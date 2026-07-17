import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProductionSecurityControlReceipts.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx', import.meta.url);

test('production security control receipts stay lazy and preserve the original rehearsal command', () => {
  assert.ok(existsSync(componentUrl), 'Production security control receipts component must exist');
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package pilot operations wrapper must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(wrapperSource.includes("const ProjectDashboardProductionSecurityControlReceipts = lazy(() => import('./ProjectDashboardProductionSecurityControlReceipts.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProductionSecurityControlReceipts'));
  assert.ok(wrapperSource.includes('onRecordReceipt={onRecordProductionControlReceipt}'));
  assert.ok(wrapperSource.includes('recordDisabled={recordProductionControlDisabled}'));
  assert.ok(wrapperSource.includes('workflow={productionSecurityControlReceiptWorkflow}'));
  assert.ok(appSource.includes('onRecordProductionControlReceipt: runBackendProductionControlReceipt'));
  assert.ok(appSource.includes('recordProductionControlDisabled: !backendCommandAvailable || backendStation.loading'));
  assert.ok(appSource.includes('productionSecurityControlReceiptWorkflow: backendProductionSecurityControlReceiptWorkflow'));

  for (const contract of [
    'backend-production-security-control-receipts-snapshot',
    'Production Security Control Receipts',
    'backend-production-security-record-controls',
    "label: 'Production security control rehearsal'",
    "workflowKey: 'productionSecurityControlReceiptWorkflow'",
    "receiptKey: 'productionSecurityControlReceipt'",
    "actorRole: 'security-admin'",
    "actorId: 'security-lead'",
    "prefix: 'manager_ui_prod_security'",
    "evidenceRouteBase: 'https://local-rehearsal.hofs.invalid/production-security'",
    "defaultOwnerRole: 'security-admin'",
    'recordDisabled || workflow.readyForProductionSecurity || !workflow.readyForLocalSecurityBoundary',
    'Record Rehearsal',
    'Receipts',
    'Verified Controls',
    'Missing Controls',
    'Latest Receipt',
    'Local Boundary',
    'Control Proof',
    'Production Security',
    'Packet',
    '.filter(row => !row.verified).slice(0, 4)',
    'Security receipts route',
    '`/projects/${projectId}/production-security-control-receipts`',
  ]) {
    assert.ok(componentSource.includes(contract), `Production security control receipts must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-production-security-control-receipts-snapshot"'),
    false,
    'Production security control receipt markup must no longer remain duplicated in App',
  );
});
