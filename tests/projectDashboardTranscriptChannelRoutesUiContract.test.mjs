import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerProofRoutePanels.jsx', import.meta.url), 'utf8');
const routesUrl = new URL('../src/project/ProjectDashboardTranscriptChannelRoutes.jsx', import.meta.url);

test('Dashboard transcript channel routes stay lazy and keep sync, chat, and timeline actions', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardTranscriptChannelRoutes = lazy(() => import('./ProjectDashboardTranscriptChannelRoutes.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardTranscriptChannelRoutes'));
  assert.ok(existsSync(routesUrl), 'Dashboard transcript channel routes component must exist');

  const componentSource = readFileSync(routesUrl, 'utf8');
  for (const publicContract of [
    'proof-map-transcript-channel-routes',
    'Backend transcript channel routes',
    'summary.readyCount',
    'summary.count',
    'summary.latestChannelId',
    'Channel chat proof',
    'Channel timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard transcript channel routes must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('summary: backendTranscriptChannelSummary'));
  assert.ok(appSource.includes('ready: backendTranscriptChannelReady'));
  assert.ok(appSource.includes('chatProofIds: backendTranscriptChannelChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendTranscriptChannelTimelineIds'));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendLatestTranscriptChannelRoute, 'proof-map-transcript-channel-routes-sync-proof-map')"));
  assert.ok(appSource.includes("openProjectChatProof(activeProject, backendTranscriptChannelChatProofIds, backendLatestTranscriptChannelRoute?.channelId || 'main')"));
  assert.ok(appSource.includes('openProjectTimelineProof(backendTranscriptChannelTimelineIds)'));
});
