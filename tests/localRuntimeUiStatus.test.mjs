import assert from 'node:assert/strict';
import test from 'node:test';

import { presentLocalRuntimeStatus } from '../src/localRuntime/localRuntimeUi.js';

test('presents a backend failure in ordinary Chinese with recovery actions', () => {
  const result = presentLocalRuntimeStatus({
    schemaVersion: 'local-runtime-status/v1',
    backend: { status: 'failed', failure: { kind: 'unexpected-exit', code: 1 } },
    ui: { status: 'running' },
  });
  assert.equal(result.visible, true);
  assert.equal(result.title, '本地服务未运行');
  assert.match(result.message, /项目数据仍保留/);
  assert.deepEqual(result.actions.map((action) => action.id), ['retry', 'open-recovery']);
});

test('hides the recovery notice while the local runtime is healthy', () => {
  assert.equal(presentLocalRuntimeStatus({
    schemaVersion: 'local-runtime-status/v1',
    backend: { status: 'running' },
  }).visible, false);
});
