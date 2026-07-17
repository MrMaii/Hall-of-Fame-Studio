import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx', import.meta.url);

test('Manager Ready Package launch readiness panels stay lazy and preserve the original rehearsal action', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package launch readiness panels component must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(operationalAssemblySource.includes("const ProjectDashboardManagerReadyPackageLaunchReadinessPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx'))"));
  assert.ok(operationalAssemblySource.includes('<ProjectDashboardManagerReadyPackageLaunchReadinessPanels'));

  for (const componentName of [
    'ProjectDashboardPrivatePilotGoLiveReadiness',
    'ProjectDashboardProductionInfrastructureRehearsalReadyPackage',
    'ProjectDashboardPublicProductionStartupReadiness',
    'ProjectDashboardPublicProductionStartupSummary',
    'ProjectDashboardProductionLaunchProofPanels',
  ]) {
    assert.ok(wrapperSource.includes(`const ${componentName} = lazy(() => import('./${componentName}.jsx'))`));
    assert.ok(wrapperSource.includes(`<${componentName}`));
  }

  const displayOrder = [
    '<ProjectDashboardPrivatePilotGoLiveReadiness',
    '<ProjectDashboardProductionInfrastructureRehearsalReadyPackage',
    '<ProjectDashboardPublicProductionStartupReadiness',
    '<ProjectDashboardProductionLaunchProofPanels',
  ];
  let previousMountIndex = -1;
  for (const marker of displayOrder) {
    const mountIndex = wrapperSource.indexOf(marker);
    assert.ok(mountIndex > previousMountIndex, `${marker} must keep its original display order`);
    previousMountIndex = mountIndex;
  }

  for (const contract of [
    'backendPrivatePilotGoLiveReadiness: privatePilotGoLiveReadiness',
    'onRunManagedInfrastructureCutoverAttestation={onRunManagedInfrastructureCutoverAttestation}',
    'rehearsal={productionInfrastructureRehearsal}',
    'receipt={managedInfrastructureCutoverAttestationRunReceipt}',
    'sourceClass={managerReadModelSourceClass(productionInfrastructureRehearsal)}',
    'sourceLabel={managerReadModelSourceLabel(productionInfrastructureRehearsal)}',
    'fallbackRoute={readyPackage.backendRoutes?.publicProductionStartupReadiness}',
    'readiness={publicProductionStartupReadiness}',
    "sourceBadge={managerReadModelSourceBadge(publicProductionStartupReadiness, 'backend-public-production-startup-readiness-source')}",
    'controlCenter={productionLaunchControlCenter}',
    'evidenceDossier={productionLaunchEvidenceDossier}',
    'gapRegister={productionLaunchGapRegister}',
    'integrityAudit={productionEvidenceIntegrityAudit}',
    'proofSyncButton={managerProofModelSyncButton}',
    'sourceBadge={managerReadModelSourceBadge}',
  ]) {
    assert.ok(wrapperSource.includes(contract), `Launch readiness wrapper must keep ${contract}`);
  }

  assert.ok(appSource.includes('onRunManagedInfrastructureCutoverAttestation: runManagedInfrastructureCutoverAttestation'));
  assert.ok(appSource.includes('runDisabled: backendStation.loading || !backendCommandAvailable'));
});
