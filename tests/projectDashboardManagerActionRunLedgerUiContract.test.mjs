import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const ledgerSource = readFileSync(new URL('../src/project/ProjectDashboardManagerActionRunLedger.jsx', import.meta.url), 'utf8');

test('complete Dashboard Manager Action Run Ledger stays lazy and keeps every proof exit', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardManagerActionRunLedger = lazy(() => import('./ProjectDashboardManagerActionRunLedger.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerActionRunLedger'));

  for (const publicControl of [
    'manager-action-run-ledger',
    'manager-action-run-ledger-source',
    'manager-action-run-ledger-backend-required',
    'manager-action-run-ledger-sync-manager-dashboard',
    'manager-action-run-output',
    'manager-action-run-output-empty',
    'manager-action-run-output-rows',
    'manager-action-output-chat-proof-',
    'manager-action-output-timeline-proof-',
    'manager-action-run-row-',
    'manager-action-run-proof-',
    'Manager Action Output Nodes',
    'Output chat proof',
    'Output timeline proof',
    'Run proof',
  ]) {
    assert.ok(ledgerSource.includes(publicControl), `Manager Action Run Ledger must keep ${publicControl}`);
  }

  assert.ok(ledgerSource.includes('onSyncManagerDashboard'));
  assert.ok(ledgerSource.includes('onOpenChatProof(chatProofIds)'));
  assert.ok(ledgerSource.includes('onOpenTimelineProof(timelineProofIds)'));
  assert.ok(ledgerSource.includes('onOpenTimelineProof((run.timelineLogIds || [run.logId]).filter(Boolean))'));
});
