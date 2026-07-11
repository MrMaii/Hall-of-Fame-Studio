# Local Delegation Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure-local, restart-safe delegation DAG that exposes overdue and dependency-blocked tasks, records accountable owner/reviewer changes, and emits idempotent local notifications.

**Architecture:** A focused pure module derives a content-minimized graph read model and creates checksummed delegation/notification receipts. The existing project service persists those receipts and task assignment fields in the local project store, while the existing API and access-control layers expose one read route and two controlled mutation routes. A file-backed acceptance script proves restart recovery and notification deduplication without any cloud dependency.

**Tech Stack:** Node.js ESM, `node:test`, existing agent project service/API/file store, SHA-256 receipts, PowerShell/npm verification.

## Global Constraints

- Pure local and open source: no SaaS, cloud queue, email provider, or remote notification dependency.
- Preserve the existing dirty worktree; do not stage, commit, push, or rewrite unrelated files.
- Do not persist task text, project briefs, secrets, or free-form reassignment reasons in governance receipts.
- All time-sensitive behavior receives an explicit ISO `now` in tests.
- Mutations are idempotent and all persisted governance receipts are checksum-verifiable after restart.

---

### Task 1: Delegation DAG read model and receipts

**Files:**
- Create: `src/agents/localDelegationGovernance.js`
- Create: `tests/localDelegationGovernance.test.mjs`

**Interfaces:**
- Consumes: project `{ id, team, tasks, localTaskDelegationChanges, localTaskDelegationNotifications }`.
- Produces: `buildLocalDelegationGovernance({ project, now })`, `createLocalTaskDelegationChange(...)`, `createLocalDelegationNotification(...)`, and receipt verification functions.

- [x] **Step 1: Write the failing pure-behavior test**

```js
const view = buildLocalDelegationGovernance({ project, now: '2026-07-10T12:00:00.000Z' });
assert.deepEqual(view.graph.layers, [['foundation'], ['build'], ['review']]);
assert.equal(view.rows.find((row) => row.taskId === 'review').blocked, true);
assert.equal(view.rows.find((row) => row.taskId === 'review').overdue, true);
assert.equal(JSON.stringify(view).includes('PRIVATE TASK TEXT'), false);
```

- [x] **Step 2: Run the test and confirm red**

Run: `node --test tests/localDelegationGovernance.test.mjs`

Expected: FAIL because `localDelegationGovernance.js` does not exist.

- [x] **Step 3: Implement the minimal pure module**

Implement deterministic task normalization, unknown/self/cyclic dependency detection, topological layers, completed/ready/scheduled/blocked/overdue flags, owner/reviewer validation, summary counts, candidate notification fingerprints, SHA-256 receipts, public projections, and fail-closed integrity status. Store identifiers and timestamps only.

- [x] **Step 4: Run the pure tests and confirm green**

Run: `node --test tests/localDelegationGovernance.test.mjs`

Expected: PASS for DAG layering, simultaneous overdue/blocking, invalid references/cycles, receipt tampering, and content minimization.

### Task 2: Local service, API, access, persistence, and notification deduplication

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `tests/localDelegationGovernance.test.mjs`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `GET /projects/:id/delegation-governance`, `POST /projects/:id/tasks/:taskId/delegation`, and `POST /projects/:id/delegation-governance/scan`.

- [x] **Step 1: Add failing API and restart tests**

```js
response = await api.handleAsync({ method: 'POST', path: `/projects/${id}/tasks/build/delegation`, body: { assignee: 'owner2', reviewerId: 'reviewer', dueAt, idempotencyKey: 'reassign-1', now } });
assert.equal(response.status, 201);
assert.equal(response.body.delegationChange.toAssignee, 'owner2');
response = await api.handleAsync({ method: 'POST', path: `/projects/${id}/delegation-governance/scan`, body: { idempotencyKey: 'scan-1', now } });
assert.equal(response.body.notificationBatch.createdCount, 2);
```

- [x] **Step 2: Run the tests and confirm red at the public API seam**

Run: `node --test tests/localDelegationGovernance.test.mjs`

Expected: FAIL with route not found or missing service method.

- [x] **Step 3: Add service mutations and routes**

Add service methods that validate team membership and reviewer independence, reject unknown/cyclic dependencies, persist capped receipt ledgers, append project events, return the refreshed governance view, and reuse existing receipts for repeated idempotency keys/fingerprints. Add access policies: observer/runtime may read; manager/security-admin may reassign; manager/runtime/security-admin may scan.

- [x] **Step 4: Prove restart, idempotency, and tamper behavior**

Run: `node --test tests/localDelegationGovernance.test.mjs`

Expected: PASS; the second scan creates zero receipts, restart returns the same receipt checksums, and a modified persisted receipt yields `degraded-integrity-invalid`.

### Task 3: P0 one-click gate and capability evidence

**Files:**
- Create: `scripts/validate-local-delegation-governance.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

**Interfaces:**
- Consumes: Task 2 HTTP routes.
- Produces: `npm run agents:delegation-governance` and a launch-gate marker for capability 37.

- [x] **Step 1: Add the failing P0 contract marker**

Register `agents:delegation-governance` in `package.json`, require it from the release checklist, and add the expected marker `P0 delegation DAG overdue blocking reassignment and notification contract`.

- [x] **Step 2: Run the gate and confirm red**

Run: `npm run agents:delegation-governance`

Expected: FAIL because the validator script is not present.

- [x] **Step 3: Implement the file-backed acceptance validator and docs**

The validator creates a local project, performs a reassignment, scans overdue/blocking conditions twice, restarts the API, and verifies checksums and zero raw task text. Update capability 37 from static DAG coverage to the new operational proof and document all three local routes.

- [x] **Step 4: Run focused and full verification**

Run:

```powershell
node --test tests/localDelegationGovernance.test.mjs tests/workModes.test.mjs
npm run agents:delegation-governance
npm run agents:work-modes:acceptance
npm test
npm run agents:product-team:smoke
npm run launch:gates
```

Expected: every command exits 0 and the full suite reports zero failed tests.

## Self-Review

- Spec coverage: DAG, overdue, blocking, responsible-party changes, local notifications, visualization-ready rows/layers, restart, access control, idempotency, and tamper detection are each assigned to a task.
- Placeholder scan: no deferred implementation or unspecified error-handling step remains.
- Type consistency: the same route names, receipt ledgers, service methods, and public fields are used across all tasks.
