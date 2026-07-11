import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';
import {
  buildLocalProjectSharedMemory,
  createLocalProjectMemoryEntry,
  createLocalProjectMemoryRevocation,
  verifyLocalProjectMemoryEntry,
  verifyLocalProjectMemoryRevocation,
} from '../src/agents/localProjectSharedMemory.js';

const base = {
  projectId: 'shared_memory_project',
  memoryKey: 'release.rollback-required',
  kind: 'constraint',
  content: 'Release requires a verified rollback plan before approval.',
  citations: [{ sourceType: 'task', sourceId: 'rollback-plan', sourceChecksum: 'a'.repeat(64) }],
  confidence: 0.95,
  confidenceBasis: 'verified',
  expiresAt: '2026-08-10T12:00:00.000Z',
  accessScope: { visibility: 'agents', agentIds: ['delivery-lead'] },
  actorId: 'manager-one',
  now: '2026-07-10T12:00:00.000Z',
};

test('creates scoped, cited, expiring and immutable versioned project memories', () => {
  const first = createLocalProjectMemoryEntry({
    ...base,
    version: 1,
    idempotencyKey: 'memory-create-1',
  });
  assert.equal(first.schemaVersion, 'local-project-memory-entry/v1');
  assert.equal(verifyLocalProjectMemoryEntry(first).valid, true);
  assert.equal(first.storesRawContent, true);
  assert.equal(first.contentChecksum.length, 64);

  const hidden = buildLocalProjectSharedMemory({
    project: { id: base.projectId, localProjectMemoryEntries: [first] },
    actor: { role: 'agent', agentId: 'other-agent' },
    now: '2026-07-10T13:00:00.000Z',
  });
  assert.equal(hidden.rows.length, 0);
  assert.equal(hidden.summary.hiddenCount, 1);

  const visible = buildLocalProjectSharedMemory({
    project: { id: base.projectId, localProjectMemoryEntries: [first] },
    actor: { role: 'agent', agentId: 'delivery-lead' },
    now: '2026-07-10T13:00:00.000Z',
  });
  assert.equal(visible.rows[0].content, base.content);
  assert.equal(visible.rows[0].status, 'active');
  assert.equal(visible.rows[0].usableForAutonomy, true);

  const second = createLocalProjectMemoryEntry({
    ...base,
    content: 'Release requires a rollback plan and restore drill before approval.',
    version: 2,
    previousVersionId: first.id,
    previousVersionChecksum: first.checksum,
    idempotencyKey: 'memory-revise-1',
    now: '2026-07-11T12:00:00.000Z',
  });
  assert.equal(verifyLocalProjectMemoryEntry(second, first).valid, true);
  const versioned = buildLocalProjectSharedMemory({
    project: { id: base.projectId, localProjectMemoryEntries: [second, first] },
    actor: { role: 'manager' },
    now: '2026-07-11T13:00:00.000Z',
    includeHistory: true,
  });
  assert.equal(versioned.rows.find((row) => row.id === second.id).status, 'active');
  assert.equal(versioned.rows.find((row) => row.id === first.id).status, 'superseded');
  assert.equal(versioned.summary.versionCount, 2);

  const competingSecond = createLocalProjectMemoryEntry({
    ...base,
    content: 'A competing second version must not coexist silently.',
    version: 2,
    previousVersionId: first.id,
    previousVersionChecksum: first.checksum,
    idempotencyKey: 'memory-revise-competing',
    now: '2026-07-11T12:01:00.000Z',
  });
  const conflicted = buildLocalProjectSharedMemory({
    project: { id: base.projectId, localProjectMemoryEntries: [competingSecond, second, first] },
    actor: { role: 'manager' },
    now: '2026-07-11T13:00:00.000Z',
    includeHistory: true,
  });
  assert.equal(conflicted.integrity.valid, false);
  assert.deepEqual(conflicted.integrity.conflictMemoryKeys, [base.memoryKey]);
  assert.equal(conflicted.status, 'degraded-integrity-invalid');
});

