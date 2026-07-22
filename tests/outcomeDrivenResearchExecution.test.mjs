import assert from 'node:assert/strict';
import test from 'node:test';

import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function researchProject() {
  return {
    id: 'required-search-project',
    name: 'Adolescent mental health research',
    objective: 'Search reliable sources and explain the relationship between daily working hours and adolescent mental health.',
    status: 'executing',
    progress: 14,
    team: [
      { id: 'researcher', name: 'Researcher', role: 'Evidence Researcher' },
      { id: 'reviewer', name: 'Reviewer', role: 'Independent Reviewer' },
    ],
    tasks: [{
      id: 'source-search',
      text: 'Search and synthesize reliable sources about working hours and adolescent mental health.',
      ownerId: 'researcher',
      reviewerAgentId: 'reviewer',
      status: 'in-progress',
      requiredWorkPulses: 2,
      workDefinition: {
        deliverable: 'Evidence matrix with source links, findings, conflicts, and limitations.',
        acceptanceCriteria: ['At least three traceable sources.', 'Independent accepted review.'],
        steps: ['Search evidence.', 'Synthesize evidence.'],
      },
    }],
    agentStates: { researcher: { agentId: 'researcher', status: 'working', inbox: [], obligations: [], worklog: [] } },
    agentSubmissions: [],
    evidenceSearches: [],
    submissionReviews: [],
    agentWorkerLedger: [],
    logs: [],
    eventLedger: [],
  };
}

test('research action queue requires provider search on the first autonomous tick', () => {
  const searchProvider = {
    status: () => ({ provider: 'http-json', enabled: false, configured: true, endpointPolicy: { status: 'blocked-remote-endpoint' } }),
    search: async () => ({ ok: false, reason: 'remote-endpoint-blocked' }),
  };
  const service = createAgentProjectService({ projects: [researchProject()], messages: [], searchProvider });
  const queue = service.getAgentAutonomousActionQueue('required-search-project', { now: '2026-07-20T10:00:00.000Z' });
  const row = queue.rows.find((item) => item.agentId === 'researcher');

  assert.equal(row.selectedAction, 'continue-owned-work');
  assert.equal(row.providerEvidenceSearchPlanned, true);
  assert.equal(row.requestBodyTemplate.recordEvidenceSearch, true);
  assert.equal(row.requestBodyTemplate.useProviderEvidenceSearch, true);
  assert.equal(row.requestBodyTemplate.requireProviderEvidenceSearch, true);
});

test('required research search failure is visible and cannot create progress, evidence, or a submission', async () => {
  const searchProvider = {
    status: () => ({ provider: 'http-json', enabled: false, configured: true, endpointPolicy: { status: 'blocked-remote-endpoint' } }),
    search: async () => ({ ok: false, reason: 'remote-endpoint-blocked' }),
  };
  const service = createAgentProjectService({ projects: [researchProject()], messages: [], searchProvider });

  await assert.rejects(
    service.runAgentAutonomousActionQueueItemWithProviderEvidence({
      projectId: 'required-search-project',
      agentId: 'researcher',
      now: '2026-07-20T10:00:00.000Z',
      force: true,
    }),
    /search-provider-unavailable:search-provider-disabled/,
  );

  const stored = service.getProject('required-search-project');
  assert.equal(stored.progress, 14);
  assert.equal(stored.tasks[0].status, 'in-progress');
  assert.equal((stored.evidenceSearches || []).length, 0);
  assert.equal((stored.agentSubmissions || []).length, 0);
});

