import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createLocalAuthStore } from '../src/agents/localAuthStore.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';

test('atomically retains content-minimized pending audit receipts for committed auth mutations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-audit-transaction-'));
  const filePath = join(directory, 'local-auth.json');
  try {
    const auth = createLocalAuthStore({ filePath });
    const bootstrap = auth.bootstrap({ username: 'owner', password: 'correct horse battery staple', now: '2026-07-11T19:00:00.000Z' });
    assert.equal(auth.status().pendingAuditTransactionCount, 1);
    const pending = auth.pendingAuditTransactions();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].operation, 'bootstrap');
    assert.equal(pending[0].status, 'audit-pending');
    assert.match(pending[0].subjectHash, /^[a-f0-9]{64}$/);
    const persisted = readFileSync(filePath, 'utf8');
    assert.equal(persisted.includes('correct horse battery staple'), false);
    assert.equal(persisted.includes(bootstrap.token), false);
    assert.equal(JSON.stringify(pending).includes('owner'), false);
    auth.acknowledgeAuditTransaction({ transactionId: pending[0].id, auditRecordId: 'runtime-audit-1', auditRecordChecksum: 'a'.repeat(64), now: '2026-07-11T19:01:00.000Z' });
    assert.equal(auth.status().pendingAuditTransactionCount, 0);
    assert.equal(auth.status().confirmedAuditTransactionCount, 1);
    const restarted = createLocalAuthStore({ filePath });
    assert.equal(restarted.status().confirmedAuditTransactionCount, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('covers every local identity mutation and rejects a tampered pending transaction on restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-audit-coverage-'));
  const filePath = join(directory, 'local-auth.json');
  try {
    const auth = createLocalAuthStore({ filePath });
    const owner = auth.bootstrap({ username: 'owner', password: 'correct horse battery staple', now: '2026-07-11T19:20:00.000Z' });
    const manager = auth.createUser({ username: 'manager', password: 'another correct horse battery staple', role: 'manager', actorUserId: owner.user.id, now: '2026-07-11T19:21:00.000Z' });
    const login = auth.login({ username: 'manager', password: 'another correct horse battery staple', now: '2026-07-11T19:22:00.000Z' });
    auth.logout({ token: login.token, now: '2026-07-11T19:23:00.000Z' });
    auth.changePassword({ userId: owner.user.id, currentPassword: 'correct horse battery staple', newPassword: 'correct horse battery staple changed', now: '2026-07-11T19:24:00.000Z' });
    auth.disableUser({ userId: manager.user.id, actorUserId: owner.user.id, now: '2026-07-11T19:25:00.000Z' });
    assert.deepEqual(new Set(auth.pendingAuditTransactions().map((row) => row.operation)), new Set(['bootstrap', 'create-user', 'login', 'logout', 'change-password', 'disable-user']));
    const snapshot = JSON.parse(readFileSync(filePath, 'utf8'));
    snapshot.auditTransactions[0].outcome = 'forged';
    writeFileSync(filePath, JSON.stringify(snapshot));
    const restarted = createLocalAuthStore({ filePath });
    assert.equal(restarted.status().invalidAuditTransactionCount, 1);
    assert.equal(restarted.pendingAuditTransactions().some((row) => row.outcome === 'forged'), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('recovers a committed auth mutation whose runtime audit append failed before acknowledgement', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-audit-recovery-'));
  const authPath = join(directory, 'local-auth.json');
  const projectPath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath: projectPath, hydrateProject: hydrateAgentProject });
    const service = createAgentProjectService({ store });
    const failingService = new Proxy(service, {
      get(target, property) {
        if (property === 'recordLocalAuthMutationResult') return () => { throw new Error('simulated-audit-outage'); };
        const value = target[property];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const auth = createLocalAuthStore({ filePath: authPath });
    const api = createAgentProjectApi({ service: failingService, localAuth: auth, localAuthRequired: true });
    const response = api.handle({ method: 'POST', path: '/local-auth/bootstrap', body: { username: 'owner', password: 'correct horse battery staple', now: '2026-07-11T19:10:00.000Z' } });
    assert.equal(response.status, 503);
    assert.equal(auth.status().pendingAuditTransactionCount, 1);

    const restartedAuth = createLocalAuthStore({ filePath: authPath });
    const restartedService = createAgentProjectService({ store: createAgentProjectFileStore({ filePath: projectPath, hydrateProject: hydrateAgentProject }) });
    createAgentProjectApi({ service: restartedService, localAuth: restartedAuth, localAuthRequired: true });
    assert.equal(restartedAuth.status().pendingAuditTransactionCount, 0);
    assert.equal(restartedAuth.status().confirmedAuditTransactionCount, 1);
    const recovered = restartedService.getRuntimeSecurityAuditStream().rows.find((row) => row.authentication?.operation === 'bootstrap');
    assert.equal(recovered.authentication.recovered, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('deduplicates one local auth mutation result by transaction id in the runtime hash chain', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-auth-audit-result-'));
  try {
    const store = createAgentProjectFileStore({ filePath: join(directory, 'projects.json'), hydrateProject: hydrateAgentProject });
    const service = createAgentProjectService({ store });
    const input = {
      transactionId: 'lat_transaction_001', operation: 'create-user', outcome: 'user-created', subjectHash: 'a'.repeat(64),
      actorUserId: 'admin-user', targetUserId: 'new-user', sessionId: null, recovered: false, now: '2026-07-11T19:02:00.000Z',
    };
    const first = service.recordLocalAuthMutationResult(input);
    const second = service.recordLocalAuthMutationResult({ ...input, recovered: true, now: '2026-07-11T19:03:00.000Z' });
    assert.equal(second.id, first.id);
    assert.equal(second.streamChecksum, first.streamChecksum);
    const stream = service.getRuntimeSecurityAuditStream();
    assert.equal(stream.rows.filter((row) => row.authentication?.transactionId === input.transactionId).length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
