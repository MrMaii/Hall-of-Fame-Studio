# Local Sensitive-Write Access Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every project-scoped sensitive local write persist an attributable, tamper-evident authorization decision before business dispatch, including prototype-open operation.

**Architecture:** Keep the existing access classifier as the source of route capability and sensitivity. Expand the API audit gate so every project-scoped mutation requires a persisted audit record, while enforced reads retain their current audit behavior. The record carries the server trace/request identifier into the existing append-only hash chain, and sensitive writes fail closed if the audit sink is absent or throws.

**Tech Stack:** Node.js ESM, existing access-control classifier, file-backed security audit JSONL/hash chain, Node test runner.

## Global Constraints

- Pure local persistence only; no cloud SIEM or SaaS identity dependency.
- Use the existing HTTP API as the public test seam.
- Audit before business dispatch so an unaudited sensitive write cannot occur.
- Preserve prototype-open compatibility for authorization decisions, but never make prototype-open mutations invisible.
- Never persist authentication tokens, request bodies, Provider keys, or raw secrets.
- Keep existing enforced read auditing unchanged.

---

### Task 1: Audit prototype-open sensitive writes

**Files:**
- Create: `tests/localSensitiveWriteAccessAudit.test.mjs`
- Modify: `src/agents/agentProjectApi.js`

**Interfaces:**
- Consumes: `authorizeAgentProjectRequest()` public decision with `route.projectId`, `route.sensitivity`, actor and mode.
- Produces: one pre-dispatch `security-access-audit` record for every project-scoped `POST`, `PUT`, `PATCH`, or `DELETE` request.

- [x] **Step 1: Write a failing HTTP/API test**

Create a project-backed API in default prototype-open mode, write project settings as a manager, then read `/projects/:id/security-access-audit`. Assert one allowed, non-enforced audit row identifies the actor, route `project-settings`, sensitivity `project-data`, method `POST`, and outcome `access-allowed-before-dispatch`.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localSensitiveWriteAccessAudit.test.mjs`

Expected: FAIL because prototype-open project writes currently skip the audit sink.

- [x] **Step 3: Require audit for project mutations**

In `authorizeRequest`, compute `projectMutation = route.projectId && ['POST','PUT','PATCH','DELETE'].includes(method)`. Persist when either the existing enforced-project condition or `projectMutation` is true.

- [x] **Step 4: Run the focused test and verify green**

Run: `node --test tests/localSensitiveWriteAccessAudit.test.mjs`

Expected: PASS.

---

### Task 2: Fail closed and correlate the immutable record

**Files:**
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/localSensitiveWriteAccessAudit.test.mjs`

**Interfaces:**
- Consumes: `request.traceId` or redacted `x-hofs-request-id`.
- Produces: `traceId` on `security-access-audit/v1` and `security-audit-stream-record/v1`; hash checksum includes that trace; sensitive mutation returns `503 access-audit-write-failed` if persistence is unavailable.

- [x] **Step 1: Extend the test with trace and failure assertions**

Assert `trace_local_sensitive_write_001` appears in both project audit and audit stream. Create a minimal service without `recordAccessDecision`, attempt the same mutation, and assert status 503 before the service write handler is invoked.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localSensitiveWriteAccessAudit.test.mjs`

Expected: FAIL on missing trace and/or fail-closed behavior.

- [x] **Step 3: Persist bounded trace and make write auditing mandatory**

Pass a bounded, redacted trace into `recordAccessDecision`; add it to the audit record, event payload and hash checksum. Treat `projectMutation` as fail-closed even when the optional global `failClosedOnAuditError` flag is false.

- [x] **Step 4: Run focused regressions**

Run: `node --test tests/localSensitiveWriteAccessAudit.test.mjs tests/localAuditLogIntegrity.test.mjs tests/localAuthApi.test.mjs tests/localTaskTraceChain.test.mjs`

Expected: PASS.

---

### Task 3: Document the verified boundary and run release gates

**Files:**
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-sensitive-write-access-audit.md`

**Interfaces:**
- Produces: capability #6 evidence that project-scoped sensitive writes cannot dispatch without a local audit record.

- [x] **Step 1: Update capability #6**

Record prototype-open mutation auditing, enforced allow/deny auditing, actor/route/sensitivity/trace attribution, append-only stream integrity, and the remaining boundary for non-project global administration routes.

- [x] **Step 2: Run full verification**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests pass, local MVP checklist passes, and diff check has no whitespace errors.

- [x] **Step 3: Record exact verification results**

Append exact pass/fail counts and the release-check result to this plan.

Verification on 2026-07-10:

- `npm.cmd test`: PASS, 133 tests / 133 passed / 0 failed.
- `npm.cmd run launch:local-mvp:check`: PASS, local MVP release checklist validation passed.
- `git diff --check`: PASS, with only existing CRLF-to-LF working-tree warnings.
- Privacy-deletion interaction regression: PASS; append-only raw audit remains external evidence while deleted-project records do not re-enter the active snapshot after restart.
