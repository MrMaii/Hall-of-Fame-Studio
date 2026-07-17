import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Windows and Unix launchers start the local app without requiring npm commands', () => {
  const windows = readFileSync(new URL('../Start Hall of Fame Studio.cmd', import.meta.url), 'utf8');
  const unix = readFileSync(new URL('../start-hall-of-fame-studio.sh', import.meta.url), 'utf8');
  const launcher = readFileSync(new URL('../scripts/start-local-app.mjs', import.meta.url), 'utf8');
  assert.match(windows, /node scripts\\start-local-app\.mjs/);
  assert.match(unix, /node scripts\/start-local-app\.mjs/);
  assert.match(launcher, /openBrowser\(match\[1\]\)/);
  assert.doesNotMatch(windows, /npm run/);
});
