# Local Dashboard Workspace File Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the active project's already-bound local folder as an expandable, manageable file tree directly from the project Dashboard.

**Architecture:** Keep the existing local-only workspace binding and filesystem runtime. Add a Workspace button to the Dashboard header that opens an in-Dashboard drawer; the drawer reads and manages the same bound folder through the existing project workspace API. All operations use relative paths under the selected root, and no cloud storage, sync adapter, separate project scene, or fake browser filesystem is introduced.

**Tech Stack:** React 18, Vite, Tailwind utility classes, Lucide icons, the existing Node.js `localProjectRuntime` / `agentProjectService` / `agentProjectApi` stack, Node test runner, and the repository's Playwright validation pattern.

## Global Constraints

- This product is local-only. Do not add cloud storage, upload/sync architecture, storage adapters, remote share links, or future-cloud language.
- The selected project workspace folder is the only user project-file root exposed to Agents and to the Dashboard manager.
- Hall of Fame's internal memory, audit, artifact, and runtime files may remain in the application's private runtime directory; they are not part of the visible project workspace.
- The Workspace manager opens inside the project Dashboard as a drawer/workbench. It is not a Dashboard content card and not a separate `projectMode` scene.
- Dashboard content priority remains unchanged: current project focus, people at work, official updates, then quiet metrics.
- Reuse the existing `/projects/:id/workspace/{list,read,write,delete}` routes. Add only the missing directory-create and move/rename operations.
- After binding, browser management requests contain relative paths only. The absolute root path may be displayed locally as context but is never accepted as an operation target.
- Reject path traversal, absolute child paths, and symbolic links that could escape the selected root.
- The root can expand and collapse, but it cannot be renamed, moved, or deleted.
- Directory loading is lazy and non-recursive. Expanding one folder reads only that folder.
- The drawer never exposes workspace command execution.
- `AGENT_WORKSPACE_EXEC` remains disabled by default. A command's working directory is not described as an operating-system sandbox.
- Supported text editing is UTF-8 and limited to the existing 512 KiB read boundary. Unsupported or larger files show metadata only.
- Use optimistic concurrency and atomic save replacement so the Dashboard cannot silently overwrite a newer Agent-authored file.
- Preserve current unrelated changes in the dirty worktree and avoid adjacent refactors.

---

## Product Shape

### Entry and placement

Add a visible `Workspace` button to `ProjectDashboardHeader`, next to Meeting, Chat, and Timeline. Clicking it keeps the user on the Dashboard and opens a drawer above the right side of the page.

