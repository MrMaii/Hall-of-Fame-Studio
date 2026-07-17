# Manager Dashboard Snapshot Region Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the existing Manager Dashboard snapshot region's shared condition, container, loading states, and parameter connections into one lazy assembly without rewriting or removing any Dashboard capability.

**Architecture:** `App.jsx` remains the owner of all backend reads, writes, proof navigation, intent execution, draft updates, availability rules, and disabled rules. A new `ProjectDashboardManagerBackendSnapshotPanels.jsx` assembly owns only the existing `backendManagerDashboard` display condition, the existing `backend-manager-dashboard-snapshot` container, and the existing order of the three already-extracted child panels.

**Tech Stack:** React 18, Vite 5, Node test runner, Playwright browser validation.

## Global Constraints

- Do not rewrite the project Dashboard.
- Do not remove Meeting, Group Chat, Timeline, Manager Flow Graph, intent routes, proof actions, writes, buttons, or disabled conditions.
- Change only the three consecutive Manager Dashboard snapshot child panels and their source-location tests.
- Do not commit, stage, or push.

---

### Task 1: Protect the assembly seam

**Files:**
- Create: `tests/projectDashboardManagerBackendSnapshotPanelsUiContract.test.mjs`

**Interfaces:**
- Consumes: `App.jsx`, the new assembly source, and the three existing child-panel module names.
- Produces: a contract that requires the original condition, container test id, child order, lazy loading, and App-owned operations.

- [x] Write a failing Node test that requires `ProjectDashboardManagerBackendSnapshotPanels.jsx`, verifies lazy imports for `ProjectDashboardManagerSnapshotExecutionPanels`, `ProjectDashboardManagerCompatibilityProofPanels`, and `ProjectDashboardManagerSubmissionRoutePanels`, verifies `view.managerDashboard` gates the original container, and verifies the original order.
- [x] Verify the test fails because the new assembly file does not exist.

### Task 2: Move only display assembly

**Files:**
- Create: `src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: one `view` object containing `fallback`, `managerDashboard`, and three child prop objects.
- Produces: the original `backend-manager-dashboard-snapshot` container and the original three child panels in the same order.

- [x] Add a lazy assembly that returns `null` when `view.managerDashboard` is absent and otherwise renders the existing container plus the three existing panels with their existing props.
- [x] Replace the original App block with one lazy assembly call; keep every callback, data source, availability rule, and disabled rule in `App.jsx`.
- [x] Run the new contract test and the three direct child contracts until they pass.

### Task 3: Update existing source-location guards

**Files:**
- Modify only tests or validators that require the three child modules to be loaded directly by `App.jsx`.
- Modify: `scripts/validate-current-local-product-release.mjs`
- Modify: `scripts/validate-frontend-bundle.mjs`

**Interfaces:**
- Consumes: the same component names and operation markers as before.
- Produces: checks that follow the new assembly while retaining all original component and operation assertions.

- [x] Change only lazy-load and render-location assertions from `App.jsx` to the new assembly.
- [x] Require the assembly in the current-release checklist and require its independent build chunk in the bundle validator.
- [x] Run all affected contract tests, then run `npm test` and require zero failures.

### Task 4: Release and real-user verification

**Files:**
- Modify after verification: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`
- Modify after verification: `docs/LOCAL_PRODUCT_UPGRADE_FINAL_REPORT.md`

**Interfaces:**
- Consumes: current build output, release validators, and browser flows.
- Produces: P2-181 evidence and updated tracker counts.

- [x] Run `npm run build`, both local release checklists, frontend boundary validation, bundle validation, and `git diff --check`.
- [x] Run the ordinary-user viewport/scale flow, real project flow, and complete Manager Dashboard flow.
- [x] Record exact test count, browser times, entry size, assembly chunk size, source size, and `App.jsx` nonblank lines.
- [x] Add P2-181 to the tracker and report only after every required check passes; keep P2-01, P2-02, and P2-33 in progress.
