import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAgentProjectService,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';

test('transcript read models contain conversation while timeline and event proof retain operational records', () => {
  const projectId = 'conversation-boundary-project';
  const project = hydrateAgentProject({
    id: projectId,
    name: 'Conversation boundary',
    team: [{ id: 'confucius', name: '孔子', role: '研究员' }],
    initiation: {
      roleNegotiation: {
        transcript: [{
          id: 'kickoff_turn_1',
          type: 'role-question',
          speaker: '孔子',
          role: '研究员',
          text: '我建议先核对问卷样本。',
        }],
      },
      leaderElection: { transcript: [] },
      managerClarifications: [],
    },
    logs: [
      { id: 'log_settings_1', time: '2026-07-19T12:00:00.000Z', agent: 'Project Settings', eventType: 'project-settings-updated', sourceChannelId: 'main', log: 'Project settings revision 7 updated.' },
      { id: 'log_pulse_1', time: '2026-07-19T12:01:00.000Z', agent: '孔子', eventType: 'agent-work-pulse', sourceChannelId: 'main', log: '孔子完成了一次 Agent 工作脉冲。' },
      { id: 'log_management_1', time: '2026-07-19T12:02:00.000Z', agent: '孔子', eventType: 'management-check-in', sourceChannelId: 'main', log: '孔子发送了管理检查。' },
    ],
    eventLedger: [{ id: 'event_settings_1', sequence: 1, type: 'project-settings-updated', actor: 'Project Settings', summary: 'Project settings revision 7 updated.' }],
  });
  const service = createAgentProjectService({
    projects: [project],
    messages: [{
      id: 'chat_1',
      projectId,
      channelId: 'main',
      author: '孔子',
      role: '研究员',
      text: '我已经核对完第一批样本。',
      source: 'agent-to-agent-message',
    }],
  });

  const transcript = service.getChannelTranscript(projectId, 'main');
  const transcriptText = [...transcript.messages, ...transcript.archivedProofMessages].map((row) => row.text);

  assert.deepEqual(transcriptText.sort(), ['我已经核对完第一批样本。', '我建议先核对问卷样本。'].sort());
  assert.equal(service.getTimeline(projectId).logs.some((row) => row.eventType === 'agent-work-pulse'), true);
  assert.equal(service.getEventLedger(projectId).eventLedger.some((row) => row.type === 'project-settings-updated'), true);
});
