import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProductionLaunchAudit.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx', import.meta.url);

test('production launch audit stays lazy and preserves the original read-only status details', () => {
  assert.ok(existsSync(componentUrl), 'Production launch audit component must exist');
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package pilot operations wrapper must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(wrapperSource.includes("const ProjectDashboardProductionLaunchAudit = lazy(() => import('./ProjectDashboardProductionLaunchAudit.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProductionLaunchAudit'));
  assert.ok(wrapperSource.includes('audit={productionLaunchAudit}'));
  assert.ok(wrapperSource.includes('route={readyPackage.backendRoutes?.productionLaunchAudit}'));
  assert.ok(appSource.includes('productionLaunchAudit: backendProductionLaunchAudit'));
  assert.ok(appSource.includes('productionLaunchAuditAvailable: readyPackageModelAvailable(backendProductionLaunchAudit)'));

  for (const contract of [
    'backend-production-launch-audit-snapshot',
    'Production Launch Audit',
    'privatePilotDecision',
    'productionDecision',
    'Private Gates',
    'Failed Private Gates',
    'Production Gates',
    'Failed Production Gates',
    'Launch Approvals',
    'Pilot Approval',
    'Production Approval',
    'Evidence Routes',
    'Production Blockers',
    'Handoff Package',
    'Handoff Gates',
    'Packet',
    'Next Gap',
    'failedPrivatePilotGates?.length ? audit.failedPrivatePilotGates : audit.productionBlockers || []',
    '.slice(0, 3)',
    'row.apiPath',
    'Audit route',
    '`/projects/${projectId}/production-launch-audit`',
  ]) {
    assert.ok(componentSource.includes(contract), `Production launch audit must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-production-launch-audit-snapshot"'),
    false,
    'Production launch audit markup must no longer remain duplicated in App',
  );
});
