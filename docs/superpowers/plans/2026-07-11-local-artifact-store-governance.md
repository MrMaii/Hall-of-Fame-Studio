# Local Artifact Store Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. This thread executes inline because autonomous continuation is authorized and subagent delegation was not requested.

**Goal:** Upgrade capability 11 into a governed pure-local canonical artifact store with durable inventory, continuous integrity verification, retention/hold metadata, workspace-drift visibility, and private API access.

**Architecture:** Keep `.versions/<sha256>` as the canonical content-addressed bytes and treat artifact/workspace filenames only as mutable projections. Append content-minimized `artifact-stored`, `legal-hold-placed`, and `legal-hold-released` events to a project-local hash-chained JSONL inventory. A runtime audit rereads canonical bytes, validates the ledger, derives retention and legal-hold state, and reports projection drift without treating a mutable workspace as the source of truth; service/API expose the inventory and hold controls.

**Tech Stack:** Node.js ESM, local filesystem, SHA-256, atomic file replacement, JSONL hash chain, existing project runtime/service/API/access-control, `node:test`.

## Global Constraints

- Pure local operation; no object-storage SaaS, cloud DAM, or external archive.
- Canonical content remains addressable only by its SHA-256; an existing canonical file must be reread and match before reuse.
- Ledger rows never contain artifact content, workspace content, legal-hold reason text, credentials, or user secrets.
- Mutable artifact/workspace projections may drift or disappear without corrupting canonical history, but drift is explicit in the audit.
- Default retention is bounded and configurable at runtime creation; expiry is reported but does not delete bytes in capability 11.
- Legal holds are append-only, actor-attributed, reason-hashed, checksum-linked, and must be explicitly released.
- Deletion and lifecycle execution remain capability 13; capability 11 supplies the authoritative inventory and hold gate.

### Task 1: Canonical write verification and hash-chained inventory

**Files:**
- Modify: `src/agents/localProjectRuntime.js`
- Modify: `tests/localArtifactContentAddressing.test.mjs`

- [x] Add failing tests requiring atomic canonical creation, existing-content checksum verification, sequential inventory rows, previous-hash linkage, no raw content, byte count, retention class, and retain-until date.
- [x] Append `local-artifact-storage-event/v1` after canonical bytes are durable; fail closed if the existing ledger is malformed or its chain is invalid.
- [x] Reject an existing canonical path whose bytes do not match its address rather than silently trusting or overwriting it.

### Task 2: Integrity inventory, workspace drift, retention, and legal hold

**Files:**
- Modify: `src/agents/localProjectRuntime.js`
- Modify: `tests/localArtifactContentAddressing.test.mjs`

- [x] Add failing inventory tests for missing/corrupt canonical bytes, duplicate content references, mutable projection drift, expired records, and valid canonical history.
- [x] Implement `auditArtifactStore(project, { now })` with ledger/content/projection/retention/hold findings and deterministic status.
- [x] Add failing legal-hold tests for actor, reason hash, exact content address, duplicate active hold rejection, release linkage, and tamper degradation.
- [x] Implement `placeArtifactLegalHold` and `releaseArtifactLegalHold`; expiry remains non-deleting and held content remains protected for capability 13.

### Task 3: Private service/API and restart proof

**Files:**
- Create: `tests/localArtifactStorageApi.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

- [x] Write a failing file-backed API test that submits a real artifact, reads inventory, observes workspace drift, places/releases a hold, restarts, and detects canonical/ledger tampering.
- [x] Add private GET `/projects/:id/local-artifact-storage` plus hold/release POST routes with server-owned Manager/security actor attribution.
- [x] Advertise the route in deferred read models and fail hold writes closed on degraded inventory.

### Task 4: P0 evidence and next-gap audit

**Files:**
- Create: `scripts/validate-local-artifact-storage.mjs`
- Modify: `package.json`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `src/agents/README.md`

- [x] Register `npm run agents:local-artifact-storage` and P0 documentation.
- [x] Replace capability 11's partial claim with canonical/ledger/inventory/retention/hold/workspace-drift guarantees and the explicit capability-13 deletion boundary.
- [x] Run focused tests, full tests, build, bundle, launch gates, local-MVP checklist, diff check, and the 50-capability audit.

## Self-review

- Spec coverage: canonical immutability, reuse verification, inventory chain, retention metadata, legal hold, projection drift, restart, tamper failure, API, and deletion boundary are explicit.
- Simplicity: one canonical directory and one JSONL inventory; no extra database or duplicate archive copy.
- Type consistency: `contentSha256`, `contentAddress`, `retainUntil`, `holdId`, `eventHash`, and `previousEventHash` are shared across runtime, service, API, tests, and docs.
