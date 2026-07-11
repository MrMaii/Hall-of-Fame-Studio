# Local Rate and Concurrency Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and delegation was not requested.

**Goal:** Upgrade capability 22 with process-safe local Provider admission control across project, actor, model, and tool dimensions.

**Architecture:** Add a small checksum-protected admission ledger beside the project snapshot. Every Provider dispatch first acquires a short filesystem lock, rereads the ledger, prunes expired claims, atomically checks hourly and active-concurrency dimensions, and writes one claim before transport. Completion/failure/cancellation settles the claim under the same lock. The existing project budget reservation remains the cost/approval audit projection; this ledger is the cross-process admission authority.

**Tech Stack:** Node.js synchronous filesystem primitives, atomic rename, SHA-256, existing Provider policy/service, `node:test`, child-process concurrency tests.

## Global Constraints

- Pure local single-host scope; no distributed Redis, cloud limiter, or multi-host fairness claim.
- Lock acquisition is bounded, owner-attributed, and can recover only a stale lock whose PID is no longer alive.
- Ledger integrity failure is fail-closed. Every claim/settlement and snapshot has SHA-256.
- Claims precede Provider transport and contain no prompts, queries, responses, credentials, or raw actor identifiers.
- Hourly quotas and active concurrency are independently enforceable per project, actor hash, model, and tool/operation.
- Expired active claims stop consuming concurrency but remain bounded audit history.
- Project snapshot save failure releases the admission claim; Provider completion/failure/cancellation settles it.
- Rate policy defaults remain explicit; zero means unlimited rather than an invented hidden limit.

### Task 1: Process-safe admission ledger

**Files:**
- Create: `src/agents/localRateLimitLedger.js`
- Create: `tests/localRateLimitLedger.test.mjs`

- [x] Test dimension limits, concurrency, settlement, expiry, restart, integrity tamper, bounded lock timeout, stale dead-owner recovery, and two-process contention.
- [x] Implement atomic locked claim/settle/snapshot with content-minimized SHA-256 receipts.

### Task 2: Provider integration and policy

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/localProviderBudgetReservation.test.mjs`

- [x] Normalize per-actor/model/tool hourly quotas and per-project concurrency from policy/env.
- [x] Claim before every model/search reservation, release on pre-dispatch save failure, settle/release with the existing Provider reservation, and expose redacted governance status.
- [x] Prove two file-backed service instances cannot oversubscribe one local Provider scope.

### Task 3: P0 and total validation

**Files:**
- Create: `scripts/validate-local-rate-concurrency-governance.mjs`
- Modify: package, capability ledger, launch docs, and validators

- [x] Register the P0 command, mark #22 verified with single-host limits, and run focused/full/build/bundle/release/smoke/diff gates.

## Self-review

- This addresses multi-process admission without pretending the entire project snapshot is a multi-writer database.
- Cross-host fairness and globally linearizable quotas remain outside the pure-local contract.
