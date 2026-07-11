# Local Privacy Deletion Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local project deletion a durable, double-confirmed and inspectable workflow before any active project data can be purged.

**Architecture:** A first request creates a random confirmation token but persists only its SHA-256 hash, expiry and operator evidence in the project ledger. A later confirmation verifies the one-time token after restart. A follow-up execution phase will use only a confirmed, unexpired request to remove active snapshot data and project-runtime data while leaving a tombstone outside the project root.

**Tech Stack:** Node.js ESM, `node:crypto`, file-backed project store, local runtime, Node test runner.

## Global Constraints

- Pure local only; no cloud deletion APIs or remote data plane.
- The raw confirmation token is returned exactly once and must never appear in the project snapshot, logs, events, export packages or audit stream.
- Request and confirmation are non-destructive; physical cleanup is a separate explicit execution task.
- A confirmed request must expire and cannot be replayed after it is consumed.
- Existing append-only security audit and user-made backup copies remain explicit residual-data boundaries.

---

### Task 1: Persist a restart-safe double-confirmation request

**Files:**

- Create: `tests/localPrivacyDeletionRequest.test.mjs`
- Modify: `src/agents/agentProjectService.js:47401-62100`

**Interfaces:**

- `service.requestProjectPrivacyDeletion({ projectId, actor, reason, now, expiresInMs })` returns `{ privacyDeletionRequest, confirmationToken }`.
- `service.confirmProjectPrivacyDeletion({ projectId, requestId, confirmationToken, actor, now })` returns a request with `status: 'confirmed'`.

- [x] **Step 1: Write the file-backed request/confirmation test**

Create a project in the file store, request deletion, assert the raw token is absent from `JSON.stringify(store.snapshot())`, restart the store, reject a wrong token, then confirm using the returned token:

```js
assert.equal(request.privacyDeletionRequest.status, 'pending-confirmation');
assert.equal(JSON.stringify(store.snapshot()).includes(request.confirmationToken), false);
assert.throws(() => restarted.confirmProjectPrivacyDeletion({ confirmationToken: 'wrong' }), /privacy-deletion-confirmation-invalid/);
assert.equal(confirmed.privacyDeletionRequest.status, 'confirmed');
```

- [x] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/localPrivacyDeletionRequest.test.mjs`

Expected: FAIL because no deletion request service methods exist.

- [x] **Step 3: Add hashed request and confirmation records**

Use `randomUUID()` for the raw token and `createHash('sha256')` for the stored `confirmationTokenHash`. Set a bounded 15-minute default expiry. Write request/confirmation events and logs without the raw token. Reject expired, non-pending and hash-mismatched confirmation attempts.

- [x] **Step 4: Run the focused test and confirm pass**

Run: `node --test tests/localPrivacyDeletionRequest.test.mjs`

Expected: PASS; a restart preserves the request but not the raw token.

### Task 2: Expose the local API confirmation boundary

**Files:**

- Modify: `src/agents/agentProjectApi.js:2200-2260`
- Modify: `tests/localPrivacyDeletionRequest.test.mjs`

- [x] **Step 1: Extend the test with API request and confirm routes**

Use `POST /projects/:projectId/privacy/deletion-requests` then `POST /projects/:projectId/privacy/deletion-requests/:requestId/confirm`. Assert the create response contains one raw token, while the confirm response does not.

- [x] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/localPrivacyDeletionRequest.test.mjs`

Expected: FAIL with method-not-allowed before routes exist.

- [x] **Step 3: Add routes and redacted response shapes**

Return `privacyDeletionRequest` from both endpoints. Include `confirmationToken` only in the create response and never in `publicProjectResult` payloads or project snapshots.

- [x] **Step 4: Run the focused test and confirm pass**

Run: `node --test tests/localPrivacyDeletionRequest.test.mjs`

Expected: PASS; create and confirmation work through the public local API seam.

### Task 3: Execute confirmed active-data purge with a tombstone

**Files:**

- Modify: `src/agents/agentProjectStore.js`
- Modify: `src/agents/agentProjectFileStore.js`
- Modify: `src/agents/localProjectRuntime.js`
- Modify: `src/agents/agentProjectService.js`
- Test: `tests/localPrivacyDeletionExecution.test.mjs`

- [x] **Step 1: Write the failing confirmed-purge test**

After confirmation, execute the request and assert the active project is absent after a file-store restart, the runtime project root no longer exists, and a tombstone under the runtime root identifies residual boundaries.

- [x] **Step 2: Add project-store removal and deletion tombstone writer**

Remove only the selected project and its messages from the active snapshot. Rewrite the active snapshot without retaining a backup containing that project. Before removing the project runtime root, write an immutable local tombstone under `deletion-receipts/` with request id, hashes, time and residual data boundaries.

- [x] **Step 3: Execute only a confirmed, unexpired request once**

Reject pending, expired and already-executed requests. Mark the external tombstone as the durable execution receipt; do not claim to erase append-only audit or user-copied backups.

- [x] **Step 4: Run focused execution test**

Run: `node --test tests/localPrivacyDeletionExecution.test.mjs`

Expected: PASS; active data is removed only through the confirmed protocol and residual boundaries are explicit.

### Task 4: Add retention preview and full regression gates

**Files:**

- Modify: `src/agents/agentProjectService.js`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Test: `tests/localPrivacyDeletionRequest.test.mjs`

- [x] **Step 1: Add a read-only retention preview**

Expose due/pending/expired deletion requests and clearly distinguish `project-local` retention from executable cleanup.

- [ ] **Step 2: Update capability 13 honestly**

Mark verified export and confirmation workflow; mark physical purge only after Task 3 proof; retain audit/backup boundaries.

- [ ] **Step 3: Run full regression**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && npm.cmd run agents:scenario`

Expected: every command exits 0.

## Self-Review

- No raw delete token reaches persistent data.
- Confirmation remains valid only for a bounded period and one execution.
- Active-data purge is separate from request/approval and does not pretend to erase external copies.
- Every phase remains purely local.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
