import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPER_AGENT_WORK_MODES,
  composeWorkModeTeam,
  evaluateWorkModeAcceptance,
  getSuperAgentWorkMode,
} from '../src/agents/workModes.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

test('defines five professional work modes with distinct artifacts, acceptance checks, and escalation checks', () => {
  assert.equal(Object.keys(SUPER_AGENT_WORK_MODES).length, 5);
  for (const mode of Object.values(SUPER_AGENT_WORK_MODES)) {
    assert.ok(mode.requiredRoles.length >= 3);
    assert.ok(mode.requiredArtifacts.length >= 3);
    assert.ok(mode.acceptanceChecks.length >= 2);
    assert.ok(mode.escalationChecks.length >= 1);
  }
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
