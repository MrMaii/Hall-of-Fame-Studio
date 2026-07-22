import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const contentLayoutSource = readFileSync(new URL('../src/project/ProjectDashboardContentLayout.jsx', import.meta.url), 'utf8');
const topPanelsSource = readFileSync(new URL('../src/project/ProjectDashboardTopPanels.jsx', import.meta.url), 'utf8');
const overviewSource = readFileSync(new URL('../src/project/ProjectDashboardAgentOverview.jsx', import.meta.url), 'utf8');

test('complete Dashboard Agent overview stays lazy and presents interactive member summaries', () => {
  assert.ok(contentLayoutSource.includes("const ProjectDashboardTopPanels = lazy(() => import('./ProjectDashboardTopPanels.jsx'))"));
  assert.ok(topPanelsSource.includes("const ProjectDashboardAgentOverview = lazy(() => import('./ProjectDashboardAgentOverview.jsx'))"));
  assert.ok(topPanelsSource.includes('<ProjectDashboardAgentOverview'));

  for (const publicControl of [
    'dashboard-agent-status',
    'dashboard-agent-status-source',
    'dashboard-agent-status-backend-required',
    'dashboard-agent-status-sync-cockpit',
    'dashboard-agent-status-${row.id}',
    'dashboard-agent-detail-${row.id}',
    '谁在做什么',
    '最近动作',
    '要交付的文件',
    '查看协作关系',
  ]) {
    assert.ok(overviewSource.includes(publicControl), `complete Dashboard Agent overview must keep ${publicControl}`);
  }

  assert.ok(overviewSource.includes('teamRows.map'));
  assert.ok(overviewSource.includes('row.avatarSrc'));
  assert.ok(overviewSource.includes('row.sentence'));
  assert.ok(overviewSource.includes('onSyncCockpit'));
  assert.ok(overviewSource.includes('onRunAgentPulse(row.id)'));
  assert.ok(overviewSource.includes('expandedAgentIds'));
  assert.ok(overviewSource.includes('toggleAgent'));
  assert.ok(overviewSource.includes('dashboard-agent-todos-${row.id}'));
  assert.ok(overviewSource.includes('row.todos.map'));
  assert.ok(!overviewSource.includes('selectedAgentId'));
});
