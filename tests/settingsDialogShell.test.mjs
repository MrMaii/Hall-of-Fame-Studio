import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const settingsViewSource = readFileSync(new URL('../src/settings/SettingsModalView.jsx', import.meta.url), 'utf8');
const shellUrl = new URL('../src/settings/SettingsDialogShell.jsx', import.meta.url);

test('settings dialog shell keeps navigation, close, status, and connection controls', () => {
  assert.equal(existsSync(shellUrl), true, 'Settings dialog shell component is missing');
  const shellSource = readFileSync(shellUrl, 'utf8');

  for (const publicControl of [
    'role="dialog"',
    'aria-modal="true"',
    'aria-labelledby="local-settings-title"',
    'data-testid={`settings-tab-${item.id}`}',
    'data-testid="settings-footer-backend-save-status"',
    'data-testid="settings-footer-test-connection"',
    'onClick={onClose}',
    'onClick={() => onTabChange(item.id)}',
    'onClick={onConnectionTest}',
  ]) {
    assert.ok(shellSource.includes(publicControl), `Settings dialog control is missing: ${publicControl}`);
  }

  assert.ok(appSource.includes("const SettingsModalView = lazy(() => import('./settings/SettingsModalView.jsx'))"));
  assert.ok(settingsViewSource.includes("const SettingsDialogShell = lazy(() => import('./SettingsDialogShell.jsx'))"));
  assert.ok(settingsViewSource.includes('<SettingsDialogShell'));
  assert.ok(settingsViewSource.includes('activeTab={settingsTab}'));
  assert.ok(settingsViewSource.includes('onTabChange={setSettingsTab}'));
  assert.ok(settingsViewSource.includes('onClose={closeSettingsDialog}'));
});
