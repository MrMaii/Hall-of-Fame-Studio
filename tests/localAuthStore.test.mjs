import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createLocalAuthStore } from '../src/agents/localAuthStore.js';

test('local auth bootstraps one admin and never persists plaintext credentials', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-'));
  const filePath = join(directory, 'local-auth.json');
  try {
    const auth = createLocalAuthStore({ filePath });
    assert.equal(auth.status().bootstrapRequired, true);

    const bootstrap = auth.bootstrap({
      username: 'owner',
      password: 'correct horse battery staple1',
      displayName: 'Local Owner',
      now: '2026-07-09T00:00:00.000Z',
    });
    assert.equal(bootstrap.user.role, 'security-admin');
    assert.ok(bootstrap.token);
    assert.equal(auth.status().bootstrapRequired, false);
    assert.throws(() => auth.bootstrap({ username: 'other', password: 'another secure password' }), /already complete/);

    const disk = readFileSync(filePath, 'utf8');
    assert.equal(disk.includes('correct horse battery staple1'), false);
    assert.equal(disk.includes(bootstrap.token), false);
    assert.equal(JSON.parse(disk).users[0].passwordHash.startsWith('scrypt$'), true);
    assert.equal(JSON.parse(disk).sessions[0].tokenHash.includes(bootstrap.token), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('local auth accepts four-character passwords with both letters and numbers', () => {
  const auth = createLocalAuthStore();
  assert.throws(() => auth.bootstrap({ username: 'owner', password: 'a1' }), /at least 4 characters/i);
  assert.throws(() => auth.bootstrap({ username: 'owner', password: 'abcd' }), /at least one number/i);
  assert.throws(() => auth.bootstrap({ username: 'owner', password: '1234' }), /at least one letter/i);
  const bootstrap = auth.bootstrap({ username: 'owner', password: 'ab12' });
  assert.ok(bootstrap.token);
  assert.equal(bootstrap.user.role, 'security-admin');
});

test('local auth persists sessions, rejects bad passwords, and revokes logout tokens', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-'));
  const filePath = join(directory, 'local-auth.json');
  try {
    const auth = createLocalAuthStore({ filePath });
    const bootstrap = auth.bootstrap({ username: 'owner', password: 'correct horse battery staple1' });
    assert.equal(auth.login({ username: 'owner', password: 'wrong password' }).verified, false);

    const login = auth.login({ username: 'owner', password: 'correct horse battery staple1' });
    assert.equal(login.verified, true);
    const restarted = createLocalAuthStore({ filePath });
    assert.equal(restarted.verifySession({ token: login.token }).verified, true);
    assert.equal(restarted.logout({ token: login.token }).revoked, true);
    assert.equal(restarted.verifySession({ token: login.token }).reason, 'local-auth-session-revoked');
    assert.equal(restarted.verifySession({ token: bootstrap.token }).verified, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('locks repeated local password failures and clears the lockout after the retry window', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-lockout-'));
  const filePath = join(directory, 'local-auth.json');
  try {
    const auth = createLocalAuthStore({ filePath, maxFailedLoginAttempts: 2, loginLockoutMs: 60_000 });
    auth.bootstrap({ username: 'owner', password: 'correct horse battery staple1', now: '2026-07-10T00:00:00.000Z' });

    assert.equal(auth.login({ username: 'owner', password: 'wrong password', now: '2026-07-10T00:00:01.000Z' }).reason, 'local-auth-invalid-credentials');
    const locked = auth.login({ username: 'owner', password: 'wrong password', now: '2026-07-10T00:00:02.000Z' });
    assert.equal(locked.reason, 'local-auth-login-locked');
    assert.equal(locked.retryAt, '2026-07-10T00:01:02.000Z');
    assert.equal(auth.login({ username: 'owner', password: 'correct horse battery staple1', now: '2026-07-10T00:00:03.000Z' }).reason, 'local-auth-login-locked');
    assert.equal(auth.login({ username: 'owner', password: 'correct horse battery staple1', now: '2026-07-10T00:01:03.000Z' }).verified, true);

    const disk = readFileSync(filePath, 'utf8');
    assert.equal(disk.includes('correct horse battery staple1'), false);
    assert.equal(JSON.stringify(auth.listUsers()).includes('failedLoginAttempts'), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('disabling a local account revokes every session without allowing the last security admin to be disabled', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-disable-'));
  const filePath = join(directory, 'local-auth.json');
  try {
    const auth = createLocalAuthStore({ filePath });
    const owner = auth.bootstrap({ username: 'owner', password: 'correct horse battery staple1', now: '2026-07-10T00:00:00.000Z' });
    const manager = auth.createUser({ username: 'manager', password: 'another correct horse battery staple1', role: 'manager', now: '2026-07-10T00:00:01.000Z' });
    const managerLogin = auth.login({ username: 'manager', password: 'another correct horse battery staple1', now: '2026-07-10T00:00:02.000Z' });

    const disabled = auth.disableUser({ userId: manager.user.id, now: '2026-07-10T01:00:00.000Z' });
    assert.equal(disabled.user.disabledAt, '2026-07-10T01:00:00.000Z');
    assert.equal(disabled.revokedSessionCount, 1);
    assert.equal(auth.status().disabledUserCount, 1);
    assert.equal(auth.verifySession({ token: managerLogin.token }).reason, 'local-auth-session-revoked');
    assert.throws(() => auth.disableUser({ userId: owner.user.id, now: '2026-07-10T01:00:01.000Z' }), /last security administrator/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rotating a local password revokes prior sessions and issues one replacement session', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-password-'));
  const filePath = join(directory, 'local-auth.json');
  try {
    const auth = createLocalAuthStore({ filePath });
    const owner = auth.bootstrap({ username: 'owner', password: 'correct horse battery staple1', now: '2026-07-10T00:00:00.000Z' });
    const secondSession = auth.login({ username: 'owner', password: 'correct horse battery staple1', now: '2026-07-10T00:01:00.000Z' });
    const rotated = auth.changePassword({
      userId: owner.user.id,
      currentPassword: 'correct horse battery staple1',
      newPassword: 'new correct horse battery staple2',
      now: '2026-07-10T02:00:00.000Z',
    });

    assert.equal(rotated.revokedSessionCount, 2);
    assert.notEqual(rotated.token, owner.token);
    assert.equal(auth.verifySession({ token: owner.token, now: '2026-07-10T02:01:00.000Z' }).reason, 'local-auth-session-revoked');
    assert.equal(auth.verifySession({ token: secondSession.token, now: '2026-07-10T02:01:00.000Z' }).reason, 'local-auth-session-revoked');
    assert.equal(auth.verifySession({ token: rotated.token, now: '2026-07-10T02:01:00.000Z' }).verified, true);
    assert.equal(auth.login({ username: 'owner', password: 'correct horse battery staple1', now: '2026-07-10T02:01:00.000Z' }).verified, false);
    assert.equal(auth.login({ username: 'owner', password: 'new correct horse battery staple2', now: '2026-07-10T02:02:00.000Z' }).verified, true);
    assert.equal(readFileSync(filePath, 'utf8').includes('new correct horse battery staple2'), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
