import React, { Suspense, lazy } from 'react';

const ProjectDashboardContentLayout = lazy(() => import('./ProjectDashboardContentLayout.jsx'));
const ProjectDashboardToolLauncher = lazy(() => import('./ProjectDashboardToolLauncher.jsx'));
const ProjectDashboardWorkspaceDrawer = lazy(() => import('./ProjectDashboardWorkspaceDrawer.jsx'));

export default function ProjectDashboardAdvancedView({
  sceneTransition,
  coreSyncStatus,
  coreSyncError,
  language,
  onRetryCoreSync,
  contentLayoutView,
  toolLauncherView,
  workspaceDrawerView,
}) {
  const coreSyncLoading = coreSyncStatus === 'loading';
  const coreSyncFailed = coreSyncStatus === 'error';
  const coreSyncMessage = language === 'zh'
    ? coreSyncFailed ? '核心项目数据同步失败；当前控制台仍可使用。' : '正在后台同步最新项目数据…'
    : coreSyncFailed ? 'Core project data failed to sync; the current console remains usable.' : 'Synchronizing the latest project data in the background…';

  return (
    <div data-testid="project-dashboard-view" className="project-room relative flex-1 overflow-hidden text-[#251b13]">
      {sceneTransition && (
        <div className="absolute right-16 top-1/2 z-50 w-28 h-28 -translate-y-1/2 bg-[#8f1e18] scene-bubble shadow-[0_0_80px_rgba(143,30,24,0.45)]" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-[72vh] archive-table skew-y-[-1.5deg] scale-110" />
      <div data-testid="project-overview" className="relative z-10 h-full overflow-x-hidden overflow-y-auto p-3 md:p-6 xl:p-12">
        {coreSyncLoading ? (
          <section
            data-testid="project-dashboard-core-models-preloader"
            className="project-paper flex min-h-[calc(100vh-96px)] w-full flex-col items-center justify-center border border-[#b9a55f] bg-[#fff9df] px-6 text-center"
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true" className="h-10 w-10 animate-spin rounded-full border-4 border-[#b9a55f] border-t-[#8f1e18]" />
            <h2 className="mt-5 font-serif text-2xl text-[#251b13]">
              {language === 'zh' ? '正在加载项目面板…' : 'Loading the project dashboard…'}
            </h2>
            <p className="mt-2 max-w-xl font-mono text-xs leading-relaxed text-[#75631d]">
              {language === 'zh' ? '正在同步项目、频道、任务、时间线和事件记录。' : 'Synchronizing project, channel, task, timeline, and event data.'}
            </p>
          </section>
        ) : (
          <>
            {coreSyncFailed && (
              <div
                data-testid="project-dashboard-core-models-error"
                className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-[#9e2f27] bg-[#fff1ed] px-4 py-2 font-mono text-xs text-[#8f1e18]"
                role="alert"
              >
                <span>{coreSyncError || coreSyncMessage}</span>
                <button type="button" onClick={onRetryCoreSync} className="border border-current px-3 py-1 uppercase tracking-widest">
                  {language === 'zh' ? '重试同步' : 'Retry sync'}
                </button>
              </div>
            )}
            <Suspense fallback={<div data-testid="project-dashboard-content-layout-loading" className="project-paper min-h-[calc(100vh-96px)] w-full border border-[#7b6542]" role="status" aria-label="正在加载完整项目控制台" />}>
              <ProjectDashboardContentLayout {...contentLayoutView} />
            </Suspense>
            <Suspense fallback={<div data-testid="project-dashboard-workspace-loading" className="mt-6 min-h-[32rem] w-full border border-[#7b6542] bg-[#f7edcf]" role="status" aria-label="正在加载本地 Workspace" />}>
              <ProjectDashboardWorkspaceDrawer view={workspaceDrawerView} />
            </Suspense>
          </>
        )}
      </div>

      <Suspense fallback={<div data-testid="project-dashboard-tool-launcher-loading" className="absolute bottom-6 right-6 h-14 w-14" role="status" aria-label="正在加载项目工具" />}>
        <ProjectDashboardToolLauncher view={toolLauncherView} />
      </Suspense>
    </div>
  );
}
