import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNoMaterialDeltaState,
  calculateOutcomeProgress,
  classifyProjectWork,
  classifyTaskWork,
  evaluateMaterialOutcome,
  normalizeOutcomeWorkContract,
} from '../src/agents/outcomeDrivenExecution.js';

const researchProject = {
  id: 'teen-health-research',
  name: '青少年心理健康指数与每天工作时间关联性的学习',
  objective: '搜索可靠研究，分析青少年心理健康指数与每天工作时间的关联，并形成可发表论文。',
  team: [
    { id: 'researcher', name: 'Researcher', role: 'Evidence Researcher' },
    { id: 'reviewer', name: 'Reviewer', role: 'Independent Reviewer' },
  ],
  tasks: [{
    id: 'evidence-task',
    text: '检索并综合青少年工作时间和心理健康的研究证据',
    ownerId: 'researcher',
    reviewerAgentId: 'reviewer',
    status: 'in-progress',
    dueAt: '2026-07-21T12:00:00.000Z',
    workDefinition: {
      deliverable: '带来源和可信度判断的证据矩阵',
      acceptanceCriteria: ['至少三项可追溯来源', '说明证据冲突和局限'],
    },
  }],
};

test('research work contract requires provider evidence and a content-bearing reviewed deliverable', () => {
  assert.equal(classifyProjectWork(researchProject).kind, 'research');

  const contract = normalizeOutcomeWorkContract({
    project: researchProject,
    task: researchProject.tasks[0],
    agent: researchProject.team[0],
  });

  assert.equal(contract.schemaVersion, 'outcome-work-contract/v1');
  assert.equal(contract.ownerId, 'researcher');
  assert.equal(contract.reviewerAgentId, 'reviewer');
  assert.equal(contract.actionType, 'research');
  assert.equal(contract.evidencePolicy.providerRequired, true);
  assert.ok(contract.requiredTools.includes('search'));
  assert.ok(contract.acceptanceCriteria.length >= 2);
  assert.equal(contract.deliverable, '带来源和可信度判断的证据矩阵');
});

test('outcome contracts never assign the task owner as their own reviewer', () => {
  const project = {
    ...researchProject,
    governance: { reviewerId: 'researcher' },
    team: [
      { id: 'researcher', name: 'Researcher', role: 'Evidence Researcher' },
      { id: 'risk-reviewer', name: 'Risk Reviewer', role: 'Risk and Ethics Reviewer' },
      { id: 'leader', name: 'Leader', role: 'Project Leader' },
    ],
  };
  const task = { ...researchProject.tasks[0], reviewerAgentId: 'researcher' };

  const contract = normalizeOutcomeWorkContract({ project, task, agent: project.team[0] });

  assert.equal(contract.ownerId, 'researcher');
  assert.equal(contract.reviewerAgentId, 'risk-reviewer');
  assert.notEqual(contract.handoffTargetId, contract.ownerId);
});

test('coordination receipts and template prose are not material outcomes', () => {
  const result = evaluateMaterialOutcome({
    project: researchProject,
    task: researchProject.tasks[0],
    artifact: {
      id: 'template-artifact',
      content: '# Work Summary\nContinue the next work pulse and publish timeline evidence.',
    },
    messages: [{ id: 'ack', text: 'Received. I will continue and report progress.' }],
  });

  assert.equal(result.material, false);
  assert.equal(result.accepted, false);
  assert.ok(result.blockers.includes('provider-evidence-required'));
  assert.ok(result.blockers.includes('substantive-artifact-required'));
  assert.ok(result.blockers.includes('accepted-review-required'));
});

test('provider evidence plus a substantive accepted submission is a material outcome', () => {
  const evidenceSearch = {
    id: 'search-1',
    provider: 'tavily',
    searchMode: 'provider-search',
    status: 'completed',
    sources: [
      { id: 'source-1', title: 'Longitudinal adolescent wellbeing study', url: 'https://example.test/study-1' },
      { id: 'source-2', title: 'Working hours and stress meta-analysis', url: 'https://example.test/study-2' },
      { id: 'source-3', title: 'Youth employment cohort', url: 'https://example.test/study-3' },
    ],
    findings: ['Longer weekly work hours correlate with higher reported stress after adjustment.'],
  };
  const submission = {
    id: 'submission-1',
    taskId: 'evidence-task',
    artifactType: 'evidence-packet',
    title: '青少年工作时间与心理健康证据矩阵',
    summary: '综合三项可追溯研究，比较样本、暴露变量、心理健康量表、效应方向和主要局限。',
    body: '# 证据矩阵\n\n本矩阵比较三项独立研究的样本、工作时间定义、心理健康测量、混杂因素和效应方向，并标记纵向证据与横断面证据的差异。研究结果提示较长工时与压力上升相关，但因果解释仍受到自我选择、社会经济状态和测量误差限制。\n\n## 可检验假设\n每周工作时长增加与压力指数上升相关，且睡眠时长可能发挥中介作用。',
    evidenceSearchIds: ['search-1'],
    checksum: 'a'.repeat(64),
    version: 1,
  };
  const review = {
    id: 'review-1',
    submissionId: 'submission-1',
    taskId: 'evidence-task',
    verdict: 'accepted',
  };

  const result = evaluateMaterialOutcome({
    project: researchProject,
    task: researchProject.tasks[0],
    artifact: { id: 'artifact-1', content: submission.body, checksum: submission.checksum, version: 1 },
    evidenceSearches: [evidenceSearch],
    submissions: [submission],
    reviews: [review],
  });

  assert.equal(result.material, true);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.handoff.artifactId, 'artifact-1');
  assert.equal(result.handoff.version, 1);
  assert.equal(result.handoff.checksum, submission.checksum);
  assert.equal(result.handoff.nextOwnerId, 'reviewer');
});

