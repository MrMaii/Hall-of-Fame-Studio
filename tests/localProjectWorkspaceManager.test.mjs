import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

function withWorkspace(run) {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-workspace-manager-'));
  const workspacePath = join(directory, 'workspace');
  const outsidePath = join(directory, 'outside');
  mkdirSync(workspacePath, { recursive: true });
  mkdirSync(outsidePath, { recursive: true });
  const runtime = createLocalProjectRuntime({ rootPath: join(directory, 'runtime') });
  const project = runtime.bindWorkspace({ id: 'workspace-project' }, workspacePath);
  try {
    run({ directory, outsidePath, project, runtime, workspacePath });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('lists directories before files using natural name order', () => withWorkspace(({ project, runtime, workspacePath }) => {
  mkdirSync(join(workspacePath, 'folder-10'));
  mkdirSync(join(workspacePath, 'folder-2'));
  writeFileSync(join(workspacePath, 'file-10.md'), 'ten');
  writeFileSync(join(workspacePath, 'file-2.md'), 'two');

  const result = runtime.listWorkspace(project, { path: '.', recursive: false });

  assert.deepEqual(result.files.map(entry => entry.name), ['folder-2', 'folder-10', 'file-2.md', 'file-10.md']);
}));

test('creates directories and moves entries without overwriting', () => withWorkspace(({ project, runtime, workspacePath }) => {
  const created = runtime.createWorkspaceDirectory(project, { path: 'docs' });
  assert.equal(created.directory.path, 'docs');

  writeFileSync(join(workspacePath, 'draft.md'), 'draft');
  const moved = runtime.moveWorkspacePath(project, { fromPath: 'draft.md', toPath: 'docs/brief.md' });
  assert.equal(moved.entry.path, 'docs/brief.md');
  assert.equal(readFileSync(join(workspacePath, 'docs', 'brief.md'), 'utf8'), 'draft');

  writeFileSync(join(workspacePath, 'occupied.md'), 'occupied');
  assert.throws(
    () => runtime.moveWorkspacePath(project, { fromPath: 'docs/brief.md', toPath: 'occupied.md' }),
    /workspace-destination-exists/,
  );
}));

test('rejects root mutations, traversal, absolute child paths, and symbolic-link escapes', () => withWorkspace(({ outsidePath, project, runtime, workspacePath }) => {
  writeFileSync(join(outsidePath, 'sentinel.txt'), 'outside');
  symlinkSync(outsidePath, join(workspacePath, 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir');

  assert.throws(() => runtime.deleteWorkspacePath(project, { path: '.', recursive: true }), /non-root/);
  assert.throws(() => runtime.moveWorkspacePath(project, { fromPath: '.', toPath: 'renamed' }), /non-root/);
  assert.throws(() => runtime.readWorkspaceFile(project, { path: '../outside/sentinel.txt' }), /escapes|outside/i);
  assert.throws(() => runtime.readWorkspaceFile(project, { path: resolve(outsidePath, 'sentinel.txt') }), /absolute|escapes/i);
  assert.throws(() => runtime.readWorkspaceFile(project, { path: 'outside-link/sentinel.txt' }), /symbolic-link/);
  assert.throws(() => runtime.writeWorkspaceFile(project, { path: 'outside-link/new.txt', content: 'blocked' }), /symbolic-link/);
  assert.equal(readFileSync(join(outsidePath, 'sentinel.txt'), 'utf8'), 'outside');
}));

test('detects stale saves and preserves the newer Agent-authored content', () => withWorkspace(({ project, runtime, workspacePath }) => {
  writeFileSync(join(workspacePath, 'brief.md'), 'version one');
  const opened = runtime.readWorkspaceFile(project, { path: 'brief.md' });
  runtime.writeWorkspaceFile(project, { path: 'brief.md', content: 'Agent version' });

  assert.throws(
    () => runtime.writeWorkspaceFile(project, {
      path: 'brief.md',
      content: 'stale Dashboard version',
      expectedUpdatedAt: opened.file.updatedAt,
    }),
    /workspace-file-conflict/,
  );
  assert.equal(readFileSync(join(workspacePath, 'brief.md'), 'utf8'), 'Agent version');
}));
