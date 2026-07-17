import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const restoredAppSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const accountSettingsSource = readFileSync(new URL('../src/settings/LocalAccountSettings.jsx', import.meta.url), 'utf8');
const settingsViewSource = readFileSync(new URL('../src/settings/SettingsModalView.jsx', import.meta.url), 'utf8');
const firstRunSource = readFileSync(new URL('../src/onboarding/LocalFirstRunFlow.jsx', import.meta.url), 'utf8');
const appSource = [restoredAppSource, accountSettingsSource].join('\n');

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
  assert.match(appSource, /settings-local-auth-password-form/);
  assert.match(appSource, /\/local-auth\/password/);
  assert.match(appSource, /settings-local-auth-disable-/);
  assert.match(appSource, /\/local-auth\/users\/\$\{encodeURIComponent\(user\.id\)\}\/disable/);
  assert.match(appSource, /settings-local-project-membership/);
  assert.match(appSource, /\/membership-policy/);
  assert.match(appSource, /settings-local-auth-login-locked/);
  assert.match(appSource, /local-auth-login-locked/);
  assert.doesNotMatch(appSource, /failedLoginAttempts/);
});

test('local account settings use plain Chinese labels and named password fields', () => {
  for (const text of ['本地账户', '退出登录', '修改密码', '创建用户', '当前项目权限', '登录本地账户']) {
    assert.match(accountSettingsSource, new RegExp(text));
  }
  for (const label of ['aria-label="当前密码"', 'aria-label="新密码"', 'aria-label="再次输入新密码"']) {
    assert.match(accountSettingsSource, new RegExp(label));
  }
  assert.doesNotMatch(accountSettingsSource, />Sign out</);
  assert.doesNotMatch(accountSettingsSource, />Create user</);
  assert.match(accountSettingsSource, /用户名或密码不正确/);
  assert.match(accountSettingsSource, /请刷新账户状态后重试/);
  assert.match(settingsViewSource, /<LocalAccountSettings/);
});

test('the current application presents the local first-run account flow before an empty workspace', () => {
  assert.match(restoredAppSource, /const LocalFirstRunFlow = lazy\(\(\) => import\(['"]\.\/onboarding\/LocalFirstRunFlow\.jsx['"]\)\)/);
  assert.match(restoredAppSource, /<LocalFirstRunFlow/);
  assert.match(firstRunSource, /data-testid="first-run-local-auth"/);
  assert.match(firstRunSource, /data-testid="first-run-password-valid"/);
  assert.match(firstRunSource, /onStartProject/);
});

test('a restored local session automatically reloads the backend project catalog', () => {
  assert.match(restoredAppSource, /const authToken = localAuthSessionForCurrentBackend\?\.token \|\| ''/);
  assert.match(restoredAppSource, /syncBackendProjectCatalog\(\{ silent: true, authToken \}\)/);
  assert.match(restoredAppSource, /timeoutMs: silent \? 8000 : 12000/);
  assert.match(restoredAppSource, /\/local-auth\/status[\s\S]{0,120}timeoutMs: 8000/);
});
