import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const flowSource = readFileSync(new URL('../src/onboarding/ProjectInitiationFlowView.jsx', import.meta.url), 'utf8');
const inviteStepUrl = new URL('../src/onboarding/ProjectInitiationInviteStep.jsx', import.meta.url);

test('project initiation invite step stays lazy and keeps Talent Market team operations', () => {
  assert.ok(appSource.includes("const ProjectInitiationFlowView = lazy(() => import('./onboarding/ProjectInitiationFlowView.jsx'))"));
  assert.ok(flowSource.includes("const ProjectInitiationInviteStep = lazy(() => import('./ProjectInitiationInviteStep.jsx'))"));
  assert.ok(flowSource.includes('<ProjectInitiationInviteStep'));
  assert.ok(existsSync(inviteStepUrl), 'project initiation invite step component must exist');

  const inviteStepSource = readFileSync(inviteStepUrl, 'utf8');
  for (const publicControl of [
    'initiation-signed-team',
    'initiation-open-talent-market',
    'initiation-next-lobby',
    'onOpenTalentMarket',
    'onContinue',
  ]) {
    assert.ok(inviteStepSource.includes(publicControl), `project initiation invite step must keep ${publicControl}`);
  }
});
