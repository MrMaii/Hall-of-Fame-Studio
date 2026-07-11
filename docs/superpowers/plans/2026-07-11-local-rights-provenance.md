# Local Rights and Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. This thread uses inline execution because uninterrupted autonomous progress is authorized and subagent delegation was not requested.

**Goal:** Upgrade capability 50 into a pure-local, restart-safe rights and provenance ledger that audits every final creative output and blocks clearance unless the exact capability-49 export and handoff have complete, current evidence.

**Architecture:** Add one focused pure module for content-minimized asset declarations, generated-content provenance, derivative lineage, and a deterministic final audit. Bind records to the latest valid creative export, handoff, and acknowledgement in the service; persist them in the existing project file store; expose private project routes; and derive clearance from verified evidence rather than caller-provided verdicts.

**Tech Stack:** Node.js ESM, `node:test`, existing SHA-256 receipt helper, project file store/service/API/access-control, existing local creative-studio receipts.

## Global Constraints

- Pure local/open-source operation; no cloud rights database, hosted DAM, licensing SaaS, or remote policy service.
- This is an evidence and policy gate, not a legal opinion or an automatic claim of copyright ownership.
- Raw license documents, attribution prose, prompts, and generation inputs are content-minimized to hashes, lengths, identifiers, and evidence references.
- Every exported output, editable source, and declared handoff dependency must have exactly one current declaration.
- Licensed scope must cover the required use, channel, territory, and audit time; expired or missing evidence fails closed.
- Generated assets require model/provider/policy identifiers, generation proof, disclosure, and input lineage. Derivative graphs must be complete and acyclic.
- Final audit must bind the exact latest export, handoff, and accepted acknowledgement from capability 49. Any newer creative terminal receipt makes the prior audit stale.
- Actor identity and rights-reviewer authority are assigned by the server, never accepted from the caller.

---

### Task 1: Content-minimized rights declarations and generation provenance

**Files:**
- Create: `src/agents/localRightsProvenance.js`
- Create: `tests/localRightsProvenance.test.mjs`

- [x] **Step 1: Write failing tests** for export-output, editable-source, and dependency declarations; closed rights bases/scopes; evidence requirements; content minimization; and checksum tampering.
- [x] **Step 2: Run the focused test** and confirm failure because the module does not exist.
- [x] **Step 3: Implement immutable asset declaration receipts** with exact target binding, allowed-use/channel/territory scope, attribution proof, expiration, and stable identifiers.
- [x] **Step 4: Add failing generated-content tests** for provider/model/policy identifiers, generation proof, disclosure, content minimization, and undeclared input rejection.
- [x] **Step 5: Implement generation provenance receipts and run the focused tests green.**

### Task 2: Derivative lineage and deterministic final export audit

**Files:**
- Modify: `src/agents/localRightsProvenance.js`
- Modify: `tests/localRightsProvenance.test.mjs`

- [x] **Step 1: Add failing lineage tests** for complete declared inputs, output checksum binding, cycle rejection, and transformation evidence.
- [x] **Step 2: Implement immutable derivative-lineage receipts.**
- [x] **Step 3: Add failing audit tests** for exact creative export/handoff/acknowledgement binding, complete target coverage, expired or out-of-scope licenses, missing attribution, missing generation disclosure, integrity degradation, and stale creative state.
- [x] **Step 4: Implement deterministic audit findings and clearance projection** with no caller-controlled verdict and a bounded validity window.
- [x] **Step 5: Run the focused tests green.**

### Task 3: File-backed private API and mandatory capability-49 gate

**Files:**
- Create: `tests/localRightsProvenanceApi.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

- [x] **Step 1: Write a failing file-backed API test** for declaration, generation, lineage, final audit, restart readback, actor override resistance, idempotency, stale creative binding, and tamper degradation.
- [x] **Step 2: Add service persistence/cache signatures** and server-owned art-director/rights-reviewer roles.
- [x] **Step 3: Add private GET plus declaration, generation, lineage, and audit POST routes.**
- [x] **Step 4: Fail all audit writes closed unless capability 49 is at its exact latest `ready-for-rights-provenance-audit` terminal state.**
- [x] **Step 5: Run focused pure and API tests green.**

### Task 4: P0 registration, documentation, and full 50-capability completion audit

**Files:**
- Create: `scripts/validate-local-rights-provenance.mjs`
- Create: `scripts/validate-local-only-50-capabilities.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/SUPER_AGENT_WORK_MODES.md`
- Modify: `src/agents/README.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

- [x] **Step 1: Register `npm run agents:rights-provenance`** and its P0 marker.
- [x] **Step 2: Add a deterministic 50-capability validator** that requires exactly 50 verified rows, executable evidence, all five work modes, and explicit pure-local/non-SaaS boundaries.
- [x] **Step 3: Document guarantees and non-claims** and update capability 50 from placeholder evidence to executable evidence.
- [x] **Step 4: Run focused gates, all five work-mode gates, full tests, build, bundle budget, smoke, launch gates, local-MVP gate, and diff validation.**
- [x] **Step 5: Inspect the resulting zero-to-delegation proof and only then decide whether the persistent goal is genuinely complete.**

## Self-review

- Spec coverage: ownership basis, licensing scope, attribution, AI provenance, derivatives, exact final export/handoff audit, restart, privacy, tamper resistance, API, P0, and overall completion audit are explicit.
- Simplicity: one pure receipt/projection module and four route families; no speculative publishing engine or legal-rule database.
- Safety: ambiguous, expired, stale, incomplete, or corrupted evidence fails closed; clearance is explicitly not legal advice.
