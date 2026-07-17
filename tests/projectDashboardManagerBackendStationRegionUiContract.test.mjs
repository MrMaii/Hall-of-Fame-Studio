import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const regionUrl = new URL('../src/project/ProjectDashboardManagerBackendStationRegion.jsx', import.meta.url);

test('Manager backend station region stays lazy while its outer marker, child order, scheduler operations, and following collaboration body remain intact', () => {
  assert.ok(existsSync(regionUrl), 'ProjectDashboardManagerBackendStationRegion must exist');
  const regionSource = readFileSync(regionUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardManagerBackendStationRegion = lazy(() => import('./ProjectDashboardManagerBackendStationRegion.jsx'));"));
  assert.ok(managerBodySource.includes('<ProjectDashboardManagerBackendStationRegion'));
  assert.ok(regionSource.includes('data-testid="backend-worker-station"'));
  assert.ok(regionSource.includes('bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6'));

  for (const component of [
    'ProjectDashboardManagerBackendStationContent',
    'ProjectDashboardBackendSchedulerControls',
  ]) {
    assert.ok(regionSource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`));
    assert.ok(regionSource.includes(`<${component}`));
  }
  assert.ok(regionSource.indexOf('<ProjectDashboardManagerBackendStationContent') < regionSource.indexOf('<ProjectDashboardBackendSchedulerControls'));

  for (const operation of [
    'onCheck: refreshBackendSchedulerStatus',
    "onStart: () => runBackendSchedulerAction('start')",
    "onStop: () => runBackendSchedulerAction('stop')",
    'onSyncManagerView: refreshBackendManagerView',
    'onServerPulse: runBackendServerPulse',
    'schedulerControlDisabled: backendStation.loading || !backendUrlConfigured',
    'seedDisabled: backendStation.loading || !canSeedActiveProjectSnapshotToBackend(activeProject)',
    'workerSyncDisabled: backendWorkerStationSyncDisabled',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain ${operation}`);
  }

  const region = managerBodySource.indexOf('<ProjectDashboardManagerBackendStationRegion');
  const collaborationBody = managerBodySource.indexOf('<ProjectDashboardManagerCollaborationBody', region);
  assert.ok(region !== -1 && collaborationBody > region, 'Manager Collaboration Body must remain after the backend station region');
});
