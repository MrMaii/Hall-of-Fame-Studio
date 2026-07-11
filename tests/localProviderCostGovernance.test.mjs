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

const projectId = 'local_provider_cost_governance_project';

function createSeed() {
  const seed = createKickoffProjectFromMeeting({
    projectId,
    name: 'Local Provider cost governance',
    brief: 'Forecast local Provider cost and govern exceptional overage.',
    now: '2026-07-10T08:00:00.000Z',
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
  return {
    ...seed,
    project: {
      ...seed.project,
      providerUsageLedger: [
        { id: 'usage_3', allowed: true, ok: true, status: 'completed', costCents: 100, startedAt: '2026-07-10T12:00:00.000Z', completedAt: '2026-07-10T12:00:00.000Z' },
        { id: 'usage_2', allowed: true, ok: true, status: 'completed', costCents: 100, startedAt: '2026-07-10T11:30:00.000Z', completedAt: '2026-07-10T11:30:00.000Z' },
        { id: 'usage_1', allowed: true, ok: true, status: 'completed', costCents: 100, startedAt: '2026-07-10T11:00:00.000Z', completedAt: '2026-07-10T11:00:00.000Z' },
      ],
    },
  };
}

function providerPolicy(overrides = {}) {
  return {
    enabled: true,
    mode: 'enforced',
    allowedSearchProviders: ['local-cost-search'],
    defaultToolGrants: ['search:evidence'],
    maxRequestsPerProjectHour: 10,
    dailyBudgetCents: 500,
    searchCostCentsPerRequest: 100,
    retryAttempts: 0,
    ...overrides,
  };
}

test('forecasts end-of-day local Provider cost from observed UTC-day burn rate', () => {
  const seed = createSeed();
  const service = createAgentProjectService({
    projects: [seed.project],
    messages: seed.messages,
    providerPolicy: providerPolicy(),
  });

  const readiness = service.getBudgetAlertReadiness(projectId, {
    now: '2026-07-10T12:00:00.000Z',
    fresh: true,
  });
  assert.equal(readiness.costForecast.schemaVersion, 'local-provider-cost-forecast/v1');
  assert.equal(readiness.costForecast.observedCostCents, 300);
  assert.equal(readiness.costForecast.projectedDailyCostCents, 600);
  assert.equal(readiness.costForecast.projectedPercentOfBudget, 120);
  assert.equal(readiness.costForecast.severity, 'critical');
  assert.equal(readiness.costForecast.confidence, 'medium');
  assert.equal(readiness.costForecast.basis, 'observed-utc-day-cost-divided-by-elapsed-day-fraction');
  assert.match(readiness.costForecast.recommendation, /approval/i);
});

test('consumes bounded local overage approval and rejects exhausted, expired, or revoked use across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-provider-cost-governance-'));
  let transportCalls = 0;
  const searchProvider = {
    status: () => ({
      provider: 'local-cost-search',
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
        provider: 'local-cost-search',
        searchMode: 'local-test',
        sources: [],
        findings: ['Local cost-governance evidence.'],
        confidence: 'high',
      };
    },
  };
  const makeRuntime = ({ seed = false } = {}) => {
    const kickoff = seed ? createSeed() : null;
    const store = createAgentProjectFileStore({
      filePath: join(directory, 'projects.json'),
      ...(kickoff ? {
        projects: [{ ...kickoff.project, providerUsageLedger: [] }],
        messages: kickoff.messages,
        replaceWithSeed: true,
      } : {}),
      hydrateProject: hydrateAgentProject,
    });
    const service = createAgentProjectService({
      store,
      providerPolicy: providerPolicy({ dailyBudgetCents: 100, maxRequestsPerProjectHour: 1 }),
      searchProvider,
    });
    return { store, service, api: createAgentProjectApi({ service }) };
  };

  try {
    let runtime = makeRuntime({ seed: true });
    await runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      query: 'base-budget-request',
      operation: 'search:evidence',
      now: '2026-07-10T09:00:00.000Z',
    });
    await assert.rejects(runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      query: 'denied-before-approval',
      operation: 'search:evidence',
      now: '2026-07-10T09:01:00.000Z',
    }), /provider-policy-denied:(hourly-rate-limit-exceeded|daily-budget-exceeded)/);
    assert.equal(transportCalls, 1);

    let response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/provider-budget-approvals`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-owner' },
      body: {
        operation: 'search:evidence',
        agentId: 'leader',
        maxExtraCostCents: 200,
        maxExtraRequests: 2,
        approvedBy: 'local-owner',
        ttlMs: 60 * 60 * 1000,
        now: '2026-07-10T09:02:00.000Z',
      },
    });
    assert.equal(response.status, 201);
    const approvalId = response.body.providerBudgetApproval.id;
    assert.equal(response.body.providerBudgetApproval.schemaVersion, 'local-provider-budget-approval/v1');
    assert.equal(response.body.providerBudgetApproval.status, 'active');

    for (const [index, now] of ['2026-07-10T09:03:00.000Z', '2026-07-10T09:04:00.000Z'].entries()) {
      await runtime.service.recordAgentEvidenceSearchWithProvider({
        projectId,
        agentId: 'leader',
        query: `approved-extra-request-${index + 1}`,
        operation: 'search:evidence',
        now,
      });
    }
    await assert.rejects(runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      query: 'denied-after-exhaustion',
      operation: 'search:evidence',
      now: '2026-07-10T09:05:00.000Z',
    }), /provider-policy-denied:(hourly-rate-limit-exceeded|daily-budget-exceeded)/);
    assert.equal(transportCalls, 3);

    response = await runtime.api.handleAsync({
      method: 'GET',
      path: `/projects/${projectId}/provider-budget-approvals`,
      body: { now: '2026-07-10T09:05:00.000Z' },
    });
    const exhausted = response.body.providerBudgetApprovals.rows.find((row) => row.id === approvalId);
    assert.equal(exhausted.status, 'exhausted');
    assert.equal(exhausted.consumedCostCents, 200);
    assert.equal(exhausted.consumedRequestCount, 2);
    assert.equal(exhausted.reservedCostCents, 0);

    response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/provider-budget-approvals`,
      body: {
        operation: 'search:evidence',
        agentId: 'leader',
        maxExtraCostCents: 100,
        maxExtraRequests: 1,
        approvedBy: 'local-owner',
        ttlMs: 60_000,
        now: '2026-07-10T09:06:00.000Z',
      },
    });
    const expiringApprovalId = response.body.providerBudgetApproval.id;

    runtime = makeRuntime();
    response = await runtime.api.handleAsync({
      method: 'GET',
      path: `/projects/${projectId}/provider-budget-approvals`,
      body: { now: '2026-07-10T09:06:30.000Z' },
    });
    assert.equal(response.body.providerBudgetApprovals.rows.find((row) => row.id === expiringApprovalId).status, 'active');
    await assert.rejects(runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      query: 'denied-after-approval-expiry',
      operation: 'search:evidence',
      now: '2026-07-10T09:08:00.000Z',
    }), /provider-policy-denied:(hourly-rate-limit-exceeded|daily-budget-exceeded)/);

    response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/provider-budget-approvals`,
      body: {
        operation: 'search:evidence',
        agentId: 'leader',
        maxExtraCostCents: 100,
        maxExtraRequests: 1,
        approvedBy: 'local-owner',
        ttlMs: 60 * 60 * 1000,
        now: '2026-07-10T09:09:00.000Z',
      },
    });
    const revokedApprovalId = response.body.providerBudgetApproval.id;
    response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/${projectId}/provider-budget-approvals/${revokedApprovalId}/revoke`,
      body: { revokedBy: 'local-owner', reason: 'No longer required.', now: '2026-07-10T09:10:00.000Z' },
    });
    assert.equal(response.body.providerBudgetApproval.status, 'revoked');
    await assert.rejects(runtime.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      query: 'denied-after-approval-revocation',
      operation: 'search:evidence',
      now: '2026-07-10T09:11:00.000Z',
    }), /provider-policy-denied:(hourly-rate-limit-exceeded|daily-budget-exceeded)/);
    const readiness = runtime.service.getBudgetAlertReadiness(projectId, {
      now: '2026-07-10T09:11:00.000Z',
      fresh: true,
    });
    assert.equal(readiness.usageSummary.dailyRequestCount, 3);
    assert.ok(readiness.usageSummary.deniedCount >= 3);
    assert.equal(readiness.backendRoutes.providerBudgetApprovals, `/projects/${projectId}/provider-budget-approvals`);
    assert.equal(readiness.summary.exhaustedProviderBudgetApprovalCount, 1);
    assert.equal(readiness.summary.expiredProviderBudgetApprovalCount, 1);
    assert.equal(readiness.summary.revokedProviderBudgetApprovalCount, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
