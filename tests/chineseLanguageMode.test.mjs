import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import { handleFeatureChangeRequest } from '../src/agents/agentRuntime.js';
import { localizeManagerFlowGraphReadModel } from '../src/i18n/managerFlowChinese.js';
import { localizeText, localizeVisibleSystemText } from '../src/i18n/runtime.js';

function chineseProject(overrides = {}) {
  return {
    id: 'chinese-language-mode-project',
    name: '青少年睡眠与心理压力调查',
    status: 'active',
    createdAt: '2026-07-19T12:00:00.000Z',
    updatedAt: '2026-07-19T12:00:00.000Z',
    team: [
      { id: 'musk', name: 'Elon Musk', role: 'Project Lead', isLeader: true },
      { id: 'confucius', name: 'Confucius', role: 'Reviewer' },
    ],
    tasks: [],
    agentStates: {},
    logs: [],
    eventLedger: [],
    agentSubmissions: [],
    submissionReviews: [],
    ...overrides,
  };
}

test('an inherited Chinese preference is persisted as the project effective language', () => {
  const service = createAgentProjectService({ projects: [chineseProject()] });

  const result = service.setProjectSettings({
    projectId: 'chinese-language-mode-project',
    language: null,
    inheritedLanguage: 'zh',
    now: '2026-07-19T12:05:00.000Z',
  });

  assert.equal(result.project.language, undefined);
  assert.equal(result.project.projectSettings.effectiveLanguage, 'zh');
  assert.equal(service.getProjectSettings('chinese-language-mode-project').effectiveLanguage, 'zh');
});

test('backend read models honor a persisted inherited Chinese language', () => {
  const project = chineseProject({
    projectSettings: {
      schemaVersion: 'project-settings/v1',
      language: null,
      effectiveLanguage: 'zh',
      revision: 1,
    },
  });
  const service = createAgentProjectService({ projects: [project] });

  const graph = service.getManagerFlowGraph(project.id);

  assert.equal(graph.zoomRules.medium.label, '智能体工作路径');
  assert.equal(graph.zoomRules.expanded.label, '聊天、报告、证据与详情');
});

test('Chinese mode translates built-in screenshot copy without retaining English words', () => {
  const builtInCopy = [
    'Ideas, collaboration, execution, and supporting evidence',
    'Private-pilot go-live is waiting for release candidate, launch run, or post-launch health proof.',
    'Elon Musk leads; Confucius reviews.',
    'Project membership',
    'Proof Map / API Route',
    'Agent Intent',
    'Roundtable Room',
    'War Room',
    'Group Channels',
    'Open project tools',
    'High-weight meeting turns, decisions, and Agent intent routing.',
    'Daily project communication, @mentions, acknowledgements, and task cards.',
    'Agent work, decisions, changes, reports, and proof in one protocol graph.',
    'Google Chat',
    'Visionary / Product Visionary / Skill v0.4.0',
    'VISIONARY / PRODUCT VISIONARY / SKILL V0.4.0',
    'Composable Skill Layer',
    'Manager Demo: Autonomous Agent Studio',
    'Manager demo scene loaded: kickoff, election, assignments, meeting change, Google Chat change, 24/7 work, and timeline proof.',
    'A manager-ready demo where agents clarify roles, campaign for leadership, assign work in chat, run continuously, and accept mid-project changes from Google Chat. Output: polished end-to-end manager walkthrough with timeline proof.',
  ];

  for (const source of builtInCopy) {
    const localized = localizeText(source, 'zh');
    assert.doesNotMatch(localized, /[A-Za-z]{2,}/, `${source} remained mixed as: ${localized}`);
  }
});

