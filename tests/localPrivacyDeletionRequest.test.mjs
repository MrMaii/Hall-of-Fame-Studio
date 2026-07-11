import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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

const projectId = 'local_privacy_deletion_project';
const requestedAt = '2026-07-10T13:00:00.000Z';

function createSeed() {
  return createKickoffProjectFromMeeting({
    projectId,
    name: 'Local privacy deletion project',
    brief: 'Require a durable second confirmation before deleting a local project.',
    now: requestedAt,
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
}

test('persists only a hashed local privacy deletion confirmation across restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-privacy-delete-'));
  const filePath = join(directory, 'projects.json');
  try {
    const seed = createSeed();
    const store = createAgentProjectFileStore({
      filePath,
      projects: [seed.project],
      messages: seed.messages,
      hydrateProject: hydrateAgentProject,
      replaceWithSeed: true,
    });
    const service = createAgentProjectService({ store });
    const request = service.requestProjectPrivacyDeletion({
      projectId,
      actor: 'Local owner',
      reason: 'remove inactive project',
      now: requestedAt,
    });

    assert.equal(request.privacyDeletionRequest.status, 'pending-confirmation');
    assert.equal(JSON.stringify(store.snapshot()).includes(request.confirmationToken), false);
    assert.ok(request.privacyDeletionRequest.confirmationTokenHash);

    const restartedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const restarted = createAgentProjectService({ store: restartedStore });
    assert.throws(() => restarted.confirmProjectPrivacyDeletion({
      projectId,
      requestId: request.privacyDeletionRequest.id,
      confirmationToken: 'wrong-token',
      actor: 'Local owner',
      now: '2026-07-10T13:01:00.000Z',
    }), /privacy-deletion-confirmation-invalid/);

    const confirmed = restarted.confirmProjectPrivacyDeletion({
      projectId,
      requestId: request.privacyDeletionRequest.id,
      confirmationToken: request.confirmationToken,
      actor: 'Local owner',
      now: '2026-07-10T13:01:00.000Z',
    });
    assert.equal(confirmed.privacyDeletionRequest.status, 'confirmed');
    assert.equal(confirmed.privacyDeletionRequest.confirmedBy, 'Local owner');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('exposes a one-time local privacy deletion confirmation through the API', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-privacy-delete-api-'));
  try {
    const seed = createSeed();
    const store = createAgentProjectFileStore({
      filePath: join(directory, 'projects.json'),
      projects: [seed.project],
      messages: seed.messages,
      hydrateProject: hydrateAgentProject,
      replaceWithSeed: true,
    });
    const api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    const requestResponse = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/privacy/deletion-requests`,
      body: { actor: 'Local owner', reason: 'remove inactive project', now: requestedAt },
    });
    assert.equal(requestResponse.status, 200);
    assert.ok(requestResponse.body.confirmationToken);
    assert.equal(JSON.stringify(requestResponse.body.project).includes(requestResponse.body.confirmationToken), false);

    const confirmResponse = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/privacy/deletion-requests/${requestResponse.body.privacyDeletionRequest.id}/confirm`,
      body: {
        actor: 'Local owner',
        confirmationToken: requestResponse.body.confirmationToken,
        now: '2026-07-10T13:01:00.000Z',
      },
    });
    assert.equal(confirmResponse.status, 200);
    assert.equal(confirmResponse.body.privacyDeletionRequest.status, 'confirmed');
    assert.equal(Object.hasOwn(confirmResponse.body, 'confirmationToken'), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('reports pending and expired local deletion requests without auto-purging data', () => {
  const seed = createSeed();
  const service = createAgentProjectService({ projects: [seed.project], messages: seed.messages });
  service.requestProjectPrivacyDeletion({
    projectId,
    actor: 'Local owner',
    now: requestedAt,
    expiresInMs: 60_000,
  });

  const preview = service.getProjectPrivacyRetentionPreview(projectId, {
    now: '2026-07-10T13:02:00.000Z',
  });

  assert.equal(preview.status, 'privacy-deletion-action-required');
  assert.equal(preview.summary.expiredRequestCount, 1);
  assert.equal(preview.rows[0].status, 'expired');
  assert.equal(preview.rows[0].automaticPurgeAllowed, false);
});
