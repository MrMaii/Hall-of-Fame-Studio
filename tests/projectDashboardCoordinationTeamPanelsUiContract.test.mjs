import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardCoordinationTeamPanels.jsx', import.meta.url);
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url), 'utf8');

test('Dashboard coordination and team panels share one lazy assembly while original conditions and operations stay intact', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardCoordinationTeamPanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardCoordinationTeamPanels = lazy(() => import('./ProjectDashboardCoordinationTeamPanels.jsx'))"));
  assert.ok(managerBodySource.includes('<ProjectDashboardCoordinationTeamPanels'));

  const components = [
    'ProjectDashboardCollaborationHealth',
    'ProjectDashboardSampleFixturePath',
    'ProjectDashboardLeaderAssignmentFlow',
    'ProjectDashboardTeamWorkspacePanels',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`lazy(() => import('./${component}.jsx'))`), `${component} must stay lazy`);
    assert.ok(assemblySource.includes(`<${component}`), `${component} must remain rendered`);
    assert.ok(!appSource.includes(`lazy(() => import('./project/${component}.jsx'))`), `${component} must leave the application entry`);
    assert.equal(new RegExp(`<${component}(?:\\s|>)`).test(appSource), false, `${component} assembly must leave App`);
  }

  const renderIndexes = components.map(component => assemblySource.indexOf(`<${component}`));
  assert.ok(renderIndexes.every((index, position) => position === 0 || index > renderIndexes[position - 1]), 'Coordination and team panels must retain their original display order');
  assert.ok(assemblySource.includes('view.showSampleFixturePath &&'), 'Sample Fixture Path must retain its display condition');
  assert.ok(assemblySource.includes('view.leaderAssignmentFlowView.assignmentDerivedFrontendRowsAllowed && view.leaderAssignmentFlowView.assignmentFlowRows.length > 0'), 'Leader Assignment Flow must retain its frontend assignment condition');
  assert.ok(assemblySource.includes('view.leaderAssignmentFlowView.assignmentTimelineRows.length > 0'), 'Leader Assignment Flow must retain its backend timeline condition');
  assert.ok(assemblySource.includes('view.leaderAssignmentFlowView.assignmentTimelineMatrix.frontendMockSuppressed'), 'Leader Assignment Flow must retain its backend-required fallback condition');

  for (const retainedOperation of [
    'syncBackendReadyPackageSubmodels',
    'openProjectChatProof',
    'openProjectTimelineProof',
    'syncBackendCockpitReadModels',
    'syncBackendManagerDashboard',
    'runBackendAgentArtifactDraft',
    'runBackendAgentArtifactSubmission',
    'runBackendAgentEvidenceSearch',
    'runBackendAgentMessage',
    'runBackendAgentPulse',
    'syncBackendAgentDashboard',
    'updateAgentMessageDraft',
    'updateAgentWorkDraft',
  ]) assert.ok(appSource.includes(retainedOperation), `App must retain ${retainedOperation}`);
});
