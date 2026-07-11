import { createHash, randomUUID } from 'node:crypto';

const TERMINAL_STATUSES = new Set(['acknowledged', 'dead-lettered', 'cancelled']);
const SENSITIVE_REQUEST_FIELDS = new Set(['body', 'content', 'prompt', 'instruction', 'query', 'messages', 'response', 'result']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function durableTaskQueueChecksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function sealRow(base) {
  const { checksum: _checksum, ...value } = base;
  return { ...value, checksum: durableTaskQueueChecksum(value) };
}

function verifyRow(row = {}) {
  const { checksum, ...base } = row;
  return Boolean(checksum) && checksum === durableTaskQueueChecksum(base);
}

function clone(value) {
  return structuredClone(value);
}

function replaceRow(rows, nextRow) {
  return [nextRow, ...rows.filter((row) => row.id !== nextRow.id)];
}

function requireValidRows(rows = []) {
  const audit = auditLocalDurableTaskQueue(rows);
  if (!audit.valid) throw new Error('local-durable-task-queue-integrity-invalid');
  return Array.isArray(rows) ? rows : [];
}

function assertContentMinimized(value, path = 'requestBody') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertContentMinimized(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    if (SENSITIVE_REQUEST_FIELDS.has(String(key).toLowerCase())) {
      throw new Error(`local-durable-task-request-body-sensitive-field:${path}.${key}`);
    }
    assertContentMinimized(child, `${path}.${key}`);
  });
}

function normalizedDate(value, errorCode) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) throw new Error(errorCode);
  return new Date(parsed).toISOString();
}

function intentFromJob(job = {}) {
  const projectId = String(job.projectId || '').trim();
  const workerKind = String(job.workerKind || '').trim();
  const idempotencyKey = String(job.idempotencyKey || '').trim();
  const runApiPath = String(job.runApiPath || '').trim();
  if (!projectId) throw new Error('local-durable-task-project-required');
  if (!['project-autonomous', 'agent-worker', 'autopilot-session'].includes(workerKind)) throw new Error('local-durable-task-worker-kind-invalid');
  if (!idempotencyKey || idempotencyKey.length > 512) throw new Error('local-durable-task-idempotency-key-invalid');
  if (!runApiPath.startsWith('/') || runApiPath.startsWith('//') || runApiPath.includes('://')) throw new Error('local-durable-task-route-invalid');
  const requestBody = job.requestBody && typeof job.requestBody === 'object' && !Array.isArray(job.requestBody)
    ? clone(job.requestBody)
    : {};
  assertContentMinimized(requestBody);
  const dueAt = normalizedDate(job.dueAt, 'local-durable-task-due-at-invalid');
  const maxAttempts = Math.max(1, Math.min(20, Math.round(Number(job.maxAttempts) || 3)));
  const retryBackoffSeconds = (Array.isArray(job.retryBackoffSeconds) && job.retryBackoffSeconds.length
    ? job.retryBackoffSeconds
    : [5, 30, 120])
    .slice(0, maxAttempts)
    .map((value) => Math.max(1, Math.min(86_400, Math.round(Number(value) || 1))));
  return {
    schemaVersion: 'local-durable-task-intent/v1',
    projectId,
    workerKind,
    agentId: job.agentId ? String(job.agentId) : null,
    sessionId: job.sessionId ? String(job.sessionId) : null,
    replayOfJobId: job.replayOfJobId ? String(job.replayOfJobId) : null,
    replayOfSourceChecksum: job.replayOfSourceChecksum ? String(job.replayOfSourceChecksum) : null,
    replayApprovalChecksum: job.replayApprovalChecksum ? String(job.replayApprovalChecksum) : null,
    idempotencyKey,
    runApiPath,
    requestBody,
    requestBodyChecksum: durableTaskQueueChecksum(requestBody),
    traceId: job.traceId ? String(job.traceId) : null,
    dueAt,
    priority: Math.max(-100, Math.min(100, Math.round(Number(job.priority) || 0))),
    maxAttempts,
    retryBackoffSeconds,
  };
}

