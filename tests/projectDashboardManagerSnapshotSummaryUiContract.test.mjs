import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerSnapshotExecutionPanels.jsx', import.meta.url);
const componentUrl = new URL('../src/project/ProjectDashboardManagerSnapshotSummary.jsx', import.meta.url);
const missionRunnerUrl = new URL('../src/project/ProjectDashboardProductTeamMissionRunner.jsx', import.meta.url);
const submissionWorkspaceUrl = new URL('../src/project/ProjectDashboardSubmissionWorkspace.jsx', import.meta.url);
const collaborationIntentQueueSnapshotUrl = new URL('../src/project/ProjectDashboardCollaborationIntentQueueSnapshot.jsx', import.meta.url);

test('Dashboard manager snapshot summary stays lazy while App keeps action callbacks for extracted workspaces', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager snapshot execution wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardManagerSnapshotSummary = lazy(() => import('./ProjectDashboardManagerSnapshotSummary.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardManagerSnapshotSummary'));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerSnapshotExecutionPanels'));
  assert.ok(assemblySource.includes('data-testid="backend-manager-dashboard-snapshot"'));
  assert.ok(assemblySource.includes('if (!view.managerDashboard) return null;'));
  assert.ok(existsSync(componentUrl), 'Dashboard manager snapshot summary component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'Backend Manager Snapshot',
    'backend-manager-dashboard-source',
    'Readiness',
    'Proof Routes',
    'Scenario Trail',
    'Walkthrough',
    'Standalone Trail',
    'Action Queue',
    'Agent Queue',
    'Run Control',
    'Mission Runs',
    'Mission Sessions',
    'Control Runs',
    'Control Loops',
    'Transcript Proofs',
    'Transcript Coverage',
    'Missing Transcript',
    'Brief Alignment',
    'Confirmed Team',
    'Startup Agents',
    'Ops Agents',
    'Continuous Rows',
    'Continuous Proofs',
    'Management Checks',
    'Agent Messages',
    'Delivered Messages',
    'Assignment Rows',
    'Assignment Timeline',
    'Assignment Progress',
    'Change Rows',
    'Change Intake',
    'Change Owner Pulses',
    'Submissions',
    'Generated Drafts',
    'Final Deliverables',
    'Pending Review',
    'Evidence Searches',
    'Evidence Sources',
    'Accepted Reviews',
    'Change Requests',
    'Open Tasks',
    'Backend route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard manager snapshot summary must keep ${publicContract}`);
  }

  for (const appContract of [
    'managerDashboard: backendManagerDashboard',
    'managerScenarioWalkthrough: backendManagerScenarioWalkthrough',
    'managerScenarioTrail: backendManagerScenarioTrail',
    'managerActionQueue: backendManagerActionQueue',
    'agentAutonomousActionQueue: backendAgentAutonomousActionQueue',
    'autonomousRunControl: backendAutonomousRunControl',
    'productTeamMissionRuns: backendProductTeamMissionRuns',
    'productTeamMissionRows: backendProductTeamMissionRows',
    'transcriptProofCoverageSummary: backendTranscriptProofCoverageSummary',
    'projectText,',
    'managerReadModelSourceBadge,',
  ]) {
    assert.ok(appSource.includes(appContract), `App must retain manager snapshot or action contract ${appContract}`);
  }

  assert.ok(existsSync(collaborationIntentQueueSnapshotUrl), 'Ready package collaboration intent queue component must exist');
  const collaborationIntentQueueSnapshotSource = readFileSync(collaborationIntentQueueSnapshotUrl, 'utf8');
  assert.ok(collaborationIntentQueueSnapshotSource.includes('backend-collaboration-intent-queue-snapshot'));

  const missionRunnerSource = readFileSync(missionRunnerUrl, 'utf8');
  assert.ok(missionRunnerSource.includes('backend-product-team-mission-handoff-execution'));
  assert.ok(appSource.includes('onRunHandoffIntent: () => runCollaborationIntentQueueRow(backendMissionHandoffIntentRow)'));

  const submissionWorkspaceSource = readFileSync(submissionWorkspaceUrl, 'utf8');
  assert.ok(submissionWorkspaceSource.includes('backend-manager-submissions-snapshot'));
  assert.ok(appSource.includes('onRunSubmissionReview: runBackendSubmissionReview'));
});
