import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

function withApi(run) {
  const directory = mkdtempSync(join(tmpdir(), 'hof-leader-work-governance-'));
  try {
    return run(createFileBackedAgentProjectApi({
      filePath: join(directory, 'store.json'),
      replaceWithSeed: true,
      projectRuntime: createLocalProjectRuntime({ rootPath: join(directory, 'runtime') }),
    }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const team = [
  { id: 'leader', name: 'Leader', role: 'Research Lead' },
  { id: 'researcher', name: 'Researcher', role: 'Evidence Researcher' },
  { id: 'analyst', name: 'Analyst', role: 'Data Analyst' },
  { id: 'reviewer', name: 'Reviewer', role: 'Independent Reviewer' },
];

const tasks = [
  { id: 'plan', text: 'Prepare the research plan', assignee: 'leader', status: 'pending' },
  { id: 'draft', text: 'Prepare the first draft', assignee: 'leader', status: 'pending' },
];

test('Leader gives every Agent a formal work contract and deadline before execution begins', () => withApi((api) => {
  const now = '2026-07-20T10:00:00.000Z';
  const response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId: 'leader-governance-project',
      name: 'Teen mental health research',
      brief: 'Research how daily work hours relate to adolescent mental health.',
      team,
      tasks,
      selectedLeaderId: 'leader',
      reviewerId: 'reviewer',
      now,
    },
  });
  assert.equal(response.status, 200);

  const projectTasks = response.body.project.tasks;
  const owners = new Set(projectTasks.map((task) => task.ownerId));
  for (const member of team) {
    assert.ok(owners.has(member.id), `${member.name} must have Leader-assigned formal work.`);
  }
  for (const task of projectTasks) {
    assert.equal(task.assignedBy, 'leader');
    assert.equal(task.deadlineSetBy, 'leader');
    assert.ok(Date.parse(task.dueAt) > Date.parse(now), `${task.id} must have a future deadline.`);
    assert.equal(task.workDefinition?.schemaVersion, 'leader-work-definition/v1');
    assert.equal(task.outcomeWorkContract?.schemaVersion, 'outcome-work-contract/v1');
    assert.equal(task.outcomeWorkContract?.ownerId, task.ownerId);
    assert.ok(task.outcomeWorkContract?.requiredTools?.length);
    assert.ok(task.workDefinition?.outcome);
    assert.ok(task.workDefinition?.deliverable);
    assert.ok(task.workDefinition?.artifactTitle);
    assert.doesNotMatch(task.workDefinition?.artifactTitle || '', /^[《“"]|[》”"]$/);
    assert.ok(task.workDefinition?.artifactPurpose);
    assert.match(task.workDefinition?.artifactFileName || '', /\.md$/);
    assert.ok(task.workDefinition?.approach?.length >= 2);
    assert.ok(task.workDefinition?.acceptanceCriteria?.length >= 2);
    assert.ok(task.workDefinition?.steps?.length >= 2);
    assert.equal(task.leaderTodos?.length, task.workDefinition.steps.length);
    assert.ok(task.leaderTodos.every((todo) => todo.setBy === 'leader'));
    assert.ok(task.leaderTodos.every((todo) => todo.dueAt === task.dueAt));
    assert.equal(task.leaderTodos.filter((todo) => todo.status === 'in-progress').length, 1);
  }

  const dashboard = api.handle({
    method: 'GET',
    path: '/projects/leader-governance-project/manager-dashboard',
  });
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.body.tasks.rows.length >= team.length);
  assert.ok(dashboard.body.tasks.rows.every((task) => task.dueAt && task.workDefinition?.deliverable && task.leaderTodos?.length));

  const logCount = response.body.project.logs.length;
  const assignedAtByTaskId = new Map(projectTasks.map((task) => [task.id, task.assignedAt]));
  const reconciled = api.handle({
    method: 'POST',
    path: '/projects/leader-governance-project/leader-work-plan/reconcile',
    body: { now: '2026-07-20T11:00:00.000Z' },
  });
  assert.equal(reconciled.status, 200);
  assert.equal(reconciled.body.project.logs.length, logCount, 'Unchanged Leader work must not publish duplicate assignment logs.');
  for (const task of reconciled.body.project.tasks) {
    assert.equal(task.assignedAt, assignedAtByTaskId.get(task.id), `${task.id} must preserve its original assignment time.`);
  }
}));

test('Agent without Leader-assigned work waits without publishing formal work or an artifact', () => withApi((api) => {
  const projectId = 'leader-governance-waiting-project';
  const response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Waiting work contract',
      brief: 'Verify that unassigned Agents do not manufacture progress.',
      team,
      tasks: [{ id: 'leader-only', text: 'Leader-only task', assignee: 'leader', status: 'pending' }],
      selectedLeaderId: 'leader',
      reviewerId: 'reviewer',
      now: '2026-07-20T10:00:00.000Z',
    },
  });
  assert.equal(response.status, 200);

  const stored = api.store.getProject(projectId);
  api.store.saveProject({
    ...stored,
    tasks: stored.tasks.filter((task) => task.ownerId !== 'analyst'),
  });

  const cycle = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/agents/analyst/work-cycle`,
    body: {
      includeReadModels: false,
      submitWorkArtifact: true,
      submitWorkArtifactOn: 'always',
      now: '2026-07-20T10:05:00.000Z',
    },
  });
  assert.equal(cycle.status, 200);
  assert.equal(cycle.body.cycle?.status, 'waiting-for-leader-assignment');
  assert.equal(cycle.body.artifact, null);
  assert.equal(cycle.body.submission, null);
  assert.equal(cycle.body.log, null);

  const reconciled = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/leader-work-plan/reconcile`,
    body: { now: '2026-07-20T10:06:00.000Z' },
  });
  assert.equal(reconciled.status, 200);
  assert.equal(reconciled.body.route, 'leader-work-plan-reconciled');
  assert.equal(reconciled.body.leaderWorkPlan?.coverage?.assignedAgentCount, team.length);
  assert.ok(reconciled.body.project.tasks.some((task) => task.ownerId === 'analyst' && task.dueAt));
}));

