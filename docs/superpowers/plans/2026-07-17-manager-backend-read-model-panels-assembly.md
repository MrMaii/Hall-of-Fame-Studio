# Manager Backend Read Model Panels Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing Manager backend snapshot and activity assembly order and loading states into one lazy assembly without rewriting or removing any Dashboard capability.

**Architecture:** `App.jsx` keeps every model, action, proof route, availability decision, disabled rule, and the following Backend Scheduler Controls. A new `ProjectDashboardManagerBackendReadModelPanels.jsx` owns only the existing Snapshot then Activity child order and their loading states.

**Tech Stack:** React 18, Vite 5, Node.js built-in test runner.

## Global Constraints

- Do not rewrite the Dashboard or move any backend operation.
- Do not remove or change Meeting, Group Chat, Timeline, Manager Flow Graph, intent, proof, write, button, scheduler, or disabled behavior.
- Keep Backend Scheduler Controls after the new assembly in `App.jsx`.
- Do not commit, stage, or push.

---

### Task 1: Protect the assembly boundary

**Files:**
- Create: `tests/projectDashboardManagerBackendReadModelPanelsUiContract.test.mjs`

- [x] **Step 1: Write a failing contract requiring the new assembly, original child order, Scheduler Controls after the assembly, and App-owned operations.**
- [x] **Step 2: Run `node --test tests/projectDashboardManagerBackendReadModelPanelsUiContract.test.mjs` and verify the failure states that the assembly does not exist.**

### Task 2: Move display-only assembly

**Files:**
- Create: `src/project/ProjectDashboardManagerBackendReadModelPanels.jsx`
- Modify: `src/App.jsx`
- Modify: `tests/projectDashboardManagerBackendSnapshotPanelsUiContract.test.mjs`
- Modify: `tests/projectDashboardManagerBackendActivityPanelsUiContract.test.mjs`
- Modify: `tests/projectDashboardLatestBackendWorkUiContract.test.mjs`
- Modify: `tests/projectDashboardManagerReadyPackageSnapshotUiContract.test.mjs`

- [x] **Step 1: Add a component that lazily renders Snapshot then Activity from `{ fallback, snapshot, activity }`.**
- [x] **Step 2: Replace only the two matching App wrappers; leave all view-object contents unchanged and keep Scheduler Controls after the new assembly.**
- [x] **Step 3: Update only the four source-location/order checks, preserving every original component and operation assertion.**
- [x] **Step 4: Run all five focused contracts and require zero failures.**

### Task 3: Release and real-interface verification

**Files:**
- Modify: `scripts/validate-current-local-product-release.mjs`
- Modify: `scripts/validate-frontend-bundle.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_FINAL_REPORT.md`

- [x] **Step 1: Require the new source file, App usage, both child assemblies, and emitted lazy chunk in release checks.**
- [x] **Step 2: Run `npm test`, `npm run build`, both local release checks, frontend boundary, bundle, and `git diff --check`; require zero failures.**
- [x] **Step 3: Run the ordinary-user, real-project, and complete Manager Dashboard browser gates sequentially; require all to pass.**
- [x] **Step 4: Record exact source, chunk, entry, App-line, test, browser-time, and Autopilot evidence as P2-185; keep P2-01, P2-02, and P2-33 in progress.**
