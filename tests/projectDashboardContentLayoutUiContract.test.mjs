import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const layoutUrl = new URL('../src/project/ProjectDashboardContentLayout.jsx', import.meta.url);
const advancedViewUrl = new URL('../src/project/ProjectDashboardAdvancedView.jsx', import.meta.url);

test('complete Dashboard content layout stays lazy while paper, loading, order, condition, and operations remain intact', () => {
  assert.ok(existsSync(layoutUrl), 'ProjectDashboardContentLayout must exist');
  assert.ok(existsSync(advancedViewUrl), 'ProjectDashboardAdvancedView must exist');
  const layoutSource = readFileSync(layoutUrl, 'utf8');
  const advancedViewSource = readFileSync(advancedViewUrl, 'utf8');

  assert.ok(advancedViewSource.includes("const ProjectDashboardContentLayout = lazy(() => import('./ProjectDashboardContentLayout.jsx'));"));
  assert.ok(appSource.includes('(backendCommandAvailable || isManagerDemoProject(activeProject)) &&'));
  assert.ok(advancedViewSource.includes('<ProjectDashboardContentLayout'));
  assert.ok(appSource.includes('<ProjectDashboardManagerBody'));
  const contentBoundaryStart = advancedViewSource.indexOf('<Suspense fallback={<div data-testid="project-dashboard-content-layout-loading"');
  const contentLayoutStart = advancedViewSource.indexOf('<ProjectDashboardContentLayout');
  const contentBoundaryEnd = advancedViewSource.indexOf('</Suspense>', contentLayoutStart);
  assert.ok(contentBoundaryStart >= 0 && contentBoundaryStart < contentLayoutStart && contentLayoutStart < contentBoundaryEnd, 'the lazy content layout must retain its loading boundary in the advanced view');

  assert.ok(layoutSource.includes("const ProjectDashboardTopPanels = lazy(() => import('./ProjectDashboardTopPanels.jsx'));"));
  assert.ok(layoutSource.includes("const ProjectDashboardRecentCommitLine = lazy(() => import('./ProjectDashboardRecentCommitLine.jsx'));"));
  assert.ok(layoutSource.includes('className="project-paper min-w-0 w-full border border-[#7b6542] p-4 md:p-6 xl:p-10 grid grid-cols-12 gap-4 md:gap-6 xl:gap-8 min-h-[calc(100vh-96px)]"'));
  assert.ok(layoutSource.includes('<Suspense fallback={topPanelsFallback}>'));
  assert.ok(layoutSource.includes('<ProjectDashboardTopPanels view={topPanelsView}>'));
  assert.ok(layoutSource.includes('{managerBody}'));
  assert.ok(layoutSource.includes('<Suspense fallback={recentCommitFallback}>'));
  assert.ok(layoutSource.includes('<ProjectDashboardRecentCommitLine view={recentCommitView} />'));
  assert.ok(layoutSource.indexOf('<ProjectDashboardTopPanels') < layoutSource.indexOf('<ProjectDashboardRecentCommitLine'));

  for (const operation of [
    'onOpenMeeting: () => enterProjectScene(\'meeting\')',
    'onSyncManagerDashboard: () => syncBackendManagerDashboard({ silent: false, projectId: activeProject.id })',
    'onSyncTimeline: () => syncBackendTimelineAndEvents({ silent: false, projectId: activeProject.id })',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain ${operation}`);
  }
});
