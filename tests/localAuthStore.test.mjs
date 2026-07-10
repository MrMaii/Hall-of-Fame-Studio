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
      password: 'correct horse battery staple',
      displayName: 'Local Owner',
      now: '2026-07-09T00:00:00.000Z',
    });
    assert.equal(bootstrap.user.role, 'security-admin');
    assert.ok(bootstrap.token);
    assert.equal(auth.status().bootstrapRequired, false);
    assert.throws(() => auth.bootstrap({ username: 'other', password: 'another secure password' }), /already complete/);

    const disk = readFileSync(filePath, 'utf8');
    assert.equal(disk.includes('correct horse battery staple'), false);
    assert.equal(disk.includes(bootstrap.token), false);
    assert.equal(JSON.parse(disk).users[0].passwordHash.startsWith('scrypt$'), true);
    assert.equal(JSON.parse(disk).sessions[0].tokenHash.includes(bootstrap.token), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('local auth persists sessions, rejects bad passwords, and revokes logout tokens', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-'));
  const filePath = join(directory, 'local-auth.json');
  try {
    const auth = createLocalAuthStore({ filePath });
    const bootstrap = auth.bootstrap({ username: 'owner', password: 'correct horse battery staple' });
    assert.equal(auth.login({ username: 'owner', password: 'wrong password' }).verified, false);

    const login = auth.login({ username: 'owner', password: 'correct horse battery staple' });
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
