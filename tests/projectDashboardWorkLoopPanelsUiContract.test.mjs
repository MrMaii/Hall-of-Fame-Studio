import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardWorkLoopPanels.jsx', import.meta.url);

test('Dashboard work-loop panels share one lazy assembly while every operation stays in App', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardWorkLoopPanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardWorkLoopPanels = lazy(() => import('./ProjectDashboardWorkLoopPanels.jsx'))"));
  assert.ok(managerBodySource.includes('<ProjectDashboardWorkLoopPanels'));

  const components = [
    'ProjectDashboardAutonomousWorkLoop',
    'ProjectDashboardOperationsBoard',
    'ProjectDashboardContinuousWorkLoop',
    'ProjectDashboardFixedWorkRoutines',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`lazy(() => import('./${component}.jsx'))`), `${component} must stay lazy`);
    assert.ok(assemblySource.includes(`<${component}`), `${component} must remain rendered`);
    assert.ok(!appSource.includes(`lazy(() => import('./project/${component}.jsx'))`), `${component} must leave the application entry`);
    assert.ok(!appSource.includes(`<${component}`), `${component} assembly must leave App`);
  }
  const renderIndexes = components.map(component => assemblySource.indexOf(`<${component}`));
  assert.ok(renderIndexes.every((index, position) => position === 0 || index > renderIndexes[position - 1]), 'Work-loop panels must retain their original display order');

  for (const retainedOperation of [
    'runProjectAutonomousPulse',
    'syncBackendCockpitReadModels',
    'runBackendAgentPulse',
    'openProjectChatProof',
    'openProjectTimelineProof',
  ]) assert.ok(appSource.includes(retainedOperation), `App must retain ${retainedOperation}`);
});
