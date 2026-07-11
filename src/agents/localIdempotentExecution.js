import { createHash } from 'node:crypto';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function localIdempotentExecutionChecksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function seal(base) {
  const { checksum: _checksum, ...value } = base;
  return { ...value, checksum: localIdempotentExecutionChecksum(value) };
}

function replace(rows, operation) {
  return [operation, ...rows.filter((row) => row.id !== operation.id)];
}

export function auditLocalIdempotentExecutions(rows = []) {
  if (!Array.isArray(rows)) return { valid: false, invalidIds: ['ledger-not-array'], duplicateOperationKeys: [] };
  const invalidIds = rows.filter((row) => {
    const { checksum, ...base } = row || {};
    return !checksum || checksum !== localIdempotentExecutionChecksum(base);
  }).map((row) => row?.id || 'missing-id');
  const counts = new Map();
  rows.forEach((row) => counts.set(row.operationKey, (counts.get(row.operationKey) || 0) + 1));
  const duplicateOperationKeys = [...counts.entries()].filter(([key, count]) => key && count > 1).map(([key]) => key);
  return { valid: invalidIds.length === 0 && duplicateOperationKeys.length === 0, invalidIds, duplicateOperationKeys, count: rows.length };
}

function requireRows(rows) {
  const audit = auditLocalIdempotentExecutions(rows);
  if (!audit.valid) throw new Error('local-idempotent-execution-integrity-invalid');
  return rows;
}

function normalizeIntent(intent = {}) {
  const projectId = String(intent.projectId || '').trim();
  const operationKey = String(intent.operationKey || '').trim();
  const operationKind = String(intent.operationKind || '').trim();
  const requestChecksum = String(intent.requestChecksum || '').toLowerCase();
  if (!projectId || !operationKind) throw new Error('local-idempotent-execution-intent-invalid');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(operationKey)) throw new Error('local-idempotent-execution-key-invalid');
  if (!/^[a-f0-9]{64}$/.test(requestChecksum)) throw new Error('local-idempotent-execution-request-checksum-invalid');
  return {
    schemaVersion: 'local-idempotent-execution-intent/v1',
    projectId,
    operationKey,
    operationKind,
    requestChecksum,
    traceId: intent.traceId ? String(intent.traceId) : null,
    providerEndpointHonoringAttested: intent.providerEndpointHonoringAttested === true,
  };
}

export function prepareLocalIdempotentExecution({ rows = [], intent = {}, now = new Date().toISOString() } = {}) {
  const current = requireRows(Array.isArray(rows) ? rows : []);
  const normalized = normalizeIntent(intent);
  const intentChecksum = localIdempotentExecutionChecksum(normalized);
  const existing = current.find((row) => row.operationKey === normalized.operationKey);
  if (existing) {
    if (existing.intentChecksum !== intentChecksum) throw new Error('local-idempotent-execution-idempotency-conflict');
    if (['dispatched', 'ambiguous'].includes(existing.status)) throw new Error('local-idempotent-execution-ambiguous-reconciliation-required');
    if (existing.status === 'completed') return { action: 'reuse-completed', operation: existing, rows: current };
    if (existing.status === 'reconciled' && existing.safeToRetryAutomatically) {
      const retried = seal({
        ...existing,
        status: 'prepared',
        preparedAt: now,
        updatedAt: now,
        checksum: undefined,
      });
      return { action: 'retry-authorized', operation: retried, rows: replace(current, retried) };
    }
    return { action: 'already-prepared', operation: existing, rows: current };
  }
  const base = {
    schemaVersion: 'local-idempotent-execution/v1',
    id: `idem_exec_${localIdempotentExecutionChecksum(normalized.operationKey).slice(0, 32)}`,
    ...normalized,
    intentChecksum,
    status: 'prepared',
    preparedAt: now,
    updatedAt: now,
    completedAt: null,
    ambiguousAt: null,
    ambiguousReasonHash: null,
    safeToRetryAutomatically: normalized.providerEndpointHonoringAttested,
    providerResponseId: null,
    resultChecksum: null,
    localEffectReceiptChecksum: null,
    reconciliation: null,
  };
  const operation = seal(base);
  return { action: 'prepared', operation, rows: replace(current, operation) };
}

