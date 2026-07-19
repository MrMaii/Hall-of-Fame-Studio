import assert from 'node:assert/strict';
import test from 'node:test';

import { buildArtifactDraftPromptBoundary } from '../src/agents/localPromptBoundary.js';
import {
  buildModelKickoffMeetingMessages,
  buildModelKickoffMeetingTurnMessages,
  buildModelKickoffOpeningLineMessages,
  buildModelKickoffTurnLineMessages,
  modelKickoffPayloadMatchesLanguage,
} from '../src/agents/modelKickoffParsing.js';
import { modelOutputLanguageInstruction, modelOutputMatchesLanguage } from '../src/agents/modelLanguagePolicy.js';
import { createModelProvider } from '../src/agents/modelProvider.js';

const team = [{ id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary' }];

test('all kickoff and artifact prompts carry the selected strict language contract', () => {
  const kickoffInputs = [
    buildModelKickoffMeetingMessages({ name: '中文项目', team, language: 'zh' }),
    buildModelKickoffMeetingTurnMessages({ meeting: { name: '中文项目', team }, language: 'zh' }),
    buildModelKickoffOpeningLineMessages({ name: '中文项目', team, language: 'zh' }),
    buildModelKickoffTurnLineMessages({ meeting: { name: '中文项目', team }, language: 'zh' }),
  ];
  for (const messages of kickoffInputs) {
    assert.match(messages[0].content, /Simplified Chinese only/);
    assert.match(messages[0].content, /Do not mix in English prose/);
  }

  const boundary = buildArtifactDraftPromptBoundary({
    project: { id: 'p_zh', name: '中文项目', language: 'zh' },
    agent: team[0],
    instruction: '生成项目摘要。',
  });
  assert.match(boundary.messages[0].content, /Simplified Chinese only/);
  assert.equal(JSON.parse(boundary.messages[1].content).language, 'zh');
});

test('language policy accepts selected-language prose and rejects mixed prose', () => {
  assert.match(modelOutputLanguageInstruction('en'), /English only/);
  assert.equal(modelOutputMatchesLanguage({ text: '只保留简体中文。', language: 'zh' }), true);
  assert.equal(modelOutputMatchesLanguage({ text: '这里混入 English prose。', language: 'zh' }), false);
  assert.equal(modelOutputMatchesLanguage({ text: 'English only response.', language: 'en' }), true);
  assert.equal(modelOutputMatchesLanguage({ text: 'English with 中文。', language: 'en' }), false);
  assert.equal(modelKickoffPayloadMatchesLanguage({ language: 'zh', team }, {
    roleTurns: [{ text: 'Steve Jobs 已确认首项交付。' }],
    decisionSummary: '团队可以继续。',
  }), true);
});

test('runtime intent fails closed when a Chinese project receives English prose', async () => {
  const calls = [];
  const provider = createModelProvider({
    provider: 'openai-compatible',
    apiKey: 'test-key',
    enabled: true,
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          intent: 'Continue the project in English.',
          publicSpeechIntent: 'English response.',
          privatePlan: [],
          timelineProof: '',
          risk: '',
        }) } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const result = await provider.createRuntimeIntent({
    project: { id: 'p_zh', name: '中文项目', language: 'zh', team },
    command: '继续',
  });
  assert.match(calls[0].messages[0].content, /Simplified Chinese only/);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'language-policy-violation');
  assert.equal(result.intent, null);
});
