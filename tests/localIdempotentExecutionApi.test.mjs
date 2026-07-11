import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { markLocalIdempotentExecutionAmbiguous, markLocalIdempotentExecutionDispatched, prepareLocalIdempotentExecution } from '../src/agents/localIdempotentExecution.js';

test('reconciles an ambiguous local operation through a private file-backed API with server-owned actor', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-idempotent-api-'));
  const filePath = join(directory, 'projects.json');
  const projectId = 'idempotent_api_project';
  const headers = { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'idempotency-security-admin' };
  try {
    const prepared = prepareLocalIdempotentExecution({ rows: [], intent: {
      projectId, operationKey: 'provider-op:idempotent-api:0001', operationKind: 'provider-search',
      requestChecksum: 'a'.repeat(64), traceId: '0123456789abcdef0123456789abcdef',
    }, now: '2026-07-11T11:00:00.000Z' });
    const dispatched = markLocalIdempotentExecutionDispatched({ rows: prepared.rows, operationId: prepared.operation.id, now: '2026-07-11T11:00:01.000Z' });
    const ambiguous = markLocalIdempotentExecutionAmbiguous({ rows: dispatched.rows, operationId: prepared.operation.id, reasonCode: 'timeout-after-dispatch', now: '2026-07-11T11:00:10.000Z' });
    let store = createAgentProjectFileStore({ filePath, projects: [{ id: projectId, name: 'Idempotent API', localIdempotentExecutionLedger: ambiguous.rows }], replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    let response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/idempotent-executions`, headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager' }, body: { now: '2026-07-11T11:01:00.000Z' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotentExecutionGovernance.summary.ambiguousCount, 1);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${projectId}/idempotent-executions/${prepared.operation.id}/reconcile`, headers,
      body: { actorId: 'caller-override', outcome: 'not-applied', evidenceChecksum: 'b'.repeat(64), reason: 'Verified no request in the local provider ledger.', now: '2026-07-11T11:02:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.idempotentExecution.reconciliation.actorId, 'idempotency-security-admin');
    assert.equal(response.body.idempotentExecution.reconciliation.reason, undefined);
    assert.equal(response.body.idempotentExecution.safeToRetryAutomatically, true);

    store = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/idempotent-executions`, headers, body: { now: '2026-07-11T11:03:00.000Z' } });
    assert.equal(response.body.idempotentExecutionGovernance.summary.reconciledCount, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps idempotent execution status private and reconciliation security-admin only', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/idempotent-executions' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/idempotent-executions/o/reconcile' }).allowedRoles, ['security-admin']);
});