export function completeLocalIdempotentExecution({
  rows = [], operationId, providerResponseId = null, resultChecksum, localEffectReceiptChecksum = null, now = new Date().toISOString(),
} = {}) {
  const current = requireRows(rows);
  const operation = current.find((row) => row.id === operationId);
  if (!operation) throw new Error('local-idempotent-execution-not-found');
  if (operation.status === 'completed') return { action: 'reuse-completed', operation, rows: current };
  if (!['prepared', 'dispatched', 'reconciled'].includes(operation.status)) throw new Error(`local-idempotent-execution-not-completable:${operation.status}`);
  if (!/^[a-f0-9]{64}$/.test(String(resultChecksum || ''))) throw new Error('local-idempotent-execution-result-checksum-required');
  const completed = seal({
    ...operation,
    status: 'completed',
    providerResponseId: providerResponseId ? String(providerResponseId) : null,
    resultChecksum,
    localEffectReceiptChecksum: localEffectReceiptChecksum || null,
    completedAt: now,
    updatedAt: now,
    safeToRetryAutomatically: true,
    checksum: undefined,
  });
  return { action: 'completed', operation: completed, rows: replace(current, completed) };
}

export function markLocalIdempotentExecutionDispatched({ rows = [], operationId, now = new Date().toISOString() } = {}) {
  const current = requireRows(rows);
  const operation = current.find((row) => row.id === operationId);
  if (!operation) throw new Error('local-idempotent-execution-not-found');
  if (operation.status === 'dispatched') return { action: 'already-dispatched', operation, rows: current };
  if (operation.status !== 'prepared') throw new Error(`local-idempotent-execution-not-dispatchable:${operation.status}`);
  const dispatched = seal({
    ...operation,
    status: 'dispatched',
    dispatchedAt: now,
    safeToRetryAutomatically: false,
    updatedAt: now,
    checksum: undefined,
  });
  return { action: 'dispatched', operation: dispatched, rows: replace(current, dispatched) };
}

export function markLocalIdempotentExecutionAmbiguous({ rows = [], operationId, reasonCode, now = new Date().toISOString() } = {}) {
  const current = requireRows(rows);
  const operation = current.find((row) => row.id === operationId);
  if (!operation) throw new Error('local-idempotent-execution-not-found');
  if (operation.status === 'completed') throw new Error('local-idempotent-execution-already-completed');
  const reason = String(reasonCode || '').trim();
  if (!reason) throw new Error('local-idempotent-execution-ambiguous-reason-required');
  const ambiguous = seal({
    ...operation,
    status: 'ambiguous',
    ambiguousAt: now,
    ambiguousReasonHash: localIdempotentExecutionChecksum(reason),
    safeToRetryAutomatically: false,
    updatedAt: now,
    checksum: undefined,
  });
  return { action: 'ambiguous', operation: ambiguous, rows: replace(current, ambiguous) };
}

export function reconcileLocalIdempotentExecution({
  rows = [], operationId, actorId, outcome, providerResponseId = null, resultChecksum = null, evidenceChecksum, reason, now = new Date().toISOString(),
} = {}) {
  const current = requireRows(rows);
  const operation = current.find((row) => row.id === operationId);
  if (!operation || operation.status !== 'ambiguous') throw new Error('local-idempotent-execution-ambiguous-not-found');
  const normalizedActorId = String(actorId || '').trim();
  const normalizedOutcome = String(outcome || '').trim();
  const normalizedReason = String(reason || '').trim();
  if (!normalizedActorId || !['completed', 'not-applied'].includes(normalizedOutcome)) throw new Error('local-idempotent-execution-reconciliation-invalid');
  if (!/^[a-f0-9]{64}$/.test(String(evidenceChecksum || '')) || !normalizedReason) throw new Error('local-idempotent-execution-reconciliation-evidence-required');
  if (normalizedOutcome === 'completed' && (!providerResponseId || !/^[a-f0-9]{64}$/.test(String(resultChecksum || '')))) {
    throw new Error('local-idempotent-execution-reconciliation-evidence-required');
  }
  const reconciliation = {
    schemaVersion: 'local-idempotent-execution-reconciliation/v1',
    actorId: normalizedActorId,
    outcome: normalizedOutcome,
    providerResponseId: providerResponseId ? String(providerResponseId) : null,
    resultChecksum: resultChecksum || null,
    evidenceChecksum,
    reasonHash: localIdempotentExecutionChecksum(normalizedReason),
    reconciledAt: now,
  };
  const reconciled = seal({
    ...operation,
    status: normalizedOutcome === 'completed' ? 'completed' : 'reconciled',
    providerResponseId: reconciliation.providerResponseId,
    resultChecksum: reconciliation.resultChecksum,
    completedAt: normalizedOutcome === 'completed' ? now : null,
    reconciliation,
    safeToRetryAutomatically: normalizedOutcome === 'not-applied',
    updatedAt: now,
    checksum: undefined,
  });
  return { action: `reconciled-${normalizedOutcome}`, operation: reconciled, rows: replace(current, reconciled) };
}
