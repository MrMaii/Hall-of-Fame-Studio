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
import { createLocalReviewHandoff, verifyLocalReviewHandoff } from '../src/agents/localReviewHandoff.js';
import { composeWorkModeTeam } from '../src/agents/workModes.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const modes = ['learning', 'academic-writing', 'investigation', 'technical-delivery', 'creative-studio'];
for (const workMode of modes) {
  const team = composeWorkModeTeam({ workMode, objective: `Validate ${workMode} review handoff.` });
  const task = team.taskNodes[0];
  const submission = {
    id: `${workMode}-submission`, projectId: `${workMode}-project`, agentId: task.ownerPersonaSlug,
    artifactType: task.artifactType, artifactChecksum: `${workMode}-artifact`, body: `${workMode} private body`, updatedAt: '2026-07-10T12:00:00.000Z',
  };
  const acceptanceCriteria = task.acceptanceChecks.map((check) => ({ id: check.id, label: `${check.id} must pass.`, required: true }));
  const handoff = createLocalReviewHandoff({
    projectId: submission.projectId, submission, reviewerAgentId: task.reviewerPersonaSlug,
    acceptanceCriteria, dueAt: '2026-07-11T12:00:00.000Z', requestedBy: submission.agentId,
    idempotencyKey: `${workMode}-handoff`, now: '2026-07-10T12:05:00.000Z',
  });
  assert(verifyLocalReviewHandoff(handoff).valid, `${workMode} handoff must verify.`);
  assert(handoff.acceptanceCriteria.length === team.acceptanceChecks.length, `${workMode} must retain every mode acceptance check.`);
  assert(handoff.submitterAgentId !== handoff.reviewerAgentId, `${workMode} Reviewer must remain independent.`);
  assert(!JSON.stringify(handoff).includes(`${workMode} private body`), `${workMode} handoff must omit artifact content.`);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-review-handoff-${process.pid}`);
const filePath = resolve(tempRoot, 'projects.json');
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const kickoff = createKickoffProjectFromMeeting({
    projectId: 'review_handoff_gate_project', name: 'Review Handoff Gate', brief: 'Prove local independent review governance.',
    team: [
      { id: 'author', name: 'Author', title: 'Creator' },
      { id: 'reviewer', name: 'Reviewer', title: 'Independent Reviewer' },
      { id: 'manager', name: 'Manager', title: 'Project Manager', isLeader: true },
    ],
    now: '2026-07-10T10:00:00.000Z',
  });
  const store = createAgentProjectFileStore({ filePath, projects: [kickoff.project], messages: kickoff.messages, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
  let service = createAgentProjectService({ store });
  let api = createAgentProjectApi({ service });
  const submission = service.submitAgentArtifact({
    projectId: kickoff.project.id, agentId: 'author', artifactType: 'implementation-plan',
    body: 'PRIVATE HANDOFF GATE ARTIFACT', reviewerAgentId: 'reviewer', now: '2026-07-10T12:00:00.000Z',
  }).submission;
  const acceptanceCriteria = [
    { id: 'requirements-traceable', label: 'Requirements are traceable.', required: true },
    { id: 'rollback-ready', label: 'Rollback proof is present.', required: true },
  ];
  let response = await api.handleAsync({
    method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs`,
    headers: { 'x-hofs-role': 'agent', 'x-hofs-agent-id': 'author', 'x-hofs-user-id': 'author-user' },
    body: { submissionId: submission.id, reviewerAgentId: 'reviewer', acceptanceCriteria, dueAt: '2026-07-11T12:00:00.000Z', idempotencyKey: 'gate-handoff-1', now: '2026-07-10T12:05:00.000Z' },
  });
  assert(response.status === 201, `Handoff create returned ${response.status}.`);
  const handoff = response.body.handoff;
  assert(!JSON.stringify(handoff).includes('PRIVATE HANDOFF GATE ARTIFACT'), 'Handoff receipt must omit artifact content.');
  const reviewerHeaders = { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' };
  response = await api.handleAsync({ method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/acknowledge`, headers: reviewerHeaders, body: { idempotencyKey: 'gate-ack-1', now: '2026-07-10T12:06:00.000Z' } });
  assert(response.status === 201, 'Reviewer acknowledgement must persist.');
  response = await api.handleAsync({ method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/claim`, headers: reviewerHeaders, body: { leaseMs: 60_000, idempotencyKey: 'gate-claim-1', now: '2026-07-10T12:07:00.000Z' } });
  assert(response.status === 201 && response.body.claim.fence === 1, 'First claim must use fence one.');
  response = await api.handleAsync({ method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/claim`, headers: reviewerHeaders, body: { leaseMs: 60_000, idempotencyKey: 'gate-claim-active', now: '2026-07-10T12:07:30.000Z' } });
  assert(response.status === 400 && /claim-active/.test(response.body.message || ''), 'Active lease must block another claim.');
  response = await api.handleAsync({ method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/claim`, headers: reviewerHeaders, body: { leaseMs: 120_000, idempotencyKey: 'gate-claim-2', now: '2026-07-10T12:09:00.000Z' } });
  assert(response.status === 201 && response.body.claim.fence === 2, 'Expired lease takeover must increment the fence.');
  const claim = response.body.claim;
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/complete`, headers: reviewerHeaders,
    body: {
      claimId: claim.id, fence: claim.fence, verdict: 'accepted', comments: 'Independent criteria verified.',
      criterionResults: acceptanceCriteria.map((criterion) => ({ criterionId: criterion.id, passed: true, evidenceIds: [`gate-proof-${criterion.id}`] })),
      idempotencyKey: 'gate-complete-1', now: '2026-07-10T12:10:00.000Z',
    },
  });
  assert(response.status === 201 && response.body.review?.verdict === 'accepted', 'Completion must invoke the real accepted review path.');
  assert(response.body.completion.reviewId === response.body.review.id, 'Completion must bind the real review id.');

  const overdueSubmission = service.submitAgentArtifact({
    projectId: kickoff.project.id, agentId: 'author', artifactType: 'progress-brief', body: 'PRIVATE OVERDUE ARTIFACT',
    reviewerAgentId: 'reviewer', now: '2026-07-10T13:00:00.000Z',
  }).submission;
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs`,
    headers: { 'x-hofs-role': 'agent', 'x-hofs-agent-id': 'author', 'x-hofs-user-id': 'author-user' },
    body: { submissionId: overdueSubmission.id, reviewerAgentId: 'reviewer', acceptanceCriteria: [acceptanceCriteria[0]], dueAt: '2026-07-10T13:20:00.000Z', idempotencyKey: 'gate-handoff-overdue', now: '2026-07-10T13:01:00.000Z' },
  });
  assert(response.status === 201, 'Overdue candidate handoff must persist.');
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/scan`,
    headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-user' },
    body: { idempotencyKey: 'gate-scan-1', now: '2026-07-10T13:21:00.000Z' },
  });
  assert(response.status === 201 && response.body.escalationBatch.createdCount === 1, 'Overdue scan must create one escalation.');

  service = createAgentProjectService({ store });
  api = createAgentProjectApi({ service });
  response = await api.handleAsync({ method: 'GET', path: `/projects/${kickoff.project.id}/review-handoffs`, body: { now: '2026-07-10T13:22:00.000Z' } });
  assert(response.body.reviewHandoffGovernance.integrity.valid, 'Review handoff receipts must verify after restart.');
  assert(response.body.reviewHandoffGovernance.summary.completedCount === 1 && response.body.reviewHandoffGovernance.summary.escalatedCount === 1, 'Completion and escalation must survive restart.');
  response = await api.handleAsync({ method: 'GET', path: `/projects/${kickoff.project.id}/submission-review-workflow`, body: { now: '2026-07-10T13:22:00.000Z' } });
  assert(response.body.submissionReviewWorkflow.summary.governedReviewCount === 1, 'Review workflow must identify the lease-governed review.');
  assert(response.body.submissionReviewWorkflow.summary.legacyReviewCount === 0, 'Gate review must not be mislabeled legacy.');

  console.log('Local review handoff governance validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