export function auditLocalDurableTaskQueue(rows = []) {
  if (!Array.isArray(rows)) return { valid: false, rowCount: 0, invalidRowIds: ['queue-not-array'], duplicateIds: [], duplicateIdempotencyKeys: [] };
  const invalidRowIds = rows.filter((row) => !verifyRow(row)).map((row) => row?.id || 'missing-id');
  const duplicateValues = (field) => {
    const counts = new Map();
    rows.forEach((row) => counts.set(row?.[field], (counts.get(row?.[field]) || 0) + 1));
    return [...counts.entries()].filter(([value, count]) => value && count > 1).map(([value]) => value);
  };
  const duplicateIds = duplicateValues('id');
  const duplicateIdempotencyKeys = duplicateValues('idempotencyKey');
  return {
    valid: invalidRowIds.length === 0 && duplicateIds.length === 0 && duplicateIdempotencyKeys.length === 0,
    rowCount: rows.length,
    invalidRowIds,
    duplicateIds,
    duplicateIdempotencyKeys,
  };
}

export function enqueueLocalDurableTask({ rows = [], job = {}, now = new Date().toISOString() } = {}) {
  const currentRows = requireValidRows(rows);
  const intent = intentFromJob(job);
  const intentChecksum = durableTaskQueueChecksum(intent);
  const existing = currentRows.find((row) => row.idempotencyKey === intent.idempotencyKey);
  if (existing) {
    if (existing.intentChecksum !== intentChecksum) throw new Error('local-durable-task-idempotency-conflict');
    return { action: 'already-enqueued', job: existing, rows: currentRows };
  }
  const createdAt = normalizedDate(now, 'local-durable-task-now-invalid');
  const base = {
    schemaVersion: 'local-durable-task/v1',
    id: `local_task_${durableTaskQueueChecksum(intent.idempotencyKey).slice(0, 32)}`,
    ...intent,
    intentChecksum,
    status: 'queued',
    createdAt,
    updatedAt: createdAt,
    attemptCount: 0,
    workerId: null,
    fenceToken: null,
    leasedAt: null,
    leaseExpiresAt: null,
    retryAt: null,
    acknowledgedAt: null,
    executionReceiptChecksum: null,
    resultChecksum: null,
    failureCodeHash: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReasonHash: null,
    cancellationRequestedAt: null,
    cancellationFenceToken: null,
    cancellationPreviousFenceHash: null,
    cancellationSignalDelivered: null,
    cancellationCompletedAt: null,
    cancellationReceiptChecksum: null,
  };
  const queued = sealRow(base);
  return { action: 'enqueued', job: queued, rows: replaceRow(currentRows, queued) };
}

export function enqueueLocalDurableDeadLetterReplay({
  rows = [], sourceJobId, now = new Date().toISOString(), priority, replayApprovalChecksum = null,
} = {}) {
  const currentRows = requireValidRows(rows);
  const source = currentRows.find((row) => row.id === sourceJobId);
  if (!source) throw new Error('local-durable-dead-letter-not-found');
  if (source.status !== 'dead-lettered') throw new Error('local-durable-dead-letter-not-active');
  const sourceChecksum = source.checksum;
  const replayKey = `dead-letter-replay:${source.id}:${sourceChecksum}`;
  const replay = enqueueLocalDurableTask({
    rows: currentRows,
    job: {
      projectId: source.projectId,
      workerKind: source.workerKind,
      agentId: source.agentId,
      sessionId: source.sessionId,
      replayOfJobId: source.id,
      replayOfSourceChecksum: sourceChecksum,
      replayApprovalChecksum,
      idempotencyKey: replayKey,
      runApiPath: source.runApiPath,
      requestBody: clone(source.requestBody || {}),
      traceId: source.traceId,
      dueAt: normalizedDate(source.updatedAt || source.createdAt, 'local-durable-task-due-at-invalid'),
      priority: priority ?? source.priority,
      maxAttempts: source.maxAttempts,
      retryBackoffSeconds: source.retryBackoffSeconds,
    },
    now,
  });
  return {
    ...replay,
    action: replay.action === 'enqueued' ? 'replay-enqueued' : 'replay-already-enqueued',
    source,
    sourceChecksum,
  };
}

