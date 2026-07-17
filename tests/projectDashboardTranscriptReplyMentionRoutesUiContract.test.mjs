import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerProofRoutePanels.jsx', import.meta.url), 'utf8');
const replyUrl = new URL('../src/project/ProjectDashboardTranscriptReplyRoutes.jsx', import.meta.url);
const mentionUrl = new URL('../src/project/ProjectDashboardTranscriptMentionRoutes.jsx', import.meta.url);

test('Dashboard transcript reply and mention routes stay lazy and keep sync, chat, and timeline actions', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardTranscriptReplyRoutes = lazy(() => import('./ProjectDashboardTranscriptReplyRoutes.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardTranscriptMentionRoutes = lazy(() => import('./ProjectDashboardTranscriptMentionRoutes.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardTranscriptReplyRoutes'));
  assert.ok(assemblySource.includes('<ProjectDashboardTranscriptMentionRoutes'));
  assert.ok(existsSync(replyUrl), 'Dashboard transcript reply routes component must exist');
  assert.ok(existsSync(mentionUrl), 'Dashboard transcript mention routes component must exist');

  const replySource = readFileSync(replyUrl, 'utf8');
  for (const publicContract of [
    'proof-map-transcript-reply-routes',
    'Backend transcript reply routes',
    'summary.readyCount',
    'summary.count',
    'summary.latestReplyMessageId',
    'Reply chat proof',
    'Reply timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(replySource.includes(publicContract), `Dashboard transcript reply routes must keep ${publicContract}`);
  }

  const mentionSource = readFileSync(mentionUrl, 'utf8');
  for (const publicContract of [
    'proof-map-transcript-mention-routes',
    'Backend transcript mention routes',
    'summary.readyCount',
    'summary.count',
    'summary.latestMentionMessageId',
    'Mention chat proof',
    'Mention timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(mentionSource.includes(publicContract), `Dashboard transcript mention routes must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('summary: backendTranscriptReplySummary'));
  assert.ok(appSource.includes('chatProofIds: backendTranscriptReplyChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendTranscriptReplyTimelineIds'));
  assert.ok(appSource.includes('summary: backendTranscriptMentionSummary'));
  assert.ok(appSource.includes('chatProofIds: backendTranscriptMentionChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendTranscriptMentionTimelineIds'));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendLatestTranscriptReplyRoute, 'proof-map-transcript-reply-routes-sync-proof-map')"));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendLatestTranscriptMentionRoute, 'proof-map-transcript-mention-routes-sync-proof-map')"));
});
