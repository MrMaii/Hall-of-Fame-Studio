import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalTechnicalDeliveryWorkflow,
  createLocalTechnicalDeliveryPlan,
  createLocalTechnicalDeliveryRelease,
  createLocalTechnicalDeliveryReview,
  createLocalTechnicalDeliveryVerification,
  verifyLocalTechnicalDeliveryPlan,
} from '../src/agents/localTechnicalDelivery.js';
import {
  buildLocalEngineeringSecurityLedger,
  createLocalEngineeringSecurityAttestation,
  createLocalEngineeringSecurityScan,
} from '../src/agents/localEngineeringSecurity.js';

const planInput = (overrides = {}) => ({
  projectId: 'technical_delivery_project',
  requirements: [
    { id: 'req-auth', statement: 'Reject unauthenticated writes.', acceptanceCriteria: ['401 without a valid local session'] },
    { id: 'req-restart', statement: 'Preserve accepted writes after restart.', acceptanceCriteria: ['file-backed restart returns the accepted record'] },
  ],
  changeSummary: 'Add a guarded local write path.',
  affectedPaths: ['src/agents/localWrite.js', 'tests/localWrite.test.mjs'],
  riskLevel: 'high',
  rollbackPlan: {
    trigger: 'Authentication or persistence regression.',
    steps: ['Stop the local process.', 'Restore the previous workspace revision.'],
    verificationSteps: ['Run the authentication and restart tests.'],
  },
  authorId: 'delivery-lead',
  implementerId: 'systems-engineer',
  idempotencyKey: 'plan-1',
  now: '2026-07-11T12:00:00.000Z',
  ...overrides,
});

function validChain() {
  const plan = createLocalTechnicalDeliveryPlan(planInput());
  const verification = createLocalTechnicalDeliveryVerification({
    plan,
    implementationRevision: 'sha256:implementation-revision-001',
    requirementEvidence: [
      { requirementId: 'req-auth', evidenceIds: ['test-auth-001'] },
      { requirementId: 'req-restart', evidenceIds: ['test-restart-001'] },
    ],
    testEvidence: [
      { id: 'auth-suite', status: 'passed', evidenceId: 'test-auth-001' },
      { id: 'restart-suite', status: 'passed', evidenceId: 'test-restart-001' },
    ],
    securityEvidence: [{ id: 'security-scan', status: 'passed', evidenceId: 'scan-001' }],
    rollbackRehearsal: { status: 'passed', evidenceIds: ['rollback-001'] },
    actorId: 'systems-engineer',
    idempotencyKey: 'verify-1',
    now: '2026-07-11T12:10:00.000Z',
  });
  const review = createLocalTechnicalDeliveryReview({
    plan,
    verification,
    reviewedRevision: verification.implementationRevision,
    reviewerId: 'quality-security-reviewer',
    verdict: 'approved',
    blockingFindingIds: [],
    idempotencyKey: 'review-1',
    now: '2026-07-11T12:20:00.000Z',
  });
  const engineeringSecurityScan = createLocalEngineeringSecurityScan({
    projectId: plan.projectId,
    implementationRevision: verification.implementationRevision,
    checks: [
      { type: 'dependency', toolId: 'dependency-audit', toolVersion: '1.0.0', configHash: 'a'.repeat(64), evidenceId: 'dependency-proof', status: 'passed', completedAt: '2026-07-11T12:21:00.000Z' },
      { type: 'secret', toolId: 'secret-scan', toolVersion: '1.0.0', configHash: 'b'.repeat(64), evidenceId: 'secret-proof', status: 'passed', completedAt: '2026-07-11T12:21:10.000Z' },
      { type: 'permission', toolId: 'permission-audit', toolVersion: '1.0.0', configHash: 'c'.repeat(64), evidenceId: 'permission-proof', status: 'passed', completedAt: '2026-07-11T12:21:20.000Z' },
      { type: 'static-analysis', toolId: 'local-sast', toolVersion: '1.0.0', configHash: 'd'.repeat(64), evidenceId: 'sast-proof', status: 'passed', completedAt: '2026-07-11T12:21:30.000Z' },
    ],
    findings: [],
    actorId: plan.implementerId,
    idempotencyKey: 'technical-security-scan',
    now: '2026-07-11T12:22:00.000Z',
  });
  const engineeringSecurityLedger = buildLocalEngineeringSecurityLedger({
    project: { id: plan.projectId, workModeContract: { workMode: 'technical-delivery' }, localEngineeringSecurityScans: [engineeringSecurityScan] },
    now: '2026-07-11T12:22:30.000Z',
  });
  const engineeringSecurityAttestation = createLocalEngineeringSecurityAttestation({
    ledger: engineeringSecurityLedger,
    actorId: 'quality-security-reviewer',
    securityReviewerId: 'quality-security-reviewer',
    idempotencyKey: 'technical-security-attestation',
    now: '2026-07-11T12:23:00.000Z',
  });
  return { plan, verification, review, engineeringSecurityScan, engineeringSecurityAttestation };
}

