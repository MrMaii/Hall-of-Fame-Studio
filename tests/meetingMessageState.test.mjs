import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMeetingUserEntry,
  meetingMessageStatusLabel,
  meetingTranscriptEntryFromMessage,
  mergeMeetingTranscript,
  selectMeetingResponders,
  updateMeetingMessageStatus,
} from '../src/meeting/meetingMessageState.js';

test('creates an immediately visible user entry before backend work starts', () => {
  const entry = createMeetingUserEntry({
    id: 'message-1',
    text: '请确认收到',
    submittedAt: '2026-07-11T23:50:00.000Z',
  });
  assert.deepEqual(entry, {
    id: 'message-1',
    speaker: 'Director',
    role: 'User',
    text: '请确认收到',
    score: 10,
    source: 'war-room-meeting-message',
    proofIds: ['message-1'],
    eventIds: [],
    submittedAt: '2026-07-11T23:50:00.000Z',
    deliveryStatus: 'submitting',
    retryable: false,
    error: null,
  });
});

test('restores persisted meeting messages after a local restart without duplicates', () => {
  const director = meetingTranscriptEntryFromMessage({
    id: 'persisted-user',
    projectId: 'project-1',
    author: 'Director',
    authorId: 'director',
    text: 'Persist this question',
    time: 'War Room',
    sentAt: '2026-07-12T00:20:00.000Z',
  });
  const agent = meetingTranscriptEntryFromMessage({
    id: 'persisted-agent',
    author: 'Leader',
    authorId: 'leader',
    role: 'Leader',
    text: 'Persist this answer',
    source: 'war-room-meeting-agent-turn',
    createdAt: '2026-07-12T00:20:01.000Z',
  });
  assert.equal(director.deliveryStatus, 'completed');
  assert.equal(agent.deliveryStatus, undefined);
  assert.equal(meetingTranscriptEntryFromMessage({ id: 'chat', text: 'not a meeting', source: 'project-chat' }), null);

  const merged = mergeMeetingTranscript([{ id: 'system', speaker: 'System', text: 'Ready' }, director], [director, agent]);
  assert.deepEqual(merged.map((entry) => entry.id), ['system', 'persisted-user', 'persisted-agent']);
});

test('updates message delivery state without duplicating the user entry', () => {
  const entries = [createMeetingUserEntry({ id: 'message-1', text: '开始' })];
  const saved = updateMeetingMessageStatus(entries, 'message-1', 'saved');
  const completed = updateMeetingMessageStatus(saved, 'message-1', 'completed');
  assert.equal(completed.length, 1);
  assert.equal(completed[0].deliveryStatus, 'completed');
  assert.equal(meetingMessageStatusLabel('completed', 'zh'), '已完成');
  assert.equal(meetingMessageStatusLabel('failed', 'zh'), '提交失败，可重试');

  const timedOut = updateMeetingMessageStatus(completed, 'message-1', 'timed-out');
  assert.equal(timedOut[0].retryable, true);
  assert.equal(meetingMessageStatusLabel('timed-out', 'zh'), '等待超时，可重试');
  assert.equal(meetingMessageStatusLabel('superseded', 'zh'), '已由新消息替代');
});

test('uses the leader by default and includes all members only for an explicit all-member request', () => {
  const team = [
    { id: 'reviewer', name: 'Reviewer', role: 'Reviewer' },
    { id: 'leader', name: 'Leader', role: 'Leader' },
    { id: 'builder', name: 'Builder', role: 'Engineer' },
  ];
  assert.deepEqual(selectMeetingResponders(team, '请给出下一步').map((member) => member.id), ['leader']);
  assert.deepEqual(selectMeetingResponders(team, '@all 请分别回答').map((member) => member.id), ['reviewer', 'leader', 'builder']);
  assert.deepEqual(selectMeetingResponders(team, '@所有人 请分别回答').map((member) => member.id), ['reviewer', 'leader', 'builder']);
  assert.deepEqual(selectMeetingResponders(team, '@Builder 请检查实现').map((member) => member.id), ['builder']);
});
