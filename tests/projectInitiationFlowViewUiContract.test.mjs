import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const viewUrl = new URL('../src/onboarding/ProjectInitiationFlowView.jsx', import.meta.url);

test('project initiation display loads independently while retaining every existing step and action', () => {
  assert.ok(existsSync(viewUrl), 'ProjectInitiationFlowView must exist');
  const viewSource = readFileSync(viewUrl, 'utf8');

  assert.ok(appSource.includes("lazy(() => import('./onboarding/ProjectInitiationFlowView.jsx'))"));
  assert.ok(appSource.includes('<ProjectInitiationFlowView'));

  for (const movedStep of [
    'ProjectInitiationBriefStep',
    'ProjectInitiationWorkspaceStep',
    'ProjectInitiationInviteStep',
    'ProjectInitiationLobbyStep',
    'ProjectInitiationResultStep',
  ]) {
    assert.ok(!appSource.includes(`<${movedStep}`), `App must not retain ${movedStep} markup`);
    assert.ok(viewSource.includes(movedStep), `initiation view is missing ${movedStep}`);
  }

  for (const retainedAction of [
    'openInitiationWorkspaceFolderPicker',
    'prepareInitiationWorkspace',
    'startInitiationMeetingSession',
    'submitInitiationMeetingInput',
    'approveInitiationProject',
  ]) {
    assert.ok(appSource.includes(retainedAction), `App must retain ${retainedAction}`);
    assert.ok(viewSource.includes(retainedAction), `initiation view must retain ${retainedAction}`);
  }
});
