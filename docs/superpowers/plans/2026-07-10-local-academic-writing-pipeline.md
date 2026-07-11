# Local Academic Writing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn academic-writing mode into a durable research-question-to-final-manuscript workflow with structural, claim, evidence, review, revision, and finalization lineage.

**Architecture:** A focused pure module owns checksum-linked blueprint versions and content-free draft/revision/finalization receipts. It references the existing local evidence searches, immutable Agent submissions/artifacts, independent submission reviews, storage proofs, and work-mode ownership instead of duplicating them. The project service/API validates every reference against current project state and exposes one pipeline read model; capability 44 remains responsible for semantic citation support, staleness, and contradiction auditing.

**Tech Stack:** Node.js ESM, `node:test`, existing project service/API/file store, existing artifact writer and review path, portable SHA-256 receipts.

## Global Constraints

- Pure local and open source; no cloud writing suite, hosted bibliography service, remote plagiarism API, or public-production claim.
- Preserve the current dirty upgrade worktree; no staging, commit, push, branch rewrite, or unrelated cleanup.
- Public seams are the pure academic-writing contract, real project submission/review API, file-backed restart, and focused P0 validator.
- Blueprint/lineage receipts store research-question and claim hashes, lengths, closed metadata, ids, and checksums only; manuscript, claim, review-comment, and source body text remain in their existing local artifact/evidence records.
- Section dependencies must be acyclic; author and independent reviewer must differ.
- Claim source ids must resolve to project evidence records, but semantic support, recency, contradiction, and retraction checks remain capability 44.
- Drafts must reference real immutable submission storage proof and explicitly cover blueprint section/claim ids.
- A requested-changes review must be answered by a newer draft that addresses every stable review issue id.
- Finalization requires the latest draft, full section/claim coverage, an accepted independent review for that exact submission, and no unresolved earlier requested-change issue.

---

### Task 1: Pure blueprint and manuscript lineage

**Files:**
- Create: `src/agents/localAcademicWritingPipeline.js`
- Create: `tests/localAcademicWritingPipeline.test.mjs`

**Interfaces:**
- Produces: `createLocalAcademicWritingBlueprint`, `verifyLocalAcademicWritingBlueprint`, `createLocalAcademicDraftReceipt`, `createLocalAcademicRevisionReceipt`, `createLocalAcademicFinalization`, `academicReviewIssueIds`, and `buildLocalAcademicWritingPipeline`.
- Consumes: `portableSha256Hex` from `src/agents/accessControl.js`.

- [x] Write a failing test for hashed research question/claims, section DAG, independent reviewer, known source ids, version links, and tamper detection.
- [x] Implement immutable blueprint versions and validation until green.
- [x] Write a failing test for real submission/storage references, requested-change issue ids, full revision response, accepted latest-draft finalization, coverage gaps, and lineage tampering.
- [x] Implement draft/revision/finalization receipts and read-model projection until green.

### Task 2: Real artifact/review service and API integration

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Create: `tests/localAcademicWritingPipelineApi.test.mjs`

**Interfaces:**
- Produces: `GET /projects/:id/academic-writing-pipeline`, blueprint create/revision routes, `POST /academic-writing-pipeline/drafts`, `POST /drafts/:draftId/revisions`, and `POST /academic-writing-pipeline/finalize`.
- Persists: `localAcademicWritingBlueprints`, `localAcademicDraftReceipts`, `localAcademicRevisionReceipts`, and `localAcademicFinalizations`.

- [x] Write a failing file-backed API test using real evidence search, `academic-manuscript` submissions, changes-requested review, revision submission, accepted review, finalization, restart, and tamper degradation.
- [x] Add `academic-manuscript` to the bounded artifact type contract and validate source/submission/review/storage references in service methods.
- [x] Add private academic-writing-only routes, idempotency/stale checks, integrity-sensitive cache signatures, and deferred route discovery.

### Task 3: P0 manuscript gate and release evidence

**Files:**
- Create: `scripts/validate-local-academic-writing-pipeline.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/SUPER_AGENT_WORK_MODES.md`
- Modify: `src/agents/README.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

- [x] Register `P0 local academic question outline claims draft review revision and finalization contract`.
- [x] Prove a file-backed academic-writing project traverses real evidence, manuscript submission, independent changes request, complete revision, accepted final review, freeze, and restart.
- [x] Replace capability 43's weak mode-label evidence while explicitly leaving semantic citation integrity to capability 44.
- [x] Run focused tests, learning/teaching P0, work-mode acceptance, all tests, build, bundle budget, smoke, launch gates, local MVP checklist, and `git diff --check`.

## Self-Review

- Covers research question, outline, claim/source mapping, draft, independent review, revision issues, final manuscript freeze, immutable lineage, idempotency, restart, and tamper detection.
- Reuses actual local evidence, artifact storage, submission, and review records instead of inventing parallel content or reviewer systems.
- Does not claim citation semantics, plagiarism detection, journal formatting, legal authorship, or remote publication readiness; capability 44 handles citation integrity next.
