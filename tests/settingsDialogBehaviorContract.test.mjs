import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/settings/SettingsDialogShell.jsx', import.meta.url), 'utf8');

test('settings dialog traps focus, closes with Escape, restores focus, and makes the background inert', () => {
  assert.ok(source.includes("import { useEffect, useRef } from 'react'"));
  assert.ok(source.includes("event.key === 'Escape'"));
  assert.ok(source.includes("event.key !== 'Tab'"));
  assert.ok(source.includes("sibling.setAttribute('inert', '')"));
  assert.ok(source.includes('previousFocus?.focus()'));
  assert.ok(source.includes('ref={dialogRef}'));
  assert.ok(source.includes('tabIndex={-1}'));
  assert.ok(source.includes('element.getClientRects().length > 0'));
  assert.ok(source.includes("!element.closest('[aria-hidden=\"true\"]')"));
});

test('the clickable backdrop is hidden from the accessibility tree', () => {
  assert.ok(source.includes('aria-hidden="true"'));
  assert.ok(source.includes('tabIndex={-1}'));
});
