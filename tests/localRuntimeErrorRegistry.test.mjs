import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalAuthStore } from '../src/agents/localAuthStore.js';
import { createLocalTelemetryPort } from '../src/agents/localTelemetryPort.js';

function throwingApi(localAuth = null) {
  return {
    localAuth,
    store: { filePath: 'local-test-store' },
    service: {
      getSecretVaultStatus() {
        return { enabled: true, ready: true };
      },
    },
    async handleAsync() {
      const error = new Error('database password=raw-secret-must-never-leak');
      error.code = 'WORKER_LEASE_LOST';
      throw error;
    },
  };
}

function createRuntime(telemetryPath) {
  const telemetry = createLocalTelemetryPort({ filePath: telemetryPath, maxRecords: 40 });
  return createAgentProjectHttpServer({ api: throwingApi(), telemetry });
}

test('deduplicates and manages local runtime error issues across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-runtime-errors-'));
  const telemetryPath = join(directory, 'telemetry.jsonl');
  let runtime = createRuntime(telemetryPath);
  let listener = await runtime.listen();
  try {
    for (let index = 0; index < 2; index += 1) {
      const failed = await fetch(`${listener.url}/projects/demo?token=query-secret-${index}`);
      assert.equal(failed.status, 400);
      const body = await failed.json();
      assert.equal(body.error, 'agent-project-http-error');
      assert.equal(body.errorCode, 'WORKER_LEASE_LOST');
      assert.ok(body.traceId);
      assert.equal(JSON.stringify(body).includes('raw-secret-must-never-leak'), false);
    }

    let response = await fetch(`${listener.url}/runtime-errors`);
    assert.equal(response.status, 200);
    let body = await response.json();
    assert.equal(body.runtimeErrors.schemaVersion, 'local-runtime-error-registry/v1');
    assert.equal(body.runtimeErrors.summary.issueCount, 1);
    assert.equal(body.runtimeErrors.summary.openCount, 1);
    let issue = body.runtimeErrors.issues[0];
    assert.match(issue.fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(issue.errorCode, 'WORKER_LEASE_LOST');
    assert.equal(issue.count, 2);
    assert.equal(issue.status, 'open');
    assert.equal(issue.path, '/projects/demo');
    assert.equal(issue.runbook.id, 'local-worker-recovery');
    assert.ok(issue.runbook.steps.length >= 2);
    assert.equal(JSON.stringify(body).includes('query-secret'), false);

    response = await fetch(`${listener.url}/runtime-errors/${issue.fingerprint}/acknowledge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        actorId: 'local-owner',
        note: 'Investigating with token=operator-secret-must-not-leak',
      }),
    });
    assert.equal(response.status, 200);
    body = await response.json();
    assert.equal(body.runtimeError.status, 'acknowledged');
    assert.equal(body.runtimeError.updatedBy, 'local-owner');
    assert.equal(JSON.stringify(body).includes('operator-secret-must-not-leak'), false);

    await runtime.close();
    runtime = createRuntime(telemetryPath);
    listener = await runtime.listen();
    response = await fetch(`${listener.url}/runtime-errors`);
    body = await response.json();
    assert.equal(body.runtimeErrors.issues[0].status, 'acknowledged');
    assert.equal(body.runtimeErrors.issues[0].count, 2);

    response = await fetch(`${listener.url}/runtime-errors/${issue.fingerprint}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actorId: 'local-owner', note: 'Lease recovered.' }),
    });
    assert.equal(response.status, 200);
    body = await response.json();
    assert.equal(body.runtimeError.status, 'resolved');

    const healthy = await fetch(`${listener.url}/local-runtime-health`);
    const healthyBody = await healthy.json();
    assert.equal(healthyBody.localRuntimeHealth.checks.find((check) => check.id === 'runtime-errors').passed, true);

    await fetch(`${listener.url}/projects/demo?token=recurrence-secret`);
    response = await fetch(`${listener.url}/runtime-errors`);
    body = await response.json();
    issue = body.runtimeErrors.issues[0];
    assert.equal(issue.status, 'open');
    assert.equal(issue.count, 3);
    assert.equal(issue.reopenedCount, 1);
    assert.deepEqual(issue.transitions.map((transition) => transition.action), ['open', 'acknowledge', 'resolve', 'reopen']);
    assert.equal(body.runtimeErrors.summary.openCount, 1);

    const health = await fetch(`${listener.url}/local-runtime-health`);
    const healthBody = await health.json();
    assert.equal(healthBody.localRuntimeHealth.status, 'attention-needed');
    assert.equal(healthBody.localRuntimeHealth.checks.find((check) => check.id === 'runtime-errors').passed, false);

    const serialized = readFileSync(telemetryPath, 'utf8');
    assert.equal(serialized.includes('raw-secret-must-never-leak'), false);
    assert.equal(serialized.includes('query-secret'), false);
    assert.equal(serialized.includes('operator-secret-must-not-leak'), false);
  } finally {
    await runtime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('protects local runtime error controls with a security administrator session', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-runtime-errors-auth-'));
  const telemetry = createLocalTelemetryPort({ filePath: join(directory, 'telemetry.jsonl') });
  telemetry.recordRuntimeError({
    method: 'POST',
    path: '/workers/autonomous/tick',
    errorCode: 'WORKER_TICK_FAILED',
  });
  const localAuth = createLocalAuthStore({ filePath: join(directory, 'local-auth.json') });
  const owner = localAuth.bootstrap({
    username: 'owner',
    password: 'correct horse battery staple1',
  });
  const runtime = createAgentProjectHttpServer({
    api: throwingApi(localAuth),
    telemetry,
    localAuthRequired: true,
  });
  const listener = await runtime.listen();
  try {
    assert.equal((await fetch(`${listener.url}/runtime-errors`)).status, 401);
    const authorized = await fetch(`${listener.url}/runtime-errors`, {
      headers: { 'x-hofs-local-auth-token': owner.token },
    });
    assert.equal(authorized.status, 200);
    const issue = (await authorized.json()).runtimeErrors.issues[0];
    const deniedResolve = await fetch(`${listener.url}/runtime-errors/${issue.fingerprint}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actorId: owner.user.id }),
    });
    assert.equal(deniedResolve.status, 401);
    const resolved = await fetch(`${listener.url}/runtime-errors/${issue.fingerprint}/resolve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hofs-local-auth-token': owner.token,
      },
      body: JSON.stringify({ actorId: owner.user.id }),
    });
    assert.equal(resolved.status, 200);
  } finally {
    await runtime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
