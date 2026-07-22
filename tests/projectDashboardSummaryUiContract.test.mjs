import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const contentLayoutSource = readFileSync(new URL('../src/project/ProjectDashboardContentLayout.jsx', import.meta.url), 'utf8');
const topPanelsSource = readFileSync(new URL('../src/project/ProjectDashboardTopPanels.jsx', import.meta.url), 'utf8');
const summarySource = readFileSync(new URL('../src/project/ProjectDashboardSummary.jsx', import.meta.url), 'utf8');

test('complete Dashboard summary stays lazy and demotes metrics to a quiet pulse line', () => {
  assert.ok(contentLayoutSource.includes("const ProjectDashboardTopPanels = lazy(() => import('./ProjectDashboardTopPanels.jsx'))"));
  assert.ok(topPanelsSource.includes("const ProjectDashboardSummary = lazy(() => import('./ProjectDashboardSummary.jsx'))"));
  assert.ok(topPanelsSource.includes('<ProjectDashboardSummary'));

  for (const publicControl of [
    'project-dashboard-quiet-metrics',
    'project-dashboard-brief-metric-',
    'members',
    'active',
    'waiting',
    'blocked',
  ]) {
    assert.ok(summarySource.includes(publicControl), `complete Dashboard summary must keep ${publicControl}`);
  }

  assert.ok(summarySource.includes('briefing.metrics'));
  assert.ok(!summarySource.includes('managerDashboardStats.map'));
});
