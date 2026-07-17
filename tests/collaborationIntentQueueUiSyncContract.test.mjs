import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('manual collaboration intent queue sync allows local read models to finish under load', () => {
  assert.match(
    appSource,
    /collaboration-intent-queue`,\s*\{\s*timeoutMs: silent \? 1800 : 60_000,/,
  );
});
