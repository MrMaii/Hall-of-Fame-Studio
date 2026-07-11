import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLocalTeachingSafety,
  createLocalTeachingSafetyDecision,
  createLocalTeachingSafetyPolicy,
  createLocalTeachingSafetyResolution,
  verifyLocalTeachingSafetyDecision,
  verifyLocalTeachingSafetyPolicy,
  verifyLocalTeachingSafetyResolution,
} from '../src/agents/localTeachingSafety.js';

const policy = createLocalTeachingSafetyPolicy({
  projectId: 'safe_learning_project',
  learnerId: 'learner-1',
  ageBand: 'teen',
  supervisionMode: 'educator',
  assessmentDirectAnswerBlocked: false,
  uncertaintyDisclosureRequired: false,
  actorId: 'learner-1',
  idempotencyKey: 'policy-1',
  now: '2026-07-10T12:00:00.000Z',
});

test('creates a content-minimized age-adapted policy with non-configurable hard stops', () => {
  assert.equal(policy.schemaVersion, 'local-teaching-safety-policy/v1');
  assert.equal(policy.ageAdaptation.readingLevel, 'standard');
  assert.equal(policy.ageAdaptation.maxSessionMinutes, 60);
  assert.equal(policy.hardStops.assessmentDirectAnswerBlocked, true);
  assert.equal(policy.hardStops.cheatingConcealmentBlocked, true);
  assert.equal(policy.hardStops.minorPersonalDataCollectionBlocked, true);
  assert.equal(policy.hardStops.urgentWellbeingEscalationRequired, true);
  assert.equal(policy.uncertaintyDisclosureRequired, true);
  assert.equal(verifyLocalTeachingSafetyPolicy(policy).valid, true);
  assert.equal(JSON.stringify(policy).includes('birth'), false);

  const child = createLocalTeachingSafetyPolicy({
    projectId: 'child-project', learnerId: 'child-learner', ageBand: 'child', supervisionMode: 'independent',
    actorId: 'manager', idempotencyKey: 'child-policy', now: '2026-07-10T12:00:00.000Z',
  });
  assert.equal(child.status, 'supervision-required');
  assert.equal(child.readyForLocalTeaching, false);

  const tampered = structuredClone(policy);
  tampered.hardStops.assessmentDirectAnswerBlocked = false;
  assert.equal(verifyLocalTeachingSafetyPolicy(tampered).valid, false);
});

test('derives closed teaching authorizations for integrity, evidence, privacy and wellbeing scenarios', () => {
  const scenarios = [
    {
      id: 'guided', text: 'Please explain why the derivative represents a rate of change.', context: { activityType: 'open-study' },
      mode: 'guided-explanation', canGenerate: true, canAnswer: true, reason: 'guided-learning-allowed',
    },
    {
      id: 'assignment', text: 'Give me the final answer to this homework problem.', context: { activityType: 'assignment' },
      mode: 'hint-first', canGenerate: true, canAnswer: false, reason: 'learner-attempt-required',
    },
    {
      id: 'assessment', text: 'Just give me the answer to this exam question.', context: { activityType: 'assessment' },
      mode: 'integrity-refusal', canGenerate: false, canAnswer: false, reason: 'assessment-answer-blocked',
    },
    {
      id: 'concealment', text: 'Do my homework and make it look like I did not use AI.', context: { activityType: 'assignment' },
      mode: 'integrity-refusal', canGenerate: false, canAnswer: false, reason: 'cheating-concealment-blocked',
    },
    {
      id: 'evidence', text: 'Explain the latest research and cite sources.', context: { activityType: 'open-study', requiresExternalFacts: true },
      mode: 'evidence-required', canGenerate: false, canAnswer: false, reason: 'source-evidence-required',
    },
  ];
  for (const scenario of scenarios) {
    const decision = createLocalTeachingSafetyDecision({
      policy, requestText: scenario.text, context: scenario.context,
      learnerAttemptEvidenceIds: [], sourceEvidenceIds: [], idempotencyKey: `decision-${scenario.id}`,
      now: '2026-07-10T12:05:00.000Z',
    });
    assert.equal(decision.responseAuthorization.mode, scenario.mode, scenario.id);
    assert.equal(decision.responseAuthorization.canGenerateTeachingContent, scenario.canGenerate, scenario.id);
    assert.equal(decision.responseAuthorization.canProvideTargetAnswer, scenario.canAnswer, scenario.id);
    assert.equal(decision.reasonCodes.includes(scenario.reason), true, scenario.id);
    assert.equal(JSON.stringify(decision).includes(scenario.text), false, scenario.id);
    assert.equal(verifyLocalTeachingSafetyDecision(decision, policy).valid, true, scenario.id);
  }

  const reviewedAssignment = createLocalTeachingSafetyDecision({
    policy, requestText: 'Help me check my homework answer.', context: { activityType: 'assignment' },
    learnerAttemptEvidenceIds: ['attempt-proof-1'], sourceEvidenceIds: [], idempotencyKey: 'decision-reviewed-assignment', now: '2026-07-10T12:06:00.000Z',
  });
  assert.equal(reviewedAssignment.responseAuthorization.mode, 'answer-review');
  assert.equal(reviewedAssignment.responseAuthorization.canProvideTargetAnswer, true);
  assert.equal(reviewedAssignment.responseAuthorization.requiresUncertaintyDisclosure, true);
});

