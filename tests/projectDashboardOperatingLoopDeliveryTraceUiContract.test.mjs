import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const coreAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const coordinationUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageCoordinationPanels.jsx', import.meta.url);
const runtimePanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageRuntimePanels.jsx', import.meta.url);
const operatingLoopUrl = new URL('../src/project/ProjectDashboardProductTeamOperatingLoop.jsx', import.meta.url);
const deliveryTraceUrl = new URL('../src/project/ProjectDashboardProductTeamDeliveryTrace.jsx', import.meta.url);

test('Dashboard product-team operating loop and delivery trace stay lazy and preserve proof rows', () => {
  const coordinationSource = readFileSync(coordinationUrl, 'utf8');
  const runtimePanelsSource = readFileSync(runtimePanelsUrl, 'utf8');
  assert.ok(coreAssemblySource.includes("const ProjectDashboardManagerReadyPackageCoordinationPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageCoordinationPanels.jsx'))"));
  assert.ok(coreAssemblySource.includes("const ProjectDashboardManagerReadyPackageRuntimePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageRuntimePanels.jsx'))"));
  assert.ok(coordinationSource.includes("const ProjectDashboardProductTeamOperatingLoop = lazy(() => import('./ProjectDashboardProductTeamOperatingLoop.jsx'))"));
  assert.ok(runtimePanelsSource.includes("const ProjectDashboardProductTeamDeliveryTrace = lazy(() => import('./ProjectDashboardProductTeamDeliveryTrace.jsx'))"));
  assert.ok(coordinationSource.includes('<ProjectDashboardProductTeamOperatingLoop'));
  assert.ok(runtimePanelsSource.includes('<ProjectDashboardProductTeamDeliveryTrace'));
  assert.ok(existsSync(coordinationUrl), 'Manager Ready Package coordination panels component must exist');
  assert.ok(existsSync(runtimePanelsUrl), 'Manager Ready Package runtime panels component must exist');
  assert.ok(existsSync(operatingLoopUrl), 'Dashboard product-team operating loop component must exist');
  assert.ok(existsSync(deliveryTraceUrl), 'Dashboard product-team delivery trace component must exist');

  const operatingLoopSource = readFileSync(operatingLoopUrl, 'utf8');
  for (const publicContract of [
    'backend-product-team-operating-loop-snapshot',
    'Product Team Operating Loop',
    'readyForLocalPilotOperatingLoop',
    'customerAgentHandoffExecutionStatus',
    'customerAgentHandoffExecutionRunReceiptCount',
    'customerAgentHandoffExecutionSubmissionCount',
    'agentInitiativeCount',
    'nextMissingStageId',
    'backend-product-team-operating-loop-initiatives',
    'row.runApiPath',
    'gate.productionBlocker',
    'backend-product-team-operating-loop-route',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(operatingLoopSource.includes(publicContract), `Dashboard operating loop must keep ${publicContract}`);
  }

  const deliveryTraceSource = readFileSync(deliveryTraceUrl, 'utf8');
  for (const publicContract of [
    'backend-product-team-delivery-trace-snapshot',
    'Product Team Delivery Trace',
    'readyForPrivatePilotDelivery',
    'brainstormAlternativeCount',
    'evidenceSearchCount',
    'generatedDraftCount',
    'reviewRoundCount',
    'revisionResponseCount',
    'acceptedFinalDeliverableCount',
    'row.proofIds',
    'backend-product-team-delivery-trace-route',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(deliveryTraceSource.includes(publicContract), `Dashboard delivery trace must keep ${publicContract}`);
  }

  assert.ok(coordinationSource.includes('model: operatingLoop'));
  assert.ok(runtimePanelsSource.includes('model: productTeamDeliveryTrace'));
  assert.ok(coordinationSource.includes("managerProofModelSyncButton(operatingLoop, 'backend-product-team-operating-loop-sync-proof-models')"));
  assert.ok(runtimePanelsSource.includes("managerProofModelSyncButton(productTeamDeliveryTrace, 'backend-product-team-delivery-trace-sync-proof-models')"));
  assert.ok(coordinationSource.includes('operatingLoop.backendRoutes?.productTeamOperatingLoop'));
  assert.ok(runtimePanelsSource.includes('productTeamDeliveryTrace.backendRoutes?.productTeamDeliveryTrace'));
});
