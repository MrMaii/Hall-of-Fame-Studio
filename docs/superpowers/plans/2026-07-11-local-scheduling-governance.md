# Local Scheduling Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and delegation was not requested.

**Goal:** Upgrade capability 19 into a deterministic pure-local scheduling contract for project, Agent, and Autopilot lanes without cloud cron or civil-time ambiguity.

**Architecture:** Introduce one pure UTC epoch-interval evaluator shared by all three lanes. It validates timestamps and bounded intervals, preserves the original scheduled slot as the durable idempotency identity, coalesces any number of missed intervals into one run, and emits explicit clock-regression/misfire metadata. Existing durable queue leases remain the dispatch authority; the in-process HTTP timer is only a wake-up source.

**Tech Stack:** Node.js ESM, existing file-backed project store and durable queue, HTTP scheduler, `node:test`.

## Global Constraints

- Pure local only; no SaaS cron, NTP dependency, remote coordinator, or cross-machine claims.
- UTC epoch intervals are the only supported schedule basis. Civil cron, locale time zones, DST folds/gaps, leap-second guarantees, and long-term oscillator accuracy are explicitly out of scope.
- A late wake-up executes at most one coalesced run, never a catch-up burst.
- The original due slot, not the wake-up time, identifies a missed run so retries/restarts cannot create a new durable key.
- Material wall-clock rollback creates one stable recovery slot and reason; a successful receipt advances the schedule normally.
- Invalid persisted timestamps fail closed instead of silently using the current time.

### Task 1: Shared schedule evaluator

**Files:**
- Create: `src/agents/localScheduleGovernance.js`
- Create: `tests/localSchedulingGovernance.test.mjs`

- [x] Test normal due/waiting, missed coalescing, clock rollback, invalid timestamps, bounds, UTC/DST metadata, and stable idempotency slots.
- [x] Implement the smallest pure evaluator and checksum-bearing content-minimized schedule receipt.

### Task 2: Integrate all durable worker lanes

**Files:**
- Modify: `src/agents/agentRuntime.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/localAutopilotClockRecovery.test.mjs`

- [x] Route project, Agent, and Autopilot schedule decisions through the shared evaluator while preserving existing normal reason strings.
- [x] Use `idempotencySlotAt` for durable keys and `dueAt` for dispatch; prove restart/late scans enqueue one key and one coalesced execution.

### Task 3: P0 and total validation

**Files:**
- Create: `scripts/validate-local-scheduling-governance.mjs`
- Modify: `package.json`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: launch/checklist validators

- [x] Register `npm run agents:local-scheduling-governance`, mark #19 verified with local-clock boundaries, and run focused/full/build/bundle/release/smoke/diff gates.

## Self-review

- Durable queue idempotency and leases remain the source of execution safety; this adds schedule semantics, not a competing queue.
- Interval schedules avoid pretending that local civil-time cron and DST behavior are already implemented.
