import assert from 'node:assert/strict';
import test from 'node:test';

import { submitProjectMeetingMessage } from '../src/agents/agentProjectService.js';

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
  assert.deepEqual(everyone.meetingAgentTurns.map((turn) => turn.speakerId), ['reviewer', 'leader', 'builder']);
});
