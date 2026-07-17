import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { createLocalAuthStore } from '../src/agents/localAuthStore.js';

function createRuntime(directory) {
  const store = createAgentProjectFileStore({
    filePath: join(directory, 'projects.json'),
    hydrateProject: hydrateAgentProject,
  });
  const service = createAgentProjectService({ store });
  const localAuth = createLocalAuthStore({
    filePath: join(directory, 'local-auth.json'),
    maxFailedLoginAttempts: 2,
    loginLockoutMs: 60_000,
  });
  const api = createAgentProjectApi({ service, localAuth, localAuthRequired: true });
  return { store, service, localAuth, api };
}

test('records privacy-preserving bootstrap, login failure, lockout and recovery events', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-events-'));
  try {
    const { api } = createRuntime(directory);
    const bootstrap = api.handle({
      method: 'POST',
      path: '/local-auth/bootstrap',
      traceId: 'trace_auth_bootstrap_001',
      body: {
        username: 'owner',
        password: 'correct horse battery staple1',
        now: '2026-07-10T21:00:00.000Z',
      },
    });
    assert.equal(bootstrap.status, 201);

    const failed = api.handle({
      method: 'POST',
      path: '/local-auth/login',
      traceId: 'trace_auth_login_failed_001',
      body: {
        username: 'owner',
        password: 'wrong password value',
        now: '2026-07-10T21:00:01.000Z',
      },
    });
    assert.equal(failed.status, 401);

    const locked = api.handle({
      method: 'POST',
      path: '/local-auth/login',
      traceId: 'trace_auth_login_locked_001',
      body: {
        username: 'owner',
        password: 'wrong password value',
        now: '2026-07-10T21:00:02.000Z',
      },
    });
    assert.equal(locked.status, 429);

    const recovered = api.handle({
      method: 'POST',
      path: '/local-auth/login',
      traceId: 'trace_auth_login_success_001',
      body: {
        username: 'owner',
        password: 'correct horse battery staple1',
        now: '2026-07-10T21:01:03.000Z',
      },
    });
    assert.equal(recovered.status, 200);

    const headers = { 'x-hofs-local-auth-token': bootstrap.body.localAuth.token };
    const audit = api.handle({
      method: 'GET',
      path: '/security-audit-stream',
      headers,
      body: { now: '2026-07-10T21:02:00.000Z' },
    });
    assert.equal(audit.status, 200);
    const stream = audit.body.runtimeSecurityAuditStream;
    assert.equal(stream.count, 4);
    assert.equal(stream.hashChainReady, true);
    const outcomes = stream.rows.map((row) => row.authentication?.outcome).sort();
    assert.deepEqual(outcomes, ['bootstrap-success', 'login-failed', 'login-locked', 'login-success']);
    const subjectHashes = new Set(stream.rows.map((row) => row.authentication?.subjectHash));
    assert.equal(subjectHashes.size, 1);
    assert.match([...subjectHashes][0], /^[a-f0-9]{64}$/);
    assert.equal(stream.rows.every((row) => row.auditScope === 'runtime'), true);
    assert.equal(stream.rows.some((row) => row.traceId === 'trace_auth_login_locked_001'), true);
    const serialized = JSON.stringify(stream);
    assert.equal(serialized.includes('owner'), false);
    assert.equal(serialized.includes('correct horse battery staple'), false);
    assert.equal(serialized.includes('wrong password value'), false);
    assert.equal(serialized.includes(bootstrap.body.localAuth.token), false);

    const restarted = createRuntime(directory);
    const restartedAudit = restarted.api.handle({
      method: 'GET',
      path: '/security-audit-stream',
      headers,
      body: { now: '2026-07-10T21:03:00.000Z' },
    });
    assert.equal(restartedAudit.status, 200);
    assert.equal(restartedAudit.body.runtimeSecurityAuditStream.count, 4);
    assert.equal(restartedAudit.body.runtimeSecurityAuditStream.hashChainReady, true);
    assert.deepEqual(
      restartedAudit.body.runtimeSecurityAuditStream.rows.map((row) => row.authentication?.outcome).sort(),
      outcomes,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
