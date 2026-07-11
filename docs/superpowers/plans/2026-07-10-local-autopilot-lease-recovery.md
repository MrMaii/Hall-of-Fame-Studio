# Local Autopilot Lease Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each local Autopilot due-work item a persisted, fenced lease and a stable idempotency key so restart recovery can block an unexpired owner, take over an expired owner, and reuse an acknowledged receipt.

**Architecture:** Keep the existing file-backed `AgentProjectFileStore`, bounded Autopilot session ledger, and `/workers/autopilot/due` execution path. A small pure helper manages `local-autopilot-lease/v1` rows stored on the project; the due-worker persists a lease before calling the existing tick, and acknowledges it only after the tick receipt is persisted. The existing tick receipt receives the same idempotency/lease identity.

**Tech Stack:** Node.js ESM, JSON file store with atomic replacement, existing Agent Project service, Node test runner.

## Global Constraints

- Pure local only; do not add a cloud queue, SaaS database, or second worker engine.
- The public seam is `service.runDueAutonomousRunControlSessions()` over a restarted `createAgentProjectFileStore`.
- A non-expired lease must prevent another local worker from executing the item.
- An expired lease may be taken over only with a new fence token and an incremented attempt count.
- An acknowledged execution receipt must be returned without executing the session tick again.
- The scheduled `dueAt` used to construct the key must remain stable when a task is late; manual forced runs retain their explicit forced timestamp behavior.
- This improves crash recovery but does not claim exactly-once behavior for an external provider call interrupted before its receipt is written.

---

### Task 1: Define and test the durable local lease state machine

**Files:**

- Create: `src/agents/localAutopilotLease.js`
- Create: `tests/localAutopilotLease.test.mjs`

**Interfaces:**

- `acquireLocalAutopilotLease({ rows, projectId, sessionId, idempotencyKey, dueAt, now, leaseSeconds })` returns `{ action, lease, rows }` where `action` is `acquired`, `lease-active`, `recovered-expired-lease`, or `already-acked`.
- `acknowledgeLocalAutopilotLease({ rows, idempotencyKey, fenceToken, receipt, now })` returns `{ acknowledged, lease, rows }` and rejects a stale fence token.

- [x] **Step 1: Write the failing state-machine tests**

```js
const first = acquireLocalAutopilotLease({
  rows: [], projectId: 'p1', sessionId: 's1', idempotencyKey: 'idem_1',
  dueAt: '2026-07-10T10:00:00.000Z', now: '2026-07-10T10:00:00.000Z', leaseSeconds: 60,
});
assert.equal(first.action, 'acquired');
assert.equal(acquireLocalAutopilotLease({ ...input, rows: first.rows, now: '2026-07-10T10:00:30.000Z' }).action, 'lease-active');
const recovered = acquireLocalAutopilotLease({ ...input, rows: first.rows, now: '2026-07-10T10:01:01.000Z' });
assert.equal(recovered.action, 'recovered-expired-lease');
assert.equal(recovered.lease.attemptCount, 2);
assert.notEqual(recovered.lease.fenceToken, first.lease.fenceToken);
```

