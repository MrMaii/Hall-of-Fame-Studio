import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('the local UI keeps a backend-bound session and exposes local account controls', () => {
  assert.match(appSource, /localAuthSession/);
  assert.match(appSource, /x-hofs-local-auth-token/);
  assert.match(appSource, /\/local-auth\/status/);
  assert.match(appSource, /\/local-auth\/\$\{action\}/);
  assert.match(appSource, /submitLocalAuth\('logout'\)/);
  assert.match(appSource, /settings-local-auth/);
  assert.match(appSource, /settings-local-auth-users/);
  assert.match(appSource, /settings-local-auth-create-user/);
  assert.match(appSource, /\/local-auth\/users/);
});
