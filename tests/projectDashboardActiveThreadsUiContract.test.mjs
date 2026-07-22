import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const activeThreadsUrl = new URL('../src/project/ProjectDashboardActiveThreads.jsx', import.meta.url);
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardTeamWorkspacePanels.jsx', import.meta.url), 'utf8');
const coordinationAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardCoordinationTeamPanels.jsx', import.meta.url), 'utf8');

test('Dashboard Active Threads stays lazy and keeps assignment, chat, timeline, and backend sync proof', () => {
  assert.ok(coordinationAssemblySource.includes("const ProjectDashboardTeamWorkspacePanels = lazy(() => import('./ProjectDashboardTeamWorkspacePanels.jsx'))"));
  assert.ok(coordinationAssemblySource.includes('<ProjectDashboardTeamWorkspacePanels'));
  assert.ok(assemblySource.includes("const ProjectDashboardActiveThreads = lazy(() => import('./ProjectDashboardActiveThreads.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardActiveThreads'));
  assert.ok(existsSync(activeThreadsUrl), 'Dashboard Active Threads component must exist');

  const componentSource = readFileSync(activeThreadsUrl, 'utf8');
  for (const publicContract of [
    'Active Threads',
    'active-threads-task-proof-backend-required',
    'active-threads-sync-manager-dashboard',
    'active-thread-task-row-',
    'Assigned by Leader',
    'Deadline set by Leader',
    'active-thread-deadline-',
    'active-thread-current-step-',
    'active-thread-deliverable-',
    'Leader must set',
    'OVERDUE',
    'Assignment proof',
    'Owner synced',
    'Chat proof',
    'Timeline proof',
    'onOpenChatProof',
    'onOpenTimelineProof',
    'onSyncManagerDashboard',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Active Threads must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('rows: activeThreadRows.map(task => ({'));
  assert.ok(appSource.includes('evidence: taskEvidence(task)'));
  assert.ok(appSource.includes("chatProofChannel: task.sourceChannelId || task.channelId || 'main'"));
  assert.ok(appSource.includes('onOpenChatProof: (chatIds, channelId) => openProjectChatProof'));
  assert.ok(appSource.includes('onOpenTimelineProof: openProjectTimelineProof'));
  assert.ok(appSource.includes('onSyncManagerDashboard: () => syncBackendManagerDashboard'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
});
