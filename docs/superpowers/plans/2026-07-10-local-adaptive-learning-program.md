# Local Adaptive Learning Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the learning work mode from artifact labels into a durable, learner-controlled syllabus-to-mastery loop with adaptive practice and spaced-review evidence.

**Architecture:** A focused pure module owns immutable learning-plan versions, content-minimized practice attempts, deterministic mastery projection, and next-action scheduling over a prerequisite DAG. The existing project service/API persists those receipts in the local project snapshot, exposes one learning-program read model, and keeps legacy non-learning projects blocked from the route. Existing work-mode tasks, review governance, autonomy governor, local auth, and file recovery remain lower-level controls rather than being duplicated.

**Tech Stack:** Node.js ESM, `node:test`, existing project service/API/file store, portable SHA-256 receipts.

## Global Constraints

- Pure local and open source; no LMS, cloud database, hosted analytics, or remote student profile.
- Preserve the current dirty upgrade worktree; no staging, commit, push, branch rewrite, or unrelated cleanup.
- Public seams are the pure learning-program contract, project service/API, file-backed restart, and focused P0 validator.
- Plans and attempts are append-only, idempotent, checksum-protected, and contain no raw learner answer text.
- Plan revision requires the latest expected version and checksum; prerequisite cycles fail closed.
- Mastery cannot be inferred from self-report alone: it requires scored attempts, minimum evidence, recency, and no unresolved prerequisite gap.
- Learners retain pace control through bounded session minutes, weekly minutes, study days, pause windows, and a revision route.
- Capability 42 owns age, academic-integrity, uncertainty, and citation safety; this capability exposes those unresolved safety gates but does not claim to complete them.

---

### Task 1: Pure learning plan and adaptive mastery contracts

**Files:**
- Create: `src/agents/localLearningProgram.js`
- Create: `tests/localLearningProgram.test.mjs`

**Interfaces:**
- Produces: `createLocalLearningPlan`, `createLocalLearningAttempt`, `verifyLocalLearningPlan`, `verifyLocalLearningAttempt`, `buildLocalLearningProgram`.
- Consumes: `portableSha256Hex` from `src/agents/accessControl.js`.

- [x] Write a failing test for a prerequisite-aware syllabus plan with diagnostic evidence, bounded learner pace, deterministic sessions, review cadence, and checksum verification.
- [x] Implement the immutable plan receipt and cycle/validation rules until the test passes.
- [x] Write a failing test for content-free practice attempts, idempotent identity, mastery evidence thresholds, decay/due review, prerequisite blocking, and adaptive next action.
- [x] Implement attempt receipts and the read-model projection until the test passes.

### Task 2: File-backed service and API

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Create: `tests/localLearningProgramApi.test.mjs`

**Interfaces:**
- Produces: `GET /projects/:id/learning-program`, `POST /projects/:id/learning-program/plans`, `POST /projects/:id/learning-program/plans/:planId/revisions`, and `POST /projects/:id/learning-program/attempts`.
- Persists: `localLearningPlans` and `localLearningAttempts` on the project snapshot.

- [x] Write a failing API test proving learning-only access, plan create/replay/revision, stale rejection, attempt replay/conflict, restart recovery, and tamper degradation.
- [x] Add service methods and API routes with Manager/security mutation access and private project read access.
- [x] Add the learning-program signature to read-model caching and prove restart/tamper behavior.

### Task 3: P0 gate, capability evidence, and release integration

**Files:**
- Create: `scripts/validate-local-learning-program.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/SUPER_AGENT_WORK_MODES.md`
- Modify: `src/agents/README.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

- [x] Register `P0 local learning syllabus diagnostic pace practice mastery and spaced-review contract`.
- [x] Build a file-backed validator that proves a real learning project moves from prerequisite gap to evidence-backed mastery and survives restart.
- [x] Replace capability 41's weak artifact-label evidence with the focused command and tests while keeping capability 42 explicitly separate.
- [x] Run focused tests, work-mode acceptance, all tests, build, bundle budget, smoke, launch gates, local MVP checklist, and `git diff --check`.

## Self-Review

- Covers syllabus-to-plan, diagnostic baseline, learner-controlled pacing, adaptive practice, mastery evidence, prerequisite order, spaced review, idempotency, restart, and tamper detection.
- Does not build a parallel task runner, authentication system, autonomy governor, review workflow, or hosted LMS.
- Does not overclaim teaching safety; it reports the existing capability-42 gates as unresolved until that phase is implemented.
