import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('ordinary launchers require neither administrator elevation nor an internet download', () => {
  const sources = [
    read('../Start Hall of Fame Studio.cmd'),
    read('../start-hall-of-fame-studio.sh'),
    read('../scripts/start-local-app.mjs'),
    read('../scripts/local-dev.mjs'),
  ].join('\n');

  assert.doesNotMatch(sources, /\b(?:runas|sudo|Start-Process\s+-Verb\s+RunAs|Invoke-WebRequest|curl|wget|npm\s+install|pnpm\s+install|yarn\s+install)\b/i);
  assert.doesNotMatch(sources, /https:\/\//i);
  assert.match(sources, /127\.0\.0\.1/);
  assert.match(sources, /process\.execPath/);
});

test('local startup keeps existing user data paths and process permissions', () => {
  const source = read('../scripts/start-local-app.mjs');
  assert.match(source, /env: process\.env/);
  assert.doesNotMatch(source, /chmod|chown|icacls|takeown|Program Files|System32/i);
});
