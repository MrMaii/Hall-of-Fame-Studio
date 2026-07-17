import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const launchPanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx', import.meta.url);
const componentUrl = new URL('../src/project/ProjectDashboardProductionLaunchProofPanels.jsx', import.meta.url);

test('production launch proof panels stay lazy while App retains proof sync helpers and routes', () => {
  assert.ok(existsSync(componentUrl), 'Production launch proof panels component must exist');
  assert.ok(existsSync(launchPanelsUrl), 'Manager Ready Package launch readiness panels component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const launchPanelsSource = readFileSync(launchPanelsUrl, 'utf8');

  assert.ok(operationalAssemblySource.includes("const ProjectDashboardManagerReadyPackageLaunchReadinessPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx'))"));
  assert.ok(launchPanelsSource.includes("const ProjectDashboardProductionLaunchProofPanels = lazy(() => import('./ProjectDashboardProductionLaunchProofPanels.jsx'));"));
  assert.ok(launchPanelsSource.includes('<ProjectDashboardProductionLaunchProofPanels'));
  assert.ok(launchPanelsSource.includes('proofSyncButton={managerProofModelSyncButton}'));
  assert.ok(launchPanelsSource.includes('sourceBadge={managerReadModelSourceBadge}'));
  assert.ok(launchPanelsSource.includes('sourceClass={managerReadModelSourceClass}'));
  assert.ok(launchPanelsSource.includes('sourceLabel={managerReadModelSourceLabel}'));
  for (const route of [
    'readyPackage.backendRoutes?.productionLaunchGapRegister',
    'readyPackage.backendRoutes?.productionLaunchControlCenter',
    'readyPackage.backendRoutes?.productionLaunchEvidenceDossier',
    'readyPackage.backendRoutes?.productionEvidenceIntegrityAudit',
  ]) {
    assert.ok(launchPanelsSource.includes(route), `Launch readiness wrapper must retain route source ${route}`);
  }

  for (const contract of [
    'backend-production-launch-gap-register-snapshot',
    'backend-production-launch-gap-register-sync-proof-models',
    'backend-production-launch-control-center-snapshot',
    'backend-production-launch-control-center-sync-proof-models',
    'backend-production-launch-evidence-dossier-snapshot',
    'backend-production-launch-evidence-dossier-sync-proof-models',
    'backend-production-evidence-integrity-audit-snapshot',
    'backend-production-evidence-integrity-audit-sync-proof-models',
    'Gap register route',
    'Control center route',
    'Dossier route',
    'Evidence integrity route',
  ]) {
    assert.ok(componentSource.includes(contract), `Production launch proof panels must keep ${contract}`);
  }
});
