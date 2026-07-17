import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

test('quarantines one project that cannot be hydrated while keeping other projects available', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-project-store-project-quarantine-'));
  const filePath = join(directory, 'projects.json');
  try {
    writeFileSync(filePath, JSON.stringify({
      version: 2,
      projects: [
        { id: 'healthy-project', name: 'Healthy project' },
        { id: 'damaged-project', name: 'Damaged project' },
      ],
      messages: [],
      kickoffMeetings: [],
      securityAccessAuditRecords: [],
      accessReplayRecords: [],
    }, null, 2));

    const store = createAgentProjectFileStore({
      filePath,
      hydrateProject: (project) => {
        if (project.id === 'damaged-project') throw new Error('invalid-project-shape');
        return { ...project, runtimeState: { status: 'idle' } };
      },
    });

    assert.deepEqual(store.listProjects().map((project) => project.id), ['healthy-project']);
    assert.equal(store.getProject('healthy-project').runtimeState.status, 'idle');
    assert.equal(store.integrity.projectQuarantine.projectCount, 1);
    assert.deepEqual(store.integrity.projectQuarantine.projectIds, ['damaged-project']);
    assert.equal(existsSync(store.integrity.projectQuarantine.path), true);
    const quarantine = JSON.parse(readFileSync(store.integrity.projectQuarantine.path, 'utf8'));
    assert.equal(quarantine.schemaVersion, 'agent-project-store-project-quarantine/v1');
    assert.equal(quarantine.projects[0].project.id, 'damaged-project');
    assert.equal(quarantine.projects[0].error, 'invalid-project-shape');
    assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')).projects.map((project) => project.id), ['healthy-project']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
