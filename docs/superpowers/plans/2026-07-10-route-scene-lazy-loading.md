# Route Scene Lazy Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce local first-interaction cost by moving route-specific scenes behind explicit lazy-loading boundaries without weakening backend-required project controls.

**Architecture:** `src/App.jsx` remains the state owner during the first extraction. Runtime inspection confirmed that the Manager Demo seed is an explicit user action, while initial project state is restored from browser storage; moving that seed would not improve first load. Route scenes are extracted one at a time as presentational components with explicit props; no scene may write backend-managed project data directly.

**Tech Stack:** React 18, Vite 5, Node test runner, Playwright local Edge validation.

## Global Constraints

- All runtime endpoints, model endpoints, search endpoints, assets, and fonts remain local/private-network only.
- Existing backend-required real-project writes must fail closed; browser fallback remains limited to sample/development fixtures.
- Do not add a router library or new runtime dependency.
- Keep `npm.cmd test`, `npm.cmd run ui:manager-demo`, `npm.cmd run ui:manager-backend`, and `npm.cmd run ui:bundle:check` green.

---

### Task 1: Isolate deterministic Manager Demo seed construction (deferred)

**Files:**

- Create: `src/demo/managerDemoSeed.js`
- Modify: `src/App.jsx:9590-9896`
- Test: `tests/managerDemoSeed.test.mjs`

**Interfaces:**

- Consumes: Agent runtime helpers, `buildNextActionResolution`, `applyPeerManagementMatrix`, and the static demo team/data supplied by `App.jsx`.
- Produces: `createManagerDemoProject({ projectId, name, brief, invitedMembers, language, now }) => project`.

- [ ] **Deferred:** The Manager Demo seed is not on the initial-render path. Revisit only if its explicit action latency becomes a measured problem.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagerDemoProject } from '../src/demo/managerDemoSeed.js';

