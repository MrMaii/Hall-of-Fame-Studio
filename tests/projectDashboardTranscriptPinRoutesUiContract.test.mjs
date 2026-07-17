import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerProofRoutePanels.jsx', import.meta.url), 'utf8');
const channelPinUrl = new URL('../src/project/ProjectDashboardTranscriptChannelPinRoutes.jsx', import.meta.url);
const messagePinUrl = new URL('../src/project/ProjectDashboardTranscriptPinRoutes.jsx', import.meta.url);

test('Dashboard transcript pin routes stay lazy and keep sync, chat, and timeline actions', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardTranscriptChannelPinRoutes = lazy(() => import('./ProjectDashboardTranscriptChannelPinRoutes.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardTranscriptPinRoutes = lazy(() => import('./ProjectDashboardTranscriptPinRoutes.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardTranscriptChannelPinRoutes'));
  assert.ok(assemblySource.includes('<ProjectDashboardTranscriptPinRoutes'));
  assert.ok(existsSync(channelPinUrl), 'Dashboard transcript channel pin routes component must exist');
  assert.ok(existsSync(messagePinUrl), 'Dashboard transcript message pin routes component must exist');

  const channelPinSource = readFileSync(channelPinUrl, 'utf8');
  for (const publicContract of [
    'proof-map-transcript-channel-pin-routes',
    'Backend transcript channel pin routes',
    'summary.readyCount',
    'summary.count',
    'summary.latestChannelId',
    'Channel pin chat proof',
    'Channel pin timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(channelPinSource.includes(publicContract), `Dashboard transcript channel pin routes must keep ${publicContract}`);
  }

  const messagePinSource = readFileSync(messagePinUrl, 'utf8');
  for (const publicContract of [
    'proof-map-transcript-pin-routes',
    'Backend transcript pin routes',
    'summary.readyCount',
    'summary.count',
    'summary.latestMessageId',
    'Pin chat proof',
    'Pin timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(messagePinSource.includes(publicContract), `Dashboard transcript message pin routes must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('summary: backendTranscriptChannelPinSummary'));
  assert.ok(appSource.includes('chatProofIds: backendTranscriptChannelPinChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendTranscriptChannelPinTimelineIds'));
  assert.ok(appSource.includes('summary: backendTranscriptPinSummary'));
  assert.ok(appSource.includes('chatProofIds: backendTranscriptPinChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendTranscriptPinTimelineIds'));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendLatestTranscriptChannelPinRoute, 'proof-map-transcript-channel-pin-routes-sync-proof-map')"));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendLatestTranscriptPinRoute, 'proof-map-transcript-pin-routes-sync-proof-map')"));
});
