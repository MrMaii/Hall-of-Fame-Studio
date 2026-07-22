import assert from 'node:assert/strict';
import test from 'node:test';

import { createAgentProjectMemoryStore } from '../src/agents/agentProjectStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
} from '../src/agents/agentProjectService.js';

function createCountingService() {
  const seed = createKickoffProjectFromMeeting({
    projectId: 'read_model_cache_project',
    name: 'Read model cache project',
    brief: 'Repeated reads should reuse a stable project snapshot.',
    now: '2026-07-20T12:00:00.000Z',
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
    ],
  });
  const baseStore = createAgentProjectMemoryStore({ projects: [seed.project], messages: seed.messages });
  const counts = { getProject: 0, getMessages: 0, listSecurityAuditRecords: 0 };
  const store = {
    ...baseStore,
    getProject(projectId) {
      counts.getProject += 1;
      return baseStore.getProject(projectId);
    },
    getMessages(projectId) {
      counts.getMessages += 1;
      return baseStore.getMessages(projectId);
    },
    listSecurityAuditRecords(projectId) {
      counts.listSecurityAuditRecords += 1;
      return baseStore.listSecurityAuditRecords(projectId);
    },
  };
  return { service: createAgentProjectService({ store }), store, counts };
}

test('a cached manager dashboard read does not rescan the project or messages', () => {
  const { service, counts } = createCountingService();
  const first = service.getManagerDashboard('read_model_cache_project');
  const readsAfterFirst = { ...counts };
  const second = service.getManagerDashboard('read_model_cache_project');

  assert.strictEqual(second, first);
  assert.deepEqual(counts, readsAfterFirst);
});

test('a project mutation invalidates the cached manager dashboard', () => {
  const { service } = createCountingService();
  const first = service.getManagerDashboard('read_model_cache_project');
  service.recordAccessDecision({
    projectId: 'read_model_cache_project',
    method: 'POST',
    path: '/projects/read_model_cache_project/project-settings',
    decision: {
      allowed: true,
      status: 'allowed',
      enforced: true,
      mode: 'enforced',
      route: { routeKey: 'project-settings', projectId: 'read_model_cache_project' },
      actor: { role: 'manager', userId: 'local-manager' },
    },
  });

  assert.notStrictEqual(service.getManagerDashboard('read_model_cache_project'), first);
});

test('a direct store mutation invalidates the cached manager dashboard', () => {
  const { service, store } = createCountingService();
  const first = service.getManagerDashboard('read_model_cache_project');
  store.saveProject({
    ...store.getProject('read_model_cache_project'),
    progress: 99,
  });

  assert.notStrictEqual(service.getManagerDashboard('read_model_cache_project'), first);
});

test('successive access records reuse the audit stream tail instead of rescanning history', () => {
  const { service, counts } = createCountingService();
  const decision = {
    allowed: true,
    status: 'allowed',
    enforced: true,
    mode: 'enforced',
    route: { routeKey: 'project-read', projectId: 'read_model_cache_project' },
    actor: { role: 'manager', userId: 'local-manager' },
  };

  service.recordAccessDecision({ projectId: 'read_model_cache_project', decision, method: 'GET', path: '/first' });
  service.recordAccessDecision({ projectId: 'read_model_cache_project', decision, method: 'GET', path: '/second' });

  assert.equal(counts.listSecurityAuditRecords, 1);
});