test('derives expiry and revocation, and fails closed on receipt tampering', () => {
  const entry = createLocalProjectMemoryEntry({ ...base, version: 1, idempotencyKey: 'memory-create-2' });
  const expired = buildLocalProjectSharedMemory({
    project: { id: base.projectId, localProjectMemoryEntries: [entry] },
    actor: { role: 'manager' },
    now: '2026-08-11T12:00:00.000Z',
    includeHistory: true,
  });
  assert.equal(expired.rows[0].status, 'expired');
  assert.equal(expired.rows[0].usableForAutonomy, false);

  const revocation = createLocalProjectMemoryRevocation({
    projectId: base.projectId,
    memoryId: entry.id,
    memoryChecksum: entry.checksum,
    reasonCode: 'source-invalidated',
    actorId: 'manager-one',
    idempotencyKey: 'memory-revoke-1',
    now: '2026-07-12T12:00:00.000Z',
  });
  assert.equal(verifyLocalProjectMemoryRevocation(revocation, entry).valid, true);
  const revoked = buildLocalProjectSharedMemory({
    project: {
      id: base.projectId,
      localProjectMemoryEntries: [entry],
      localProjectMemoryRevocations: [revocation],
    },
    actor: { role: 'manager' },
    now: '2026-07-13T12:00:00.000Z',
    includeHistory: true,
  });
  assert.equal(revoked.rows[0].status, 'revoked');

  const tampered = structuredClone(entry);
  tampered.confidence = 0.1;
  const invalid = buildLocalProjectSharedMemory({
    project: { id: base.projectId, localProjectMemoryEntries: [tampered] },
    actor: { role: 'manager' },
    now: '2026-07-13T12:00:00.000Z',
    includeHistory: true,
  });
  assert.equal(invalid.integrity.valid, false);
  assert.equal(invalid.status, 'degraded-integrity-invalid');
});

test('classifies shared-memory reads separately from governance writes', () => {
  const read = classifyAccessRequest({ method: 'GET', path: '/projects/project-1/shared-memories' });
  const create = classifyAccessRequest({ method: 'POST', path: '/projects/project-1/shared-memories' });
  assert.equal(read.allowedRoles.includes('observer'), true);
  assert.equal(read.allowedRoles.includes('agent'), true);
  assert.deepEqual(create.allowedRoles, ['manager', 'security-admin']);
});

