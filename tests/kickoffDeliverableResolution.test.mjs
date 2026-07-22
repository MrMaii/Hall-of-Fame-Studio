import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildKickoffDeliverableResolution,
  kickoffDeliverablesReady,
  kickoffDeliverablesToTasks,
} from '../src/agents/kickoffDeliverables.js';
import { buildModelKickoffMeetingMessages, buildModelKickoffMeetingTurnMessages } from '../src/agents/modelKickoffParsing.js';
import {
  appendModelKickoffMeetingTurns,
  approveKickoffMeetingSession,
  confirmKickoffMeetingDeliverables,
  confirmKickoffMeetingLeader,
  confirmKickoffMeetingNextActions,
  createKickoffMeetingSession,
} from '../src/agents/agentProjectService.js';

const team = [
  { id: 'lead', name: '负责人', role: 'Product Lead' },
  { id: 'writer', name: '报告作者', role: 'Researcher' },
  { id: 'reviewer', name: '审阅人', role: 'Evidence Reviewer' },
];

const deliverables = [{
  id: 'research-report',
  title: '青少年工作时间专题研究报告',
  fileName: '青少年工作时间专题研究报告.md',
  ownerId: 'writer',
  purpose: '让用户直接阅读研究结论。',
  acceptanceCriteria: ['结论有证据支持，并由审阅人通过。'],
}];

test('kickoff deliverables are structured files rather than next-action labels', () => {
  const resolution = buildKickoffDeliverableResolution({
    deliverables,
    team,
    selectedLeaderId: 'lead',
    managerConfirmed: true,
    now: '2026-07-22T12:00:00.000Z',
    language: 'zh',
  });
  assert.equal(kickoffDeliverablesReady(resolution), true);
  assert.equal(resolution.deliverables[0].formatLabel, 'Markdown');
  assert.equal(resolution.deliverables[0].ownerName, '报告作者');

  const [task] = kickoffDeliverablesToTasks(resolution, { language: 'zh' });
  assert.equal(task.text, '完成《青少年工作时间专题研究报告》');
  assert.equal(task.workDefinition.artifactFileName, '青少年工作时间专题研究报告.md');
  assert.deepEqual(task.workDefinition.acceptanceCriteria, ['结论有证据支持，并由审阅人通过。']);
});

test('Agents proactively raise deliverables and approval is blocked until the Director confirms them', () => {
  const meeting = createKickoffMeetingSession({
    meetingId: 'meeting-deliverables',
    projectId: 'project-deliverables',
    name: '青少年工作时间研究',
    brief: '形成可阅读的专题研究报告。',
    team,
    selectedLeaderId: 'lead',
    reviewerId: 'reviewer',
    deliverables,
    nextActions: [{ id: 'next-1', text: '先核对研究范围', ownerId: 'lead' }],
    language: 'zh',
    now: '2026-07-22T12:00:00.000Z',
  });

  assert.equal(meeting.deliverableResolution.status, 'awaiting-manager-confirmation');
  assert.ok(meeting.transcript.some(turn => turn.stage === 'deliverable-confirmation' && /青少年工作时间专题研究报告\.md/.test(turn.text)));
  assert.throws(() => approveKickoffMeetingSession({ meeting, selectedLeaderId: 'lead', reviewerId: 'reviewer', language: 'zh' }), /deliverables-must-be-confirmed/);

  const withLeader = confirmKickoffMeetingLeader({ meeting, selectedLeaderId: 'lead', now: '2026-07-22T12:01:00.000Z' });
  const withActions = confirmKickoffMeetingNextActions({ meeting: withLeader, tasks: meeting.nextActions, now: '2026-07-22T12:02:00.000Z' });
  const confirmed = confirmKickoffMeetingDeliverables({ meeting: withActions, deliverables, now: '2026-07-22T12:03:00.000Z', language: 'zh' });
  const approved = approveKickoffMeetingSession({
    meeting: confirmed,
    selectedLeaderId: 'lead',
    reviewerId: 'reviewer',
    now: '2026-07-22T12:04:00.000Z',
    language: 'zh',
  });

  assert.equal(approved.project.initiation.deliverableResolution.managerConfirmed, true);
  assert.equal(approved.project.tasks.length, 1, 'Leader planning must not invent extra file deliverables for unassigned team members.');
  assert.equal(approved.project.tasks[0].workDefinition.artifactFileName, '青少年工作时间专题研究报告.md');
  assert.equal(approved.kickoffCharter.deliverables[0].fileName, '青少年工作时间专题研究报告.md');
  assert.equal(approved.meeting.managerDecision.deliverableIds[0], 'research-report');
  assert.equal(approved.project.initiation.nextActionResolution.tasks[0].text, '先核对研究范围');
});

test('model kickoff contracts ask for deliverables in both the opening and continuation stages', () => {
  const opening = buildModelKickoffMeetingMessages({ name: '测试项目', brief: '做一个报告', team, language: 'zh' });
  const continuation = buildModelKickoffMeetingTurnMessages({ meeting: { name: '测试项目', brief: '做一个报告', team }, language: 'zh' });
  assert.match(opening[0].content, /deliverables item/);
  const shape = JSON.parse(continuation[1].content).requiredShape;
  assert.ok(Array.isArray(shape.deliverables));
  assert.match(continuation[0].content, /propose the final files/);
});

test('a later Agent proposal replaces the draft deliverable resolution without confirming it', () => {
  const meeting = createKickoffMeetingSession({
    meetingId: 'meeting-model-deliverables',
    projectId: 'project-model-deliverables',
    name: '交付物讨论',
    brief: '明确最终文件。',
    team,
    deliverables,
    language: 'zh',
    now: '2026-07-22T12:00:00.000Z',
  });
  const next = appendModelKickoffMeetingTurns({
    meeting,
    modelPayload: {
      agentTurns: [{
        agentId: 'writer',
        type: 'deliverable-proposal',
        text: '我建议再增加一份证据清单，请总监确认。',
        replyToTurnId: meeting.transcript[0].id,
        targetSpeakerId: 'director',
        interactionIntent: 'synthesize',
      }],
      deliverables: [{
        title: '研究证据清单',
        fileName: '研究证据清单.xlsx',
        ownerId: 'writer',
        purpose: '核对每项结论的来源。',
        acceptanceCriteria: ['所有结论都有来源。'],
      }],
    },
    now: '2026-07-22T12:05:00.000Z',
  });
  assert.equal(next.deliverableResolution.deliverables[0].fileName, '研究证据清单.xlsx');
  assert.equal(next.deliverableResolution.managerConfirmed, false);
  assert.ok(next.transcript.some(turn => turn.stage === 'deliverable-confirmation'));
});
