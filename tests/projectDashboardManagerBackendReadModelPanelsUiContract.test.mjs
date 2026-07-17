import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerBackendReadModelPanels.jsx', import.meta.url);
const regionSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationRegion.jsx', import.meta.url), 'utf8');
const stationContentSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationContent.jsx', import.meta.url), 'utf8');

test('Manager backend read-model panels share one lazy assembly while Scheduler Controls and operations stay in App', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerBackendReadModelPanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardManagerBackendStationRegion = lazy(() => import('./ProjectDashboardManagerBackendStationRegion.jsx'));"));
  assert.ok(stationContentSource.includes("const ProjectDashboardManagerBackendReadModelPanels = lazy(() => import('./ProjectDashboardManagerBackendReadModelPanels.jsx'));"));
  assert.ok(stationContentSource.includes('<ProjectDashboardManagerBackendReadModelPanels'));

  for (const component of [
    'ProjectDashboardManagerBackendSnapshotPanels',
    'ProjectDashboardManagerBackendActivityPanels',
  ]) {
    assert.ok(assemblySource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`));
    assert.ok(assemblySource.includes(`<${component}`));
  }
  assert.ok(assemblySource.indexOf('<ProjectDashboardManagerBackendSnapshotPanels') < assemblySource.indexOf('<ProjectDashboardManagerBackendActivityPanels'));

  for (const operation of [
    'onRunHandoffIntent: () => runCollaborationIntentQueueRow(backendMissionHandoffIntentRow)',
    'onRunSubmissionReview: runBackendSubmissionReview',
    'onRunLoop: runAutonomousRunControlLoop',
    'onRunRow: runAgentAutonomousActionQueueRow',
    'commandDisabled: !backendCommandAvailable || backendStation.loading',
    'runDisabled: !backendCommandAvailable || backendStation.loading',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain ${operation}`);
  }

  const readModelPanels = regionSource.indexOf('<ProjectDashboardManagerBackendStationContent');
  const schedulerControls = regionSource.indexOf('<ProjectDashboardBackendSchedulerControls', readModelPanels);
  assert.ok(readModelPanels !== -1 && schedulerControls > readModelPanels, 'Backend Scheduler Controls must remain after the read-model assembly');
});
