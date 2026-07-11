# Local Engineering Security Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. This thread uses inline execution because the user already authorized uninterrupted autonomous progress and subagent delegation was not requested.

**Goal:** Upgrade capability 48 into a pure-local, restart-safe engineering security ledger whose exact-revision attestation is mandatory for the capability-47 release path.

**Architecture:** Add a focused pure module that records immutable scan, remediation, exception-request, exception-approval, and release-attestation receipts. Project service/API methods bind all actors to the technical-delivery work-mode roster, persist receipts through the existing atomic file store, and fail closed on stale, incomplete, duplicate, expired, or tampered security state. The existing technical delivery release receipt binds the current security attestation; no cloud scanner or arbitrary command execution is introduced.

**Tech Stack:** Node.js ESM, `node:test`, existing SHA-256 helper, existing project file store/service/API/access-control layers.

## Global Constraints

- Pure local/open-source operation; no SaaS security scanner, hosted risk register, or cloud deployment.
- Required check types are exactly `dependency`, `secret`, `permission`, and `static-analysis`.
- Scan receipts store findings and locations but never secret values, matched snippets, tokens, credentials, or environment contents.
- `critical` and `high` findings cannot be risk-accepted; every such finding must be remediated or independently marked false-positive.
- `medium` and `low` risk exceptions require separate approvals from the assigned quality/security reviewer and product owner, expire within 30 days, and bind one finding plus one implementation revision.
- A security attestation binds the latest scan and exact current remediation/exception manifests, expires after 60 minutes, and is invalidated by newer scan state.
- Capability-47 local release creation requires an unexpired exact-revision attestation and records its id/checksum in the release receipt.
- Historical matching idempotent replay remains stable; any new write against a degraded ledger fails closed.

---

### Task 1: Exact-revision scan and deterministic risk projection

**Files:**
- Create: `src/agents/localEngineeringSecurity.js`
- Create: `tests/localEngineeringSecurity.test.mjs`

**Interfaces:**
- Produces `createLocalEngineeringSecurityScan(input)`, `verifyLocalEngineeringSecurityScan(scan)`, and `buildLocalEngineeringSecurityLedger({ project, now })`.
- A scan consumes `projectId`, `implementationRevision`, four check rows, finding rows, `actorId`, `idempotencyKey`, and `now`.

- [x] **Step 1: Write a failing public-seam test** that creates a four-check scan, proves deterministic finding fingerprints and counts, and rejects missing/duplicate check types plus raw-secret fields.
- [x] **Step 2: Run `node --test tests/localEngineeringSecurity.test.mjs`** and confirm failure because the module does not exist.
- [x] **Step 3: Implement the minimal immutable scan receipt and projection** with schema `local-engineering-security-scan/v1`, checksum verification, exact revision binding, required check set, tool/config/evidence metadata, redacted locations, and scan error blockers.
- [x] **Step 4: Run the focused test** and confirm the first vertical slice passes.

### Task 2: Finding remediation, dual-approved exception, and attestation

**Files:**
- Modify: `src/agents/localEngineeringSecurity.js`
- Modify: `tests/localEngineeringSecurity.test.mjs`

**Interfaces:**
- Produces `createLocalEngineeringSecurityRemediation`, `createLocalEngineeringSecurityExceptionRequest`, `createLocalEngineeringSecurityExceptionApproval`, and `createLocalEngineeringSecurityAttestation` plus corresponding verifiers.
- `buildLocalEngineeringSecurityLedger` exposes exact open/blocking finding ids, exception state, current manifest checksum, and attestation eligibility.

- [x] **Step 1: Add failing worked-matrix tests** for remediation, false-positive independence, forbidden high/critical exceptions, low/medium dual approval, denial, expiry, actor separation, stale scan links, and monotonic time.
- [x] **Step 2: Implement append-only remediation and exception receipts** with exact finding/scan/revision links, bounded expiry, separate assigned-role approvals, and no self-approval.
- [x] **Step 3: Add a failing attestation test** proving scan errors, unresolved findings, single approval, expired exception, stale manifest, or tampering blocks issuance.
- [x] **Step 4: Implement attestation issuance and verification** with a 60-minute TTL and exact manifest checksum.
- [x] **Step 5: Run the focused tests green.**

### Task 3: File-backed private API and mandatory technical release fence

**Files:**
- Create: `tests/localEngineeringSecurityApi.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `src/agents/localTechnicalDelivery.js`
- Modify: `tests/localTechnicalDelivery.test.mjs`
- Modify: `tests/localTechnicalDeliveryApi.test.mjs`

**Interfaces:**
- Adds private `/projects/:id/engineering-security` GET plus `/scans`, `/remediations`, `/exception-requests`, `/exception-requests/:id/approvals`, and `/attestations` POST routes.
- Extends `createLocalTechnicalDeliveryRelease` with required `engineeringSecurityAttestation` and binds attestation id/checksum/revision.

- [x] **Step 1: Write a failing file-backed API test** for scan -> remediation/exception -> two approvals -> attestation -> release, idempotency, private access, restart, expiry, and tamper degradation.
- [x] **Step 2: Add service persistence/cache signatures and server-owned role binding** for implementer, quality/security reviewer, and product owner.
- [x] **Step 3: Add API/access routes** and ensure only Manager/security-admin sessions can read or write the private ledger.
- [x] **Step 4: Make capability-47 release fail without the current attestation** and update its unit/API acceptance path to supply a valid exact-revision attestation.
- [x] **Step 5: Run capability-47 and capability-48 focused tests green.**

### Task 4: P0 release registration and complete verification

**Files:**
- Create: `scripts/validate-local-engineering-security.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/SUPER_AGENT_WORK_MODES.md`
- Modify: `src/agents/README.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

**Interfaces:**
- Adds `npm run agents:engineering-security` and the marker `Local engineering security validation passed.`

- [x] **Step 1: Register the focused P0 command and release-checklist marker.**
- [x] **Step 2: Document exact guarantees and non-claims** including local-only scan evidence ingestion rather than autonomous scanner execution.
- [x] **Step 3: Run `npm run agents:engineering-security`, `npm run agents:technical-delivery`, `npm run agents:work-modes:acceptance`, `npm test`, `npm run build`, `npm run ui:bundle:check`, `npm run agents:product-team:smoke`, `npm run launch:gates`, `npm run launch:local-mvp:check`, and `git diff --check`.

## Self-review

- Spec coverage: dependency, secret, permission, and static-analysis evidence all enter one exact-revision ledger; exceptions, expiry, actor separation, release fencing, restart, tampering, API privacy, P0 registration, and non-cloud boundaries are covered.
- Placeholder scan: no TBD/TODO/later placeholders remain.
- Type consistency: scan, remediation, exception request/approval, attestation, and technical release names are consistent across pure, service, API, test, and documentation tasks.
