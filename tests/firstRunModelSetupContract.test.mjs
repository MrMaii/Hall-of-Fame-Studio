import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const modalSource = readFileSync(new URL('../src/settings/SettingsModalView.jsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/settings/SettingsDialogShell.jsx', import.meta.url), 'utf8');

test('first-run model action opens a focused model setup instead of the full settings navigation', () => {
  assert.ok(appSource.includes('const [focusedModelSetup, setFocusedModelSetup] = useState(false)'));
  assert.ok(appSource.includes('setFocusedModelSetup(true)'));
  assert.ok(appSource.includes('focusedModelSetup,'));
  assert.ok(modalSource.includes('focused={focusedModelSetup}'));
  assert.ok(shellSource.includes('{!focused && ('));
});

test('focused model setup has one task and exposes completion only after provider configuration', () => {
  assert.ok(modalSource.includes("data-testid={focusedModelSetup ? 'first-run-model-setup' : undefined}"));
  assert.ok(modalSource.includes('data-testid="first-run-model-setup-complete"'));
  assert.ok(modalSource.includes('providerRuntimeStatus.modelProvider?.configured'));
  assert.ok(modalSource.includes('!focusedModelSetup &&'));
});
