import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractBalancedJsonObject,
  findMeetingAgent,
  modelKickoffPayloadMatchesTopic,
  normalizeModelArray,
  parseModelCompletionJson,
  parseModelLineTurns,
  parseModelOpeningLinePayload,
  safeParseModelJson,
  topicTermsForMeeting,
} from '../src/agents/modelKickoffParsing.js';

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect' },
];

describe('normalizeModelArray', () => {
  it('wraps single object', () => {
    assert.deepEqual(normalizeModelArray({ a: 1 }), [{ a: 1 }]);
  });
});

describe('safeParseModelJson / extractBalancedJsonObject', () => {
  it('parses fenced JSON with trailing comma normalized', () => {
    const raw = 'Here is output:\n```json\n{\'roleTurns\': [{\'agentId\': \'jobs\', \'type\': \'role-question\', \'text\': \'Scope?\'}],}\n```';
    const parsed = extractBalancedJsonObject(raw);
    assert.ok(parsed?.roleTurns?.length === 1);
    assert.equal(parsed.roleTurns[0].agentId, 'jobs');
  });

  it('parseModelCompletionJson prefers completion.json', () => {
    assert.deepEqual(parseModelCompletionJson({ json: { ok: true } }), { ok: true });
  });
});

describe('parseModelLineTurns', () => {
  it('parses pipe-delimited opening lines', () => {
    const content = 'jobs | role-question | What is the MVP scope for HallBot?\nturing | role-volunteer | I can own architecture for HallBot.';
    const turns = parseModelLineTurns(content, team, { mode: 'opening' });
    assert.equal(turns.length, 2);
    assert.equal(turns[0].agentId, 'jobs');
    assert.match(turns[0].text, /HallBot/);
    assert.deepEqual(turns[0].hears, ['turing']);
  });
});

describe('parseModelOpeningLinePayload', () => {
  it('falls back to line format when JSON missing', () => {
    const payload = parseModelOpeningLinePayload(
      'jobs | role-question | Confirm HallBot launch criteria?',
      { team, name: 'HallBot Studio', brief: 'Build HallBot assistant' },
    );
    assert.ok(payload?.roleTurns?.length);
    assert.equal(payload.decisionSummary, 'Opening clarification started.');
  });
});

describe('topic matching', () => {
  it('modelKickoffPayloadMatchesTopic accepts on-topic payload', () => {
    const input = { name: 'HallBot Studio', brief: 'Build HallBot for founders' };
    const payload = {
      roleTurns: [{ text: 'HallBot needs a clear MVP for founders.' }],
      decisionSummary: 'HallBot scope discussion started.',
      risks: [],
    };
    assert.equal(modelKickoffPayloadMatchesTopic(input, payload), true);
  });

  it('topicTermsForMeeting extracts latin tokens', () => {
    const terms = topicTermsForMeeting({ name: 'HallBot Studio', brief: 'assistant' });
    assert.ok(terms.includes('hallbot'));
  });
});

describe('findMeetingAgent', () => {
  it('matches id or name case-insensitively', () => {
    assert.equal(findMeetingAgent(team, 'JOBS')?.id, 'jobs');
    assert.equal(findMeetingAgent(team, 'Alan Turing')?.id, 'turing');
    assert.equal(findMeetingAgent(team, 'missing'), null);
  });
});