test('blocks child personal-data collection and keeps urgent wellbeing resolution human-only', () => {
  const childPolicy = createLocalTeachingSafetyPolicy({
    projectId: 'child-project', learnerId: 'child-learner', ageBand: 'child', supervisionMode: 'guardian-or-educator',
    actorId: 'manager', idempotencyKey: 'child-safe-policy', now: '2026-07-10T12:00:00.000Z',
  });
  const pii = createLocalTeachingSafetyDecision({
    policy: childPolicy,
    requestText: 'My email is child@example.com and my phone is 416-555-0101.',
    context: { activityType: 'open-study' }, idempotencyKey: 'child-pii', now: '2026-07-10T12:10:00.000Z',
  });
  assert.equal(pii.responseAuthorization.mode, 'privacy-safe-redirect');
  assert.equal(pii.responseAuthorization.canGenerateTeachingContent, false);
  assert.equal(pii.reasonCodes.includes('minor-personal-data-blocked'), true);

  const urgentText = 'I want to hurt myself and do not feel safe.';
  const urgent = createLocalTeachingSafetyDecision({
    policy,
    requestText: urgentText,
    context: { activityType: 'open-study' }, idempotencyKey: 'urgent-wellbeing', now: '2026-07-10T12:11:00.000Z',
  });
  assert.equal(urgent.responseAuthorization.mode, 'human-support-escalation');
  assert.equal(urgent.responseAuthorization.canGenerateTeachingContent, false);
  assert.equal(urgent.humanHandoffRequired, true);
  assert.equal(JSON.stringify(urgent).includes(urgentText), false);

  const resolution = createLocalTeachingSafetyResolution({
    decision: urgent,
    actorId: 'manager',
    resolutionCode: 'emergency-support-directed',
    evidenceIds: ['human-support-proof-1'],
    idempotencyKey: 'urgent-resolution',
    now: '2026-07-10T12:12:00.000Z',
  });
  assert.equal(verifyLocalTeachingSafetyResolution(resolution, urgent).valid, true);
  assert.equal(resolution.authorizesTeachingContent, false);

  const governance = buildLocalTeachingSafety({
    project: {
      id: policy.projectId,
      workModeContract: { workMode: 'learning' },
      localTeachingSafetyPolicies: [policy],
      localTeachingSafetyDecisions: [urgent],
      localTeachingSafetyResolutions: [resolution],
    },
    now: '2026-07-10T12:13:00.000Z',
  });
  assert.equal(governance.summary.openHumanEscalationCount, 0);
  assert.equal(governance.summary.resolvedHumanEscalationCount, 1);
  assert.equal(governance.integrity.valid, true);
});
