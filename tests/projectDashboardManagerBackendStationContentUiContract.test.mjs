import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerBackendStationContent.jsx', import.meta.url);
const regionSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationRegion.jsx', import.meta.url), 'utf8');

test('Manager backend station content shares one lazy assembly while the outer station, Scheduler Controls, and operations stay in App', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerBackendStationContent must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardManagerBackendStationRegion = lazy(() => import('./ProjectDashboardManagerBackendStationRegion.jsx'));"));
  assert.ok(regionSource.includes('data-testid="backend-worker-station"'));
  assert.ok(regionSource.includes("const ProjectDashboardManagerBackendStationContent = lazy(() => import('./ProjectDashboardManagerBackendStationContent.jsx'));"));
  assert.ok(regionSource.includes('<ProjectDashboardManagerBackendStationContent'));

  for (const component of [
    'ProjectDashboardManagerWorkerStationPanels',
    'ProjectDashboardManagerReadyPackageSnapshot',
    'ProjectDashboardManagerBackendReadModelPanels',
  ]) {
    assert.ok(assemblySource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`));
    assert.ok(assemblySource.includes(`<${component}`));
  }

  const workerStation = assemblySource.indexOf('<ProjectDashboardManagerWorkerStationPanels');
  const readyPackage = assemblySource.indexOf('<ProjectDashboardManagerReadyPackageSnapshot');
  const readModel = assemblySource.indexOf('<ProjectDashboardManagerBackendReadModelPanels');
  assert.ok(workerStation !== -1 && readyPackage > workerStation && readModel > readyPackage, 'Station content must keep Worker Station, Ready Package, then Backend Read Model order');

  for (const operation of [
    'onSaveBaseUrl: saveBackendBaseUrl',
    'onRunNextStep: runLaunchOperationsNextStep',
    'onRunLoop: runAutonomousRunControlLoop',
    "onStart: () => runBackendSchedulerAction('start')",
    'workerSyncDisabled: backendWorkerStationSyncDisabled',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain ${operation}`);
  }

  const stationContent = regionSource.indexOf('<ProjectDashboardManagerBackendStationContent');
  const schedulerControls = regionSource.indexOf('<ProjectDashboardBackendSchedulerControls', stationContent);
  assert.ok(stationContent !== -1 && schedulerControls > stationContent, 'Backend Scheduler Controls must remain after the station-content assembly');
});
