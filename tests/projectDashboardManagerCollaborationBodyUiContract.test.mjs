import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url);

test('Dashboard manager collaboration body shares one lazy assembly while original panels, proof routes, and operations stay intact', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerCollaborationBody must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCollaborationBody = lazy(() => import('./ProjectDashboardManagerCollaborationBody.jsx'))"));
  assert.ok(managerBodySource.includes('<ProjectDashboardManagerCollaborationBody'));

  const components = [
    'ProjectDashboardEventLedger',
    'ProjectDashboardKickoffCollaborationPanels',
    'ProjectDashboardCollaborationOperationsPanels',
    'ProjectDashboardManagerProofMap',
    'ProjectDashboardCoordinationTeamPanels',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`lazy(() => import('./${component}.jsx'))`), `${component} must stay lazy`);
    assert.ok(assemblySource.includes(`<${component}`), `${component} must remain rendered`);
    assert.ok(!appSource.includes(`lazy(() => import('./project/${component}.jsx'))`), `${component} must leave the application entry`);
    assert.equal(new RegExp(`<${component}(?:\\s|>)`).test(appSource), false, `${component} assembly must leave App`);
  }

  const renderIndexes = components.map(component => assemblySource.indexOf(`<${component}`));
  assert.ok(renderIndexes.every((index, position) => position === 0 || index > renderIndexes[position - 1]), 'Manager collaboration body panels must retain their original display order');
  assert.ok(assemblySource.includes('(view.eventLedgerDisplayRows.length > 0 || view.eventLedgerReadModel.frontendMockSuppressed)'), 'Unified Event Ledger must retain its display condition');
  assert.ok(assemblySource.includes('view.managerProofMapView'), 'Manager Proof Map must keep its complete view');
  assert.ok(appSource.includes('routePanels: ('), 'Manager Proof Map route panels must stay connected in App');
  assert.ok(appSource.includes('<ProjectDashboardManagerProofRoutePanels'), 'P2-176 proof routes must remain inside Manager Proof Map');

  for (const retainedOperation of [
    'syncBackendTimelineAndEvents',
    'syncBackendGovernanceProtocol',
    'syncBackendManagerDashboard',
    'syncBackendProjectTranscripts',
    'syncBackendCockpitReadModels',
    'syncBackendReadinessProofMap',
    'runBackendManagementSync',
    'openProjectChatProof',
    'openProjectTimelineProof',
    'runBackendAgentPulse',
    'syncBackendAgentDashboard',
  ]) assert.ok(appSource.includes(retainedOperation), `App must retain ${retainedOperation}`);
});
