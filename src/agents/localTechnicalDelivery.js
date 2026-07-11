import { portableSha256Hex } from './accessControl.js';
import { verifyLocalEngineeringSecurityAttestationReceipt } from './localEngineeringSecurity.js';

const RISK_LEVELS = new Set(['low', 'medium', 'high']);
const EVIDENCE_STATUSES = new Set(['passed', 'failed']);
const REVIEW_VERDICTS = new Set(['approved', 'changes-requested']);
const TARGET_TYPES = new Set(['local-package', 'local-service', 'local-workspace']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function checksum(value) {
  return portableSha256Hex(JSON.stringify(canonicalize(value)));
}

function receiptValid(receipt = {}, schemaVersion = '') {
  const { checksum: expected, ...base } = receipt;
  return receipt.schemaVersion === schemaVersion && Boolean(expected) && expected === checksum(base);
}

function identifier(value, field) {
  const text = String(value || '').trim();
  if (!text || text.length > 220 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(text)) throw new Error(`technical-delivery-${field}-invalid`);
  return text;
}

function text(value, field, max = 4_000) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max) throw new Error(`technical-delivery-${field}-invalid`);
  return normalized;
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`technical-delivery-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function uniqueStrings(values, field, { identifiers = false, min = 1, max = 100 } = {}) {
  if (!Array.isArray(values) || values.length < min || values.length > max) throw new Error(`technical-delivery-${field}-invalid`);
  const normalized = values.map((value) => identifiers ? identifier(value, field) : text(value, field));
  if (new Set(normalized).size !== normalized.length) throw new Error(`technical-delivery-${field}-duplicate`);
  return normalized;
}

function normalizeRequirements(requirements) {
  if (!Array.isArray(requirements) || !requirements.length || requirements.length > 100) throw new Error('technical-delivery-requirements-invalid');
  const rows = requirements.map((row) => ({
    id: identifier(row?.id, 'requirement-id'),
    statement: text(row?.statement, 'requirement-statement'),
    acceptanceCriteria: uniqueStrings(row?.acceptanceCriteria, 'acceptance-criterion', { max: 20 }),
  }));
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('technical-delivery-requirement-id-duplicate');
  return rows;
}

function normalizeRollbackPlan(input = {}) {
  return {
    trigger: text(input.trigger, 'rollback-trigger'),
    steps: uniqueStrings(input.steps, 'rollback-step', { max: 30 }),
    verificationSteps: uniqueStrings(input.verificationSteps, 'rollback-verification-step', { max: 30 }),
  };
}

function normalizeEvidence(rows, field, { allowEmpty = false } = {}) {
  if (!Array.isArray(rows) || (!allowEmpty && !rows.length) || rows.length > 100) throw new Error(`technical-delivery-${field}-invalid`);
  const normalized = rows.map((row) => {
    const status = String(row?.status || '').trim();
    if (!EVIDENCE_STATUSES.has(status)) throw new Error(`technical-delivery-${field}-status-invalid`);
    return { id: identifier(row?.id, `${field}-id`), status, evidenceId: identifier(row?.evidenceId, `${field}-evidence-id`) };
  });
  if (new Set(normalized.map((row) => row.id)).size !== normalized.length) throw new Error(`technical-delivery-${field}-id-duplicate`);
  return normalized;
}

export function createLocalTechnicalDeliveryPlan({
  projectId, requirements, changeSummary, affectedPaths, riskLevel, rollbackPlan,
  authorId, implementerId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  const normalizedProjectId = identifier(projectId, 'project-id');
  const normalizedRisk = String(riskLevel || '').trim();
  if (!RISK_LEVELS.has(normalizedRisk)) throw new Error('technical-delivery-risk-level-invalid');
  const normalizedAuthor = identifier(authorId, 'author-id');
  const normalizedImplementer = identifier(implementerId, 'implementer-id');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-technical-delivery-plan/v1',
    id: `technical_delivery_plan_${checksum(`${normalizedProjectId}:${normalizedKey}`).slice(0, 28)}`,
    projectId: normalizedProjectId,
    version: 1,
    requirements: normalizeRequirements(requirements),
    changeSummary: text(changeSummary, 'change-summary'),
    affectedPaths: uniqueStrings(affectedPaths, 'affected-path', { max: 200 }),
    riskLevel: normalizedRisk,
    rollbackPlan: normalizeRollbackPlan(rollbackPlan),
    authorId: normalizedAuthor,
    implementerId: normalizedImplementer,
    idempotencyKey: normalizedKey,
    localOnly: true,
    createdAt: iso(now, 'plan-created-at'),
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalTechnicalDeliveryPlan(plan = {}) {
  return { valid: receiptValid(plan, 'local-technical-delivery-plan/v1'), checksumValid: receiptValid(plan, 'local-technical-delivery-plan/v1') };
}

export function createLocalTechnicalDeliveryVerification({
  plan, implementationRevision, requirementEvidence, testEvidence, securityEvidence = [], rollbackRehearsal,
  actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(plan, 'local-technical-delivery-plan/v1')) throw new Error('technical-delivery-plan-integrity-invalid');
  const normalizedActor = identifier(actorId, 'verification-actor-id');
  if (normalizedActor !== plan.implementerId) throw new Error('technical-delivery-implementer-required');
  if (!Array.isArray(requirementEvidence)) throw new Error('technical-delivery-requirement-evidence-invalid');
  const normalizedRequirementEvidence = requirementEvidence.map((row) => ({
    requirementId: identifier(row?.requirementId, 'requirement-evidence-requirement-id'),
    evidenceIds: uniqueStrings(row?.evidenceIds, 'requirement-evidence-id', { identifiers: true, max: 100 }),
  }));
  const expectedRequirementIds = [...plan.requirements.map((row) => row.id)].sort();
  const actualRequirementIds = [...normalizedRequirementEvidence.map((row) => row.requirementId)].sort();
  if (new Set(actualRequirementIds).size !== actualRequirementIds.length
    || JSON.stringify(expectedRequirementIds) !== JSON.stringify(actualRequirementIds)) throw new Error('technical-delivery-requirement-coverage-incomplete');
  const tests = normalizeEvidence(testEvidence, 'test-evidence');
  if (tests.some((row) => row.status !== 'passed')) throw new Error('technical-delivery-tests-not-passed');
  const security = normalizeEvidence(securityEvidence, 'security-evidence', { allowEmpty: true });
  if (security.some((row) => row.status !== 'passed')) throw new Error('technical-delivery-security-evidence-not-passed');
  if (['medium', 'high'].includes(plan.riskLevel) && (!security.length || security.some((row) => row.status !== 'passed'))) throw new Error('technical-delivery-security-evidence-required');
  if (!rollbackRehearsal || rollbackRehearsal.status !== 'passed') throw new Error('technical-delivery-rollback-rehearsal-not-passed');
  const rollbackEvidenceIds = uniqueStrings(rollbackRehearsal.evidenceIds, 'rollback-rehearsal-evidence-id', { identifiers: true, max: 100 });
  const registeredEvidenceIds = new Set([
    ...tests.map((row) => row.evidenceId),
    ...security.map((row) => row.evidenceId),
    ...rollbackEvidenceIds,
  ]);
  if (normalizedRequirementEvidence.some((row) => row.evidenceIds.some((evidenceId) => !registeredEvidenceIds.has(evidenceId)))) {
    throw new Error('technical-delivery-requirement-evidence-reference-invalid');
  }
  const createdAt = iso(now, 'verification-created-at');
  if (Date.parse(createdAt) <= Date.parse(plan.createdAt)) throw new Error('technical-delivery-verification-before-plan');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-technical-delivery-verification/v1',
    id: `technical_delivery_verification_${checksum(`${plan.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: plan.projectId,
    planId: plan.id,
    planChecksum: plan.checksum,
    implementationRevision: text(implementationRevision, 'implementation-revision', 500),
    requirementEvidence: normalizedRequirementEvidence.sort((a, b) => a.requirementId.localeCompare(b.requirementId)),
    testEvidence: tests,
    securityEvidence: security,
    rollbackRehearsal: { status: 'passed', evidenceIds: rollbackEvidenceIds },
    actorId: normalizedActor,
    idempotencyKey: normalizedKey,
    status: 'verified',
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalTechnicalDeliveryVerification(verification = {}, plan = {}) {
  const checksumValid = receiptValid(verification, 'local-technical-delivery-verification/v1');
  const linkValid = receiptValid(plan, 'local-technical-delivery-plan/v1')
    && verification.projectId === plan.projectId && verification.planId === plan.id && verification.planChecksum === plan.checksum
    && verification.actorId === plan.implementerId && Date.parse(verification.createdAt) > Date.parse(plan.createdAt);
  const requirementsValid = JSON.stringify([...new Set((verification.requirementEvidence || []).map((row) => row.requirementId))].sort())
    === JSON.stringify((plan.requirements || []).map((row) => row.id).sort());
  const evidenceValid = (verification.testEvidence || []).length > 0
    && verification.testEvidence.every((row) => row.status === 'passed')
    && (verification.securityEvidence || []).every((row) => row.status === 'passed')
    && verification.rollbackRehearsal?.status === 'passed'
    && (verification.rollbackRehearsal?.evidenceIds || []).length > 0
    && (!['medium', 'high'].includes(plan.riskLevel) || ((verification.securityEvidence || []).length > 0 && verification.securityEvidence.every((row) => row.status === 'passed')));
  const registeredEvidenceIds = new Set([
    ...(verification.testEvidence || []).map((row) => row.evidenceId),
    ...(verification.securityEvidence || []).map((row) => row.evidenceId),
    ...(verification.rollbackRehearsal?.evidenceIds || []),
  ]);
  const evidenceReferencesValid = (verification.requirementEvidence || []).every((row) => (row.evidenceIds || []).length > 0
    && row.evidenceIds.every((evidenceId) => registeredEvidenceIds.has(evidenceId)));
  return { valid: checksumValid && linkValid && requirementsValid && evidenceValid && evidenceReferencesValid, checksumValid, linkValid, requirementsValid, evidenceValid, evidenceReferencesValid };
}

export function createLocalTechnicalDeliveryReview({
  plan, verification, reviewedRevision, reviewerId, verdict, blockingFindingIds = [], idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  if (!verifyLocalTechnicalDeliveryVerification(verification, plan).valid) throw new Error('technical-delivery-verification-integrity-invalid');
  const normalizedReviewer = identifier(reviewerId, 'reviewer-id');
  if ([plan.authorId, plan.implementerId].includes(normalizedReviewer)) throw new Error('technical-delivery-reviewer-independence-required');
  const normalizedRevision = text(reviewedRevision, 'reviewed-revision', 500);
  if (normalizedRevision !== verification.implementationRevision) throw new Error('technical-delivery-review-revision-mismatch');
  const normalizedVerdict = String(verdict || '').trim();
  if (!REVIEW_VERDICTS.has(normalizedVerdict)) throw new Error('technical-delivery-review-verdict-invalid');
  const findings = Array.isArray(blockingFindingIds) && blockingFindingIds.length
    ? uniqueStrings(blockingFindingIds, 'blocking-finding-id', { identifiers: true, max: 100 }) : [];
  if (normalizedVerdict === 'approved' && findings.length) throw new Error('technical-delivery-approved-review-has-blockers');
  const createdAt = iso(now, 'review-created-at');
  if (Date.parse(createdAt) <= Date.parse(verification.createdAt)) throw new Error('technical-delivery-review-before-verification');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-technical-delivery-review/v1',
    id: `technical_delivery_review_${checksum(`${verification.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: plan.projectId,
    planId: plan.id,
    planChecksum: plan.checksum,
    verificationId: verification.id,
    verificationChecksum: verification.checksum,
    reviewedRevision: normalizedRevision,
    reviewerId: normalizedReviewer,
    verdict: normalizedVerdict,
    blockingFindingIds: findings,
    idempotencyKey: normalizedKey,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalTechnicalDeliveryReview(review = {}, plan = {}, verification = {}) {
  const checksumValid = receiptValid(review, 'local-technical-delivery-review/v1');
  const linkValid = verifyLocalTechnicalDeliveryVerification(verification, plan).valid
    && review.planId === plan.id && review.planChecksum === plan.checksum
    && review.verificationId === verification.id && review.verificationChecksum === verification.checksum
    && review.reviewedRevision === verification.implementationRevision
    && ![plan.authorId, plan.implementerId].includes(review.reviewerId)
    && Date.parse(review.createdAt) > Date.parse(verification.createdAt);
  const approved = review.verdict === 'approved' && (review.blockingFindingIds || []).length === 0;
  return { valid: checksumValid && linkValid && approved, checksumValid, linkValid, approved };
}

export function createLocalTechnicalDeliveryRelease({
  plan, verification, review, engineeringSecurityAttestation, existingReleases = [], targetType, targetId, releaseVersion,
  actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!verifyLocalTechnicalDeliveryReview(review, plan, verification).valid) throw new Error('technical-delivery-release-gate-blocked');
  if (!verifyLocalEngineeringSecurityAttestationReceipt(engineeringSecurityAttestation).valid) throw new Error('technical-delivery-engineering-security-attestation-required');
  if (engineeringSecurityAttestation.projectId !== plan.projectId
    || engineeringSecurityAttestation.implementationRevision !== verification.implementationRevision) throw new Error('technical-delivery-engineering-security-revision-mismatch');
  const normalizedTargetType = String(targetType || '').trim();
  if (!TARGET_TYPES.has(normalizedTargetType)) throw new Error('technical-delivery-release-target-type-invalid');
  const normalizedTargetId = identifier(targetId, 'release-target-id');
  const normalizedReleaseVersion = identifier(releaseVersion, 'release-version');
  const operationKey = checksum({ targetType: normalizedTargetType, targetId: normalizedTargetId, releaseVersion: normalizedReleaseVersion });
  if ((Array.isArray(existingReleases) ? existingReleases : []).some((row) => row.operationKey === operationKey)) throw new Error('technical-delivery-release-target-version-already-recorded');
  const createdAt = iso(now, 'release-created-at');
  if (Date.parse(createdAt) <= Date.parse(review.createdAt)) throw new Error('technical-delivery-release-before-review');
  if (Date.parse(createdAt) <= Date.parse(engineeringSecurityAttestation.createdAt)
    || Date.parse(createdAt) > Date.parse(engineeringSecurityAttestation.expiresAt)) throw new Error('technical-delivery-engineering-security-attestation-expired');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-technical-delivery-release/v1',
    id: `technical_delivery_release_${checksum(`${review.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: plan.projectId,
    planId: plan.id,
    planChecksum: plan.checksum,
    verificationId: verification.id,
    verificationChecksum: verification.checksum,
    reviewId: review.id,
    reviewChecksum: review.checksum,
    engineeringSecurityAttestationId: engineeringSecurityAttestation.id,
    engineeringSecurityAttestationChecksum: engineeringSecurityAttestation.checksum,
    implementationRevision: verification.implementationRevision,
    targetType: normalizedTargetType,
    targetId: normalizedTargetId,
    releaseVersion: normalizedReleaseVersion,
    operationKey,
    actorId: identifier(actorId, 'release-actor-id'),
    idempotencyKey: normalizedKey,
    localOnly: true,
    status: 'released-locally',
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalTechnicalDeliveryRelease(release = {}, plan = {}, verification = {}, review = {}, engineeringSecurityAttestation = {}) {
  const checksumValid = receiptValid(release, 'local-technical-delivery-release/v1');
  const linkValid = verifyLocalTechnicalDeliveryReview(review, plan, verification).valid
    && release.planId === plan.id && release.planChecksum === plan.checksum
    && release.verificationId === verification.id && release.verificationChecksum === verification.checksum
    && release.reviewId === review.id && release.reviewChecksum === review.checksum
    && verifyLocalEngineeringSecurityAttestationReceipt(engineeringSecurityAttestation).valid
    && release.engineeringSecurityAttestationId === engineeringSecurityAttestation.id
    && release.engineeringSecurityAttestationChecksum === engineeringSecurityAttestation.checksum
    && engineeringSecurityAttestation.projectId === plan.projectId
    && engineeringSecurityAttestation.implementationRevision === verification.implementationRevision
    && release.implementationRevision === verification.implementationRevision
    && Date.parse(release.createdAt) > Date.parse(review.createdAt)
    && Date.parse(release.createdAt) > Date.parse(engineeringSecurityAttestation.createdAt)
    && Date.parse(release.createdAt) <= Date.parse(engineeringSecurityAttestation.expiresAt);
  const operationValid = TARGET_TYPES.has(release.targetType) && release.localOnly === true && release.status === 'released-locally'
    && release.operationKey === checksum({ targetType: release.targetType, targetId: release.targetId, releaseVersion: release.releaseVersion });
  return { valid: checksumValid && linkValid && operationValid, checksumValid, linkValid, operationValid };
}

function duplicates(rows, selector) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = selector(row);
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  }).map(selector);
}

export function buildLocalTechnicalDeliveryWorkflow({ project = {} } = {}) {
  const plans = Array.isArray(project.localTechnicalDeliveryPlans) ? project.localTechnicalDeliveryPlans : [];
  const verifications = Array.isArray(project.localTechnicalDeliveryVerifications) ? project.localTechnicalDeliveryVerifications : [];
  const reviews = Array.isArray(project.localTechnicalDeliveryReviews) ? project.localTechnicalDeliveryReviews : [];
  const releases = Array.isArray(project.localTechnicalDeliveryReleases) ? project.localTechnicalDeliveryReleases : [];
  const planMap = new Map(plans.map((row) => [row.id, row]));
  const verificationMap = new Map(verifications.map((row) => [row.id, row]));
  const reviewMap = new Map(reviews.map((row) => [row.id, row]));
  const attestationMap = new Map((project.localEngineeringSecurityAttestations || []).map((row) => [row.id, row]));
  const invalidReceiptIds = [];
  plans.forEach((row) => { if (!verifyLocalTechnicalDeliveryPlan(row).valid || row.projectId !== project.id) invalidReceiptIds.push(row.id); });
  verifications.forEach((row) => { if (!verifyLocalTechnicalDeliveryVerification(row, planMap.get(row.planId)).valid) invalidReceiptIds.push(row.id); });
  reviews.forEach((row) => { if (!verifyLocalTechnicalDeliveryReview(row, planMap.get(row.planId), verificationMap.get(row.verificationId)).valid) invalidReceiptIds.push(row.id); });
  releases.forEach((row) => { if (!verifyLocalTechnicalDeliveryRelease(row, planMap.get(row.planId), verificationMap.get(row.verificationId), reviewMap.get(row.reviewId), attestationMap.get(row.engineeringSecurityAttestationId)).valid) invalidReceiptIds.push(row.id); });
  const duplicateIds = duplicates([...plans, ...verifications, ...reviews, ...releases], (row) => row.id);
  const duplicateReleaseOperationKeys = duplicates(releases, (row) => row.operationKey);
  const modeValid = project.workModeContract?.workMode === 'technical-delivery';
  const valid = modeValid && invalidReceiptIds.length === 0 && duplicateIds.length === 0 && duplicateReleaseOperationKeys.length === 0;
  const latestPlan = plans[0] || null;
  const latestVerification = latestPlan ? verifications.find((row) => row.planId === latestPlan.id) || null : null;
  const latestReview = latestVerification ? reviews.find((row) => row.verificationId === latestVerification.id) || null : null;
  const releaseEligible = valid && Boolean(latestReview && verifyLocalTechnicalDeliveryReview(latestReview, latestPlan, latestVerification).valid);
  return {
    schemaVersion: 'local-technical-delivery-workflow/v1',
    projectId: project.id || null,
    localOnly: true,
    integrity: { valid, modeValid, invalidReceiptIds: [...new Set(invalidReceiptIds)], duplicateIds: [...new Set(duplicateIds)], duplicateReleaseOperationKeys: [...new Set(duplicateReleaseOperationKeys)] },
    latestPlan,
    latestVerification,
    latestReview,
    latestRelease: releases[0] || null,
    releaseEligible,
    readyForLocalRelease: valid && releases.length > 0,
    blockers: [
      !modeValid ? 'technical-delivery-work-mode-required' : null,
      invalidReceiptIds.length ? 'technical-delivery-ledger-integrity-invalid' : null,
      duplicateIds.length || duplicateReleaseOperationKeys.length ? 'technical-delivery-ledger-duplicate' : null,
      !latestPlan ? 'technical-delivery-plan-required' : null,
      latestPlan && !latestVerification ? 'technical-delivery-verification-required' : null,
      latestVerification && !latestReview ? 'technical-delivery-review-required' : null,
      valid && !releases.length ? 'technical-delivery-release-evidence-required' : null,
    ].filter(Boolean),
    summary: { planCount: plans.length, verificationCount: verifications.length, reviewCount: reviews.length, releaseCount: releases.length },
  };
}
