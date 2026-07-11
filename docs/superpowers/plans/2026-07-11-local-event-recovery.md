# Local Event-Ledger Integrity and Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and delegation was not requested.

**Goal:** Upgrade capability 25 so the local project event ledger detects mutation, fails closed, and can be restored from a verified local checkpoint without losing an intact post-checkpoint prefix.

**Architecture:** Seal every retained project event with a content checksum and predecessor-linked SHA-256 hash. Store immutable checkpoint snapshots beside the local project store. Recovery verifies the checkpoint, preserves the longest valid suffix linked to its root, quarantines the damaged ledger before replacement, atomically saves the rebuilt chain, rereads it, and records a checksum-bound receipt. The authenticated local server actor owns every mutation.

**Tech Stack:** Existing project runtime/file store/private API/access control, Node.js `node:test`, local filesystem only.

## Global Constraints

- An integrity-invalid ledger rejects new event appends; reads remain available for diagnosis.
- Legacy unsealed ledgers migrate once; a ledger already marked chain version 1 is never silently resealed.
- Checkpoints contain the exact retained ledger and independently verified metadata/checksum.
- Recovery is dry-run unless `execute: true`, and execution requires an explicit checkpoint id plus stable operation id.
- The longest valid post-checkpoint prefix is preserved; the first corrupt or unlinked event and everything after it are discarded.
- The complete pre-recovery ledger is written to a checksummed local quarantine before replacement.
- Same operation/checkpoint is idempotent across restart; a changed checkpoint conflicts.
- Responses and governance receipts expose hashes/counts/ids, not quarantined event contents or local paths.
- Pure local scope only; this does not claim off-host durability, WORM storage, or protection from an administrator deleting every local copy.

### Task 1: Event hash chain and fail-closed mutation

**Files:**
- Modify: `src/agents/agentRuntime.js`
- Create: `tests/localEventLedgerIntegrity.test.mjs`

- [x] Seal new and migrated events with content checksum, predecessor hash, event hash, and retained-root metadata.
- [x] Verify sequence and hash continuity, including retention boundaries, and expose integrity in the event summary.
- [x] Reject append/backfill mutation against a chain-versioned invalid ledger.

### Task 2: Durable checkpoint, quarantine, and recovery

**Files:**
- Modify: `src/agents/agentProjectFileStore.js`
- Modify: `src/agents/agentProjectService.js`
- Create: `tests/localEventRecovery.test.mjs`

- [x] Persist and validate idempotent project-scoped event checkpoints outside the main store.
- [x] Dry-run and execute exact recovery, preserving the longest linked valid tail and quarantining the original ledger first.
- [x] Reread and verify the rebuilt store, persist an idempotent content-minimized recovery receipt, and prove restart recovery.

### Task 3: Private API, P0 gate, and total validation

**Files:**
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Create: `scripts/validate-local-event-recovery.mjs`
- Modify: `package.json`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: launch/checklist docs and validators

- [x] Add Manager/security read diagnostics and security-admin-only checkpoint/recovery mutations with body actor override blocked.
- [x] Register `npm run agents:local-event-recovery`, mark #25 verified with explicit local-only limitations, and run focused/full/build/bundle/release/smoke/diff gates.

## Self-review

- Recovery reuses the project event ledger and file store instead of introducing a second event engine.
- Quarantine/checkpoints are deliberately local and operator-controlled; stronger disaster recovery remains an external backup concern.
