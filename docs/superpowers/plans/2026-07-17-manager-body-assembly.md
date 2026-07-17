# Manager Body Assembly Implementation Plan

**Goal:** Move the existing Manager Core, Work Loop, Backend Station, and Manager Collaboration display order into one lazy assembly without moving or rewriting any operation.

**Architecture:** `App.jsx` keeps the existing Manager availability condition, all four complete view objects, every callback, disabled rule, proof action, and write operation. A new `ProjectDashboardManagerBody.jsx` receives those original view objects as named props and owns only the existing child order and the Backend Station loading boundary.

**Tech Stack:** React 18, Vite 5, Node.js built-in test runner.

## Global Constraints

- Do not rewrite the Dashboard or move any backend operation implementation.
- Preserve Meeting, Group Chat, Timeline, Manager Flow Graph, intent, proof, write, button, scheduler, and disabled behavior.
- Preserve the Manager availability condition in `App.jsx`.
- Preserve the order: Manager Core, Work Loop, Backend Station, Manager Collaboration.
- Preserve the Backend Station `Suspense` loading fallback.
- Do not commit, stage, or push.

---

### Task 1: Protect the Manager body boundary

**Files:**
- Create: `tests/projectDashboardManagerBodyUiContract.test.mjs`

- [x] **Step 1: Write a failing contract requiring the new body, original child order, station loading boundary, App-owned condition, and App-owned operations.**
- [x] **Step 2: Run the new contract and verify it fails because the body file does not exist.**

### Task 2: Move display-only Manager body assembly

**Files:**
- Create: `src/project/ProjectDashboardManagerBody.jsx`
- Modify: `src/App.jsx`
- Modify only affected source-location and order contract tests.

- [x] **Step 1: Add a component consuming the original core, work-loop, station, and collaboration view objects as named props.**
- [x] **Step 2: Lazily render the four existing components in their original order and retain the station loading boundary.**
- [x] **Step 3: Replace only the current four-component assembly in `App.jsx`; preserve every view-object value.**
- [x] **Step 4: Update only source-location, object-syntax, and order checks while retaining every operation assertion.**

### Task 3: Release and real-interface verification

**Files:**
- Modify: `scripts/validate-current-local-product-release.mjs`
- Modify: `scripts/validate-frontend-bundle.mjs`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_TRACKER.md`
- Modify: `docs/LOCAL_PRODUCT_UPGRADE_FINAL_REPORT.md`

- [x] **Step 1: Require the new source, App usage, retained children, original order, and lazy chunk in release checks.**
- [x] **Step 2: Run focused tests, `npm test`, `npm run build`, both release checks, frontend boundary, bundle, and `git diff --check`; require zero failures.**
- [x] **Step 3: Run the ordinary-user, real-project, and complete Manager Dashboard browser gates sequentially; require all to pass.**
- [x] **Step 4: Record exact P2-188 source, chunk, entry, App-line, test, browser-time, and Autopilot evidence; keep P2-01, P2-02, and P2-33 in progress.**
