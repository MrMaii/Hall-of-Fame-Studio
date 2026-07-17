import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerWorkerStationPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardBackendWorkerStationStatus.jsx', import.meta.url);

test('Backend Worker Station status stays lazy and preserves its local connection actions', () => {
  assert.ok(existsSync(componentUrl), 'Backend Worker Station status component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardBackendWorkerStationStatus = lazy(() => import('./ProjectDashboardBackendWorkerStationStatus.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardBackendWorkerStationStatus'));
  assert.ok(appSource.includes('backendConfiguredTargetLabel,'));
  assert.ok(appSource.includes('backendOnline,'));
  assert.ok(appSource.includes('backendScheduler,'));
  assert.ok(appSource.includes('backendSchedulerAgentControls,'));
  assert.ok(appSource.includes('backendSchedulerAutopilotControls,'));
  assert.ok(appSource.includes('backendStation,'));
  assert.ok(appSource.includes('backendStatusText,'));
  assert.ok(appSource.includes('backendWorkerStationTargetRequiredDetail,'));
  assert.ok(appSource.includes('onBaseUrlChange: (value) => setBackendStation(prev => ({ ...prev, draftBaseUrl: value }))'));
  assert.ok(appSource.includes("onOpenDeployment: () => { setSettingsTab('deployment'); setSettingsOpen(true); }"));
  assert.ok(appSource.includes('onSaveBaseUrl: saveBackendBaseUrl'));
  assert.ok(appSource.includes('projectText,'));

  for (const contract of [
    'Backend Worker Station',
    'backend-worker-connection-status',
    'backend-url-input',
    'Backend worker station URL',
    'onBaseUrlChange(event.target.value)',
    'onClick={onSaveBaseUrl}',
    'Save URL',
    "['Ticks', backendScheduler.tickCount ?? 0]",
    "['Processed', backendScheduler.processedCount ?? 0]",
    "['Agent Runs', backendScheduler.agentProcessedCount ?? 0]",
    "['Autopilot Runs', backendScheduler.autopilotProcessedCount ?? 0]",
    "['Skipped', backendScheduler.skippedCount ?? 0]",
    "['Agent Skips', backendScheduler.agentSkippedCount ?? 0]",
    "['Autopilot Skips', backendScheduler.autopilotSkippedCount ?? 0]",
    "['Messages', backendScheduler.messageCount ?? 0]",
    'backend-scheduler-agent-controls',
    'backend-scheduler-autopilot-controls',
    'backend-worker-station-target-required',
    'backend-worker-station-open-deployment',
    'onClick={onOpenDeployment}',
    'backend-project-catalog-sync-status',
    'BACKEND MANAGER READY PACKAGE SYNCED',
    'Collaboration intent queue sync',
    'Autonomous run control sync',
    'backend-runtime-autonomy-status-sync',
  ]) {
    assert.ok(componentSource.includes(contract), `Backend Worker Station status must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-worker-connection-status"'),
    false,
    'Backend Worker Station status markup must no longer remain duplicated in App',
  );
});
