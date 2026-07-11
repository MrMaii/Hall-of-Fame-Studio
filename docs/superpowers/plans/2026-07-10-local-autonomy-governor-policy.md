# Local Autonomy Governor Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned project autonomy policy and optimistic command plane that globally enforces pause/resume/stop, wall-clock, step, cost, tool-call and tool-allowlist limits across local autonomous execution.

**Architecture:** A pure module owns immutable policy versions and pause/resume/stop commands, derives usage from existing tick/provider/tool receipts, and evaluates execution requests fail closed. Service/API routes persist policy/commands, atomically fence every project session, and call one common assertion from run-control action/loop/tick and direct Agent autonomy entrypoints. Existing session leases, cancellation and provider budget/tool-grant controls remain authoritative lower layers.

**Tech Stack:** Node.js ESM, `node:test`, existing project service/API/file store, portable SHA-256 receipts.

## Global Constraints

- Pure local and open source; no hosted policy service or cloud control plane.
- Preserve the dirty upgrade branch; no staging, commits, pushes or unrelated cleanup.
- Policy versions are append-only and require expected previous version/checksum.
- Commands are append-only, idempotent, state-transition checked and bound to the latest policy.
- `stopped` is terminal; `resume` is valid only from `paused`.
- A project with an explicit policy fails closed at every integrated autonomous execution entrypoint.
- `force=true` never bypasses governor state or limits.
- Existing projects without a policy remain legacy-compatible but are reported `policy-required`; the P0 path creates policy before autonomy.
- Project-level commands update all active session rows: pause → paused, resume → waiting, stop → cancelled.

---

### Task 1: Pure policy, commands and execution evaluation

**Files:**
- Create: `src/agents/localAutonomyGovernor.js`
- Create: `tests/localAutonomyGovernor.test.mjs`

- [x] Write a failing test for active → paused → resumed → stopped transitions, stale expected version, terminal stop, and tamper detection.
- [x] Write a failing test for wall-clock, step, cost, tool-count and disallowed-tool denials from existing ledgers.
- [x] Implement immutable policy/command receipts and `buildLocalAutonomyGovernor` / `evaluateLocalAutonomyExecution`.
- [x] Re-run the pure test green.

### Task 2: Service/API control plane and execution enforcement

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `tests/localAutonomyGovernor.test.mjs`

- [x] Add a failing file-backed API test for policy creation/revision, stale policy writes, command idempotency, all-session pause/resume/stop, restart and tamper state.
- [x] Add the common governor assertion to run-control action, loop, session tick, direct Agent action and Provider-evidence Agent action entrypoints.
- [x] Prove pause and exhausted limits block execution even with force, resume restores execution, and stop cannot resume.
- [x] Add observer read-only and Manager/security mutation access assertions.

### Task 3: Existing read model and P0 proof

**Files:**
- Create: `scripts/validate-local-autonomy-governor.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`
- Modify: `src/agents/README.md`

- [x] Add governor policy/state/usage/denial evidence and route to `autonomous-run-control/v1` without changing its schema.
- [x] Register `P0 project autonomy governor version pause resume terminal-stop cost step and tool contract` and confirm missing-validator red.
- [x] Implement a five-mode P0 gate with real file-backed session fencing and limit enforcement.
- [x] Run focused tests, five-mode acceptance, all tests, build, bundle budget, smoke, launch gates, local MVP checklist and `git diff --check`.

## Self-Review

- Covers the audited gaps: missing resume, project-wide state, optimistic policy updates, policy drift, force bypass, duration/cost/tool limits and session fencing.
- Does not duplicate lower-level lease, cancellation, Provider budget or tool-grant implementation.
- Compatibility is explicit and observable rather than silently labeling unconfigured projects governed.