```text
Project Dashboard
┌──────────────────────────────────────────────────────────────────┐
│ Project name      Refresh  Meeting  Chat  Timeline  Workspace    │
│                                                                  │
│ What the project is doing now              ┌ Workspace ────────┐ │
│ Current focus and team work remain here    │ ▾ selected-folder │ │
│                                            │   ▾ docs           │ │
│                                            │     brief.md       │ │
│                                            │   ▸ src            │ │
│                                            │                    │ │
│                                            │ file/folder pane   │ │
│                                            └────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

- The Dashboard remains mounted and visible behind the drawer.
- Desktop drawer width: approximately `min(760px, calc(100vw - 96px))`.
- Desktop internal layout: 280 px tree pane plus a flexible file/folder pane.
- Mobile: the drawer becomes full-screen with a back button and a tree/content toggle.
- Opening and closing uses a short 160–220 ms horizontal transition.

### Tree behavior

- The selected root row is always the first row.
- The root automatically expands on first open and remains collapsible.
- Folder chevrons rotate and children reveal only after the folder list request succeeds.
- Directories sort before files; both groups use locale-aware natural name order.
- Single click selects; double click or `Enter` expands a folder or opens a file.
- `ArrowRight` expands the focused folder and `ArrowLeft` collapses it.
- Hover/focus reveals rename and delete actions for non-root entries.
- Refresh acts on the selected directory or the selected file's parent, not the entire tree.

### Management scope

Included:

- Browse and refresh directories.
- Expand and collapse the root and nested folders.
- Open and edit supported text files.
- Create a text file.
- Create a folder.
- Rename or move a file/folder inside the root.
- Delete a file or confirmed non-empty folder.
- Display save, conflict, unsupported-file, loading, empty, unavailable-root, and backend-offline states.

Excluded:

- Cloud sync, upload workflows, remote sharing, bulk selection, Git controls, full-text search, file history, command execution, and operating-system file browsing outside the selected root.

---

## Existing Boundary and Required Hardening

The current runtime already does the essential binding:

```js
bindWorkspace(project, workspacePath)
requireWorkspace(project)
safeJoin(workspacePath, relativePath)
```

The current `listWorkspace`, `readWorkspaceFile`, `writeWorkspaceFile`, and `deleteWorkspacePath` methods all resolve their targets under `project.localRuntime.workspacePath`. This is the correct shared source for both Agents and the Dashboard.

Two limits must remain explicit:

1. The current lexical containment check does not fully protect against a symbolic link inside the root that points outside it.
2. `executeWorkspaceCommand` uses the workspace as `cwd`, but `cwd` does not prevent a process from opening an external absolute path. Command execution is therefore kept out of this feature and remains disabled by default.

The implementation will harden file operations, not claim that selecting a folder creates an OS sandbox.

---

## File Map

### New files

- `src/project/ProjectDashboardWorkspaceDrawer.jsx` — drawer shell, toolbar, dialogs, API orchestration, and responsive layout.
- `src/workspace/WorkspaceTree.jsx` — accessible recursive root/folder/file tree.
- `src/workspace/WorkspaceFilePane.jsx` — directory contents, text editor, and unsupported-file metadata states.
- `src/workspace/workspaceTreeState.js` — pure reducer for loaded children, expansion, selection, editor, and conflicts.
- `tests/localProjectWorkspaceManager.test.mjs` — filesystem boundary and mutation tests.
- `tests/workspaceTreeState.test.mjs` — pure tree/editor state tests.
- `tests/projectDashboardWorkspaceDrawerUiContract.test.mjs` — Dashboard integration and UI contract.
- `scripts/validate-project-dashboard-workspace-ui.mjs` — real local backend/browser acceptance path.

### Modified files

- `src/agents/localProjectRuntime.js` — harden path resolution; add directory-create, move/rename, atomic save, and stale-write detection.
- `src/agents/agentProjectService.js` — add thin service wrappers for directory-create and move.
- `src/agents/agentProjectApi.js` — add `/workspace/mkdir` and `/workspace/move`; map expected workspace errors.
- `src/project/ProjectDashboardHeader.jsx` — add the visible Workspace button.
- `src/project/ProjectDashboardAdvancedView.jsx` — lazy-mount the drawer over the Dashboard.
- `src/App.jsx` — own drawer open state and pass the existing backend request function/project binding.
- `tests/projectDashboardHeaderUiContract.test.mjs` — verify the header action remains available.
- `package.json` — add one focused UI verification command.
- `docs/ARCHITECTURE.md` — document the local folder boundary and Dashboard drawer.
- `src/agents/README.md` — document the new local workspace operations and command limitation.

---

## Task 1: Make the Bound Folder a Safe File Boundary

**Files:**

- Create: `tests/localProjectWorkspaceManager.test.mjs`
- Modify: `src/agents/localProjectRuntime.js`

**Produces:** Safe path resolution plus `createWorkspaceDirectory`, `moveWorkspacePath`, and concurrency-aware `writeWorkspaceFile` runtime methods.

- [ ] Write failing tests using a disposable temporary workspace and an outside sentinel file. Cover:
  - normal nested list/read/write/delete;
  - `../outside.txt` rejection;
  - absolute child-path rejection;
  - symlink-to-outside rejection for list/read/write/delete/move;
  - root delete/move rejection;
  - directory creation;
  - file and directory rename;
  - destination-exists conflict;
  - stale-save conflict;
  - atomic successful save;
  - 512 KiB read limit.

- [ ] Run the failing test:

```powershell
node --test tests/localProjectWorkspaceManager.test.mjs
```

Expected result: failures for symbolic-link handling, mkdir, move, and concurrency behavior.

- [ ] Add real-path validation. Existing targets must resolve under the real workspace root; new targets validate their existing parent chain. Reject every symbolic-link segment instead of following it.

```js
function assertWorkspacePath(rootPath, relativePath, { allowMissingLeaf = false } = {}) {
  const normalized = String(relativePath || '.').replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error('workspace-absolute-child-path-not-allowed');
  }
  const targetPath = safeJoin(rootPath, normalized);
  const existingPath = allowMissingLeaf && !existsSync(targetPath) ? dirname(targetPath) : targetPath;
  assertInside(realpathSync(rootPath), realpathSync(existingPath));
  assertNoSymbolicLinkSegments(rootPath, existingPath);
  return targetPath;
}
```

- [ ] Add directory creation:

```js
createWorkspaceDirectory(project = {}, input = {}) {
  const workspacePath = this.requireWorkspace(project);
  if (!input.path || input.path === '.') throw new Error('workspace-directory-path-required');
  const absolutePath = assertWorkspacePath(workspacePath, input.path, { allowMissingLeaf: true });
  if (existsSync(absolutePath)) throw new Error('workspace-destination-exists');
  mkdirSync(absolutePath, { recursive: false });
  return { projectId: project.id, workspacePath, directory: fileRecord(workspacePath, absolutePath) };
}
```

- [ ] Add move/rename with no overwrite and no root target:

```js
moveWorkspacePath(project = {}, input = {}) {
  const workspacePath = this.requireWorkspace(project);
  if (!input.fromPath || input.fromPath === '.' || !input.toPath || input.toPath === '.') {
    throw new Error('workspace-non-root-move-path-required');
  }
  const fromPath = assertWorkspacePath(workspacePath, input.fromPath);
  const toPath = assertWorkspacePath(workspacePath, input.toPath, { allowMissingLeaf: true });
  if (existsSync(toPath)) throw new Error('workspace-destination-exists');
  renameSync(fromPath, toPath);
  return { projectId: project.id, workspacePath, entry: fileRecord(workspacePath, toPath) };
}
```

- [ ] Extend text writes with optional `expectedUpdatedAt`. If the current `mtime` differs, throw `workspace-file-conflict`. Write to a temporary sibling and use the existing atomic replacement helper.

- [ ] Preserve compatibility for existing Agent/runtime callers that do not send `expectedUpdatedAt`.

- [ ] Run the test until all cases pass.

---

## Task 2: Add Only the Two Missing Workspace Commands

**Files:**

- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Test: `tests/localProjectWorkspaceManager.test.mjs`

**Consumes:** Runtime methods from Task 1.

**Produces:** `POST /projects/:id/workspace/mkdir` and `POST /projects/:id/workspace/move`.

- [ ] Add thin service wrappers:

```js
createWorkspaceDirectory({ projectId, ...input } = {}) {
  if (!projectRuntime?.createWorkspaceDirectory) throw new Error('Local project runtime is not configured.');
  return projectRuntime.createWorkspaceDirectory(store.getProject(projectId), input);
},
moveWorkspacePath({ projectId, ...input } = {}) {
  if (!projectRuntime?.moveWorkspacePath) throw new Error('Local project runtime is not configured.');
  return projectRuntime.moveWorkspacePath(store.getProject(projectId), input);
},
```

- [ ] Add the routes beside existing workspace routes:

```js
if (method === 'POST' && route.tail[0] === 'mkdir') {
  return json(201, service.createWorkspaceDirectory({ projectId: route.projectId, ...body }));
}
if (method === 'POST' && route.tail[0] === 'move') {
  return json(200, service.moveWorkspacePath({ projectId: route.projectId, ...body }));
}
```

- [ ] Map known workspace errors so stale writes and existing destinations return `409`, invalid paths return `400`, unavailable files return `404`, and large text reads return `413`.

- [ ] Do not modify or surface `/workspace/exec`.

- [ ] Verify existing and new runtime/API behavior:

```powershell
node --test tests/localProjectWorkspaceManager.test.mjs
npm run agents:scenario
```

Expected result: both commands pass and the current bind/list/read/write/delete scenario remains green.

---

## Task 3: Build the Lazy Tree State Model

**Files:**

- Create: `src/workspace/workspaceTreeState.js`
- Create: `tests/workspaceTreeState.test.mjs`

**Produces:** `createWorkspaceTreeState(rootRecord)` and `workspaceTreeReducer(state, action)`.

- [ ] Write failing pure tests for root initialization, one-folder loading, expansion, collapse, selection, refresh, delete, path rewrite after move, dirty editor state, successful save, and conflict state.

- [ ] Run:

```powershell
node --test tests/workspaceTreeState.test.mjs
```

- [ ] Implement the smallest serializable state:

```js
{
  root: null,
  entriesByPath: {},
  childPathsByDirectory: {},
  expandedPaths: [],
  loadingPaths: [],
  selectedPath: '.',
  editor: {
    path: null,
    content: '',
    updatedAt: null,
    dirty: false,
    conflict: null
  },
  error: null
}
```

- [ ] Keep network calls and React outside the reducer.

- [ ] Run the test until it passes.

---

## Task 4: Build the Dashboard Workspace Drawer

**Files:**

- Create: `src/project/ProjectDashboardWorkspaceDrawer.jsx`
- Create: `src/workspace/WorkspaceTree.jsx`
- Create: `src/workspace/WorkspaceFilePane.jsx`
- Create: `tests/projectDashboardWorkspaceDrawerUiContract.test.mjs`

**Consumes:** Existing workspace API routes and the Task 3 reducer.

**Produces:** One local file-management workbench that can be mounted above the Dashboard.

- [ ] Write a failing UI contract test that verifies:
  - `role="tree"`, `role="treeitem"`, and `aria-expanded`;
  - an expandable root row;
  - drawer close behavior;
  - lazy list requests using relative paths;
  - create file, create folder, rename, save, refresh, and confirmed delete actions;
  - loading, empty, offline, unavailable-root, unsupported-file, and conflict states;
  - absence of command execution controls.

- [ ] Run:

```powershell
node --test tests/projectDashboardWorkspaceDrawerUiContract.test.mjs
```

- [ ] Implement `WorkspaceTree` as a presentation component. It receives loaded records, expanded/loading paths, selection, and callbacks; it performs no fetching.

- [ ] Implement `WorkspaceFilePane` with exactly three content modes:
  - selected directory children;
  - editable UTF-8 text file;
  - metadata-only unsupported preview.

- [ ] Implement `ProjectDashboardWorkspaceDrawer` with this interface:

```js
{
  open,
  project,
  workspacePath,
  backendAvailable,
  requestAgentBackend,
  onClose,
  onOpenWorkspaceSettings,
  projectText
}
```

- [ ] On first open, derive the root label from `workspacePath`, initialize `.` as the root, and call `/workspace/list` with `{ path: '.', recursive: false }`.

- [ ] Expanding an unloaded folder calls `/workspace/list` once for that relative path. Re-expanding an already-loaded folder makes no request until refresh.

- [ ] After create, move, or delete, refresh only the affected parent directory.

- [ ] Save text with the file's `updatedAt` as `expectedUpdatedAt`. A `409` shows `文件已被 Agent 更新` with `读取最新版` and `继续查看当前编辑` actions; no force-overwrite button is added.

- [ ] Require a dialog naming the exact relative path before deletion. Only the explicit non-empty-folder confirmation sends `recursive: true`.

- [ ] Use the existing warm archive/paper language: strong root row, restrained indentation lines, layered folder edges, ink-colored selection, hover/focus actions, and no KPI cards.

- [ ] Run the UI contract test until it passes.

---

## Task 5: Mount It Directly in the Dashboard

**Files:**

- Modify: `src/project/ProjectDashboardHeader.jsx`
- Modify: `tests/projectDashboardHeaderUiContract.test.mjs`
- Modify: `src/project/ProjectDashboardAdvancedView.jsx`
- Modify: `src/App.jsx`
- Test: `tests/projectDashboardWorkspaceDrawerUiContract.test.mjs`

**Consumes:** The drawer from Task 4.

**Produces:** A Dashboard header action and preserved in-place Dashboard workspace state.

- [ ] Add `FolderTree` and the Workspace button to `ProjectDashboardHeader`:

```jsx
<button
  type="button"
  data-testid="project-open-workspace"
  onClick={onOpenWorkspace}
  className="inline-flex items-center gap-2 border border-[#7b6542] px-3 py-2 font-mono text-[9px] uppercase tracking-widest hover:bg-[#efe2bd]"
