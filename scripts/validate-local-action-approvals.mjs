import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-action-approvals-${process.pid}`);
const storePath = resolve(tempRoot, 'projects.json');
const runtimeRoot = resolve(tempRoot, 'runtime');
const projectId = 'local_action_approval_validation';

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  let projectRuntime = createLocalProjectRuntime({ rootPath: runtimeRoot });
  let api = createFileBackedAgentProjectApi({
    filePath: storePath,
    replaceWithSeed: true,
    projectRuntime,
  });
  let response = await api.handleAsync({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Local Action Approval Validation',
      brief: 'Prove one local human approval broker before irreversible work.',
      team: [
        { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader' },
        { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer' },
      ],
      selectedLeaderId: 'leader',
      reviewerId: 'reviewer',
      now: '2026-07-10T19:00:00.000Z',
    },
  });
  assert(response.status === 200, `Project initiation returned ${response.status}.`);

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/privacy/deletion-requests`,
    body: { actor: 'local-owner', now: '2026-07-10T19:01:00.000Z' },
  });
  assert(response.status === 200 && response.body.confirmationToken, 'Privacy deletion request must return one confirmation token.');
  const deletionRequest = response.body.privacyDeletionRequest;
  const confirmationToken = response.body.confirmationToken;
  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/privacy/deletion-requests/${deletionRequest.id}/confirm`,
    body: { actor: 'local-owner', confirmationToken, now: '2026-07-10T19:01:30.000Z' },
  });
  assert(response.status === 200 && response.body.privacyDeletionRequest.status === 'confirmed', 'Independent deletion confirmation must persist.');

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/privacy/deletion-requests/${deletionRequest.id}/execute`,
    body: { actor: 'local-owner', now: '2026-07-10T19:01:40.000Z' },
  });
  assert(response.status === 400 && /action-approval-required/.test(response.body.message || ''), 'Irreversible execution must fail without unified approval.');

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/action-approvals`,
    headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
    body: {
      actionType: 'privacy:project-delete',
      actionKey: deletionRequest.id,
      reason: 'Approve the exact confirmed local deletion request.',
      idempotencyKey: 'local-action-approval-validation-001',
      riskClass: 'low',
      requiredDecisionCount: 1,
      now: '2026-07-10T19:02:00.000Z',
    },
  });
  assert(response.status === 201, `Action approval request returned ${response.status}.`);
  const approval = response.body.actionApproval;
  assert(approval.riskClass === 'critical' && approval.requiredDecisionCount === 2, 'Backend policy must resist caller downgrade.');

  for (const item of [
    { role: 'manager', userId: 'manager-two', now: '2026-07-10T19:02:10.000Z' },
    { role: 'security-admin', userId: 'security-one', now: '2026-07-10T19:02:20.000Z' },
  ]) {
    response = await api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals/${approval.id}/decisions`,
      headers: { 'x-hofs-role': item.role, 'x-hofs-user-id': item.userId },
      body: { decision: 'approved', reason: `Independent ${item.role} review.`, now: item.now },
    });
    assert(response.status === 200, `${item.role} decision returned ${response.status}.`);
  }
  assert(response.body.actionApproval.status === 'approved', 'Both required roles must produce approved state.');

  projectRuntime = createLocalProjectRuntime({ rootPath: runtimeRoot });
  api = createFileBackedAgentProjectApi({ filePath: storePath, projectRuntime });
  response = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/action-approvals`,
    body: { now: '2026-07-10T19:02:30.000Z' },
  });
  const governance = response.body.actionApprovalGovernance;
  assert(response.status === 200 && governance.integrity.valid, 'Approval checksums must verify after file-store restart.');
  assert(governance.summary.approvedCount === 1 && governance.rows[0].id === approval.id, 'Approved authority must recover after restart.');

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/privacy/deletion-requests/${deletionRequest.id}/execute`,
    body: {
      actor: 'local-owner',
      actionApprovalId: approval.id,
      executionKey: 'local-action-execution-validation-001',
      now: '2026-07-10T19:03:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.route === 'project-privacy-deleted', `Approved deletion returned ${response.status}.`);
  const receipt = response.body.privacyDeletionReceipt;
  assert(receipt.actionApprovalId === approval.id, 'Deletion tombstone must bind the exact approval.');
  assert(receipt.actionApprovalDecisionChecksums?.length === 2, 'Deletion tombstone must preserve both decision checksums.');
  assert(receipt.actionApprovalExecutionClaim?.checksum, 'Deletion tombstone must preserve a checksummed execution claim.');
  assert(!JSON.stringify(receipt).includes('local-action-execution-validation-001'), 'Execution idempotency secret must not be retained in the receipt.');
  assert(existsSync(receipt.tombstonePath), 'Residual-boundary tombstone must remain after project purge.');
  const tombstone = JSON.parse(await readFile(receipt.tombstonePath, 'utf8'));
  assert(tombstone.actionApprovalId === approval.id, 'Persisted tombstone must contain the same approval proof.');
  assert(api.store.snapshot().projects.every((project) => project.id !== projectId), 'Deleted project state must not remain in the active store.');

  console.log('Local unified action approval validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
