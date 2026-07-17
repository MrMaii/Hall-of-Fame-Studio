import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardKickoffCollaborationPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardGovernanceSpeechProtocol.jsx', import.meta.url);

test('Dashboard Governance and Speech Protocol stays lazy and keeps governance sync and speaking rules', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardKickoffCollaborationPanels = lazy(() => import('./ProjectDashboardKickoffCollaborationPanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardGovernanceSpeechProtocol = lazy(() => import('./ProjectDashboardGovernanceSpeechProtocol.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardGovernanceSpeechProtocol'));
  assert.ok(existsSync(componentUrl), 'Dashboard Governance and Speech Protocol component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'Governance & Speech Protocol',
    'governance-protocol-backend-required',
    'governance-protocol-sync-governance',
    'Sync Governance',
    'Lead decides',
    'Reviewer challenges',
    'leadFrame',
    'memberFrame',
    'onSyncGovernance',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Governance and Speech Protocol must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('lead: governanceLead'));
  assert.ok(appSource.includes('protocols: meetingFrames'));
  assert.ok(appSource.includes('readModel: governanceProtocol'));
  assert.ok(appSource.includes('onSyncGovernance: () => syncBackendGovernanceProtocol'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
  assert.ok(appSource.includes("managerReadModelSourceBadge(governanceProtocol, 'governance-protocol-source')"));
});
