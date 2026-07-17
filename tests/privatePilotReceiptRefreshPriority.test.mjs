import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('private-pilot receipts keep lightweight proof refresh immediate without an automatic full Ready Package read', () => {
  const handlerStart = source.indexOf('const runBackendPrivatePilotReceipt = async ({');
  const handlerEnd = source.indexOf('const buildProductionControlReceiptRows = (workflow, {', handlerStart);
  const receiptHandler = source.slice(handlerStart, handlerEnd);

  for (const contract of [
    'const runBackendPrivatePilotReceipt = async ({',
    'cancelPendingBackendReadModelRefreshes();',
    'const refreshedReadModels = await refreshReceiptReadModels({',
    'const receiptWorkflowModels = Object.fromEntries([',
    "'privatePilotLaunchRunWorkflow',",
    "'privatePilotLaunchHealthCheckWorkflow',",
    "'privatePilotAcceptanceReportWorkflow',",
    "'productionOperationsControlReceiptWorkflow',",
    "'productionDeploymentControlReceiptWorkflow',",
    "'productionSecurityControlReceiptWorkflow',",
    "'productionProviderControlReceiptWorkflow',",
    '...receiptWorkflowModels,',
    'if (!refreshedReadModels || !Object.keys(refreshedReadModels).length) {',
    'syncBackendReadyPackageSubmodels({ silent: true, projectId, includeLaunchControls: true })',
  ]) {
    assert.ok(receiptHandler.includes(contract), `Private-pilot receipt refresh priority must keep ${contract}`);
  }

  assert.equal(
    receiptHandler.includes('syncBackendManagerReadyPackage('),
    false,
    'Private-pilot receipts must not start an automatic full Ready Package read after lightweight receipt refresh',
  );
  assert.equal(source.includes('backendPrivatePilotReceiptRefreshTimerRef'), false, 'The obsolete delayed full-refresh timer must be removed');
});

test('private-pilot receipt refresh cannot replace dependent workflows returned by the write response', () => {
  const refreshStart = source.indexOf('const refreshReceiptReadModels = async ({');
  const refreshEnd = source.indexOf('const syncBackendCollaborationIntentQueue = async (', refreshStart);
  const receiptRefresh = source.slice(refreshStart, refreshEnd);

  for (const contract of [
    'const receiptWorkflowModels = Object.fromEntries([',
    "'privatePilotReleaseCandidateWorkflow',",
    "'privatePilotLaunchRunWorkflow',",
    "'privatePilotLaunchHealthCheckWorkflow',",
    "'privatePilotAcceptanceReportWorkflow',",
    "'productionOperationsControlReceiptWorkflow',",
    "'productionDeploymentControlReceiptWorkflow',",
    "'productionSecurityControlReceiptWorkflow',",
    "'productionProviderControlReceiptWorkflow',",
    '...receiptWorkflowModels,',
  ]) {
    assert.ok(receiptRefresh.includes(contract), `Receipt refresh must keep write-response workflow contract ${contract}`);
  }

  assert.ok(
    receiptRefresh.indexOf('...receiptWorkflowModels,') > receiptRefresh.indexOf('...readyPackageSubmodels,'),
    'Write-response workflows must be merged after refreshed read models so stale reads cannot disable the next action',
  );

  for (const contract of [
    'const routeSpecsToFetch = workflowKey && payload[workflowKey] ? [] : routeSpecs;',
    'routeSpecsToFetch.map(([, route,, timeoutMs]) =>',
    'const [key,, payloadKey] = routeSpecsToFetch[index];',
  ]) {
    assert.ok(receiptRefresh.includes(contract), `Receipt refresh must avoid write-response network fan-out with ${contract}`);
  }
});
