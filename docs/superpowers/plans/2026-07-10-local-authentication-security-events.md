# Local Authentication Security Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record local bootstrap and login success/failure/lockout outcomes as privacy-preserving, restart-durable runtime security events.

**Architecture:** The local-auth store remains responsible for password/session state. The API records each completed public authentication outcome through a service method that maps it into the independent runtime security audit hash chain. Usernames are represented only by a deterministic SHA-256 subject hash; passwords, tokens and raw usernames never enter the audit event.

**Tech Stack:** Node.js ESM, local-auth API/store, runtime audit stream, Node test runner.

## Global Constraints

- Pure local persistence; no cloud IdP, SIEM or remote telemetry.
- Use `/local-auth/bootstrap`, `/local-auth/login` and `/security-audit-stream` as public test seams.
- Never persist plaintext usernames, passwords, session tokens, password hashes or request bodies in authentication events.
- Store only a normalized-username SHA-256 subject hash, public user id/role when authenticated, public session id, result reason, retry time and trace.
- Authentication outcome events share the runtime audit sequence/hash domain and survive restart.
- Preserve existing HTTP status behavior for invalid credentials and lockout.

---

### Task 1: Record bootstrap and login outcomes

**Files:**
- Create: `tests/localAuthenticationSecurityEvents.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`

**Interfaces:**
- Produces: `recordLocalAuthenticationEvent({ eventType, outcome, username, user, session, reason, retryAt, traceId, now })` returning a runtime security stream record.

- [x] **Step 1: Write a failing public-seam test**

Bootstrap an owner, submit one invalid login, trigger lockout on the next invalid login, then successfully log in after the retry window. Query the runtime stream and assert bootstrap-success, login-failed, login-locked and login-success outcomes with one stable subject hash and no raw credentials.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localAuthenticationSecurityEvents.test.mjs`

Expected: FAIL because public authentication routes currently write no runtime security event.

- [x] **Step 3: Map authentication results into runtime audit records**

Hash the normalized username inside the service, attach redacted outcome metadata to the audit record and hash payload, and call the service after each bootstrap/login result. Keep current response codes and payloads unchanged.

- [x] **Step 4: Run the focused test and verify green**

Run: `node --test tests/localAuthenticationSecurityEvents.test.mjs`

Expected: PASS.

---

### Task 2: Prove restart durability and privacy boundaries

**Files:**
- Modify: `tests/localAuthenticationSecurityEvents.test.mjs`
- Modify: `docs/LOCAL_AUTH.md`

**Interfaces:**
- Consumes: existing file-backed runtime security audit storage.
- Produces: restored authentication event chain with identical subject hashes and valid sequence/hash proof.

- [x] **Step 1: Extend the test across a file-store restart**

Recreate the project service/API against the same files, query with an active owner token, and assert all authentication outcomes and hash-chain readiness remain while the serialized stream contains none of the submitted usernames/passwords/tokens.

- [x] **Step 2: Run focused regressions**

Run: `node --test tests/localAuthenticationSecurityEvents.test.mjs tests/localRuntimeSecurityAudit.test.mjs tests/localAuthApi.test.mjs tests/localAuthStore.test.mjs`

Expected: PASS.

- [x] **Step 3: Document the event and atomicity boundary**

Document fields, query route and that auth state plus append-only audit use separate local files, so recovery verifies both but does not claim a cross-file ACID transaction.

---

### Task 3: Update capability evidence and release gates

**Files:**
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-authentication-security-events.md`

- [x] **Step 1: Update capabilities #4 and #6**

Record bootstrap/login/lockout audit coverage and retain external immutable retention plus cross-file transactionality as explicit local boundaries.

- [x] **Step 2: Run full verification**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests pass, local MVP checklist passes, and diff check has no whitespace errors.

- [x] **Step 3: Record exact verification results**

Append exact test counts and release-check results to this plan.

## Verification Results

- `npm.cmd test`: 136 tests passed, 0 failed, 0 skipped or cancelled.
- `npm.cmd run launch:local-mvp:check`: Local MVP release checklist validation passed.
- `git diff --check`: exited 0 with no whitespace errors; Git reported only existing CRLF-to-LF working-copy warnings.
