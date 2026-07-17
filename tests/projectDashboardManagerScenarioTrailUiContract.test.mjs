import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const trailSource = readFileSync(new URL('../src/project/ProjectDashboardManagerScenarioTrail.jsx', import.meta.url), 'utf8');

test('complete Dashboard Manager Scenario Trail stays lazy and keeps every proof action', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardManagerScenarioTrail = lazy(() => import('./ProjectDashboardManagerScenarioTrail.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerScenarioTrail'));

  for (const publicControl of [
    'manager-scenario-trail',
    'manager-scenario-trail-source',
    'manager-scenario-trail-backend-required',
    'manager-scenario-trail-sync-read-model',
    'manager-scenario-trail-row-',
    'manager-scenario-trail-proof-',
    'Manager Scenario Trail',
    'Sync Trail',
    'Trail proof',
    'Needs Proof',
  ]) {
    assert.ok(trailSource.includes(publicControl), `Manager Scenario Trail must keep ${publicControl}`);
  }

  assert.ok(trailSource.includes('managerScenarioTrailDisplayRows.map((row, index)'));
  assert.ok(trailSource.includes('onSyncTrail'));
  assert.ok(trailSource.includes('onOpenRow(row)'));
});
