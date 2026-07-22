# Outcome-Driven Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every autonomous Agent cycle advance verifiable project deliverables instead of manufacturing progress from chat, receipts, or template artifacts.

**Architecture:** Add a focused outcome policy module that classifies work, normalizes work contracts, requires material evidence, calculates accepted-deliverable progress, limits coordination, and detects no-output loops. Integrate it at the existing public service/provider seams so research, code, design, and operations projects share one outcome protocol while retaining specialized executors.

**Tech Stack:** Node.js 24, ES modules, `node:test`, existing Agent Project service/API/provider adapters.

## Global Constraints

- Preserve all pre-existing uncommitted work and do not clean unrelated files.
- Messages, audit receipts, work pulses, and template files never increase outcome progress.
- Provider-required work fails closed and exposes a visible blocked state.
- Director role assignments and deliverable ownership remain authoritative.
- Autonomous coordination is allowed only when it unblocks a material deliverable.
- Tests exercise public service, HTTP/API, and provider adapter seams.

---

### Task 1: Outcome policy and work-contract protocol

**Files:**
- Create: `src/agents/outcomeDrivenExecution.js`
- Create: `tests/outcomeDrivenExecution.test.mjs`

**Interfaces:**
- Produces: `classifyProjectWork(project)`, `normalizeOutcomeWorkContract({ project, task, agent })`, `evaluateMaterialOutcome(...)`, `calculateOutcomeProgress(project)`, `buildNoMaterialDeltaState(...)`.

- [x] Write a failing test proving a research task requires provider evidence, a content-bearing artifact, a reviewable submission, and explicit acceptance criteria.
- [x] Run `node --test tests/outcomeDrivenExecution.test.mjs` and confirm the module/import is missing.
- [x] Implement the minimal pure policy functions and rerun the test.
- [x] Add vertical slices for technical-delivery, creative/design, and operations work without project-specific hard-coding.

### Task 2: Material work cycles and anti-chatter queueing

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Create: `tests/outcomeDrivenAgentWorkCycle.test.mjs`

**Interfaces:**
- Consumes: Task 1 outcome contracts and material evaluation.
- Produces: public `runAgentWorkCycle` results with `outcome`, `materialDelta`, `blockedReason`, and content-addressed handoff metadata.

- [x] Write a failing service test proving a work pulse and management response do not change project progress.
- [x] Write a failing service test proving an open owned task outranks non-blocking management signals.
- [x] Write a failing service test proving a task cannot become done from pulse count alone.
- [x] Integrate outcome evaluation, suppress acknowledgment loops, and keep tasks in progress until a material submission is accepted.
- [x] Run the focused tests plus `tests/workflowNodeRuntimeIntent.test.mjs` and `tests/leaderWorkGovernance.test.mjs`.

### Task 3: Fail-closed research search and provider policy

**Files:**
- Modify: `src/agents/searchProvider.js`
- Modify: `scripts/agent-project-server.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/searchProvider.test.mjs`
- Create: `tests/outcomeDrivenResearchExecution.test.mjs`

**Interfaces:**
- Consumes: research work classification and existing search provider.
- Produces: provider-backed evidence search or a visible `blocked-provider-evidence-required` outcome; never a local-proof substitute for research.

- [x] Write a failing provider test proving an explicit `SEARCH_LOCAL_ONLY=false` overrides application-local mode for a user-configured search endpoint.
- [x] Write a failing service test proving research automatically plans provider search before artifact completion.
- [x] Write a failing service test proving failed required search records blockage without task completion or progress.
- [x] Implement per-provider egress override and mandatory research search.
- [x] Run focused search/provider tests.

### Task 4: Model content reliability and substantive artifact generation

**Files:**
- Modify: `src/agents/modelProvider.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/modelProvider.test.mjs`
- Create: `tests/outcomeArtifactQuality.test.mjs`

**Interfaces:**
- Produces: runtime intent retries on empty `finish_reason=length`, and artifact drafts that can pass only with task-specific content and evidence references.

- [x] Write a failing adapter test proving `createRuntimeIntent` retries empty length output with a larger output budget.
- [x] Write a failing quality test rejecting coordination-only and fixed-template artifacts.
- [x] Add the runtime retry and replace completion-path templates with provider/model payload or an explicit blocked draft.
- [x] Run model and artifact tests.

### Task 5: Readiness, progress, handoffs, and no-output breaker

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentRuntime.js`
- Create: `tests/outcomeReadinessAndProgress.test.mjs`

**Interfaces:**
- Produces: readiness gates for scheduler/provider/material-output health, outcome-weighted progress, `STALLED_NO_MATERIAL_DELTA`, and handoffs containing artifact id/version/checksum/open questions/next owner.

- [x] Write failing tests for false-ready scheduler state, activity-only progress, incomplete handoff, and two-cycle no-output stall.
- [x] Add the gates and progress calculation without changing unrelated read models.
- [x] Run focused readiness/progress tests.

### Task 6: Cross-project and live research verification

**Files:**
- Create: `scripts/validate-outcome-driven-agent-runtime.mjs`
- Modify: `package.json`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `src/agents/README.md`

**Interfaces:**
- Produces: `npm run agents:outcome-runtime` acceptance gate.

- [x] Build isolated research, technical-delivery, creative/design, and operations fixtures.
- [x] Prove each fixture advances only after its required material outcome.
- [x] Run the full focused suite, the new acceptance gate, `npm test`, and `npm run build`.
- [x] Restart the local runtime, verify provider/scheduler status, and run the target research project until search, evidence, substantive artifact, handoff, and graph nodes are observable.
- [x] Audit every requirement above against current files and live API responses before claiming completion.
