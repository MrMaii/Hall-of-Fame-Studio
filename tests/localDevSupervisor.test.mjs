import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  createLocalDevSupervisor,
  createLocalRuntimeStatusWriter,
} from '../src/localRuntime/localDevSupervisor.js';

function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.killed = false;
  child.killCalls = [];
  child.kill = (signal) => {
    child.killCalls.push(signal);
    child.killed = true;
  };
  return child;
}

test('keeps the UI running and records a recovery action when the backend exits', () => {
  const backend = fakeChild();
  const ui = fakeChild();
  const statuses = [];
  const exits = [];
  createLocalDevSupervisor({
    backend,
    ui,
    writeStatus: (status) => statuses.push(status),
    exit: (code) => exits.push(code),
    schedule: () => ({ unref() {} }),
    now: () => '2026-07-11T23:40:00.000Z',
  });

  backend.emit('exit', 1, null);

  assert.deepEqual(ui.killCalls, []);
  assert.deepEqual(exits, []);
  assert.equal(statuses.at(-1).backend.status, 'failed');
  assert.equal(statuses.at(-1).ui.status, 'running');
  assert.equal(statuses.at(-1).message, '本地服务启动失败，界面仍可使用。');
  assert.deepEqual(statuses.at(-1).recoveryActions.map((action) => action.id), ['restart-backend', 'restore-backup']);
});

test('stops the backend when the UI exits unexpectedly', () => {
  const backend = fakeChild();
  const ui = fakeChild();
  const exits = [];
  const scheduled = [];
  createLocalDevSupervisor({
    backend,
    ui,
    writeStatus: () => {},
    exit: (code) => exits.push(code),
    schedule: (callback) => {
      scheduled.push(callback);
      return { unref() {} };
    },
  });

  ui.emit('exit', 1, null);

  assert.deepEqual(backend.killCalls, ['SIGTERM']);
  assert.equal(scheduled.length, 1);
  scheduled[0]();
  assert.deepEqual(exits, [1]);
});

test('writes local runtime status atomically for the Vite recovery page', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-runtime-status-'));
  const filePath = join(directory, 'runtime-status.json');
  try {
    const writeStatus = createLocalRuntimeStatusWriter(filePath);
    writeStatus({ schemaVersion: 'local-runtime-status/v1', backend: { status: 'failed' } });
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')), {
      schemaVersion: 'local-runtime-status/v1',
      backend: { status: 'failed' },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
