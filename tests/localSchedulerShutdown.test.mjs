import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAgentProjectHttpServer,
  createAutonomousSchedulerController,
} from '../src/agents/agentProjectHttpServer.js';

function createBlockingSchedulerApi() {
  let releaseAutopilot = null;
  let autopilotStarted = null;
  const started = new Promise((resolve) => { autopilotStarted = resolve; });
  const completedResponse = { status: 200, body: { processed: [], skipped: [], messages: [], messageCount: 0 } };
  const api = {
    handle({ path }) {
      assert.ok(['/workers/autonomous/due', '/workers/agents/due'].includes(path));
      return completedResponse;
    },
    async handleAsync({ path }) {
      assert.equal(path, '/workers/autopilot/due');
      autopilotStarted();
      await new Promise((resolve) => { releaseAutopilot = resolve; });
      return completedResponse;
    },
  };
  return {
    api,
    waitForAutopilotStart: () => started,
    releaseAutopilot: () => releaseAutopilot?.(),
  };
}

function createRecordingSchedulerApi() {
  const calls = [];
  const completedResponse = { status: 200, body: { processed: [], skipped: [], messages: [], messageCount: 0 } };
  return {
    calls,
    api: {
      handle({ path }) {
        calls.push(path);
        return completedResponse;
      },
      async handleAsync({ path }) {
        calls.push(path);
        return completedResponse;
      },
    },
  };
}

async function waitFor(predicate, timeoutMs = 100) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for scheduler activity.');
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

test('explicit local scheduler recovery starts the existing Autopilot due-worker', async () => {
  const recording = createRecordingSchedulerApi();
  const scheduler = createAutonomousSchedulerController({ api: recording.api, intervalMs: 60_000 });
  scheduler.start({ runImmediately: true, resumeAutopilotSessions: true });
  await waitFor(() => recording.calls.includes('/workers/autopilot/due'));
  scheduler.stop();
  assert.deepEqual(await scheduler.waitForIdle({ timeoutMs: 100, pollIntervalMs: 1 }), {
    drained: true,
    reason: 'scheduler-idle',
  });
});

test('waits for an active local scheduler tick to become idle and reports a bounded timeout', async () => {
  const blocking = createBlockingSchedulerApi();
  const scheduler = createAutonomousSchedulerController({ api: blocking.api });
  const tick = scheduler.tick({ tickAutopilotSessions: true });
  await blocking.waitForAutopilotStart();
  assert.equal(scheduler.status().running, true);
  assert.deepEqual(await scheduler.waitForIdle({ timeoutMs: 1, pollIntervalMs: 1 }), {
    drained: false,
    reason: 'scheduler-drain-timeout',
  });
  const draining = scheduler.waitForIdle({ timeoutMs: 100, pollIntervalMs: 1 });
  blocking.releaseAutopilot();
  assert.deepEqual(await draining, { drained: true, reason: 'scheduler-idle' });
  await tick;
  assert.deepEqual(await scheduler.waitForIdle({ timeoutMs: 1, pollIntervalMs: 1 }), {
    drained: true,
    reason: 'scheduler-idle',
  });
});

test('HTTP shutdown stops new local ticks and waits for the active tick to drain', async () => {
  const blocking = createBlockingSchedulerApi();
  const httpServer = createAgentProjectHttpServer({ api: blocking.api });
  await httpServer.listen({ port: 0 });
  const tick = httpServer.scheduler.tick({ tickAutopilotSessions: true });
  await blocking.waitForAutopilotStart();
  const closing = httpServer.close({ schedulerDrainTimeoutMs: 100 });
  blocking.releaseAutopilot();
  assert.deepEqual((await closing).schedulerDrain, { drained: true, reason: 'scheduler-idle' });
  await tick;
});
