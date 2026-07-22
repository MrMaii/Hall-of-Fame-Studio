import test from 'node:test';
import assert from 'node:assert/strict';

import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const GENERIC_TITLE = /智能体运行记录|管理记录|项目设置修订|Agent\s*脉冲|工作脉冲|管理检查|流程记录|系统记录/;

test('timeline hides control-plane records while retaining them for internal traceability', () => {
  const projectId = 'human-readable-workflow-project';
  const service = createAgentProjectService({
    projects: [{
      id: projectId,
      name: '自然节点流',
      language: 'zh',
      status: 'active',
      team: [
        { id: 'lincoln', name: '林肯', role: '工程师' },
        { id: 'confucius', name: '孔子', role: '负责人' },
        { id: 'davinci', name: '达·芬奇', role: '设计师' },
      ],
      tasks: [
        { id: 'login-api', text: '登录页接口', ownerId: 'lincoln', assignee: '林肯', status: 'in-progress' },
        { id: 'survey-prototype', text: '完成问卷原型', ownerId: 'davinci', assignee: '达·芬奇', status: 'in-progress' },
      ],
      logs: [
        { id: 'settings_7', time: '2026-07-19T15:00:00.000Z', actor: '总监', agent: 'Project Settings', eventType: 'project-settings-updated', log: 'Project settings revision 7 updated.' },
        { id: 'pulse_1', time: '2026-07-19T15:01:00.000Z', agentId: 'lincoln', agent: '林肯', taskId: 'login-api', eventType: 'agent-work-pulse', log: 'Agent work pulse.' },
        { id: 'check_1', time: '2026-07-19T15:02:00.000Z', agentId: 'confucius', agent: '孔子', targetAgentId: 'davinci', taskId: 'survey-prototype', eventType: 'management-check-in', log: 'Management check-in.' },
      ],
      eventLedger: [],
      agentStates: {},
    }],
    messages: [],
  });

  const graph = service.getManagerFlowGraph(projectId);
  const nodes = Object.fromEntries(graph.nodes
    .filter((node) => node.id.startsWith('timeline-log-'))
    .map((node) => [node.id, node]));

  assert.equal(nodes['timeline-log-settings_7'].publiclyVisible, false);
  assert.equal(nodes['timeline-log-pulse_1'].publiclyVisible, false);
  assert.equal(nodes['timeline-log-check_1'].publiclyVisible, false);
  assert.equal(nodes['timeline-log-check_1'].subtype, 'management-check-in');
  assert.equal(Object.values(nodes).every((node) => !GENERIC_TITLE.test(node.displayTitle)), true);
});

test('manager flow names submissions and reviews after the deliverable itself', () => {
  const projectId = 'deliverable-named-workflow-project';
  const service = createAgentProjectService({
    projects: [{
      id: projectId,
      name: '青少年心理健康研究',
      objective: '完成青少年心理健康研究论文。',
      language: 'zh',
      status: 'active',
      team: [
        { id: 'researcher', name: '研究员', role: '研究员' },
        { id: 'reviewer', name: '审阅人', role: '证据审阅人' },
      ],
      tasks: [{ id: 'report', text: '完成《青少年心理健康专题研究报告》', ownerId: 'researcher', status: 'in-progress' }],
      agentSubmissions: [{
        id: 'report-v1',
        taskId: 'report',
        agentId: 'researcher',
        title: '青少年心理健康专题研究报告',
        summary: '汇总主要发现和依据。',
        body: '这是一份包含研究问题、方法、资料来源、主要发现、局限和结论的完整研究报告正文。',
        reviewStatus: 'accepted',
        status: 'submitted',
      }],
      submissionReviews: [{
        id: 'review-v1',
        submissionId: 'report-v1',
        taskId: 'report',
        reviewerAgentId: 'reviewer',
        verdict: 'accepted',
        comments: '结论与证据对应，可以交付。',
      }],
      logs: [],
      eventLedger: [],
      agentStates: {},
    }],
    messages: [],
  });

  const graph = service.getManagerFlowGraph(projectId);
  const submission = graph.nodes.find(node => node.id === 'agent-submission-report-v1');
  const review = graph.nodes.find(node => node.id === 'submission-review-review-v1');

  assert.equal(submission.displayTitle, '青少年心理健康专题研究报告');
  assert.equal(review.displayTitle, '《青少年心理健康专题研究报告》已通过审阅');
  assert.doesNotMatch(`${submission.displayTitle} ${review.displayTitle}`, /提交记录|运行记录|reviewed submission/i);
});
