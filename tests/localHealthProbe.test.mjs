import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';

test('exposes a public redacted local health probe before login', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-health-'));
  const runtime = createAgentProjectHttpServer({
    filePath: join(directory, 'projects.json'),
    localAuthFilePath: join(directory, 'auth.json'),
    localAuthRequired: true,
  });
  const listener = await runtime.listen();
  try {
    const response = await fetch(`${listener.url}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      schemaVersion: 'local-health/v1',
      status: 'ok',
      localOnly: true,
      lifecycle: 'accepting',
    });
  } finally {
    await runtime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
