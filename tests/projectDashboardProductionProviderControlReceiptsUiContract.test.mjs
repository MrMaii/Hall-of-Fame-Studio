import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProductionProviderControlReceipts.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx', import.meta.url);

test('production provider control receipts stay lazy and preserve the original rehearsal command', () => {
  assert.ok(existsSync(componentUrl), 'Production provider control receipts component must exist');
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package pilot operations wrapper must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(wrapperSource.includes("const ProjectDashboardProductionProviderControlReceipts = lazy(() => import('./ProjectDashboardProductionProviderControlReceipts.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProductionProviderControlReceipts'));
  assert.ok(wrapperSource.includes('onRecordReceipt={onRecordProductionControlReceipt}'));
  assert.ok(wrapperSource.includes('providerEvalReady={providerEvalReady}'));
  assert.ok(wrapperSource.includes('recordDisabled={recordProductionControlDisabled}'));
  assert.ok(wrapperSource.includes('workflow={productionProviderControlReceiptWorkflow}'));
  assert.ok(appSource.includes('onRecordProductionControlReceipt: runBackendProductionControlReceipt'));
  assert.ok(appSource.includes('providerEvalReady: backendProviderEvalRunWorkflow?.readyForPrivatePilotProviderEval'));
  assert.ok(appSource.includes('recordProductionControlDisabled: !backendCommandAvailable || backendStation.loading'));
  assert.ok(appSource.includes('productionProviderControlReceiptWorkflow: backendProductionProviderControlReceiptWorkflow'));

  for (const contract of [
    'backend-production-provider-control-receipts-snapshot',
    'Production Provider Control Receipts',
    'backend-production-provider-record-controls',
    "label: 'Production provider control rehearsal'",
    "workflowKey: 'productionProviderControlReceiptWorkflow'",
    "receiptKey: 'productionProviderControlReceipt'",
    "actorRole: 'runtime-platform'",
    "actorId: 'runtime-ops'",
    "prefix: 'manager_ui_prod_provider'",
    "evidenceRouteBase: 'https://local-rehearsal.hofs.invalid/production-provider'",
    "defaultOwnerRole: 'runtime-platform'",
    'recordDisabled || workflow.readyForProductionProvider || !workflow.readyForLocalProviderContract || !providerEvalReady',
    'Record Rehearsal',
    'Receipts',
    'Verified Controls',
    'Missing Controls',
    'Latest Receipt',
    'Provider Local',
    'Provider Eval',
    'Production Provider',
    'Packet',
    '.filter(row => !row.verified).slice(0, 4)',
    "row.latestReceiptChecksum || row.sourceStatus || row.status || 'missing'",
    'Provider receipts route',
    '`/projects/${projectId}/production-provider-control-receipts`',
  ]) {
    assert.ok(componentSource.includes(contract), `Production provider control receipts must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-production-provider-control-receipts-snapshot"'),
    false,
    'Production provider control receipt markup must no longer remain duplicated in App',
  );
});
