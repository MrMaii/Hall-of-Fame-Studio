# Durable Local Task Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and subagent delegation was not requested.

**Goal:** Upgrade capability 15 from synthesized queue previews plus an Autopilot-only lease ledger into one integrity-checked, restart-safe local queue for project, Agent, and Autopilot work.

**Architecture:** Add a small pure queue state machine reused by all three existing worker lanes. Due discovery enqueues a content-minimized immutable job intent by stable idempotency key before dispatch. Workers atomically lease the stored job with a monotonically increasing fence, persist a prepared execution claim, dispatch only the exact stored route/body checksum, then acknowledge only after a valid worker execution receipt is durably present. Expired leases return to the queue with bounded retry timing; terminal failures enter the existing governed dead-letter surface. The queue remains inside the atomic file-backed project snapshot and does not add a database, daemon, or second scheduler.

**Tech Stack:** Node.js ESM, existing file store, worker queue snapshot, worker execution receipts, Autopilot lease concepts, dead-letter governance, `node:test`.

## Global Constraints

- Pure local and offline; no managed queue, Redis, cloud cron, or SaaS dependency.
- Queue state stores route, closed request metadata/checksum, trace/idempotency/fence data, never artifact/prompt/provider response content.
- State transitions are closed: `queued -> leased -> acknowledged`, `leased -> retry-wait -> queued`, or terminal `dead-lettered/cancelled`.
- Every row and queue snapshot has SHA-256 integrity; malformed state fails closed before dispatch.
- Enqueue is idempotent by exact intent checksum; same key with different intent is a conflict.
- Lease ownership uses attempt number plus random nonce, not a predictable fence alone; stale workers cannot ack or publish completion.
- Acknowledgement binds the exact stored job, fence, worker execution receipt, result checksum, trace id, and completion time.
- Crash windows are explicit: enqueue-before-dispatch, lease-before-effect, receipt-before-ack, and ack-before-compaction all resume safely.
- Old acknowledged jobs remain auditable under bounded retention; compaction cannot remove active/retry/dead-letter rows.
- Existing direct diagnostic routes remain available, but unattended scheduler execution must go through the durable queue.

### Task 1: Integrity-checked queue state machine

**Files:**
- Create: `src/agents/localDurableTaskQueue.js`
- Create: `tests/localDurableTaskQueue.test.mjs`

- [x] Add failing tests for exact enqueue idempotency/conflict, checksum tampering, fair due ordering, exclusive leases, random fenced takeover, stale ack rejection, receipt-bound acknowledgement, retry timing, cancellation terminality, and bounded acknowledged retention.
- [x] Implement pure transition functions and a deterministic public snapshot with SHA-256 integrity.
- [x] Keep payload content out of rows; bind only a validated local route, worker kind, ids, closed request body, request checksum, trace id, due time, and attempt policy.

### Task 2: Persist and execute all three worker lanes

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectStore.js`
- Modify: `tests/localDurableTaskQueue.test.mjs`
- Modify: existing Autopilot lease/recovery tests as compatibility requires

- [x] Materialize due project, Agent, and Autopilot rows into `localDurableTaskQueue` inside the atomic project snapshot before dispatch.
- [x] Replace Autopilot-only acquisition/ack logic with the shared queue while preserving existing public lease/receipt fields and legacy-only recovery compatibility.
- [x] Dispatch project and Agent due work only after durable lease acquisition; persist valid execution receipt before queue acknowledgement.
- [x] Prove restart at enqueue, active lease, expired lease, post-receipt/pre-ack, and post-ack windows across the shared state machine and all three real lanes without duplicate acknowledged work.
- [x] Preserve exhausted jobs as immutable `dead-lettered` queue state without deleting the failure hash; capability 20 owns approved replay/close integration.

### Task 3: Private operational API and scheduler contract

**Files:**
- Create: `tests/localDurableTaskQueueApi.test.mjs`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `src/agents/agentProjectHttpServer.js`

- [x] Add Manager/security read-only `/projects/:id/durable-task-queue` and security-admin scan/cancel controls; derive actor identity from verified access, not body overrides.
- [x] Make scheduler due endpoints persist discovery before work and return the exact durable task row; the queue route returns queued/leased/acked/retry/dead-letter counts.
- [x] Keep shutdown ownership in capability 24, which will stop discovery, refuse new leases, drain active leases, and report residual queued jobs without deleting them.
- [x] Add file-backed API/restart tests for all lanes, actor override resistance, tamper fail-closed behavior, active/expired lease recovery, and receipt-before-ack recovery.

### Task 4: P0 evidence and next-gap audit

**Files:**
- Create: `scripts/validate-local-durable-task-queue.mjs`
- Modify: `package.json`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LOCAL_AUTH.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `src/agents/README.md`

- [x] Register `npm run agents:local-durable-task-queue` and its P0 marker.
- [x] Mark capability 15 verified only after all three unattended lanes persist enqueue/lease/receipt/ack/recovery evidence.
- [x] Run focused tests, queue/lease/dead-letter/scheduler regressions, full tests, build, bundle, launch gates, Local MVP checklist, product-team smoke, diff check, and the total audit.

## Self-review

- Spec coverage: persistence, exact idempotency, lease fencing, retry, acknowledgement, crash recovery, dead-letter handoff, cancellation, shutdown, operations visibility, and all three worker lanes are explicit.
- Simplicity: one pure state machine in the existing project snapshot; existing scheduler, worker routes, receipts, and dead-letter governance remain the public execution surfaces.
- Boundary: this makes the single-host local queue trustworthy; it does not claim multi-host consensus, externally durable storage, or managed-production cutover.
