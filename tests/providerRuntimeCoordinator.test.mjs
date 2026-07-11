import assert from 'node:assert/strict';
import test from 'node:test';

import { createProviderRuntimeCoordinator } from '../src/agents/providerRuntimeCoordinator.js';

test('serializes operations per backend scope and suppresses stale completion', async () => {
  let releaseFirst;
  const coordinator = createProviderRuntimeCoordinator();
  const first = coordinator.request({
    scope: 'http://127.0.0.1:8787:global',
    operation: () => new Promise((resolve) => { releaseFirst = () => resolve('old'); }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  coordinator.invalidate('http://127.0.0.1:8787:global');
  const second = coordinator.request({
    scope: 'http://127.0.0.1:8787:global',
    operation: async () => 'new',
  });
  releaseFirst();

  assert.equal((await first).stale, true);
  assert.deepEqual(await second, { stale: false, value: 'new' });
});

test('does not serialize independent backend scopes', async () => {
  const coordinator = createProviderRuntimeCoordinator();
  const order = [];
  await Promise.all([
    coordinator.request({ scope: 'http://127.0.0.1:8787:global', operation: async () => order.push('first') }),
    coordinator.request({ scope: 'http://127.0.0.1:8788:global', operation: async () => order.push('second') }),
  ]);
  assert.deepEqual(order.sort(), ['first', 'second']);
});
