import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  localAuthSessionPersistenceTarget,
  selectStoredLocalAuthSession,
} from '../src/onboarding/localAuthSessionPersistence.js';

const session = (token, expiresAt = '2026-07-19T12:00:00.000Z') => ({
  token,
  baseUrl: 'http://127.0.0.1:8787',
  user: { id: 'user-1' },
  expiresAt,
});

test('prefers the current-window session and can restore an opted-in persistent session', () => {
  assert.deepEqual(selectStoredLocalAuthSession({
    sessionSession: session('window-token'),
    persistentSession: session('persistent-token'),
    now: '2026-07-19T10:00:00.000Z',
  }), {
    session: session('window-token'),
    persistence: 'session',
  });
  assert.deepEqual(selectStoredLocalAuthSession({
    persistentSession: session('persistent-token'),
    now: '2026-07-19T10:00:00.000Z',
  }), {
    session: session('persistent-token'),
    persistence: 'persistent',
  });
});

test('never restores an expired or malformed session', () => {
  assert.deepEqual(selectStoredLocalAuthSession({
    persistentSession: session('expired-token', '2026-07-19T09:59:59.000Z'),
    now: '2026-07-19T10:00:00.000Z',
  }), { session: null, persistence: null });
  assert.deepEqual(selectStoredLocalAuthSession({
    persistentSession: { token: 'missing-backend' },
    now: '2026-07-19T10:00:00.000Z',
  }), { session: null, persistence: null });
});

test('persistent storage is used only after an explicit keep-signed-in choice', () => {
  assert.equal(localAuthSessionPersistenceTarget(false), 'session');
  assert.equal(localAuthSessionPersistenceTarget(true), 'persistent');
});

test('both sign-in surfaces expose the keep-signed-in choice', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const firstRunSource = readFileSync(new URL('../src/onboarding/LocalFirstRunFlow.jsx', import.meta.url), 'utf8');
  const settingsSource = readFileSync(new URL('../src/settings/LocalAccountSettings.jsx', import.meta.url), 'utf8');

  assert.ok(appSource.includes('window.localStorage.setItem(STORAGE_KEYS.localAuthSession'));
  assert.ok(appSource.includes('keepSignedIn: localAuthSession?.persistence'));
  assert.ok(firstRunSource.includes('data-testid="first-run-keep-signed-in"'));
  assert.ok(settingsSource.includes('data-testid="settings-local-auth-keep-signed-in"'));
});
