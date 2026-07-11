# Local Scheduler Graceful Shutdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop accepting scheduled local Agent work during shutdown, wait a bounded period for an active tick to persist its receipts, and return an explicit drain result.

**Architecture:** Keep the existing in-process scheduler and persisted project ledgers. Add an idle waiter to `createAutonomousSchedulerController`; it observes the controller's existing `running` state rather than creating a second lease system. HTTP server shutdown clears the interval first, closes the listener, then waits for the active scheduler tick until the supplied drain deadline.

**Tech Stack:** Node.js ESM, existing HTTP scheduler controller, Node test runner.

## Global Constraints

- No cloud queue, SaaS, or replacement worker engine is introduced.
- A shutdown must clear the interval before waiting so no new scheduled tick starts.
- A drain timeout is a visible result, never reported as a successful drain.
- Existing `close()` callers may ignore its returned result; they must retain safe close behavior.
- The scheduler must remain single-flight: a second `tick()` still returns `scheduler-already-running`.

---

### Task 1: Make active scheduler work observable and drainable

**Files:**

- Modify: `src/agents/agentProjectHttpServer.js:73-330`
- Create: `tests/localSchedulerShutdown.test.mjs`

**Interfaces:**

- Export `createAutonomousSchedulerController(options)`.
- `waitForIdle({ timeoutMs = 5000, pollIntervalMs = 10 })` resolves `{ drained: true, reason: 'scheduler-idle' }` or `{ drained: false, reason: 'scheduler-drain-timeout' }`.

- [x] **Step 1: Write failing controller tests**

```js
const tick = scheduler.tick({ tickAutopilotSessions: true });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(scheduler.status().running, true);
const draining = scheduler.waitForIdle({ timeoutMs: 100, pollIntervalMs: 1 });
releaseAutopilot();
assert.deepEqual(await draining, { drained: true, reason: 'scheduler-idle' });
await tick;
assert.deepEqual(await scheduler.waitForIdle({ timeoutMs: 1, pollIntervalMs: 1 }), { drained: true, reason: 'scheduler-idle' });
```

- [x] **Step 2: Run focused test and confirm it fails**

Run: `node --test tests/localSchedulerShutdown.test.mjs`

Expected: failure because the controller is not exported and has no `waitForIdle` method.

- [x] **Step 3: Implement the bounded idle waiter**

```js
const waitForIdle = ({ timeoutMs = 5000, pollIntervalMs = 10 } = {}) => new Promise((resolve) => {
  const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);
  const check = () => {
    if (!running) return resolve({ drained: true, reason: 'scheduler-idle' });
    if (Date.now() >= deadline) return resolve({ drained: false, reason: 'scheduler-drain-timeout' });
    setTimeout(check, Math.max(1, Number(pollIntervalMs) || 1));
  };
  check();
});
```

Return it from the controller beside `start`, `stop`, `tick`, and `status`.

- [x] **Step 4: Verify focused test passes**

Run: `node --test tests/localSchedulerShutdown.test.mjs`

Expected: the active tick drains after release and the already-idle controller drains immediately.

### Task 2: Make HTTP shutdown wait for the bounded scheduler drain

**Files:**

- Modify: `src/agents/agentProjectHttpServer.js:520-555`
- Modify: `tests/localSchedulerShutdown.test.mjs`

**Interfaces:**

- `httpServer.close({ schedulerDrainTimeoutMs = 5000 })` resolves `{ schedulerDrain }` after listener closure and the scheduler drain attempt.
- `schedulerDrain` uses the Task 1 result shape.

- [x] **Step 1: Add the failing close test**

```js
const tick = server.scheduler.tick({ tickAutopilotSessions: true });
await new Promise((resolve) => setTimeout(resolve, 0));
const closing = server.close({ schedulerDrainTimeoutMs: 100 });
releaseAutopilot();
assert.deepEqual((await closing).schedulerDrain, { drained: true, reason: 'scheduler-idle' });
await tick;
```

- [x] **Step 2: Run focused test and confirm it fails**

Run: `node --test tests/localSchedulerShutdown.test.mjs`

Expected: failure because `close()` returns no scheduler drain result and does not wait for the active tick.

- [x] **Step 3: Stop, close, and drain in one shutdown path**

```js
async close({ schedulerDrainTimeoutMs = 5000 } = {}) {
  scheduler.stop();
  const schedulerDrainPromise = scheduler.waitForIdle({ timeoutMs: schedulerDrainTimeoutMs });
  const serverClosePromise = closeNodeServerWithExistingSocketFallback();
  const [schedulerDrain] = await Promise.all([schedulerDrainPromise, serverClosePromise]);
  return { schedulerDrain };
}
```

Keep the existing idle/force socket timers inside `closeNodeServerWithExistingSocketFallback`; do not make a drain timeout throw or pretend that it drained.

- [x] **Step 4: Verify focused and regression commands**

Run: `node --test tests/localSchedulerShutdown.test.mjs && npm.cmd test && npm.cmd run agents:server:validate && npm.cmd run launch:local-mvp:check`

Expected: every command exits 0.

## Self-Review

- Covers the real process-shutdown race discovered in the HTTP scheduler path.
- Uses the existing persisted project worker receipts instead of creating a parallel queue abstraction.
- Leaves long-running work visible when drain times out, so the next recovery task can inspect and resume it.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
