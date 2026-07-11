import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';
import { acquireLocalAutopilotLease } from '../src/agents/localAutopilotLease.js';

const projectId = 'local_lease_recovery_project';
const sessionId = 'local_lease_recovery_session';
const startedAt = '2026-07-10T10:00:00.000Z';

function createSeed() {
  return createKickoffProjectFromMeeting({
    projectId,
    name: 'Local lease recovery project',
    brief: 'Prove that a local Autopilot session resumes safely after restart.',
    now: startedAt,
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
}

test('file-backed Autopilot recovery blocks an active lease then recovers and acknowledges it after expiry', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-lease-'));
  const filePath = join(directory, 'projects.json');
  try {
    const seed = createSeed();
    const firstStore = createAgentProjectFileStore({
      filePath,
      projects: [seed.project],
      messages: seed.messages,
      hydrateProject: hydrateAgentProject,
      replaceWithSeed: true,
    });
    const firstService = createAgentProjectService({ store: firstStore });
    firstService.startAutonomousRunControlSession({
      projectId,
      sessionId,
      now: startedAt,
      maxLoops: 2,
      maxStepsPerLoop: 1,
      maxTotalSteps: 2,
      forceNewSession: true,
      requestBodyOverrides: { includeReadModels: false },
    });
    const firstQueue = firstService.getProjectWorkerQueue(projectId, { now: startedAt });
    const firstRow = firstQueue.autopilotQueue.find((row) => row.sessionId === sessionId);
    assert.ok(firstRow?.idempotencyKey, 'The public queue snapshot must expose the scheduled Autopilot key.');
    const initialLease = acquireLocalAutopilotLease({
      rows: [],
      projectId,
      sessionId,
      idempotencyKey: firstRow.idempotencyKey,
      dueAt: firstRow.dueAt,
      now: startedAt,
      leaseSeconds: 60,
    });
    firstStore.saveProject({
      ...firstStore.getProject(projectId),
      localAutopilotLeaseLedger: initialLease.rows,
    });

    const activeStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const activeService = createAgentProjectService({ store: activeStore });
    const providerBlocked = await activeService.runDueAutonomousRunControlSessionsWithProviderEvidence({
      now: '2026-07-10T10:00:30.000Z',
      maxProjects: 1,
      maxSessionsPerProject: 1,
      loopCount: 1,
      providerEvidenceSearchEnabled: true,
    });
    assert(providerBlocked.skipped.some((row) => row.sessionId === sessionId && row.reason === 'autopilot-lease-active'));
    const blocked = activeService.runDueAutonomousRunControlSessions({
      now: '2026-07-10T10:00:30.000Z',
      maxProjects: 1,
      maxSessionsPerProject: 1,
      loopCount: 1,
    });
    assert(blocked.skipped.some((row) => row.sessionId === sessionId && row.reason === 'autopilot-lease-active'));
    assert.equal(activeService.getAutonomousRunControlSessions(projectId).sessions.find((session) => session.id === sessionId).tickCount, 0);

    const recoveredStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const recoveredService = createAgentProjectService({ store: recoveredStore });
    const recovered = recoveredService.runDueAutonomousRunControlSessions({
      now: '2026-07-10T10:01:01.000Z',
      maxProjects: 1,
      maxSessionsPerProject: 1,
      loopCount: 1,
    });
    const processed = recovered.processed.find((row) => row.sessionId === sessionId);
    assert.equal(processed.leaseAction, 'recovered-expired-lease');
    assert.equal(processed.executionReceipt.status, 'succeeded');
    const savedProject = recoveredService.getProject(projectId);
    const savedLease = savedProject.localAutopilotLeaseLedger.find((row) => row.idempotencyKey === firstRow.idempotencyKey);
    assert.equal(savedLease.status, 'acked');
    assert.equal(savedLease.attemptCount, 2);
    assert.equal(savedLease.receipt.tickId, processed.tickId);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
