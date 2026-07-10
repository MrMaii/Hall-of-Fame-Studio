import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { redactSensitiveText } from './secretRedaction.js';
import { replaceFileWithRetry } from './atomicFileReplace.js';

const DEFAULT_MAX_RECORDS = 500;
const DEFAULT_MAX_FILE_BYTES = 1_000_000;

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readRecords(filePath, maxRecords) {
  if (!filePath || !existsSync(filePath)) return [];
  try {
    return readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((record) => record?.schemaVersion === 'local-runtime-telemetry-event/v1')
      .slice(-maxRecords);
  } catch {
    return [];
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
    p50DurationMs: percentile(durations, 0.5),
    p95DurationMs: percentile(durations, 0.95),
    latestAt: records.at(-1)?.occurredAt || null,
  };
}

export function createLocalTelemetryPort({
  filePath = null,
  maxRecords = DEFAULT_MAX_RECORDS,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  now = () => new Date().toISOString(),
} = {}) {
  const recordLimit = Math.floor(positiveNumber(maxRecords, DEFAULT_MAX_RECORDS));
  const fileLimit = Math.floor(positiveNumber(maxFileBytes, DEFAULT_MAX_FILE_BYTES));
  let records = readRecords(filePath, recordLimit);

  const persist = (record) => {
    if (!filePath) return;
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, `${JSON.stringify(record)}\n`);
    if (statSync(filePath).size <= fileLimit) return;
    const compacted = records.slice(-recordLimit).map((item) => JSON.stringify(item)).join('\n');
    const tempPath = `${filePath}.tmp`;
    writeFileSync(tempPath, compacted ? `${compacted}\n` : '', 'utf8');
    replaceFileWithRetry(tempPath, filePath);
  };

  return {
    recordHttpRequest({ traceId = '', method = 'GET', path = '/', statusCode = 0, durationMs = 0 } = {}) {
      const record = {
        schemaVersion: 'local-runtime-telemetry-event/v1',
        type: 'http-request',
        occurredAt: now(),
        traceId: redactSensitiveText(String(traceId || '')).slice(0, 160) || null,
        method: String(method || 'GET').toUpperCase().slice(0, 12),
        path: redactPath(path),
        statusCode: Math.max(0, Math.floor(Number(statusCode) || 0)),
        durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
      };
      records = [...records, record].slice(-recordLimit);
      try {
        persist(record);
      } catch {
        // Telemetry must never fail a local request.
      }
      return record;
    },
    status({ limit = 40 } = {}) {
      const count = Math.max(1, Math.min(recordLimit, Math.floor(Number(limit) || 40)));
      return {
        schemaVersion: 'local-runtime-observability/v1',
        enabled: true,
        storage: filePath ? 'local-jsonl' : 'memory',
        filePath: filePath || null,
        maxRecords: recordLimit,
        maxFileBytes: fileLimit,
        summary: summary(records),
        recent: records.slice(-count),
        readyForProduction: false,
        productionBlockers: ['centralized log retention', 'distributed traces', 'managed alert routing and on-call ownership'],
      };
    },
  };
}
