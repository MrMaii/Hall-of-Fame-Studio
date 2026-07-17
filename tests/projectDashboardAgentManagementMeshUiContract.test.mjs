import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardCollaborationOperationsPanels.jsx', import.meta.url), 'utf8');
const meshUrl = new URL('../src/project/ProjectDashboardAgentManagementMesh.jsx', import.meta.url);

test('Dashboard Agent Management Mesh stays lazy and keeps leader, peer, timeline, and management-sync operations', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardAgentManagementMesh = lazy(() => import('./ProjectDashboardAgentManagementMesh.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardAgentManagementMesh'));
  assert.ok(existsSync(meshUrl), 'Dashboard Agent Management Mesh component must exist');

  const componentSource = readFileSync(meshUrl, 'utf8');
  for (const publicContract of [
    'agent-management-mesh',
    'agent-management-mesh-source',
    'agent-management-mesh-backend-required',
    'agent-management-mesh-sync-cockpit',
    'peer-management-matrix',
    'peer-management-matrix-',
    'management-mesh-',
    'agent-management-sync-',
    'Management timeline proof',
    'Run Management Sync',
    'onOpenTimelineProof',
    'onRunManagementSync',
    'onSyncCockpit',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Agent Management Mesh must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('mesh: agentManagementMesh'));
  assert.ok(appSource.includes('peerRows: peerManagementMatrixRows'));
  assert.ok(appSource.includes('rows: agentManagementMeshDisplayRows'));
  assert.ok(appSource.includes('onOpenTimelineProof: openProjectTimelineProof'));
  assert.ok(appSource.includes('onRunManagementSync: runBackendManagementSync'));
  assert.ok(appSource.includes('onSyncCockpit: () => syncBackendCockpitReadModels'));
  assert.ok(appSource.includes('commandDisabled: !backendCommandAvailable || backendStation.loading'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
});
