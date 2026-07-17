import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const contentLayoutSource = readFileSync(new URL('../src/project/ProjectDashboardContentLayout.jsx', import.meta.url), 'utf8');
const topPanelsSource = readFileSync(new URL('../src/project/ProjectDashboardTopPanels.jsx', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../src/project/ProjectDashboardHeader.jsx', import.meta.url), 'utf8');

test('complete Dashboard header stays lazy and keeps its public project controls', () => {
  assert.ok(contentLayoutSource.includes("const ProjectDashboardTopPanels = lazy(() => import('./ProjectDashboardTopPanels.jsx'))"));
  assert.ok(topPanelsSource.includes("const ProjectDashboardHeader = lazy(() => import('./ProjectDashboardHeader.jsx'))"));
  assert.ok(topPanelsSource.includes('<ProjectDashboardHeader'));

  for (const publicControl of [
    'project-dashboard-snapshot-source',
    'project-dashboard-snapshot-source-detail',
    'project-dashboard-progress-source',
    'project-dashboard-progress-source-detail',
    'project-sample-fixture-banner',
    "projectText('Open project meeting')",
    "projectText('Open project chat')",
    "projectText('View full timeline')",
    "projectText('Return to simple view')",
  ]) {
    assert.ok(headerSource.includes(publicControl), `complete Dashboard header must keep ${publicControl}`);
  }
});
