import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageEvidencePanels.jsx', import.meta.url);

test('Manager Ready Package evidence panels stay lazy and preserve sources, sync, and proof navigation', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package evidence panels component must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardManagerReadyPackageEvidencePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageEvidencePanels.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerReadyPackageEvidencePanels'));

  const childComponents = [
    'ProjectDashboardProjectEvidenceArchive',
    'ProjectDashboardBrainstormLayer',
    'ProjectDashboardArtifactQualityAudit',
    'ProjectDashboardSubmissionReviewWorkflowSnapshot',
    'ProjectDashboardEvidenceQualityAudit',
    'ProjectDashboardEvidenceIndexReadiness',
    'ProjectDashboardEvidenceSourceReviewWorkflow',
  ];
  let previousMountIndex = -1;
  for (const componentName of childComponents) {
    assert.ok(wrapperSource.includes(`const ${componentName} = lazy(() => import('./${componentName}.jsx'))`));
    const mountIndex = wrapperSource.indexOf(`<${componentName}`);
    assert.ok(mountIndex > previousMountIndex, `${componentName} must keep its original display order`);
    previousMountIndex = mountIndex;
  }

  for (const contract of [
    'model: projectEvidenceArchive',
    'data-testid="backend-project-evidence-archive-source"',
    "managerProofModelSyncButton(projectEvidenceArchive, 'backend-project-evidence-archive-sync-proof-models')",
    'projectEvidenceArchive.backendRoutes?.projectEvidenceArchive',
    'model: brainstormLayer',
    'data-testid="backend-brainstorm-layer-source"',
    "managerProofModelSyncButton(brainstormLayer, 'backend-brainstorm-layer-sync-proof-models')",
    'brainstormLayer.backendRoutes?.brainstormLayer',
    'model: artifactQualityAudit',
    'data-testid="backend-artifact-quality-audit-source"',
    "managerProofModelSyncButton(artifactQualityAudit, 'backend-artifact-quality-audit-sync-proof-models')",
    'artifactQualityAudit.backendRoutes?.artifactQualityAudit',
    'sourceBadge={<span data-testid="backend-submission-review-workflow-source"',
    "syncButton={managerProofModelSyncButton(submissionReviewWorkflow, 'backend-submission-review-workflow-sync-proof-models')}",
    'route={readyPackage.backendRoutes?.submissionReviewWorkflow}',
    'workflow={submissionReviewWorkflow}',
    'model: evidenceQualityAudit',
    'data-testid="backend-evidence-quality-audit-source"',
    "managerProofModelSyncButton(evidenceQualityAudit, 'backend-evidence-quality-audit-sync-proof-models')",
    'evidenceQualityAudit.backendRoutes?.evidenceQualityAudit',
    'model: evidenceIndexReadiness',
    'data-testid="backend-evidence-index-readiness-source"',
    "managerProofModelSyncButton(evidenceIndexReadiness, 'backend-evidence-index-readiness-sync-proof-models')",
    'evidenceIndexReadiness.backendRoutes?.evidenceIndexReadiness',
    'model: evidenceSourceReviewWorkflow',
    'data-testid="backend-evidence-source-review-workflow-source"',
    "managerProofModelSyncButton(evidenceSourceReviewWorkflow, 'backend-evidence-source-review-workflow-sync-proof-models')",
    'evidenceSourceReviewWorkflow.backendRoutes?.evidenceSourceReviewWorkflow',
  ]) {
    assert.ok(wrapperSource.includes(contract), `Evidence panel wrapper must keep ${contract}`);
  }

  assert.ok(appSource.includes('chatProofIdsFromIds,'));
  assert.ok(appSource.includes('onOpenSubmissionReviewChatProof: (proofIds, channelId) => openProjectChatProof(activeProject, proofIds, channelId)'));
  assert.ok(appSource.includes('onOpenSubmissionReviewTimelineProof: openProjectTimelineProof'));
  assert.ok(wrapperSource.includes('onOpenChatProof={onOpenSubmissionReviewChatProof}'));
  assert.ok(wrapperSource.includes('onOpenTimelineProof={onOpenSubmissionReviewTimelineProof}'));
});
