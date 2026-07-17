import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardPilotLaunchReadiness.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLocalReadinessPanels.jsx', import.meta.url);

test('Dashboard pilot launch readiness stays lazy and keeps its private-pilot decision, gates, blockers, and route', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package local readiness wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardPilotLaunchReadiness = lazy(() => import('./ProjectDashboardPilotLaunchReadiness.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardPilotLaunchReadiness'));
  assert.ok(existsSync(componentUrl), 'Dashboard pilot launch readiness component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-pilot-launch-readiness-snapshot',
    'Pilot Launch Readiness',
    'production',
    'Private Pilot',
    'Gates',
    'Failed Gates',
    'Evidence Routes',
    'Prod Blockers',
    'Packet',
    'Next Gap',
    'pilot-launch-gap-',
    'Launch route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard pilot launch readiness must keep ${publicContract}`);
  }

  for (const appContract of [
    'pilotLaunchReadinessAvailable: readyPackageModelAvailable(backendPilotLaunchReadiness)',
    'pilotLaunchReadiness: backendPilotLaunchReadiness',
    'managerReadyPackage: backendManagerReadyPackage',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard pilot launch readiness must keep ${appContract} in App.jsx`);
  }
  assert.ok(wrapperSource.includes('backendPilotLaunchReadiness: pilotLaunchReadiness,'));
  assert.ok(wrapperSource.includes('backendManagerReadyPackage: managerReadyPackage,'));
});
