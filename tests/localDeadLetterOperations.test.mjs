import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, createKickoffProjectFromMeeting, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { acquireLocalDurableTaskLease, enqueueLocalDurableTask, failLocalDurableTask } from '../src/agents/localDurableTaskQueue.js';

const projectId = 'local_dead_letter_operations';
const securityHeaders = { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'dead-letter-security-admin' };

function createFixture(directory, { durable = false } = {}) {
  const seed = createKickoffProjectFromMeeting({
    projectId, name: 'Local dead-letter operations', brief: 'Recover failed local work only after an explicit operator decision.',
    now: '2026-07-10T17:00:00.000Z',
    team: [{ id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' }, { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' }],
  });
  let project = {
    ...seed.project,
    agentWorkerLedger: durable ? [] : ['replay', 'close'].map((suffix, index) => ({
      id: `legacy_failed_${suffix}`, projectId, workerKind: 'agent-worker', agentId: 'leader',
      status: 'failed', executionStatus: 'failed', attemptCount: 3, reason: `legacy-failure-${index}`,
      ranAt: `2026-07-10T17:0${index + 1}:00.000Z`, completedAt: `2026-07-10T17:0${index + 1}:00.000Z`,
    })),
  };
  if (durable) {
    const queued = enqueueLocalDurableTask({
      rows: [],
      job: {
        projectId, workerKind: 'agent-worker', agentId: 'leader', idempotencyKey: 'durable-dead-letter-source',
        runApiPath: `/projects/${projectId}/agents/leader/work-cycle`, requestBody: { taskId: project.tasks?.[0]?.id || 'task-1', includeReadModels: false },
        traceId: 'abcdef0123456789abcdef0123456789', dueAt: '2026-07-10T17:01:00.000Z', maxAttempts: 1,
      },
      now: '2026-07-10T17:00:00.000Z',
    });
    const leased = acquireLocalDurableTaskLease({ rows: queued.rows, jobId: queued.job.id, workerId: 'failed-worker', now: '2026-07-10T17:01:00.000Z', nonce: 'failed-fence' });
    const dead = failLocalDurableTask({ rows: leased.rows, jobId: leased.job.id, fenceToken: leased.job.fenceToken, retryable: false, failureCode: 'provider-permanent', now: '2026-07-10T17:01:01.000Z' });
    project = { ...project, localDurableTaskQueue: dead.rows };
  }
  const filePath = join(directory, 'projects.json');
  const store = createAgentProjectFileStore({ filePath, projects: [project], messages: seed.messages, hydrateProject: hydrateAgentProject, replaceWithSeed: true });
  const service = createAgentProjectService({ store });
  return { filePath, store, service, api: createAgentProjectApi({ service }) };
}

test('imports legacy failures into durable replay jobs and records non-conflicting replay or close dispositions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-dead-letter-legacy-'));
  try {
    const { api, service } = createFixture(directory);
    const listPath = `/projects/${projectId}/dead-letters`;
    const listed = await api.handleAsync({ method: 'GET', path: listPath, headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager' } });
    assert.equal(listed.body.deadLetters.active.length, 2);
    const replaySource = listed.body.deadLetters.active.find((row) => row.runId === 'legacy_failed_replay');
    const closeSource = listed.body.deadLetters.active.find((row) => row.runId === 'legacy_failed_close');
    const denied = await api.handleAsync({ method: 'POST', path: `${listPath}/${encodeURIComponent(replaySource.id)}/replay`, headers: securityHeaders, body: {} });
    assert.notEqual(denied.status, 200);
    const replayed = await api.handleAsync({
      method: 'POST', path: `${listPath}/${encodeURIComponent(replaySource.id)}/replay`, headers: securityHeaders,
      body: { actorId: 'spoofed', approval: { approvedBy: 'spoofed', reason: 'provider recovered' }, now: '2026-07-10T17:03:00.000Z' },
    });
    assert.equal(replayed.status, 200, JSON.stringify(replayed.body));
    assert.equal(replayed.body.deadLetterDisposition.status, 'replayed');
    assert.equal(replayed.body.deadLetterDisposition.actorId, 'dead-letter-security-admin');
    assert.equal(replayed.body.deadLetterDisposition.approval.approvedBy, 'dead-letter-security-admin');
    assert.match(replayed.body.deadLetterDisposition.approval.reasonHash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(replayed.body.deadLetterDisposition).includes('provider recovered'), false);
    const replayJob = service.getDurableTaskQueue(projectId, { now: '2026-07-10T17:03:01.000Z' }).rows.find((row) => row.id === replayed.body.deadLetterDisposition.replayJobId);
    assert.equal(replayJob.status, 'acknowledged');
    assert.equal(replayJob.replayOfJobId, replaySource.id);

    const closed = await api.handleAsync({
      method: 'POST', path: `${listPath}/${encodeURIComponent(closeSource.id)}/close`, headers: securityHeaders,
      body: { actorId: 'spoofed', reason: 'accepted local limitation', now: '2026-07-10T17:04:00.000Z' },
    });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.deadLetterDisposition.status, 'closed');
    assert.equal(closed.body.deadLetterDisposition.actorId, 'dead-letter-security-admin');
    assert.match(closed.body.deadLetterDisposition.reasonHash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(closed.body.deadLetterDisposition).includes('accepted local limitation'), false);
    assert.equal(closed.body.deadLetters.active.length, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('replays a canonical durable dead letter once, retains the source, and resumes idempotently after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-dead-letter-durable-'));
  try {
    const fixture = createFixture(directory, { durable: true });
    const listPath = `/projects/${projectId}/dead-letters`;
    let response = await fixture.api.handleAsync({ method: 'GET', path: listPath, headers: securityHeaders });
    assert.equal(response.body.deadLetters.durableCount, 1);
    const source = response.body.deadLetters.active[0];
    assert.equal(source.sourceKind, 'durable-task');
    const sourceChecksum = source.sourceChecksum;
    response = await fixture.api.handleAsync({
      method: 'POST', path: `${listPath}/${encodeURIComponent(source.id)}/replay`, headers: securityHeaders,
      body: { approval: { reason: 'fixed durable dependency' }, now: '2026-07-10T17:02:00.000Z' },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.deadLetterDisposition.sourceChecksum, sourceChecksum);
    assert.match(response.body.deadLetterDisposition.replayReceiptChecksum, /^[a-f0-9]{64}$/);
    const runCount = fixture.store.getProject(projectId).agentWorkerLedger.length;
    const sourceAfter = fixture.store.getProject(projectId).localDurableTaskQueue.find((row) => row.id === source.sourceJobId);
    assert.equal(sourceAfter.status, 'dead-lettered');
    assert.equal(sourceAfter.checksum, sourceChecksum);

    const restartedStore = createAgentProjectFileStore({ filePath: fixture.filePath, hydrateProject: hydrateAgentProject });
    const restartedService = createAgentProjectService({ store: restartedStore });
    const restartedApi = createAgentProjectApi({ service: restartedService });
    const duplicate = await restartedApi.handleAsync({
      method: 'POST', path: `${listPath}/${encodeURIComponent(source.id)}/replay`, headers: securityHeaders,
      body: { approval: { reason: 'fixed durable dependency' }, now: '2026-07-10T17:03:00.000Z' },
    });
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.idempotent, true);
    assert.equal(restartedStore.getProject(projectId).agentWorkerLedger.length, runCount);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fails dead-letter reads closed after disposition tampering and applies private role policy', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-dead-letter-integrity-'));
  try {
    const { api, store } = createFixture(directory);
    const path = `/projects/${projectId}/dead-letters`;
    const listed = await api.handleAsync({ method: 'GET', path, headers: securityHeaders });
    const source = listed.body.deadLetters.active[0];
    await api.handleAsync({ method: 'POST', path: `${path}/${encodeURIComponent(source.id)}/close`, headers: securityHeaders, body: { reason: 'close safely' } });
    const project = store.getProject(projectId);
    const tampered = structuredClone(project.localDeadLetterDispositionLedger);
    tampered[0].actorId = 'attacker';
    store.saveProject({ ...project, localDeadLetterDispositionLedger: tampered });
    const failed = await api.handleAsync({ method: 'GET', path, headers: securityHeaders });
    assert.equal(failed.status, 400);
    assert.match(failed.body.message || failed.body.error || '', /disposition-integrity-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: `/projects/${projectId}/dead-letters` }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: `/projects/${projectId}/dead-letters/dead/replay` }).allowedRoles, ['security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: `/projects/${projectId}/dead-letters/dead/close` }).allowedRoles, ['security-admin']);
});