test('a successful research tick searches, synthesizes a substantive artifact, and publishes a review handoff', async () => {
  const searchProvider = {
    status: () => ({ provider: 'test-search', enabled: true, configured: true, endpointPolicy: { status: 'remote-endpoints-allowed' } }),
    search: async () => ({
      ok: true,
      provider: 'test-search',
      searchMode: 'provider-search',
      confidence: 'high',
      sources: [
        { id: 's1', title: 'Longitudinal adolescent cohort', url: 'https://example.test/1', snippet: 'Working hours precede higher stress.' },
        { id: 's2', title: 'Youth work meta-analysis', url: 'https://example.test/2', snippet: 'Effects vary by age and schedule.' },
        { id: 's3', title: 'Sleep mediation study', url: 'https://example.test/3', snippet: 'Sleep partly mediates the association.' },
      ],
      findings: ['Longer hours are associated with higher stress, with sleep as a plausible mediator.'],
    }),
  };
  const llmProvider = {
    status: () => ({ provider: 'test-model', model: 'test-v1', enabled: true, configured: true }),
    createChatCompletion: async () => ({
      ok: true,
      provider: 'test-model',
      model: 'test-v1',
      id: 'model-research-1',
      json: {
        title: 'Adolescent working hours and mental health evidence matrix',
        summary: 'Three provider-backed studies are compared by design, exposure, outcome, confounding controls, and limitations.',
        body: '# Evidence matrix\n\nThe longitudinal cohort places working-hour exposure before the measured increase in stress, while the meta-analysis confirms the direction but reports heterogeneity across age bands and schedule definitions. The sleep study supplies a plausible mediation path: longer work schedules reduce sleep duration, which predicts higher standardized distress.\n\n## Conflicts and limitations\n\nThe evidence does not yet establish a universal causal threshold. Self-selection into paid work, socioeconomic status, school workload, and inconsistent mental-health scales remain important limitations.\n\n## Testable hypothesis\n\nFor adolescents in paid work, each additional five weekly work hours will predict a higher standardized stress score, partially mediated by shorter sleep duration.',
      },
      usage: { total_tokens: 240 },
    }),
  };
  const providerPolicy = {
    enabled: true,
    mode: 'enforced',
    allowedSearchProviders: ['test-search'],
    allowedModelProviders: ['test-model'],
    allowedModels: ['test-v1'],
    defaultToolGrants: ['search:evidence', 'model:artifact-draft'],
    maxRequestsPerProjectHour: 100,
    dailyBudgetCents: 10_000,
    searchCostCentsPerRequest: 1,
    modelCostCentsPer1kTokens: 1,
    retryAttempts: 0,
  };
  const service = createAgentProjectService({ projects: [researchProject()], messages: [], searchProvider, llmProvider, providerPolicy });

  const queue = service.getAgentAutonomousActionQueue('required-search-project', { now: '2026-07-20T10:00:00.000Z' });
  const requestBody = queue.rows.find((row) => row.agentId === 'researcher').requestBodyTemplate;
  const result = await service.runAgentWorkCycleWithProviderEvidence({
    projectId: 'required-search-project',
    agentId: 'researcher',
    ...requestBody,
    now: '2026-07-20T10:00:00.000Z',
    autonomousProviderPreflight: {
      schemaVersion: 'autonomous-provider-preflight/v1',
      canCallProvider: true,
      shouldPause: false,
      action: 'call-provider',
      reason: 'test-provider-ready',
      reasons: [],
      checksum: 'test-preflight-checksum',
    },
  });

  assert.equal(result.providerEvidenceSearch.status, 'completed');
  assert.ok(result.evidenceSearch?.sources?.length >= 3);
  assert.ok(result.generatedArtifact?.submission);
  assert.equal(result.generatedArtifact.materialOutcome.material, true);
  assert.match(result.generatedArtifact.submission.body, /Testable hypothesis/);
  assert.ok(result.generatedArtifact.materialHandoff.checksum);
  assert.ok(result.generatedArtifact.messages.some((message) => message.resourceRoute && message.submissionId));
  assert.equal(result.project.progress, 14, 'pending review must not advance progress');

  const graph = service.getManagerFlowGraph('required-search-project');
  assert.ok(graph.nodes.some((node) => node.category === 'evidence'));
  assert.ok(graph.nodes.some((node) => node.category === 'submission'));

  const reviewed = service.reviewAgentSubmission({
    projectId: 'required-search-project',
    submissionId: result.generatedArtifact.submission.id,
    reviewerAgentId: 'reviewer',
    verdict: 'accepted',
    comments: 'Sources, conflicts, limitations, and the testable hypothesis are all reviewable.',
    now: '2026-07-20T10:05:00.000Z',
  });
  assert.equal(reviewed.project.tasks[0].status, 'done');
  assert.equal(reviewed.project.tasks[0].outcome.accepted, true);
  assert.equal(reviewed.task.status, 'done');
  assert.equal(reviewed.task.outcome.accepted, true);
  assert.equal(reviewed.project.progress, 100);
});

