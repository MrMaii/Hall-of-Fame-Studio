import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const contentLayoutSource = readFileSync(new URL('../src/project/ProjectDashboardContentLayout.jsx', import.meta.url), 'utf8');
const routeUrl = new URL('../src/project/ProjectDashboardTopPanels.jsx', import.meta.url);

test('Dashboard top panels share one lazy assembly while every operation stays in App', () => {
  assert.ok(existsSync(routeUrl), 'ProjectDashboardTopPanels must exist');
  const routeSource = readFileSync(routeUrl, 'utf8');

  assert.ok(contentLayoutSource.includes("const ProjectDashboardTopPanels = lazy(() => import('./ProjectDashboardTopPanels.jsx'))"));
  assert.ok(contentLayoutSource.includes('<ProjectDashboardTopPanels'));

  for (const component of ['ProjectDashboardHeader', 'ProjectDashboardSummary', 'ProjectDashboardAgentOverview']) {
    assert.ok(routeSource.includes(`lazy(() => import('./${component}.jsx'))`), `${component} must stay lazy`);
    assert.ok(routeSource.includes(`<${component}`), `${component} must remain rendered`);
    assert.ok(!appSource.includes(`lazy(() => import('./project/${component}.jsx'))`), `${component} must leave the application entry`);
    assert.ok(!appSource.includes(`<${component}`), `${component} assembly must leave App`);
  }

  assert.ok(routeSource.includes('className="col-span-12 lg:col-span-7"'));
  assert.ok(routeSource.includes('{children}'));

  for (const retainedOperation of [
    "enterProjectScene('meeting')",
    "enterProjectScene('chat')",
    "enterProjectScene('timeline')",
    'syncBackendManagerDashboard',
    'openManagerFlowGraphScene',
    'runBackendAgentPulse',
    'syncBackendCockpitReadModels',
  ]) assert.ok(appSource.includes(retainedOperation), `App must retain ${retainedOperation}`);
});
