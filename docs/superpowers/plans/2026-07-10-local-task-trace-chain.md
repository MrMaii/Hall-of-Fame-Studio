# Local Task Trace Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist one redacted local trace identifier across an HTTP-triggered Agent work cycle, Provider usage, evidence, artifact submission, and independent review.

**Architecture:** The local HTTP server remains the trace root and passes its existing `traceId` into API request context without trusting a body field over the server value. Service operations accept the identifier explicitly, copy it into durable business records, and inherit it from a submission when a later review omits it. A project trace read model groups only records whose exact `traceId` matches, so operators can inspect one task chain without exporting secrets or request bodies.

**Tech Stack:** Node.js ESM, existing local HTTP/API/service stack, file-backed project store, Node test runner.

## Global Constraints

- Pure local storage only; no remote collector or SaaS tracing backend.
- Trace identifiers are opaque correlation values, never authorization credentials.
- Redact and bound every persisted trace identifier to 160 characters.
- Existing clients that do not send a trace header continue to receive a server-generated trace.
- Do not log request bodies, local-auth tokens, Provider keys, or query-string values.

---

### Task 1: Prove HTTP trace context reaches durable Agent work

**Files:**
- Create: `tests/localTaskTraceChain.test.mjs`
- Modify: `src/agents/agentProjectHttpServer.js`
- Modify: `src/agents/agentProjectApi.js`

**Interfaces:**
- Consumes: existing `x-hofs-request-id` input and generated `trace_<uuid>` fallback.
- Produces: API request field `traceId: string` and service input field `traceId: string`.

- [x] **Step 1: Write a failing HTTP test**

Start the local HTTP runtime, post an Agent work cycle with `x-hofs-request-id: trace_local_task_001`, and assert the durable cycle returned by the project API has the same `traceId`.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/localTaskTraceChain.test.mjs`

Expected: FAIL because the HTTP server currently uses the trace only for telemetry and the response header.

- [x] **Step 3: Pass server-owned trace context into the API**

Add `traceId` to the object passed to `handleAsync`/`handle`, and merge it into work-cycle service input as `traceId: request.traceId || body.traceId || null`. The server-owned value must win.

- [x] **Step 4: Run the focused test**

Run: `node --test tests/localTaskTraceChain.test.mjs`

Expected: PASS for the HTTP-to-cycle assertion.

---

### Task 2: Persist the trace through Provider, evidence, artifact, and review records

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/localTaskTraceChain.test.mjs`

**Interfaces:**
- Consumes: `traceId` on Agent cycle, Provider usage, evidence search, artifact submission, and review inputs.
- Produces: exact `traceId` fields on `agentWorkerLedger`, `providerUsageLedger`, `evidenceSearches`, `agentSubmissions`, `artifacts`, `submissionReviews`, logs, and relevant ledger events.

- [x] **Step 1: Extend the failing test across a Provider-backed work cycle**

Use a deterministic local search Provider. Assert the work cycle, Provider usage, evidence search, submitted artifact, and submission share `trace_local_task_001`. Review the submission without a new trace and assert it inherits the submission trace.

- [x] **Step 2: Run the focused test and verify the deeper assertions fail**

Run: `node --test tests/localTaskTraceChain.test.mjs`

Expected: FAIL on the first durable record that lacks `traceId`.

- [x] **Step 3: Add one bounded trace normalizer and propagate it**

Normalize with `redactSensitiveText(String(traceId || '')).slice(0, 160) || null`. Pass that value into nested `recordAgentEvidenceSearch`, `submitAgentArtifact`, and `reviewAgentSubmission` calls. When review input has no trace, use `submission.traceId`.

- [x] **Step 4: Run focused regressions**

Run: `node --test tests/localTaskTraceChain.test.mjs tests/localProviderBudgetReservation.test.mjs tests/localTelemetryHttpServer.test.mjs`

Expected: PASS.

---

### Task 3: Expose a local project trace read model and close the gate

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `tests/localTaskTraceChain.test.mjs`
- Modify: `docs/LOCAL_RUNTIME_OBSERVABILITY.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-task-trace-chain.md`

**Interfaces:**
- Produces: `getProjectTrace(projectId, traceId)` and `GET /projects/:projectId/traces/:traceId` returning exact-match correlated records and summary counts.

- [x] **Step 1: Add a failing read-model assertion**

Query the trace route and require its summary to include the correlated cycle, Provider usage, evidence, artifact/submission, and review counts, with no unrelated trace rows.

- [x] **Step 2: Implement exact-match local trace grouping**

Read only bounded project arrays, filter on exact normalized `traceId`, and return a redacted `local-project-trace/v1` object with `projectId`, `traceId`, `summary`, and grouped record arrays.

- [x] **Step 3: Update documentation and capability 27**

Document the trace header, propagation boundary, local query route, and the remaining limitation that external Provider side effects can only be correlated when the Provider returns its own receipt identifier.

- [x] **Step 4: Run full verification**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests pass, local MVP checklist passes, and diff check has no whitespace errors.

Verification on 2026-07-10:

- `npm.cmd test`: PASS, 131 tests / 131 passed / 0 failed.
- `npm.cmd run launch:local-mvp:check`: PASS, local MVP release checklist validation passed.
- `git diff --check`: PASS, with only existing CRLF-to-LF working-tree warnings.
