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

function createService(directory, projectId) {
  const seed = createKickoffProjectFromMeeting({
    projectId,
    name: 'Local Autopilot clock recovery',
    brief: 'Recover one safe local Autopilot tick after clock anomalies.',
    now: '2026-07-10T10:00:00.000Z',
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
  const store = createAgentProjectFileStore({
    filePath: join(directory, 'projects.json'),
    projects: [seed.project],
    messages: seed.messages,
    hydrateProject: hydrateAgentProject,
    replaceWithSeed: true,
  });
  const service = createAgentProjectService({ store });
  const sessionId = `${projectId}_session`;
  service.startAutonomousRunControlSession({
    projectId,
    sessionId,
    now: '2026-07-10T10:00:00.000Z',
    maxLoops: 2,
    maxStepsPerLoop: 1,
    maxTotalSteps: 2,
    forceNewSession: true,
    requestBodyOverrides: { includeReadModels: false },
  });
  return { service, store, sessionId };
}

function setLastTick(store, projectId, sessionId, lastTickAt) {
  const project = store.getProject(projectId);
  store.saveProject({
    ...project,
    autonomousRunControlSessionLedger: project.autonomousRunControlSessionLedger.map((session) => (
      session.id === sessionId ? { ...session, lastTickAt, status: 'running' } : session
    )),
  });
}

test('recovers one Autopilot tick after a material local clock rollback', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-autopilot-clock-rollback-'));
  try {
    const projectId = 'autopilot_clock_rollback';
    const { service, store, sessionId } = createService(directory, projectId);
    setLastTick(store, projectId, sessionId, '2026-07-10T10:10:00.000Z');

    const result = service.runDueAutonomousRunControlSessions({
      now: '2026-07-10T10:00:00.000Z',
      intervalMs: 60_000,
      maxProjects: 1,
      maxSessionsPerProject: 1,
      loopCount: 1,
    });

    assert.equal(result.processed.length, 1);
    assert.equal(result.processed[0].reason, 'autopilot-session-clock-regression-recovery');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('recovers one Autopilot tick after missed local cadence intervals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-autopilot-missed-cadence-'));
  try {
    const projectId = 'autopilot_missed_cadence';
    const { service, store, sessionId } = createService(directory, projectId);
    setLastTick(store, projectId, sessionId, '2026-07-10T10:00:00.000Z');

    const result = service.runDueAutonomousRunControlSessions({
      now: '2026-07-10T10:05:00.000Z',
      intervalMs: 60_000,
      maxProjects: 1,
      maxSessionsPerProject: 1,
      loopCount: 1,
    });

    assert.equal(result.processed.length, 1);
    assert.equal(result.processed[0].reason, 'autopilot-session-missed-cadence-recovery');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

