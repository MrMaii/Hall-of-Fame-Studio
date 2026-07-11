# Local Provider Cost Forecast and Overage Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local Provider spending predictable and govern exceptional over-budget work through bounded, expiring, consumable human approvals.

**Architecture:** Extend the existing project Provider usage ledger and atomic budget reservations rather than creating a parallel counter. `budget-alert-readiness/v1` projects end-of-UTC-day spend from observed burn rate and emits explicit warning/critical forecast state. A `local-provider-budget-approval/v1` grants extra cost/request headroom to one operation (and optionally one Agent); reservation provisionally occupies the approval, settlement consumes actual usage, release returns headroom, and restart/expiry remain authoritative from project state.

**Tech Stack:** Node.js ESM, project file store, Provider policy/reservations, HTTP-shaped project API, Node test runner.

## Global Constraints

- Pure local persistence; no billing SaaS, remote budget service, or external approval system.
- Base project limits remain authoritative; approvals may bypass only `daily-budget-exceeded` and `hourly-rate-limit-exceeded`, never provider/model/tool/security policy denials.
- Approval requires `operation`, `approvedBy`, at least one positive extra limit, and an expiry no more than 24 hours after creation.
- Optional `agentId` restricts the approval to that Agent; operation matching is exact.
- Tokens, Provider credentials, prompts, queries, and result contents never enter approval records or forecast output.
- Approval reservation and Provider budget reservation are saved in one project update.
- Released Provider work returns provisional approval headroom; settled work consumes actual cost and one request.
- Expired, exhausted, or revoked approval never permits new Provider dispatch and remains visible across restart.
- Forecast is explicitly an estimate: observed cost divided by elapsed UTC-day time, projected to 24 hours; fewer than three daily usage rows reports low confidence.

---

### Task 1: Add forecast and alert severity

**Files:**
- Create: `tests/localProviderCostGovernance.test.mjs`
- Modify: `src/agents/agentProjectService.js`

**Interfaces:**
- Consumes: `GET /projects/:projectId/budget-alert-readiness`.
- Produces: `costForecast` with projected daily cost, projected percent, confidence, severity, basis, and recommendation.

- [x] **Step 1: Write a failing readiness test**

Run three settled local search calls with known cost, read readiness at UTC noon, and assert the projected end-of-day cost, critical forecast severity, and explicit estimate basis.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localProviderCostGovernance.test.mjs`

Expected: FAIL because readiness currently exposes only historical spend/headroom.

- [x] **Step 3: Implement deterministic forecast projection**

Use daily usage cost, usage count, UTC day start, and elapsed minutes. Return `insufficient-data`, `ok`, `warning`, or `critical`; never claim prediction certainty and never use future timestamps.

- [x] **Step 4: Run the focused test and verify green**

Run: `node --test tests/localProviderCostGovernance.test.mjs`

Expected: PASS for forecast amount, severity, confidence, and redaction.

---

### Task 2: Add bounded overage approvals

**Files:**
- Modify: `tests/localProviderCostGovernance.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

**Interfaces:**
- Produces: `GET|POST /projects/:projectId/provider-budget-approvals`.
- Produces: `POST /projects/:projectId/provider-budget-approvals/:approvalId/revoke`.
- Produces: service methods `getProviderBudgetApprovals`, `createProviderBudgetApproval`, and `revokeProviderBudgetApproval`.

- [x] **Step 1: Extend the test from denied work to approved work**

Exhaust base cost/request limits, prove the next transport is denied, create an operation-scoped approval, then prove exactly the approved extra requests/cost can dispatch and the next call is denied after exhaustion.

- [x] **Step 2: Implement validation and public lifecycle records**

Persist issuer, operation, optional Agent, extra limits, reserved/consumed counters, created/expiry/revocation timestamps, status, and checksum. Return no Provider request content or credentials.

- [x] **Step 3: Integrate approval selection into policy evaluation**

Remove only budget/rate denial reasons when one matching active approval has sufficient remaining headroom; attach public approval evidence to the decision.

- [x] **Step 4: Integrate provisional reservation and settlement**

Reserve approval cost/request headroom in the same save as Provider reservation. On released work return it; on settled work consume actual cost and one request, marking the approval exhausted when either configured limit is used.

- [x] **Step 5: Run focused Provider regressions**

Run: `node --test tests/localProviderCostGovernance.test.mjs tests/localProviderBudgetReservation.test.mjs`

Expected: forecast, denial, approval, exhaustion, and existing concurrent reservation tests pass.

---

### Task 3: Prove expiry/revocation/restart and capability evidence

**Files:**
- Modify: `tests/localProviderCostGovernance.test.mjs`
- Modify: `scripts/validate-budget-alert-readiness-contract.mjs`
- Modify: `docs/LOCAL_PROVIDER_TRANSPORT_RELIABILITY.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-provider-cost-forecast-and-overage-approval.md`

- [x] **Step 1: Extend the file-backed test across restart**

Persist an approval, restart the service, prove active approval state is readable, then prove expiry and explicit revocation both deny new work.

- [x] **Step 2: Expose approval/forecast evidence through readiness**

Link the approval route, active/exhausted/expired/revoked counts, forecast severity, and remaining approved headroom from `budget-alert-readiness/v1`.

- [x] **Step 3: Document local operator meaning and boundaries**

Document projection math, confidence, warning/critical thresholds, approval constraints, provisional reservation, settlement/release, expiry/revocation, and local-only boundaries.

- [x] **Step 4: Run full verification**

Run: `npm.cmd test && npm.cmd run agents:budget-alert-readiness && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests and both release contracts pass with no whitespace errors.

- [x] **Step 5: Record exact verification results**

Append exact test counts and gate results to this plan.

## Verification Results

- `node --check scripts/agent-project-server.mjs`: PASS (exit 0).
- `npm.cmd test`: PASS (143 tests, 143 passed, 0 failed).
- `npm.cmd run agents:budget-alert-readiness`: PASS (`Budget alert readiness contract validation passed.`).
- `npm.cmd run launch:local-mvp:check`: PASS (`Local MVP release checklist validation passed.`).
- `git diff --check`: PASS (exit 0; existing CRLF normalization warnings only).
