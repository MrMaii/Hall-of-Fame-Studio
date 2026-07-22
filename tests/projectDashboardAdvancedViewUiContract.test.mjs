import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const viewUrl = new URL('../src/project/ProjectDashboardAdvancedView.jsx', import.meta.url);

test('complete Dashboard page shell stays lazy while original layout, loading, condition, and operations remain intact', () => {
  assert.ok(existsSync(viewUrl), 'ProjectDashboardAdvancedView must exist');
  const viewSource = readFileSync(viewUrl, 'utf8');

  assert.ok(appSource.includes("const ProjectDashboardAdvancedView = lazy(() => import('./project/ProjectDashboardAdvancedView.jsx'));"));
  const outerBoundaryStart = appSource.indexOf('<Suspense fallback={<LazyPanelFallback />}>');
  const advancedViewStart = appSource.indexOf('<ProjectDashboardAdvancedView');
  const outerBoundaryEnd = appSource.indexOf('</Suspense>', advancedViewStart);
  assert.ok(outerBoundaryStart >= 0 && outerBoundaryStart < advancedViewStart && advancedViewStart < outerBoundaryEnd, 'App must keep an outer loading boundary around the lazy page assembly');

  assert.ok(appSource.includes('contentLayoutView={{'));
  assert.ok(appSource.includes('toolLauncherView={{'));
  assert.ok(appSource.includes('(backendCommandAvailable || isManagerDemoProject(activeProject)) &&'));
  assert.ok(appSource.includes('<ProjectDashboardManagerBody'));

  assert.ok(viewSource.includes("const ProjectDashboardContentLayout = lazy(() => import('./ProjectDashboardContentLayout.jsx'));"));
  assert.ok(viewSource.includes("const ProjectDashboardToolLauncher = lazy(() => import('./ProjectDashboardToolLauncher.jsx'));"));
  assert.ok(viewSource.includes("const ProjectDashboardWorkspaceDrawer = lazy(() => import('./ProjectDashboardWorkspaceDrawer.jsx'));"));
  assert.ok(viewSource.includes('data-testid="project-dashboard-view" className="project-room relative flex-1 overflow-hidden text-[#251b13]"'));
  assert.ok(viewSource.includes('data-testid="project-overview" className="relative z-10 h-full overflow-x-hidden overflow-y-auto p-3 md:p-6 xl:p-12"'));
  assert.ok(viewSource.includes('className="absolute inset-x-0 bottom-0 h-[72vh] archive-table skew-y-[-1.5deg] scale-110"'));
  assert.ok(viewSource.includes('data-testid="project-dashboard-content-layout-loading"'));
  assert.ok(viewSource.includes('<ProjectDashboardContentLayout {...contentLayoutView} />'));
  assert.ok(viewSource.includes('data-testid="project-dashboard-tool-launcher-loading"'));
  assert.ok(viewSource.includes('<ProjectDashboardToolLauncher view={toolLauncherView} />'));
  assert.ok(viewSource.includes('<ProjectDashboardWorkspaceDrawer view={workspaceDrawerView} />'));
  assert.ok(!viewSource.includes('workspaceDrawerView?.open'));
  assert.ok(viewSource.indexOf('<ProjectDashboardContentLayout') < viewSource.indexOf('<ProjectDashboardToolLauncher'));

  for (const operation of [
    "onOpenMeeting: () => enterProjectScene('meeting')",
    'onSyncManagerDashboard: () => syncBackendManagerDashboard({ silent: false, projectId: activeProject.id })',
    'onSyncTimeline: () => syncBackendTimelineAndEvents({ silent: false, projectId: activeProject.id })',
    'onEnterScene: enterProjectScene',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain ${operation}`);
  }
});

test('real advanced dashboard shows a preloader instead of unverified cards while core backend models synchronize', () => {
  assert.ok(appSource.includes('projectDashboardCoreSync'));
  assert.ok(appSource.includes('timeoutMs: 10_000'));
  assert.ok(appSource.includes('indexOnly: true'));
  assert.ok(appSource.includes('if (!projectDashboardCoreReady) return;'));
  assert.ok(!appSource.includes('if (projectDashboardNeedsCoreSync && !projectDashboardCoreReady)'));

  const viewSource = readFileSync(viewUrl, 'utf8');
  assert.ok(viewSource.includes('coreSyncStatus'));
  assert.ok(viewSource.includes("const coreSyncLoading = coreSyncStatus === 'loading';"));
  assert.ok(viewSource.includes('data-testid="project-dashboard-core-models-preloader"'));
  assert.ok(viewSource.includes('animate-spin'));
  assert.ok(viewSource.includes('{coreSyncLoading ? ('));
  assert.ok(viewSource.includes('data-testid="project-dashboard-core-models-error"'));
  const loadingBranch = viewSource.slice(
    viewSource.indexOf('{coreSyncLoading ? ('),
    viewSource.indexOf("{coreSyncFailed && (", viewSource.indexOf('{coreSyncLoading ? (')),
  );
  assert.ok(loadingBranch.includes('project-dashboard-core-models-preloader'));
  assert.ok(!loadingBranch.includes('<ProjectDashboardContentLayout'), 'Unverified dashboard cards must not mount during core synchronization.');
});

test('dashboard core synchronization cannot leave a fresh user on an infinite loading screen', () => {
  assert.ok(appSource.includes('const PROJECT_DASHBOARD_CORE_SYNC_TIMEOUT_MS = 12_000;'));
  assert.ok(appSource.includes("if (projectDashboardCoreSync.status !== 'loading' || !projectDashboardCoreSync.projectId) return undefined;"));
  assert.ok(appSource.includes('failProjectDashboardCoreSync(prev, {'));
  assert.ok(appSource.includes('Core project read models timed out; the current console remains usable.'));
});

test('dashboard core synchronization uses a terminal error state and ignores stale attempts', () => {
  assert.ok(appSource.includes("from './project/projectDashboardCoreSyncState.js';"));
  assert.ok(appSource.includes('shouldStartProjectDashboardCoreSync(projectDashboardCoreSync, activeProject.id)'));
  assert.ok(appSource.includes('completeProjectDashboardCoreSync(prev, {'));
  assert.ok(appSource.includes('attemptId,'));
  assert.ok(!appSource.includes("['loading', 'ready'].includes(projectDashboardCoreSync.status)"));

  const effectStart = appSource.indexOf('shouldStartProjectDashboardCoreSync(projectDashboardCoreSync, activeProject.id)');
  const effectEnd = appSource.indexOf('  useEffect(() => {', effectStart + 20);
  const effectSource = appSource.slice(effectStart, effectEnd);
  assert.ok(!effectSource.includes('backendStation.loading'), 'Unrelated global loading must not restart or block core synchronization.');
});

test('manager dashboard timeout does not immediately issue the same expensive request again', () => {
  const start = appSource.indexOf('const syncBackendManagerDashboard = async');
  const end = appSource.indexOf('const syncBackendManagerReadyPackage = async', start);
  const source = appSource.slice(start, end);
  assert.equal(source.match(/\/manager-dashboard`/g)?.length, 1);
  assert.ok(!source.includes('fallbackDashboard'));
  assert.ok(!source.includes('syncBackendManagerFlowGraph'), 'Dashboard reads must not eagerly build the separate timeline graph.');
});
