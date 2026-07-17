import React, { lazy, Suspense } from 'react';

const ProjectDashboardProjectEvidenceArchive = lazy(() => import('./ProjectDashboardProjectEvidenceArchive.jsx'));
const ProjectDashboardBrainstormLayer = lazy(() => import('./ProjectDashboardBrainstormLayer.jsx'));
const ProjectDashboardArtifactQualityAudit = lazy(() => import('./ProjectDashboardArtifactQualityAudit.jsx'));
const ProjectDashboardSubmissionReviewWorkflowSnapshot = lazy(() => import('./ProjectDashboardSubmissionReviewWorkflowSnapshot.jsx'));
const ProjectDashboardEvidenceQualityAudit = lazy(() => import('./ProjectDashboardEvidenceQualityAudit.jsx'));
const ProjectDashboardEvidenceIndexReadiness = lazy(() => import('./ProjectDashboardEvidenceIndexReadiness.jsx'));
const ProjectDashboardEvidenceSourceReviewWorkflow = lazy(() => import('./ProjectDashboardEvidenceSourceReviewWorkflow.jsx'));

export default function ProjectDashboardManagerReadyPackageEvidencePanels({
  artifactQualityAudit,
  brainstormLayer,
  chatProofIdsFromIds,
  evidenceIndexReadiness,
  evidenceQualityAudit,
  evidenceSourceReviewWorkflow,
  fallback,
  managerProofModelSyncButton,
  managerReadModelSourceClass,
  managerReadModelSourceLabel,
  onOpenSubmissionReviewChatProof,
  onOpenSubmissionReviewTimelineProof,
  projectEvidenceArchive,
  projectId,
  projectText,
  readyPackage,
  submissionReviewWorkflow,
}) {
  return (
    <>
      {projectEvidenceArchive && (
        <Suspense fallback={fallback}>
          <ProjectDashboardProjectEvidenceArchive
            view={{
              model: projectEvidenceArchive,
              routePath: projectEvidenceArchive.backendRoutes?.projectEvidenceArchive || readyPackage.backendRoutes?.projectEvidenceArchive || `/projects/${projectId}/project-evidence-archive`,
              sourceBadge: (
                <span data-testid="backend-project-evidence-archive-source" className={`node-status-tag ${managerReadModelSourceClass(projectEvidenceArchive)}`}>
                  {managerReadModelSourceLabel(projectEvidenceArchive)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(projectEvidenceArchive, 'backend-project-evidence-archive-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {brainstormLayer && (
        <Suspense fallback={fallback}>
          <ProjectDashboardBrainstormLayer
            view={{
              model: brainstormLayer,
              routePath: brainstormLayer.backendRoutes?.brainstormLayer || readyPackage.backendRoutes?.brainstormLayer || `/projects/${projectId}/brainstorm-layer`,
              sourceBadge: (
                <span data-testid="backend-brainstorm-layer-source" className={`node-status-tag ${managerReadModelSourceClass(brainstormLayer)}`}>
                  {managerReadModelSourceLabel(brainstormLayer)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(brainstormLayer, 'backend-brainstorm-layer-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {artifactQualityAudit && (
        <Suspense fallback={fallback}>
          <ProjectDashboardArtifactQualityAudit
            view={{
              model: artifactQualityAudit,
              routePath: artifactQualityAudit.backendRoutes?.artifactQualityAudit || readyPackage.backendRoutes?.artifactQualityAudit || `/projects/${projectId}/artifact-quality-audit`,
              sourceBadge: (
                <span data-testid="backend-artifact-quality-audit-source" className={`node-status-tag ${managerReadModelSourceClass(artifactQualityAudit)}`}>
                  {managerReadModelSourceLabel(artifactQualityAudit)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(artifactQualityAudit, 'backend-artifact-quality-audit-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {submissionReviewWorkflow && (
        <Suspense fallback={null}>
          <ProjectDashboardSubmissionReviewWorkflowSnapshot
            chatProofIdsFromIds={chatProofIdsFromIds}
            onOpenChatProof={onOpenSubmissionReviewChatProof}
            onOpenTimelineProof={onOpenSubmissionReviewTimelineProof}
            projectId={projectId}
            projectText={projectText}
            route={readyPackage.backendRoutes?.submissionReviewWorkflow}
            sourceBadge={<span data-testid="backend-submission-review-workflow-source" className={`node-status-tag ${managerReadModelSourceClass(submissionReviewWorkflow)}`}>{managerReadModelSourceLabel(submissionReviewWorkflow)}</span>}
            syncButton={managerProofModelSyncButton(submissionReviewWorkflow, 'backend-submission-review-workflow-sync-proof-models')}
            workflow={submissionReviewWorkflow}
          />
        </Suspense>
      )}
      {evidenceQualityAudit && (
        <Suspense fallback={fallback}>
          <ProjectDashboardEvidenceQualityAudit
            view={{
              model: evidenceQualityAudit,
              routePath: evidenceQualityAudit.backendRoutes?.evidenceQualityAudit || readyPackage.backendRoutes?.evidenceQualityAudit || `/projects/${projectId}/evidence-quality-audit`,
              sourceBadge: (
                <span data-testid="backend-evidence-quality-audit-source" className={`node-status-tag ${managerReadModelSourceClass(evidenceQualityAudit)}`}>
                  {managerReadModelSourceLabel(evidenceQualityAudit)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(evidenceQualityAudit, 'backend-evidence-quality-audit-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {evidenceIndexReadiness && (
        <Suspense fallback={fallback}>
          <ProjectDashboardEvidenceIndexReadiness
            view={{
              model: evidenceIndexReadiness,
              routePath: evidenceIndexReadiness.backendRoutes?.evidenceIndexReadiness || `/projects/${projectId}/evidence-index-readiness`,
              sourceBadge: (
                <span data-testid="backend-evidence-index-readiness-source" className={`node-status-tag ${managerReadModelSourceClass(evidenceIndexReadiness)}`}>
                  {managerReadModelSourceLabel(evidenceIndexReadiness)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(evidenceIndexReadiness, 'backend-evidence-index-readiness-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {evidenceSourceReviewWorkflow && (
        <Suspense fallback={fallback}>
          <ProjectDashboardEvidenceSourceReviewWorkflow
            view={{
              model: evidenceSourceReviewWorkflow,
              routePath: evidenceSourceReviewWorkflow.backendRoutes?.evidenceSourceReviewWorkflow || readyPackage.backendRoutes?.evidenceSourceReviewWorkflow || `/projects/${projectId}/evidence-source-review-workflow`,
              sourceBadge: (
                <span data-testid="backend-evidence-source-review-workflow-source" className={`node-status-tag ${managerReadModelSourceClass(evidenceSourceReviewWorkflow)}`}>
                  {managerReadModelSourceLabel(evidenceSourceReviewWorkflow)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(evidenceSourceReviewWorkflow, 'backend-evidence-source-review-workflow-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
    </>
  );
}
