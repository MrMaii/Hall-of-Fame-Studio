import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { appendProjectEvents, createProjectLedgerEvent, verifyProjectEventLedger } from '../src/agents/agentRuntime.js';

const projectId = 'local_event_recovery_project';
const securityHeaders = { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'verified-event-admin' };

function event(id, time) {
  return createProjectLedgerEvent({ id, type: 'fixture-event', time, actor: 'fixture-runtime', summary: id, source: 'fixture' });
}

function fixture(directory) {
  const filePath = join(directory, 'projects.json');
  const project = appendProjectEvents({ id: projectId, name: 'Event recovery fixture' }, [
    event('evt_checkpoint_1', '2026-07-11T23:00:00.000Z'),
    event('evt_checkpoint_2', '2026-07-11T23:00:01.000Z'),
  ]);
  const store = createAgentProjectFileStore({ filePath, projects: [project], replaceWithSeed: true, hydrateProject: hydrateAgentProject });
  const service = createAgentProjectService({ store });
  return { filePath, store, service, api: createAgentProjectApi({ service }) };
}

test('recovers from a verified checkpoint, preserves the valid linked tail, quarantines corruption, and resumes once after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-event-recovery-'));
  try {
    let current = fixture(directory);
    let response = await current.api.handleAsync({
      method: 'POST', path: `/projects/${projectId}/event-recovery/checkpoints`, headers: securityHeaders,
      body: { actorId: 'spoofed-admin', now: '2026-07-11T23:01:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const checkpointId = response.body.eventCheckpoint.id;
    assert.ok(response.body.eventCheckpoint.retainedCount >= 2);
    assert.equal(JSON.stringify(response.body.eventCheckpoint).includes('eventLedger'), false);

    const extended = appendProjectEvents(current.store.getProject(projectId), [
      event('evt_valid_after_checkpoint', '2026-07-11T23:02:00.000Z'),
      event('evt_corrupt_after_checkpoint', '2026-07-11T23:02:01.000Z'),
    ]);
    const corrupted = structuredClone(extended);
    corrupted.eventLedger.at(-1).summary = 'mutated on disk';
    current.store.saveProject(corrupted);
    assert.equal(verifyProjectEventLedger(current.store.getProject(projectId)).valid, false);

    response = await current.api.handleAsync({ method: 'GET', path: `/projects/${projectId}/event-recovery`, headers: securityHeaders });
    assert.equal(response.status, 200);
    assert.equal(response.body.eventRecovery.status, 'recovery-available');
    response = await current.api.handleAsync({
      method: 'POST', path: `/projects/${projectId}/event-recovery/restore`, headers: securityHeaders,
      body: { checkpointId, operationId: 'event-recovery-op-1', execute: false, actorId: 'spoofed-admin', now: '2026-07-11T23:03:00.000Z' },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.eventRecoveryPlan.validPostCheckpointCount, 1);
    assert.equal(response.body.eventRecoveryPlan.discardedEventCount, 1);
    assert.equal(verifyProjectEventLedger(current.store.getProject(projectId)).valid, false);

    response = await current.api.handleAsync({
      method: 'POST', path: `/projects/${projectId}/event-recovery/restore`, headers: securityHeaders,
      body: { checkpointId, operationId: 'event-recovery-op-1', execute: true, actorId: 'spoofed-admin', now: '2026-07-11T23:04:00.000Z' },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.eventRecoveryReceipt.actorId, 'verified-event-admin');
    assert.equal(response.body.eventRecoveryReceipt.validPostCheckpointCount, 1);
    assert.equal(response.body.eventRecoveryReceipt.discardedEventCount, 1);
    assert.equal(response.body.eventRecoveryReceipt.rebuiltVerified, true);
    assert.equal(JSON.stringify(response.body).includes('mutated on disk'), false);
    let recoveredProject = current.store.getProject(projectId);
    assert.equal(verifyProjectEventLedger(recoveredProject).valid, true);
    assert.ok(recoveredProject.eventLedger.some((row) => row.id === 'evt_valid_after_checkpoint'));
    assert.equal(recoveredProject.eventLedger.some((row) => row.id === 'evt_corrupt_after_checkpoint'), false);
    assert.equal(recoveredProject.eventLedger.filter((row) => row.type === 'local-event-ledger-recovered').length, 1);
    const quarantine = current.store.getProjectEventRecoveryQuarantine(projectId, 'event-recovery-op-1');
    assert.equal(quarantine.eventSnapshot.eventLedger.at(-1).summary, 'mutated on disk');
    assert.match(quarantine.checksum, /^[a-f0-9]{64}$/);

    const restartedStore = createAgentProjectFileStore({ filePath: current.filePath, hydrateProject: hydrateAgentProject });
    const restartedService = createAgentProjectService({ store: restartedStore });
    const restartedApi = createAgentProjectApi({ service: restartedService });
    response = await restartedApi.handleAsync({
      method: 'POST', path: `/projects/${projectId}/event-recovery/restore`, headers: securityHeaders,
      body: { checkpointId, operationId: 'event-recovery-op-1', execute: true, now: '2026-07-11T23:05:00.000Z' },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.eventRecoveryReceipt.idempotent, true);
    recoveredProject = restartedStore.getProject(projectId);
    assert.equal(recoveredProject.eventLedger.filter((row) => row.type === 'local-event-ledger-recovered').length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fails closed for missing or tampered checkpoints and applies project recovery roles', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-event-recovery-tamper-'));
  try {
    const current = fixture(directory);
    let response = await current.api.handleAsync({ method: 'POST', path: `/projects/${projectId}/event-recovery/checkpoints`, headers: securityHeaders, body: {} });
    assert.equal(response.status, 201);
    const checkpointId = response.body.eventCheckpoint.id;
    response = await current.api.handleAsync({
      method: 'POST', path: `/projects/${projectId}/event-recovery/restore`, headers: securityHeaders,
      body: { checkpointId: 'event_checkpoint_aaaaaaaaaaaaaaaaaaaaaaaa', operationId: 'missing-checkpoint', execute: false },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || response.body.error || '', /checkpoint-not-found/);

    const checkpointRoot = `${current.filePath}.event-checkpoints`;
    const projectDirectory = join(checkpointRoot, readdirSync(checkpointRoot)[0]);
    const checkpointPath = join(projectDirectory, readdirSync(projectDirectory)[0]);
    const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    checkpoint.eventSnapshot.eventLedger[0].summary = 'tampered checkpoint';
    writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    response = await current.api.handleAsync({ method: 'GET', path: `/projects/${projectId}/event-recovery`, headers: securityHeaders });
    assert.equal(response.status, 400);
    assert.match(response.body.message || response.body.error || '', /checkpoint-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: `/projects/${projectId}/event-recovery` }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: `/projects/${projectId}/event-recovery/checkpoints` }).allowedRoles, ['security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: `/projects/${projectId}/event-recovery/restore` }).allowedRoles, ['security-admin']);
});

test('resumes after the rebuilt project is saved but before the recovery receipt is committed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-event-recovery-crash-'));
  try {
    const current = fixture(directory);
    const checkpoint = current.service.createLocalEventCheckpoint({ projectId, actorId: 'event-admin', now: '2026-07-11T23:10:00.000Z' }).eventCheckpoint;
    const extended = appendProjectEvents(current.store.getProject(projectId), [
      event('evt_crash_valid_tail', '2026-07-11T23:11:00.000Z'),
      event('evt_crash_corrupt_tail', '2026-07-11T23:11:01.000Z'),
    ]);
    extended.eventLedger.at(-1).summary = 'corrupted before crash recovery';
    current.store.saveProject(extended);

    const writeReceipt = current.store.writeProjectEventRecoveryReceipt;
    current.store.writeProjectEventRecoveryReceipt = () => { throw new Error('simulated-receipt-write-crash'); };
    assert.throws(() => current.service.recoverLocalEventLedger({
      projectId, checkpointId: checkpoint.id, operationId: 'crash-after-rebuild', execute: true,
      actorId: 'event-admin', now: '2026-07-11T23:12:00.000Z',
    }), /simulated-receipt-write-crash/);
    assert.equal(verifyProjectEventLedger(current.store.getProject(projectId)).valid, true);
    current.store.writeProjectEventRecoveryReceipt = writeReceipt;

    const resumed = current.service.recoverLocalEventLedger({
      projectId, checkpointId: checkpoint.id, operationId: 'crash-after-rebuild', execute: true,
      actorId: 'event-admin', now: '2026-07-11T23:13:00.000Z',
    });
    assert.equal(resumed.eventRecoveryReceipt.status, 'recovered');
    assert.equal(resumed.eventRecoveryReceipt.validPostCheckpointCount, 1);
    assert.equal(current.store.getProject(projectId).eventLedger.filter((row) => row.type === 'local-event-ledger-recovered').length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
