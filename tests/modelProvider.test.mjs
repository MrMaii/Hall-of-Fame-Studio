// Characterization tests: lock in modelProvider behavior (incl. BUG-002/BUG-003 fixes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelProvider } from '../src/agents/modelProvider.js';

const okResponse = (payload) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(payload),
});

const makeProvider = (payload, options = {}) => {
  const calls = [];
  const provider = createModelProvider({
    provider: options.provider || 'openai-compatible',
    apiKey: 'test-key',
    enabled: true,
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      const next = Array.isArray(payload) ? payload[Math.min(calls.length - 1, payload.length - 1)] : payload;
      return okResponse(typeof next === 'function' ? next(calls.length) : next);
    },
    ...options.config,
  });
  return { provider, calls };
};

const messages = [{ role: 'user', content: 'hello' }];

test('extracts plain string content (openai shape)', async () => {
  const { provider } = makeProvider({ choices: [{ message: { content: 'hi there' }, finish_reason: 'stop' }] });
  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.ok, true);
  assert.equal(result.content, 'hi there');
  assert.equal(result.finishReason, 'stop');
});

test('extracts array-of-parts content (openai content blocks)', async () => {
  const { provider } = makeProvider({
    choices: [{ message: { content: [{ type: 'text', text: 'part one' }, { text: 'part two' }] } }],
  });
  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.content, 'part one\npart two');
});

test('extracts anthropic content blocks', async () => {
  const { provider } = makeProvider(
    { content: [{ type: 'text', text: 'claude says' }] },
    { provider: 'anthropic' },
  );
  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.content, 'claude says');
});

test('extracts gemini candidate parts', async () => {
  const { provider } = makeProvider(
    { candidates: [{ content: { parts: [{ text: 'gemini says' }] } }] },
    { provider: 'gemini' },
  );
  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.content, 'gemini says');
});

test('BUG-002: empty content with finish_reason=length returns explicit error, not ok', async () => {
  const { provider } = makeProvider({ choices: [{ message: { content: '' }, finish_reason: 'length' }] });
  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.ok, false);
  assert.match(result.error, /empty content/);
  assert.equal(result.finishReason, 'length');
});

test('json mode extracts fenced JSON object', async () => {
  const { provider } = makeProvider({
    choices: [{ message: { content: '```json\n{"ok": true}\n```' } }],
  });
  const result = await provider.createChatCompletion({ messages, json: true });
  assert.deepEqual(result.json, { ok: true });
});

test('disabled provider skips with reason missing-api-key', async () => {
  const provider = createModelProvider({ enabled: true, apiKey: '', fetchImpl: async () => okResponse({}) });
  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'missing-api-key');
});

test('blockedModels policy is evaluated dynamically after setConfig', async () => {
  const { provider } = makeProvider(
    { choices: [{ message: { content: 'x' } }] },
    { config: { blockedModels: ['blocked-*'], model: 'safe-model' } },
  );
  assert.equal(provider.blockedByPolicy, false);
  provider.setConfig({ model: 'blocked-model' });
  assert.equal(provider.blockedByPolicy, true);
  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'model-blocked');
});

test('BUG-003: setConfig updates model and baseURL used in requests', async () => {
  const { provider, calls } = makeProvider({ choices: [{ message: { content: 'x' } }] });
  provider.setConfig({ baseURL: 'https://custom.example.com/v1/', model: 'custom-model' });
  await provider.createChatCompletion({ messages });
  assert.ok(calls[0].url.startsWith('https://custom.example.com/v1'));
  assert.equal(calls[0].body.model, 'custom-model');
});

test('BUG-003: test() sends lightweight OK health check, not JSON demand', async () => {
  const { provider, calls } = makeProvider({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] });
  const result = await provider.test();
  assert.equal(result.ok, true);
  assert.ok(calls[0].body.max_tokens <= 128);
  assert.match(JSON.stringify(calls[0].body.messages), /OK/);
});

test('status() redacts base URL and reports api key source', () => {
  const { provider } = makeProvider({ choices: [] });
  const status = provider.status();
  assert.equal(status.hasApiKey, true);
  assert.equal(status.apiKeySource, 'direct-config');
  assert.ok(!JSON.stringify(status).includes('test-key'));
});
