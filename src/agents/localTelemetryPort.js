import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { redactSensitiveText } from './secretRedaction.js';
import { replaceFileWithRetry } from './atomicFileReplace.js';

const DEFAULT_MAX_RECORDS = 500;
const DEFAULT_MAX_FILE_BYTES = 1_000_000;
const DEFAULT_MAX_SNAPSHOTS = 120;
const DEFAULT_MAX_ERROR_ISSUES = 100;
const TELEMETRY_EVENT_SCHEMA = 'local-runtime-telemetry-event/v1';
const SLO_SNAPSHOT_SCHEMA = 'local-runtime-slo-snapshot/v1';
const ERROR_ISSUE_SCHEMA = 'local-runtime-error-issue/v1';

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readTelemetryFile(filePath, maxRecords, maxSnapshots) {
  if (!filePath || !existsSync(filePath)) return { events: [], snapshots: [], errorIssueRecords: [] };
  try {
    const parsed = readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
    return {
      events: parsed.filter((record) => record?.schemaVersion === TELEMETRY_EVENT_SCHEMA).slice(-maxRecords),
      snapshots: parsed.filter((record) => record?.schemaVersion === SLO_SNAPSHOT_SCHEMA).slice(-maxSnapshots),
      errorIssueRecords: parsed.filter((record) => record?.schemaVersion === ERROR_ISSUE_SCHEMA),
    };
  } catch {
    return { events: [], snapshots: [], errorIssueRecords: [] };
  }
}

function redactPath(path = '/') {
  const pathname = String(path || '/').split('?')[0].trim() || '/';
  return redactSensitiveText(pathname).slice(0, 240);
}

function percentile(values = [], ratio = 0.5) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

function summary(records = []) {
  const durations = records.map((record) => Number(record.durationMs) || 0);
  const serverErrorCount = records.filter((record) => Number(record.statusCode) >= 500).length;
  const clientErrorCount = records.filter((record) => Number(record.statusCode) >= 400 && Number(record.statusCode) < 500).length;
  return {
    requestCount: records.length,
    serverErrorCount,
    clientErrorCount,
    successCount: records.filter((record) => Number(record.statusCode) < 400).length,
    serverErrorRate: records.length ? serverErrorCount / records.length : 0,
    p50DurationMs: percentile(durations, 0.5),
    p95DurationMs: percentile(durations, 0.95),
    latestAt: records.at(-1)?.occurredAt || null,
  };
}

function normalizeSloPolicy(policy = {}) {
  const warningP95DurationMs = positiveNumber(policy.warningP95DurationMs, 2000);
  const windowSize = Math.floor(positiveNumber(policy.windowSize, 20));
  return {
    schemaVersion: 'local-runtime-slo-policy/v1',
    windowSize,
    snapshotEveryRequests: Math.floor(positiveNumber(policy.snapshotEveryRequests, 20)),
    minSamples: Math.min(windowSize, Math.floor(positiveNumber(policy.minSamples, 10))),
    warningP95DurationMs,
    criticalP95DurationMs: Math.max(warningP95DurationMs, positiveNumber(policy.criticalP95DurationMs, 10000)),
    maxServerErrorRate: Math.max(0, Math.min(1, Number.isFinite(Number(policy.maxServerErrorRate))
      ? Number(policy.maxServerErrorRate)
      : 0.1)),
    consecutiveBreachWindows: Math.floor(positiveNumber(policy.consecutiveBreachWindows, 2)),
    maxSnapshots: Math.floor(positiveNumber(policy.maxSnapshots, DEFAULT_MAX_SNAPSHOTS)),
  };
}

