# Local Project Store Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local project JSON store recover from a corrupted primary snapshot using its last known-good local backup, while failing closed when neither copy is readable.

**Architecture:** Continue using the existing atomic replacement writer. Before replacing a valid primary snapshot, atomically copy it to a sibling `.bak` file. Startup reads the primary first; if it is invalid JSON but the backup is valid, it renames the invalid file to a timestamped quarantine path and hydrates from the backup. If primary and backup are both invalid, startup throws an explicit recovery error rather than silently using an empty store.

**Tech Stack:** Node.js ESM, synchronous local filesystem store, atomic rename helper, Node test runner.

## Global Constraints

- Pure local only; do not introduce a cloud database or hosted backup service.
- Preserve corrupt bytes in a quarantine file; never overwrite them before an operator can inspect them.
- A valid primary remains authoritative and must not be replaced by an older backup.
- Backup is a prior successfully written snapshot, not an in-memory approximation.
- Failure with two unreadable snapshots must be explicit and must not create an empty project store.
- Public test seam: `createAgentProjectFileStore({ filePath })` and its returned `integrity` status.

---

### Task 1: Write recovery regression tests at the file-store seam

**Files:**

- Create: `tests/agentProjectFileStoreRecovery.test.mjs`

- [x] **Step 1: Write the failing primary-corruption recovery test**

```js
const store = createAgentProjectFileStore({ filePath });
store.saveProject({ id: 'project_1', name: 'Recover me' });
store.appendMessages([{ id: 'message_1', projectId: 'project_1', text: 'Creates a prior backup.' }]);
writeFileSync(filePath, '{not valid json', 'utf8');
const recovered = createAgentProjectFileStore({ filePath });
assert.equal(recovered.getProject('project_1').name, 'Recover me');
assert.equal(recovered.integrity.status, 'recovered-from-backup');
assert.equal(readFileSync(recovered.integrity.quarantinePath, 'utf8'), '{not valid json');
```

- [x] **Step 2: Add the failing double-corruption test**

```js
writeFileSync(filePath, '{bad primary', 'utf8');
writeFileSync(`${filePath}.bak`, '{bad backup', 'utf8');
assert.throws(() => createAgentProjectFileStore({ filePath }), /agent-project-store-corrupt-no-backup/);
```

- [x] **Step 3: Run focused test and confirm failure**

Run: `node --test tests/agentProjectFileStoreRecovery.test.mjs`

Expected: the current store throws the raw JSON parser error on the primary corruption case.

### Task 2: Add a local prior-snapshot backup and recovery protocol

**Files:**

- Modify: `src/agents/agentProjectFileStore.js:1-155`

**Interfaces:**

- Returned file store includes `integrity: { schemaVersion, status, backupPath, quarantinePath? }`.
- Invalid primary plus valid backup returns status `recovered-from-backup`.
- Invalid primary plus invalid/missing backup throws `agent-project-store-corrupt-no-backup`.

- [x] **Step 1: Read snapshots without conflating absence and corruption**

Implement a helper that returns `{ exists, snapshot, error }`. Empty/missing files remain an empty snapshot; malformed JSON produces an error value without returning empty data.

- [x] **Step 2: Keep the prior primary snapshot before atomic replacement**

Before writing `${filePath}.tmp`, if `filePath` exists, copy it to `${filePath}.bak.tmp` and atomically replace `${filePath}.bak`. Then atomically replace the primary with the already-written next snapshot.

- [x] **Step 3: Recover a readable backup while quarantining corrupt primary bytes**

On malformed primary with readable backup:

```js
const quarantinePath = `${filePath}.corrupt-${Date.now()}.json`;
replaceFileWithRetry(filePath, quarantinePath);
return { snapshot: backup.snapshot, integrity: { schemaVersion: 'agent-project-file-store-integrity/v1', status: 'recovered-from-backup', backupPath, quarantinePath } };
```

The constructor's normal first persist then recreates the primary from the backup snapshot. Do not mutate a valid primary.

- [x] **Step 4: Fail closed for two invalid copies**

Throw `new Error('agent-project-store-corrupt-no-backup')` when the primary is malformed and no readable backup exists. Keep the files untouched in that branch.

- [x] **Step 5: Run focused test and confirm pass**

Run: `node --test tests/agentProjectFileStoreRecovery.test.mjs`

Expected: primary recovery preserves the corrupt file, uses the backup, and double corruption fails closed.

### Task 3: Record the verified recovery boundary and run regressions

**Files:**

- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`

- [x] **Step 1: Update the persistence/recovery capability evidence**

Record the prior-snapshot backup and quarantine recovery test. Keep multi-process conflict resolution and external disk-failure recovery as partial/unimplemented boundaries.

- [x] **Step 2: Run focused and regression commands**

Run: `node --test tests/agentProjectFileStoreRecovery.test.mjs && npm.cmd test && npm.cmd run agents:scenario && npm.cmd run launch:local-mvp:check`

Expected: every command exits 0.

## Self-Review

- Recovery never substitutes a fresh empty store for corrupted user data.
- The most recent valid primary remains preferred; backup is used only after parse failure.
- The corrupt primary is retained for operator analysis.
- This is a local resilience control, not a claim of multi-host or cloud durability.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
