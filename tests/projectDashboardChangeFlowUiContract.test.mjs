import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardCollaborationOperationsPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardChangeFlow.jsx', import.meta.url);

test('Dashboard Change Flow stays lazy and keeps intake, resolution, ledger, and proof actions', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardChangeFlow = lazy(() => import('./ProjectDashboardChangeFlow.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardChangeFlow'));
  assert.ok(existsSync(componentUrl), 'Dashboard Change Flow component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'dual-channel-change-intake-matrix',
    'Dual-channel Change Intake Matrix',
    'change-flow-backend-required',
    'change-flow-sync-cockpit',
    'Source Message',
    'Source Receipts',
    'Team Discussed',
    'Owner Confirmed',
    'Team Synced',
    'Source channel proof',
    'Resolution chat proof',
    'change-resolution-matrix',
    'Change Resolution Matrix',
    'Owner work chat proof',
    'Owner work timeline proof',
    'Change Ledger',
    'Change chat proof',
    'Change timeline proof',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Change Flow must keep ${publicContract}`);
  }

  for (const appContract of [
    'onSyncCockpit: () => syncBackendCockpitReadModels',
    'onOpenSourceProof: row => openProjectChatProof',
    'onOpenResolutionProof: row => openProjectChatProof',
    'onOpenOwnerWorkChatProof: row => openProjectChatProof',
    'onOpenOwnerWorkTimelineProof: row => openProjectTimelineProof',
    'onOpenChangeChatProof: row => openProjectChatProof',
    'onOpenChangeTimelineProof: row => openProjectTimelineProof',
    'changeChatProofIds: chatProofIdsFromIds',
    'changeTimelineProofIds: changeTimelineProofIds(row.change)',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard Change Flow must keep ${appContract} in App.jsx`);
  }
});
