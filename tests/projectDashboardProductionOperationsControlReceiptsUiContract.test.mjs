import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProductionOperationsControlReceipts.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx', import.meta.url);

test('production operations control receipts stay lazy and preserve the original rehearsal command', () => {
  assert.ok(existsSync(componentUrl), 'Production operations control receipts component must exist');
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package pilot operations wrapper must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(wrapperSource.includes("const ProjectDashboardProductionOperationsControlReceipts = lazy(() => import('./ProjectDashboardProductionOperationsControlReceipts.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProductionOperationsControlReceipts'));
  assert.ok(wrapperSource.includes('onRecordReceipt={onRecordProductionControlReceipt}'));
  assert.ok(wrapperSource.includes('recordDisabled={recordProductionControlDisabled}'));
  assert.ok(wrapperSource.includes('fallbackRoute={productionOperationsReadiness?.backendRoutes?.productionOperationsControlReceipts}'));
  assert.ok(wrapperSource.includes('workflow={productionOperationsControlReceiptWorkflow}'));
  assert.ok(appSource.includes('onRecordProductionControlReceipt: runBackendProductionControlReceipt'));
  assert.ok(appSource.includes('recordProductionControlDisabled: !backendCommandAvailable || backendStation.loading'));
  assert.ok(appSource.includes('productionOperationsControlReceiptWorkflow: backendProductionOperationsControlReceiptWorkflow'));

  for (const contract of [
    'backend-production-operations-control-receipts-snapshot',
    'Production Operations Control Receipts',
    'backend-production-operations-record-controls',
    "label: 'Production operations control rehearsal'",
    "workflowKey: 'productionOperationsControlReceiptWorkflow'",
    "receiptKey: 'productionOperationsControlReceipt'",
    "actorRole: 'security-admin'",
    "actorId: 'security-lead'",
    "prefix: 'manager_ui_prod_ops'",
    "evidenceRouteBase: 'https://local-rehearsal.hofs.invalid/production-operations'",
    "defaultOwnerRole: 'operations-owner'",
    'recordDisabled || workflow.readyForProductionOperations || !workflow.readyForPrivatePilotOperations',
    'Record Rehearsal',
    'Receipts',
    'Verified Controls',
    'Missing Controls',
    'Latest Receipt',
    'Private Pilot Ops',
    'Control Proof',
    'Production Ops',
    'Packet',
    '.filter(row => !row.verified).slice(0, 4)',
    'Ops receipts route',
    '`/projects/${projectId}/production-operations-control-receipts`',
  ]) {
    assert.ok(componentSource.includes(contract), `Production operations control receipts must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-production-operations-control-receipts-snapshot"'),
    false,
    'Production operations control receipt markup must no longer remain duplicated in App',
  );
});
