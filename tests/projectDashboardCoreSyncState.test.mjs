import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginProjectDashboardCoreSync,
  completeProjectDashboardCoreSync,
  coreSyncStatusForView,
  createProjectDashboardCoreSyncState,
  failProjectDashboardCoreSync,
  resetProjectDashboardCoreSync,
  shouldStartProjectDashboardCoreSync,
} from '../src/project/projectDashboardCoreSyncState.js';

test('a failed dashboard core sync becomes retryable after a short recovery delay', () => {
  const idle = createProjectDashboardCoreSyncState();
  assert.equal(shouldStartProjectDashboardCoreSync(idle, 'project-a', 1_000), true);

  const loading = beginProjectDashboardCoreSync(idle, 'project-a');
  const failed = failProjectDashboardCoreSync(loading, {
    projectId: 'project-a',
    attemptId: loading.attemptId,
    error: 'timed out',
    now: 1_000,
    retryDelayMs: 5_000,
  });

  assert.equal(failed.status, 'error');
  assert.equal(failed.retryAt, 6_000);
  assert.equal(shouldStartProjectDashboardCoreSync(failed, 'project-a', 5_999), false);
  assert.equal(shouldStartProjectDashboardCoreSync(failed, 'project-a', 6_000), true);

  const retryable = resetProjectDashboardCoreSync(failed, 'project-a');
  assert.equal(retryable.status, 'idle');
  assert.equal(shouldStartProjectDashboardCoreSync(retryable, 'project-a', 1_000), true);
});

test('a stale dashboard response cannot overwrite a newer project or retry attempt', () => {
  const firstAttempt = beginProjectDashboardCoreSync(createProjectDashboardCoreSyncState(), 'project-a');
  const secondAttempt = beginProjectDashboardCoreSync(
    resetProjectDashboardCoreSync(firstAttempt, 'project-b'),
    'project-b',
  );

  assert.strictEqual(completeProjectDashboardCoreSync(secondAttempt, {
    projectId: 'project-a',
    attemptId: firstAttempt.attemptId,
    complete: true,
  }), secondAttempt);

  const completed = completeProjectDashboardCoreSync(secondAttempt, {
    projectId: 'project-b',
    attemptId: secondAttempt.attemptId,
    complete: true,
  });
  assert.equal(completed.status, 'ready');
});

test('verified dashboard content stays visible during any later background refresh', () => {
  const loading = beginProjectDashboardCoreSync(createProjectDashboardCoreSyncState(), 'project-a');
  assert.equal(coreSyncStatusForView({ required: true, verified: false, state: loading, projectId: 'project-a' }), 'loading');
  assert.equal(coreSyncStatusForView({ required: true, verified: true, state: loading, projectId: 'project-a' }), null);

  const failed = failProjectDashboardCoreSync(loading, {
    projectId: 'project-a',
    attemptId: loading.attemptId,
    error: 'timed out',
  });
  assert.equal(coreSyncStatusForView({ required: true, verified: false, state: failed, projectId: 'project-a' }), 'error');
});
