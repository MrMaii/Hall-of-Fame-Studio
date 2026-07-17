import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProductionDeploymentControlReceipts.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx', import.meta.url);

test('production deployment control receipts stay lazy and preserve the original rehearsal command', () => {
  assert.ok(existsSync(componentUrl), 'Production deployment control receipts component must exist');
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package pilot operations wrapper must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(wrapperSource.includes("const ProjectDashboardProductionDeploymentControlReceipts = lazy(() => import('./ProjectDashboardProductionDeploymentControlReceipts.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProductionDeploymentControlReceipts'));
  assert.ok(wrapperSource.includes('onRecordReceipt={onRecordProductionControlReceipt}'));
  assert.ok(wrapperSource.includes('recordDisabled={recordProductionControlDisabled}'));
  assert.ok(wrapperSource.includes('workflow={productionDeploymentControlReceiptWorkflow}'));
  assert.ok(appSource.includes('onRecordProductionControlReceipt: runBackendProductionControlReceipt'));
  assert.ok(appSource.includes('recordProductionControlDisabled: !backendCommandAvailable || backendStation.loading'));
  assert.ok(appSource.includes('productionDeploymentControlReceiptWorkflow: backendProductionDeploymentControlReceiptWorkflow'));

  for (const contract of [
    'backend-production-deployment-control-receipts-snapshot',
    'Production Deployment Control Receipts',
    'backend-production-deployment-record-controls',
    "label: 'Production deployment control rehearsal'",
    "workflowKey: 'productionDeploymentControlReceiptWorkflow'",
    "receiptKey: 'productionDeploymentControlReceipt'",
    "actorRole: 'runtime-platform'",
    "actorId: 'runtime-ops'",
    "prefix: 'manager_ui_prod_deploy'",
    "evidenceRouteBase: 'https://local-rehearsal.hofs.invalid/production-deployment'",
    "defaultOwnerRole: 'runtime-platform'",
    'recordDisabled || workflow.readyForProductionDeployment || !workflow.readyForPrivatePilotDeployment',
    'Record Rehearsal',
    'Receipts',
    'Verified Controls',
    'Missing Controls',
    'Latest Receipt',
    'Private Pilot Deploy',
    'Control Proof',
    'Production Deploy',
    'Packet',
    '.filter(row => !row.verified).slice(0, 4)',
    'Deployment receipts route',
    '`/projects/${projectId}/production-deployment-control-receipts`',
  ]) {
    assert.ok(componentSource.includes(contract), `Production deployment control receipts must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-production-deployment-control-receipts-snapshot"'),
    false,
    'Production deployment control receipt markup must no longer remain duplicated in App',
  );
});
