import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

const projectId = 'local_privacy_deletion_execution_project';
const requestedAt = '2026-07-10T14:00:00.000Z';

function createSeed() {
  return createKickoffProjectFromMeeting({
    projectId,
    name: 'Local privacy deletion execution project',
    brief: 'Delete only confirmed local active project data.',
    now: requestedAt,
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
}

test('requires a restart-safe dual approval before purge and preserves approval proof in the tombstone', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-privacy-purge-'));
  const filePath = join(directory, 'projects.json');
  const runtimeRoot = join(directory, 'runtime');
  try {
    const seed = createSeed();
    const runtime = createLocalProjectRuntime({ rootPath: runtimeRoot });
    const projectWithRuntime = runtime.attachProject(seed.project);
    const store = createAgentProjectFileStore({
      filePath,
      projects: [projectWithRuntime],
      messages: [...seed.messages, { id: 'delete_me', projectId, text: 'active project data', time: requestedAt }],
      hydrateProject: hydrateAgentProject,
      replaceWithSeed: true,
    });
    let service = createAgentProjectService({ store, projectRuntime: runtime });
    let api = createAgentProjectApi({ service });
    const request = service.requestProjectPrivacyDeletion({ projectId, actor: 'Local owner', now: requestedAt });
    service.confirmProjectPrivacyDeletion({
      projectId,
      requestId: request.privacyDeletionRequest.id,
      confirmationToken: request.confirmationToken,
      actor: 'Local owner',
      now: '2026-07-10T14:01:00.000Z',
    });

    let response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/privacy/deletion-requests/${request.privacyDeletionRequest.id}/execute`,
      body: { actor: 'Local owner', now: '2026-07-10T14:02:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || response.body.error || '', /action-approval-required/);
    assert.equal(existsSync(projectWithRuntime.localRuntime.rootPath), true);
    assert.equal(store.getProject(projectId).id, projectId);

    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
      body: {
        actionType: 'privacy:project-delete',
        actionKey: 'a-different-privacy-deletion-request',
        reason: 'This approval must not authorize a different deletion request.',
        idempotencyKey: 'privacy-delete-wrong-target-001',
        now: '2026-07-10T14:02:01.000Z',
      },
    });
    assert.equal(response.status, 201);
    const wrongTargetApprovalId = response.body.actionApproval.id;
    for (const approvalDecision of [
      { role: 'manager', userId: 'manager-wrong-target', now: '2026-07-10T14:02:02.000Z' },
      { role: 'security-admin', userId: 'security-wrong-target', now: '2026-07-10T14:02:03.000Z' },
    ]) {
      response = api.handle({
        method: 'POST',
        path: `/projects/${projectId}/action-approvals/${wrongTargetApprovalId}/decisions`,
        headers: { 'x-hofs-role': approvalDecision.role, 'x-hofs-user-id': approvalDecision.userId },
        body: { decision: 'approved', now: approvalDecision.now },
      });
      assert.equal(response.status, 200);
    }
    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/privacy/deletion-requests/${request.privacyDeletionRequest.id}/execute`,
      body: {
        actor: 'Local owner',
        actionApprovalId: wrongTargetApprovalId,
        executionKey: 'wrong-target-execution',
        now: '2026-07-10T14:02:04.000Z',
      },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || response.body.error || '', /exact-match-required/);
    assert.equal(store.getProject(projectId).id, projectId);

    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
      body: {
        actionType: 'privacy:project-delete',
        actionKey: request.privacyDeletionRequest.id,
        requestedBy: 'local-owner',
        reason: 'Execute the exact confirmed local privacy deletion request.',
        idempotencyKey: 'privacy-delete-execution-approval-001',
        now: '2026-07-10T14:02:10.000Z',
      },
    });
    assert.equal(response.status, 201);
    const actionApprovalId = response.body.actionApproval.id;

    for (const approvalDecision of [
      { role: 'manager', userId: 'manager-two', now: '2026-07-10T14:02:20.000Z' },
      { role: 'security-admin', userId: 'security-one', now: '2026-07-10T14:02:30.000Z' },
    ]) {
      response = api.handle({
        method: 'POST',
        path: `/projects/${projectId}/action-approvals/${actionApprovalId}/decisions`,
        headers: { 'x-hofs-role': approvalDecision.role, 'x-hofs-user-id': approvalDecision.userId },
        body: {
          decision: 'approved',
          reason: `Independent ${approvalDecision.role} approval for the exact request.`,
          now: approvalDecision.now,
        },
      });
      assert.equal(response.status, 200);
    }

    const restartedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const restartedRuntime = createLocalProjectRuntime({ rootPath: runtimeRoot });
    let failPurgeOnce = true;
    const crashRecoverableRuntime = {
      purgeProject(...args) {
        if (failPurgeOnce) {
          failPurgeOnce = false;
          throw new Error('simulated-purge-crash-window');
        }
        return restartedRuntime.purgeProject(...args);
      },
    };
    service = createAgentProjectService({ store: restartedStore, projectRuntime: crashRecoverableRuntime });
    api = createAgentProjectApi({ service });
    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/privacy/deletion-requests/${request.privacyDeletionRequest.id}/execute`,
      body: {
        actor: 'Local owner',
        actionApprovalId,
        executionKey: 'privacy-delete-execution-001',
        now: '2026-07-10T14:03:00.000Z',
      },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || response.body.error || '', /simulated-purge-crash-window/);
    assert.equal(
      restartedStore.getProject(projectId).actionApprovals.find((item) => item.id === actionApprovalId).status,
      'executing',
    );
    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/privacy/deletion-requests/${request.privacyDeletionRequest.id}/execute`,
      body: {
        actor: 'Local owner',
        actionApprovalId,
        executionKey: 'privacy-delete-execution-001',
        now: '2026-07-10T14:03:10.000Z',
      },
    });
    assert.equal(response.status, 200);
    const result = response.body;

    assert.equal(result.route, 'project-privacy-deleted');
    assert.equal(existsSync(projectWithRuntime.localRuntime.rootPath), false);
    assert.equal(existsSync(result.privacyDeletionReceipt.tombstonePath), true);
    assert.equal(readFileSync(result.privacyDeletionReceipt.tombstonePath, 'utf8').includes('append-only'), true);
    assert.equal(result.privacyDeletionReceipt.actionApprovalId, actionApprovalId);
    assert.ok(result.privacyDeletionReceipt.actionApprovalChecksum);
    assert.equal(result.privacyDeletionReceipt.actionApprovalDecisionChecksums.length, 2);
    assert.ok(result.privacyDeletionReceipt.actionApprovalExecutionClaim.checksum);
    assert.equal(JSON.stringify(result.privacyDeletionReceipt).includes('privacy-delete-execution-001'), false);
    const restarted = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    assert.throws(() => restarted.getProject(projectId), /Project not found/);
    assert.equal(JSON.stringify(restarted.snapshot()).includes(projectId), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
