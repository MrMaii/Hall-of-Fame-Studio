import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProjectExecutionPlan } from '../src/project/projectExecutionPlan.js';

test('execution plan measures reviewable assets instead of runtime activity', () => {
  const plan = buildProjectExecutionPlan({
    project: {
      id: 'research-project',
      createdAt: '2026-07-20T10:00:00.000Z',
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
  assert.equal(plan.elapsedPercent, 33);
  assert.equal(plan.expectedCompletionAt, '2026-07-23T10:00:00.000Z');
  assert.equal(plan.currentPhase.key, 'execution');
  assert.equal(plan.rows[0].status, 'in-progress');
  assert.equal(plan.rows[0].ownerName, 'Analyst');
  assert.equal(plan.rows[0].progressPercent, 10);
  assert.ok(plan.markerPercent > plan.stages[1].position);
  assert.ok(plan.markerPercent < plan.stages[3].position);
});

test('execution plan exposes Leader todo progress for each formal assignment', () => {
  const plan = buildProjectExecutionPlan({
    project: {
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
