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
import {
  createModelGenerationProvenance,
  verifyModelGenerationProvenance,
} from '../src/agents/localModelDegradation.js';

const base = {
  projectId: 'model_degradation_project',
  agentId: 'writer',
  taskId: 'draft_task',
  artifactType: 'progress-brief',
  now: '2026-07-10T22:00:00.000Z',
};

test('derives truthful model, degraded fallback, and explicit-template provenance without raw content', () => {
  const modelOutput = createModelGenerationProvenance({
    ...base,
    modelRequested: true,
    modelResult: {
      ok: true,
      provider: 'local-openai-compatible',
      model: 'local-model-v1',
      id: 'response-001',
      content: 'PRIVATE MODEL OUTPUT MUST NOT ENTER RECEIPT',
    },
    modelStatus: { provider: 'local-openai-compatible', model: 'local-model-v1' },
  });
  assert.equal(modelOutput.schemaVersion, 'local-model-generation-provenance/v1');
  assert.equal(modelOutput.generationMode, 'model-provider-output');
  assert.equal(modelOutput.modelUsed, true);
  assert.equal(modelOutput.qualityTier, 'model-draft');
  assert.equal(modelOutput.humanReviewRequired, true);
  assert.equal(modelOutput.releaseEligibility.directAcceptanceAllowed, false);
  assert.equal(verifyModelGenerationProvenance(modelOutput).valid, true);

  const fallbackCases = [
    ['policy-denied', 'policy-denied'],
    ['circuit-open', 'circuit-open'],
    ['budget-denied', 'budget-denied'],
    ['provider-unavailable', 'provider-unavailable'],
    ['transport-failed', 'transport-failed'],
  ];
  for (const [degradationReason, expected] of fallbackCases) {
    const receipt = createModelGenerationProvenance({
      ...base,
      modelRequested: true,
      modelRequired: false,
      modelResult: {
        ok: false,
        error: 'sk-secret raw upstream body and private project content',
        content: 'PRIVATE FALLBACK INPUT',
      },
      modelStatus: { provider: 'local-openai-compatible', model: 'local-model-v1' },
      degradationReason,
    });
    assert.equal(receipt.generationMode, 'requested-model-fallback');
    assert.equal(receipt.modelUsed, false);
    assert.equal(receipt.degradationReason, expected);
    assert.equal(receipt.qualityTier, 'degraded-template');
    assert.equal(receipt.releaseEligibility.directAcceptanceAllowed, false);
    assert.equal(receipt.releaseEligibility.finalDeliveryAllowed, false);
    assert.equal(verifyModelGenerationProvenance(receipt).valid, true);
    const serialized = JSON.stringify(receipt);
    assert.equal(serialized.includes('sk-secret'), false);
    assert.equal(serialized.includes('private project content'), false);
    assert.equal(serialized.includes('PRIVATE FALLBACK INPUT'), false);
  }

  const explicitTemplate = createModelGenerationProvenance({
    ...base,
    modelRequested: false,
    modelResult: null,
    modelStatus: { provider: 'local-openai-compatible', model: 'local-model-v1' },
  });
  assert.equal(explicitTemplate.generationMode, 'explicit-local-template');
  assert.equal(explicitTemplate.modelUsed, false);
  assert.equal(explicitTemplate.degradationReason, null);
  assert.equal(explicitTemplate.qualityTier, 'local-template');
  assert.equal(explicitTemplate.fallback, false);
});

