import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
  reviewAgentSubmission,
} from '../src/agents/agentProjectService.js';
import {
  buildLocalReviewHandoffGovernance,
  createLocalReviewHandoff,
  createLocalReviewHandoffAcknowledgement,
  createLocalReviewHandoffClaim,
  createLocalReviewHandoffCompletion,
  createLocalReviewHandoffEscalation,
  localReviewSubmissionFingerprint,
  verifyLocalReviewHandoff,
  verifyLocalReviewHandoffCompletion,
} from '../src/agents/localReviewHandoff.js';

const submission = {
  id: 'submission-1',
  projectId: 'review_handoff_project',
  agentId: 'author',
  artifactType: 'implementation-plan',
  artifactChecksum: 'artifact-checksum-1',
  artifactStorageProofChecksum: 'storage-checksum-1',
  body: 'PRIVATE SUBMISSION CONTENT',
  updatedAt: '2026-07-10T12:00:00.000Z',
};
const criteria = [
  { id: 'requirements-traceable', label: 'Requirements are traceable.', required: true },
  { id: 'rollback-ready', label: 'Rollback evidence is present.', required: true },
];

test('derives acknowledged, fenced claim takeover and evidence-backed completion without artifact content', () => {
  const handoff = createLocalReviewHandoff({
    projectId: submission.projectId,
    submission,
    reviewerAgentId: 'reviewer',
    acceptanceCriteria: criteria,
    dueAt: '2026-07-11T12:00:00.000Z',
    requestedBy: 'author',
    idempotencyKey: 'handoff-1',
    now: '2026-07-10T12:05:00.000Z',
  });
  assert.equal(handoff.schemaVersion, 'local-review-handoff/v1');
  assert.equal(verifyLocalReviewHandoff(handoff).valid, true);
  assert.equal(JSON.stringify(handoff).includes('PRIVATE SUBMISSION CONTENT'), false);

  const acknowledgement = createLocalReviewHandoffAcknowledgement({
    handoff,
    reviewerAgentId: 'reviewer',
    idempotencyKey: 'ack-1',
    now: '2026-07-10T12:06:00.000Z',
  });
  const firstClaim = createLocalReviewHandoffClaim({
    handoff,
    reviewerAgentId: 'reviewer',
    fence: 1,
    leaseMs: 60_000,
    idempotencyKey: 'claim-1',
    now: '2026-07-10T12:07:00.000Z',
  });
  const secondClaim = createLocalReviewHandoffClaim({
    handoff,
    reviewerAgentId: 'reviewer',
    fence: 2,
    leaseMs: 120_000,
    idempotencyKey: 'claim-2',
    now: '2026-07-10T12:09:00.000Z',
  });
  const completion = createLocalReviewHandoffCompletion({
    handoff,
    claim: secondClaim,
    submissionFingerprint: localReviewSubmissionFingerprint(submission),
    verdict: 'accepted',
    criterionResults: criteria.map((criterion) => ({ criterionId: criterion.id, passed: true, evidenceIds: [`proof-${criterion.id}`] })),
    reviewId: 'review-1',
    reviewChecksum: 'b'.repeat(64),
    reviewerAgentId: 'reviewer',
    idempotencyKey: 'complete-1',
    now: '2026-07-10T12:10:00.000Z',
  });
  assert.equal(verifyLocalReviewHandoffCompletion(completion, handoff, secondClaim).valid, true);

  const governance = buildLocalReviewHandoffGovernance({
    project: {
      id: submission.projectId,
      localReviewHandoffs: [handoff],
      localReviewHandoffAcknowledgements: [acknowledgement],
      localReviewHandoffClaims: [secondClaim, firstClaim],
      localReviewHandoffCompletions: [completion],
    },
    now: '2026-07-10T12:10:30.000Z',
  });
  assert.equal(governance.rows[0].state, 'completed');
  assert.equal(governance.rows[0].activeFence, 2);
  assert.equal(governance.rows[0].completionId, completion.id);
  assert.equal(governance.integrity.valid, true);

  const tampered = structuredClone(completion);
  tampered.verdict = 'rejected';
  const invalid = buildLocalReviewHandoffGovernance({
    project: { id: submission.projectId, localReviewHandoffs: [handoff], localReviewHandoffClaims: [secondClaim], localReviewHandoffCompletions: [tampered] },
    now: '2026-07-10T12:10:30.000Z',
  });
  assert.equal(invalid.integrity.valid, false);
  assert.equal(invalid.status, 'degraded-integrity-invalid');
});

