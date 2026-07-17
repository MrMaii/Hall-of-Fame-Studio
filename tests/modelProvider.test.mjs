// Characterization tests: lock in modelProvider behavior (incl. BUG-002/BUG-003 fixes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelProvider, createModelProviderFromEnv, getModelProviderAdapterManifest } from '../src/agents/modelProvider.js';

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
      calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      const next = Array.isArray(payload) ? payload[Math.min(calls.length - 1, payload.length - 1)] : payload;
      return okResponse(typeof next === 'function' ? next(calls.length) : next);
    },
    ...options.config,
  });
  return { provider, calls };
};

const messages = [{ role: 'user', content: 'hello' }];

test('uses a local OpenAI-compatible endpoint as the unconfigured provider default', () => {
  const provider = createModelProviderFromEnv({});
  assert.equal(provider.status().baseURL, 'http://127.0.0.1:11434/v1');
  assert.equal(provider.status().model, 'llama3.2');
  assert.ok(getModelProviderAdapterManifest().adapters.every((adapter) => adapter.defaultBaseUrl.includes('127.0.0.1')));
});

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

test('Anthropic uses the Messages API and native authentication headers', async () => {
  const { provider, calls } = makeProvider(
    { content: [{ type: 'text', text: 'OK' }] },
    { provider: 'anthropic', config: { baseURL: 'https://api.anthropic.com/v1' } },
  );
  await provider.createChatCompletion({ messages });
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].headers['x-api-key'], 'test-key');
  assert.equal(calls[0].headers['anthropic-version'], '2023-06-01');
  assert.equal(calls[0].headers.authorization, undefined);
});

test('OpenAI-compatible suppliers use Bearer chat completions', async () => {
  for (const [providerName, baseURL] of [
    ['deepseek', 'https://api.deepseek.com'],
    ['stepfun', 'https://api.stepfun.com/v1'],
    ['qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1'],
  ]) {
    const { provider, calls } = makeProvider(
      { choices: [{ message: { content: 'OK' } }] },
      { provider: providerName, config: { baseURL } },
    );
    await provider.createChatCompletion({ messages });
    assert.equal(calls[0].url, `${baseURL}/chat/completions`);
    assert.equal(calls[0].headers.authorization, 'Bearer test-key');
    assert.equal(provider.status().provider, providerName);
  }
});

test('runtime provider selection changes the protocol used by the next request', async () => {
  const { provider, calls } = makeProvider(
    [
      { choices: [{ message: { content: 'OpenAI response' } }] },
      { content: [{ type: 'text', text: 'Claude response' }] },
    ],
    { config: { baseURL: 'https://api.openai.com/v1' } },
  );
  await provider.createChatCompletion({ messages });
  provider.setConfig({ provider: 'anthropic', baseURL: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6' });
  const result = await provider.createChatCompletion({ messages });
  assert.equal(calls[1].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(result.content, 'Claude response');
  assert.equal(provider.status().provider, 'anthropic');
});

test('local-only provider rejects a public model endpoint before making a network request', async () => {
  let calls = 0;
  const provider = createModelProvider({
    apiKey: 'test-key',
    enabled: true,
    localOnly: true,
    baseURL: 'https://api.openai.com/v1',
    fetchImpl: async () => {
      calls += 1;
      return okResponse({ choices: [{ message: { content: 'must not be returned' } }] });
    },
  });

  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'remote-base-url-blocked');
  assert.equal(calls, 0);
  assert.equal(provider.status().endpointPolicy.status, 'blocked-remote-endpoint');
});

test('local application mode still permits a user-selected remote model API', async () => {
  let calls = 0;
  const provider = createModelProviderFromEnv(
    { AGENT_LOCAL_ONLY: 'true' },
    {
      provider: 'openai',
      apiKey: 'test-key',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-5.2',
      fetchImpl: async () => {
        calls += 1;
        return okResponse({ choices: [{ message: { content: 'remote response' } }] });
      },
    },
  );
  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
});

test('local-only provider permits a loopback model endpoint', async () => {
  const { provider, calls } = makeProvider(
    { choices: [{ message: { content: 'local response' } }] },
    { config: { localOnly: true, baseURL: 'http://127.0.0.1:11434/v1' } },
  );

  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.ok, true);
  assert.match(calls[0].url, /^http:\/\/127\.0\.0\.1:11434\/v1/);
  assert.equal(provider.status().endpointPolicy.status, 'local-endpoint');
});

test('applies the explicitly configured transport retry budget to direct model calls', async () => {
  let calls = 0;
  const provider = createModelProvider({
    apiKey: 'test-key',
    enabled: true,
    transportMaxRetries: 1,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 503, text: async () => JSON.stringify({ error: { message: 'busy' } }) }
        : okResponse({ choices: [{ message: { content: 'recovered' } }] });
    },
  });

  const result = await provider.createChatCompletion({ messages });
  assert.equal(result.ok, true);
  assert.equal(result.content, 'recovered');
  assert.equal(calls, 2);
  assert.equal(result.transportReliability.retry.attemptCount, 2);
  assert.equal(provider.status().transportReliability.retry.maxRetries, 1);
});

test('keeps a provider timeout active when the caller also supplies an abort signal', async () => {
  const provider = createModelProvider({
    apiKey: 'test-key',
    enabled: true,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }),
  });
  const caller = new AbortController();

  const result = await provider.createChatCompletion({ messages, signal: caller.signal, timeoutMs: 10 });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'model request timed out');
});
