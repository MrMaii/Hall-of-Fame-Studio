import assert from 'node:assert/strict';
import test from 'node:test';

import { advanceAutonomousProjectCycle } from '../src/agents/agentRuntime.js';

test('an autonomous cycle publishes uniquely identified logs with the originating Agent attached', () => {
  const team = [
    { id: 'lead', name: 'Lead', role: 'Leader', isLeader: true, managedIds: ['worker'] },
    { id: 'worker', name: 'Worker', role: 'Engineer', managerId: 'lead' },
  ];
  const project = {
    id: 'cycle-identity-project',
    name: 'Cycle identity project',
    team,
    tasks: [{ id: 'task-1', text: 'Open work', assignee: 'Worker', status: 'pending' }],
    agentStates: {},
    logs: [],
  };

  const result = advanceAutonomousProjectCycle({
    project,
    team,
    cadence: 'hourly',
    now: '2026-07-15T12:00:00.000Z',
  });
  const cycleLogs = result.project.logs;
  const logIds = cycleLogs.map((row) => row.id);

  assert.equal(new Set(logIds).size, logIds.length, 'every timeline log in one cycle must have a unique public id');
  const workPulseLogs = cycleLogs.filter((row) => row.eventType === 'work-pulse');
  assert.ok(workPulseLogs.length > 0, 'the cycle must publish at least one Agent work pulse');
  assert.ok(
    workPulseLogs.every((row) => row.agentId && row.agent && row.agent !== 'Agent Runtime'),
    'every published work pulse must retain the originating Agent identity',
  );
});

test('coordination cycles never complete tasks or increase project progress without an accepted material outcome', () => {
  const team = [
    { id: 'lead', name: 'Lead', role: 'Leader', isLeader: true, managedIds: ['worker'] },
    { id: 'worker', name: 'Worker', role: 'Researcher', managerId: 'lead' },
  ];
  let project = {
    id: 'no-fake-progress-project',
    name: 'Research project',
    objective: 'Research reliable evidence.',
    progress: 14,
    team,
    tasks: [{ id: 'task-1', text: 'Search and synthesize evidence', assignee: 'Worker', status: 'pending' }],
    agentStates: {},
    logs: [],
  };

  for (let index = 0; index < 4; index += 1) {
    project = advanceAutonomousProjectCycle({
      project,
      team,
      cadence: 'hourly',
      now: `2026-07-15T1${index}:00:00.000Z`,
    }).project;
  }

  assert.equal(project.progress, 14);
  assert.equal(project.tasks[0].status, 'in-progress');
  assert.equal(project.tasks[0].completedAt, undefined);
  assert.equal(project.logs.some((row) => row.eventType === 'task-completed'), false);
});
