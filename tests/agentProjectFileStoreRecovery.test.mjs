import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';

test('recovers a corrupt project snapshot from its prior local backup and quarantines the corrupt bytes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-project-store-recovery-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath });
    store.saveProject({ id: 'project_1', name: 'Recover me' });
    store.appendMessages([{ id: 'message_1', projectId: 'project_1', text: 'Creates a prior backup.' }]);
    writeFileSync(filePath, '{not valid json', 'utf8');

    const recovered = createAgentProjectFileStore({ filePath });
    assert.equal(recovered.getProject('project_1').name, 'Recover me');
    assert.equal(recovered.integrity.status, 'recovered-from-backup');
    assert.equal(readFileSync(recovered.integrity.quarantinePath, 'utf8'), '{not valid json');
    assert.equal(readdirSync(directory).some((name) => name.startsWith('projects.json.corrupt-')), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fails closed when both the primary project snapshot and its backup are corrupt', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-project-store-double-corrupt-'));
  const filePath = join(directory, 'projects.json');
  try {
    writeFileSync(filePath, '{bad primary', 'utf8');
    writeFileSync(`${filePath}.bak`, '{bad backup', 'utf8');
    assert.throws(() => createAgentProjectFileStore({ filePath }), /agent-project-store-corrupt-no-backup/);
    assert.equal(readFileSync(filePath, 'utf8'), '{bad primary');
    assert.equal(readFileSync(`${filePath}.bak`, 'utf8'), '{bad backup');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
