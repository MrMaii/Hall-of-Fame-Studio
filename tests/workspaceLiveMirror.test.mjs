import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

test('local workspace filesystem changes advance the live mirror without polling', async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'hofs-workspace-live-mirror-'));
  const workspacePath = join(tempRoot, 'Research on Team Strengths');
  mkdirSync(workspacePath, { recursive: true });
  writeFileSync(join(workspacePath, 'README.md'), '# Research\n', 'utf8');
  const runtime = createLocalProjectRuntime({ rootPath: join(tempRoot, 'runtime') });

  try {
    const project = runtime.bindWorkspace({ id: 'project_live_mirror' }, workspacePath);
    const initial = runtime.listWorkspace(project, { path: '.' });
    const nextChange = runtime.waitForWorkspaceChange(project, {
      since: initial.workspaceRevision,
      timeoutMs: 1000,
    });

    renameSync(join(workspacePath, 'README.md'), join(workspacePath, '项目说明.md'));
    const change = await nextChange;
    assert.equal(change.changed, true);
    assert.ok(change.revision > initial.workspaceRevision);
    assert.equal(change.schemaVersion, 'local-workspace-mirror-change/v1');
    assert.ok(runtime.listWorkspace(project, { path: '.' }).files.some(file => file.name === '项目说明.md'));

    const beforeRootMove = runtime.listWorkspace(project, { path: '.' });
    const renamedWorkspacePath = join(tempRoot, 'Research on Team Stress');
    renameSync(workspacePath, renamedWorkspacePath);
    const rootMove = await runtime.waitForWorkspaceChange(project, {
      since: beforeRootMove.workspaceRevision,
      timeoutMs: 1000,
    });
    assert.equal(rootMove.workspacePath, renamedWorkspacePath);
    assert.ok(rootMove.changes.some(item => item.eventType === 'workspace-root-moved'));
  } finally {
    runtime.closeWorkspaceWatchers();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