test('creates a versioned plan with traceable requirements and a concrete rollback contract', () => {
  const plan = createLocalTechnicalDeliveryPlan(planInput());
  assert.equal(plan.schemaVersion, 'local-technical-delivery-plan/v1');
  assert.equal(plan.requirements.length, 2);
  assert.equal(plan.rollbackPlan.steps.length, 2);
  assert.equal(verifyLocalTechnicalDeliveryPlan(plan).valid, true);
  assert.throws(() => createLocalTechnicalDeliveryPlan(planInput({ requirements: [planInput().requirements[0], planInput().requirements[0]] })), /requirement-id-duplicate/);
  assert.throws(() => createLocalTechnicalDeliveryPlan(planInput({ rollbackPlan: { trigger: 'Regression', steps: [], verificationSteps: [] } })), /rollback/);
  const tampered = structuredClone(plan);
  tampered.riskLevel = 'low';
  assert.equal(verifyLocalTechnicalDeliveryPlan(tampered).valid, false);
});

test('fails verification closed on missing requirements, failed tests, security gaps, rollback gaps, or time regression', () => {
  const { plan } = validChain();
  const base = {
    plan,
    implementationRevision: 'sha256:implementation-revision-002',
    requirementEvidence: plan.requirements.map((row) => ({ requirementId: row.id, evidenceIds: ['test-full'] })),
    testEvidence: [{ id: 'full-suite', status: 'passed', evidenceId: 'test-full' }],
    securityEvidence: [{ id: 'security-scan', status: 'passed', evidenceId: 'scan-full' }],
    rollbackRehearsal: { status: 'passed', evidenceIds: ['rollback-full'] },
    actorId: plan.implementerId,
    idempotencyKey: 'verify-negative',
    now: '2026-07-11T12:11:00.000Z',
  };
  assert.throws(() => createLocalTechnicalDeliveryVerification({ ...base, requirementEvidence: base.requirementEvidence.slice(0, 1) }), /requirement-coverage-incomplete/);
  assert.throws(() => createLocalTechnicalDeliveryVerification({ ...base, testEvidence: [{ id: 'full-suite', status: 'failed', evidenceId: 'test-full' }] }), /tests-not-passed/);
  assert.throws(() => createLocalTechnicalDeliveryVerification({ ...base, requirementEvidence: base.requirementEvidence.map((row) => ({ ...row, evidenceIds: ['unregistered-proof'] })) }), /requirement-evidence-reference-invalid/);
  assert.throws(() => createLocalTechnicalDeliveryVerification({ ...base, securityEvidence: [] }), /security-evidence-required/);
  assert.throws(() => createLocalTechnicalDeliveryVerification({ ...base, rollbackRehearsal: { status: 'failed', evidenceIds: ['rollback-full'] } }), /rollback-rehearsal-not-passed/);
  assert.throws(() => createLocalTechnicalDeliveryVerification({ ...base, now: plan.createdAt }), /verification-before-plan/);
  const lowRiskPlan = createLocalTechnicalDeliveryPlan(planInput({ riskLevel: 'low', idempotencyKey: 'low-risk-plan' }));
  assert.throws(() => createLocalTechnicalDeliveryVerification({
    ...base,
    plan: lowRiskPlan,
    actorId: lowRiskPlan.implementerId,
    requirementEvidence: lowRiskPlan.requirements.map((row) => ({ requirementId: row.id, evidenceIds: ['test-full'] })),
    securityEvidence: [{ id: 'optional-scan', status: 'failed', evidenceId: 'failed-scan' }],
  }), /security-evidence-not-passed/);
});

