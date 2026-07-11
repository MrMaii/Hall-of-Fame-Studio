import assert from 'node:assert/strict';
import test from 'node:test';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
} from '../src/agents/agentProjectService.js';

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
