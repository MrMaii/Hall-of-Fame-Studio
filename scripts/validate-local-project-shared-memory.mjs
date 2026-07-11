import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-project-shared-memory-${process.pid}`);
const filePath = resolve(tempRoot, 'projects.json');
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const kickoff = createKickoffProjectFromMeeting({
    projectId: 'shared_memory_gate_project',
    name: 'Shared Memory Gate',
    brief: 'Prove governed local project knowledge across a real team.',
    team: [
      { id: 'delivery-lead', name: 'Delivery Lead' },
      { id: 'other-agent', name: 'Other Agent' },
      { id: 'reviewer', name: 'Reviewer' },
    ],
    now: '2026-07-10T10:00:00.000Z',
  });
  kickoff.project.tasks = [{ id: 'rollback-plan', text: 'Gate task body', status: 'pending', assignee: 'delivery-lead', reviewerId: 'reviewer' }];
  const store = createAgentProjectFileStore({
    filePath,
    projects: [kickoff.project],
    messages: kickoff.messages,
    replaceWithSeed: true,
    hydrateProject: hydrateAgentProject,
  });
  let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
  const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-one' };
  const createMemory = async (body) => api.handleAsync({
    method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories`, headers, body,
  });
  const citation = [{ sourceType: 'task', sourceId: 'rollback-plan' }];

  let response = await createMemory({
    memoryKey: 'release.rollback-required', kind: 'constraint',
    content: 'Release requires rollback evidence before approval.', citations: citation,
    confidence: 0.95, confidenceBasis: 'verified', expiresAt: '2026-08-10T12:00:00.000Z',
    accessScope: { visibility: 'agents', agentIds: ['delivery-lead'] },
    idempotencyKey: 'gate-memory-agent-1', now: '2026-07-10T12:00:00.000Z',
  });
  assert(response.status === 201, `Agent-scoped memory create returned ${response.status}.`);
  const first = response.body.memory;
  assert(first.citations[0].sourceChecksum?.length === 64, 'Citation must bind a SHA-256 source fingerprint.');

  response = await createMemory({
    memoryKey: 'management.release-window', kind: 'decision',
    content: 'Management review occurs after the restore drill.', citations: citation,
    confidence: 0.9, confidenceBasis: 'reported', expiresAt: '2026-08-10T12:00:00.000Z',
    accessScope: { visibility: 'management' },
    idempotencyKey: 'gate-memory-management-1', now: '2026-07-10T12:01:00.000Z',
  });
  assert(response.status === 201, 'Management-scoped memory must persist locally.');

  response = await createMemory({
    memoryKey: 'temporary.release-signal', kind: 'fact',
    content: 'Temporary release signal is valid for this rehearsal window.', citations: citation,
    confidence: 0.8, confidenceBasis: 'observed', expiresAt: '2026-07-10T12:30:00.000Z',
    accessScope: { visibility: 'project' },
    idempotencyKey: 'gate-memory-expiring-1', now: '2026-07-10T12:02:00.000Z',
  });
  assert(response.status === 201, 'Expiring project memory must persist locally.');

  response = await api.handleAsync({
    method: 'GET', path: `/projects/${kickoff.project.id}/shared-memories`,
    headers: { 'x-hofs-role': 'agent', 'x-hofs-agent-id': 'delivery-lead' },
    body: { now: '2026-07-10T12:10:00.000Z' },
  });
  assert(response.body.sharedMemory.rows.length === 2, 'Target Agent must see Agent-scoped plus project memory, not management memory.');
  response = await api.handleAsync({
    method: 'GET', path: `/projects/${kickoff.project.id}/shared-memories`,
    headers: { 'x-hofs-role': 'agent', 'x-hofs-agent-id': 'other-agent' },
    body: { now: '2026-07-10T12:10:00.000Z' },
  });
  assert(response.body.sharedMemory.rows.length === 1, 'Other Agent must see only project memory.');

  response = await api.handleAsync({
    method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories/${first.id}/revisions`, headers,
    body: {
      content: 'Release requires rollback evidence and a restore drill before approval.', citations: citation,
      confidence: 0.98, confidenceBasis: 'verified', expiresAt: '2026-08-11T12:00:00.000Z',
      accessScope: first.accessScope, expectedPreviousChecksum: 'f'.repeat(64),
      idempotencyKey: 'gate-memory-stale-revision', now: '2026-07-11T12:00:00.000Z',
    },
  });
  assert(response.status === 400 && /stale-version/.test(response.body.message || ''), 'Stale optimistic revision must fail.');
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories/${first.id}/revisions`, headers,
    body: {
      content: 'Release requires rollback evidence and a restore drill before approval.', citations: citation,
      confidence: 0.98, confidenceBasis: 'verified', expiresAt: '2026-08-11T12:00:00.000Z',
      accessScope: first.accessScope, expectedPreviousChecksum: first.checksum,
      idempotencyKey: 'gate-memory-revision-1', now: '2026-07-11T12:00:00.000Z',
    },
  });
  assert(response.status === 201 && response.body.memory.version === 2, 'Valid optimistic revision must append version two.');
  const second = response.body.memory;

  response = await api.handleAsync({
    method: 'POST', path: `/projects/${kickoff.project.id}/shared-memories/${second.id}/revoke`,
    headers: { 'x-hofs-role': 'security-admin', 'x-hofs-user-id': 'security-one' },
    body: { reasonCode: 'source-invalidated', idempotencyKey: 'gate-memory-revoke-1', now: '2026-07-12T12:00:00.000Z' },
  });
  assert(response.status === 201 && response.body.memory.status === 'revoked', 'Revocation must be receipt-backed.');

  api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
  response = await api.handleAsync({
    method: 'GET', path: `/projects/${kickoff.project.id}/shared-memories`, headers,
    body: { includeHistory: true, includeContents: false, now: '2026-07-13T12:00:00.000Z' },
  });
  const sharedMemory = response.body.sharedMemory;
  assert(sharedMemory.integrity.valid && sharedMemory.summary.versionCount === 4, 'All four immutable versions must verify after restart.');
  assert(sharedMemory.summary.revokedCount === 1, 'Revocation must survive restart.');
  assert(sharedMemory.summary.expiredCount === 1, 'Explicit expiry must be derived after restart.');
  assert(sharedMemory.rows.every((row) => row.content === undefined), 'Metadata-only reads must omit memory content.');

  response = await api.handleAsync({
    method: 'GET', path: `/projects/${kickoff.project.id}/memory-readiness`, headers,
    body: { now: '2026-07-13T12:00:00.000Z' },
  });
  assert(response.body.projectMemoryReadiness.summary.sharedMemoryVersionCount === 4, 'Memory readiness must include shared-memory version evidence.');
  assert(response.body.projectMemoryReadiness.relatedReadiness.sharedMemoryIntegrityValid, 'Memory readiness must verify shared-memory integrity.');
  assert(!JSON.stringify(store.getProject(kickoff.project.id).eventLedger || []).includes('restore drill before approval'), 'Event ledger must not duplicate raw memory content.');

  console.log('Local project shared memory validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
