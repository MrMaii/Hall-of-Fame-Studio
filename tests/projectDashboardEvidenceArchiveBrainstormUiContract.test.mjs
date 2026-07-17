import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const coreAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const evidencePanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageEvidencePanels.jsx', import.meta.url);
const evidenceArchiveUrl = new URL('../src/project/ProjectDashboardProjectEvidenceArchive.jsx', import.meta.url);
const brainstormLayerUrl = new URL('../src/project/ProjectDashboardBrainstormLayer.jsx', import.meta.url);

test('Dashboard evidence archive and brainstorm layer stay lazy and preserve visible proof details', () => {
  const evidencePanelsSource = readFileSync(evidencePanelsUrl, 'utf8');
  assert.ok(coreAssemblySource.includes("const ProjectDashboardManagerReadyPackageEvidencePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageEvidencePanels.jsx'))"));
  assert.ok(evidencePanelsSource.includes("const ProjectDashboardProjectEvidenceArchive = lazy(() => import('./ProjectDashboardProjectEvidenceArchive.jsx'))"));
  assert.ok(evidencePanelsSource.includes("const ProjectDashboardBrainstormLayer = lazy(() => import('./ProjectDashboardBrainstormLayer.jsx'))"));
  assert.ok(evidencePanelsSource.includes('<ProjectDashboardProjectEvidenceArchive'));
  assert.ok(evidencePanelsSource.includes('<ProjectDashboardBrainstormLayer'));
  assert.ok(existsSync(evidencePanelsUrl), 'Manager Ready Package evidence panels component must exist');
  assert.ok(existsSync(evidenceArchiveUrl), 'Dashboard project evidence archive component must exist');
  assert.ok(existsSync(brainstormLayerUrl), 'Dashboard brainstorm layer component must exist');

  const evidenceArchiveSource = readFileSync(evidenceArchiveUrl, 'utf8');
  for (const publicContract of [
    'backend-project-evidence-archive-snapshot',
    'Project Evidence Archive',
    'readyForManagerHandoff',
    'readyManifestEntryCount',
    'submissionCount',
    'finalDeliverableCount',
    'artifactStorageProofCount',
    'workspaceFileProofCount',
    'evidenceSourceReviewDecisionCount',
    'submissionReviewCount',
    'transcriptMessageCount',
    'rawLeakCount',
    'model.checksum',
    "text('Archive route')",
    'routePath',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(evidenceArchiveSource.includes(publicContract), `Dashboard evidence archive must keep ${publicContract}`);
  }

  const brainstormLayerSource = readFileSync(brainstormLayerUrl, 'utf8');
  for (const publicContract of [
    'backend-brainstorm-layer-snapshot',
    'Brainstorm Layer',
    'readyForPrivatePilotBrainstorm',
    'brainstormBoardCount',
    'alternativeCount',
    'participantCount',
    'evidenceSearchCount',
    'downstreamArtifactCount',
    'failedGateCount',
    'proofIdCount',
    'model.rows',
    'row.agentName',
    'row.taskId',
    "text('Brainstorm route')",
    'routePath',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(brainstormLayerSource.includes(publicContract), `Dashboard brainstorm layer must keep ${publicContract}`);
  }

  assert.ok(evidencePanelsSource.includes('model: projectEvidenceArchive'));
  assert.ok(evidencePanelsSource.includes('model: brainstormLayer'));
  assert.ok(evidencePanelsSource.includes("managerProofModelSyncButton(projectEvidenceArchive, 'backend-project-evidence-archive-sync-proof-models')"));
  assert.ok(evidencePanelsSource.includes("managerProofModelSyncButton(brainstormLayer, 'backend-brainstorm-layer-sync-proof-models')"));
  assert.ok(evidencePanelsSource.includes('projectEvidenceArchive.backendRoutes?.projectEvidenceArchive'));
  assert.ok(evidencePanelsSource.includes('brainstormLayer.backendRoutes?.brainstormLayer'));
});
