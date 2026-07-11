import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-learning-program-${process.pid}`);
const filePath = resolve(tempRoot, 'projects.json');
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
  let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
  const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-learner' };
  let response = await api.handleAsync({
    method: 'POST', path: '/projects/initiate', headers,
    body: { projectId: 'learning_program_gate_project', name: 'Learning Program Gate', brief: 'Master local algebra topics.', workMode: 'learning', includeReadModels: false },
  });
  assert(response.status === 200, `Learning project initiation returned ${response.status}.`);
  const planBody = {
    learnerId: 'local-learner', syllabusVersion: 'algebra-gate-v1',
    topics: [
      { id: 'linear-equations', title: 'Linear equations', estimatedMinutes: 60, weightBps: 5000, prerequisites: [] },
      { id: 'quadratics', title: 'Quadratics', estimatedMinutes: 90, weightBps: 5000, prerequisites: ['linear-equations'] },
    ],
    diagnostics: [
      { topicId: 'linear-equations', scoreBps: 6000, evidenceId: 'diagnostic-linear' },
      { topicId: 'quadratics', scoreBps: 2500, evidenceId: 'diagnostic-quadratics' },
    ],
    pace: {
      weeklyMinutes: 180, sessionMinutes: 45, studyDays: [1, 3, 5], blackoutDates: ['2026-07-15'],
      startDate: '2026-07-13', targetDate: '2026-07-31', timezoneOffsetMinutes: -240, targetMasteryBps: 8000,
    },
    actorId: 'local-learner', idempotencyKey: 'gate-plan-1', now: '2026-07-10T12:00:00.000Z',
  };
  response = await api.handleAsync({ method: 'POST', path: '/projects/learning_program_gate_project/learning-program/plans', headers, body: planBody });
  assert(response.status === 201, `Learning plan create returned ${response.status}.`);
  let plan = response.body.learningPlan;
  assert(plan.sessions.every((row) => row.scheduledDate !== '2026-07-15'), 'Learner blackout date must remain unscheduled.');
  assert(response.body.learningProgram.nextAction.topicId === 'linear-equations', 'Prerequisite topic must be selected first.');
  assert(response.body.learningProgram.nextAction.reasonCode === 'prerequisite-mastery-required', 'Prerequisite gap must explain the next action.');

  const recordAttempts = async (topicId, scores, startDay) => {
    for (let index = 0; index < scores.length; index += 1) {
      const day = String(startDay + index).padStart(2, '0');
      response = await api.handleAsync({
        method: 'POST', path: '/projects/learning_program_gate_project/learning-program/attempts', headers,
        body: {
          planId: plan.id, learnerId: 'local-learner', topicId, itemId: `${topicId}-gate-${index + 1}`,
          scoreBps: scores[index], durationMs: 120_000, hintCount: 0, evidenceIds: [`proof-${topicId}-${index + 1}`],
          idempotencyKey: `${topicId}-attempt-${index + 1}`, occurredAt: `2026-07-${day}T12:00:00.000Z`,
        },
      });
      assert(response.status === 201, `${topicId} attempt ${index + 1} returned ${response.status}.`);
    }
  };
  await recordAttempts('linear-equations', [8500, 9000, 9200], 13);
  response = await api.handleAsync({ method: 'GET', path: '/projects/learning_program_gate_project/learning-program', headers, body: { now: '2026-07-16T12:00:00.000Z' } });
  assert(response.body.learningProgram.topicRows.find((row) => row.topicId === 'linear-equations').mastered, 'Three recent hint-free passing attempts must master the prerequisite.');
  assert(response.body.learningProgram.nextAction.topicId === 'quadratics', 'Mastering the prerequisite must unlock the dependent topic.');

  response = await api.handleAsync({
    method: 'POST', path: `/projects/learning_program_gate_project/learning-program/plans/${plan.id}/revisions`, headers,
    body: { ...planBody, pace: { ...planBody.pace, weeklyMinutes: 225 }, idempotencyKey: 'gate-plan-2', expectedPlanVersion: 1, expectedPlanChecksum: plan.checksum, now: '2026-07-16T13:00:00.000Z' },
  });
  assert(response.status === 201 && response.body.learningProgram.summary.attemptCount === 3, 'Learner pace revision must preserve compatible practice evidence.');
  plan = response.body.learningPlan;
  await recordAttempts('quadratics', [8400, 8800, 9300], 16);

  response = await api.handleAsync({
    method: 'POST', path: '/projects/learning_program_gate_project/learning-program/attempts', headers,
    body: { planId: plan.id, learnerId: 'local-learner', topicId: 'quadratics', itemId: 'raw-answer-attempt', scoreBps: 9000, durationMs: 120_000, hintCount: 0, evidenceIds: ['raw-answer-proof'], idempotencyKey: 'raw-answer-forbidden', occurredAt: '2026-07-19T12:00:00.000Z', answer: 'PRIVATE LEARNER ANSWER' },
  });
  assert(response.status === 400 && /raw-answer-forbidden/.test(response.body.message || ''), 'Raw learner answer text must be rejected from the evidence receipt.');

  api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
  response = await api.handleAsync({ method: 'GET', path: '/projects/learning_program_gate_project/learning-program', headers, body: { now: '2026-07-20T12:00:00.000Z' } });
  const program = response.body.learningProgram;
  assert(program.status === 'mastery-maintenance', `Expected mastery-maintenance after restart, received ${program.status}.`);
  assert(program.summary.masteredCount === 2 && program.summary.attemptCount === 6, 'All topic mastery evidence must survive restart and pace revision.');
  assert(program.integrity.valid && program.readyForLocalLearning, 'Restarted learning receipts must remain valid and locally usable.');
  assert(program.unresolvedTeachingSafetyGateIds.includes('academic-integrity'), 'Capability 42 safety boundary must remain explicit.');

  response = await api.handleAsync({ method: 'GET', path: '/projects/learning_program_gate_project/learning-program', headers, body: { now: '2026-07-24T12:00:00.000Z' } });
  assert(response.body.learningProgram.nextAction?.reasonCode === 'spaced-review-due', 'Expired mastery evidence must schedule a spaced review.');
  console.log('Local adaptive learning program validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
