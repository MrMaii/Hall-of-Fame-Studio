import { portableSha256Hex } from './accessControl.js';

const VERDICTS = new Set(['accepted', 'changes-requested', 'rejected']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function localReviewHandoffChecksum(value) {
  return portableSha256Hex(JSON.stringify(canonicalize(value)));
}

function identifier(value, field, { optional = false } = {}) {
  const normalized = String(value || '').trim();
  if (!normalized && optional) return null;
  if (!normalized || normalized.length > 180 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(normalized)) {
    throw new Error(`review-handoff-${field}-invalid`);
  }
  return normalized;
}

function timestamp(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`review-handoff-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function checksum(value, field) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error(`review-handoff-${field}-invalid`);
  return normalized;
}

function criteriaRows(criteria = []) {
  if (!Array.isArray(criteria) || !criteria.length || criteria.length > 24) throw new Error('review-handoff-acceptance-criteria-required');
  const rows = criteria.map((criterion = {}) => {
    const label = String(criterion.label || '').trim();
    if (!label || label.length > 240) throw new Error('review-handoff-criterion-label-invalid');
    return {
      id: identifier(criterion.id, 'criterion-id'),
      label,
      required: criterion.required !== false,
    };
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('review-handoff-criterion-duplicate');
  if (!rows.some((row) => row.required)) throw new Error('review-handoff-required-criterion-missing');
  return rows;
}

export function localReviewSubmissionFingerprint(submission = {}) {
  return localReviewHandoffChecksum({
    id: submission.id || null,
    projectId: submission.projectId || null,
    agentId: submission.agentId || null,
    artifactType: submission.artifactType || null,
    artifactChecksum: submission.artifactChecksum || null,
    artifactStorageProofChecksum: submission.artifactStorageProofChecksum || null,
    bodyChecksum: portableSha256Hex(String(submission.body || '')),
    updatedAt: submission.updatedAt || submission.createdAt || null,
  });
}

export function createLocalReviewHandoff({
  projectId,
  submission,
  reviewerAgentId,
  acceptanceCriteria,
  dueAt,
  requestedBy,
  idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  const createdAt = timestamp(now, 'created-at');
  const normalizedDueAt = timestamp(dueAt, 'due-at');
  const dueMs = Date.parse(normalizedDueAt) - Date.parse(createdAt);
  if (dueMs < 15 * 60_000 || dueMs > 14 * 24 * 60 * 60_000) throw new Error('review-handoff-due-window-invalid');
  const normalizedProjectId = identifier(projectId, 'project-id');
  const submissionId = identifier(submission?.id, 'submission-id');
  const submitterAgentId = identifier(submission?.agentId, 'submitter-agent-id');
  const normalizedReviewerId = identifier(reviewerAgentId, 'reviewer-agent-id');
  if (submitterAgentId === normalizedReviewerId) throw new Error('review-handoff-independent-reviewer-required');
  const normalizedCriteria = criteriaRows(acceptanceCriteria);
  const normalizedIdempotencyKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-review-handoff/v1',
    id: `review_handoff_${localReviewHandoffChecksum(`${normalizedProjectId}:${submissionId}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: normalizedProjectId,
    submissionId,
    submissionFingerprint: localReviewSubmissionFingerprint(submission),
    artifactType: identifier(submission.artifactType || 'artifact', 'artifact-type'),
    submitterAgentId,
    reviewerAgentId: normalizedReviewerId,
    acceptanceCriteria: normalizedCriteria,
    acceptanceCriteriaChecksum: localReviewHandoffChecksum(normalizedCriteria),
    dueAt: normalizedDueAt,
    requestedBy: identifier(requestedBy, 'requested-by'),
    idempotencyKey: normalizedIdempotencyKey,
    storesArtifactContent: false,
    createdAt,
  };
  return { ...base, checksum: localReviewHandoffChecksum(base) };
}

export function verifyLocalReviewHandoff(handoff = {}) {
  const { checksum: receiptChecksum, ...base } = handoff;
  const checksumValid = Boolean(receiptChecksum) && receiptChecksum === localReviewHandoffChecksum(base);
  const schemaValid = handoff.schemaVersion === 'local-review-handoff/v1';
  const independenceValid = Boolean(handoff.submitterAgentId && handoff.reviewerAgentId && handoff.submitterAgentId !== handoff.reviewerAgentId);
  const criteriaValid = Array.isArray(handoff.acceptanceCriteria)
    && handoff.acceptanceCriteria.length > 0
    && handoff.acceptanceCriteriaChecksum === localReviewHandoffChecksum(handoff.acceptanceCriteria);
  const dueValid = Number.isFinite(Date.parse(handoff.dueAt)) && Date.parse(handoff.dueAt) > Date.parse(handoff.createdAt);
  return { valid: checksumValid && schemaValid && independenceValid && criteriaValid && dueValid, checksumValid, schemaValid, independenceValid, criteriaValid, dueValid };
}

export function createLocalReviewHandoffAcknowledgement({ handoff, reviewerAgentId, idempotencyKey, now = new Date().toISOString() } = {}) {
  if (!verifyLocalReviewHandoff(handoff).valid) throw new Error('review-handoff-integrity-invalid');
  const reviewer = identifier(reviewerAgentId, 'reviewer-agent-id');
  if (reviewer !== handoff.reviewerAgentId) throw new Error('review-handoff-reviewer-required');
  const normalizedIdempotencyKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-review-handoff-acknowledgement/v1',
    id: `review_handoff_ack_${localReviewHandoffChecksum(`${handoff.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: handoff.projectId,
    handoffId: handoff.id,
    handoffChecksum: handoff.checksum,
    reviewerAgentId: reviewer,
    idempotencyKey: normalizedIdempotencyKey,
    storesArtifactContent: false,
    acknowledgedAt: timestamp(now, 'acknowledged-at'),
  };
  return { ...base, checksum: localReviewHandoffChecksum(base) };
}

export function verifyLocalReviewHandoffAcknowledgement(receipt = {}, handoff = {}) {
  const { checksum: receiptChecksum, ...base } = receipt;
  const checksumValid = Boolean(receiptChecksum) && receiptChecksum === localReviewHandoffChecksum(base);
  const linkValid = receipt.schemaVersion === 'local-review-handoff-acknowledgement/v1'
    && receipt.handoffId === handoff.id
    && receipt.handoffChecksum === handoff.checksum
    && receipt.reviewerAgentId === handoff.reviewerAgentId;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function createLocalReviewHandoffClaim({
  handoff,
  reviewerAgentId,
  fence,
  leaseMs = 30 * 60_000,
  idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  if (!verifyLocalReviewHandoff(handoff).valid) throw new Error('review-handoff-integrity-invalid');
  const reviewer = identifier(reviewerAgentId, 'reviewer-agent-id');
  if (reviewer !== handoff.reviewerAgentId) throw new Error('review-handoff-reviewer-required');
  const normalizedFence = Number(fence);
  if (!Number.isInteger(normalizedFence) || normalizedFence < 1) throw new Error('review-handoff-claim-fence-invalid');
  const normalizedLeaseMs = Number(leaseMs);
  if (!Number.isInteger(normalizedLeaseMs) || normalizedLeaseMs < 60_000 || normalizedLeaseMs > 4 * 60 * 60_000) {
    throw new Error('review-handoff-claim-lease-invalid');
  }
  const claimedAt = timestamp(now, 'claimed-at');
  const normalizedIdempotencyKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-review-handoff-claim/v1',
    id: `review_handoff_claim_${localReviewHandoffChecksum(`${handoff.id}:${normalizedFence}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: handoff.projectId,
    handoffId: handoff.id,
    handoffChecksum: handoff.checksum,
    reviewerAgentId: reviewer,
    fence: normalizedFence,
    leaseMs: normalizedLeaseMs,
    claimedAt,
    expiresAt: new Date(Date.parse(claimedAt) + normalizedLeaseMs).toISOString(),
    idempotencyKey: normalizedIdempotencyKey,
    storesArtifactContent: false,
  };
  return { ...base, checksum: localReviewHandoffChecksum(base) };
}

export function verifyLocalReviewHandoffClaim(receipt = {}, handoff = {}) {
  const { checksum: receiptChecksum, ...base } = receipt;
  const checksumValid = Boolean(receiptChecksum) && receiptChecksum === localReviewHandoffChecksum(base);
  const linkValid = receipt.schemaVersion === 'local-review-handoff-claim/v1'
    && receipt.handoffId === handoff.id
    && receipt.handoffChecksum === handoff.checksum
    && receipt.reviewerAgentId === handoff.reviewerAgentId;
  const leaseValid = Number.isInteger(receipt.fence) && receipt.fence > 0 && Date.parse(receipt.expiresAt) > Date.parse(receipt.claimedAt);
  return { valid: checksumValid && linkValid && leaseValid, checksumValid, linkValid, leaseValid };
}

function normalizeCriterionResults(results = [], criteria = []) {
  if (!Array.isArray(results) || results.length !== criteria.length) throw new Error('review-handoff-criterion-coverage-required');
  const expectedIds = [...criteria.map((criterion) => criterion.id)].sort();
  const rows = results.map((result = {}) => ({
    criterionId: identifier(result.criterionId, 'criterion-result-id'),
    passed: result.passed === true,
    evidenceIds: [...new Set((Array.isArray(result.evidenceIds) ? result.evidenceIds : [])
      .map((value) => identifier(value, 'criterion-evidence-id')))].sort(),
  })).sort((left, right) => left.criterionId.localeCompare(right.criterionId));
  if (JSON.stringify(rows.map((row) => row.criterionId)) !== JSON.stringify(expectedIds)
    || rows.some((row) => !row.evidenceIds.length)) {
    throw new Error('review-handoff-criterion-coverage-required');
  }
  return rows;
}

export function createLocalReviewHandoffCompletion({
  handoff,
  claim,
  submissionFingerprint,
  verdict,
  criterionResults,
  reviewId,
  reviewChecksum,
  reviewIntentChecksum = null,
  reviewerAgentId,
  idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  if (!verifyLocalReviewHandoff(handoff).valid || !verifyLocalReviewHandoffClaim(claim, handoff).valid) {
    throw new Error('review-handoff-completion-prerequisite-invalid');
  }
  const completedAt = timestamp(now, 'completed-at');
  if (Date.parse(completedAt) > Date.parse(claim.expiresAt)) throw new Error('review-handoff-claim-expired');
  const reviewer = identifier(reviewerAgentId, 'reviewer-agent-id');
  if (reviewer !== handoff.reviewerAgentId || reviewer !== claim.reviewerAgentId) throw new Error('review-handoff-reviewer-required');
  const normalizedFingerprint = checksum(submissionFingerprint, 'submission-fingerprint');
  if (normalizedFingerprint !== handoff.submissionFingerprint) throw new Error('review-handoff-stale-submission');
  const normalizedVerdict = String(verdict || '').trim();
  if (!VERDICTS.has(normalizedVerdict)) throw new Error('review-handoff-verdict-invalid');
  const results = normalizeCriterionResults(criterionResults, handoff.acceptanceCriteria);
  if (normalizedVerdict === 'accepted') {
    const requiredIds = new Set(handoff.acceptanceCriteria.filter((criterion) => criterion.required).map((criterion) => criterion.id));
    if (results.some((result) => requiredIds.has(result.criterionId) && !result.passed)) {
      throw new Error('review-handoff-required-criteria-not-passed');
    }
  }
  const normalizedIdempotencyKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-review-handoff-completion/v1',
    id: `review_handoff_completion_${localReviewHandoffChecksum(`${handoff.id}:${claim.fence}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: handoff.projectId,
    handoffId: handoff.id,
    handoffChecksum: handoff.checksum,
    claimId: claim.id,
    claimChecksum: claim.checksum,
    fence: claim.fence,
    reviewerAgentId: reviewer,
    submissionId: handoff.submissionId,
    submissionFingerprint: normalizedFingerprint,
    verdict: normalizedVerdict,
    criterionResults: results,
    criterionResultsChecksum: localReviewHandoffChecksum(results),
    reviewId: identifier(reviewId, 'review-id'),
    reviewChecksum: checksum(reviewChecksum, 'review-checksum'),
    reviewIntentChecksum: checksum(reviewIntentChecksum || localReviewHandoffChecksum({ verdict: normalizedVerdict }), 'review-intent-checksum'),
    idempotencyKey: normalizedIdempotencyKey,
    storesArtifactContent: false,
    completedAt,
  };
  return { ...base, checksum: localReviewHandoffChecksum(base) };
}

export function verifyLocalReviewHandoffCompletion(receipt = {}, handoff = {}, claim = {}) {
  const { checksum: receiptChecksum, ...base } = receipt;
  const checksumValid = Boolean(receiptChecksum) && receiptChecksum === localReviewHandoffChecksum(base);
  const linkValid = receipt.schemaVersion === 'local-review-handoff-completion/v1'
    && receipt.handoffId === handoff.id
    && receipt.handoffChecksum === handoff.checksum
    && receipt.claimId === claim.id
    && receipt.claimChecksum === claim.checksum
    && receipt.fence === claim.fence
    && receipt.submissionFingerprint === handoff.submissionFingerprint;
  const resultValid = receipt.criterionResultsChecksum === localReviewHandoffChecksum(receipt.criterionResults || []);
  return { valid: checksumValid && linkValid && resultValid, checksumValid, linkValid, resultValid };
}

export function createLocalReviewHandoffEscalation({ handoff, reasonCode = 'review-overdue', idempotencyKey, now = new Date().toISOString() } = {}) {
  if (!verifyLocalReviewHandoff(handoff).valid) throw new Error('review-handoff-integrity-invalid');
  const escalatedAt = timestamp(now, 'escalated-at');
  if (reasonCode === 'review-overdue' && Date.parse(escalatedAt) <= Date.parse(handoff.dueAt)) throw new Error('review-handoff-not-overdue');
  const normalizedIdempotencyKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-review-handoff-escalation/v1',
    id: `review_handoff_escalation_${localReviewHandoffChecksum(`${handoff.id}:${reasonCode}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: handoff.projectId,
    handoffId: handoff.id,
    handoffChecksum: handoff.checksum,
    reviewerAgentId: handoff.reviewerAgentId,
    reasonCode: identifier(reasonCode, 'escalation-reason-code'),
    idempotencyKey: normalizedIdempotencyKey,
    storesArtifactContent: false,
    escalatedAt,
  };
  return { ...base, checksum: localReviewHandoffChecksum(base) };
}

export function verifyLocalReviewHandoffEscalation(receipt = {}, handoff = {}) {
  const { checksum: receiptChecksum, ...base } = receipt;
  const checksumValid = Boolean(receiptChecksum) && receiptChecksum === localReviewHandoffChecksum(base);
  const linkValid = receipt.schemaVersion === 'local-review-handoff-escalation/v1'
    && receipt.handoffId === handoff.id
    && receipt.handoffChecksum === handoff.checksum
    && receipt.reviewerAgentId === handoff.reviewerAgentId;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function buildLocalReviewHandoffGovernance({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = timestamp(now, 'generated-at');
  const handoffs = project.localReviewHandoffs || [];
  const acknowledgements = project.localReviewHandoffAcknowledgements || [];
  const claims = project.localReviewHandoffClaims || [];
  const completions = project.localReviewHandoffCompletions || [];
  const escalations = project.localReviewHandoffEscalations || [];
  const handoffById = new Map(handoffs.map((handoff) => [handoff.id, handoff]));
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const handoffIntegrity = handoffs.map((handoff) => ({ id: handoff.id, ...verifyLocalReviewHandoff(handoff) }));
  const acknowledgementIntegrity = acknowledgements.map((receipt) => ({ id: receipt.id, ...verifyLocalReviewHandoffAcknowledgement(receipt, handoffById.get(receipt.handoffId) || {}) }));
  const claimIntegrity = claims.map((receipt) => ({ id: receipt.id, ...verifyLocalReviewHandoffClaim(receipt, handoffById.get(receipt.handoffId) || {}) }));
  const completionIntegrity = completions.map((receipt) => ({
    id: receipt.id,
    ...verifyLocalReviewHandoffCompletion(receipt, handoffById.get(receipt.handoffId) || {}, claimById.get(receipt.claimId) || {}),
  }));
  const escalationIntegrity = escalations.map((receipt) => ({ id: receipt.id, ...verifyLocalReviewHandoffEscalation(receipt, handoffById.get(receipt.handoffId) || {}) }));
  const conflictHandoffIds = handoffs.filter((handoff) => {
    const rows = claims.filter((claim) => claim.handoffId === handoff.id);
    const fences = rows.map((claim) => claim.fence);
    const duplicateFence = new Set(fences).size !== fences.length;
    const multipleCompletions = completions.filter((completion) => completion.handoffId === handoff.id).length > 1;
    const hasClaimWithoutAck = rows.length > 0 && !acknowledgements.some((ack) => ack.handoffId === handoff.id && Date.parse(ack.acknowledgedAt) <= Date.parse(rows[0].claimedAt));
    const latestFence = fences.length ? Math.max(...fences) : null;
    const staleCompletion = completions.some((completion) => completion.handoffId === handoff.id && completion.fence !== latestFence);
    return duplicateFence || multipleCompletions || hasClaimWithoutAck || staleCompletion;
  }).map((handoff) => handoff.id).sort();
  const integrityValid = conflictHandoffIds.length === 0
    && [handoffIntegrity, acknowledgementIntegrity, claimIntegrity, completionIntegrity, escalationIntegrity]
      .every((rows) => rows.every((row) => row.valid));
  const rows = handoffs.map((handoff) => {
    const handoffClaims = claims.filter((claim) => claim.handoffId === handoff.id).sort((left, right) => right.fence - left.fence);
    const latestClaim = handoffClaims[0] || null;
    const completion = completions.find((receipt) => receipt.handoffId === handoff.id) || null;
    const acknowledged = acknowledgements.some((receipt) => receipt.handoffId === handoff.id);
    const escalated = escalations.some((receipt) => receipt.handoffId === handoff.id);
    const overdue = !completion && Date.parse(generatedAt) > Date.parse(handoff.dueAt);
    const claimActive = Boolean(latestClaim && Date.parse(generatedAt) <= Date.parse(latestClaim.expiresAt));
    return {
      handoffId: handoff.id,
      submissionId: handoff.submissionId,
      artifactType: handoff.artifactType,
      submitterAgentId: handoff.submitterAgentId,
      reviewerAgentId: handoff.reviewerAgentId,
      dueAt: handoff.dueAt,
      acceptanceCriteria: handoff.acceptanceCriteria,
      acceptanceCriteriaChecksum: handoff.acceptanceCriteriaChecksum,
      acknowledged,
      activeClaimId: claimActive ? latestClaim.id : null,
      activeFence: latestClaim?.fence || null,
      claimActive,
      completionId: completion?.id || null,
      reviewId: completion?.reviewId || null,
      verdict: completion?.verdict || null,
      overdue,
      escalated,
      state: completion ? 'completed' : overdue ? 'overdue' : claimActive ? 'claimed' : acknowledged ? 'acknowledged' : 'requested',
      checksum: handoff.checksum,
    };
  });
  const governanceChecksum = localReviewHandoffChecksum({
    schemaVersion: 'local-review-handoff-governance/v1',
    projectId: project.id,
    handoffs: handoffs.map((row) => [row.id, row.checksum]),
    acknowledgements: acknowledgements.map((row) => [row.id, row.checksum]),
    claims: claims.map((row) => [row.id, row.fence, row.checksum]),
    completions: completions.map((row) => [row.id, row.checksum]),
    escalations: escalations.map((row) => [row.id, row.checksum]),
    conflictHandoffIds,
  });
  return {
    schemaVersion: 'local-review-handoff-governance/v1',
    projectId: identifier(project.id, 'project-id'),
    generatedAt,
    status: !integrityValid ? 'degraded-integrity-invalid' : rows.some((row) => row.overdue) ? 'attention-required' : 'review-handoffs-ready',
    rows,
    summary: {
      handoffCount: handoffs.length,
      acknowledgedCount: rows.filter((row) => row.acknowledged).length,
      activeClaimCount: rows.filter((row) => row.claimActive).length,
      completedCount: rows.filter((row) => row.state === 'completed').length,
      overdueCount: rows.filter((row) => row.overdue).length,
      escalatedCount: rows.filter((row) => row.escalated).length,
      conflictCount: conflictHandoffIds.length,
      checksum: governanceChecksum,
    },
    integrity: {
      valid: integrityValid,
      conflictHandoffIds,
      handoffRows: handoffIntegrity,
      acknowledgementRows: acknowledgementIntegrity,
      claimRows: claimIntegrity,
      completionRows: completionIntegrity,
      escalationRows: escalationIntegrity,
    },
    backendRoutes: {
      handoffs: `/projects/${project.id}/review-handoffs`,
      acknowledge: `/projects/${project.id}/review-handoffs/:handoffId/acknowledge`,
      claim: `/projects/${project.id}/review-handoffs/:handoffId/claim`,
      complete: `/projects/${project.id}/review-handoffs/:handoffId/complete`,
      scan: `/projects/${project.id}/review-handoffs/scan`,
      submissionReviewWorkflow: `/projects/${project.id}/submission-review-workflow`,
    },
    checksum: governanceChecksum,
    readyForLocalMvp: integrityValid,
    readyForProduction: false,
  };
}
