import { portableSha256Hex } from './accessControl.js';

const AGE_ADAPTATION = Object.freeze({
  child: Object.freeze({ readingLevel: 'plain-short', maxSessionMinutes: 45, maxHintLevel: 2 }),
  teen: Object.freeze({ readingLevel: 'standard', maxSessionMinutes: 60, maxHintLevel: 3 }),
  adult: Object.freeze({ readingLevel: 'advanced', maxSessionMinutes: 120, maxHintLevel: 4 }),
});
const ACTIVITY_TYPES = new Set(['open-study', 'assignment', 'assessment']);
const RESOLUTION_CODES = new Set(['guardian-notified', 'educator-review-complete', 'emergency-support-directed', 'privacy-data-removed']);

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

function id(value, field, optional = false) {
  const text = String(value || '').trim();
  if (!text && optional) return null;
  if (!text || text.length > 180 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(text)) throw new Error(`teaching-safety-${field}-invalid`);
  return text;
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`teaching-safety-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function integer(value, field, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`teaching-safety-${field}-invalid`);
  return number;
}

function receiptChecksumValid(receipt = {}, schemaVersion = '') {
  const { checksum: expected, ...base } = receipt;
  return receipt.schemaVersion === schemaVersion && Boolean(expected) && expected === checksum(base);
}

export function createLocalTeachingSafetyPolicy({
  projectId, learnerId, ageBand, supervisionMode = 'independent', version = 1,
  previousPolicyId = null, previousPolicyChecksum = null, governanceStartedAt = null,
  actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  const normalizedAgeBand = String(ageBand || '').trim();
  if (!AGE_ADAPTATION[normalizedAgeBand]) throw new Error('teaching-safety-age-band-invalid');
  const normalizedSupervision = String(supervisionMode || '').trim();
  if (!['independent', 'educator', 'guardian-or-educator'].includes(normalizedSupervision)) throw new Error('teaching-safety-supervision-mode-invalid');
  const normalizedVersion = integer(version, 'version', 1, 10_000);
  const previousId = id(previousPolicyId, 'previous-policy-id', true);
  const previousChecksum = previousPolicyChecksum ? String(previousPolicyChecksum).toLowerCase() : null;
  if ((normalizedVersion === 1 && (previousId || previousChecksum))
    || (normalizedVersion > 1 && (!previousId || !/^[a-f0-9]{64}$/.test(previousChecksum || '')))) throw new Error('teaching-safety-policy-link-invalid');
  const createdAt = iso(now, 'created-at');
  const supervisionReady = normalizedAgeBand !== 'child' || ['educator', 'guardian-or-educator'].includes(normalizedSupervision);
  const normalized = {
    projectId: id(projectId, 'project-id'),
    learnerId: id(learnerId, 'learner-id'),
    ageBand: normalizedAgeBand,
    supervisionMode: normalizedSupervision,
    version: normalizedVersion,
    previousPolicyId: previousId,
    previousPolicyChecksum: previousChecksum,
    governanceStartedAt: governanceStartedAt ? iso(governanceStartedAt, 'governance-started-at') : createdAt,
    ageAdaptation: AGE_ADAPTATION[normalizedAgeBand],
    hardStops: {
      assessmentDirectAnswerBlocked: true,
      cheatingConcealmentBlocked: true,
      minorPersonalDataCollectionBlocked: true,
      urgentWellbeingEscalationRequired: true,
    },
    assignmentHintFirstRequired: true,
    citationForExternalFactsRequired: true,
    uncertaintyDisclosureRequired: true,
    actorId: id(actorId, 'actor-id'),
    idempotencyKey: id(idempotencyKey, 'idempotency-key'),
  };
  const base = {
    schemaVersion: 'local-teaching-safety-policy/v1',
    id: `teaching_safety_policy_${checksum(`${normalized.projectId}:${normalized.version}:${normalized.idempotencyKey}`).slice(0, 28)}`,
    ...normalized,
    status: supervisionReady ? 'active' : 'supervision-required',
    readyForLocalTeaching: supervisionReady,
    storesExactAge: false,
    storesRawContent: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalTeachingSafetyPolicy(policy = {}, previous = null) {
  const checksumValid = receiptChecksumValid(policy, 'local-teaching-safety-policy/v1');
  const linkValid = policy.version === 1
    ? !policy.previousPolicyId && !policy.previousPolicyChecksum
    : Boolean(previous && policy.version === previous.version + 1 && policy.previousPolicyId === previous.id && policy.previousPolicyChecksum === previous.checksum);
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

function classifyRequest(requestText, context) {
  const text = String(requestText || '').trim();
  if (!text || text.length > 20_000) throw new Error('teaching-safety-request-text-invalid');
  const activityType = String(context?.activityType || '').trim();
  if (!ACTIVITY_TYPES.has(activityType)) throw new Error('teaching-safety-activity-type-invalid');
  return {
    requestHash: portableSha256Hex(text),
    requestLength: text.length,
    activityType,
    requiresExternalFacts: Boolean(context?.requiresExternalFacts),
    signals: {
      urgentWellbeing: /hurt myself|kill myself|suicid|self[- ]?harm|do not feel safe|不想活|自杀|伤害自己|活不下去/i.test(text),
      personalData: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)|my address|home address|我的地址|我的电话|手机号|邮箱/i.test(text),
      cheatingConcealment: /look like.*(?:didn't|did not).*ai|hide.*ai|not use ai|make it look like i did|不要.*看出.*ai|伪装.*自己|代写/i.test(text),
      directAnswerSeeking: /give me (?:the )?(?:final )?answer|just (?:give|tell).*answer|do my homework|直接.*答案|帮我(?:做|写).*作业|代做/i.test(text),
      citationRequested: /cite|citation|source|reference|来源|引用|参考文献/i.test(text),
    },
  };
}

function authorizationFor({ policy, classified, learnerAttemptEvidenceIds, sourceEvidenceIds }) {
  const reasons = [];
  let mode = 'guided-explanation';
  let canGenerateTeachingContent = true;
  let canProvideTargetAnswer = classified.activityType === 'open-study';
  let humanHandoffRequired = false;
  let riskLevel = 'standard';
  if (!policy.readyForLocalTeaching) {
    reasons.push('supervision-required');
    mode = 'human-supervision-required';
    canGenerateTeachingContent = false;
    canProvideTargetAnswer = false;
    humanHandoffRequired = true;
    riskLevel = 'high';
  } else if (classified.signals.urgentWellbeing) {
    reasons.push('urgent-wellbeing-signal');
    mode = 'human-support-escalation';
    canGenerateTeachingContent = false;
    canProvideTargetAnswer = false;
    humanHandoffRequired = true;
    riskLevel = 'critical';
  } else if (policy.ageBand === 'child' && classified.signals.personalData) {
    reasons.push('minor-personal-data-blocked');
    mode = 'privacy-safe-redirect';
    canGenerateTeachingContent = false;
    canProvideTargetAnswer = false;
    humanHandoffRequired = true;
    riskLevel = 'high';
  } else if (classified.signals.cheatingConcealment) {
    reasons.push('cheating-concealment-blocked');
    mode = 'integrity-refusal';
    canGenerateTeachingContent = false;
    canProvideTargetAnswer = false;
    riskLevel = 'high';
  } else if (classified.activityType === 'assessment' && classified.signals.directAnswerSeeking) {
    reasons.push('assessment-answer-blocked');
    mode = 'integrity-refusal';
    canGenerateTeachingContent = false;
    canProvideTargetAnswer = false;
    riskLevel = 'high';
  } else if ((classified.requiresExternalFacts || classified.signals.citationRequested) && !sourceEvidenceIds.length) {
    reasons.push('source-evidence-required');
    mode = 'evidence-required';
    canGenerateTeachingContent = false;
    canProvideTargetAnswer = false;
  } else if (classified.activityType === 'assessment') {
    reasons.push('assessment-hint-only');
    mode = 'assessment-hint-only';
    canProvideTargetAnswer = false;
  } else if (classified.activityType === 'assignment' && !learnerAttemptEvidenceIds.length) {
    reasons.push('learner-attempt-required');
    mode = 'hint-first';
    canProvideTargetAnswer = false;
  } else if (classified.activityType === 'assignment') {
    reasons.push('learner-attempt-review-allowed');
    mode = 'answer-review';
    canProvideTargetAnswer = true;
  } else if (classified.requiresExternalFacts || classified.signals.citationRequested) {
    reasons.push('evidence-grounded-guidance-allowed');
    mode = 'evidence-grounded-explanation';
  } else {
    reasons.push('guided-learning-allowed');
  }
  return {
    riskLevel,
    humanHandoffRequired,
    reasonCodes: reasons,
    responseAuthorization: {
      mode,
      canGenerateTeachingContent,
      canProvideTargetAnswer,
      maxHintLevel: policy.ageAdaptation.maxHintLevel,
      readingLevel: policy.ageAdaptation.readingLevel,
      requiresLearnerAttempt: mode === 'hint-first',
      requiresCitations: Boolean(classified.requiresExternalFacts || classified.signals.citationRequested),
      requiresUncertaintyDisclosure: true,
    },
    modelBoundary: {
      allowedInstructionIds: [mode, policy.ageAdaptation.readingLevel, 'state-uncertainty', ...(sourceEvidenceIds.length ? ['cite-provided-evidence'] : [])],
      forbiddenInstructionIds: ['invent-source', 'hide-ai-use', 'collect-minor-pii', 'provide-assessment-answer', 'diagnose-wellbeing'],
    },
  };
}

export function createLocalTeachingSafetyDecision({
  policy, requestText, context = {}, learnerAttemptEvidenceIds = [], sourceEvidenceIds = [],
  idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptChecksumValid(policy, 'local-teaching-safety-policy/v1')) throw new Error('teaching-safety-policy-integrity-invalid');
  const classified = classifyRequest(requestText, context);
  const attempts = [...new Set((Array.isArray(learnerAttemptEvidenceIds) ? learnerAttemptEvidenceIds : []).map((value) => id(value, 'learner-attempt-evidence-id')))].sort();
  const sources = [...new Set((Array.isArray(sourceEvidenceIds) ? sourceEvidenceIds : []).map((value) => id(value, 'source-evidence-id')))].sort();
  const authorization = authorizationFor({ policy, classified, learnerAttemptEvidenceIds: attempts, sourceEvidenceIds: sources });
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-teaching-safety-decision/v1',
    id: `teaching_safety_decision_${checksum(`${policy.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: policy.projectId,
    learnerId: policy.learnerId,
    policyId: policy.id,
    policyVersion: policy.version,
    policyChecksum: policy.checksum,
    requestHash: classified.requestHash,
    requestLength: classified.requestLength,
    activityType: classified.activityType,
    requiresExternalFacts: classified.requiresExternalFacts,
    signalIds: Object.entries(classified.signals).filter(([, matched]) => matched).map(([signal]) => signal).sort(),
    learnerAttemptEvidenceIds: attempts,
    sourceEvidenceIds: sources,
    ...authorization,
    idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false,
    createdAt: iso(now, 'decision-created-at'),
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalTeachingSafetyDecision(decision = {}, policy = {}) {
  const checksumValid = receiptChecksumValid(decision, 'local-teaching-safety-decision/v1');
  const linkValid = decision.policyId === policy.id && decision.policyVersion === policy.version && decision.policyChecksum === policy.checksum;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function createLocalTeachingSafetyResolution({
  decision, actorId, resolutionCode, evidenceIds = [], idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptChecksumValid(decision, 'local-teaching-safety-decision/v1')) throw new Error('teaching-safety-decision-integrity-invalid');
  if (!decision.humanHandoffRequired) throw new Error('teaching-safety-human-resolution-not-required');
  const normalizedCode = String(resolutionCode || '').trim();
  if (!RESOLUTION_CODES.has(normalizedCode)) throw new Error('teaching-safety-resolution-code-invalid');
  const normalizedEvidenceIds = [...new Set((Array.isArray(evidenceIds) ? evidenceIds : []).map((value) => id(value, 'resolution-evidence-id')))].sort();
  if (!normalizedEvidenceIds.length) throw new Error('teaching-safety-resolution-evidence-required');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-teaching-safety-resolution/v1',
    id: `teaching_safety_resolution_${checksum(`${decision.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: decision.projectId,
    decisionId: decision.id,
    decisionChecksum: decision.checksum,
    actorId: id(actorId, 'actor-id'),
    resolutionCode: normalizedCode,
    evidenceIds: normalizedEvidenceIds,
    authorizesTeachingContent: false,
    idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false,
    createdAt: iso(now, 'resolution-created-at'),
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalTeachingSafetyResolution(resolution = {}, decision = {}) {
  const checksumValid = receiptChecksumValid(resolution, 'local-teaching-safety-resolution/v1');
  const linkValid = resolution.decisionId === decision.id && resolution.decisionChecksum === decision.checksum;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function buildLocalTeachingSafety({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = iso(now, 'generated-at');
  const backendRoutes = {
    teachingSafety: project.id ? `/projects/${project.id}/teaching-safety` : null,
    policies: project.id ? `/projects/${project.id}/teaching-safety/policies` : null,
    evaluate: project.id ? `/projects/${project.id}/teaching-safety/evaluate` : null,
  };
  if (project.workModeContract?.workMode !== 'learning') return {
    schemaVersion: 'local-teaching-safety/v1', projectId: project.id || null, generatedAt,
    status: 'learning-work-mode-required', policy: null, decisions: [], resolutions: [], backendRoutes,
    integrity: { valid: true, policyRows: [], decisionRows: [], resolutionRows: [] }, readyForLocalTeaching: false, readyForProduction: false,
  };
  const policies = [...(project.localTeachingSafetyPolicies || [])].sort((a, b) => a.version - b.version);
  if (!policies.length) return {
    schemaVersion: 'local-teaching-safety/v1', projectId: project.id, generatedAt,
    status: 'policy-required', policy: null, decisions: [], resolutions: [], backendRoutes,
    integrity: { valid: true, policyRows: [], decisionRows: [], resolutionRows: [] }, readyForLocalTeaching: false, readyForProduction: false,
  };
  const policyRows = policies.map((policy, index) => ({ id: policy.id, ...verifyLocalTeachingSafetyPolicy(policy, index ? policies[index - 1] : null) }));
  const policyById = new Map(policies.map((policy) => [policy.id, policy]));
  const decisions = [...(project.localTeachingSafetyDecisions || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const decisionRows = decisions.map((decision) => ({ id: decision.id, ...verifyLocalTeachingSafetyDecision(decision, policyById.get(decision.policyId) || {}) }));
  const decisionById = new Map(decisions.map((decision) => [decision.id, decision]));
  const resolutions = [...(project.localTeachingSafetyResolutions || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const resolutionRows = resolutions.map((resolution) => ({ id: resolution.id, ...verifyLocalTeachingSafetyResolution(resolution, decisionById.get(resolution.decisionId) || {}) }));
  const validResolutionDecisionIds = new Set(resolutionRows.filter((row) => row.valid).map((row) => decisionById.get(resolutions.find((item) => item.id === row.id)?.decisionId)?.id).filter(Boolean));
  const openHumanEscalations = decisions.filter((decision) => decision.humanHandoffRequired && !validResolutionDecisionIds.has(decision.id));
  const resolvedHumanEscalations = decisions.filter((decision) => decision.humanHandoffRequired && validResolutionDecisionIds.has(decision.id));
  const integrityValid = policyRows.every((row) => row.valid) && decisionRows.every((row) => row.valid) && resolutionRows.every((row) => row.valid);
  const policy = policies.at(-1);
  return {
    schemaVersion: 'local-teaching-safety/v1',
    projectId: project.id,
    generatedAt,
    status: !integrityValid ? 'degraded-integrity-invalid' : !policy.readyForLocalTeaching ? 'supervision-required' : openHumanEscalations.length ? 'human-escalation-open' : 'active',
    policy,
    decisions,
    resolutions,
    summary: {
      decisionCount: decisions.length,
      blockedDecisionCount: decisions.filter((decision) => !decision.responseAuthorization?.canGenerateTeachingContent).length,
      openHumanEscalationCount: openHumanEscalations.length,
      resolvedHumanEscalationCount: resolvedHumanEscalations.length,
    },
    openHumanEscalationIds: openHumanEscalations.map((decision) => decision.id),
    backendRoutes,
    integrity: { valid: integrityValid, policyRows, decisionRows, resolutionRows },
    readyForLocalTeaching: integrityValid && policy.readyForLocalTeaching && openHumanEscalations.length === 0,
    readyForProduction: false,
  };
}
