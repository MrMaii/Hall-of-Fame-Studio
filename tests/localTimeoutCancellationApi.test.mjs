import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, createKickoffProjectFromMeeting, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { acquireLocalDurableTaskLease, enqueueLocalDurableTask } from '../src/agents/localDurableTaskQueue.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

test('security-admin cancellation fences and aborts an active workspace child, then remains terminal after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-timeout-cancellation-api-'));
  const filePath = join(directory, 'projects.json');
  const workspacePath = join(directory, 'workspace');
  mkdirSync(workspacePath);
  const projectId = 'timeout_cancellation_api';
  const now = '2026-07-11T12:00:00.000Z';
  try {
    const seed = createKickoffProjectFromMeeting({
      projectId, name: 'Timeout cancellation', brief: 'Cancel active local work safely.', now,
      team: [{ id: 'leader', name: 'Ada', title: 'Leader', skill: 'planning' }],
    });
    let store = createAgentProjectFileStore({ filePath, projects: [seed.project], messages: seed.messages, hydrateProject: hydrateAgentProject, replaceWithSeed: true });
    const runtime = createLocalProjectRuntime({ rootPath: join(directory, 'runtime'), enableCommandExecution: true, allowedCommands: ['node'] });
    let service = createAgentProjectService({ store, projectRuntime: runtime });
    service.bindProjectWorkspace({ projectId, workspacePath });
    const queued = enqueueLocalDurableTask({
      rows: [],
      job: {
        projectId, workerKind: 'agent-worker', agentId: 'leader', idempotencyKey: 'timeout-cancel-active-child',
        runApiPath: `/projects/${projectId}/agents/leader/work-cycle`, requestBody: { taskId: 'task-1' },
        dueAt: now, maxAttempts: 3,
      },
      now,
    });
    const leased = acquireLocalDurableTaskLease({ rows: queued.rows, jobId: queued.job.id, workerId: 'workspace-worker', now, nonce: 'workspace-lease' });
    service.replaceProject({ ...service.getProject(projectId), localDurableTaskQueue: leased.rows });
    const running = service.executeWorkspaceCommandAsync({
      projectId, durableTaskJobId: leased.job.id, durableTaskFenceToken: leased.job.fenceToken,
      command: 'node', args: ['-e', "setTimeout(() => process.stdout.write('late-success'), 500)"],
      timeoutMs: 2_000, operationId: 'active-child-cancel-test',
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const api = createAgentProjectApi({ service });
    const response = await api.handleAsync({
      method: 'POST', path: `/projects/${projectId}/durable-task-queue/jobs/${encodeURIComponent(leased.job.id)}/cancel`,
      headers: { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'local-security-admin' },
      body: { actorId: 'caller-spoof', reason: 'Operator stopped the active child.', now: '2026-07-11T12:00:01.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.cancellationSignalDelivered, true);
    assert.equal(response.body.durableTask.status, 'cancelled');
    assert.equal(response.body.durableTask.cancelledBy, 'local-security-admin');
    assert.match(response.body.cancellationReceipt.checksum, /^[a-f0-9]{64}$/);
    const commandResult = await running;
    assert.equal(commandResult.status, 'cancelled');
    assert.equal(commandResult.stdout.includes('late-success'), false);

    store = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    service = createAgentProjectService({ store, projectRuntime: runtime });
    const restarted = service.getDurableTaskQueue(projectId, { now: '2026-07-11T12:00:02.000Z' });
    assert.equal(restarted.rows.find((row) => row.id === leased.job.id).status, 'cancelled');
    assert.equal(restarted.summary.cancellationRequestedCount, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
