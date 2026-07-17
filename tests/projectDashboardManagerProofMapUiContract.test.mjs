import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardManagerProofMap.jsx', import.meta.url);

test('Dashboard Manager Proof Map stays lazy and keeps every readiness, sync, settings, chat, and timeline action', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerProofMap = lazy(() => import('./ProjectDashboardManagerProofMap.jsx'))"));
  assert.ok(managerBodySource.includes('<ProjectDashboardManagerProofMap'));
  assert.ok(existsSync(componentUrl), 'Dashboard Manager Proof Map component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'manager-proof-map',
    'Manager Proof Map',
    'manager-proof-map-core-routes',
    'Open Settings',
    'Settings timeline proof',
    'Sync Proof Models',
    'Autonomy timeline proof',
    'Sync Cockpit',
    'Cockpit timeline proof',
    'Sync Governance',
    'Governance chat proof',
    'Governance timeline proof',
    'Output chat proof',
    'Output timeline proof',
    'Generic Product-Team Acceptance Chain',
    'Chain chat proof',
    'Chain timeline proof',
    'Zero-to-Autonomy Report',
    'Report chat proof',
    'Report timeline proof',
    'Product Team Delivery Trace',
    'Delivery chat proof',
    'Delivery timeline proof',
    'manager-proof-map-sync-readiness-proof-map',
    'Sync Proof Map',
    '{routePanels}',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Manager Proof Map must keep ${publicContract}`);
  }

  for (const appContract of [
    'governanceCards: backendGovernanceProofMapCards.map(card => ({',
    'outputCards: backendOutputChainProofMapCards.map(card => ({',
    'chatProofIds: chatProofIdsFromIds(card.proofIds)',
    'managerProofMapRouteSyncButton,',
    'openProjectChatProof,',
    'openProjectTimelineProof,',
    'syncBackendReadinessProofMap,',
    'routePanels: (',
    '<ProjectDashboardManagerProofRoutePanels',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard Manager Proof Map must keep ${appContract} in App.jsx`);
  }
});
