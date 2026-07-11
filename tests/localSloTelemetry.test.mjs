import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalTelemetryPort } from '../src/agents/localTelemetryPort.js';

function recordWindow(telemetry, { durationMs, statusCode = 200, start = 0 } = {}) {
  for (let index = 0; index < 3; index += 1) {
    telemetry.recordHttpRequest({
      traceId: `trace_slo_${start + index}`,
      method: 'GET',
      path: `/projects/local-slo?token=never-persist-${start + index}`,
      statusCode,
      durationMs,
    });
  }
}

test('persists sustained local SLO alerts and health degradation across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-slo-'));
  const telemetryPath = join(directory, 'telemetry.jsonl');
  let clock = Date.parse('2026-07-10T23:00:00.000Z');
  const telemetry = createLocalTelemetryPort({
    filePath: telemetryPath,
    maxRecords: 30,
    now: () => new Date(clock += 1000).toISOString(),
    sloPolicy: {
      windowSize: 3,
      snapshotEveryRequests: 3,
      minSamples: 3,
      warningP95DurationMs: 100,
      criticalP95DurationMs: 500,
      maxServerErrorRate: 0.2,
      consecutiveBreachWindows: 2,
      maxSnapshots: 8,
    },
  });

  let firstRuntime = null;
  let restartedRuntime = null;
  try {
    recordWindow(telemetry, { durationMs: 250, start: 1 });
    let status = telemetry.status();
    assert.equal(status.slo.schemaVersion, 'local-runtime-slo-status/v1');
    assert.equal(status.slo.current.status, 'warning');
    assert.equal(status.slo.alert.active, false);
    assert.equal(status.slo.alert.reason, 'transient-warning-window');
    assert.equal(status.slo.alert.consecutiveBreachWindows, 1);
    assert.equal(status.slo.trends.length, 1);

    recordWindow(telemetry, { durationMs: 250, start: 4 });
    status = telemetry.status();
    assert.equal(status.slo.alert.active, true);
    assert.equal(status.slo.alert.severity, 'warning');
    assert.equal(status.slo.alert.reason, 'sustained-warning-windows');
    assert.equal(status.slo.alert.consecutiveBreachWindows, 2);
    assert.match(status.slo.alert.recommendation, /inspect slow routes/i);
    assert.equal(status.slo.trends.length, 2);
    assert.equal(readFileSync(telemetryPath, 'utf8').includes('never-persist'), false);

    firstRuntime = createAgentProjectHttpServer({
      filePath: join(directory, 'projects.json'),
      telemetry,
    });
    const firstListener = await firstRuntime.listen();
    const observability = await fetch(`${firstListener.url}/runtime-observability`);
    assert.equal(observability.status, 200);
    const observabilityBody = await observability.json();
    assert.equal(observabilityBody.runtimeObservability.slo.alert.active, true);

    const health = await fetch(`${firstListener.url}/local-runtime-health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.localRuntimeHealth.status, 'attention-needed');
    const sloCheck = healthBody.localRuntimeHealth.checks.find((check) => check.id === 'latency-slo');
    assert.equal(sloCheck.passed, false);
    assert.match(sloCheck.detail, /inspect slow routes/i);
    await firstRuntime.close();
    firstRuntime = null;

    const restartedTelemetry = createLocalTelemetryPort({
      filePath: telemetryPath,
      maxRecords: 30,
      sloPolicy: {
        windowSize: 3,
        snapshotEveryRequests: 3,
        minSamples: 3,
        warningP95DurationMs: 100,
        criticalP95DurationMs: 500,
        maxServerErrorRate: 0.2,
        consecutiveBreachWindows: 2,
        maxSnapshots: 8,
      },
    });
    restartedRuntime = createAgentProjectHttpServer({
      filePath: join(directory, 'projects.json'),
      telemetry: restartedTelemetry,
    });
    const restartedListener = await restartedRuntime.listen();
    const restartedObservability = await fetch(`${restartedListener.url}/runtime-observability`);
    const restartedBody = await restartedObservability.json();
    assert.equal(restartedBody.runtimeObservability.slo.alert.active, true);
    assert.equal(restartedBody.runtimeObservability.slo.alert.consecutiveBreachWindows, 2);
    assert.equal(restartedBody.runtimeObservability.slo.trends.length, 2);
  } finally {
    if (firstRuntime) await firstRuntime.close();
    if (restartedRuntime) await restartedRuntime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('raises an immediate alert for one critical local SLO window', () => {
  const telemetry = createLocalTelemetryPort({
    sloPolicy: {
      windowSize: 2,
      snapshotEveryRequests: 2,
      minSamples: 2,
      warningP95DurationMs: 100,
      criticalP95DurationMs: 500,
      consecutiveBreachWindows: 4,
    },
  });
  telemetry.recordHttpRequest({ statusCode: 200, durationMs: 800 });
  telemetry.recordHttpRequest({ statusCode: 200, durationMs: 800 });

  const status = telemetry.status();
  assert.equal(status.slo.current.status, 'critical');
  assert.equal(status.slo.alert.active, true);
  assert.equal(status.slo.alert.reason, 'critical-window');
  assert.equal(status.slo.alert.consecutiveBreachWindows, 1);
  assert.match(status.slo.alert.recommendation, /pause autonomous work/i);

  telemetry.recordHttpRequest({ statusCode: 200, durationMs: 20 });
  telemetry.recordHttpRequest({ statusCode: 200, durationMs: 20 });
  const recovered = telemetry.status();
  assert.equal(recovered.slo.current.status, 'healthy');
  assert.equal(recovered.slo.alert.active, false);
  assert.equal(recovered.slo.alert.reason, 'within-local-slo');
  assert.equal(recovered.slo.alert.consecutiveBreachWindows, 0);
});
