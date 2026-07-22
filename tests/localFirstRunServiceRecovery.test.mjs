import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { localServiceRecoveryMessage } from '../src/onboarding/localFirstRunModel.js';

const flowSource = readFileSync(new URL('../src/onboarding/LocalFirstRunFlow.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('local service recovery explains the most likely failure without exposing raw error details', () => {
  assert.equal(
    localServiceRecoveryMessage({ configured: false, language: 'en' }),
    'The local service address is not configured. Open local service settings and enter the address.'
  );
  assert.equal(
    localServiceRecoveryMessage({ configured: true, error: 'Request timed out after 8000ms', language: 'en' }),
    'The local service did not respond in time. Check that it is running, then retry.'
  );
  assert.equal(
    localServiceRecoveryMessage({ configured: true, error: 'fetch failed: api_key=super-secret', language: 'en' }),
    'The application could not reach the local service. Check its address and that it is running, then retry.'
  );
});

test('first-run service failure offers retry and local service settings actions', () => {
  assert.ok(flowSource.includes('data-testid="first-run-retry-service"'));
  assert.ok(flowSource.includes('onClick={onRetryService}'));
  assert.ok(flowSource.includes('data-testid="first-run-open-service-settings"'));
  assert.ok(flowSource.includes('onClick={onOpenServiceSettings}'));
  assert.ok(flowSource.includes('localServiceRecoveryMessage'));
});

test('app wires first-run recovery to a fresh status check and deployment settings', () => {
  assert.ok(appSource.includes('onRetryService={() => syncLocalAuthStatus()}'));
  assert.ok(appSource.includes("setSettingsTab('deployment')"));
  assert.ok(appSource.includes('onOpenServiceSettings={() =>'));
});
