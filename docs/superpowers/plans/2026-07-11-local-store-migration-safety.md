# Local Store Migration Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. This thread executes inline because autonomous continuation is authorized and subagent delegation was not requested.

**Goal:** Upgrade capability 10 into a crash-recoverable, verified, explicitly reversible pure-local project-store migration system.

**Architecture:** Replace the one-way migration callback registry with version steps that own `up`, `down`, and validation. Before changing the primary snapshot, preserve its exact bytes in a deterministic immutable migration archive and atomically write a checksummed transaction journal containing source/target versions and semantic checksums. Startup reconciles a valid prepared journal, verifies the migrated target, and commits it; an offline rollback function applies registered down steps to the current snapshot, preserves a pre-rollback archive, and writes the prior version without opening the current runtime.

**Tech Stack:** Node.js ESM, atomic local JSON replacement, SHA-256, `node:test`, existing file-store recovery primitives.

## Global Constraints

- Pure local operation; no database migration SaaS, cloud backup, or external coordinator.
- Exact pre-migration bytes are preserved outside the rotating `.bak` path and never overwritten by normal business writes.
- Journal, archive, target snapshot, and rollback backup carry checksums; invalid or unknown state fails closed.
- Migration target validation happens after the target is reread from disk, not only against the in-memory object.
- Prepared transactions are recovered idempotently on startup.
- Rollback is offline and explicit. It must require the exact migration id and a registered down step; it must not run implicitly during normal startup.
- A rollback preserves all fields supported by the down step and writes a pre-rollback copy before replacing the primary file.
- Future versions without complete up/down/validate registrations remain unsupported.

### Task 1: Version-step registry and verified migration transaction

**Files:**
- Modify: `src/agents/agentProjectFileStore.js`
- Modify: `tests/agentProjectFileStoreMigration.test.mjs`

- [x] Write a failing test that starts from v1 and requires a committed checksummed migration transaction, exact immutable source archive, reread target verification, and rollback metadata in `store.integrity`.
- [x] Change the v1→v2 registry entry to `{ up, down, validate }` and validate required snapshot collections after every step.
- [x] Preserve exact source bytes and write a prepared journal before the primary snapshot changes.
- [x] Reread/validate the v2 target, write the committed journal, and expose transaction id, versions, checksums, archive path, status, and rollback command.
- [x] Prove a later ordinary project write does not modify the migration source archive.

### Task 2: Prepared-journal crash recovery and tamper failure

**Files:**
- Modify: `src/agents/agentProjectFileStore.js`
- Modify: `tests/agentProjectFileStoreMigration.test.mjs`

- [x] Add failing tests for a crash after journal prepare and a crash after target replacement but before journal commit.
- [x] Reconcile a valid prepared journal against exact source/target checksums and resume the same transaction idempotently.
- [x] Reject a journal checksum mismatch, missing/mismatched archive, unsupported version edge, or target validation failure without replacing evidence.
- [x] Verify existing corrupt-primary `.bak` recovery remains independent and green.

### Task 3: Explicit offline rollback

**Files:**
- Modify: `src/agents/agentProjectFileStore.js`
- Create: `scripts/rollback-agent-project-store-migration.mjs`
- Modify: `tests/agentProjectFileStoreMigration.test.mjs`

- [x] Add a failing test for `rollbackAgentProjectFileStoreMigration({ filePath, expectedMigrationId })` preserving current project data while writing version 1.
- [x] Apply registered down steps, validate each result, preserve a checksummed pre-rollback archive, atomically write the target version, and mark the journal `rolled-back`.
- [x] Reject a wrong transaction id, uncommitted/tampered journal, missing down step, corrupt current snapshot, or repeated rollback.
- [x] Add a CLI that defaults to dry-run status and requires `--execute --migration-id <id>` for mutation.

### Task 4: P0 evidence and next-gap audit

**Files:**
- Create: `scripts/validate-local-store-migration-safety.mjs`
- Modify: `package.json`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `src/agents/README.md`

- [x] Register `npm run agents:store-migration-safety` and its P0 marker.
- [x] Replace capability 10's partial evidence with exact archive/journal/recovery/rollback guarantees and non-claims.
- [x] Run focused tests, recovery regressions, full tests, build, launch gates, local-MVP checklist, diff check, and the 50-capability audit.

## Self-review

- Spec coverage: immutable pre-migration evidence, up/down validation, post-write verification, prepared-state recovery, journal tamper detection, explicit rollback, CLI, P0, and existing corruption recovery are covered.
- Simplicity: one current journal plus one immutable source archive and one rollback archive; no generalized migration service or online rollback engine.
- Type consistency: migration id, `expectedMigrationId`, source/target versions, source/target checksums, journal checksum, archive path, and rollback status use the same names across module, CLI, tests, and docs.
