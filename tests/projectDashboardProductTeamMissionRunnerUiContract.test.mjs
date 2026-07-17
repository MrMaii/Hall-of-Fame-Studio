import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerSnapshotExecutionPanels.jsx', import.meta.url);
const componentUrl = new URL('../src/project/ProjectDashboardProductTeamMissionRunner.jsx', import.meta.url);

test('Dashboard mission runner stays lazy while App keeps all six action callbacks and disable policies', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager snapshot execution wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardProductTeamMissionRunner = lazy(() => import('./ProjectDashboardProductTeamMissionRunner.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProductTeamMissionRunner'));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerSnapshotExecutionPanels'));
  assert.ok(existsSync(componentUrl), 'Dashboard product team mission runner component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-product-team-mission-runs-snapshot',
    'Product Team Mission Runner',
    'Research Only',
    'Generic Product Team',
    'Reused Kickoff',
    'New Kickoff',
    'Runs',
    'Agents',
    'Tasks',
    'Autopilot',
    'C/A Handoff',
    'backend-product-team-mission-runs-route',
    'backend-product-team-mission-handoff-execution',
    'backend-product-team-mission-handoff-latest-output',
    'backend-product-team-mission-handoff-output-rows',
    'backend-product-team-mission-run-handoff-intent',
    'backend-product-team-mission-handoff-chat-proof',
    'backend-product-team-mission-handoff-timeline-proof',
    'backend-product-team-mission-chat-proof',
    'backend-product-team-mission-timeline-proof',
    'backend-product-team-mission-flow-node',
    'Run C/A handoff',
    'Handoff chat proof',
    'Handoff timeline proof',
    'Mission chat proof',
    'Mission timeline proof',
    'Flow node',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard mission runner must keep ${publicContract}`);
  }

  assert.ok(wrapperSource.includes('latestProductTeamMissionRun && ('), 'Mission runner must remain conditional');

  for (const appContract of [
    'latestProductTeamMissionRun: backendLatestProductTeamMissionRun',
    'onRunHandoffIntent: () => runCollaborationIntentQueueRow(backendMissionHandoffIntentRow)',
    '!backendCommandAvailable || backendStation.loading || !backendMissionHandoffIntentRow?.canRun || !backendMissionHandoffIntentRow?.runIntentApiPath',
    "onOpenHandoffChatProof: () => openProjectChatProof(activeProject, backendMissionHandoffExecutionChatProofIds, 'main')",
    '!backendMissionHandoffExecutionChatProofIds.length',
    'onOpenHandoffTimelineProof: () => openProjectTimelineProof(backendMissionHandoffExecutionTimelineIds)',
    '!backendMissionHandoffExecutionTimelineIds.length',
    "onOpenMissionChatProof: () => openProjectChatProof(activeProject, backendProductTeamMissionChatProofIds, 'main')",
    '!backendProductTeamMissionChatProofIds.length',
    'onOpenMissionTimelineProof: () => openProjectTimelineProof(backendProductTeamMissionTimelineIds)',
    '!backendProductTeamMissionTimelineIds.length',
    'onOpenMissionFlowNode: () => openManagerFlowNode(backendProductTeamMissionFlowNodeId, {',
    'chatProofIds: backendProductTeamMissionChatProofIds,',
    'timelineLogIds: backendProductTeamMissionTimelineIds,',
    '!backendProductTeamMissionFlowNodeId',
  ]) {
    assert.ok(appSource.includes(appContract), `App must retain mission runner action contract ${appContract}`);
  }
});
