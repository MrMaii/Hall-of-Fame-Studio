# Provider Runtime Operation Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local Provider Runtime reads and Vault seal refreshes deterministic, so a completed local seal is never hidden by an older status request.

**Architecture:** Move provider-runtime network work behind one per-backend operation coordinator. A sync receives a monotonically increasing generation; only the latest generation for the same local backend/project scope may update React state. Vault sealing invalidates the scope and enqueues one final sync after the seal writes finish. The coordinator never runs more than one status fetch per scope at once.

**Tech Stack:** React 18 hooks, Vite, Node test runner, Playwright local Edge harness, local Agents server.

## Global Constraints

- Accept only loopback, `.local`, `.localhost`, or private-network backend/provider endpoints.
- Never persist provider plaintext or Vault ciphertext in browser state.
- A missing explicit backend target must not trigger a fallback `127.0.0.1:8787` request.
- Retain existing backend-required write guards and development-fixture-only fallbacks.

---

### Task 1: Extract an operation coordinator with generation fencing

**Files:**

- Create: `src/agents/providerRuntimeCoordinator.js`
- Test: `tests/providerRuntimeCoordinator.test.mjs`

**Interfaces:**

- Produces `createProviderRuntimeCoordinator({ run })`.
- `request({ scope, operation })` returns a promise for the latest queued operation for `scope`.
- `invalidate(scope)` increments the generation and causes older completions to return `{ stale: true }` without publishing state.

- [x] **Step 1: Write failing coordinator tests**

```js
test('serializes operations per backend scope and suppresses stale completion', async () => {
  const coordinator = createProviderRuntimeCoordinator({ run: async operation => operation() });
  const first = coordinator.request({ scope: 'http://127.0.0.1:8787:global', operation: async () => 'old' });
  coordinator.invalidate('http://127.0.0.1:8787:global');
  const second = coordinator.request({ scope: 'http://127.0.0.1:8787:global', operation: async () => 'new' });
  assert.equal((await first).stale, true);
  assert.equal((await second).value, 'new');
});
```

- [x] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/providerRuntimeCoordinator.test.mjs`

Expected: fail because the coordinator module does not exist.

- [x] **Step 3: Implement the minimal coordinator**

```js
export function createProviderRuntimeCoordinator({ run = async operation => operation() } = {}) {
  const scopes = new Map();
  // Keep one promise chain and one generation counter per scope.
  // Return stale results instead of allowing a replaced generation to publish.
}
```

- [x] **Step 4: Verify the focused coordinator tests pass**

Run: `node --test tests/providerRuntimeCoordinator.test.mjs`

Expected: pass.

### Task 2: Route provider status and seal refreshes through the coordinator

**Files:**

- Modify: `src/App.jsx:3008-3155`
- Modify: `src/App.jsx:3227-3505`
- Test: `tests/localRuntimeUiLatency.test.mjs`

**Interfaces:**

- Consumes `createProviderRuntimeCoordinator` and the existing `requestAgentBackend` transport.
- Produces `syncSettingsProviderRuntime({ runTests, baseUrlOverride, reason })`, where `reason` is `manual`, `target-change`, or `vault-seal`.

- [x] **Step 1: Write a failing static boundary test**

```js
assert.match(appSource, /createProviderRuntimeCoordinator/);
assert.doesNotMatch(appSource, /providerRuntimeSyncPendingRef/);
assert.match(appSource, /reason: 'vault-seal'/);
```

- [x] **Step 2: Remove callback-based pending state**

Delete `providerRuntimeSyncPendingRef`, its flush helper, and the receipt-driven retry effect. Do not retain a timeout retry as a second coordination mechanism.

- [x] **Step 3: Publish state only for the current generation**

```js
const result = await providerRuntimeCoordinator.request({ scope, operation: readProviderRuntime });
if (result.stale) return null;
setProviderRuntimeStatus(result.value);
```

- [x] **Step 4: Invalidate immediately after a successful seal**

```js
providerRuntimeCoordinator.invalidate(scope);
await syncSettingsProviderRuntime({ baseUrlOverride: baseUrl, reason: 'vault-seal' });
```

- [x] **Step 5: Verify focused checks**

Run: `node --test tests/providerRuntimeCoordinator.test.mjs tests/localRuntimeUiLatency.test.mjs && npm.cmd run agents:server:validate`

Expected: pass.

### Task 3: Prove the real browser seal path and preserve local-only invariants

**Files:**

- Modify: `scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs`
- Modify: `scripts/validate-frontend-mock-boundaries.mjs`

**Interfaces:**

- The real-user harness must assert that no failed request targets the default fallback backend after a user has saved its temporary local backend URL.
- The harness must verify Vault record names `model.baseURL`, `model.name`, `search.apiKey`, and `search.endpoint` through the local backend API. The rendered UI must show only a seal receipt and must never expose provider plaintext or sensitive record metadata.

- [x] **Step 1: Add a failing browser assertion**

```js
assert(!backendCriticalTraffic.some(row => /127\.0\.0\.1:8787/.test(row)), 'A saved local backend target must suppress fallback backend traffic.');
```

- [x] **Step 2: Run the real-user command**

Run: `npm.cmd run ui:real-user-zero-to-autonomy`

Expected: pass through provider seal, startup readiness, kickoff, autonomy, evidence, submission, and review phases.

- [x] **Step 3: Run regression verification**

Run: `npm.cmd test && npm.cmd run ui:mock-boundaries && npm.cmd run launch:local-mvp:check && npm.cmd run ui:manager-backend && npm.cmd run ui:bundle:check`

Expected: every command exits 0.

## Self-Review

- Scope: targets the proven lost-refresh race without changing project, work-mode, or provider policy semantics.
- Safety: the design has a single coordinator rather than competing retries, preserves local-only checks, and suppresses stale state publication.
- Verification: combines unit ordering tests, local Agents-server verification, full browser proof, and existing launch gates.

## Execution Handoff

Execute inline with `executing-plans` after the architecture is approved. Do not proceed with more callback retries.
