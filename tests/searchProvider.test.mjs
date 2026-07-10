import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchProvider } from '../src/agents/searchProvider.js';

test('applies the explicitly configured transport retry budget to direct search calls', async () => {
  let calls = 0;
  const provider = createSearchProvider({
    provider: 'http-json',
    endpoint: 'http://127.0.0.1:9999/search',
    enabled: true,
    transportMaxRetries: 1,
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 503, text: async () => JSON.stringify({ message: 'busy' }) }
        : {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ results: [{ title: 'Recovered evidence', url: 'https://example.test/evidence' }] }),
        };
    },
  });

  const result = await provider.search({ query: 'local evidence' });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
  assert.equal(result.sources[0].title, 'Recovered evidence');
  assert.equal(result.transportReliability.retry.attemptCount, 2);
  assert.equal(provider.status().transportReliability.retry.maxRetries, 1);
});
