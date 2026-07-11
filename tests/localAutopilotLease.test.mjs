import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acknowledgeLocalAutopilotLease,
  acquireLocalAutopilotLease,
} from '../src/agents/localAutopilotLease.js';

const input = {
  projectId: 'lease-project',
  sessionId: 'lease-session',
  idempotencyKey: 'idem_lease_session_1',
  dueAt: '2026-07-10T10:00:00.000Z',
  leaseSeconds: 60,
};

test('keeps an unexpired local Autopilot lease exclusive and recovers it with a new fence', () => {
  const first = acquireLocalAutopilotLease({
    ...input,
    rows: [],
    now: '2026-07-10T10:00:00.000Z',
  });
  assert.equal(first.action, 'acquired');
  assert.equal(first.lease.attemptCount, 1);

  const active = acquireLocalAutopilotLease({
    ...input,
    rows: first.rows,
    now: '2026-07-10T10:00:30.000Z',
  });
  assert.equal(active.action, 'lease-active');
  assert.equal(active.lease.fenceToken, first.lease.fenceToken);

  const recovered = acquireLocalAutopilotLease({
    ...input,
    rows: first.rows,
    now: '2026-07-10T10:01:01.000Z',
  });
  assert.equal(recovered.action, 'recovered-expired-lease');
  assert.equal(recovered.lease.attemptCount, 2);
  assert.notEqual(recovered.lease.fenceToken, first.lease.fenceToken);
});

test('acknowledges only the current fence and suppresses an acknowledged duplicate', () => {
  const first = acquireLocalAutopilotLease({
    ...input,
    rows: [],
    now: '2026-07-10T10:00:00.000Z',
  });
  const recovered = acquireLocalAutopilotLease({
    ...input,
    rows: first.rows,
    now: '2026-07-10T10:01:01.000Z',
  });
  const staleAcknowledgement = acknowledgeLocalAutopilotLease({
    rows: recovered.rows,
    idempotencyKey: input.idempotencyKey,
    fenceToken: first.lease.fenceToken,
    receipt: { tickId: 'tick_1', receiptChecksum: 'chk_tick_1', status: 'succeeded' },
    now: '2026-07-10T10:01:02.000Z',
  });
  assert.equal(staleAcknowledgement.acknowledged, false);

  const acknowledgement = acknowledgeLocalAutopilotLease({
    rows: recovered.rows,
    idempotencyKey: input.idempotencyKey,
    fenceToken: recovered.lease.fenceToken,
    receipt: { tickId: 'tick_2', receiptChecksum: 'chk_tick_2', status: 'succeeded' },
    now: '2026-07-10T10:01:03.000Z',
  });
  assert.equal(acknowledgement.acknowledged, true);
  assert.equal(acknowledgement.lease.status, 'acked');

  const duplicate = acquireLocalAutopilotLease({
    ...input,
    rows: acknowledgement.rows,
    now: '2026-07-10T10:02:00.000Z',
  });
  assert.equal(duplicate.action, 'already-acked');
  assert.equal(duplicate.lease.receipt.tickId, 'tick_2');
});
