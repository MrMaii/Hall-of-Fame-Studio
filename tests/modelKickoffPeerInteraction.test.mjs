import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildModelKickoffMeetingTurnMessages,
  parseModelTurnLinePayload,
} from '../src/agents/modelKickoffParsing.js';

const team = [
  { id: 'a', name: 'Agent A', role: 'Product Lead' },
  { id: 'b', name: 'Agent B', role: 'Reviewer' },
  { id: 'c', name: 'Agent C', role: 'Architect' },
];

test('requests a bounded causal peer exchange instead of parallel Director replies', () => {
  const messages = buildModelKickoffMeetingTurnMessages({
    meeting: {
      id: 'meeting-1',
      projectId: 'project-1',
      name: 'Peer Meeting',
      brief: 'Choose a leader and delivery slice.',
      language: 'en',
      team,
      recommendedLeaderId: 'a',
      discussionState: {
        topicId: 'leadership-topic',
        peerExchangeCount: 1,
        status: 'active',
        synthesizerId: 'a',
      },
      evidence: {
        decisionSummary: 'A volunteered to lead.',
        risks: ['Independent review is unresolved.'],
      },
      roleQuestionResolutions: [
        { questionId: 'q-1', questionText: 'Who can block release?', answered: false },
      ],
      transcript: Array.from({ length: 10 }, (_, index) => ({
        id: `turn-${index + 1}`,
        speakerId: index % 2 ? 'a' : 'b',
        text: index === 0 ? 'OLD RAW TRANSCRIPT' : `Discussion ${index + 1}`,
      })),
    },
    latestDirectorInput: 'Challenge the proposal, then converge.',
    language: 'en',
    now: '2026-07-19T13:00:00.000Z',
  });

  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /replyToTurnId/);
  assert.match(messages[0].content, /interactionIntent/);
  assert.match(messages[0].content, /targetSpeakerId/);
  assert.match(messages[0].content, /2 or 3 causal peer exchanges/);
  assert.match(messages[0].content, /synthesize or escalate/);

  const input = JSON.parse(messages[1].content);
  assert.equal(input.contextPacket.discussionState.topicId, 'leadership-topic');
  assert.equal(input.contextPacket.recentTurns.length <= 6, true);
  assert.equal(JSON.stringify(input).includes('OLD RAW TRANSCRIPT'), false);
  assert.equal(input.recentTranscript, undefined);
  assert.equal(input.requiredShape.agentTurns[0].replyToTurnId.includes('earlier'), true);
  assert.equal(input.requiredShape.agentTurns[0].interactionIntent.includes('support'), true);
});

test('keeps the simple line fallback available for one model turn', () => {
  const payload = parseModelTurnLinePayload('b | clarifying-question | Who owns the review gate?', { team });
  assert.equal(payload.agentTurns.length, 1);
  assert.equal(payload.agentTurns[0].agentId, 'b');
  assert.equal(payload.agentTurns[0].text, 'Who owns the review gate?');
});

test('live kickoff continuation uses the compact causal JSON prompt as its primary call', () => {
  const serviceSource = readFileSync(new URL('../src/agents/agentProjectService.js', import.meta.url), 'utf8');
  const start = serviceSource.indexOf('async clarifyKickoffMeetingAsync');
  const end = serviceSource.indexOf('confirmKickoffMeetingLeader({ meetingId', start);
  const clarificationSource = serviceSource.slice(start, end);
  const firstProviderCall = clarificationSource.slice(
    clarificationSource.indexOf('let completion = await llmProvider.createChatCompletion'),
    clarificationSource.indexOf('if (!completion.ok)'),
  );

  assert.match(firstProviderCall, /buildModelKickoffMeetingTurnMessages/);
  assert.match(firstProviderCall, /json: true/);
  assert.doesNotMatch(firstProviderCall, /buildModelKickoffTurnLineMessages/);
});
