import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('does not retain remote frontend asset or attribution targets', () => {
  assert.doesNotMatch(appSource, /fonts\.googleapis\.com|fonts\.gstatic\.com/i);
  assert.doesNotMatch(appSource, /commons\.wikimedia\.org/i);
});
