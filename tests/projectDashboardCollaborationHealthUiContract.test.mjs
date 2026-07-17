import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardCoordinationTeamPanels.jsx', import.meta.url), 'utf8');
const collaborationHealthUrl = new URL('../src/project/ProjectDashboardCollaborationHealth.jsx', import.meta.url);

test('Dashboard Collaboration Health stays lazy and keeps score, checks, and proof-model sync', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardCollaborationHealth = lazy(() => import('./ProjectDashboardCollaborationHealth.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardCollaborationHealth'));
  assert.ok(existsSync(collaborationHealthUrl), 'Dashboard Collaboration Health component must exist');

  const componentSource = readFileSync(collaborationHealthUrl, 'utf8');
  for (const publicContract of [
    'Collaboration Health',
    'collaboration-health-source',
    'collaboration-health-backend-required',
    'collaboration-health-sync-diagnostics',
    'Backend Team Collaboration Diagnostics required',
    'Sync Proof Models',
    'onSyncDiagnostics',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Collaboration Health must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('health: collaborationHealth'));
  assert.ok(appSource.includes('onSyncDiagnostics: () => syncBackendReadyPackageSubmodels'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
});
