import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';

const projectId = 'local_action_approval_project';
const actionKey = 'privacy_deletion_request_exact_target';

function createSeed() {
  return createKickoffProjectFromMeeting({
    projectId,
    name: 'Local unified action approval project',
    brief: 'Require independent human approval before irreversible local actions.',
    now: '2026-07-10T17:00:00.000Z',
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
}

function createRuntime({ directory, seed = false } = {}) {
  const kickoff = seed ? createSeed() : null;
  const store = createAgentProjectFileStore({
    filePath: join(directory, 'projects.json'),
    ...(kickoff ? {
      projects: [kickoff.project],
      messages: kickoff.messages,
      replaceWithSeed: true,
    } : {}),
    hydrateProject: hydrateAgentProject,
  });
  const service = createAgentProjectService({ store });
  return { store, service, api: createAgentProjectApi({ service }) };
}

test('derives critical policy and requires independent Manager plus security approval', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-action-approval-'));
  try {
    let runtime = createRuntime({ directory, seed: true });
    const requestBody = {
      actionType: 'privacy:project-delete',
      actionKey,
      requestedBy: 'spoofed-body-user',
      reason: 'Delete the confirmed local project and preserve only the residual-boundary tombstone.',
      idempotencyKey: 'delete-request-approval-001',
      riskClass: 'low',
      requiredDecisionCount: 1,
      ttlMs: 60 * 60 * 1000,
      now: '2026-07-10T17:01:00.000Z',
    };
    let response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
      body: requestBody,
    });
    assert.equal(response.status, 201);
    const approval = response.body.actionApproval;
    assert.equal(approval.schemaVersion, 'local-action-approval/v1');
    assert.equal(approval.projectId, projectId);
    assert.equal(approval.requestedBy, 'local-owner');
    assert.equal(approval.actionType, 'privacy:project-delete');
    assert.equal(approval.actionKey, actionKey);
    assert.equal(approval.riskClass, 'critical');
    assert.equal(approval.irreversible, true);
    assert.deepEqual(approval.requiredApproverRoles, ['manager', 'security-admin']);
    assert.equal(approval.requiredDecisionCount, 2);
    assert.equal(approval.status, 'pending');
    assert.ok(approval.intentChecksum && approval.checksum);
    const approvalId = approval.id;

    response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
      body: requestBody,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);
    assert.equal(response.body.actionApproval.id, approvalId);

    const conflict = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals`,
      body: { ...requestBody, reason: 'Conflicting reuse of the same idempotency key.' },
    });
    assert.equal(conflict.status, 400);
    assert.match(conflict.body.message || conflict.body.error || '', /idempotency/i);

    const selfDecision = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals/${approvalId}/decisions`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
      body: {
        decision: 'approved',
        reason: 'Requester must not approve their own critical action.',
        now: '2026-07-10T17:02:00.000Z',
      },
    });
    assert.equal(selfDecision.status, 400);
    assert.match(selfDecision.body.message || selfDecision.body.error || '', /self-approval/i);

    response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals/${approvalId}/decisions`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-two' },
      body: {
        decision: 'approved',
        reason: 'Manager confirms the exact deletion target and impact.',
        now: '2026-07-10T17:03:00.000Z',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.actionApproval.status, 'pending');
    assert.equal(response.body.actionApproval.decisions.length, 1);

    const duplicateDecision = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals/${approvalId}/decisions`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-two' },
      body: {
        decision: 'approved',
        reason: 'Manager confirms the exact deletion target and impact.',
        now: '2026-07-10T17:03:30.000Z',
      },
    });
    assert.equal(duplicateDecision.status, 200);
    assert.equal(duplicateDecision.body.idempotent, true);
    assert.equal(duplicateDecision.body.actionApproval.decisions.length, 1);

    const reusedApprover = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals/${approvalId}/decisions`,
      headers: { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'manager-two' },
      body: {
        decision: 'approved',
        reason: 'One person must not cover both required roles.',
        now: '2026-07-10T17:03:40.000Z',
      },
    });
    assert.equal(reusedApprover.status, 400);
    assert.match(reusedApprover.body.message || reusedApprover.body.error || '', /must-be-distinct/);

    response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals/${approvalId}/decisions`,
      headers: { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'security-one' },
      body: {
        decision: 'approved',
        reason: 'Security confirms the irreversible local deletion boundary.',
        now: '2026-07-10T17:04:00.000Z',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.actionApproval.status, 'approved');
    assert.equal(response.body.actionApproval.decisions.length, 2);
    assert.equal(response.body.actionApproval.missingApproverRoles.length, 0);

    runtime = createRuntime({ directory });
    response = await runtime.api.handleAsync({
      method: 'GET',
      path: `/projects/${projectId}/action-approvals`,
      body: { now: '2026-07-10T17:05:00.000Z' },
    });
    assert.equal(response.status, 200);
    const governance = response.body.actionApprovalGovernance;
    assert.equal(governance.schemaVersion, 'local-action-approval-governance/v1');
    assert.equal(governance.summary.approvedCount, 1);
    assert.equal(governance.integrity.valid, true);
    assert.equal(governance.rows[0].id, approvalId);
    assert.equal(governance.backendRoutes.actionApprovals, `/projects/${projectId}/action-approvals`);

    const tamperedProject = runtime.store.getProject(projectId);
    tamperedProject.actionApprovals[0].decisions[0].reason = 'tampered after approval';
    runtime.store.saveProject(tamperedProject);
    response = await runtime.api.handleAsync({
      method: 'GET',
      path: `/projects/${projectId}/action-approvals`,
      body: { now: '2026-07-10T17:06:00.000Z' },
    });
    assert.equal(response.body.actionApprovalGovernance.integrity.valid, false);
    assert.equal(response.body.actionApprovalGovernance.rows[0].status, 'integrity-invalid');
    assert.equal(response.body.actionApprovalGovernance.summary.approvedCount, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fails closed after rejection or expiry', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-action-approval-terminal-'));
  try {
    const runtime = createRuntime({ directory, seed: true });
    const requestApproval = async (idempotencyKey, now, ttlMs = 60 * 60 * 1000) => {
      const response = await runtime.api.handleAsync({
        method: 'POST',
        path: `/projects/${projectId}/action-approvals`,
        headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
        body: {
          actionType: 'workspace:external-write',
          actionKey: `workspace-write-${idempotencyKey}`,
          reason: 'Authorize one exact external workspace write.',
          idempotencyKey,
          ttlMs,
          now,
        },
      });
      assert.equal(response.status, 201);
      return response.body.actionApproval.id;
    };

    const rejectedId = await requestApproval('rejected-001', '2026-07-10T18:00:00.000Z');
    let response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals/${rejectedId}/decisions`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-two' },
      body: { decision: 'rejected', reason: 'Target is outside the permitted workspace.', now: '2026-07-10T18:01:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.actionApproval.status, 'rejected');
    response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals/${rejectedId}/decisions`,
      headers: { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'security-one' },
      body: { decision: 'approved', now: '2026-07-10T18:02:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || response.body.error || '', /terminal:rejected/);

    const expiredId = await requestApproval('expired-001', '2026-07-10T18:10:00.000Z', 60_000);
    response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/action-approvals/${expiredId}/decisions`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-three' },
      body: { decision: 'approved', now: '2026-07-10T18:12:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || response.body.error || '', /terminal:expired/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
