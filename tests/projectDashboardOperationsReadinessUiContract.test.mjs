import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardOperationsReadiness.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageLocalReadinessPanels.jsx', import.meta.url);

test('Dashboard operations readiness stays lazy and keeps local status, storage, queue, recovery, alerts, and route', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package local readiness wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardOperationsReadiness = lazy(() => import('./ProjectDashboardOperationsReadiness.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardOperationsReadiness'));
  assert.ok(existsSync(componentUrl), 'Dashboard operations readiness component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-operations-readiness-snapshot',
    'Operations Readiness',
    'backend-operations-readiness-source',
    'Local Ops Ready',
    'Needs Ops Work',
    'DB Adapter Plan',
    'DB Adapter Dry Run',
    'Rollback',
    'Backup Restore',
    'Queue Driver',
    'Snapshot Parity',
    'Lease Parity',
    'Dead Letters',
    'Recovery',
    'Incident Drill',
    'Drill Receipts',
    'Drill Alerts',
    'operations-gap-',
    'Operations route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard operations readiness must keep ${publicContract}`);
  }

  for (const appContract of [
    'operationsReadiness: backendOperationsReadiness',
    'persistenceAdapterPlan: backendPersistenceAdapterPlan',
    'persistenceAdapterDryRun: backendPersistenceAdapterDryRun',
    'workerQueueAdapterPlan: backendWorkerQueueAdapterPlan',
    'workerQueueAdapterDryRun: backendWorkerQueueAdapterDryRun',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard operations readiness must keep ${appContract} in App.jsx`);
  }
  assert.ok(wrapperSource.includes('backendOperationsReadiness: operationsReadiness,'));
  assert.ok(wrapperSource.includes('backendPersistenceAdapterPlan: persistenceAdapterPlan,'));
  assert.ok(wrapperSource.includes('backendWorkerQueueAdapterPlan: workerQueueAdapterPlan,'));
});
