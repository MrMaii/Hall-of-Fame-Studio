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
  assert.ok(viewSource.includes('data-testid="project-dashboard-view" className="project-room relative flex-1 overflow-hidden text-[#251b13]"'));
  assert.ok(viewSource.includes('data-testid="project-overview" className="relative z-10 h-full overflow-x-hidden overflow-y-auto p-3 md:p-6 xl:p-12"'));
  assert.ok(viewSource.includes('className="absolute inset-x-0 bottom-0 h-[72vh] archive-table skew-y-[-1.5deg] scale-110"'));
  assert.ok(viewSource.includes('data-testid="project-dashboard-content-layout-loading"'));
  assert.ok(viewSource.includes('<ProjectDashboardContentLayout {...contentLayoutView} />'));
  assert.ok(viewSource.includes('data-testid="project-dashboard-tool-launcher-loading"'));
  assert.ok(viewSource.includes('<ProjectDashboardToolLauncher view={toolLauncherView} />'));
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

test('real advanced dashboard waits for core backend models instead of rendering missing data as seven errors', () => {
  assert.ok(appSource.includes('projectDashboardCoreSync'));
  assert.ok(appSource.includes("'project-dashboard-core-models-loading'"));
  assert.ok(appSource.includes("'project-dashboard-core-models-error'"));
  assert.ok(appSource.includes('timeoutMs: 10_000'));
  assert.ok(appSource.includes('indexOnly: true'));
  assert.ok(appSource.includes('if (!projectDashboardCoreReady) return;'));
  assert.ok(appSource.includes("eyebrow: '正在同步项目面板'"));
});
