import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { projectCommandRefreshPlan } from '../src/project/projectCommandRefreshPlan.js';

test('refreshes the visible chat transcript immediately after an interactive command', () => {
  assert.deepEqual(projectCommandRefreshPlan({
    action: 'chat',
    projectMode: 'chat',
    refreshAdvanced: false,
  }), {
    immediate: ['transcript'],
    background: ['timeline'],
  });
});

test('keeps non-visible and advanced read models in one parallel background tier', () => {
  assert.deepEqual(projectCommandRefreshPlan({
    action: 'meeting',
    projectMode: 'meeting',
    refreshAdvanced: true,
  }), {
    immediate: ['transcript'],
    background: [
      'timeline',
      'manager-dashboard',
      'manager-flow-graph',
      'readiness-proof-map',
      'ready-package-submodels',
      'collaboration-intent-queue',
      'agent-autonomous-action-queue',
    ],
  });
});

test('prioritizes timeline when it is the currently visible project mode', () => {
  assert.deepEqual(projectCommandRefreshPlan({
    action: 'transcripts',
    projectMode: 'timeline',
    refreshAdvanced: false,
  }), {
    immediate: ['timeline'],
    background: ['transcript'],
  });
});

test('the backend project command uses immediate and parallel background refresh tiers', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const start = appSource.indexOf('const runBackendProjectCommand = async');
  const end = appSource.indexOf('const recordTimelineAction = async', start);
  const commandSource = appSource.slice(start, end);

  assert.ok(commandSource.includes('projectCommandRefreshPlan({'));
  assert.ok(commandSource.includes('await Promise.allSettled(refreshPlan.immediate.map(refreshReadModel))'));
  assert.ok(commandSource.includes('void Promise.allSettled(refreshPlan.background.map(refreshReadModel))'));
  assert.ok(!commandSource.includes('}, 5000)'));
});
