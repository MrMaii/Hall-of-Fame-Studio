import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUPER_AGENT_WORK_MODES,
  composeWorkModeTeam,
  evaluateWorkModeAcceptance,
  getSuperAgentWorkMode,
  validateWorkModeDependencyGraph,
} from '../src/agents/workModes.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService, reviewAgentSubmission, submitAgentArtifact } from '../src/agents/agentProjectService.js';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('defines five professional work modes with distinct artifacts, acceptance checks, and escalation checks', () => {
  assert.equal(Object.keys(SUPER_AGENT_WORK_MODES).length, 5);
  for (const mode of Object.values(SUPER_AGENT_WORK_MODES)) {
    assert.ok(mode.requiredRoles.length >= 3);
    assert.ok(mode.requiredArtifacts.length >= 3);
    assert.ok(mode.acceptanceChecks.length >= 2);
    assert.ok(mode.escalationChecks.length >= 1);
  }
});

test('does not permit a work mode to fall back to a browser-only project without its contract', () => {
  assert.match(appSource, /if \(confirmedKickoffPayload\.workMode \|\| !isDevelopmentInitiationFallbackEnabled\(\)\)/);
  assert.match(appSource, /Work-mode initiation requires the local backend/);
});

test('creates a learning team with mastery and academic-integrity gates', () => {
  const team = composeWorkModeTeam({
    workMode: 'learning',
    objective: 'Build a study plan for calculus.',
  });
  assert.equal(team.readyForKickoff, true);
  assert.equal(team.requiredArtifacts.includes('mastery-check'), true);
  assert.equal(team.escalationChecks.some((check) => check.id === 'academic-integrity'), true);
  assert.equal(team.roles.some((role) => role.lane === 'research_synthesis'), true);
});

test('creates an academic-writing team with citation and revision lineage gates', () => {
  const team = composeWorkModeTeam({
    workMode: 'academic-writing',
    objective: 'Write a cited literature review on agent evaluation.',
  });
  assert.equal(team.requiredArtifacts.includes('claim-citation-graph'), true);
  assert.equal(team.acceptanceChecks.some((check) => check.id === 'citation-coverage'), true);
  assert.equal(team.roles.some((role) => role.lane === 'copywriting'), true);
});

test('creates an investigation team with hypothesis and contradiction controls', () => {
  const team = composeWorkModeTeam({
    workMode: 'investigation',
    objective: 'Investigate why a service deployment regressed.',
  });
  assert.equal(team.requiredArtifacts.includes('contradiction-matrix'), true);
  assert.equal(team.escalationChecks.some((check) => check.id === 'claim-beyond-evidence'), true);
});

test('creates a technical-delivery team with security and rollback controls', () => {
  const team = composeWorkModeTeam({
    workMode: 'technical-delivery',
    objective: 'Ship a reliable API change.',
  });
  assert.equal(team.requiredArtifacts.includes('rollback-plan'), true);
  assert.equal(team.acceptanceChecks.some((check) => check.id === 'tests-and-review'), true);
  assert.equal(team.escalationChecks.some((check) => check.id === 'security-release'), true);
  assert.equal(team.dependencyDag.acyclic, true);
  assert.equal(team.taskNodes.length, team.requiredArtifacts.length);
  assert.ok(team.taskNodes.every((task) => task.ownerPersonaSlug && task.reviewerPersonaSlug));
  assert.ok(team.taskNodes.every((task) => task.ownerPersonaSlug !== task.reviewerPersonaSlug));
});

test('creates a creative-studio team with licensing and provenance controls', () => {
  const team = composeWorkModeTeam({
    workMode: 'creative-studio',
    objective: 'Create an illustrated launch campaign.',
  });
  assert.equal(team.requiredArtifacts.includes('rights-provenance-register'), true);
  assert.equal(team.acceptanceChecks.some((check) => check.id === 'rights-declared'), true);
});

test('reports coverage gaps instead of inventing a specialist when the allowed persona set is insufficient', () => {
  const team = composeWorkModeTeam({
    workMode: 'technical-delivery',
    objective: 'Ship an API.',
    availablePersonaSlugs: ['chanel'],
  });
  assert.equal(team.readyForKickoff, false);
  assert.ok(team.coverageGaps.length > 0);
  assert.equal(getSuperAgentWorkMode('unknown'), null);
});

