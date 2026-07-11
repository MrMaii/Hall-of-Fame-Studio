import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function localRateLimitChecksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function seal(value) {
  const { checksum: _checksum, ...base } = value;
  return { ...base, checksum: localRateLimitChecksum(base) };
}

function exactDate(value, code) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(1, ms));
}

function normalizedLimits(limits = {}) {
  const number = (value) => Math.max(0, Math.min(1_000_000, Math.round(Number(value) || 0)));
  return {
    projectHourly: number(limits.projectHourly),
    actorHourly: number(limits.actorHourly),
    modelHourly: number(limits.modelHourly),
    toolHourly: number(limits.toolHourly),
    projectConcurrent: number(limits.projectConcurrent),
  };
}

function emptyLedger() {
  return seal({ schemaVersion: 'local-rate-limit-ledger/v1', revision: 0, entries: [] });
}

function verifyLedger(ledger = {}) {
  const { checksum, ...base } = ledger;
  return ledger.schemaVersion === 'local-rate-limit-ledger/v1'
    && checksum === localRateLimitChecksum(base)
    && Array.isArray(ledger.entries)
    && ledger.entries.every((entry) => {
      const { checksum: entryChecksum, ...entryBase } = entry;
      return entryChecksum === localRateLimitChecksum(entryBase);
    });
}

