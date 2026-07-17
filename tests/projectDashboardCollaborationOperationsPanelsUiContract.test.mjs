import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardCollaborationOperationsPanels.jsx', import.meta.url);
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url), 'utf8');

test('Dashboard collaboration operation panels share one lazy assembly while every operation stays in App', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardCollaborationOperationsPanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardCollaborationOperationsPanels = lazy(() => import('./ProjectDashboardCollaborationOperationsPanels.jsx'))"));
  assert.ok(managerBodySource.includes('<ProjectDashboardCollaborationOperationsPanels'));

  const components = [
    'ProjectDashboardChangeFlow',
    'ProjectDashboardCommunicationFlow',
    'ProjectDashboardAgentManagementMesh',
    'ProjectDashboardManagerScenarioReadiness',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`lazy(() => import('./${component}.jsx'))`), `${component} must stay lazy`);
    assert.ok(assemblySource.includes(`<${component}`), `${component} must remain rendered`);
    assert.ok(!appSource.includes(`lazy(() => import('./project/${component}.jsx'))`), `${component} must leave the application entry`);
    assert.ok(!appSource.includes(`<${component}`), `${component} assembly must leave App`);
  }
  const renderIndexes = components.map(component => assemblySource.indexOf(`<${component}`));
  assert.ok(renderIndexes.every((index, position) => position === 0 || index > renderIndexes[position - 1]), 'Collaboration operation panels must retain their original display order');

  for (const condition of [
    'view.changeFlowDisplayRows.length > 0',
    'view.changeFlow.frontendMockSuppressed',
    'view.changeDerivedFrontendRowsAllowed && view.changeLedger.length > 0',
    'view.peerHandoffs.length > 0 || view.agentCommunicationRows.length > 0',
  ]) assert.ok(assemblySource.includes(condition), `Assembly must retain display condition: ${condition}`);

  for (const retainedOperation of [
    'syncBackendCockpitReadModels',
    'syncBackendReadinessProofMap',
    'runBackendManagementSync',
    'openProjectChatProof',
    'openProjectTimelineProof',
  ]) assert.ok(appSource.includes(retainedOperation), `App must retain ${retainedOperation}`);
});
