import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const viewUrl = new URL('../src/workspace/WorkspaceView.jsx', import.meta.url);

test('workspace display loads independently while retaining simple and advanced project controls', () => {
  assert.ok(existsSync(viewUrl), 'WorkspaceView must exist');
  const viewSource = readFileSync(viewUrl, 'utf8');

  assert.ok(appSource.includes("lazy(() => import('./workspace/WorkspaceView.jsx'))"));
  assert.ok(appSource.includes('<WorkspaceView'));
  assert.ok(!appSource.includes('<ProjectHub'));
  assert.ok(!appSource.includes('<AdvancedWorkspaceView'));

  for (const retainedArea of [
    'ProjectHub',
    'AdvancedWorkspaceView',
    'workspaceAdvancedOpen',
    'localMvpStartupReadiness',
    'workspacePortfolioCatalogRequired',
  ]) {
    assert.ok(viewSource.includes(retainedArea), `workspace view is missing ${retainedArea}`);
  }

  for (const retainedAction of [
    'navToInitiation',
    'navToProject',
    'syncBackendProjectCatalog',
    'syncSettingsProviderRuntime',
    'launchManagerDemoProject',
    'setWorkspaceAdvancedOpen',
  ]) {
    assert.ok(appSource.includes(retainedAction), `App must retain ${retainedAction}`);
    assert.ok(viewSource.includes(retainedAction), `workspace view must retain ${retainedAction}`);
  }
});
