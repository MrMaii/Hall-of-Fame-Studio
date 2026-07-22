import assert from 'node:assert/strict';
import test from 'node:test';

import { projectWorkspaceLaunchGate } from '../src/project/projectWorkspaceLaunchGate.js';

test('a backend project cannot open its Dashboard before the prepared workspace is verified', () => {
  assert.deepEqual(projectWorkspaceLaunchGate({
    workspaceRequired: true,
    preparedWorkspacePath: 'C:/projects/research',
    verification: null,
  }), {
    ready: false,
    reason: 'workspace-verification-required',
  });
  assert.deepEqual(projectWorkspaceLaunchGate({
    workspaceRequired: true,
    preparedWorkspacePath: 'C:/projects/research',
    verification: {
      workspacePath: 'C:/projects/research',
      markerPath: '.hall-of-fame-workspace/README.md',
      readBytes: 42,
    },
  }), {
    ready: true,
    reason: null,
  });
});

test('development-only projects that do not require a backend workspace keep their existing launch path', () => {
  assert.equal(projectWorkspaceLaunchGate({ workspaceRequired: false }).ready, true);
});
