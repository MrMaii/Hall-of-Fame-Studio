import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMeetingContextPacket,
  MEETING_MAX_PEER_EXCHANGES,
  normalizeMeetingInteractionChain,
} from '../src/agents/meetingInteractionProtocol.js';

const team = [
  { id: 'a', name: 'Agent A', role: 'Product Lead' },
  { id: 'b', name: 'Agent B', role: 'Reviewer' },
  { id: 'c', name: 'Agent C', role: 'Architect' },
];

function meeting(overrides = {}) {
  return {
    id: 'meeting-1',
    projectId: 'project-1',
    name: 'Peer Meeting',
    brief: 'Choose a leader and agree on the first delivery slice.',
    team,
    recommendedLeaderId: 'a',
    transcript: [
      {
        id: 'director-1',
        speakerId: 'director',
        speaker: 'Director',
        type: 'director-clarification',
        text: 'Discuss leadership and delivery risk.',
      },
    ],
    ...overrides,
  };
}

test('normalizes a causal challenge and synthesis chain between valid peers', () => {
  const result = normalizeMeetingInteractionChain({
    meeting: meeting(),
    now: '2026-07-19T12:00:00.000Z',
    turns: [
      {
        id: 'candidate-a',
        agentId: 'a',
        type: 'leader-campaign',
        text: 'I volunteer to lead the first slice.',
        replyToTurnId: 'director-1',
        interactionIntent: 'compete',
      },
      {
        id: 'challenge-b',
        agentId: 'b',
        text: 'How will you protect independent review?',
        replyToTurnId: 'candidate-a',
        targetSpeakerId: 'a',
        interactionIntent: 'challenge',
      },
      {
        id: 'answer-a',
        agentId: 'a',
        text: 'B owns the review gate and can block release.',
        replyToTurnId: 'challenge-b',
        targetSpeakerId: 'b',
        interactionIntent: 'clarify',
      },
      {
        id: 'summary-a',
        agentId: 'a',
        text: 'Proposal: A leads delivery and B owns the independent gate.',
        replyToTurnId: 'answer-a',
        targetSpeakerId: 'a',
        interactionIntent: 'synthesize',
      },
    ],
  });

  assert.deepEqual(result.turns.map((turn) => turn.id), [
    'candidate-a',
    'challenge-b',
    'answer-a',
    'summary-a',
  ]);
  assert.equal(result.turns[1].replyToTurnId, 'candidate-a');
  assert.equal(result.turns[1].targetSpeakerId, 'a');
  assert.equal(result.turns[1].interactionIntent, 'challenge');
  assert.deepEqual(result.turns[1].addressedAgentIds, ['a']);
  assert.equal(result.turns[3].interactionIntent, 'synthesize');
  assert.equal(result.state.synthesizerId, 'a');
  assert.equal(result.state.status, 'converged');
  assert.equal(result.state.peerExchangeCount, 3);
});

test('uses the confirmed leader as synthesizer', () => {
  const result = normalizeMeetingInteractionChain({
    meeting: meeting({
      leaderElectionResolution: {
        managerConfirmed: true,
        selectedLeaderId: 'c',
      },
    }),
    turns: [
      { id: 'turn-a', agentId: 'a', text: 'A view', replyToTurnId: 'director-1' },
      { id: 'turn-b', agentId: 'b', text: 'B challenge', replyToTurnId: 'turn-a', interactionIntent: 'challenge' },
      { id: 'turn-c', agentId: 'c', text: 'C summary', replyToTurnId: 'turn-b', interactionIntent: 'synthesize' },
    ],
  });

  assert.equal(result.state.synthesizerId, 'c');
  assert.equal(result.turns.at(-1).agentId, 'c');
});

test('drops unknown speakers, dangling replies, and self-replies', () => {
  const result = normalizeMeetingInteractionChain({
    meeting: meeting(),
    turns: [
      { id: 'valid-a', agentId: 'a', text: 'Valid opening', replyToTurnId: 'director-1' },
      { id: 'unknown', agentId: 'missing', text: 'Unknown agent', replyToTurnId: 'valid-a' },
      { id: 'dangling', agentId: 'b', text: 'Missing parent', replyToTurnId: 'missing-turn' },
      { id: 'self', agentId: 'a', text: 'Self reply', replyToTurnId: 'valid-a', interactionIntent: 'challenge' },
    ],
  });

  assert.deepEqual(result.turns.map((turn) => turn.id), ['valid-a']);
  assert.equal(result.state.droppedTurnCount, 3);
});

