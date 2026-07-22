import assert from 'node:assert/strict';
import test from 'node:test';

import { appendModelKickoffMeetingTurns } from '../src/agents/agentProjectService.js';

const team = [
  { id: 'a', name: 'Agent A', role: 'Product Lead' },
  { id: 'b', name: 'Agent B', role: 'Reviewer' },
  { id: 'c', name: 'Agent C', role: 'Architect' },
];

test('persists only a bounded valid causal peer chain with convergence evidence', () => {
  const meeting = {
    id: 'meeting-1',
    projectId: 'project-1',
    name: 'Peer Meeting',
    brief: 'Choose a leader and delivery slice.',
    language: 'en',
    team,
    recommendedLeaderId: 'a',
    reviewerId: 'b',
    transcript: [
      {
        id: 'director-1',
        speakerId: 'director',
        speaker: 'Director',
        type: 'director-clarification',
        text: 'Discuss leadership and delivery risk.',
      },
    ],
    evidence: {},
  };

  const result = appendModelKickoffMeetingTurns({
    meeting,
    now: '2026-07-19T14:00:00.000Z',
    modelPayload: {
      agentTurns: [
        {
          id: 'candidate-a',
          agentId: 'a',
          type: 'leader-campaign',
          text: 'I volunteer to lead.',
          replyToTurnId: 'director-1',
          targetSpeakerId: 'director',
          interactionIntent: 'compete',
        },
        {
          id: 'challenge-b',
          agentId: 'b',
          type: 'adjustment',
          text: 'How will review stay independent?',
          replyToTurnId: 'candidate-a',
          targetSpeakerId: 'a',
          interactionIntent: 'challenge',
        },
        {
          id: 'answer-a',
          agentId: 'a',
          type: 'adjustment',
          text: 'B owns a blocking review gate.',
          replyToTurnId: 'challenge-b',
          targetSpeakerId: 'b',
          interactionIntent: 'clarify',
        },
        {
          id: 'challenge-b-2',
          agentId: 'b',
          type: 'adjustment',
          text: 'Who resolves a deadlock?',
          replyToTurnId: 'answer-a',
          targetSpeakerId: 'a',
          interactionIntent: 'challenge',
        },
        {
          id: 'argument-a-2',
          agentId: 'a',
          type: 'adjustment',
          text: 'I will keep arguing.',
          replyToTurnId: 'challenge-b-2',
          targetSpeakerId: 'b',
          interactionIntent: 'challenge',
        },
        {
          id: 'unknown-speaker',
          agentId: 'missing',
          text: 'This must not persist.',
          replyToTurnId: 'argument-a-2',
          interactionIntent: 'support',
        },
        {
          id: 'dangling-reply',
          agentId: 'c',
          text: 'This must not persist either.',
          replyToTurnId: 'not-a-turn',
          interactionIntent: 'clarify',
        },
      ],
      decisionSummary: 'A is the candidate; B owns the review gate.',
      risks: ['Deadlock resolution needs Director input.'],
    },
    modelResult: { provider: 'test', model: 'test-model', id: 'response-1' },
    modelProviderStatus: { enabled: true },
  });

  const peerTurns = result.transcript.slice(1);
  assert.deepEqual(peerTurns.map((turn) => turn.id), [
    'candidate-a',
    'challenge-b',
    'answer-a',
    'challenge-b-2',
    'argument-a-2',
  ]);
  assert.deepEqual(peerTurns.map((turn) => turn.replyToTurnId), [
    'director-1',
    'candidate-a',
    'challenge-b',
    'answer-a',
    'challenge-b-2',
  ]);
  assert.equal(peerTurns.at(-1).interactionIntent, 'synthesize');
  assert.equal(result.discussionState.status, 'converged');
  assert.equal(result.discussionState.peerExchangeCount, 3);
  assert.equal(result.evidence.peerInteractionEdgeCount, 3);
  assert.deepEqual(result.evidence.convergedTopicIds, ['meeting-1_topic']);
  assert.equal(result.evidence.droppedMeetingTurnCount, 2);
  assert.equal(result.evidence.modelTurnIds.includes('unknown-speaker'), false);
  assert.equal(result.evidence.modelTurnIds.includes('dangling-reply'), false);
});
