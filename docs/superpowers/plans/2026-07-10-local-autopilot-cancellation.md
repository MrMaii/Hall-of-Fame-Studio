# Local Autopilot Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a local operator permanently cancel an Autopilot session, stop its in-flight local provider request, and prevent it from resuming after restart.

**Architecture:** Cancellation is a durable terminal session state in the existing project ledger. The service maintains an in-process `AbortController` only while an async provider-evidence tick is active; a cancel write both records the terminal state and aborts that request. Scheduler scans already select only `running` and `waiting` sessions, so cancelled rows are naturally excluded after a restart.

**Tech Stack:** Node.js ESM, existing file-backed project store, local JSONL audit/event ledger, `AbortController`, Node test runner, React UI.

## Global Constraints

- Pure local only; no cloud queue, remote cancellation service, or SaaS telemetry.
- Cancellation is terminal; it is not a hidden pause and must not be resumed by the scheduler.
- Preserve the cancellation actor, reason, time, event and log in the local project evidence.
- Abort only requests started by this process; a provider that has already accepted a side effect remains subject to its own idempotency boundary.
- Do not serialize an `AbortSignal` into a durable receipt or project snapshot.

---

### Task 1: Prove a cancelled session stays stopped after a file-backed restart

**Files:**

- Create: `tests/localAutopilotCancellation.test.mjs`
- Modify: `src/agents/agentProjectService.js:54796-54882`

**Interfaces:**

- Produces `service.cancelAutonomousRunControlSession({ projectId, sessionId, actor, reason, now })`.
- Returns `{ route: 'autonomous-run-control-session-cancelled', autonomousRunControlSession }` where the session has `status: 'cancelled'`.

- [x] **Step 1: Write a file-backed cancellation restart test**

Create a project, start a named session, cancel it, reopen the file store, and run the due worker:

```js
const cancelled = service.cancelAutonomousRunControlSession({
  projectId,
  sessionId,
  actor: 'Local operator',
  reason: 'operator cancelled delivery',
  now: '2026-07-10T10:01:00.000Z',
});
assert.equal(cancelled.autonomousRunControlSession.status, 'cancelled');

const restarted = createAgentProjectService({ store: restartedStore });
const due = restarted.runDueAutonomousRunControlSessions({ now: '2026-07-10T10:02:00.000Z' });
assert(due.skipped.some((row) => row.reason === 'autopilot-no-active-session'));
assert.equal(restarted.getAutonomousRunControlSessions(projectId).sessions[0].status, 'cancelled');
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/localAutopilotCancellation.test.mjs`

Expected: FAIL because no cancellation service method or terminal state exists.

- [x] **Step 3: Persist a terminal cancellation receipt**

Add `cancelAutonomousRunControlSession` next to `pauseAutonomousRunControlSession`. It must write `status: 'cancelled'`, `cancelledAt`, `cancelledBy`, `cancellationReason`, event/log ids and a checksum. Repeating cancellation must return the existing cancelled session without producing another event.

- [x] **Step 4: Run the focused test and confirm it passes**

Run: `node --test tests/localAutopilotCancellation.test.mjs`

Expected: PASS; the due worker sees no active session after a fresh file-store read.

### Task 2: Abort an in-flight local provider-evidence tick

**Files:**

- Modify: `src/agents/agentProjectService.js:47401-47520, 54100-54250, 55056-55120, 61423-61695`
- Modify: `tests/localAutopilotCancellation.test.mjs`

**Interfaces:**

- `cancelAutonomousRunControlSession` aborts the active local controller for the same `projectId` and `sessionId`.
- `tickAutonomousRunControlSessionWithProviderEvidence` passes an ephemeral `AbortSignal` into provider search work.

- [x] **Step 1: Extend the test with an abort-aware local provider**

Use a provider whose `search({ signal })` waits for `signal.abort`, begin a provider-evidence tick, wait for the provider to start, then cancel the session. Assert the provider observed the abort, the tick rejects with `autopilot-session-cancelled`, and no evidence submission was written after cancellation.

- [x] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/localAutopilotCancellation.test.mjs`

Expected: FAIL because the active search receives no cancellation signal.

- [x] **Step 3: Propagate the abort signal without persisting it**

Maintain an in-memory controller map keyed by project and session for only the awaited provider search. Pass `signal` through `tickAutonomousRunControlSessionWithProviderEvidence`, `runAgentAutonomousActionQueueItemWithProviderEvidence`, and `runAgentWorkCycleWithProviderEvidence`; pass it to `searchProvider.search`. Before local fallback or persistence, throw `new Error('autopilot-session-cancelled')` if the signal is aborted. Remove the controller in a `finally` attached to the awaited provider operation.

- [x] **Step 4: Run the focused test and confirm pass**

Run: `node --test tests/localAutopilotCancellation.test.mjs`

Expected: PASS; cancellation reaches the active local provider request and the cancelled session remains terminal.

### Task 3: Expose the operator control and validate the local release gates

**Files:**

- Modify: `src/agents/agentProjectApi.js:3390-3445`
- Modify: `src/App.jsx:22448-22530, 30000-30025`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`

- [x] **Step 1: Add the local API route and UI action**

Expose `POST /projects/:projectId/autonomous-run-control/sessions/:sessionId/cancel`. Add a distinct `Cancel` control beside `Pause`; it sends the operator and reason to that route, refreshes the returned backend read models, and never labels a terminal cancellation as a resumable pause.

- [x] **Step 2: Update the capability ledger**

Update capability 18 to record durable Autopilot cancellation, restart suppression and in-process provider abort. Leave workspace-process cancellation and provider-side idempotency as remaining local boundaries unless an executable worker owns such a process.

- [x] **Step 3: Run focused and regression verification**

Run: `node --test tests/localAutopilotCancellation.test.mjs && npm.cmd test && npm.cmd run launch:local-mvp:check && npm.cmd run agents:scenario`

Expected: every command exits 0.

## Self-Review

- Cancellation is distinct from pause and has durable evidence.
- A restart cannot schedule a cancelled session.
- An in-flight local provider request receives abort and cannot fall back to a new local write after cancellation.
- The UI/API operation is local-auth governed through the existing project route policy.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
