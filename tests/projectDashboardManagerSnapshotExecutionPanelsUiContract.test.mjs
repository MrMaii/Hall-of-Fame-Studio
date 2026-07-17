import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerSnapshotExecutionPanels.jsx', import.meta.url);

test('Manager snapshot and mission runner stay lazy while App retains every operation and disable rule', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager snapshot execution wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardManagerSnapshotExecutionPanels = lazy(() => import('./ProjectDashboardManagerSnapshotExecutionPanels.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerSnapshotExecutionPanels'));
  assert.ok(assemblySource.includes('data-testid="backend-manager-dashboard-snapshot"'));

  for (const contract of [
    'onRunHandoffIntent: () => runCollaborationIntentQueueRow(backendMissionHandoffIntentRow)',
    'runHandoffIntentDisabled: !backendCommandAvailable || backendStation.loading || !backendMissionHandoffIntentRow?.canRun || !backendMissionHandoffIntentRow?.runIntentApiPath',
    "onOpenHandoffChatProof: () => openProjectChatProof(activeProject, backendMissionHandoffExecutionChatProofIds, 'main')",
    'handoffChatProofDisabled: !backendMissionHandoffExecutionChatProofIds.length',
    'onOpenHandoffTimelineProof: () => openProjectTimelineProof(backendMissionHandoffExecutionTimelineIds)',
    'handoffTimelineProofDisabled: !backendMissionHandoffExecutionTimelineIds.length',
    "onOpenMissionChatProof: () => openProjectChatProof(activeProject, backendProductTeamMissionChatProofIds, 'main')",
    'missionChatProofDisabled: !backendProductTeamMissionChatProofIds.length',
    'onOpenMissionTimelineProof: () => openProjectTimelineProof(backendProductTeamMissionTimelineIds)',
    'missionTimelineProofDisabled: !backendProductTeamMissionTimelineIds.length',
    'onOpenMissionFlowNode: () => openManagerFlowNode(backendProductTeamMissionFlowNodeId, {',
    'chatProofIds: backendProductTeamMissionChatProofIds,',
    'timelineLogIds: backendProductTeamMissionTimelineIds,',
    'missionFlowNodeDisabled: !backendProductTeamMissionFlowNodeId',
  ]) {
    assert.ok(appSource.includes(contract), `App must retain ${contract}`);
  }

  const components = [
    'ProjectDashboardManagerSnapshotSummary',
    'ProjectDashboardProductTeamMissionRunner',
  ];
  for (const component of components) {
    assert.ok(wrapperSource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`), `${component} must remain lazy`);
    assert.ok(wrapperSource.includes(`<${component}`), `${component} must remain mounted`);
  }
  const mountOrder = components.map(component => wrapperSource.indexOf(`<${component}`));
  assert.deepEqual(mountOrder, [...mountOrder].sort((left, right) => left - right), 'Manager snapshot and mission runner must retain their original order');

  for (const contract of [
    'backendManagerDashboard: managerDashboard,',
    'backendManagerScenarioTrail: managerScenarioTrail,',
    'backendManagerScenarioWalkthrough: managerScenarioWalkthrough,',
    'backendManagerActionQueue: managerActionQueue,',
    'backendAgentAutonomousActionQueue: agentAutonomousActionQueue,',
    'backendAutonomousRunControl: autonomousRunControl,',
    'backendProductTeamMissionRuns: productTeamMissionRuns,',
    'backendProductTeamMissionRows: productTeamMissionRows,',
    'backendTranscriptProofCoverageSummary: transcriptProofCoverageSummary,',
    'latestProductTeamMissionRun && (',
    'backendLatestProductTeamMissionRun: latestProductTeamMissionRun,',
    'backendMissionHandoffExecution: missionHandoffExecution,',
    'backendMissionHandoffExecutionOutputRows: missionHandoffExecutionOutputRows,',
    'backendMissionHandoffIntentRow: missionHandoffIntentRow,',
    'onRunHandoffIntent={onRunHandoffIntent}',
    'runHandoffIntentDisabled={runHandoffIntentDisabled}',
    'onOpenHandoffChatProof={onOpenHandoffChatProof}',
    'handoffChatProofDisabled={handoffChatProofDisabled}',
    'onOpenHandoffTimelineProof={onOpenHandoffTimelineProof}',
    'handoffTimelineProofDisabled={handoffTimelineProofDisabled}',
    'onOpenMissionChatProof={onOpenMissionChatProof}',
    'missionChatProofDisabled={missionChatProofDisabled}',
    'onOpenMissionTimelineProof={onOpenMissionTimelineProof}',
    'missionTimelineProofDisabled={missionTimelineProofDisabled}',
    'onOpenMissionFlowNode={onOpenMissionFlowNode}',
    'missionFlowNodeDisabled={missionFlowNodeDisabled}',
  ]) {
    assert.ok(wrapperSource.includes(contract), `Manager snapshot execution wrapper must retain ${contract}`);
  }
});
