import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardManagerUseCaseAudit.jsx', import.meta.url);

test('Dashboard manager use case audit stays lazy and keeps every coverage, sync, run, and proof action', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardManagerUseCaseAudit = lazy(() => import('./ProjectDashboardManagerUseCaseAudit.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerUseCaseAudit'));
  assert.ok(existsSync(componentUrl), 'Dashboard manager use case audit component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'manager-use-case-audit',
    'Manager Use Case Audit',
    'manager-use-case-audit-source',
    'covered',
    'manager-use-case-audit-backend-required',
    'manager-use-case-audit-sync-read-model',
    'Sync Audit',
    'manager-use-case-row-',
    'requirements /',
    'Next action:',
    'manager-use-case-run-',
    'Run use case action',
    'manager-use-case-proof-',
    'Use case proof',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard manager use case audit must keep ${publicContract}`);
  }

  for (const appContract of [
    'openManagerUseCaseAuditRow,',
    'runManagerActionPlaybookRow,',
    'syncBackendManagerUseCaseAudit,',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard manager use case audit must keep ${appContract} in App.jsx`);
  }
});
