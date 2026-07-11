import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

const projectId = 'local_privacy_export_project';
const exportedAt = '2026-07-10T12:00:00.000Z';

function createSeed() {
  return createKickoffProjectFromMeeting({
    projectId,
    name: 'Local privacy export project',
    brief: 'Export local project data without a cloud service.',
    now: '2026-07-10T11:00:00.000Z',
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
}

test('writes an approved redacted privacy export under the local project runtime', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-privacy-export-'));
  try {
    const seed = createSeed();
    const store = createAgentProjectFileStore({
      filePath: join(directory, 'projects.json'),
      projects: [{ ...seed.project, providerSecret: 'local-export-must-not-leak' }],
      messages: [...seed.messages, {
        id: 'privacy_export_message',
        projectId,
        channelId: 'main',
        text: 'A locally owned project message.',
        time: exportedAt,
      }],
      hydrateProject: hydrateAgentProject,
      replaceWithSeed: true,
    });
    const service = createAgentProjectService({
      store,
      projectRuntime: createLocalProjectRuntime({ rootPath: join(directory, 'runtime') }),
    });

    const result = service.exportProjectPrivacyData({
      projectId,
      actor: 'Local owner',
      reason: 'personal data request',
      approval: { approvedBy: 'Local owner' },
      now: exportedAt,
    });
    const rawPayload = readFileSync(result.privacyExport.exportPath, 'utf8');
    const payload = JSON.parse(rawPayload);

    assert.equal(result.route, 'project-privacy-exported');
    assert.equal(existsSync(result.privacyExport.exportPath), true);
    assert.equal(payload.privacyExport.schemaVersion, 'local-project-privacy-export/v1');
    assert.equal(payload.project.id, projectId);
    assert.equal(payload.messages.some((message) => message.id === 'privacy_export_message'), true);
    assert.equal(payload.privacyExport.approval.approvedBy, 'Local owner');
    assert.equal(result.project.privacyExports[0].checksum, result.privacyExport.checksum);
    assert.doesNotMatch(rawPayload, /local-export-must-not-leak/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requires approval before exposing a local privacy export through the API', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-privacy-export-api-'));
  try {
    const seed = createSeed();
    const store = createAgentProjectFileStore({
      filePath: join(directory, 'projects.json'),
      projects: [seed.project],
      messages: seed.messages,
      hydrateProject: hydrateAgentProject,
      replaceWithSeed: true,
    });
    const api = createAgentProjectApi({
      service: createAgentProjectService({
        store,
        projectRuntime: createLocalProjectRuntime({ rootPath: join(directory, 'runtime') }),
      }),
    });
    const path = `/projects/${projectId}/privacy/export`;

    const denied = api.handle({ method: 'POST', path, body: { now: exportedAt } });
    assert.notEqual(denied.status, 200);
    const approved = api.handle({
      method: 'POST',
      path,
      body: {
        actor: 'Local owner',
        reason: 'personal data request',
        approval: { approvedBy: 'Local owner' },
        now: exportedAt,
      },
    });

    assert.equal(approved.status, 200);
    assert.equal(existsSync(approved.body.privacyExport.exportPath), true);
    assert.equal(approved.body.privacyExport.approval.approvedBy, 'Local owner');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
