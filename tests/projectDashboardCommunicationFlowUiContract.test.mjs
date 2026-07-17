import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardCollaborationOperationsPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardCommunicationFlow.jsx', import.meta.url);

test('Dashboard communication flow stays lazy and keeps handoff, delivery, inbox, worklog, and proof actions', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardCommunicationFlow = lazy(() => import('./ProjectDashboardCommunicationFlow.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardCommunicationFlow'));
  assert.ok(existsSync(componentUrl), 'Dashboard communication flow component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'Peer Handoffs',
    'Peer chat proof',
    'Peer timeline proof',
    'agent-communication-flow',
    'Agent Communication Flow',
    'agent-message-delivery-matrix',
    'Agent Message Delivery Matrix',
    'Direct Receipt',
    'Target Inbox',
    'Obligation',
    'Sender Worklog',
    'Delivery chat proof',
    'Agent chat proof',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard communication flow must keep ${publicContract}`);
  }

  for (const appContract of [
    'chatProofIds: chatProofIdsFromIds',
    'timelineProofIds: handoffTimelineProofIds(handoff)',
    'transcriptProofIds: transcriptProofIdsFromRow(row)',
    'onOpenPeerChatProof: row => openProjectChatProof',
    'onOpenPeerTimelineProof: row => openProjectTimelineProof',
    'onOpenAgentChatProof: row => openProjectChatProof',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard communication flow must keep ${appContract} in App.jsx`);
  }
});
