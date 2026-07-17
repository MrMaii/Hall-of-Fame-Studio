import React, { lazy, Suspense } from 'react';

const ProjectDashboardProductTeamOperatingLoop = lazy(() => import('./ProjectDashboardProductTeamOperatingLoop.jsx'));
const ProjectDashboardPlannerExecutorReviewer = lazy(() => import('./ProjectDashboardPlannerExecutorReviewer.jsx'));
const ProjectDashboardTeamCollaborationDiagnostics = lazy(() => import('./ProjectDashboardTeamCollaborationDiagnostics.jsx'));

export default function ProjectDashboardManagerReadyPackageCoordinationPanels({
  fallback,
  managerProofModelSyncButton,
  managerReadModelSourceClass,
  managerReadModelSourceLabel,
  operatingLoop,
  plannerExecutorReviewer,
  projectId,
  projectText,
  readyPackage,
  teamCollaborationDiagnostics,
}) {
  return (
    <>
      {operatingLoop && (
        <Suspense fallback={fallback}>
          <ProjectDashboardProductTeamOperatingLoop
            view={{
              model: operatingLoop,
              routePath: operatingLoop.backendRoutes?.productTeamOperatingLoop || readyPackage.backendRoutes?.productTeamOperatingLoop || `/projects/${projectId}/product-team-operating-loop`,
              sourceBadge: (
                <span data-testid="backend-product-team-operating-loop-source" className={`node-status-tag ${managerReadModelSourceClass(operatingLoop)}`}>
                  {managerReadModelSourceLabel(operatingLoop)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(operatingLoop, 'backend-product-team-operating-loop-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {plannerExecutorReviewer && (
        <Suspense fallback={fallback}>
          <ProjectDashboardPlannerExecutorReviewer
            view={{
              model: plannerExecutorReviewer,
              routePath: plannerExecutorReviewer.backendRoutes?.plannerExecutorReviewerStateMachine || readyPackage?.backendRoutes?.plannerExecutorReviewerStateMachine || `/projects/${projectId}/planner-executor-reviewer-state-machine`,
              sourceBadge: (
                <span data-testid="backend-planner-executor-reviewer-state-machine-source" className={`node-status-tag ${managerReadModelSourceClass(plannerExecutorReviewer)}`}>
                  {managerReadModelSourceLabel(plannerExecutorReviewer)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(plannerExecutorReviewer, 'backend-planner-executor-reviewer-state-machine-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {teamCollaborationDiagnostics && (
        <Suspense fallback={fallback}>
          <ProjectDashboardTeamCollaborationDiagnostics
            view={{
              model: teamCollaborationDiagnostics,
              routePath: teamCollaborationDiagnostics.backendRoutes?.teamCollaborationDiagnostics || readyPackage.backendRoutes?.teamCollaborationDiagnostics || `/projects/${projectId}/team-collaboration-diagnostics`,
              sourceBadge: (
                <span data-testid="backend-team-collaboration-diagnostics-source" className={`node-status-tag ${managerReadModelSourceClass(teamCollaborationDiagnostics)}`}>
                  {managerReadModelSourceLabel(teamCollaborationDiagnostics)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(teamCollaborationDiagnostics, 'backend-team-collaboration-diagnostics-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
    </>
  );
}
