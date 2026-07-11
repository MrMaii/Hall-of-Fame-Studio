import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLocalAutonomyGovernor,
  createLocalAutonomyCommand,
  createLocalAutonomyPolicy,
  evaluateLocalAutonomyExecution,
  verifyLocalAutonomyPolicy,
} from '../src/agents/localAutonomyGovernor.js';

const limits = {
  maxWallClockMs: 24 * 60 * 60_000,
  maxSteps: 5,
  maxCostCents: 40,
  maxToolInvocations: 2,
  allowedToolOperations: ['search:evidence'],
};

test('derives optimistic pause, resume and terminal stop commands with tamper detection', () => {
  const policy = createLocalAutonomyPolicy({
    projectId: 'governor_project', version: 1, ...limits,
    actorId: 'manager-one', idempotencyKey: 'policy-1', now: '2026-07-10T12:00:00.000Z',
  });
  assert.equal(verifyLocalAutonomyPolicy(policy).valid, true);
  const pause = createLocalAutonomyCommand({
    policy, fromState: 'active', command: 'pause', expectedPolicyVersion: 1,
    expectedPolicyChecksum: policy.checksum, actorId: 'manager-one', reasonCode: 'operator-pause',
    idempotencyKey: 'pause-1', now: '2026-07-10T12:05:00.000Z',
  });
  const resume = createLocalAutonomyCommand({
    policy, fromState: 'paused', command: 'resume', expectedPolicyVersion: 1,
    expectedPolicyChecksum: policy.checksum, actorId: 'manager-one', reasonCode: 'operator-resume',
    idempotencyKey: 'resume-1', now: '2026-07-10T12:06:00.000Z',
  });
  const stop = createLocalAutonomyCommand({
    policy, fromState: 'active', command: 'stop', expectedPolicyVersion: 1,
    expectedPolicyChecksum: policy.checksum, actorId: 'manager-one', reasonCode: 'operator-stop',
    idempotencyKey: 'stop-1', now: '2026-07-10T12:07:00.000Z',
  });
  const governor = buildLocalAutonomyGovernor({
    project: { id: policy.projectId, localAutonomyPolicies: [policy], localAutonomyCommands: [stop, resume, pause] },
    now: '2026-07-10T12:08:00.000Z',
  });
  assert.equal(governor.state, 'stopped');
  assert.equal(governor.integrity.valid, true);
  assert.throws(() => createLocalAutonomyCommand({
    policy, fromState: 'stopped', command: 'resume', expectedPolicyVersion: 1,
    expectedPolicyChecksum: policy.checksum, actorId: 'manager-one', reasonCode: 'invalid-resume',
    idempotencyKey: 'resume-after-stop', now: '2026-07-10T12:09:00.000Z',
  }), /terminal-stop/);
  const tampered = { ...policy, maxSteps: 500 };
  assert.equal(buildLocalAutonomyGovernor({ project: { id: policy.projectId, localAutonomyPolicies: [tampered] } }).integrity.valid, false);
});

test('denies projected duration, steps, cost, tool count and disallowed operations together', () => {
  const policy = createLocalAutonomyPolicy({
    projectId: 'governor_limits_project', version: 1, ...limits,
    actorId: 'manager-one', idempotencyKey: 'policy-limits', now: '2026-07-10T12:00:00.000Z',
  });
  const project = {
    id: policy.projectId,
    localAutonomyPolicies: [policy],
    localAutonomyCommands: [],
    autonomousRunControlSessionTickLedger: [{ id: 'tick-1', stepCount: 4, completedAt: '2026-07-10T12:10:00.000Z' }],
    providerUsageLedger: [{ id: 'usage-1', costCents: 30, completedAt: '2026-07-10T12:11:00.000Z' }],
    toolInvocationReceipts: [
      { id: 'tool-1', operation: 'search:evidence', createdAt: '2026-07-10T12:12:00.000Z' },
      { id: 'tool-2', operation: 'search:evidence', createdAt: '2026-07-10T12:13:00.000Z' },
    ],
  };
  const decision = evaluateLocalAutonomyExecution({
    project,
    now: '2026-07-11T12:00:01.000Z',
    request: { requestedSteps: 2, estimatedCostCents: 15, toolOperations: ['model:artifact-draft'] },
  });
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.reasonCodes.sort(), [
    'cost-limit-exceeded', 'duration-limit-exceeded', 'step-limit-exceeded',
    'tool-invocation-limit-exceeded', 'tool-operation-not-allowed',
  ]);
  assert.equal(decision.projected.steps, 6);
  assert.equal(decision.projected.costCents, 45);
  assert.equal(decision.projected.toolInvocations, 3);
});
