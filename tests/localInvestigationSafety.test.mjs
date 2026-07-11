import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLocalInvestigationSafety,
  createLocalInvestigationSafetyDecision,
  createLocalInvestigationSafetyPolicy,
  createLocalInvestigationSafetyResolution,
  createLocalInvestigationSafetyUse,
  verifyLocalInvestigationSafetyDecision,
  verifyLocalInvestigationSafetyPolicy,
  verifyLocalInvestigationSafetyUse,
} from '../src/agents/localInvestigationSafety.js';
import { createLocalInvestigationCase } from '../src/agents/localInvestigationCase.js';

const caseRecord = createLocalInvestigationCase({
  projectId: 'investigation-project', leadId: 'lead', investigatorId: 'investigator', analystId: 'analyst', reviewerId: 'reviewer',
  scope: 'PRIVATE CASE SCOPE',
  hypotheses: [
    { id: 'cause-a', type: 'primary', statement: 'A', falsificationCriteria: 'Not A', priorBps: 5000 },
    { id: 'cause-b', type: 'alternative', statement: 'B', falsificationCriteria: 'Not B', priorBps: 5000 },
  ],
  actorId: 'lead', idempotencyKey: 'case-1', now: '2026-07-11T12:00:00.000Z',
});

function publicPolicy(overrides = {}) {
  return createLocalInvestigationSafetyPolicy({
    caseRecord, authorityBasis: 'public-record-research', authorityEvidenceIds: [],
    allowedDataCategories: ['operational', 'public-record'], retentionDays: 30, decisionTtlMinutes: 15,
    reviewerId: 'reviewer', actorId: 'lead', idempotencyKey: 'policy-1', now: '2026-07-11T12:01:00.000Z',
    ...overrides,
  });
}

function decision(policy, overrides = {}) {
  return createLocalInvestigationSafetyDecision({
    policy, requestText: 'Collect the public deployment record.',
    context: {
      actionType: 'collect-evidence', targetIds: ['snapshot-1'], requestedDataCategories: ['operational'],
      collectionMethod: 'public-source', subjectType: 'organization', externalEffect: false,
    },
    caseState: { evidenceCount: 0, sealedEvidenceCount: 0, unresolvedContradictionCount: 0, conclusionCount: 0 },
    idempotencyKey: 'decision-1', now: '2026-07-11T12:02:00.000Z',
    ...overrides,
  });
}

test('creates a content-minimized versioned authority and minimization policy with immutable hard stops', () => {
  const policy = publicPolicy();
  assert.equal(verifyLocalInvestigationSafetyPolicy(policy, caseRecord).valid, true);
  assert.deepEqual(policy.allowedDataCategories, ['operational', 'public-record']);
  assert.equal(policy.hardStops.credentialAccessBlocked, true);
  assert.equal(policy.hardStops.externalActionAutoAuthorizationBlocked, true);
  assert.throws(() => publicPolicy({ allowedDataCategories: ['operational', 'contact'] }), /public-record-scope-invalid/);
  assert.throws(() => publicPolicy({ authorityBasis: 'subject-consent', authorityEvidenceIds: [] }), /authority-evidence-required/);
  assert.throws(() => publicPolicy({ now: '2026-07-11T11:59:00.000Z' }), /policy-before-case/);
  const consent = publicPolicy({
    authorityBasis: 'subject-consent', authorityEvidenceIds: ['consent-proof-1'], allowedDataCategories: ['contact', 'operational'],
    idempotencyKey: 'policy-consent',
  });
  assert.equal(consent.readyForLocalInvestigation, true);
  const revision = createLocalInvestigationSafetyPolicy({
    caseRecord, authorityBasis: 'public-record-research', authorityEvidenceIds: [], allowedDataCategories: ['operational'],
    retentionDays: 14, decisionTtlMinutes: 10, reviewerId: 'reviewer', actorId: 'lead',
    version: 2, previousPolicyId: policy.id, previousPolicyChecksum: policy.checksum,
    idempotencyKey: 'policy-2', now: '2026-07-11T12:01:30.000Z',
  });
  assert.equal(verifyLocalInvestigationSafetyPolicy(revision, caseRecord, policy).valid, true);
  assert.equal(verifyLocalInvestigationSafetyPolicy({ ...revision, retentionDays: 1 }, caseRecord, policy).valid, false);
});

