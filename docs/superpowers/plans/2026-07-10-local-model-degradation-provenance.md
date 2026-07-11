# Local Model Degradation Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every local artifact generation result truthfully identifies whether a model produced it, why a requested model degraded, what quality ceiling applies, and which human review boundary prevents fallback output from masquerading as model work.

**Architecture:** Add a pure `localModelDegradation.js` classifier that emits content-free SHA-256 provenance receipts for model output, requested-model fallback, and explicitly requested local templates. Integrate it at the existing `generateAgentArtifactDraft` seam, persist bounded receipt metadata independently of draft content, project it into artifact quality/submissions, and expose restart-safe governance. Keep kickoff provenance separate because it already has a dedicated `kickoff-generation-provenance/v1` contract.

**Tech Stack:** Node.js ESM, built-in SHA-256, existing model Provider and artifact-draft pipeline, project file store, service/API, Node test runner.

## Global Constraints

- Pure local only; no remote fallback router, cloud model broker, telemetry upload, or SaaS quality service.
- Generation modes are backend-derived: `model-provider-output`, `requested-model-fallback`, or `explicit-local-template`.
- Caller fields cannot set `modelUsed`, generation mode, quality tier, release eligibility, or fallback reason.
- A successful Provider result is the only condition that may set `modelUsed=true` or `generationMode=model-provider-output`.
- Requested-model denial, missing/disabled Provider, circuit-open, budget exhaustion, or transport failure must produce `requested-model-fallback` when `requireModel=false`; `requireModel=true` continues to fail without producing fallback content.
- Degradation reasons use a closed redacted code set. Provider errors, prompts, outputs, instructions, project content, credentials, and response bodies never enter the provenance receipt.
- Model output has quality tier `model-draft`; requested fallback has `degraded-template`; explicit local generation has `local-template`.
- Every generated draft requires human review. Requested fallback and explicit templates are ineligible for direct acceptance/final delivery until submitted through the normal Reviewer workflow; caller-supplied `accepted` or completed review state is forced back to `pending-review`.
- Artifact quality may describe structural readiness but must expose the generation quality ceiling and cannot label fallback/template output as model-authored.
- Receipts persist across restart, are checksum verified, degrade on mutation, and are capped at 160 per project.
- Existing Provider policy, budget, retry, circuit, prompt boundary, secret redaction, and usage receipts remain authoritative and are not bypassed.
- This slice does not promise semantic equivalence between model and template output; it makes the difference impossible to hide.

---

### Task 1: Pure generation provenance classifier

**Files:**
- Create: `src/agents/localModelDegradation.js`
- Create: `tests/localModelDegradation.test.mjs`

**Interfaces:**
- Produces: `createModelGenerationProvenance({ projectId, agentId, taskId, artifactType, modelRequested, modelRequired, modelResult, modelStatus, degradationReason, now })`.
- Produces: `verifyModelGenerationProvenance(receipt)` and `publicModelGenerationProvenance(receipt)`.

- [x] **Step 1: Write failing classifier tests**

Assert successful Provider output is the only model-authored mode; missing Provider, policy denial, circuit, budget, and transport failure map to closed fallback reason codes; explicit `useModel=false` is a local template rather than a failure; serialized receipts contain no supplied raw error/output/secret.

- [x] **Step 2: Run red test**

Run: `node --test tests/localModelDegradation.test.mjs`

Expected: FAIL because the classifier module does not exist.

- [x] **Step 3: Implement minimal classifier and SHA-256 verification**

Derive mode, tier, human-review requirement, direct acceptance/final delivery eligibility, model/provider identifiers, and content-free checksum from trusted execution facts.

- [x] **Step 4: Run green test**

Run: `node --test tests/localModelDegradation.test.mjs`

Expected: PASS for all three modes and redaction invariants.

---

### Task 2: Artifact pipeline enforcement and persistent governance

