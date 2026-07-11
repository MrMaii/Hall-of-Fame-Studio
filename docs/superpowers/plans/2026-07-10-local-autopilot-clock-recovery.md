# Local Autopilot Clock Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a local Autopilot scheduler recover safely from a material system-clock rollback or missed cadence without permanent waiting or catch-up bursts.

**Architecture:** Keep the single `evaluateAutopilotRunControlSessionSchedule` function as the authoritative schedule seam. It will classify a material future `lastTickAt` as a clock-regression recovery and an overdue cadence as a missed-cadence recovery; both yield exactly one normal tick at `now`. The existing lease and idempotency flow remains unchanged and still prevents duplicate execution.

**Tech Stack:** Node.js ESM, file-backed local project store, Node test runner.

## Global Constraints

- Pure local behavior; do not introduce NTP, cloud time, or a remote scheduler.
- Recover exactly one tick; never backfill one tick per missed interval.
- Preserve explicit forced-run precedence.
- Ignore small timestamp jitter by treating only a future last tick beyond one configured interval as a rollback.
- Return an explicit machine-readable recovery reason in existing worker summaries.

---

### Task 1: Establish clock-recovery behavior at the public due-worker seam

**Files:**
- Create: `tests/localAutopilotClockRecovery.test.mjs`

**Interfaces:**
- Consumes: `createAgentProjectService({ store }).startAutonomousRunControlSession()` and `runDueAutonomousRunControlSessions()`.
- Produces: processed worker rows with reasons `autopilot-session-clock-regression-recovery` and `autopilot-session-missed-cadence-recovery`.

- [x] **Step 1: Write failing public due-worker tests**

```js
const rollback = service.runDueAutonomousRunControlSessions({ now: '2026-07-10T10:00:00.000Z', intervalMs: 60_000 });
assert.equal(rollback.processed[0].reason, 'autopilot-session-clock-regression-recovery');

const missed = service.runDueAutonomousRunControlSessions({ now: '2026-07-10T10:05:00.000Z', intervalMs: 60_000 });
assert.equal(missed.processed[0].reason, 'autopilot-session-missed-cadence-recovery');
assert.equal(missed.processed.length, 1);
```

Each test seeds one active session and sets its persisted `lastTickAt` before invoking the public worker.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/localAutopilotClockRecovery.test.mjs`

Expected: FAIL; a rollback is reported as waiting and an overdue session is reported as generic cadence due.

### Task 2: Add the single safe schedule classification

**Files:**
- Modify: `src/agents/agentProjectService.js:6476-6504`
- Modify: `tests/localAutopilotClockRecovery.test.mjs`

**Interfaces:**
- Consumes: `lastTickAt`, `now`, and `intervalMs`.
- Produces: schedule fields `due`, `reason`, `dueAt`, `nextRunAt`, `clockRegressionDetected`, and `missedIntervals`.

- [x] **Step 1: Implement material rollback and missed-cadence classification**

```js
const nowMs = safeDateMs(now);
const interval = Number(intervalMs) || 60_000;
const lastTickMs = lastTickAt ? safeDateMs(lastTickAt, nowMs) : null;
const scheduledDueMs = safeDateMs(scheduledDueAt, nowMs);
const clockRegressionDetected = Boolean(lastTickAt) && lastTickMs > nowMs + interval;
const missedIntervals = lastTickAt && nowMs > scheduledDueMs
  ? Math.floor((nowMs - scheduledDueMs) / interval)
  : 0;
const due = forceDue || !lastTickAt || clockRegressionDetected || nowMs >= scheduledDueMs;
```

Give forced runs precedence, then first tick, rollback recovery, missed-cadence recovery, normal cadence due, and waiting. Set `dueAt` to `now` for either recovery.

- [x] **Step 2: Run the focused test and scheduler regressions**

Run: `node --test tests/localAutopilotClockRecovery.test.mjs tests/localAutopilotLeaseRecovery.test.mjs tests/localSchedulerShutdown.test.mjs`

Expected: PASS; recovery is explicit and leases/shutdown retain their existing behavior.

### Task 3: Document the verified boundary and run local release checks

**Files:**
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-autopilot-clock-recovery.md`

**Interfaces:**
- Consumes: verified recovery results from Tasks 1-2.
- Produces: a precise capability #19 description that says one safe recovery tick, not guaranteed wall-clock accuracy.

- [x] **Step 1: Update capability 19**

```markdown
| 19 | 定时调度 | 部分覆盖 | due-worker、Autopilot 会话与本地时钟回拨/错过周期的单次恢复 | 时钟明显回拨或停机错过周期时只恢复一次正常 tick 并留下原因；长期准确时钟、跨机器协调和可视化补偿策略仍待实现。 |
```

- [x] **Step 2: Run complete local verification**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests pass, release checklist passes, and the diff has no whitespace errors.

- [x] **Step 3: Record results in this plan**

Add a `## Verification` section with exact focused and complete test counts. Leave commit steps unexecuted unless the user explicitly asks to commit.

## Verification

- `node --test tests/localAutopilotClockRecovery.test.mjs`: 2 passed, 0 failed.
- `node --test tests/localAutopilotClockRecovery.test.mjs tests/localAutopilotLeaseRecovery.test.mjs tests/localSchedulerShutdown.test.mjs`: 6 passed, 0 failed.
- `npm.cmd test`: 125 passed, 0 failed.
- `npm.cmd run launch:local-mvp:check`: passed.
- `git diff --check`: passed (Git only reported pre-existing CRLF normalization warnings).

