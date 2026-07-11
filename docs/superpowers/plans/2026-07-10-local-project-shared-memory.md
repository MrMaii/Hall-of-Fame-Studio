# Local Project Shared Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing read-only memory-readiness summary into a governed, pure-local project shared-memory capability with citations, immutable versions, confidence, expiry, access scopes, revocation, and restart-safe integrity proof.

**Architecture:** A focused pure module owns immutable `local-project-memory-entry/v1` and revocation receipts plus identity-aware projections. The project service validates citations against real project records, rejects sensitive content, persists bounded ledgers, and appends event proof; HTTP routes enforce separate read/write roles and never cache an identity-filtered response. The existing `project-memory-readiness/v1` remains backward compatible while incorporating the shared-memory governance route and integrity summary.

**Tech Stack:** Node.js ESM, `node:test`, existing agent project service/API/file store/access control, SHA-256 checksum chains.

## Global Constraints

- Pure local and open source; no hosted vector database, SaaS memory, or cloud identity dependency.
- Preserve the dirty `codex/super-agent-production` worktree; do not stage, commit, push, or rewrite unrelated changes.
- Every memory requires at least one resolvable project citation, a confidence value and basis, an explicit future expiry, and an access scope.
- Versions are append-only and use optimistic previous-checksum validation; revocation is a separate immutable receipt.
- Manager/security can inspect all scopes; other readers receive only entries permitted for their role/Agent id.
- Identity-filtered memory results must not use the shared read-model cache.
- Memory content that triggers existing secret redaction is rejected rather than silently persisted.

---

### Task 1: Pure shared-memory governance contracts

**Files:**
- Create: `src/agents/localProjectSharedMemory.js`
- Create: `tests/localProjectSharedMemory.test.mjs`

**Interfaces:**
- Produces `createLocalProjectMemoryEntry`, `createLocalProjectMemoryRevocation`, `verifyLocalProjectMemoryEntry`, `verifyLocalProjectMemoryRevocation`, and `buildLocalProjectSharedMemory`.

- [x] **Step 1: Write one failing pure behavior test**

```js
const entry = createLocalProjectMemoryEntry({ projectId, memoryKey: 'release.rollback-required', version: 1, content, citations: [{ sourceType: 'task', sourceId: 'rollback-plan' }], confidence: 0.95, confidenceBasis: 'verified', expiresAt, accessScope: { visibility: 'agents', agentIds: ['delivery-lead'] }, actorId: 'manager', idempotencyKey: 'memory-1', now });
assert.equal(verifyLocalProjectMemoryEntry(entry).valid, true);
assert.equal(buildLocalProjectSharedMemory({ project: { id: projectId, localProjectMemoryEntries: [entry] }, actor: { role: 'agent', agentId: 'other-agent' }, now }).summary.hiddenCount, 1);
```

- [x] **Step 2: Run `node --test tests/localProjectSharedMemory.test.mjs` and confirm module-not-found red**

- [x] **Step 3: Implement only the tested entry, version-chain, expiry, confidence, scope, projection, revocation, and checksum behavior**

- [x] **Step 4: Re-run the focused test and confirm all pure cases pass**

### Task 2: Service/API persistence, citation resolution, and access enforcement

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `tests/localProjectSharedMemory.test.mjs`

**Interfaces:**
- Produces `GET|POST /projects/:id/shared-memories`, `GET /projects/:id/shared-memories/:memoryId`, `POST /projects/:id/shared-memories/:memoryId/revisions`, and `POST /projects/:id/shared-memories/:memoryId/revoke`.

- [x] **Step 1: Add a failing file-backed API test for create, scoped reads, stale revision rejection, successful revision, expiry, revocation, restart, and tamper degradation**

- [x] **Step 2: Run the focused test and confirm the routes fail before implementation**

- [x] **Step 3: Implement service methods and routes**

Validate task/submission/evidence-search/transcript/event citations against the authoritative project/store records; reject unknown citations, unsafe content, duplicate active keys, stale expected checksums and idempotency conflicts. Persist at most 500 entries and 500 revocations with local event-ledger proof.

- [x] **Step 4: Add access-control assertions and re-run the test**

Reads allow manager, runtime, security, observer, Agent and Reviewer roles but filter contents per entry scope. Writes allow manager/security only. Manager/security bypass entry scope for governance; Agent-specific reads require a matching Agent id.

### Task 3: Readiness integration and P0 gate

**Files:**
- Create: `scripts/validate-local-project-shared-memory.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`
- Modify: `src/agents/README.md`

**Interfaces:**
- Produces `npm run agents:shared-memory` and extends `project-memory-readiness/v1` with shared-memory route, counts, integrity and expiry/confidence evidence.

- [x] **Step 1: Register the command and `P0 project shared memory citation version confidence expiry and access-scope contract`, then confirm the missing-validator red**

- [x] **Step 2: Implement a file-backed validator that exercises two scopes, revision concurrency, expiry, revocation and restart**

- [x] **Step 3: Update readiness/docs/ledger without changing the existing readiness schema version or falsely claiming managed production memory**

- [x] **Step 4: Run focused tests, `agents:shared-memory`, workspace-settings compatibility, all tests, product-team smoke, launch gates, local MVP checklist and `git diff --check`**

## Self-Review

- Coverage: citations, immutable versions, confidence, expiry, access scope, conflict prevention, revocation, identity-safe querying, restart and tamper handling are explicit.
- Compatibility: the existing readiness route/schema remains intact and receives only additive proof.
- Safety: no shared identity cache, no cloud dependency, no plaintext credential storage, no in-place version mutation.
