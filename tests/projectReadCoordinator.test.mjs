import assert from 'node:assert/strict';
import test from 'node:test';

import { createProjectReadCoordinator } from '../src/project/projectReadCoordinator.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('user-visible project reads jump ahead of queued background proof reads', async () => {
  const coordinator = createProjectReadCoordinator({ maxConcurrent: 1 });
  const gate = deferred();
  const order = [];

  const first = coordinator.schedule({
    key: 'background-active',
    priority: 'background',
    timeoutMs: 1000,
    run: async () => { order.push('background-active'); await gate.promise; },
  });
  const stale = coordinator.schedule({
    key: 'background-queued',
    priority: 'background',
    timeoutMs: 1000,
    run: async () => { order.push('background-queued'); },
  });
  const visible = coordinator.schedule({
    key: 'dashboard-core',
    priority: 'user-visible',
    timeoutMs: 1000,
    run: async () => { order.push('dashboard-core'); },
  });

  gate.resolve();
  await Promise.all([first, stale, visible]);

  assert.deepEqual(order, ['background-active', 'dashboard-core', 'background-queued']);
});

test('queued project reads expire within their total timeout budget', async () => {
  const coordinator = createProjectReadCoordinator({ maxConcurrent: 1 });
  const gate = deferred();
  let expiredReadRan = false;

  const blocker = coordinator.schedule({
    key: 'blocker',
    timeoutMs: 1000,
    run: () => gate.promise,
  });
  const expired = coordinator.schedule({
    key: 'expires-in-queue',
    timeoutMs: 20,
    run: async () => { expiredReadRan = true; },
  });

  await assert.rejects(expired, error => error?.name === 'AbortError');
  assert.equal(expiredReadRan, false);
  gate.resolve();
  await blocker;
});

test('duplicate in-flight reads share one request', async () => {
  const coordinator = createProjectReadCoordinator({ maxConcurrent: 2 });
  let runCount = 0;
  const run = async () => { runCount += 1; return { ok: true }; };

  const first = coordinator.schedule({ key: 'same-read', timeoutMs: 1000, run });
  const second = coordinator.schedule({ key: 'same-read', timeoutMs: 1000, run });

  assert.strictEqual(first, second);
  assert.deepEqual(await first, { ok: true });
  assert.equal(runCount, 1);
});

test('canceling background refreshes preserves user-visible dashboard reads', async () => {
  const coordinator = createProjectReadCoordinator({ maxConcurrent: 2 });
  const backgroundGate = deferred();
  const visibleGate = deferred();

  const background = coordinator.schedule({
    key: 'background-proof',
    priority: 'background',
    timeoutMs: 1000,
    run: () => backgroundGate.promise,
  });
  const visible = coordinator.schedule({
    key: 'dashboard-core',
    priority: 'user-visible',
    timeoutMs: 1000,
    run: () => visibleGate.promise,
  });

  coordinator.cancelBackground();
  visibleGate.resolve({ ok: true });

  await assert.rejects(background, error => error?.name === 'AbortError');
  assert.deepEqual(await visible, { ok: true });
});

test('joining a queued background read promotes it to user-visible priority', async () => {
  const coordinator = createProjectReadCoordinator({ maxConcurrent: 1 });
  const gate = deferred();
  const order = [];
  const blocker = coordinator.schedule({ key: 'blocker', timeoutMs: 1000, run: () => gate.promise });
  const otherBackground = coordinator.schedule({
    key: 'other-background',
    timeoutMs: 1000,
    run: async () => { order.push('other-background'); },
  });
  const targetBackground = coordinator.schedule({
    key: 'shared-dashboard-read',
    timeoutMs: 1000,
    run: async () => { order.push('shared-dashboard-read'); },
  });
  const targetVisible = coordinator.schedule({
    key: 'shared-dashboard-read',
    priority: 'user-visible',
    timeoutMs: 1000,
    run: async () => { throw new Error('duplicate read must not run'); },
  });

  assert.strictEqual(targetVisible, targetBackground);
  gate.resolve();
  await Promise.all([blocker, otherBackground, targetVisible]);
  assert.deepEqual(order, ['shared-dashboard-read', 'other-background']);
});

test('joining a queued background read adopts the longer user-visible timeout budget', async () => {
  const coordinator = createProjectReadCoordinator({ maxConcurrent: 1 });
  const gate = deferred();
  const blocker = coordinator.schedule({ key: 'blocker', timeoutMs: 1000, run: () => gate.promise });
  const background = coordinator.schedule({
    key: 'shared-dashboard-read',
    timeoutMs: 20,
    run: async () => ({ ok: true }),
  });
  const visible = coordinator.schedule({
    key: 'shared-dashboard-read',
    priority: 'user-visible',
    timeoutMs: 250,
    run: async () => { throw new Error('duplicate read must not run'); },
  });

  assert.strictEqual(visible, background);
  await new Promise(resolve => setTimeout(resolve, 40));
  gate.resolve();

  await blocker;
  assert.deepEqual(await visible, { ok: true });
});
