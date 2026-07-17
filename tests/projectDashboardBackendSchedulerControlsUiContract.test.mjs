import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationRegion.jsx', import.meta.url), 'utf8');
const controlsSource = readFileSync(new URL('../src/project/ProjectDashboardBackendSchedulerControls.jsx', import.meta.url), 'utf8');

test('backend scheduler controls stay lazy with every original action delegated by App', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerBackendStationRegion = lazy(() => import('./ProjectDashboardManagerBackendStationRegion.jsx'));"));
  assert.ok(regionSource.includes("const ProjectDashboardBackendSchedulerControls = lazy(() => import('./ProjectDashboardBackendSchedulerControls.jsx'));"));
  assert.ok(regionSource.includes('<ProjectDashboardBackendSchedulerControls'));

  const appCallbacks = [
    'onCheck: refreshBackendSchedulerStatus',
    "onStart: () => runBackendSchedulerAction('start')",
    "onStop: () => runBackendSchedulerAction('stop')",
    'onSyncState: () => syncBackendProjectState()',
    'onSeed: () => saveActiveProjectToBackend({ silent: false })',
    'onSyncProjects: () => syncBackendProjectCatalog({ silent: false })',
    'onSyncManagerView: refreshBackendManagerView',
    'onSyncReadyPackage: () => syncBackendManagerReadyPackage({ silent: false })',
    'onSyncProofModels: () => syncBackendReadyPackageSubmodels({ silent: false, includeLaunchControls: false })',
    'onSyncCommandCenter: () => syncBackendManagerCommandCenter({ silent: false })',
    'onSyncScenarioWalkthrough: () => syncBackendManagerScenarioWalkthrough({ silent: false })',
    'onSyncScenarioTrail: () => syncBackendManagerScenarioTrail({ silent: false })',
    'onSyncRequirementMatrix: () => syncBackendManagerRequirementMatrix({ silent: false })',
    'onSyncProtocolAudit: () => syncBackendSyncProtocolAudit({ silent: false })',
    'onSyncUseCaseAudit: () => syncBackendManagerUseCaseAudit({ silent: false })',
    'onSyncCockpit: () => syncBackendCockpitReadModels({ silent: false })',
    'onSyncActionQueue: () => syncBackendManagerActionQueue({ silent: false })',
    'onSyncAgentQueue: () => syncBackendAutonomousControlBundle({ silent: false })',
    'onSyncIntentQueue: () => syncBackendCollaborationIntentQueue({ silent: false })',
    'onSyncTimeline: () => syncBackendTimelineAndEvents({ silent: false })',
    'onServerPulse: runBackendServerPulse',
  ];
  appCallbacks.forEach(callback => assert.ok(appSource.includes(callback), `missing App callback: ${callback}`));
  assert.ok(appSource.includes('schedulerControlDisabled: backendStation.loading || !backendUrlConfigured'));
  assert.ok(appSource.includes('seedDisabled: backendStation.loading || !canSeedActiveProjectSnapshotToBackend(activeProject)'));
  assert.ok(appSource.includes('workerSyncDisabled: backendWorkerStationSyncDisabled'));
  assert.ok(appSource.includes("immediateStartVisible: backendScheduler.lastStartedRunImmediately || /Started backend scheduler/i.test(backendStation.lastAction || '')"));

  const controlIds = [
    'backend-save-project',
    'backend-sync-project-catalog-detail',
    'backend-sync-manager-view',
    'backend-sync-ready-package',
    'backend-sync-proof-models',
    'backend-sync-command-center',
    'backend-sync-scenario-walkthrough',
    'backend-sync-scenario-trail',
    'backend-sync-requirement-matrix',
    'backend-sync-sync-protocol-audit',
    'backend-sync-use-case-audit',
    'backend-sync-cockpit-models',
    'backend-sync-action-queue',
    'backend-sync-agent-autonomous-action-queue',
    'backend-sync-collaboration-intent-queue',
    'backend-sync-timeline-events',
  ];
  controlIds.forEach(id => assert.ok(controlsSource.includes(`data-testid="${id}"`), `missing control: ${id}`));
  [
    'Check', 'Start', 'Stop', 'Sync State', 'Seed Sample/Dev', 'Sync Projects',
    'Sync Manager View', 'Sync Package', 'Sync Proof Models', 'Sync Command',
    'Sync Walkthrough', 'Sync Trail', 'Sync Matrix', 'Sync Protocol', 'Sync Audit',
    'Sync Cockpit', 'Sync Queue', 'Sync Agent Queue', 'Sync Intent Queue',
    'Sync Timeline', 'Server Pulse', 'IMMEDIATE START: YES',
  ].forEach(label => assert.ok(controlsSource.includes(label), `missing label: ${label}`));
});
