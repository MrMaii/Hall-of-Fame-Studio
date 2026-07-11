# Local Versioned Quality Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one pure-local, versioned five-work-mode evaluation suite that compares model/prompt/policy candidate runs with an approved baseline and blocks regressions with restart-safe evidence.

**Architecture:** Keep Provider transport shadow replay separate from output-quality evaluation. A focused `localQualityEvaluation.js` module owns the immutable suite, deterministic criterion evaluation, SHA-256 receipts, baseline comparison, and tamper verification; the project service persists content-free run evidence and exposes it through project API routes. The first slice evaluates observable work-mode contract results rather than subjective prose: team readiness, reviewer independence, required artifacts, acceptance checks, escalation closure, and evidence linkage.

**Tech Stack:** Node.js ESM, built-in SHA-256, existing five work-mode registry, project file store, project service/API, Node test runner.

## Global Constraints

- Pure local only: no cloud evaluator, telemetry upload, SaaS experiment system, or remote judge.
- The built-in suite must cover exactly `learning`, `academic-writing`, `investigation`, `technical-delivery`, and `creative-studio` and derive required artifacts/checks/escalations from `SUPER_AGENT_WORK_MODES`.
- Suite version and checksum are backend-owned and cannot be supplied or downgraded by callers.
- A run identifies candidate, model, prompt, and policy versions plus one idempotency key.
- Observations retain contract booleans, ids, and evidence references only; no prompt, model output, student content, paper text, investigation material, source body, code, artwork, or secret is persisted in the evaluation receipt.
- Every scenario requires correct work mode, ready team, independent reviewer, all required accepted artifacts, all acceptance checks passed, all escalation checks resolved, and at least one evidence id.
- Missing, duplicate, unknown, or cross-mode scenarios fail closed. Unknown required ids do not earn credit.
- Only a complete passing run may become the project baseline.
- Candidate comparison uses exact criterion-level baseline results. Any baseline pass becoming a fail is a regression and sets `releaseBlocked=true`; score improvement cannot hide a critical regression.
- Identical idempotency retry returns the original run; conflicting reuse fails.
- Runs and baseline pointers survive file-store restart. Checksum mutation degrades governance and cannot authorize a baseline or clean release decision.
- This deterministic contract evaluation does not claim semantic correctness, calibrated human preference, or public-production model release readiness.

---

### Task 1: Versioned suite and deterministic evaluator

**Files:**
- Create: `src/agents/localQualityEvaluation.js`
- Create: `tests/localQualityEvaluation.test.mjs`

**Interfaces:**
- Produces: `getLocalQualityEvaluationSuite()`.
- Produces: `createLocalQualityEvaluationRun({ projectId, input, baselineRun, now })`.
- Produces: `verifyLocalQualityEvaluationRun(run)` and `publicLocalQualityEvaluationRun(run)`.

- [x] **Step 1: Write the failing pure evaluator test**

Assert five suite cases, backend-owned version/checksum, a complete passing run, an incomplete candidate with criterion-level regression ids, release blocking despite unchanged unrelated criteria, unknown/duplicate scenario rejection, and content-free serialized receipts.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localQualityEvaluation.test.mjs`

Expected: FAIL because `localQualityEvaluation.js` does not exist.

- [x] **Step 3: Implement the minimal suite/evaluator**

Build cases from `SUPER_AGENT_WORK_MODES`; calculate literal criterion pass/fail results, per-mode scores, overall score, SHA-256 suite/run checksums, baseline deltas, regression ids, and `releaseBlocked`. Reject malformed coverage before creating a receipt.

- [x] **Step 4: Run the evaluator test and verify green**

Run: `node --test tests/localQualityEvaluation.test.mjs`

Expected: PASS with deterministic results and no raw content fields.

---

### Task 2: Persistent API, baseline authority, and restart integrity

**Files:**
- Modify: `tests/localQualityEvaluation.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

**Interfaces:**
- Produces: `GET /projects/:projectId/quality-evaluation-suite`.
- Produces: `GET|POST /projects/:projectId/quality-evaluation-runs`.
- Produces: `POST /projects/:projectId/quality-evaluation-runs/:runId/baseline`.
- Produces: `local-quality-evaluation-governance/v1`.

- [x] **Step 1: Add a failing API lifecycle test**

Create a file-backed project, record one passing baseline run, retry it idempotently, record a regressing candidate, verify release blocking, restart and read both runs/baseline, then mutate one stored criterion and verify integrity becomes degraded.

- [x] **Step 2: Implement persistence and routes**

Persist at most 100 runs, append timeline/security-neutral quality logs and project-ledger events, keep one baseline id, reject a failing baseline, return governance summaries and integrity rows, and derive actor identity from request headers before body fields.

- [x] **Step 3: Add access policy**

Allow Manager/runtime/security/observer reads; allow Manager/runtime/security run creation; allow only Manager/security to change the baseline.

- [x] **Step 4: Run focused regressions**

Run: `node --test tests/localQualityEvaluation.test.mjs tests/workModes.test.mjs`

Expected: all evaluator, API, restart, tamper, and existing work-mode contracts pass.

---

### Task 3: P0 gate, documentation, and full verification

**Files:**
- Create: `scripts/validate-local-quality-evaluation.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-versioned-quality-evaluation.md`

**Interfaces:**
- Produces: `npm.cmd run agents:quality-evaluation`.

- [x] **Step 1: Add the focused gate**

Create a local file-backed project, prove all five modes in the suite, create a perfect baseline, create one technical-delivery regression, assert the exact failed criterion and release block, restart, and verify checksums/baseline without any Provider call.

- [x] **Step 2: Wire P0 release metadata and docs**

Add the command and required entry point to the local release checklist. Document version ownership, baseline authority, criterion-level regressions, no-output persistence, deterministic limitations, and separation from Provider transport eval.

- [x] **Step 3: Run completion verification**

Run: `node --check src/agents/localQualityEvaluation.js`, `node --check scripts/validate-local-quality-evaluation.mjs`, `npm.cmd test`, `npm.cmd run agents:quality-evaluation`, `npm.cmd run launch:local-mvp:check`, and `git diff --check`.

Expected: all tests and local release contracts pass without public-production overclaim.

- [x] **Step 4: Record exact results**

Append test counts and gate results; mark capability #34 complete only for the current pure-local deterministic scope while keeping the overall 50-capability goal active.

## Verification Results — 2026-07-10

- Red phase: `node --test tests/localQualityEvaluation.test.mjs` failed with `ERR_MODULE_NOT_FOUND` before the evaluator existed; the API lifecycle then failed with HTTP 405 before routes existed.
- Focused phase: `node --test tests/localQualityEvaluation.test.mjs tests/workModes.test.mjs` passed 20/20 with baseline, regression, restart, tamper, and existing five-mode contracts.
- Syntax: `node --check` passed for `localQualityEvaluation.js`, project service/API, focused gate, and server entrypoint.
- Full regression: `npm.cmd test` passed 152/152, with 0 failed, cancelled, or skipped.
- Focused P0 gate: `npm.cmd run agents:quality-evaluation` passed with `Local versioned quality evaluation validation passed.`
- Local release metadata: `npm.cmd run launch:local-mvp:check` passed with `Local MVP release checklist validation passed.`
- Whitespace: `git diff --check` exited 0; only existing CRLF-to-LF conversion warnings were emitted.
- Capability #34 is complete for pure-local deterministic work-mode contract regression. Semantic correctness and calibrated preference evaluation remain explicitly outside this slice; the overall 50-capability objective remains active.