test('Leader work plan follows the inherited language of a Chinese project', () => withApi((api) => {
  const response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId: 'leader-governance-zh-project',
      name: '青少年心理健康与每日工作时间关联研究',
      brief: '研究青少年心理健康指数与每天工作时间之间的关联。',
      language: 'inherit',
      team,
      tasks: [
        { id: 'zh-plan', text: '制定研究计划', assignee: 'leader', status: 'pending' },
        { id: 'generic-review', text: '审批后发布第一包时间线证据', assignee: 'reviewer', status: 'pending', source: 'kickoff-leader-assignment' },
      ],
      selectedLeaderId: 'leader',
      reviewerId: 'reviewer',
      now: '2026-07-20T10:00:00.000Z',
    },
  });
  assert.equal(response.status, 200);

  const generatedTasks = response.body.project.tasks.filter((task) => task.source === 'leader-work-plan');
  assert.ok(generatedTasks.length > 0);
  for (const task of generatedTasks) {
    assert.match(task.text, /青少年心理健康与每日工作时间关系研究/);
    assert.doesNotMatch(task.text, /Deliver the first formal/);
    assert.equal(task.workDefinition?.language, 'zh');
    assert.match(task.workDefinition?.deliverable || '', /方案|报告|说明|计划|论文|成果/);
  }
  const rewrittenReviewTask = response.body.project.tasks.find((task) => task.id === 'generic-review');
  assert.match(rewrittenReviewTask?.text || '', /完成《.*证据与质量审查报告》/);
  assert.doesNotMatch(rewrittenReviewTask?.text || '', /审批后发布第一包时间线证据/);
}));

test('completed history does not replace each Agent current formal work', () => withApi((api) => {
  const response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId: 'leader-current-work-project',
      name: 'Current work coverage',
      brief: 'Keep current formal work visible after historical tasks finish.',
      team: team.map((member) => member.id === 'reviewer' ? { ...member, role: 'Crisis Leader' } : member),
      tasks: [
        { id: 'leader-history', text: 'Historical Leader task', assignee: 'leader', status: 'done', completedAt: '2026-07-19T10:00:00.000Z' },
        { id: 'research-active', text: 'Active research task', assignee: 'researcher', status: 'pending' },
      ],
      selectedLeaderId: 'leader',
      reviewerId: 'reviewer',
      now: '2026-07-20T10:00:00.000Z',
    },
  });
  assert.equal(response.status, 200);

  const openOwners = new Set(response.body.project.tasks
    .filter((task) => task.status !== 'done')
    .map((task) => task.ownerId));
  for (const member of team) {
    assert.ok(openOwners.has(member.id), `${member.name} must have current formal work, not only completed history.`);
  }
  const leaderCurrentTask = response.body.project.tasks.find((task) => task.ownerId === 'leader' && task.status !== 'done');
  assert.match(leaderCurrentTask?.text || '', /Complete.*Delivery Plan/i);
  assert.doesNotMatch(leaderCurrentTask?.text || '', /coordinate|deadline/i);
  assert.match(leaderCurrentTask?.workDefinition?.artifactFileName || '', /Delivery Plan\.md$/i);
  const crisisLeaderTask = response.body.project.tasks.find((task) => task.ownerId === 'reviewer' && task.status !== 'done');
  assert.doesNotMatch(crisisLeaderTask?.text || '', /统筹|coordinate/i);
}));

test('Leader plan reconciliation is maintenance work and does not request model self-commentary', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hof-leader-plan-maintenance-'));
  try {
    const api = createFileBackedAgentProjectApi({
      filePath: join(directory, 'store.json'),
      replaceWithSeed: true,
      projectRuntime: createLocalProjectRuntime({ rootPath: join(directory, 'runtime') }),
      llmProvider: {
        status: () => ({ provider: 'disabled-test-provider', enabled: false, configured: false }),
        createRuntimeIntent: async () => ({ ok: true, intent: { intent: 'This must not run.' } }),
      },
    });
    const initiated = api.handle({
      method: 'POST',
      path: '/projects/initiate',
      body: {
        includeReadModels: false,
        projectId: 'leader-plan-maintenance-project',
        name: 'Leader plan maintenance',
        brief: 'Reconcile formal work without asking a model to narrate the maintenance call.',
        team,
        tasks,
        selectedLeaderId: 'leader',
        reviewerId: 'reviewer',
        now: '2026-07-20T10:00:00.000Z',
      },
    });
    assert.equal(initiated.status, 200);

    const reconciled = await api.handleAsync({
      method: 'POST',
      path: '/projects/leader-plan-maintenance-project/leader-work-plan/reconcile',
      body: { includeReadModels: true, now: '2026-07-20T11:00:00.000Z' },
    });
    assert.equal(reconciled.status, 200);
    assert.equal(reconciled.body.modelIntentStatus, undefined);
    assert.equal(reconciled.body.modelIntent, undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
