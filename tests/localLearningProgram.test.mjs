import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLocalLearningProgram,
  createLocalLearningAttempt,
  createLocalLearningPlan,
  verifyLocalLearningAttempt,
  verifyLocalLearningPlan,
} from '../src/agents/localLearningProgram.js';

const basePlanInput = {
  projectId: 'calculus_learning_project',
  learnerId: 'learner-1',
  syllabusVersion: 'calculus-v1',
  topics: [
    { id: 'algebra-foundations', title: 'Algebra foundations', estimatedMinutes: 60, weightBps: 4000, prerequisites: [] },
    { id: 'derivatives', title: 'Derivatives', estimatedMinutes: 90, weightBps: 6000, prerequisites: ['algebra-foundations'] },
  ],
  diagnostics: [
    { topicId: 'algebra-foundations', scoreBps: 7000, evidenceId: 'diagnostic-algebra' },
    { topicId: 'derivatives', scoreBps: 3000, evidenceId: 'diagnostic-derivatives' },
  ],
  pace: {
    weeklyMinutes: 180,
    sessionMinutes: 45,
    studyDays: [1, 3, 5],
    blackoutDates: ['2026-07-15'],
    startDate: '2026-07-13',
    targetDate: '2026-07-31',
    timezoneOffsetMinutes: -240,
    targetMasteryBps: 8000,
  },
  actorId: 'learner-1',
  idempotencyKey: 'plan-1',
  now: '2026-07-10T12:00:00.000Z',
};

test('creates a prerequisite-aware, learner-paced syllabus plan with diagnostic evidence', () => {
  const plan = createLocalLearningPlan(basePlanInput);
  assert.equal(plan.schemaVersion, 'local-learning-plan/v1');
  assert.equal(plan.status, 'scheduled');
  assert.equal(plan.feasibility.feasible, true);
  assert.equal(plan.sessions.reduce((sum, row) => sum + row.plannedMinutes, 0), 150);
  assert.equal(plan.sessions.every((row) => row.plannedMinutes <= 45), true);
  assert.equal(plan.sessions.some((row) => row.scheduledDate === '2026-07-15'), false);
  assert.equal(plan.sessions[0].topicId, 'algebra-foundations');
  assert.equal(plan.sessions.findIndex((row) => row.topicId === 'derivatives') > plan.sessions.findLastIndex((row) => row.topicId === 'algebra-foundations'), true);
  assert.equal(plan.diagnostics.every((row) => row.evidenceId), true);
  assert.equal(verifyLocalLearningPlan(plan).valid, true);

  const tampered = structuredClone(plan);
  tampered.pace.weeklyMinutes = 600;
  assert.equal(verifyLocalLearningPlan(tampered).valid, false);

  assert.throws(() => createLocalLearningPlan({
    ...basePlanInput,
    idempotencyKey: 'cycle-plan',
    topics: [
      { id: 'a', title: 'A', estimatedMinutes: 30, weightBps: 5000, prerequisites: ['b'] },
      { id: 'b', title: 'B', estimatedMinutes: 30, weightBps: 5000, prerequisites: ['a'] },
    ],
    diagnostics: [],
  }), /topic-dependency-cycle/);
});

test('derives evidence-backed mastery, prerequisite blocking and spaced-review next actions without answer text', () => {
  const plan = createLocalLearningPlan(basePlanInput);
  const makeAttempt = (topicId, number, scoreBps, occurredAt) => createLocalLearningAttempt({
    plan,
    topicId,
    itemId: `${topicId}-item-${number}`,
    scoreBps,
    durationMs: 120_000,
    hintCount: 0,
    evidenceIds: [`proof-${topicId}-${number}`],
    learnerId: 'learner-1',
    idempotencyKey: `${topicId}-attempt-${number}`,
    occurredAt,
  });

  const initial = buildLocalLearningProgram({
    project: { id: plan.projectId, workModeContract: { workMode: 'learning' }, localLearningPlans: [plan], localLearningAttempts: [] },
    now: '2026-07-13T12:00:00.000Z',
  });
  assert.equal(initial.nextAction.topicId, 'algebra-foundations');
  assert.equal(initial.nextAction.reasonCode, 'prerequisite-mastery-required');

  const attempts = [
    makeAttempt('algebra-foundations', 1, 8500, '2026-07-13T12:00:00.000Z'),
    makeAttempt('algebra-foundations', 2, 9000, '2026-07-14T12:00:00.000Z'),
    makeAttempt('algebra-foundations', 3, 9200, '2026-07-15T12:00:00.000Z'),
  ];
  assert.equal(verifyLocalLearningAttempt(attempts[0], plan).valid, true);
  assert.equal(JSON.stringify(attempts).includes('answer'), false);

  const unlocked = buildLocalLearningProgram({
    project: { id: plan.projectId, workModeContract: { workMode: 'learning' }, localLearningPlans: [plan], localLearningAttempts: attempts },
    now: '2026-07-16T12:00:00.000Z',
  });
  assert.equal(unlocked.topicRows.find((row) => row.topicId === 'algebra-foundations').mastered, true);
  assert.equal(unlocked.nextAction.topicId, 'derivatives');
  assert.equal(unlocked.nextAction.reasonCode, 'lowest-mastery-unlocked-topic');

  const revisedPlan = createLocalLearningPlan({
    ...basePlanInput,
    version: 2,
    previousPlanId: plan.id,
    previousPlanChecksum: plan.checksum,
    governanceStartedAt: plan.governanceStartedAt,
    pace: { ...basePlanInput.pace, weeklyMinutes: 225 },
    idempotencyKey: 'plan-2',
    now: '2026-07-16T13:00:00.000Z',
  });
  const afterPaceRevision = buildLocalLearningProgram({
    project: { id: plan.projectId, workModeContract: { workMode: 'learning' }, localLearningPlans: [revisedPlan, plan], localLearningAttempts: attempts },
    now: '2026-07-16T14:00:00.000Z',
  });
  assert.equal(afterPaceRevision.summary.attemptCount, 3);
  assert.equal(afterPaceRevision.topicRows.find((row) => row.topicId === 'algebra-foundations').mastered, true);

  const due = buildLocalLearningProgram({
    project: { id: plan.projectId, workModeContract: { workMode: 'learning' }, localLearningPlans: [plan], localLearningAttempts: attempts },
    now: '2026-07-23T12:00:00.000Z',
  });
  assert.equal(due.nextAction.topicId, 'algebra-foundations');
  assert.equal(due.nextAction.reasonCode, 'spaced-review-due');

  const tamperedAttempt = structuredClone(attempts[0]);
  tamperedAttempt.scoreBps = 10000;
  assert.equal(verifyLocalLearningAttempt(tamperedAttempt, plan).valid, false);
});
