import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const workspaceViewSource = readFileSync(new URL('../src/workspace/WorkspaceView.jsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../src/workspace/AdvancedWorkspaceView.jsx', import.meta.url), 'utf8');

test('complete workspace stays lazy and keeps every project and startup control', () => {
  assert.ok(appSource.includes("const WorkspaceView = lazy(() => import('./workspace/WorkspaceView.jsx'))"));
  assert.ok(workspaceViewSource.includes("const AdvancedWorkspaceView = lazy(() => import('./AdvancedWorkspaceView.jsx'))"));
  assert.ok(workspaceViewSource.includes('<AdvancedWorkspaceView'));

  for (const publicControl of [
    'start-initiation-button',
    'start-initiation-backend-state',
    'manager-demo-tools',
    'run-manager-demo-button',
    'workspace-local-mvp-startup-readiness',
    'workspace-sync-local-mvp-startup',
    'workspace-open-startup-settings',
    'backend-sync-project-catalog',
    'workspace-portfolio-catalog-required',
    'workspace-portfolio-sync-catalog-required',
    'aria-label={`打开项目：${proj.name}`}',
    'project-progress-source-',
  ]) {
    assert.ok(workspaceSource.includes(publicControl), `complete workspace must keep ${publicControl}`);
  }
});
