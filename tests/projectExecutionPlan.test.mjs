import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProjectExecutionPlan } from '../src/project/projectExecutionPlan.js';

test('execution plan measures reviewable assets instead of runtime activity', () => {
  const plan = buildProjectExecutionPlan({
    project: {
      id: 'research-project',
      createdAt: '2026-07-20T10:00:00.000Z',
      leaderWorkPlan: {
        schemaVersion: 'leader-managed-task-plan/v1',
        status: 'submitted',
        submittedAt: '2026-07-20T10:05:00.000Z',
        leaderId: 'leader',
        leaderName: 'Leader',
        taskIds: ['scope', 'analysis'],
        tasks: [{ id: 'scope' }, { id: 'analysis' }],
      },
      team: [
        { id: 'leader', name: 'Leader' },
        { id: 'analyst', name: 'Analyst' },
      ],
      tasks: [
        {
          id: 'scope',
          text: 'Confirm research scope',
          ownerId: 'leader',
          status: 'done',
          dueAt: '2026-07-21T10:00:00.000Z',
          requiredWorkPulses: 3,
          workPulseCount: 3,
        },
        {
          id: 'analysis',
          text: 'Analyze the relationship',
          ownerId: 'analyst',
          status: 'in-progress',
          dueAt: '2026-07-23T10:00:00.000Z',
          requiredWorkPulses: 4,
          workPulseCount: 2,
        },
      ],
    },
    language: 'en',
    now: '2026-07-21T10:00:00.000Z',
  });

  assert.equal(plan.progressPercent, 55);
  assert.equal(plan.planStatus, 'ready');
  assert.equal(plan.progressAvailable, true);
  assert.equal(plan.elapsedPercent, 33);
  assert.equal(plan.expectedCompletionAt, '2026-07-23T10:00:00.000Z');
  assert.equal(plan.currentPhase.key, 'analysis');
  const activeRow = plan.rows.find((row) => row.id === 'analysis');
  assert.equal(activeRow.status, 'in-progress');
  assert.equal(activeRow.ownerName, 'Analyst');
  assert.equal(activeRow.progressPercent, 10);
  assert.deepEqual(plan.stages.map((stage) => stage.key), ['scope', 'analysis']);
  assert.equal(plan.stages[1].ownerName, 'Analyst');
  assert.equal(plan.stages[1].dueAt, '2026-07-23T10:00:00.000Z');
});

test('execution plan exposes Leader todo progress for each formal assignment', () => {
  const plan = buildProjectExecutionPlan({
    project: {
      leaderWorkPlan: {
        schemaVersion: 'leader-managed-task-plan/v1',
        status: 'submitted',
        submittedAt: '2026-07-20T10:05:00.000Z',
        leaderId: 'leader',
        taskIds: ['task'],
        tasks: [{ id: 'task' }],
      },
      tasks: [{
        id: 'task',
        text: 'Prepare evidence matrix',
        ownerId: 'researcher',
        dueAt: '2026-07-22T10:00:00.000Z',
        leaderTodos: [
          { id: 'one', text: 'Collect sources', status: 'completed', setBy: 'leader' },
          { id: 'two', text: 'Draft matrix', status: 'in-progress', setBy: 'leader' },
        ],
      }],
      team: [{ id: 'researcher', name: 'Researcher' }],
    },
    language: 'en',
    now: '2026-07-20T10:00:00.000Z',
  });

  assert.equal(plan.rows[0].todos.length, 2);
  assert.equal(plan.rows[0].todos[1].status, 'in-progress');
  assert.equal(plan.rows[0].todos[1].setBy, 'leader');
});

test('execution progress stays unavailable until the Leader submits a formal plan', () => {
  const plan = buildProjectExecutionPlan({
    project: {
      initiation: { leaderId: 'leader', firstLead: 'Ada' },
      progress: 78,
      team: [{ id: 'leader', name: 'Ada', isLeader: true }],
      tasks: [{ id: 'fake-progress', status: 'in-progress', workPulseCount: 99 }],
    },
    language: 'en',
  });

  assert.equal(plan.planStatus, 'planning');
  assert.equal(plan.progressAvailable, false);
  assert.equal(plan.progressPercent, null);
  assert.equal(plan.markerPercent, null);
  assert.equal(plan.expectedCompletionAt, null);
  assert.deepEqual(plan.rows, []);
  assert.deepEqual(plan.stages, []);
  assert.equal(plan.leaderName, 'Ada');
});
