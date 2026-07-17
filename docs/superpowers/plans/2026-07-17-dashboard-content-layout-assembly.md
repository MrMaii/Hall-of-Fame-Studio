# Dashboard Content Layout Assembly Implementation Plan

**Goal:** Move the existing complete Dashboard paper container, top-panels loading boundary, Manager body slot, and recent-commit loading boundary into one lazy assembly without moving or rewriting any operation.

**Architecture:** `App.jsx` keeps the complete top-panels view, the Manager availability condition and Manager Body element, the recent-commit view, every callback, disabled rule, proof action, and write operation. A new `ProjectDashboardContentLayout.jsx` owns only the original paper container, loading boundaries, and display order.

**Tech Stack:** React 18, Vite 5, Node.js built-in test runner.

## Global Constraints

- Do not rewrite the Dashboard or move any backend operation implementation.
- Preserve Meeting, Group Chat, Timeline, Manager Flow Graph, intent, proof, write, button, scheduler, and disabled behavior.
- Preserve the Manager availability condition in `App.jsx`.
- Preserve the exact `project-paper` classes.
- Preserve Top Panels with the Manager Body child before Recent Commit Line.
- Do not commit, stage, or push.

---

### Task 1: Protect the content-layout boundary

**Files:**
- Create: `tests/projectDashboardContentLayoutUiContract.test.mjs`

- [x] **Step 1: Write a failing contract requiring the new layout, original paper classes, loading boundaries, order, App-owned Manager condition, and App-owned operations.**
- [x] **Step 2: Run the new contract and verify it fails because the layout file does not exist.**

### Task 2: Move display-only content layout

**Files:**
- Create: `src/project/ProjectDashboardContentLayout.jsx`
- Modify: `src/App.jsx`
- Modify only affected source-location and layout contract tests.

- [x] **Step 1: Add a component consuming top-panels fallback/view, Manager Body element, and recent-commit fallback/view.**
- [x] **Step 2: Lazily render Top Panels with the Manager Body child, then Recent Commit Line, inside the original paper container.**
- [x] **Step 3: Replace only the current paper-content assembly in `App.jsx`; preserve all values and the Manager condition.**
- [x] **Step 4: Update only source-location and order checks while retaining every operation assertion.**

### Task 3: Release and real-interface verification

**Files:**
- Modify: `scripts/validate-current-local-product-release.mjs`
- Modify: `scripts/validate-frontend-bundle.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_FINAL_REPORT.md`

- [x] **Step 1: Require the new source, App usage, retained children, original layout, order, and lazy chunk in release checks.**
- [x] **Step 2: Run focused tests, `npm test`, `npm run build`, both release checks, frontend boundary, bundle, and `git diff --check`; require zero failures.**
- [x] **Step 3: Run the ordinary-user, real-project, and complete Manager Dashboard browser gates sequentially; require all to pass.**
- [x] **Step 4: Record exact P2-189 source, chunk, entry, App-line, test, browser-time, and Autopilot evidence; keep P2-01, P2-02, and P2-33 in progress.**
