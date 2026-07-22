import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('browser caches are never silently discarded and persistence failures stay visible', () => {
  assert.equal(appSource.includes('raw.length > 5_000_000'), false);
  assert.equal(appSource.includes('raw.length <= 2_000_000'), false);
  assert.ok(appSource.includes('reportBrowserStorageIssue('));
  assert.ok(appSource.includes('data-testid="browser-storage-warning"'));
  assert.ok(appSource.includes("requestAgentBackend('/projects'"));
});
