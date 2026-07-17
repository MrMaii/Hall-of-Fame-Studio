# Exact Project Dashboard Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the project Dashboard, Group Chat, Manager Flow Graph, and intent wiring exactly from Git commit `488194f6`, while retaining the newer local-account, password, provider-picker, and local-backend changes outside that UI section.

**Architecture:** `src/App.jsx` from commit `488194f6` is the only UI source of truth. The exact project UI section begins at `const renderDashboardView = () =>` and ends immediately before `const renderWarRoomView = () =>`; its normalized-LF SHA-256 must be `df1fe38c18b59583b6f81c0f986d3ed3263506d68ff24462210336d78ae47e41`. Newer settings components may be connected only outside that protected section.

**Tech Stack:** React, Vite, Node test runner, Playwright-based local UI validation, local Node HTTP backend.

## Global Constraints

- Do not reconstruct the old UI from memory, screenshots, or descriptions.
- Do not reset or delete project data.
- Do not revert the newer local-authentication, password-policy, provider-catalog, secret-vault, or backend service files.
- Do not modify the protected Dashboard section after restoring it from commit `488194f6`.
- Verify the real local application, not only source-code tests.

---

### Task 1: Pin the exact restoration contract

**Files:**
- Create: `tests/originalProjectDashboardRestore.test.mjs`

**Interfaces:**
- Consumes: `src/App.jsx`, `src/agents/agentRuntime.js`
- Produces: an exact source identity gate and intent-wiring regression gate

- [ ] **Step 1: Write the failing test**

```js
const startMarker = '  const renderDashboardView = () =>';
const endMarker = '  const renderWarRoomView = () =>';
const expectedHash = 'df1fe38c18b59583b6f81c0f986d3ed3263506d68ff24462210336d78ae47e41';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/originalProjectDashboardRestore.test.mjs`

Expected: failure because the simplified `src/App.jsx` does not contain the exact original protected section.

### Task 2: Restore the committed App and preserve current settings

**Files:**
- Modify: `src/App.jsx`
- Reuse: `src/settings/LocalAccountSettings.jsx`
- Reuse: `src/settings/LocalModelSettings.jsx`

**Interfaces:**
- Consumes: Git blob `488194f6:src/App.jsx`
- Produces: the exact original project UI plus current local settings

- [ ] **Step 1: Restore `src/App.jsx` from the exact Git blob**

Run: `git restore --source=488194f6 --worktree -- src/App.jsx`

- [ ] **Step 2: Connect current settings outside the protected section**

Add only these imports near the existing scene imports:

```js
import LocalAccountSettings from './settings/LocalAccountSettings.jsx';
import LocalModelSettings from './settings/LocalModelSettings.jsx';
```

Use `LocalAccountSettings` in the existing local-account settings area and `LocalModelSettings` in the existing provider-key settings area. Do not change code between the two protected markers.

- [ ] **Step 3: Run the exact source gate**

Run: `node --test tests/originalProjectDashboardRestore.test.mjs`

Expected: all tests pass and protected-section SHA-256 equals the committed value.

### Task 3: Verify intent and node-flow behavior

**Files:**
- Verify: `src/App.jsx`
- Verify: `src/agents/agentRuntime.js`
- Verify: `src/agents/agentProjectApi.js`

**Interfaces:**
- Consumes: meeting input, Group Chat input, Manager Flow Graph HTTP routes
- Produces: visible intent routing, chat records, timeline evidence, and graph nodes

- [ ] **Step 1: Verify source wiring**

Run: `rg -n "routeDirectorDirective|isFeatureChangeRequest|startAgentSession|manager-flow-graph|manager-flow-node" src/App.jsx src/agents/agentRuntime.js src/agents/agentProjectApi.js`

- [ ] **Step 2: Run focused tests**

Run: `node --test tests/originalProjectDashboardRestore.test.mjs tests/agentRuntime.test.mjs tests/agentProjectApi.test.mjs tests/managerFlowGraph.test.mjs`

Expected: zero failures. If a listed historical test has a different repository filename, select the existing test containing the corresponding public route or behavior before running.

### Task 4: Run the complete verification gates

**Files:**
- Verify only

**Interfaces:**
- Consumes: local frontend and backend
- Produces: build and real-user evidence

- [ ] **Step 1: Run full tests**

Run: `npm test`

- [ ] **Step 2: Run production build**

Run: `npm run build`

- [ ] **Step 3: Run the project browser flow**

Run: `npm run ui:manager-demo`

Expected: the browser opens the committed Dashboard, opens project tools, renders Manager Flow Graph node cards, returns to Dashboard, opens Group Chat, and completes the existing Manager demo validation.

- [ ] **Step 4: Confirm the exact UI identity again after all edits**

Run: `node --test tests/originalProjectDashboardRestore.test.mjs`

Expected: zero failures and exact protected-section hash unchanged.
