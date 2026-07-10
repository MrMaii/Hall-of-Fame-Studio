import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';

test('local auth protects HTTP API and scheduler controls without blocking bootstrap', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-http-'));
  const server = createAgentProjectHttpServer({
    filePath: join(directory, 'projects.json'),
    localAuthFilePath: join(directory, 'auth.json'),
    localAuthRequired: true,
  });
  const runtime = await server.listen({ port: 0 });
  try {
    let response = await fetch(`${runtime.url}/projects`);
    assert.equal(response.status, 401);

    response = await fetch(`${runtime.url}/local-auth/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'correct horse battery staple' }),
    });
    const bootstrap = await response.json();
    assert.equal(response.status, 201);
    const headers = { 'x-hofs-local-auth-token': bootstrap.localAuth.token };

    response = await fetch(`${runtime.url}/projects`, { headers });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('access-control-allow-headers') || '', /x-hofs-local-auth-token/);

    response = await fetch(`${runtime.url}/workers/autonomous/status`);
    assert.equal(response.status, 401);
    response = await fetch(`${runtime.url}/workers/autonomous/status`, { headers });
    assert.equal(response.status, 200);
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
