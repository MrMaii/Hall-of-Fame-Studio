import { PERSON_SKILLS, getPersonaCapabilityProfile } from '../skills/personSkillSystem.js';

const mode = ({ id, label, requiredRoles, requiredArtifacts, acceptanceChecks, escalationChecks }) => Object.freeze({
  id,
  label,
  requiredRoles: Object.freeze(requiredRoles.map((role) => Object.freeze(role))),
  requiredArtifacts: Object.freeze(requiredArtifacts),
  acceptanceChecks: Object.freeze(acceptanceChecks.map((check) => Object.freeze(check))),
  escalationChecks: Object.freeze(escalationChecks.map((check) => Object.freeze(check))),
});

export const SUPER_AGENT_WORK_MODES = Object.freeze({
  learning: mode({
    id: 'learning', label: 'Student learning',
    requiredRoles: [{ id: 'learning-lead', lane: 'project_management' }, { id: 'subject-researcher', lane: 'research_synthesis' }, { id: 'learning-reviewer', lane: 'risk_review' }],
    requiredArtifacts: ['learning-plan', 'practice-set', 'mastery-check'],
    acceptanceChecks: [{ id: 'pacing-evidence' }, { id: 'mastery-evidence' }],
    escalationChecks: [{ id: 'academic-integrity' }, { id: 'learner-wellbeing' }],
  }),
  'academic-writing': mode({
    id: 'academic-writing', label: 'Academic writing',
    requiredRoles: [{ id: 'writing-lead', lane: 'project_management' }, { id: 'literature-researcher', lane: 'research_synthesis' }, { id: 'argument-editor', lane: 'copywriting' }, { id: 'citation-reviewer', lane: 'risk_review' }],
    requiredArtifacts: ['outline', 'claim-citation-graph', 'revision-lineage'],
    acceptanceChecks: [{ id: 'citation-coverage' }, { id: 'claim-support' }, { id: 'revision-reviewed' }],
    escalationChecks: [{ id: 'academic-integrity' }, { id: 'unsupported-claim' }],
  }),
  investigation: mode({
    id: 'investigation', label: 'Investigation',
    requiredRoles: [{ id: 'investigation-lead', lane: 'project_management' }, { id: 'evidence-investigator', lane: 'research_synthesis' }, { id: 'causal-analyst', lane: 'market_research' }, { id: 'risk-reviewer', lane: 'risk_review' }],
    requiredArtifacts: ['hypothesis-register', 'source-custody-log', 'contradiction-matrix'],
    acceptanceChecks: [{ id: 'source-reliability' }, { id: 'contradictions-resolved' }],
    escalationChecks: [{ id: 'claim-beyond-evidence' }, { id: 'sensitive-data' }],
  }),
  'technical-delivery': mode({
    id: 'technical-delivery', label: 'Technical delivery',
    requiredRoles: [{ id: 'delivery-lead', lane: 'project_management' }, { id: 'systems-engineer', lane: 'engineering_breakdown' }, { id: 'quality-security-reviewer', lane: 'risk_review' }, { id: 'product-owner', lane: 'product_design' }],
    requiredArtifacts: ['implementation-plan', 'test-evidence', 'rollback-plan'],
    acceptanceChecks: [{ id: 'tests-and-review' }, { id: 'rollback-ready' }, { id: 'requirements-traceable' }],
    escalationChecks: [{ id: 'security-release' }, { id: 'irreversible-change' }],
  }),
  'creative-studio': mode({
    id: 'creative-studio', label: 'Creative studio',
    requiredRoles: [{ id: 'creative-lead', lane: 'brand_story' }, { id: 'art-director', lane: 'product_design' }, { id: 'audience-researcher', lane: 'user_interview' }, { id: 'rights-reviewer', lane: 'risk_review' }],
    requiredArtifacts: ['creative-brief', 'critique-log', 'rights-provenance-register'],
    acceptanceChecks: [{ id: 'brief-satisfied' }, { id: 'rights-declared' }, { id: 'critique-addressed' }],
    escalationChecks: [{ id: 'licensing-uncertain' }, { id: 'sensitive-representation' }],
  }),
});

export function getSuperAgentWorkMode(id) {
  return SUPER_AGENT_WORK_MODES[id] || null;
}

