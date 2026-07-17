import React, { Suspense, lazy } from 'react';

const ProjectDashboardHeader = lazy(() => import('./ProjectDashboardHeader.jsx'));
const ProjectDashboardSummary = lazy(() => import('./ProjectDashboardSummary.jsx'));
const ProjectDashboardAgentOverview = lazy(() => import('./ProjectDashboardAgentOverview.jsx'));

export default function ProjectDashboardTopPanels({ children, view }) {
  const { agentOverview, header, summary } = view;

  return (
    <>
      <Suspense fallback={<div data-testid="project-dashboard-header-loading" className="col-span-12 min-h-40" role="status" aria-label="正在加载完整项目标题" />}>
        <ProjectDashboardHeader view={header} />
      </Suspense>

      <section className="col-span-12 lg:col-span-7">
        <Suspense fallback={<div data-testid="project-dashboard-summary-loading" className="min-h-64" role="status" aria-label="正在加载项目概览" />}>
          <ProjectDashboardSummary view={summary} />
        </Suspense>

        <Suspense fallback={<div data-testid="project-dashboard-agent-overview-loading" className="min-h-80" role="status" aria-label="正在加载 Agent 工作状态" />}>
          <ProjectDashboardAgentOverview view={agentOverview} />
        </Suspense>

        {children}
      </section>
    </>
  );
}
