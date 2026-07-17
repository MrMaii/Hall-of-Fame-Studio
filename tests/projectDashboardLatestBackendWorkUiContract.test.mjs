import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationRegion.jsx', import.meta.url), 'utf8');
const stationContentSource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendStationContent.jsx', import.meta.url), 'utf8');
const parentAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendReadModelPanels.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendActivityPanels.jsx', import.meta.url), 'utf8');
const latestWorkSource = readFileSync(new URL('../src/project/ProjectDashboardLatestBackendWork.jsx', import.meta.url), 'utf8');

test('Latest Backend Work stays lazy and read-only while scheduler controls remain in the Dashboard', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardLatestBackendWork = lazy(() => import('./ProjectDashboardLatestBackendWork.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardLatestBackendWork'));
  assert.ok(appSource.includes('backendLatestResult,'));
  assert.ok(appSource.includes('backendLatestAgentsProcessed,'));
  assert.ok(appSource.includes('backendLatestAutopilotProcessed,'));
  assert.ok(appSource.includes('backendLatestTriggerText,'));
  assert.ok(appSource.includes('projectText,'));

  assert.ok(latestWorkSource.includes('data-testid="backend-last-result"'));
  assert.ok(latestWorkSource.includes("projectText('Latest Backend Work')"));
  assert.ok(latestWorkSource.includes('HTTP-AUTONOMOUS-SCHEDULER-STARTUP-AGENTS / MANAGER-UI-SCHEDULER-START-PULSE'));
  assert.ok(latestWorkSource.includes("projectText('Projects')"));
  assert.ok(latestWorkSource.includes("projectText('Agents')"));
  assert.ok(latestWorkSource.includes("projectText('Autopilot')"));
  assert.ok(latestWorkSource.includes("projectText('Worker Messages')"));
  assert.ok(!latestWorkSource.includes('<button'));
  assert.ok(!latestWorkSource.includes('onClick='));

  const latestWorkUsage = assemblySource.indexOf('<ProjectDashboardLatestBackendWork');
  const backendError = assemblySource.indexOf('view.backendError &&', latestWorkUsage);
  const activityPanels = parentAssemblySource.indexOf('<ProjectDashboardManagerBackendActivityPanels');
  const readModelPanels = stationContentSource.indexOf('<ProjectDashboardManagerBackendReadModelPanels');
  const stationContent = regionSource.indexOf('<ProjectDashboardManagerBackendStationContent');
  const schedulerControls = regionSource.indexOf('<ProjectDashboardBackendSchedulerControls', stationContent);
  assert.ok(latestWorkUsage !== -1 && backendError > latestWorkUsage);
  assert.ok(activityPanels !== -1);
  assert.ok(readModelPanels !== -1 && stationContent !== -1 && schedulerControls > stationContent);
});
