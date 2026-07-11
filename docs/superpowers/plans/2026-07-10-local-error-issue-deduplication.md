# Local Error Issue Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert repeated unhandled local runtime failures into privacy-safe, restart-durable error issues with acknowledgement, resolution, recurrence, and an actionable local runbook.

**Architecture:** Extend the existing local telemetry JSONL with a latest-state `local-runtime-error-issue/v1` record keyed by a SHA-256 fingerprint of category, error code, method, and query-free path. HTTP catches record an issue before returning a generic response; dedicated admin routes list and transition issues. Raw exception messages, stacks, request bodies, headers, query values, and credentials never enter the registry or response.

**Tech Stack:** Node.js ESM, local telemetry JSONL, Node HTTP server, SHA-256, Node test runner.

## Global Constraints

- Pure local persistence; no SaaS error tracker, remote incident system, or outbound alert delivery.
- Record only unhandled server exceptions in this phase; ordinary API 4xx responses remain request telemetry, not error issues.
- Fingerprint input is `category|errorCode|METHOD|query-free-path`; raw message and stack are excluded.
- Repeated occurrences update one issue count and latest trace instead of creating duplicate visible issues.
- Allowed states are `open`, `acknowledged`, and `resolved`; recurrence after resolution reopens the same fingerprint and increments `reopenedCount`.
- `GET /runtime-errors`, `POST /runtime-errors/:fingerprint/acknowledge`, and `POST /runtime-errors/:fingerprint/resolve` require a local security administrator when strict local auth is enabled.
- Registry retention is bounded to 100 latest issues and survives telemetry-file compaction and restart.
- Error reporting must never fail the business response path.

---

### Task 1: Capture and deduplicate unhandled errors

**Files:**
- Create: `tests/localRuntimeErrorRegistry.test.mjs`
- Modify: `src/agents/localTelemetryPort.js`
- Modify: `src/agents/agentProjectHttpServer.js`

**Interfaces:**
- Produces: `telemetry.recordRuntimeError({ traceId, method, path, category, errorCode, severity })`.
- Produces: `telemetry.status().errors` with `issues`, `summary`, and route metadata.

- [x] **Step 1: Write a failing HTTP-seam test**

Run a server whose API throws the same coded exception twice. Assert both responses are generic, `GET /runtime-errors` exposes one issue with `count: 2`, a 64-character fingerprint, a local runbook, and no raw exception/query secret.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localRuntimeErrorRegistry.test.mjs`

Expected: FAIL because `/runtime-errors` and the local error registry do not exist.

- [x] **Step 3: Implement privacy-safe issue capture**

Parse and compact `local-runtime-error-issue/v1` alongside telemetry events/SLO snapshots, merge the latest record per fingerprint, record caught HTTP exceptions before the response, and replace raw exception responses with a generic error code/trace contract.

- [x] **Step 4: Run the focused test and verify green**

Run: `node --test tests/localRuntimeErrorRegistry.test.mjs`

Expected: PASS for deduplication, redaction, and runbook projection.

---

### Task 2: Add lifecycle transitions and recurrence recovery

**Files:**
- Modify: `tests/localRuntimeErrorRegistry.test.mjs`
- Modify: `src/agents/localTelemetryPort.js`
- Modify: `src/agents/agentProjectHttpServer.js`

**Interfaces:**
- Produces: `telemetry.updateRuntimeErrorIssue({ fingerprint, action, actorId, note })`.
- Consumes: `acknowledge` or `resolve`; unknown fingerprints return 404.

- [x] **Step 1: Extend the test through acknowledge, restart, resolve, and recur**

Acknowledge the issue, restart against the same JSONL, prove acknowledged state persists, resolve it, trigger the same exception again, and assert the issue reopens with `count: 3` and `reopenedCount: 1`.

- [x] **Step 2: Implement append-only state transitions**

Append the updated latest issue state for every transition; persist only redacted operator id/note previews; on recurrence preserve the fingerprint/history counters and clear the prior resolution state.

- [x] **Step 3: Run focused observability regressions**

Run: `node --test tests/localRuntimeErrorRegistry.test.mjs tests/localSloTelemetry.test.mjs tests/localTelemetryHttpServer.test.mjs`

Expected: all error, SLO, health, restart, and redaction contracts pass.

---

### Task 3: Project runtime health and capability evidence

**Files:**
- Modify: `src/agents/agentProjectHttpServer.js`
- Modify: `docs/LOCAL_RUNTIME_OBSERVABILITY.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-error-issue-deduplication.md`

- [x] **Step 1: Add a runtime-errors health check**

An open or acknowledged unhandled issue makes `local-runtime-health/v1` report `attention-needed`; resolving every issue clears this check. Link the dedicated issue route in maintenance metadata.

- [x] **Step 2: Document local operator handling and boundaries**

Document fingerprint inputs, excluded sensitive data, lifecycle states, recurrence, runbook mapping, local-admin protection, retention, and the absence of remote incident delivery.

- [x] **Step 3: Run full verification**

Run: `npm.cmd test && npm.cmd run agents:error-reporting-readiness && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests and both release contracts pass with no whitespace errors.

- [x] **Step 4: Record exact verification results**

Append exact test counts and gate results to this plan.

## Verification Results

- `node --check scripts/agent-project-server.mjs`: exited 0.
- `npm.cmd test`: 141 tests passed, 0 failed, 0 skipped or cancelled.
- `npm.cmd run agents:error-reporting-readiness`: Error Reporting Readiness contract validation passed.
- `npm.cmd run launch:local-mvp:check`: Local MVP release checklist validation passed.
- `git diff --check`: exited 0 with no whitespace errors; Git reported only existing CRLF-to-LF working-copy warnings.