test('strict Chinese visible-system localization never leaves mixed generated prose', () => {
  const generatedCopy = [
    'Project snapshot has backend catalog, initiation, or receipt evidence',
    'Backend timeline read model',
    'Agent Runs',
    'Backend Agent run model',
    'Let Elon Musk coordinate the next execution pulse while Elon Musk keeps the first evidence report current.',
    'Kickoff Generation Source',
    'Provider-backed kickoff meeting / model-provider-backed',
    'Provider-backed kickoff generation still requires production provider controls, eval policy, incident handling, and managed audit storage.',
    'reading-chat',
    'completed-task',
    'needs-evidence',
    '25 management evidence logs',
    'Submit completed work as an Agent artifact node.',
    'Confucius: @Leonardo da Vinci peer-management check-in from my Agent pulse. Keep "our dependency" moving and post the next evidence marker.',
    'Let candidates campaign, then confirm the Leader marker.',
    'Confirm next actions and start fixed Agent routines.',
    'Ask the Leader to @assign work and have the assignee start immediately.',
    'Confirm work progress reaches the big timeline while chat stays inspectable.',
    'Broadcast a new feature request through the meeting path and Google Chat.',
    'Verify agents discussed the change and the responsible Leader confirmed it.',
    'Run or inspect peer-management check-ins so agents manage each other continuously.',
  ];

  for (const source of generatedCopy) {
    assert.doesNotMatch(localizeVisibleSystemText(source, 'zh'), /[A-Za-z]{2,}/, source);
  }
  assert.equal(localizeVisibleSystemText('/projects/project_123/manager-dashboard', 'zh'), '/projects/project_123/manager-dashboard');
  assert.equal(localizeVisibleSystemText('POST', 'zh'), 'POST');
  assert.equal(
    localizeVisibleSystemText('Body template: {"projectId":"project_123","status":"in-progress"}', 'zh'),
    '请求体模板: {"projectId":"project_123","status":"in-progress"}',
  );
});

test('strict Chinese DOM localization preserves technical terms inside localized settings copy', () => {
  for (const source of [
    'AI 模型',
    '本机或自定义 http://127.0.0.1:11434/v1',
    '例如：http://127.0.0.1:11434/v1',
    '例如：llama3.2',
    '这个本地模型不需要密钥（例如默认配置的 Ollama）',
    'Ollama',
  ]) {
    assert.equal(localizeVisibleSystemText(source, 'zh'), source);
  }
  assert.equal(localizeVisibleSystemText('Loading the project 时间线…', 'zh'), '项目记录');
  assert.equal(localizeText('Sync runtime', 'zh'), '同步运行时');
  assert.equal(localizeVisibleSystemText('Sync runtime', 'zh'), '同步运行时');
});

test('the Chinese talent market keeps every built-in candidate identifiable', () => {
  for (const [source, expected] of [
    ['Albert Einstein', '阿尔伯特·爱因斯坦'],
    ['Isaac Newton', '艾萨克·牛顿'],
    ['William Shakespeare', '威廉·莎士比亚'],
  ]) {
    assert.equal(localizeText(source, 'zh'), expected);
    assert.equal(localizeVisibleSystemText(source, 'zh'), expected);
  }
});

test('Chinese manager flow projection removes generated English while preserving exact user content', () => {
  const userText = '请保留 research 与 Abraham 这两个原始词。';
  const graph = localizeManagerFlowGraphReadModel({
    zoomRules: {
      expanded: {
        label: 'Ideas, collaboration, execution, and supporting evidence',
        description: 'High-weight meeting turns, decisions, and Agent intent routing.',
      },
    },
    nodes: [
      {
        id: 'node_project_membership_policy_revision_1',
        category: 'communication',
        categoryLabel: 'Communication',
        subtype: 'project-membership-policy',
        title: 'Project membership policy revision 1 was updated for the current team.',
        description: 'Elon Musk leads; Confucius reviews.',
        summary: 'Private-pilot go-live is waiting for release candidate proof.',
        commitMessage: 'Autonomous Run Control ran "Submit completed owned work" through agent-autonomous-action-queue.',
        agentName: 'Elon Musk',
        status: 'published',
        importance: 'major',
        thinkingFrame: {
          checklist: ['refresh ownership map', 'publish decision delta'],
        },
        submission: {
          intent: 'Submit completed work as an Agent artifact node.',
          submissionMotivation: {
            whyNow: 'No explicit publication rationale was recorded.',
            evidencePlan: ['artifact-or-work-record', 'timeline-log'],
          },
        },
      },
      {
        id: 'node_user_clarification',
        category: 'communication',
        categoryLabel: 'Communication',
        subtype: 'director-clarification',
        title: userText,
        description: userText,
        summary: userText,
        commitMessage: userText,
        status: 'published',
        importance: 'major',
      },
    ],
  }, {
    language: 'zh',
    userAuthoredFragments: [undefined, userText],
  });

  assert.equal(graph.nodes[1].title, userText);
  assert.equal(graph.nodes[1].description, userText);
  assert.equal(graph.nodes[1].summary, userText);
  assert.equal(graph.nodes[1].commitMessage, userText);

  const generatedText = JSON.stringify({
    zoomRules: graph.zoomRules,
    node: {
      categoryLabel: graph.nodes[0].categoryLabel,
      subtypeLabel: graph.nodes[0].subtypeLabel,
      title: graph.nodes[0].title,
      description: graph.nodes[0].description,
      summary: graph.nodes[0].summary,
      commitMessage: graph.nodes[0].commitMessage,
      agentName: graph.nodes[0].agentName,
      statusLabel: graph.nodes[0].statusLabel,
      importanceLabel: graph.nodes[0].importanceLabel,
      submission: graph.nodes[0].submission,
    },
  });
  assert.doesNotMatch(generatedText, /\b(?:Project|membership|policy|revision|updated|Communication|Elon|Musk|leads|Confucius|reviews|Private|pilot|release|candidate|Autonomous|Run|Control|Submit|completed|owned|work|Agent|artifact|published|major|explicit|publication|rationale|recorded)\b/i);
});

