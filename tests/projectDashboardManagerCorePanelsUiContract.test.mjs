import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url);

test('Dashboard manager core panels share one lazy assembly while every operation stays in App', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerCorePanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(managerBodySource.includes('<ProjectDashboardManagerCorePanels'));

  const components = [
    'ProjectDashboardManagerCommandCenters',
    'ProjectDashboardManagerScenarioWalkthrough',
    'ProjectDashboardManagerActionPlaybook',
    'ProjectDashboardManagerActionRunLedger',
    'ProjectDashboardManagerScenarioTrail',
    'ProjectDashboardSyncProtocolAudit',
    'ProjectDashboardManagerUseCaseAudit',
    'ProjectDashboardManagerComposers',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`lazy(() => import('./${component}.jsx'))`), `${component} must stay lazy`);
    assert.ok(assemblySource.includes(`<${component}`), `${component} must remain rendered`);
    assert.ok(!appSource.includes(`lazy(() => import('./project/${component}.jsx'))`), `${component} must leave the application entry`);
    assert.ok(!appSource.includes(`<${component}`), `${component} assembly must leave App`);
  }
  const renderIndexes = components.map(component => assemblySource.indexOf(`<${component}`));
  assert.ok(renderIndexes.every((index, position) => position === 0 || index > renderIndexes[position - 1]), 'Manager core panels must retain their original display order');

  for (const retainedOperation of [
    'runManagerCommandCenterNext',
    'runManagerScenarioWalkthroughRow',
    'runManagerActionPlaybookRow',
    'syncBackendManagerDashboard',
    'syncBackendManagerScenarioTrail',
    'syncBackendSyncProtocolAudit',
    'syncBackendManagerUseCaseAudit',
    'submitManagerLeaderAssignment',
    'submitManagerChangeIntake',
  ]) assert.ok(appSource.includes(retainedOperation), `App must retain ${retainedOperation}`);
});
