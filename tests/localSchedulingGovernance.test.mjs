import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateAutonomousSchedule } from '../src/agents/agentRuntime.js';
import { createAgentProjectService, createKickoffProjectFromMeeting, evaluateAgentWorkSchedule } from '../src/agents/agentProjectService.js';
import { evaluateLocalIntervalSchedule } from '../src/agents/localScheduleGovernance.js';

test('uses stable UTC interval slots for waiting and normal due work', () => {
  const waiting = evaluateLocalIntervalSchedule({ lane: 'agent', now: '2026-07-11T10:00:30.000Z', intervalMs: 60_000, lastCompletedAt: '2026-07-11T10:00:00.000Z' });
  assert.equal(waiting.due, false);
  assert.equal(waiting.scheduledAt, '2026-07-11T10:01:00.000Z');
  assert.equal(waiting.idempotencySlotAt, waiting.scheduledAt);
  const due = evaluateLocalIntervalSchedule({ lane: 'agent', now: '2026-07-11T10:01:00.000Z', intervalMs: 60_000, lastCompletedAt: '2026-07-11T10:00:00.000Z' });
  assert.equal(due.due, true);
  assert.equal(due.dueAt, '2026-07-11T10:01:00.000Z');
  assert.match(due.checksum, /^[a-f0-9]{64}$/);
  assert.equal(due.timeBasis, 'utc-epoch-interval');
  assert.equal(due.timeZone, 'UTC');
  assert.equal(due.dstSensitive, false);
});

test('coalesces missed intervals into one run while preserving the original durable slot', () => {
  const result = evaluateLocalIntervalSchedule({ lane: 'autopilot', now: '2026-07-11T10:05:00.000Z', intervalMs: 60_000, lastCompletedAt: '2026-07-11T10:00:00.000Z' });
  assert.equal(result.due, true);
  assert.equal(result.reason, 'autopilot-missed-cadence-recovery');
  assert.equal(result.missedIntervals, 4);
  assert.equal(result.coalescedRunCount, 1);
  assert.equal(result.suppressedCatchUpCount, 4);
  assert.equal(result.dueAt, '2026-07-11T10:01:00.000Z');
  assert.equal(result.idempotencySlotAt, '2026-07-11T10:01:00.000Z');
  assert.equal(result.misfirePolicy, 'coalesce-one');
});

test('creates one stable clock-regression recovery identity without waiting for wall clock catch-up', () => {
  const input = { lane: 'project', now: '2026-07-11T10:00:00.000Z', intervalMs: 60_000, lastCompletedAt: '2026-07-11T10:10:00.000Z' };
  const first = evaluateLocalIntervalSchedule(input);
  const repeated = evaluateLocalIntervalSchedule(input);
  assert.equal(first.due, true);
  assert.equal(first.reason, 'project-clock-regression-recovery');
  assert.equal(first.dueAt, input.now);
  assert.equal(first.idempotencySlotAt, input.lastCompletedAt);
  assert.equal(repeated.checksum, first.checksum);
});

test('fails closed for malformed timestamps and unbounded intervals', () => {
  assert.throws(() => evaluateLocalIntervalSchedule({ lane: 'agent', now: 'invalid', intervalMs: 1000 }), /now-invalid/);
  assert.throws(() => evaluateLocalIntervalSchedule({ lane: 'agent', now: '2026-07-11T10:00:00.000Z', intervalMs: 0 }), /interval-invalid/);
  assert.throws(() => evaluateLocalIntervalSchedule({ lane: 'agent', now: '2026-07-11T10:00:00.000Z', intervalMs: 1000, storedNextAt: 'invalid' }), /next-run-invalid/);
});

test('applies clock recovery and stable missed slots to project, Agent, and Autopilot queue lanes', () => {
  const now = '2026-07-11T10:00:00.000Z';
  const future = '2026-07-11T12:10:00.000Z';
  const seed = createKickoffProjectFromMeeting({
    projectId: 'schedule-three-lanes', name: 'Schedule lanes', brief: 'Prove deterministic scheduling.', now,
    team: [{ id: 'leader', name: 'Ada', title: 'Leader', skill: 'planning' }],
  });
  const project = {
    ...seed.project,
    autonomy: { ...(seed.project.autonomy || {}), enabled: true, cadence: 'hourly' },
    lastAutonomousRunAt: future,
    nextAutonomousRunAt: '2026-07-11T13:10:00.000Z',
    agentStates: {
      ...seed.project.agentStates,
      leader: { ...(seed.project.agentStates?.leader || {}), lastAgentRunAt: future, nextAgentRunAt: '2026-07-11T10:11:00.000Z' },
    },
  };
  assert.equal(evaluateAutonomousSchedule({ project, now }).reason, 'project-clock-regression-recovery');
  assert.equal(evaluateAgentWorkSchedule({ project, agentId: 'leader', now, intervalMs: 60_000 }).reason, 'agent-clock-regression-recovery');

  const service = createAgentProjectService({ projects: [seed.project], messages: seed.messages });
  service.startAutonomousRunControlSession({ projectId: seed.project.id, sessionId: 'stable-slot', now, maxLoops: 1, maxStepsPerLoop: 1, maxTotalSteps: 1, forceNewSession: true });
  const stored = service.getProject(seed.project.id);
  service.replaceProject({
    ...stored,
    autonomousRunControlSessionLedger: stored.autonomousRunControlSessionLedger.map((session) => ({ ...session, lastTickAt: now })),
  });
  const first = service.getProjectWorkerQueue(seed.project.id, { now: '2026-07-11T10:05:00.000Z', intervalMs: 60_000 }).autopilotQueue[0];
  const later = service.getProjectWorkerQueue(seed.project.id, { now: '2026-07-11T10:06:00.000Z', intervalMs: 60_000 }).autopilotQueue[0];
  assert.equal(first.reason, 'autopilot-session-missed-cadence-recovery');
  assert.equal(first.dueAt, '2026-07-11T10:01:00.000Z');
  assert.equal(later.idempotencyKey, first.idempotencyKey);
});
