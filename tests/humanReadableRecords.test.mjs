import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activitySentence,
  isConversationMessage,
  isMeaningfulActivitySentence,
} from '../src/project/humanReadableRecords.js';

test('operational logs are not conversation messages', () => {
  assert.equal(isConversationMessage({ source: 'timeline-log', eventType: 'project-settings-updated', text: 'Project settings changed.' }), false);
  assert.equal(isConversationMessage({ source: 'agent-work-cycle', eventType: 'agent-work-pulse', text: 'Worker ran.' }), false);
  assert.equal(isConversationMessage({ source: 'war-room-meeting-message', speaker: '孔子', text: '我建议先做小样本验证。' }), true);
  assert.equal(isConversationMessage({ recordKind: 'conversation', author: '林肯', text: '收到，我今天完成。' }), true);
});

test('workflow activity reads like a commit', () => {
  assert.equal(activitySentence({ eventType: 'task-completed', actor: '林肯', taskTitle: '登录页接口' }), '林肯完成了登录页接口');
  assert.equal(activitySentence({ eventType: 'approval', actor: '总监', targetName: '马斯克', object: '负责数据清理' }), '总监批准马斯克负责数据清理');
  assert.equal(activitySentence({ eventType: 'message-read', actor: '达·芬奇', object: '新的问卷分组要求' }), '达·芬奇读到了新的问卷分组要求');
});

test('generic internal labels are never meaningful activity titles', () => {
  for (const text of ['智能体运行记录', '管理记录', '项目设置修订 7 已更新。', 'Agent 脉冲']) {
    assert.equal(isMeaningfulActivitySentence(text), false);
  }
  assert.equal(isMeaningfulActivitySentence('林肯完成了登录页接口'), true);
  assert.equal(activitySentence({ eventType: 'agent-work-pulse', actor: '林肯', summary: 'Agent work pulse.' }), '');
});
