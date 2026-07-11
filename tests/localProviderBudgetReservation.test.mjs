import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';

const projectId = 'local_provider_budget_reservation_project';
const now = '2026-07-10T18:00:00.000Z';

function createSeed() {
  return createKickoffProjectFromMeeting({
    projectId,
    name: 'Local provider budget reservation',
    brief: 'Prevent concurrent local provider work from oversubscribing one project.',
    now,
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
}

function providerPolicy() {
  return {
    enabled: true,
    mode: 'enforced',
    allowedSearchProviders: ['local-budget-search'],
    defaultToolGrants: ['search:evidence'],
    maxRequestsPerProjectHour: 1,
    dailyBudgetCents: 100,
    searchCostCentsPerRequest: 1,
    retryAttempts: 0,
    circuitFailureThreshold: 3,
    circuitWindowMinutes: 15,
    circuitCooldownSeconds: 300,
  };
}

function modelProviderPolicy() {
  return {
    ...providerPolicy(),
    allowedSearchProviders: [],
    allowedModelProviders: ['local-budget-model'],
    allowedModels: ['local-budget-model-v1'],
    defaultToolGrants: ['model:artifact-draft'],
    searchCostCentsPerRequest: 0,
    modelCostCentsPer1kTokens: 10,
  };
}

test('reserves project provider capacity before concurrent local search dispatch', async () => {
  let releaseFirst = null;
  let firstStarted = null;
  const started = new Promise((resolve) => { firstStarted = resolve; });
  let transportCalls = 0;
  const seed = createSeed();
  const service = createAgentProjectService({
    projects: [seed.project],
    messages: seed.messages,
    providerPolicy: providerPolicy(),
    searchProvider: {
      status: () => ({
        provider: 'local-budget-search',
        enabled: true,
        configured: true,
        runtimeEnabled: true,
        apiKeySource: 'not-required',
        hasEndpoint: true,
      }),
      search: async () => {
        transportCalls += 1;
        if (transportCalls === 1) {
          firstStarted();
          await new Promise((resolve) => { releaseFirst = resolve; });
        }
        return {
          ok: true,
          provider: 'local-budget-search',
          searchMode: 'local-test',
          sources: [{ title: 'Local source', url: 'file:///local/source' }],
          findings: ['Local evidence found.'],
          confidence: 'high',
        };
      },
    },
  });

  const first = service.recordAgentEvidenceSearchWithProvider({
    projectId,
    agentId: 'leader',
    query: 'first local request',
    purpose: 'Hold the only project provider slot.',
    now,
  });
  await started;

  await assert.rejects(
    service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      query: 'second local request',
      purpose: 'Must not cross the project limit.',
      now,
    }),
    /provider-policy-denied:hourly-rate-limit-exceeded/,
  );
  assert.equal(transportCalls, 1);

  releaseFirst();
  await first;

  const project = service.getProject(projectId);
  assert.equal(project.providerUsageLedger.filter((row) => row.status === 'completed').length, 1);
  assert.equal(project.providerBudgetReservations.filter((row) => row.status === 'settled').length, 1);
  assert.equal(project.providerBudgetReservations.filter((row) => row.status === 'active').length, 0);
});

test('releases a local provider budget reservation after transport failure', async () => {
  const seed = createSeed();
  const service = createAgentProjectService({
    projects: [seed.project],
    messages: seed.messages,
    providerPolicy: providerPolicy(),
    searchProvider: {
      status: () => ({
        provider: 'local-budget-search',
        enabled: true,
        configured: true,
        runtimeEnabled: true,
        apiKeySource: 'not-required',
        hasEndpoint: true,
      }),
      search: async () => ({ ok: false, error: 'local search stopped' }),
    },
  });

  await assert.rejects(
    service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      query: 'failing local request',
      purpose: 'Verify failed work does not leave a live reservation.',
      now,
    }),
    /search-provider-unavailable:local search stopped/,
  );

  const project = service.getProject(projectId);
  assert.equal(project.providerBudgetReservations.filter((row) => row.status === 'released').length, 1);
  assert.equal(project.providerBudgetReservations.filter((row) => row.status === 'active').length, 0);
  assert.equal(project.providerUsageLedger.filter((row) => row.status === 'failed').length, 1);
});

test('reserves project provider capacity before concurrent local model dispatch', async () => {
  let releaseFirst = null;
  let firstStarted = null;
  const started = new Promise((resolve) => { firstStarted = resolve; });
  let transportCalls = 0;
  const seed = createSeed();
  const service = createAgentProjectService({
    projects: [seed.project],
    messages: seed.messages,
    providerPolicy: modelProviderPolicy(),
    llmProvider: {
      status: () => ({
        provider: 'local-budget-model',
        model: 'local-budget-model-v1',
        enabled: true,
        configured: true,
        runtimeEnabled: true,
        apiKeySource: 'not-required',
      }),
      createChatCompletion: async () => {
        transportCalls += 1;
        if (transportCalls === 1) {
          firstStarted();
          await new Promise((resolve) => { releaseFirst = resolve; });
        }
        return {
          ok: true,
          provider: 'local-budget-model',
          model: 'local-budget-model-v1',
          json: {
            title: 'Reserved local model draft',
            summary: 'Only one local model request crossed the project boundary.',
            body: 'The project-level provider reservation prevented concurrent quota oversubscription.',
          },
          usage: { total_tokens: 100 },
        };
      },
    },
  });

  const first = service.generateAgentArtifactDraft({
    projectId,
    agentId: 'leader',
    traceId: 'trace_local_model_budget_001',
    instruction: 'Hold the only local model slot.',
    requireModel: true,
    estimatedCostCents: 1,
    now,
  });
  await started;

  await assert.rejects(
    service.generateAgentArtifactDraft({
      projectId,
      agentId: 'leader',
      instruction: 'Must not cross the local model limit.',
      requireModel: true,
      estimatedCostCents: 1,
      now,
    }),
    /model-provider-denied:hourly-rate-limit-exceeded/,
  );
  assert.equal(transportCalls, 1);

  releaseFirst();
  const result = await first;
  assert.equal(result.providerBudgetReservation.status, 'settled');
  assert.equal(result.providerUsage.traceId, 'trace_local_model_budget_001');
  assert.equal(result.artifactDraft.traceId, 'trace_local_model_budget_001');
  const project = service.getProject(projectId);
  assert.equal(project.providerBudgetReservations.filter((row) => row.status === 'active').length, 0);
  assert.equal(project.providerBudgetReservations.filter((row) => row.status === 'settled').length, 1);
});

