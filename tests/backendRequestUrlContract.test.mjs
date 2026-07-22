import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('backend requests use the normalized base URL that was validated for auth and deduplication', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(appSource.includes('const normalizedBaseUrl = normalizeBackendBaseUrl(baseUrl || DEFAULT_AGENT_BACKEND_URL);'));
  assert.ok(appSource.includes('await fetch(`${normalizedBaseUrl}${path}`'));
  assert.equal(appSource.includes('await fetch(`${baseUrl}${path}`'), false);
});
