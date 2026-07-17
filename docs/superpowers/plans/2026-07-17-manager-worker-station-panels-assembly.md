# Manager Worker Station Panels Assembly Implementation Plan

**Goal:** Move the existing Backend Worker Station status, optional infrastructure rehearsal, and two proof-required notices into one lazy assembly without rewriting or removing any Dashboard capability.

**Architecture:** `App.jsx` keeps backend address state, settings navigation, save operations, infrastructure rehearsal execution, proof state derivation, availability and disabled rules. A new `ProjectDashboardManagerWorkerStationPanels.jsx` owns only the original child order, display conditions, loading states, and notice markup. The outer worker-station container and following Manager Ready Package remain in `App.jsx`.

## Constraints

- Do not rewrite the Dashboard or move any backend operation.
- Do not remove or change Meeting, Group Chat, Timeline, Manager Flow Graph, intent, proof, write, button, or disabled behavior.
- Keep Manager Ready Package in its current parent position after the new assembly.
- Do not commit, stage, or push.

### Task 1: Protect the seam

- [x] Add a failing contract for the new assembly, two original child panels, original order and conditions, both proof notices, and App-owned operations.
- [x] Verify failure occurs because the assembly does not exist.

### Task 2: Move display-only assembly

- [x] Add the assembly and replace only the matching App block.
- [x] Keep all values, callbacks and disabled rules in `App.jsx`.
- [x] Update only directly affected source-location tests and run them.

### Task 3: Full verification

- [x] Add release and bundle checks for the new assembly.
- [x] Run all automated tests, build, release checks, frontend boundary checks, bundle checks, and code-difference checks.
- [x] Run ordinary-user, real-project, and complete Manager Dashboard browser flows.
- [x] Record P2-183 only after every check passes; keep P2-01, P2-02, and P2-33 in progress.