test('blocks a team that contains a dependency cycle and identifies the escalation owner', () => {
  const team = composeWorkModeTeam({
    workMode: 'learning',
    objective: 'Build a study plan.',
    additionalDependencies: [
      { from: 'learning-lead', to: 'subject-researcher', type: 'custom' },
      { from: 'subject-researcher', to: 'learning-lead', type: 'custom' },
    ],
  });
  assert.equal(team.readyForKickoff, false);
  assert.equal(team.dependencyDag.acyclic, false);
  assert.ok(team.blockers.includes('dependency-cycle'));
  assert.ok(team.escalationPlan.every((item) => item.ownerRoleId === 'learning-lead'));
  assert.equal(validateWorkModeDependencyGraph(team.dependencies, team.roles.map((role) => role.id)).acyclic, false);
});

test('treats a self dependency as a cycle instead of silently dropping it', () => {
  const team = composeWorkModeTeam({
    workMode: 'learning',
    objective: 'Build a study plan.',
    additionalDependencies: [{ from: 'learning-lead', to: 'learning-lead' }],
  });
  assert.equal(team.readyForKickoff, false);
  assert.deepEqual(team.dependencyDag.cycle, ['learning-lead', 'learning-lead']);
});

test('exposes work-mode composition through both API dispatch paths', async () => {
  const api = createAgentProjectApi({ service: createAgentProjectService() });
  const request = {
    method: 'POST',
    path: '/work-modes/technical-delivery/team',
    body: { objective: 'Ship an API safely.' },
  };
  for (const response of [api.handle(request), await api.handleAsync(request)]) {
    assert.equal(response.status, 200);
    assert.equal(response.body.workModeTeam.workMode, 'technical-delivery');
    assert.equal(response.body.workModeTeam.readyForKickoff, true);
  }
});

test('persists a work-mode contract and its artifact tasks when a project is initiated', () => {
  const api = createAgentProjectApi({ service: createAgentProjectService() });
  const response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      projectId: 'academic_writing_project',
      name: 'Academic Writing Project',
      brief: 'Draft a cited literature review.',
      workMode: 'academic-writing',
      includeReadModels: false,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.project.workModeContract.workMode, 'academic-writing');
  assert.equal(response.body.project.workModeContract.readyForKickoff, true);
  assert.equal(response.body.project.tasks.some((task) => task.artifactType === 'claim-citation-graph'), true);
  assert.ok(response.body.project.tasks.every((task) => Array.isArray(task.dependsOn)));
  assert.ok(response.body.project.tasks.every((task) => task.reviewerId && task.reviewerId !== task.assignee));
});

test('starts a product-team mission with the governed work-mode roster instead of caller-selected members', () => {
  const api = createAgentProjectApi({ service: createAgentProjectService() });
  const response = api.handle({
    method: 'POST',
    path: '/product-team-missions',
    body: {
      projectId: 'governed_mission_project',
      name: 'Governed technical mission',
      brief: 'Ship a reliable local API change.',
      workMode: 'technical-delivery',
      team: [{ id: 'caller-selected-agent', name: 'Caller Selected Agent' }],
      selectedTeamIds: ['caller-selected-agent'],
      selectedLeaderId: 'caller-selected-agent',
      reviewerId: 'caller-selected-agent',
      reuseExistingKickoffMeeting: true,
      kickoffMeetingId: 'untrusted-existing-meeting',
      startAutopilot: false,
      includeReadModels: false,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.project.workModeContract.workMode, 'technical-delivery');
  assert.equal(response.body.productTeamMissionRun.workMode, 'technical-delivery');
  assert.equal(response.body.productTeamMissionRun.reusedKickoffMeeting, false);
  assert.equal(response.body.project.team.some((member) => member.id === 'caller-selected-agent'), false);
  assert.deepEqual(
    response.body.project.team.map((member) => member.id).sort(),
    response.body.project.workModeContract.roles.map((role) => role.personaSlug).sort(),
  );
  assert.ok(response.body.project.tasks.every((task) => task.reviewerId && task.reviewerId !== task.assignee));
});

test('rejects a project initiation whose submitted role dependencies are cyclic', () => {
  const api = createAgentProjectApi({ service: createAgentProjectService() });
  const response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      projectId: 'cyclic_work_mode_project',
      name: 'Cyclic work mode project',
      brief: 'Build a study plan.',
      workMode: 'learning',
      additionalDependencies: [
        { from: 'learning-lead', to: 'subject-researcher' },
        { from: 'subject-researcher', to: 'learning-lead' },
      ],
    },
  });
  assert.equal(response.status, 422);
  assert.ok(response.body.workModeTeam.blockers.includes('dependency-cycle'));
});

