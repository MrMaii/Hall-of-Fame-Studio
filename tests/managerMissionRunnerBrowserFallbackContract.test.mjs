import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../scripts/validate-manager-mission-runner-ui.mjs', import.meta.url), 'utf8');

test('mission runner UI validation can use the locally installed Edge browser', () => {
  assert.ok(source.includes("{ channel: 'msedge', headless: true }"));
});

test('mission runner UI validation boots an isolated local account before opening the product', () => {
  assert.ok(source.includes('localAuthRequired: true'));
  assert.ok(source.includes("fetch(`${backendRuntime.url}/local-auth/bootstrap`"));
  assert.ok(source.includes('window.sessionStorage.setItem(localAuthStorageKey'));
  assert.ok(source.includes('let backendAuthContext = null'));
  assert.ok(source.includes("headers.set('x-hofs-local-auth-token', backendAuthContext.token)"));
  assert.ok(source.includes('backendAuthContext = { baseUrl: backendRuntime.url, token: localAuthSession.token }'));
});

test('mission runner UI validation enters the complete workspace before using the original initiation flow', () => {
  assert.ok(source.includes("page.getByTestId('workspace-open-advanced')"));
  assert.ok(source.includes("page.getByTestId('initiation-next-workspace')"));
  assert.ok(source.includes("page.getByTestId('initiation-workspace-base-path')"));
  assert.ok(source.includes("page.getByTestId('initiation-workspace-prepare')"));
  assert.ok(source.includes("page.getByTestId('initiation-workspace-next-invite')"));
  assert.ok(source.includes('createLocalProjectRuntime({ rootPath: PROJECT_RUNTIME_ROOT })'));
});

test('mission runner UI validation opens the complete project Dashboard after project creation', () => {
  assert.ok(source.includes("page.getByTestId('initiation-approval-progress')"));
  assert.ok(source.includes("page.getByTestId('project-overview-open-advanced')"));
  assert.ok(source.includes("timeout: 90000"));
  assert.ok(source.includes("page.getByTestId('project-dashboard-view')"));
});

test('mission runner UI validation returns an on-topic structured kickoff meeting fixture', () => {
  assert.ok(source.includes('roleTurns: ['));
  assert.ok(source.includes('leaderCampaigns: ['));
  assert.ok(source.includes("recommendedLeaderId: 'turing'"));
  assert.ok(source.includes("reviewerId: 'curie'"));
});

test('mission runner UI validation uses the current meeting transcript and result controls', () => {
  assert.ok(source.includes("page.getByTestId('project-meeting-input')"));
  assert.ok(source.includes("page.getByTestId('project-meeting-send')"));
  assert.ok(source.includes("getByRole('button', { name: 'End Meeting', exact: true })"));
  assert.ok(source.includes("page.getByTestId('initiation-next-action-0')"));
  assert.ok(source.includes("page.getByTestId('leader-candidate-turing')"));
});
