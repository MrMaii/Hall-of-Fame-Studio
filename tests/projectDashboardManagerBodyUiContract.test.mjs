import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const bodyUrl = new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url);

test('Manager body stays lazy while original child order, station loading, condition, and operations remain intact', () => {
  assert.ok(existsSync(bodyUrl), 'ProjectDashboardManagerBody must exist');
  const bodySource = readFileSync(bodyUrl, 'utf8');

  assert.ok(appSource.includes("const ProjectDashboardManagerBody = lazy(() => import('./project/ProjectDashboardManagerBody.jsx'));"));
  assert.ok(appSource.includes('(backendCommandAvailable || isManagerDemoProject(activeProject)) &&'));
  assert.ok(appSource.includes('<ProjectDashboardManagerBody'));

  const children = [
    'ProjectDashboardManagerCorePanels',
    'ProjectDashboardWorkLoopPanels',
    'ProjectDashboardManagerBackendStationRegion',
    'ProjectDashboardManagerCollaborationBody',
  ];
  for (const component of children) {
    assert.ok(bodySource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`));
    assert.ok(bodySource.includes(`<${component}`));
  }
  assert.ok(bodySource.indexOf('<ProjectDashboardManagerCorePanels') < bodySource.indexOf('<ProjectDashboardWorkLoopPanels'));
  assert.ok(bodySource.indexOf('<ProjectDashboardWorkLoopPanels') < bodySource.indexOf('<ProjectDashboardManagerBackendStationRegion'));
  assert.ok(bodySource.indexOf('<ProjectDashboardManagerBackendStationRegion') < bodySource.indexOf('<ProjectDashboardManagerCollaborationBody'));
  assert.ok(bodySource.includes('<Suspense fallback={stationFallback}>'));

  for (const operation of [
    'onSubmitAssignment: submitManagerLeaderAssignment',
    'onRunAgentPulse: runBackendAgentPulse',
    "onStart: () => runBackendSchedulerAction('start')",
    'onSyncTimeline: () => syncBackendTimelineAndEvents({ silent: false, projectId: activeProject.id })',
    'workerSyncDisabled: backendWorkerStationSyncDisabled',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain ${operation}`);
  }
});
