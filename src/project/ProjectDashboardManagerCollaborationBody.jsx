import React, { Suspense, lazy } from 'react';

const ProjectDashboardEventLedger = lazy(() => import('./ProjectDashboardEventLedger.jsx'));
const ProjectDashboardKickoffCollaborationPanels = lazy(() => import('./ProjectDashboardKickoffCollaborationPanels.jsx'));
const ProjectDashboardCollaborationOperationsPanels = lazy(() => import('./ProjectDashboardCollaborationOperationsPanels.jsx'));
const ProjectDashboardManagerProofMap = lazy(() => import('./ProjectDashboardManagerProofMap.jsx'));
const ProjectDashboardCoordinationTeamPanels = lazy(() => import('./ProjectDashboardCoordinationTeamPanels.jsx'));

export default function ProjectDashboardManagerCollaborationBody({ view }) {
  return (
    <>
      {(view.eventLedgerDisplayRows.length > 0 || view.eventLedgerReadModel.frontendMockSuppressed) && (
        <Suspense fallback={<div data-testid="project-dashboard-event-ledger-loading" className="min-h-64" role="status" aria-label="正在加载统一事件记录" />}>
          <ProjectDashboardEventLedger view={view.eventLedgerView} />
        </Suspense>
      )}

      <ProjectDashboardKickoffCollaborationPanels view={view.kickoffCollaborationView} />
      <ProjectDashboardCollaborationOperationsPanels view={view.collaborationOperationsView} />

      <Suspense fallback={<div data-testid="project-dashboard-manager-proof-map-loading" className="min-h-96" role="status" aria-label="正在加载经理证明图" />}>
        <ProjectDashboardManagerProofMap view={view.managerProofMapView} />
      </Suspense>

      <Suspense fallback={view.coordinationTeamFallback}>
        <ProjectDashboardCoordinationTeamPanels view={view.coordinationTeamView} />
      </Suspense>
    </>
  );
}
