# Manager Ready Package Snapshot Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing Manager Ready Package outer condition, heading, order, and loading states into one lazy assembly without rewriting or removing any Dashboard capability.

**Architecture:** `App.jsx` keeps every Ready Package model, route, source badge, approval, receipt, proof action, availability decision, and disabled rule. A new `ProjectDashboardManagerReadyPackageSnapshot.jsx` owns only the existing `backendManagerReadyPackage` display decision, snapshot container, heading, and the original Core then Operational assembly order.

**Tech Stack:** React 18, Vite 5, Node.js built-in test runner.

## Global Constraints

- Do not rewrite the Dashboard or move any Ready Package operation.
- Do not remove or change Meeting, Group Chat, Timeline, Manager Flow Graph, intent, proof, write, button, receipt, or disabled behavior.
- Keep the snapshot inside the existing Backend Worker Station and before `ProjectDashboardManagerBackendSnapshotPanels`.
- Do not commit, stage, or push.

---

### Task 1: Protect the snapshot boundary

**Files:**
- Create: `tests/projectDashboardManagerReadyPackageSnapshotUiContract.test.mjs`
- Test: `tests/projectDashboardManagerReadyPackageCorePanelsUiContract.test.mjs`
- Test: `tests/projectDashboardManagerReadyPackageOperationalPanelsUiContract.test.mjs`

**Interfaces:**
- Consumes: the existing `backendManagerReadyPackage` condition and the two Ready Package assembly components.
- Produces: a contract that requires the original container, title, order, conditions, and App-owned operations.

- [x] **Step 1: Write the failing contract**

  Require `ProjectDashboardManagerReadyPackageSnapshot.jsx`, its two lazy imports, Core-before-Operational order, `view` null condition, `backend-manager-ready-package-snapshot`, `Manager Ready Package`, and the existing position before `ProjectDashboardManagerBackendSnapshotPanels`. Require `runLaunchOperationsNextStep`, `runBackendPrivatePilotReceipt`, `runBackendProductionControlReceipt`, `runManagedInfrastructureCutoverAttestation`, `runMvpReadinessOperatorAction`, and the existing `backendCommandAvailable`/`backendStation.loading` disabled rules to remain in `App.jsx`.

- [x] **Step 2: Run the contract and verify the missing assembly failure**

  Run: `node --test tests/projectDashboardManagerReadyPackageSnapshotUiContract.test.mjs`

  Expected: one failure stating that `ProjectDashboardManagerReadyPackageSnapshot.jsx` does not exist.

### Task 2: Move display-only assembly

**Files:**
- Create: `src/project/ProjectDashboardManagerReadyPackageSnapshot.jsx`
- Modify: `src/App.jsx`
- Modify: `tests/projectDashboardManagerReadyPackageCorePanelsUiContract.test.mjs`
- Modify: `tests/projectDashboardManagerReadyPackageOperationalPanelsUiContract.test.mjs`

**Interfaces:**
- Consumes: `{ fallback, core, operational }` or `null` through a single `view` prop.
- Produces: the existing snapshot markup with lazy Core and Operational child assemblies.

- [x] **Step 1: Add the minimal assembly**

  Implement a component that returns `null` for a missing `view`, otherwise renders the original snapshot container and title, then `ProjectDashboardManagerReadyPackageCorePanels` followed by `ProjectDashboardManagerReadyPackageOperationalPanels`, each under the original fallback.

- [x] **Step 2: Replace only the matching App wrapper**

  Replace the two direct assembly imports with one lazy snapshot import. Keep every existing Core and Operational view object expression in `App.jsx`, changing only their outer connection to `core` and `operational` properties under `backendManagerReadyPackage ? { ... } : null`.

- [x] **Step 3: Update only the two source-location contracts**

  Change the two old tests to verify their assembly import and render in `ProjectDashboardManagerReadyPackageSnapshot.jsx`; keep all App-owned callback and disabled-rule assertions unchanged.

- [x] **Step 4: Run the focused contracts**

  Run: `node --test tests/projectDashboardManagerReadyPackageSnapshotUiContract.test.mjs tests/projectDashboardManagerReadyPackageCorePanelsUiContract.test.mjs tests/projectDashboardManagerReadyPackageOperationalPanelsUiContract.test.mjs`

  Expected: all focused tests pass.

### Task 3: Release and real-interface verification

**Files:**
- Modify: `scripts/validate-current-local-product-release.mjs`
- Modify: `scripts/validate-frontend-bundle.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_FINAL_REPORT.md`

**Interfaces:**
- Consumes: the production build output and current local release checks.
- Produces: P2-184 evidence while leaving P2-01, P2-02, and P2-33 in progress.

- [x] **Step 1: Add release and bundle assertions**

  Require the new source file, App usage, both child assemblies inside it, and an emitted `ProjectDashboardManagerReadyPackageSnapshot-` chunk.

- [x] **Step 2: Run the full static gate**

  Run: `npm test`, `npm run build`, `node scripts/validate-current-local-product-release.mjs`, `node scripts/validate-local-mvp-release-checklist.mjs`, `node scripts/validate-frontend-mock-boundaries.mjs`, `node scripts/validate-frontend-bundle.mjs`, and `git diff --check`.

  Expected: zero failures; the large-entry warning may remain and keeps P2-33 open.

- [x] **Step 3: Run the three browser gates sequentially**

  Run: `node scripts/validate-primary-user-ui.mjs`, `node scripts/validate-primary-project-flow-ui.mjs`, and `node scripts/validate-manager-backend-core-ui.mjs`.

  Expected: all three pass, including seven ordinary-user viewports, four display scales, the real local project flow, four complete-Dashboard widths, Manager actions, Agent actions, flow graph, and Autopilot receipt.

- [x] **Step 4: Record exact evidence**

  Record the source bytes, lazy chunk bytes, entry bytes, `App.jsx` nonblank lines, test count, browser durations, and Autopilot receipt latency. Mark P2-184 verified only after every command passes; keep P2-01, P2-02, and P2-33 in progress.
