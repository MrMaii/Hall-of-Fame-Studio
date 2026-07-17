# Manager Backend Station Content Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing Worker Station, Manager Ready Package, and Manager backend read-model panel order and loading states into one lazy assembly without rewriting or removing any Dashboard capability.

**Architecture:** `App.jsx` keeps the existing `backend-worker-station` container, every view object, model, action, proof route, availability decision, disabled rule, and the following Backend Scheduler Controls. A new `ProjectDashboardManagerBackendStationContent.jsx` owns only the existing Worker Station, Ready Package, and Backend Read Model child order and their loading states.

**Tech Stack:** React 18, Vite 5, Node.js built-in test runner.

## Global Constraints

- Do not rewrite the Dashboard or move any backend operation.
- Do not remove or change Meeting, Group Chat, Timeline, Manager Flow Graph, intent, proof, write, button, scheduler, or disabled behavior.
- Keep the `backend-worker-station` outer container and Backend Scheduler Controls in `App.jsx`.
- Keep Backend Scheduler Controls after the new assembly.
- Do not commit, stage, or push.

---

### Task 1: Protect the station-content boundary

**Files:**
- Create: `tests/projectDashboardManagerBackendStationContentUiContract.test.mjs`

**Interfaces:**
- Consumes: the current App-owned `workerStation`, `readyPackage`, and `readModel` view objects.
- Produces: a contract requiring Worker Station, then Ready Package, then Backend Read Model, with Scheduler Controls after the assembly and operations still in `App.jsx`.

- [x] **Step 1: Write the failing contract.**

  Require `ProjectDashboardManagerBackendStationContent.jsx`, its three lazy children in the original order, the existing App-owned operations, the App-owned outer container, and Backend Scheduler Controls after the new assembly.

- [x] **Step 2: Run the new contract and verify red.**

  Run: `node --test tests/projectDashboardManagerBackendStationContentUiContract.test.mjs`

  Expected: FAIL because `ProjectDashboardManagerBackendStationContent.jsx` does not exist.

### Task 2: Move display-only station content

**Files:**
- Create: `src/project/ProjectDashboardManagerBackendStationContent.jsx`
- Modify: `src/App.jsx`
- Modify: `tests/projectDashboardManagerWorkerStationPanelsUiContract.test.mjs`
- Modify: `tests/projectDashboardManagerReadyPackageSnapshotUiContract.test.mjs`
- Modify: `tests/projectDashboardManagerBackendReadModelPanelsUiContract.test.mjs`

**Interfaces:**
- Consumes: `{ fallback, workerStation, readyPackage, readModel }`.
- Produces: one fragment that lazily renders Worker Station, Ready Package, and Backend Read Model in that order.

- [x] **Step 1: Add the minimal assembly component.**

  The component imports `Suspense` and `lazy`, lazily loads the three existing child assemblies, and renders each with its existing view object and `view.fallback`.

- [x] **Step 2: Replace only the three matching App wrappers.**

  Pass the existing view objects unchanged as `workerStation`, `readyPackage`, and `readModel`; keep the outer station container and Scheduler Controls in `App.jsx`.

- [x] **Step 3: Update only the three source-location and order checks.**

  Preserve every existing operation, condition, child-component, and disabled-rule assertion.

- [x] **Step 4: Run the four focused contracts.**

  Run the new contract plus the Worker Station, Ready Package, and Backend Read Model contracts. Expected: 4 passed, 0 failed.

### Task 3: Release and real-interface verification

**Files:**
- Modify: `scripts/validate-current-local-product-release.mjs`
- Modify: `scripts/validate-frontend-bundle.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_FINAL_REPORT.md`

**Interfaces:**
- Consumes: the emitted `ProjectDashboardManagerBackendStationContent-*` lazy chunk.
- Produces: P2-186 evidence while leaving P2-01, P2-02, and P2-33 in progress.

- [x] **Step 1: Extend release checks.**

  Require the new source file, App usage, all three retained child assemblies, and the emitted lazy chunk.

- [x] **Step 2: Run full static verification.**

  Run `npm test`, `npm run build`, both local release checks, frontend boundary, bundle, and `git diff --check`. Expected: zero failures; the large-entry warning may remain and keeps P2-33 open.

- [x] **Step 3: Run all three browser gates sequentially.**

  Run the ordinary-user, real-project, and complete Manager Dashboard browser checks. Expected: all pass, including the original Group Chat, Manager, node flow, Agent, Autopilot, four Dashboard sizes, seven ordinary-user sizes, and four display scales.

- [x] **Step 4: Record exact evidence.**

  Record source bytes, lazy chunk bytes, entry bytes, `App.jsx` nonblank lines, test count, browser durations, and Autopilot receipt latency as P2-186. Keep P2-01, P2-02, and P2-33 in progress.
