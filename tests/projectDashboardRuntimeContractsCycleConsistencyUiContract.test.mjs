import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const coreAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const runtimePanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageRuntimePanels.jsx', import.meta.url);
const runtimeContractsUrl = new URL('../src/project/ProjectDashboardRuntimeContracts.jsx', import.meta.url);
const cycleConsistencyUrl = new URL('../src/project/ProjectDashboardAutonomousCycleConsistency.jsx', import.meta.url);

test('Dashboard runtime contracts and cycle consistency stay lazy and keep backend proof details', () => {
  const runtimePanelsSource = readFileSync(runtimePanelsUrl, 'utf8');
  assert.ok(coreAssemblySource.includes("const ProjectDashboardManagerReadyPackageRuntimePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageRuntimePanels.jsx'))"));
  assert.ok(runtimePanelsSource.includes("const ProjectDashboardRuntimeContracts = lazy(() => import('./ProjectDashboardRuntimeContracts.jsx'))"));
  assert.ok(runtimePanelsSource.includes("const ProjectDashboardAutonomousCycleConsistency = lazy(() => import('./ProjectDashboardAutonomousCycleConsistency.jsx'))"));
  assert.ok(runtimePanelsSource.includes('<ProjectDashboardRuntimeContracts'));
  assert.ok(runtimePanelsSource.includes('<ProjectDashboardAutonomousCycleConsistency'));
  assert.ok(existsSync(runtimePanelsUrl), 'Manager Ready Package runtime panels component must exist');
  assert.ok(existsSync(runtimeContractsUrl), 'Dashboard runtime contracts component must exist');
  assert.ok(existsSync(cycleConsistencyUrl), 'Dashboard autonomous cycle consistency component must exist');

  const runtimeContractsSource = readFileSync(runtimeContractsUrl, 'utf8');
  for (const publicContract of [
    'backend-runtime-contracts-snapshot',
    'Runtime Contracts',
    'readyForLocalPilotContractFreeze',
    'frozenLocalContractCount',
    'failedLocalContractCount',
    'coveredArtifactTypeCount',
    'requiredArtifactTypeCount',
    'productionBlockerCount',
    'backend-runtime-contracts-rows',
    'row.productionBlocker',
    'backend-runtime-contracts-route',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(runtimeContractsSource.includes(publicContract), `Dashboard runtime contracts must keep ${publicContract}`);
  }

  const cycleConsistencySource = readFileSync(cycleConsistencyUrl, 'utf8');
  for (const publicContract of [
    'backend-autonomous-cycle-consistency-snapshot',
    'Autonomous Cycle Consistency',
    'readyForLocalPilotCycleConsistency',
    'observedStepCount',
    'requiredStepCount',
    'missingRunReceiptCount',
    'workerDeadLetterCount',
    'backend-autonomous-cycle-consistency-rows',
    'row.productionBlocker',
    'backend-autonomous-cycle-consistency-route',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(cycleConsistencySource.includes(publicContract), `Dashboard cycle consistency must keep ${publicContract}`);
  }

  assert.ok(runtimePanelsSource.includes('model: runtimeContracts'));
  assert.ok(runtimePanelsSource.includes('model: autonomousCycleConsistency'));
  assert.ok(runtimePanelsSource.includes("managerProofModelSyncButton(runtimeContracts, 'backend-runtime-contracts-sync-proof-models')"));
  assert.ok(runtimePanelsSource.includes("managerProofModelSyncButton(autonomousCycleConsistency, 'backend-autonomous-cycle-consistency-sync-proof-models')"));
  assert.ok(runtimePanelsSource.includes('runtimeContracts.backendRoutes?.runtimeContracts'));
  assert.ok(runtimePanelsSource.includes('autonomousCycleConsistency.backendRoutes?.autonomousCycleConsistency'));
});
