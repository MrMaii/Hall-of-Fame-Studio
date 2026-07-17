# Manager Backend Activity Panels Assembly Implementation Plan

**Goal:** Move the existing Manager backend activity panels' shared order, conditional display, loading states, and error display into one lazy assembly without rewriting or removing any Dashboard capability.

**Architecture:** `App.jsx` remains the owner of every backend read, write, scheduler action, autonomous command, proof navigation, availability rule, and disabled rule. A new `ProjectDashboardManagerBackendActivityPanels.jsx` assembly owns only the existing order and display conditions of four already-extracted child panels plus the existing backend error line.

**Tech Stack:** React 18, Vite 5, Node test runner, Playwright browser validation.

## Global Constraints

- Do not rewrite the project Dashboard.
- Do not remove Meeting, Group Chat, Timeline, Manager Flow Graph, intent routes, proof actions, writes, buttons, or disabled conditions.
- Change only the consecutive Manager read-model summary, autonomous control, Agent autonomous queue, latest backend work, and backend error display region.
- Keep Backend Scheduler Controls in its current parent position.
- Do not commit, stage, or push.

### Task 1: Protect the assembly seam

- [x] Add a failing contract requiring the new assembly, the original four child panels, their original order and conditions, the backend error line, and App-owned operation markers.
- [x] Verify the contract fails because the new assembly file does not exist.

### Task 2: Move only display assembly

- [x] Add the lazy assembly with the original loading states, two conditional panels, unconditional summary and latest-work panels, and error line.
- [x] Replace only the matching App block with one lazy assembly call while leaving every callback and disabled rule in `App.jsx`.
- [x] Run the new contract and all directly affected child contracts until they pass.

### Task 3: Update source-location guards

- [x] Update only checks that require the four children to load directly from `App.jsx`.
- [x] Add the assembly to the current-release checklist and bundle validator.
- [x] Run the full automated suite with zero failures.

### Task 4: Release and real-user verification

- [x] Run the product build, both local release checklists, frontend boundary validation, bundle validation, and `git diff --check`.
- [x] Run ordinary-user viewport and scale validation, real project flow, and complete Manager Dashboard flow.
- [x] Record exact test count, browser times, entry size, assembly source and chunk sizes, and `App.jsx` nonblank lines.
- [x] Add P2-182 only after all checks pass; keep P2-01, P2-02, and P2-33 in progress.