test('outcome progress counts accepted tasks, never activity volume', () => {
  const project = {
    ...researchProject,
    progress: 87,
    messages: Array.from({ length: 100 }, (_, index) => ({ id: `message-${index}` })),
    eventLedger: Array.from({ length: 500 }, (_, index) => ({ id: `event-${index}` })),
    tasks: [
      { id: 'accepted', status: 'done', outcome: { accepted: true } },
      { id: 'busy', status: 'in-progress', workPulseCount: 50 },
      { id: 'blocked', status: 'blocked', outcome: { accepted: false } },
      { id: 'pending', status: 'pending' },
    ],
  };

  assert.equal(calculateOutcomeProgress(project), 25);
});

test('no-output breaker stalls after two cycles without a material delta', () => {
  const first = buildNoMaterialDeltaState({ previous: null, material: false, now: '2026-07-20T10:00:00.000Z' });
  const second = buildNoMaterialDeltaState({ previous: first, material: false, now: '2026-07-20T10:05:00.000Z' });
  assert.equal(first.status, 'watching');
  assert.equal(second.status, 'STALLED_NO_MATERIAL_DELTA');
  assert.equal(second.consecutiveNoMaterialCycles, 2);

  const recovered = buildNoMaterialDeltaState({ previous: second, material: true, now: '2026-07-20T10:10:00.000Z' });
  assert.equal(recovered.status, 'productive');
  assert.equal(recovered.consecutiveNoMaterialCycles, 0);
});

test('technical, creative, and operations projects reuse the same outcome protocol', () => {
  const cases = [
    [{ workModeContract: { workMode: 'technical-delivery' }, objective: 'Ship and test an API.' }, 'technical-delivery', ['workspace', 'test']],
    [{ workModeContract: { workMode: 'creative-studio' }, objective: 'Design campaign concepts.' }, 'creative', ['workspace', 'evaluation']],
    [{ objective: 'Inspect production health, apply the approved change, and verify recovery.' }, 'operations', ['inspection', 'verification']],
  ];

  for (const [project, kind, requiredTools] of cases) {
    const classification = classifyProjectWork(project);
    assert.equal(classification.kind, kind);
    const contract = normalizeOutcomeWorkContract({
      project,
      task: { id: `${kind}-task`, text: project.objective, ownerId: 'owner' },
      agent: { id: 'owner', role: kind },
    });
    for (const tool of requiredTools) assert.ok(contract.requiredTools.includes(tool), `${kind} requires ${tool}`);
  }
});

test('a research project stays research when one downstream task designs its study framework', () => {
  const project = {
    name: 'Adolescent work hours and mental health study',
    objective: 'Research the association and publish an evidence-backed paper.',
    tasks: [
      { id: 'framework', text: 'Design the study framework and variable relationships.' },
    ],
  };

  assert.equal(classifyProjectWork(project).kind, 'research');
  assert.equal(classifyTaskWork({
    project,
    task: project.tasks[0],
    agent: { id: 'designer', role: 'Research designer' },
  }).kind, 'research');
});

test('management work stays managerial inside a research project while specialist work inherits research execution', () => {
  const project = {
    ...researchProject,
    tasks: [],
  };
  const manager = { id: 'director', role: 'Project Director' };
  const researcher = { id: 'thinker', role: 'Philosopher' };

  assert.equal(classifyTaskWork({
    project,
    task: { text: 'Coordinate deliverables, deadlines, dependencies, and reviews' },
    agent: manager,
  }).kind, 'general');
  assert.equal(classifyTaskWork({
    project,
    task: { text: 'Deliver the first formal philosophy work product' },
    agent: researcher,
  }).kind, 'research');
});

test('specialized projects cannot claim material output without their own proof shape', () => {
  const technical = evaluateMaterialOutcome({
    project: { workModeContract: { workMode: 'technical-delivery' } },
    task: { id: 'code-task', text: 'Fix the API bug and verify the build.' },
    submissions: [{ id: 'code-submission', taskId: 'code-task', body: 'The API bug is discussed in detail with a proposed implementation, risks, and a long verification plan that is specific to the failing endpoint and expected response contract.' }],
  });
  assert.equal(technical.material, false);
  assert.ok(technical.blockers.includes('technical-change-and-verification-proof-required'));

  const creative = evaluateMaterialOutcome({
    project: { workModeContract: { workMode: 'creative-studio' } },
    task: { id: 'creative-task', text: 'Create campaign concepts.' },
    submissions: [{ id: 'creative-submission', taskId: 'creative-task', body: 'Option 1: A documentary-led campaign built around authentic participant stories and a restrained visual language. Option 2: A participatory challenge campaign using bold motion, creator prompts, and public progress markers. The first option is selected because trust is the primary objective.' }],
  });
  assert.equal(creative.material, true);
  assert.ok(creative.blockers.includes('accepted-review-required'));
});
