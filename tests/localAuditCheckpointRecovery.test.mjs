import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { classifyAccessRequest } from '../src/agents/accessControl.js';

function accessDecision(projectId, routeKey) {
  return {
    allowed: true, status: 'allowed', enforced: true, mode: 'enforced',
    route: { routeKey, capability: 'Audit checkpoint fixture', sensitivity: 'project-data', projectId },
    actor: { role: 'security-admin', userId: 'audit-admin' },
  };
}

test('checkpoints independently verified runtime and project audit chains into immutable archives', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-audit-checkpoint-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, projects: [{ id: 'p1' }, { id: 'p2' }], replaceWithSeed: true });
    const service = createAgentProjectService({ store });
    service.recordLocalAuthMutationResult({ transactionId: 'runtime-tx-1', operation: 'login', outcome: 'login-success', subjectHash: 'a'.repeat(64), actorUserId: 'audit-admin', now: '2026-07-11T22:00:00.000Z' });
    service.recordAccessDecision({ projectId: 'p1', decision: accessDecision('p1', 'p1-read'), method: 'GET', path: '/projects/p1', now: '2026-07-11T22:00:01.000Z' });
    service.recordAccessDecision({ projectId: 'p2', decision: accessDecision('p2', 'p2-read'), method: 'GET', path: '/projects/p2', now: '2026-07-11T22:00:02.000Z' });
    service.recordAccessDecision({ projectId: 'p1', decision: accessDecision('p1', 'p1-events'), method: 'GET', path: '/projects/p1/events', now: '2026-07-11T22:00:03.000Z' });

    const first = store.createSecurityAuditCheckpoint({ now: '2026-07-11T22:01:00.000Z', retentionDays: 365 });
    assert.equal(first.schemaVersion, 'local-security-audit-checkpoint/v1');
    assert.equal(first.status, 'committed');
    assert.equal(first.recordCount, 4);
    assert.equal(first.scopeRoots['local-runtime'].recordCount, 1);
    assert.equal(first.scopeRoots.p1.recordCount, 2);
    assert.equal(first.scopeRoots.p2.recordCount, 1);
    assert.equal(first.previousCheckpointHash, '0'.repeat(64));
    assert.equal(first.retainUntil, '2027-07-11T22:01:00.000Z');
    assert.equal(existsSync(first.archivePath), true);
    assert.equal(readFileSync(first.archivePath, 'utf8').trim().split(/\r?\n/).length, 4);
    const firstArchive = readFileSync(first.archivePath, 'utf8');
    const firstReplay = store.createSecurityAuditCheckpoint({ now: '2026-07-11T22:01:00.000Z', retentionDays: 365 });
    assert.equal(firstReplay.id, first.id);
    assert.equal(firstReplay.checkpointHash, first.checkpointHash);
    assert.equal(firstReplay.idempotent, true);

    service.recordLocalAuthMutationResult({ transactionId: 'runtime-tx-2', operation: 'logout', outcome: 'logout-success', subjectHash: 'a'.repeat(64), actorUserId: 'audit-admin', now: '2026-07-11T22:02:00.000Z' });
    const second = store.createSecurityAuditCheckpoint({ now: '2026-07-11T22:03:00.000Z', retentionDays: 365 });
    assert.equal(second.previousCheckpointHash, first.checkpointHash);
    assert.equal(second.recordCount, 5);
    assert.equal(readFileSync(first.archivePath, 'utf8'), firstArchive);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('dry-runs and executes checkpoint recovery without dropping valid post-checkpoint snapshot records', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-audit-recovery-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, projects: [{ id: 'p1' }], replaceWithSeed: true });
    const service = createAgentProjectService({ store });
    service.recordAccessDecision({ projectId: 'p1', decision: accessDecision('p1', 'first'), method: 'GET', path: '/first', now: '2026-07-11T22:10:00.000Z' });
    const checkpoint = store.createSecurityAuditCheckpoint({ now: '2026-07-11T22:11:00.000Z' });
    service.recordAccessDecision({ projectId: 'p1', decision: accessDecision('p1', 'after-checkpoint'), method: 'GET', path: '/after', now: '2026-07-11T22:12:00.000Z' });
    const validLog = readFileSync(store.securityAuditLogPath, 'utf8');
    writeFileSync(store.securityAuditLogPath, `${validLog.split(/\r?\n/)[0]}\n{malformed\n`);
    const damagedBytes = readFileSync(store.securityAuditLogPath, 'utf8');

    const dryRun = store.recoverSecurityAuditLog({ expectedCheckpointId: checkpoint.id, operationId: 'recovery-op-1', execute: false, now: '2026-07-11T22:13:00.000Z' });
    assert.equal(dryRun.status, 'ready-to-recover');
    assert.equal(dryRun.execute, false);
    assert.equal(dryRun.rebuiltRecordCount, 2);
    assert.equal(readFileSync(store.securityAuditLogPath, 'utf8'), damagedBytes);
    const recovered = store.recoverSecurityAuditLog({ expectedCheckpointId: checkpoint.id, operationId: 'recovery-op-1', execute: true, now: '2026-07-11T22:13:00.000Z' });
    assert.equal(recovered.status, 'recovered');
    assert.equal(recovered.rebuiltRecordCount, 2);
    assert.equal(recovered.rebuiltVerified, true);
    assert.equal(existsSync(recovered.quarantinePath), true);
    assert.equal(readFileSync(recovered.quarantinePath, 'utf8'), damagedBytes);
    assert.equal(store.securityAuditLogIntegrity().status, 'ready');
    const restarted = createAgentProjectFileStore({ filePath });
    assert.equal(restarted.listSecurityAuditRecords('p1').length, 2);
    const replay = restarted.recoverSecurityAuditLog({ expectedCheckpointId: checkpoint.id, operationId: 'recovery-op-1', execute: true, now: '2026-07-11T22:14:00.000Z' });
    assert.equal(replay.id, recovered.id);
    assert.equal(replay.idempotent, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects wrong checkpoint ids and tampered checkpoint archives before recovery', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-audit-recovery-tamper-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, projects: [{ id: 'p1' }], replaceWithSeed: true });
    const service = createAgentProjectService({ store });
    service.recordAccessDecision({ projectId: 'p1', decision: accessDecision('p1', 'first'), method: 'GET', path: '/first' });
    const checkpoint = store.createSecurityAuditCheckpoint({ now: '2026-07-11T22:20:00.000Z' });
    assert.throws(() => store.recoverSecurityAuditLog({ expectedCheckpointId: 'wrong', operationId: 'operation', execute: false }), /checkpoint-not-found/);
    appendFileSync(checkpoint.archivePath, '{tampered}\n');
    assert.throws(() => store.recoverSecurityAuditLog({ expectedCheckpointId: checkpoint.id, operationId: 'operation', execute: false }), /checkpoint-archive-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('governs checkpoint recovery through a private API and audits the verified recovery actor', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-audit-recovery-api-'));
  const filePath = join(directory, 'projects.json');
  const headers = { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'real-security-admin' };
  try {
    let store = createAgentProjectFileStore({ filePath, projects: [{ id: 'p1' }], replaceWithSeed: true });
    let service = createAgentProjectService({ store });
    service.recordAccessDecision({ projectId: 'p1', decision: accessDecision('p1', 'fixture'), method: 'GET', path: '/fixture' });
    let api = createAgentProjectApi({ service });
    let response = await api.handleAsync({ method: 'POST', path: '/security-audit-checkpoints', headers, body: { now: '2026-07-11T22:30:00.000Z' } });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const checkpointId = response.body.securityAuditCheckpoint.id;
    appendFileSync(store.securityAuditLogPath, '{malformed\n');
    response = await api.handleAsync({ method: 'GET', path: '/security-audit-integrity', headers, body: { now: '2026-07-11T22:31:00.000Z' } });
    assert.equal(response.body.localAuditIntegrity.status, 'recovery-available');
    response = await api.handleAsync({ method: 'POST', path: '/security-audit-recovery', headers, body: { expectedCheckpointId: checkpointId, operationId: 'api-recovery-1', execute: false, actorId: 'caller-override', now: '2026-07-11T22:32:00.000Z' } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.securityAuditRecovery.execute, false);
    response = await api.handleAsync({ method: 'POST', path: '/security-audit-recovery', headers, body: { expectedCheckpointId: checkpointId, operationId: 'api-recovery-1', execute: true, actorId: 'caller-override', now: '2026-07-11T22:33:00.000Z' } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(response.body.recoveryAuditRecordId);
    assert.equal(response.body.localAuditIntegrity.status, 'ready');

    store = createAgentProjectFileStore({ filePath });
    service = createAgentProjectService({ store });
    api = createAgentProjectApi({ service });
    response = await api.handleAsync({ method: 'GET', path: '/security-audit-integrity', headers });
    assert.equal(response.body.localAuditIntegrity.lastRecovery.operationId, 'api-recovery-1');
    const recoveryAudit = service.getRuntimeSecurityAuditStream().rows.find((row) => row.auditRecovery?.operationId === 'api-recovery-1');
    assert.equal(recoveryAudit.auditRecovery.actorId, 'real-security-admin');
    assert.equal(recoveryAudit.auditRecovery.checkpointId, checkpointId);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('restricts cross-project audit integrity controls to security administrators', () => {
  for (const path of ['/security-audit-integrity', '/security-audit-checkpoints', '/security-audit-recovery']) {
    assert.deepEqual(classifyAccessRequest({ method: path === '/security-audit-integrity' ? 'GET' : 'POST', path }).allowedRoles, ['security-admin']);
  }
});
