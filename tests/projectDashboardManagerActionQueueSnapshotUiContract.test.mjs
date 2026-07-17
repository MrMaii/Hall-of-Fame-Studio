import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const activityAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendActivityPanels.jsx', import.meta.url), 'utf8');
const managerCoreSource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadModelSummaryPanels.jsx', import.meta.url);
const snapshotSource = readFileSync(new URL('../src/project/ProjectDashboardManagerActionQueueSnapshot.jsx', import.meta.url), 'utf8');

test('Manager Action Queue compatibility snapshot stays lazy without replacing the complete action components', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager read-model summary wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardManagerActionQueueSnapshot = lazy(() => import('./ProjectDashboardManagerActionQueueSnapshot.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardManagerActionQueueSnapshot'));
  assert.ok(activityAssemblySource.includes('<ProjectDashboardManagerReadModelSummaryPanels'));
  assert.ok(appSource.includes('managerActionQueue: backendManagerActionQueue'));
  assert.ok(appSource.includes('managerDashboard: backendManagerDashboard'));
  assert.ok(appSource.includes('activeProjectId: activeProject.id'));
  assert.ok(appSource.includes('managerReadModelSourceBadge,'));
  assert.ok(appSource.includes('projectText,'));

  assert.ok(snapshotSource.includes('data-testid="backend-manager-action-queue-snapshot"'));
  assert.ok(snapshotSource.includes("projectText('Manager Action Queue')"));
  assert.ok(snapshotSource.includes("['Complete'"));
  assert.ok(snapshotSource.includes("['Ready'"));
  assert.ok(snapshotSource.includes("['Blocked'"));
  assert.ok(snapshotSource.includes("['Unresolved'"));
  assert.ok(snapshotSource.includes("['Next Action'"));
  assert.ok(snapshotSource.includes('backendManagerActionQueue.nextAction.method'));
  assert.ok(snapshotSource.includes("projectText('Next body')"));

  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'));"));
  assert.ok(managerCoreSource.includes("const ProjectDashboardManagerActionPlaybook = lazy(() => import('./ProjectDashboardManagerActionPlaybook.jsx'));"));
  assert.ok(managerCoreSource.includes("const ProjectDashboardManagerActionRunLedger = lazy(() => import('./ProjectDashboardManagerActionRunLedger.jsx'));"));
  assert.ok(managerCoreSource.includes('<ProjectDashboardManagerActionPlaybook'));
  assert.ok(managerCoreSource.includes('<ProjectDashboardManagerActionRunLedger'));
});
