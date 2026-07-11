# Local Dead-Letter Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a local project manager a persistent, auditable way to inspect an active worker dead letter, approve and execute exactly one replay, or close it with a reason.

**Architecture:** Worker failures remain the source of the immutable dead-letter facts. A project-owned `localDeadLetterDispositionLedger` records a separate, append-only operator disposition keyed by dead-letter id; queue read models overlay its status so resolved rows no longer block readiness while their history remains inspectable. Replay calls the existing direct worker service path from the dead letter's worker kind and only records `replayed` after that call succeeds.

**Tech Stack:** Node.js ESM, file-backed local project store, existing event ledger/logs, Node test runner, local API.

## Global Constraints

- Purely local project-store state and loopback API; no managed queue, SaaS approval system, or cloud workflow.
- A replay requires non-empty `approval.approvedBy` and `approval.reason`; never infer an approval.
- Reject replay of a closed or previously replayed dead letter; an identical completed action returns its existing local receipt without a second worker invocation.
- Preserve the original worker failure and receipt; dispositions are overlays, not destructive edits.
- A replay invokes only the already-supported direct worker kind: project autonomous, agent worker, or Autopilot session.
- Closing requires an explicit actor and reason and never executes work.

---

### Task 1: Prove public API operation requirements

**Files:**
- Create: `tests/localDeadLetterOperations.test.mjs`

**Interfaces:**
- Consumes: `createAgentProjectApi({ service })`, `GET /projects/:id/dead-letters`, `POST /projects/:id/dead-letters/:deadLetterId/replay`, and `POST /projects/:id/dead-letters/:deadLetterId/close`.
- Produces: a visible active dead letter, approval rejection, a replay receipt with a new worker run, and a closed disposition that removes the row from the active queue.

- [x] **Step 1: Write the failing API test**

Seed a project with an `agentWorkerLedger` failure at `attemptCount: 3`, then assert:

```js
assert.equal(api.handle({ method: 'GET', path: `/projects/${projectId}/dead-letters` }).body.deadLetters.active.length, 1);
assert.notEqual(api.handle({ method: 'POST', path: replayPath, body: { actor: 'Local manager' } }).status, 200);
const replayed = api.handle({ method: 'POST', path: replayPath, body: { actor: 'Local manager', approval: { approvedBy: 'Local manager', reason: 'fixed local input' } } });
assert.equal(replayed.body.deadLetterDisposition.status, 'replayed');
assert.equal(api.handle({ method: 'POST', path: closePath, body: { actor: 'Local manager', reason: 'accepted known limitation' } }).body.deadLetterDisposition.status, 'closed');
```

Use an Agent worker run whose agent exists in the seed project so replay can run through `runAgentWorkCycle`.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/localDeadLetterOperations.test.mjs`

Expected: FAIL because the local dead-letter operation routes do not exist.

### Task 2: Persist and expose dispositions

**Files:**
- Modify: `src/agents/agentProjectService.js:2228-2247,37042-37108,60248-60264`
- Modify: `src/agents/agentProjectApi.js:3101-3110`
- Modify: `tests/localDeadLetterOperations.test.mjs`

**Interfaces:**
- Consumes: derived `worker-dead-letter/v1` facts and a project `localDeadLetterDispositionLedger`.
- Produces: `getProjectDeadLetters(projectId)`, `replayProjectDeadLetter(input)`, and `closeProjectDeadLetter(input)`.

- [x] **Step 1: Overlay dispositions on dead-letter read models**

```js
const disposition = (project.localDeadLetterDispositionLedger || [])
  .find((row) => row.deadLetterId === run.deadLetter?.id);
const deadLetter = disposition ? { ...run.deadLetter, disposition } : run.deadLetter;
const active = deadLetter?.status === 'dead-lettered';
```

Keep all rows in `history`, but expose only unresolved `dead-lettered` rows in `active` and `workerQueueSnapshot.deadLetterQueue`.

- [x] **Step 2: Add guarded replay and close service methods**

For replay, validate the dead letter and approval, invoke the matching existing direct worker method, then save a `local-dead-letter-disposition/v1` row with `status: 'replayed'`, operator data, original proof ids, and checksum. For close, save the same schema with `status: 'closed'` and no worker invocation. Both append one project event and log.

- [x] **Step 3: Add exact local API routes**

```js
GET  /projects/:projectId/dead-letters
POST /projects/:projectId/dead-letters/:deadLetterId/replay
POST /projects/:projectId/dead-letters/:deadLetterId/close
```

Return only redacted operator receipts and the updated dead-letter read model.

- [x] **Step 4: Run the focused test**

Run: `node --test tests/localDeadLetterOperations.test.mjs`

Expected: PASS; replay is approval-gated and closes do not execute work.

### Task 3: Regression, ledger, and release gate

**Files:**
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-dead-letter-operations.md`

**Interfaces:**
- Consumes: verified routes from Tasks 1-2.
- Produces: a capability #20 statement that distinguishes local operations from distributed queue durability.

- [x] **Step 1: Run worker regression contracts**

Run: `node --test tests/localDeadLetterOperations.test.mjs tests/localAutopilotLeaseRecovery.test.mjs tests/localAutopilotCancellation.test.mjs`

Expected: PASS; dead-letter operations preserve lease and cancellation semantics.

- [x] **Step 2: Update capability 20**

```markdown
| 20 | 死信操作 | 部分覆盖 | 本地死信审阅、批准后直接重放、关闭回执与事件审计 | 原始失败回执持续保留；本地管理员可带理由重放或关闭。跨机器队列、隔离执行和外部通知仍待实现。 |
```

- [x] **Step 3: Run the complete local release gate**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: every test and the local release checklist pass with no whitespace errors.

- [x] **Step 4: Record exact verification results**

Add a `## Verification` section to this plan and mark implemented/verified steps `[x]`. Do not commit unless the user explicitly requests it.

## Verification

- `node --test tests/localDeadLetterOperations.test.mjs`: 1 passed, 0 failed.
- `node --test tests/localDeadLetterOperations.test.mjs tests/localAutopilotLeaseRecovery.test.mjs tests/localAutopilotCancellation.test.mjs`: 6 passed, 0 failed.
- `npm.cmd test`: 126 passed, 0 failed.
- `npm.cmd run launch:local-mvp:check`: passed.
- `git diff --check`: passed (Git only reported pre-existing CRLF normalization warnings).
