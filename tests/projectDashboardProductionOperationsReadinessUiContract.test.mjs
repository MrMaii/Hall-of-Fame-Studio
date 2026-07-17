import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProductionOperationsReadiness.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx', import.meta.url);

test('production operations readiness stays lazy and preserves the original read-only status contract', () => {
  assert.ok(existsSync(componentUrl), 'Production operations readiness component must exist');
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package pilot operations wrapper must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(wrapperSource.includes("const ProjectDashboardProductionOperationsReadiness = lazy(() => import('./ProjectDashboardProductionOperationsReadiness.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProductionOperationsReadiness'));
  assert.ok(wrapperSource.includes('readiness={productionOperationsReadiness}'));
  assert.ok(wrapperSource.includes('fallbackRoute={readyPackage.backendRoutes?.productionOperationsReadiness}'));
  assert.ok(wrapperSource.includes('projectId={projectId}'));
  assert.ok(wrapperSource.includes('projectText={projectText}'));
  assert.ok(appSource.includes('productionOperationsReadiness: backendProductionOperationsReadiness'));

  for (const contract of [
    'backend-production-operations-readiness-snapshot',
    'Production Operations Readiness',
    'managed evidence ready',
    'receipts ready',
    'controls blocked',
    'proof blocked',
    'Local Proof',
    'Local Failures',
    'Prod Controls',
    'Blocked Controls',
    'Managed Evidence',
    'Managed Controls',
    'Private Pilot Ops',
    'Ops Receipts',
    'Alert Rules',
    'On Call',
    'Incident System',
    'Restore Drill',
    'Next Gap',
    'Packet',
    'failedProductionControlGates?.length',
    'failedLocalProofGates || []',
    '.slice(0, 4)',
    'Production ops route',
    '`/projects/${projectId}/production-operations-readiness`',
  ]) {
    assert.ok(componentSource.includes(contract), `Production operations readiness must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-production-operations-readiness-snapshot"'),
    false,
    'Production operations readiness markup must no longer remain duplicated in App',
  );
});
