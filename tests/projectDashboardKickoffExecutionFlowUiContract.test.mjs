import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardKickoffCollaborationPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardKickoffExecutionFlow.jsx', import.meta.url);

test('Dashboard Kickoff Execution Flow stays lazy and keeps startup, assignment, and first-pulse proof', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardKickoffCollaborationPanels = lazy(() => import('./ProjectDashboardKickoffCollaborationPanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardKickoffExecutionFlow = lazy(() => import('./ProjectDashboardKickoffExecutionFlow.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardKickoffExecutionFlow'));
  assert.ok(existsSync(componentUrl), 'Dashboard Kickoff Execution Flow component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'kickoff-execution-flow-backend-required',
    'kickoff-execution-flow-sync-manager-dashboard',
    'Sync Manager Dashboard',
    'kickoff-execution-flow',
    'kickoff-next-action-resolution',
    'kickoff-next-action-agent-receipts',
    'all-agent-startup-matrix',
    'Startup timeline proof',
    'Assignment proof',
    'Timeline proof',
    'First pulse chat proof',
    'First pulse timeline proof',
    'onSyncManagerDashboard',
    'onOpenChatProof',
    'onOpenTimelineProof',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Kickoff Execution Flow must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('backendRequired: kickoffExecutionFlowBackendRequired'));
  assert.ok(appSource.includes('flow: kickoffExecutionFlow'));
  assert.ok(appSource.includes('charter: kickoffCharter'));
  assert.ok(appSource.includes('onSyncManagerDashboard: () => syncBackendManagerDashboard'));
  assert.ok(appSource.includes('onOpenChatProof: (ids, channelId) => openProjectChatProof'));
  assert.ok(appSource.includes('onOpenTimelineProof: openProjectTimelineProof'));
});
