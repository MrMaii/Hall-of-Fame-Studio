import React, { Suspense, lazy } from 'react';

const ProjectDashboardManagerReadModelSummaryPanels = lazy(() => import('./ProjectDashboardManagerReadModelSummaryPanels.jsx'));
const ProjectDashboardAutonomousRunControl = lazy(() => import('./ProjectDashboardAutonomousRunControl.jsx'));
const ProjectDashboardAgentAutonomousActionQueue = lazy(() => import('./ProjectDashboardAgentAutonomousActionQueue.jsx'));
const ProjectDashboardLatestBackendWork = lazy(() => import('./ProjectDashboardLatestBackendWork.jsx'));

export default function ProjectDashboardManagerBackendActivityPanels({ view }) {
  return (
    <>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadModelSummaryPanels {...view.readModelSummary} />
      </Suspense>
      {view.autonomousRunControl && (
        <Suspense fallback={<div data-testid="project-dashboard-autonomous-run-control-loading" className="min-h-72" role="status" aria-label="正在加载自主运行控制" />}>
          <ProjectDashboardAutonomousRunControl {...view.autonomousRunControl} />
        </Suspense>
      )}
      {view.agentAutonomousActionQueue && (
        <Suspense fallback={<div data-testid="project-dashboard-agent-autonomous-action-queue-loading" className="min-h-72" role="status" aria-label="正在加载 Agent 自主行动队列" />}>
          <ProjectDashboardAgentAutonomousActionQueue {...view.agentAutonomousActionQueue} />
        </Suspense>
      )}
      <Suspense fallback={<div data-testid="project-dashboard-latest-backend-work-loading" className="min-h-24" role="status" aria-label="正在加载最近后端工作" />}>
        <ProjectDashboardLatestBackendWork {...view.latestBackendWork} />
      </Suspense>
      {view.backendError && (
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mt-1">{view.backendError}</div>
      )}
    </>
  );
}
