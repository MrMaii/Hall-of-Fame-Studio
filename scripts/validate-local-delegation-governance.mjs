import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-delegation-governance-${process.pid}`);
const filePath = resolve(tempRoot, 'projects.json');
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const kickoff = createKickoffProjectFromMeeting({
    projectId: 'delegation_governance_gate_project',
    name: 'Delegation Governance Gate',
    brief: 'Prove local accountable delegation without cloud notifications.',
    team: [
      { id: 'owner', name: 'Owner' },
      { id: 'owner2', name: 'Owner Two' },
      { id: 'reviewer', name: 'Reviewer' },
    ],
    now: '2026-07-10T10:00:00.000Z',
  });
  kickoff.project.tasks = [
    { id: 'foundation', text: 'PRIVATE GATE TASK TEXT', assignee: 'owner', reviewerId: 'reviewer', status: 'done', dependsOn: [] },
    { id: 'build', text: 'PRIVATE GATE TASK TEXT', assignee: 'owner', reviewerId: 'reviewer', status: 'pending', dueAt: '2026-07-12T12:00:00.000Z', dependsOn: ['foundation'] },
    { id: 'review', text: 'PRIVATE GATE TASK TEXT', assignee: 'owner', reviewerId: 'reviewer', status: 'pending', dueAt: '2026-07-09T12:00:00.000Z', dependsOn: ['build'] },
  ];
  const store = createAgentProjectFileStore({
    filePath,
    projects: [kickoff.project],
    messages: kickoff.messages,
    replaceWithSeed: true,
    hydrateProject: hydrateAgentProject,
  });
  let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });

  let response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${kickoff.project.id}/tasks/build/delegation`,
    body: {
      assignee: 'owner2', reviewerId: 'reviewer', dueAt: '2026-07-13T12:00:00.000Z',
      reasonCode: 'capacity-rebalance', idempotencyKey: 'gate-reassign-1', now: '2026-07-10T12:05:00.000Z',
    },
  });
  assert(response.status === 201, `Delegation change returned ${response.status}.`);
  assert(response.body.delegationChange.toAssignee === 'owner2', 'Delegation change must retain the accountable new owner.');
  assert(response.body.notification?.type === 'owner-changed', 'Owner change must create a local notification.');

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${kickoff.project.id}/delegation-governance/scan`,
    body: { idempotencyKey: 'gate-scan-1', now: '2026-07-10T12:10:00.000Z' },
  });
  assert(response.status === 201, `Delegation scan returned ${response.status}.`);
  assert(response.body.notificationBatch.createdCount === 2, 'Scan must create one overdue and one dependency-blocked notification.');
  assert(response.body.delegationGovernance.graph.layers.length === 3, 'Governance must expose three visualization-ready DAG layers.');

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${kickoff.project.id}/delegation-governance/scan`,
    body: { idempotencyKey: 'gate-scan-2', now: '2026-07-10T12:11:00.000Z' },
  });
  assert(response.status === 200 && response.body.notificationBatch.createdCount === 0, 'Unchanged task state must not duplicate notifications.');

  api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
  response = await api.handleAsync({
    method: 'GET',
    path: `/projects/${kickoff.project.id}/delegation-governance`,
    body: { now: '2026-07-10T12:12:00.000Z' },
  });
  const governance = response.body.delegationGovernance;
  assert(response.status === 200 && governance.integrity.valid, 'Delegation governance must verify after file-store restart.');
  assert(governance.summary.changeCount === 1 && governance.summary.notificationCount === 3, 'Restart must retain one change and three deduplicated notifications.');
  assert(!JSON.stringify(governance).includes('PRIVATE GATE TASK TEXT'), 'Governance read model must exclude raw task text.');

  const readPolicy = classifyAccessRequest({ method: 'GET', path: `/projects/${kickoff.project.id}/delegation-governance` });
  const scanPolicy = classifyAccessRequest({ method: 'POST', path: `/projects/${kickoff.project.id}/delegation-governance/scan` });
  assert(readPolicy.allowedRoles.includes('observer'), 'Observer must be able to inspect delegation state.');
  assert(!scanPolicy.allowedRoles.includes('observer'), 'Observer must not trigger notification scans.');

  console.log('Local delegation governance validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
