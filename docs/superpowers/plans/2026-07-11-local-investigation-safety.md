# Local Investigation Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn capability 46 into a mandatory local investigation authorization layer for PII, consent/authority, sensitive data, minimization, evidence sufficiency, external effects, human escalation, and one-time operation use.

**Architecture:** A focused pure module owns versioned safety policies, content-minimized request decisions, non-authorizing human resolutions, and one-time operation-use receipts. The project service derives case state from capability 45, validates authority evidence, persists the safety ledgers, exposes one private read model, and requires matching unexpired unused decisions before recording investigation evidence, conclusions, or closure. Safety decisions classify and authorize bounded local actions; they do not determine legality or replace privacy/legal review.

**Tech Stack:** Node.js ESM, `node:test`, existing investigation case/service/API/file store, portable SHA-256 receipts.

## Global Constraints

- Pure local and open source; no hosted compliance, identity enrichment, surveillance, legal, consent-management, or data-broker service.
- Preserve the dirty `codex/super-agent-production` worktree; no staging, commit, push, branch rewrite, or unrelated cleanup.
- Public test seams are the pure policy/decision/use contract, private service/API routes, and the three capability-45 write fences across file restart.
- Persist request hashes, lengths, closed categories/signals, target ids, authority metadata, decisions, reasons, expiry, and checksums only; never persist raw request text or detected PII values.
- Authority bases are `none`, `subject-consent`, `organizational-mandate`, or `public-record-research`; consent/mandate require real project evidence ids.
- Public-record authority may authorize only public-source collection of operational/public-record categories.
- Credentials, doxxing, stalking, impersonation, retaliation, covert surveillance, and unauthorized access are non-configurable hard stops.
- Minor subjects, biometrics, intimate data, and precise location always require human review and never receive automatic operation authorization.
- Requested categories outside policy scope and undeclared detected PII fail the minimization gate.
- Draft conclusion requires at least two evidence rows, all sealed, and zero unresolved contradictions; close-case requires a valid recorded conclusion.
- External action and publication are never automatically authorized by this local layer.
- Human resolution records disposition and evidence but cannot convert the blocked decision into operation authorization; re-evaluation is required after scope/authority changes.
- Allowed decisions expire after a bounded policy TTL and are consumable exactly once for the matching action and target ids.
- Local readiness never claims legal basis, regulatory compliance, consent validity, investigative authority, or public-production readiness.

---

### Task 1: Pure policy, decision, resolution, and one-time use

**Files:**
- Create: `src/agents/localInvestigationSafety.js`
- Create: `tests/localInvestigationSafety.test.mjs`

**Interfaces:**
- Produces: `createLocalInvestigationSafetyPolicy`, `createLocalInvestigationSafetyDecision`, `createLocalInvestigationSafetyResolution`, `createLocalInvestigationSafetyUse`, verification functions, and `buildLocalInvestigationSafety`.
- Consumes: capability-45 case receipts/state and `portableSha256Hex`.

- [x] Write a failing test for versioned authority policy, competing-case binding, public-record scope restrictions, content minimization, and checksum tampering.
- [x] Implement `local-investigation-safety-policy/v1` with immutable hard stops, bounded retention/TTL, authority evidence, allowed categories, and version links.
- [x] Write a failing worked-case matrix for allowed minimized collection, undeclared PII, missing authority, minor/sensitive data, prohibited conduct, insufficient evidence, external action, and close-case prerequisites.
- [x] Implement `local-investigation-safety-decision/v1` with deterministic signal/rule priority, operation fingerprint, expiry, reasons, model boundary, and no raw values.
- [x] Write a failing test for non-authorizing human resolution, expired/mismatched decision denial, one-time exact-target use, use tampering, and aggregate restart projection.
- [x] Implement resolution/use receipts and `local-investigation-safety/v1` integrity/readiness projection.

### Task 2: Mandatory service/API fences

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `tests/localInvestigationCaseApi.test.mjs`
- Create: `tests/localInvestigationSafetyApi.test.mjs`

**Interfaces:**
- Produces: `GET /projects/:id/investigation-safety`, policy/evaluate/resolve routes, and mandatory `safetyDecisionId` consumption for evidence, conclusion, and closure writes.
- Persists: `localInvestigationSafetyPolicies`, `localInvestigationSafetyDecisions`, `localInvestigationSafetyResolutions`, and `localInvestigationSafetyUses`.

- [x] Write a failing API test using a real investigation case to prove policy creation, blocked request classes, allowed collection, mandatory/one-time decision use, non-authorizing resolution, restart, raw-text absence, access control, and tamper degradation.
- [x] Add service policy/evaluate/resolve methods that validate authority ids, derive authoritative case state, handle idempotency, and persist integrity-sensitive ledgers.
- [x] Add a shared service use-consumption helper and fence `recordLocalInvestigationEvidence`, `createLocalInvestigationConclusion`, and `closeLocalInvestigationCase` before any business write.
- [x] Update capability-45 API acceptance to create policy, evaluate matching decisions, and pass safety decisions through the full case workflow.
- [x] Add private Manager/security routes, deferred discovery, cache signatures, and non-investigation rejection.

### Task 3: P0 release evidence

**Files:**
- Create: `scripts/validate-local-investigation-safety.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/SUPER_AGENT_WORK_MODES.md`
- Modify: `src/agents/README.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

**Interfaces:**
- Produces: `npm run agents:investigation-safety` and marker `P0 local investigation authority privacy minimization sufficiency human review and one-time authorization contract`.

- [x] Build a focused file-backed P0 gate from pure and API safety workflows.
- [x] Register the gate in launch/local-MVP metadata and retain capability-45 regression coverage.
- [x] Replace capability 46's partial escalation-label evidence with mandatory operation-gate evidence and document the legal/compliance boundary.
- [x] Run capability 45/46 P0, work-mode acceptance, all tests, build, bundle budget, smoke, launch gates, local MVP checklist, and `git diff --check`.

## Self-Review

- The plan covers every current row-46 claim: PII, authority/consent, sensitive subjects/data, evidence insufficiency, and hard gates.
- The plan additionally covers data minimization, prohibited conduct, external effects, expiry, one-time exact-target consumption, human disposition, restart, idempotency, and tamper degradation.
- The safety layer is mandatory on actual case writes, not an optional read model or duplicate escalation label.
- The plan does not claim legal authority, consent validity, regulatory compliance, emergency capability, surveillance capability, or public-production certification.