test('derives deterministic hard blocks, human review, minimization and evidence sufficiency without retaining request text', () => {
  const policy = publicPolicy();
  const allowed = decision(policy);
  assert.equal(verifyLocalInvestigationSafetyDecision(allowed, policy).valid, true);
  assert.equal(allowed.responseAuthorization.canProceed, true);
  assert.equal(allowed.responseAuthorization.mode, 'minimized-local-action');
  assert.equal(JSON.stringify(allowed).includes('Collect the public deployment record.'), false);
  assert.throws(() => decision(policy, { idempotencyKey: 'early-decision', now: '2026-07-11T12:00:30.000Z' }), /decision-before-policy/);

  const cases = [
    {
      id: 'pii', requestText: 'Collect jane@example.com without listing contact data.',
      context: { actionType: 'collect-evidence', targetIds: ['snapshot-1'], requestedDataCategories: ['operational'], collectionMethod: 'public-source', subjectType: 'adult' },
      mode: 'data-minimization-blocked', reason: 'undeclared-pii-detected', human: false,
    },
    {
      id: 'authority', requestText: 'Read the private incident database.',
      context: { actionType: 'collect-evidence', targetIds: ['snapshot-1'], requestedDataCategories: ['operational'], collectionMethod: 'private-system', subjectType: 'organization' },
      mode: 'authority-required', reason: 'public-record-authority-insufficient', human: true,
    },
    {
      id: 'minor', requestText: 'Analyze a minor subject record.',
      context: { actionType: 'collect-evidence', targetIds: ['snapshot-1'], requestedDataCategories: ['public-record'], collectionMethod: 'public-source', subjectType: 'minor' },
      mode: 'sensitive-data-human-review', reason: 'minor-subject-human-review', human: true,
    },
    {
      id: 'biometric', requestText: 'Compare the face scan.',
      context: { actionType: 'analyze-evidence', targetIds: ['evidence-1'], requestedDataCategories: ['biometric'], collectionMethod: 'not-applicable', subjectType: 'adult' },
      mode: 'sensitive-data-human-review', reason: 'sensitive-data-human-review', human: true,
    },
    {
      id: 'prohibited', requestText: 'Doxx the employee and steal their password.',
      context: { actionType: 'collect-evidence', targetIds: ['person-1'], requestedDataCategories: ['public-record'], collectionMethod: 'public-source', subjectType: 'adult' },
      mode: 'prohibited-investigation-refusal', reason: 'prohibited-conduct-detected', human: true,
    },
    {
      id: 'insufficient', requestText: 'Draft the final causal conclusion.',
      context: { actionType: 'draft-conclusion', targetIds: [caseRecord.id], requestedDataCategories: [], collectionMethod: 'not-applicable', subjectType: 'organization' },
      caseState: { evidenceCount: 1, sealedEvidenceCount: 0, unresolvedContradictionCount: 1, conclusionCount: 0 },
      mode: 'insufficient-evidence', reason: 'conclusion-evidence-insufficient', human: false,
    },
    {
      id: 'external', requestText: 'Publish the employee finding now.',
      context: { actionType: 'publish-finding', targetIds: [caseRecord.id], requestedDataCategories: ['public-record'], collectionMethod: 'not-applicable', subjectType: 'adult', externalEffect: true },
      mode: 'external-effect-human-review', reason: 'external-effect-not-auto-authorized', human: true,
    },
  ];
  for (const scenario of cases) {
    const row = decision(policy, {
      requestText: scenario.requestText,
      context: scenario.context,
      caseState: scenario.caseState || { evidenceCount: 2, sealedEvidenceCount: 2, unresolvedContradictionCount: 0, conclusionCount: 1 },
      idempotencyKey: `decision-${scenario.id}`,
    });
    assert.equal(row.responseAuthorization.canProceed, false, scenario.id);
    assert.equal(row.responseAuthorization.mode, scenario.mode, scenario.id);
    assert.ok(row.reasonCodes.includes(scenario.reason), scenario.id);
    assert.equal(row.humanHandoffRequired, scenario.human, scenario.id);
    assert.equal(JSON.stringify(row).includes(scenario.requestText), false, scenario.id);
  }
});

