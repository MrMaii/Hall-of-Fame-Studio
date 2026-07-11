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
const policyBody = {
  learnerId: 'learner-user', ageBand: 'teen', supervisionMode: 'educator', actorId: 'learner-user',
  idempotencyKey: 'teaching-policy-1', now: '2026-07-10T12:00:00.000Z',
};

test('persists a mandatory teaching authorization and human-only escalation resolution across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-teaching-safety-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    let response = await api.handleAsync({
      method: 'POST', path: '/projects/initiate', headers,
      body: { projectId: 'teaching_safety_api_project', name: 'Teaching Safety', brief: 'Learn safely.', workMode: 'learning', includeReadModels: false },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.readModels.teachingSafetyRoute, '/projects/teaching_safety_api_project/teaching-safety');

    response = await api.handleAsync({ method: 'POST', path: '/projects/teaching_safety_api_project/teaching-safety/policies', headers, body: policyBody });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const policy = response.body.teachingSafetyPolicy;
    assert.equal(policy.readyForLocalTeaching, true);
    response = await api.handleAsync({ method: 'POST', path: '/projects/teaching_safety_api_project/teaching-safety/policies', headers, body: { ...policyBody, now: '2026-07-10T12:00:30.000Z' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);

    response = await api.handleAsync({
      method: 'POST', path: '/projects/teaching_safety_api_project/learning-program/plans', headers,
      body: {
        learnerId: 'learner-user', syllabusVersion: 'safety-learning-v1',
        topics: [{ id: 'foundations', title: 'Foundations', estimatedMinutes: 45, weightBps: 10000, prerequisites: [] }],
        diagnostics: [{ topicId: 'foundations', scoreBps: 5000, evidenceId: 'diagnostic-foundations' }],
        pace: { weeklyMinutes: 90, sessionMinutes: 45, studyDays: [1, 3], startDate: '2026-07-13', targetDate: '2026-07-31', timezoneOffsetMinutes: -240, targetMasteryBps: 8000 },
        actorId: 'learner-user', idempotencyKey: 'safety-learning-plan', now: '2026-07-10T12:00:40.000Z',
      },
    });
    assert.equal(response.status, 201);
    const learningPlan = response.body.learningPlan;
    response = await api.handleAsync({
      method: 'POST', path: '/projects/teaching_safety_api_project/learning-program/attempts', headers,
      body: { planId: learningPlan.id, learnerId: 'learner-user', topicId: 'foundations', itemId: 'learner-work-1', scoreBps: 7500, durationMs: 120_000, hintCount: 1, evidenceIds: ['attempt-work-proof'], idempotencyKey: 'safety-attempt-1', occurredAt: '2026-07-13T12:00:00.000Z' },
    });
    assert.equal(response.status, 201);
    const learningAttempt = response.body.learningAttempt;

    response = await api.handleAsync({
      method: 'POST', path: '/projects/teaching_safety_api_project/teaching-safety/evaluate', headers,
      body: { requestText: 'Help me review my homework answer.', context: { activityType: 'assignment' }, learnerAttemptEvidenceIds: [learningAttempt.id], idempotencyKey: 'verified-answer-review', now: '2026-07-10T12:01:30.000Z' },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.teachingSafetyDecision.responseAuthorization.mode, 'answer-review');
    response = await api.handleAsync({
      method: 'POST', path: '/projects/teaching_safety_api_project/teaching-safety/evaluate', headers,
      body: { requestText: 'Help me review my homework answer.', context: { activityType: 'assignment' }, learnerAttemptEvidenceIds: ['invented-attempt-proof'], idempotencyKey: 'fake-answer-review', now: '2026-07-10T12:01:40.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /learner-attempt-evidence-invalid/);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/teaching_safety_api_project/teaching-safety/policies/${policy.id}/revisions`, headers,
      body: { ...policyBody, idempotencyKey: 'stale-policy', expectedPolicyVersion: 0, expectedPolicyChecksum: '0'.repeat(64), now: '2026-07-10T12:01:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /stale-policy/);

    response = await api.handleAsync({
      method: 'POST', path: '/projects/teaching_safety_api_project/teaching-safety/evaluate', headers,
      body: { requestText: 'Please explain why a derivative is a rate of change.', context: { activityType: 'open-study' }, idempotencyKey: 'safe-guidance', now: '2026-07-10T12:02:00.000Z' },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.teachingSafetyDecision.responseAuthorization.canGenerateTeachingContent, true);
    assert.equal(JSON.stringify(response.body.teachingSafetyDecision).includes('derivative is a rate'), false);

    const urgentText = 'I want to hurt myself and do not feel safe.';
    response = await api.handleAsync({
      method: 'POST', path: '/projects/teaching_safety_api_project/teaching-safety/evaluate', headers,
      body: { requestText: urgentText, context: { activityType: 'open-study' }, idempotencyKey: 'urgent-guidance', now: '2026-07-10T12:03:00.000Z' },
    });
    assert.equal(response.status, 201);
    const urgent = response.body.teachingSafetyDecision;
    assert.equal(urgent.humanHandoffRequired, true);
    assert.equal(urgent.responseAuthorization.canGenerateTeachingContent, false);
    assert.equal(JSON.stringify(response.body).includes(urgentText), false);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/teaching_safety_api_project/teaching-safety/decisions/${urgent.id}/resolve`, headers,
      body: { actorId: 'manager-user', resolutionCode: 'emergency-support-directed', evidenceIds: ['human-support-proof'], idempotencyKey: 'urgent-resolution', now: '2026-07-10T12:04:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.teachingSafetyResolution.authorizesTeachingContent, false);
    assert.equal(response.body.teachingSafety.summary.openHumanEscalationCount, 0);

    response = await api.handleAsync({
      method: 'POST', path: '/projects/teaching_safety_api_project/teaching-safety/evaluate', headers,
      body: { requestText: 'Check my homework.', context: { activityType: 'assignment' }, idempotencyKey: 'raw-output', modelOutput: 'PRIVATE MODEL ANSWER', now: '2026-07-10T12:05:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /raw-response-forbidden/);

    const snapshotText = JSON.stringify(store.snapshot());
    assert.equal(snapshotText.includes(urgentText), false);
    assert.equal(snapshotText.includes('PRIVATE MODEL ANSWER'), false);

    const restartedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    api = createAgentProjectApi({ service: createAgentProjectService({ store: restartedStore }) });
    response = await api.handleAsync({ method: 'GET', path: '/projects/teaching_safety_api_project/teaching-safety', headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.teachingSafety.summary.decisionCount, 3);
    assert.equal(response.body.teachingSafety.summary.resolvedHumanEscalationCount, 1);
    assert.equal(response.body.teachingSafety.integrity.valid, true);

    const tampered = restartedStore.getProject('teaching_safety_api_project');
    tampered.localTeachingSafetyDecisions[0].riskLevel = 'standard';
    restartedStore.saveProject(tampered);
    response = await api.handleAsync({ method: 'GET', path: '/projects/teaching_safety_api_project/teaching-safety', headers });
    assert.equal(response.body.teachingSafety.status, 'degraded-integrity-invalid');
    assert.equal(response.body.teachingSafety.readyForLocalTeaching, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps teaching safety private and learning-only', () => {
  const read = classifyAccessRequest({ method: 'GET', path: '/projects/project-1/teaching-safety' });
  const write = classifyAccessRequest({ method: 'POST', path: '/projects/project-1/teaching-safety/evaluate' });
  assert.deepEqual(read.allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(write.allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'creative-project', workModeContract: { workMode: 'creative-studio' } }] });
  assert.throws(() => service.createLocalTeachingSafetyPolicy({ projectId: 'creative-project', ...policyBody }), /learning-work-mode-required/);
});
