import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardCoordinationTeamPanels.jsx', import.meta.url), 'utf8');
const assignmentFlowUrl = new URL('../src/project/ProjectDashboardLeaderAssignmentFlow.jsx', import.meta.url);

test('Dashboard Leader Assignment Flow stays lazy and keeps assignment, progress, chat, and timeline proof routes', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardLeaderAssignmentFlow = lazy(() => import('./ProjectDashboardLeaderAssignmentFlow.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardLeaderAssignmentFlow'));
  assert.ok(existsSync(assignmentFlowUrl), 'Dashboard Leader Assignment Flow component must exist');

  const componentSource = readFileSync(assignmentFlowUrl, 'utf8');
  for (const publicContract of [
    'Leader Assignment Flow',
    'assignment-timeline-matrix',
    'assignment-timeline-matrix-source',
    'assignment-timeline-matrix-backend-required',
    'assignment-timeline-matrix-sync-cockpit',
    'assignment-timeline-row-',
    'assignment-work-progress-matrix',
    'assignment-work-progress-row-',
    'assignment-flow-',
    'Assignment receipt proof',
    'Assignment timeline event proof',
    'Progress chat proof',
    'Completion timeline proof',
    'Assignment chat proof',
    'Assignment timeline proof',
    'onOpenChatProof',
    'onOpenTimelineProof',
    'onSyncCockpit',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Leader Assignment Flow must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('assignmentFlowRows,'));
  assert.ok(appSource.includes('assignmentTimelineRows: assignmentTimelineMatrixDisplayRows'));
  assert.ok(appSource.includes('assignmentWorkProgressRows,'));
  assert.ok(appSource.includes('onOpenChatProof: (chatIds, channelId) => openProjectChatProof'));
  assert.ok(appSource.includes('onOpenTimelineProof: openProjectTimelineProof'));
  assert.ok(appSource.includes('onSyncCockpit: () => syncBackendCockpitReadModels'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
});
