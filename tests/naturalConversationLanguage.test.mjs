import test from 'node:test';
import assert from 'node:assert/strict';

import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const FORBIDDEN_VISIBLE_TERMS = /Agent\s*脉冲|工作脉冲|管理信号|管理检查|证据标记|智能体运行记录|管理记录/;

test('Agent work-cycle messages speak like teammates instead of runtime telemetry', () => {
  const projectId = 'natural-conversation-project';
  const service = createAgentProjectService({
    projects: [{
      id: projectId,
      name: '自然沟通项目',
      language: 'zh',
      status: 'active',
      team: [
        { id: 'lead', name: '孔子', role: '负责人', isLeader: true, managedIds: ['builder'] },
        { id: 'builder', name: '达·芬奇', role: '设计师', managerId: 'lead' },
      ],
      tasks: [{ id: 'prototype', text: '完成问卷原型', ownerId: 'lead', assignee: '孔子', status: 'in-progress' }],
      agentStates: {
        lead: { status: 'working', managedIds: ['builder'], currentPlan: { taskId: 'prototype', focus: '完成问卷原型' } },
        builder: { status: 'working', currentPlan: { focus: '补齐问卷交互' } },
      },
      logs: [],
      eventLedger: [],
    }],
    messages: [],
  });

  const result = service.runAgentWorkCycle({
    projectId,
    agentId: 'lead',
    now: '2026-07-19T14:00:00.000Z',
    trigger: 'natural-language-contract',
  });
  const visibleText = result.messages.map((message) => `${message.time || ''} ${message.text || ''}`).join('\n');

  assert.equal(FORBIDDEN_VISIBLE_TERMS.test(visibleText), false, visibleText);
  assert.equal(result.messages.every((message) => message.author === '孔子'), true);
  assert.equal(result.messages.some((message) => message.text.includes('完成问卷原型')), true);
  assert.equal(result.messages.some((message) => message.text.includes('@达·芬奇')), false, 'owned work must not emit a management courtesy check-in');
});
