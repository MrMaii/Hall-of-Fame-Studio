import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

test('project catalog returns compact navigation rows instead of full project ledgers', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hof-project-catalog-'));
  try {
    const api = createFileBackedAgentProjectApi({
      filePath: join(directory, 'store.json'),
      replaceWithSeed: true,
      projectRuntime: createLocalProjectRuntime({ rootPath: join(directory, 'runtime') }),
    });
    const initiated = api.handle({
      method: 'POST',
      path: '/projects/initiate',
      body: {
        includeReadModels: false,
        projectId: 'catalog-project',
        name: 'Catalog project',
        team: [{ id: 'leader', name: 'Leader', role: 'Leader' }],
        selectedLeaderId: 'leader',
        tasks: [{ id: 'task', text: 'Produce a formal result', assignee: 'leader' }],
        now: '2026-07-20T10:00:00.000Z',
      },
    });
    assert.equal(initiated.status, 200);

    const response = api.handle({ method: 'GET', path: '/projects' });
    assert.equal(response.status, 200);
    assert.equal(response.body.projects.length, 1);
    assert.deepEqual(Object.keys(response.body.projects[0]).sort(), [
      'createdAt',
      'id',
      'language',
      'name',
      'progress',
      'status',
      'updatedAt',
    ]);
    assert.equal(response.body.projects[0].id, 'catalog-project');
    assert.equal(JSON.stringify(response.body).includes('eventLedger'), false);
    assert.equal(JSON.stringify(response.body).includes('agentWorkerLedger'), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
