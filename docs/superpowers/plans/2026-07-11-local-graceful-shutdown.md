# Local Graceful Shutdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and delegation was not requested.

**Goal:** Upgrade capability 24 so the local backend quiesces, drains all in-flight HTTP/scheduler work within one deadline, preserves recovery evidence, and exits truthfully.

**Architecture:** Add a runtime lifecycle state (`accepting → quiescing → closed`) and track every HTTP request until response finish/close. Shutdown atomically switches to quiescing before stopping the scheduler/listener, rejects new work, waits boundedly for scheduler and HTTP activity, then force-closes remaining sockets only after the deadline. It writes a content-minimized SHA-256 shutdown receipt beside the file store containing drain results and durable leased/recovery counts. Signal handling is single-flight and exits nonzero on incomplete drain.

**Tech Stack:** Node HTTP server, existing scheduler/durable queue, atomic local JSON receipt, `node:test` and real loopback requests.

## Global Constraints

- No new work is accepted after quiescing begins, including manual scheduler ticks.
- Existing work gets the configured drain window; the deadline is global, not multiplied per subsystem.
- A timeout is reported as incomplete and never mislabeled graceful.
- Forced socket closure does not claim to undo Provider effects; durable leases/idempotency/ambiguity ledgers remain recovery truth.
- Shutdown is idempotent and single-flight under repeated close calls or repeated OS signals.
- Receipts contain hashes/counts/status only, never request bodies, paths with secrets, prompts, responses, or credentials.
- Pure local only; service-manager restart policy and OS crash/power-loss guarantees remain external.

### Task 1: Runtime quiescing and HTTP drain

**Files:**
- Modify: `src/agents/agentProjectHttpServer.js`
- Rewrite: `tests/localSchedulerShutdown.test.mjs`

- [x] Track active requests/sockets and expose lifecycle status without leaking request content.
- [x] Set quiescing before listener/scheduler stop; reject new work and wait one bounded deadline for HTTP plus scheduler.
- [x] Prove successful drain, timeout/forced close, repeated close idempotency, and no post-quiesce dispatch.

### Task 2: Restart-safe receipt and process signals

**Files:**
- Modify: `src/agents/agentProjectHttpServer.js`
- Modify: `scripts/agent-project-server.mjs`
- Create: `tests/localGracefulShutdownReceipt.test.mjs`

- [x] Persist/reread a SHA-256 shutdown receipt with active-request hashes, socket counts, durable lease counts, and truthful complete/incomplete status.
- [x] Make SIGINT/SIGTERM single-flight and exit 0 only for a complete drain, otherwise 1.

### Task 3: P0 and total validation

**Files:**
- Create: `scripts/validate-local-graceful-shutdown.mjs`
- Modify: package, capability ledger, launch docs, and validators

- [x] Register the P0 command, mark #24 verified with abrupt-power-loss boundaries, and run focused/full/build/bundle/release/smoke/diff gates.

## Self-review

- Individual cancellation remains capability 18; this capability owns whole-runtime admission and drain.
- Durable recovery evidence is reported rather than erased when the deadline expires.
