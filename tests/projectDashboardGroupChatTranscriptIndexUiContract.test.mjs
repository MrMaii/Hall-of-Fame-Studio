import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCollaborationBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardKickoffCollaborationPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardGroupChatTranscriptIndex.jsx', import.meta.url);

test('Dashboard Group Chat Transcript Index stays lazy and keeps channel and collaboration proof routes', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardKickoffCollaborationPanels = lazy(() => import('./ProjectDashboardKickoffCollaborationPanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardGroupChatTranscriptIndex = lazy(() => import('./ProjectDashboardGroupChatTranscriptIndex.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardGroupChatTranscriptIndex'));
  assert.ok(existsSync(componentUrl), 'Dashboard Group Chat Transcript Index component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'group-chat-transcript-index',
    'group-chat-transcript-source',
    'backend-sync-transcripts',
    'backend-transcript-index-required',
    'Open transcript',
    'Message Count',
    'Archived Proofs',
    'Receipt Coverage',
    'Direct Mentions',
    'group-chat-collaboration-proof-backend-required',
    'group-chat-collaboration-proof-sync-manager-dashboard',
    'group-chat-collaboration-proof-rows',
    'Chat proof',
    'Timeline proof',
    'onOpenTranscript',
    'onSyncTranscripts',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Group Chat Transcript Index must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('channels: channelTranscriptRows'));
  assert.ok(appSource.includes('collaborationRows: collaborationProofRows'));
  assert.ok(appSource.includes('onOpenTranscript: row =>'));
  assert.ok(appSource.includes('transcriptProofIdsFromRow(row)'));
  assert.ok(appSource.includes("enterProjectScene('chat')"));
  assert.ok(appSource.includes('onSyncTranscripts: () => syncBackendProjectTranscripts'));
  assert.ok(appSource.includes('onSyncManagerDashboard: () => syncBackendManagerDashboard'));
  assert.ok(appSource.includes('onOpenChatProof: (ids, channelId) => openProjectChatProof'));
  assert.ok(appSource.includes('onOpenTimelineProof: openProjectTimelineProof'));
});
