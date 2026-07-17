import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const coreAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const coordinationUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageCoordinationPanels.jsx', import.meta.url);
const responsibilityUrl = new URL('../src/project/ProjectDashboardPlannerExecutorReviewer.jsx', import.meta.url);
const diagnosticsUrl = new URL('../src/project/ProjectDashboardTeamCollaborationDiagnostics.jsx', import.meta.url);

test('Dashboard responsibility state machine and collaboration diagnostics stay lazy and complete', () => {
  const coordinationSource = readFileSync(coordinationUrl, 'utf8');
  assert.ok(coreAssemblySource.includes("const ProjectDashboardManagerReadyPackageCoordinationPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageCoordinationPanels.jsx'))"));
  assert.ok(coordinationSource.includes("const ProjectDashboardPlannerExecutorReviewer = lazy(() => import('./ProjectDashboardPlannerExecutorReviewer.jsx'))"));
  assert.ok(coordinationSource.includes("const ProjectDashboardTeamCollaborationDiagnostics = lazy(() => import('./ProjectDashboardTeamCollaborationDiagnostics.jsx'))"));
  assert.ok(coordinationSource.includes('<ProjectDashboardPlannerExecutorReviewer'));
  assert.ok(coordinationSource.includes('<ProjectDashboardTeamCollaborationDiagnostics'));
  assert.ok(existsSync(coordinationUrl), 'Manager Ready Package coordination panels component must exist');
  assert.ok(existsSync(responsibilityUrl), 'Dashboard Planner / Executor / Reviewer component must exist');
  assert.ok(existsSync(diagnosticsUrl), 'Dashboard team collaboration diagnostics component must exist');

  const responsibilitySource = readFileSync(responsibilityUrl, 'utf8');
  for (const publicContract of [
    'backend-planner-executor-reviewer-state-machine-snapshot',
    'Planner / Executor / Reviewer',
    'readyForLocalProductTeamStateMachine',
    'readyRoleCount',
    'readyTransitionCount',
    'executorAgentCount',
    'acceptedFinalDeliverableCount',
    'backend-planner-executor-reviewer-state-machine-roles',
    'backend-planner-executor-reviewer-state-machine-transitions',
    'backend-planner-executor-reviewer-state-machine-route',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(responsibilitySource.includes(publicContract), `Dashboard responsibility state machine must keep ${publicContract}`);
  }

  const diagnosticsSource = readFileSync(diagnosticsUrl, 'utf8');
  for (const publicContract of [
    'backend-team-collaboration-diagnostics-snapshot',
    'Team Collaboration Diagnostics',
    'readyForLocalPilotCollaboration',
    'collaborationScore',
    'readyRowCount',
    'handoffBreaks',
    'transcriptChannelCount',
    'transcriptMessageCount',
    'backend-team-collaboration-diagnostics-rows',
    'row.productionBlocker',
    'backend-team-collaboration-diagnostics-route',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(diagnosticsSource.includes(publicContract), `Dashboard collaboration diagnostics must keep ${publicContract}`);
  }

  assert.ok(coordinationSource.includes('model: plannerExecutorReviewer'));
  assert.ok(coordinationSource.includes('model: teamCollaborationDiagnostics'));
  assert.ok(coordinationSource.includes("managerProofModelSyncButton(plannerExecutorReviewer, 'backend-planner-executor-reviewer-state-machine-sync-proof-models')"));
  assert.ok(coordinationSource.includes("managerProofModelSyncButton(teamCollaborationDiagnostics, 'backend-team-collaboration-diagnostics-sync-proof-models')"));
  assert.ok(coordinationSource.includes('plannerExecutorReviewer.backendRoutes?.plannerExecutorReviewerStateMachine'));
  assert.ok(coordinationSource.includes('teamCollaborationDiagnostics.backendRoutes?.teamCollaborationDiagnostics'));
});
