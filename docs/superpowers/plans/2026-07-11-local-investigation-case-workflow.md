# Local Investigation Case Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn capability 45 into a durable local investigation case workflow with versioned hypotheses, real evidence/source-review binding, reliability scoring, append-only custody, automatic contradiction handling, deterministic conclusion confidence, independent closure, and tamper-aware restart.

**Architecture:** A focused pure module owns content-minimized case, evidence, custody-event, contradiction-resolution, conclusion, and closure receipts. The Agent project service resolves those receipts against the investigation work-mode roster plus existing evidence searches, source snapshots, and approved source reviews, then persists them in the atomic local project snapshot and exposes one private case read model. Generic evidence custody remains the storage/provenance substrate; the new domain adds case-specific custody and reasoning without claiming legal chain-of-custody or autonomous truth determination.

**Tech Stack:** Node.js ESM, `node:test`, existing project service/API/file store, existing evidence/source-review records, portable SHA-256 receipts.

## Global Constraints

- Pure local and open source; no hosted case-management, intelligence, legal-discovery, court-evidence, or external fact-verification service.
- Preserve the dirty `codex/super-agent-production` worktree; no staging, commit, push, branch rewrite, or unrelated cleanup.
- Public test seams are the pure investigation contract, private service/API routes, and file-backed restart/read-model behavior.
- Store case scope, hypothesis statements, falsification criteria, observations, and resolution rationales as hashes and lengths only; do not duplicate raw source or case narrative text.
- Case lead, evidence investigator, causal analyst, and risk reviewer must resolve from the work-mode roster; reviewer must be independent from evidence collection and analysis.
- A case requires at least two hypotheses so alternatives are tested instead of confirming one favored explanation.
- Every case evidence row binds one real source snapshot and one approved independent source review, records deterministic reliability dimensions, and relates the evidence to at least one known hypothesis.
- Reliability dimensions are authority, proximity, corroboration, recency, and bias risk, each 0-10000 basis points; the score is the integer average of the four positive dimensions plus inverted bias risk.
- Custody begins with acquisition in the evidence receipt; later verify, transfer, and seal events are append-only, sequential, checksum-linked, actor-attributed, and time-monotonic.
- Opposing evidence relations for the same hypothesis automatically create stable contradiction ids. Conclusion is blocked until every contradiction has an independent reviewer resolution.
- Conclusion confidence is derived from weighted supporting/contradicting evidence and the declared prior; callers cannot set the final confidence.
- Case closure requires every evidence chain sealed, every contradiction resolved, the latest conclusion, and independent reviewer acceptance.
- Local closure never claims legal admissibility, criminal attribution, due-process compliance, or public-production readiness.

---

### Task 1: Pure case, evidence, custody, contradiction, and closure contracts

**Files:**
- Create: `src/agents/localInvestigationCase.js`
- Create: `tests/localInvestigationCase.test.mjs`

**Interfaces:**
- Produces: `createLocalInvestigationCase`, `createLocalInvestigationEvidence`, `createLocalInvestigationCustodyEvent`, `investigationContradictionIds`, `createLocalInvestigationContradictionResolution`, `createLocalInvestigationConclusion`, `createLocalInvestigationClosure`, verification functions, and `buildLocalInvestigationCaseWorkflow`.
- Consumes: `portableSha256Hex` and existing source-snapshot/source-review metadata.

- [x] Write a failing test for content-minimized scope/hypotheses, alternative-hypothesis minimum, independent roles, version links, and checksum tampering.
- [x] Implement `local-investigation-case/v1` and verification with strict roles, hypothesis ids/types/priors, hashes, and append-only versions.
- [x] Write a failing test for real snapshot/approved-review evidence binding, deterministic reliability score, known hypothesis relations, and raw observation exclusion.
- [x] Implement `local-investigation-evidence/v1` and verification.
- [x] Write a failing test for acquisition-to-verify/transfer/seal custody ordering, stale/forked events, actor attribution, monotonic timestamps, and checksum tampering.
- [x] Implement `local-investigation-custody-event/v1` and chain verification.
- [x] Write a failing test for automatic stable contradiction ids, unresolved-conclusion rejection, independent resolution, derived hypothesis confidence, sealed-evidence requirement, closure, and tamper degradation.
- [x] Implement contradiction resolution, deterministic conclusion/closure receipts, and the aggregate `local-investigation-case-workflow/v1` read model.

### Task 2: Real evidence and file-backed API integration

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Create: `tests/localInvestigationCaseApi.test.mjs`

**Interfaces:**
- Produces: `GET /projects/:id/investigation-case`, plus POST routes for cases, evidence, evidence custody events, contradiction resolutions, conclusions, and closures.
- Persists: `localInvestigationCases`, `localInvestigationEvidence`, `localInvestigationCustodyEvents`, `localInvestigationContradictionResolutions`, `localInvestigationConclusions`, and `localInvestigationClosures`.

- [x] Write a failing API test that initiates a real investigation team, records source snapshots and approved reviews, creates a case/evidence, observes an unresolved contradiction, records sealed custody and resolution, derives a conclusion, closes independently, restarts, and detects tampering.
- [x] Add service methods that resolve work-mode roles, source snapshot/review references, optimistic case/evidence chain state, latest contradiction set, conclusion lineage, idempotency, and fail-closed integrity before writes.
- [x] Add private Manager/security routes, deferred route discovery, academic/learning-mode rejection, and integrity-sensitive cache signatures.

### Task 3: P0 release evidence

**Files:**
- Create: `scripts/validate-local-investigation-case.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/SUPER_AGENT_WORK_MODES.md`
- Modify: `src/agents/README.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

**Interfaces:**
- Produces: `npm run agents:investigation-case` and marker `P0 local investigation hypotheses reliability custody contradictions confidence review and closure contract`.

- [x] Build a focused file-backed P0 gate from the pure and API workflows.
- [x] Register the command in launch and local-MVP release metadata.
- [x] Replace capability 45's weak mode-label evidence and document the local/non-legal boundary.
- [x] Run focused tests/P0, work-mode acceptance, all tests, build, bundle budget, smoke, launch gates, local MVP checklist, and `git diff --check`.

## Self-Review

- The plan covers every current row-45 claim with executable evidence: hypothesis versions, source reliability, case-specific custody, contradiction resolution, and derived conclusion confidence.
- The plan additionally covers alternative hypotheses, independent review, case freeze, idempotency, restart, raw-text minimization, and tamper degradation.
- The plan reuses real local evidence snapshots, approved source reviews, project roles, persistence, and access control instead of inventing parallel source storage or reviewer identity.
- The plan deliberately does not claim legal chain-of-custody, admissibility, investigative authority, identity attribution, live fact verification, or public-production readiness.
