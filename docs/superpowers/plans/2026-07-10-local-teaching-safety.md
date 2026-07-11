# Local Teaching Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mandatory, content-minimized teaching-safety authorization boundary for learning requests, with age-band adaptation, academic-integrity controls, evidence/uncertainty requirements, privacy protection, and human escalation.

**Architecture:** A focused pure module owns immutable policy versions, derives request signals from transient text plus trusted activity context, emits content-free decisions, and tracks human resolutions for blocked high-risk cases. The project service/API persists only hashes, closed reason codes, evidence ids, and checksums; a learning guidance request cannot proceed unless the decision explicitly authorizes a response mode. Existing local auth, learning program, review handoff, autonomy governor, and privacy controls remain authoritative lower layers.

**Tech Stack:** Node.js ESM, `node:test`, existing project service/API/file store, portable SHA-256 receipts.

## Global Constraints

- Pure local and open source; no remote moderation, cloud student profile, hosted guardian service, or legal-compliance claim.
- Preserve the current dirty upgrade worktree; no staging, commit, push, branch rewrite, or unrelated cleanup.
- Public seams are the pure teaching-safety contract, learning-project service/API, file-backed restart, and focused P0 validator.
- Raw learner prompts, answers, names, contact data, wellbeing disclosures, and model responses must never enter policy, decision, or resolution receipts.
- Learner age is a coarse `child|teen|adult` band only; exact birth date is not collected.
- Assessment direct answers, cheating concealment, minor personal-data collection, and urgent wellbeing signals are non-configurable hard stops.
- Assignment guidance is hint-first until learner-attempt evidence exists; an analogous example must not reveal the target answer.
- External/current factual explanations require evidence ids; uncertain claims require an uncertainty disclosure contract.
- Critical/high-risk decisions require a human resolution receipt and never become answer-authorized merely because they were acknowledged.

---

### Task 1: Pure policy and request decision contract

**Files:**
- Create: `src/agents/localTeachingSafety.js`
- Create: `tests/localTeachingSafety.test.mjs`

**Interfaces:**
- Produces: `createLocalTeachingSafetyPolicy`, `verifyLocalTeachingSafetyPolicy`, `createLocalTeachingSafetyDecision`, `verifyLocalTeachingSafetyDecision`, `createLocalTeachingSafetyResolution`, `buildLocalTeachingSafety`.
- Consumes: `portableSha256Hex` from `src/agents/accessControl.js`.

- [x] Write a failing test for hard-stop policy invariants, coarse age adaptation, prompt hashing, and content-free receipts.
- [x] Implement immutable policy versions and deterministic transient-text signal classification.
- [x] Write a failing table test for normal guided explanation, hint-first assignment, assessment refusal, evidence-required facts, child privacy block, cheating concealment, and urgent wellbeing escalation.
- [x] Implement response authorization, closed reason codes, model boundary instructions, and resolution rules until green.

### Task 2: File-backed safety API and mandatory guidance seam

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Create: `tests/localTeachingSafetyApi.test.mjs`

**Interfaces:**
- Produces: `GET /projects/:id/teaching-safety`, `POST /projects/:id/teaching-safety/policies`, `POST /projects/:id/teaching-safety/policies/:policyId/revisions`, `POST /projects/:id/teaching-safety/evaluate`, and `POST /projects/:id/teaching-safety/decisions/:decisionId/resolve`.
- Persists: `localTeachingSafetyPolicies`, `localTeachingSafetyDecisions`, and `localTeachingSafetyResolutions`.

- [x] Write a failing API test for learning-only policy creation/revision, stale/idempotent writes, safe authorization, hard-stop decisions, human resolution, private access, restart, and tamper degradation.
- [x] Add the service/API routes and integrity-sensitive cache signature.
- [x] Make `/teaching-safety/evaluate` the only route that produces a learning guidance authorization receipt; reject raw answer/model-output persistence fields.
- [x] Advertise the teaching-safety route in deferred project read models.

### Task 3: P0 adversarial gate and release evidence

**Files:**
- Create: `scripts/validate-local-teaching-safety.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/SUPER_AGENT_WORK_MODES.md`
- Modify: `src/agents/README.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

- [x] Register `P0 local teaching age integrity privacy evidence uncertainty and wellbeing contract`.
- [x] Prove a file-backed learning project allows safe guidance, blocks assessment answers and child PII, escalates urgent wellbeing, requires human resolution, and survives restart without raw text.
- [x] Replace capability 42's partial label evidence with the focused command and tests without claiming legal, clinical, or school-policy compliance.
- [x] Run focused tests, learning P0, work-mode acceptance, all tests, build, bundle budget, smoke, launch gates, local MVP checklist, and `git diff --check`.

## Self-Review

- Covers age adaptation, academic integrity, hint-first pedagogy, evidence, uncertainty, privacy, wellbeing escalation, human resolution, content minimization, idempotency, restart, and tamper detection.
- Does not diagnose mental health, determine emergencies, collect exact age, contact guardians, or claim jurisdiction-specific compliance.
- Does not implement a second model provider or moderation service; it authorizes the response shape that a local teaching generation path must obey.
