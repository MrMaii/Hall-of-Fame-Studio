import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRetryDelayMs,
  createProductionJobPort,
  validateProductionJob,
} from '../src/agents/productionJobPort.js';

const now = '2026-07-10T02:00:00.000Z';
const job = {
  id: 'job_1',
  tenantId: 'tenant_1',
  projectId: 'project_1',
  actorId: 'user_1',
  idempotencyKey: 'task_1',
  kind: 'agent-autonomy',
  deadlineAt: '2026-07-10T03:00:00.000Z',
  retryPolicy: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10_000 },
};

function managedQueue() {
  const calls = [];
  return {
    mode: 'managed',
    calls,
    async enqueue(value) { calls.push(['enqueue', value]); return { jobId: value.id }; },
    async acquireLease(value) { calls.push(['lease', value]); return { leaseId: 'lease_1', expiresAt: '2026-07-10T02:01:00.000Z' }; },
    async acknowledge(value) { calls.push(['ack', value]); return { acknowledged: true }; },
    async defer(value) { calls.push(['defer', value]); return { deferred: true }; },
    async deadLetter(value) { calls.push(['dead-letter', value]); return { deadLetterId: 'dead_1' }; },
    async cancel(value) { calls.push(['cancel', value]); return { cancelled: true }; },
    async replay(value) { calls.push(['replay', value]); return { jobId: 'job_replayed' }; },
  };
}

test('requires an attributable, bounded job contract', () => {
  assert.equal(validateProductionJob(job, now).ok, true);
  const invalid = validateProductionJob({ id: 'job_1', tenantId: 'tenant_1' }, now);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.missing.includes('projectId'), true);
  assert.equal(invalid.missing.includes('retryPolicy'), true);
});

test('fails closed when no managed queue driver exists', async () => {
  const port = createProductionJobPort({ now: () => now });
  const result = await port.enqueue(job);
  assert.equal(port.status().status, 'managed-queue-not-configured');
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'managed-queue-not-configured');
});

test('enqueues a delayed job once per idempotency key', async () => {
  const queue = managedQueue();
  const port = createProductionJobPort({ adapter: queue, now: () => now });
  const first = await port.enqueue({ ...job, delayMs: 5000 });
  const duplicate = await port.enqueue({ ...job, delayMs: 5000 });

  assert.equal(first.status, 'queued');
  assert.equal(first.availableAt, '2026-07-10T02:00:05.000Z');
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(queue.calls.filter(([operation]) => operation === 'enqueue').length, 1);
});

test('uses bounded exponential retry delay and dead-letters after its retry budget', async () => {
  assert.equal(calculateRetryDelayMs({ attempt: 1, baseDelayMs: 1000, maxDelayMs: 10_000 }), 1000);
  assert.equal(calculateRetryDelayMs({ attempt: 4, baseDelayMs: 1000, maxDelayMs: 5000 }), 5000);
  const queue = managedQueue();
  const port = createProductionJobPort({ adapter: queue, now: () => now });
  await port.enqueue(job);
  const retry = await port.nack({ job, attempt: 1, errorClass: 'provider-timeout' });
  const deadLetter = await port.nack({ job, attempt: 3, errorClass: 'provider-timeout' });

  assert.equal(retry.status, 'retry-scheduled');
  assert.equal(retry.retryAt, '2026-07-10T02:00:01.000Z');
  assert.equal(deadLetter.status, 'dead-lettered');
  assert.equal(queue.calls.some(([operation]) => operation === 'defer'), true);
  assert.equal(queue.calls.some(([operation]) => operation === 'dead-letter'), true);
});

test('requires human approval to replay a dead letter and forwards cancellation', async () => {
  const queue = managedQueue();
  const port = createProductionJobPort({ adapter: queue, now: () => now });
  const denied = await port.replay({ deadLetterId: 'dead_1' });
  const replayed = await port.replay({
    deadLetterId: 'dead_1',
    approval: { actorId: 'ops_1', reason: 'provider recovered' },
  });
  const cancelled = await port.cancel({ jobId: job.id, actorId: 'user_1', reason: 'user stopped project' });

  assert.equal(denied.status, 'rejected');
  assert.equal(denied.reason, 'dead-letter-replay-approval-required');
  assert.equal(replayed.status, 'replayed');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(queue.calls.some(([operation]) => operation === 'replay'), true);
  assert.equal(queue.calls.some(([operation]) => operation === 'cancel'), true);
});
