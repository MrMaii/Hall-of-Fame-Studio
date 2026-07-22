import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

test('the multi-megabyte project service is loaded only when an advanced local fallback runs', () => {
  assert.equal(appSource.includes("from './agents/agentProjectService.js'"), false);
  assert.ok(appSource.includes("import('./agents/agentProjectFallbacks.js')"));
});

test('runtime core and the deferred project service use separate chunks', () => {
  assert.ok(viteSource.includes("return 'agent-runtime-core'"));
  assert.equal(viteSource.includes("agentProjectService.js')) return"), false);
});
