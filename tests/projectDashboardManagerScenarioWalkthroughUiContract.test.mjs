import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const walkthroughSource = readFileSync(new URL('../src/project/ProjectDashboardManagerScenarioWalkthrough.jsx', import.meta.url), 'utf8');

test('complete Dashboard Manager Scenario Walkthrough stays lazy and keeps every public action', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardManagerScenarioWalkthrough = lazy(() => import('./ProjectDashboardManagerScenarioWalkthrough.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerScenarioWalkthrough'));

  for (const publicControl of [
    'manager-scenario-walkthrough',
    'manager-scenario-walkthrough-source',
    'manager-walkthrough-run-receipt',
    'manager-walkthrough-run-proof',
    'manager-scenario-walkthrough-backend-required',
    'manager-scenario-walkthrough-sync-read-model',
    'manager-walkthrough-row-',
    'manager-walkthrough-run-',
    'manager-walkthrough-proof-',
    'Manager Scenario Walkthrough',
    'Sync Walkthrough',
    'Run walkthrough step',
    'Walkthrough proof',
    'Run result proof',
    'Result inspection:',
    'Primary action:',
  ]) {
    assert.ok(walkthroughSource.includes(publicControl), `Manager Scenario Walkthrough must keep ${publicControl}`);
  }

  assert.ok(walkthroughSource.includes('(managerScenarioWalkthrough.rows || []).map((row, index)'));
  assert.ok(walkthroughSource.includes('onSyncWalkthrough'));
  assert.ok(walkthroughSource.includes('onRunResultProof'));
  assert.ok(walkthroughSource.includes('onRunRow(row)'));
  assert.ok(walkthroughSource.includes('onOpenRow(row)'));
});
