import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLocalCitationIntegrity,
  createLocalCitationAssessment,
  createLocalCitationIntegrityAudit,
  verifyLocalCitationAssessment,
  verifyLocalCitationIntegrityAudit,
} from '../src/agents/localCitationIntegrity.js';
import {
  createLocalAcademicWritingBlueprint,
} from '../src/agents/localAcademicWritingPipeline.js';

const blueprint = createLocalAcademicWritingBlueprint({
  projectId: 'academic-project', authorId: 'author', reviewerId: 'reviewer',
  researchQuestion: 'PRIVATE RESEARCH QUESTION', styleGuideId: 'apa-7',
  sections: [{ id: 'discussion', title: 'Discussion', dependsOn: [] }],
  claims: [
    { id: 'claim-a', sectionId: 'discussion', kind: 'empirical', statement: 'PRIVATE CLAIM A', sourceEvidenceIds: ['search-1'] },
    { id: 'claim-b', sectionId: 'discussion', kind: 'limitation', statement: 'PRIVATE CLAIM B', sourceEvidenceIds: ['snapshot-2'] },
  ],
  knownSourceEvidenceIds: ['search-1', 'snapshot-2'], actorId: 'author', idempotencyKey: 'blueprint-1', now: '2026-07-10T10:00:00.000Z',
});

const latestDraft = {
  schemaVersion: 'local-academic-revision-receipt/v1', id: 'draft-2', projectId: blueprint.projectId,
  blueprintId: blueprint.id, blueprintChecksum: blueprint.checksum, draftVersion: 2,
  previousDraftId: 'draft-1', previousDraftChecksum: 'a'.repeat(64), reviewId: 'review-1', reviewChecksum: 'b'.repeat(64),
  submissionId: 'submission-2', artifactChecksum: 'c'.repeat(64), artifactStorageProofChecksum: 'd'.repeat(64),
  coveredSectionIds: ['discussion'], coveredClaimIds: ['claim-a', 'claim-b'], wordCount: 1000,
  idempotencyKey: 'draft-2', storesRawContent: false, createdAt: '2026-07-10T11:00:00.000Z', checksum: 'e'.repeat(64),
};
const acceptedReview = {
  id: 'review-2', submissionId: 'submission-2', reviewerAgentId: 'reviewer', verdict: 'accepted', requestedChanges: [], createdAt: '2026-07-10T11:10:00.000Z',
};
// The pure citation contract only needs an exact capability-43 finalization binding.
const finalization = {
  schemaVersion: 'local-academic-finalization/v1', id: 'finalization-1', projectId: blueprint.projectId,
  blueprintId: blueprint.id, blueprintChecksum: blueprint.checksum, latestDraftId: latestDraft.id,
  latestDraftChecksum: latestDraft.checksum, submissionId: latestDraft.submissionId,
  artifactChecksum: latestDraft.artifactChecksum, artifactStorageProofChecksum: latestDraft.artifactStorageProofChecksum,
  acceptedReviewId: acceptedReview.id, acceptedReviewChecksum: 'f'.repeat(64), reviewerId: blueprint.reviewerId,
  sectionCoverageCount: 1, claimCoverageCount: 2, readyForCitationIntegrityAudit: true, readyForProduction: false,
  idempotencyKey: 'finalization-1', storesRawContent: false, createdAt: '2026-07-10T11:11:00.000Z', checksum: '1'.repeat(64),
};

function assessment(overrides = {}) {
  return createLocalCitationAssessment({
    blueprint,
    claimId: 'claim-a', sourceEvidenceId: 'search-1',
    sourceSnapshot: {
      schemaVersion: 'evidence-source-snapshot/v1', id: 'snapshot-1', evidenceSearchId: 'search-1',
      sourceId: 'source-1', checksum: '2'.repeat(64), capturedAt: '2026-07-09T12:00:00.000Z',
    },
    assessorId: 'reviewer', stance: 'supports', sourceStatus: 'active',
    publishedAt: '2026-01-01T00:00:00.000Z', statusCheckedAt: '2026-07-09T12:00:00.000Z',
    evidenceExcerpt: 'PRIVATE SOURCE EXCERPT', locator: 'p. 4', rationale: 'PRIVATE REVIEW RATIONALE',
    idempotencyKey: 'assessment-a-1', now: '2026-07-10T12:00:00.000Z',
    ...overrides,
  });
}

