import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('../src/agents/agentProjectApi.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/agents/agentProjectService.js', import.meta.url), 'utf8');

test('workspace manager exposes mkdir and move through thin project runtime routes', () => {
  for (const method of ['createWorkspaceDirectory', 'moveWorkspacePath']) {
    assert.ok(serviceSource.includes(`${method}({ projectId, ...input } = {})`));
    assert.ok(serviceSource.includes(`projectRuntime.${method}(store.getProject(projectId), input)`));
    assert.ok(apiSource.includes(`service.${method}({ projectId: route.projectId, ...body })`));
  }
  assert.ok(apiSource.includes("route.tail[0] === 'mkdir'"));
  assert.ok(apiSource.includes("route.tail[0] === 'move'"));
  assert.ok(apiSource.includes("errorMessage.includes('workspace-file-conflict')"));
  assert.ok(apiSource.includes('? 409'));
});
