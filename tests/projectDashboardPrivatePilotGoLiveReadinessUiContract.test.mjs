import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const launchPanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx', import.meta.url);
const componentUrl = new URL('../src/project/ProjectDashboardPrivatePilotGoLiveReadiness.jsx', import.meta.url);

test('Dashboard private pilot go-live readiness stays lazy and keeps its status, stages, proof counts, and route', () => {
  const launchPanelsSource = readFileSync(launchPanelsUrl, 'utf8');
  assert.ok(operationalAssemblySource.includes("const ProjectDashboardManagerReadyPackageLaunchReadinessPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx'))"));
  assert.ok(launchPanelsSource.includes("const ProjectDashboardPrivatePilotGoLiveReadiness = lazy(() => import('./ProjectDashboardPrivatePilotGoLiveReadiness.jsx'))"));
  assert.ok(launchPanelsSource.includes('<ProjectDashboardPrivatePilotGoLiveReadiness'));
  assert.ok(existsSync(launchPanelsUrl), 'Manager Ready Package launch readiness panels component must exist');
  assert.ok(existsSync(componentUrl), 'Dashboard private pilot go-live readiness component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-private-pilot-go-live-readiness-snapshot',
    'Private Pilot Go-Live Readiness',
    'backend-private-pilot-go-live-readiness-source',
    'Active Phase',
    'Go-Live Stages',
    'Acceptance Stages',
    'Failed Go-Live',
    'Next Action',
    'Latest Launch',
    'Latest Health',
    'Acceptance',
    'Packet',
    'Go-live route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard private pilot go-live readiness must keep ${publicContract}`);
  }

  for (const appContract of [
    'privatePilotGoLiveReadiness: backendPrivatePilotGoLiveReadiness',
    'readyPackage: backendManagerReadyPackage',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard private pilot go-live readiness must keep ${appContract} in App.jsx`);
  }
  assert.ok(launchPanelsSource.includes('backendPrivatePilotGoLiveReadiness: privatePilotGoLiveReadiness'));
  assert.ok(launchPanelsSource.includes('backendManagerReadyPackage: readyPackage'));
});
