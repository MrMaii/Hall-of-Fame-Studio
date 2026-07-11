# Local Autopilot Restart Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user explicitly enables the local autonomous scheduler, restart it with the Autopilot due-worker enabled so persisted `running` sessions resume through their existing bounded, receipt-backed path.

**Architecture:** Preserve the existing file-backed session ledger and `/workers/autopilot/due` route. Add one scheduler input flag, `resumeAutopilotSessions`, which is translated into the existing Autopilot tick control. The local server entrypoint sets it only when `AGENT_AUTONOMOUS_SCHEDULER=true`; paused and completed sessions remain filtered by the existing due-worker.

**Tech Stack:** Node.js ESM, local file-backed project store, existing HTTP scheduler, Node test runner.

## Global Constraints

- Pure local only: no hosted queue, SaaS scheduler, or external recovery worker.
- Only an explicitly enabled `AGENT_AUTONOMOUS_SCHEDULER` may enable automatic resumption.
- The feature must use `/workers/autopilot/due`; it must not create a second execution path.
- Existing session state is authoritative: only `running` and `waiting` sessions are eligible, as enforced by the current due-worker.
- The scheduler remains single-flight and still honors the graceful drain behavior added in the preceding task.

---

### Task 1: Prove the restart-resume control is currently absent

**Files:**

- Modify: `tests/localSchedulerShutdown.test.mjs`

- [x] **Step 1: Add a failing scheduler-start test**

Use a mock API that records route calls. Start the controller with:

```js
scheduler.start({ runImmediately: true, resumeAutopilotSessions: true });
```

Assert that the immediate tick calls `/workers/autopilot/due`, then stop and drain the scheduler.

- [x] **Step 2: Run focused test and confirm it fails**

Run: `node --test tests/localSchedulerShutdown.test.mjs`

Expected: the new control is ignored, so no Autopilot due-worker call is recorded.

### Task 2: Thread the explicit local resume control through the existing scheduler

**Files:**

- Modify: `src/agents/agentProjectHttpServer.js:54-340`
- Modify: `scripts/agent-project-server.mjs:84-172`

- [x] **Step 1: Treat `resumeAutopilotSessions` as an Autopilot tick control**

Extend the current Autopilot control predicate and status summary so a scheduler started with this flag invokes its existing `/workers/autopilot/due` operation for the initial and interval ticks.

- [x] **Step 2: Set the control only for explicit local autonomous-server startup**

Pass `resumeAutopilotSessions: autonomousSchedulerEnabled` into `autonomousScheduler` in `scripts/agent-project-server.mjs`. This means the normal opt-in variable, not a hidden default, authorizes recovery after process restart.

- [x] **Step 3: Verify focused test passes**

Run: `node --test tests/localSchedulerShutdown.test.mjs`

Expected: immediate resume invokes `/workers/autopilot/due`; all existing drain tests remain green.

### Task 3: Verify no regression in local runtime gates

**Files:**

- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`

- [x] **Step 1: Update the capability ledger truthfully**

Keep durable-task recovery as partial coverage, and state that explicitly enabled local scheduler restart now resumes persisted Autopilot sessions via the normal due-worker; lease-expiry recovery remains the next gap.

- [x] **Step 2: Run focused and regression commands**

Run: `node --test tests/localSchedulerShutdown.test.mjs && npm.cmd test && npm.cmd run agents:server:validate && npm.cmd run launch:local-mvp:check`

Expected: every command exits 0.

## Self-Review

- The recovery authorization is explicit and local.
- It resumes only session states already considered active by the durable ledger.
- It composes with bounded shutdown rather than bypassing it.
- It leaves lease expiry, duplicate-effect prevention across a crash, and dead-letter operations as separate verified work items.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