function evaluateSloWindow(records = [], policy = {}) {
  const metrics = summary(records);
  const breaches = [];
  let status = 'healthy';
  if (metrics.requestCount < policy.minSamples) {
    status = 'insufficient-data';
  } else {
    const criticalErrorRate = Math.min(1, policy.maxServerErrorRate * 2);
    if (metrics.p95DurationMs >= policy.criticalP95DurationMs) breaches.push('critical-p95-latency');
    if (metrics.serverErrorRate >= criticalErrorRate && metrics.serverErrorCount > 0) breaches.push('critical-server-error-rate');
    if (breaches.length) {
      status = 'critical';
    } else {
      if (metrics.p95DurationMs >= policy.warningP95DurationMs) breaches.push('warning-p95-latency');
      if (metrics.serverErrorRate >= policy.maxServerErrorRate && metrics.serverErrorCount > 0) breaches.push('warning-server-error-rate');
      if (breaches.length) status = 'warning';
    }
  }
  return {
    status,
    breaches,
    summary: metrics,
    windowStartedAt: records[0]?.occurredAt || null,
    windowEndedAt: records.at(-1)?.occurredAt || null,
  };
}

function consecutiveBreachCount(snapshots = []) {
  let count = 0;
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    if (!['warning', 'critical'].includes(snapshots[index]?.status)) break;
    count += 1;
  }
  return count;
}

function buildSloAlert(snapshots = [], policy = {}) {
  const latest = snapshots.at(-1) || null;
  const consecutiveBreachWindows = consecutiveBreachCount(snapshots);
  const severity = latest?.status || 'insufficient-data';
  const active = severity === 'critical'
    || (severity === 'warning' && consecutiveBreachWindows >= policy.consecutiveBreachWindows);
  const reason = severity === 'critical'
    ? 'critical-window'
    : severity === 'warning'
      ? active ? 'sustained-warning-windows' : 'transient-warning-window'
      : severity === 'healthy' ? 'within-local-slo' : 'insufficient-data';
  const recommendation = severity === 'critical'
    ? 'Pause autonomous work and inspect slow routes and server errors before retrying.'
    : active
      ? 'Inspect slow routes before continuing autonomous work; retry only after a healthy window.'
      : severity === 'warning'
        ? 'Observe the next SLO window before intervening; this may be transient local load.'
        : severity === 'healthy'
          ? 'No local latency intervention is required.'
          : 'Collect more local requests before evaluating the SLO.';
  return {
    schemaVersion: 'local-runtime-slo-alert/v1',
    active,
    severity,
    reason,
    consecutiveBreachWindows,
    requiredConsecutiveBreachWindows: policy.consecutiveBreachWindows,
    latestSnapshotId: latest?.id || null,
    recommendation,
  };
}

function normalizeErrorCode(value = '') {
  return String(value || 'UNHANDLED_RUNTIME_ERROR')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '_')
    .slice(0, 80) || 'UNHANDLED_RUNTIME_ERROR';
}

function normalizeErrorCategory(value = '') {
  return String(value || 'unhandled-http-error')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .slice(0, 80) || 'unhandled-http-error';
}

function errorRunbook(errorCode = '', category = '') {
  const signal = `${errorCode} ${category}`.toLowerCase();
  if (/worker|lease|scheduler|queue/.test(signal)) {
    return {
      id: 'local-worker-recovery',
      path: 'docs/LOCAL_RUNTIME_OBSERVABILITY.md',
      steps: [
        { action: 'inspect-runtime-health', route: '/local-runtime-health' },
        { action: 'inspect-scheduler-status', route: '/workers/autonomous/status' },
        { action: 'run-supervised-recovery-tick', route: '/workers/autonomous/tick' },
      ],
    };
  }
  if (/provider|model|search/.test(signal)) {
    return {
      id: 'local-provider-recovery',
      path: 'docs/LOCAL_PROVIDER_TRANSPORT_RELIABILITY.md',
      steps: [
        { action: 'inspect-runtime-health', route: '/local-runtime-health' },
        { action: 'inspect-provider-status', route: '/runtime-observability' },
      ],
    };
  }
  if (/audit|auth|access|identity/.test(signal)) {
    return {
      id: 'local-security-recovery',
      path: 'docs/LOCAL_AUTH.md',
      steps: [
        { action: 'inspect-runtime-health', route: '/local-runtime-health' },
        { action: 'inspect-security-audit', route: '/security-audit-stream' },
      ],
    };
  }
  return {
    id: 'local-runtime-error-recovery',
    path: 'docs/LOCAL_RUNTIME_OBSERVABILITY.md',
    steps: [
      { action: 'inspect-runtime-health', route: '/local-runtime-health' },
      { action: 'correlate-trace', route: '/runtime-observability' },
    ],
  };
}

