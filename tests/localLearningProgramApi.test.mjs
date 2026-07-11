import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';

const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'learner-user' };
const planBody = {
  learnerId: 'learner-user',
  syllabusVersion: 'algebra-v1',
  topics: [
    { id: 'linear-equations', title: 'Linear equations', estimatedMinutes: 60, weightBps: 5000, prerequisites: [] },
    { id: 'quadratics', title: 'Quadratics', estimatedMinutes: 90, weightBps: 5000, prerequisites: ['linear-equations'] },
  ],
  diagnostics: [
    { topicId: 'linear-equations', scoreBps: 6000, evidenceId: 'diagnostic-linear' },
    { topicId: 'quadratics', scoreBps: 2500, evidenceId: 'diagnostic-quadratics' },
  ],
  pace: {
    weeklyMinutes: 180, sessionMinutes: 45, studyDays: [1, 3, 5],
    startDate: '2026-07-13', targetDate: '2026-07-31', timezoneOffsetMinutes: -240, targetMasteryBps: 8000,
  },
  actorId: 'learner-user',
  idempotencyKey: 'learning-plan-1',
  now: '2026-07-10T12:00:00.000Z',
};

test('persists, revises and practices a private learning program across restart with tamper degradation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-learning-program-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    let response = await api.handleAsync({
      method: 'POST', path: '/projects/initiate', headers,
      body: { projectId: 'learning_program_api_project', name: 'Learning Program', brief: 'Master algebra foundations.', workMode: 'learning', includeReadModels: false },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.readModels.learningProgramRoute, '/projects/learning_program_api_project/learning-program');

    response = await api.handleAsync({ method: 'POST', path: '/projects/learning_program_api_project/learning-program/plans', headers, body: planBody });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const firstPlan = response.body.learningPlan;
    assert.equal(response.body.learningProgram.status, 'learning-in-progress');
    assert.equal(response.body.learningProgram.nextAction.topicId, 'linear-equations');

    response = await api.handleAsync({ method: 'POST', path: '/projects/learning_program_api_project/learning-program/plans', headers, body: { ...planBody, now: '2026-07-10T12:00:30.000Z' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/learning_program_api_project/learning-program/plans/${firstPlan.id}/revisions`, headers,
      body: { ...planBody, idempotencyKey: 'learning-plan-stale', expectedPlanVersion: 0, expectedPlanChecksum: '0'.repeat(64), now: '2026-07-10T12:01:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /stale-plan/);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/learning_program_api_project/learning-program/plans/${firstPlan.id}/revisions`, headers,
      body: { ...planBody, idempotencyKey: 'learning-plan-2', expectedPlanVersion: 1, expectedPlanChecksum: firstPlan.checksum, pace: { ...planBody.pace, weeklyMinutes: 225 }, now: '2026-07-10T12:02:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const revisedPlan = response.body.learningPlan;
    assert.equal(revisedPlan.version, 2);

    const attemptBody = {
      planId: revisedPlan.id, learnerId: 'learner-user', topicId: 'linear-equations', itemId: 'linear-item-1',
      scoreBps: 8500, durationMs: 120_000, hintCount: 0, evidenceIds: ['local-quiz-proof-1'],
      idempotencyKey: 'attempt-1', occurredAt: '2026-07-13T12:00:00.000Z',
    };
    response = await api.handleAsync({ method: 'POST', path: '/projects/learning_program_api_project/learning-program/attempts', headers, body: attemptBody });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(JSON.stringify(response.body.learningAttempt).includes('answer'), false);
    response = await api.handleAsync({ method: 'POST', path: '/projects/learning_program_api_project/learning-program/attempts', headers, body: attemptBody });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);
    response = await api.handleAsync({ method: 'POST', path: '/projects/learning_program_api_project/learning-program/attempts', headers, body: { ...attemptBody, scoreBps: 10000 } });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /idempotency-conflict/);

    const restartedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    api = createAgentProjectApi({ service: createAgentProjectService({ store: restartedStore }) });
    response = await api.handleAsync({ method: 'GET', path: '/projects/learning_program_api_project/learning-program', headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.learningProgram.plan.version, 2);
    assert.equal(response.body.learningProgram.summary.attemptCount, 1);
    assert.equal(response.body.learningProgram.integrity.valid, true);

    const tampered = restartedStore.getProject('learning_program_api_project');
    tampered.localLearningAttempts[0].scoreBps = 10000;
    restartedStore.saveProject(tampered);
    response = await api.handleAsync({ method: 'GET', path: '/projects/learning_program_api_project/learning-program', headers });
    assert.equal(response.body.learningProgram.status, 'degraded-integrity-invalid');
    assert.equal(response.body.learningProgram.readyForLocalLearning, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps learning records private and rejects the learning route for other work modes', () => {
  const read = classifyAccessRequest({ method: 'GET', path: '/projects/project-1/learning-program' });
  const write = classifyAccessRequest({ method: 'POST', path: '/projects/project-1/learning-program/plans' });
  assert.deepEqual(read.allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(write.allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'technical-project', workModeContract: { workMode: 'technical-delivery' } }] });
  assert.throws(() => service.createLocalLearningPlan({ projectId: 'technical-project', ...planBody }), /learning-work-mode-required/);
});
