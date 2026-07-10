import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalTelemetryPort } from '../src/agents/localTelemetryPort.js';

test('records redacted local HTTP telemetry with a returned trace id', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-telemetry-http-'));
  const telemetryPath = join(directory, 'telemetry.jsonl');
  const telemetry = createLocalTelemetryPort({ filePath: telemetryPath, maxRecords: 8 });
  const runtime = createAgentProjectHttpServer({
    filePath: join(directory, 'projects.json'),
    telemetry,
  });
  const listener = await runtime.listen();
  try {
    const projects = await fetch(`${listener.url}/projects?token=do-not-log-this`);
    assert.equal(projects.status, 200);
    assert.ok(projects.headers.get('x-hofs-trace-id'));
    const observability = await fetch(`${listener.url}/runtime-observability`);
    assert.equal(observability.status, 200);
    const body = await observability.json();
    assert.equal(body.runtimeObservability.schemaVersion, 'local-runtime-observability/v1');
    assert.ok(body.runtimeObservability.summary.requestCount >= 1);
    assert.equal(JSON.stringify(body).includes('do-not-log-this'), false);
    assert.equal(readFileSync(telemetryPath, 'utf8').includes('do-not-log-this'), false);
  } finally {
    await runtime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
