import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const auditSource = readFileSync(new URL('../src/project/ProjectDashboardSyncProtocolAudit.jsx', import.meta.url), 'utf8');

test('complete Dashboard Sync Protocol Audit stays lazy and keeps every proof action', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardSyncProtocolAudit = lazy(() => import('./ProjectDashboardSyncProtocolAudit.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardSyncProtocolAudit'));

  for (const publicControl of [
    'sync-protocol-audit',
    'sync-protocol-audit-source',
    'sync-protocol-audit-backend-required',
    'sync-protocol-audit-sync-read-model',
    'sync-protocol-row-',
    'sync-protocol-chat-proof-',
    'sync-protocol-timeline-proof-',
    'Sync Protocol Audit',
    'Sync Protocol',
    'Protocol chat proof',
    'Protocol timeline proof',
    'Published',
    'Delivered',
    'Agent State',
    'Timeline',
    'Ledger',
  ]) {
    assert.ok(auditSource.includes(publicControl), `Sync Protocol Audit must keep ${publicControl}`);
  }

  assert.ok(auditSource.includes('(syncProtocolAudit.rows || []).map(row =>'));
  assert.ok(auditSource.includes('chatProofIdsFromRow(row)'));
  assert.ok(auditSource.includes('onSyncProtocol'));
  assert.ok(auditSource.includes('onOpenChatProof(row, chatIds)'));
  assert.ok(auditSource.includes('onOpenTimelineProof(timelineIds)'));
});
