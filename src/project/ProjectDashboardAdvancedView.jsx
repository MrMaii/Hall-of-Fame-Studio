import React, { Suspense, lazy } from 'react';

const ProjectDashboardContentLayout = lazy(() => import('./ProjectDashboardContentLayout.jsx'));
const ProjectDashboardToolLauncher = lazy(() => import('./ProjectDashboardToolLauncher.jsx'));

export default function ProjectDashboardAdvancedView({
  sceneTransition,
  contentLayoutView,
  toolLauncherView,
}) {
  return (
    <div data-testid="project-dashboard-view" className="project-room relative flex-1 overflow-hidden text-[#251b13]">
      {sceneTransition && (
        <div className="absolute right-16 top-1/2 z-50 w-28 h-28 -translate-y-1/2 bg-[#8f1e18] scene-bubble shadow-[0_0_80px_rgba(143,30,24,0.45)]" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-[72vh] archive-table skew-y-[-1.5deg] scale-110" />
      <div data-testid="project-overview" className="relative z-10 h-full overflow-x-hidden overflow-y-auto p-3 md:p-6 xl:p-12">
        <Suspense fallback={<div data-testid="project-dashboard-content-layout-loading" className="project-paper min-h-[calc(100vh-96px)] w-full border border-[#7b6542]" role="status" aria-label="正在加载完整项目控制台" />}>
          <ProjectDashboardContentLayout {...contentLayoutView} />
        </Suspense>
      </div>

      <Suspense fallback={<div data-testid="project-dashboard-tool-launcher-loading" className="absolute bottom-6 right-6 h-14 w-14" role="status" aria-label="正在加载项目工具" />}>
        <ProjectDashboardToolLauncher view={toolLauncherView} />
      </Suspense>
    </div>
  );
}
