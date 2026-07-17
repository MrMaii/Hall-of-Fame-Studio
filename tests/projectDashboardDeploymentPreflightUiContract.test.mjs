import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardDeploymentPreflight.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLocalReadinessPanels.jsx', import.meta.url);

test('Deployment Preflight stays lazy and keeps readiness, adapter, blocker, and route details', () => {
  assert.ok(existsSync(componentUrl), 'Deployment Preflight component must exist');
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package local readiness wrapper must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(wrapperSource.includes("const ProjectDashboardDeploymentPreflight = lazy(() => import('./ProjectDashboardDeploymentPreflight.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardDeploymentPreflight'));
  assert.ok(wrapperSource.includes('gatewayPreflight={adapterGatewayPreflight}'));
  assert.ok(wrapperSource.includes('preflight={deploymentPreflight}'));
  assert.ok(wrapperSource.includes('readyPackage={managerReadyPackage}'));
  assert.ok(appSource.includes('deploymentPreflightAvailable: readyPackageModelAvailable(backendDeploymentPreflight)'));
  for (const contract of [
    'data-testid="backend-deployment-preflight-snapshot"',
    'Deployment Preflight',
    'privatePilotDeploymentReady',
    'failedBlockerGateCount',
    'failedWarningGateCount',
    'schedulerAgentControls',
    'managedPersistence',
    'workerQueue',
    'adapterGatewayPreflight',
    'failedGates?.length',
    'Preflight route:',
    'Gateway route:',
  ]) {
    assert.ok(componentSource.includes(contract), `Deployment Preflight must keep ${contract}`);
  }
});
