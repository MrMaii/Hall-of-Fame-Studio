import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const coreAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const evidencePanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageEvidencePanels.jsx', import.meta.url);
const indexReadinessUrl = new URL('../src/project/ProjectDashboardEvidenceIndexReadiness.jsx', import.meta.url);
const sourceReviewUrl = new URL('../src/project/ProjectDashboardEvidenceSourceReviewWorkflow.jsx', import.meta.url);

test('Dashboard evidence index and source review stay lazy and preserve visible readiness proof', () => {
  const evidencePanelsSource = readFileSync(evidencePanelsUrl, 'utf8');
  assert.ok(coreAssemblySource.includes("const ProjectDashboardManagerReadyPackageEvidencePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageEvidencePanels.jsx'))"));
  assert.ok(evidencePanelsSource.includes("const ProjectDashboardEvidenceIndexReadiness = lazy(() => import('./ProjectDashboardEvidenceIndexReadiness.jsx'))"));
  assert.ok(evidencePanelsSource.includes("const ProjectDashboardEvidenceSourceReviewWorkflow = lazy(() => import('./ProjectDashboardEvidenceSourceReviewWorkflow.jsx'))"));
  assert.ok(evidencePanelsSource.includes('<ProjectDashboardEvidenceIndexReadiness'));
  assert.ok(evidencePanelsSource.includes('<ProjectDashboardEvidenceSourceReviewWorkflow'));
  assert.ok(existsSync(evidencePanelsUrl), 'Manager Ready Package evidence panels component must exist');
  assert.ok(existsSync(indexReadinessUrl), 'Dashboard evidence index readiness component must exist');
  assert.ok(existsSync(sourceReviewUrl), 'Dashboard evidence source review workflow component must exist');

  const indexReadinessSource = readFileSync(indexReadinessUrl, 'utf8');
  for (const publicContract of [
    'backend-evidence-index-readiness-snapshot',
    'Evidence Index Readiness',
    'readyForLocalMvp',
    'readyForProduction',
    'rowCount',
    'evidenceSearchCount',
    'submissionCount',
    'sourceSnapshotCount',
    'providerReceiptCount',
    'artifactStorageProofCount',
    'proofLinkedCount',
    'proofRouteCount',
    'failedLocalGateCount',
    'failedLocalGates',
    'model.gates',
    'row.passed',
    'row.severity',
    'model.checksum',
    "text('Index route')",
    'routePath',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(indexReadinessSource.includes(publicContract), `Dashboard evidence index readiness must keep ${publicContract}`);
  }

  const sourceReviewSource = readFileSync(sourceReviewUrl, 'utf8');
  for (const publicContract of [
    'backend-evidence-source-review-workflow-snapshot',
    'Evidence Source Review Workflow',
    'readyForLocalPilot',
    'reviewItemCount',
    'decisionRequiredSourceCount',
    'sourceReviewDecisionCount',
    'approvedSourceReviewCount',
    'pendingDecisionSourceCount',
    'reviewRequiredSourceCount',
    'autoClearedSourceCount',
    'blockedSourceCount',
    'proofedReviewItemCount',
    'gateCount',
    'failedGateCount',
    'sourceSafetyReady',
    'reviewQueue',
    'requiredProductionControls',
    'row.reviewerAction',
    'row.proofRoute?.apiPath',
    'model.checksum',
    'Source review route: {routePath}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(sourceReviewSource.includes(publicContract), `Dashboard evidence source review must keep ${publicContract}`);
  }

  assert.ok(evidencePanelsSource.includes('model: evidenceIndexReadiness'));
  assert.ok(evidencePanelsSource.includes('model: evidenceSourceReviewWorkflow'));
  assert.ok(evidencePanelsSource.includes("managerProofModelSyncButton(evidenceIndexReadiness, 'backend-evidence-index-readiness-sync-proof-models')"));
  assert.ok(evidencePanelsSource.includes("managerProofModelSyncButton(evidenceSourceReviewWorkflow, 'backend-evidence-source-review-workflow-sync-proof-models')"));
  assert.ok(evidencePanelsSource.includes('evidenceIndexReadiness.backendRoutes?.evidenceIndexReadiness'));
  assert.ok(evidencePanelsSource.includes('evidenceSourceReviewWorkflow.backendRoutes?.evidenceSourceReviewWorkflow'));
});