export function acquireLocalDurableTaskLease({
  rows = [],
  jobId,
  workerId,
  now = new Date().toISOString(),
  leaseSeconds = 60,
  nonce,
} = {}) {
  const currentRows = requireValidRows(rows);
  const job = currentRows.find((row) => row.id === jobId);
  if (!job) throw new Error('local-durable-task-not-found');
  if (job.status === 'acknowledged') return { action: 'already-acknowledged', job, rows: currentRows };
  if (TERMINAL_STATUSES.has(job.status)) return { action: 'terminal', job, rows: currentRows };
  if (job.status === 'cancellation-requested') return { action: 'cancellation-pending', job, rows: currentRows };
  const nowAt = normalizedDate(now, 'local-durable-task-now-invalid');
  const nowMs = Date.parse(nowAt);
  if (job.status === 'leased' && Date.parse(job.leaseExpiresAt || '') > nowMs) return { action: 'lease-active', job, rows: currentRows };
  const dueMs = Date.parse(job.status === 'retry-wait' ? job.retryAt : job.dueAt);
  if (dueMs > nowMs) return { action: 'not-due', job, rows: currentRows };
  const normalizedWorkerId = String(workerId || '').trim();
  if (!normalizedWorkerId) throw new Error('local-durable-task-worker-required');
  const attemptCount = job.attemptCount + 1;
  const fenceNonce = String(nonce || randomUUID());
  const fenceToken = `fence:${job.id}:${attemptCount}:${durableTaskQueueChecksum(fenceNonce).slice(0, 24)}`;
  const leaseDurationMs = Math.max(1, Math.min(3600, Number(leaseSeconds) || 60)) * 1000;
  const leased = sealRow({
    ...job,
    status: 'leased',
    attemptCount,
    workerId: normalizedWorkerId,
    fenceToken,
    leasedAt: nowAt,
    leaseExpiresAt: new Date(nowMs + leaseDurationMs).toISOString(),
    retryAt: null,
    updatedAt: nowAt,
    checksum: undefined,
  });
  return {
    action: job.status === 'leased' ? 'recovered-expired-lease' : 'acquired',
    job: leased,
    rows: replaceRow(currentRows, leased),
  };
}

export function acknowledgeLocalDurableTask({ rows = [], jobId, fenceToken, receipt = {}, now = new Date().toISOString() } = {}) {
  const currentRows = requireValidRows(rows);
  const job = currentRows.find((row) => row.id === jobId);
  if (!job) throw new Error('local-durable-task-not-found');
  if (job.status === 'acknowledged') return { action: 'already-acknowledged', job, rows: currentRows };
  if (job.status !== 'leased' || job.fenceToken !== fenceToken) throw new Error('local-durable-task-stale-fence');
  const receiptValid = receipt.schemaVersion === 'worker-execution-receipt/v1'
    && receipt.idempotencyKey === job.idempotencyKey
    && receipt.leaseKey === job.fenceToken
    && (/^[a-f0-9]{64}$/.test(String(receipt.receiptChecksum || '')) || /^chk_[a-f0-9]{8}$/.test(String(receipt.receiptChecksum || '')))
    && ['succeeded', 'completed'].includes(receipt.status);
  if (!receiptValid) {
    const diagnostics = [
      receipt.schemaVersion === 'worker-execution-receipt/v1' ? 'schema-ok' : 'schema',
      receipt.idempotencyKey === job.idempotencyKey ? 'idempotency-ok' : 'idempotency',
      receipt.leaseKey === job.fenceToken ? 'lease-ok' : 'lease',
      (/^[a-f0-9]{64}$/.test(String(receipt.receiptChecksum || '')) || /^chk_[a-f0-9]{8}$/.test(String(receipt.receiptChecksum || ''))) ? 'checksum-ok' : 'checksum',
      ['succeeded', 'completed'].includes(receipt.status) ? 'status-ok' : 'status',
    ];
    throw new Error(`local-durable-task-execution-receipt-invalid:${diagnostics.join(',')}`);
  }
  if (job.traceId && receipt.traceId && job.traceId !== receipt.traceId) throw new Error('local-durable-task-trace-mismatch');
  const acknowledgedAt = normalizedDate(now, 'local-durable-task-now-invalid');
  const acknowledged = sealRow({
    ...job,
    status: 'acknowledged',
    acknowledgedAt,
    executionReceiptChecksum: receipt.receiptChecksum,
    resultChecksum: receipt.resultChecksum || null,
    leaseExpiresAt: acknowledgedAt,
    updatedAt: acknowledgedAt,
    checksum: undefined,
  });
  return { action: 'acknowledged', job: acknowledged, rows: replaceRow(currentRows, acknowledged) };
}