export function validateWorkModeDependencyGraph(dependencies = [], nodeIds = []) {
  const known = new Set((nodeIds || []).filter(Boolean).map(String));
  const graph = new Map([...known].map((id) => [id, []]));
  const unknownNodeIds = [];
  (Array.isArray(dependencies) ? dependencies : []).forEach((dependency) => {
    const from = String(dependency?.from || '');
    const to = String(dependency?.to || '');
    if (!known.has(from) || !known.has(to)) {
      unknownNodeIds.push(...[from, to].filter((id) => id && !known.has(id)));
      return;
    }
    graph.get(from).push(to);
  });
  const states = new Map();
  const stack = [];
  let cycle = [];
  const visit = (id) => {
    if (states.get(id) === 'visiting') {
      cycle = [...stack.slice(stack.indexOf(id)), id];
      return false;
    }
    if (states.get(id) === 'visited') return true;
    states.set(id, 'visiting');
    stack.push(id);
    for (const next of graph.get(id) || []) {
      if (!visit(next)) return false;
    }
    stack.pop();
    states.set(id, 'visited');
    return true;
  };
  const acyclic = [...known].every(visit);
  return {
    schemaVersion: 'super-agent-work-mode-dependency-dag/v1',
    acyclic,
    cycle,
    unknownNodeIds: [...new Set(unknownNodeIds)],
    nodeCount: known.size,
    edgeCount: (Array.isArray(dependencies) ? dependencies : []).length,
  };
}

function selectPersona(lane, availablePersonaSlugs, alreadySelected) {
  return availablePersonaSlugs
    .filter((slug) => PERSON_SKILLS[slug] && !alreadySelected.has(slug))
    .map((slug) => ({ slug, profile: getPersonaCapabilityProfile(slug) }))
    .map(({ slug, profile }) => ({ slug, profile, score: profile.weights[lane] || 0 }))
    .filter((candidate) => candidate.score >= 70)
    .sort((left, right) => right.score - left.score || left.slug.localeCompare(right.slug))[0] || null;
}

