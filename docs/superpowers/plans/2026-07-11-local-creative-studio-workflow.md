# Local Creative Studio Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. This thread uses inline execution because uninterrupted autonomous progress is already authorized and subagent delegation was not requested.

**Goal:** Upgrade capability 49 into a pure-local, restart-safe creative production workflow from evidence-backed brief through immutable iterations, structured critique, export-quality verification, and acknowledged handoff.

**Architecture:** Add one focused pure module for checksum-linked brief, iteration, critique, export, handoff, and acknowledgement receipts. Bind iterations to real immutable `creative-work` submissions from the existing artifact store, bind actors to the creative-studio roster in the service, and expose one private project route. The terminal state is `readyForRightsProvenanceAudit`; capability 50 remains responsible for licenses, attribution, generated-content provenance, and final release authority.

**Tech Stack:** Node.js ESM, `node:test`, existing SHA-256 helper, project file store/service/API/access-control, existing Agent submission storage proofs.

## Global Constraints

- Pure local/open-source operation; no hosted DAM, review SaaS, cloud renderer, or remote publishing service.
- Raw creative direction, critique prose, handoff instructions, and known limitations are content-minimized to hashes and lengths in workflow receipts.
- Brief audience segments must reference real project evidence ids and define measurable deliverable/export specifications.
- Iterations bind an exact brief version and a real immutable `creative-work` submission from the assigned art director.
- Every iteration requires separate `creative-lead` and `audience-researcher` critiques across exact `brief-alignment`, `craft`, `audience-fit`, and `accessibility` dimensions.
- An approved critique requires every score to be at least 7000 basis points and zero blocking dimensions; revisions must address the complete stable issue-id set from both prior critiques.
- Export evidence must cover every brief deliverable exactly once and match format, dimensions, duration, color space, byte limit, checksum, and accessibility requirements.
- Handoff manifests bind the exact export and editable-source/toolchain/dependency evidence; the creative lead must acknowledge the exact manifest.
- Newer brief/iteration/export/handoff state makes older terminal evidence stale without invalidating untampered history.
- Final creative state remains blocked for external release until capability 50 records the matching rights/provenance audit.

---

### Task 1: Versioned evidence-backed brief and immutable iteration lineage

**Files:**
- Create: `src/agents/localCreativeStudio.js`
- Create: `tests/localCreativeStudio.test.mjs`
- Modify: `src/agents/agentProjectService.js` to allow the `creative-work` artifact type.

**Interfaces:**
- Produces `createLocalCreativeBrief`, `verifyLocalCreativeBrief`, `createLocalCreativeIteration`, `verifyLocalCreativeIteration`, and `buildLocalCreativeStudioWorkflow`.
- Brief consumes structured audience, deliverable, constraint, success-criterion, and role data; iteration consumes a real immutable submission snapshot.

- [x] **Step 1: Write a failing public-seam test** for an evidence-backed brief, deliverable-spec validation, role separation, content minimization, and checksum tampering.
- [x] **Step 2: Run `node --test tests/localCreativeStudio.test.mjs`** and confirm failure because the module does not exist.
- [x] **Step 3: Implement versioned brief receipts** with optimistic lineage, unique audience/deliverable ids, export specs, evidence references, hashed narrative fields, and monotonic time.
- [x] **Step 4: Add a failing immutable-iteration test** for art-director ownership, `creative-work` storage proof, exact brief binding, version lineage, and deliverable coverage.
- [x] **Step 5: Implement iteration receipts and run the focused tests green.**

### Task 2: Structured dual-perspective critique and complete revision closure

**Files:**
- Modify: `src/agents/localCreativeStudio.js`
- Modify: `tests/localCreativeStudio.test.mjs`

**Interfaces:**
- Produces `createLocalCreativeCritique`, `creativeCritiqueIssueIds`, and revision support in `createLocalCreativeIteration`.
- Critique perspectives are exactly `creative-lead` and `audience-researcher`; dimension ids are fixed by the module.

