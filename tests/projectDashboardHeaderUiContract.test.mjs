import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const contentLayoutSource = readFileSync(new URL('../src/project/ProjectDashboardContentLayout.jsx', import.meta.url), 'utf8');
const topPanelsSource = readFileSync(new URL('../src/project/ProjectDashboardTopPanels.jsx', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../src/project/ProjectDashboardHeader.jsx', import.meta.url), 'utf8');

test('complete Dashboard header stays lazy and prioritizes the living project brief', () => {
  assert.ok(contentLayoutSource.includes("const ProjectDashboardTopPanels = lazy(() => import('./ProjectDashboardTopPanels.jsx'))"));
  assert.ok(topPanelsSource.includes("const ProjectDashboardHeader = lazy(() => import('./ProjectDashboardHeader.jsx'))"));
  assert.ok(topPanelsSource.includes('<ProjectDashboardHeader'));

  for (const publicControl of [
    'project-dashboard-snapshot-source',
    'project-dashboard-briefing-header',
    'project-dashboard-current-focus',
    'project-dashboard-refresh-briefing',
    'project-dashboard-execution-rail',
    'project-dashboard-leader-planning',
    'project-dashboard-current-marker',
    'project-dashboard-execution-plan',
    'project-dashboard-expected-completion',
    '正在制定项目工作计划',
    '暂不计算项目进度',
    '提交并通过校验后才会生成正式进度条',
    'Leader 已提交',
    '预计完成',
    'project-sample-fixture-banner',
    '目前项目在做什么',
    '当前阶段',
    '下一节点',
    '最后更新',
    "projectText('Open project meeting')",
    "projectText('Open project chat')",
    "projectText('View full timeline')",
  ]) {
    assert.ok(headerSource.includes(publicControl), `complete Dashboard header must keep ${publicControl}`);
  }
  assert.ok(!headerSource.includes('Return to simple view'));
  assert.ok(!headerSource.includes('Project Progress'));
  assert.ok(headerSource.includes('executionPlan.markerPercent'));
  assert.ok(!headerSource.includes('project-open-workspace'));
});