export function composeWorkModeTeam({
  workMode,
  objective = '',
  availablePersonaSlugs = Object.keys(PERSON_SKILLS),
  additionalDependencies = [],
} = {}) {
  const definition = getSuperAgentWorkMode(workMode);
  if (!definition) return { schemaVersion: 'super-agent-work-mode-team/v1', workMode: workMode || null, readyForKickoff: false, reason: 'work-mode-unknown', roles: [], coverageGaps: ['work-mode'] };
  const selected = new Set();
  const coverageGaps = [];
  const roles = definition.requiredRoles.map((requiredRole) => {
    const candidate = selectPersona(requiredRole.lane, availablePersonaSlugs, selected);
    if (!candidate) {
      coverageGaps.push(requiredRole.id);
      return { ...requiredRole, personaSlug: null, capabilityScore: 0, status: 'coverage-gap' };
    }
    selected.add(candidate.slug);
    return {
      ...requiredRole,
      personaSlug: candidate.slug,
      capabilityScore: candidate.score,
      realWorldEdge: candidate.profile.edge,
      status: 'assigned',
    };
  });
  const lead = roles.find((role) => role.id.includes('lead')) || roles[0] || null;
  const reviewerRoles = roles.filter((role) => role.id.includes('reviewer'));
  const executionRoles = roles.filter((role) => !reviewerRoles.includes(role));
  const dependencies = [
    ...executionRoles
      .filter((role) => role.id !== lead?.id)
      .map((role) => ({ from: lead?.id, to: role.id, type: 'lead-brief' })),
    ...executionRoles.flatMap((role) => reviewerRoles.map((reviewer) => ({
      from: role.id,
      to: reviewer.id,
      type: 'independent-review-before-acceptance',
    }))),
    ...(Array.isArray(additionalDependencies) ? additionalDependencies.map((dependency) => ({
      from: String(dependency?.from || ''),
      to: String(dependency?.to || ''),
      type: dependency?.type || 'custom',
    })) : []),
  ].filter((dependency) => dependency.from && dependency.to);
  const dependencyDag = validateWorkModeDependencyGraph(dependencies, roles.map((role) => role.id));
  const reviewerPersonaSlugs = reviewerRoles.map((role) => role.personaSlug).filter(Boolean);
  const executionPersonaSlugs = executionRoles.map((role) => role.personaSlug).filter(Boolean);
  const reviewerIndependent = reviewerPersonaSlugs.length > 0
    && reviewerPersonaSlugs.every((slug) => !executionPersonaSlugs.includes(slug));
  const taskNodes = definition.requiredArtifacts.map((artifactType, index) => {
    const owner = executionRoles[index % Math.max(1, executionRoles.length)] || null;
    const reviewer = reviewerRoles[index % Math.max(1, reviewerRoles.length)] || null;
    return {
      id: artifactType,
      artifactType,
      ownerRoleId: owner?.id || null,
      ownerPersonaSlug: owner?.personaSlug || null,
      reviewerRoleId: reviewer?.id || null,
      reviewerPersonaSlug: reviewer?.personaSlug || null,
      dependsOn: index ? [definition.requiredArtifacts[index - 1]] : [],
      acceptanceChecks: [...definition.acceptanceChecks],
    };
  });
  const blockers = [
    !String(objective).trim() ? 'objective-missing' : null,
    ...coverageGaps.map((roleId) => `role-coverage-gap:${roleId}`),
    !reviewerIndependent ? 'reviewer-independence-missing' : null,
    !dependencyDag.acyclic ? 'dependency-cycle' : null,
    dependencyDag.unknownNodeIds.length ? 'dependency-reference-invalid' : null,
    ...taskNodes.some((task) => !task.ownerPersonaSlug || !task.reviewerPersonaSlug || task.ownerPersonaSlug === task.reviewerPersonaSlug)
      ? ['task-review-assignment-invalid']
      : [],
  ].filter(Boolean);
  const escalationPlan = definition.escalationChecks.map((check) => ({
    ...check,
    ownerRoleId: lead?.id || null,
    ownerPersonaSlug: lead?.personaSlug || null,
    status: 'requires-decision-if-triggered',
  }));
  const readyForKickoff = blockers.length === 0;
  return {
    schemaVersion: 'super-agent-work-mode-team/v1',
    workMode: definition.id,
    objective: String(objective).trim(),
    requiredArtifacts: [...definition.requiredArtifacts],
    acceptanceChecks: [...definition.acceptanceChecks],
    escalationChecks: [...definition.escalationChecks],
    roles,
    dependencies,
    dependencyDag,
    taskNodes,
    reviewerIndependence: {
      required: true,
      satisfied: reviewerIndependent,
      reviewerPersonaSlugs,
      executionPersonaSlugs,
    },
    coverageGaps,
    blockers,
    escalationPlan,
    readyForKickoff,
    status: readyForKickoff ? 'team-composed' : 'team-composition-blocked',
  };
}

export function evaluateWorkModeAcceptance({
  workModeContract = null,
  submissions = [],
  resolvedEscalationIds = [],
} = {}) {
  if (workModeContract?.schemaVersion !== 'super-agent-work-mode-team/v1') {
    return { schemaVersion: 'super-agent-work-mode-acceptance/v1', readyForAcceptance: false, reason: 'work-mode-contract-missing', missingArtifacts: [], unresolvedEscalations: [] };
  }
  const acceptedArtifacts = new Set((Array.isArray(submissions) ? submissions : [])
    .filter((submission) => submission?.reviewStatus === 'accepted')
    .map((submission) => submission.artifactType));
  const missingArtifacts = (workModeContract.requiredArtifacts || []).filter((artifact) => !acceptedArtifacts.has(artifact));
  const resolved = new Set(resolvedEscalationIds || []);
  const unresolvedEscalations = (workModeContract.escalationChecks || [])
    .map((check) => check.id)
    .filter((id) => !resolved.has(id));
  return {
    schemaVersion: 'super-agent-work-mode-acceptance/v1',
    workMode: workModeContract.workMode,
    missingArtifacts,
    unresolvedEscalations,
    acceptedArtifactCount: acceptedArtifacts.size,
    readyForAcceptance: missingArtifacts.length === 0 && unresolvedEscalations.length === 0,
  };
}
