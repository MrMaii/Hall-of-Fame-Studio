import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url), 'utf8');
const eventLedgerUrl = new URL('../src/project/ProjectDashboardEventLedger.jsx', import.meta.url);

test('Dashboard Unified Event Ledger stays lazy and keeps timeline sync and event proof', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardEventLedger = lazy(() => import('./ProjectDashboardEventLedger.jsx'))"));
  assert.ok(managerBodySource.includes('<ProjectDashboardEventLedger'));
  assert.ok(existsSync(eventLedgerUrl), 'Dashboard Unified Event Ledger component must exist');

  const componentSource = readFileSync(eventLedgerUrl, 'utf8');
  for (const publicContract of [
    'Unified Event Ledger',
    'event-ledger-backend-required',
    'event-ledger-sync-timeline-events',
    'Sync Timeline',
    'Retained',
    'replayProjection',
    'onSyncTimeline',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Unified Event Ledger must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('events: eventLedgerDisplayRows'));
  assert.ok(appSource.includes('readModel: eventLedgerReadModel'));
  assert.ok(appSource.includes('summary: eventLedgerSummary'));
  assert.ok(appSource.includes('onSyncTimeline: () => syncBackendTimelineAndEvents'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
  assert.ok(appSource.includes("managerReadModelSourceBadge(eventLedgerReadModel, 'event-ledger-source')"));
});