test('keeps human disposition non-authorizing and consumes an unexpired exact-target decision once', () => {
  const policy = publicPolicy();
  const allowed = decision(policy);
  const use = createLocalInvestigationSafetyUse({
    decision: allowed, actionType: 'collect-evidence', targetIds: ['snapshot-1'], actorId: 'investigator',
    idempotencyKey: 'use-1', now: '2026-07-11T12:03:00.000Z',
  });
  assert.equal(verifyLocalInvestigationSafetyUse(use, allowed).valid, true);
  assert.throws(() => createLocalInvestigationSafetyUse({
    decision: allowed, actionType: 'collect-evidence', targetIds: ['snapshot-1'], actorId: 'investigator',
    idempotencyKey: 'early-use', now: '2026-07-11T12:01:30.000Z',
  }), /use-before-decision/);
  assert.throws(() => createLocalInvestigationSafetyUse({
    decision: allowed, actionType: 'collect-evidence', targetIds: ['snapshot-2'], actorId: 'investigator', idempotencyKey: 'wrong-target', now: '2026-07-11T12:03:00.000Z',
  }), /operation-target-mismatch/);
  assert.throws(() => createLocalInvestigationSafetyUse({
    decision: allowed, actionType: 'collect-evidence', targetIds: ['snapshot-1'], actorId: 'investigator', idempotencyKey: 'expired', now: '2026-07-11T12:18:00.001Z',
  }), /decision-expired/);

  const blocked = decision(policy, {
    requestText: 'Doxx the subject.',
    context: { actionType: 'external-action', targetIds: ['subject-1'], requestedDataCategories: ['public-record'], collectionMethod: 'not-applicable', subjectType: 'adult', externalEffect: true },
    idempotencyKey: 'blocked-decision',
  });
  const resolution = createLocalInvestigationSafetyResolution({
    decision: blocked, actorId: 'reviewer', resolutionCode: 'deny', evidenceIds: ['review-proof-1'],
    idempotencyKey: 'resolution-1', now: '2026-07-11T12:04:00.000Z',
  });
  assert.equal(resolution.authorizesOperation, false);
  assert.throws(() => createLocalInvestigationSafetyUse({
    decision: blocked, actionType: 'external-action', targetIds: ['subject-1'], actorId: 'investigator', idempotencyKey: 'blocked-use', now: '2026-07-11T12:05:00.000Z',
  }), /operation-not-authorized/);

  const safety = buildLocalInvestigationSafety({
    project: {
      id: caseRecord.projectId, workModeContract: { workMode: 'investigation' }, localInvestigationCases: [caseRecord],
      localInvestigationSafetyPolicies: [policy], localInvestigationSafetyDecisions: [allowed, blocked],
      localInvestigationSafetyResolutions: [resolution], localInvestigationSafetyUses: [use],
    },
    now: '2026-07-11T12:06:00.000Z',
  });
  assert.equal(safety.integrity.valid, true);
  assert.equal(safety.summary.allowedDecisionCount, 1);
  assert.equal(safety.summary.consumedDecisionCount, 1);
  assert.equal(safety.readyForLocalInvestigation, true);
  const degraded = buildLocalInvestigationSafety({
    project: {
      id: caseRecord.projectId, workModeContract: { workMode: 'investigation' }, localInvestigationCases: [caseRecord],
      localInvestigationSafetyPolicies: [policy], localInvestigationSafetyDecisions: [allowed, blocked],
      localInvestigationSafetyResolutions: [resolution], localInvestigationSafetyUses: [{ ...use, targetIds: ['snapshot-2'] }],
    },
    now: '2026-07-11T12:06:00.000Z',
  });
  assert.equal(degraded.status, 'degraded-integrity-invalid');
});
