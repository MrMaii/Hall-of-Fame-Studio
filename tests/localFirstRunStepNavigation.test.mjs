import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildLocalFirstRunSteps } from '../src/onboarding/localFirstRunModel.js';

const flowSource = readFileSync(new URL('../src/onboarding/LocalFirstRunFlow.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('first-run steps expose only reachable destinations and explain locked ones', () => {
  const checking = buildLocalFirstRunSteps({ serviceChecked: false, language: 'en' });
  assert.equal(checking[0].accessible, false);
  assert.match(checking[0].lockedReason, /check finishes/i);
  assert.equal(checking[1].accessible, false);
  assert.match(checking[1].lockedReason, /local service/i);

  const signedIn = buildLocalFirstRunSteps({
    serviceChecked: true,
    serviceReady: true,
    authenticated: true,
    modelReady: false,
    language: 'en',
  });
  assert.deepEqual(signedIn.map(step => step.accessible), [true, true, true, true]);
  assert.equal(signedIn[3].status, 'waiting');
});

test('reachable step cards are buttons and locked cards show the blocking reason', () => {
  assert.ok(flowSource.includes('data-testid={`first-run-step-${step.id}`}'));
  assert.ok(flowSource.includes('onClick={() => runStepAction(step.id)}'));
  assert.ok(flowSource.includes('step.lockedReason'));
  assert.ok(flowSource.includes("document.getElementById('first-run-username')?.focus()"));
});

test('completed account step opens account settings from the app', () => {
  assert.ok(appSource.includes('onOpenAccountSettings={() =>'));
  assert.ok(appSource.includes("setSettingsTab('account')"));
});
