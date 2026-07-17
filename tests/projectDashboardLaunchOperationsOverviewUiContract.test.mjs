import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardLaunchOperationsOverview.jsx', import.meta.url);

test('Launch Operations Overview stays lazy while App keeps the action callback and routes', () => {
  assert.ok(existsSync(componentUrl), 'Launch Operations Overview component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardLaunchOperationsOverview = lazy(() => import('./ProjectDashboardLaunchOperationsOverview.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardLaunchOperationsOverview'));
  assert.ok(appSource.includes('onRunNextStep: runLaunchOperationsNextStep'));
  assert.ok(appSource.includes("backendLaunchOperationsOverview?.backendRoutes?.launchOperationsOverview"));
  assert.ok(appSource.includes("backendPublicProductionStartupReadiness?.backendRoutes?.publicProductionStartupReadiness"));

  for (const contract of [
    'backend-launch-operations-overview',
    'backend-launch-operations-next-action',
    'backend-launch-operations-private-pilot-status',
    'backend-launch-operations-public-production-status',
    'backend-private-mvp-launch-package',
    'backend-public-production-next-steps',
    'backend-public-production-next-step-receipt',
    'backend-launch-operations-routes',
    'backend-launch-operations-blockers',
    'onRunNextStep(row)',
  ]) {
    assert.ok(componentSource.includes(contract), `Launch Operations Overview must keep ${contract}`);
  }
});