export function createLocalRateLimitLedger({
  filePath = null,
  lockTimeoutMs = 2_000,
  lockStaleMs = 30_000,
  claimTtlMs = 15 * 60 * 1000,
  maxEntries = 5_000,
} = {}) {
  const resolvedPath = filePath ? String(filePath) : null;
  const lockPath = resolvedPath ? `${resolvedPath}.lock` : null;
  let memoryLedger = emptyLedger();

  const readLedger = () => {
    if (!resolvedPath) return structuredClone(memoryLedger);
    if (!existsSync(resolvedPath)) return emptyLedger();
    let ledger;
    try {
      ledger = JSON.parse(readFileSync(resolvedPath, 'utf8'));
    } catch {
      throw new Error('local-rate-limit-ledger-invalid');
    }
    if (!verifyLedger(ledger)) throw new Error('local-rate-limit-ledger-integrity-invalid');
    return ledger;
  };

  const writeLedger = (ledger) => {
    if (!verifyLedger(ledger)) throw new Error('local-rate-limit-ledger-integrity-invalid');
    if (!resolvedPath) {
      memoryLedger = structuredClone(ledger);
      return;
    }
    mkdirSync(dirname(resolvedPath), { recursive: true });
    const tempPath = `${resolvedPath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(tempPath, JSON.stringify(ledger, null, 2), 'utf8');
    renameSync(tempPath, resolvedPath);
  };

  const acquireLock = () => {
    if (!resolvedPath) return null;
    mkdirSync(dirname(resolvedPath), { recursive: true });
    const deadline = Date.now() + Math.max(1, Number(lockTimeoutMs) || 1);
    const nonce = randomUUID();
    while (Date.now() <= deadline) {
      try {
        const fd = openSync(lockPath, 'wx');
        const lock = seal({ schemaVersion: 'local-rate-limit-lock/v1', pid: process.pid, nonce, acquiredAt: new Date().toISOString() });
        writeFileSync(fd, JSON.stringify(lock), 'utf8');
        return { fd, nonce };
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        let existing = null;
        try { existing = JSON.parse(readFileSync(lockPath, 'utf8')); } catch { /* bounded wait */ }
        const acquiredMs = Date.parse(existing?.acquiredAt || '');
        const stale = Number.isFinite(acquiredMs) && Date.now() - acquiredMs > Math.max(1, Number(lockStaleMs) || 1);
        if (stale && !pidAlive(Number(existing?.pid))) {
          try { unlinkSync(lockPath); } catch (unlinkError) { if (unlinkError?.code !== 'ENOENT') throw unlinkError; }
          continue;
        }
        sleepSync(Math.min(10, Math.max(1, deadline - Date.now())));
      }
    }
    throw new Error('local-rate-limit-lock-timeout');
  };

  const releaseLock = (lock) => {
    if (!lockPath || !lock) return;
    try { closeSync(lock.fd); } catch { /* already closed */ }
    let existing = null;
    try { existing = JSON.parse(readFileSync(lockPath, 'utf8')); } catch { /* fail below */ }
    if (existing?.nonce !== lock.nonce) throw new Error('local-rate-limit-lock-ownership-lost');
    unlinkSync(lockPath);
  };

  const transact = (mutate) => {
    const lock = acquireLock();
    try {
      const current = readLedger();
      const result = mutate(current);
      if (result.ledger) writeLedger(result.ledger);
      return result.value;
    } finally {
      releaseLock(lock);
    }
  };

  return {
    claim({ projectId, actorId = 'local-runtime', provider = 'unknown', model = '', tool = '', idempotencyKey, limits = {}, now = new Date().toISOString(), ttlMs = claimTtlMs } = {}) {
      const normalizedProjectId = String(projectId || '').trim();
      const normalizedKey = String(idempotencyKey || '').trim();
      if (!normalizedProjectId || !normalizedKey) throw new Error('local-rate-limit-claim-identity-required');
      const nowAt = exactDate(now, 'local-rate-limit-now-invalid');
      const nowMs = Date.parse(nowAt);
      const normalized = normalizedLimits(limits);
      const dimensions = {
        projectId: normalizedProjectId,
        actorHash: localRateLimitChecksum(String(actorId || 'local-runtime')),
        provider: String(provider || 'unknown'),
        model: String(model || ''),
        tool: String(tool || ''),
      };
      const intentChecksum = localRateLimitChecksum({ dimensions, idempotencyKeyHash: localRateLimitChecksum(normalizedKey), limits: normalized });
      return transact((ledger) => {
        const existing = ledger.entries.find((entry) => entry.idempotencyKeyHash === localRateLimitChecksum(normalizedKey));
        if (existing) {
          if (existing.intentChecksum !== intentChecksum) throw new Error('local-rate-limit-idempotency-conflict');
          return { value: { allowed: existing.status === 'active', action: 'existing', claim: existing, reason: existing.denialReason || null }, ledger: null };
        }
        const hourStart = nowMs - 60 * 60 * 1000;
        const hourly = ledger.entries.filter((entry) => Date.parse(entry.createdAt) >= hourStart && (entry.status === 'active' || entry.counted));
        const active = ledger.entries.filter((entry) => entry.status === 'active' && Date.parse(entry.expiresAt) > nowMs);
        const checks = [
          ['project-hourly', normalized.projectHourly, hourly.filter((entry) => entry.projectId === dimensions.projectId).length],
          ['actor-hourly', normalized.actorHourly, hourly.filter((entry) => entry.projectId === dimensions.projectId && entry.actorHash === dimensions.actorHash).length],
          ['model-hourly', normalized.modelHourly, hourly.filter((entry) => entry.projectId === dimensions.projectId && entry.model === dimensions.model).length],
          ['tool-hourly', normalized.toolHourly, hourly.filter((entry) => entry.projectId === dimensions.projectId && entry.tool === dimensions.tool).length],
          ['project-concurrent', normalized.projectConcurrent, active.filter((entry) => entry.projectId === dimensions.projectId).length],
        ];
        const denied = checks.find(([, limit, used]) => limit > 0 && used >= limit);
        if (denied) return { value: { allowed: false, action: 'denied', claim: null, reason: `local-rate-limit-${denied[0]}-exceeded`, dimension: denied[0], limit: denied[1], used: denied[2] }, ledger: null };
        const entry = seal({
          schemaVersion: 'local-rate-limit-claim/v1',
          id: `rate_claim_${localRateLimitChecksum(normalizedKey).slice(0, 32)}`,
          idempotencyKeyHash: localRateLimitChecksum(normalizedKey), intentChecksum, ...dimensions,
          limits: normalized, status: 'active', counted: false, denialReason: null,
          createdAt: nowAt, expiresAt: new Date(nowMs + Math.max(1, Number(ttlMs) || claimTtlMs)).toISOString(),
          resolvedAt: null, outcome: null, storesBusinessContent: false,
        });
        const next = seal({ schemaVersion: 'local-rate-limit-ledger/v1', revision: ledger.revision + 1, entries: [entry, ...ledger.entries].slice(0, Math.max(100, Number(maxEntries) || 5_000)) });
        return { value: { allowed: true, action: 'claimed', claim: entry, reason: null }, ledger: next };
      });
    },

    resolve({ claimId, outcome = 'settled', counted = true, now = new Date().toISOString() } = {}) {
      const nowAt = exactDate(now, 'local-rate-limit-now-invalid');
      return transact((ledger) => {
        const entry = ledger.entries.find((row) => row.id === claimId);
        if (!entry) throw new Error('local-rate-limit-claim-not-found');
        if (entry.status !== 'active') return { value: { action: 'already-resolved', claim: entry }, ledger: null };
        const resolved = seal({ ...entry, status: 'resolved', counted: Boolean(counted), resolvedAt: nowAt, outcome: String(outcome || 'settled'), checksum: undefined });
        const next = seal({ schemaVersion: 'local-rate-limit-ledger/v1', revision: ledger.revision + 1, entries: [resolved, ...ledger.entries.filter((row) => row.id !== entry.id)] });
        return { value: { action: 'resolved', claim: resolved }, ledger: next };
      });
    },

    snapshot({ now = new Date().toISOString() } = {}) {
      const nowAt = exactDate(now, 'local-rate-limit-now-invalid');
      const ledger = readLedger();
      const nowMs = Date.parse(nowAt);
      const base = {
        schemaVersion: 'local-rate-limit-snapshot/v1', generatedAt: nowAt, revision: ledger.revision,
        entryCount: ledger.entries.length,
        activeCount: ledger.entries.filter((entry) => entry.status === 'active' && Date.parse(entry.expiresAt) > nowMs).length,
        expiredActiveCount: ledger.entries.filter((entry) => entry.status === 'active' && Date.parse(entry.expiresAt) <= nowMs).length,
        entries: ledger.entries,
        processSafeOnSingleHost: Boolean(resolvedPath), distributedSafe: false,
      };
      return { ...base, checksum: localRateLimitChecksum(base) };
    },
  };
}