test('a retry reuses sufficient provider evidence instead of repeating the search', async () => {
  const project = researchProject();
  project.evidenceSearches = [{
    id: 'existing-provider-evidence',
    taskId: 'source-search',
    status: 'completed',
    provider: 'test-search',
    searchMode: 'provider-search',
    sources: [
      { id: 's1', title: 'Cohort', url: 'https://example.test/1' },
      { id: 's2', title: 'Meta-analysis', url: 'https://example.test/2' },
      { id: 's3', title: 'Mediation study', url: 'https://example.test/3' },
    ],
    findings: ['Longer working hours correlate with distress and reduced sleep.'],
  }];
  let searchCalls = 0;
  const searchProvider = {
    status: () => ({ provider: 'test-search', enabled: true, configured: true }),
    search: async () => {
      searchCalls += 1;
      throw new Error('search must not be repeated');
    },
  };
  const llmProvider = {
    status: () => ({ provider: 'test-model', model: 'test-v1', enabled: true, configured: true }),
    createChatCompletion: async () => ({
      ok: true,
      provider: 'test-model',
      model: 'test-v1',
      json: {
        title: 'Reused evidence synthesis',
        summary: 'The existing three-source evidence set is synthesized without another network search.',
        body: '# Findings\n\nThe cohort, meta-analysis, and mediation study jointly support an association between longer work hours, shorter sleep, and higher distress.\n\n## Conflicts and limitations\n\nDefinitions and confounding controls vary, so causal thresholds remain uncertain.\n\n## Testable hypothesis\n\nFive additional weekly work hours will predict higher distress, partially mediated by sleep loss.',
      },
      usage: { total_tokens: 180 },
    }),
  };
  const providerPolicy = {
    enabled: true,
    mode: 'enforced',
    allowedSearchProviders: ['test-search'],
    allowedModelProviders: ['test-model'],
    allowedModels: ['test-v1'],
    defaultToolGrants: ['search:evidence', 'model:artifact-draft'],
    maxRequestsPerProjectHour: 100,
    dailyBudgetCents: 10_000,
    searchCostCentsPerRequest: 1,
    modelCostCentsPer1kTokens: 1,
    retryAttempts: 0,
  };
  const service = createAgentProjectService({ projects: [project], messages: [], searchProvider, llmProvider, providerPolicy });
  const queue = service.getAgentAutonomousActionQueue(project.id, { now: '2026-07-20T10:10:00.000Z' });
  const row = queue.rows.find((item) => item.agentId === 'researcher');

  assert.equal(row.providerEvidenceSearchPlanned, false);
  assert.deepEqual(row.requestBodyTemplate.existingEvidenceSearchIds, ['existing-provider-evidence']);

  const result = await service.runAgentAutonomousActionQueueItemWithProviderEvidence({
    projectId: project.id,
    agentId: 'researcher',
    now: '2026-07-20T10:10:00.000Z',
    force: true,
  });

  assert.equal(searchCalls, 0);
  assert.equal(result.project.evidenceSearches.length, 1, 'reusing evidence must not create a local fallback search record');
  assert.equal(result.submission.artifactType, 'evidence-packet');
  assert.deepEqual(result.submission.evidenceSearchIds, ['existing-provider-evidence']);
});