test('requires independent exact-revision approval and engineering security attestation before issuing one local release receipt', () => {
  const { plan, verification, review, engineeringSecurityAttestation } = validChain();
  assert.throws(() => createLocalTechnicalDeliveryReview({
    plan, verification, reviewedRevision: verification.implementationRevision, reviewerId: plan.implementerId,
    verdict: 'approved', blockingFindingIds: [], idempotencyKey: 'self-review', now: '2026-07-11T12:21:00.000Z',
  }), /reviewer-independence-required/);
  assert.throws(() => createLocalTechnicalDeliveryReview({
    plan, verification, reviewedRevision: 'sha256:wrong', reviewerId: 'quality-security-reviewer',
    verdict: 'approved', blockingFindingIds: [], idempotencyKey: 'wrong-revision', now: '2026-07-11T12:21:00.000Z',
  }), /review-revision-mismatch/);
  assert.throws(() => createLocalTechnicalDeliveryRelease({
    plan, verification, review, existingReleases: [], targetType: 'local-package', targetId: 'hall-of-fame-studio',
    releaseVersion: '0.47.0', actorId: 'product-owner', idempotencyKey: 'release-without-security', now: '2026-07-11T12:30:00.000Z',
  }), /engineering-security-attestation-required/);
  const release = createLocalTechnicalDeliveryRelease({
    plan, verification, review, engineeringSecurityAttestation, existingReleases: [], targetType: 'local-package', targetId: 'hall-of-fame-studio',
    releaseVersion: '0.47.0', actorId: 'product-owner', idempotencyKey: 'release-1', now: '2026-07-11T12:30:00.000Z',
  });
  assert.equal(release.status, 'released-locally');
  assert.equal(release.localOnly, true);
  assert.equal(release.implementationRevision, verification.implementationRevision);
  assert.throws(() => createLocalTechnicalDeliveryRelease({
    plan, verification, review, engineeringSecurityAttestation, existingReleases: [release], targetType: release.targetType, targetId: release.targetId,
    releaseVersion: release.releaseVersion, actorId: 'product-owner', idempotencyKey: 'release-2', now: '2026-07-11T12:31:00.000Z',
  }), /release-target-version-already-recorded/);
});

test('projects a restart-safe workflow and marks stale links, duplicates, and tampering invalid', () => {
  const { plan, verification, review, engineeringSecurityScan, engineeringSecurityAttestation } = validChain();
  const release = createLocalTechnicalDeliveryRelease({
    plan, verification, review, engineeringSecurityAttestation, targetType: 'local-service', targetId: 'agent-runtime', releaseVersion: '47.0.0',
    actorId: 'product-owner', idempotencyKey: 'release-projection', now: '2026-07-11T12:30:00.000Z',
  });
  const project = {
    id: plan.projectId,
    workModeContract: { workMode: 'technical-delivery' },
    localTechnicalDeliveryPlans: [plan],
    localTechnicalDeliveryVerifications: [verification],
    localTechnicalDeliveryReviews: [review],
    localTechnicalDeliveryReleases: [release],
    localEngineeringSecurityScans: [engineeringSecurityScan],
    localEngineeringSecurityAttestations: [engineeringSecurityAttestation],
  };
  const ready = buildLocalTechnicalDeliveryWorkflow({ project });
  assert.equal(ready.schemaVersion, 'local-technical-delivery-workflow/v1');
  assert.equal(ready.integrity.valid, true);
  assert.equal(ready.readyForLocalRelease, true);
  assert.equal(ready.summary.releaseCount, 1);
  const duplicate = buildLocalTechnicalDeliveryWorkflow({ project: { ...project, localTechnicalDeliveryReleases: [release, release] } });
  assert.equal(duplicate.integrity.valid, false);
  const tamperedReview = structuredClone(review);
  tamperedReview.verdict = 'changes-requested';
  const tampered = buildLocalTechnicalDeliveryWorkflow({ project: { ...project, localTechnicalDeliveryReviews: [tamperedReview] } });
  assert.equal(tampered.integrity.valid, false);
  assert.equal(tampered.readyForLocalRelease, false);
});
