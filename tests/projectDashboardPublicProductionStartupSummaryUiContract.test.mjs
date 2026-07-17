import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const launchPanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx', import.meta.url);
const componentUrl = new URL('../src/project/ProjectDashboardPublicProductionStartupSummary.jsx', import.meta.url);

test('Public Production Startup summary stays lazy and keeps source, readiness, and all fifteen statistics', () => {
  assert.ok(existsSync(componentUrl), 'Public Production Startup summary component must exist');
  assert.ok(existsSync(launchPanelsUrl), 'Manager Ready Package launch readiness panels component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const launchPanelsSource = readFileSync(launchPanelsUrl, 'utf8');

  assert.ok(operationalAssemblySource.includes("const ProjectDashboardManagerReadyPackageLaunchReadinessPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx'))"));
  assert.ok(launchPanelsSource.includes("const ProjectDashboardPublicProductionStartupSummary = lazy(() => import('./ProjectDashboardPublicProductionStartupSummary.jsx'));"));
  assert.ok(launchPanelsSource.includes('<ProjectDashboardPublicProductionStartupSummary'));
  assert.ok(launchPanelsSource.includes("managerReadModelSourceBadge(publicProductionStartupReadiness, 'backend-public-production-startup-readiness-source')"));
  for (const contract of [
    'Public Production Startup Readiness',
    'readyForPublicProduction',
    'passedGateCount',
    'failedGateCount',
    'failedBlockerGateCount',
    'accessControlEnforced',
    'managedIdentityStartupReady',
    'productionCostControlReady',
    'productionDataGovernanceReady',
    'productionTrafficStartupReady',
    'productionCustomerAcceptanceReady',
    'managedSecretsReady',
    'managedPersistenceReady',
    'managedQueueReady',
    'observabilityReady',
    'nextAction?.id',
    'checksum',
  ]) {
    assert.ok(componentSource.includes(contract), `Public Production Startup summary must keep ${contract}`);
  }
});
