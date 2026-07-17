import React, { lazy, Suspense } from 'react';

const ProjectDashboardSubmissionWorkspace = lazy(() => import('./ProjectDashboardSubmissionWorkspace.jsx'));
const ProjectDashboardManagerReadModelRoutes = lazy(() => import('./ProjectDashboardManagerReadModelRoutes.jsx'));

export default function ProjectDashboardManagerSubmissionRoutePanels({
  activeProject,
  agentAutonomousActionQueue,
  autonomousRunControl,
  chatProofIdsForIds,
  chatProofIdsForRow,
  defaultReviewerId,
  managerActionQueue,
  managerCommandCenter,
  managerDashboard,
  managerRequirementMatrix,
  managerScenarioTrail,
  managerScenarioWalkthrough,
  managerSubmissionReviewRows,
  managerSubmissionReviewRowsBackendRequired,
  onOpenChatProof,
  onOpenTimelineProof,
  onRunSubmissionReview,
  onUpdateReviewDraft,
  proofDisabled,
  reviewDraftFor,
  reviewInputDisabled,
  reviewSubmitDisabled,
  submissionReviewVerdicts,
}) {
  return (
    <>
      <Suspense fallback={<div data-testid="project-dashboard-submission-workspace-loading" className="min-h-64" role="status" aria-label="正在加载提交与复核工作区" />}>
        <ProjectDashboardSubmissionWorkspace
          view={{
            activeProject,
            backendManagerDashboard: managerDashboard,
            managerSubmissionReviewRows,
            managerSubmissionReviewRowsBackendRequired,
            submissionReviewVerdicts,
          }}
          reviewDraftFor={reviewDraftFor}
          defaultReviewerId={defaultReviewerId}
          chatProofIdsForRow={chatProofIdsForRow}
          chatProofIdsForIds={chatProofIdsForIds}
          onUpdateReviewDraft={onUpdateReviewDraft}
          onRunSubmissionReview={onRunSubmissionReview}
          onOpenChatProof={onOpenChatProof}
          onOpenTimelineProof={onOpenTimelineProof}
          reviewInputDisabled={reviewInputDisabled}
          reviewSubmitDisabled={reviewSubmitDisabled}
          proofDisabled={proofDisabled}
        />
      </Suspense>
      <Suspense fallback={<div data-testid="project-dashboard-manager-read-model-routes-loading" className="min-h-20" role="status" aria-label="正在加载管理接口状态" />}>
        <ProjectDashboardManagerReadModelRoutes
          backendManagerDashboard={managerDashboard}
          activeProjectId={activeProject.id}
          backendManagerCommandCenter={managerCommandCenter}
          backendManagerScenarioTrail={managerScenarioTrail}
          backendManagerScenarioWalkthrough={managerScenarioWalkthrough}
          backendManagerRequirementMatrix={managerRequirementMatrix}
          backendManagerActionQueue={managerActionQueue}
          backendAgentAutonomousActionQueue={agentAutonomousActionQueue}
          backendAutonomousRunControl={autonomousRunControl}
        />
      </Suspense>
    </>
  );
}
