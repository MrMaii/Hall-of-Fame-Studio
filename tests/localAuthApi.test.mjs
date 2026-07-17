import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

test('local auth API protects local user administration and authenticates project requests', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-api-'));
  try {
    const api = createFileBackedAgentProjectApi({
      filePath: join(directory, 'projects.json'),
      localAuthFilePath: join(directory, 'auth.json'),
      localAuthRequired: true,
    });
    assert.equal(api.handle({ method: 'GET', path: '/projects' }).status, 401);
    assert.equal(api.handle({ method: 'GET', path: '/local-auth/status' }).body.localAuth.bootstrapRequired, true);

    const bootstrap = api.handle({
      method: 'POST',
      path: '/local-auth/bootstrap',
      body: { username: 'owner', password: 'correct horse battery staple1' },
    });
    assert.equal(bootstrap.status, 201);
    assert.ok(bootstrap.body.localAuth.token);
    assert.equal(bootstrap.body.localAuth.user.passwordHash, undefined);

    const noToken = api.handle({ method: 'GET', path: '/local-auth/users' });
    assert.equal(noToken.status, 401);
    const headers = { 'x-hofs-local-auth-token': bootstrap.body.localAuth.token };
    const created = api.handle({
      method: 'POST',
      path: '/local-auth/users',
      headers,
      body: { username: 'manager', password: 'another correct horse battery staple1', role: 'manager' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.localAuth.user.role, 'manager');
    assert.equal(created.body.localAuth.user.passwordHash, undefined);

    const managerLogin = api.handle({
      method: 'POST',
      path: '/local-auth/login',
      body: { username: 'manager', password: 'another correct horse battery staple1' },
    });
    assert.equal(managerLogin.status, 200);
    assert.equal(api.handle({
      method: 'GET',
      path: '/local-auth/users',
      headers: { 'x-hofs-local-auth-token': managerLogin.body.localAuth.token },
    }).status, 403);

    const rejectedRotation = api.handle({
      method: 'POST',
      path: '/local-auth/password',
      headers: { 'x-hofs-local-auth-token': managerLogin.body.localAuth.token },
      body: { currentPassword: 'wrong current password', newPassword: 'replacement manager password1' },
    });
    assert.equal(rejectedRotation.status, 403);
    const rotated = api.handle({
      method: 'POST',
      path: '/local-auth/password',
      headers: { 'x-hofs-local-auth-token': managerLogin.body.localAuth.token },
      body: {
        userId: bootstrap.body.localAuth.user.id,
        currentPassword: 'another correct horse battery staple1',
        newPassword: 'replacement manager password1',
      },
    });
    assert.equal(rotated.status, 200);
    assert.ok(rotated.body.localAuth.token);
    assert.equal(api.handle({
      method: 'POST',
      path: '/local-auth/login',
      body: { username: 'owner', password: 'correct horse battery staple1' },
    }).status, 200);
    assert.equal(api.handle({
      method: 'POST',
      path: '/local-auth/logout',
      headers: { 'x-hofs-local-auth-token': managerLogin.body.localAuth.token },
    }).status, 401);
    assert.equal(api.handle({
      method: 'POST',
      path: '/local-auth/logout',
      headers: { 'x-hofs-local-auth-token': rotated.body.localAuth.token },
    }).status, 200);

    const disabled = api.handle({
      method: 'POST',
      path: `/local-auth/users/${managerLogin.body.localAuth.user.id}/disable`,
      headers,
      body: { now: '2026-07-10T01:00:00.000Z' },
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.localAuth.user.disabledAt, '2026-07-10T01:00:00.000Z');
    assert.equal(api.handle({
      method: 'GET',
      path: '/projects',
      headers: { 'x-hofs-local-auth-token': managerLogin.body.localAuth.token },
    }).status, 401);

    const authenticatedProjects = api.handle({ method: 'GET', path: '/projects', headers });
    assert.equal(authenticatedProjects.status, 200);
    const logout = api.handle({ method: 'POST', path: '/local-auth/logout', headers });
    assert.equal(logout.status, 200);
    assert.equal(api.handle({ method: 'GET', path: '/projects', headers }).status, 401);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