function restoreErrorIssues(records = [], limit = DEFAULT_MAX_ERROR_ISSUES) {
  const byFingerprint = new Map();
  records.forEach((record) => {
    if (record?.fingerprint) byFingerprint.set(record.fingerprint, record);
  });
  return new Map([...byFingerprint.values()]
    .sort((left, right) => (Date.parse(right.updatedAt || right.lastSeenAt || '') || 0)
      - (Date.parse(left.updatedAt || left.lastSeenAt || '') || 0))
    .slice(0, limit)
    .map((record) => [record.fingerprint, record]));
}

function errorRegistryStatus(errorIssues = new Map()) {
  const issues = [...errorIssues.values()]
    .sort((left, right) => (Date.parse(right.lastSeenAt || right.updatedAt || '') || 0)
      - (Date.parse(left.lastSeenAt || left.updatedAt || '') || 0));
  const openCount = issues.filter((issue) => issue.status === 'open').length;
  const acknowledgedCount = issues.filter((issue) => issue.status === 'acknowledged').length;
  const resolvedCount = issues.filter((issue) => issue.status === 'resolved').length;
  return {
    schemaVersion: 'local-runtime-error-registry/v1',
    issues,
    summary: {
      issueCount: issues.length,
      openCount,
      acknowledgedCount,
      resolvedCount,
      activeCount: openCount + acknowledgedCount,
      totalOccurrenceCount: issues.reduce((sum, issue) => sum + (Number(issue.count) || 0), 0),
      latestAt: issues[0]?.lastSeenAt || null,
    },
    routes: {
      list: '/runtime-errors',
      acknowledge: '/runtime-errors/:fingerprint/acknowledge',
      resolve: '/runtime-errors/:fingerprint/resolve',
    },
  };
}