test('Chinese mode localizes built-in project roles and settings activity', () => {
  assert.equal(localizeText('Leader', 'zh'), '负责人');
  assert.equal(
    localizeText('Project settings revision 5 updated language to inherit, privacy policy to project-local/redacted.', 'zh'),
    '项目设置修订 5 已更新。',
  );
  assert.equal(
    localizeText("Elon Musk responded to Abraham Lincoln's management signal and folded it into the current Agent work pulse.", 'zh'),
    '埃隆·马斯克 已回应 亚伯拉罕·林肯 的管理信号，并将其纳入当前智能体工作脉冲。',
  );
  assert.equal(
    localizeText('Elon Musk sent a peer-management check-in to Leonardo da Vinci from an independent Agent worker pulse.', 'zh'),
    '埃隆·马斯克 通过独立智能体工作器脉冲向 列奥纳多·达·芬奇 发送了同级管理检查。',
  );
});

test('Chinese mode localizes the complete manager demo brief', () => {
  const localized = localizeText('Manager Demo: Autonomous Agent Studio A manager-ready demo where agents clarify roles, campaign for leadership, assign work in chat, run continuously, and accept mid-project changes from Google Chat. Output: polished end-to-end manager walkthrough with timeline evidence.', 'zh');
  assert.doesNotMatch(localized, /[A-Za-z]{2,}/);
});

test('Chinese localization preserves technical routes while translating their labels', () => {
  assert.equal(
    localizeText('Project read model: /projects/:id', 'zh'),
    '项目读取模型: /projects/:id',
  );
});

test('English mode translates embedded Chinese skill labels', () => {
  const localized = localizeText('Elon Musk: 从0到1产品突破与赛道重定义 / 研究综述', 'en');
  assert.doesNotMatch(localized, /[\u3400-\u9fff]/);
});

test('Chinese Agent templates preserve user-entered English exactly', () => {
  const result = handleFeatureChangeRequest({
    project: chineseProject({ language: 'zh' }),
    text: 'Add export summary',
    language: 'zh',
  });
  const generated = JSON.stringify({
    changeTask: result.changeTask,
    discussionMessages: result.discussionMessages,
    logs: result.logs,
  });
  assert.match(generated, /Add export summary/);
  assert.doesNotMatch(generated, /Add export 简介/);
});

test('Chinese mode translates Agent assignment templates while preserving the assigned task', () => {
  const task = 'Build agent communication contract for group chat';
  const assignment = localizeText(`@Alan Turing please take ownership of "${task}". Report progress in the work stream and push every meaningful update to the timeline.`, 'zh');
  assert.match(assignment, new RegExp(task));
  assert.doesNotMatch(assignment.replace(task, ''), /[A-Za-z]{2,}/);
});

test('the flow graph has no untranslated built-in projectText labels in Chinese mode', () => {
  const source = readFileSync(new URL('../src/project/AdvancedProjectTimeline.jsx', import.meta.url), 'utf8');
  const builtInLabels = [...source.matchAll(/projectText\('([^']+)'\)/g)].map((match) => match[1]);
  const untranslated = [...new Set(builtInLabels)]
    .map((label) => ({ label, localized: localizeText(label, 'zh') }))
    .filter(({ label, localized }) => label !== 'ID' && /[A-Za-z]{2,}/.test(localized));

  assert.deepEqual(untranslated, []);
});

test('the language validator strips technical tokens instead of allowlisting whole mixed lines', () => {
  const source = readFileSync(new URL('../scripts/validate-language-system.mjs', import.meta.url), 'utf8');
  assert.match(source, /withoutTechnicalTokens\.replace\(new RegExp\(allowPattern\.source/);
  assert.ok(source.includes(".replace(/\\/[A-Za-z0-9_./#?=&%-]+/g, ' ')"));
  assert.doesNotMatch(source, /!\(allowPattern && allowPattern\.test\(line\)\)/);
});
