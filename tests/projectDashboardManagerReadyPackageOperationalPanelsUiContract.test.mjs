import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const snapshotSource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageSnapshot.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url);

test('Dashboard Manager Ready Package operational panels share one lazy assembly while original order, condition, and operations stay intact', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerReadyPackageOperationalPanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(snapshotSource.includes("const ProjectDashboardManagerReadyPackageOperationalPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageOperationalPanels.jsx'))"));
  assert.ok(snapshotSource.includes('<ProjectDashboardManagerReadyPackageOperationalPanels'));

  const components = [
    'ProjectDashboardProjectEvidenceExportWorkflow',
    'ProjectDashboardManagerReadyPackageLaunchReadinessPanels',
    'ProjectDashboardManagerReadyPackagePilotOperationsPanels',
    'ProjectDashboardManagerReadyPackageLocalReadinessPanels',
    'ProjectDashboardManagerReadyPackageProviderSecurityPanels',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`lazy(() => import('./${component}.jsx'))`), `${component} must stay lazy`);
    assert.ok(assemblySource.includes(`<${component}`), `${component} must remain rendered`);
    assert.ok(!appSource.includes(`lazy(() => import('./project/${component}.jsx'))`), `${component} must leave the application entry`);
    assert.equal(new RegExp(`<${component}(?:\\s|>)`).test(appSource), false, `${component} assembly must leave App`);
  }

  const renderIndexes = components.map(component => assemblySource.indexOf(`<${component}`));
  assert.ok(renderIndexes.every((index, position) => position === 0 || index > renderIndexes[position - 1]), 'Manager Ready Package operational panels must retain their original display order');
  assert.ok(assemblySource.includes('view.projectEvidenceExportWorkflow &&'), 'Project Evidence Export Workflow must retain its display condition');

  for (const retainedOperation of [
    'runBackendPrivatePilotReceipt',
    'runManagedInfrastructureCutoverAttestation',
    'runBackendProductionControlReceipt',
    'runMvpReadinessOperatorAction',
    'managerProofModelSyncButton',
    'readyPackageModelAvailable',
  ]) assert.ok(appSource.includes(retainedOperation), `App must retain ${retainedOperation}`);
});