**Files:**
- Modify: `tests/localModelDegradation.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

**Interfaces:**
- Produces: `GET /projects/:projectId/model-degradation-readiness` returning `local-model-degradation-readiness/v1`.
- Extends: `agent-artifact-draft/v1`, `artifact-draft-quality/v1`, and submitted draft proof with `generationProvenance`.

- [x] **Step 1: Add failing service/API tests**

Generate one successful local-model draft, one transport-failed fallback, and one explicit template. Assert truthful mode/model flags, closed reason codes, quality ceilings, forced pending review on submitted fallback, content-free persisted receipts, API governance integrity, and restart recovery.

- [x] **Step 2: Integrate classifier without changing Provider decisions**

Track the actual failure branch, build provenance after Provider execution, attach it to draft quality and draft checksum, append a quality log/event plus bounded receipt, save before returning, and use the saved project for optional submission.

- [x] **Step 3: Enforce generated-draft review state**

When `submit=true`, force generated model/fallback/template drafts to `submitted` plus `pending-review` regardless of caller-provided accepted/completed values; retain the standard independent Reviewer path as the only acceptance mechanism.

- [x] **Step 4: Add governance and access route**

Expose mode/reason/tier counts and checksum rows. Allow Manager/runtime/security/observer reads; do not expose a mutation/delete route for receipts.

- [x] **Step 5: Run focused regressions**

Run: `node --test tests/localModelDegradation.test.mjs tests/modelProvider.test.mjs tests/localProviderBudgetReservation.test.mjs tests/localPromptBoundary.test.mjs`

Expected: all provenance, Provider, budget, and prompt-boundary behavior passes.

---

### Task 3: P0 gate, documentation, and completion verification

**Files:**
- Create: `scripts/validate-local-model-degradation.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/LOCAL_PROVIDER_TRANSPORT_RELIABILITY.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-model-degradation-provenance.md`

**Interfaces:**
- Produces: `npm.cmd run agents:model-degradation`.

- [x] **Step 1: Build focused file-backed gate**

Use a fake local Provider that fails transport, generate and submit a fallback, prove it is not model-authored and cannot self-accept, restart, verify the content-free receipt, then generate a successful model result and prove the mode changes only on actual Provider success.

- [x] **Step 2: Wire P0 metadata and operator docs**

Document the mode matrix, closed reason codes, review forcing, quality ceiling, no-content receipt, separation from kickoff provenance, and local-only limitation.

- [x] **Step 3: Run full verification**

Run: `node --check src/agents/localModelDegradation.js`, `node --check scripts/validate-local-model-degradation.mjs`, `npm.cmd test`, `npm.cmd run agents:model-degradation`, `npm.cmd run launch:local-mvp:check`, and `git diff --check`.

Expected: all tests and gates pass with no fallback/model provenance ambiguity.

- [x] **Step 4: Record exact evidence**

Append counts and command results; mark #35 complete for the pure-local artifact-generation scope while leaving the overall 50-capability objective active.

## Verification Results — 2026-07-10

- Red phase: classifier test failed with `ERR_MODULE_NOT_FOUND`; service/API lifecycle then failed because generated drafts had no `generationProvenance`.
- Focused provenance/Provider regression: 23/23 passed across model degradation, Provider adapter, Provider budget reservations, and prompt-boundary tests.
- Full regression: `npm.cmd test` passed 154/154 with 0 failed, cancelled, or skipped.
- Focused P0 gate: `npm.cmd run agents:model-degradation` passed with `Local model degradation provenance validation passed.`
- Local release metadata: `npm.cmd run launch:local-mvp:check` passed.
- Product workflow: `npm.cmd run agents:product-team:smoke` initially exposed that reviewed template drafts remained permanently not-ready; Artifact Quality Audit was corrected to require accepted review or changes-requested plus revision response, then the smoke passed.
- Manager low-write contracts: `npm.cmd run agents:scenario:contract` passed all six contract slices.
- Syntax checks passed for the classifier, service/API, gate, and server entrypoint.
- `git diff --check` exited 0; only existing CRLF-to-LF conversion warnings were emitted.
- Capability #35 is complete for pure-local artifact generation provenance and degradation handling. The overall 50-capability objective remains active.