test('recovers receipt-before-ack and ack-before-disposition crashes without rerunning the replay effect', async (t) => {
  for (const crashStage of ['ack', 'disposition']) {
    await t.test(crashStage, async () => {
      const directory = mkdtempSync(join(tmpdir(), `hofs-dead-letter-${crashStage}-crash-`));
      try {
        const fixture = createFixture(directory, { durable: true });
        const path = `/projects/${projectId}/dead-letters`;
        const listed = await fixture.api.handleAsync({ method: 'GET', path, headers: securityHeaders });
        const source = listed.body.deadLetters.active[0];
        const originalSaveProject = fixture.store.saveProject.bind(fixture.store);
        let failOnce = true;
        fixture.store.saveProject = (project) => {
          const replayRows = (project.localDurableTaskQueue || []).filter((row) => row.replayOfJobId);
          const shouldFail = crashStage === 'ack'
            ? replayRows.some((row) => row.status === 'acknowledged') && !(project.localDeadLetterDispositionLedger || []).length
            : (project.localDeadLetterDispositionLedger || []).length > 0;
          if (failOnce && shouldFail) {
            failOnce = false;
            throw new Error(`simulated-dead-letter-${crashStage}-crash`);
          }
          return originalSaveProject(project);
        };
        const first = await fixture.api.handleAsync({
          method: 'POST', path: `${path}/${encodeURIComponent(source.id)}/replay`, headers: securityHeaders,
          body: { approval: { reason: 'recover after simulated crash' }, now: '2026-07-10T17:02:00.000Z' },
        });
        assert.equal(first.status, 400);
        const runCountAfterCrash = fixture.store.getProject(projectId).agentWorkerLedger.length;
        fixture.store.saveProject = originalSaveProject;
        const changedApproval = await fixture.api.handleAsync({
          method: 'POST', path: `${path}/${encodeURIComponent(source.id)}/replay`, headers: securityHeaders,
          body: { approval: { reason: 'different approval after crash' }, now: '2026-07-10T17:03:00.000Z' },
        });
        assert.equal(changedApproval.status, 400);
        assert.match(changedApproval.body.message || '', /idempotency-conflict/);
        const recovered = await fixture.api.handleAsync({
          method: 'POST', path: `${path}/${encodeURIComponent(source.id)}/replay`, headers: securityHeaders,
          body: { approval: { reason: 'recover after simulated crash' }, now: '2026-07-10T17:03:01.000Z' },
        });
        assert.equal(recovered.status, 200, JSON.stringify(recovered.body));
        assert.equal(fixture.store.getProject(projectId).agentWorkerLedger.length, runCountAfterCrash);
        assert.equal(recovered.body.deadLetterDisposition.status, 'replayed');
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
