import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/navigation/ProductSidebar.jsx', import.meta.url), 'utf8');

test('the expanded sidebar automatically collapses to an icon rail below the desktop breakpoint', () => {
  assert.ok(source.includes("collapsed ? 'w-16' : 'w-16 md:w-64'"));
  assert.ok(source.includes('data-testid="sidebar-identity"'));
  assert.ok(source.includes('hidden min-w-0 flex-1 items-center gap-3 md:flex'));
  assert.ok(source.includes('hidden md:block'));
});
