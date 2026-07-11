# Local Dead-Letter Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and delegation was not requested.

**Goal:** Upgrade capability 20 so durable worker failures can be inspected, closed, or replayed exactly once through the same queue/lease/receipt contract, with no destructive loss of the original failure.

**Architecture:** Treat `dead-lettered` durable queue rows as the canonical local dead-letter facts and retain legacy worker-derived rows for compatibility. A replay derives one exact, content-minimized replay intent from the sealed source row, persists it, leases it, dispatches with its fence, persists the worker receipt, acknowledges, then writes a checksum-bound disposition. Recovery recognizes replay receipts or acknowledged replay jobs and completes the missing state without repeating business work.

**Tech Stack:** Existing durable queue/file store, project event ledger, private API/access control, Node.js `node:test`.

## Global Constraints

- Original dead-letter rows are immutable terminal evidence; replay creates a new linked job.
- Replay uses the exact stored worker kind, identifiers, route, content-minimized request body, trace, and source checksum. Caller request overrides are rejected for durable rows.
- The authenticated server actor replaces body actor fields. Reads allow Manager/security; mutations require security-admin.
- Approval reason is hashed in durable governance receipts; raw reasons are not stored in queue/disposition evidence.
- A source dead letter has at most one replay intent. Same approval/retry resumes; changed source/intent fails closed.
- A crash after business receipt, queue acknowledgement, or before disposition must not re-execute the effect.
- Closing never dispatches work and does not delete the source failure.
- Pure local scope only; no external paging, distributed quarantine, or cross-machine consensus claim.

### Task 1: Exact replay state machine

**Files:**
- Modify: `src/agents/localDurableTaskQueue.js`
- Modify: `tests/localDurableTaskQueue.test.mjs`

- [x] Derive one replay intent from an integrity-valid dead-letter row, bind source id/checksum, and reject nonterminal/tampered sources.
- [x] Prove enqueue idempotency, exact request preservation, new job identity, and source retention.

### Task 2: Service recovery and private API

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Rewrite: `tests/localDeadLetterOperations.test.mjs`

- [x] Merge durable and legacy dead letters into one integrity-aware read model with immutable source proof.
- [x] Replay durable rows through enqueue/lease/receipt/ack/disposition, recover every crash boundary, and keep legacy compatibility explicit.
- [x] Close without dispatch; persist server-owned actor, reason/approval hashes, source checksum, replay job/receipt checksum, and SHA-256 disposition.
- [x] Enforce Manager/security reads and security-admin-only mutations with body actor override blocked.

### Task 3: P0 and total validation

**Files:**
- Create: `scripts/validate-local-dead-letter-governance.mjs`
- Modify: `package.json`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: launch/checklist docs and validators

- [x] Register `npm run agents:local-dead-letter-governance`, mark #20 verified with local-only limitations, and run focused/full/build/bundle/release/smoke/diff gates.

## Self-review

- This reuses the durable queue instead of creating a second replay engine.
- External alerts and isolated OS sandboxes are not required to make single-host replay safe and are stated as boundaries.
