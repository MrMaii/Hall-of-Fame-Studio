import assert from 'node:assert/strict';
import test from 'node:test';

import {
  academicReviewIssueIds,
  buildLocalAcademicWritingPipeline,
  createLocalAcademicDraftReceipt,
  createLocalAcademicFinalization,
  createLocalAcademicRevisionReceipt,
  createLocalAcademicWritingBlueprint,
  verifyLocalAcademicDraftReceipt,
  verifyLocalAcademicFinalization,
  verifyLocalAcademicRevisionReceipt,
  verifyLocalAcademicWritingBlueprint,
} from '../src/agents/localAcademicWritingPipeline.js';

const blueprintInput = {
  projectId: 'academic_pipeline_project',
  authorId: 'author-1',
  reviewerId: 'reviewer-1',
  researchQuestion: 'How does retrieval quality affect evidence-grounded agent writing?',
  styleGuideId: 'apa-7',
  sections: [
    { id: 'introduction', title: 'Introduction', dependsOn: [] },
    { id: 'method', title: 'Method', dependsOn: ['introduction'] },
    { id: 'discussion', title: 'Discussion', dependsOn: ['method'] },
  ],
  claims: [
    { id: 'claim-retrieval', sectionId: 'introduction', kind: 'empirical', statement: 'Retrieval quality affects grounded writing.', sourceEvidenceIds: ['evidence-search-1'] },
    { id: 'claim-method', sectionId: 'method', kind: 'methodological', statement: 'Source review must precede synthesis.', sourceEvidenceIds: ['source-snapshot-1'] },
    { id: 'claim-limit', sectionId: 'discussion', kind: 'limitation', statement: 'Local evaluation does not prove public production quality.', sourceEvidenceIds: ['evidence-search-1'] },
  ],
  knownSourceEvidenceIds: ['evidence-search-1', 'source-snapshot-1'],
  actorId: 'author-1',
  idempotencyKey: 'blueprint-1',
  now: '2026-07-10T12:00:00.000Z',
};

test('creates a content-minimized versioned research blueprint with an acyclic section and claim graph', () => {
  const blueprint = createLocalAcademicWritingBlueprint(blueprintInput);
  assert.equal(blueprint.schemaVersion, 'local-academic-writing-blueprint/v1');
  assert.equal(blueprint.status, 'ready-for-draft');
  assert.equal(blueprint.sections.map((row) => row.id).join(','), 'introduction,method,discussion');
  assert.equal(blueprint.claims.every((row) => row.statementHash && !Object.hasOwn(row, 'statement')), true);
  assert.equal(blueprint.citationIntegrityPending, true);
  assert.equal(JSON.stringify(blueprint).includes(blueprintInput.researchQuestion), false);
  assert.equal(JSON.stringify(blueprint).includes(blueprintInput.claims[0].statement), false);
  assert.equal(verifyLocalAcademicWritingBlueprint(blueprint).valid, true);

  const revised = createLocalAcademicWritingBlueprint({
    ...blueprintInput,
    version: 2,
    previousBlueprintId: blueprint.id,
    previousBlueprintChecksum: blueprint.checksum,
    governanceStartedAt: blueprint.governanceStartedAt,
    styleGuideId: 'chicago-author-date',
    idempotencyKey: 'blueprint-2',
    now: '2026-07-10T12:10:00.000Z',
  });
  assert.equal(verifyLocalAcademicWritingBlueprint(revised, blueprint).valid, true);

  const tampered = structuredClone(blueprint);
  tampered.claims[0].sourceEvidenceIds = [];
  assert.equal(verifyLocalAcademicWritingBlueprint(tampered).valid, false);
  assert.throws(() => createLocalAcademicWritingBlueprint({
    ...blueprintInput,
    idempotencyKey: 'cyclic-blueprint',
    sections: [
      { id: 'a', title: 'A', dependsOn: ['b'] },
      { id: 'b', title: 'B', dependsOn: ['a'] },
    ],
    claims: [{ id: 'claim-a', sectionId: 'a', kind: 'empirical', statement: 'A claim.', sourceEvidenceIds: ['evidence-search-1'] }],
  }), /section-dependency-cycle/);
  assert.throws(() => createLocalAcademicWritingBlueprint({ ...blueprintInput, authorId: 'same', reviewerId: 'same' }), /independent-reviewer-required/);
  assert.throws(() => createLocalAcademicWritingBlueprint({ ...blueprintInput, claims: [{ ...blueprintInput.claims[0], sourceEvidenceIds: ['invented-source'] }] }), /source-evidence-invalid/);
});

