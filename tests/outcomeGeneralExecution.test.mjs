import assert from 'node:assert/strict';
import test from 'node:test';

import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const providerPolicy = {
  enabled: true,
  mode: 'enforced',
  allowedModelProviders: ['test-model'],
  allowedModels: ['test-v1'],
  defaultToolGrants: ['model:artifact-draft'],
  maxRequestsPerProjectHour: 100,
  dailyBudgetCents: 10_000,
  modelCostCentsPer1kTokens: 1,
  retryAttempts: 0,
};

function projectFixture({ workMode = null } = {}) {
  return {
    id: workMode ? `outcome-${workMode}` : 'outcome-general',
    name: workMode ? 'API delivery' : 'Launch decision',
    objective: workMode ? 'Fix and test the API implementation.' : 'Decide the launch sequence and produce an actionable recommendation.',
    ...(workMode ? { workModeContract: { workMode } } : {}),
    progress: 0,
    team: [
      { id: 'owner', name: 'Owner', role: workMode ? 'Engineer' : 'Product Strategist' },
      { id: 'reviewer', name: 'Reviewer', role: 'Independent Reviewer' },
    ],
    tasks: [{
      id: 'outcome-task',
      text: workMode ? 'Fix the API bug and verify the build.' : 'Recommend the launch sequence, risks, and immediate actions.',
      ownerId: 'owner',
      reviewerAgentId: 'reviewer',
      status: 'in-progress',
      workDefinition: { deliverable: workMode ? 'Verified API change.' : 'Launch decision brief.' },
    }],
    agentStates: { owner: { agentId: 'owner', status: 'working', inbox: [], obligations: [], worklog: [] } },
    agentSubmissions: [],
    submissionReviews: [],
    evidenceSearches: [],
    logs: [],
    eventLedger: [],
  };
}

test('general autonomous work uses the model to create a material review submission instead of a pulse template', async () => {
  const llmProvider = {
    status: () => ({ provider: 'test-model', model: 'test-v1', enabled: true, configured: true }),
    createChatCompletion: async () => ({
      ok: true,
      provider: 'test-model',
      model: 'test-v1',
      id: 'general-model-1',
      usage: { total_tokens: 180 },
      json: {
        title: 'Launch sequence decision proposal',
        summary: 'A task-specific launch recommendation that orders validation, controlled release, measurement, and rollback preparation.',
        body: '# Launch decision\n\nThe product team should launch in three controlled stages. First, validate the highest-risk user path with ten representative users and record completion, error, and abandonment rates. Second, release to a five-percent cohort with a documented rollback threshold. Third, expand only after the cohort meets the reliability and activation targets.\n\nThe main risks are weak onboarding evidence, hidden support load, and irreversible public positioning. The immediate actions are to name metric owners, prepare the rollback checklist, and schedule the cohort review. This artifact gives the manager a concrete decision and leaves the reviewer a clear handoff: verify thresholds, owners, and rollback readiness before acceptance.',
      },
    }),
  };
  const service = createAgentProjectService({ projects: [projectFixture()], messages: [], llmProvider, providerPolicy });
  const queue = service.getAgentAutonomousActionQueue('outcome-general', { now: '2026-07-20T13:00:00.000Z' });
  const row = queue.rows.find((candidate) => candidate.agentId === 'owner');
  assert.equal(row.requestBodyTemplate.useOutcomeModelExecution, true);

  const result = await service.runAgentAutonomousActionQueueItemWithProviderEvidence({
    projectId: 'outcome-general',
    agentId: 'owner',
    now: '2026-07-20T13:00:00.000Z',
    force: true,
  });

  assert.equal(result.outcomeExecutor.status, 'material-submission-created');
  assert.ok(result.submission);
  assert.equal(result.generatedArtifact.materialOutcome.material, true);
  assert.equal(result.project.progress, 0);
  assert.equal(result.project.agentSubmissions.length, 1);
});

test('technical autonomous work fails visibly instead of inventing code or test proof', async () => {
  const project = projectFixture({ workMode: 'technical-delivery' });
  const service = createAgentProjectService({ projects: [project], messages: [] });
  const result = await service.runAgentAutonomousActionQueueItemWithProviderEvidence({
    projectId: project.id,
    agentId: 'owner',
    now: '2026-07-20T13:05:00.000Z',
    force: true,
  });

  assert.equal(result.outcomeExecutor.status, 'blocked-specialized-tool-proof-required');
  assert.equal(result.project.agentSubmissions.length, 0);
  assert.equal(result.project.progress, 0);
});
