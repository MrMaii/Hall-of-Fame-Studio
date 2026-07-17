import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardWorkLoopPanels.jsx', import.meta.url), 'utf8');
const autonomousWorkLoopUrl = new URL('../src/project/ProjectDashboardAutonomousWorkLoop.jsx', import.meta.url);

test('Dashboard autonomous work loop stays lazy and keeps both pulse controls and recent proof details', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardWorkLoopPanels = lazy(() => import('./ProjectDashboardWorkLoopPanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardAutonomousWorkLoop = lazy(() => import('./ProjectDashboardAutonomousWorkLoop.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardAutonomousWorkLoop'));
  assert.ok(existsSync(autonomousWorkLoopUrl), 'Dashboard autonomous work loop component must exist');

  const componentSource = readFileSync(autonomousWorkLoopUrl, 'utf8');
  for (const publicContract of [
    'autonomous-work-loop-backend-required',
    'autonomous-work-loop-hour-pulse',
    'autonomous-work-loop-day-report',
    "onRunPulse('hourly')",
    "onRunPulse('daily')",
    'cycles.slice(0, 2)',
    'managementEvents?.slice(0, 3)',
    'communicationDiagnostics?.slice(0, 2)',
    'agentPlans?.slice(0, 3)',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard autonomous work loop must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('commandDisabled: autonomousPulseCommandDisabled'));
  assert.ok(appSource.includes('onRunPulse: runProjectAutonomousPulse'));
});