Add a second test that acknowledges a lease, verifies the same key returns `already-acked`, and verifies an old fence cannot acknowledge the recovered lease.

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/localAutopilotLease.test.mjs`

Expected: failure because the helper module does not exist.

- [x] **Step 3: Implement the pure lease helper**

```js
export function acquireLocalAutopilotLease({ rows = [], projectId, sessionId, idempotencyKey, dueAt, now, leaseSeconds = 60 } = {}) {
  const existing = rows.find((row) => row.idempotencyKey === idempotencyKey) || null;
  if (existing?.status === 'acked') return { action: 'already-acked', lease: existing, rows };
  if (existing?.status === 'leased' && Date.parse(existing.expiresAt) > Date.parse(now)) {
    return { action: 'lease-active', lease: existing, rows };
  }
  const attemptCount = (existing?.attemptCount || 0) + 1;
  const lease = { ...existing, schemaVersion: 'local-autopilot-lease/v1', projectId, sessionId, idempotencyKey, dueAt, status: 'leased', attemptCount, fenceToken: `fence:${idempotencyKey}:${attemptCount}`, acquiredAt: now, expiresAt: new Date(Date.parse(now) + leaseSeconds * 1000).toISOString(), acknowledgedAt: null, receipt: null };
  return { action: existing ? 'recovered-expired-lease' : 'acquired', lease, rows: [lease, ...rows.filter((row) => row.idempotencyKey !== idempotencyKey)] };
}
```

Implement acknowledgement by matching both `idempotencyKey` and `fenceToken`, preserving the bounded ledger order, and storing only the receipt metadata required for duplicate suppression (`tickId`, `receiptChecksum`, `status`).

- [x] **Step 4: Run focused test and confirm it passes**

Run: `node --test tests/localAutopilotLease.test.mjs`

Expected: all acquisition, active-owner, expired recovery, stale-fence, and acknowledged-receipt assertions pass.

### Task 2: Persist the lease around the existing Autopilot due-worker

**Files:**

- Modify: `src/agents/agentProjectService.js:26, 6471-6500, 53659-54140, 61720-62020`
- Create: `tests/localAutopilotLeaseRecovery.test.mjs`

**Interfaces:**

- `runDueAutonomousRunControlSessions()` exposes skipped rows with reason `autopilot-lease-active` or `autopilot-already-acked`.
- A processed row includes `idempotencyKey`, `leaseKey`, `fenceToken`, `leaseAction`, and its persisted execution receipt.

- [x] **Step 1: Write the failing file-restart test**

Create a file-backed project with one due active session. Seed an unexpired `localAutopilotLeaseLedger` row, restart the file store, and assert:

```js
const summary = restartedService.runDueAutonomousRunControlSessions({ now, forceDue: false });
assert(summary.skipped.some((row) => row.sessionId === sessionId && row.reason === 'autopilot-lease-active'));
assert.equal(restartedService.getAutonomousRunControlSessions(projectId).sessions[0].tickCount, 0);
```

Then advance past `expiresAt`, run the due-worker, and assert exactly one tick is recorded with `attemptCount === 2`, a new fence token, and a persisted `acked` lease. Restart again, force the same scheduled key, and assert the existing receipt is returned without increasing `tickCount`.

- [x] **Step 2: Run the focused recovery test and confirm it fails**

Run: `node --test tests/localAutopilotLeaseRecovery.test.mjs`

Expected: failure because leases are currently display-only queue fields and the due-worker executes despite the persisted row.

- [x] **Step 3: Keep late scheduled keys stable**

In `evaluateAutopilotRunControlSessionSchedule`, retain the computed scheduled timestamp in `dueAt` even after it is due:

```js
const scheduledDueAt = lastTickAt
  ? new Date(safeDateMs(lastRunAt, safeDateMs(now)) + (Number(intervalMs) || 60_000)).toISOString()
  : session.startedAt || session.createdAt || session.updatedAt || now;
return { due, dueAt: scheduledDueAt, nextRunAt: due ? now : scheduledDueAt, ... };
```

For an explicitly forced run, continue using the supplied `now` as its due timestamp.

- [x] **Step 4: Acquire before tick and persist the result**

Before each due-session tick, build the existing Autopilot idempotency key from project, session, stable `dueAt`, and reason; acquire through `acquireLocalAutopilotLease`; call `saveProject` immediately with `localAutopilotLeaseLedger`. On `lease-active` or `already-acked`, add a skipped result and do not call the tick.

Pass `workerIdempotencyKey`, `workerLeaseKey`, and `workerFenceToken` into `tickAutonomousRunControlSession`. Make its `buildWorkerRunControlFields` call use those values so the stored execution receipt proves the job identity.

- [x] **Step 5: Acknowledge only the matching fence after the receipt exists**

After a successful non-error tick returns its receipt, call `acknowledgeLocalAutopilotLease` with the same fence and receipt metadata, persist the returned project, and return that project/receipt in the due-worker row. Do not acknowledge error ticks; their lease remains observable until expiry.

- [x] **Step 6: Run focused recovery test and confirm it passes**

Run: `node --test tests/localAutopilotLeaseRecovery.test.mjs`

Expected: unexpired owner blocks work; expired owner is safely recovered; acked key reuses receipt; all assertions pass after a file-store restart.

### Task 3: Surface the verified boundary and regress the local runtime

**Files:**

- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`

- [x] **Step 1: Update the capability ledger truthfully**

Mark durable tasks and idempotent execution as partial coverage backed by a local lease/restart test. State the remaining limit: external calls interrupted before a durable receipt still require provider-level idempotency support.

- [x] **Step 2: Run focused and regression commands**

Run: `node --test tests/localAutopilotLease.test.mjs tests/localAutopilotLeaseRecovery.test.mjs && npm.cmd test && npm.cmd run agents:server:validate && npm.cmd run launch:local-mvp:check`

Expected: every command exits 0.

## Self-Review

- The solution writes authoritative state before execution rather than generating a read-only queue preview.
- A late task keeps one deterministic key across restart, while manual forced work remains a new intentional request.
- Fence tokens prevent an older recovered owner from acknowledging a newer lease.
- The plan does not claim impossible exactly-once semantics for an unacknowledged external side effect.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
