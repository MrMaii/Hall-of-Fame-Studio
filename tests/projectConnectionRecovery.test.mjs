import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LOCAL_BACKEND_RECOVERY_INTERVAL_MS,
  shouldHydrateRestoredProject,
  shouldRetryManagerFlowGraph,
  shouldRunLocalBackendRecovery,
} from '../src/project/projectConnectionRecovery.js';

test('transient local backend failures remain eligible for automatic recovery', () => {
  assert.equal(LOCAL_BACKEND_RECOVERY_INTERVAL_MS, 5_000);
  assert.equal(shouldRunLocalBackendRecovery({
    configured: true,
    authAvailable: false,
    hasSession: false,
    catalogStatus: 'offline',
    connectionStatus: 'offline',
  }), true);
  assert.equal(shouldRunLocalBackendRecovery({
    configured: true,
    authAvailable: true,
    hasSession: false,
    catalogStatus: 'offline',
    connectionStatus: 'offline',
  }), false);
  assert.equal(shouldRunLocalBackendRecovery({
    configured: true,
    authAvailable: true,
    hasSession: true,
    catalogStatus: 'ready',
    connectionStatus: 'online',
  }), false);
});

test('the active timeline retries its own failed flow graph without leaking another project error', () => {
  assert.equal(shouldRetryManagerFlowGraph({
    activeRoute: 'project_detail',
    projectMode: 'timeline',
    projectId: 'project-1',
    errorProjectId: 'project-1',
    error: 'timed out',
  }), true);
  assert.equal(shouldRetryManagerFlowGraph({
    activeRoute: 'project_detail',
    projectMode: 'timeline',
    projectId: 'project-1',
    errorProjectId: 'project-2',
    error: 'timed out',
  }), false);
});

test('a restored catalog-only active project is immediately hydrated from the backend', () => {
  assert.equal(shouldHydrateRestoredProject({
    activeRoute: 'project_detail',
    project: { id: 'project-1', dataSource: 'backend-catalog-snapshot', catalogRecoveryStatus: 'verifying' },
    configured: true,
    authAvailable: false,
    hasSession: false,
    lastSyncedProjectId: null,
  }), true);
  assert.equal(shouldHydrateRestoredProject({
    activeRoute: 'project_detail',
    project: { id: 'project-1', dataSource: 'backend-backed' },
    configured: true,
    authAvailable: false,
    hasSession: false,
    lastSyncedProjectId: 'project-1',
  }), false);
});
