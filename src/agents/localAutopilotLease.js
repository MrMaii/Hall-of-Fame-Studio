const MAX_LEASE_ROWS = 100;

function replaceLease(rows = [], nextLease = {}) {
  return [
    nextLease,
    ...rows.filter((row) => row?.idempotencyKey !== nextLease.idempotencyKey),
  ].slice(0, MAX_LEASE_ROWS);
}

function expiryMs(lease = {}) {
  const value = Date.parse(lease.expiresAt || '');
  return Number.isFinite(value) ? value : 0;
}

function receiptSummary(receipt = {}) {
  return {
    tickId: receipt.tickId || receipt.id || null,
    receiptChecksum: receipt.receiptChecksum || receipt.checksum || null,
    status: receipt.status || null,
  };
}

export function acquireLocalAutopilotLease({
  rows = [],
  projectId,
  sessionId,
  idempotencyKey,
  dueAt,
  now,
  leaseSeconds = 60,
} = {}) {
  const currentRows = Array.isArray(rows) ? rows : [];
  const existing = currentRows.find((row) => row?.idempotencyKey === idempotencyKey) || null;
  if (existing?.status === 'acked') {
    return { action: 'already-acked', lease: existing, rows: currentRows };
  }
  const nowMs = Date.parse(now || '');
  if (existing?.status === 'leased' && expiryMs(existing) > nowMs) {
    return { action: 'lease-active', lease: existing, rows: currentRows };
  }

  const attemptCount = Math.max(0, Number(existing?.attemptCount) || 0) + 1;
  const leaseDurationMs = Math.max(1, Number(leaseSeconds) || 60) * 1000;
  const lease = {
    schemaVersion: 'local-autopilot-lease/v1',
    id: `local_autopilot_lease_${idempotencyKey}`,
    projectId,
    sessionId,
    idempotencyKey,
    dueAt,
    status: 'leased',
    attemptCount,
    fenceToken: `fence:${idempotencyKey}:${attemptCount}`,
    acquiredAt: now,
    expiresAt: new Date(nowMs + leaseDurationMs).toISOString(),
    acknowledgedAt: null,
    receipt: null,
  };
  return {
    action: existing ? 'recovered-expired-lease' : 'acquired',
    lease,
    rows: replaceLease(currentRows, lease),
  };
}

export function acknowledgeLocalAutopilotLease({
  rows = [],
  idempotencyKey,
  fenceToken,
  receipt,
  now,
} = {}) {
  const currentRows = Array.isArray(rows) ? rows : [];
  const lease = currentRows.find((row) => row?.idempotencyKey === idempotencyKey) || null;
  if (!lease || lease.status !== 'leased' || lease.fenceToken !== fenceToken) {
    return { acknowledged: false, lease, rows: currentRows };
  }
  const acknowledgedLease = {
    ...lease,
    status: 'acked',
    acknowledgedAt: now,
    expiresAt: now,
    receipt: receiptSummary(receipt),
  };
  return {
    acknowledged: true,
    lease: acknowledgedLease,
    rows: replaceLease(currentRows, acknowledgedLease),
  };
}
