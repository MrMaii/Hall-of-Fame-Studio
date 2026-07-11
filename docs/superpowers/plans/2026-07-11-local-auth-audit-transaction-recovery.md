# Local Auth Audit Transaction Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and subagent delegation was not requested.

**Goal:** Close capability 6's remaining pure-local crash-consistency gap so every committed local identity mutation has an eventually confirmed, idempotent runtime audit result across process restart.

**Architecture:** Upgrade the local-auth snapshot with content-minimized mutation receipts written atomically with user/session state. Each committed receipt starts `audit-pending`; the API writes its result to the existing runtime hash chain using the receipt transaction id, then acknowledges the receipt. Startup replays pending audit results, while the service deduplicates transaction ids so a crash between audit append and acknowledgement cannot duplicate the logical event.

**Tech Stack:** Node.js ESM, local-auth atomic JSON snapshot, existing runtime security audit stream, `node:test`.

## Constraints

- Pure local operation; no database, cloud IAM, SIEM, or remote transaction coordinator.
- Passwords, tokens, plaintext usernames, and request bodies never enter transaction receipts or audit results.
- The auth-state mutation and `audit-pending` receipt share one atomic snapshot replacement.
- Audit result append is idempotent by transaction id and remains independently hash chained.
- Startup recovery is bounded and fails visible if the audit sink remains unavailable.
- Existing public local-auth API behavior and session-token one-time response semantics remain compatible.

### Task 1: Atomic auth mutation receipts

**Files:**
- Modify: `src/agents/localAuthStore.js`
- Create: `tests/localAuthAuditTransaction.test.mjs`

- [x] Write failing tests proving bootstrap, login state changes, logout, password rotation, user creation, and user disable persist content-minimized `audit-pending` receipts in the same snapshot.
- [x] Upgrade the snapshot schema compatibly and expose bounded pending receipt reads plus acknowledgement.
- [x] Verify passwords/tokens/usernames are absent and receipt tampering fails visible.

### Task 2: Idempotent runtime audit result

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/localAuthAuditTransaction.test.mjs`

- [x] Add a failing duplicate transaction test.
- [x] Add `recordLocalAuthMutationResult` that returns the existing runtime record for a previously committed transaction id.
- [x] Bind transaction id, operation, outcome, subject hash, actor/session ids, and recovery flag without raw credentials.

### Task 3: API acknowledgement and startup recovery

**Files:**
- Modify: `src/agents/agentProjectApi.js`
- Modify: `tests/localAuthAuditTransaction.test.mjs`
- Modify: `tests/localRuntimeSecurityAudit.test.mjs`

- [x] Add a failing crash-window test where auth mutation commits but audit append fails.
- [x] On successful mutation, append/dedupe the result and acknowledge the local receipt.
- [x] On API creation, replay bounded pending results and acknowledge successes; expose pending/recovery counts in local-auth status.
- [x] Prove restart recovery, append-before-ack idempotency, and fail-visible persistent audit outage.

### Task 4: Capability evidence and regression

**Files:**
- Create: `scripts/validate-local-fine-grained-authorization.mjs`
- Modify: `package.json`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/LOCAL_AUTH.md`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `scripts/validate-launch-readiness-gates.mjs`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`

- [x] Register the focused P0 gate and replace capability 6's partial evidence.
- [x] Run focused tests, full tests, build, launch gates, local-MVP checklist, and the 50-capability audit to expose the next remaining gap.
