import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardTeam.jsx', import.meta.url);
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardTeamWorkspacePanels.jsx', import.meta.url), 'utf8');
const coordinationAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardCoordinationTeamPanels.jsx', import.meta.url), 'utf8');

test('Dashboard Team stays lazy and keeps Agent status, workbench, message, proof, and pulse actions', () => {
  assert.ok(coordinationAssemblySource.includes("const ProjectDashboardTeamWorkspacePanels = lazy(() => import('./ProjectDashboardTeamWorkspacePanels.jsx'))"));
  assert.ok(coordinationAssemblySource.includes('<ProjectDashboardTeamWorkspacePanels'));
  assert.ok(assemblySource.includes("const ProjectDashboardTeam = lazy(() => import('./ProjectDashboardTeam.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardTeam'));
  assert.ok(existsSync(componentUrl), 'Dashboard Team component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    '>Team</div>',
    'agent-team-dashboard-required-',
    'agent-state-detail-',
    'Inbox proof',
    'Obligation proof',
    'Worklog proof',
    'Open Agent Workspace',
    'Close Agent Workspace',
    'Run Agent Pulse',
    'agent-focus-backend-dashboard-',
    'agent-focus-control-run-receipt-',
    'agent-focus-submissions-',
    'agent-focus-evidence-searches-',
    'agent-focus-submission-reviews-',
    'agent-workbench-',
    'Agent Workbench',
    'agent-workbench-evidence-',
    'agent-workbench-submit-',
    'agent-workbench-draft-submit-',
    'Management proof',
    'Agent chat proof',
    'Agent timeline proof',
    'agent-message-panel-',
    'Agent Message',
    'Agent Pulse',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Team must keep ${publicContract}`);
  }

  for (const appContract of [
    'agentDashboardSnapshotFor,',
    'agentMessageDraftFor,',
    'agentWorkDraftFor,',
    'openProjectChatProof,',
    'openProjectTimelineProof,',
    'runBackendAgentArtifactDraft,',
    'runBackendAgentArtifactSubmission,',
    'runBackendAgentEvidenceSearch,',
    'runBackendAgentMessage,',
    'runBackendAgentPulse,',
    'syncBackendAgentDashboard,',
    'updateAgentMessageDraft,',
    'updateAgentWorkDraft,',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard Team must keep ${appContract} in App.jsx`);
  }
});