export function failLocalDurableTask({
  rows = [], jobId, fenceToken, retryable = true, failureCode = 'worker-failed', now = new Date().toISOString(),
} = {}) {
  const currentRows = requireValidRows(rows);
  const job = currentRows.find((row) => row.id === jobId);
  if (!job) throw new Error('local-durable-task-not-found');
  if (job.status !== 'leased' || job.fenceToken !== fenceToken) throw new Error('local-durable-task-stale-fence');
  const failedAt = normalizedDate(now, 'local-durable-task-now-invalid');
  const exhausted = !retryable || job.attemptCount >= job.maxAttempts;
  const backoff = job.retryBackoffSeconds[Math.min(job.attemptCount, job.retryBackoffSeconds.length - 1)] || 1;
  const failed = sealRow({
    ...job,
    status: exhausted ? 'dead-lettered' : 'retry-wait',
    retryAt: exhausted ? null : new Date(Date.parse(failedAt) + backoff * 1000).toISOString(),
    failureCodeHash: durableTaskQueueChecksum(String(failureCode || 'worker-failed')),
    leaseExpiresAt: failedAt,
    updatedAt: failedAt,
    checksum: undefined,
  });
  return { action: exhausted ? 'dead-lettered' : 'retry-scheduled', job: failed, rows: replaceRow(currentRows, failed) };
}

export function cancelLocalDurableTask({ rows = [], jobId, actorId, reason, now = new Date().toISOString() } = {}) {
  const currentRows = requireValidRows(rows);
  const job = currentRows.find((row) => row.id === jobId);
  if (!job) throw new Error('local-durable-task-not-found');
  if (TERMINAL_STATUSES.has(job.status)) return { action: 'terminal', job, rows: currentRows };
  if (job.status === 'leased') throw new Error('local-durable-task-active-lease-cancel-required');
  const normalizedActorId = String(actorId || '').trim();
  const normalizedReason = String(reason || '').trim();
  if (!normalizedActorId || !normalizedReason) throw new Error('local-durable-task-cancellation-reason-required');
  const cancelledAt = normalizedDate(now, 'local-durable-task-now-invalid');
  const cancelled = sealRow({
    ...job,
    status: 'cancelled',
    cancelledAt,
    cancelledBy: normalizedActorId,
    cancellationReasonHash: durableTaskQueueChecksum(normalizedReason),
    updatedAt: cancelledAt,
    checksum: undefined,
  });
  return { action: 'cancelled', job: cancelled, rows: replaceRow(currentRows, cancelled) };
}

export function requestLocalDurableTaskCancellation({
  rows = [], jobId, actorId, reason, now = new Date().toISOString(), nonce,
} = {}) {
  const currentRows = requireValidRows(rows);
  const job = currentRows.find((row) => row.id === jobId);
  if (!job) throw new Error('local-durable-task-not-found');
  if (TERMINAL_STATUSES.has(job.status)) return { action: 'terminal', job, rows: currentRows };
  if (job.status === 'cancellation-requested') return { action: 'already-requested', job, rows: currentRows };
  const normalizedActorId = String(actorId || '').trim();
  const normalizedReason = String(reason || '').trim();
  if (!normalizedActorId || !normalizedReason) throw new Error('local-durable-task-cancellation-reason-required');
  const requestedAt = normalizedDate(now, 'local-durable-task-now-invalid');
  if (job.status !== 'leased') {
    return cancelLocalDurableTask({ rows: currentRows, jobId, actorId: normalizedActorId, reason: normalizedReason, now: requestedAt });
  }
  const previousFenceToken = job.fenceToken;
  const cancellationFenceToken = `cancel:${job.id}:${job.attemptCount}:${durableTaskQueueChecksum(String(nonce || randomUUID())).slice(0, 24)}`;
  const requested = sealRow({
    ...job,
    status: 'cancellation-requested',
    fenceToken: cancellationFenceToken,
    cancellationFenceToken,
    cancellationPreviousFenceHash: durableTaskQueueChecksum(previousFenceToken),
    cancellationRequestedAt: requestedAt,
    cancelledBy: normalizedActorId,
    cancellationReasonHash: durableTaskQueueChecksum(normalizedReason),
    cancellationSignalDelivered: null,
    updatedAt: requestedAt,
    checksum: undefined,
  });
  return {
    action: 'cancellation-requested',
    job: requested,
    rows: replaceRow(currentRows, requested),
    previousFenceToken,
  };
}

