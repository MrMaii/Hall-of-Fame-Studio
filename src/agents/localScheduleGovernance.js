import { createHash } from 'node:crypto';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function localScheduleChecksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function exactIso(value, code) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

export function evaluateLocalIntervalSchedule({
  lane,
  now = new Date().toISOString(),
  intervalMs,
  lastCompletedAt = null,
  storedNextAt = null,
  initialAt = null,
  enabled = true,
  forceDue = false,
  reasons = {},
} = {}) {
  const normalizedLane = String(lane || '').trim();
  if (!normalizedLane) throw new Error('local-schedule-lane-required');
  const normalizedIntervalMs = Math.round(Number(intervalMs));
  if (!Number.isFinite(normalizedIntervalMs) || normalizedIntervalMs < 1 || normalizedIntervalMs > 7 * 24 * 60 * 60 * 1000) {
    throw new Error('local-schedule-interval-invalid');
  }
  const nowAt = exactIso(now, 'local-schedule-now-invalid');
  const lastAt = lastCompletedAt ? exactIso(lastCompletedAt, 'local-schedule-last-completed-invalid') : null;
  const nextAt = storedNextAt ? exactIso(storedNextAt, 'local-schedule-next-run-invalid') : null;
  const anchorAt = initialAt ? exactIso(initialAt, 'local-schedule-initial-anchor-invalid') : nowAt;
  const nowMs = Date.parse(nowAt);
  const lastMs = lastAt ? Date.parse(lastAt) : null;
  const scheduledAt = nextAt || (lastAt ? new Date(lastMs + normalizedIntervalMs).toISOString() : anchorAt);
  const scheduledMs = Date.parse(scheduledAt);
  const clockRegressionDetected = lastMs !== null && lastMs > nowMs + normalizedIntervalMs;
  const missedIntervals = !clockRegressionDetected && nowMs > scheduledMs
    ? Math.floor((nowMs - scheduledMs) / normalizedIntervalMs)
    : 0;
  const due = Boolean(enabled) && (Boolean(forceDue) || clockRegressionDetected || nowMs >= scheduledMs);
  const first = !lastAt && !nextAt;
  const reason = !enabled
    ? (reasons.disabled || `${normalizedLane}-disabled`)
    : forceDue
      ? (reasons.forced || `${normalizedLane}-forced`)
      : clockRegressionDetected
        ? (reasons.clockRegression || `${normalizedLane}-clock-regression-recovery`)
        : missedIntervals > 0
          ? (reasons.missed || `${normalizedLane}-missed-cadence-recovery`)
          : first && due
            ? (reasons.first || `${normalizedLane}-first-run`)
            : due
              ? (reasons.due || `${normalizedLane}-due`)
              : (reasons.waiting || `${normalizedLane}-waiting`);
  const dueAt = forceDue || clockRegressionDetected ? nowAt : scheduledAt;
  const idempotencySlotAt = forceDue ? nowAt : clockRegressionDetected ? lastAt : scheduledAt;
  const base = {
    schemaVersion: 'local-interval-schedule/v1',
    lane: normalizedLane,
    enabled: Boolean(enabled),
    due,
    reason,
    now: nowAt,
    intervalMs: normalizedIntervalMs,
    lastCompletedAt: lastAt,
    scheduledAt,
    dueAt,
    nextRunAt: due ? nowAt : scheduledAt,
    idempotencySlotAt,
    idempotencyReason: forceDue ? reason : `${normalizedLane}-scheduled-slot`,
    clockRegressionDetected,
    missedIntervals,
    coalescedRunCount: due ? 1 : 0,
    suppressedCatchUpCount: due ? missedIntervals : 0,
    timeBasis: 'utc-epoch-interval',
    timeZone: 'UTC',
    dstSensitive: false,
    misfirePolicy: 'coalesce-one',
    storesBusinessContent: false,
  };
  return { ...base, checksum: localScheduleChecksum(base) };
}
