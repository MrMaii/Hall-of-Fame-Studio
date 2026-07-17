import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardMvpReadiness.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLocalReadinessPanels.jsx', import.meta.url);

test('Dashboard MVP readiness stays lazy and keeps local-pilot status, operator actions, receipts, blockers, and route', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package local readiness wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardMvpReadiness = lazy(() => import('./ProjectDashboardMvpReadiness.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardMvpReadiness'));
  assert.ok(existsSync(componentUrl), 'Dashboard MVP readiness component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-mvp-readiness-snapshot',
    'MVP Readiness',
    'Local Pilot Ready',
    'Core Blocked',
    'Core Blockers',
    'Production Blockers',
    'Next Action',
    'mvp-readiness-operator-actions',
    'mvp-readiness-operator-action-run-',
    'Record',
    'mvp-readiness-operator-action-receipt',
    'Action failed:',
    'no local operator receipt was created',
    'Receipt:',
    'mvp-gap-',
    'MVP route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard MVP readiness must keep ${publicContract}`);
  }

  for (const appContract of [
    'mvpReadinessOperatorActionRunReceipt: backendMvpReadinessOperatorActionRunReceipt',
    'runMvpReadinessOperatorAction,',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard MVP readiness must keep ${appContract} in App.jsx`);
  }
  assert.ok(wrapperSource.includes('backendMvpReadinessOperatorActionRunReceipt: mvpReadinessOperatorActionRunReceipt,'));
  assert.ok(wrapperSource.includes('runMvpReadinessOperatorAction,'));
});
