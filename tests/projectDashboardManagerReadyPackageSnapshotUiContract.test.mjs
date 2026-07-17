import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageSnapshot.jsx', import.meta.url);
const stationRegionSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationRegion.jsx', import.meta.url), 'utf8');
const stationContentSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationContent.jsx', import.meta.url), 'utf8');
const backendReadModelPanelsSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendReadModelPanels.jsx', import.meta.url), 'utf8');

test('Manager Ready Package snapshot shares one lazy assembly while every operation stays in App', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerReadyPackageSnapshot must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardManagerBackendStationRegion = lazy(() => import('./ProjectDashboardManagerBackendStationRegion.jsx'));"));
  assert.ok(stationRegionSource.includes("const ProjectDashboardManagerBackendStationContent = lazy(() => import('./ProjectDashboardManagerBackendStationContent.jsx'));"));
  assert.ok(stationContentSource.includes("const ProjectDashboardManagerReadyPackageSnapshot = lazy(() => import('./ProjectDashboardManagerReadyPackageSnapshot.jsx'));"));
  assert.ok(stationContentSource.includes('<ProjectDashboardManagerReadyPackageSnapshot'));
  assert.ok(appSource.includes('readyPackage: backendManagerReadyPackage ? {'));

  for (const component of [
    'ProjectDashboardManagerReadyPackageCorePanels',
    'ProjectDashboardManagerReadyPackageOperationalPanels',
  ]) {
    assert.ok(assemblySource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`));
    assert.ok(assemblySource.includes(`<${component}`));
  }
  assert.ok(assemblySource.includes('if (!view) return null;'));
  assert.ok(assemblySource.includes('data-testid="backend-manager-ready-package-snapshot"'));
  assert.ok(assemblySource.includes('Manager Ready Package'));
  assert.ok(assemblySource.indexOf('<ProjectDashboardManagerReadyPackageCorePanels') < assemblySource.indexOf('<ProjectDashboardManagerReadyPackageOperationalPanels'));

  for (const operation of [
    'onRunNextStep: runLaunchOperationsNextStep',
    'onRecordPrivatePilotReceipt: runBackendPrivatePilotReceipt',
    'onRecordProductionControlReceipt: runBackendProductionControlReceipt',
    'onRunManagedInfrastructureCutoverAttestation: runManagedInfrastructureCutoverAttestation',
    'runMvpReadinessOperatorAction,',
    'recordPrivatePilotDisabled: !backendCommandAvailable || backendStation.loading',
    'recordProductionControlDisabled: !backendCommandAvailable || backendStation.loading',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain ${operation}`);
  }

  const readyPackageSnapshot = stationContentSource.indexOf('<ProjectDashboardManagerReadyPackageSnapshot');
  const backendSnapshotPanels = stationContentSource.indexOf('<ProjectDashboardManagerBackendReadModelPanels', readyPackageSnapshot);
  assert.ok(backendReadModelPanelsSource.includes('<ProjectDashboardManagerBackendSnapshotPanels'));
  assert.ok(readyPackageSnapshot !== -1 && backendSnapshotPanels > readyPackageSnapshot, 'Manager backend snapshot panels must remain after the Ready Package snapshot');
});
