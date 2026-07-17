import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const snapshotSource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageSnapshot.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url);

test('Dashboard Manager Ready Package core panels share one lazy assembly while original order, condition, and operations stay intact', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerReadyPackageCorePanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(snapshotSource.includes("const ProjectDashboardManagerReadyPackageCorePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageCorePanels.jsx'))"));
  assert.ok(snapshotSource.includes('<ProjectDashboardManagerReadyPackageCorePanels'));

  const components = [
    'ProjectDashboardLaunchOperationsOverview',
    'ProjectDashboardManagerReadyPackageSummary',
    'ProjectDashboardManagerReadyPackageCoordinationPanels',
    'ProjectDashboardCollaborationIntentQueueSnapshot',
    'ProjectDashboardManagerReadyPackageRuntimePanels',
    'ProjectDashboardManagerReadyPackageEvidencePanels',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`lazy(() => import('./${component}.jsx'))`), `${component} must stay lazy`);
    assert.ok(assemblySource.includes(`<${component}`), `${component} must remain rendered`);
    assert.ok(!appSource.includes(`lazy(() => import('./project/${component}.jsx'))`), `${component} must leave the application entry`);
    assert.equal(new RegExp(`<${component}(?:\\s|>)`).test(appSource), false, `${component} assembly must leave App`);
  }

  const renderIndexes = components.map(component => assemblySource.indexOf(`<${component}`));
  assert.ok(renderIndexes.every((index, position) => position === 0 || index > renderIndexes[position - 1]), 'Manager Ready Package core panels must retain their original display order');
  assert.ok(assemblySource.includes('view.collaborationIntentQueue &&'), 'Collaboration Intent Queue Snapshot must retain its display condition');

  for (const retainedOperation of [
    'runLaunchOperationsNextStep',
    'runCollaborationIntentQueueRow',
    'openProjectChatProof',
    'openProjectTimelineProof',
    'openManagerFlowNode',
    'managerProofModelSyncButton',
  ]) assert.ok(appSource.includes(retainedOperation), `App must retain ${retainedOperation}`);
});
