import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

test('meeting writes can return a compact acknowledgement instead of the full project snapshot', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-meeting-compact-'));
  try {
    const api = createFileBackedAgentProjectApi({ filePath: join(directory, 'projects.json') });
    const initiated = api.handle({
      method: 'POST',
      path: '/projects/initiate',
      body: {
        includeReadModels: false,
        projectId: 'compact-meeting-project',
        name: 'Compact Meeting Project',
        brief: 'Keep meeting latency independent of project history size.',
        team: [{ id: 'leader', name: 'Leader', title: 'Leader' }],
        selectedLeaderId: 'leader',
      },
    });
    assert.equal(initiated.status, 200);

    const response = api.handle({
      method: 'POST',
      path: '/projects/compact-meeting-project/meeting',
      body: {
        includeReadModels: false,
        compactResult: true,
        text: 'Please confirm the next task.',
        messageId: 'compact-message-1',
        now: '2026-07-12T00:10:00.000Z',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.project, undefined);
    assert.deepEqual(response.body.projectRef, { id: 'compact-meeting-project' });
    assert.equal(response.body.messages.length > 0, true);
    assert.equal(Buffer.byteLength(JSON.stringify(response.body), 'utf8') < 100_000, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