test('requires real immutable drafts, complete review issue response and accepted latest-draft finalization', () => {
  const blueprint = createLocalAcademicWritingBlueprint(blueprintInput);
  const firstSubmission = {
    id: 'submission-draft-1', agentId: 'author-1', artifactType: 'academic-manuscript',
    artifactChecksum: 'a'.repeat(64), artifactStorageProofChecksum: 'b'.repeat(64), createdAt: '2026-07-10T13:00:00.000Z',
    body: 'PRIVATE FIRST MANUSCRIPT',
  };
  const firstDraft = createLocalAcademicDraftReceipt({
    blueprint,
    submission: firstSubmission,
    coveredSectionIds: blueprint.sections.map((row) => row.id),
    coveredClaimIds: blueprint.claims.map((row) => row.id),
    wordCount: 1800,
    idempotencyKey: 'draft-1',
    now: '2026-07-10T13:01:00.000Z',
  });
  assert.equal(verifyLocalAcademicDraftReceipt(firstDraft, blueprint).valid, true);
  assert.equal(JSON.stringify(firstDraft).includes(firstSubmission.body), false);

  const requestedChangesReview = {
    id: 'review-1', submissionId: firstSubmission.id, reviewerAgentId: 'reviewer-1', verdict: 'changes-requested',
    requestedChanges: ['Clarify the method boundary.', 'Separate observed results from limitations.'], checksum: 'c'.repeat(64),
  };
  const issueIds = academicReviewIssueIds(requestedChangesReview);
  assert.equal(issueIds.length, 2);
  const revisedSubmission = {
    id: 'submission-draft-2', agentId: 'author-1', artifactType: 'academic-manuscript',
    artifactChecksum: 'd'.repeat(64), artifactStorageProofChecksum: 'e'.repeat(64), createdAt: '2026-07-10T14:00:00.000Z',
    body: 'PRIVATE REVISED MANUSCRIPT',
  };
  assert.throws(() => createLocalAcademicRevisionReceipt({
    blueprint, previousDraft: firstDraft, submission: revisedSubmission, review: requestedChangesReview,
    addressedIssueIds: [issueIds[0]], coveredSectionIds: firstDraft.coveredSectionIds, coveredClaimIds: firstDraft.coveredClaimIds,
    wordCount: 2000, idempotencyKey: 'incomplete-revision', now: '2026-07-10T14:01:00.000Z',
  }), /review-issues-unresolved/);
  const revision = createLocalAcademicRevisionReceipt({
    blueprint, previousDraft: firstDraft, submission: revisedSubmission, review: requestedChangesReview,
    addressedIssueIds: issueIds, coveredSectionIds: firstDraft.coveredSectionIds, coveredClaimIds: firstDraft.coveredClaimIds,
    wordCount: 2000, idempotencyKey: 'revision-1', now: '2026-07-10T14:01:00.000Z',
  });
  assert.equal(verifyLocalAcademicRevisionReceipt(revision, blueprint, firstDraft, requestedChangesReview).valid, true);

  const acceptedReview = {
    id: 'review-2', submissionId: revisedSubmission.id, reviewerAgentId: 'reviewer-1', verdict: 'accepted',
    requestedChanges: [], checksum: 'f'.repeat(64),
  };
  const finalization = createLocalAcademicFinalization({
    blueprint, latestDraft: revision, acceptedReview,
    idempotencyKey: 'finalization-1', now: '2026-07-10T15:00:00.000Z',
  });
  assert.equal(verifyLocalAcademicFinalization(finalization, blueprint, revision, acceptedReview).valid, true);
  assert.equal(finalization.readyForCitationIntegrityAudit, true);
  assert.equal(finalization.readyForProduction, false);

  const pipeline = buildLocalAcademicWritingPipeline({
    project: {
      id: blueprint.projectId, workModeContract: { workMode: 'academic-writing' },
      localAcademicWritingBlueprints: [blueprint], localAcademicDraftReceipts: [firstDraft],
      localAcademicRevisionReceipts: [revision], localAcademicFinalizations: [finalization],
    },
    now: '2026-07-10T15:01:00.000Z',
  });
  assert.equal(pipeline.status, 'finalized-awaiting-citation-integrity');
  assert.equal(pipeline.summary.draftVersionCount, 2);
  assert.equal(pipeline.integrity.valid, true);

  const tampered = structuredClone(revision);
  tampered.addressedIssueIds = [];
  const degraded = buildLocalAcademicWritingPipeline({
    project: { id: blueprint.projectId, workModeContract: { workMode: 'academic-writing' }, localAcademicWritingBlueprints: [blueprint], localAcademicDraftReceipts: [firstDraft], localAcademicRevisionReceipts: [tampered], localAcademicFinalizations: [finalization] },
    now: '2026-07-10T15:01:00.000Z',
  });
  assert.equal(degraded.status, 'degraded-integrity-invalid');
});
