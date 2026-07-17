import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardTeamWorkspacePanels.jsx', import.meta.url);
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardCoordinationTeamPanels.jsx', import.meta.url), 'utf8');

test('Dashboard task and Agent team panels share one lazy assembly without moving operations', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardTeamWorkspacePanels = lazy(() => import('./ProjectDashboardTeamWorkspacePanels.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardTeamWorkspacePanels'));
  assert.ok(assemblySource.includes('activeThreadsView={view.activeThreadsView}'));
  assert.ok(assemblySource.includes('teamView={view.teamView}'));
  assert.ok(appSource.includes('activeThreadsView: {'));
  assert.ok(appSource.includes('teamView: {'));

  for (const retainedOperation of [
    'onOpenChatProof: (chatIds, channelId) => openProjectChatProof',
    'onOpenTimelineProof: openProjectTimelineProof',
    'onSyncManagerDashboard: () => syncBackendManagerDashboard',
    'runBackendAgentArtifactDraft,',
    'runBackendAgentArtifactSubmission,',
    'runBackendAgentEvidenceSearch,',
    'runBackendAgentMessage,',
    'runBackendAgentPulse,',
    'syncBackendAgentDashboard,',
    'updateAgentMessageDraft,',
    'updateAgentWorkDraft,',
  ]) {
    assert.ok(appSource.includes(retainedOperation), `App must retain operation: ${retainedOperation}`);
  }

  const componentSource = readFileSync(componentUrl, 'utf8');
  assert.ok(componentSource.includes("lazy(() => import('./ProjectDashboardActiveThreads.jsx'))"));
  assert.ok(componentSource.includes("lazy(() => import('./ProjectDashboardTeam.jsx'))"));
  assert.ok(componentSource.includes('data-testid="project-dashboard-active-threads-loading"'));
  assert.ok(componentSource.includes('data-testid="project-dashboard-team-loading"'));
  assert.ok(componentSource.includes('<ProjectDashboardActiveThreads view={activeThreadsView}'));
  assert.ok(componentSource.includes('<ProjectDashboardTeam view={teamView}'));
});
