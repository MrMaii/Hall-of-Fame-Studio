import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/navigation/ProductSidebar.jsx', import.meta.url), 'utf8');

test('sidebar identity is display-only and exposes one settings tab stop', () => {
  assert.equal((source.match(/onClick=\{onSettings\}/g) || []).length, 1);
  assert.ok(source.includes('data-testid="sidebar-identity"'));
  assert.ok(source.includes('data-testid="open-settings-button"'));
});
