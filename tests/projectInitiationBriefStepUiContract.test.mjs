import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const flowSource = readFileSync(new URL('../src/onboarding/ProjectInitiationFlowView.jsx', import.meta.url), 'utf8');
const briefStepUrl = new URL('../src/onboarding/ProjectInitiationBriefStep.jsx', import.meta.url);

test('project initiation brief stays lazy and keeps project brief and work-mode operations', () => {
  assert.ok(appSource.includes("const ProjectInitiationFlowView = lazy(() => import('./onboarding/ProjectInitiationFlowView.jsx'))"));
  assert.ok(flowSource.includes("const ProjectInitiationBriefStep = lazy(() => import('./ProjectInitiationBriefStep.jsx'))"));
  assert.ok(flowSource.includes('<ProjectInitiationBriefStep'));
  assert.ok(existsSync(briefStepUrl), 'project initiation brief component must exist');

  const briefStepSource = readFileSync(briefStepUrl, 'utf8');
  for (const publicContract of [
    'initiation-work-mode',
    'initiation-next-workspace',
    "onDraftChange('name'",
    "onDraftChange('summary'",
    "onDraftChange('intent'",
    'onWorkModeChange',
    'onContinue',
  ]) {
    assert.ok(briefStepSource.includes(publicContract), `project initiation brief must keep ${publicContract}`);
  }
});
