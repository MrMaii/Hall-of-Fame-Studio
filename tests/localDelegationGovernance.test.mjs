import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { classifyAccessRequest } from '../src/agents/accessControl.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';
import {
  buildLocalDelegationGovernance,
  createLocalDelegationNotification,
  createLocalTaskDelegationChange,
  verifyLocalDelegationNotification,
  verifyLocalTaskDelegationChange,
} from '../src/agents/localDelegationGovernance.js';

const project = {
  id: 'delegation_governance_project',
  team: [
    { id: 'owner', name: 'Owner' },
    { id: 'owner2', name: 'Owner Two' },
    { id: 'reviewer', name: 'Reviewer' },
  ],
  tasks: [
    { id: 'foundation', text: 'PRIVATE TASK TEXT foundation', assignee: 'owner', reviewerId: 'reviewer', status: 'done', dependsOn: [] },
    { id: 'build', text: 'PRIVATE TASK TEXT build', assignee: 'owner', reviewerId: 'reviewer', status: 'pending', dueAt: '2026-07-11T12:00:00.000Z', dependsOn: ['foundation'] },
    { id: 'review', text: 'PRIVATE TASK TEXT review', assignee: 'owner', reviewerId: 'reviewer', status: 'pending', dueAt: '2026-07-09T12:00:00.000Z', dependsOn: ['build'] },
  ],
  localTaskDelegationChanges: [],
  localTaskDelegationNotifications: [],
};

test('builds a content-minimized DAG with overdue and dependency-blocked task states', () => {
  const view = buildLocalDelegationGovernance({
    project,
    now: '2026-07-10T12:00:00.000Z',
  });

  assert.equal(view.schemaVersion, 'local-delegation-governance/v1');
  assert.deepEqual(view.graph.layers, [['foundation'], ['build'], ['review']]);
  assert.deepEqual(view.graph.edges, [
    { fromTaskId: 'foundation', toTaskId: 'build' },
    { fromTaskId: 'build', toTaskId: 'review' },
  ]);
  assert.equal(view.rows.find((row) => row.taskId === 'foundation').state, 'completed');
  assert.equal(view.rows.find((row) => row.taskId === 'build').state, 'ready');
  assert.equal(view.rows.find((row) => row.taskId === 'review').state, 'overdue-blocked');
  assert.equal(view.rows.find((row) => row.taskId === 'review').blocked, true);
  assert.equal(view.rows.find((row) => row.taskId === 'review').overdue, true);
  assert.deepEqual(view.rows.find((row) => row.taskId === 'review').blockedByTaskIds, ['build']);
  assert.equal(view.summary.overdueCount, 1);
  assert.equal(view.summary.blockedCount, 1);
  assert.equal(view.integrity.valid, true);
  assert.equal(JSON.stringify(view).includes('PRIVATE TASK TEXT'), false);
});

test('fails closed for invalid dependency graphs and verifies content-free receipts', () => {
  const invalid = buildLocalDelegationGovernance({
    project: {
      ...project,
      tasks: [
        { id: 'a', assignee: 'owner', reviewerId: 'reviewer', status: 'pending', dependsOn: ['b', 'missing'] },
        { id: 'b', assignee: 'owner', reviewerId: 'reviewer', status: 'pending', dependsOn: ['a'] },
      ],
    },
    now: '2026-07-10T12:00:00.000Z',
  });
  assert.equal(invalid.integrity.valid, false);
  assert.equal(invalid.graph.acyclic, false);
  assert.deepEqual(invalid.graph.unknownTaskIds, ['missing']);
  assert.equal(invalid.status, 'degraded-integrity-invalid');

  const change = createLocalTaskDelegationChange({
    projectId: project.id,
    taskId: 'build',
    fromAssignee: 'owner',
    toAssignee: 'owner2',
    fromReviewerId: 'reviewer',
    toReviewerId: 'reviewer',
    fromDueAt: '2026-07-11T12:00:00.000Z',
    toDueAt: '2026-07-12T12:00:00.000Z',
    actorId: 'manager',
    idempotencyKey: 'change-1',
    reasonCode: 'capacity-rebalance',
    now: '2026-07-10T12:05:00.000Z',
  });
  assert.equal(verifyLocalTaskDelegationChange(change).valid, true);
  assert.equal(JSON.stringify(change).includes('PRIVATE TASK TEXT'), false);
  const tampered = { ...change, toAssignee: 'owner' };
  assert.equal(verifyLocalTaskDelegationChange(tampered).valid, false);

  const notification = createLocalDelegationNotification({
    projectId: project.id,
    taskId: 'review',
    type: 'dependency-blocked',
    assignee: 'owner',
    reviewerId: 'reviewer',
    dueAt: '2026-07-09T12:00:00.000Z',
    blockedByTaskIds: ['build'],
    now: '2026-07-10T12:06:00.000Z',
  });
  assert.equal(verifyLocalDelegationNotification(notification).valid, true);
  assert.equal(notification.storesRawContent, false);
});

