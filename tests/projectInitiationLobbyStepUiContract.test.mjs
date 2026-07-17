import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const flowSource = readFileSync(new URL('../src/onboarding/ProjectInitiationFlowView.jsx', import.meta.url), 'utf8');
const lobbyStepUrl = new URL('../src/onboarding/ProjectInitiationLobbyStep.jsx', import.meta.url);

test('project initiation lobby stays lazy and keeps kickoff start states and controls', () => {
  assert.ok(appSource.includes("const ProjectInitiationFlowView = lazy(() => import('./onboarding/ProjectInitiationFlowView.jsx'))"));
  assert.ok(flowSource.includes("const ProjectInitiationLobbyStep = lazy(() => import('./ProjectInitiationLobbyStep.jsx'))"));
  assert.ok(flowSource.includes('<ProjectInitiationLobbyStep'));
  assert.ok(existsSync(lobbyStepUrl), 'project initiation lobby component must exist');

  const lobbyStepSource = readFileSync(lobbyStepUrl, 'utf8');
  for (const publicContract of [
    'initiation-start-meeting',
    'Start Kickoff Roundtable',
    'startState.running',
    'canStart',
    'providerRunning',
    'onStartMeeting',
  ]) {
    assert.ok(lobbyStepSource.includes(publicContract), `project initiation lobby must keep ${publicContract}`);
  }
});