export function createLocalTelemetryPort({
  filePath = null,
  maxRecords = DEFAULT_MAX_RECORDS,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  sloPolicy = {},
  maxErrorIssues = DEFAULT_MAX_ERROR_ISSUES,
  now = () => new Date().toISOString(),
} = {}) {
  const recordLimit = Math.floor(positiveNumber(maxRecords, DEFAULT_MAX_RECORDS));
  const fileLimit = Math.floor(positiveNumber(maxFileBytes, DEFAULT_MAX_FILE_BYTES));
  const policy = normalizeSloPolicy(sloPolicy);
  const errorIssueLimit = Math.floor(positiveNumber(maxErrorIssues, DEFAULT_MAX_ERROR_ISSUES));
  const restored = readTelemetryFile(filePath, recordLimit, policy.maxSnapshots);
  let records = restored.events;
  let snapshots = restored.snapshots;
  let errorIssues = restoreErrorIssues(restored.errorIssueRecords, errorIssueLimit);
  let requestSequence = Math.max(
    records.length,
    ...records.map((record) => Number(record.requestSequence) || 0),
    ...snapshots.map((snapshot) => Number(snapshot.requestSequence) || 0),
  );

  const persist = (record) => {
    if (!filePath) return;
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, `${JSON.stringify(record)}\n`);
    if (statSync(filePath).size <= fileLimit) return;
    const retained = [
      ...records.slice(-recordLimit),
      ...snapshots.slice(-policy.maxSnapshots),
      ...errorIssues.values(),
    ].sort((left, right) => {
      const sequenceDifference = (Number(left.requestSequence) || 0) - (Number(right.requestSequence) || 0);
      if (sequenceDifference) return sequenceDifference;
      return left.schemaVersion === TELEMETRY_EVENT_SCHEMA ? -1 : 1;
    });
    const compacted = retained.map((item) => JSON.stringify(item)).join('\n');
    const tempPath = `${filePath}.tmp`;
    writeFileSync(tempPath, compacted ? `${compacted}\n` : '', 'utf8');
    replaceFileWithRetry(tempPath, filePath);
  };

  const maybeCaptureSloSnapshot = () => {
    if (requestSequence % policy.snapshotEveryRequests !== 0) return null;
    const windowRecords = records.slice(-policy.windowSize);
    const evaluation = evaluateSloWindow(windowRecords, policy);
    const capturedAt = now();
    const snapshot = {
      schemaVersion: SLO_SNAPSHOT_SCHEMA,
      id: `local_slo_${requestSequence}_${Date.parse(capturedAt) || requestSequence}`,
      capturedAt,
      requestSequence,
      status: evaluation.status,
      breaches: evaluation.breaches,
      windowStartedAt: evaluation.windowStartedAt,
      windowEndedAt: evaluation.windowEndedAt,
      summary: evaluation.summary,
    };
    snapshots = [...snapshots, snapshot].slice(-policy.maxSnapshots);
    try {
      persist(snapshot);
    } catch {
      // Telemetry must never fail a local request.
    }
    return snapshot;
  };

  const persistErrorIssue = (issue) => {
    errorIssues.set(issue.fingerprint, issue);
    if (errorIssues.size > errorIssueLimit) {
      errorIssues = restoreErrorIssues([...errorIssues.values()], errorIssueLimit);
    }
    try {
      persist(issue);
    } catch {
      // Error reporting must never fail a local request.
    }
    return issue;
  };

  return {
    recordHttpRequest({ traceId = '', spanId = null, parentSpanId = null, method = 'GET', path = '/', statusCode = 0, durationMs = 0 } = {}) {
      requestSequence += 1;
      const record = {
        schemaVersion: TELEMETRY_EVENT_SCHEMA,
        type: 'http-request',
        occurredAt: now(),
        traceId: redactSensitiveText(String(traceId || '')).slice(0, 160) || null,
        spanId: /^span_[a-f0-9]{32}$/.test(String(spanId || '')) ? spanId : null,
        parentSpanId: /^span_[a-f0-9]{32}$/.test(String(parentSpanId || '')) ? parentSpanId : null,
        method: String(method || 'GET').toUpperCase().slice(0, 12),
        path: redactPath(path),
        statusCode: Math.max(0, Math.floor(Number(statusCode) || 0)),
        durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
        requestSequence,
      };
      records = [...records, record].slice(-recordLimit);
      try {
        persist(record);
      } catch {
        // Telemetry must never fail a local request.
      }
      maybeCaptureSloSnapshot();
      return record;
    },
    recordRuntimeError({
      traceId = '',
      method = 'GET',
      path = '/',
      category = 'unhandled-http-error',
      errorCode = 'UNHANDLED_RUNTIME_ERROR',
      severity = 'critical',
    } = {}) {
      const normalizedCategory = normalizeErrorCategory(category);
      const normalizedCode = normalizeErrorCode(errorCode);
      const normalizedMethod = String(method || 'GET').toUpperCase().slice(0, 12);
      const normalizedPath = redactPath(path);
      const fingerprint = createHash('sha256')
        .update(`${normalizedCategory}|${normalizedCode}|${normalizedMethod}|${normalizedPath}`)
        .digest('hex');
      const occurredAt = now();
      const existing = errorIssues.get(fingerprint) || null;
      const recurred = existing?.status === 'resolved';
      const transitions = existing?.transitions || [];
      const issue = {
        schemaVersion: ERROR_ISSUE_SCHEMA,
        fingerprint,
        category: normalizedCategory,
        errorCode: normalizedCode,
        severity: ['warning', 'error', 'critical'].includes(String(severity).toLowerCase())
          ? String(severity).toLowerCase()
          : 'critical',
        method: normalizedMethod,
        path: normalizedPath,
        status: 'open',
        count: (Number(existing?.count) || 0) + 1,
        reopenedCount: (Number(existing?.reopenedCount) || 0) + (recurred ? 1 : 0),
        firstSeenAt: existing?.firstSeenAt || occurredAt,
        lastSeenAt: occurredAt,
        updatedAt: occurredAt,
        latestTraceId: redactSensitiveText(String(traceId || '')).slice(0, 160) || null,
        updatedBy: recurred ? 'runtime-recurrence' : existing?.updatedBy || 'runtime',
        acknowledgedAt: recurred ? null : existing?.acknowledgedAt || null,
        resolvedAt: null,
        lastResolvedAt: recurred ? existing?.resolvedAt || existing?.lastResolvedAt || null : existing?.lastResolvedAt || null,
        note: recurred ? 'Issue reopened after a new matching occurrence.' : existing?.note || null,
        runbook: errorRunbook(normalizedCode, normalizedCategory),
        transitions: (!existing
          ? [{ action: 'open', at: occurredAt, actorId: 'runtime', note: null }]
          : recurred
            ? [...transitions, { action: 'reopen', at: occurredAt, actorId: 'runtime-recurrence', note: null }]
            : transitions).slice(-20),
      };
      return persistErrorIssue(issue);
    },
    updateRuntimeErrorIssue({ fingerprint = '', action = '', actorId = '', note = '' } = {}) {
      const existing = errorIssues.get(String(fingerprint || '').trim()) || null;
      if (!existing) return null;
      const normalizedAction = String(action || '').trim().toLowerCase();
      if (!['acknowledge', 'resolve'].includes(normalizedAction)) {
        throw new Error(`Unsupported runtime error action: ${normalizedAction || 'missing'}`);
      }
      const updatedAt = now();
      const safeActorId = redactSensitiveText(String(actorId || 'local-security-admin')).slice(0, 120);
      const safeNote = redactSensitiveText(String(note || '')).slice(0, 240) || null;
      const issue = {
        ...existing,
        status: normalizedAction === 'resolve' ? 'resolved' : 'acknowledged',
        updatedAt,
        updatedBy: safeActorId,
        note: safeNote,
        acknowledgedAt: normalizedAction === 'acknowledge' ? updatedAt : existing.acknowledgedAt || null,
        resolvedAt: normalizedAction === 'resolve' ? updatedAt : null,
        transitions: [
          ...(existing.transitions || []),
          { action: normalizedAction, at: updatedAt, actorId: safeActorId, note: safeNote },
        ].slice(-20),
      };
      return persistErrorIssue(issue);
    },
    status({ limit = 40 } = {}) {
      const count = Math.max(1, Math.min(recordLimit, Math.floor(Number(limit) || 40)));
      const currentEvaluation = evaluateSloWindow(records.slice(-policy.windowSize), policy);
      return {
        schemaVersion: 'local-runtime-observability/v1',
        enabled: true,
        storage: filePath ? 'local-jsonl' : 'memory',
        filePath: filePath || null,
        maxRecords: recordLimit,
        maxFileBytes: fileLimit,
        summary: summary(records),
        recent: records.slice(-count),
        slo: {
          schemaVersion: 'local-runtime-slo-status/v1',
          policy,
          current: currentEvaluation,
          alert: buildSloAlert(snapshots, policy),
          trends: snapshots.slice(-policy.maxSnapshots),
        },
        errors: errorRegistryStatus(errorIssues),
        readyForProduction: false,
        productionBlockers: ['centralized log retention', 'distributed traces', 'managed alert routing and on-call ownership'],
      };
    },
  };
}
