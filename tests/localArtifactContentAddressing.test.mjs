import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { submitAgentArtifact } from '../src/agents/agentProjectService.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

test('keeps immutable content-addressed versions when a local artifact path is overwritten', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-artifact-addressing-'));
  try {
    const runtime = createLocalProjectRuntime({ rootPath: join(directory, 'runtime') });
    const project = { id: 'artifact-addressing-project' };
    const first = runtime.writeArtifact({
      id: 'brief',
      relativePath: 'brief.md',
      content: 'version one',
    }, { project });
    const second = runtime.writeArtifact({
      id: 'brief',
      relativePath: 'brief.md',
      content: 'version two',
    }, { project });

    assert.equal(first.contentAddress, 'sha256:197c7c60ef8a8470a38d1a9212bdfde9cfe6fd4be910825fe6ac7880ac765d16');
    assert.equal(readFileSync(first.immutableAbsolutePath, 'utf8'), 'version one');
    assert.equal(readFileSync(second.immutableAbsolutePath, 'utf8'), 'version two');
    assert.equal(readFileSync(second.absolutePath, 'utf8'), 'version two');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('records local immutable provenance in the agent submission storage proof', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-artifact-submission-'));
  try {
    const runtime = createLocalProjectRuntime({ rootPath: join(directory, 'runtime') });
    const project = {
      id: 'artifact-submission-project',
      team: [
        { id: 'author', name: 'Author Agent', role: 'Writer' },
        { id: 'reviewer', name: 'Reviewer Agent', role: 'Reviewer' },
      ],
    };
    const result = submitAgentArtifact({
      project,
      agentId: 'author',
      artifactType: 'product-brief',
      title: 'Immutable local proof',
      body: 'final submission',
      now: '2026-07-10T16:00:00.000Z',
      artifactWriter: runtime.writeArtifact.bind(runtime),
    });
    const proof = result.artifact.storageProof;

    assert.equal(proof.contentAddress, 'sha256:40d4984c76927048a34c408e5c6867bd494035d55dca9279242e3fe834b0954d');
    assert.equal(existsSync(proof.immutablePath), true);
    assert.equal(readFileSync(proof.immutablePath, 'utf8'), result.submission.body);
    assert.equal(proof.immutableRelativePath.startsWith('.versions/'), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps the canonical artifact when a bound workspace projection is not writable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-artifact-projection-blocked-'));
  try {
    const workspacePath = join(directory, 'workspace');
    mkdirSync(workspacePath);
    const runtime = createLocalProjectRuntime({
      rootPath: join(directory, 'runtime'),
      workspaceProjectionWriteFile() {
        const error = new Error('workspace denied');
        error.code = 'EPERM';
        throw error;
      },
    });
    const written = runtime.writeArtifact({ id: 'report', relativePath: 'report.md', content: 'canonical report' }, {
      project: { id: 'projection-blocked-project', localRuntime: { workspacePath } },
    });

    assert.equal(readFileSync(written.absolutePath, 'utf8'), 'canonical report');
    assert.equal(readFileSync(written.immutableAbsolutePath, 'utf8'), 'canonical report');
    assert.equal(written.workspaceFile, null);
    assert.deepEqual(written.workspaceProjection, { status: 'blocked', errorCode: 'EPERM' });
    assert.equal(written.storageEvent.workspaceProjectionStatus, 'blocked');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('records a content-minimized retention inventory and rejects corrupt canonical reuse', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-artifact-inventory-'));
  try {
    const runtime = createLocalProjectRuntime({ rootPath: join(directory, 'runtime'), artifactRetentionDays: 30 });
    const project = { id: 'artifact-inventory-project' };
    const first = runtime.writeArtifact({ id: 'brief-1', relativePath: 'brief.md', content: 'PRIVATE ARTIFACT BODY' }, { project, now: '2026-07-11T20:00:00.000Z' });
    assert.equal(first.storageEvent.schemaVersion, 'local-artifact-storage-event/v1');
    assert.equal(first.storageEvent.sequence, 1);
    assert.equal(first.storageEvent.retentionClass, 'project-artifact-30d');
    assert.equal(first.storageEvent.retainUntil, '2026-08-10T20:00:00.000Z');
    assert.equal(JSON.stringify(first.storageEvent).includes('PRIVATE ARTIFACT BODY'), false);
    assert.match(first.storageEvent.eventHash, /^[a-f0-9]{64}$/);
    const second = runtime.writeArtifact({ id: 'brief-2', relativePath: 'brief-copy.md', content: 'PRIVATE ARTIFACT BODY' }, { project, now: '2026-07-11T20:01:00.000Z' });
    assert.equal(second.storageEvent.sequence, 2);
    assert.equal(second.storageEvent.previousEventHash, first.storageEvent.eventHash);
    assert.equal(second.immutableAbsolutePath, first.immutableAbsolutePath);
    const ledger = readFileSync(first.storageLedgerPath, 'utf8');
    assert.equal(ledger.includes('PRIVATE ARTIFACT BODY'), false);
    writeFileSync(first.immutableAbsolutePath, 'tampered canonical bytes');
    assert.throws(() => runtime.writeArtifact({ id: 'brief-3', content: 'PRIVATE ARTIFACT BODY' }, { project, now: '2026-07-11T20:02:00.000Z' }), /artifact-canonical-integrity-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('audits canonical integrity separately from mutable workspace drift and retention eligibility', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-artifact-audit-'));
  try {
    const workspacePath = join(directory, 'workspace');
    mkdirSync(workspacePath);
    const runtime = createLocalProjectRuntime({ rootPath: join(directory, 'runtime'), artifactRetentionDays: 1 });
    const project = { id: 'artifact-audit-project', localRuntime: { workspacePath } };
    const written = runtime.writeArtifact({ id: 'report', relativePath: 'report.md', content: 'canonical report' }, { project, now: '2026-07-11T20:10:00.000Z' });
    writeFileSync(written.workspaceAbsolutePath, 'locally edited projection');
    const inventory = runtime.auditArtifactStore(project, { now: '2026-07-13T20:10:00.000Z' });
    assert.equal(inventory.integrity.valid, true);
    assert.equal(inventory.status, 'ready-with-projection-drift');
    assert.equal(inventory.summary.canonicalContentCount, 1);
    assert.equal(inventory.summary.expiredContentCount, 1);
    assert.equal(inventory.summary.deletionEligibleContentCount, 1);
    assert.deepEqual(inventory.projectionFindings.map((row) => row.code), ['workspace-projection-drift']);
    assert.equal(readFileSync(written.immutableAbsolutePath, 'utf8'), 'canonical report');
    writeFileSync(written.immutableAbsolutePath, 'corrupt canonical report');
    const degraded = runtime.auditArtifactStore(project, { now: '2026-07-13T20:10:00.000Z' });
    assert.equal(degraded.integrity.valid, false);
    assert.equal(degraded.status, 'degraded-integrity-invalid');
    assert.deepEqual(degraded.integrityFindings.map((row) => row.code), ['canonical-checksum-mismatch']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('places and releases an actor-attributed content-minimized legal hold', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-artifact-hold-'));
  try {
    const runtime = createLocalProjectRuntime({ rootPath: join(directory, 'runtime'), artifactRetentionDays: 1 });
    const project = { id: 'artifact-hold-project' };
    const written = runtime.writeArtifact({ id: 'evidence', content: 'evidence bytes' }, { project, agentId: 'author', now: '2026-07-11T20:20:00.000Z' });
    const hold = runtime.placeArtifactLegalHold(project, { contentSha256: written.contentSha256, reason: 'Preserve for an active local review.', actorId: 'security-admin', now: '2026-07-12T20:20:00.000Z' });
    assert.equal(hold.eventType, 'legal-hold-placed');
    assert.equal(hold.reason, undefined);
    assert.match(hold.reasonHash, /^[a-f0-9]{64}$/);
    assert.throws(() => runtime.placeArtifactLegalHold(project, { contentSha256: written.contentSha256, reason: 'Duplicate.', actorId: 'security-admin' }), /artifact-legal-hold-already-active/);
    const held = runtime.auditArtifactStore(project, { now: '2026-07-14T20:20:00.000Z' });
    assert.equal(held.summary.activeLegalHoldCount, 1);
    assert.equal(held.summary.deletionEligibleContentCount, 0);
    const released = runtime.releaseArtifactLegalHold(project, { holdId: hold.holdId, actorId: 'security-admin', now: '2026-07-14T20:21:00.000Z' });
    assert.equal(released.releaseOfHoldId, hold.holdId);
    const afterRelease = runtime.auditArtifactStore(project, { now: '2026-07-14T20:22:00.000Z' });
    assert.equal(afterRelease.summary.activeLegalHoldCount, 0);
    assert.equal(afterRelease.summary.deletionEligibleContentCount, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
