import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const parentAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendReadModelPanels.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url);

test('Manager Dashboard backend snapshot panels share one lazy assembly while the original condition, order, and operations stay intact', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerBackendSnapshotPanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(parentAssemblySource.includes("const ProjectDashboardManagerBackendSnapshotPanels = lazy(() => import('./ProjectDashboardManagerBackendSnapshotPanels.jsx'))"));
  assert.ok(parentAssemblySource.includes('<ProjectDashboardManagerBackendSnapshotPanels'));
  assert.ok(assemblySource.includes('if (!view.managerDashboard) return null;'));
  assert.ok(assemblySource.includes('data-testid="backend-manager-dashboard-snapshot"'));

  const components = [
    'ProjectDashboardManagerSnapshotExecutionPanels',
    'ProjectDashboardManagerCompatibilityProofPanels',
    'ProjectDashboardManagerSubmissionRoutePanels',
  ];
  let previousIndex = -1;
  for (const component of components) {
    assert.ok(assemblySource.includes(`const ${component} = lazy(() => import('./${component}.jsx'))`), `${component} must remain lazy`);
    const renderIndex = assemblySource.indexOf(`<${component}`);
    assert.ok(renderIndex > previousIndex, `${component} must retain its original display order`);
    previousIndex = renderIndex;
  }

  for (const operation of [
    "onOpenHandoffChatProof: () => openProjectChatProof(activeProject, backendMissionHandoffExecutionChatProofIds, 'main')",
    'onRunHandoffIntent: () => runCollaborationIntentQueueRow(backendMissionHandoffIntentRow)',
    'intentRunDisabled: (row) => !backendCommandAvailable || backendStation.loading || !row.canRun || !row.runIntentApiPath',
    'onRunSubmissionReview: runBackendSubmissionReview',
    'onUpdateReviewDraft: updateSubmissionReviewDraft',
    'reviewInputDisabled: !backendCommandAvailable || backendStation.loading',
    'reviewSubmitDisabled: (reviewerId) => !backendCommandAvailable || backendStation.loading || !reviewerId',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain operation ${operation}`);
  }
});