test('derives overdue escalation and refuses acceptance without required criterion evidence', () => {
  const handoff = createLocalReviewHandoff({
    projectId: submission.projectId,
    submission,
    reviewerAgentId: 'reviewer',
    acceptanceCriteria: criteria,
    dueAt: '2026-07-10T13:00:00.000Z',
    requestedBy: 'author',
    idempotencyKey: 'handoff-overdue',
    now: '2026-07-10T12:05:00.000Z',
  });
  const escalation = createLocalReviewHandoffEscalation({
    handoff,
    reasonCode: 'review-overdue',
    idempotencyKey: 'escalate-1',
    now: '2026-07-10T13:01:00.000Z',
  });
  const governance = buildLocalReviewHandoffGovernance({
    project: { id: submission.projectId, localReviewHandoffs: [handoff], localReviewHandoffEscalations: [escalation] },
    now: '2026-07-10T13:02:00.000Z',
  });
  assert.equal(governance.rows[0].state, 'overdue');
  assert.equal(governance.rows[0].escalated, true);

  const claim = createLocalReviewHandoffClaim({
    handoff, reviewerAgentId: 'reviewer', fence: 1, leaseMs: 60_000,
    idempotencyKey: 'claim-incomplete', now: '2026-07-10T12:10:00.000Z',
  });
  assert.throws(() => createLocalReviewHandoffCompletion({
    handoff,
    claim,
    submissionFingerprint: handoff.submissionFingerprint,
    verdict: 'accepted',
    criterionResults: [{ criterionId: criteria[0].id, passed: true, evidenceIds: ['proof-1'] }],
    reviewId: 'review-incomplete',
    reviewChecksum: 'c'.repeat(64),
    reviewerAgentId: 'reviewer',
    idempotencyKey: 'complete-incomplete',
    now: '2026-07-10T12:10:30.000Z',
  }), /criterion-coverage-required/);
});

test('separates handoff reads, submitter requests, reviewer transitions and manager scans', () => {
  const read = classifyAccessRequest({ method: 'GET', path: '/projects/project-1/review-handoffs' });
  const create = classifyAccessRequest({ method: 'POST', path: '/projects/project-1/review-handoffs' });
  const claim = classifyAccessRequest({ method: 'POST', path: '/projects/project-1/review-handoffs/handoff-1/claim' });
  const scan = classifyAccessRequest({ method: 'POST', path: '/projects/project-1/review-handoffs/scan' });
  assert.equal(read.allowedRoles.includes('observer'), true);
  assert.equal(create.allowedRoles.includes('agent'), true);
  assert.deepEqual(claim.allowedRoles, ['reviewer-agent', 'security-admin']);
  assert.equal(scan.allowedRoles.includes('runtime-platform'), true);
  assert.equal(scan.allowedRoles.includes('reviewer-agent'), false);
});

test('rejects self-review even outside a governed work mode', () => {
  const author = { id: 'solo-author', name: 'Solo Author', title: 'Creator' };
  assert.throws(() => reviewAgentSubmission({
    project: {
      id: 'self_review_project',
      team: [author],
      agentSubmissions: [{
        id: 'self-submission', projectId: 'self_review_project', agentId: author.id,
        agentName: author.name, title: 'Self submission', artifactType: 'progress-brief', status: 'submitted',
      }],
      submissionReviews: [], tasks: [], logs: [], messages: [], agentStates: {},
    },
    submissionId: 'self-submission',
    reviewerAgentId: author.id,
    verdict: 'accepted',
    now: '2026-07-10T12:00:00.000Z',
  }), /reviewer-must-be-independent/);
});

