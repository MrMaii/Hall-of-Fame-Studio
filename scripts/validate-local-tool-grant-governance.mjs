import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-tool-grant-governance-${process.pid}`);
const storePath = resolve(tempRoot, 'store.json');
const projectId = 'local_tool_grant_governance_validation';
let transportCalls = 0;
const searchProvider = {
  status: () => ({
    provider: 'local-tool-search',
    enabled: true,
    configured: true,
    runtimeEnabled: true,
    apiKeySource: 'not-required',
  }),
  search: async () => {
    transportCalls += 1;
    return {
      ok: true,
      provider: 'local-tool-search',
      searchMode: 'local-validation',
      sources: [],
      findings: ['Local temporary authorization validation evidence.'],
      confidence: 'high',
    };
  },
};
const providerPolicy = {
  enabled: true,
  mode: 'enforced',
  allowedSearchProviders: ['local-tool-search'],
  defaultToolGrants: ['search:evidence'],
  maxRequestsPerProjectHour: 100,
  dailyBudgetCents: 10_000,
  searchCostCentsPerRequest: 1,
  retryAttempts: 0,
};

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  let api = createFileBackedAgentProjectApi({
    filePath: storePath,
    replaceWithSeed: true,
    searchProvider,
    providerPolicy,
  });
  let response = await api.handleAsync({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Local Tool Grant Governance Validation',
      brief: 'Prove bounded local Agent tool authorization and tamper-evident receipts.',
      team: [
        { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader' },
        { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer' },
      ],
      selectedLeaderId: 'leader',
      reviewerId: 'reviewer',
      now: '2026-07-10T14:00:00.000Z',
    },
  });
  assert(response.status === 200, `Project initiation returned ${response.status}.`);
  const taskId = api.store.getProject(projectId).tasks[0]?.id;
  assert(taskId, 'Validation project must expose a task for exact task scope.');

  response = await api.handleAsync({
    method: 'PUT',
    path: `/projects/${projectId}/project-settings`,
    body: {
      includeReadModels: false,
      toolGrantPolicy: { defaultToolGrants: ['provider:test'], agentToolGrants: {} },
      updatedBy: 'local-owner',
      now: '2026-07-10T14:01:00.000Z',
    },
  });
  assert(response.status === 200, 'Baseline project tool policy must remove search access.');

  let denied = false;
  try {
    await api.service.recordAgentEvidenceSearchWithProvider({
      projectId,
      agentId: 'leader',
      taskId,
      operation: 'search:evidence',
      query: 'must-not-leave-local-test-boundary',
      now: '2026-07-10T14:02:00.000Z',
    });
  } catch (error) {
    denied = /agent-tool-grant-missing/.test(error.message || String(error));
  }
  assert(denied && transportCalls === 0, 'Missing baseline grant must fail before Provider dispatch.');

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/tool-grant-leases`,
    body: {
      operation: 'search:evidence',
      agentId: 'leader',
      taskId,
      maxInvocations: 1,
      grantedBy: 'local-owner',
      purpose: 'Run one local validation attempt.',
      ttlMs: 60 * 60 * 1000,
      now: '2026-07-10T14:03:00.000Z',
    },
  });
  assert(response.status === 201, `Temporary tool grant creation returned ${response.status}.`);
  const leaseId = response.body.toolGrantLease?.id;
  assert(leaseId && response.body.toolGrantLease.remainingInvocationCount === 1, 'Created lease must expose one remaining attempt.');

  await api.service.recordAgentEvidenceSearchWithProvider({
    projectId,
    agentId: 'leader',
    taskId,
    operation: 'search:evidence',
    query: 'one-bounded-local-validation-call',
    now: '2026-07-10T14:04:00.000Z',
  });
  assert(transportCalls === 1, 'Exactly one matching Provider attempt must dispatch.');

  response = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/tool-grant-leases`,
    body: { now: '2026-07-10T14:05:00.000Z' },
  });
  const governance = response.body.toolGrantGovernance;
  assert(response.status === 200 && governance?.schemaVersion === 'local-tool-grant-governance/v1', 'Governance route must expose the typed contract.');
  assert(governance.summary.exhaustedLeaseCount === 1, 'One-attempt lease must become exhausted.');
  assert(governance.receiptIntegrity.valid && governance.receiptIntegrity.status === 'verified', 'Invocation receipt chain must verify.');
  assert(governance.invocationReceipts.length === 2, 'Denied and dispatched attempts must both have receipts.');
  const leaseReceipt = governance.invocationReceipts.find((receipt) => receipt.authorizationSource === 'temporary-lease');
  assert(leaseReceipt?.toolGrantLeaseId === leaseId && leaseReceipt.toolGrantLeaseChecksum, 'Lease-backed receipt must bind the authorization snapshot.');
  const serialized = JSON.stringify(governance.invocationReceipts);
  assert(!serialized.includes('one-bounded-local-validation-call') && !serialized.includes('must-not-leave-local-test-boundary'), 'Invocation receipts must not retain query content.');
  assert(governance.readyForProduction === false, 'Pure-local governance must not overclaim public production readiness.');

  api = createFileBackedAgentProjectApi({ filePath: storePath, searchProvider, providerPolicy });
  response = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/tool-grant-leases`,
    body: { now: '2026-07-10T14:06:00.000Z' },
  });
  assert(response.body.toolGrantGovernance.summary.exhaustedLeaseCount === 1, 'Exhaustion must remain authoritative after restart.');
  assert(response.body.toolGrantGovernance.receiptIntegrity.valid, 'Receipt integrity must remain valid after restart.');

  const stored = JSON.parse(await readFile(storePath, 'utf8'));
  const storedProject = stored.projects.find((project) => project.id === projectId);
  assert(storedProject?.toolGrantLeases?.some((lease) => lease.id === leaseId), 'File store must persist the temporary grant.');
  assert(storedProject?.toolInvocationReceipts?.length === 2, 'File store must persist invocation receipts.');

  console.log('Local temporary tool grant governance validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
