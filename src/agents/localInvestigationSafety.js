import { portableSha256Hex } from './accessControl.js';

const AUTHORITY_BASES = new Set(['none', 'subject-consent', 'organizational-mandate', 'public-record-research']);
const DATA_CATEGORIES = new Set(['operational', 'public-record', 'contact', 'financial', 'health', 'biometric', 'precise-location', 'protected-trait', 'intimate']);
const SENSITIVE_CATEGORIES = new Set(['financial', 'health', 'biometric', 'precise-location', 'protected-trait', 'intimate']);
const ACTION_TYPES = new Set(['collect-evidence', 'analyze-evidence', 'draft-conclusion', 'close-case', 'external-action', 'publish-finding']);
const COLLECTION_METHODS = new Set(['public-source', 'user-provided', 'private-system', 'observation', 'not-applicable']);
const SUBJECT_TYPES = new Set(['organization', 'adult', 'minor', 'unknown']);
const RESOLUTION_CODES = new Set(['deny', 'scope-minimized', 'authority-verified', 'privacy-review', 'legal-review']);

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

function id(value, field, optional = false) {
  const text = String(value || '').trim();
  if (!text && optional) return null;
  if (!text || text.length > 220 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(text)) throw new Error(`investigation-safety-${field}-invalid`);
  return text;
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`investigation-safety-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function integer(value, field, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`investigation-safety-${field}-invalid`);
  return number;
}

function uniqueIds(values, field) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => id(value, field)))].sort();
}

function categories(values) {
  const rows = [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()))].sort();
  if (rows.some((value) => !DATA_CATEGORIES.has(value))) throw new Error('investigation-safety-data-category-invalid');
  return rows;
}

export function createLocalInvestigationSafetyPolicy({
  caseRecord, authorityBasis, authorityEvidenceIds = [], allowedDataCategories = [], retentionDays,
  decisionTtlMinutes, reviewerId, actorId, version = 1, previousPolicyId = null,
  previousPolicyChecksum = null, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!caseRecord?.id || !caseRecord?.checksum) throw new Error('investigation-safety-case-required');
  const basis = String(authorityBasis || '').trim();
  if (!AUTHORITY_BASES.has(basis)) throw new Error('investigation-safety-authority-basis-invalid');
  const evidenceIds = uniqueIds(authorityEvidenceIds, 'authority-evidence-id');
  if (['subject-consent', 'organizational-mandate'].includes(basis) && !evidenceIds.length) throw new Error('investigation-safety-authority-evidence-required');
  const allowed = categories(allowedDataCategories);
  if (!allowed.length) throw new Error('investigation-safety-allowed-data-categories-required');
  if (basis === 'public-record-research' && allowed.some((value) => !['operational', 'public-record'].includes(value))) throw new Error('investigation-safety-public-record-scope-invalid');
  if (reviewerId !== caseRecord.reviewerId || actorId !== caseRecord.leadId) throw new Error('investigation-safety-policy-role-invalid');
  const normalizedVersion = integer(version, 'policy-version', 1, 10_000);
  const previousId = id(previousPolicyId, 'previous-policy-id', true);
  const previousChecksum = previousPolicyChecksum ? String(previousPolicyChecksum).toLowerCase() : null;
  if ((normalizedVersion === 1 && (previousId || previousChecksum))
    || (normalizedVersion > 1 && (!previousId || !/^[a-f0-9]{64}$/.test(previousChecksum || '')))) throw new Error('investigation-safety-policy-link-invalid');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const createdAt = iso(now, 'policy-created-at');
  if (Date.parse(createdAt) <= Date.parse(caseRecord.createdAt || 0)) throw new Error('investigation-safety-policy-before-case');
  const base = {
    schemaVersion: 'local-investigation-safety-policy/v1',
    id: `investigation_safety_policy_${checksum(`${caseRecord.id}:${normalizedVersion}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: caseRecord.projectId,
    caseId: caseRecord.id,
    caseChecksum: caseRecord.checksum,
    authorityBasis: basis,
    authorityEvidenceIds: evidenceIds,
    allowedDataCategories: allowed,
    retentionDays: integer(retentionDays, 'retention-days', 1, 3_650),
    decisionTtlMinutes: integer(decisionTtlMinutes, 'decision-ttl-minutes', 1, 60),
    reviewerId,
    actorId,
    hardStops: {
      credentialAccessBlocked: true,
      doxxingBlocked: true,
      stalkingBlocked: true,
      impersonationBlocked: true,
      retaliationBlocked: true,
      covertSurveillanceBlocked: true,
      sensitiveDataAutoAuthorizationBlocked: true,
      externalActionAutoAuthorizationBlocked: true,
    },
    version: normalizedVersion,
    previousPolicyId: previousId,
    previousPolicyChecksum: previousChecksum,
    idempotencyKey: normalizedIdempotencyKey,
    status: basis === 'none' ? 'authority-required' : 'active',
    readyForLocalInvestigation: basis !== 'none',
    storesRawContent: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalInvestigationSafetyPolicy(policy = {}, caseRecord = {}, previous = null) {
  const checksumValid = receiptValid(policy, 'local-investigation-safety-policy/v1');
  const caseValid = policy.caseId === caseRecord.id && policy.caseChecksum === caseRecord.checksum;
  const linkValid = policy.version === 1
    ? !policy.previousPolicyId && !policy.previousPolicyChecksum
    : previous
      ? policy.version === previous.version + 1 && policy.previousPolicyId === previous.id && policy.previousPolicyChecksum === previous.checksum
      : Boolean(policy.previousPolicyId && /^[a-f0-9]{64}$/.test(policy.previousPolicyChecksum || ''));
  return { valid: checksumValid && caseValid && linkValid, checksumValid, caseValid, linkValid };
}

function classifyRequest(requestText, context = {}) {
  const text = String(requestText || '').trim();
  if (!text || text.length > 20_000) throw new Error('investigation-safety-request-text-invalid');
  const actionType = String(context.actionType || '').trim();
  const collectionMethod = String(context.collectionMethod || '').trim();
  const subjectType = String(context.subjectType || '').trim();
  if (!ACTION_TYPES.has(actionType)) throw new Error('investigation-safety-action-type-invalid');
  if (!COLLECTION_METHODS.has(collectionMethod)) throw new Error('investigation-safety-collection-method-invalid');
  if (!SUBJECT_TYPES.has(subjectType)) throw new Error('investigation-safety-subject-type-invalid');
  const targetIds = uniqueIds(context.targetIds, 'target-id');
  if (!targetIds.length) throw new Error('investigation-safety-target-required');
  return {
    requestHash: portableSha256Hex(text),
    requestLength: text.length,
    actionType,
    targetIds,
    operationKey: portableSha256Hex(JSON.stringify({ actionType, targetIds })),
    requestedDataCategories: categories(context.requestedDataCategories),
    collectionMethod,
    subjectType,
    externalEffect: Boolean(context.externalEffect),
    signals: {
      pii: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)|home address|personal address|email address|phone number/i.test(text),
      credential: /password|credential|api key|secret token|steal.*(?:login|password)|unauthorized access/i.test(text),
      doxxing: /doxx|publish.*(?:address|phone|identity)/i.test(text),
      stalking: /stalk|track.*without.*consent|follow.*location/i.test(text),
      impersonation: /impersonat|pretend to be.*(?:employee|subject|victim)/i.test(text),
      retaliation: /retaliat|punish.*whistleblower|threaten.*source/i.test(text),
      covertSurveillance: /covert surveillance|hidden camera|secretly record|spy on/i.test(text),
    },
  };
}

function authorizationFor(policy, classified, caseState) {
  const reasonCodes = [];
  let mode = 'minimized-local-action';
  let canProceed = true;
  let humanHandoffRequired = false;
  let riskLevel = 'standard';
  const prohibited = Object.entries(classified.signals).some(([key, matched]) => key !== 'pii' && matched);
  const sensitive = classified.requestedDataCategories.some((value) => SENSITIVE_CATEGORIES.has(value));
  const outsideScope = classified.requestedDataCategories.some((value) => !policy.allowedDataCategories.includes(value));
  if (prohibited) {
    mode = 'prohibited-investigation-refusal'; canProceed = false; humanHandoffRequired = true; riskLevel = 'critical';
    reasonCodes.push('prohibited-conduct-detected');
  } else if (classified.subjectType === 'minor') {
    mode = 'sensitive-data-human-review'; canProceed = false; humanHandoffRequired = true; riskLevel = 'high';
    reasonCodes.push('minor-subject-human-review');
  } else if (sensitive) {
    mode = 'sensitive-data-human-review'; canProceed = false; humanHandoffRequired = true; riskLevel = 'high';
    reasonCodes.push('sensitive-data-human-review');
  } else if (classified.signals.pii && !classified.requestedDataCategories.includes('contact')) {
    mode = 'data-minimization-blocked'; canProceed = false; riskLevel = 'high';
    reasonCodes.push('undeclared-pii-detected');
  } else if (outsideScope) {
    mode = 'data-minimization-blocked'; canProceed = false; riskLevel = 'high';
    reasonCodes.push('requested-data-outside-policy');
  } else if (policy.authorityBasis === 'none') {
    mode = 'authority-required'; canProceed = false; humanHandoffRequired = true; riskLevel = 'high';
    reasonCodes.push('authority-basis-required');
  } else if (policy.authorityBasis === 'public-record-research'
    && (classified.collectionMethod === 'private-system' || classified.requestedDataCategories.some((value) => !['operational', 'public-record'].includes(value)))) {
    mode = 'authority-required'; canProceed = false; humanHandoffRequired = true; riskLevel = 'high';
    reasonCodes.push('public-record-authority-insufficient');
  } else if (classified.externalEffect || ['external-action', 'publish-finding'].includes(classified.actionType)) {
    mode = 'external-effect-human-review'; canProceed = false; humanHandoffRequired = true; riskLevel = 'high';
    reasonCodes.push('external-effect-not-auto-authorized');
  } else if (classified.actionType === 'analyze-evidence' && caseState.evidenceCount < 1) {
    mode = 'insufficient-evidence'; canProceed = false;
    reasonCodes.push('analysis-evidence-required');
  } else if (classified.actionType === 'draft-conclusion'
    && (caseState.evidenceCount < 2 || caseState.sealedEvidenceCount !== caseState.evidenceCount || caseState.unresolvedContradictionCount > 0)) {
    mode = 'insufficient-evidence'; canProceed = false;
    reasonCodes.push('conclusion-evidence-insufficient');
  } else if (classified.actionType === 'close-case' && caseState.conclusionCount < 1) {
    mode = 'insufficient-evidence'; canProceed = false;
    reasonCodes.push('case-conclusion-required');
  } else {
    reasonCodes.push('bounded-local-action-authorized');
  }
  return {
    riskLevel,
    humanHandoffRequired,
    reasonCodes,
    responseAuthorization: {
      mode,
      canProceed,
      actionType: classified.actionType,
      targetIds: classified.targetIds,
      allowedDataCategories: canProceed ? classified.requestedDataCategories : [],
      localOnly: true,
      externalEffectAllowed: false,
    },
    modelBoundary: {
      allowedInstructionIds: canProceed ? ['use-authorized-targets-only', 'minimize-data', 'state-evidence-limits'] : ['refuse-or-escalate'],
      forbiddenInstructionIds: ['invent-authority', 'collect-extra-data', 'doxx', 'credential-access', 'covert-surveillance', 'external-action'],
    },
  };
}

function normalizeCaseState(input = {}) {
  return {
    evidenceCount: integer(input.evidenceCount ?? 0, 'case-state-evidence-count', 0, 100_000),
    sealedEvidenceCount: integer(input.sealedEvidenceCount ?? 0, 'case-state-sealed-evidence-count', 0, 100_000),
    unresolvedContradictionCount: integer(input.unresolvedContradictionCount ?? 0, 'case-state-unresolved-contradiction-count', 0, 100_000),
    conclusionCount: integer(input.conclusionCount ?? 0, 'case-state-conclusion-count', 0, 100_000),
  };
}

export function createLocalInvestigationSafetyDecision({
  policy, requestText, context = {}, caseState = {}, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(policy, 'local-investigation-safety-policy/v1')) throw new Error('investigation-safety-policy-integrity-invalid');
  const classified = classifyRequest(requestText, context);
  const normalizedCaseState = normalizeCaseState(caseState);
  const authorization = authorizationFor(policy, classified, normalizedCaseState);
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const createdAt = iso(now, 'decision-created-at');
  if (Date.parse(createdAt) <= Date.parse(policy.createdAt || 0)) throw new Error('investigation-safety-decision-before-policy');
  const expiresAt = new Date(Date.parse(createdAt) + policy.decisionTtlMinutes * 60_000).toISOString();
  const base = {
    schemaVersion: 'local-investigation-safety-decision/v1',
    id: `investigation_safety_decision_${checksum(`${policy.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: policy.projectId, caseId: policy.caseId,
    policyId: policy.id, policyVersion: policy.version, policyChecksum: policy.checksum,
    requestHash: classified.requestHash, requestLength: classified.requestLength,
    actionType: classified.actionType, targetIds: classified.targetIds, operationKey: classified.operationKey,
    requestedDataCategories: classified.requestedDataCategories,
    collectionMethod: classified.collectionMethod, subjectType: classified.subjectType, externalEffect: classified.externalEffect,
    signalIds: Object.entries(classified.signals).filter(([, matched]) => matched).map(([key]) => key).sort(),
    caseState: normalizedCaseState,
    ...authorization,
    idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false,
    createdAt,
    expiresAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalInvestigationSafetyDecision(decision = {}, policy = {}) {
  const checksumValid = receiptValid(decision, 'local-investigation-safety-decision/v1');
  const linkValid = decision.policyId === policy.id && decision.policyVersion === policy.version && decision.policyChecksum === policy.checksum;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function createLocalInvestigationSafetyResolution({
  decision, actorId, resolutionCode, evidenceIds = [], idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(decision, 'local-investigation-safety-decision/v1')) throw new Error('investigation-safety-decision-integrity-invalid');
  if (!decision.humanHandoffRequired) throw new Error('investigation-safety-human-resolution-not-required');
  const code = String(resolutionCode || '').trim();
  if (!RESOLUTION_CODES.has(code)) throw new Error('investigation-safety-resolution-code-invalid');
  const proofIds = uniqueIds(evidenceIds, 'resolution-evidence-id');
  if (!proofIds.length) throw new Error('investigation-safety-resolution-evidence-required');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const createdAt = iso(now, 'resolution-created-at');
  if (Date.parse(createdAt) <= Date.parse(decision.createdAt)) throw new Error('investigation-safety-resolution-before-decision');
  const base = {
    schemaVersion: 'local-investigation-safety-resolution/v1',
    id: `investigation_safety_resolution_${checksum(`${decision.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: decision.projectId, caseId: decision.caseId,
    decisionId: decision.id, decisionChecksum: decision.checksum,
    actorId: id(actorId, 'resolution-actor-id'), resolutionCode: code, evidenceIds: proofIds,
    authorizesOperation: false,
    requiresReevaluation: true,
    idempotencyKey: normalizedIdempotencyKey,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalInvestigationSafetyResolution(resolution = {}, decision = {}) {
  const checksumValid = receiptValid(resolution, 'local-investigation-safety-resolution/v1');
  const linkValid = resolution.decisionId === decision.id && resolution.decisionChecksum === decision.checksum && resolution.authorizesOperation === false;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function createLocalInvestigationSafetyUse({
  decision, actionType, targetIds = [], actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(decision, 'local-investigation-safety-decision/v1')) throw new Error('investigation-safety-decision-integrity-invalid');
  if (!decision.responseAuthorization?.canProceed) throw new Error('investigation-safety-operation-not-authorized');
  const usedAt = iso(now, 'use-created-at');
  if (Date.parse(usedAt) <= Date.parse(decision.createdAt || 0)) throw new Error('investigation-safety-use-before-decision');
  if (Date.parse(usedAt) > Date.parse(decision.expiresAt)) throw new Error('investigation-safety-decision-expired');
  const normalizedActionType = String(actionType || '').trim();
  const normalizedTargetIds = uniqueIds(targetIds, 'use-target-id');
  const operationKey = portableSha256Hex(JSON.stringify({ actionType: normalizedActionType, targetIds: normalizedTargetIds }));
  if (operationKey !== decision.operationKey) throw new Error('investigation-safety-operation-target-mismatch');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-investigation-safety-use/v1',
    id: `investigation_safety_use_${checksum(`${decision.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: decision.projectId, caseId: decision.caseId,
    decisionId: decision.id, decisionChecksum: decision.checksum,
    actionType: normalizedActionType, targetIds: normalizedTargetIds, operationKey,
    actorId: id(actorId, 'use-actor-id'),
    idempotencyKey: normalizedIdempotencyKey,
    usedAt,
    createdAt: usedAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalInvestigationSafetyUse(use = {}, decision = {}) {
  const checksumValid = receiptValid(use, 'local-investigation-safety-use/v1');
  const linkValid = use.decisionId === decision.id && use.decisionChecksum === decision.checksum && use.operationKey === decision.operationKey;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function buildLocalInvestigationSafety({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = iso(now, 'generated-at');
  const backendRoutes = {
    investigationSafety: project.id ? `/projects/${project.id}/investigation-safety` : null,
    policies: project.id ? `/projects/${project.id}/investigation-safety/policies` : null,
    evaluate: project.id ? `/projects/${project.id}/investigation-safety/evaluate` : null,
  };
  const empty = (status) => ({
    schemaVersion: 'local-investigation-safety/v1', projectId: project.id || null, generatedAt, status,
    policy: null, decisions: [], resolutions: [], uses: [],
    summary: { policyVersionCount: 0, decisionCount: 0, allowedDecisionCount: 0, blockedDecisionCount: 0, consumedDecisionCount: 0 },
    integrity: { valid: true, policyRows: [], decisionRows: [], resolutionRows: [], useRows: [] },
    backendRoutes, readyForLocalInvestigation: false, readyForProduction: false,
  });
  if (project.workModeContract?.workMode !== 'investigation') return empty('investigation-work-mode-required');
  const caseRecord = (project.localInvestigationCases || [])[0];
  if (!caseRecord) return empty('case-required');
  const policies = [...(project.localInvestigationSafetyPolicies || [])].sort((a, b) => a.version - b.version);
  if (!policies.length) return empty('policy-required');
  const policyRows = policies.map((row, index) => ({ id: row.id, ...verifyLocalInvestigationSafetyPolicy(row, caseRecord, index ? policies[index - 1] : null) }));
  const policyById = new Map(policies.map((row) => [row.id, row]));
  const decisions = project.localInvestigationSafetyDecisions || [];
  const decisionRows = decisions.map((row) => ({ id: row.id, ...verifyLocalInvestigationSafetyDecision(row, policyById.get(row.policyId) || {}) }));
  const decisionById = new Map(decisions.map((row) => [row.id, row]));
  const resolutions = project.localInvestigationSafetyResolutions || [];
  const resolutionRows = resolutions.map((row) => ({ id: row.id, ...verifyLocalInvestigationSafetyResolution(row, decisionById.get(row.decisionId) || {}) }));
  const uses = project.localInvestigationSafetyUses || [];
  const useRows = uses.map((row) => ({ id: row.id, ...verifyLocalInvestigationSafetyUse(row, decisionById.get(row.decisionId) || {}) }));
  const duplicateUseDecisionIds = uses.map((row) => row.decisionId).filter((value, index, rows) => rows.indexOf(value) !== index);
  const integrityValid = [...policyRows, ...decisionRows, ...resolutionRows, ...useRows].every((row) => row.valid) && duplicateUseDecisionIds.length === 0;
  const resolvedIds = new Set(resolutionRows.filter((row) => row.valid).map((row) => resolutions.find((item) => item.id === row.id)?.decisionId));
  const openHumanDecisions = decisions.filter((row) => row.humanHandoffRequired && !resolvedIds.has(row.id));
  const policy = policies.at(-1);
  return {
    schemaVersion: 'local-investigation-safety/v1', projectId: project.id, generatedAt,
    status: !integrityValid ? 'degraded-integrity-invalid' : !policy.readyForLocalInvestigation ? 'authority-required' : openHumanDecisions.length ? 'human-review-open' : 'active',
    policy, decisions, resolutions, uses,
    summary: {
      policyVersionCount: policies.length, decisionCount: decisions.length,
      allowedDecisionCount: decisions.filter((row) => row.responseAuthorization?.canProceed).length,
      blockedDecisionCount: decisions.filter((row) => !row.responseAuthorization?.canProceed).length,
      humanReviewDecisionCount: decisions.filter((row) => row.humanHandoffRequired).length,
      openHumanReviewCount: openHumanDecisions.length,
      consumedDecisionCount: uses.length,
    },
    openHumanDecisionIds: openHumanDecisions.map((row) => row.id),
    integrity: { valid: integrityValid, policyRows, decisionRows, resolutionRows, useRows, duplicateUseDecisionIds },
    backendRoutes,
    readyForLocalInvestigation: Boolean(integrityValid && policy.readyForLocalInvestigation && openHumanDecisions.length === 0),
    readyForProduction: false,
  };
}
