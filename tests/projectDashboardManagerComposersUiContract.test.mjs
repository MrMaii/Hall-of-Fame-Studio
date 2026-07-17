import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerCorePanels.jsx', import.meta.url), 'utf8');
const managerComposersUrl = new URL('../src/project/ProjectDashboardManagerComposers.jsx', import.meta.url);

test('Dashboard manager requirement and command composers stay lazy and keep their public operations', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardManagerComposers = lazy(() => import('./ProjectDashboardManagerComposers.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerComposers'));
  assert.ok(existsSync(managerComposersUrl), 'Dashboard manager composers component must exist');

  const componentSource = readFileSync(managerComposersUrl, 'utf8');
  for (const publicContract of [
    'manager-requirement-matrix',
    'manager-requirement-matrix-backend-required',
    'manager-requirement-matrix-sync-read-model',
    'manager-requirement-row-',
    'manager-requirement-proof-',
    'manager-leader-assignment-composer',
    'manager-assignment-composer-input',
    'manager-assignment-composer-target',
    'manager-assignment-composer-submit',
    'manager-change-intake-composer',
    'manager-change-composer-input',
    'manager-change-composer-mode',
    'manager-change-composer-submit',
    'onSyncRequirementMatrix',
    'onOpenRequirement',
    'onAssignmentDraftChange',
    'onSubmitAssignment',
    'onChangeDraft',
    'onSubmitChange',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard manager composers must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('assignmentSubmitDisabled:'));
  assert.ok(appSource.includes('changeSubmitDisabled:'));
  assert.ok(appSource.includes('backendManagedCommandTargetMissing'));
  assert.ok(appSource.includes('Boolean(sceneTransition)'));
});
