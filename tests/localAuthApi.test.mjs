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
      body: { username: 'owner', password: 'correct horse battery staple' },
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
      body: { username: 'manager', password: 'another correct horse battery staple', role: 'manager' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.localAuth.user.role, 'manager');
    assert.equal(created.body.localAuth.user.passwordHash, undefined);

    const managerLogin = api.handle({
      method: 'POST',
      path: '/local-auth/login',
      body: { username: 'manager', password: 'another correct horse battery staple' },
    });
    assert.equal(managerLogin.status, 200);
    assert.equal(api.handle({
      method: 'GET',
      path: '/local-auth/users',
      headers: { 'x-hofs-local-auth-token': managerLogin.body.localAuth.token },
    }).status, 403);

    const authenticatedProjects = api.handle({ method: 'GET', path: '/projects', headers });
    assert.equal(authenticatedProjects.status, 200);
    const logout = api.handle({ method: 'POST', path: '/local-auth/logout', headers });
    assert.equal(logout.status, 200);
    assert.equal(api.handle({ method: 'GET', path: '/projects', headers }).status, 401);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
