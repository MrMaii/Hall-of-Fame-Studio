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
  const localAuth = createLocalAuthStore({ filePath: join(directory, 'local-auth.json') });
  const api = createAgentProjectApi({ service, localAuth, localAuthRequired: true });
  return { store, service, localAuth, api };
}

test('audits local user administration in an independent runtime hash chain', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-runtime-security-audit-'));
  try {
    const { api } = createRuntime(directory);
    const bootstrap = api.handle({
      method: 'POST',
      path: '/local-auth/bootstrap',
      body: {
        username: 'owner',
        password: 'correct horse battery staple1',
        now: '2026-07-10T20:00:00.000Z',
      },
    });
    assert.equal(bootstrap.status, 201);
    const headers = { 'x-hofs-local-auth-token': bootstrap.body.localAuth.token };

    const created = api.handle({
      method: 'POST',
      path: '/local-auth/users',
      traceId: 'trace_runtime_user_admin_001',
      headers,
      body: {
        username: 'manager',
        password: 'another correct horse battery staple1',
        role: 'manager',
        now: '2026-07-10T20:01:00.000Z',
      },
    });
    assert.equal(created.status, 201);

    const auditResponse = api.handle({
      method: 'GET',
      path: '/security-audit-stream',
      headers,
      body: { now: '2026-07-10T20:01:30.000Z' },
    });
    assert.equal(auditResponse.status, 200);
    const stream = auditResponse.body.runtimeSecurityAuditStream;
    assert.equal(stream.schemaVersion, 'runtime-security-audit-stream/v1');
    assert.equal(stream.hashChainReady, true);
    assert.equal(stream.count, 3);
    const row = stream.rows.find((record) => record.routeKey === 'local-auth-users');
    assert.equal(row.auditScope, 'runtime');
    assert.equal(row.scopeId, 'local-runtime');
    assert.equal(row.projectId, null);
    assert.equal(row.routeKey, 'local-auth-users');
    assert.equal(row.actor.role, 'security-admin');
    assert.equal(row.actor.userId, bootstrap.body.localAuth.user.id);
    assert.equal(row.traceId, 'trace_runtime_user_admin_001');
    assert.equal(row.streamSequence, 2);
    const mutationResult = stream.rows.find((record) => record.authentication?.operation === 'create-user');
    assert.equal(mutationResult.authentication.targetUserId, created.body.localAuth.user.id);
    assert.equal(mutationResult.authentication.recovered, false);
    assert.equal(JSON.stringify(stream).includes('another correct horse battery staple'), false);

    const restarted = createRuntime(directory);
    const restartedAudit = restarted.api.handle({
      method: 'GET',
      path: '/security-audit-stream',
      headers,
      body: { now: '2026-07-10T20:02:00.000Z' },
    });
    assert.equal(restartedAudit.status, 200);
    assert.equal(restartedAudit.body.runtimeSecurityAuditStream.count, 3);
    assert.equal(restartedAudit.body.runtimeSecurityAuditStream.hashChainReady, true);
    assert.equal(
      restartedAudit.body.runtimeSecurityAuditStream.rows.some((record) => record.traceId === 'trace_runtime_user_admin_001'),
      true,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fails a global Vault mutation closed before dispatch when runtime audit is unavailable', async () => {
  let vaultWriteCount = 0;
  const api = createAgentProjectApi({
    service: {
      async sealSecretVaultRecord() {
        vaultWriteCount += 1;
        return { sealed: true };
      },
    },
  });

  const response = await api.handleAsync({
    method: 'POST',
    path: '/secret-vault/seal',
    traceId: 'trace_runtime_vault_missing_sink',
    headers: { 'x-hofs-role': 'security-admin' },
    body: { name: 'model.apiKey', value: 'must-not-reach-handler' },
  });

  assert.equal(response.status, 503);
  assert.equal(response.body.error, 'access-audit-write-failed');
  assert.equal(vaultWriteCount, 0);
});
