import assert from 'node:assert/strict';
import test from 'node:test';
import { initiationStartupAllowsModelWork } from '../src/onboarding/initiationStartupReadiness.js';

test('configured language model allows kickoff when optional search is absent', () => {
  assert.equal(initiationStartupAllowsModelWork({
    backendUrlConfigured: true,
    startupReadiness: {
      schemaVersion: 'local-mvp-startup-readiness/v1',
      readyForProviderSetup: true,
      readyForFirstProjectRun: false,
      nextAction: { id: 'seal-search-provider' },
    },
    modelProviderStatus: { enabled: true, configured: true },
  }), true);
});

test('kickoff remains blocked without a configured language model or backend target', () => {
  assert.equal(initiationStartupAllowsModelWork({
    backendUrlConfigured: true,
    startupReadiness: { readyForProviderSetup: true, readyForFirstProjectRun: false },
    modelProviderStatus: { enabled: false, configured: true },
  }), false);
  assert.equal(initiationStartupAllowsModelWork({
    backendUrlConfigured: false,
    startupReadiness: { readyForFirstProjectRun: true },
    modelProviderStatus: { enabled: true, configured: true },
  }), false);
});
