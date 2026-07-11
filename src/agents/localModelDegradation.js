import { createHash } from 'node:crypto';

const DEGRADATION_REASONS = new Set([
  'policy-denied',
  'circuit-open',
  'budget-denied',
  'provider-unavailable',
  'transport-failed',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function modelGenerationProvenanceChecksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function safeIdentifier(value, maxLength = 160) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength) return null;
  return /^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(normalized) ? normalized : null;
}

function normalizeDegradationReason(reason = '', modelStatus = {}) {
  const value = String(reason || '').trim().toLowerCase().replace(/_/g, '-');
  if (DEGRADATION_REASONS.has(value)) return value;
  if (value.includes('circuit')) return 'circuit-open';
  if (value.includes('budget') || value.includes('cost') || value.includes('rate-limit')) return 'budget-denied';
  if (value.includes('policy') || value.includes('denied') || value.includes('grant')) return 'policy-denied';
  if (value.includes('unavailable') || value.includes('disabled') || value.includes('missing') || value.includes('blocked')) {
    return 'provider-unavailable';
  }
  if (!modelStatus?.enabled) return 'provider-unavailable';
  return 'transport-failed';
}

export function createModelGenerationProvenance({
  projectId = '',
  agentId = '',
  taskId = null,
  artifactType = 'progress-brief',
  modelRequested = true,
  modelRequired = false,
  modelResult = null,
  modelStatus = {},
  degradationReason = '',
  now = new Date().toISOString(),
} = {}) {
  const modelUsed = Boolean(modelRequested && modelResult?.ok === true);
  const fallback = Boolean(modelRequested && !modelUsed);
  const generationMode = modelUsed
    ? 'model-provider-output'
    : fallback
      ? 'requested-model-fallback'
      : 'explicit-local-template';
  const qualityTier = modelUsed
    ? 'model-draft'
    : fallback
      ? 'degraded-template'
      : 'local-template';
  const reasonCode = fallback ? normalizeDegradationReason(degradationReason, modelStatus) : null;
  const provider = safeIdentifier(modelResult?.provider || modelStatus?.provider);
  const model = safeIdentifier(modelResult?.model || modelStatus?.model);
  const responseId = modelUsed ? safeIdentifier(modelResult?.id || modelResult?.responseId) : null;
  const normalizedProjectId = safeIdentifier(projectId) || 'project';
  const normalizedAgentId = safeIdentifier(agentId) || 'agent';
  const normalizedTaskId = safeIdentifier(taskId);
  const normalizedArtifactType = safeIdentifier(artifactType) || 'progress-brief';
  const base = {
    schemaVersion: 'local-model-generation-provenance/v1',
    id: `model_generation_${modelGenerationProvenanceChecksum(`${normalizedProjectId}:${normalizedAgentId}:${normalizedTaskId || 'project'}:${normalizedArtifactType}:${now}`).slice(0, 28)}`,
    projectId: normalizedProjectId,
    agentId: normalizedAgentId,
    taskId: normalizedTaskId,
    artifactType: normalizedArtifactType,
    generationMode,
    modelRequested: Boolean(modelRequested),
    modelRequired: Boolean(modelRequired),
    modelUsed,
    fallback,
    degradationReason: reasonCode,
    qualityTier,
    qualityCeiling: modelUsed
      ? 'reviewed-model-draft'
      : fallback
        ? 'human-reviewed-degraded-draft'
        : 'human-reviewed-local-template',
    humanReviewRequired: true,
    releaseEligibility: {
      directAcceptanceAllowed: false,
      finalDeliveryAllowed: false,
      reviewedSubmissionAllowed: true,
      reason: modelUsed
        ? 'model-output-human-review-required'
        : fallback
          ? 'degraded-fallback-human-review-required'
          : 'local-template-human-review-required',
    },
    provider: {
      provider,
      model,
      responseId,
    },
    storesRawContent: false,
    createdAt: now,
  };
  return { ...base, checksum: modelGenerationProvenanceChecksum(base) };
}

export function verifyModelGenerationProvenance(receipt = {}) {
  const { checksum, ...base } = receipt;
  const checksumValid = Boolean(checksum) && checksum === modelGenerationProvenanceChecksum(base);
  const modeValid = ['model-provider-output', 'requested-model-fallback', 'explicit-local-template']
    .includes(receipt.generationMode);
  const truthValid = receipt.generationMode === 'model-provider-output'
    ? receipt.modelUsed === true && receipt.fallback === false && receipt.degradationReason === null
    : receipt.modelUsed === false
      && (receipt.generationMode !== 'requested-model-fallback' || (
        receipt.fallback === true && DEGRADATION_REASONS.has(receipt.degradationReason)
      ));
  return { valid: checksumValid && modeValid && truthValid, checksumValid, modeValid, truthValid };
}

export function publicModelGenerationProvenance(receipt = {}) {
  const integrity = verifyModelGenerationProvenance(receipt);
  return {
    ...receipt,
    integrity,
    status: integrity.valid ? receipt.generationMode : 'integrity-invalid',
    releaseEligibility: integrity.valid
      ? receipt.releaseEligibility
      : {
        directAcceptanceAllowed: false,
        finalDeliveryAllowed: false,
        reviewedSubmissionAllowed: false,
        reason: 'generation-provenance-integrity-invalid',
      },
  };
}
