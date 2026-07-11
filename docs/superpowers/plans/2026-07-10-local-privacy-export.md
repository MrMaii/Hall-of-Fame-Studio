# Local Privacy Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the local project owner a real, approval-governed data export package instead of only an evidence-export workflow receipt.

**Architecture:** The existing local runtime owns filesystem writes beneath its project root. The project service builds a redacted export payload from the project, messages and local access audit records, asks the runtime to atomically write it under `archives/privacy-exports/`, then persists only export metadata, checksum and proof ids in the project ledger. The API exposes this as a local project route guarded by the existing authorization layer.

**Tech Stack:** Node.js ESM, local project runtime, file-backed project store, JSON export package, Node test runner.

## Global Constraints

- Pure local only; no cloud storage, remote export service, or external telemetry.
- Never export raw secret-vault material, provider keys or ciphertext; use the existing sensitive-object redaction before serialization.
- When `privacyPolicy.evidenceExportRequiresApproval` is true, an export requires a nonempty `approval.approvedBy` value.
- Export bytes live only under the configured project runtime root; the persistent project store receives metadata, not a duplicate payload.
- This task does not delete any user data. Retention and two-phase deletion are separate follow-up controls.

---

### Task 1: Write a real local privacy export package

**Files:**

- Create: `tests/localPrivacyExport.test.mjs`
- Modify: `src/agents/localProjectRuntime.js:72-390`
- Modify: `src/agents/agentProjectService.js:47401-62100`

**Interfaces:**

- `projectRuntime.writePrivacyExport(project, { exportId, payload, now })` returns `{ exportPath, file, bytes }`.
- `service.exportProjectPrivacyData({ projectId, actor, reason, approval, now })` returns `{ route: 'project-privacy-exported', privacyExport, project }`.

- [x] **Step 1: Write the failing public file-backed test**

Create a file-backed store and local runtime, add a project message and audit record, then call:

```js
const result = service.exportProjectPrivacyData({
  projectId,
  actor: 'Local owner',
  reason: 'personal data request',
  approval: { approvedBy: 'Local owner' },
  now: '2026-07-10T12:00:00.000Z',
});
const payload = JSON.parse(readFileSync(result.privacyExport.exportPath, 'utf8'));
assert.equal(payload.project.id, projectId);
assert.equal(payload.messages.length, 1);
assert.equal(payload.privacyExport.schemaVersion, 'local-project-privacy-export/v1');
assert.equal(result.project.privacyExports[0].checksum, result.privacyExport.checksum);
```

- [x] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/localPrivacyExport.test.mjs`

Expected: FAIL because the service has no real privacy-export method.

- [x] **Step 3: Add the local runtime writer**

Write only below `archives/privacy-exports/`. Use a filename based on `exportId`, write UTF-8 JSON, and return a file record without retaining the payload in runtime state:

```js
const exportPath = safeJoin(paths.archives, `privacy-exports/${safeFileName(exportId)}.json`);
writeJson(exportPath, payload);
return { exportPath, file: fileRecord(paths.root, exportPath), bytes: statSync(exportPath).size };
```

- [x] **Step 4: Build and persist redacted export metadata**

Reject missing runtime and missing approval when policy requires it. Construct a payload containing `project`, project messages, `store.listSecurityAuditRecords(projectId)`, export actor/reason/time and a checksum. Persist a `privacyExports` row, timeline log and ledger event that reference only path, checksum, byte count and approval metadata.

- [x] **Step 5: Run the focused test and confirm pass**

Run: `node --test tests/localPrivacyExport.test.mjs`

Expected: PASS; output exists beneath the temp local runtime root and its metadata survives project persistence.

### Task 2: Expose the governed local API and document the capability boundary

**Files:**

- Modify: `src/agents/agentProjectApi.js:2200-2750`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `tests/localPrivacyExport.test.mjs`

**Interfaces:**

- `POST /projects/:projectId/privacy/export` dispatches `service.exportProjectPrivacyData`.
- Missing approval produces a non-2xx error; approved export returns `privacyExport` and a project snapshot.

- [x] **Step 1: Extend the test through the API seam**

Call the route once without approval and once with `approval.approvedBy`. Assert rejection then a `200` response containing a filesystem-backed `privacyExport` record.

- [x] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/localPrivacyExport.test.mjs`

Expected: FAIL with method-not-allowed before the route exists.

- [x] **Step 3: Add the API route and response shape**

Route implementation:

```js
if (method === 'POST' && route.action === 'privacy' && route.tail[0] === 'export') {
  const result = service.exportProjectPrivacyData({ projectId: route.projectId, ...body });
  return json(200, { ...publicProjectResult(result, route.projectId, language), privacyExport: result.privacyExport });
}
```

- [x] **Step 4: Update capability 13 honestly**

Record that local approved export is verified. Keep retention scheduling, physical deletion and external immutable retention as incomplete boundaries.

- [x] **Step 5: Run focused and regression verification**

Run: `node --test tests/localPrivacyExport.test.mjs && npm.cmd test && npm.cmd run launch:local-mvp:check && npm.cmd run agents:scenario`

Expected: every command exits 0.

## Self-Review

- The package contains customer-visible local data but not secret-vault material.
- Policy-required approval is enforced before the filesystem write.
- The ledger proves who exported what and when without duplicating the payload.
- Deletion is deliberately not coupled to export.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
