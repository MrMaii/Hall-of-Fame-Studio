import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const coreAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const runtimePanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageRuntimePanels.jsx', import.meta.url);
const runtimeUrl = new URL('../src/project/ProjectDashboardRuntimeAutonomyStatus.jsx', import.meta.url);
const reportUrl = new URL('../src/project/ProjectDashboardZeroToAutonomyReport.jsx', import.meta.url);

test('Dashboard runtime autonomy status and zero-to-autonomy report stay lazy and keep proof exits', () => {
  const runtimePanelsSource = readFileSync(runtimePanelsUrl, 'utf8');
  assert.ok(coreAssemblySource.includes("const ProjectDashboardManagerReadyPackageRuntimePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageRuntimePanels.jsx'))"));
  assert.ok(runtimePanelsSource.includes("const ProjectDashboardRuntimeAutonomyStatus = lazy(() => import('./ProjectDashboardRuntimeAutonomyStatus.jsx'))"));
  assert.ok(runtimePanelsSource.includes("const ProjectDashboardZeroToAutonomyReport = lazy(() => import('./ProjectDashboardZeroToAutonomyReport.jsx'))"));
  assert.ok(runtimePanelsSource.includes('<ProjectDashboardRuntimeAutonomyStatus'));
  assert.ok(runtimePanelsSource.includes('<ProjectDashboardZeroToAutonomyReport'));
  assert.ok(existsSync(runtimePanelsUrl), 'Manager Ready Package runtime panels component must exist');
  assert.ok(existsSync(runtimeUrl), 'Dashboard runtime autonomy status component must exist');
  assert.ok(existsSync(reportUrl), 'Dashboard zero-to-autonomy report component must exist');

  const runtimeSource = readFileSync(runtimeUrl, 'utf8');
  for (const publicContract of [
    'backend-runtime-autonomy-status-snapshot',
    'Runtime Autonomy Status',
    'readyForLocalAutonomy',
    'readyForUnattendedProduction',
    'readyLocalGateCount',
    'recoverableAutopilotQueueCount',
    'backend-runtime-autonomy-status-gates',
    'backend-runtime-autonomy-status-route',
    'backend-runtime-autonomy-status-production-boundary',
    'backend-runtime-autonomy-status-chat-proof',
    'backend-runtime-autonomy-status-timeline-proof',
    'backend-runtime-autonomy-status-flow-node',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'disabled={!flowNodeId}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(runtimeSource.includes(publicContract), `Dashboard runtime autonomy status must keep ${publicContract}`);
  }

  const reportSource = readFileSync(reportUrl, 'utf8');
  for (const publicContract of [
    'backend-zero-to-autonomy-report-snapshot',
    'Zero-to-autonomy',
    'readyForLocalMvpTrial',
    'readyForPublicProduction',
    'readyStageCount',
    'submittedArtifactTypeCount',
    'providerUsageCount',
    'sourceReviewDecisionCount',
    'archiveRawLeakCount',
    'backend-zero-to-autonomy-report-stage-proof-count-',
    'backend-zero-to-autonomy-report-stage-timeline-count-',
    'backend-zero-to-autonomy-report-stage-event-count-',
    'backend-zero-to-autonomy-report-stage-route-',
    'backend-zero-to-autonomy-report-route',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(reportSource.includes(publicContract), `Dashboard zero-to-autonomy report must keep ${publicContract}`);
  }

  assert.ok(runtimePanelsSource.includes('model: runtimeAutonomyStatus'));
  assert.ok(runtimePanelsSource.includes('model: zeroToAutonomyReport'));
  assert.ok(runtimePanelsSource.includes('chatProofIds: runtimeAutonomyChatProofIds'));
  assert.ok(runtimePanelsSource.includes('timelineIds: runtimeAutonomyTimelineIds'));
  assert.ok(runtimePanelsSource.includes('flowNodeId: runtimeAutonomyFlowNodeId'));
  assert.ok(appSource.includes("openProjectChatProof(activeProject, backendRuntimeAutonomyStatusChatProofIds, 'main')"));
  assert.ok(appSource.includes('openProjectTimelineProof(backendRuntimeAutonomyStatusTimelineIds)'));
  assert.ok(appSource.includes('openManagerFlowNode(backendRuntimeAutonomyStatusFlowNodeId'));
  assert.ok(runtimePanelsSource.includes("managerProofModelSyncButton(runtimeAutonomyStatus, 'backend-runtime-autonomy-status-sync-proof-models')"));
  assert.ok(runtimePanelsSource.includes("managerProofModelSyncButton(zeroToAutonomyReport, 'backend-zero-to-autonomy-report-sync-proof-models')"));
});
