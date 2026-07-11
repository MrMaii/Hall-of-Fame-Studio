# Local Provider Budget Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make project provider budget checks atomic across concurrent local requests.

**Architecture:** Persist temporary provider budget reservations on the project before dispatching a provider request. Policy evaluation counts active reservations together with settled usage; the caller settles the reservation with actual cost or releases it on denied, failed, aborted, or timed-out work. Expired reservations are ignored and reported for recovery.

**Tech Stack:** Node.js ESM, existing file-backed project store, provider usage ledger, Node test runner.

## Global Constraints

- Pure local persistence; no cloud queue, distributed lock, or SaaS metering.
- Reserve before the provider network call; never claim a budget reservation after dispatch.
- Every reservation has project id, operation, estimated cents, created/expires timestamps, and a checksum.
- Settled usage remains the financial/audit fact; reservations only prevent concurrent oversubscription.
- Expired reservations must not indefinitely consume capacity.

---

### Task 1: Add failing concurrent-admission coverage

**Files:**
- Create: `tests/localProviderBudgetReservation.test.mjs`
- Modify: `src/agents/agentProjectService.js`

- [x] **Step 1: Write a test that starts two provider-backed Agent operations with a one-request hourly policy**

The first operation blocks at its provider transport; the second must receive `hourly-rate-limit-exceeded` before its transport starts. Release the first operation and assert its reservation is settled into the usage ledger.

- [x] **Step 2: Run the focused test**

Run: `node --test tests/localProviderBudgetReservation.test.mjs`

Expected: FAIL because concurrent evaluations only inspect settled usage.

### Task 2: Persist, settle, and release reservations

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/localProviderBudgetReservation.test.mjs`

- [x] **Step 1: Implement project-local reservation helpers**

Expose internal helpers that add `providerBudgetReservations` entries before dispatch, count unexpired active entries in policy evaluation, and atomically save the project through the existing file store seam.

- [x] **Step 2: Wire the provider dispatch paths**

Apply the helpers to model artifact drafts and both evidence-search paths. Settle actual cost on success; release on denial, timeout, thrown error, or cancellation.

- [x] **Step 3: Run focused regression**

Run: `node --test tests/localProviderBudgetReservation.test.mjs tests/modelProvider.test.mjs tests/searchProvider.test.mjs`

Expected: PASS.

### Task 3: Ledger and release gate

**Files:**
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-provider-budget-reservations.md`

- [x] **Step 1: Update capability 22 with verified reservation semantics**

- [x] **Step 2: Run full verification**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

- [x] **Step 3: Record exact verification results**

Verification on 2026-07-10:

- `npm.cmd test`: PASS, 130 tests / 130 passed / 0 failed.
- `npm.cmd run launch:local-mvp:check`: PASS, local MVP release checklist validation passed.
- `git diff --check`: PASS, with only existing CRLF-to-LF working-tree warnings.
