# Local SLO Alerts and Trends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn local HTTP latency metrics into restart-durable SLO windows that distinguish transient slowness from sustained degradation and give the operator an explicit response.

**Architecture:** Extend the existing local telemetry JSONL with a second redacted record type, `local-runtime-slo-snapshot/v1`. The telemetry port evaluates bounded request windows against a configurable local policy, persists snapshots at deterministic request intervals, and derives alerts only from persisted consecutive windows (with immediate escalation for a critical window). Existing `/runtime-observability` and `/local-runtime-health` remain the public read seams.

**Tech Stack:** Node.js ESM, JSONL local telemetry, Node HTTP server, Node test runner.

## Global Constraints

- Pure local storage; no SaaS telemetry, remote alert router, or cloud time-series database.
- Never persist query strings, request bodies, prompts, credentials, or attachment contents.
- Existing telemetry event schema and p50/p95 fields remain backward compatible.
- Default SLO policy: 20-request windows, snapshot every 20 requests, minimum 10 samples, warning p95 at 2000 ms, critical p95 at 10000 ms, maximum server-error rate 10%, and two consecutive warning windows before alerting.
- A critical window alerts immediately; a warning window is treated as transient until the configured consecutive-window count is reached.
- Trend history is bounded to 120 persisted snapshots and survives restart.
- Telemetry write failures must never fail the business request.

---

### Task 1: Persist windowed SLO snapshots

**Files:**
- Create: `tests/localSloTelemetry.test.mjs`
- Modify: `src/agents/localTelemetryPort.js`

**Interfaces:**
- Consumes: `createLocalTelemetryPort({ filePath, maxRecords, sloPolicy, now })`.
- Produces: `status().slo` with `policy`, `current`, `alert`, and `trends`.

- [x] **Step 1: Write a failing public-contract test**

Create a file-backed telemetry port with three-request windows and snapshots. Record one slow warning window and assert `status().slo.alert.active === false`; record a second warning window and assert the alert becomes active with two persisted trend rows.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localSloTelemetry.test.mjs`

Expected: FAIL because `local-runtime-observability/v1` has no `slo` contract.

- [x] **Step 3: Implement the bounded snapshot contract**

Parse telemetry JSONL line-by-line into request events and SLO snapshots, calculate p50/p95 and server-error rate over the configured window, append `local-runtime-slo-snapshot/v1` after each snapshot interval, and compact both record types without exposing raw request data.

- [x] **Step 4: Run the focused test and verify green**

Run: `node --test tests/localSloTelemetry.test.mjs`

Expected: PASS with one transient warning followed by one sustained warning alert.

---

### Task 2: Expose health degradation and restart recovery

**Files:**
- Modify: `tests/localSloTelemetry.test.mjs`
- Modify: `src/agents/agentProjectHttpServer.js`

**Interfaces:**
- Consumes: `resolvedTelemetry.status().slo.alert`.
- Produces: a `latency-slo` health check and `attention-needed` runtime health status while an alert is active.

- [x] **Step 1: Extend the test through HTTP and restart**

Start the HTTP server with the breached port, assert `/runtime-observability` returns the alert and `/local-runtime-health` reports a failed `latency-slo` check. Recreate the telemetry port and server from the same JSONL and prove the alert and trend snapshots survive restart.

- [x] **Step 2: Add the health projection**

Keep the telemetry attachment check, add `latency-slo`, set its detail to the redacted alert summary/recommendation, and make an active SLO alert produce `attention-needed` before the generic ready/degraded branches.

- [x] **Step 3: Run focused regressions**

Run: `node --test tests/localSloTelemetry.test.mjs tests/localTelemetryHttpServer.test.mjs`

Expected: both tests pass and the existing redaction assertions remain green.

---

### Task 3: Configure, document, and release-gate capability #28

**Files:**
- Modify: `scripts/agent-project-server.mjs`
- Modify: `.env.example`
- Modify: `docs/LOCAL_RUNTIME_OBSERVABILITY.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-slo-alerts-and-trends.md`

- [x] **Step 1: Wire explicit local environment controls**

Support `AGENT_LOCAL_SLO_WINDOW_SIZE`, `AGENT_LOCAL_SLO_SNAPSHOT_EVERY_REQUESTS`, `AGENT_LOCAL_SLO_MIN_SAMPLES`, `AGENT_LOCAL_SLO_WARNING_P95_MS`, `AGENT_LOCAL_SLO_CRITICAL_P95_MS`, `AGENT_LOCAL_SLO_MAX_SERVER_ERROR_RATE`, `AGENT_LOCAL_SLO_CONSECUTIVE_BREACH_WINDOWS`, and `AGENT_LOCAL_SLO_MAX_SNAPSHOTS`.

- [x] **Step 2: Document operator meaning and local boundary**

Document transient versus sustained warnings, immediate critical alerts, trend retention, restart recovery, response recommendations, and the absence of remote paging/on-call delivery.

- [x] **Step 3: Run full verification**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests pass, the local MVP checklist passes, and the diff has no whitespace errors.

- [x] **Step 4: Record exact verification results**

Append exact test counts and release-check results to this plan.

## Verification Results

- `node --check scripts/agent-project-server.mjs`: exited 0.
- `npm.cmd test`: 139 tests passed, 0 failed, 0 skipped or cancelled.
- `npm.cmd run launch:local-mvp:check`: Local MVP release checklist validation passed.
- `git diff --check`: exited 0 with no whitespace errors; Git reported only existing CRLF-to-LF working-copy warnings.
