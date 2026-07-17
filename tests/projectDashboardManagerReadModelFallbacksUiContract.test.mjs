import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url), 'utf8');
const activityAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendActivityPanels.jsx', import.meta.url), 'utf8');
const managerCoreSource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerSubmissionRoutePanels.jsx', import.meta.url);
const summaryWrapperUrl = new URL('../src/project/ProjectDashboardManagerReadModelSummaryPanels.jsx', import.meta.url);
const routesUrl = new URL('../src/project/ProjectDashboardManagerReadModelRoutes.jsx', import.meta.url);
const snapshotsUrl = new URL('../src/project/ProjectDashboardManagerReadModelSnapshots.jsx', import.meta.url);

test('Manager Dashboard compatibility read models stay lazy without removing the complete manager components', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager submission route wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(existsSync(summaryWrapperUrl), 'Manager read-model summary wrapper must exist');
  const summaryWrapperSource = readFileSync(summaryWrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardManagerReadModelRoutes = lazy(() => import('./ProjectDashboardManagerReadModelRoutes.jsx'))"));
  assert.ok(summaryWrapperSource.includes("const ProjectDashboardManagerReadModelSnapshots = lazy(() => import('./ProjectDashboardManagerReadModelSnapshots.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardManagerReadModelRoutes'));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerSubmissionRoutePanels'));
  assert.ok(summaryWrapperSource.includes('<ProjectDashboardManagerReadModelSnapshots'));
  assert.ok(activityAssemblySource.includes('<ProjectDashboardManagerReadModelSummaryPanels'));
  assert.ok(existsSync(routesUrl));
  assert.ok(existsSync(snapshotsUrl));

  const routesSource = readFileSync(routesUrl, 'utf8');
  for (const publicContract of [
    'backend-manager-command-center-route',
    'backend-manager-scenario-trail-route',
    'backend-manager-scenario-walkthrough-route',
    'backend-manager-requirement-matrix-route',
    'backend-manager-action-queue-route',
    'backend-agent-autonomous-action-queue-route',
    'backend-autonomous-run-control-route',
    'Command center route:',
    'Scenario trail route:',
    'Walkthrough route:',
    'Requirement matrix route:',
    'Action queue route:',
    'Agent autonomous queue route:',
    'Autonomous run control route:',
  ]) {
    assert.ok(routesSource.includes(publicContract), `Manager read-model routes must keep ${publicContract}`);
  }

  const snapshotsSource = readFileSync(snapshotsUrl, 'utf8');
  for (const publicContract of [
    'backend-manager-command-center-snapshot',
    'backend-manager-scenario-walkthrough-snapshot',
    'backend-manager-scenario-trail-snapshot',
    'backend-manager-requirement-matrix-snapshot',
    'backend-sync-protocol-audit-snapshot',
    'backend-manager-use-case-audit-snapshot',
    'backend-manager-command-center-source',
    'backend-manager-scenario-walkthrough-source',
    'backend-manager-scenario-trail-source',
    'backend-manager-requirement-matrix-source',
    'backend-sync-protocol-audit-source',
    'backend-manager-use-case-audit-source',
    'Manager Command Center',
    'Manager Scenario Walkthrough',
    'Standalone Trail',
    'Manager Requirement Matrix',
    'Sync Protocol Audit',
    'Manager Use Case Audit',
    'Next run route:',
    'Ready Rows',
    'Latest protocol row:',
    'Latest stage:',
  ]) {
    assert.ok(snapshotsSource.includes(publicContract), `Manager read-model snapshots must keep ${publicContract}`);
  }

  for (const appContract of [
    'managerDashboard: backendManagerDashboard',
    'activeProject,',
    'managerCommandCenter: backendManagerCommandCenter',
    'managerScenarioTrail: backendManagerScenarioTrail',
    'managerScenarioWalkthrough: backendManagerScenarioWalkthrough',
    'managerRequirementMatrix: backendManagerRequirementMatrix',
    'managerActionQueue: backendManagerActionQueue',
    'agentAutonomousActionQueue: backendAgentAutonomousActionQueue',
    'autonomousRunControl: backendAutonomousRunControl',
    'syncProtocolAudit: backendSyncProtocolAudit',
    'managerUseCaseAudit: backendManagerUseCaseAudit',
    'managerReadModelSourceBadge,',
    'projectText,',
  ]) {
    assert.ok(appSource.includes(appContract), `App must provide manager read-model contract ${appContract}`);
  }

  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(managerBodySource.includes('<ProjectDashboardManagerCorePanels'));
  for (const retainedCompleteComponent of [
    'ProjectDashboardManagerCommandCenters',
    'ProjectDashboardManagerScenarioWalkthrough',
    'ProjectDashboardManagerScenarioTrail',
    'ProjectDashboardSyncProtocolAudit',
  ]) {
    assert.ok(managerCoreSource.includes(`const ${retainedCompleteComponent} = lazy(() => import('./${retainedCompleteComponent}.jsx'))`), `Complete manager component must stay lazy: ${retainedCompleteComponent}`);
    assert.ok(managerCoreSource.includes(`<${retainedCompleteComponent}`), `Complete manager component must remain rendered: ${retainedCompleteComponent}`);
  }
});
