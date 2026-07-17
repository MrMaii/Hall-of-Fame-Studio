import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardEvidenceCustodyReadiness.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageProviderSecurityPanels.jsx', import.meta.url);

test('Dashboard evidence custody stays lazy while App keeps source and proof-model sync behavior', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package provider security wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardEvidenceCustodyReadiness = lazy(() => import('./ProjectDashboardEvidenceCustodyReadiness.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardEvidenceCustodyReadiness'));
  assert.ok(existsSync(componentUrl), 'Dashboard evidence custody readiness component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-evidence-custody-readiness-snapshot',
    'Evidence Custody Readiness',
    'production-ready',
    'managed-storage-blocked',
    'Local Custody Ready',
    'Needs Custody Work',
    'sourceBadge',
    'syncProofModelsButton',
    'Gates',
    'Custody Records',
    'Source Snapshots',
    'Provider Receipts',
    'Source Decisions',
    'Persistence Rows',
    'Managed Storage',
    'Production Controls',
    'evidence-custody-gap-',
    'Custody route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard evidence custody must keep ${publicContract}`);
  }

  for (const appContract of [
    'evidenceCustodyAvailable: readyPackageModelAvailable(backendEvidenceCustodyReadiness)',
    'evidenceCustodySourceBadge: (',
    'data-testid="backend-evidence-custody-readiness-source"',
    'managerReadModelSourceClass(backendEvidenceCustodyReadiness)',
    'managerReadModelSourceLabel(backendEvidenceCustodyReadiness)',
    "evidenceCustodySyncProofModelsButton: managerProofModelSyncButton(backendEvidenceCustodyReadiness, 'backend-evidence-custody-readiness-sync-proof-models')",
    'managerReadyPackage: backendManagerReadyPackage',
    'evidenceCustodyReadiness: backendEvidenceCustodyReadiness',
  ]) {
    assert.ok(appSource.includes(appContract), `App must retain evidence custody behavior ${appContract}`);
  }
  assert.ok(wrapperSource.includes('backendEvidenceCustodyReadiness: evidenceCustodyReadiness,'));
  assert.ok(wrapperSource.includes('backendManagerReadyPackage: managerReadyPackage,'));
  assert.ok(wrapperSource.includes('sourceBadge={evidenceCustodySourceBadge}'));
  assert.ok(wrapperSource.includes('syncProofModelsButton={evidenceCustodySyncProofModelsButton}'));
});