>
  <FolderTree size={13} /> {projectText('Workspace')}
</button>
```

- [ ] Add `projectWorkspaceOpen` state in `src/App.jsx`. Close it when changing projects, leaving `project_detail`, or opening Meeting/Chat/Timeline.

- [ ] Pass `onOpenWorkspace` through the existing `contentLayoutView.topPanelsView.header` object.

- [ ] Lazy-load and mount `ProjectDashboardWorkspaceDrawer` in `ProjectDashboardAdvancedView` as a sibling of the Dashboard scroll surface, not inside `ProjectDashboardContentLayout`.

- [ ] Pass the active project's bound path from `activeProject.localRuntime.workspacePath`, the existing `requestAgentBackend`, backend state, close callback, and Settings → Workspace callback.

- [ ] Do not add `workspace` to `projectNavigationRecovery`, `projectMode`, sidebar rules, or the floating scene launcher.

- [ ] Verify the Dashboard itself remains mounted while opening and closing the drawer.

- [ ] Run:

```powershell
node --test tests/projectDashboardHeaderUiContract.test.mjs tests/projectDashboardWorkspaceDrawerUiContract.test.mjs tests/projectDashboardAdvancedViewUiContract.test.mjs tests/projectDashboardContentLayoutUiContract.test.mjs
```

Expected result: the Workspace drawer is reachable from the Dashboard without changing the Dashboard content composition.

---

## Task 6: Prove the Real Local Workflow

**Files:**

- Create: `scripts/validate-project-dashboard-workspace-ui.mjs`
- Modify: `package.json`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `src/agents/README.md`

**Produces:** Browser-level proof that the selected local folder and Dashboard view are the same workspace.

- [ ] Add a validator that creates one resolved temporary directory containing nested folders, a text file, a large file, and an outside sentinel.

- [ ] Start the normal local backend/frontend, create or bind a project to that folder, open its Dashboard, and click `Workspace`.

- [ ] Verify the root expands, nested folders lazy-load, the text file opens, an edit saves to the actual local file, a folder is created and renamed, and deletion requires confirmation.

- [ ] Verify `../` and a symlink cannot reach the outside sentinel.

- [ ] Verify no browser console errors or page errors occur.

- [ ] Add the package command:

```json
{
  "ui:project-dashboard-workspace": "vite build && node scripts/validate-project-dashboard-workspace-ui.mjs"
}
```

- [ ] Document these exact boundaries:
  - the selected local folder is the user-visible Agent workspace;
  - UI and Agent file routes share `project.localRuntime.workspacePath`;
  - internal Hall of Fame runtime data is separate;
  - command `cwd` is not an OS sandbox and command execution remains disabled by default;
  - the feature has no cloud component.

- [ ] Run the focused and regression checks:

```powershell
node --test tests/localProjectWorkspaceManager.test.mjs tests/workspaceTreeState.test.mjs tests/projectDashboardWorkspaceDrawerUiContract.test.mjs tests/projectDashboardHeaderUiContract.test.mjs tests/projectDashboardAdvancedViewUiContract.test.mjs tests/projectDashboardContentLayoutUiContract.test.mjs tests/workspaceViewUiContract.test.mjs
npm run agents:project-settings:workspace
npm run agents:scenario
npm run ui:project-dashboard-workspace
npm run build
```

- [ ] Inspect the final diff and confirm that every production change belongs to local workspace safety, file management, or the Dashboard drawer.

---

## Acceptance Criteria

- The user selects or binds one local folder as the project workspace.
- The project Dashboard shows a visible Workspace entry without adding a new content card.
- Clicking Workspace opens an in-Dashboard drawer containing that folder's real structure.
- The root automatically expands once, can collapse, and can expand again.
- Nested directories load only when opened.
- File creation, folder creation, text editing, rename/move, refresh, and confirmed deletion change the actual selected local folder.
- Every management target is a relative path beneath the bound root.
- Traversal and symbolic-link attempts cannot reach outside the root.
- The root itself cannot be renamed, moved, or deleted.
- A stale Dashboard editor cannot silently overwrite an Agent update.
- The drawer offers no terminal or command execution.
- No cloud-related code, copy, configuration, or architecture is added.
- Existing Dashboard content hierarchy and project workspace binding behavior remain intact.

---

## Plan Self-Review

- [x] The corrected plan is local-only and contains no cloud phase.
- [x] The file structure appears directly from the Dashboard through an in-place drawer.
- [x] The Dashboard content hierarchy remains unchanged.
- [x] Existing workspace APIs are reused instead of adding a storage abstraction.
- [x] The selected root, Agent file operations, and Dashboard management share one runtime path.
- [x] The difference between a project-file boundary and an OS command sandbox is explicit.
- [x] Path traversal, symlink escape, root mutation, stale saves, and destructive actions have concrete tests.
- [x] No separate project route, workspace scene, upload system, or command UI is introduced.
