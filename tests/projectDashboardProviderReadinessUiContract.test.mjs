import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProviderReadiness.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLocalReadinessPanels.jsx', import.meta.url);

test('Dashboard provider readiness stays lazy and keeps local controls, cost, failure, vault, safety, and route status', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package local readiness wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardProviderReadiness = lazy(() => import('./ProjectDashboardProviderReadiness.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProviderReadiness'));
  assert.ok(existsSync(componentUrl), 'Dashboard provider readiness component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-provider-readiness-snapshot',
    'Provider Readiness',
    'backend-provider-readiness-source',
    'Local Contract Ready',
    'Needs Provider Work',
    'Provider Searches',
    'Evidence Sources',
    'Provider Receipts',
    'Local Controls',
    'Daily Cost',
    'Draft Quality',
    'Human Review',
    'Failure Control',
    'Open Circuits',
    'Retry Attempts',
    'Secret Vault',
    'Vault Records',
    'Vault Rotation',
    'Source Safety',
    'Blocked Sources',
    'Response Leaks',
    'provider-gap-',
    'Provider route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard provider readiness must keep ${publicContract}`);
  }

  for (const appContract of [
    'providerReadinessAvailable: readyPackageModelAvailable(backendProviderReadiness)',
    'providerReadiness: backendProviderReadiness',
    'managerReadyPackage: backendManagerReadyPackage',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard provider readiness must keep ${appContract} in App.jsx`);
  }
  assert.ok(wrapperSource.includes('backendProviderReadiness: providerReadiness,'));
  assert.ok(wrapperSource.includes('backendManagerReadyPackage: managerReadyPackage,'));
});
