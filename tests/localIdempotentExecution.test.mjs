import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentProjectService, createKickoffProjectFromMeeting } from '../src/agents/agentProjectService.js';

import {
  auditLocalIdempotentExecutions,
  completeLocalIdempotentExecution,
  markLocalIdempotentExecutionAmbiguous,
  markLocalIdempotentExecutionDispatched,
  prepareLocalIdempotentExecution,
  reconcileLocalIdempotentExecution,
} from '../src/agents/localIdempotentExecution.js';

const intent = {
  projectId: 'idem-project',
  operationKey: 'provider-op:idem-project:search:0001',
  operationKind: 'provider-search',
  requestChecksum: 'a'.repeat(64),
  traceId: '0123456789abcdef0123456789abcdef',
  providerEndpointHonoringAttested: false,
};

test('prepares one exact operation and rejects changed intent or tampering', () => {
  const prepared = prepareLocalIdempotentExecution({ rows: [], intent, now: '2026-07-11T10:00:00.000Z' });
  assert.equal(prepared.action, 'prepared');
  assert.equal(prepared.operation.status, 'prepared');
  assert.match(prepared.operation.checksum, /^[a-f0-9]{64}$/);
  const duplicate = prepareLocalIdempotentExecution({ rows: prepared.rows, intent, now: '2026-07-11T10:00:01.000Z' });
  assert.equal(duplicate.action, 'already-prepared');
  assert.throws(() => prepareLocalIdempotentExecution({ rows: prepared.rows, intent: { ...intent, requestChecksum: 'b'.repeat(64) } }), /idempotency-conflict/);
  const tampered = structuredClone(prepared.rows);
  tampered[0].traceId = 'attacker';
  assert.equal(auditLocalIdempotentExecutions(tampered).valid, false);
  assert.throws(() => prepareLocalIdempotentExecution({ rows: tampered, intent }), /integrity-invalid/);
});

test('reuses one completed result instead of executing again', () => {
  const prepared = prepareLocalIdempotentExecution({ rows: [], intent, now: '2026-07-11T10:00:00.000Z' });
  const dispatched = markLocalIdempotentExecutionDispatched({ rows: prepared.rows, operationId: prepared.operation.id, now: '2026-07-11T10:00:01.000Z' });
  const completed = completeLocalIdempotentExecution({
    rows: dispatched.rows, operationId: prepared.operation.id,
    providerResponseId: 'provider-response-1', resultChecksum: 'c'.repeat(64), localEffectReceiptChecksum: 'd'.repeat(64),
    now: '2026-07-11T10:00:02.000Z',
  });
  assert.equal(completed.operation.status, 'completed');
  const replay = prepareLocalIdempotentExecution({ rows: completed.rows, intent, now: '2026-07-11T10:01:00.000Z' });
  assert.equal(replay.action, 'reuse-completed');
  assert.equal(replay.operation.resultChecksum, 'c'.repeat(64));
});

test('blocks ambiguous replay until security reconciliation supplies exact evidence', () => {
  const prepared = prepareLocalIdempotentExecution({ rows: [], intent, now: '2026-07-11T10:00:00.000Z' });
  const ambiguous = markLocalIdempotentExecutionAmbiguous({
    rows: prepared.rows, operationId: prepared.operation.id, reasonCode: 'timeout-after-dispatch', now: '2026-07-11T10:00:10.000Z',
  });
  assert.equal(ambiguous.operation.status, 'ambiguous');
  assert.equal(ambiguous.operation.safeToRetryAutomatically, false);
  assert.throws(() => prepareLocalIdempotentExecution({ rows: ambiguous.rows, intent }), /ambiguous-reconciliation-required/);
  assert.throws(() => reconcileLocalIdempotentExecution({ rows: ambiguous.rows, operationId: prepared.operation.id, actorId: 'security', outcome: 'completed' }), /reconciliation-evidence-required/);
  const reconciled = reconcileLocalIdempotentExecution({
    rows: ambiguous.rows, operationId: prepared.operation.id, actorId: 'security', outcome: 'completed',
    providerResponseId: 'provider-response-reconciled', resultChecksum: 'e'.repeat(64), evidenceChecksum: 'f'.repeat(64), reason: 'Verified in local provider response ledger.',
    now: '2026-07-11T10:02:00.000Z',
  });
  assert.equal(reconciled.operation.status, 'completed');
  assert.equal(reconciled.operation.reconciliation.actorId, 'security');
  assert.equal(reconciled.operation.reconciliation.reason, undefined);
  assert.match(reconciled.operation.reconciliation.reasonHash, /^[a-f0-9]{64}$/);
});

test('persists ambiguous Provider outcome and blocks downstream evidence plus same-key redispatch', async () => {
  const projectId = 'idempotent_provider_project';
  const seed = createKickoffProjectFromMeeting({
    projectId, name: 'Idempotent Provider', brief: 'Do not duplicate uncertain provider effects.', now: '2026-07-11T10:00:00.000Z',
    team: [{ id: 'leader', name: 'Ada', title: 'Leader', skill: 'research' }, { id: 'reviewer', name: 'Grace', title: 'Reviewer', skill: 'review' }],
  });
  let transportCalls = 0;
  const service = createAgentProjectService({
    projects: [seed.project], messages: seed.messages,
    providerPolicy: {
      enabled: true, mode: 'enforced', allowedSearchProviders: ['local-idempotent-search'], defaultToolGrants: ['search:evidence'],
      maxRequestsPerProjectHour: 10, dailyBudgetCents: 100, searchCostCentsPerRequest: 1, retryAttempts: 2,
    },
    searchProvider: {
      status: () => ({ provider: 'local-idempotent-search', enabled: true, configured: true, runtimeEnabled: true, hasEndpoint: true }),
      search: async () => {
        transportCalls += 1;
        return { ok: false, error: 'search request timed out', provider: 'local-idempotent-search', idempotency: { outcome: 'ambiguous', endpointHonoringAttested: false, safeToRetryAutomatically: false } };
      },
    },
  });
  const request = { projectId, agentId: 'leader', query: 'private query', purpose: 'research', idempotencyKey: 'search-ambiguous-1', now: '2026-07-11T10:01:00.000Z' };
  await assert.rejects(service.recordAgentEvidenceSearchWithProvider(request), /ambiguous-reconciliation-required/);
  assert.equal(transportCalls, 1);
  assert.equal(service.getProject(projectId).evidenceSearches?.length || 0, 0);
  assert.equal(service.getProject(projectId).localIdempotentExecutionLedger[0].status, 'ambiguous');
  await assert.rejects(service.recordAgentEvidenceSearchWithProvider({ ...request, now: '2026-07-11T10:02:00.000Z' }), /ambiguous-reconciliation-required/);
  assert.equal(transportCalls, 1);
});
