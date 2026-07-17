import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardWorkLoopPanels.jsx', import.meta.url), 'utf8');
const fixedWorkRoutinesUrl = new URL('../src/project/ProjectDashboardFixedWorkRoutines.jsx', import.meta.url);

test('Dashboard Fixed Work Routines stays lazy and keeps every Agent routine detail and sync action', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardWorkLoopPanels = lazy(() => import('./ProjectDashboardWorkLoopPanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardFixedWorkRoutines = lazy(() => import('./ProjectDashboardFixedWorkRoutines.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardFixedWorkRoutines'));
  assert.ok(existsSync(fixedWorkRoutinesUrl), 'Dashboard Fixed Work Routines component must exist');

  const componentSource = readFileSync(fixedWorkRoutinesUrl, 'utf8');
  for (const publicContract of [
    'fixed-work-routines-source',
    'fixed-work-routines-backend-required',
    'fixed-work-routines-sync-cockpit',
    'routine-row-',
    'Routine Checklist',
    'Current Focus',
    'Next Evidence',
    'onSyncCockpit',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Fixed Work Routines must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('rows: routineRows'));
  assert.ok(appSource.includes('onSyncCockpit: () => syncBackendCockpitReadModels'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
});