- [x] **Step 1: Add failing critique tests** for exact dimensions, score threshold, blocking findings, reviewer assignment, prose hashing, stable issue ids, and duplicate perspective rejection in the projection.
- [x] **Step 2: Implement immutable critique receipts** with exact iteration/artifact binding and deterministic issues.
- [x] **Step 3: Add a failing revision test** requiring a newer stored submission and the complete union of both prior critique issue ids.
- [x] **Step 4: Implement revision lineage** and reject partial issue closure, stale brief links, same-artifact replay, and revisions after dual approval.
- [x] **Step 5: Run the focused tests green.**

### Task 3: Export-quality gate and acknowledged collaboration handoff

**Files:**
- Modify: `src/agents/localCreativeStudio.js`
- Modify: `tests/localCreativeStudio.test.mjs`

**Interfaces:**
- Produces `createLocalCreativeExport`, `createLocalCreativeHandoff`, `createLocalCreativeHandoffAcknowledgement`, and corresponding verifiers.
- Export consumes the latest iteration plus both approved critiques; handoff consumes the exact export and produces a manifest awaiting acknowledgement.

- [x] **Step 1: Add failing export tests** for complete deliverable coverage, exact spec matching, output checksum, artifact-storage evidence, accessibility evidence, byte limits, and dual approved critique.
- [x] **Step 2: Implement the export receipt** with `readyForHandoff=true` and `readyForExternalRelease=false`.
- [x] **Step 3: Add failing handoff tests** for exact export binding, editable-source evidence, toolchain/dependency manifest, content-minimized instructions/limitations, assigned sender/recipient, acknowledgement, time ordering, and tamper degradation.
- [x] **Step 4: Implement handoff and acknowledgement receipts** and derive `readyForRightsProvenanceAudit` only after exact accepted acknowledgement.
- [x] **Step 5: Run the focused tests green.**

### Task 4: File-backed private API, P0 registration, and release verification

**Files:**
- Create: `tests/localCreativeStudioApi.test.mjs`
- Create: `scripts/validate-local-creative-studio.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `package.json`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/SUPER_AGENT_WORK_MODES.md`
- Modify: `src/agents/README.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

**Interfaces:**
- Adds private `/projects/:id/creative-studio-workflow` GET plus `/briefs`, `/iterations`, `/critiques`, `/exports`, `/handoffs`, and `/handoffs/:id/acknowledgements` POST routes.
- Adds `npm run agents:creative-studio` and marker `Local creative studio workflow validation passed.`

- [x] **Step 1: Write a failing file-backed API test** that creates audience evidence, brief, stored draft, dual critique, revision, dual approval, export, handoff, acknowledgement, restart readback, role override resistance, idempotency, and tamper degradation.
- [x] **Step 2: Add service persistence/cache signatures and server-owned role binding** for creative lead, art director, audience researcher, and rights reviewer.
- [x] **Step 3: Add private API/access routes** and fail new writes closed on degraded state or stale lineage.
- [x] **Step 4: Register P0 and document exact guarantees/non-claims** including the explicit capability-50 boundary.
- [x] **Step 5: Run `npm run agents:creative-studio`, `npm run agents:work-modes:acceptance`, `npm test`, `npm run build`, `npm run ui:bundle:check`, `npm run agents:product-team:smoke`, `npm run launch:gates`, `npm run launch:local-mvp:check`, and `git diff --check`.

## Self-review

- Spec coverage: brief, audience evidence, immutable iterations, two-perspective critique, complete revision closure, export checks, collaboration handoff, acknowledgement, restart, privacy, tamper handling, API, P0, and capability-50 boundary all have explicit tasks.
- Placeholder scan: no placeholder markers or unspecified error-handling steps remain.
- Type consistency: brief, iteration, critique, export, handoff, acknowledgement, projection, service, API, test, and documentation names are consistent.
