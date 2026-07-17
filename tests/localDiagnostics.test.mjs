import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLocalDiagnosticExport } from '../src/localRuntime/localDiagnostics.js';

test('local diagnostic export includes operating state without credentials, identity or project content', () => {
  const payload = buildLocalDiagnosticExport({
    localRuntimeStatus: {
      updatedAt: '2026-07-12T01:00:00.000Z',
      backend: { status: 'failed', failure: { kind: 'unexpected-exit', code: 1, detail: 'C:\\secret\\project.json API_KEY=must-not-leak' } },
      ui: { status: 'running' },
      token: 'must-not-leak',
    },
    localServiceReady: false,
    modelReady: true,
    projectCount: 2,
    platform: 'Win32',
    userAgent: 'Local browser',
    now: '2026-07-12T01:01:00.000Z',
  });
  const serialized = JSON.stringify(payload);
  assert.equal(payload.service.failureKind, 'unexpected-exit');
  assert.equal(payload.service.failureCode, 1);
  assert.equal(payload.privacy.includesCredentials, false);
  assert.doesNotMatch(serialized, /must-not-leak|API_KEY|secret\\project|token/i);
});
