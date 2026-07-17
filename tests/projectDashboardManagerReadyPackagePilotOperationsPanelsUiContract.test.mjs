import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx', import.meta.url);

test('Manager Ready Package pilot and production panels stay lazy while App retains every write function', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package pilot operations panels component must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(operationalAssemblySource.includes("const ProjectDashboardManagerReadyPackagePilotOperationsPanels = lazy(() => import('./ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx'))"));
  assert.ok(operationalAssemblySource.includes('<ProjectDashboardManagerReadyPackagePilotOperationsPanels'));

  const childComponents = [
    'ProjectDashboardPrivatePilotWorkflowPanels',
    'ProjectDashboardProductionOperationsReadiness',
    'ProjectDashboardProductionOperationsControlReceipts',
    'ProjectDashboardProductionDeploymentControlReceipts',
    'ProjectDashboardProductionSecurityControlReceipts',
    'ProjectDashboardProductionProviderControlReceipts',
    'ProjectDashboardProductionLaunchAudit',
    'ProjectDashboardLaunchApprovalWorkflow',
  ];
  let previousMountIndex = -1;
  for (const componentName of childComponents) {
    assert.ok(wrapperSource.includes(`const ${componentName} = lazy(() => import('./${componentName}.jsx'))`));
    const mountIndex = wrapperSource.indexOf(`<${componentName}`);
    assert.ok(mountIndex > previousMountIndex, `${componentName} must keep its original display order`);
    previousMountIndex = mountIndex;
  }

  for (const contract of [
    'onRecordReceipt={onRecordPrivatePilotReceipt}',
    'recordDisabled={recordPrivatePilotDisabled}',
    'fallbackRoute={readyPackage.backendRoutes?.productionOperationsReadiness}',
    'onRecordReceipt={onRecordProductionControlReceipt}',
    'recordDisabled={recordProductionControlDisabled}',
    'providerEvalReady={providerEvalReady}',
    'productionLaunchAuditAvailable && productionLaunchAudit',
    'route={readyPackage.backendRoutes?.productionLaunchAudit}',
    'launchApprovalWorkflowAvailable && launchApprovalWorkflow',
    'managerApproved={launchManagerApproved}',
    'prereqsReady={launchApprovalPrereqsReady}',
    'securityApproved={launchSecurityApproved}',
    "sourceBadge={managerReadModelSourceBadge(launchApprovalWorkflow, 'backend-launch-approval-workflow-source')}",
  ]) {
    assert.ok(wrapperSource.includes(contract), `Pilot operations wrapper must keep ${contract}`);
  }

  for (const appContract of [
    'onRecordPrivatePilotReceipt: runBackendPrivatePilotReceipt',
    'onRecordProductionControlReceipt: runBackendProductionControlReceipt',
    'recordPrivatePilotDisabled: !backendCommandAvailable || backendStation.loading',
    'recordProductionControlDisabled: !backendCommandAvailable || backendStation.loading',
    'productionLaunchAuditAvailable: readyPackageModelAvailable(backendProductionLaunchAudit)',
    'launchApprovalWorkflowAvailable: readyPackageModelAvailable(backendLaunchApprovalWorkflow)',
    'launchApprovalPrereqsReady: backendLaunchApprovalPrereqsReady',
  ]) {
    assert.ok(appSource.includes(appContract), `App must retain ${appContract}`);
  }
});
