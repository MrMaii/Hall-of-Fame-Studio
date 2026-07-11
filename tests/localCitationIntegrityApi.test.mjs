import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { academicReviewIssueIds } from '../src/agents/localAcademicWritingPipeline.js';

const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-author' };

async function createFinalizedAcademicProject(api) {
  let response = await api.handleAsync({
    method: 'POST', path: '/projects/initiate', headers,
    body: { projectId: 'citation_integrity_api_project', name: 'Citation Integrity', brief: 'Audit a finalized local manuscript.', workMode: 'academic-writing', includeReadModels: false },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.readModels.citationIntegrityRoute, '/projects/citation_integrity_api_project/citation-integrity');
  const project = response.body.project;
  const role = (id) => project.workModeContract.roles.find((row) => row.id === id)?.personaSlug;
  const authorId = role('argument-editor');
  const reviewerId = role('citation-reviewer');
  const researcherId = role('literature-researcher');
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${project.id}/agents/${researcherId}/evidence-searches`, headers,
    body: {
      query: 'Citation integrity fixtures', purpose: 'Create exact local source snapshots.', includeReadModels: false,
      sources: [
        { id: 'source-a', title: 'Source A', url: 'https://example.test/citation-a', publisher: 'Local fixture' },
        { id: 'source-b', title: 'Source B', url: 'https://example.test/citation-b', publisher: 'Local fixture' },
      ],
      findings: ['Two bounded fixtures are available for independent citation assessment.'], confidence: 'high', now: '2026-07-10T10:00:00.000Z',
    },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const evidence = response.body.evidenceSearch;
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/blueprints`, headers,
    body: {
      authorId, reviewerId, researchQuestion: 'PRIVATE CITATION RESEARCH QUESTION', styleGuideId: 'apa-7',
      sections: [{ id: 'discussion', title: 'Discussion', dependsOn: [] }],
      claims: [
        { id: 'claim-a', sectionId: 'discussion', kind: 'empirical', statement: 'PRIVATE CLAIM A', sourceEvidenceIds: [evidence.id] },
        { id: 'claim-b', sectionId: 'discussion', kind: 'limitation', statement: 'PRIVATE CLAIM B', sourceEvidenceIds: [evidence.sourceSnapshotIds[1]] },
      ],
      actorId: authorId, idempotencyKey: 'citation-blueprint', now: '2026-07-10T10:05:00.000Z',
    },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const blueprint = response.body.academicWritingBlueprint;
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${project.id}/agents/${authorId}/submissions`, headers,
    body: { includeReadModels: false, artifactType: 'academic-manuscript', title: 'Citation manuscript draft', summary: 'Initial draft.', body: 'PRIVATE MANUSCRIPT DRAFT', reviewerAgentId: reviewerId, sourceRefs: evidence.sources, now: '2026-07-10T10:10:00.000Z' },
  });
  const firstSubmission = response.body.submission;
  const coverage = { coveredSectionIds: ['discussion'], coveredClaimIds: ['claim-a', 'claim-b'] };
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/drafts`, headers,
    body: { submissionId: firstSubmission.id, ...coverage, wordCount: 1200, idempotencyKey: 'citation-draft', now: '2026-07-10T10:11:00.000Z' },
  });
  const firstDraft = response.body.academicDraft;
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${project.id}/submissions/${firstSubmission.id}/reviews`, headers,
    body: { includeReadModels: false, reviewerAgentId: reviewerId, verdict: 'changes-requested', requestedChanges: ['Resolve citation semantics.'], now: '2026-07-10T10:20:00.000Z' },
  });
  const changesReview = response.body.review;
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${project.id}/agents/${authorId}/submissions`, headers,
    body: { includeReadModels: false, artifactType: 'academic-manuscript', title: 'Citation manuscript revision', summary: 'Revision.', body: 'PRIVATE MANUSCRIPT REVISION', reviewerAgentId: reviewerId, respondsToReviewId: changesReview.id, revisesSubmissionId: firstSubmission.id, sourceRefs: evidence.sources, now: '2026-07-10T10:30:00.000Z' },
  });
  const revisionSubmission = response.body.submission;
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/drafts/${firstDraft.id}/revisions`, headers,
    body: { submissionId: revisionSubmission.id, reviewId: changesReview.id, addressedIssueIds: academicReviewIssueIds(changesReview), ...coverage, wordCount: 1300, idempotencyKey: 'citation-revision', now: '2026-07-10T10:31:00.000Z' },
  });
  const revision = response.body.academicRevision;
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${project.id}/submissions/${revisionSubmission.id}/reviews`, headers,
    body: { includeReadModels: false, reviewerAgentId: reviewerId, verdict: 'accepted', comments: 'Structure accepted; citation semantics require the dedicated gate.', now: '2026-07-10T10:40:00.000Z' },
  });
  response = await api.handleAsync({
    method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/finalize`, headers,
    body: { draftId: revision.id, reviewId: response.body.review.id, idempotencyKey: 'citation-finalization', now: '2026-07-10T10:41:00.000Z' },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return { project, blueprint, evidence, authorId, reviewerId, finalization: response.body.academicFinalization };
}

test('blocks semantic/status defects, accepts a checksum-linked replacement, and survives restart without raw text', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-citation-integrity-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    const context = await createFinalizedAcademicProject(api);
    const assessmentBodies = [
      {
        claimId: 'claim-a', sourceEvidenceId: context.evidence.id, sourceSnapshotId: context.evidence.sourceSnapshotIds[0],
        assessorId: context.reviewerId, stance: 'supports', sourceStatus: 'active', publishedAt: '2026-01-01T00:00:00.000Z',
        statusCheckedAt: '2026-07-09T00:00:00.000Z', evidenceExcerpt: 'PRIVATE SUPPORT EXCERPT A', locator: 'p. 2', rationale: 'PRIVATE RATIONALE A',
        idempotencyKey: 'assessment-a', now: '2026-07-10T11:00:00.000Z',
      },
      {
        claimId: 'claim-b', sourceEvidenceId: context.evidence.sourceSnapshotIds[1], sourceSnapshotId: context.evidence.sourceSnapshotIds[1],
        assessorId: context.reviewerId, stance: 'contradicts', sourceStatus: 'retracted', publishedAt: '2020-01-01T00:00:00.000Z',
        statusCheckedAt: '2026-05-01T00:00:00.000Z', evidenceExcerpt: 'PRIVATE CONTRADICTION B', locator: 'p. 9', rationale: 'PRIVATE RATIONALE B',
        idempotencyKey: 'assessment-b-v1', now: '2026-07-10T11:01:00.000Z',
      },
    ];
    const assessments = [];
    for (const body of assessmentBodies) {
      const response = await api.handleAsync({ method: 'POST', path: `/projects/${context.project.id}/citation-integrity/assessments`, headers, body });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assessments.push(response.body.citationAssessment);
      assert.equal(JSON.stringify(response.body.citationAssessment).includes(body.evidenceExcerpt), false);
      assert.equal(JSON.stringify(response.body.citationAssessment).includes(body.rationale), false);
    }
    let response = await api.handleAsync({
      method: 'POST', path: `/projects/${context.project.id}/citation-integrity/audits`, headers,
      body: { policy: { maxPublicationAgeDays: 730, maxStatusCheckAgeDays: 30 }, idempotencyKey: 'blocked-audit', now: '2026-07-10T11:10:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.citationIntegrityAudit.status, 'blocked');
    assert.ok(response.body.citationIntegrityAudit.findings.some((row) => row.code === 'citation-contradicts-claim'));
    assert.ok(response.body.citationIntegrityAudit.findings.some((row) => row.code === 'source-retracted'));
    assert.equal(response.body.academicWritingPipeline.status, 'citation-integrity-blocked');

    const previous = assessments[1];
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${context.project.id}/citation-integrity/assessments`, headers,
      body: {
        ...assessmentBodies[1], stance: 'supports', sourceStatus: 'active', publishedAt: '2026-02-01T00:00:00.000Z',
        statusCheckedAt: '2026-07-09T00:00:00.000Z', evidenceExcerpt: 'PRIVATE REPLACEMENT SUPPORT B', rationale: 'PRIVATE REPLACEMENT RATIONALE B',
        expectedAssessmentVersion: previous.version, expectedAssessmentChecksum: previous.checksum,
        idempotencyKey: 'assessment-b-v2', now: '2026-07-10T11:20:00.000Z',
      },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.citationAssessment.version, 2);
    assert.equal(response.body.citationAssessment.previousAssessmentId, previous.id);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${context.project.id}/citation-integrity/assessments`, headers,
      body: assessmentBodies[1],
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.idempotent, true);
    assert.equal(response.body.citationAssessment.id, previous.id);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${context.project.id}/citation-integrity/audits`, headers,
      body: { policy: { maxPublicationAgeDays: 730, maxStatusCheckAgeDays: 30 }, idempotencyKey: 'passing-audit', now: '2026-07-10T11:21:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.citationIntegrityAudit.status, 'passed');
    assert.equal(response.body.citationIntegrity.readyForLocalCitationIntegrity, true);
    assert.equal(response.body.academicWritingPipeline.status, 'citation-integrity-passed');
    assert.equal(response.body.academicWritingPipeline.readyForProduction, false);

    const snapshotText = JSON.stringify(store.snapshot());
    for (const text of ['PRIVATE SUPPORT EXCERPT A', 'PRIVATE RATIONALE A', 'PRIVATE CONTRADICTION B', 'PRIVATE REPLACEMENT SUPPORT B', 'PRIVATE REPLACEMENT RATIONALE B']) {
      assert.equal(snapshotText.includes(text), false, `File snapshot leaked: ${text}`);
    }
    api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${context.project.id}/citation-integrity`, headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.citationIntegrity.status, 'passed');
    assert.equal(response.body.citationIntegrity.integrity.valid, true);

    const tamperedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const tampered = tamperedStore.getProject(context.project.id);
    tampered.localCitationAssessments[0].stance = 'contradicts';
    tamperedStore.saveProject(tampered);
    api = createAgentProjectApi({ service: createAgentProjectService({ store: tamperedStore }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${context.project.id}/citation-integrity`, headers });
    assert.equal(response.body.citationIntegrity.status, 'degraded-integrity-invalid');
    assert.equal(response.body.citationIntegrity.readyForLocalCitationIntegrity, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps citation integrity private and academic-writing-only', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/citation-integrity' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/citation-integrity/assessments' }).allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'learning', workModeContract: { workMode: 'learning' } }] });
  assert.throws(() => service.recordLocalCitationAssessment({ projectId: 'learning' }), /citation-integrity-academic-writing-work-mode-required/);
});