test('enforces file-backed acknowledgement, lease fences, stale submission protection and real review completion', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-review-handoff-'));
  const filePath = join(directory, 'projects.json');
  try {
    const kickoff = createKickoffProjectFromMeeting({
      projectId: 'review_handoff_api_project',
      name: 'Review Handoff API Project',
      brief: 'Prove accountable local review handoffs.',
      team: [
        { id: 'author', name: 'Author', title: 'Systems Engineer' },
        { id: 'reviewer', name: 'Reviewer', title: 'Independent Reviewer' },
        { id: 'manager', name: 'Manager', title: 'Project Manager', isLeader: true },
      ],
      now: '2026-07-10T10:00:00.000Z',
    });
    kickoff.project.tasks = [{ id: 'implementation-plan', text: 'Prepare implementation plan.', status: 'pending', assignee: 'author', reviewerId: 'reviewer' }];
    const store = createAgentProjectFileStore({ filePath, projects: [kickoff.project], messages: kickoff.messages, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let service = createAgentProjectService({ store });
    let api = createAgentProjectApi({ service });
    let submitted = service.submitAgentArtifact({
      projectId: kickoff.project.id,
      agentId: 'author',
      taskId: 'implementation-plan',
      artifactType: 'implementation-plan',
      body: 'PRIVATE IMPLEMENTATION PLAN CONTENT',
      reviewerAgentId: 'reviewer',
      now: '2026-07-10T12:00:00.000Z',
    });
    const submittedArtifact = submitted.submission;

    let response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs`,
      headers: { 'x-hofs-role': 'agent', 'x-hofs-agent-id': 'author', 'x-hofs-user-id': 'author-user' },
      body: {
        submissionId: submittedArtifact.id,
        reviewerAgentId: 'reviewer',
        acceptanceCriteria: criteria,
        dueAt: '2026-07-11T12:00:00.000Z',
        idempotencyKey: 'api-handoff-1',
        now: '2026-07-10T12:05:00.000Z',
      },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const handoff = response.body.handoff;
    assert.equal(JSON.stringify(handoff).includes('PRIVATE IMPLEMENTATION PLAN CONTENT'), false);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/acknowledge`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: { idempotencyKey: 'api-ack-1', now: '2026-07-10T12:06:00.000Z' },
    });
    assert.equal(response.status, 201);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/claim`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: { leaseMs: 60_000, idempotencyKey: 'api-claim-1', now: '2026-07-10T12:07:00.000Z' },
    });
    assert.equal(response.status, 201);
    const firstClaim = response.body.claim;

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/claim`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: { leaseMs: 60_000, idempotencyKey: 'api-claim-too-soon', now: '2026-07-10T12:07:30.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /claim-active/);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/claim`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: { leaseMs: 120_000, idempotencyKey: 'api-claim-2', now: '2026-07-10T12:09:00.000Z' },
    });
    assert.equal(response.status, 201);
    const secondClaim = response.body.claim;
    assert.equal(secondClaim.fence, 2);

    const completeBody = {
      claimId: secondClaim.id,
      fence: 2,
      verdict: 'accepted',
      criterionResults: criteria.map((criterion) => ({ criterionId: criterion.id, passed: true, evidenceIds: [`proof-${criterion.id}`] })),
      comments: 'All criteria independently verified.',
      idempotencyKey: 'api-complete-1',
      now: '2026-07-10T12:10:00.000Z',
    };
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/complete`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: { ...completeBody, claimId: firstClaim.id, fence: 1, idempotencyKey: 'api-complete-stale-fence' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /stale-claim/);

    const projectWithChangedSubmission = store.getProject(kickoff.project.id);
    const target = projectWithChangedSubmission.agentSubmissions.find((row) => row.id === submittedArtifact.id);
    const originalUpdatedAt = target.updatedAt;
    target.updatedAt = '2026-07-10T12:09:30.000Z';
    store.saveProject(projectWithChangedSubmission);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/complete`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: { ...completeBody, idempotencyKey: 'api-complete-stale-submission' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /stale-submission/);
    const restoredProject = store.getProject(kickoff.project.id);
    restoredProject.agentSubmissions.find((row) => row.id === submittedArtifact.id).updatedAt = originalUpdatedAt;
    store.saveProject(restoredProject);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/complete`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: { ...completeBody, criterionResults: [completeBody.criterionResults[0]], idempotencyKey: 'api-complete-incomplete' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /criterion-coverage-required/);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/complete`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: completeBody,
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.review.verdict, 'accepted');
    assert.equal(response.body.completion.reviewId, response.body.review.id);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/complete`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: { ...completeBody, now: '2026-07-10T12:10:30.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/${handoff.id}/complete`,
      headers: { 'x-hofs-role': 'reviewer-agent', 'x-hofs-agent-id': 'reviewer', 'x-hofs-user-id': 'reviewer-user' },
      body: {
        ...completeBody,
        criterionResults: completeBody.criterionResults.map((row, index) => index ? row : { ...row, evidenceIds: ['different-proof'] }),
        now: '2026-07-10T12:10:40.000Z',
      },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /idempotency-conflict/);
    response = await api.handleAsync({
      method: 'GET', path: `/projects/${kickoff.project.id}/submission-review-workflow`,
      headers: { 'x-hofs-role': 'observer', 'x-hofs-user-id': 'observer-user' },
      body: { now: '2026-07-10T12:11:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.submissionReviewWorkflow.summary.governedReviewCount, 1);
    assert.equal(response.body.submissionReviewWorkflow.summary.legacyReviewCount, 0);
    assert.equal(response.body.submissionReviewWorkflow.roundRows[0].leaseGoverned, true);
    assert.equal(response.body.submissionReviewWorkflow.reviewHandoffGovernance.integrity.valid, true);

    submitted = service.submitAgentArtifact({
      projectId: kickoff.project.id,
      agentId: 'author',
      artifactType: 'progress-brief',
      body: 'Second private artifact.',
      reviewerAgentId: 'reviewer',
      now: '2026-07-10T13:00:00.000Z',
    });
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs`,
      headers: { 'x-hofs-role': 'agent', 'x-hofs-agent-id': 'author', 'x-hofs-user-id': 'author-user' },
      body: {
        submissionId: submitted.submission.id, reviewerAgentId: 'reviewer', acceptanceCriteria: [criteria[0]],
        dueAt: '2026-07-10T13:20:00.000Z', idempotencyKey: 'api-handoff-overdue', now: '2026-07-10T13:01:00.000Z',
      },
    });
    assert.equal(response.status, 201);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/scan`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-user' },
      body: { idempotencyKey: 'api-scan-1', now: '2026-07-10T13:21:00.000Z' },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.escalationBatch.createdCount, 1);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${kickoff.project.id}/review-handoffs/scan`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-user' },
      body: { idempotencyKey: 'api-scan-2', now: '2026-07-10T13:22:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.escalationBatch.createdCount, 0);

    service = createAgentProjectService({ store });
    api = createAgentProjectApi({ service });
    response = await api.handleAsync({
      method: 'GET', path: `/projects/${kickoff.project.id}/review-handoffs`,
      headers: { 'x-hofs-role': 'observer', 'x-hofs-user-id': 'observer-user' },
      body: { now: '2026-07-10T13:23:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.reviewHandoffGovernance.summary.completedCount, 1);
    assert.equal(response.body.reviewHandoffGovernance.summary.escalatedCount, 1);
    assert.equal(response.body.reviewHandoffGovernance.integrity.valid, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
