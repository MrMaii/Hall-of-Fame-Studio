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

const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'author-user' };

test('persists a real evidence-to-reviewed-final-manuscript lineage across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-academic-pipeline-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    let response = await api.handleAsync({
      method: 'POST', path: '/projects/initiate', headers,
      body: { projectId: 'academic_pipeline_api_project', name: 'Academic Pipeline', brief: 'Write an evidence-grounded paper.', workMode: 'academic-writing', includeReadModels: false },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.readModels.academicWritingPipelineRoute, '/projects/academic_pipeline_api_project/academic-writing-pipeline');
    const project = response.body.project;
    const authorId = project.workModeContract.roles.find((row) => row.id === 'argument-editor').personaSlug;
    const reviewerId = project.workModeContract.roles.find((row) => row.id === 'citation-reviewer').personaSlug;
    const researcherId = project.workModeContract.roles.find((row) => row.id === 'literature-researcher').personaSlug;

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/agents/${researcherId}/evidence-searches`, headers,
      body: {
        query: 'Evidence-grounded agent writing', purpose: 'Support the manuscript claims.', includeReadModels: false,
        sources: [
          { id: 'academic-source-1', title: 'Academic source one', url: 'https://example.test/academic-1', publisher: 'Local fixture' },
          { id: 'academic-source-2', title: 'Academic source two', url: 'https://example.test/academic-2', publisher: 'Local fixture' },
        ],
        findings: ['Local fixture findings support the planned claim graph.'], confidence: 'high', now: '2026-07-10T12:00:00.000Z',
      },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const evidenceSearch = response.body.evidenceSearch;
    const sourceSnapshotId = evidenceSearch.sourceSnapshotIds[0];

    const blueprintBody = {
      authorId, reviewerId,
      researchQuestion: 'How does retrieval quality affect evidence-grounded agent writing?',
      styleGuideId: 'apa-7',
      sections: [
        { id: 'introduction', title: 'Introduction', dependsOn: [] },
        { id: 'method', title: 'Method', dependsOn: ['introduction'] },
        { id: 'discussion', title: 'Discussion', dependsOn: ['method'] },
      ],
      claims: [
        { id: 'claim-retrieval', sectionId: 'introduction', kind: 'empirical', statement: 'Retrieval quality affects grounded writing.', sourceEvidenceIds: [evidenceSearch.id] },
        { id: 'claim-method', sectionId: 'method', kind: 'methodological', statement: 'Source review must precede synthesis.', sourceEvidenceIds: [sourceSnapshotId] },
        { id: 'claim-limit', sectionId: 'discussion', kind: 'limitation', statement: 'Local evaluation does not prove public production quality.', sourceEvidenceIds: [evidenceSearch.id] },
      ],
      actorId: authorId, idempotencyKey: 'api-blueprint-1', now: '2026-07-10T12:05:00.000Z',
    };
    response = await api.handleAsync({ method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/blueprints`, headers, body: blueprintBody });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const blueprint = response.body.academicWritingBlueprint;
    assert.equal(JSON.stringify(blueprint).includes(blueprintBody.researchQuestion), false);
    response = await api.handleAsync({ method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/blueprints`, headers, body: { ...blueprintBody, now: '2026-07-10T12:05:30.000Z' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/agents/${authorId}/submissions`, headers,
      body: { includeReadModels: false, artifactType: 'academic-manuscript', title: 'Academic manuscript draft', summary: 'First structured manuscript draft.', body: '# Private manuscript draft\n\nEvidence-grounded draft body.', reviewerAgentId: reviewerId, sourceRefs: evidenceSearch.sources, dependsOn: [evidenceSearch.id], now: '2026-07-10T13:00:00.000Z' },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const firstSubmission = response.body.submission;
    assert.equal(firstSubmission.artifactType, 'academic-manuscript');
    assert.ok(firstSubmission.artifactStorageProofChecksum);

    const coverage = { coveredSectionIds: blueprint.sections.map((row) => row.id), coveredClaimIds: blueprint.claims.map((row) => row.id) };
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/drafts`, headers,
      body: { submissionId: firstSubmission.id, ...coverage, wordCount: 1800, idempotencyKey: 'api-draft-1', now: '2026-07-10T13:01:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const firstDraft = response.body.academicDraft;

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/submissions/${firstSubmission.id}/reviews`, headers,
      body: { includeReadModels: false, reviewerAgentId: reviewerId, verdict: 'changes-requested', comments: 'Clarify method and limitations.', requestedChanges: ['Clarify the method boundary.', 'Separate observed results from limitations.'], now: '2026-07-10T13:10:00.000Z' },
    });
    assert.equal(response.status, 200);
    const changesReview = response.body.review;
    const issueIds = academicReviewIssueIds(changesReview);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/agents/${authorId}/submissions`, headers,
      body: { includeReadModels: false, artifactType: 'academic-manuscript', title: 'Academic manuscript revision', summary: 'Revision addressing independent review.', body: '# Private revised manuscript\n\nRevised evidence-grounded body.', reviewerAgentId: reviewerId, sourceRefs: evidenceSearch.sources, respondsToReviewId: changesReview.id, revisesSubmissionId: firstSubmission.id, dependsOn: [evidenceSearch.id, firstSubmission.id, changesReview.id], now: '2026-07-10T14:00:00.000Z' },
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const revisedSubmission = response.body.submission;

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/drafts/${firstDraft.id}/revisions`, headers,
      body: { submissionId: revisedSubmission.id, reviewId: changesReview.id, addressedIssueIds: issueIds, ...coverage, wordCount: 2050, idempotencyKey: 'api-revision-1', now: '2026-07-10T14:01:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const revision = response.body.academicRevision;

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/finalize`, headers,
      body: { draftId: revision.id, reviewId: changesReview.id, idempotencyKey: 'premature-finalization', now: '2026-07-10T14:05:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /accepted-review-required/);

    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/submissions/${revisedSubmission.id}/reviews`, headers,
      body: { includeReadModels: false, reviewerAgentId: reviewerId, verdict: 'accepted', comments: 'Accepted after complete revision.', requestedChanges: [], now: '2026-07-10T14:10:00.000Z' },
    });
    assert.equal(response.status, 200);
    const acceptedReview = response.body.review;
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/academic-writing-pipeline/finalize`, headers,
      body: { draftId: revision.id, reviewId: acceptedReview.id, idempotencyKey: 'api-finalization-1', now: '2026-07-10T14:11:00.000Z' },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.academicFinalization.readyForCitationIntegrityAudit, true);
    assert.equal(response.body.academicWritingPipeline.status, 'finalized-awaiting-citation-integrity');

    const restartedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    api = createAgentProjectApi({ service: createAgentProjectService({ store: restartedStore }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/academic-writing-pipeline`, headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.academicWritingPipeline.summary.draftVersionCount, 2);
    assert.equal(response.body.academicWritingPipeline.integrity.valid, true);

    const tampered = restartedStore.getProject(project.id);
    tampered.localAcademicRevisionReceipts[0].addressedIssueIds = [];
    restartedStore.saveProject(tampered);
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/academic-writing-pipeline`, headers });
    assert.equal(response.body.academicWritingPipeline.status, 'degraded-integrity-invalid');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps the pipeline private and academic-writing-only', () => {
  const read = classifyAccessRequest({ method: 'GET', path: '/projects/project-1/academic-writing-pipeline' });
  const write = classifyAccessRequest({ method: 'POST', path: '/projects/project-1/academic-writing-pipeline/blueprints' });
  assert.deepEqual(read.allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(write.allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'learning-project', workModeContract: { workMode: 'learning' } }] });
  assert.throws(() => service.createLocalAcademicWritingBlueprint({ projectId: 'learning-project' }), /academic-writing-work-mode-required/);
});
