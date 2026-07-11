import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

const headers = { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'artifact-security-admin' };

test('exposes restart-safe canonical inventory and legal holds through the private API', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-artifact-storage-api-'));
  const filePath = join(directory, 'projects.json');
  const runtimeRoot = join(directory, 'runtime');
  const workspacePath = join(directory, 'workspace');
  mkdirSync(workspacePath);
  try {
    const project = {
      id: 'artifact_storage_api_project', name: 'Artifact Storage', localRuntime: { workspacePath },
      team: [{ id: 'author', name: 'Author', role: 'Writer' }, { id: 'reviewer', name: 'Reviewer', role: 'Reviewer' }],
    };
    let store = createAgentProjectFileStore({ filePath, projects: [project], replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let runtime = createLocalProjectRuntime({ rootPath: runtimeRoot, artifactRetentionDays: 1 });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store, projectRuntime: runtime }) });
    const call = (method, path, body = {}) => api.handleAsync({ method, path, headers, body });
    let response = await call('POST', `/projects/${project.id}/agents/author/submissions`, {
      artifactType: 'product-brief', reviewerAgentId: 'reviewer', title: 'Stored brief', summary: 'Canonical local artifact.', body: 'PRIVATE STORED ARTIFACT',
      includeReadModels: false, now: '2026-07-11T21:00:00.000Z',
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const contentSha256 = response.body.submission.artifactStorageProof.contentAddress.split(':')[1];
    response = await call('GET', `/projects/${project.id}/local-artifact-storage`, { now: '2026-07-13T21:00:00.000Z' });
    assert.equal(response.status, 200);
    assert.equal(response.body.localArtifactStorage.integrity.valid, true);
    assert.equal(response.body.localArtifactStorage.summary.deletionEligibleContentCount, 1);
    response = await call('POST', `/projects/${project.id}/local-artifact-storage/legal-holds`, { contentSha256, reason: 'Active review hold.', actorId: 'caller-override', now: '2026-07-13T21:01:00.000Z' });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.artifactLegalHold.actorId, 'artifact-security-admin');
    const holdId = response.body.artifactLegalHold.holdId;
    assert.equal(response.body.localArtifactStorage.summary.deletionEligibleContentCount, 0);

    store = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    runtime = createLocalProjectRuntime({ rootPath: runtimeRoot, artifactRetentionDays: 1 });
    api = createAgentProjectApi({ service: createAgentProjectService({ store, projectRuntime: runtime }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/local-artifact-storage`, headers, body: { now: '2026-07-13T21:02:00.000Z' } });
    assert.equal(response.body.localArtifactStorage.summary.activeLegalHoldCount, 1);
    response = await api.handleAsync({ method: 'POST', path: `/projects/${project.id}/local-artifact-storage/legal-holds/${holdId}/release`, headers, body: { now: '2026-07-13T21:03:00.000Z' } });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.localArtifactStorage.summary.activeLegalHoldCount, 0);
    const canonicalPath = join(runtimeRoot, project.id, 'artifacts', '.versions', contentSha256.slice(0, 2), contentSha256);
    writeFileSync(canonicalPath, 'tampered');
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/local-artifact-storage`, headers, body: { now: '2026-07-13T21:04:00.000Z' } });
    assert.equal(response.body.localArtifactStorage.integrity.valid, false);
    assert.equal(response.body.localArtifactStorage.status, 'degraded-integrity-invalid');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps artifact inventory and legal hold controls private', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/local-artifact-storage' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/local-artifact-storage/legal-holds' }).allowedRoles, ['manager', 'security-admin']);
});
