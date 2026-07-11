# Local Citation Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn capability 44 into a deterministic local gate that proves every planned academic claim/citation link was independently assessed against a real source snapshot and automatically blocks missing, unsupported, contradictory, stale, retracted, corrected, or unavailable evidence.

**Architecture:** A focused pure module owns content-minimized, checksum-linked citation assessments and immutable audit receipts. The project service resolves assessments against capability 43's latest blueprint/finalization plus existing evidence searches/source snapshots, persists receipts in the atomic local project file, and exposes one private citation-integrity read model. The academic-writing pipeline consumes the latest valid audit additively: a passed audit changes its local status to `citation-integrity-passed`, while public-production readiness remains false.

**Tech Stack:** Node.js ESM, `node:test`, existing Agent project service/API/file store, portable SHA-256 receipts.

## Global Constraints

- Pure local and open source; no hosted bibliography, plagiarism, retraction, journal, or citation-verification service.
- Preserve the dirty `codex/super-agent-production` worktree; no staging, commit, push, branch rewrite, or unrelated cleanup.
- Public test seams are the pure citation contract, the private project service/API, and file-backed restart/read-model behavior.
- Persist claim/source/snapshot ids, closed judgements, dates, locators, hashes, lengths, policy values, findings, and checksums only; do not duplicate source text, evidence excerpts, rationales, research questions, claim prose, or manuscript bodies.
- Every assessment must bind one exact blueprint claim/source pair to one real source snapshot; evidence-search ids may resolve only to a snapshot owned by that search.
- The assessor must be the blueprint reviewer and must differ from the author.
- `supports`, `contradicts`, `irrelevant`, and `uncertain` are the only semantic stances; `active`, `corrected`, `retracted`, and `unavailable` are the only source statuses.
- Audit policy defaults to 730 maximum publication-age days and 30 maximum status-check-age days, with explicit bounded overrides.
- A passing audit requires complete pair coverage, at least one supporting link per claim, no contradiction, no stale publication/status check, no corrected/retracted/unavailable source, and a hashed evidence excerpt for every supports/contradicts assessment.
- Failed audits remain useful immutable evidence but never mark the manuscript citation-ready; a new assessment/audit supersedes them append-only.

---

### Task 1: Pure assessment and audit contract

**Files:**
- Create: `src/agents/localCitationIntegrity.js`
- Create: `tests/localCitationIntegrity.test.mjs`

**Interfaces:**
- Produces: `createLocalCitationAssessment`, `verifyLocalCitationAssessment`, `createLocalCitationIntegrityAudit`, `verifyLocalCitationIntegrityAudit`, and `buildLocalCitationIntegrity`.
- Consumes: capability 43 blueprint/finalization receipts and `portableSha256Hex`.

- [x] Write a failing test that creates one assessment per exact claim/source pair, proves excerpt/rationale text is absent, requires independent reviewer identity and real snapshot binding, and detects tampering.
- [x] Implement `local-citation-assessment/v1` with strict ids/enums/dates, excerpt/rationale hashes, source metadata, idempotency key, and checksum.
- [x] Write a failing test with worked literal outcomes for missing coverage, unsupported claims, contradictions, stale publication, stale status check, corrected/retracted/unavailable sources, and a fully passing audit.
- [x] Implement `local-citation-integrity-audit/v1` with deterministic finding ids, counts, readiness flags, assessment checksum manifest, finalization binding, and checksum verification.
- [x] Implement `local-citation-integrity/v1` projection that selects the latest assessment per claim/source pair, exposes integrity degradation, and never includes raw assessment text.

### Task 2: Real source-snapshot service and API integration

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Create: `tests/localCitationIntegrityApi.test.mjs`

**Interfaces:**
- Produces: `GET /projects/:id/citation-integrity`, `POST /projects/:id/citation-integrity/assessments`, and `POST /projects/:id/citation-integrity/audits`.
- Persists: `localCitationAssessments` and `localCitationIntegrityAudits`.

- [x] Write a failing file-backed API test that creates a real academic project, evidence snapshots, blueprint, immutable final manuscript, assessment set, blocked audit, replacement assessment, passing audit, restart, access denial, and tamper degradation.
- [x] Add service methods that resolve the latest blueprint/finalization, exact claim/source pair, snapshot ownership, reviewer identity, assessment idempotency, and audit policy before writing.
- [x] Add integrity-sensitive cache signature fields, private Manager/security routes, deferred route discovery, and academic-writing-only failure behavior.
- [x] Extend the service-owned academic pipeline read-model projection to consume valid audits and report `citation-integrity-passed` only for the latest exact finalization; retain `readyForProduction: false`.

### Task 3: P0 release gate and capability evidence

**Files:**
- Create: `scripts/validate-local-citation-integrity.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/SUPER_AGENT_WORK_MODES.md`
- Modify: `src/agents/README.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

**Interfaces:**
- Produces: `npm run agents:citation-integrity` and marker `P0 local claim source support contradiction freshness status and citation integrity contract`.

- [x] Build a focused file-backed P0 scenario that demonstrates automatic blocked findings, corrected replacement assessment, exact-finalization pass, restart, no raw excerpts/rationales, and tamper degradation.
- [x] Register the command in launch and local-MVP release metadata.
- [x] Replace capability 44's weak label evidence with concrete contract/test evidence and document the honest pure-local boundary.
- [x] Run focused tests/P0, capability 43 P0, work-mode acceptance, all tests, build, bundle budget, smoke, launch gates, local MVP checklist, and `git diff --check`.

## Self-Review

- The plan covers every current row-44 claim: missing, unsupported, contradictory, and stale citations are deterministic findings; retracted/corrected/unavailable source state is stricter additional coverage.
- The plan reuses real local source snapshots, manuscript finalization, reviewer identity, persistence, access control, and cache infrastructure instead of inventing a parallel evidence store.
- The plan does not claim that a model can determine truth, that source status was checked against a live registry, that plagiarism was detected, or that the manuscript is publicly publishable. It proves only that locally recorded independent semantic/status assessments satisfy a deterministic policy.
