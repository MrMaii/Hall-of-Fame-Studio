# Local Runtime Security Audit Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend fail-closed, trace-correlated authorization auditing from project writes to local runtime-wide sensitive operations such as user administration and Secret Vault mutation.

**Architecture:** Store runtime audit entries in the existing append-only security audit store with `projectId: null`, `auditScope: runtime`, and an independent runtime hash-chain sequence. The access classifier identifies local-auth control and runtime audit routes; the API audits every non-public sensitive mutation before dispatch. Dedicated root read routes expose only runtime-scope records, never a mixture of project chains.

**Tech Stack:** Node.js ESM, local-auth API, existing access classifier, file-backed audit JSONL and hash chain, Node test runner.

## Global Constraints

- Pure local storage; no cloud SIEM, SaaS identity, or remote audit sink.
- Bootstrap/login/status remain public local-auth routes and are not treated as authenticated admin mutations.
- Passwords, tokens, Vault values, ciphertext and request bodies must never enter audit records.
- Project and runtime audit chains have independent sequence/hash namespaces.
- Runtime sensitive mutations fail closed before their handler when audit persistence is unavailable.
- Existing project audit records and hashes remain backward compatible.

---

### Task 1: Persist and query a runtime-scoped audit chain

**Files:**
- Create: `tests/localRuntimeSecurityAudit.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

**Interfaces:**
- Produces: `recordAccessDecision({ projectId: null, ... })`, `getRuntimeSecurityAccessAudit()`, `getRuntimeSecurityAuditStream()`, `GET /security-access-audit`, and `GET /security-audit-stream`.

- [x] **Step 1: Write a failing public-seam test**

Bootstrap a local security administrator, create a local manager through `POST /local-auth/users` with a trace id, then query `GET /security-audit-stream`. Assert one runtime-scoped `local-auth-users` record with actor id/role, trace, no password, sequence 1 and a valid hash chain.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localRuntimeSecurityAudit.test.mjs`

Expected: FAIL because local-auth routes bypass access auditing and no root runtime audit query exists.

- [x] **Step 3: Implement the runtime audit scope**

Classify private local-auth and runtime audit routes. Allow `recordAccessDecision` without a project, filter runtime records as `!record.projectId`, sequence/hash them independently, append them to the existing store, and expose the two root read models/routes.

- [x] **Step 4: Run the focused test and verify green**

Run: `node --test tests/localRuntimeSecurityAudit.test.mjs`

Expected: PASS.

---

### Task 2: Prove restart durability and fail-closed global writes

**Files:**
- Modify: `tests/localRuntimeSecurityAudit.test.mjs`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/agentProjectService.js`

**Interfaces:**
- Consumes: file-backed `appendSecurityAuditRecords()` and `x-hofs-request-id`/server trace.
- Produces: runtime audit restoration after file-store restart and mandatory audit before all classified non-public global mutations.

- [x] **Step 1: Extend the test with restart and missing-sink cases**

Restart the file store and assert the runtime record/hash remains queryable. Create an API service without `recordAccessDecision`, call `POST /secret-vault/seal`, and assert 503 before the Vault handler is called.

- [x] **Step 2: Run the focused test and verify the shared seam**

Run: `node --test tests/localRuntimeSecurityAudit.test.mjs`

Expected: PASS because Task 1's shared runtime append seam already provides restart visibility and fail-closed confirmation; the new assertions lock that behavior in.

- [x] **Step 3: Make all non-public mutations audit-mandatory**

Use the mutation method itself rather than classifier completeness, persist before dispatch, and require a returned stream record. Include `auditScope` and `scopeId` in new hash payloads only when present so legacy hashes remain valid.

- [x] **Step 4: Run focused regressions**

Run: `node --test tests/localRuntimeSecurityAudit.test.mjs tests/localSensitiveWriteAccessAudit.test.mjs tests/localAuthApi.test.mjs tests/localAuditLogIntegrity.test.mjs`

Expected: PASS.

---

### Task 3: Update capability evidence and release gates

**Files:**
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-runtime-security-audit-domain.md`

**Interfaces:**
- Produces: capability #6 evidence covering both project and runtime sensitive-write domains.

- [x] **Step 1: Update capability #6 with the verified runtime domain**

Record user administration, Vault/global mutation fail-closed auditing, independent runtime hash chain and restart durability. Keep external immutable retention as the explicit remaining boundary.

- [x] **Step 2: Run full verification**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests pass, local MVP checklist passes, and diff check has no whitespace errors.

- [x] **Step 3: Record exact verification results**

Append exact test counts, release-check result and diff-check result to this plan.

Verification on 2026-07-10:

- `npm.cmd test`: PASS, 135 tests / 135 passed / 0 failed.
- `npm.cmd run launch:local-mvp:check`: PASS, local MVP release checklist validation passed.
- `git diff --check`: PASS, with only existing CRLF-to-LF working-tree warnings.
- Focused runtime/project/auth/work-mode audit regressions: PASS, 24 tests / 24 passed / 0 failed.
