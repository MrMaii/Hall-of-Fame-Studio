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

function projectFixture() {
  return {
    id: 'research-artifact-quality',
    name: 'Adolescent mental health research',
    objective: 'Research the relationship between adolescent working hours and mental health and prepare a publishable paper.',
    progress: 0,
    team: [
      { id: 'researcher', name: 'Researcher', role: 'Evidence Researcher' },
      { id: 'reviewer', name: 'Reviewer', role: 'Independent Reviewer' },
    ],
    tasks: [{
      id: 'evidence-task',
      text: 'Synthesize working-hours and adolescent mental-health evidence.',
      ownerId: 'researcher',
      reviewerAgentId: 'reviewer',
      status: 'in-progress',
      workDefinition: { deliverable: 'Evidence matrix and testable hypothesis.' },
    }],
    evidenceSearches: [{
      id: 'provider-search-1',
      taskId: 'evidence-task',
      provider: 'tavily',
      searchMode: 'provider-search',
      status: 'completed',
      sources: [
        { id: 's1', title: 'Longitudinal study', url: 'https://example.test/1' },
        { id: 's2', title: 'Meta-analysis', url: 'https://example.test/2' },
        { id: 's3', title: 'Youth cohort', url: 'https://example.test/3' },
      ],
      findings: ['Longer hours are associated with higher stress in several samples.'],
    }],
    agentSubmissions: [],
    submissionReviews: [],
    logs: [],
    eventLedger: [],
    agentStates: {},
  };
}

function modelProvider(payload) {
  return {
    status: () => ({ provider: 'test-model', model: 'test-v1', enabled: true, configured: true }),
    createChatCompletion: async () => ({
      ok: true,
      provider: 'test-model',
      model: 'test-v1',
      id: 'model-response-1',
      json: payload,
      usage: { total_tokens: 200 },
    }),
  };
}

test('research artifact generation rejects coordination-only model prose before submission', async () => {
  const service = createAgentProjectService({
    projects: [projectFixture()],
    messages: [],
    providerPolicy,
    llmProvider: modelProvider({
      title: 'Research progress brief',
      summary: 'A coordination update for the manager and reviewer handoff workflow.',
      body: `${'Continue the next work pulse and publish timeline evidence for manager review. '.repeat(12)} Evidence packet.`,
    }),
  });

  await assert.rejects(
    service.generateAgentArtifactDraft({
      projectId: 'research-artifact-quality',
      agentId: 'researcher',
      taskId: 'evidence-task',
      artifactType: 'evidence-packet',
      instruction: 'Produce the source-backed evidence matrix.',
      evidenceSearchIds: ['provider-search-1'],
      useModel: true,
      submit: true,
      reviewerAgentId: 'reviewer',
      now: '2026-07-20T11:00:00.000Z',
    }),
    /artifact-draft-not-material:substantive-artifact-required/,
  );

  assert.equal(service.getProject('research-artifact-quality').agentSubmissions.length, 0);
});

test('research artifact generation submits task-specific model content with evidence and handoff metadata', async () => {
  const service = createAgentProjectService({
    projects: [projectFixture()],
    messages: [],
    providerPolicy,
    llmProvider: modelProvider({
      title: 'Working hours and adolescent mental health evidence matrix',
      summary: 'Three traceable studies are compared by sample, exposure definition, outcome measure, confounding control, and evidentiary limitation.',
      body: '# Evidence matrix\n\nThe longitudinal study reports that longer weekly working hours precede higher stress scores after adjustment for baseline distress. The meta-analysis points in the same direction but shows substantial heterogeneity in age ranges and work-hour definitions. The youth cohort adds sleep duration as a plausible mediator.\n\n## Conflicts and limitations\n\nCross-sectional estimates cannot establish direction, self-selection into work remains a major confounder, and the three studies do not use an identical mental-health index.\n\n## Testable hypothesis\n\nAmong adolescents in paid work, additional weekly hours will predict a higher standardized stress score, partly mediated by shorter sleep duration.',
      tags: ['adolescent-health', 'working-hours'],
    }),
  });

  const result = await service.generateAgentArtifactDraft({
    projectId: 'research-artifact-quality',
    agentId: 'researcher',
    taskId: 'evidence-task',
    artifactType: 'evidence-packet',
    instruction: 'Produce the source-backed evidence matrix.',
    evidenceSearchIds: ['provider-search-1'],
    useModel: true,
    requireModel: true,
    submit: true,
    reviewerAgentId: 'reviewer',
    now: '2026-07-20T11:05:00.000Z',
  });

  assert.ok(result.submission);
  assert.equal(result.artifactDraft.modelUsed, true);
  assert.equal(result.materialOutcome.material, true);
  assert.equal(result.materialHandoff.artifactId, result.artifact.id);
  assert.equal(result.materialHandoff.submissionId, result.submission.id);
  assert.equal(result.materialHandoff.nextOwnerId, 'reviewer');
  assert.ok(result.materialHandoff.checksum);
});

test('Chinese artifact generation repairs an otherwise substantive English draft before submission', async () => {
  const project = projectFixture();
  project.language = 'zh';
  project.name = '青少年心理健康研究';
  project.objective = '研究青少年工作时间与心理健康之间的关联。';
  project.tasks[0].text = '综合工作时间与青少年心理健康证据。';
  project.tasks[0].workDefinition.deliverable = '证据矩阵与可检验假设。';
  let calls = 0;
  const llmProvider = {
    status: () => ({ provider: 'test-model', model: 'test-v1', enabled: true, configured: true }),
    createChatCompletion: async () => {
      calls += 1;
      return {
        ok: true,
        provider: 'test-model',
        model: 'test-v1',
        id: `model-response-${calls}`,
        json: calls === 1 ? {
          title: 'Adolescent work hours evidence matrix',
          summary: 'Three studies are compared with limitations and a testable hypothesis.',
          body: '# Findings\n\nLonger working hours are associated with distress, while sleep is a plausible mediator. The studies differ in exposure definitions and confounding controls.\n\n## Limitations\n\nThe current evidence does not establish a causal threshold.\n\n## Testable hypothesis\n\nFive additional weekly work hours predict higher distress through reduced sleep.',
        } : {
          title: '青少年工作时间证据矩阵',
          summary: '对三项研究的发现、限制与可检验假设进行比较。',
          body: '# 主要发现\n\n更长的工作时间与更高的心理压力相关，睡眠缩短是可能的中介路径。三项研究在暴露定义与混杂因素控制方面存在差异。\n\n## 冲突与限制\n\n现有证据尚不能确定统一的因果阈值，自我选择与家庭社会经济状况仍是重要混杂因素。\n\n## 可检验假设\n\n每周增加五小时工作将预测更高的标准化压力得分，并由睡眠时间缩短部分中介。',
        },
        usage: { total_tokens: 200 },
      };
    },
  };
  const service = createAgentProjectService({ projects: [project], messages: [], providerPolicy, llmProvider });

  const result = await service.generateAgentArtifactDraft({
    projectId: project.id,
    agentId: 'researcher',
    taskId: 'evidence-task',
    artifactType: 'evidence-packet',
    instruction: '生成来源可追溯的证据矩阵。',
    evidenceSearchIds: ['provider-search-1'],
    useModel: true,
    requireModel: true,
    submit: true,
    reviewerAgentId: 'reviewer',
    now: '2026-07-20T11:10:00.000Z',
  });

  assert.equal(calls, 2);
  assert.match(result.submission.body, /可检验假设/);
  assert.doesNotMatch(result.submission.body, /Longer working hours/);
});
