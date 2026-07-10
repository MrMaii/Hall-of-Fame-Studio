import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderTransportPolicy } from '../src/agents/providerTransportReliability.js';

test('opens after consecutive retryable failures, then recovers through one half-open probe', async () => {
  let now = 1_000;
  let calls = 0;
  const policy = createProviderTransportPolicy({
    maxConcurrency: 2,
    failureThreshold: 2,
    cooldownMs: 100,
    now: () => now,
  });

  const fail = () => policy.execute(() => {
    calls += 1;
    return { ok: false, status: 503, error: 'upstream unavailable' };
  });

  assert.equal((await fail()).ok, false);
  now += 1;
  assert.equal((await fail()).ok, false);
  assert.equal(policy.status().circuit.state, 'open');

  const blocked = await policy.execute(() => {
    calls += 1;
    return { ok: true };
  });
  assert.deepEqual(blocked, {
    ok: false,
    skipped: true,
    reason: 'provider-transport-circuit-open',
    transportReliability: blocked.transportReliability,
  });
  assert.equal(calls, 2);

  now += 100;
  const recovered = await policy.execute(() => {
    calls += 1;
    return { ok: true, value: 'recovered' };
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.value, 'recovered');
  assert.equal(recovered.transportReliability.circuit.state, 'closed');
  assert.equal(policy.status().circuit.state, 'closed');
});

test('uses only configured transport retries and records their bounded attempts', async () => {
  let calls = 0;
  const policy = createProviderTransportPolicy({
    maxRetries: 1,
    retryBackoffMs: [0],
  });

  const result = await policy.execute(() => {
    calls += 1;
    return calls === 1
      ? { ok: false, statusCode: 429, error: 'rate limited' }
      : { ok: true, value: 'done' };
  });

  assert.equal(calls, 2);
  assert.equal(result.ok, true);
  assert.equal(result.transportReliability.retry.attemptCount, 2);
  assert.equal(result.transportReliability.retry.retried, true);
});

test('queues provider work rather than exceeding the configured local concurrency', async () => {
  let releaseFirst;
  let active = 0;
  let highestActive = 0;
  const policy = createProviderTransportPolicy({ maxConcurrency: 1 });
  const first = policy.execute(async () => {
    active += 1;
    highestActive = Math.max(highestActive, active);
    await new Promise((resolve) => { releaseFirst = resolve; });
    active -= 1;
    return { ok: true, value: 'first' };
  });
  const second = policy.execute(async () => {
    active += 1;
    highestActive = Math.max(highestActive, active);
    active -= 1;
    return { ok: true, value: 'second' };
  });

  assert.equal(policy.status().queuedRequests, 1);
  releaseFirst();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.value, 'first');
  assert.equal(secondResult.value, 'second');
  assert.equal(highestActive, 1);
});
