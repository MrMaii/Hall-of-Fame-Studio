import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProjectMeetingSession,
  submitProjectMeetingMessage,
} from '../src/agents/agentProjectService.js';

const project = {
  id: 'meeting-responder-project',
  name: 'Meeting Responder Project',
  team: [
    { id: 'reviewer', name: 'Reviewer', role: 'Reviewer' },
    { id: 'leader', name: 'Leader', role: 'Leader', isLeader: true },
    { id: 'builder', name: 'Builder', role: 'Engineer' },
  ],
};

test('backend meeting defaults to the leader and honors explicit participant scope', () => {
  const leaderOnly = submitProjectMeetingMessage({
    project,
    text: 'Give the next action.',
    now: '2026-07-12T00:30:00.000Z',
  });
  assert.deepEqual(leaderOnly.meetingAgentTurns.map((turn) => turn.speakerId), ['leader']);

  const builderOnly = submitProjectMeetingMessage({
    project,
    text: '@Builder check the implementation.',
    now: '2026-07-12T00:31:00.000Z',
  });
  assert.deepEqual(builderOnly.meetingAgentTurns.map((turn) => turn.speakerId), ['builder']);

  const everyone = submitProjectMeetingMessage({
    project,
    text: '@all give one short answer.',
    now: '2026-07-12T00:32:00.000Z',
  });
  assert.deepEqual(everyone.meetingAgentTurns.map((turn) => turn.speakerId), ['reviewer', 'builder', 'leader']);
  assert.equal(everyone.meetingAgentTurns[0].replyToTurnId, everyone.userMessage.id);
  assert.equal(everyone.meetingAgentTurns[1].replyToTurnId, everyone.meetingAgentTurns[0].messageId);
  assert.equal(everyone.meetingAgentTurns[1].targetSpeakerId, 'reviewer');
  assert.equal(everyone.meetingAgentTurns[1].interactionIntent, 'challenge');
  assert.equal(everyone.meetingAgentTurns[2].replyToTurnId, everyone.meetingAgentTurns[1].messageId);
  assert.equal(everyone.meetingAgentTurns[2].interactionIntent, 'synthesize');
});

test('a confirmed project meeting makes every selected attendee hear, intend, and discuss', () => {
  const started = createProjectMeetingSession({
    project,
    agenda: 'Confirm the release decision and assign the next work.',
    participantIds: ['leader', 'reviewer', 'builder'],
    recorderId: 'reviewer',
    meetingSessionId: 'meeting-session-1',
    now: '2026-07-22T12:00:00.000Z',
  });
  assert.equal(started.meetingSession.participantIds.length, 3);
  assert.equal(started.meetingSession.recorderId, 'reviewer');
  assert.equal(started.messages.length, 3);

  const discussed = submitProjectMeetingMessage({
    project: started.project,
    meetingSessionId: started.meetingSession.id,
    text: 'Tell me what we should decide and what happens next.',
    now: '2026-07-22T12:01:00.000Z',
  });
  assert.deepEqual(discussed.userMessage.heardByAgentIds, ['leader', 'reviewer', 'builder']);
  assert.deepEqual(discussed.meetingIntentions.map((intent) => intent.speakerId), ['leader', 'reviewer', 'builder']);
  assert.equal(discussed.meetingAgentTurns.length, 3);
  assert.equal(discussed.meetingAgentTurns[1].replyToTurnId, discussed.meetingAgentTurns[0].messageId);
  assert.equal(discussed.meetingAgentTurns[2].interactionIntent, 'synthesize');
  assert.deepEqual(discussed.meetingSession.rounds[0].heardByParticipantIds, ['leader', 'reviewer', 'builder']);
  assert.equal(discussed.meetingSession.rounds[0].intentionAgentIds.length, 3);
});
