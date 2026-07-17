import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLocalReadinessPanels.jsx', import.meta.url);

test('Manager Ready Package local readiness panels stay lazy while App retains availability and MVP action logic', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package local readiness wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(operationalAssemblySource.includes("const ProjectDashboardManagerReadyPackageLocalReadinessPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageLocalReadinessPanels.jsx'));"));
  assert.ok(operationalAssemblySource.includes('<ProjectDashboardManagerReadyPackageLocalReadinessPanels'));

  for (const contract of [
    'pilotLaunchReadinessAvailable: readyPackageModelAvailable(backendPilotLaunchReadiness)',
    'deploymentPreflightAvailable: readyPackageModelAvailable(backendDeploymentPreflight)',
    'operationsReadinessAvailable: readyPackageModelAvailable(backendOperationsReadiness)',
    'providerReadinessAvailable: readyPackageModelAvailable(backendProviderReadiness)',
    'providerControlledRunAvailable: readyPackageModelAvailable(backendProviderControlledRun)',
    'runMvpReadinessOperatorAction,',
    'mvpReadinessOperatorActionRunReceipt: backendMvpReadinessOperatorActionRunReceipt',
  ]) {
    assert.ok(appSource.includes(contract), `App must retain ${contract}`);
  }

  const imports = [
    'ProjectDashboardPilotLaunchReadiness',
    'ProjectDashboardDeploymentPreflight',
    'ProjectDashboardMvpReadiness',
    'ProjectDashboardOperationsReadiness',
    'ProjectDashboardProviderReadiness',
    'ProjectDashboardProviderControlledRun',
  ];
  for (const component of imports) {
    assert.ok(wrapperSource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`), `${component} must remain lazy`);
    assert.ok(wrapperSource.includes(`<${component}`), `${component} must remain mounted`);
  }

  const mountOrder = imports.map(component => wrapperSource.indexOf(`<${component}`));
  assert.ok(mountOrder.every(index => index >= 0), 'Every local readiness panel must be mounted');
  assert.deepEqual(mountOrder, [...mountOrder].sort((left, right) => left - right), 'Local readiness panels must retain their original order');

  for (const contract of [
    'runMvpReadinessOperatorAction,',
    'managerReadModelSourceBadge,',
    'backendPersistenceAdapterPlan: persistenceAdapterPlan,',
    'backendPersistenceAdapterDryRun: persistenceAdapterDryRun,',
    'backendWorkerQueueAdapterPlan: workerQueueAdapterPlan,',
    'backendWorkerQueueAdapterDryRun: workerQueueAdapterDryRun,',
  ]) {
    assert.ok(wrapperSource.includes(contract), `Local readiness wrapper must retain ${contract}`);
  }
});
