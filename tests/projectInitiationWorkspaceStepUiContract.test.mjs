import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const flowSource = readFileSync(new URL('../src/onboarding/ProjectInitiationFlowView.jsx', import.meta.url), 'utf8');
const workspaceStepUrl = new URL('../src/onboarding/ProjectInitiationWorkspaceStep.jsx', import.meta.url);

test('project initiation workspace step stays lazy and keeps every public workspace operation', () => {
  assert.ok(appSource.includes("const ProjectInitiationFlowView = lazy(() => import('./onboarding/ProjectInitiationFlowView.jsx'))"));
  assert.ok(flowSource.includes("const ProjectInitiationWorkspaceStep = lazy(() => import('./ProjectInitiationWorkspaceStep.jsx'))"));
  assert.ok(flowSource.includes('<ProjectInitiationWorkspaceStep'));
  assert.ok(existsSync(workspaceStepUrl), 'project initiation workspace step component must exist');

  const workspaceStepSource = readFileSync(workspaceStepUrl, 'utf8');
  for (const publicControl of [
    'initiation-workspace-status',
    'initiation-workspace-base-path',
    'initiation-workspace-folder-name',
    'initiation-workspace-full-path',
    'initiation-workspace-browser-folder',
    'initiation-workspace-open-folder-picker',
    'initiation-workspace-prepare',
    'initiation-workspace-receipt',
    'initiation-workspace-next-invite',
  ]) {
    assert.ok(workspaceStepSource.includes(publicControl), `project initiation workspace step must keep ${publicControl}`);
  }

  assert.ok(workspaceStepSource.includes('onOpenFolderPicker'));
  assert.ok(workspaceStepSource.includes('onPrepareWorkspace'));
  assert.ok(workspaceStepSource.includes('onContinue'));
});
