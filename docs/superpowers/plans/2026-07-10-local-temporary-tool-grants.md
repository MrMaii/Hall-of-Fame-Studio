# Local Temporary Tool Grants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace permanent-only project tool grants with bounded local temporary grants whose expiry, revocation, consumption, and tamper-evident invocation receipts remain authoritative across restart.

**Architecture:** Keep `project-tool-grant-policy/v1` as the durable baseline and add `local-tool-grant-lease/v1` only as a narrow exception for one project, Agent, exact operation, and optional task. Provider policy evaluation may remove only `agent-tool-grant-missing` when a matching active lease exists; the Provider reservation atomically occupies one lease invocation, resolution consumes the attempt, and the Provider usage append writes a redacted `local-tool-invocation-receipt/v1` into a checksum chain. The HTTP-shaped API exposes create/list/revoke only; no route mutates or deletes receipts.

**Tech Stack:** Node.js ESM, project file store, Provider policy/reservations, HTTP-shaped project API, SHA-256 persistence checksums, Node test runner.

## Global Constraints

- Pure local persistence only; no cloud IAM, SaaS authorization, or remote approval dependency.
- Temporary grants never modify the baseline `project-tool-grant-policy/v1`.
- A grant requires exact `operation`, exact `agentId`, `grantedBy`, purpose, one to 100 invocations, and expiry no more than 24 hours after creation.
- Optional `taskId` matches exactly and never authorizes an unscoped or different task.
- A temporary grant removes only `agent-tool-grant-missing`; provider/model allowlists, budgets, rate limits, circuit breakers, membership, and route access remain authoritative.
- Lease reservation and Provider reservation persist in one project save so concurrent local calls cannot exceed the grant.
- A dispatched attempt consumes one invocation even when the Provider fails; a denial before dispatch consumes none.
- Invocation receipts contain identifiers, authorization source, outcome, timestamps, and checksums only; no prompts, queries, result bodies, credentials, or secret material.
- Invocation receipts are append-only through public APIs and form a previous-checksum chain that is verified on read.
- Expired, exhausted, and revoked grants remain visible and cannot authorize work after restart.

---

### Task 1: Define the temporary grant public contract

**Files:**
- Create: `tests/localTemporaryToolGrant.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

**Interfaces:**
- Produces: `GET|POST /projects/:projectId/tool-grant-leases`.
- Produces: `POST /projects/:projectId/tool-grant-leases/:leaseId/revoke`.
- Produces: `getToolGrantLeases`, `createToolGrantLease`, and `revokeToolGrantLease` service methods.

- [x] **Step 1: Write one failing API lifecycle test**

Create a file-backed project whose baseline removes `search:evidence`. Assert a Manager can create an Agent/operation/task-scoped lease through `handleAsync`, GET returns `local-tool-grant-governance/v1`, and invalid missing-Agent, over-24-hour, and zero-invocation requests fail.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localTemporaryToolGrant.test.mjs`

Expected: FAIL because the lease API does not exist.

- [x] **Step 3: Implement validated lifecycle records and access policy**

Add `local-tool-grant-lease/v1` records with status, remaining/reserved/consumed counts, checksum, create/revoke audit logs, and project ledger events. Add Manager/security-admin write access and Manager/runtime/security-admin read access. Route project id must override any body-supplied project id.

- [x] **Step 4: Run the lifecycle test and verify green**

Run: `node --test tests/localTemporaryToolGrant.test.mjs`

Expected: PASS for validation, API routing, access metadata, and file persistence.

---

### Task 2: Authorize and atomically consume real Provider attempts

**Files:**
- Modify: `tests/localTemporaryToolGrant.test.mjs`
- Modify: `src/agents/agentProjectService.js`

**Interfaces:**
- Consumes: `local-tool-grant-lease/v1` active records.
- Produces: `policyDecision.toolGrantLease` and Provider reservations carrying `toolGrantLeaseId` / `toolGrantReservedInvocationCount`.

- [x] **Step 1: Add a failing real-dispatch test**

Prove the baseline-denied search never reaches transport, a matching task-scoped lease permits exactly its configured attempts, a wrong Agent/operation/task remains denied, and the next call is denied after exhaustion.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localTemporaryToolGrant.test.mjs`

Expected: FAIL because policy evaluation does not consume temporary grants.

- [x] **Step 3: Integrate exact matching and atomic reservation**

Select the earliest-expiring matching active lease only when baseline authorization is missing. Reserve one invocation with the Provider budget reservation; on Provider reservation resolution remove the provisional count and consume one dispatched attempt. Recompute the lease checksum on every state transition.

- [x] **Step 4: Run focused Provider regressions**

Run: `node --test tests/localTemporaryToolGrant.test.mjs tests/localProviderBudgetReservation.test.mjs tests/localProviderCostGovernance.test.mjs`

Expected: temporary grant tests and existing cost/concurrency reservation behavior all pass.

---

### Task 3: Add tamper-evident invocation receipts and restart proof

**Files:**
- Modify: `tests/localTemporaryToolGrant.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Create: `scripts/validate-local-tool-grant-governance.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_PROVIDER_TRANSPORT_RELIABILITY.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

**Interfaces:**
- Produces: append-only `local-tool-invocation-receipt/v1` records.
- Produces: governance `receiptIntegrity` with row-checksum and previous-checksum-chain verification.
- Produces: `npm.cmd run agents:local-tool-grants`.

- [x] **Step 1: Add failing receipt and restart assertions**

Assert each denied or dispatched Provider attempt yields one redacted checksummed receipt linked to its Provider usage record and authorization source; lease-backed receipts include lease id/checksum. Restart the file store, verify exhausted/expired/revoked states, receipt order and chain integrity, and prove no public mutation/delete receipt route exists.

- [x] **Step 2: Implement receipt append and integrity verification**

Write receipts while appending Provider usage records, point each new receipt to the prior newest checksum, verify stored checksum plus chronological previous links on read, cap local retention without rewriting surviving receipts, and expose only compact redacted metadata.

- [x] **Step 3: Add focused contract gate and documentation**

Add `agents:local-tool-grants`, include it in the local MVP checklist, and document baseline-vs-temporary semantics, limits, exact scope, failure consumption, receipt redaction, tamper evidence, restart behavior, and local-only boundary.

- [x] **Step 4: Run full verification**

Run: `node --check scripts/agent-project-server.mjs`, `npm.cmd test`, `npm.cmd run agents:local-tool-grants`, `npm.cmd run launch:local-mvp:check`, and `git diff --check`.

Expected: all tests and local release contracts pass with no whitespace errors.

- [x] **Step 5: Record exact verification results**

Append exact test counts and gate results to this plan without claiming the full 50-capability goal is complete.

## Verification Results

- `node --check scripts/agent-project-server.mjs`: PASS (exit 0).
- `node --check src/agents/agentProjectService.js`: PASS (exit 0).
- `npm.cmd test`: PASS (147 tests, 147 passed, 0 failed).
- `npm.cmd run agents:local-tool-grants`: PASS (`Local temporary tool grant governance validation passed.`).
- `npm.cmd run launch:local-mvp:check`: PASS (`Local MVP release checklist validation passed.`).
- `git diff --check`: PASS (exit 0; existing CRLF normalization warnings only).
