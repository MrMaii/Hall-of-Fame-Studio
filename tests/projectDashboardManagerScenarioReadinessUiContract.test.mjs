import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardCollaborationOperationsPanels.jsx', import.meta.url), 'utf8');
const readinessUrl = new URL('../src/project/ProjectDashboardManagerScenarioReadiness.jsx', import.meta.url);

test('Dashboard Manager Scenario Readiness stays lazy and keeps every readiness check and proof-map sync action', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardManagerScenarioReadiness = lazy(() => import('./ProjectDashboardManagerScenarioReadiness.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerScenarioReadiness'));
  assert.ok(existsSync(readinessUrl), 'Dashboard Manager Scenario Readiness component must exist');

  const componentSource = readFileSync(readinessUrl, 'utf8');
  for (const publicContract of [
    'Manager Scenario Readiness',
    'manager-scenario-readiness-source',
    'manager-scenario-readiness-backend-required',
    'manager-scenario-readiness-sync-proof-map',
    'Backend Readiness Proof Map required',
    'onSyncProofMap',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Manager Scenario Readiness must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('checks: managerReadinessDisplayChecks'));
  assert.ok(appSource.includes('onSyncProofMap: () => syncBackendReadinessProofMap'));
  assert.ok(appSource.includes('proofMap: managerProofMap'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
});
