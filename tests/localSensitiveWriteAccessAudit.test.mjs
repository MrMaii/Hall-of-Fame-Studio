import assert from 'node:assert/strict';
import test from 'node:test';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';
import { verifyProjectEventLedger } from '../src/agents/agentRuntime.js';

const projectId = 'local_sensitive_write_audit_project';
const now = '2026-07-10T19:00:00.000Z';

function createApi() {
  const seed = createKickoffProjectFromMeeting({
    projectId,
    name: 'Local sensitive write audit',
    brief: 'Make local sensitive mutations attributable before dispatch.',
    now,
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
  return createAgentProjectApi({
    service: createAgentProjectService({ projects: [seed.project], messages: seed.messages }),
  });
}

test('audits a project-scoped sensitive write before prototype-open dispatch', () => {
  const api = createApi();
  const response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/project-settings`,
    traceId: 'trace_local_sensitive_write_001',
    headers: {
      'x-hofs-role': 'manager',
      'x-hofs-user-id': 'local-manager',
    },
    body: {
      language: 'en',
      updatedBy: 'local-manager',
      includeReadModels: false,
      now,
    },
  });
  assert.equal(response.status, 200);

  const auditResponse = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/security-access-audit`,
    body: { includeReadModels: false },
  });
  assert.equal(auditResponse.status, 200);
  assert.equal(auditResponse.body.securityAccessAudit.count, 1);
  const row = auditResponse.body.securityAccessAudit.rows[0];
  assert.equal(row.allowed, true);
  assert.equal(row.enforced, false);
  assert.equal(row.actor.role, 'manager');
  assert.equal(row.actor.userId, 'local-manager');
  assert.equal(row.routeKey, 'project-settings');
  assert.equal(row.sensitivity, 'project-data');
  assert.equal(row.method, 'POST');
  assert.equal(row.outcome, 'access-allowed-before-dispatch');
  assert.equal(row.traceId, 'trace_local_sensitive_write_001');

  const streamResponse = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/security-audit-stream`,
    body: { includeReadModels: false },
  });
  assert.equal(streamResponse.status, 200);
  assert.equal(streamResponse.body.securityAuditStream.hashChainReady, true);
  assert.equal(streamResponse.body.securityAuditStream.rows[0].traceId, 'trace_local_sensitive_write_001');
});

test('fails a sensitive write closed when its local audit sink is unavailable', () => {
  let businessWriteCount = 0;
  const serviceWithoutAuditSink = {
    setProjectSettings() {
      businessWriteCount += 1;
      return {
        project: { id: projectId, language: 'en' },
        projectSettings: { schemaVersion: 'project-settings/v1', effectiveLanguage: 'en' },
        projectSettingsAuditEntry: null,
        log: null,
      };
    },
  };
  const api = createAgentProjectApi({ service: serviceWithoutAuditSink });

  const response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/project-settings`,
    traceId: 'trace_local_sensitive_write_missing_sink',
    headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-manager' },
    body: { language: 'en', includeReadModels: false, now },
  });

  assert.equal(response.status, 503);
  assert.equal(response.body.error, 'access-audit-write-failed');
  assert.equal(businessWriteCount, 0);
});

test('project reads are retained in the audit stream without mutating the business event ledger', () => {
  const seed = createKickoffProjectFromMeeting({
    projectId,
    name: 'Read-only access audit',
    brief: 'Keep read auditing separate from the project business history.',
    now,
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
    ],
  });
  const service = createAgentProjectService({ projects: [seed.project], messages: seed.messages });
  const decision = {
    allowed: true,
    status: 'allowed',
    enforced: true,
    mode: 'enforced',
    route: {
      routeKey: 'project-read',
      capability: 'Read project',
      sensitivity: 'project-data',
      projectId,
    },
    actor: { role: 'manager', userId: 'local-manager' },
  };
  const eventCountBefore = service.getEventLedger(projectId).eventLedger.length;

  service.recordAccessDecision({
    projectId,
    decision,
    method: 'GET',
    path: `/projects/${projectId}`,
    now: '2026-07-10T19:01:00.000Z',
  });
  service.recordAccessDecision({
    projectId,
    decision,
    method: 'GET',
    path: `/projects/${projectId}/events`,
    now: '2026-07-10T19:01:01.000Z',
  });

  assert.equal(service.getEventLedger(projectId).eventLedger.length, eventCountBefore);
  assert.equal(service.getSecurityAuditStream(projectId).count, 2);
  assert.equal(service.getSecurityAccessAudit(projectId).stream.count, 2);
});

test('retains high-volume project reads in the hash-chained audit stream without business events', () => {
  const seed = createKickoffProjectFromMeeting({
    projectId,
    name: 'Local sensitive write audit',
    brief: 'Keep every retained access decision linked to its event-ledger proof.',
    now,
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
    ],
  });
  const service = createAgentProjectService({ projects: [seed.project], messages: seed.messages });
  const decision = {
    allowed: true,
    status: 'allowed',
    enforced: true,
    mode: 'enforced',
    route: {
      routeKey: 'project-read',
      capability: 'Read project',
      sensitivity: 'project-data',
      projectId,
    },
    actor: { role: 'manager', userId: 'local-manager' },
  };

  for (let index = 0; index < 41; index += 1) {
    service.recordAccessDecision({
      projectId,
      decision,
      method: 'GET',
      path: `/projects/${projectId}?audit=${index}`,
      now: `2026-07-10T19:00:${String(index).padStart(2, '0')}.000Z`,
    });
  }

  const audit = service.getSecurityAccessAudit(projectId);
  assert.equal(audit.count, 41);
  assert.equal(audit.eventIds.length, 0);
  assert.equal(audit.stream.count, audit.count);
  assert.equal(audit.stream.hashChainReady, true);
  assert.equal(service.getSecurityAuditStream(projectId).rows.length, 20);
});

test('hydration compacts legacy prototype access events out of business history while preserving enforced audit proof', () => {
  const hydrated = hydrateAgentProject({
    id: 'legacy-access-event-project',
    eventLedger: [
      { id: 'prototype-1', sequence: 1, type: 'security-access', payload: { enforced: false } },
      { id: 'business-1', sequence: 2, type: 'agent-submission', payload: {} },
      { id: 'enforced-1', sequence: 3, type: 'security-access', payload: { enforced: true } },
    ],
    eventLedgerChainVersion: 0,
  });

  assert.deepEqual(hydrated.eventLedger.map((event) => event.id), ['business-1', 'enforced-1']);
  assert.equal(hydrated.prototypeAccessEventCompaction.removedEventCount, 1);
  assert.equal(verifyProjectEventLedger(hydrated).valid, true);
});

test('hydration caps duplicated enforced access events while the dedicated audit stream remains authoritative', () => {
  const hydrated = hydrateAgentProject({
    id: 'high-volume-access-event-project',
    eventLedger: Array.from({ length: 105 }, (_, index) => ({
      id: `enforced-${index + 1}`,
      sequence: index + 1,
      type: 'security-access',
      payload: { enforced: true },
    })),
    eventLedgerChainVersion: 0,
  });

  assert.equal(hydrated.eventLedger.length, 100);
  assert.equal(hydrated.eventLedger[0].id, 'enforced-6');
  assert.equal(hydrated.prototypeAccessEventCompaction.removedEventCount, 5);
  assert.equal(verifyProjectEventLedger(hydrated).valid, true);
});
