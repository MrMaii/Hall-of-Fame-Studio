import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';

const projectId = 'local_service_identity_project';
const storeFile = 'projects.json';

function createSeed() {
  return createKickoffProjectFromMeeting({
    projectId,
    name: 'Local service identity',
    brief: 'Give a local project worker a bounded and rotatable machine identity.',
    now: '2026-07-10T22:00:00.000Z',
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
}

function createRuntime(directory, { seed = false } = {}) {
  const kickoff = seed ? createSeed() : null;
  const store = createAgentProjectFileStore({
    filePath: join(directory, storeFile),
    ...(kickoff ? {
      projects: [kickoff.project],
      messages: kickoff.messages,
      replaceWithSeed: true,
    } : {}),
    hydrateProject: hydrateAgentProject,
  });
  const service = createAgentProjectService({ store });
  return {
    store,
    service,
    adminApi: createAgentProjectApi({ service }),
    serviceApi: createAgentProjectApi({ service, localAuthRequired: true }),
  };
}

function useToken(api, token, path) {
  return api.handle({
    method: 'GET',
    path,
    headers: { 'x-hofs-session-token': token },
    body: { now: '2026-07-10T22:02:00.000Z' },
  });
}

test('binds a rotatable local service identity to one route audience across restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-service-identity-'));
  try {
    const runtime = createRuntime(directory, { seed: true });
    assert.throws(() => runtime.service.issueIdentitySession({
      projectId,
      identityType: 'service',
      serviceId: 'over-privileged-worker',
      role: 'security-admin',
      audiences: ['worker-queue'],
    }), /Service identity role is not allowed/);
    assert.throws(() => runtime.service.issueIdentitySession({
      projectId,
      identityType: 'service',
      serviceId: 'unbounded-worker',
      role: 'runtime-platform',
    }), /requires at least one audience/);

    const issued = runtime.adminApi.handle({
      method: 'POST',
      path: `/projects/${projectId}/identity-sessions`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
      body: {
        identityType: 'service',
        serviceId: 'project-due-worker',
        role: 'runtime-platform',
        audiences: ['worker-queue'],
        ttlMs: 60 * 60 * 1000,
        includeReadModels: false,
        now: '2026-07-10T22:01:00.000Z',
      },
    });

    assert.equal(issued.status, 200);
    assert.equal(issued.body.identitySession.identityType, 'service');
    assert.equal(issued.body.identitySession.serviceId, 'project-due-worker');
    assert.deepEqual(issued.body.identitySession.audiences, ['worker-queue']);
    assert.equal(issued.body.tokenContract.returnedOnce, true);
    const firstSessionId = issued.body.identitySession.id;
    const firstToken = issued.body.token;
    assert.ok(firstToken);

    const allowed = useToken(
      runtime.serviceApi,
      firstToken,
      `/projects/${projectId}/worker-queue`,
    );
    assert.equal(allowed.status, 200);
    const audit = runtime.adminApi.handle({
      method: 'GET',
      path: `/projects/${projectId}/security-access-audit`,
    });
    const serviceAccess = audit.body.securityAccessAudit.rows.find((row) => (
      row.identitySession?.sessionId === firstSessionId
    ));
    assert.equal(serviceAccess.identitySession.identityType, 'service');
    assert.equal(serviceAccess.identitySession.serviceId, 'project-due-worker');
    assert.equal(serviceAccess.identitySession.verifiedAudience, 'worker-queue');

    const wrongAudience = useToken(
      runtime.serviceApi,
      firstToken,
      `/projects/${projectId}/provider-readiness`,
    );
    assert.equal(wrongAudience.status, 403);
    assert.equal(wrongAudience.body.error, 'identity-session-invalid');
    assert.equal(wrongAudience.body.identitySessionVerification.reason, 'identity-session-audience-mismatch');

    const rotated = runtime.adminApi.handle({
      method: 'POST',
      path: `/projects/${projectId}/identity-sessions/${encodeURIComponent(firstSessionId)}/rotate`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
      body: {
        rotatedBy: 'local-owner',
        includeReadModels: false,
        now: '2026-07-10T22:03:00.000Z',
      },
    });
    assert.equal(rotated.status, 200);
    assert.equal(rotated.body.identitySession.rotatedFromSessionId, firstSessionId);
    assert.equal(rotated.body.rotatedIdentitySession.status, 'revoked');
    assert.equal(rotated.body.rotatedIdentitySession.rotatedToSessionId, rotated.body.identitySession.id);
    assert.ok(rotated.body.token);
    const replacementToken = rotated.body.token;

    const oldDenied = useToken(
      runtime.serviceApi,
      firstToken,
      `/projects/${projectId}/worker-queue`,
    );
    assert.equal(oldDenied.status, 403);
    assert.equal(oldDenied.body.identitySessionVerification.reason, 'identity-session-revoked');
    assert.equal(
      useToken(runtime.serviceApi, replacementToken, `/projects/${projectId}/worker-queue`).status,
      200,
    );

    const serialized = readFileSync(join(directory, storeFile), 'utf8');
    assert.equal(serialized.includes(firstToken), false);
    assert.equal(serialized.includes(replacementToken), false);

    const restarted = createRuntime(directory);
    const oldAfterRestart = useToken(
      restarted.serviceApi,
      firstToken,
      `/projects/${projectId}/worker-queue`,
    );
    assert.equal(oldAfterRestart.status, 403);
    assert.equal(oldAfterRestart.body.identitySessionVerification.reason, 'identity-session-revoked');
    assert.equal(
      useToken(restarted.serviceApi, replacementToken, `/projects/${projectId}/worker-queue`).status,
      200,
    );
    const sessions = restarted.service.getIdentitySessions(projectId);
    assert.equal(sessions.summary.serviceCount, 2);
    assert.equal(sessions.summary.rotatedCount, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
