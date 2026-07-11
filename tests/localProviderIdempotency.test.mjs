import assert from 'node:assert/strict';
import test from 'node:test';

import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';

const key = 'provider-op:project-1:task-1:0001';
const traceId = '0123456789abcdef0123456789abcdef';

test('propagates one stable model idempotency key and trace across transport retries', async () => {
  const calls = [];
  const provider = createModelProvider({
    apiKey: 'local-key', enabled: true, transportMaxRetries: 1,
    fetchImpl: async (_url, init) => {
      calls.push(init.headers);
      return calls.length === 1
        ? { ok: false, status: 503, text: async () => JSON.stringify({ error: { message: 'busy' } }) }
        : { ok: true, status: 200, text: async () => JSON.stringify({ id: 'model-response-1', choices: [{ message: { content: 'done' } }] }) };
    },
  });
  const result = await provider.createChatCompletion({ messages: [{ role: 'user', content: 'private prompt' }], idempotencyKey: key, traceId });
  assert.equal(result.ok, true);
  assert.equal(result.id, 'model-response-1');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((headers) => headers['idempotency-key']), [key, key]);
  assert.deepEqual(calls.map((headers) => headers['x-hofs-trace-id']), [traceId, traceId]);
  assert.equal(result.idempotency.outcome, 'completed');
  assert.match(result.idempotency.keyHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result.idempotency).includes(key), false);
});

test('rejects invalid model keys before dispatch and classifies timeout after dispatch as ambiguous', async () => {
  let calls = 0;
  const provider = createModelProvider({
    apiKey: 'local-key', enabled: true,
    fetchImpl: async (_url, init) => {
      calls += 1;
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => {
        const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
      }, { once: true }));
    },
  });
  const invalid = await provider.createChatCompletion({ messages: [], idempotencyKey: 'bad key' });
  assert.equal(invalid.reason, 'invalid-idempotency-key');
  assert.equal(calls, 0);
  const ambiguous = await provider.createChatCompletion({ messages: [], idempotencyKey: key, traceId, timeoutMs: 10 });
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.idempotency.outcome, 'ambiguous');
  assert.equal(ambiguous.idempotency.safeToRetryAutomatically, false);
  assert.equal(calls, 1);
});

test('propagates search idempotency metadata and marks aborted HTTP search ambiguous', async () => {
  const headers = [];
  const provider = createSearchProvider({
    provider: 'http-json', endpoint: 'http://127.0.0.1:7777/search', enabled: true, localOnly: true,
    fetchImpl: async (_url, init) => {
      headers.push(init.headers);
      return { ok: true, status: 200, text: async () => JSON.stringify({ responseId: 'search-response-1', results: [{ title: 'Local result' }] }) };
    },
  });
  const result = await provider.search({ query: 'private query', purpose: 'research', idempotencyKey: key, traceId });
  assert.equal(result.ok, true);
  assert.equal(result.responseId, 'search-response-1');
  assert.equal(headers[0]['idempotency-key'], key);
  assert.equal(headers[0]['x-hofs-trace-id'], traceId);
  assert.equal(result.idempotency.outcome, 'completed');

  let abortedCalls = 0;
  const abortedProvider = createSearchProvider({
    provider: 'http-json', endpoint: 'http://127.0.0.1:7777/search', enabled: true, timeoutMs: 10, localOnly: true,
    fetchImpl: async (_url, init) => {
      abortedCalls += 1;
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => {
        const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
      }, { once: true }));
    },
  });
  const ambiguous = await abortedProvider.search({ query: 'private query', idempotencyKey: key, traceId });
  assert.equal(ambiguous.idempotency.outcome, 'ambiguous');
  assert.equal(ambiguous.idempotency.safeToRetryAutomatically, false);
  assert.equal(abortedCalls, 1);
});
