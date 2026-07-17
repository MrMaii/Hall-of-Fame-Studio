import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardKickoffCollaborationPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardKickoffMeetingFlow.jsx', import.meta.url);

test('Dashboard Kickoff Meeting Flow stays lazy and keeps every kickoff proof route', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardKickoffCollaborationPanels = lazy(() => import('./ProjectDashboardKickoffCollaborationPanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardKickoffMeetingFlow = lazy(() => import('./ProjectDashboardKickoffMeetingFlow.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardKickoffMeetingFlow'));
  assert.ok(existsSync(componentUrl), 'Dashboard Kickoff Meeting Flow component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'kickoff-meeting-flow',
    'Kickoff meeting proof',
    'kickoff-dashboard-generation-source-detail',
    'kickoff-brief-alignment',
    'Brief proof',
    'Role response proof',
    'kickoff-confirmed-team-matrix',
    'Team timeline proof',
    'kickoff-leader-election-resolution',
    'kickoff-role-question-answers',
    'Answer proof',
    'kickoff-hearing-matrix',
    'Hearing proof',
    'kickoff-conversation-flow',
    'Conversation proof',
    'onOpenChatProof',
    'onOpenTimelineProof',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Kickoff Meeting Flow must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('flow: kickoffMeetingFlow'));
  assert.ok(appSource.includes('proofIds: kickoffCharterProofIds'));
  assert.ok(appSource.includes('onOpenChatProof: (ids, channelId) => openProjectChatProof'));
  assert.ok(appSource.includes('onOpenTimelineProof: openProjectTimelineProof'));
  assert.ok(appSource.includes('proofIdsFromRow: chatProofIdsFromRow'));
  assert.ok(appSource.includes('text: projectText'));
});
