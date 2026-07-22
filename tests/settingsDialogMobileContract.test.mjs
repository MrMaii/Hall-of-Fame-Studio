import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/settings/SettingsDialogShell.jsx', import.meta.url), 'utf8');

test('settings uses a full-width single column and a top selector on small screens', () => {
  assert.ok(source.includes('sm:flex-row'));
  assert.ok(source.includes('hidden w-64'));
  assert.ok(source.includes('sm:hidden'));
  assert.ok(source.includes('data-testid="settings-mobile-tab-select"'));
  assert.ok(source.includes('onChange={(event) => onTabChange(event.target.value)}'));
});
