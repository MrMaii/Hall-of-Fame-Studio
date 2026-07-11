import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';

const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-user' };

test('persists project autonomy policy and fences all sessions through terminal stop', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-autonomy-governor-'));
  const filePath = join(directory, 'projects.json');
  try {
    const kickoff = createKickoffProjectFromMeeting({
      projectId: 'autonomy_governor_api_project',
      name: 'Autonomy Governor API Project',
      brief: 'Prove bounded local autonomy.',
      team: [{ id: 'manager', name: 'Manager', title: 'Project Manager', isLeader: true }],
      now: '2026-07-10T10:00:00.000Z',
    });
    kickoff.project.autonomousRunControlSessionLedger = [
      { id: 'session-running', status: 'running', checksum: 'old-running' },
      { id: 'session-waiting', status: 'waiting', checksum: 'old-waiting' },
    ];
    const store = createAgentProjectFileStore({ filePath, projects: [kickoff.project], replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });

    let response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/policies`, headers,
      body: {
        maxWallClockMs: 86_400_000, maxSteps: 10, maxCostCents: 100, maxToolInvocations: 3,
        allowedToolOperations: ['search:evidence'], actorId: 'manager', idempotencyKey: 'policy-1', now: '2026-07-10T11:00:00.000Z',
      },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const policy = response.body.policy;
    assert.equal(response.body.autonomyGovernor.state, 'active');
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/policies`, headers,
      body: {
        maxWallClockMs: 86_400_000, maxSteps: 10, maxCostCents: 100, maxToolInvocations: 3,
        allowedToolOperations: ['search:evidence'], actorId: 'manager', idempotencyKey: 'policy-1', now: '2026-07-10T11:00:30.000Z',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/commands`, headers,
      body: { command: 'pause', expectedPolicyVersion: 1, expectedPolicyChecksum: policy.checksum, actorId: 'manager', reasonCode: 'operator-pause', idempotencyKey: 'pause-1', now: '2026-07-10T11:01:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.autonomyGovernor.state, 'paused');
    assert.deepEqual(response.body.project.autonomousRunControlSessionLedger.map((row) => row.status), ['paused', 'paused']);
    assert.equal(response.body.project.autonomousRunControlSessionLedger.every((row) => row.governorPaused), true);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/commands`, headers,
      body: { command: 'pause', expectedPolicyVersion: 1, expectedPolicyChecksum: policy.checksum, actorId: 'manager', reasonCode: 'operator-pause', idempotencyKey: 'pause-1', now: '2026-07-10T11:01:30.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);

    const restartedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    api = createAgentProjectApi({ service: createAgentProjectService({ store: restartedStore }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${kickoff.project.id}/autonomy-governor`, headers: { 'x-hofs-role': 'observer', 'x-hofs-user-id': 'observer-user' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.autonomyGovernor.state, 'paused');

    response = await api.handleAsync({ method: 'GET', path: `/projects/${kickoff.project.id}/autonomous-run-control`, headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.autonomousRunControl.summary.autonomyGovernorState, 'paused');
    assert.equal(response.body.autonomousRunControl.gates.find((row) => row.id === 'local-autonomy-governor-ready').passed, false);
    assert.equal(response.body.autonomousRunControl.nextActions.every((row) => !row.canRun), true);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/commands`, headers,
      body: { command: 'resume', expectedPolicyVersion: 1, expectedPolicyChecksum: policy.checksum, actorId: 'manager', reasonCode: 'operator-resume', idempotencyKey: 'resume-1', now: '2026-07-10T11:02:00.000Z' },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.autonomyGovernor.state, 'active');
    assert.deepEqual(response.body.project.autonomousRunControlSessionLedger.map((row) => row.status), ['waiting', 'waiting']);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/commands`, headers,
      body: { command: 'stop', expectedPolicyVersion: 1, expectedPolicyChecksum: policy.checksum, actorId: 'manager', reasonCode: 'operator-stop', idempotencyKey: 'stop-1', now: '2026-07-10T11:03:00.000Z' },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.autonomyGovernor.state, 'stopped');
    assert.equal(response.body.project.autonomousRunControlSessionLedger.every((row) => row.status === 'cancelled'), true);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/commands`, headers,
      body: { command: 'resume', expectedPolicyVersion: 1, expectedPolicyChecksum: policy.checksum, actorId: 'manager', reasonCode: 'invalid-resume', idempotencyKey: 'resume-after-stop', now: '2026-07-10T11:04:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /terminal-stop/);
    const tamperedProject = restartedStore.getProject(kickoff.project.id);
    tamperedProject.localAutonomyCommands[0].command = 'pause';
    restartedStore.saveProject(tamperedProject);
    response = await api.handleAsync({ method: 'GET', path: `/projects/${kickoff.project.id}/autonomy-governor`, headers });
    assert.equal(response.body.autonomyGovernor.integrity.valid, false);
    assert.equal(response.body.autonomyGovernor.status, 'degraded-integrity-invalid');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects stale revisions and denies force execution when project governance is paused or over budget', () => {
  const access = classifyAccessRequest({ method: 'GET', path: '/projects/project-1/autonomy-governor' });
  assert.equal(access.allowedRoles.includes('observer'), true);

  const kickoff = createKickoffProjectFromMeeting({
    projectId: 'autonomy_governor_enforcement_project', name: 'Governor Enforcement', brief: 'Fail closed.',
    team: [{ id: 'manager', name: 'Manager', title: 'Project Manager', isLeader: true }], now: '2026-07-10T10:00:00.000Z',
  });
  const service = createAgentProjectService({ projects: [kickoff.project] });
  const created = service.createLocalAutonomyPolicy({
    projectId: kickoff.project.id, maxWallClockMs: 86_400_000, maxSteps: 1, maxCostCents: 5,
    maxToolInvocations: 1, allowedToolOperations: ['search:evidence'], actorId: 'manager', idempotencyKey: 'policy-1', now: '2026-07-10T11:00:00.000Z',
  });
  assert.throws(() => service.reviseLocalAutonomyPolicy({
    projectId: kickoff.project.id, expectedPolicyVersion: 0, expectedPolicyChecksum: '0'.repeat(64),
    maxWallClockMs: 86_400_000, maxSteps: 2, maxCostCents: 10, maxToolInvocations: 2,
    allowedToolOperations: ['search:evidence'], actorId: 'manager', idempotencyKey: 'policy-2', now: '2026-07-10T11:01:00.000Z',
  }), /stale-policy/);
  const revised = service.reviseLocalAutonomyPolicy({
    projectId: kickoff.project.id, policyId: created.policy.id, expectedPolicyVersion: 1, expectedPolicyChecksum: created.policy.checksum,
    maxWallClockMs: 86_400_000, maxSteps: 2, maxCostCents: 10, maxToolInvocations: 2,
    allowedToolOperations: ['search:evidence'], actorId: 'manager', idempotencyKey: 'policy-2', now: '2026-07-10T11:01:00.000Z',
  });
  assert.equal(revised.policy.version, 2);
  assert.equal(revised.autonomyGovernor.integrity.valid, true);
  service.commandLocalAutonomy({
    projectId: kickoff.project.id, command: 'pause', expectedPolicyVersion: 2, expectedPolicyChecksum: revised.policy.checksum,
    actorId: 'manager', reasonCode: 'operator-pause', idempotencyKey: 'pause-1', now: '2026-07-10T11:02:00.000Z',
  });
  assert.throws(() => service.assertLocalAutonomyExecution(kickoff.project.id, { now: '2026-07-10T11:03:00.000Z', requestedSteps: 1 }), /autonomy-paused/);
  assert.throws(() => service.runAutonomousRunControlAction({ projectId: kickoff.project.id, actionId: 'next', force: true, now: '2026-07-10T11:03:00.000Z' }), /autonomy-paused/);
});