test('caps peer contention and forces convergence instead of an A/B loop', () => {
  const result = normalizeMeetingInteractionChain({
    meeting: meeting(),
    maxPeerExchanges: MEETING_MAX_PEER_EXCHANGES,
    turns: [
      { id: 'a-1', agentId: 'a', text: 'A proposal', replyToTurnId: 'director-1' },
      { id: 'b-1', agentId: 'b', text: 'B challenge one', replyToTurnId: 'a-1', interactionIntent: 'challenge' },
      { id: 'a-2', agentId: 'a', text: 'A answer', replyToTurnId: 'b-1', interactionIntent: 'clarify' },
      { id: 'b-2', agentId: 'b', text: 'B challenge two', replyToTurnId: 'a-2', interactionIntent: 'challenge' },
      { id: 'a-3', agentId: 'a', text: 'A keeps arguing', replyToTurnId: 'b-2', interactionIntent: 'challenge' },
    ],
  });

  assert.equal(result.state.peerExchangeCount, MEETING_MAX_PEER_EXCHANGES);
  assert.equal(result.state.status, 'converged');
  assert.equal(result.turns.length, 5);
  assert.equal(result.turns.at(-1).agentId, 'a');
  assert.equal(result.turns.at(-1).interactionIntent, 'synthesize');
  assert.match(result.turns.at(-1).text, /Director|总监/);
});

test('creates stable ids and defaults for a minimal provider batch', () => {
  const result = normalizeMeetingInteractionChain({
    meeting: meeting(),
    now: '2026-07-19T12:34:56.000Z',
    turns: [
      { agentId: 'a', text: 'I can lead.' },
      { agentId: 'b', text: 'I want an independent review gate.' },
    ],
  });

  assert.deepEqual(result.turns.map((turn) => turn.id), [
    'meeting-1_peer_turn_1784464496000_1',
    'meeting-1_peer_turn_1784464496000_2',
  ]);
  assert.equal(result.turns[0].replyToTurnId, 'director-1');
  assert.equal(result.turns[1].replyToTurnId, result.turns[0].id);
  assert.equal(result.turns[1].targetSpeakerId, 'a');
  assert.equal(result.turns[1].interactionIntent, 'clarify');
});

test('builds a bounded context packet with decisions and unresolved questions', () => {
  const transcript = Array.from({ length: 12 }, (_, index) => ({
    id: `turn-${index + 1}`,
    speakerId: index % 2 ? 'a' : 'b',
    speaker: index % 2 ? 'Agent A' : 'Agent B',
    type: index === 11 ? 'leader-campaign' : 'role-volunteer',
    text: index === 0
      ? 'OLD VERBATIM CONTENT MUST NOT SURVIVE COMPACTION'
      : `Recent discussion point ${index + 1}`,
    interactionIntent: index === 11 ? 'compete' : 'clarify',
  }));
  const packet = buildMeetingContextPacket({
    meeting: meeting({
      language: 'en',
      transcript,
      discussionState: {
        topicId: 'leadership-topic',
        peerExchangeCount: 2,
        status: 'active',
        synthesizerId: 'a',
      },
      evidence: {
        decisionSummary: 'A is the current leader candidate; B keeps the review gate.',
        risks: ['Independent review could be weakened.'],
      },
      roleQuestionResolutions: [
        {
          questionId: 'question-1',
          speakerId: 'b',
          questionText: 'Who can block release?',
          answered: false,
        },
      ],
    }),
    latestDirectorInput: 'Converge and tell me what remains unresolved.',
    maxRecentTurns: 6,
    maxCharacters: 2200,
  });

  assert.equal(packet.project.id, 'project-1');
  assert.equal(packet.project.name, 'Peer Meeting');
  assert.equal(packet.leadership.recommendedLeaderId, 'a');
  assert.equal(packet.discussionState.topicId, 'leadership-topic');
  assert.equal(packet.recentTurns.length, 6);
  assert.equal(packet.compactedTurnCount, 6);
  assert.equal(packet.decisionSummary, 'A is the current leader candidate; B keeps the review gate.');
  assert.deepEqual(packet.risks, ['Independent review could be weakened.']);
  assert.equal(packet.openQuestions[0].questionText, 'Who can block release?');
  assert.equal(JSON.stringify(packet).includes('OLD VERBATIM CONTENT'), false);
  assert.equal(JSON.stringify(packet).length <= 2200, true);
});

test('honors a tight character budget without dropping required decision state', () => {
  const longText = 'implementation detail '.repeat(80);
  const packet = buildMeetingContextPacket({
    meeting: meeting({
      transcript: Array.from({ length: 10 }, (_, index) => ({
        id: `long-${index}`,
        speakerId: index % 2 ? 'a' : 'b',
        text: longText,
      })),
      evidence: {
        decisionSummary: 'Keep independent review.',
        risks: ['Release ownership is unresolved.'],
      },
      roleQuestionResolutions: [
        { questionId: 'q-tight', questionText: 'Who owns release?', answered: false },
      ],
    }),
    latestDirectorInput: longText,
    maxRecentTurns: 6,
    maxCharacters: 1200,
  });

  assert.equal(JSON.stringify(packet).length <= 1200, true);
  assert.equal(packet.decisionSummary, 'Keep independent review.');
  assert.deepEqual(packet.risks, ['Release ownership is unresolved.']);
  assert.equal(packet.openQuestions[0].questionText, 'Who owns release?');
  assert.equal(packet.compactedTurnCount > 0, true);
});
