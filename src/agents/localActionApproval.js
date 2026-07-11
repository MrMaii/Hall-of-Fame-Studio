import { createHash, randomUUID } from 'node:crypto';

const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_TTL_MS = 60 * 1000;

const ACTION_POLICIES = Object.freeze({
  'privacy:artifact-retention-delete': Object.freeze({
    riskClass: 'critical',
    irreversible: true,
    requiredApproverRoles: Object.freeze(['manager', 'security-admin']),
    allowedApproverRoles: Object.freeze(['manager', 'security-admin']),
    requiredDecisionCount: 2,
    disallowRequesterApproval: true,
  }),
  'privacy:project-delete': Object.freeze({
    riskClass: 'critical',
    irreversible: true,
    requiredApproverRoles: Object.freeze(['manager', 'security-admin']),
    allowedApproverRoles: Object.freeze(['manager', 'security-admin']),
    requiredDecisionCount: 2,
    disallowRequesterApproval: true,
  }),
  'provider:budget-overage': Object.freeze({
    riskClass: 'high-cost',
    irreversible: false,
    requiredApproverRoles: Object.freeze([]),
    allowedApproverRoles: Object.freeze(['manager', 'security-admin']),
    requiredDecisionCount: 1,
    disallowRequesterApproval: false,
  }),
  'dead-letter:replay': Object.freeze({
    riskClass: 'high',
    irreversible: false,
    requiredApproverRoles: Object.freeze([]),
    allowedApproverRoles: Object.freeze(['manager', 'security-admin']),
    requiredDecisionCount: 1,
    disallowRequesterApproval: false,
  }),
  'artifact:external-export': Object.freeze({
    riskClass: 'high',
    irreversible: false,
    requiredApproverRoles: Object.freeze([]),
    allowedApproverRoles: Object.freeze(['manager', 'security-admin']),
    requiredDecisionCount: 1,
    disallowRequesterApproval: false,
  }),
  'workspace:external-write': Object.freeze({
    riskClass: 'high',
    irreversible: false,
    requiredApproverRoles: Object.freeze([]),
    allowedApproverRoles: Object.freeze(['manager', 'security-admin']),
    requiredDecisionCount: 1,
    disallowRequesterApproval: false,
  }),
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function actionApprovalChecksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export function normalizeActionApprovalRole(role = '') {
  const value = String(role || '').trim().toLowerCase().replace(/_/g, '-');
  if (['admin', 'security', 'security-admin', 'owner'].includes(value)) return 'security-admin';
  if (['lead', 'leader', 'manager', 'director'].includes(value)) return 'manager';
  return value;
}

export function getActionApprovalPolicy(actionType = '') {
  const normalizedType = String(actionType || '').trim().toLowerCase();
  const policy = ACTION_POLICIES[normalizedType];
  if (!policy) throw new Error(`unsupported-action-approval-type:${normalizedType || 'missing'}`);
  return {
    actionType: normalizedType,
    riskClass: policy.riskClass,
    irreversible: policy.irreversible,
    requiredApproverRoles: [...policy.requiredApproverRoles],
    allowedApproverRoles: [...policy.allowedApproverRoles],
    requiredDecisionCount: policy.requiredDecisionCount,
    disallowRequesterApproval: policy.disallowRequesterApproval,
  };
}

export function createActionApprovalRecord({
  projectId = '',
  actionType = '',
  actionKey = '',
  requestedBy = '',
  reason = '',
  idempotencyKey = '',
  ttlMs = 60 * 60 * 1000,
  now = new Date().toISOString(),
} = {}) {
  const policy = getActionApprovalPolicy(actionType);
  const normalizedProjectId = String(projectId || '').trim();
  const normalizedActionKey = String(actionKey || '').trim();
  const normalizedRequester = String(requestedBy || '').trim();
  const normalizedReason = String(reason || '').trim();
  const normalizedIdempotencyKey = String(idempotencyKey || '').trim();
  if (!normalizedProjectId) throw new Error('action-approval-project-required');
  if (!normalizedActionKey) throw new Error('action-approval-key-required');
  if (!normalizedRequester) throw new Error('action-approval-requester-required');
  if (!normalizedReason) throw new Error('action-approval-reason-required');
  if (!normalizedIdempotencyKey) throw new Error('action-approval-idempotency-key-required');
  const durationMs = Math.max(MIN_TTL_MS, Math.min(Number(ttlMs) || 60 * 60 * 1000, MAX_TTL_MS));
  const intent = {
    projectId: normalizedProjectId,
    actionType: policy.actionType,
    actionKey: normalizedActionKey,
    requestedBy: normalizedRequester,
    reason: normalizedReason,
    idempotencyKey: normalizedIdempotencyKey,
    ttlMs: durationMs,
  };
  const intentChecksum = actionApprovalChecksum(intent);
  const base = {
    schemaVersion: 'local-action-approval/v1',
    id: `action_approval_${actionApprovalChecksum(`${normalizedProjectId}:${normalizedIdempotencyKey}`).slice(0, 24)}_${randomUUID().slice(0, 8)}`,
    ...intent,
    ...policy,
    status: 'pending',
    requestedAt: now,
    expiresAt: new Date((Date.parse(now) || Date.now()) + durationMs).toISOString(),
    intentChecksum,
    decisions: [],
    executionClaim: null,
  };
  return { ...base, checksum: actionApprovalChecksum(base) };
}

export function createActionApprovalDecision(record, {
  decision = '',
  approverRole = '',
  approverId = '',
  reason = '',
  now = new Date().toISOString(),
} = {}) {
  const normalizedDecision = String(decision || '').trim().toLowerCase();
  const normalizedRole = normalizeActionApprovalRole(approverRole);
  const normalizedApprover = String(approverId || '').trim();
  if (!['approved', 'rejected'].includes(normalizedDecision)) throw new Error('action-approval-decision-invalid');
  if (!record.allowedApproverRoles?.includes(normalizedRole)) throw new Error(`action-approval-role-not-allowed:${normalizedRole || 'missing'}`);
  if (!normalizedApprover) throw new Error('action-approval-approver-required');
  if (record.disallowRequesterApproval && normalizedApprover === record.requestedBy) {
    throw new Error('action-approval-self-approval-forbidden');
  }
  const base = {
    schemaVersion: 'local-action-approval-decision/v1',
    id: `action_approval_decision_${record.id}_${actionApprovalChecksum(`${normalizedRole}:${normalizedApprover}`).slice(0, 16)}`,
    approvalId: record.id,
    decision: normalizedDecision,
    approverRole: normalizedRole,
    approverId: normalizedApprover,
    reason: String(reason || '').trim(),
    decidedAt: now,
  };
  return { ...base, checksum: actionApprovalChecksum(base) };
}

export function actionApprovalState(record = {}, now = new Date().toISOString()) {
  const decisions = Array.isArray(record.decisions) ? record.decisions : [];
  const rejected = decisions.some((item) => item.decision === 'rejected');
  const approved = decisions.filter((item) => item.decision === 'approved');
  const approvedRoles = [...new Set(approved.map((item) => normalizeActionApprovalRole(item.approverRole)))];
  const missingApproverRoles = (record.requiredApproverRoles || []).filter((role) => !approvedRoles.includes(role));
  const expired = (Date.parse(record.expiresAt || '') || 0) <= (Date.parse(now) || Date.now());
  let status = 'pending';
  if (record.status === 'cancelled') status = 'cancelled';
  else if (record.status === 'executing') status = 'executing';
  else if (record.status === 'consumed') status = 'consumed';
  else if (rejected) status = 'rejected';
  else if (expired) status = 'expired';
  else if (approved.length >= Number(record.requiredDecisionCount || 1) && !missingApproverRoles.length) status = 'approved';
  return { status, approvedDecisionCount: approved.length, approvedRoles, missingApproverRoles };
}

export function publicActionApproval(record = {}, now = new Date().toISOString()) {
  const state = actionApprovalState(record, now);
  const integrity = verifyActionApprovalRecord(record);
  return {
    ...record,
    status: integrity.valid ? state.status : 'integrity-invalid',
    approvedDecisionCount: state.approvedDecisionCount,
    approvedRoles: state.approvedRoles,
    missingApproverRoles: state.missingApproverRoles,
    integrity,
  };
}

export function verifyActionApprovalRecord(record = {}) {
  const { checksum, ...base } = record;
  const recordValid = Boolean(checksum) && checksum === actionApprovalChecksum(base);
  const decisionResults = (record.decisions || []).map((decision) => {
    const { checksum: decisionChecksum, ...decisionBase } = decision;
    return Boolean(decisionChecksum) && decisionChecksum === actionApprovalChecksum(decisionBase);
  });
  return {
    valid: recordValid && decisionResults.every(Boolean),
    recordValid,
    decisionCount: decisionResults.length,
    validDecisionCount: decisionResults.filter(Boolean).length,
  };
}

export function claimActionApprovalExecution(record = {}, {
  projectId = '',
  actionType = '',
  actionKey = '',
  executionKey = '',
  now = new Date().toISOString(),
} = {}) {
  const integrity = verifyActionApprovalRecord(record);
  if (!integrity.valid) throw new Error('action-approval-integrity-invalid');
  if (record.projectId !== projectId
    || record.actionType !== String(actionType || '').trim().toLowerCase()
    || record.actionKey !== String(actionKey || '').trim()) {
    throw new Error('action-approval-exact-match-required');
  }
  const normalizedExecutionKey = String(executionKey || '').trim();
  if (!normalizedExecutionKey) throw new Error('action-approval-execution-key-required');
  const executionKeyHash = actionApprovalChecksum(normalizedExecutionKey);
  const state = actionApprovalState(record, now);
  if (state.status === 'executing'
    && record.executionClaim?.executionKeyHash === executionKeyHash
    && record.executionClaim?.checksum) {
    return { actionApproval: record, executionClaim: record.executionClaim, resumed: true };
  }
  if (state.status !== 'approved') throw new Error(`action-approval-not-executable:${state.status}`);
  const claimBase = {
    schemaVersion: 'local-action-approval-execution-claim/v1',
    approvalId: record.id,
    projectId,
    actionType: record.actionType,
    actionKey: record.actionKey,
    claimedAt: now,
    executionKeyHash,
    approvalChecksum: record.checksum,
    decisionChecksums: (record.decisions || []).map((item) => item.checksum),
  };
  const executionClaim = { ...claimBase, checksum: actionApprovalChecksum(claimBase) };
  const updatedBase = {
    ...record,
    status: 'executing',
    executionClaim,
  };
  delete updatedBase.checksum;
  return {
    actionApproval: { ...updatedBase, checksum: actionApprovalChecksum(updatedBase) },
    executionClaim,
    resumed: false,
  };
}

export function withActionApprovalDecisions(record, decisions = [], now = new Date().toISOString()) {
  const base = { ...record, decisions, status: actionApprovalState({ ...record, decisions }, now).status };
  delete base.checksum;
  return { ...base, checksum: actionApprovalChecksum(base) };
}
