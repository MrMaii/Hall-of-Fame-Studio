import React, { Suspense, lazy } from 'react';

const ProjectDashboardCollaborationHealth = lazy(() => import('./ProjectDashboardCollaborationHealth.jsx'));
const ProjectDashboardSampleFixturePath = lazy(() => import('./ProjectDashboardSampleFixturePath.jsx'));
const ProjectDashboardLeaderAssignmentFlow = lazy(() => import('./ProjectDashboardLeaderAssignmentFlow.jsx'));
const ProjectDashboardTeamWorkspacePanels = lazy(() => import('./ProjectDashboardTeamWorkspacePanels.jsx'));

export default function ProjectDashboardCoordinationTeamPanels({ view }) {
  return (
    <>
      <Suspense fallback={<div data-testid="project-dashboard-collaboration-health-loading" className="min-h-48" role="status" aria-label="正在加载团队协作健康状态" />}>
        <ProjectDashboardCollaborationHealth view={view.collaborationHealthView} />
      </Suspense>

      {view.showSampleFixturePath && (
        <Suspense fallback={<div data-testid="project-dashboard-sample-fixture-path-loading" className="min-h-40" role="status" aria-label="正在加载示例项目操作步骤" />}>
          <ProjectDashboardSampleFixturePath view={view.sampleFixturePathView} />
        </Suspense>
      )}

      {((view.leaderAssignmentFlowView.assignmentDerivedFrontendRowsAllowed && view.leaderAssignmentFlowView.assignmentFlowRows.length > 0)
        || view.leaderAssignmentFlowView.assignmentTimelineRows.length > 0
        || view.leaderAssignmentFlowView.assignmentTimelineMatrix.frontendMockSuppressed) && (
        <Suspense fallback={<div data-testid="project-dashboard-leader-assignment-flow-loading" className="min-h-96" role="status" aria-label="正在加载 Leader 任务分配流程" />}>
          <ProjectDashboardLeaderAssignmentFlow view={view.leaderAssignmentFlowView} />
        </Suspense>
      )}

      <Suspense fallback={view.teamWorkspaceFallback}>
        <ProjectDashboardTeamWorkspacePanels
          activeThreadsView={view.activeThreadsView}
          teamView={view.teamView}
        />
      </Suspense>
    </>
  );
}
