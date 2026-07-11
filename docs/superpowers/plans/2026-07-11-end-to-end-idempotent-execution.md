# End-to-End Idempotent Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and subagent delegation was not requested.

**Goal:** Upgrade capability 16 from duplicate tick suppression into exact, recoverable idempotency across local business effects, worker receipts, queue acknowledgement, and local Provider requests.

**Architecture:** Treat the durable task intent checksum as the root operation identity. System-owned mutations remain atomic in the project snapshot and return the acknowledged result rather than re-executing. Provider adapters propagate one stable idempotency key and trace id across transport retries, record provider response ids, and explicitly classify timeout/abort-without-response as ambiguous. An ambiguous request never commits downstream local artifacts automatically; it requires a same-key provider reconciliation or human retry decision. Provider implementations that do not attest idempotency remain visibly at-least-once at the inference boundary while local state stays exactly-once.

**Tech Stack:** existing durable queue, provider budget reservations/usage ledger, model/search adapters, local file store/API, SHA-256, `node:test`.

## Global Constraints

- No claim of exactly-once delivery over HTTP; the guarantee is exactly-once local commit plus stable-key Provider deduplication when supported.
- One operation key binds project, worker/task/action, request checksum, trace id, attempt history, Provider response id, local result checksum, and queue receipt.
- Retries reuse the same key; a changed request under the same key fails before network dispatch.
- Timeout, abort, connection loss, or process death after dispatch but before response is `ambiguous`, never silently `failed-safe-to-repeat`.
- Ambiguous operations cannot create artifacts, submissions, evidence, or tool effects until reconciled.
- Provider headers and receipts never contain prompt/query content or credentials.
- Existing deterministic/local Provider modes and direct human API writes retain compatibility.

### Task 1: Stable Provider idempotency transport

**Files:**
- Modify: `src/agents/modelProvider.js`
- Modify: `src/agents/searchProvider.js`
- Modify: `tests/modelProvider.test.mjs`
- Create: `tests/localProviderIdempotency.test.mjs`

- [x] Add failing tests proving model/search send the same `idempotency-key` and trace header across retries, expose response ids, reject invalid keys, and classify timeout/abort ambiguity.
- [x] Add content-minimized Provider idempotency metadata to adapter status/receipts without claiming the endpoint honors it.

### Task 2: Persist exact operation result and ambiguous state

**Files:**
- Create: `src/agents/localIdempotentExecution.js`
- Create: `tests/localIdempotentExecution.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/localDurableTaskQueue.test.mjs`

- [x] Implement SHA-256 prepared/dispatched/completed/ambiguous/reconciled operation receipts with exact-key conflict detection.
- [x] Persist prepared intent before Provider dispatch; preserve one stable key across retries, bind response id/result checksum, and block completed-result redispatch when raw result readback is unavailable.
- [x] Combine Provider ambiguity tests with durable-queue receipt-before-ack and acknowledged-result restart tests so no ambiguous Provider output creates a downstream local effect.
- [x] Require explicit reconciliation evidence before an ambiguous Provider operation can resume; only a verified `not-applied` outcome authorizes same-key retry.

### Task 3: Private reconciliation API and P0 evidence

**Files:**
- Create: `tests/localIdempotentExecutionApi.test.mjs`
- Create: `scripts/validate-local-idempotent-execution.mjs`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `package.json`
- Modify: capability/readiness/auth/agent docs and validators

- [x] Add Manager/security read-only operation status and security-admin reconciliation controls using verified actor identity.
- [x] Register `npm run agents:local-idempotent-execution`, mark #16 verified with the HTTP boundary stated precisely, and run focused/full/build/bundle/release/total gates.

## Self-review

- This closes duplicate local effects and makes uncertain Provider outcomes explicit; it does not pretend arbitrary local model/search servers implement exactly-once HTTP semantics.
- It reuses queue idempotency, Provider reservations, usage receipts, trace ids, and file snapshots rather than adding a transaction coordinator.
