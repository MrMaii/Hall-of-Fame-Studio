import React, { Suspense, lazy } from 'react';

const ProjectDashboardTopPanels = lazy(() => import('./ProjectDashboardTopPanels.jsx'));
const ProjectDashboardRecentCommitLine = lazy(() => import('./ProjectDashboardRecentCommitLine.jsx'));

export default function ProjectDashboardContentLayout({
  topPanelsFallback,
  topPanelsView,
  recentCommitFallback,
  recentCommitView,
}) {
  return (
    <div className="project-paper min-w-0 w-full border border-[#7b6542] p-4 md:p-6 xl:p-10 grid grid-cols-12 gap-4 md:gap-6 xl:gap-8 min-h-[calc(100vh-96px)]">
      <Suspense fallback={topPanelsFallback}>
        <ProjectDashboardTopPanels view={topPanelsView} />
      </Suspense>

      <Suspense fallback={recentCommitFallback}>
        <ProjectDashboardRecentCommitLine view={recentCommitView} />
      </Suspense>
    </div>
  );
}