test('binds a content-minimized independent semantic assessment to one exact claim, citation and real snapshot', () => {
  const row = assessment();
  assert.equal(verifyLocalCitationAssessment(row, blueprint).valid, true);
  assert.equal(row.claimId, 'claim-a');
  assert.equal(row.sourceEvidenceId, 'search-1');
  assert.equal(row.sourceSnapshotId, 'snapshot-1');
  assert.equal(row.evidenceExcerptLength, 'PRIVATE SOURCE EXCERPT'.length);
  assert.equal(row.rationaleLength, 'PRIVATE REVIEW RATIONALE'.length);
  assert.equal(JSON.stringify(row).includes('PRIVATE SOURCE EXCERPT'), false);
  assert.equal(JSON.stringify(row).includes('PRIVATE REVIEW RATIONALE'), false);
  assert.throws(() => assessment({ assessorId: 'author' }), /independent-assessor-required/);
  assert.throws(() => assessment({
    sourceSnapshot: { schemaVersion: 'evidence-source-snapshot/v1', id: 'wrong-snapshot', evidenceSearchId: 'wrong-search', checksum: '2'.repeat(64) },
  }), /source-snapshot-binding-invalid/);
  assert.throws(() => assessment({ stance: 'supports', evidenceExcerpt: '' }), /evidence-excerpt-required/);
  assert.throws(() => assessment({ locator: 'PRIVATE EXCERPT SMUGGLED THROUGH LOCATOR' }), /locator-invalid/);
  assert.throws(() => assessment({ publishedAt: '2026-07-11T00:00:00.000Z' }), /published-at-future/);
  assert.throws(() => assessment({ statusCheckedAt: '2026-07-11T00:00:00.000Z' }), /status-checked-at-future/);
  assert.throws(() => assessment({ publishedAt: '2026-07-09T00:00:00.000Z', statusCheckedAt: '2026-07-08T00:00:00.000Z' }), /status-check-before-publication/);
  const tampered = { ...row, stance: 'contradicts' };
  assert.equal(verifyLocalCitationAssessment(tampered, blueprint).valid, false);
});

