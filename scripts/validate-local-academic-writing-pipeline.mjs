import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { academicReviewIssueIds } from '../src/agents/localAcademicWritingPipeline.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-academic-writing-${process.pid}`);
const filePath = resolve(tempRoot, 'projects.json');
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
  let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
  const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-author' };
  const call = (method, path, body = {}) => api.handleAsync({ method, path, headers, body });
  let response = await call('POST', '/projects/initiate', {
    projectId: 'academic_writing_gate_project', name: 'Academic Writing Gate', brief: 'Produce an evidence-grounded local manuscript.',
    workMode: 'academic-writing', includeReadModels: false,
  });
  assert(response.status === 200, `Academic project initiation returned ${response.status}.`);
  const project = response.body.project;
  const roleId = (id) => project.workModeContract.roles.find((row) => row.id === id)?.personaSlug;
  const authorId = roleId('argument-editor');
  const reviewerId = roleId('citation-reviewer');
  const researcherId = roleId('literature-researcher');
  assert(authorId && reviewerId && researcherId && authorId !== reviewerId, 'Academic team must assign independent author, reviewer, and researcher roles.');

  response = await call('POST', `/projects/${project.id}/agents/${researcherId}/evidence-searches`, {
    query: 'Local evidence for grounded academic writing', purpose: 'Bind planned claims to locally recorded sources.', includeReadModels: false,
    sources: [
      { id: 'academic-gate-source-1', title: 'Academic gate source one', url: 'https://example.test/academic-gate-1', publisher: 'Local fixture' },
      { id: 'academic-gate-source-2', title: 'Academic gate source two', url: 'https://example.test/academic-gate-2', publisher: 'Local fixture' },
    ],
    findings: ['The bounded fixtures support the planned claim graph.'], confidence: 'high', now: '2026-07-10T12:00:00.000Z',
  });
  assert(response.status === 200 && response.body.evidenceSearch?.sourceSnapshotIds?.length === 2, 'Academic evidence must use the real local evidence seam.');
  const evidence = response.body.evidenceSearch;
  const rawQuestion = 'How does retrieval quality affect evidence-grounded local academic writing?';
  response = await call('POST', `/projects/${project.id}/academic-writing-pipeline/blueprints`, {
    authorId, reviewerId, researchQuestion: rawQuestion, styleGuideId: 'apa-7',
    sections: [
      { id: 'introduction', title: 'Introduction', dependsOn: [] },
      { id: 'method', title: 'Method', dependsOn: ['introduction'] },
      { id: 'discussion', title: 'Discussion', dependsOn: ['method'] },
    ],
    claims: [
      { id: 'retrieval-claim', sectionId: 'introduction', kind: 'empirical', statement: 'Retrieval quality affects grounded writing.', sourceEvidenceIds: [evidence.id] },
      { id: 'method-claim', sectionId: 'method', kind: 'methodological', statement: 'Source review precedes synthesis.', sourceEvidenceIds: [evidence.sourceSnapshotIds[0]] },
      { id: 'limit-claim', sectionId: 'discussion', kind: 'limitation', statement: 'Local proof is not public production proof.', sourceEvidenceIds: [evidence.id] },
    ],
    actorId: authorId, idempotencyKey: 'gate-blueprint-1', now: '2026-07-10T12:05:00.000Z',
  });
  assert(response.status === 201, `Academic blueprint creation returned ${response.status}.`);
  const blueprint = response.body.academicWritingBlueprint;
  assert(!JSON.stringify(blueprint).includes(rawQuestion) && blueprint.citationIntegrityPending, 'Blueprint receipts must hash private text and preserve the citation-integrity boundary.');

  const manuscriptBody = '# Private manuscript draft\n\nEvidence-grounded content.';
  response = await call('POST', `/projects/${project.id}/agents/${authorId}/submissions`, {
    includeReadModels: false, artifactType: 'academic-manuscript', title: 'Academic manuscript draft', summary: 'First structured draft.',
    body: manuscriptBody, reviewerAgentId: reviewerId, sourceRefs: evidence.sources, dependsOn: [evidence.id], now: '2026-07-10T13:00:00.000Z',
  });
  assert(response.status === 200 && response.body.submission.artifactStorageProofChecksum, 'Draft must use immutable local artifact storage proof.');
  const firstSubmission = response.body.submission;
  const coverage = { coveredSectionIds: blueprint.sections.map((row) => row.id), coveredClaimIds: blueprint.claims.map((row) => row.id) };
  response = await call('POST', `/projects/${project.id}/academic-writing-pipeline/drafts`, {
    submissionId: firstSubmission.id, ...coverage, wordCount: 1800, idempotencyKey: 'gate-draft-1', now: '2026-07-10T13:01:00.000Z',
  });
  assert(response.status === 201 && !JSON.stringify(response.body.academicDraft).includes(manuscriptBody), 'Draft receipt must omit manuscript content.');
  const firstDraft = response.body.academicDraft;

  response = await call('POST', `/projects/${project.id}/submissions/${firstSubmission.id}/reviews`, {
    includeReadModels: false, reviewerAgentId: reviewerId, verdict: 'changes-requested', comments: 'Clarify method and limitations.',
    requestedChanges: ['Clarify the method boundary.', 'Separate observations from limitations.'], now: '2026-07-10T13:10:00.000Z',
  });
  assert(response.status === 200 && response.body.review.reviewerAgentId !== authorId, 'First draft must receive independent review.');
  const changesReview = response.body.review;
  const requiredIssueIds = academicReviewIssueIds(changesReview);
  response = await call('POST', `/projects/${project.id}/agents/${authorId}/submissions`, {
    includeReadModels: false, artifactType: 'academic-manuscript', title: 'Academic manuscript revision', summary: 'Review-complete revision.',
    body: '# Private revised manuscript\n\nRevised grounded content.', reviewerAgentId: reviewerId, sourceRefs: evidence.sources,
    respondsToReviewId: changesReview.id, revisesSubmissionId: firstSubmission.id,
    dependsOn: [evidence.id, firstSubmission.id, changesReview.id], now: '2026-07-10T14:00:00.000Z',
  });
  assert(response.status === 200, `Revised manuscript submission returned ${response.status}.`);
  const revisedSubmission = response.body.submission;
  response = await call('POST', `/projects/${project.id}/academic-writing-pipeline/drafts/${firstDraft.id}/revisions`, {
    submissionId: revisedSubmission.id, reviewId: changesReview.id, addressedIssueIds: requiredIssueIds, ...coverage,
    wordCount: 2050, idempotencyKey: 'gate-revision-1', now: '2026-07-10T14:01:00.000Z',
  });
  assert(response.status === 201 && response.body.academicRevision.requiredIssueIds.length === 2, 'Revision must close every stable review issue id.');
  const revision = response.body.academicRevision;

  response = await call('POST', `/projects/${project.id}/academic-writing-pipeline/finalize`, {
    draftId: revision.id, reviewId: changesReview.id, idempotencyKey: 'gate-premature-finalization', now: '2026-07-10T14:05:00.000Z',
  });
  assert(response.status === 400 && /accepted-review-required/.test(response.body.message || ''), 'Changes-requested review must not finalize a manuscript.');
  response = await call('POST', `/projects/${project.id}/submissions/${revisedSubmission.id}/reviews`, {
    includeReadModels: false, reviewerAgentId: reviewerId, verdict: 'accepted', comments: 'Accepted after complete revision.', now: '2026-07-10T14:10:00.000Z',
  });
  assert(response.status === 200, `Accepted review returned ${response.status}.`);
  response = await call('POST', `/projects/${project.id}/academic-writing-pipeline/finalize`, {
    draftId: revision.id, reviewId: response.body.review.id, idempotencyKey: 'gate-finalization-1', now: '2026-07-10T14:11:00.000Z',
  });
  assert(response.status === 201 && response.body.academicWritingPipeline.status === 'finalized-awaiting-citation-integrity', 'Accepted complete revision must freeze locally while keeping capability 44 explicit.');

  assert(!JSON.stringify(store.snapshot()).includes(rawQuestion), 'File snapshot must not persist the raw research question in pipeline receipts.');
  api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
  response = await call('GET', `/projects/${project.id}/academic-writing-pipeline`);
  assert(response.status === 200 && response.body.academicWritingPipeline.integrity.valid, 'Academic writing lineage must remain valid after file-store restart.');
  assert(response.body.academicWritingPipeline.readyForCitationIntegrityAudit && !response.body.academicWritingPipeline.readyForProduction, 'Finalized manuscript must hand off to citation integrity without claiming production readiness.');
  console.log('Local academic writing pipeline validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
