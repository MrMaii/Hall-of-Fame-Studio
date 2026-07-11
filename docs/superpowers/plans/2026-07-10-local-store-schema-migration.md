# Local Store Schema Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade local project snapshots through an explicit, fail-closed migration protocol rather than assuming every parseable JSON file is compatible.

**Architecture:** The file store reads a declared snapshot version, applies only registered forward migrations, and reports migration provenance in its integrity read model. Writes use the current version. A newer unknown version fails closed; a corrupt upgraded primary can still recover from an older compatible backup and migrate it again.

**Tech Stack:** Node.js ESM, JSON snapshots, existing atomic file replacement and backup recovery, Node test runner.

## Global Constraints

- Pure local only; no migration service or cloud dependency.
- Never mutate an existing snapshot in place; migration materializes through the existing atomic snapshot writer.
- Unknown future versions fail closed with a stable error code.
- A v1-to-v2 migration may be data-shape preserving, but it must be explicit and audited through integrity metadata.
- Backup recovery remains compatible with a prior supported version.

---

### Task 1: Reproduce old-version and unsupported-version loading

**Files:**

- Create: `tests/agentProjectFileStoreMigration.test.mjs`

- [x] **Step 1: Write a v1 upgrade test**

Write a version-1 JSON snapshot with a project, open it, and assert `store.integrity.status === 'migrated'`, `migratedFromVersion === 1`, and the primary file is rewritten with `version: 2` while retaining the project.

- [x] **Step 2: Write an unknown-future-version failure test**

Write `{ version: 999, projects: [] }` and assert construction throws `agent-project-store-version-unsupported` without rewriting the file.

- [x] **Step 3: Run focused test and confirm failure**

Run: `node --test tests/agentProjectFileStoreMigration.test.mjs`

Expected: the old snapshot has no migration provenance and an unknown version is silently accepted.

### Task 2: Add versioned forward migration and provenance

**Files:**

- Modify: `src/agents/agentProjectFileStore.js:7-220`

**Interfaces:**

- `store.integrity` includes `{ status, sourceVersion, migratedFromVersion, currentVersion }`.
- Supported v1 snapshots open as current v2 snapshots; unsupported future versions throw.

- [x] **Step 1: Parse the declared version alongside snapshot data**

`readSnapshotCandidate` must retain `version` from JSON and treat absent version as legacy v1.

- [x] **Step 2: Register v1-to-v2 migration**

Use an explicit migration table:

```js
const SNAPSHOT_MIGRATIONS = new Map([[1, (snapshot) => snapshot]]);
```

Apply sequentially until `STORE_VERSION === 2`; throw `agent-project-store-version-unsupported` for versions above 2 or without a migration.

- [x] **Step 3: Atomically materialize successful migration**

After a migrated snapshot initializes memory state, persist it through `writeSnapshot`, keeping the pre-upgrade primary as the normal `.bak` recovery source. Do not rewrite a current v2 snapshot.

- [x] **Step 4: Run focused test and confirm pass**

Run: `node --test tests/agentProjectFileStoreMigration.test.mjs`

Expected: old data upgrades and future data fails closed.

### Task 3: Verify recovery and capability evidence

**Files:**

- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`

- [x] **Step 1: Add migration evidence to capability 10**

Record registered forward migration, prior-version backup and unknown-version fail-closed behavior; retain rollback of arbitrary business migrations as not yet implemented.

- [x] **Step 2: Run regression commands**

Run: `node --test tests/agentProjectFileStoreMigration.test.mjs && npm.cmd test && npm.cmd run launch:local-mvp:check`

Expected: every command exits 0.

## Self-Review

- An upgrade is observable and not implicit.
- A newer store does not get silently downgraded or rewritten.
- Existing corrupt-primary recovery remains valid with supported backup versions.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
