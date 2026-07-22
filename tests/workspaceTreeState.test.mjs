import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkspaceTreeState, workspaceTreeReducer } from '../src/workspace/workspaceTreeState.js';

const root = { path: '.', name: 'customer-workspace', type: 'directory', size: 0, updatedAt: '2026-07-20T12:00:00.000Z' };
const docs = { path: 'docs', name: 'docs', type: 'directory', size: 0, updatedAt: '2026-07-20T12:01:00.000Z' };
const brief = { path: 'docs/brief.md', name: 'brief.md', type: 'file', size: 12, updatedAt: '2026-07-20T12:02:00.000Z' };

test('initializes an expanded root and loads one directory without touching siblings', () => {
  let state = createWorkspaceTreeState(root);
  assert.deepEqual(state.expandedPaths, ['.']);

  state = workspaceTreeReducer(state, { type: 'directory-loaded', path: '.', entries: [docs] });
  state = workspaceTreeReducer(state, { type: 'directory-loaded', path: 'docs', entries: [brief] });

  assert.deepEqual(state.childPathsByDirectory['.'], ['docs']);
  assert.deepEqual(state.childPathsByDirectory.docs, ['docs/brief.md']);
  assert.equal(state.entriesByPath['docs/brief.md'].name, 'brief.md');
});

test('tracks expansion, selection, dirty edits, save success, and conflicts', () => {
  let state = createWorkspaceTreeState(root);
  state = workspaceTreeReducer(state, { type: 'toggle-directory', path: 'docs' });
  assert.ok(state.expandedPaths.includes('docs'));
  state = workspaceTreeReducer(state, { type: 'select-entry', path: 'docs/brief.md' });
  state = workspaceTreeReducer(state, { type: 'file-opened', file: brief, content: 'initial' });
  state = workspaceTreeReducer(state, { type: 'editor-changed', content: 'edited' });
  assert.equal(state.editor.dirty, true);
  state = workspaceTreeReducer(state, { type: 'save-conflict', currentUpdatedAt: '2026-07-20T12:05:00.000Z' });
  assert.equal(state.editor.conflict.currentUpdatedAt, '2026-07-20T12:05:00.000Z');
  state = workspaceTreeReducer(state, { type: 'save-succeeded', file: { ...brief, updatedAt: '2026-07-20T12:06:00.000Z' } });
  assert.equal(state.editor.dirty, false);
  assert.equal(state.editor.conflict, null);
});

test('rewrites loaded subtree paths after move and removes subtrees after delete', () => {
  let state = createWorkspaceTreeState(root);
  state = workspaceTreeReducer(state, { type: 'directory-loaded', path: '.', entries: [docs] });
  state = workspaceTreeReducer(state, { type: 'directory-loaded', path: 'docs', entries: [brief] });
  state = workspaceTreeReducer(state, { type: 'toggle-directory', path: 'docs' });
  state = workspaceTreeReducer(state, { type: 'select-entry', path: 'docs/brief.md' });

  state = workspaceTreeReducer(state, {
    type: 'entry-moved',
    fromPath: 'docs',
    entry: { ...docs, path: 'archive', name: 'archive' },
  });
  assert.ok(state.entriesByPath.archive);
  assert.ok(state.entriesByPath['archive/brief.md']);
  assert.deepEqual(state.childPathsByDirectory.archive, ['archive/brief.md']);
  assert.equal(state.selectedPath, 'archive/brief.md');

  state = workspaceTreeReducer(state, { type: 'entry-removed', path: 'archive' });
  assert.equal(state.entriesByPath.archive, undefined);
  assert.equal(state.entriesByPath['archive/brief.md'], undefined);
  assert.equal(state.selectedPath, '.');
});

test('keeps the failed directory path so retry targets the operation that failed', () => {
  let state = createWorkspaceTreeState(root);
  state = workspaceTreeReducer(state, { type: 'directory-loading', path: 'docs' });
  state = workspaceTreeReducer(state, { type: 'error', path: 'docs', error: 'read failed' });

  assert.equal(state.error, 'read failed');
  assert.equal(state.errorPath, 'docs');

  state = workspaceTreeReducer(state, { type: 'select-entry', path: '.' });
  assert.equal(state.errorPath, 'docs');

  state = workspaceTreeReducer(state, { type: 'directory-loaded', path: 'docs', entries: [] });
  assert.equal(state.error, null);
  assert.equal(state.errorPath, null);
});
