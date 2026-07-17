import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the local launcher has explicit Windows, macOS and Linux browser paths', () => {
  const source = readFileSync(new URL('../scripts/start-local-app.mjs', import.meta.url), 'utf8');
  assert.match(source, /platform === 'win32' \? 'cmd\.exe'/);
  assert.match(source, /platform === 'darwin' \? 'open'/);
  assert.match(source, /: 'xdg-open'/);
});
