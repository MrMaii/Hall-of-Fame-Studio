import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';

function blockingApi(filePath, { recoveryRows = false } = {}) {
  let started = null;
  let release = null;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  const project = recoveryRows ? {
    id: 'p', localDurableTaskQueue: [{ status: 'leased' }, { status: 'retry-wait' }],
    localIdempotentExecutionLedger: [{ status: 'ambiguous' }],
  } : { id: 'p' };
  return {
    api: {
      store: { filePath, listProjects: () => [project] },
      handleAsync: async ({ path }) => {
        if (path === '/blocked') {
          started();
          await new Promise((resolve) => { release = resolve; });
        }
        return { status: 200, body: { ok: true } };
      },
    },
    waitForStart: () => requestStarted,
    release: () => release?.(),
  };
}

function verifyReceipt(receipt) {
  const { checksum, ...base } = receipt;
  assert.equal(checksum, createHash('sha256').update(JSON.stringify(base)).digest('hex'));
}

test('quiesces first, drains an active HTTP request, persists proof, and makes repeated close single-flight', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-graceful-shutdown-'));
  const filePath = join(directory, 'projects.json');
  try {
    const blocking = blockingApi(filePath);
    const runtime = createAgentProjectHttpServer({ api: blocking.api });
    const listening = await runtime.listen({ port: 0 });
    const request = fetch(`${listening.url}/blocked`);
    await blocking.waitForStart();
    const firstClose = runtime.close({ drainTimeoutMs: 500, forceCloseTimeoutMs: 500 });
    assert.equal(runtime.runtimeLifecycleStatus().state, 'quiescing');
    assert.equal((await runtime.scheduler.tick()).reason, 'scheduler-quiescing');
    const secondClose = runtime.close({ drainTimeoutMs: 1, forceCloseTimeoutMs: 1 });
    blocking.release();
    assert.equal((await request).status, 200);
    const [first, second] = await Promise.all([firstClose, secondClose]);
    assert.deepEqual(second, first);
    assert.equal(first.complete, true);
    assert.equal(first.httpDrain.drained, true);
    assert.equal(first.shutdownReceipt.status, 'drained');
    verifyReceipt(first.shutdownReceipt);
    const diskReceipt = JSON.parse(readFileSync(`${filePath}.shutdown.json`, 'utf8'));
    assert.deepEqual(diskReceipt, first.shutdownReceipt);
    const restarted = createAgentProjectHttpServer({ api: blockingApi(filePath).api });
    assert.equal(restarted.runtimeLifecycleStatus().lastShutdownReceipt.checksum, first.shutdownReceipt.checksum);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('reports an incomplete deadline, force-closes sockets, and preserves durable recovery counts without request content', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-shutdown-timeout-'));
  const filePath = join(directory, 'projects.json');
  try {
    const blocking = blockingApi(filePath, { recoveryRows: true });
    const runtime = createAgentProjectHttpServer({ api: blocking.api });
    const listening = await runtime.listen({ port: 0 });
    const request = fetch(`${listening.url}/blocked`).catch(() => null);
    await blocking.waitForStart();
    const result = await runtime.close({ drainTimeoutMs: 20, forceCloseTimeoutMs: 20 });
    assert.equal(result.complete, false);
    assert.equal(result.httpDrain.reason, 'http-drain-timeout');
    assert.equal(result.httpDrain.activeRequestCount, 1);
    assert.match(result.httpDrain.activeRequestHashes[0], /^[a-f0-9]{64}$/);
    assert.equal(result.shutdownReceipt.status, 'incomplete');
    assert.equal(result.shutdownReceipt.forcedConnectionCount >= 1, true);
    assert.deepEqual(result.shutdownReceipt.durableRecovery, { leasedCount: 1, cancellationRequestedCount: 0, retryWaitCount: 1, ambiguousProviderCount: 1 });
    assert.equal(JSON.stringify(result.shutdownReceipt).includes('/blocked'), false);
    assert.equal(JSON.stringify(result.shutdownReceipt).includes('request body'), false);
    verifyReceipt(result.shutdownReceipt);
    blocking.release();
    await request;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
