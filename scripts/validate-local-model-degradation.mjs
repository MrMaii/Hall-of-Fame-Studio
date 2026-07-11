import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-model-degradation-${process.pid}`);
const filePath = resolve(tempRoot, 'projects.json');
const projectId = 'local_model_degradation_validation';
let providerMode = 'failure';
const llmProvider = {
  status: () => ({
    provider: 'local-gate-model',
    model: 'local-gate-v1',
    enabled: true,
    configured: true,
    runtimeEnabled: true,
    apiKeySource: 'not-required',
  }),
  createChatCompletion: async () => (providerMode === 'success'
    ? {
      ok: true,
      provider: 'local-gate-model',
      model: 'local-gate-v1',
      id: 'gate-response-001',
      json: {
        title: 'Model-generated progress brief',
        summary: 'A local model generated this product-team artifact for Manager and Reviewer handoff.',
        body: `${'Product team workflow evidence manager reviewer handoff implementation artifact. '.repeat(12)} Artifact type progress brief.`,
      },
      usage: { total_tokens: 100 },
    }
    : {
      ok: false,
      reason: 'timeout',
      error: 'sk-local-secret private draft body must never enter provenance',
    }),
};
const providerPolicy = {
  enabled: true,
  mode: 'enforced',
  allowedModelProviders: ['local-gate-model'],
  allowedModels: ['local-gate-v1'],
  defaultToolGrants: ['model:artifact-draft'],
  maxRequestsPerProjectHour: 100,
  dailyBudgetCents: 10_000,
  modelCostCentsPer1kTokens: 1,
  retryAttempts: 0,
};

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  let api = createFileBackedAgentProjectApi({
    filePath,
    replaceWithSeed: true,
    llmProvider,
    providerPolicy,
  });
  let response = await api.handleAsync({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Local Model Degradation Validation',
      brief: 'Keep model and deterministic fallback output provenance truthful.',
      team: [
        { id: 'writer', name: 'Ada Lovelace', title: 'Technical Writer' },
        { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer' },
      ],
      selectedLeaderId: 'writer',
      reviewerId: 'reviewer',
      now: '2026-07-10T23:00:00.000Z',
    },
  });
  assert(response.status === 200, `Project initiation returned ${response.status}.`);

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/agents/writer/artifact-drafts`,
    body: {
      includeReadModels: false,
      artifactType: 'progress-brief',
      instruction: 'Prepare a fallback-safe progress brief.',
      useModel: true,
      requireModel: false,
      submit: true,
      status: 'completed',
      reviewStatus: 'accepted',
      reviewerAgentId: 'reviewer',
      now: '2026-07-10T23:01:00.000Z',
    },
  });
  assert(response.status === 200, `Fallback artifact route returned ${response.status}.`);
  const fallbackDraft = response.body.artifactDraft;
  assert(fallbackDraft.modelUsed === false, 'Failed Provider attempt must not set modelUsed.');
  assert(fallbackDraft.generationProvenance.generationMode === 'requested-model-fallback', 'Failed Provider attempt must be a requested-model fallback.');
  assert(fallbackDraft.generationProvenance.degradationReason === 'transport-failed', 'Raw timeout must map to a closed reason code.');
  assert(fallbackDraft.artifactDraftQuality.status === 'degraded-review-required', 'Fallback quality must be visibly capped.');
  assert(response.body.submission.status === 'submitted' && response.body.submission.reviewStatus === 'pending-review', 'Generated fallback cannot self-accept or self-complete.');
  assert(JSON.stringify(fallbackDraft.generationProvenance).includes('sk-local-secret') === false, 'Provenance must contain no upstream secret or error body.');

  response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/model-degradation-readiness` });
  assert(response.status === 200 && response.body.modelDegradationReadiness.integrity.valid, 'Fallback provenance must be queryable and checksum-valid.');

  api = createFileBackedAgentProjectApi({ filePath, llmProvider, providerPolicy });
  response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/model-degradation-readiness` });
  assert(response.body.modelDegradationReadiness.summary.requestedFallbackCount === 1, 'Fallback receipt must survive restart.');

  providerMode = 'success';
  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/agents/writer/artifact-drafts`,
    body: {
      includeReadModels: false,
      artifactType: 'progress-brief',
      instruction: 'Prepare a real local-model progress brief.',
      useModel: true,
      requireModel: true,
      now: '2026-07-10T23:02:00.000Z',
    },
  });
  assert(response.status === 200, `Model artifact route returned ${response.status}.`);
  assert(response.body.artifactDraft.modelUsed === true, 'Only a successful Provider result may set modelUsed.');
  assert(response.body.artifactDraft.generationProvenance.generationMode === 'model-provider-output', 'Successful Provider result must use model-provider-output mode.');

  response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/model-degradation-readiness` });
  const readiness = response.body.modelDegradationReadiness;
  assert(readiness.summary.receiptCount === 2 && readiness.summary.modelOutputCount === 1, 'Readiness must distinguish model and fallback receipts.');
  assert(readiness.readyForProduction === false, 'Local provenance must not claim public production readiness.');

  console.log('Local model degradation provenance validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
