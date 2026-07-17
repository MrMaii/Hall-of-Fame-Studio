import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardKickoffCollaborationPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardKickoffCharter.jsx', import.meta.url);

test('Dashboard Kickoff Charter stays lazy and keeps governance, actions, and chat proof', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardKickoffCollaborationPanels = lazy(() => import('./ProjectDashboardKickoffCollaborationPanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardKickoffCharter = lazy(() => import('./ProjectDashboardKickoffCharter.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardKickoffCharter'));
  assert.ok(existsSync(componentUrl), 'Dashboard Kickoff Charter component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'Kickoff Charter',
    'Kickoff chat proof',
    'Confirmed Leader',
    'Reviewer',
    'nextActions',
    'communicationRules',
    'onOpenChatProof',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Kickoff Charter must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('charter: kickoffCharter'));
  assert.ok(appSource.includes('proofIds: kickoffCharterProofIds'));
  assert.ok(appSource.includes('onOpenChatProof: () => openProjectChatProof'));
});
