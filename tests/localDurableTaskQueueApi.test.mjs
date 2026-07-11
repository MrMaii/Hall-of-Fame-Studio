import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, createKickoffProjectFromMeeting, hydrateAgentProject } from '../src/agents/agentProjectService.js';

test('persists private durable queue discovery, cancellation identity, restart, and tamper failure', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-durable-queue-api-'));
  const filePath = join(directory, 'projects.json');
  const projectId = 'durable_queue_api';
  const securityHeaders = { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'queue-security-admin' };
  try {
    const seed = createKickoffProjectFromMeeting({
      projectId, name: 'Durable queue API', brief: 'Operate the local queue privately.', now: '2026-07-11T09:00:00.000Z',
      team: [{ id: 'leader', name: 'Ada', title: 'Leader', skill: 'planning' }, { id: 'reviewer', name: 'Grace', title: 'Reviewer', skill: 'review' }],
    });
    let store = createAgentProjectFileStore({ filePath, projects: [seed.project], messages: seed.messages, hydrateProject: hydrateAgentProject, replaceWithSeed: true });
    let service = createAgentProjectService({ store });
    service.startAutonomousRunControlSession({ projectId, sessionId: 'api-session', now: '2026-07-11T09:00:00.000Z', maxLoops: 1, maxStepsPerLoop: 1, maxTotalSteps: 1, forceNewSession: true, requestBodyOverrides: { includeReadModels: false } });
    let api = createAgentProjectApi({ service });
    let response = await api.handleAsync({ method: 'POST', path: `/projects/${projectId}/durable-task-queue/scan`, headers: securityHeaders, body: { now: '2026-07-11T09:00:00.000Z' } });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.discoveredCount >= 3, true);
    response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/durable-task-queue`, headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'queue-manager' }, body: { now: '2026-07-11T09:00:01.000Z' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.durableTaskQueue.integrity.valid, true);
    const queuedJob = response.body.durableTaskQueue.rows.find((row) => row.status === 'queued');
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${projectId}/durable-task-queue/jobs/${encodeURIComponent(queuedJob.id)}/cancel`, headers: securityHeaders,
      body: { actorId: 'caller-override', reason: 'Project operator stopped this scheduled attempt.', now: '2026-07-11T09:00:02.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.durableTask.cancelledBy, 'queue-security-admin');
    assert.match(response.body.durableTask.cancellationReasonHash, /^[a-f0-9]{64}$/);

    store = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    service = createAgentProjectService({ store });
    api = createAgentProjectApi({ service });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/durable-task-queue`, headers: securityHeaders, body: { now: '2026-07-11T09:00:03.000Z' } });
    assert.equal(response.body.durableTaskQueue.summary.cancelledCount, 1);
    const project = store.getProject(projectId);
    const tamperedRows = structuredClone(project.localDurableTaskQueue);
    tamperedRows[0].workerId = 'tampered-worker';
    store.saveProject({ ...project, localDurableTaskQueue: tamperedRows });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/durable-task-queue`, headers: securityHeaders, body: { now: '2026-07-11T09:00:04.000Z' } });
    assert.equal(response.status, 400);
    assert.match(response.body.message || response.body.error || '', /queue-integrity-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps durable queue reads private and mutations security-admin only', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/durable-task-queue' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/durable-task-queue/scan' }).allowedRoles, ['security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/durable-task-queue/jobs/j/cancel' }).allowedRoles, ['security-admin']);
});
