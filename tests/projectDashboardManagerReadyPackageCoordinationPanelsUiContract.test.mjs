import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageCoordinationPanels.jsx', import.meta.url);

test('Manager Ready Package coordination panels stay lazy and preserve their sources, sync actions, and routes', () => {
  assert.ok(existsSync(componentUrl), 'Manager Ready Package coordination panels component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardManagerReadyPackageCoordinationPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageCoordinationPanels.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerReadyPackageCoordinationPanels'));
  assert.ok(appSource.includes('operatingLoop: backendProductTeamOperatingLoop'));
  assert.ok(appSource.includes('plannerExecutorReviewer: backendPlannerExecutorReviewerStateMachine'));
  assert.ok(appSource.includes('teamCollaborationDiagnostics: backendTeamCollaborationDiagnostics'));
  assert.ok(appSource.includes('readyPackage: backendManagerReadyPackage'));
  assert.ok(appSource.includes('managerProofModelSyncButton,'));

  for (const contract of [
    "const ProjectDashboardProductTeamOperatingLoop = lazy(() => import('./ProjectDashboardProductTeamOperatingLoop.jsx'))",
    "const ProjectDashboardPlannerExecutorReviewer = lazy(() => import('./ProjectDashboardPlannerExecutorReviewer.jsx'))",
    "const ProjectDashboardTeamCollaborationDiagnostics = lazy(() => import('./ProjectDashboardTeamCollaborationDiagnostics.jsx'))",
    'backend-product-team-operating-loop-source',
    'backend-planner-executor-reviewer-state-machine-source',
    'backend-team-collaboration-diagnostics-source',
    'backend-product-team-operating-loop-sync-proof-models',
    'backend-planner-executor-reviewer-state-machine-sync-proof-models',
    'backend-team-collaboration-diagnostics-sync-proof-models',
    '/product-team-operating-loop',
    '/planner-executor-reviewer-state-machine',
    '/team-collaboration-diagnostics',
  ]) {
    assert.ok(componentSource.includes(contract), `Manager Ready Package coordination panels must keep ${contract}`);
  }

  for (const oldAppContract of [
    "const ProjectDashboardProductTeamOperatingLoop = lazy(() => import('./project/ProjectDashboardProductTeamOperatingLoop.jsx'));",
    "const ProjectDashboardPlannerExecutorReviewer = lazy(() => import('./project/ProjectDashboardPlannerExecutorReviewer.jsx'));",
    "const ProjectDashboardTeamCollaborationDiagnostics = lazy(() => import('./project/ProjectDashboardTeamCollaborationDiagnostics.jsx'));",
    '<ProjectDashboardProductTeamOperatingLoop',
    '<ProjectDashboardPlannerExecutorReviewer',
    '<ProjectDashboardTeamCollaborationDiagnostics',
  ]) {
    assert.equal(appSource.includes(oldAppContract), false, `App must no longer duplicate ${oldAppContract}`);
  }
});