test('labels real artifact generation paths, forces fallback review, and recovers provenance after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-model-degradation-'));
  const filePath = join(directory, 'projects.json');
  try {
    const kickoff = createKickoffProjectFromMeeting({
      projectId: 'model_degradation_api_project',
      name: 'Model degradation API project',
      brief: 'Keep model and fallback artifact provenance truthful.',
      now: '2026-07-10T22:30:00.000Z',
      team: [
        { id: 'writer', name: 'Ada Lovelace', title: 'Technical Writer' },
        { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer' },
      ],
    });
    const store = createAgentProjectFileStore({
      filePath,
      projects: [kickoff.project],
      messages: kickoff.messages,
      replaceWithSeed: true,
      hydrateProject: hydrateAgentProject,
    });
    let providerMode = 'success';
    const llmProvider = {
      status: () => ({
        provider: 'local-test-model',
        model: 'local-v1',
        enabled: true,
        configured: true,
        runtimeEnabled: true,
        apiKeySource: 'not-required',
      }),
      createChatCompletion: async () => (providerMode === 'success'
        ? {
          ok: true,
          provider: 'local-test-model',
          model: 'local-v1',
          id: 'response-success-001',
          json: {
            title: 'Model progress brief',
            summary: 'A model-authored product-team artifact prepared for independent Manager and Reviewer inspection.',
            body: `${'Product team evidence workflow implementation review handoff manager artifact. '.repeat(12)} Artifact type progress brief.`,
          },
          usage: { total_tokens: 120 },
        }
        : {
          ok: false,
          error: 'sk-secret upstream timeout with private project body',
          reason: 'timeout',
        }),
    };
    const providerPolicy = {
      enabled: true,
      mode: 'enforced',
      allowedModelProviders: ['local-test-model'],
      allowedModels: ['local-v1'],
      defaultToolGrants: ['model:artifact-draft'],
      maxRequestsPerProjectHour: 100,
      dailyBudgetCents: 10_000,
      modelCostCentsPer1kTokens: 1,
      retryAttempts: 0,
    };
    let service = createAgentProjectService({ store, llmProvider, providerPolicy });
    let api = createAgentProjectApi({ service });

    let result = await service.generateAgentArtifactDraft({
      projectId: kickoff.project.id,
      agentId: 'writer',
      artifactType: 'progress-brief',
      instruction: 'Prepare a manager-ready product-team progress brief.',
      useModel: true,
      now: '2026-07-10T22:31:00.000Z',
    });
    assert.equal(result.artifactDraft.modelUsed, true);
    assert.equal(result.artifactDraft.generationProvenance.generationMode, 'model-provider-output');
    assert.equal(result.artifactDraft.artifactDraftQuality.generationMode, 'model-provider-output');

    providerMode = 'failure';
    result = await service.generateAgentArtifactDraft({
      projectId: kickoff.project.id,
      agentId: 'writer',
      artifactType: 'progress-brief',
      instruction: 'Prepare a fallback-safe product-team progress brief.',
      useModel: true,
      requireModel: false,
      submit: true,
      status: 'completed',
      reviewStatus: 'accepted',
      reviewerAgentId: 'reviewer',
      now: '2026-07-10T22:32:00.000Z',
    });
    assert.equal(result.artifactDraft.modelUsed, false);
    assert.equal(result.artifactDraft.generationProvenance.generationMode, 'requested-model-fallback');
    assert.equal(result.artifactDraft.generationProvenance.degradationReason, 'transport-failed');
    assert.equal(result.artifactDraft.artifactDraftQuality.status, 'degraded-review-required');
    assert.equal(result.submission.status, 'submitted');
    assert.equal(result.submission.reviewStatus, 'pending-review');
    assert.equal(result.submission.artifactDraftModelUsed, false);
    assert.equal(result.submission.artifactDraft.generationProvenance.modelUsed, false);

    result = await service.generateAgentArtifactDraft({
      projectId: kickoff.project.id,
      agentId: 'writer',
      artifactType: 'progress-brief',
      instruction: 'Prepare an explicit local template.',
      useModel: false,
      now: '2026-07-10T22:33:00.000Z',
    });
    assert.equal(result.artifactDraft.generationProvenance.generationMode, 'explicit-local-template');
    assert.equal(result.artifactDraft.artifactDraftQuality.status, 'template-review-required');

    let response = await api.handleAsync({
      method: 'GET',
      path: `/projects/${kickoff.project.id}/model-degradation-readiness`,
    });
    assert.equal(response.status, 200);
    let readiness = response.body.modelDegradationReadiness;
    assert.equal(readiness.schemaVersion, 'local-model-degradation-readiness/v1');
    assert.equal(readiness.summary.receiptCount, 3);
    assert.equal(readiness.summary.modelOutputCount, 1);
    assert.equal(readiness.summary.requestedFallbackCount, 1);
    assert.equal(readiness.summary.explicitTemplateCount, 1);
    assert.equal(readiness.integrity.valid, true);
    assert.equal(JSON.stringify(readiness).includes('sk-secret'), false);
    assert.equal(JSON.stringify(readiness).includes('private project body'), false);

    const restartedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    service = createAgentProjectService({ store: restartedStore, llmProvider, providerPolicy });
    api = createAgentProjectApi({ service });
    response = await api.handleAsync({
      method: 'GET',
      path: `/projects/${kickoff.project.id}/model-degradation-readiness`,
    });
    readiness = response.body.modelDegradationReadiness;
    assert.equal(response.status, 200);
    assert.equal(readiness.summary.receiptCount, 3);
    assert.equal(readiness.integrity.valid, true);

    const tampered = restartedStore.getProject(kickoff.project.id);
    tampered.modelGenerationProvenanceReceipts[0].qualityTier = 'model-draft';
    restartedStore.saveProject(tampered);
    response = await api.handleAsync({
      method: 'GET',
      path: `/projects/${kickoff.project.id}/model-degradation-readiness`,
    });
    assert.equal(response.body.modelDegradationReadiness.integrity.valid, false);
    assert.equal(response.body.modelDegradationReadiness.rows[0].status, 'integrity-invalid');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