test('does not let caller-supplied task ownership bypass a work-mode contract', () => {
  const api = createAgentProjectApi({ service: createAgentProjectService() });
  const response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      projectId: 'governed_custom_task_project',
      name: 'Governed custom task project',
      brief: 'Draft a cited literature review.',
      workMode: 'academic-writing',
      tasks: [{
        id: 'caller_outline',
        artifactType: 'outline',
        text: 'Use this custom outline title.',
        assignee: 'caller-selected-agent',
        reviewerId: 'caller-selected-reviewer',
        dependsOn: ['untrusted-task'],
      }],
    },
  });
  assert.equal(response.status, 200);
  const outline = response.body.project.tasks.find((task) => task.artifactType === 'outline');
  assert.equal(outline.text, 'Use this custom outline title.');
  assert.notEqual(outline.assignee, 'caller-selected-agent');
  assert.notEqual(outline.reviewerId, 'caller-selected-reviewer');
  assert.deepEqual(outline.dependsOn, []);
});

test('does not accept a work-mode project until every required artifact and mode-specific review is present', () => {
  const contract = composeWorkModeTeam({ workMode: 'technical-delivery', objective: 'Ship an API safely.' });
  const blocked = evaluateWorkModeAcceptance({ workModeContract: contract, submissions: [] });
  const ready = evaluateWorkModeAcceptance({
    workModeContract: contract,
    submissions: contract.requiredArtifacts.map((artifactType) => ({ artifactType, reviewStatus: 'accepted' })),
    resolvedEscalationIds: ['security-release', 'irreversible-change'],
  });
  assert.equal(blocked.readyForAcceptance, false);
  assert.equal(blocked.missingArtifacts.includes('test-evidence'), true);
  assert.equal(ready.readyForAcceptance, true);
});

test('enforces work-mode task ownership, independent review, and accepted task prerequisites', () => {
  const contract = composeWorkModeTeam({ workMode: 'learning', objective: 'Build a study plan.' });
  const [owner, reviewer] = [
    { id: 'owner', name: 'Owner', role: 'subject-researcher', isLeader: true },
    { id: 'reviewer', name: 'Reviewer', role: 'learning-reviewer' },
  ];
  const project = {
    id: 'governed_work_mode_project',
    workModeContract: contract,
    team: [owner, reviewer],
    tasks: [
      { id: 'learning-plan', artifactType: 'learning-plan', assignee: owner.id, reviewerId: reviewer.id, dependsOn: [], status: 'pending' },
      { id: 'practice-set', artifactType: 'practice-set', assignee: owner.id, reviewerId: reviewer.id, dependsOn: ['learning-plan'], status: 'pending' },
    ],
    agentSubmissions: [],
    submissionReviews: [],
    logs: [],
    messages: [],
  };
  assert.throws(() => submitAgentArtifact({
    project,
    agentId: reviewer.id,
    taskId: 'learning-plan',
    artifactType: 'learning-plan',
  }), /task-owner-required/);
  assert.throws(() => submitAgentArtifact({
    project,
    agentId: owner.id,
    taskId: 'practice-set',
    artifactType: 'practice-set',
  }), /task-dependency-not-accepted/);

  const submitted = submitAgentArtifact({
    project,
    agentId: owner.id,
    taskId: 'learning-plan',
    artifactType: 'learning-plan',
    reviewerAgentId: reviewer.id,
  });
  assert.equal(submitted.submission.artifactType, 'learning-plan');
  assert.throws(() => reviewAgentSubmission({
    project: submitted.project,
    submissionId: submitted.submission.id,
    reviewerAgentId: owner.id,
    verdict: 'accepted',
  }), /task-reviewer-required/);
  const reviewed = reviewAgentSubmission({
    project: submitted.project,
    submissionId: submitted.submission.id,
    reviewerAgentId: reviewer.id,
    verdict: 'accepted',
  });
  assert.equal(reviewed.submission.reviewStatus, 'accepted');
});

test('records a work-mode escalation resolution through the backend before acceptance can pass', () => {
  const api = createAgentProjectApi({ service: createAgentProjectService() });
  const initiated = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      projectId: 'work_mode_escalation_resolution',
      name: 'Work mode escalation resolution',
      brief: 'Build a study plan.',
      workMode: 'learning',
    },
  });
  assert.equal(initiated.status, 200);
  const resolution = api.handle({
    method: 'POST',
    path: '/projects/work_mode_escalation_resolution/work-mode-escalations/academic-integrity/resolve',
    body: {
      actorId: initiated.body.project.workModeContract.escalationPlan.find((item) => item.id === 'academic-integrity').ownerPersonaSlug,
      reason: 'Confirmed learner-owned work and citation boundary.',
    },
  });
  assert.equal(resolution.status, 200);
  assert.equal(resolution.body.workModeEscalationResolution.escalationId, 'academic-integrity');
  assert.ok(resolution.body.project.resolvedWorkModeEscalationIds.includes('academic-integrity'));
});
