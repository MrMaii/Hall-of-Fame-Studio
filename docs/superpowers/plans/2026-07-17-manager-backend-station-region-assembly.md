# Manager Backend Station Region Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing backend worker-station outer region, station content, and scheduler control display order into one lazy assembly without moving or rewriting any operation.

**Architecture:** `App.jsx` keeps the complete station-content view object and every scheduler icon, callback, disabled rule, and data value. A new `ProjectDashboardManagerBackendStationRegion.jsx` owns the existing outer container, Station Content then Scheduler Controls order, and their loading states.

**Tech Stack:** React 18, Vite 5, Node.js built-in test runner.

## Global Constraints

- Do not rewrite the Dashboard or move any backend operation implementation.
- Preserve Meeting, Group Chat, Timeline, Manager Flow Graph, intent, proof, write, button, scheduler, and disabled behavior.
- Preserve `data-testid="backend-worker-station"` and its existing CSS classes.
- Keep the Manager Collaboration Body after the new region.
- Do not commit, stage, or push.

---

### Task 1: Protect the region boundary

**Files:**
- Create: `tests/projectDashboardManagerBackendStationRegionUiContract.test.mjs`

- [x] **Step 1: Write a failing contract requiring the new region, original outer marker, Station Content then Scheduler Controls order, following Collaboration Body, and App-owned operations.**
- [x] **Step 2: Run the new contract and verify it fails because the region file does not exist.**

### Task 2: Move display-only region assembly

**Files:**
- Create: `src/project/ProjectDashboardManagerBackendStationRegion.jsx`
- Modify: `src/App.jsx`
- Modify: `tests/projectDashboardManagerBackendStationContentUiContract.test.mjs`
- Modify: `tests/projectDashboardBackendSchedulerControlsUiContract.test.mjs`
- Modify: `tests/projectDashboardLatestBackendWorkUiContract.test.mjs`
- Modify: `tests/projectDashboardManagerBackendReadModelPanelsUiContract.test.mjs`
- Modify: `tests/managerBackendUiOnlineGateContract.test.mjs`

- [x] **Step 1: Add a component consuming `{ fallback, content, scheduler, schedulerFallback }` and lazily rendering Station Content then Scheduler Controls inside the original outer structure.**
- [x] **Step 2: Replace only the current outer station region in `App.jsx`; preserve all content and scheduler object values.**
- [x] **Step 3: Update only source-location, object-syntax, and order checks while retaining every operation and visible-control assertion.**
- [x] **Step 4: Run the focused contracts and require zero failures.**

### Task 3: Release and real-interface verification

**Files:**
- Modify: `scripts/validate-current-local-product-release.mjs`
- Modify: `scripts/validate-frontend-bundle.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_FINAL_REPORT.md`

- [x] **Step 1: Require the new source, App usage, retained child assemblies, and lazy chunk in release checks.**
- [x] **Step 2: Run `npm test`, `npm run build`, both release checks, frontend boundary, bundle, and `git diff --check`; require zero failures.**
- [x] **Step 3: Run the ordinary-user, real-project, and complete Manager Dashboard browser gates sequentially; require all to pass.**
- [x] **Step 4: Record exact P2-187 source, chunk, entry, App-line, test, browser-time, and Autopilot evidence; keep P2-01, P2-02, and P2-33 in progress.**
