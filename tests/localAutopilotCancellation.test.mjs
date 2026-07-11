import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';
import { acquireLocalDurableTaskLease, enqueueLocalDurableTask } from '../src/agents/localDurableTaskQueue.js';

const projectId = 'local_autopilot_cancellation_project';
const sessionId = 'local_autopilot_cancellation_session';
const startedAt = '2026-07-10T10:00:00.000Z';

function createSeed() {
  return createKickoffProjectFromMeeting({
    projectId,
    name: 'Local cancellation project',
    brief: 'Prove that a local operator can permanently cancel an Autopilot session.',
    now: startedAt,
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
}

function providerEvidenceProject(seed) {
  const providerTaskId = 'local_cancellation_provider_task';
  const leaderState = seed.project.agentStates?.leader || {};
  return {
    ...seed.project,
    tasks: [{
      id: providerTaskId,
      text: 'Collect provider-backed evidence for cancellation propagation.',
      assignee: 'Ada Lovelace',
      ownerId: 'leader',
      status: 'in-progress',
      workPulseCount: 1,
    }],
    agentStates: {
      ...seed.project.agentStates,
      leader: {
        ...leaderState,
        currentPlan: { ...(leaderState.currentPlan || {}), taskId: providerTaskId, focus: 'Collect provider-backed evidence.' },
        obligations: [{ id: 'local_cancellation_provider_obligation', taskId: providerTaskId, text: 'Collect evidence.', status: 'open' }],
      },
    },
  };
}

function providerPolicy() {
  return {
    enabled: true,
    mode: 'enforced',
    allowedSearchProviders: ['local-test-search'],
    defaultToolGrants: ['search:evidence'],
    maxRequestsPerProjectHour: 10,
    dailyBudgetCents: 100,
    searchCostCentsPerRequest: 1,
    retryAttempts: 0,
    circuitFailureThreshold: 3,
    circuitWindowMinutes: 15,
    circuitCooldownSeconds: 300,
  };
}

test('keeps a cancelled file-backed Autopilot session terminal after restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-cancel-'));
  const filePath = join(directory, 'projects.json');
  try {
    const seed = createSeed();
    const store = createAgentProjectFileStore({
      filePath,
      projects: [seed.project],
      messages: seed.messages,
      hydrateProject: hydrateAgentProject,
      replaceWithSeed: true,
    });
    const service = createAgentProjectService({ store });
    service.startAutonomousRunControlSession({
      projectId,
      sessionId,
      now: startedAt,
      maxLoops: 2,
      maxStepsPerLoop: 1,
      maxTotalSteps: 2,
      forceNewSession: true,
    });

    const cancelled = service.cancelAutonomousRunControlSession({
      projectId,
      sessionId,
      actor: 'Local operator',
      reason: 'operator cancelled delivery',
      now: '2026-07-10T10:01:00.000Z',
    });
    assert.equal(cancelled.route, 'autonomous-run-control-session-cancelled');
    assert.equal(cancelled.autonomousRunControlSession.status, 'cancelled');
    assert.equal(cancelled.autonomousRunControlSession.cancelledBy, 'Local operator');

    const restartedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const restarted = createAgentProjectService({ store: restartedStore });
    const due = restarted.runDueAutonomousRunControlSessions({ now: '2026-07-10T10:02:00.000Z' });
    assert(due.skipped.some((row) => row.reason === 'autopilot-no-active-session'));
    assert.equal(restarted.getAutonomousRunControlSessions(projectId).sessions[0].status, 'cancelled');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('passes the active Autopilot cancellation signal to a local provider-evidence request', async () => {
  let receivedSignal = null;
  const seed = createSeed();
  const service = createAgentProjectService({
    projects: [providerEvidenceProject(seed)],
    messages: seed.messages,
    providerPolicy: providerPolicy(),
    searchProvider: {
      status: () => ({
        provider: 'local-test-search',
        enabled: true,
        configured: true,
        runtimeEnabled: true,
        apiKeySource: 'not-required',
        hasEndpoint: true,
      }),
      search: async ({ signal }) => {
        receivedSignal = signal;
        return {
          ok: true,
          provider: 'local-test-search',
          searchMode: 'local-test',
          sources: [],
          findings: [],
          confidence: 'high',
        };
      },
    },
  });
  service.startAutonomousRunControlSession({
    projectId,
    sessionId,
    now: startedAt,
    maxLoops: 1,
    maxStepsPerLoop: 1,
    maxTotalSteps: 1,
    forceNewSession: true,
  });

  await service.tickAutonomousRunControlSessionWithProviderEvidence({
    projectId,
    sessionId,
    now: '2026-07-10T10:01:00.000Z',
    force: true,
    requestBodyOverrides: { useProviderEvidenceSearch: true },
  });

  assert.ok(receivedSignal, 'The local provider must receive a cancellation signal for an Autopilot tick.');
});

test('cancellation aborts an active local provider-evidence tick before it writes fallback work', async () => {
  let releaseSearchStarted = null;
  const searchStarted = new Promise((resolve) => { releaseSearchStarted = resolve; });
  let observedAbort = false;
  const seed = createSeed();
  const service = createAgentProjectService({
    projects: [providerEvidenceProject(seed)],
    messages: seed.messages,
    providerPolicy: providerPolicy(),
    searchProvider: {
      status: () => ({
        provider: 'local-test-search',
        enabled: true,
        configured: true,
        runtimeEnabled: true,
        apiKeySource: 'not-required',
        hasEndpoint: true,
      }),
      search: ({ signal }) => new Promise((resolve) => {
        releaseSearchStarted();
        signal.addEventListener('abort', () => {
          observedAbort = true;
          resolve({ ok: false, error: 'search request aborted' });
        }, { once: true });
      }),
    },
  });
  service.startAutonomousRunControlSession({
    projectId,
    sessionId,
    now: startedAt,
    maxLoops: 1,
    maxStepsPerLoop: 1,
    maxTotalSteps: 1,
    forceNewSession: true,
  });

  const tick = service.tickAutonomousRunControlSessionWithProviderEvidence({
    projectId,
    sessionId,
    now: '2026-07-10T10:01:00.000Z',
    force: true,
    requestBodyOverrides: { useProviderEvidenceSearch: true },
  });
  await searchStarted;
  const cancelled = service.cancelAutonomousRunControlSession({
    projectId,
    sessionId,
    actor: 'Local operator',
    reason: 'stop waiting for evidence',
    now: '2026-07-10T10:01:01.000Z',
  });

  assert.equal(cancelled.autonomousRunControlSession.cancellationAbortRequested, true);
  await assert.rejects(tick, /autopilot-session-cancelled/);
  assert.equal(observedAbort, true);
  const project = service.getProject(projectId);
  assert.equal(project.autonomousRunControlSessionLedger[0].status, 'cancelled');
  assert.equal((project.evidenceSearches || []).length, 0);
  assert.equal(project.providerBudgetReservations.filter((row) => row.status === 'active').length, 0);
  assert.equal(project.providerBudgetReservations.filter((row) => row.status === 'released').length, 1);
});

test('durable queue cancellation aborts an active Provider wait and fences its late worker', async () => {
  let releaseSearchStarted = null;
  const searchStarted = new Promise((resolve) => { releaseSearchStarted = resolve; });
  let observedAbort = false;
  const seed = createSeed();
  const service = createAgentProjectService({
    projects: [providerEvidenceProject(seed)],
    messages: seed.messages,
    providerPolicy: providerPolicy(),
    searchProvider: {
      status: () => ({ provider: 'local-test-search', enabled: true, configured: true, runtimeEnabled: true, apiKeySource: 'not-required', hasEndpoint: true }),
      search: ({ signal }) => new Promise((resolve) => {
        releaseSearchStarted();
        signal.addEventListener('abort', () => {
          observedAbort = true;
          resolve({ ok: false, error: 'search request aborted' });
        }, { once: true });
      }),
    },
  });
  const queued = enqueueLocalDurableTask({
    rows: [],
    job: {
      projectId, workerKind: 'agent-worker', agentId: 'leader', idempotencyKey: 'durable-provider-cancel',
      runApiPath: `/projects/${projectId}/agents/leader/work-cycle`, requestBody: { taskId: 'local_cancellation_provider_task' },
      dueAt: '2026-07-10T10:01:00.000Z', maxAttempts: 3,
    },
    now: startedAt,
  });
  const leased = acquireLocalDurableTaskLease({ rows: queued.rows, jobId: queued.job.id, workerId: 'provider-worker', now: '2026-07-10T10:01:00.000Z', nonce: 'provider-lease' });
  service.replaceProject({ ...service.getProject(projectId), localDurableTaskQueue: leased.rows });
  const run = service.runAgentAutonomousActionQueueItemWithProviderEvidence({
    projectId, agentId: 'leader', now: '2026-07-10T10:01:00.000Z', force: true,
    durableTaskJobId: leased.job.id, durableTaskFenceToken: leased.job.fenceToken,
    requestBodyOverrides: { useProviderEvidenceSearch: true },
  });
  await searchStarted;
  const cancelled = service.cancelDurableTaskQueueJob({
    projectId, jobId: leased.job.id, actorId: 'security-admin', reason: 'Stop active Provider wait.', now: '2026-07-10T10:01:01.000Z',
  });
  assert.equal(cancelled.cancellationSignalDelivered, true);
  assert.equal(cancelled.durableTask.status, 'cancelled');
  await assert.rejects(run, /local-durable-task-cancelled/);
  assert.equal(observedAbort, true);
  const cancelledProject = service.getProject(projectId);
  assert.equal(cancelledProject.localDurableTaskQueue[0].status, 'cancelled');
  assert.equal(cancelledProject.localIdempotentExecutionLedger.some((row) => row.status === 'ambiguous'), true);
});

test('exposes terminal Autopilot cancellation through the local project API', () => {
  const seed = createSeed();
  const service = createAgentProjectService({ projects: [seed.project], messages: seed.messages });
  service.startAutonomousRunControlSession({
    projectId,
    sessionId,
    now: startedAt,
    maxLoops: 1,
    maxStepsPerLoop: 1,
    maxTotalSteps: 1,
    forceNewSession: true,
  });
  const api = createAgentProjectApi({ service });

  const response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/autonomous-run-control/sessions/${sessionId}/cancel`,
    body: {
      actor: 'Local operator',
      reason: 'cancel through local API',
      now: '2026-07-10T10:01:00.000Z',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.autonomousRunControlSession.status, 'cancelled');
  assert.equal(response.body.autonomousRunControlSession.cancellationReason, 'cancel through local API');
});
