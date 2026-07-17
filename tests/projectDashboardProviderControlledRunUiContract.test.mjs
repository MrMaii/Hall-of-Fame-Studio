import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProviderControlledRun.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLocalReadinessPanels.jsx', import.meta.url);

test('Dashboard provider controlled run stays lazy and keeps budgets, proofs, governance, redaction, plan rows, and route', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package local readiness wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardProviderControlledRun = lazy(() => import('./ProjectDashboardProviderControlledRun.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProviderControlledRun'));
  assert.ok(existsSync(componentUrl), 'Dashboard provider controlled run component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-provider-controlled-run-snapshot',
    'Provider Controlled Run',
    'backend-provider-controlled-run-source',
    'Controlled Run Ready',
    'Run Blocked',
    'Operations',
    'Blocked Ops',
    'Estimated Cost',
    'Budget Left',
    'Hourly Left',
    'Model Proof',
    'Search Proof',
    'Human Review',
    'Evidence Gov',
    'Redaction',
    'provider-controlled-run-row-',
    'Controlled run route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard provider controlled run must keep ${publicContract}`);
  }

  for (const appContract of [
    'providerControlledRunAvailable: readyPackageModelAvailable(backendProviderControlledRun)',
    'providerControlledRun: backendProviderControlledRun',
    'managerReadyPackage: backendManagerReadyPackage',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard provider controlled run must keep ${appContract} in App.jsx`);
  }
  assert.ok(wrapperSource.includes('backendProviderControlledRun: providerControlledRun,'));
  assert.ok(wrapperSource.includes('backendManagerReadyPackage: managerReadyPackage,'));
});
