# Local Audit Log Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure malformed entries in the local append-only security audit JSONL file are visible in the audit stream and make its integrity readiness fail rather than being silently ignored.

**Architecture:** Keep valid JSONL records readable and preserve the append-only file unchanged. Extend the file-store reader to expose line-level parse diagnostics; project service combines those diagnostics with the existing sequence/hash-chain check so `getSecurityAuditStream()` reports `malformed-lines-detected` and `hashChainReady: false` whenever malformed audit lines exist.

**Tech Stack:** Node.js ESM, local JSONL file store, existing audit stream service, Node test runner.

## Global Constraints

- Pure local only; no centralized audit/SaaS dependency is introduced.
- Invalid JSONL bytes must remain on disk for incident inspection; do not silently discard or rewrite them.
- Valid records remain readable so operators can investigate access history.
- Malformed JSON and JSON values without an audit record id both count as malformed lines.
- A malformed line makes local audit hash-chain readiness false, even when all readable records form a valid chain.
- Public test seam: restart `createAgentProjectFileStore`, then `createAgentProjectService(...).getSecurityAuditStream(projectId)`.

---

### Task 1: Reproduce the silent malformed-line gap through the public audit stream

**Files:**

- Create: `tests/localAuditLogIntegrity.test.mjs`

- [x] **Step 1: Write the failing restart test**

Create a file-backed project, record two access decisions through `service.recordAccessDecision`, append `'{malformed audit line\n'` to its audit JSONL path, restart store/service, and assert:

```js
const stream = restartedService.getSecurityAuditStream(projectId);
assert.equal(stream.auditLogIntegrity.status, 'malformed-lines-detected');
assert.equal(stream.auditLogIntegrity.malformedLineCount, 1);
assert.equal(stream.hashChainReady, false);
assert.equal(stream.count, 2);
```

- [x] **Step 2: Run focused test and confirm failure**

Run: `node --test tests/localAuditLogIntegrity.test.mjs`

Expected: the reader silently skips the malformed line, so the new diagnostics are absent and readiness remains based only on readable rows.

### Task 2: Surface local JSONL parse diagnostics without destroying evidence

**Files:**

- Modify: `src/agents/agentProjectFileStore.js:32-170`
- Modify: `src/agents/agentProjectService.js:59388-59425`

**Interfaces:**

- `store.securityAuditLogIntegrity()` returns `{ schemaVersion, status, auditLogPath, malformedLineCount, malformedLineNumbers }`.
- `getSecurityAuditStream(projectId)` returns `auditLogIntegrity` and returns `hashChainReady: false` when `malformedLineCount > 0`.

- [x] **Step 1: Replace silent JSONL parsing with detailed diagnostics**

Use a detail reader that records nonblank malformed line numbers while preserving every valid record:

```js
const malformedLineNumbers = [];
const records = raw.split(/\r?\n/).flatMap((line, index) => {
  if (!line.trim()) return [];
  try {
    const record = JSON.parse(line).record || JSON.parse(line);
    if (!record?.id) throw new Error('audit-record-id-missing');
    return [record];
  } catch {
    malformedLineNumbers.push(index + 1);
    return [];
  }
});
```

Read JSON exactly once per line in the final implementation. Update diagnostics at startup and every audit refresh. Expose a copy through `securityAuditLogIntegrity()`.

- [x] **Step 2: Make service audit readiness include JSONL diagnostics**

```js
const auditLogIntegrity = store.securityAuditLogIntegrity?.() || { status: 'not-applicable', malformedLineCount: 0 };
const hashChainReady = summary.hashChainReady && auditLogIntegrity.malformedLineCount === 0;
const status = auditLogIntegrity.malformedLineCount ? 'malformed-lines-detected' : (summary.count ? 'prototype-store-backed' : 'waiting-for-enforced-traffic');
```

Return the diagnostics and overridden readiness in `getSecurityAuditStream`; use the same readiness value in `storage.hashChain.ready`.

- [x] **Step 3: Run focused test and confirm pass**

Run: `node --test tests/localAuditLogIntegrity.test.mjs`

Expected: readable rows remain visible, malformed line evidence is reported, and readiness is false.

### Task 3: Update the capability ledger and regression gates

**Files:**

- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`

- [x] **Step 1: Update audit integrity evidence**

Record local chain, hash mismatch, sequence gap, and malformed JSONL line detection as partial coverage. Keep immutable off-device audit retention and deletion policy as unimplemented/blocked local boundaries.

- [x] **Step 2: Run focused and regression commands**

Run: `node --test tests/localAuditLogIntegrity.test.mjs && npm.cmd test && npm.cmd run agents:scenario && npm.cmd run launch:local-mvp:check`

Expected: every command exits 0.

## Self-Review

- A malformed audit line is no longer invisible.
- Valid historical records remain available for investigation.
- Readiness cannot claim a valid chain while raw JSONL corruption exists.
- This is local tamper/corruption detection, not an immutable centralized-audit claim.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
