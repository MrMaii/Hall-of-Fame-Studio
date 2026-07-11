import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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

const projectId = 'local_temporary_tool_grant_project';

function createSeed() {
  const seed = createKickoffProjectFromMeeting({
    projectId,
    name: 'Local temporary tool grant governance',
    brief: 'Grant one Agent bounded access to one local Provider tool.',
    now: '2026-07-10T10:00:00.000Z',
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
  return {
    ...seed,
    project: {
      ...seed.project,
      projectSettings: {
        schemaVersion: 'project-settings/v1',
        projectId,
        toolGrantPolicy: {
          schemaVersion: 'project-tool-grant-policy/v1',
          defaultToolGrants: ['provider:test'],
          agentToolGrants: {},
          enforcementMode: 'enforced',
          readyForProduction: false,
        },
      },
    },
  };
}

function createRuntime({ directory, seed = false, searchProvider = null } = {}) {
  const kickoff = seed ? createSeed() : null;
  const store = createAgentProjectFileStore({
    filePath: join(directory, 'projects.json'),
    ...(kickoff ? {
      projects: [kickoff.project],
      messages: kickoff.messages,
      replaceWithSeed: true,
    } : {}),
    hydrateProject: hydrateAgentProject,
  });
  const service = createAgentProjectService({
    store,
    providerPolicy: {
      enabled: true,
      mode: 'enforced',
      allowedSearchProviders: ['local-tool-search'],
      defaultToolGrants: ['search:evidence'],
      maxRequestsPerProjectHour: 100,
      dailyBudgetCents: 10_000,
      searchCostCentsPerRequest: 1,
      retryAttempts: 0,
    },
    ...(searchProvider ? { searchProvider } : {}),
  });
  return { store, service, api: createAgentProjectApi({ service }) };
}

test('creates, reads, validates, and persists one bounded local tool grant lease', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-tool-grant-'));
  try {
    let runtime = createRuntime({ directory, seed: true });
    const taskId = runtime.store.getProject(projectId).tasks[0].id;
    const response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/tool-grant-leases`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
      body: {
        projectId: 'body-must-not-override-route',
        operation: 'search:evidence',
        agentId: 'leader',
        taskId,
        maxInvocations: 2,
        grantedBy: 'local-owner',
        purpose: 'Collect the evidence packet.',
        ttlMs: 60 * 60 * 1000,
        now: '2026-07-10T10:05:00.000Z',
      },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.toolGrantLease.schemaVersion, 'local-tool-grant-lease/v1');
    assert.equal(response.body.toolGrantLease.projectId, projectId);
    assert.equal(response.body.toolGrantLease.operation, 'search:evidence');
    assert.equal(response.body.toolGrantLease.agentId, 'leader');
    assert.equal(response.body.toolGrantLease.taskId, taskId);
    assert.equal(response.body.toolGrantLease.maxInvocations, 2);
    assert.equal(response.body.toolGrantLease.remainingInvocationCount, 2);
    assert.equal(response.body.toolGrantLease.status, 'active');
    assert.ok(response.body.toolGrantLease.checksum);

    const invalidBodies = [
      { operation: 'search:evidence', grantedBy: 'local-owner', maxInvocations: 1 },
      { operation: 'search:evidence', agentId: 'leader', grantedBy: 'local-owner', maxInvocations: 0 },
      { operation: 'search:evidence', agentId: 'leader', grantedBy: 'local-owner', maxInvocations: 1, ttlMs: 25 * 60 * 60 * 1000 },
    ];
    for (const body of invalidBodies) {
      const invalid = await runtime.api.handleAsync({
        method: 'POST',
        path: `/projects/${projectId}/tool-grant-leases`,
        body: { ...body, purpose: 'Bounded test grant.', now: '2026-07-10T10:06:00.000Z' },
      });
      assert.equal(invalid.status, 400);
    }

    runtime = createRuntime({ directory });
    const read = await runtime.api.handleAsync({
      method: 'GET',
      path: `/projects/${projectId}/tool-grant-leases`,
      body: { now: '2026-07-10T10:07:00.000Z' },
    });
    assert.equal(read.status, 200);
    assert.equal(read.body.toolGrantGovernance.schemaVersion, 'local-tool-grant-governance/v1');
    assert.equal(read.body.toolGrantGovernance.summary.activeLeaseCount, 1);
    assert.equal(read.body.toolGrantGovernance.leases[0].projectId, projectId);
    assert.equal(read.body.toolGrantGovernance.routes.leases, `/projects/${projectId}/tool-grant-leases`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('authorizes only matching temporary tool attempts and consumes the lease atomically', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-tool-grant-dispatch-'));
  let transportCalls = 0;
  const searchProvider = {
    status: () => ({
      provider: 'local-tool-search',
      enabled: true,
      configured: true,
      runtimeEnabled: true,
      apiKeySource: 'not-required',
      hasEndpoint: true,
    }),
    search: async () => {
      transportCalls += 1;
      return {
        ok: true,
        provider: 'local-tool-search',
        searchMode: 'local-test',
        sources: [],
        findings: ['Temporary tool grant evidence.'],
        confidence: 'high',
      };
    },
  };
  try {
    const runtime = createRuntime({ directory, seed: true, searchProvider });
    const [task, otherTask] = runtime.store.getProject(projectId).tasks;
    assert.ok(task?.id && otherTask?.id);

    await assert.rejects(runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      taskId: task.id,
      query: 'denied-before-temporary-grant',
      operation: 'search:evidence',
      now: '2026-07-10T11:00:00.000Z',
    }), /provider-policy-denied:agent-tool-grant-missing/);
    assert.equal(transportCalls, 0);

    const created = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/tool-grant-leases`,
      body: {
        operation: 'search:evidence',
        agentId: 'leader',
        taskId: task.id,
        maxInvocations: 2,
        grantedBy: 'local-owner',
        purpose: 'Collect two bounded evidence packets.',
        ttlMs: 60 * 60 * 1000,
        now: '2026-07-10T11:01:00.000Z',
      },
    });
    assert.equal(created.status, 201);

    const mismatches = [
      { agentId: 'reviewer', taskId: task.id, operation: 'search:evidence' },
      { agentId: 'leader', taskId: otherTask.id, operation: 'search:evidence' },
      { agentId: 'leader', taskId: task.id, operation: 'model:artifact-draft' },
    ];
    for (const [index, mismatch] of mismatches.entries()) {
      await assert.rejects(runtime.service.recordAgentEvidenceSearchWithProvider({
        projectId,
        ...mismatch,
        query: `denied-mismatched-scope-${index}`,
        now: `2026-07-10T11:0${index + 2}:00.000Z`,
      }), /provider-policy-denied:agent-tool-grant-missing/);
    }
    assert.equal(transportCalls, 0);

    for (const [index, now] of ['2026-07-10T11:05:00.000Z', '2026-07-10T11:06:00.000Z'].entries()) {
      await runtime.service.recordAgentEvidenceSearchWithProvider({
        projectId,
        agentId: 'leader',
        taskId: task.id,
        query: `temporary-grant-call-${index + 1}`,
        operation: 'search:evidence',
        now,
      });
    }
    assert.equal(transportCalls, 2);
    await assert.rejects(runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      taskId: task.id,
      query: 'denied-after-temporary-grant-exhaustion',
      operation: 'search:evidence',
      now: '2026-07-10T11:07:00.000Z',
    }), /provider-policy-denied:agent-tool-grant-missing/);
    assert.equal(transportCalls, 2);

    const governance = runtime.service.getToolGrantLeases(projectId, { now: '2026-07-10T11:07:00.000Z' });
    assert.equal(governance.summary.exhaustedLeaseCount, 1);
    assert.equal(governance.leases[0].consumedInvocationCount, 2);
    assert.equal(governance.leases[0].reservedInvocationCount, 0);
    assert.equal(governance.leases[0].remainingInvocationCount, 0);
    assert.equal(governance.invocationReceipts.length, 7);
    assert.equal(governance.receiptIntegrity.status, 'verified');
    assert.equal(governance.receiptIntegrity.valid, true);
    assert.equal(governance.receiptIntegrity.checksumFailureCount, 0);
    assert.equal(governance.receiptIntegrity.chainFailureCount, 0);
    const leaseReceipts = governance.invocationReceipts.filter((receipt) => receipt.authorizationSource === 'temporary-lease');
    assert.equal(leaseReceipts.length, 2);
    assert.ok(leaseReceipts.every((receipt) => receipt.toolGrantLeaseId === created.body.toolGrantLease.id));
    assert.ok(leaseReceipts.every((receipt) => receipt.toolGrantLeaseChecksum));
    assert.ok(governance.invocationReceipts.every((receipt) => receipt.schemaVersion === 'local-tool-invocation-receipt/v1'));
    assert.ok(governance.invocationReceipts.every((receipt) => receipt.providerUsageId && receipt.checksum));
    const serializedReceipts = JSON.stringify(governance.invocationReceipts);
    assert.doesNotMatch(serializedReceipts, /temporary-grant-call|denied-mismatched-scope|denied-before-temporary-grant/);

    const restarted = createRuntime({ directory, searchProvider });
    const restartedGovernance = restarted.service.getToolGrantLeases(projectId, { now: '2026-07-10T11:08:00.000Z' });
    assert.equal(restartedGovernance.summary.exhaustedLeaseCount, 1);
    assert.equal(restartedGovernance.invocationReceipts.length, 7);
    assert.equal(restartedGovernance.receiptIntegrity.valid, true);
    const mutation = await restarted.api.handleAsync({
      method: 'DELETE',
      path: `/projects/${projectId}/tool-grant-leases/${restartedGovernance.invocationReceipts[0].id}`,
    });
    assert.equal(mutation.status, 405);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('releases a crashed temporary grant reservation after its local Provider reservation expires', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-tool-grant-recovery-'));
  let transportCalls = 0;
  const searchProvider = {
    status: () => ({ provider: 'local-tool-search', enabled: true, configured: true, runtimeEnabled: true }),
    search: async () => {
      transportCalls += 1;
      return { ok: true, provider: 'local-tool-search', sources: [], findings: ['Recovered grant.'] };
    },
  };
  try {
    let runtime = createRuntime({ directory, seed: true, searchProvider });
    const taskId = runtime.store.getProject(projectId).tasks[0].id;
    const created = runtime.service.createToolGrantLease({
      projectId,
      operation: 'search:evidence',
      agentId: 'leader',
      taskId,
      maxInvocations: 1,
      grantedBy: 'local-owner',
      purpose: 'Recover one interrupted authorization reservation.',
      ttlMs: 60 * 60 * 1000,
      now: '2026-07-10T12:00:00.000Z',
    });
    const raw = runtime.store.getProject(projectId);
    runtime.store.saveProject({
      ...raw,
      toolGrantLeases: raw.toolGrantLeases.map((lease) => lease.id === created.toolGrantLease.id
        ? { ...lease, reservedInvocationCount: 1 }
        : lease),
      providerBudgetReservations: [{
        schemaVersion: 'local-provider-budget-reservation/v1',
        id: 'crashed_provider_reservation',
        projectId,
        agentId: 'leader',
        taskId,
        kind: 'search',
        operation: 'search:evidence',
        status: 'active',
        toolGrantLeaseId: created.toolGrantLease.id,
        toolGrantReservedInvocationCount: 1,
        createdAt: '2026-07-10T12:00:00.000Z',
        expiresAt: '2026-07-10T12:01:00.000Z',
      }],
    });

    runtime = createRuntime({ directory, searchProvider });
    const recovered = runtime.service.getToolGrantLeases(projectId, { now: '2026-07-10T12:02:00.000Z' });
    assert.equal(recovered.leases[0].status, 'active');
    assert.equal(recovered.leases[0].reservedInvocationCount, 0);
    assert.equal(recovered.leases[0].remainingInvocationCount, 1);
    await runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      taskId,
      operation: 'search:evidence',
      query: 'recovered-after-crash',
      now: '2026-07-10T12:02:30.000Z',
    });
    assert.equal(transportCalls, 1);
    assert.equal(runtime.service.getToolGrantLeases(projectId, { now: '2026-07-10T12:03:00.000Z' }).leases[0].status, 'exhausted');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps expired and revoked grants denied across restart and detects receipt tampering', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-tool-grant-terminal-'));
  let transportCalls = 0;
  const searchProvider = {
    status: () => ({ provider: 'local-tool-search', enabled: true, configured: true, runtimeEnabled: true }),
    search: async () => {
      transportCalls += 1;
      return { ok: true, provider: 'local-tool-search', sources: [], findings: [] };
    },
  };
  try {
    let runtime = createRuntime({ directory, seed: true, searchProvider });
    const taskId = runtime.store.getProject(projectId).tasks[0].id;
    const expiring = runtime.service.createToolGrantLease({
      projectId,
      operation: 'search:evidence',
      agentId: 'leader',
      taskId,
      maxInvocations: 1,
      grantedBy: 'local-owner',
      purpose: 'One short-lived evidence authorization.',
      ttlMs: 60_000,
      now: '2026-07-10T13:00:00.000Z',
    });
    runtime = createRuntime({ directory, searchProvider });
    await assert.rejects(runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      taskId,
      operation: 'search:evidence',
      query: 'denied-expired-grant',
      now: '2026-07-10T13:02:00.000Z',
    }), /provider-policy-denied:agent-tool-grant-missing/);
    assert.equal(runtime.service.getToolGrantLeases(projectId, { now: '2026-07-10T13:02:00.000Z' })
      .leases.find((lease) => lease.id === expiring.toolGrantLease.id).status, 'expired');

    const revocable = runtime.service.createToolGrantLease({
      projectId,
      operation: 'search:evidence',
      agentId: 'leader',
      taskId,
      maxInvocations: 1,
      grantedBy: 'local-owner',
      purpose: 'Authorization that will be revoked.',
      ttlMs: 60 * 60 * 1000,
      now: '2026-07-10T13:03:00.000Z',
    });
    runtime.service.revokeToolGrantLease({
      projectId,
      leaseId: revocable.toolGrantLease.id,
      revokedBy: 'local-owner',
      reason: 'The task was cancelled.',
      now: '2026-07-10T13:04:00.000Z',
    });
    runtime = createRuntime({ directory, searchProvider });
    await assert.rejects(runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      taskId,
      operation: 'search:evidence',
      query: 'denied-revoked-grant',
      now: '2026-07-10T13:05:00.000Z',
    }), /provider-policy-denied:agent-tool-grant-missing/);
    assert.equal(transportCalls, 0);
    let governance = runtime.service.getToolGrantLeases(projectId, { now: '2026-07-10T13:05:00.000Z' });
    assert.equal(governance.summary.expiredLeaseCount, 1);
    assert.equal(governance.summary.revokedLeaseCount, 1);
    assert.equal(governance.receiptIntegrity.valid, true);

    const raw = runtime.store.getProject(projectId);
    runtime.store.saveProject({
      ...raw,
      toolInvocationReceipts: raw.toolInvocationReceipts.map((receipt, index) => index === 0
        ? { ...receipt, status: 'tampered' }
        : receipt),
    });
    governance = runtime.service.getToolGrantLeases(projectId, { now: '2026-07-10T13:05:00.000Z' });
    assert.equal(governance.receiptIntegrity.status, 'degraded');
    assert.equal(governance.receiptIntegrity.valid, false);
    assert.equal(governance.receiptIntegrity.checksumFailureCount, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