test('keeps delegation reads observable while restricting scans and reassignment writes', () => {
  const read = classifyAccessRequest({ method: 'GET', path: '/projects/project-1/delegation-governance' });
  const scan = classifyAccessRequest({ method: 'POST', path: '/projects/project-1/delegation-governance/scan' });
  const change = classifyAccessRequest({ method: 'POST', path: '/projects/project-1/tasks/task-1/delegation' });
  assert.equal(read.allowedRoles.includes('observer'), true);
  assert.equal(scan.allowedRoles.includes('observer'), false);
  assert.deepEqual(change.allowedRoles, ['manager', 'security-admin']);
});

test('reassigns locally, deduplicates governance scans, and detects receipt tampering after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-delegation-governance-'));
  const filePath = join(directory, 'projects.json');
  try {
    const kickoff = createKickoffProjectFromMeeting({
      projectId: 'delegation_governance_api_project',
      name: 'Delegation governance API project',
      brief: 'Coordinate a local product team with accountable delegation.',
      team: project.team,
      now: '2026-07-10T10:00:00.000Z',
    });
    kickoff.project.tasks = structuredClone(project.tasks);
    const store = createAgentProjectFileStore({
      filePath,
      projects: [kickoff.project],
      messages: kickoff.messages,
      replaceWithSeed: true,
      hydrateProject: hydrateAgentProject,
    });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });

    let response = await api.handleAsync({
      method: 'POST',
      path: `/projects/${kickoff.project.id}/tasks/build/delegation`,
      body: {
        assignee: 'owner2',
        reviewerId: 'reviewer',
        dueAt: '2026-07-12T12:00:00.000Z',
        reasonCode: 'capacity-rebalance',
        idempotencyKey: 'reassign-build-1',
        now: '2026-07-10T12:05:00.000Z',
      },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.delegationChange.toAssignee, 'owner2');
    assert.equal(response.body.notification.type, 'owner-changed');

    response = await api.handleAsync({
      method: 'POST',
      path: `/projects/${kickoff.project.id}/tasks/build/delegation`,
      body: {
        assignee: 'owner2', reviewerId: 'reviewer', dueAt: '2026-07-12T12:00:00.000Z',
        reasonCode: 'capacity-rebalance', idempotencyKey: 'reassign-build-1', now: '2026-07-10T12:06:00.000Z',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);

    response = await api.handleAsync({
      method: 'POST',
      path: `/projects/${kickoff.project.id}/delegation-governance/scan`,
      body: { idempotencyKey: 'scan-1', now: '2026-07-10T12:10:00.000Z' },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.notificationBatch.createdCount, 2);
    assert.deepEqual(response.body.notificationBatch.createdTypes.sort(), ['dependency-blocked', 'task-overdue']);

    response = await api.handleAsync({
      method: 'POST',
      path: `/projects/${kickoff.project.id}/delegation-governance/scan`,
      body: { idempotencyKey: 'scan-2', now: '2026-07-10T12:11:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.notificationBatch.createdCount, 0);

    api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    response = await api.handleAsync({
      method: 'GET',
      path: `/projects/${kickoff.project.id}/delegation-governance`,
      body: { now: '2026-07-10T12:12:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.delegationGovernance.summary.changeCount, 1);
    assert.equal(response.body.delegationGovernance.summary.notificationCount, 3);
    assert.equal(response.body.delegationGovernance.integrity.valid, true);
    assert.equal(JSON.stringify(response.body).includes('PRIVATE TASK TEXT'), false);

    const tamperedProject = store.getProject(kickoff.project.id);
    tamperedProject.localTaskDelegationChanges[0].toAssignee = 'owner';
    store.saveProject(tamperedProject);
    api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    response = await api.handleAsync({
      method: 'GET',
      path: `/projects/${kickoff.project.id}/delegation-governance`,
      body: { now: '2026-07-10T12:13:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.delegationGovernance.status, 'degraded-integrity-invalid');
    assert.equal(response.body.delegationGovernance.integrity.valid, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
