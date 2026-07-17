import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const viewUrl = new URL('../src/settings/SettingsModalView.jsx', import.meta.url);

test('settings window loads independently while retaining every local settings area and action', () => {
  assert.ok(existsSync(viewUrl), 'SettingsModalView must exist');
  const viewSource = readFileSync(viewUrl, 'utf8');

  assert.ok(appSource.includes("lazy(() => import('./settings/SettingsModalView.jsx'))"));
  assert.ok(appSource.includes('<SettingsModalView'));
  assert.ok(!appSource.includes('data-testid="settings-provider-boundary"'));

  for (const retainedArea of [
    'SettingsDialogShell',
    'LocalAccountSettings',
    'LocalModelSettings',
    'LocalDeploymentSettings',
    'LocalHealthSettings',
    'LocalPrivacySettings',
    'LocalWorkspaceSettings',
    'LocalToolsSettings',
    'data-testid="settings-provider-boundary"',
    'data-testid="settings-model-runtime-boundary"',
  ]) {
    assert.ok(viewSource.includes(retainedArea), `settings view is missing ${retainedArea}`);
  }

  for (const retainedAction of [
    'saveBackendBaseUrl',
    'sealSettingsProviderSecret',
    'submitLocalAuth',
    'changeLocalAuthPassword',
    'bindProjectWorkspaceFromSettings',
    'runSettingsHealthCheck',
  ]) {
    assert.ok(appSource.includes(retainedAction), `App must retain ${retainedAction}`);
    assert.ok(viewSource.includes(retainedAction), `settings view must retain ${retainedAction}`);
  }
});
