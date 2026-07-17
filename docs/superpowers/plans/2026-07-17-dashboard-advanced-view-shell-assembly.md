# Dashboard Advanced View Shell Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing complete Dashboard page shell, content-layout loading boundary, and tool-launcher loading boundary into one lazy display assembly without moving or rewriting any operation, then close P2-01, P2-02, and P2-33 with an explicit 700 KB entry budget and two concentrated final checks.

**Architecture:** `App.jsx` keeps the complete content-layout view, Manager availability condition and Manager Body element, tool-launcher view, every callback, disabled rule, proof action, and write operation. A new `ProjectDashboardAdvancedView.jsx` owns only the original complete Dashboard outer containers, decorative layers, child loading boundaries, and display order. `App.jsx` retains an outer `Suspense` boundary around the new lazy page assembly so entering the Dashboard cannot trigger React suspension error 426.

**Tech Stack:** React 18, Vite 5, Node.js built-in test runner, Playwright browser gates.

## Global Constraints

- Do not rewrite the Dashboard or move any backend operation implementation.
- Preserve Meeting, Group Chat, Timeline, Manager Flow Graph, intent, proof, write, button, scheduler, and disabled behavior.
- Preserve the Manager availability condition and both complete view objects in `App.jsx`.
- Preserve the exact `project-dashboard-view`, `project-overview`, `project-paper`, scene bubble, and archive table classes.
- Preserve Content Layout before Tool Launcher.
- Keep an `App.jsx` loading boundary around the new lazy page assembly.
- Do not commit, stage, or push.

---

### Task 1: Protect the advanced-view shell boundary

**Files:**
- Create: `tests/projectDashboardAdvancedViewUiContract.test.mjs`

**Interfaces:**
- Consumes: `src/App.jsx`, `src/project/ProjectDashboardAdvancedView.jsx`.
- Produces: a contract requiring the new lazy page, exact shell, child boundaries and order, App-owned Manager condition, view objects, and operations.

- [x] **Step 1: Write a failing contract** that requires `App.jsx` to lazy import and wrap `ProjectDashboardAdvancedView`, requires the new file to lazy import Content Layout and Tool Launcher, and requires all original shell identifiers, classes, fallbacks, and order.
- [x] **Step 2: Run `node --test tests/projectDashboardAdvancedViewUiContract.test.mjs`** and require failure only because `ProjectDashboardAdvancedView.jsx` does not exist.

### Task 2: Move the display-only page shell

**Files:**
- Create: `src/project/ProjectDashboardAdvancedView.jsx`
- Modify: `src/App.jsx`
- Modify only affected source-location and layout contract tests.

**Interfaces:**
- Consumes: `{ sceneTransition, contentLayoutView, toolLauncherView }`.
- Produces: the original complete Dashboard shell, `<ProjectDashboardContentLayout {...contentLayoutView} />`, and `<ProjectDashboardToolLauncher view={toolLauncherView} />` in original order.

- [x] **Step 1: Add the page component** with the exact `project-dashboard-view`, scene bubble, archive table, and `project-overview` markup.
- [x] **Step 2: Lazily render Content Layout inside the existing `project-dashboard-content-layout-loading` boundary, followed by Tool Launcher inside the existing tool loading boundary.**
- [x] **Step 3: Replace only the current complete Dashboard page shell in `App.jsx`** with an outer `Suspense` and `ProjectDashboardAdvancedView`; keep the complete `contentLayoutView`, Manager condition, Manager Body, `toolLauncherView`, and every operation in `App.jsx`.
- [x] **Step 4: Update only source-location and order checks** while retaining every operation assertion.

### Task 3: Release and real-interface verification

**Files:**
- Modify: `scripts/validate-current-local-product-release.mjs`
- Modify: `scripts/validate-frontend-bundle.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_FINAL_REPORT.md`

**Interfaces:**
- Consumes: the production `dist/assets` output and the existing three browser gates.
- Produces: P2-190 source, chunk, entry, App-line, test, browser-time, and Autopilot evidence while leaving P2-01, P2-02, and P2-33 in progress.

- [x] **Step 1: Require the new source, App outer loading boundary, retained children, original shell, order, lazy chunk, and a 700 KB application-entry budget in release checks.**
- [x] **Step 2: Run one concentrated automated release check covering the affected contracts, production build, release contract, and bundle budget; require zero failures.**
- [x] **Step 3: Run one real complete-Dashboard browser flow covering Group Chat, Manager, Manager Flow Graph, Agent, Autopilot, and responsive widths; require it to pass.**
- [x] **Step 4: Record exact evidence and mark P2-190, P2-01, P2-02, and P2-33 verified only after both concentrated checks pass.**
