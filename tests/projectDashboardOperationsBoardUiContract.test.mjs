import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardWorkLoopPanels.jsx', import.meta.url), 'utf8');
const operationsBoardUrl = new URL('../src/project/ProjectDashboardOperationsBoard.jsx', import.meta.url);

test('Dashboard 24/7 Operations Board stays lazy and keeps sync, cadence, and Agent queue details', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardWorkLoopPanels = lazy(() => import('./ProjectDashboardWorkLoopPanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardOperationsBoard = lazy(() => import('./ProjectDashboardOperationsBoard.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardOperationsBoard'));
  assert.ok(existsSync(operationsBoardUrl), 'Dashboard Operations Board component must exist');

  const componentSource = readFileSync(operationsBoardUrl, 'utf8');
  for (const publicContract of [
    'operations-board-24-7',
    'agent-state-summary-source',
    'agent-state-summary-backend-required',
    'agent-state-summary-sync-cockpit',
    'operations-agent-',
    'Project Next Run',
    'Project Last Run',
    'Backend Worker',
    'Agent Run Queue',
    'onSyncCockpit',
    'formatRunTime',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Operations Board must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('onSyncCockpit: () => syncBackendCockpitReadModels'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
  assert.ok(appSource.includes('rows: operationsBoardRows'));
});
