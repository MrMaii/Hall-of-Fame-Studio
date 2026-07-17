import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerProofRoutePanels.jsx', import.meta.url), 'utf8');
const attachmentUrl = new URL('../src/project/ProjectDashboardTranscriptAttachmentRoutes.jsx', import.meta.url);
const presenceUrl = new URL('../src/project/ProjectDashboardTranscriptMemberPresenceRoutes.jsx', import.meta.url);

test('Dashboard transcript attachment and member presence routes stay lazy and keep proof actions', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardTranscriptAttachmentRoutes = lazy(() => import('./ProjectDashboardTranscriptAttachmentRoutes.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardTranscriptMemberPresenceRoutes = lazy(() => import('./ProjectDashboardTranscriptMemberPresenceRoutes.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardTranscriptAttachmentRoutes'));
  assert.ok(assemblySource.includes('<ProjectDashboardTranscriptMemberPresenceRoutes'));
  assert.ok(existsSync(attachmentUrl), 'Dashboard transcript attachment routes component must exist');
  assert.ok(existsSync(presenceUrl), 'Dashboard transcript member presence routes component must exist');

  const attachmentSource = readFileSync(attachmentUrl, 'utf8');
  for (const publicContract of [
    'proof-map-transcript-attachment-routes',
    'Backend transcript attachment routes',
    'summary.readyCount',
    'summary.count',
    'summary.latestAttachmentMessageId',
    'Attachment chat proof',
    'Attachment timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(attachmentSource.includes(publicContract), `Dashboard transcript attachment routes must keep ${publicContract}`);
  }

  const presenceSource = readFileSync(presenceUrl, 'utf8');
  for (const publicContract of [
    'proof-map-transcript-member-presence-routes',
    'Backend transcript member presence',
    'summary.readyCount',
    'summary.count',
    'summary.presentCount',
    'summary.memberCount',
    'Presence chat proof',
    'Presence timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(presenceSource.includes(publicContract), `Dashboard transcript member presence routes must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('summary: backendTranscriptAttachmentSummary'));
  assert.ok(appSource.includes('chatProofIds: backendTranscriptAttachmentChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendTranscriptAttachmentTimelineIds'));
  assert.ok(appSource.includes('summary: backendTranscriptMemberPresenceSummary'));
  assert.ok(appSource.includes('chatProofIds: backendTranscriptMemberPresenceChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendTranscriptMemberPresenceTimelineIds'));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendLatestTranscriptAttachmentRoute, 'proof-map-transcript-attachment-routes-sync-proof-map')"));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendLatestTranscriptMemberPresenceRoute, 'proof-map-transcript-member-presence-routes-sync-proof-map')"));
});