test('ignores an expired local provider reservation when evaluating new work', async () => {
  let transportCalls = 0;
  const seed = createSeed();
  const projectWithExpiredReservation = {
    ...seed.project,
    providerBudgetReservations: [{
      schemaVersion: 'local-provider-budget-reservation/v1',
      id: 'expired_local_provider_reservation',
      projectId,
      agentId: 'leader',
      kind: 'search',
      operation: 'search:evidence',
      provider: 'local-budget-search',
      status: 'active',
      estimatedCostCents: 1,
      createdAt: '2026-07-10T17:00:00.000Z',
      expiresAt: '2026-07-10T17:15:00.000Z',
    }],
  };
  const service = createAgentProjectService({
    projects: [projectWithExpiredReservation],
    messages: seed.messages,
    providerPolicy: providerPolicy(),
    searchProvider: {
      status: () => ({
        provider: 'local-budget-search',
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
          provider: 'local-budget-search',
          sources: [],
          findings: [],
          confidence: 'high',
        };
      },
    },
  });

  const result = await service.recordAgentEvidenceSearchWithProvider({
    projectId,
    agentId: 'leader',
    query: 'work after an expired reservation',
    now,
  });

  assert.equal(transportCalls, 1);
  assert.equal(result.providerBudgetReservation.status, 'settled');
  assert.equal(service.getProject(projectId).providerBudgetReservations.some((row) => row.id === 'expired_local_provider_reservation'), true);
});

test('prevents two file-backed service instances from oversubscribing one Provider concurrency slot', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-provider-cross-process-admission-'));
  const filePath = join(directory, 'projects.json');
  let releaseFirst = null;
  let firstStarted = null;
  const started = new Promise((resolve) => { firstStarted = resolve; });
  let firstCalls = 0;
  let secondCalls = 0;
  const policy = {
    enabled: true, mode: 'enforced', allowedSearchProviders: ['local-budget-search'], defaultToolGrants: ['search:evidence'],
    maxConcurrentPerProject: 1, retryAttempts: 0,
  };
  const status = () => ({ provider: 'local-budget-search', enabled: true, configured: true, runtimeEnabled: true, apiKeySource: 'not-required', hasEndpoint: true });
  try {
    const seed = createSeed();
    const seedStore = createAgentProjectFileStore({ filePath, projects: [seed.project], messages: seed.messages, hydrateProject: hydrateAgentProject, replaceWithSeed: true });
    const storeA = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const storeB = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const serviceA = createAgentProjectService({
      store: storeA, providerPolicy: policy,
      searchProvider: { status, search: async () => { firstCalls += 1; firstStarted(); await new Promise((resolve) => { releaseFirst = resolve; }); return { ok: true, provider: 'local-budget-search', sources: [], findings: [], confidence: 'high' }; } },
    });
    const serviceB = createAgentProjectService({
      store: storeB, providerPolicy: policy,
      searchProvider: { status, search: async () => { secondCalls += 1; return { ok: true, provider: 'local-budget-search', sources: [], findings: [], confidence: 'high' }; } },
    });
    const first = serviceA.recordAgentEvidenceSearchWithProvider({ projectId, agentId: 'leader', query: 'first', now });
    await started;
    await assert.rejects(serviceB.recordAgentEvidenceSearchWithProvider({ projectId, agentId: 'leader', query: 'second', now }), /provider-policy-denied:local-rate-limit-project-concurrent-exceeded/);
    assert.equal(firstCalls, 1);
    assert.equal(secondCalls, 0);
    releaseFirst();
    await first;
    const governance = serviceA.getLocalRateLimitGovernance(projectId, { now: '2026-07-10T18:01:00.000Z' });
    assert.equal(governance.processSafeOnSingleHost, true);
    assert.equal(governance.summary.activeCount, 0);
    assert.equal(governance.summary.countedCount, 1);
    const api = createAgentProjectApi({ service: serviceA });
    const response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/rate-limit-governance`, headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.rateLimitGovernance.entries[0].actorId, undefined);
    assert.match(response.body.rateLimitGovernance.entries[0].actorHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(classifyAccessRequest({ method: 'GET', path: `/projects/${projectId}/rate-limit-governance` }).allowedRoles, ['manager', 'security-admin']);
    void seedStore;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