test('creates deterministic local demo evidence without a backend request', () => {
  const project = createManagerDemoProject({
    projectId: 'demo_seed',
    name: 'Demo',
    brief: 'Local evidence',
    invitedMembers: [
      { id: 'turing', name: 'Alan Turing', role: 'System Architect' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer' },
    ],
    language: 'en',
    now: '2026-07-10T00:00:00.000Z',
  });
  assert.equal(project.id, 'demo_seed');
  assert.equal(project.demoFixture, true);
  assert.ok(project.kickoffCharter?.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/managerDemoSeed.test.mjs`

Expected: FAIL because `src/demo/managerDemoSeed.js` does not exist.

- [ ] **Step 3: Move only the deterministic seed builder**

```js
export function createManagerDemoProject({
  projectId,
  name,
  brief,
  invitedMembers,
  language = 'en',
  now = new Date().toISOString(),
} = {}) {
  // Move the existing deterministic seed pipeline here unchanged.
  // Do not call fetch, localStorage, or backend commands.
  return demoProject;
}
```

- [ ] **Step 4: Replace the synchronous App.jsx seed call with an async import**

```js
const module = await import('./demo/managerDemoSeed.js');
const project = module.createManagerDemoProject(seedInput);
```

Initialize the UI with a local loading fixture and replace it only after the import resolves. Preserve the current `managerDemoReady` and `demoFixture` flags.

- [ ] **Step 5: Run focused checks**

Run: `node --test tests/managerDemoSeed.test.mjs tests/localRuntimeUiLatency.test.mjs && npm.cmd run ui:manager-demo`

Expected: all tests pass and the Manager Demo browser harness completes without a backend write.

### Task 2: Add an explicit first-scene loading boundary

**Files:**

- Modify: `src/App.jsx:38414-38429`
- Test: `tests/localRuntimeUiLatency.test.mjs`

**Interfaces:**

- Consumes: `activeRoute`, the existing render functions, and the demo seed loading state from Task 1.
- Produces: a deterministic local loading state while `agent_market`, `project_initiation`, or demo seed modules load.

- [ ] **Step 1: Write the failing test**

```js
test('shows a local loading boundary while a lazy scene is unresolved', () => {
  assert.match(appSource, /data-testid="local-scene-loading"/);
  assert.match(appSource, /Loading local workspace/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/localRuntimeUiLatency.test.mjs`

Expected: FAIL because the boundary does not exist.

- [ ] **Step 3: Implement the small boundary**

```jsx
{sceneLoading && (
  <div data-testid="local-scene-loading" role="status">
    Loading local workspace…
  </div>
)}
```

Only set `sceneLoading` during an actual dynamic import. Do not display it for a backend/network failure and do not suppress backend error states.

- [ ] **Step 4: Run focused checks**

Run: `node --test tests/localRuntimeUiLatency.test.mjs && npm.cmd run ui:manager-demo`

Expected: all checks pass and the loading boundary is not a permanent overlay.

### Task 3: Extract the Talent Market scene as a presentational lazy component (completed)

**Files:**

- Create: `src/scenes/AgentMarketScene.jsx`
- Modify: `src/App.jsx:13768-14252`
- Test: `tests/agentMarketScene.test.mjs`

**Interfaces:**

- Consumes: `{ agents, filters, marketMode, recruitedIds, onOpenDossier, onContinueInitiation }`.
- Produces: `AgentMarketScene`, which renders cards and emits callbacks without issuing fetches or mutating project state itself.

- [ ] **Step 1: Write the failing test**

```js
test('keeps Talent Market backend-free and delegates selection to callbacks', () => {
  const source = readFileSync(new URL('../src/scenes/AgentMarketScene.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|requestAgentBackend\(/);
  assert.match(source, /onOpenDossier\(agent\.id\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/agentMarketScene.test.mjs`

Expected: FAIL because the scene file does not exist.

- [ ] **Step 3: Move card rendering only**

```jsx
export default function AgentMarketScene({ agents, onOpenDossier }) {
  return agents.map((agent) => (
    <button key={agent.id} onClick={() => onOpenDossier(agent.id)} />
  ));
}
```

Keep filtering, route transitions, contract signing, and backend commands in `App.jsx` callbacks.

- [ ] **Step 4: Load the scene with `React.lazy`**

```js
const AgentMarketScene = lazy(() => import('./scenes/AgentMarketScene.jsx'));
```

Wrap only the `agent_market` branch with `Suspense`; use the Task 2 local loading fallback.

- [ ] **Step 5: Run verification**

Run: `npm.cmd run ui:manager-demo && npm.cmd run ui:manager-backend && npm.cmd run ui:bundle:check`

Expected: both local browser paths pass and the bundle check reports an additional lazy scene chunk.

### Task 4: Document and verify the new runtime boundary (completed)

**Files:**

- Modify: `docs/LOCAL_FRONTEND_PERFORMANCE.md`
- Modify: `scripts/validate-frontend-bundle.mjs`

**Interfaces:**

- Consumes: Vite output under `dist/assets`.
- Produces: a budget check that requires the Agent Market lazy chunk and keeps the existing application entry under 1.6 MB.

- [ ] **Step 1: Write the failing budget assertion**

```js
assert(agentMarketChunk, 'Expected a lazy Agent Market chunk.');
```

- [ ] **Step 2: Run it to verify it fails before Task 3**

Run: `npm.cmd run build && npm.cmd run ui:bundle:check`

Expected: FAIL because no Agent Market chunk exists.

- [ ] **Step 3: Update the validator and documentation**

Document which routes are lazy, which remain eagerly loaded, and that static chunk checks do not replace local browser Web Vitals traces.

- [ ] **Step 4: Run final verification**

Run: `npm.cmd test && npm.cmd run agents:server:validate && npm.cmd run ui:manager-demo && npm.cmd run ui:manager-backend && npm.cmd run ui:bundle:check`

Expected: all commands exit 0; the build reports the new lazy scene chunk; no claim is made about FCP/LCP/INP without a browser trace.

## Self-Review

- Spec coverage: Tasks 1-4 address the actual synchronous runtime dependency, visible loading behavior, first route-scene extraction, bundle evidence, and local-only invariants.
- Placeholder scan: no task delegates unspecified implementation; each contains concrete files, public interfaces, tests, commands, and acceptance behavior.
- Type consistency: `createManagerDemoProject` is defined in Task 1 and consumed by Task 2; `AgentMarketScene` is defined in Task 3 and checked by Task 4's bundle validator.

## Execution Handoff

Execute inline with `executing-plans`, starting at Task 1. Do not begin Task 3 until Task 1's demo seed remains behaviorally identical under `ui:manager-demo`.
