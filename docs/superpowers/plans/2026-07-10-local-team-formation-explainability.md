# Local Team Formation Explainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn five-mode roster composition into a content-minimized, auditable explanation of role coverage, persona selection, risk ownership, delegation readiness, and unresolved specialist gaps.

**Architecture:** Add a pure `localTeamFormationBrief.js` projector over the existing frozen `super-agent-work-mode-team/v1` contract rather than creating another persona source of truth. Expose the brief during pre-project composition and as a restart-stable project read model; keep roster selection in `workModes.js` and persona capability weights in `personSkillSystem.js`.

**Tech Stack:** Node.js ESM, SHA-256, existing work-mode/persona registries, project service/API, Node tests.

## Global Constraints

- Pure local only; no cloud recruiting, remote persona registry, or SaaS workforce planner.
- Do not duplicate or override persona weights, work-mode roles, dependencies, task ownership, or escalation checks.
- Store objective checksum, length, and closed need-signal ids only; never copy objective text into the explainability receipt.
- Every selected role explains required lane, persona, capability score, owned artifacts, reviewer/lead responsibility, selection rationale, and escalation ownership.
- Every work mode exposes its fixed risks plus structural reviewer/dependency/coverage risks.
- Coverage gaps, low-confidence scores below 75, missing owners/reviewers, dependency cycles, and unresolved role slots are explicit.
- `delegationReady=true` only when the work-mode contract is kickoff-ready, reviewer-independent, acyclic, fully assigned, and has no blocking gap.
- Unknown modes and incomplete contracts fail closed without inventing a specialist.
- Brief checksum must be stable across restart and mutation must degrade readiness.

---

### Task 1: Pure explainability brief

**Files:** Create `src/agents/localTeamFormationBrief.js`; create `tests/localTeamFormationBrief.test.mjs`.

- [x] Write a failing test covering a ready technical team, sensitive objective signals, role/artifact/risk explanations, a deliberately insufficient persona pool, content minimization, stable checksum, and tamper detection.
- [x] Run `node --test tests/localTeamFormationBrief.test.mjs` and confirm missing-module red.
- [x] Implement `buildLocalTeamFormationBrief({ workModeTeam })`, `verifyLocalTeamFormationBrief`, and public projection.
- [x] Re-run focused test green.

### Task 2: Preflight and project API integration

**Files:** Modify test, `agentProjectApi.js`, `agentProjectService.js`, and `accessControl.js`.

- [x] Add failing assertions that both sync/async work-mode composition return the same brief and a file-backed project exposes it after restart.
- [x] Add `teamFormationBrief` to `/work-modes/:mode/team`; add service `getTeamFormationReadiness` and `GET /projects/:id/team-formation-readiness`.
- [x] Allow Manager/runtime/security/observer reads; expose no mutation route.
- [x] Run `node --test tests/localTeamFormationBrief.test.mjs tests/workModes.test.mjs`.

### Task 3: P0 gate, docs, verification

**Files:** Create `scripts/validate-local-team-formation.mjs`; modify package, local release checklist, launch gates, 50-capability ledger, architecture audit, and this plan.

- [x] Gate all five modes, one insufficient-pool blocker, project restart checksum, and absence of raw objective text.
- [x] Add `agents:team-formation` as a P0 local command and document authority/boundaries.
- [x] Run syntax checks, `npm.cmd test`, focused gate, `agents:work-modes:acceptance`, `launch:local-mvp:check`, and `git diff --check`.
- [x] Record exact evidence while leaving the 50-capability goal active.

## Verification Results — 2026-07-10

- Red phase: missing module, then missing preflight/API brief behavior, both failed before implementation.
- Focused work-mode tests: 20/20 passed.
- Full regression: `npm.cmd test` passed 156/156, 0 failed/cancelled/skipped.
- `npm.cmd run agents:team-formation`: passed all five modes, insufficient persona supply, content minimization, and restart checksum.
- `npm.cmd run agents:work-modes:acceptance`: passed learning, academic-writing, investigation, technical-delivery, and creative-studio end to end.
- `npm.cmd run launch:local-mvp:check`: passed.
- Syntax checks passed; `git diff --check` exited 0 with only existing CRLF-to-LF warnings.
- Capability #36 is complete for pure-local team formation explainability and gap governance; the overall 50-capability objective remains active.