export function finalizeLocalDurableTaskCancellation({
  rows = [], jobId, cancellationFenceToken, signalDelivered = false, now = new Date().toISOString(),
} = {}) {
  const currentRows = requireValidRows(rows);
  const job = currentRows.find((row) => row.id === jobId);
  if (!job) throw new Error('local-durable-task-not-found');
  if (job.status === 'cancelled') return { action: 'already-cancelled', job, rows: currentRows };
  if (job.status !== 'cancellation-requested' || job.cancellationFenceToken !== cancellationFenceToken) {
    throw new Error('local-durable-task-stale-cancellation-fence');
  }
  const completedAt = normalizedDate(now, 'local-durable-task-now-invalid');
  const receiptBase = {
    schemaVersion: 'local-durable-task-cancellation-receipt/v1',
    jobId: job.id,
    projectId: job.projectId,
    attemptCount: job.attemptCount,
    cancellationFenceToken: job.cancellationFenceToken,
    cancellationPreviousFenceHash: job.cancellationPreviousFenceHash,
    requestedAt: job.cancellationRequestedAt,
    completedAt,
    actorId: job.cancelledBy,
    reasonHash: job.cancellationReasonHash,
    signalDelivered: Boolean(signalDelivered),
    storesRawReason: false,
  };
  const cancelled = sealRow({
    ...job,
    status: 'cancelled',
    cancelledAt: completedAt,
    cancellationSignalDelivered: Boolean(signalDelivered),
    cancellationCompletedAt: completedAt,
    cancellationReceiptChecksum: durableTaskQueueChecksum(receiptBase),
    leaseExpiresAt: completedAt,
    updatedAt: completedAt,
    checksum: undefined,
  });
  return { action: 'cancelled', job: cancelled, rows: replaceRow(currentRows, cancelled), receipt: { ...receiptBase, checksum: cancelled.cancellationReceiptChecksum } };
}

export function snapshotLocalDurableTaskQueue({ rows = [], projectId = null, now = new Date().toISOString() } = {}) {
  const currentRows = requireValidRows(rows);
  const nowAt = normalizedDate(now, 'local-durable-task-now-invalid');
  const nowMs = Date.parse(nowAt);
  const selected = currentRows
    .filter((row) => !projectId || row.projectId === projectId)
    .sort((left, right) => (
      Number(right.priority || 0) - Number(left.priority || 0)
      || Date.parse(left.status === 'retry-wait' ? left.retryAt : left.dueAt) - Date.parse(right.status === 'retry-wait' ? right.retryAt : right.dueAt)
      || left.createdAt.localeCompare(right.createdAt)
      || left.id.localeCompare(right.id)
    ));
  const due = (row) => ['queued', 'retry-wait'].includes(row.status)
    && Date.parse(row.status === 'retry-wait' ? row.retryAt : row.dueAt) <= nowMs;
  const base = {
    schemaVersion: 'local-durable-task-queue-snapshot/v1',
    projectId,
    generatedAt: nowAt,
    integrity: auditLocalDurableTaskQueue(currentRows),
    rows: selected,
    summary: {
      count: selected.length,
      dueCount: selected.filter(due).length,
      queuedCount: selected.filter((row) => row.status === 'queued').length,
      leasedCount: selected.filter((row) => row.status === 'leased').length,
      cancellationRequestedCount: selected.filter((row) => row.status === 'cancellation-requested').length,
      retryWaitCount: selected.filter((row) => row.status === 'retry-wait').length,
      acknowledgedCount: selected.filter((row) => row.status === 'acknowledged').length,
      deadLetteredCount: selected.filter((row) => row.status === 'dead-lettered').length,
      cancelledCount: selected.filter((row) => row.status === 'cancelled').length,
    },
  };
  return { ...base, checksum: durableTaskQueueChecksum(base) };
}

export function compactLocalDurableTaskQueue({ rows = [], maxAcknowledged = 500 } = {}) {
  const currentRows = requireValidRows(rows);
  const limit = Math.max(0, Math.min(10_000, Math.round(Number(maxAcknowledged) || 0)));
  const acknowledged = currentRows
    .filter((row) => row.status === 'acknowledged')
    .sort((left, right) => String(right.acknowledgedAt || '').localeCompare(String(left.acknowledgedAt || '')));
  const retainedAcknowledgedIds = new Set(acknowledged.slice(0, limit).map((row) => row.id));
  const nextRows = currentRows.filter((row) => row.status !== 'acknowledged' || retainedAcknowledgedIds.has(row.id));
  return {
    rows: nextRows,
    removedCount: currentRows.length - nextRows.length,
    retainedAcknowledgedCount: retainedAcknowledgedIds.size,
  };
}
