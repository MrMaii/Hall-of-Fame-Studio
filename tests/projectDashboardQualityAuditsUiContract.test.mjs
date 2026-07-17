import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const coreAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const evidencePanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageEvidencePanels.jsx', import.meta.url);
const artifactAuditUrl = new URL('../src/project/ProjectDashboardArtifactQualityAudit.jsx', import.meta.url);
const evidenceAuditUrl = new URL('../src/project/ProjectDashboardEvidenceQualityAudit.jsx', import.meta.url);

test('Dashboard artifact and evidence quality audits stay lazy and preserve visible quality proof', () => {
  const evidencePanelsSource = readFileSync(evidencePanelsUrl, 'utf8');
  assert.ok(coreAssemblySource.includes("const ProjectDashboardManagerReadyPackageEvidencePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageEvidencePanels.jsx'))"));
  assert.ok(evidencePanelsSource.includes("const ProjectDashboardArtifactQualityAudit = lazy(() => import('./ProjectDashboardArtifactQualityAudit.jsx'))"));
  assert.ok(evidencePanelsSource.includes("const ProjectDashboardEvidenceQualityAudit = lazy(() => import('./ProjectDashboardEvidenceQualityAudit.jsx'))"));
  assert.ok(evidencePanelsSource.includes('<ProjectDashboardArtifactQualityAudit'));
  assert.ok(evidencePanelsSource.includes('<ProjectDashboardEvidenceQualityAudit'));
  assert.ok(existsSync(evidencePanelsUrl), 'Manager Ready Package evidence panels component must exist');
  assert.ok(existsSync(artifactAuditUrl), 'Dashboard artifact quality audit component must exist');
  assert.ok(existsSync(evidenceAuditUrl), 'Dashboard evidence quality audit component must exist');

  const artifactAuditSource = readFileSync(artifactAuditUrl, 'utf8');
  for (const publicContract of [
    'backend-artifact-quality-audit-snapshot',
    'Artifact Quality Audit',
    'readyForLocalPilot',
    'coveredArtifactTypeCount',
    'requiredArtifactTypeCount',
    'averageQualityScore',
    'qualityReadyCount',
    'proofReadyCount',
    'reviewCount',
    'revisionCount',
    'generatedDraftQualityReadyCount',
    'failedLocalDecisionGateCount',
    'productionControlCount',
    'requiredArtifactTypes',
    'missingRequiredArtifactTypes',
    'failedLocalDecisionGates',
    'requiredProductionControls',
    'model.checksum',
    'Audit route: {routePath}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(artifactAuditSource.includes(publicContract), `Dashboard artifact quality audit must keep ${publicContract}`);
  }

  const evidenceAuditSource = readFileSync(evidenceAuditUrl, 'utf8');
  for (const publicContract of [
    'backend-evidence-quality-audit-snapshot',
    'Evidence Quality Audit',
    'readyForDecision',
    'rowCount',
    'sourceCount',
    'averageQualityScore',
    'strongEvidenceCount',
    'usableEvidenceCount',
    'sourceSafetyReady',
    'sourceSafetyBlockedSourceCount',
    'readyProofRouteCount',
    'proofRouteCount',
    'gateCount',
    'failedGateCount',
    'failedDecisionGateCount',
    'productionControlCount',
    'failedDecisionGates',
    'requiredProductionControls',
    'row.apiPath',
    'model.checksum',
    'Audit route: {routePath}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(evidenceAuditSource.includes(publicContract), `Dashboard evidence quality audit must keep ${publicContract}`);
  }

  assert.ok(evidencePanelsSource.includes('model: artifactQualityAudit'));
  assert.ok(evidencePanelsSource.includes('model: evidenceQualityAudit'));
  assert.ok(evidencePanelsSource.includes("managerProofModelSyncButton(artifactQualityAudit, 'backend-artifact-quality-audit-sync-proof-models')"));
  assert.ok(evidencePanelsSource.includes("managerProofModelSyncButton(evidenceQualityAudit, 'backend-evidence-quality-audit-sync-proof-models')"));
  assert.ok(evidencePanelsSource.includes('artifactQualityAudit.backendRoutes?.artifactQualityAudit'));
  assert.ok(evidencePanelsSource.includes('evidenceQualityAudit.backendRoutes?.evidenceQualityAudit'));
});
