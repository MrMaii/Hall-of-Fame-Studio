import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';

test('local store remains usable with 100 projects, 5000 tasks and 10000 messages across restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-scale-'));
  const filePath = join(directory, 'projects.json');
  try {
    const projects = Array.from({ length: 100 }, (_, projectIndex) => ({
      id: `scale_project_${projectIndex}`,
      name: `Scale project ${projectIndex}`,
      status: 'executing',
      tasks: Array.from({ length: 50 }, (_, taskIndex) => ({
        id: `task_${projectIndex}_${taskIndex}`,
        title: `Task ${taskIndex}`,
        status: taskIndex % 3 === 0 ? 'done' : 'open',
      })),
      team: [{ id: 'leader', name: 'Local Leader', role: 'Leader' }],
    }));
    const messages = Array.from({ length: 10_000 }, (_, index) => ({
      id: `scale_message_${index}`,
      projectId: `scale_project_${index % 100}`,
      channelId: 'main',
      author: index % 2 ? 'Local Leader' : 'Director',
      text: `Local scale message ${index}`,
      time: new Date(1_750_000_000_000 + index * 1_000).toISOString(),
    }));

    const startedAt = performance.now();
    const first = createAgentProjectFileStore({ filePath, projects, messages, messageLimit: 20_000, replaceWithSeed: true });
    const firstWriteMs = performance.now() - startedAt;
    assert.equal(first.listProjects().length, 100);
    assert.equal(first.snapshot().messages.length, 10_000);

    const restartStartedAt = performance.now();
    const restarted = createAgentProjectFileStore({ filePath, messageLimit: 20_000 });
    const restartMs = performance.now() - restartStartedAt;
    assert.equal(restarted.listProjects().length, 100);
    assert.equal(restarted.snapshot().messages.length, 10_000);
    assert.equal(restarted.listProjects().reduce((sum, project) => sum + project.tasks.length, 0), 5_000);
    assert.ok(firstWriteMs < 5_000, `Initial scale write took ${firstWriteMs.toFixed(0)}ms`);
    assert.ok(restartMs < 5_000, `Scale restart took ${restartMs.toFixed(0)}ms`);
    assert.ok(statSync(filePath).size < 25 * 1024 * 1024, 'Scale fixture unexpectedly exceeded 25 MiB.');
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
