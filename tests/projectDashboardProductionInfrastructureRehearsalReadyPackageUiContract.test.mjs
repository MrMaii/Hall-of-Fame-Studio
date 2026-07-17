import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const launchPanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx', import.meta.url);
const componentUrl = new URL('../src/project/ProjectDashboardProductionInfrastructureRehearsalReadyPackage.jsx', import.meta.url);

test('ready-package Production Infrastructure Rehearsal stays lazy and keeps full status, routes, and attestation action', () => {
  assert.ok(existsSync(componentUrl), 'ready-package Production Infrastructure Rehearsal component must exist');
  assert.ok(existsSync(launchPanelsUrl), 'Manager Ready Package launch readiness panels component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const launchPanelsSource = readFileSync(launchPanelsUrl, 'utf8');

  assert.ok(operationalAssemblySource.includes("const ProjectDashboardManagerReadyPackageLaunchReadinessPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx'))"));
  assert.ok(launchPanelsSource.includes("const ProjectDashboardProductionInfrastructureRehearsalReadyPackage = lazy(() => import('./ProjectDashboardProductionInfrastructureRehearsalReadyPackage.jsx'));"));
  assert.ok(launchPanelsSource.includes('<ProjectDashboardProductionInfrastructureRehearsalReadyPackage'));
  assert.ok(appSource.includes('onRunManagedInfrastructureCutoverAttestation: runManagedInfrastructureCutoverAttestation'));
  assert.ok(appSource.includes('runDisabled: backendStation.loading || !backendCommandAvailable'));
  assert.ok(launchPanelsSource.includes('sourceClass={managerReadModelSourceClass(productionInfrastructureRehearsal)}'));
  assert.ok(launchPanelsSource.includes('sourceLabel={managerReadModelSourceLabel(productionInfrastructureRehearsal)}'));

  for (const contract of [
    'data-testid="backend-production-infrastructure-rehearsal-snapshot"',
    'data-testid="backend-production-infrastructure-rehearsal-source"',
    'Production Infrastructure Rehearsal',
    'readyForInfrastructureRehearsal',
    'productionReadyCount',
    'adapterGatewayReady',
    'operationsRehearsalReady',
    'managedCutoverGates',
    '.slice(0, 6)',
    'domainRows',
    'data-testid="backend-production-infrastructure-rehearsal-route"',
    'data-testid="backend-managed-infrastructure-cutover-attestation-run"',
    'Request managed cutover attestation',
    'data-testid="backend-managed-infrastructure-cutover-attestation-receipt"',
    'managed-infrastructure-cutover-attestations',
  ]) {
    assert.ok(componentSource.includes(contract), `ready-package Production Infrastructure Rehearsal must keep ${contract}`);
  }
});
