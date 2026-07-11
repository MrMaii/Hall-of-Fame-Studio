import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-privacy-lifecycle-'));
  const project = { id: 'privacy_lifecycle_project', name: 'Privacy Lifecycle' };
  const store = createAgentProjectFileStore({
    filePath: join(directory, 'projects.json'),
    projects: [project],
    replaceWithSeed: true,
    hydrateProject: hydrateAgentProject,
  });
  const runtime = createLocalProjectRuntime({ rootPath: join(directory, 'runtime'), artifactRetentionDays: 365 });
  const service = createAgentProjectService({ store, projectRuntime: runtime });
  return { directory, projectId: project.id, store, runtime, service };
}

test('plans exact automatic local retention from the project privacy policy', () => {
  const { directory, projectId, store, runtime, service } = fixture();
  try {
    const updated = service.setProjectSettings({
      projectId,
      privacyPolicy: { retentionDays: 1, lifecycleScanMode: 'automatic-review' },
      updatedBy: 'privacy-manager',
      now: '2026-07-11T10:00:00.000Z',
    });
    assert.equal(updated.projectSettings.privacyPolicy.retentionDays, 1);
    assert.equal(updated.projectSettings.privacyPolicy.lifecycleScanMode, 'automatic-review');

    const written = runtime.writeArtifact({ id: 'expired-report', content: 'PRIVATE REPORT' }, {
      project: store.getProject(projectId),
      now: '2026-07-11T11:00:00.000Z',
    });
    assert.equal(written.storageEvent.retentionClass, 'project-artifact-1d');
    assert.equal(written.storageEvent.retainUntil, '2026-07-12T11:00:00.000Z');

    const inventory = runtime.auditArtifactStore(store.getProject(projectId), { now: '2026-07-13T11:00:00.000Z' });
    assert.match(inventory.checksum, /^[a-f0-9]{64}$/);
    const lifecycle = service.getProjectPrivacyLifecycle(projectId, { now: '2026-07-13T11:00:00.000Z' });
    assert.equal(lifecycle.status, 'due-approval-required');
    assert.equal(lifecycle.automaticScanEnabled, true);
    assert.equal(lifecycle.inventoryChecksum, inventory.checksum);
    assert.deepEqual(lifecycle.deletionManifest.contentSha256, [written.contentSha256]);
    assert.match(lifecycle.planChecksum, /^[a-f0-9]{64}$/);
    assert.equal(lifecycle.planExpiresAt, '2026-07-13T12:00:00.000Z');
    assert.equal(lifecycle.nextScanAt, '2026-07-14T11:00:00.000Z');
    assert.equal(lifecycle.deletionExecuted, false);
    assert.equal(lifecycle.residualDataBoundaries.externalWorkspacePreserved, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('excludes held content and bounds invalid privacy lifecycle settings', () => {
  const { directory, projectId, store, runtime, service } = fixture();
  try {
    const updated = service.setProjectSettings({
      projectId,
      privacyPolicy: { retentionDays: 99_999, lifecycleScanMode: 'silent-delete' },
      updatedBy: 'privacy-manager',
      now: '2026-07-11T10:00:00.000Z',
    });
    assert.equal(updated.projectSettings.privacyPolicy.retentionDays, 3650);
    assert.equal(updated.projectSettings.privacyPolicy.lifecycleScanMode, 'manual');
    service.setProjectSettings({
      projectId,
      privacyPolicy: { retentionDays: 1, lifecycleScanMode: 'automatic-review' },
      updatedBy: 'privacy-manager',
      now: '2026-07-11T10:01:00.000Z',
    });
    const written = runtime.writeArtifact({ id: 'held-report', content: 'HELD PRIVATE REPORT' }, {
      project: store.getProject(projectId),
      now: '2026-07-11T11:00:00.000Z',
    });
    runtime.placeArtifactLegalHold(store.getProject(projectId), {
      contentSha256: written.contentSha256,
      reason: 'Required for an active review.',
      actorId: 'security-admin',
      now: '2026-07-12T11:00:00.000Z',
    });
    const lifecycle = service.getProjectPrivacyLifecycle(projectId, { now: '2026-07-13T11:00:00.000Z' });
    assert.equal(lifecycle.status, 'blocked-legal-hold');
    assert.deepEqual(lifecycle.deletionManifest.contentSha256, []);
    assert.deepEqual(lifecycle.blockedContentSha256, [written.contentSha256]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requires exact dual approval and resumes a committed retention operation idempotently', () => {
  const { directory, projectId, store, runtime, service } = fixture();
  try {
    service.setProjectSettings({ projectId, privacyPolicy: { retentionDays: 1, lifecycleScanMode: 'automatic-review' }, updatedBy: 'owner', now: '2026-07-11T10:00:00.000Z' });
    const written = runtime.writeArtifact({ id: 'delete-me', relativePath: 'delete-me.md', content: 'DELETE AFTER RETENTION' }, {
      project: store.getProject(projectId), now: '2026-07-11T11:00:00.000Z',
    });
    const plan = service.scanProjectPrivacyLifecycle(projectId, { actor: 'privacy-scanner', now: '2026-07-13T11:00:00.000Z' }).privacyLifecyclePlan;
    assert.throws(() => service.executeProjectPrivacyLifecycle({
      projectId, planChecksum: plan.planChecksum, operationId: 'retention-op-1', actor: 'executor', now: '2026-07-13T11:05:00.000Z',
    }), /explicit-execute-required/);
    assert.throws(() => service.executeProjectPrivacyLifecycle({
      projectId, planChecksum: plan.planChecksum, operationId: 'retention-op-1', execute: true, actor: 'executor', now: '2026-07-13T11:05:00.000Z',
    }), /action-approval-required/);
    const requested = service.requestActionApproval({
      projectId, actionType: 'privacy:artifact-retention-delete', actionKey: plan.planChecksum,
      requestedBy: 'requester', reason: 'Delete the exact expired manifest.', idempotencyKey: 'retention-approval-1', now: '2026-07-13T11:06:00.000Z',
    });
    const approvalId = requested.actionApproval.id;
    service.recordActionApprovalDecision({ projectId, approvalId, decision: 'approved', approverRole: 'manager', approverId: 'manager-1', now: '2026-07-13T11:07:00.000Z' });
    service.recordActionApprovalDecision({ projectId, approvalId, decision: 'approved', approverRole: 'security-admin', approverId: 'security-1', now: '2026-07-13T11:08:00.000Z' });
    const originalAuditArtifactStore = runtime.auditArtifactStore.bind(runtime);
    let auditCallCount = 0;
    runtime.auditArtifactStore = (...args) => {
      auditCallCount += 1;
      if (auditCallCount === 2) throw new Error('simulated-retention-post-delete-crash');
      return originalAuditArtifactStore(...args);
    };
    assert.throws(() => service.executeProjectPrivacyLifecycle({
      projectId, planChecksum: plan.planChecksum, actionApprovalId: approvalId, operationId: 'retention-op-1', execute: true, actor: 'privacy-executor', now: '2026-07-13T11:09:00.000Z',
    }), /simulated-retention-post-delete-crash/);
    runtime.auditArtifactStore = originalAuditArtifactStore;
    const result = service.executeProjectPrivacyLifecycle({
      projectId, planChecksum: plan.planChecksum, actionApprovalId: approvalId, operationId: 'retention-op-1', execute: true, actor: 'privacy-executor', now: '2026-07-13T11:09:30.000Z',
    });
    assert.equal(result.privacyLifecycleReceipt.deletionVerified, true);
    assert.deepEqual(result.privacyLifecycleReceipt.deletedContentSha256, [written.contentSha256]);
    assert.equal(result.privacyLifecycleReceipt.residualDataBoundaries.externalWorkspacePreserved, true);
    const inventory = runtime.auditArtifactStore(store.getProject(projectId), { now: '2026-07-13T11:10:00.000Z' });
    assert.equal(inventory.integrity.valid, true);
    assert.equal(inventory.canonicalEntries[0].canonicalStatus, 'retention-deleted');
    const resumed = service.executeProjectPrivacyLifecycle({
      projectId, planChecksum: plan.planChecksum, actionApprovalId: approvalId, operationId: 'retention-op-1', execute: true, actor: 'privacy-executor', now: '2026-07-13T11:11:00.000Z',
    });
    assert.equal(resumed.idempotent, true);
    assert.equal(resumed.privacyLifecycleReceipt.checksum, result.privacyLifecycleReceipt.checksum);
    assert.throws(() => service.executeProjectPrivacyLifecycle({
      projectId, planChecksum: 'f'.repeat(64), actionApprovalId: approvalId, operationId: 'retention-op-1', execute: true, actor: 'privacy-executor', now: '2026-07-13T11:12:00.000Z',
    }), /operation-conflict/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('refuses a stale lifecycle plan when a legal hold changes the inventory', () => {
  const { directory, projectId, store, runtime, service } = fixture();
  try {
    service.setProjectSettings({ projectId, privacyPolicy: { retentionDays: 1, lifecycleScanMode: 'automatic-review' }, updatedBy: 'owner', now: '2026-07-11T10:00:00.000Z' });
    const written = runtime.writeArtifact({ id: 'hold-before-delete', content: 'PRESERVE ME' }, { project: store.getProject(projectId), now: '2026-07-11T11:00:00.000Z' });
    const plan = service.scanProjectPrivacyLifecycle(projectId, { actor: 'scanner', now: '2026-07-13T11:00:00.000Z' }).privacyLifecyclePlan;
    const approval = service.requestActionApproval({ projectId, actionType: 'privacy:artifact-retention-delete', actionKey: plan.planChecksum, requestedBy: 'requester', reason: 'Exact plan.', idempotencyKey: 'hold-stale-plan', now: '2026-07-13T11:01:00.000Z' }).actionApproval;
    service.recordActionApprovalDecision({ projectId, approvalId: approval.id, decision: 'approved', approverRole: 'manager', approverId: 'manager-2', now: '2026-07-13T11:02:00.000Z' });
    service.recordActionApprovalDecision({ projectId, approvalId: approval.id, decision: 'approved', approverRole: 'security-admin', approverId: 'security-2', now: '2026-07-13T11:03:00.000Z' });
    runtime.placeArtifactLegalHold(store.getProject(projectId), { contentSha256: written.contentSha256, reason: 'New litigation hold.', actorId: 'security-2', now: '2026-07-13T11:04:00.000Z' });
    assert.throws(() => service.executeProjectPrivacyLifecycle({ projectId, planChecksum: plan.planChecksum, actionApprovalId: approval.id, operationId: 'retention-hold-stale', execute: true, actor: 'executor', now: '2026-07-13T11:05:00.000Z' }), /inventory-stale/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('refuses expired approval and degraded canonical content', () => {
  const expiredFixture = fixture();
  try {
    const { projectId, store, runtime, service } = expiredFixture;
    service.setProjectSettings({ projectId, privacyPolicy: { retentionDays: 1, lifecycleScanMode: 'automatic-review' }, updatedBy: 'owner', now: '2026-07-11T10:00:00.000Z' });
    runtime.writeArtifact({ id: 'expired-approval', content: 'EXPIRED APPROVAL' }, { project: store.getProject(projectId), now: '2026-07-11T11:00:00.000Z' });
    const plan = service.scanProjectPrivacyLifecycle(projectId, { actor: 'scanner', now: '2026-07-13T11:00:00.000Z' }).privacyLifecyclePlan;
    const approval = service.requestActionApproval({ projectId, actionType: 'privacy:artifact-retention-delete', actionKey: plan.planChecksum, requestedBy: 'requester', reason: 'Short approval.', idempotencyKey: 'expired-retention-approval', ttlMs: 60_000, now: '2026-07-13T11:01:00.000Z' }).actionApproval;
    service.recordActionApprovalDecision({ projectId, approvalId: approval.id, decision: 'approved', approverRole: 'manager', approverId: 'manager-3', now: '2026-07-13T11:01:10.000Z' });
    service.recordActionApprovalDecision({ projectId, approvalId: approval.id, decision: 'approved', approverRole: 'security-admin', approverId: 'security-3', now: '2026-07-13T11:01:20.000Z' });
    assert.throws(() => service.executeProjectPrivacyLifecycle({ projectId, planChecksum: plan.planChecksum, actionApprovalId: approval.id, operationId: 'retention-expired', execute: true, actor: 'executor', now: '2026-07-13T11:03:00.000Z' }), /not-executable:expired/);
  } finally {
    rmSync(expiredFixture.directory, { recursive: true, force: true });
  }

  const degradedFixture = fixture();
  try {
    const { projectId, store, runtime, service } = degradedFixture;
    service.setProjectSettings({ projectId, privacyPolicy: { retentionDays: 1, lifecycleScanMode: 'automatic-review' }, updatedBy: 'owner', now: '2026-07-11T10:00:00.000Z' });
    const written = runtime.writeArtifact({ id: 'degraded', content: 'ORIGINAL' }, { project: store.getProject(projectId), now: '2026-07-11T11:00:00.000Z' });
    const plan = service.scanProjectPrivacyLifecycle(projectId, { actor: 'scanner', now: '2026-07-13T11:00:00.000Z' }).privacyLifecyclePlan;
    const approval = service.requestActionApproval({ projectId, actionType: 'privacy:artifact-retention-delete', actionKey: plan.planChecksum, requestedBy: 'requester', reason: 'Exact plan.', idempotencyKey: 'degraded-retention', now: '2026-07-13T11:01:00.000Z' }).actionApproval;
    service.recordActionApprovalDecision({ projectId, approvalId: approval.id, decision: 'approved', approverRole: 'manager', approverId: 'manager-4', now: '2026-07-13T11:02:00.000Z' });
    service.recordActionApprovalDecision({ projectId, approvalId: approval.id, decision: 'approved', approverRole: 'security-admin', approverId: 'security-4', now: '2026-07-13T11:03:00.000Z' });
    writeFileSync(written.immutableAbsolutePath, 'TAMPERED');
    assert.throws(() => service.executeProjectPrivacyLifecycle({ projectId, planChecksum: plan.planChecksum, actionApprovalId: approval.id, operationId: 'retention-degraded', execute: true, actor: 'executor', now: '2026-07-13T11:04:00.000Z' }), /integrity-invalid/);
  } finally {
    rmSync(degradedFixture.directory, { recursive: true, force: true });
  }
});