test('automatically blocks missing, unsupported, contradictory, stale and invalid-status citations before passing a complete replacement set', () => {
  const base = assessment();
  const blockedB = assessment({
    claimId: 'claim-b', sourceEvidenceId: 'snapshot-2',
    sourceSnapshot: {
      schemaVersion: 'evidence-source-snapshot/v1', id: 'snapshot-2', evidenceSearchId: 'search-2',
      sourceId: 'source-2', checksum: '3'.repeat(64), capturedAt: '2026-07-09T12:00:00.000Z',
    },
    stance: 'contradicts', sourceStatus: 'retracted', publishedAt: '2020-01-01T00:00:00.000Z',
    statusCheckedAt: '2026-05-01T00:00:00.000Z', evidenceExcerpt: 'PRIVATE CONTRADICTION',
    idempotencyKey: 'assessment-b-1', now: '2026-07-10T12:01:00.000Z',
  });
  const blocked = createLocalCitationIntegrityAudit({
    blueprint, finalization, assessments: [base, blockedB],
    policy: { maxPublicationAgeDays: 730, maxStatusCheckAgeDays: 30 },
    idempotencyKey: 'audit-1', now: '2026-07-10T13:00:00.000Z',
  });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.readyForLocalCitationIntegrity, false);
  assert.deepEqual(new Set(blocked.findings.map((row) => row.code)), new Set([
    'citation-contradicts-claim', 'claim-unsupported', 'source-publication-stale', 'source-status-check-stale', 'source-retracted',
  ]));

  const missing = createLocalCitationIntegrityAudit({
    blueprint, finalization, assessments: [base], idempotencyKey: 'audit-missing', now: '2026-07-10T13:01:00.000Z',
  });
  assert.deepEqual(new Set(missing.findings.map((row) => row.code)), new Set(['citation-assessment-missing', 'claim-unsupported']));

  for (const [stance, code] of [['irrelevant', 'citation-irrelevant'], ['uncertain', 'citation-support-uncertain']]) {
    const row = assessment({
      claimId: 'claim-b', sourceEvidenceId: 'snapshot-2',
      sourceSnapshot: { schemaVersion: 'evidence-source-snapshot/v1', id: 'snapshot-2', evidenceSearchId: 'search-2', sourceId: 'source-2', checksum: '3'.repeat(64) },
      stance, evidenceExcerpt: '', idempotencyKey: `assessment-${stance}`,
    });
    const audit = createLocalCitationIntegrityAudit({ blueprint, finalization, assessments: [base, row], idempotencyKey: `audit-${stance}`, now: '2026-07-10T13:02:00.000Z' });
    assert.ok(audit.findings.some((finding) => finding.code === code));
  }

  for (const [sourceStatus, code] of [['corrected', 'source-corrected'], ['unavailable', 'source-unavailable']]) {
    const row = assessment({
      claimId: 'claim-b', sourceEvidenceId: 'snapshot-2',
      sourceSnapshot: { schemaVersion: 'evidence-source-snapshot/v1', id: 'snapshot-2', evidenceSearchId: 'search-2', sourceId: 'source-2', checksum: '3'.repeat(64) },
      sourceStatus, idempotencyKey: `assessment-${sourceStatus}`,
    });
    const audit = createLocalCitationIntegrityAudit({ blueprint, finalization, assessments: [base, row], idempotencyKey: `audit-${sourceStatus}`, now: '2026-07-10T13:03:00.000Z' });
    assert.ok(audit.findings.some((finding) => finding.code === code));
  }

  const supportedB = assessment({
    claimId: 'claim-b', sourceEvidenceId: 'snapshot-2',
    sourceSnapshot: {
      schemaVersion: 'evidence-source-snapshot/v1', id: 'snapshot-2', evidenceSearchId: 'search-2',
      sourceId: 'source-2', checksum: '3'.repeat(64), capturedAt: '2026-07-09T12:00:00.000Z',
    },
    stance: 'supports', sourceStatus: 'active', publishedAt: '2026-02-01T00:00:00.000Z',
    statusCheckedAt: '2026-07-09T12:00:00.000Z', evidenceExcerpt: 'PRIVATE SUPPORT B',
    idempotencyKey: 'assessment-b-2', now: '2026-07-10T12:02:00.000Z',
  });
  const passed = createLocalCitationIntegrityAudit({
    blueprint, finalization, assessments: [base, supportedB], idempotencyKey: 'audit-passed', now: '2026-07-10T13:10:00.000Z',
  });
  assert.equal(passed.status, 'passed');
  assert.equal(passed.findings.length, 0);
  assert.equal(passed.summary.requiredCitationCount, 2);
  assert.equal(passed.summary.supportedClaimCount, 2);
  assert.equal(passed.readyForLocalCitationIntegrity, true);
  assert.equal(passed.readyForProduction, false);
  assert.equal(verifyLocalCitationIntegrityAudit(passed, blueprint, finalization, [base, supportedB]).valid, true);

  const readModel = buildLocalCitationIntegrity({
    project: {
      id: blueprint.projectId, workModeContract: { workMode: 'academic-writing' },
      localAcademicWritingBlueprints: [blueprint], localAcademicFinalizations: [finalization],
      evidenceSourceSnapshots: [
        { id: 'snapshot-1', evidenceSearchId: 'search-1', checksum: '2'.repeat(64) },
        { id: 'snapshot-2', evidenceSearchId: 'search-2', checksum: '3'.repeat(64) },
      ],
      localCitationAssessments: [base, supportedB], localCitationIntegrityAudits: [passed],
    },
    now: '2026-07-10T13:11:00.000Z',
  });
  assert.equal(readModel.status, 'passed');
  assert.equal(readModel.integrity.valid, true);
  assert.equal(readModel.readyForLocalCitationIntegrity, true);
  const degraded = buildLocalCitationIntegrity({
    project: {
      id: blueprint.projectId, workModeContract: { workMode: 'academic-writing' },
      localAcademicWritingBlueprints: [blueprint], localAcademicFinalizations: [finalization],
      evidenceSourceSnapshots: [
        { id: 'snapshot-1', evidenceSearchId: 'search-1', checksum: '2'.repeat(64) },
        { id: 'snapshot-2', evidenceSearchId: 'search-2', checksum: '3'.repeat(64) },
      ],
      localCitationAssessments: [{ ...base, stance: 'contradicts' }, supportedB], localCitationIntegrityAudits: [passed],
    },
    now: '2026-07-10T13:11:00.000Z',
  });
  assert.equal(degraded.status, 'degraded-integrity-invalid');
  assert.equal(degraded.readyForLocalCitationIntegrity, false);
});
