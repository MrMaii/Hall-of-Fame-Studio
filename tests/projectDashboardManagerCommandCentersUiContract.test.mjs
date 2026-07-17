import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardManagerCommandCenters.jsx', import.meta.url);

test('Dashboard manager command centers stay lazy and keep every scenario, sync, run, and proof action', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardManagerCommandCenters = lazy(() => import('./ProjectDashboardManagerCommandCenters.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerCommandCenters'));
  assert.ok(existsSync(componentUrl), 'Dashboard manager command centers component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'scenario-control-center',
    'Scenario Control Center',
    'scenario-control-step-',
    'scenario-control-action-',
    'manager-live-command-center',
    'Manager Live Command Center',
    'Next best action',
    'manager-command-run-next',
    'Run next',
    'manager-command-run-receipt',
    'manager-command-run-proof',
    'Command run proof',
    'manager-command-center-sync-read-model',
    'Sync Command',
    'manager-command-kickoff-board',
    'Kickoff proof',
    'manager-command-work-loop-board',
    'Loop chat',
    'Loop proof',
    'manager-command-collaboration-board',
    'Collaboration chat',
    'Collaboration proof',
    'manager-command-change-protocol-board',
    'Change protocol chat',
    'Change protocol proof',
    'manager-command-attention-open-',
    'manager-command-change-sync',
    'Change proof',
    'Timeline proof',
    'Signal proof',
    'Work proof',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard manager command centers must keep ${publicContract}`);
  }

  for (const appContract of [
    'chatProofIdsFromIds,',
    'chatProofIdsFromRow,',
    'openManagerCommandAttentionRow,',
    'openProjectChatProof,',
    'openProjectTimelineProof,',
    'runManagerCommandCenterNext,',
    'syncBackendManagerCommandCenter,',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard manager command centers must keep ${appContract} in App.jsx`);
  }
});
