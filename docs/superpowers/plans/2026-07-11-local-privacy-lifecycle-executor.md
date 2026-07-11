# Local Privacy Lifecycle Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. This thread executes inline because autonomous continuation is authorized and subagent delegation was not requested.

**Goal:** Upgrade capability 13 into an automatically planned, dual-approved, restart-safe pure-local retention executor for system-owned artifact data with explicit residual-boundary reporting.

**Architecture:** Extend project privacy policy with bounded retention days and lifecycle scan mode. The service combines policy with capability-11 canonical inventory to produce a checksum-bound deletion manifest automatically. Execution requires an existing critical `privacy:artifact-retention-delete` action approval from distinct Manager and security-admin actors; the runtime writes a prepared journal, deletes only exact eligible canonical/internal projections, appends retention-deletion ledger events, verifies the resulting inventory, commits a tombstone outside the project directory, and resumes idempotently after interruption.

**Tech Stack:** Node.js ESM, existing project settings/action approvals/artifact inventory, atomic local JSON, SHA-256, file-backed service/API, `node:test`.

## Global Constraints

- Pure local operation; no cloud deletion job, SaaS DSR workflow, or remote policy engine.
- Lifecycle scan is automatic and deterministic; irreversible execution is never silent and always requires exact-manifest dual approval.
- Only canonical content whose latest `retainUntil` has passed and has no active legal hold is eligible.
- A plan binds project id, policy revision/checksum, artifact inventory checksum, exact content hashes, deadline, generated time, and expiration.
- Execution refuses stale plans, changed inventory, new holds, released/replaced approvals, actor mismatch, expired approval, or degraded storage/audit integrity.
- Prepared execution journals are content-minimized, checksummed, idempotent by operation id, and recoverable after partial deletion.
- Internal artifact projections may be deleted when they still match the target checksum. External workspace files, user backups, recovery bundles, and audit/checkpoint retention are never silently deleted.
- Tombstones live outside the removed content path and list exact deleted hashes plus explicit residual boundaries without artifact content.
- Project-wide deletion retains its existing confirmation and dual-approval path; this capability adds scheduled artifact retention, not a bypass.

### Task 1: Policy and exact lifecycle plan

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/localProjectRuntime.js`
- Create: `tests/localPrivacyLifecycle.test.mjs`

- [x] Add failing tests for bounded `retentionDays`, automatic scan mode, artifact writes inheriting project policy, inventory checksum, exact eligible manifest, held exclusion, and plan expiry.
- [x] Extend `project-privacy-policy/v1` compatibly with `retentionDays` and `lifecycleScanMode` while preserving existing defaults.
- [x] Add a SHA-256 checksum to `local-artifact-storage-inventory/v1` and derive artifact retain-until from project policy at write time.
- [x] Implement `getProjectPrivacyLifecycle(projectId, { now })` with due/not-due/blocked states, exact manifest checksum, next scan time, residual boundaries, and no mutation.

### Task 2: Critical dual approval and restart-safe artifact deletion

**Files:**
- Modify: `src/agents/localActionApproval.js`
- Modify: `src/agents/localProjectRuntime.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/localPrivacyLifecycle.test.mjs`

- [x] Add `privacy:artifact-retention-delete` as critical, irreversible, distinct Manager+security-admin approval policy.
- [x] Add failing tests rejecting no approval, self approval, stale plan, legal hold, expired approval, changed inventory, and degraded canonical/ledger state.
- [x] Implement `executeArtifactRetention` with prepared journal, exact canonical/internal projection deletion, external workspace preservation, ledger deletion events, post-delete verification, committed journal, and outside-root tombstone.
- [x] Consume the exact action approval execution claim and bind its checksum/decision checksums into the lifecycle tombstone.
- [x] Prove same operation id restart resumes/idempotently returns the committed receipt and a conflicting operation fails.

### Task 3: Private API, scan worker seam, and residual report

**Files:**
- Create: `tests/localPrivacyLifecycleApi.test.mjs`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `src/agents/agentProjectService.js`

- [x] Add a failing file-backed API test for policy update, real artifact, automatic scan, exact approval, dual decisions, execute, restart, tombstone, hold blocking, and actor override resistance.
- [x] Add Manager/security GET `/projects/:id/privacy/lifecycle`, security-admin POST `/projects/:id/privacy/lifecycle/scan`, and exact approved POST `/projects/:id/privacy/lifecycle/executions` routes.
- [x] Make scan receipt-first and safe for the later persistent scheduler: no execution without explicit `execute=true`, approval id, operation id, and expected plan checksum.
- [x] Return deleted/system-owned counts, no external workspace paths, recovery/user-backup/audit residual categories, next scan time, and `readyForProduction=false` without remote deletion claims.

### Task 4: P0 evidence and next-gap audit

**Files:**
- Create: `scripts/validate-local-privacy-lifecycle.mjs`
- Modify: `package.json`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LOCAL_AUTH.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `src/agents/README.md`

- [x] Register `npm run agents:local-privacy-lifecycle` and its P0 marker.
- [x] Replace capability 13's partial claim with automatic scan, exact dual approval, journal/resume, deletion verification, tombstone, hold, and residual-boundary guarantees.
- [x] Run focused tests, existing privacy/action/artifact regressions, full tests, build, bundle, launch gates, local-MVP checklist, diff check, and the 50-capability audit.

## Self-review

- Spec coverage: policy, automatic planning, due calculation, holds, exact approval, stale prevention, journal, crash resume, internal-only deletion, tombstone, residual boundaries, API/worker seam, and non-cloud boundary are explicit.
- Simplicity: reuses project settings, artifact inventory, and action approval; adds one lifecycle journal/tombstone path, not a second privacy subsystem.
- Type consistency: `retentionDays`, `lifecycleScanMode`, `planChecksum`, `inventoryChecksum`, `operationId`, `actionApprovalId`, `deletedContentSha256`, `tombstonePath`, and `residualDataBoundaries` are shared across runtime, service, API, tests, and docs.
