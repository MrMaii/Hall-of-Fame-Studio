import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProjectAssetCatalog,
  describeProjectOutcome,
  describeTaskAsset,
  taskAssetProgress,
} from '../src/project/workOutputSemantics.js';
import { normalizeActivityNodeForDisplay } from '../src/project/humanReadableRecords.js';

const project = {
  id: 'plain-language-research',
  name: '关于青少年心理健康指数与他们每天工作时间关联性的学习',
  objective: '研究青少年心理健康与每天工作时间的关系，并形成可以发表的研究论文。',
  language: 'zh',
  team: [
    { id: 'lead', name: '负责人', role: 'Research Director', isLeader: true },
    { id: 'method', name: '方法研究员', role: 'Data Analyst' },
    { id: 'reviewer', name: '审阅人', role: 'Evidence Reviewer' },
  ],
  tasks: [
    {
      id: 'method-task',
      ownerId: 'method',
      text: '设计“关于青少年心理健康指数与他们每天工作时间关联性的学习”的研究框架、变量关系与交付结构',
      status: 'in-progress',
      workPulseCount: 8,
      requiredWorkPulses: 9,
      workDefinition: {},
    },
  ],
  agentSubmissions: [],
  submissionReviews: [],
};

test('project and role work are named after outcomes people can open and use', () => {
  const outcome = describeProjectOutcome(project, 'zh');
  const taskAsset = describeTaskAsset({ project, task: project.tasks[0], agent: project.team[1], language: 'zh' });

  assert.equal(outcome.title, '青少年心理健康与每天工作时间关系研究论文');
  assert.equal(taskAsset.title, '青少年心理健康与每天工作时间关系研究设计方案');
  assert.equal(taskAsset.taskText, '完成《青少年心理健康与每天工作时间关系研究设计方案》');
  assert.equal(taskAsset.fileName, '青少年心理健康与每天工作时间关系研究设计方案.md');
  assert.match(taskAsset.purpose, /说明.*如何研究|研究问题.*方法/);
  assert.doesNotMatch(`${taskAsset.title} ${taskAsset.taskText} ${taskAsset.purpose}`, /统筹|伦理边界|证据标准|验收门槛|交付结构/);
});

test('activity pulses cannot impersonate material progress or public workflow nodes', () => {
  assert.equal(taskAssetProgress({ project, task: project.tasks[0] }), 10);

  const pulse = normalizeActivityNodeForDisplay({
    id: 'pulse',
    subtype: 'agent-work-pulse',
    agentName: '方法研究员',
    taskId: 'method-task',
    title: 'Agent work pulse',
  }, { object: project.tasks[0].text });
  assert.equal(pulse.publiclyVisible, false);
});

test('workspace catalog presents a file identity and a plain-language ownership state', () => {
  const catalog = buildProjectAssetCatalog(project, 'zh');
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].title, '青少年心理健康与每天工作时间关系研究设计方案');
  assert.equal(catalog[0].displayName, '青少年心理健康与每天工作时间关系研究设计方案');
  assert.equal(catalog[0].extension, '.md');
  assert.equal(catalog[0].fileName, '青少年心理健康与每天工作时间关系研究设计方案.md');
  assert.equal(catalog[0].formatLabel, 'Markdown');
  assert.equal(catalog[0].ownerName, '方法研究员');
  assert.equal(catalog[0].statusLabel, '制作中');
  assert.equal(catalog[0].statusSummary, '方法研究员 正在制作');
  assert.equal(catalog[0].fileAvailable, false);
  assert.equal(catalog[0].path, 'agent-artifacts/青少年心理健康与每天工作时间关系研究设计方案.md');
});

test('workspace catalog collapses duplicate tasks and never lets a submission record rename the file', () => {
  const duplicateProject = {
    ...project,
    team: [
      ...project.team,
      { id: 'writer', name: '报告作者', role: 'Researcher' },
    ],
    tasks: [
      {
        id: 'report-old',
        ownerId: 'writer',
        status: 'pending',
        dueAt: '2026-07-23T12:00:00.000Z',
        assignedAt: '2026-07-22T12:00:00.000Z',
        workDefinition: {
          artifactTitle: '青少年工作时间专题研究报告',
          artifactFileName: '青少年工作时间专题研究报告.md',
        },
      },
      {
        id: 'report-current',
        ownerId: 'writer',
        status: 'done',
        workDefinition: {
          artifactTitle: '青少年工作时间专题研究报告',
          artifactFileName: '青少年工作时间专题研究报告.md',
        },
      },
    ],
    agentSubmissions: [
      {
        id: 'submission-report',
        taskId: 'report-current',
        title: '报告作者提交的研究记录',
        agentId: 'writer',
        committerIds: ['writer'],
        reviewStatus: 'accepted',
        workspaceRelativePath: 'agent-artifacts/青少年工作时间专题研究报告.md',
        artifact: { fileName: '青少年工作时间专题研究报告.md' },
        updatedAt: '2026-07-22T13:00:00.000Z',
      },
    ],
  };

  const catalog = buildProjectAssetCatalog(duplicateProject, 'zh');
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].displayName, '青少年工作时间专题研究报告');
  assert.equal(catalog[0].fileName, '青少年工作时间专题研究报告.md');
  assert.deepEqual(catalog[0].taskIds.sort(), ['report-current', 'report-old']);
  assert.equal(catalog[0].statusLabel, '已完成');
  assert.equal(catalog[0].statusSummary, '作者：报告作者');
  assert.equal(catalog[0].fileAvailable, true);
  assert.notEqual(catalog[0].displayName, duplicateProject.agentSubmissions[0].title);
});

test('not-started files explain the planned owner, start time, and estimated duration', () => {
  const plannedProject = {
    ...project,
    tasks: [{
      id: 'planned-report',
      ownerId: 'method',
      status: 'pending',
      assignedAt: '2026-07-22T12:00:00.000Z',
      dueAt: '2026-07-23T12:00:00.000Z',
      workDefinition: {
        artifactTitle: '青少年工作时间专题研究报告',
        artifactFileName: '青少年工作时间专题研究报告.md',
      },
    }],
  };

  const [asset] = buildProjectAssetCatalog(plannedProject, 'zh');
  assert.equal(asset.statusLabel, '未开始');
  assert.match(asset.statusSummary, /计划由 方法研究员 于/);
  assert.equal(asset.statusDetail, '预计约 1 天');
});
