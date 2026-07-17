import { cpus, freemem, platform, release, totalmem } from 'node:os';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const storePath = resolve(process.env.AGENT_PROJECT_STORE || '.tmp/agent-project-store.json');
const outputPath = resolve(process.argv[2] || 'docs/local-performance-baseline.json');
const runtimeStatusPath = resolve(process.env.AGENT_LOCAL_RUNTIME_STATUS_FILE || '.tmp/local-runtime-status.json');

async function resolveHealthUrl() {
  if (process.env.HOF_HEALTH_URL) return process.env.HOF_HEALTH_URL;
  try {
    const runtimeStatus = JSON.parse(await readFile(runtimeStatusPath, 'utf8'));
    if (runtimeStatus?.backend?.status === 'running' && runtimeStatus?.urls?.backend) {
      return `${runtimeStatus.urls.backend.replace(/\/$/, '')}/health`;
    }
  } catch {
    // A missing or stale runtime status falls back to the documented default port.
  }
  return 'http://127.0.0.1:8787/health';
}

const healthUrl = await resolveHealthUrl();

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)].toFixed(2));
}

async function measureHealth() {
  const durations = [];
  let status = null;
  let error = null;
  for (let index = 0; index < 12; index += 1) {
    const startedAt = performance.now();
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
      status = response.status;
      await response.arrayBuffer();
      durations.push(performance.now() - startedAt);
    } catch (requestError) {
      error = requestError.message || String(requestError);
      break;
    }
  }
  return { url: healthUrl, status, samples: durations.length, p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95), error };
}

const storeInfo = await stat(storePath);
const cpuStartedAt = process.cpuUsage();
const readStartedAt = performance.now();
const raw = await readFile(storePath, 'utf8');
const readMs = performance.now() - readStartedAt;
const parseStartedAt = performance.now();
const parsed = JSON.parse(raw);
const parseMs = performance.now() - parseStartedAt;
const cpuUsed = process.cpuUsage(cpuStartedAt);
const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
const report = {
  schemaVersion: 'local-performance-baseline/v1',
  measuredAt: new Date().toISOString(),
  environment: {
    platform: platform(),
    osRelease: release(),
    node: process.versions.node,
    logicalCpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    freeMemoryBytes: freemem(),
  },
  localStore: {
    path: storePath,
    bytes: storeInfo.size,
    projectCount: projects.length,
    messageCount: messages.length,
    readMs: Number(readMs.toFixed(2)),
    parseMs: Number(parseMs.toFixed(2)),
    heapUsedBytesAfterParse: process.memoryUsage().heapUsed,
    cpuUserMs: Number((cpuUsed.user / 1_000).toFixed(2)),
    cpuSystemMs: Number((cpuUsed.system / 1_000).toFixed(2)),
  },
  health: await measureHealth(),
  budgets: {
    healthP95Ms: 250,
    storeReadAndParseMs: 2_000,
    heapUsedBytesAfterParse: 512 * 1024 * 1024,
    result: 'pending-evaluation',
  },
};
report.budgets.result = (
  report.health.error === null
  && report.health.status === 200
  && report.health.p95Ms <= report.budgets.healthP95Ms
  && report.localStore.readMs + report.localStore.parseMs <= report.budgets.storeReadAndParseMs
  && report.localStore.heapUsedBytesAfterParse <= report.budgets.heapUsedBytesAfterParse
) ? 'pass' : 'fail';

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
