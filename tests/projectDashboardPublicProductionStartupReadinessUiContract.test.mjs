import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const launchPanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx', import.meta.url);
const componentUrl = new URL('../src/project/ProjectDashboardPublicProductionStartupReadiness.jsx', import.meta.url);

test('Public Production Startup Readiness stays lazy and retains every detailed production domain', () => {
  assert.ok(existsSync(componentUrl), 'Public Production Startup Readiness component must exist');
  assert.ok(existsSync(launchPanelsUrl), 'Manager Ready Package launch readiness panels component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const launchPanelsSource = readFileSync(launchPanelsUrl, 'utf8');

  assert.ok(operationalAssemblySource.includes("const ProjectDashboardManagerReadyPackageLaunchReadinessPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx'))"));
  assert.ok(launchPanelsSource.includes("const ProjectDashboardPublicProductionStartupReadiness = lazy(() => import('./ProjectDashboardPublicProductionStartupReadiness.jsx'));"));
  assert.ok(launchPanelsSource.includes('<ProjectDashboardPublicProductionStartupReadiness'));
  assert.ok(launchPanelsSource.includes('{publicProductionStartupReadiness && ('));
  assert.ok(launchPanelsSource.includes('summary={'));
  assert.ok(launchPanelsSource.includes('<ProjectDashboardPublicProductionStartupSummary'));
  assert.ok(launchPanelsSource.includes("readyPackage.backendRoutes?.publicProductionStartupReadiness"));

  for (const contract of [
    'backend-public-production-startup-readiness-snapshot',
    'backend-managed-identity-startup-readiness',
    'backend-production-cost-control-startup-readiness',
    'backend-production-data-governance-startup-readiness',
    'backend-production-traffic-startup-readiness',
    'backend-production-customer-acceptance-startup-readiness',
    'backend-managed-secret-manager-readiness',
    'backend-managed-infrastructure-cutover-readiness',
    'backend-production-operations-startup-readiness',
    'backend-production-environment-setup-matrix',
    'backend-public-production-action-plan',
    'backend-public-production-action-plan-validation-commands',
    'Public startup route',
  ]) {
    assert.ok(componentSource.includes(contract), `Public Production Startup Readiness must keep ${contract}`);
  }
});
