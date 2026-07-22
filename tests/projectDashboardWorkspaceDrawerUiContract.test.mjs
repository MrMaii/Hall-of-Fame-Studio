import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const drawerUrl = new URL('../src/project/ProjectDashboardWorkspaceDrawer.jsx', import.meta.url);
const treeUrl = new URL('../src/workspace/WorkspaceTree.jsx', import.meta.url);
const paneUrl = new URL('../src/workspace/WorkspaceFilePane.jsx', import.meta.url);

test('Dashboard workspace section exposes a local lazy tree and complete file management states', () => {
  for (const url of [drawerUrl, treeUrl, paneUrl]) assert.ok(existsSync(url), `${url.pathname} must exist`);
  const drawer = readFileSync(drawerUrl, 'utf8');
  const tree = readFileSync(treeUrl, 'utf8');
  const pane = readFileSync(paneUrl, 'utf8');

  for (const contract of [
    'project-dashboard-workspace-section',
    "endpoint('list')",
    "endpoint('read')",
    "endpoint('write')",
    "endpoint('mkdir')",
    "endpoint('move')",
    "endpoint('delete')",
    'endpoint(`watch?since=',
    'workspace-file-conflict',
    'onOpenWorkspaceSettings',
    'expectedUpdatedAt',
    'data-no-localize',
    'workspace-deliverable-catalog',
    '交付文件',
    'asset.displayName',
    'asset.extension',
    'asset.statusSummary',
    'asset.statusDetail',
    'asset.fileAvailable',
    'data-asset-status',
  ]) assert.ok(drawer.includes(contract), `drawer must retain ${contract}`);
  for (const noisyCardDetail of ['{asset.purpose}', '>{asset.path}</div>', '等待形成文件']) {
    assert.equal(drawer.includes(noisyCardDetail), false, `deliverable cards must not expose ${noisyCardDetail}`);
  }
  assert.equal(drawer.includes('setInterval'), false, 'the local workspace mirror must be filesystem-event driven, not polling driven');

  for (const contract of ['role="tree"', 'role="treeitem"', 'aria-expanded', 'onToggle', 'onRename', 'onDelete']) {
    assert.ok(tree.includes(contract), `tree must retain ${contract}`);
  }
  assert.ok(tree.includes('data-no-localize'), 'local file and folder names must not be translated');

  for (const contract of ['workspace-file-editor', 'unsupported-preview', 'onCreateFile', 'onCreateFolder', 'onSave']) {
    assert.ok(pane.includes(contract), `file pane must retain ${contract}`);
  }

  assert.equal(drawer.includes('/workspace/exec'), false, 'file manager must not expose command execution');
});

test('Dashboard workspace is an inline section rather than an openable drawer', () => {
  const drawer = readFileSync(drawerUrl, 'utf8');
  assert.ok(drawer.includes('data-testid="project-dashboard-workspace-section"'));
  assert.ok(drawer.includes('<section'));
  assert.ok(!drawer.includes('if (!open) return null'));
  assert.ok(!drawer.includes('workspace-drawer-backdrop'));
  assert.ok(!drawer.includes('aria-modal="true" aria-labelledby="workspace-drawer-title"'));
});

test('Workspace file action dialog owns Escape and focus without closing the drawer behind it', () => {
  const drawer = readFileSync(drawerUrl, 'utf8');
  for (const contract of [
    'useModalDialogFocus(Boolean(dialog), onCancel)',
    'if (!activeRef.current) return',
    'ref={overlayRef}',
    'ref={dialogRef}',
    'tabIndex={-1}',
    "aria-describedby={deleting ? 'workspace-dialog-description' : undefined}",
    'id="workspace-dialog-description"',
  ]) assert.ok(drawer.includes(contract), `workspace action dialog must retain nested modal behavior: ${contract}`);
  assert.equal(drawer.includes('autoFocus'), false, 'modal focus management must capture the opener before moving focus');
});

test('Workspace save and file-loading changes are announced without interrupting editing', () => {
  const pane = readFileSync(paneUrl, 'utf8');
  assert.ok(pane.includes('role="status" aria-live="polite" aria-atomic="true"'), 'save status must be announced politely');
  assert.ok(pane.includes('data-testid="workspace-file-loading" role="status"'), 'file loading must expose a named status region');
});
