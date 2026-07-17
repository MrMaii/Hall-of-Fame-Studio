import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageRuntimePanels.jsx', import.meta.url);

test('Manager Ready Package runtime panels stay lazy and preserve sync and proof navigation', () => {
  assert.ok(existsSync(componentUrl), 'Manager Ready Package runtime panels component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardManagerReadyPackageRuntimePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageRuntimePanels.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerReadyPackageRuntimePanels'));
  assert.ok(appSource.includes('runtimeContracts: backendRuntimeContracts'));
  assert.ok(appSource.includes('autonomousCycleConsistency: backendAutonomousCycleConsistency'));
  assert.ok(appSource.includes('runtimeAutonomyStatus: backendRuntimeAutonomyStatus'));
  assert.ok(appSource.includes('zeroToAutonomyReport: backendZeroToAutonomyReport'));
  assert.ok(appSource.includes('productTeamDeliveryTrace: backendProductTeamDeliveryTrace'));
  assert.ok(appSource.includes("onOpenRuntimeAutonomyChat: () => openProjectChatProof(activeProject, backendRuntimeAutonomyStatusChatProofIds, 'main')"));
  assert.ok(appSource.includes('onOpenRuntimeAutonomyTimeline: () => openProjectTimelineProof(backendRuntimeAutonomyStatusTimelineIds)'));
  assert.ok(appSource.includes('onOpenRuntimeAutonomyFlowNode: () => openManagerFlowNode(backendRuntimeAutonomyStatusFlowNodeId, {'));

  for (const contract of [
    "const ProjectDashboardRuntimeContracts = lazy(() => import('./ProjectDashboardRuntimeContracts.jsx'))",
    "const ProjectDashboardAutonomousCycleConsistency = lazy(() => import('./ProjectDashboardAutonomousCycleConsistency.jsx'))",
    "const ProjectDashboardRuntimeAutonomyStatus = lazy(() => import('./ProjectDashboardRuntimeAutonomyStatus.jsx'))",
    "const ProjectDashboardZeroToAutonomyReport = lazy(() => import('./ProjectDashboardZeroToAutonomyReport.jsx'))",
    "const ProjectDashboardProductTeamDeliveryTrace = lazy(() => import('./ProjectDashboardProductTeamDeliveryTrace.jsx'))",
    'backend-runtime-contracts-source',
    'backend-autonomous-cycle-consistency-source',
    'backend-runtime-autonomy-status-source',
    'backend-zero-to-autonomy-report-source',
    'backend-product-team-delivery-trace-source',
    'backend-runtime-contracts-sync-proof-models',
    'backend-autonomous-cycle-consistency-sync-proof-models',
    'backend-runtime-autonomy-status-sync-proof-models',
    'backend-zero-to-autonomy-report-sync-proof-models',
    'backend-product-team-delivery-trace-sync-proof-models',
    '/runtime-contracts',
    '/autonomous-cycle-consistency',
    '/runtime-autonomy-status',
    '/zero-to-autonomy-report',
    '/product-team-delivery-trace',
    'onOpenChat: onOpenRuntimeAutonomyChat',
    'onOpenFlowNode: onOpenRuntimeAutonomyFlowNode',
    'onOpenTimeline: onOpenRuntimeAutonomyTimeline',
  ]) {
    assert.ok(componentSource.includes(contract), `Manager Ready Package runtime panels must keep ${contract}`);
  }

  for (const oldAppContract of [
    "const ProjectDashboardRuntimeContracts = lazy(() => import('./project/ProjectDashboardRuntimeContracts.jsx'));",
    "const ProjectDashboardAutonomousCycleConsistency = lazy(() => import('./project/ProjectDashboardAutonomousCycleConsistency.jsx'));",
    "const ProjectDashboardRuntimeAutonomyStatus = lazy(() => import('./project/ProjectDashboardRuntimeAutonomyStatus.jsx'));",
    "const ProjectDashboardZeroToAutonomyReport = lazy(() => import('./project/ProjectDashboardZeroToAutonomyReport.jsx'));",
    "const ProjectDashboardProductTeamDeliveryTrace = lazy(() => import('./project/ProjectDashboardProductTeamDeliveryTrace.jsx'));",
    '<ProjectDashboardRuntimeContracts',
    '<ProjectDashboardAutonomousCycleConsistency',
    '<ProjectDashboardRuntimeAutonomyStatus',
    '<ProjectDashboardZeroToAutonomyReport',
    '<ProjectDashboardProductTeamDeliveryTrace',
  ]) {
    assert.equal(appSource.includes(oldAppContract), false, `App must no longer duplicate ${oldAppContract}`);
  }
});
