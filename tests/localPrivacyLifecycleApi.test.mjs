import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

test('scans, dual-approves, executes, and resumes local privacy retention through the private API', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-privacy-lifecycle-api-'));
  const filePath = join(directory, 'projects.json');
  const runtimeRoot = join(directory, 'runtime');
  const workspacePath = join(directory, 'workspace');
  mkdirSync(workspacePath);
  const projectId = 'privacy_lifecycle_api_project';
  const securityHeaders = { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'security-caller' };
  try {
    let store = createAgentProjectFileStore({
      filePath,
      projects: [{ id: projectId, name: 'Privacy Lifecycle API', localRuntime: { workspacePath } }],
      replaceWithSeed: true,
      hydrateProject: hydrateAgentProject,
    });
    let runtime = createLocalProjectRuntime({ rootPath: runtimeRoot });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store, projectRuntime: runtime }) });
    const call = (method, path, body = {}, headers = securityHeaders) => api.handleAsync({ method, path, headers, body });
    let response = await call('POST', `/projects/${projectId}/project-settings`, {
      privacyPolicy: { retentionDays: 1, lifecycleScanMode: 'automatic-review' },
      now: '2026-07-11T12:00:00.000Z',
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const written = runtime.writeArtifact({ id: 'private-api-report', relativePath: 'private-api-report.md', content: 'PRIVATE API REPORT' }, {
      project: store.getProject(projectId), now: '2026-07-11T13:00:00.000Z',
    });
    response = await call('GET', `/projects/${projectId}/privacy/lifecycle`, { now: '2026-07-13T13:00:00.000Z' });
    assert.equal(response.status, 200);
    assert.equal(response.body.privacyLifecycle.status, 'due-approval-required');
    response = await call('POST', `/projects/${projectId}/privacy/lifecycle/scan`, { actor: 'caller-override', now: '2026-07-13T13:00:00.000Z' });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const plan = response.body.privacyLifecyclePlan;
    response = await call('POST', `/projects/${projectId}/action-approvals`, {
      actionType: 'privacy:artifact-retention-delete', actionKey: plan.planChecksum,
      requestedBy: 'caller-override', reason: 'Delete exact expired canonical content.',
      idempotencyKey: 'privacy-lifecycle-api-approval', now: '2026-07-13T13:01:00.000Z',
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.actionApproval.requestedBy, 'security-caller');
    const approvalId = response.body.actionApproval.id;
    for (const decision of [
      { role: 'manager', userId: 'manager-independent', now: '2026-07-13T13:02:00.000Z' },
      { role: 'security-admin', userId: 'security-independent', now: '2026-07-13T13:03:00.000Z' },
    ]) {
      response = await call('POST', `/projects/${projectId}/action-approvals/${approvalId}/decisions`, {
        decision: 'approved', reason: 'Independent exact-plan approval.', now: decision.now,
      }, { 'x-hofs-role': decision.role, 'x-hofs-user-id': decision.userId });
      assert.equal(response.status, 200, JSON.stringify(response.body));
    }

    store = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    runtime = createLocalProjectRuntime({ rootPath: runtimeRoot });
    api = createAgentProjectApi({ service: createAgentProjectService({ store, projectRuntime: runtime }) });
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${projectId}/privacy/lifecycle/executions`, headers: securityHeaders,
      body: { planChecksum: plan.planChecksum, actionApprovalId: approvalId, operationId: 'privacy-api-op-1', execute: true, actor: 'caller-override', now: '2026-07-13T13:04:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.privacyLifecycleReceipt.executedBy, 'security-caller');
    assert.equal(response.body.privacyLifecycleReceipt.deletionVerified, true);
    assert.equal(existsSync(written.immutableAbsolutePath), false);
    assert.equal(existsSync(written.absolutePath), false);
    assert.equal(existsSync(written.workspaceAbsolutePath), true);
    assert.equal(readFileSync(written.workspaceAbsolutePath, 'utf8'), 'PRIVATE API REPORT');
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${projectId}/privacy/lifecycle/executions`, headers: securityHeaders,
      body: { planChecksum: plan.planChecksum, actionApprovalId: approvalId, operationId: 'privacy-api-op-1', execute: true, now: '2026-07-13T13:05:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps privacy lifecycle scan and execution private', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/privacy/lifecycle' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/privacy/lifecycle/scan' }).allowedRoles, ['security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/privacy/lifecycle/executions' }).allowedRoles, ['security-admin']);
});