test('persists cited scoped memories, rejects stale revisions, and proves revoke/tamper state after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-project-shared-memory-'));
  const filePath = join(directory, 'projects.json');
  try {
    const kickoff = createKickoffProjectFromMeeting({
      projectId: 'shared_memory_api_project',
      name: 'Shared Memory API Project',
      brief: 'Build a locally governed team memory.',
      team: [
        { id: 'delivery-lead', name: 'Delivery Lead' },
        { id: 'other-agent', name: 'Other Agent' },
        { id: 'reviewer', name: 'Reviewer' },
      ],
      now: '2026-07-10T10:00:00.000Z',
    });
    kickoff.project.tasks = [{ id: 'rollback-plan', text: 'Private task body', status: 'pending', assignee: 'delivery-lead', reviewerId: 'reviewer' }];
    const store = createAgentProjectFileStore({
      filePath,
      projects: [kickoff.project],
      messages: kickoff.messages,
      replaceWithSeed: true,
      hydrateProject: hydrateAgentProject,
    });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    const createBody = {
      memoryKey: 'release.rollback-required',
      kind: 'constraint',
      content: 'Release requires rollback evidence before approval.',
      citations: [{ sourceType: 'task', sourceId: 'rollback-plan' }],
      confidence: 0.95,
      confidenceBasis: 'verified',
      expiresAt: '2026-08-10T12:00:00.000Z',
      accessScope: { visibility: 'agents', agentIds: ['delivery-lead'] },
      idempotencyKey: 'api-memory-create-1',
      now: '2026-07-10T12:00:00.000Z',
    };
    let response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' }, body: createBody,
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const first = response.body.memory;
    assert.equal(first.citations[0].sourceChecksum.length, 64);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: { ...createBody, now: '2026-07-10T12:01:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: { ...createBody, content: 'Different content under the same idempotency key.', now: '2026-07-10T12:02:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /idempotency-conflict/);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: { ...createBody, idempotencyKey: 'api-memory-duplicate-key', now: '2026-07-10T12:03:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /key-already-exists/);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: { ...createBody, memoryKey: 'unknown.source', citations: [{ sourceType: 'task', sourceId: 'missing-task' }], idempotencyKey: 'api-memory-missing-source' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /citation-not-found/);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: { ...createBody, memoryKey: 'unsafe.secret', content: 'Use api key sk-secret-1234567890 for release.', idempotencyKey: 'api-memory-secret' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /sensitive-content-rejected/);

    response = await api.handleAsync({
      method: 'GET', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'agent', 'x-hofs-agent-id': 'other-agent' },
      body: { now: '2026-07-10T13:00:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.sharedMemory.rows.length, 0);
    assert.equal(response.body.sharedMemory.summary.hiddenCount, 1);

    response = await api.handleAsync({
      method: 'GET', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'agent', 'x-hofs-agent-id': 'delivery-lead' },
      body: { now: '2026-07-10T13:00:00.000Z' },
    });
    assert.equal(response.body.sharedMemory.rows[0].content, createBody.content);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories/${first.id}/revisions`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: {
        content: 'Release requires rollback evidence plus a restore drill before approval.',
        citations: createBody.citations,
        confidence: 0.98,
        confidenceBasis: 'verified',
        expiresAt: '2026-08-11T12:00:00.000Z',
        accessScope: createBody.accessScope,
        expectedPreviousChecksum: 'f'.repeat(64),
        idempotencyKey: 'api-memory-revise-stale',
        now: '2026-07-11T12:00:00.000Z',
      },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || response.body.error || '', /stale-version/);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories/${first.id}/revisions`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: {
        content: 'Release requires rollback evidence plus a restore drill before approval.',
        citations: createBody.citations,
        confidence: 0.98,
        confidenceBasis: 'verified',
        expiresAt: '2026-08-11T12:00:00.000Z',
        accessScope: createBody.accessScope,
        expectedPreviousChecksum: first.checksum,
        idempotencyKey: 'api-memory-revise-1',
        now: '2026-07-11T12:00:00.000Z',
      },
    });
    assert.equal(response.status, 201);
    const second = response.body.memory;
    assert.equal(second.version, 2);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories/${first.id}/revisions`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: {
        content: 'Conflicting revision content.', citations: createBody.citations, confidence: 0.98,
        confidenceBasis: 'verified', expiresAt: '2026-08-11T12:00:00.000Z', accessScope: createBody.accessScope,
        expectedPreviousChecksum: first.checksum, idempotencyKey: 'api-memory-revise-1', now: '2026-07-11T12:01:00.000Z',
      },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /idempotency-conflict/);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories/${second.id}/revoke`,
      headers: { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'security-one' },
      body: { reasonCode: 'source-invalidated', idempotencyKey: 'api-memory-revoke-1', now: '2026-07-12T12:00:00.000Z' },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.memory.status, 'revoked');
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories/${second.id}/revoke`,
      headers: { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'security-one' },
      body: { reasonCode: 'different-reason', idempotencyKey: 'api-memory-revoke-1', now: '2026-07-12T12:01:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /idempotency-conflict/);

    api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    response = await api.handleAsync({
      method: 'GET', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: { includeHistory: true, now: '2026-07-13T12:00:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.sharedMemory.summary.versionCount, 2);
    assert.equal(response.body.sharedMemory.summary.revokedCount, 1);
    assert.equal(response.body.sharedMemory.integrity.valid, true);

    response = await api.handleAsync({
      method: 'GET', path: `/projects/${kickoff.project.id}/memory-readiness`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: { now: '2026-07-13T12:00:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.projectMemoryReadiness.schemaVersion, 'project-memory-readiness/v1');
    assert.equal(response.body.projectMemoryReadiness.summary.sharedMemoryVersionCount, 2);
    assert.equal(response.body.projectMemoryReadiness.relatedReadiness.sharedMemoryIntegrityValid, true);
    assert.equal(response.body.projectMemoryReadiness.backendRoutes.sharedMemories, `/projects/${kickoff.project.id}/shared-memories`);

    const tampered = store.getProject(kickoff.project.id);
    tampered.localProjectMemoryEntries[0].confidence = 0.1;
    store.saveProject(tampered);
    api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    response = await api.handleAsync({
      method: 'GET', path: `/projects/${kickoff.project.id}/shared-memories`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: { includeHistory: true, now: '2026-07-13T13:00:00.000Z' },
    });
    assert.equal(response.body.sharedMemory.status, 'degraded-integrity-invalid');
    assert.equal(response.body.sharedMemory.integrity.valid, false);
    response = await api.handleAsync({
      method: 'GET', path: `/projects/${kickoff.project.id}/memory-readiness`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' },
      body: { now: '2026-07-13T13:00:00.000Z' },
    });
    assert.equal(response.body.projectMemoryReadiness.relatedReadiness.sharedMemoryIntegrityValid, false);
    assert.equal(response.body.projectMemoryReadiness.readyForLocalMvp, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
