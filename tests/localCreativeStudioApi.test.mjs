import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { creativeCritiqueIssueIds } from '../src/agents/localCreativeStudio.js';

const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'creative-studio-manager' };
const dimensions = (audienceScore, blocking, findingText) => [
  { id: 'brief-alignment', scoreBps: 8200, findingText: 'The work follows the approved direction.', blocking: false },
  { id: 'craft', scoreBps: 7900, findingText: 'The craft is internally coherent.', blocking: false },
  { id: 'audience-fit', scoreBps: audienceScore, findingText, blocking },
  { id: 'accessibility', scoreBps: 7800, findingText: 'Contrast and reading order meet the brief.', blocking: false },
];

test('persists a real brief-to-iteration-to-critique-to-export-to-handoff creative workflow', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-creative-studio-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    const call = (method, path, body = {}) => api.handleAsync({ method, path, headers, body });
    let response = await call('POST', '/projects/initiate', {
      projectId: 'creative_studio_api_project', name: 'Creative Studio', brief: 'Create a local launch system.',
      workMode: 'creative-studio', includeReadModels: false,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.readModels.creativeStudioWorkflowRoute, '/projects/creative_studio_api_project/creative-studio-workflow');
    const project = response.body.project;
    const role = (id) => project.workModeContract.roles.find((row) => row.id === id)?.personaSlug;
    const creativeLeadId = role('creative-lead');
    const artDirectorId = role('art-director');
    const audienceResearcherId = role('audience-researcher');
    const rightsReviewerId = role('rights-reviewer');

    response = await call('POST', `/projects/${project.id}/agents/${audienceResearcherId}/evidence-searches`, {
      query: 'Local operator and student audience needs', purpose: 'Ground the creative brief in audience evidence.', includeReadModels: false,
      sources: [
        { id: 'operator-interview', title: 'Operator interview', url: 'https://example.test/operator' },
        { id: 'student-interview', title: 'Student interview', url: 'https://example.test/student' },
      ],
      findings: ['Operators need proof hierarchy; students need a clear starting path.'], confidence: 'high', now: '2026-07-11T17:00:00.000Z',
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const evidence = response.body.evidenceSearch;
    const briefBody = {
      creativeDirection: 'A calm editorial system that makes local agent work tangible.',
      audienceSegments: [
        { id: 'operators', description: 'Operators who need proof hierarchy.', evidenceIds: [evidence.id] },
        { id: 'students', description: 'Students who need a clear entry path.', evidenceIds: [evidence.sourceSnapshotIds[0]] },
      ],
      deliverables: [
        { id: 'hero-image', mediaType: 'image', format: 'png', width: 1600, height: 900, colorSpace: 'srgb', maxBytes: 2_000_000, accessibilityRequired: true },
        { id: 'launch-pdf', mediaType: 'document', format: 'pdf', colorSpace: 'srgb', maxBytes: 5_000_000, accessibilityRequired: true },
      ],
      constraints: [{ id: 'local-only', text: 'All assets and fonts remain local.' }],
      successCriteria: [{ id: 'legibility', text: 'A new operator understands the hierarchy in under one minute.' }],
      actorId: 'caller-cannot-select-lead', idempotencyKey: 'api-creative-brief', now: '2026-07-11T17:01:00.000Z',
    };
    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/briefs`, briefBody);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const brief = response.body.creativeBrief;
    assert.equal(brief.creativeLeadId, creativeLeadId);
    assert.equal(brief.artDirectorId, artDirectorId);
    assert.equal(brief.audienceResearcherId, audienceResearcherId);
    assert.equal(brief.rightsReviewerId, rightsReviewerId);
    assert.equal(JSON.stringify(brief).includes(briefBody.creativeDirection), false);
    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/briefs`, { ...briefBody, now: '2026-07-11T17:01:30.000Z' });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);

    const submitCreativeWork = (body, now) => call('POST', `/projects/${project.id}/agents/${artDirectorId}/submissions`, {
      includeReadModels: false, artifactType: 'creative-work', reviewerAgentId: creativeLeadId, sourceRefs: evidence.sources, now, ...body,
    });
    response = await submitCreativeWork({ title: 'Creative system draft', summary: 'Initial complete visual direction.', body: 'PRIVATE CREATIVE DRAFT' }, '2026-07-11T17:10:00.000Z');
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const firstSubmission = response.body.submission;
    assert.ok(firstSubmission.artifactStorageProofChecksum);
    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/iterations`, {
      submissionId: firstSubmission.id, deliverableIds: ['hero-image', 'launch-pdf'], changeSummary: 'Initial full direction.',
      idempotencyKey: 'api-creative-iteration-1', now: '2026-07-11T17:11:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const firstIteration = response.body.creativeIteration;

    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/critiques`, {
      iterationId: firstIteration.id, perspective: 'creative-lead', reviewerId: 'caller-cannot-select-reviewer',
      dimensions: dimensions(6400, true, 'Hierarchy needs a stronger operator entry point.'), verdict: 'changes-requested',
      idempotencyKey: 'api-lead-critique-1', now: '2026-07-11T17:20:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const leadChanges = response.body.creativeCritique;
    assert.equal(leadChanges.reviewerId, creativeLeadId);
    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/critiques`, {
      iterationId: firstIteration.id, perspective: 'audience-researcher', reviewerId: 'caller-cannot-select-reviewer',
      dimensions: dimensions(6600, true, 'Student entry sequencing needs clarification.'), verdict: 'changes-requested',
      idempotencyKey: 'api-audience-critique-1', now: '2026-07-11T17:21:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const audienceChanges = response.body.creativeCritique;
    const issueIds = [...creativeCritiqueIssueIds(leadChanges), ...creativeCritiqueIssueIds(audienceChanges)].sort();

    response = await submitCreativeWork({
      title: 'Creative system revision', summary: 'Revision closes both critique issues.', body: 'PRIVATE CREATIVE REVISION',
      revisesSubmissionId: firstSubmission.id,
    }, '2026-07-11T17:30:00.000Z');
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const revisedSubmission = response.body.submission;
    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/iterations`, {
      previousIterationId: firstIteration.id, submissionId: revisedSubmission.id, deliverableIds: ['hero-image', 'launch-pdf'],
      addressedIssueIds: issueIds, changeSummary: 'Closes hierarchy and sequencing issues.',
      idempotencyKey: 'api-creative-iteration-2', now: '2026-07-11T17:31:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const revision = response.body.creativeIteration;

    const approvedDimensions = dimensions(8300, false, 'Audience entry and hierarchy are clear.');
    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/critiques`, {
      iterationId: revision.id, perspective: 'creative-lead', dimensions: approvedDimensions, verdict: 'approved',
      idempotencyKey: 'api-lead-approved', now: '2026-07-11T17:40:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const leadApproved = response.body.creativeCritique;
    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/critiques`, {
      iterationId: revision.id, perspective: 'audience-researcher', dimensions: approvedDimensions, verdict: 'approved',
      idempotencyKey: 'api-audience-approved', now: '2026-07-11T17:41:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));

    const checks = [
      { deliverableId: 'hero-image', format: 'png', width: 1600, height: 900, durationMs: null, colorSpace: 'srgb', fileBytes: 1_500_000, outputChecksum: 'a'.repeat(64), evidenceIds: [revision.artifactStorageProofChecksum], accessibilityEvidenceIds: ['hero-alt-proof'] },
      { deliverableId: 'launch-pdf', format: 'pdf', width: null, height: null, durationMs: null, colorSpace: 'srgb', fileBytes: 3_000_000, outputChecksum: 'b'.repeat(64), evidenceIds: [revision.artifactStorageProofChecksum], accessibilityEvidenceIds: ['pdf-reading-order-proof'] },
    ];
    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/exports`, {
      iterationId: revision.id, checks, actorId: 'caller-cannot-select-actor', idempotencyKey: 'api-creative-export', now: '2026-07-11T17:50:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const creativeExport = response.body.creativeExport;
    assert.equal(creativeExport.actorId, artDirectorId);

    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/handoffs`, {
      exportId: creativeExport.id, senderId: 'caller-cannot-select-sender', recipientId: 'caller-cannot-select-recipient',
      editableSourceEvidenceIds: ['editable-source-proof'], toolchain: [{ toolId: 'local-design-tool', toolVersion: '5.0.0' }],
      dependencyIds: ['local-font-family'], instructionsText: 'Open editable sources and use checked export presets.',
      knownLimitationsText: 'The PDF uses a local fallback if the primary font is unavailable.',
      idempotencyKey: 'api-creative-handoff', now: '2026-07-11T17:51:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const handoff = response.body.creativeHandoff;
    assert.equal(handoff.senderId, artDirectorId);
    assert.equal(handoff.recipientId, creativeLeadId);
    assert.equal(JSON.stringify(handoff).includes('Open editable sources'), false);
    response = await call('POST', `/projects/${project.id}/creative-studio-workflow/handoffs/${handoff.id}/acknowledgements`, {
      actorId: 'caller-cannot-select-actor', evidenceIds: ['handoff-opened-proof'], idempotencyKey: 'api-handoff-ack', now: '2026-07-11T17:52:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.creativeHandoffAcknowledgement.actorId, creativeLeadId);
    assert.equal(response.body.creativeStudioWorkflow.status, 'ready-for-rights-provenance-audit');

    api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/creative-studio-workflow`, headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.creativeStudioWorkflow.integrity.valid, true);
    assert.equal(response.body.creativeStudioWorkflow.readyForRightsProvenanceAudit, true);
    assert.equal(response.body.creativeStudioWorkflow.readyForExternalRelease, false);

    const tamperedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const tampered = tamperedStore.getProject(project.id);
    tampered.localCreativeExports[0].checks[0].fileBytes = 99_000_000;
    tamperedStore.saveProject(tampered);
    api = createAgentProjectApi({ service: createAgentProjectService({ store: tamperedStore }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/creative-studio-workflow`, headers });
    assert.equal(response.body.creativeStudioWorkflow.integrity.valid, false);
    assert.equal(response.body.creativeStudioWorkflow.readyForRightsProvenanceAudit, false);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/creative-studio-workflow/briefs`, headers,
      body: { ...briefBody, expectedBriefVersion: brief.version, expectedBriefChecksum: brief.checksum, idempotencyKey: 'blocked-after-creative-tamper', now: '2026-07-11T18:00:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /creative-studio-current-state-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps the creative studio private and creative-mode-only', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/creative-studio-workflow' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/creative-studio-workflow/briefs' }).allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'learning', workModeContract: { workMode: 'learning' } }] });
  assert.throws(() => service.createLocalCreativeBrief({ projectId: 'learning' }), /creative-studio-work-mode-required/);
});
