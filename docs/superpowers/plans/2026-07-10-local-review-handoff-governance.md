# Local Review Handoff Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a restart-safe local handoff and independent-review state machine with explicit acceptance criteria, acknowledgement, fenced reviewer claims, submission-version binding, SLA escalation, and auditable completion.

**Architecture:** A pure module creates immutable checksummed handoff and transition receipts and derives the current state without mutating history. Service routes validate real submissions/team identities, enforce submitter/reviewer separation and lease fences, and invoke the existing `reviewAgentSubmission` only after a valid completion request. The existing review workflow stays backward compatible but additively reports governed versus legacy review coverage.

**Tech Stack:** Node.js ESM, `node:test`, existing project service/API/file store/access control, portable SHA-256 receipts.

## Global Constraints

- Pure local; no SaaS workflow engine, hosted queue, email, or cloud identity.
- Preserve the dirty upgrade branch; do not stage, commit, push, or rewrite unrelated work.
- Handoffs require a real submission, a different team Reviewer, at least one acceptance criterion, an explicit future due time, and a submission fingerprint.
- Acknowledgement, claim, completion, and escalation are append-only receipts.
- Claims use monotonically increasing fences; only the latest unexpired claim may complete.
- Accepted verdicts require every required criterion to pass with evidence ids.
- Completion rejects a submission whose fingerprint changed after handoff creation.
- Existing direct review routes remain legacy-compatible and are counted separately rather than falsely labeled governed.

---

### Task 1: Pure handoff, lease and completion contracts

**Files:**
- Create: `src/agents/localReviewHandoff.js`
- Create: `tests/localReviewHandoff.test.mjs`

**Interfaces:**
- Produces handoff, acknowledgement, claim, completion and escalation receipt constructors/verifiers plus `buildLocalReviewHandoffGovernance`.

- [x] Write a failing test for requested → acknowledged → claimed → completed and overdue states.
- [x] Confirm module-not-found red with `node --test tests/localReviewHandoff.test.mjs`.
- [x] Implement immutable SHA-256 contracts, acceptance result checks, lease/fence derivation and tamper failure.
- [x] Re-run the pure test green.

### Task 2: File-backed service/API workflow

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `tests/localReviewHandoff.test.mjs`

**Interfaces:**
- Produces `GET|POST /projects/:id/review-handoffs`, `POST /projects/:id/review-handoffs/:handoffId/acknowledge`, `/claim`, `/complete`, and `POST /projects/:id/review-handoffs/scan`.

- [x] Add a failing API test for independent assignment, acknowledgement, competing claims, expiry takeover, stale fence, stale submission fingerprint, acceptance criteria, completion and restart.
- [x] Implement citation-free content-minimized receipts and service validation against real submission/team records.
- [x] Complete through the existing `reviewAgentSubmission`, bind the resulting review id/checksum, and append event-ledger proof.
- [x] Add access assertions for submitter creation, Reviewer-only transitions, Manager/runtime scanning and observer read-only access.

### Task 3: Workflow projection and P0 proof

**Files:**
- Create: `scripts/validate-local-review-handoff.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`
- Modify: `src/agents/README.md`

**Interfaces:**
- Produces `npm run agents:review-handoff` and additive governance coverage in `submission-review-workflow/v1`.

- [x] Register `P0 review handoff acknowledgement lease fence stale-submission and acceptance contract` and confirm missing-validator red.
- [x] Implement a file-backed gate covering all five work-mode acceptance criteria shapes plus contention, timeout, escalation and completion.
- [x] Add governed/legacy counts, open/overdue handoffs and integrity to the existing workflow without changing its schema.
- [x] Run focused tests, the P0 gate, five-mode acceptance, all tests, production build, bundle budget, smoke, launch gates, local MVP checklist and `git diff --check`.

## Self-Review

- Coverage includes every audited gap: acknowledgement, independence, leases, fences, SLA, stale versions, criteria, escalation, restart and tamper proof.
- Existing review semantics remain compatible; only the new governed route may claim lease-backed review assurance.
- No free-form artifact content is copied into governance receipts.
