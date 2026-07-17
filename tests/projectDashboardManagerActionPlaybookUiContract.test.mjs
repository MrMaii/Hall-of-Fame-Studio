import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const playbookSource = readFileSync(new URL('../src/project/ProjectDashboardManagerActionPlaybook.jsx', import.meta.url), 'utf8');

test('complete Dashboard Manager Action Playbook stays lazy and keeps every public action', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardManagerActionPlaybook = lazy(() => import('./ProjectDashboardManagerActionPlaybook.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerActionPlaybook'));

  for (const publicControl of [
    'manager-action-playbook',
    'manager-action-playbook-source',
    'manager-action-playbook-backend-required',
    'manager-action-playbook-sync-action-queue',
    'manager-action-playbook-row-',
    'manager-action-playbook-run-',
    'manager-action-playbook-open-',
    'Body template',
    'Run route:',
    'Run Again',
    'Run Action',
    'Open Step',
  ]) {
    assert.ok(playbookSource.includes(publicControl), `Manager Action Playbook must keep ${publicControl}`);
  }

  assert.ok(playbookSource.includes('(managerActionPlaybook.rows || []).map'));
  assert.ok(playbookSource.includes('onSyncActionQueue'));
  assert.ok(playbookSource.includes('onRunRow(row)'));
  assert.ok(playbookSource.includes('onOpenRow(row)'));
});
