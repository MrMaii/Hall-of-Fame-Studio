# Local Timeout and Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and subagent delegation was not requested.

**Goal:** Upgrade capability 18 into one persistent cancellation contract spanning durable workers, Provider waits, and local workspace child processes.

**Architecture:** Extend durable jobs with a persisted cancellation request/terminal receipt and maintain an in-process abort-controller registry keyed by job id + fence. Worker dispatch passes that signal through Provider and workspace executors. The workspace runtime gains an async spawn path with bounded timeout/output and direct-child termination; it resolves only after exit and never writes a success receipt after cancellation. Restart treats a persisted cancellation request as terminal before acquiring a new lease. Existing Autopilot cancellation remains interoperable with the durable cancellation signal while retaining its public session receipt.

**Tech Stack:** Node.js `spawn`, `AbortController`, existing durable queue/file store, Provider signals, HTTP scheduler, `node:test`.

## Global Constraints

- Cancellation is a durable state transition, not only an in-memory signal.
- The authenticated actor and reason hash are persisted; raw command output/reason stays out of queue/audit receipts.
- Queue cancellation fences the current lease before signaling the process, so late workers cannot acknowledge.
- Timeout and operator cancellation are distinct reason codes and metrics.
- Child completion races are deterministic: once cancellation commits, a late exit/result cannot publish business effects.
- Async workspace execution defaults to `shell=false`, validates allowlist/cwd, bounds timeout/output, and reports tree-termination limitations explicitly.
- Provider outcomes aborted after dispatch remain ambiguous under capability 16; they do not become safe retries merely because cancellation was requested.
- No claim that an already accepted external side effect can be undone.

### Task 1: Cancellable async workspace process

**Files:**
- Modify: `src/agents/localProjectRuntime.js`
- Create: `tests/localWorkspaceCommandCancellation.test.mjs`

- [x] Add failing tests for success, timeout, caller abort, output limit, allowlist/cwd, no late success, child exit cleanup, and Windows/direct-child termination receipt.
- [x] Implement `executeWorkspaceCommandAsync` with signal, timeout, bounded buffers, one settlement path, and content-minimized execution receipt.

### Task 2: Durable active-job cancellation

**Files:**
- Modify: `src/agents/localDurableTaskQueue.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `tests/localDurableTaskQueue.test.mjs`
- Modify: `tests/localAutopilotCancellation.test.mjs`

- [x] Add `cancellation-requested` with a new fence epoch, server-owned actor, reason hash, requested time, and final cancelled receipt.
- [x] Register active worker AbortControllers by exact job/fence and pass signals through project, Agent, Autopilot, Provider, and workspace execution paths.
- [x] Prove cancellation before lease, during Provider wait, during workspace child execution, after receipt/before ack, after ack, and across restart.
- [x] Reject stale/late completion and preserve Provider ambiguity when dispatch already occurred.

### Task 3: Private API, P0, and next-gap audit

**Files:**
- Create: `tests/localTimeoutCancellationApi.test.mjs`
- Create: `scripts/validate-local-timeout-cancellation.mjs`
- Modify: API/access/readiness/auth/capability docs and validators

- [x] Extend security-admin queue cancel to active jobs and return signal-delivery/terminal-state proof; Manager/security reads show active cancellation state.
- [x] Register `npm run agents:local-timeout-cancellation`, mark #18 verified with external-effect limitations, then run focused/full/build/bundle/release/total gates.

## Self-review

- The design reuses durable queue fences and existing Provider AbortSignals; it adds only the missing child-process executor and one controller registry.
- Capability 24 will own whole-server graceful drain; this capability owns cancelling individual work safely.
