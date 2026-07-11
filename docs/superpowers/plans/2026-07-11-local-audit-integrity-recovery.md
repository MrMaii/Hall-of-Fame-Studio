# Local Audit Integrity Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. This thread executes inline because autonomous continuation is authorized and subagent delegation was not requested.

**Goal:** Upgrade capability 12 into a checkpointed, archive-backed, verifiably recoverable pure-local security audit system for independent project and runtime hash chains.

**Architecture:** Extend the file store with immutable-by-convention checkpoint archives outside the active JSONL. A checkpoint validates every runtime/project stream independently, preserves ordered records in a checksummed archive, and links its manifest to the previous checkpoint. Recovery requires an exact checkpoint id, verifies checkpoint/archive/record chains, merges later valid snapshot records, quarantines the damaged active log, atomically rebuilds it, and then records a recovery event through the normal runtime audit chain.

**Tech Stack:** Node.js ESM, SHA-256, existing stable audit checksums/hash links, atomic local replacement, JSONL, file store/service/API, `node:test`.

## Global Constraints

- Pure local operation; no SIEM, cloud WORM bucket, remote timestamp authority, or external signing service.
- Project streams and the runtime stream retain independent sequence/hash namespaces even when archived in one physical file.
- A checkpoint is created only from a fully readable, sequence-contiguous, checksum-valid, hash-valid active log.
- Checkpoint manifests are SHA-256 checksummed and chained; archives carry exact-byte SHA-256 and a verified record count/root summary.
- Recovery never silently drops valid records after the checkpoint when they remain available in the atomic project snapshot.
- Damaged active bytes are quarantined before replacement and never overwritten in place.
- Recovery is dry-run by default in the CLI and requires the exact checkpoint id for execution.
- The recovery action is appended to the rebuilt runtime audit chain; repeated execution with the same recovery operation id is idempotent.
- Retention metadata is recorded but deletion is capability 13; same-machine archives are not external immutable retention.

### Task 1: Independent stream verifier and chained checkpoint archive

**Files:**
- Modify: `src/agents/agentProjectFileStore.js`
- Create: `tests/localAuditCheckpointRecovery.test.mjs`

- [x] Write a failing test that records runtime and two project streams, creates a checkpoint, and requires independent contiguous sequence/checksum/hash verification.
- [x] Implement stable audit checksum/hash verification compatible with existing stream records and reject gaps, duplicate sequence, previous-hash breaks, or hash mismatches.
- [x] Implement `createSecurityAuditCheckpoint({ now, retentionDays })` that writes an ordered JSONL archive plus a chained checksummed manifest and exposes id/count/scope roots/archive checksum/retain-until.
- [x] Prove a second checkpoint links the first and a normal active-log append does not mutate prior archives.

### Task 2: Dry-run and executable recovery

**Files:**
- Modify: `src/agents/agentProjectFileStore.js`
- Modify: `tests/localAuditCheckpointRecovery.test.mjs`
- Create: `scripts/recover-local-security-audit.mjs`

- [x] Add failing tests for malformed active JSONL, truncated/missing checkpoint-era lines, and valid post-checkpoint snapshot records.
- [x] Implement `recoverSecurityAuditLog({ expectedCheckpointId, execute, operationId, now })`: verify checkpoint chain/archive, merge/dedupe snapshot records, revalidate each scope, and return a dry-run plan without mutation by default.
- [x] On execute, quarantine exact damaged bytes, atomically rebuild the active log, verify it after reread, and return a content-minimized recovery receipt.
- [x] Reject wrong checkpoint id, tampered manifest/archive, invalid archived stream, invalid snapshot continuation, repeated conflicting operation id, or missing evidence.
- [x] Add a CLI requiring `--store`, defaulting to dry-run, and requiring `--execute --checkpoint-id --operation-id` for mutation.

### Task 3: Private control API and recovery audit receipt

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `tests/localAuditCheckpointRecovery.test.mjs`

- [x] Add a failing private API test for checkpoint creation, degraded read, dry-run recovery, executed recovery, actor override resistance, restart, and recovery receipt visibility.
- [x] Add security-admin-only checkpoint/recovery writes plus Manager/security-admin integrity reads.
- [x] After successful rebuild, append an idempotent `local-security-audit-recovery` runtime record through `recordAccessDecision`, bound to checkpoint id, operation id, quarantine checksum, rebuilt checksum, and actor id.
- [x] Expose active integrity, latest checkpoint, retention, recovery readiness, last recovery, and explicit local non-WORM boundary.

### Task 4: P0 evidence and next-gap audit

**Files:**
- Create: `scripts/validate-local-audit-integrity.mjs`
- Modify: `package.json`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `src/agents/README.md`

- [x] Register `npm run agents:local-audit-integrity` and P0 documentation.
- [x] Replace capability 12's partial claim with checkpoint/archive/dry-run/recovery/quarantine/receipt guarantees and the explicit non-WORM boundary.
- [x] Run focused tests, full tests, build, bundle, launch gates, local-MVP checklist, diff check, and the 50-capability audit.

## Self-review

- Spec coverage: independent chains, stable checksum compatibility, chained checkpoint manifests, archive retention, post-checkpoint merge, dry-run, quarantine, atomic rebuild, reread verification, actor-bound recovery receipt, restart, and non-WORM boundary are explicit.
- Simplicity: active JSONL, rotating project snapshot, checkpoint manifest+archive, and quarantine only; no generalized logging framework.
- Type consistency: `checkpointId`, `operationId`, `archiveChecksum`, `quarantineChecksum`, `rebuiltChecksum`, `scopeRoots`, `retainUntil`, and `recoveryReceiptId` are shared across store, CLI, API, tests, and docs.
