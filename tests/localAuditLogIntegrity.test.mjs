import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

test('reports malformed local audit JSONL lines without hiding the valid audit chain', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-audit-integrity-'));
  const filePath = join(directory, 'projects.json');
  const projectId = 'audit_integrity_project';
  try {
    const store = createAgentProjectFileStore({
      filePath,
      projects: [{ id: projectId, name: 'Audit integrity project', team: [], tasks: [], logs: [], eventLedger: [] }],
      replaceWithSeed: true,
    });
    const service = createAgentProjectService({ store });
    const decision = {
      allowed: true,
      status: 'allowed',
      enforced: true,
      mode: 'enforced',
      route: { routeKey: 'project-read', capability: 'Read project', sensitivity: 'project-data', projectId },
      actor: { role: 'security-admin', userId: 'local-admin' },
    };
    service.recordAccessDecision({ projectId, decision, method: 'GET', path: `/projects/${projectId}`, now: '2026-07-10T10:00:00.000Z' });
    service.recordAccessDecision({ projectId, decision, method: 'GET', path: `/projects/${projectId}/events`, now: '2026-07-10T10:00:01.000Z' });
    appendFileSync(store.securityAuditLogPath, '{malformed audit line\n', 'utf8');

    const restartedStore = createAgentProjectFileStore({ filePath });
    const restartedService = createAgentProjectService({ store: restartedStore });
    const stream = restartedService.getSecurityAuditStream(projectId);
    assert.equal(stream.auditLogIntegrity.status, 'malformed-lines-detected');
    assert.equal(stream.auditLogIntegrity.malformedLineCount, 1);
    assert.equal(stream.hashChainReady, false);
    assert.equal(stream.count, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('high-volume access auditing appends its dedicated log without rewriting the project snapshot', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-audit-append-only-'));
  const filePath = join(directory, 'projects.json');
  const projectId = 'audit_append_only_project';
  try {
    const store = createAgentProjectFileStore({
      filePath,
      projects: [{ id: projectId, name: 'Audit append-only project', team: [], tasks: [], logs: [], eventLedger: [] }],
      replaceWithSeed: true,
    });
    const service = createAgentProjectService({ store });
    const snapshotBefore = readFileSync(filePath, 'utf8');
    service.recordAccessDecision({
      projectId,
      method: 'GET',
      path: `/projects/${projectId}`,
      decision: {
        allowed: true,
        status: 'allowed',
        enforced: true,
        mode: 'enforced',
        route: { routeKey: 'project-read', projectId },
        actor: { role: 'security-admin', userId: 'local-admin' },
      },
      now: '2026-07-10T10:05:00.000Z',
    });

    assert.equal(readFileSync(filePath, 'utf8'), snapshotBefore);
    assert.equal(createAgentProjectService({ store: createAgentProjectFileStore({ filePath }) }).getSecurityAuditStream(projectId).count, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
