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
  const dependencies = roles.slice(1).map((role, index) => ({ from: roles[index].id, to: role.id, type: 'handoff-before-review' }));
  const readyForKickoff = Boolean(String(objective).trim() && coverageGaps.length === 0);
  return {
    schemaVersion: 'super-agent-work-mode-team/v1',
    workMode: definition.id,
    objective: String(objective).trim(),
    requiredArtifacts: [...definition.requiredArtifacts],
    acceptanceChecks: [...definition.acceptanceChecks],
    escalationChecks: [...definition.escalationChecks],
    roles,
    dependencies,
    coverageGaps,
    readyForKickoff,
    status: readyForKickoff ? 'team-composed' : 'team-composition-blocked',
  };
}
