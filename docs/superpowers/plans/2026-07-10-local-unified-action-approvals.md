# Local Unified Action Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered human-confirmation semantics with one local, bounded, attributable, single-consumption approval contract for high-cost and irreversible Agent/tool actions.

**Architecture:** Add a pure `localActionApproval.js` policy/state module and persist `local-action-approval/v1` records in project state. The backend derives risk and required roles from a closed action registry, deduplicates requests by idempotency key, accepts append-only decisions from distinct approvers, and exposes readiness through one project route. Irreversible project deletion keeps its existing confirmation token but additionally claims an exact approved action before purge; its tombstone receipt preserves the approval and execution-claim proof after project state is removed.

**Tech Stack:** Node.js ESM, built-in SHA-256, project file store, HTTP-shaped project API, local project runtime, Node test runner.

## Global Constraints

- Pure local persistence only; no SaaS approval inbox, cloud workflow engine, email, or remote identity dependency.
- Action type, risk class, irreversibility, required roles, decision count, and maximum TTL come from a backend registry and cannot be lowered by request input.
- Supported actions are `privacy:project-delete`, `provider:budget-overage`, `dead-letter:replay`, `artifact:external-export`, and `workspace:external-write`.
- `privacy:project-delete` is critical and irreversible, requires one Manager plus one security-admin, and disallows requester self-approval.
- Other registered high-risk/high-cost actions require one Manager or security-admin and remain available for existing workflows to adopt without changing their current specialist receipts in this slice.
- Every request requires project id, exact action key, requester id, reason, idempotency key, and expiry no more than the policy maximum of 24 hours.
- Reusing an idempotency key with identical intent returns the original request; conflicting intent fails closed.
- Decisions are append-only, checksummed, attributable, and unique per approver. Repeating the same decision is idempotent; changing it fails closed.
- Any rejection is terminal. Expired, rejected, cancelled, executing, or consumed approval cannot authorize new execution.
- Execution requires exact project/action type/action key match, then atomically changes approved to executing with one execution key before side effects.
- Failed pre-side-effect validation consumes nothing. Privacy deletion preserves the unified approval proof in its tombstone and cannot be replayed after project removal.
- Approval records contain action metadata and checksums only; no project content, prompts, secrets, deletion token, export content, or tool payload.

---

### Task 1: Define one approval state machine and API

**Files:**
- Create: `src/agents/localActionApproval.js`
- Create: `tests/localActionApproval.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

**Interfaces:**
- Produces: `GET|POST /projects/:projectId/action-approvals`.
- Produces: `POST /projects/:projectId/action-approvals/:approvalId/decisions`.
- Produces: service methods `getActionApprovalGovernance`, `requestActionApproval`, and `recordActionApprovalDecision`.

- [x] **Step 1: Write one failing API lifecycle test**

Request a critical deletion approval through `handleAsync`, prove backend-derived policy requires Manager and security-admin, prove identical idempotency returns the same row, reject conflicting reuse and requester self-approval, then record Manager and security-admin approval decisions and assert the status changes pending → approved.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localActionApproval.test.mjs`

Expected: FAIL because no unified approval API exists.

- [x] **Step 3: Implement registry, lifecycle, audit, and access policy**

Implement canonical SHA-256 request/decision checksums, server-derived risk policy, role coverage, distinct-person and self-approval rules, idempotency intent checksum, public redacted governance, audit logs, project ledger events, Manager/runtime/security reads, requester creation, and Manager/security decisions.

- [x] **Step 4: Run the lifecycle test and verify green**

Run: `node --test tests/localActionApproval.test.mjs`

Expected: PASS for policy derivation, idempotency, decision rules, checksums, and API routing.

---

### Task 2: Enforce single-use approval on irreversible deletion

**Files:**
- Modify: `tests/localActionApproval.test.mjs`
- Modify: `tests/localPrivacyDeletionExecution.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`

**Interfaces:**
- Consumes: approved `local-action-approval/v1` for `privacy:project-delete` and exact privacy deletion request id.
- Produces: `local-action-approval-execution-claim/v1` and approval-bound `local-project-privacy-deletion-receipt/v1` tombstone.

- [x] **Step 1: Add a failing real deletion test**

Confirm a privacy deletion request, prove execution without unified approval and with a wrong action key both fail while project/runtime data remain, approve the exact request with two independent roles, restart the file store, and execute once with the approval id plus execution key.

- [x] **Step 2: Implement exact-match execution claim**

Validate approval status/expiry/type/key, atomically persist `executing` plus checksummed claim before purge, carry approval request/decision/claim checksums into the deletion tombstone, and keep confirmation-token validation independently required.

- [x] **Step 3: Prove terminal and expiry behavior**

Assert rejected and expired approvals cannot execute, approved state survives restart, tombstone contains no confirmation token/project content, and removed project state prevents replay.

- [x] **Step 4: Run focused deletion and approval regressions**

Run: `node --test tests/localActionApproval.test.mjs tests/localPrivacyDeletionRequest.test.mjs tests/localPrivacyDeletionExecution.test.mjs`

Expected: all confirmation, approval, deletion, tombstone, and restart behavior passes.

---

### Task 3: Add governance readiness, release gate, and documentation

**Files:**
- Create: `scripts/validate-local-action-approvals.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/LOCAL_PROVIDER_TRANSPORT_RELIABILITY.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-unified-action-approvals.md`

**Interfaces:**
- Produces: `local-action-approval-governance/v1` summaries and integrity state.
- Produces: `npm.cmd run agents:action-approvals`.

- [x] **Step 1: Extend restart and tamper assertions**

Read governance after restart, verify request and decision checksums, status counts and routes, mutate one stored decision, and assert integrity/status degrade rather than trusting it.

- [x] **Step 2: Add focused contract gate and local release wiring**

Create a file-backed approval lifecycle, prove dual approval and exact irreversible execution, inspect the deletion tombstone, add `agents:action-approvals` to P0 release metadata, and keep public production overclaim blocked.

- [x] **Step 3: Document operator semantics and boundaries**

Document registry-derived risk, independence/role rules, idempotency, rejection/expiry, two-phase execution, privacy confirmation layering, tombstone proof, supported future adoption points, local identity limitations, and no cloud/SaaS dependency.

- [x] **Step 4: Run full verification**

Run: `node --check scripts/agent-project-server.mjs`, `node --check src/agents/localActionApproval.js`, `npm.cmd test`, `npm.cmd run agents:action-approvals`, `npm.cmd run launch:local-mvp:check`, and `git diff --check`.

Expected: all tests and local release contracts pass with no whitespace errors.

- [x] **Step 5: Record exact verification results**

Append exact test counts and gate results without claiming the overall 50-capability objective is complete.

## Verification Results — 2026-07-10

- `node --check scripts/agent-project-server.mjs`, `src/agents/localActionApproval.js`, `src/agents/agentProjectService.js`, `src/agents/agentProjectApi.js`, and `scripts/validate-local-action-approvals.mjs`: PASS, exit 0.
- `npm.cmd test`: PASS, 150 tests, 150 passed, 0 failed, 0 cancelled, 0 skipped.
- `npm.cmd run agents:action-approvals`: PASS, `Local unified action approval validation passed.`
- `npm.cmd run launch:local-mvp:check`: PASS, `Local MVP release checklist validation passed.`
- `git diff --check`: PASS, exit 0; only line-ending conversion warnings were emitted.
- Capability #33 is complete for the current pure-local scope. The overall 50-capability Super Agent objective remains active.
