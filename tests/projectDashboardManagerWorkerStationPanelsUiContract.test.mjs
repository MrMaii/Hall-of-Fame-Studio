import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerWorkerStationPanels.jsx', import.meta.url);
const stationRegionSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationRegion.jsx', import.meta.url), 'utf8');
const stationContentSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationContent.jsx', import.meta.url), 'utf8');
const readyPackageSnapshotSource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageSnapshot.jsx', import.meta.url), 'utf8');

test('Manager worker-station panels share one lazy assembly while address, proof, and rehearsal operations stay in App', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerWorkerStationPanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardManagerBackendStationRegion = lazy(() => import('./ProjectDashboardManagerBackendStationRegion.jsx'));"));
  assert.ok(stationRegionSource.includes("const ProjectDashboardManagerBackendStationContent = lazy(() => import('./ProjectDashboardManagerBackendStationContent.jsx'));"));
  assert.ok(stationContentSource.includes("const ProjectDashboardManagerWorkerStationPanels = lazy(() => import('./ProjectDashboardManagerWorkerStationPanels.jsx'));"));
  assert.ok(stationContentSource.includes('<ProjectDashboardManagerWorkerStationPanels'));

  const components = [
    'ProjectDashboardBackendWorkerStationStatus',
    'ProjectDashboardProductionInfrastructureRehearsal',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`));
    assert.ok(assemblySource.includes(`<${component}`));
  }
  assert.ok(assemblySource.indexOf('<ProjectDashboardBackendWorkerStationStatus') < assemblySource.indexOf('<ProjectDashboardProductionInfrastructureRehearsal'));
  assert.ok(assemblySource.includes('view.productionInfrastructureRehearsal &&'));
  assert.ok(assemblySource.includes('view.proofTranscriptRequired &&'));
  assert.ok(assemblySource.includes('data-testid="backend-proof-transcript-required"'));
  assert.ok(assemblySource.includes('view.proofTimelineRequired &&'));
  assert.ok(assemblySource.includes('data-testid="backend-proof-timeline-required"'));

  for (const operation of [
    'onBaseUrlChange: (value) => setBackendStation(prev => ({ ...prev, draftBaseUrl: value }))',
    "onOpenDeployment: () => { setSettingsTab('deployment'); setSettingsOpen(true); }",
    'onSaveBaseUrl: saveBackendBaseUrl',
    'onRunManagedInfrastructureCutoverAttestation: runManagedInfrastructureCutoverAttestation',
    'runDisabled: backendStation.loading || !backendCommandAvailable',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain ${operation}`);
  }
  const workerPanels = stationContentSource.indexOf('<ProjectDashboardManagerWorkerStationPanels');
  const readyPackage = stationContentSource.indexOf('<ProjectDashboardManagerReadyPackageSnapshot', workerPanels);
  assert.ok(readyPackageSnapshotSource.includes('data-testid="backend-manager-ready-package-snapshot"'));
  assert.ok(workerPanels !== -1 && readyPackage > workerPanels, 'Manager Ready Package must remain after the worker-station assembly');
});
