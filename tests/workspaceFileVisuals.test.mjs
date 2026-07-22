import assert from 'node:assert/strict';
import test from 'node:test';

import { isWorkspaceTextFile, resolveWorkspaceFileVisual } from '../src/workspace/workspaceFileVisuals.js';

test('maps common local project files to stable visual families', () => {
  assert.equal(resolveWorkspaceFileVisual({ name: 'src', type: 'directory' }).family, 'folder');
  assert.equal(resolveWorkspaceFileVisual({ name: 'App.jsx', type: 'file' }).family, 'code');
  assert.equal(resolveWorkspaceFileVisual({ name: 'brief.md', type: 'file' }).family, 'text');
  assert.equal(resolveWorkspaceFileVisual({ name: 'data.json', type: 'file' }).family, 'data');
  assert.equal(resolveWorkspaceFileVisual({ name: 'cover.png', type: 'file' }).family, 'image');
  assert.equal(resolveWorkspaceFileVisual({ name: '.env', type: 'file' }).family, 'config');
  assert.equal(resolveWorkspaceFileVisual({ name: 'shortcut', type: 'symlink' }).family, 'symlink');
});

test('allows project text formats but keeps binary families metadata-only', () => {
  assert.equal(isWorkspaceTextFile({ name: 'App.tsx', type: 'file' }), true);
  assert.equal(isWorkspaceTextFile({ name: 'settings.yaml', type: 'file' }), true);
  assert.equal(isWorkspaceTextFile({ name: 'photo.jpg', type: 'file' }), false);
  assert.equal(isWorkspaceTextFile({ name: 'archive.zip', type: 'file' }), false);
  assert.equal(isWorkspaceTextFile({ name: 'linked', type: 'symlink' }), false);
});
