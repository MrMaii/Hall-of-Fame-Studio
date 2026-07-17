import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerProofRoutePanels.jsx', import.meta.url), 'utf8');
const messageUrl = new URL('../src/project/ProjectDashboardAgentMessageRoutes.jsx', import.meta.url);
const contractUrl = new URL('../src/project/ProjectDashboardAgentContractRoutes.jsx', import.meta.url);

test('Dashboard Agent message and contract routes stay lazy and keep proof actions', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardAgentMessageRoutes = lazy(() => import('./ProjectDashboardAgentMessageRoutes.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardAgentContractRoutes = lazy(() => import('./ProjectDashboardAgentContractRoutes.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardAgentMessageRoutes'));
  assert.ok(assemblySource.includes('<ProjectDashboardAgentContractRoutes'));
  assert.ok(existsSync(messageUrl), 'Dashboard Agent message routes component must exist');
  assert.ok(existsSync(contractUrl), 'Dashboard Agent contract routes component must exist');

  const messageSource = readFileSync(messageUrl, 'utf8');
  for (const publicContract of [
    'proof-map-agent-message-routes',
    'Agent-to-Agent message routes',
    'summary.readyCount',
    'summary.count',
    'summary.deliveredCount',
    'summary.senderWorklogCount',
    'Agent message chat proof',
    'Agent message timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(messageSource.includes(publicContract), `Dashboard Agent message routes must keep ${publicContract}`);
  }

  const contractSource = readFileSync(contractUrl, 'utf8');
  for (const publicContract of [
    'proof-map-agent-contract-routes',
    'Marketplace Agent contract routes',
    'summary.readyCount',
    'summary.count',
    'summary.activeCount',
    'Agent dashboard',
    'Contract timeline proof',
    'disabled={!hasAgent}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenDashboard}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(contractSource.includes(publicContract), `Dashboard Agent contract routes must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('summary: backendAgentMessageSummary'));
  assert.ok(appSource.includes('chatProofIds: backendAgentMessageChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendAgentMessageTimelineProofIds'));
  assert.ok(appSource.includes('summary: backendAgentContractSummary'));
  assert.ok(appSource.includes('timelineIds: backendAgentContractTimelineProofIds'));
  assert.ok(appSource.includes('setSelectedAgentFocusId(contractAgentId)'));
  assert.ok(appSource.includes("syncBackendAgentDashboard(contractAgentId, { silent: true, projectId: activeProject.id })"));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendLatestAgentMessageRoute, 'proof-map-agent-message-routes-sync-proof-map')"));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendLatestAgentContractRoute, 'proof-map-agent-contract-routes-sync-proof-map')"));
});
