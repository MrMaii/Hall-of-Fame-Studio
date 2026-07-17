import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viteConfig = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

test('Vite does not watch backend-owned local data files', () => {
  assert.match(viteConfig, /server:\s*\{[\s\S]*watch:\s*\{[\s\S]*ignored:\s*\['\*\*\/\.tmp\/\*\*'\]/);
});
