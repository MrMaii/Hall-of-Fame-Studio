import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-workspace-command-cancel-'));
  const workspacePath = join(directory, 'workspace');
  mkdirSync(workspacePath);
  const runtime = createLocalProjectRuntime({ rootPath: join(directory, 'runtime'), enableCommandExecution: true, allowedCommands: ['node'] });
  const project = { id: 'workspace-command-project', localRuntime: { workspacePath } };
  return { directory, runtime, project };
}

test('executes an allowed workspace command asynchronously with a content-minimized receipt', async () => {
  const { directory, runtime, project } = fixture();
  try {
    const result = await runtime.executeWorkspaceCommandAsync(project, { command: 'node', args: ['-e', "process.stdout.write('ok')"], timeoutMs: 1000, operationId: 'command-success-1' });
    assert.equal(result.status, 'succeeded');
    assert.equal(result.stdout, 'ok');
    assert.equal(result.receipt.schemaVersion, 'local-workspace-command-execution/v1');
    assert.match(result.receipt.commandHash, /^[a-f0-9]{64}$/);
    assert.match(result.receipt.checksum, /^[a-f0-9]{64}$/);
    assert.equal(result.receipt.stdout, undefined);
    assert.equal(JSON.stringify(result.receipt).includes('process.stdout'), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('distinguishes timeout, caller cancellation, and output limit without late success', async () => {
  const { directory, runtime, project } = fixture();
  try {
    const timedOut = await runtime.executeWorkspaceCommandAsync(project, { command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'], timeoutMs: 20, operationId: 'command-timeout-1' });
    assert.equal(timedOut.status, 'timed-out');
    assert.equal(timedOut.receipt.timeoutTriggered, true);
    assert.equal(timedOut.receipt.cancelledByCaller, false);

    const controller = new AbortController();
    const running = runtime.executeWorkspaceCommandAsync(project, { command: 'node', args: ['-e', "setTimeout(() => process.stdout.write('late-success'), 100)"], timeoutMs: 1000, signal: controller.signal, operationId: 'command-cancel-1' });
    setTimeout(() => controller.abort('operator-cancelled'), 15);
    const cancelled = await running;
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.receipt.cancelledByCaller, true);
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.stdout.includes('late-success'), false);

    const overflow = await runtime.executeWorkspaceCommandAsync(project, { command: 'node', args: ['-e', "process.stdout.write('x'.repeat(10000))"], maxBuffer: 128, timeoutMs: 1000, operationId: 'command-output-limit-1' });
    assert.equal(overflow.status, 'output-limit-exceeded');
    assert.equal(overflow.receipt.outputLimitExceeded, true);
    assert.equal(Buffer.byteLength(overflow.stdout), 128);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects disallowed commands and escaped cwd before spawn', async () => {
  const { directory, runtime, project } = fixture();
  try {
    await assert.rejects(runtime.executeWorkspaceCommandAsync(project, { command: 'powershell', args: ['-Command', 'echo unsafe'] }), /not allowed/);
    await assert.rejects(runtime.executeWorkspaceCommandAsync(project, { command: 'node', cwd: '..', args: ['-e', '0'] }), /escapes allowed root/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
