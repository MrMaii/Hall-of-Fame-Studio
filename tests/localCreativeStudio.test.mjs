import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalCreativeStudioWorkflow,
  createLocalCreativeCritique,
  createLocalCreativeBrief,
  createLocalCreativeExport,
  createLocalCreativeHandoff,
  createLocalCreativeHandoffAcknowledgement,
  createLocalCreativeIteration,
  creativeCritiqueIssueIds,
  verifyLocalCreativeBrief,
  verifyLocalCreativeIteration,
} from '../src/agents/localCreativeStudio.js';

const briefInput = (overrides = {}) => ({
  projectId: 'creative_studio_project',
  creativeLeadId: 'creative-lead',
  artDirectorId: 'art-director',
  audienceResearcherId: 'audience-researcher',
  rightsReviewerId: 'rights-reviewer',
  creativeDirection: 'A calm editorial system that makes complex local-agent work feel tangible.',
  audienceSegments: [
    { id: 'operators', description: 'Local-first operators who need trustworthy proof.', evidenceIds: ['audience-interview-1'] },
    { id: 'students', description: 'Students who need a legible learning path.', evidenceIds: ['audience-interview-2'] },
  ],
  deliverables: [
    { id: 'hero-image', mediaType: 'image', format: 'png', width: 1600, height: 900, colorSpace: 'srgb', maxBytes: 2_000_000, accessibilityRequired: true },
    { id: 'launch-pdf', mediaType: 'document', format: 'pdf', colorSpace: 'srgb', maxBytes: 5_000_000, accessibilityRequired: true },
  ],
  constraints: [{ id: 'local-only', text: 'All assets and fonts must remain local.' }],
  successCriteria: [{ id: 'brief-legibility', text: 'A new operator understands the system hierarchy in under one minute.' }],
  knownEvidenceIds: ['audience-interview-1', 'audience-interview-2'],
  actorId: 'creative-lead',
  idempotencyKey: 'creative-brief-1',
  now: '2026-07-11T16:00:00.000Z',
  ...overrides,
});

const submission = (overrides = {}) => ({
  id: 'creative-submission-1',
  agentId: 'art-director',
  artifactType: 'creative-work',
  artifactChecksum: 'artifact-checksum-1',
  artifactStorageProofChecksum: 'storage-proof-checksum-1',
  createdAt: '2026-07-11T16:10:00.000Z',
  ...overrides,
});

test('creates a content-minimized evidence-backed versioned creative brief', () => {
  const brief = createLocalCreativeBrief(briefInput({ knownEvidenceIds: ['audience-interview-1', 'audience-interview-2', 'unrelated-project-evidence'] }));
  assert.equal(brief.schemaVersion, 'local-creative-brief/v1');
  assert.equal(brief.version, 1);
  assert.equal(brief.audienceSegments.length, 2);
  assert.equal(brief.deliverables.length, 2);
  assert.equal(brief.storesRawNarrative, false);
  assert.equal(JSON.stringify(brief).includes(briefInput().creativeDirection), false);
  assert.equal(JSON.stringify(brief).includes(briefInput().constraints[0].text), false);
  assert.equal(brief.knownEvidenceIds.includes('unrelated-project-evidence'), false);
  assert.equal(verifyLocalCreativeBrief(brief).valid, true);
  assert.throws(() => createLocalCreativeBrief(briefInput({ audienceSegments: [{ id: 'unknown', description: 'Unknown audience.', evidenceIds: ['missing-evidence'] }] })), /audience-evidence-invalid/);
  assert.throws(() => createLocalCreativeBrief(briefInput({ deliverables: [{ id: 'bad-video', mediaType: 'video', format: 'mp4', width: 1920, height: 1080, maxBytes: 1000, accessibilityRequired: false }] })), /deliverable-duration-invalid/);
  assert.throws(() => createLocalCreativeBrief(briefInput({ artDirectorId: 'creative-lead' })), /role-separation-required/);
  const tampered = structuredClone(brief);
  tampered.deliverables[0].maxBytes = 99_000_000;
  assert.equal(verifyLocalCreativeBrief(tampered).valid, false);
});

test('binds an iteration to the exact brief and a real immutable art-director submission', () => {
  const brief = createLocalCreativeBrief(briefInput());
  const iteration = createLocalCreativeIteration({
    brief,
    submission: submission(),
    deliverableIds: ['hero-image'],
    changeSummary: 'First visual direction for the hero system.',
    idempotencyKey: 'creative-iteration-1',
    now: '2026-07-11T16:11:00.000Z',
  });
  assert.equal(iteration.schemaVersion, 'local-creative-iteration/v1');
  assert.equal(iteration.iterationVersion, 1);
  assert.equal(iteration.artifactStorageProofChecksum, submission().artifactStorageProofChecksum);
  assert.equal(iteration.storesRawContent, false);
  assert.equal(verifyLocalCreativeIteration(iteration, brief).valid, true);
  assert.throws(() => createLocalCreativeIteration({
    brief, submission: submission({ agentId: 'creative-lead' }), deliverableIds: ['hero-image'], changeSummary: 'Wrong owner.',
    idempotencyKey: 'wrong-owner', now: '2026-07-11T16:11:00.000Z',
  }), /art-director-submission-required/);
  assert.throws(() => createLocalCreativeIteration({
    brief, submission: submission({ artifactStorageProofChecksum: null }), deliverableIds: ['hero-image'], changeSummary: 'No storage proof.',
    idempotencyKey: 'no-storage', now: '2026-07-11T16:11:00.000Z',
  }), /immutable-storage-proof-required/);
  const workflow = buildLocalCreativeStudioWorkflow({
    project: { id: brief.projectId, workModeContract: { workMode: 'creative-studio' }, localCreativeBriefs: [brief], localCreativeIterations: [iteration] },
    now: '2026-07-11T16:12:00.000Z',
  });
  assert.equal(workflow.integrity.valid, true);
  assert.equal(workflow.status, 'critique-required');
  assert.equal(workflow.latestIteration.id, iteration.id);
});

function firstCreativeIteration() {
  const brief = createLocalCreativeBrief(briefInput());
  const iteration = createLocalCreativeIteration({
    brief, submission: submission(), deliverableIds: ['hero-image', 'launch-pdf'],
    changeSummary: 'First complete campaign system.', idempotencyKey: 'creative-iteration-base', now: '2026-07-11T16:11:00.000Z',
  });
  return { brief, iteration };
}

const critiqueDimensions = (overrides = {}) => [
  { id: 'brief-alignment', scoreBps: 8200, findingText: 'Direction follows the brief.', blocking: false },
  { id: 'craft', scoreBps: 7800, findingText: 'Craft is coherent.', blocking: false },
  { id: 'audience-fit', scoreBps: 6500, findingText: 'Operator hierarchy needs stronger emphasis.', blocking: true },
  { id: 'accessibility', scoreBps: 7600, findingText: 'Contrast and reading order are workable.', blocking: false },
].map((row) => ({ ...row, ...(overrides[row.id] || {}) }));

test('records exact dual-perspective critique dimensions with stable content-minimized issue ids', () => {
  const { brief, iteration } = firstCreativeIteration();
  const critique = createLocalCreativeCritique({
    brief, iteration, perspective: 'creative-lead', reviewerId: brief.creativeLeadId,
    dimensions: critiqueDimensions(), verdict: 'changes-requested', idempotencyKey: 'lead-critique-1', now: '2026-07-11T16:20:00.000Z',
  });
  assert.equal(critique.schemaVersion, 'local-creative-critique/v1');
  assert.deepEqual(critique.dimensions.map((row) => row.id), ['accessibility', 'audience-fit', 'brief-alignment', 'craft']);
  assert.equal(JSON.stringify(critique).includes('Operator hierarchy needs stronger emphasis.'), false);
  assert.equal(creativeCritiqueIssueIds(critique).length, 1);
  assert.match(creativeCritiqueIssueIds(critique)[0], /^creative_issue_[a-f0-9]{28}$/);
  assert.throws(() => createLocalCreativeCritique({
    brief, iteration, perspective: 'creative-lead', reviewerId: brief.creativeLeadId,
    dimensions: critiqueDimensions().slice(0, 3), verdict: 'changes-requested', idempotencyKey: 'missing-dimension', now: '2026-07-11T16:20:00.000Z',
  }), /critique-dimension-set-invalid/);
  assert.throws(() => createLocalCreativeCritique({
    brief, iteration, perspective: 'creative-lead', reviewerId: brief.audienceResearcherId,
    dimensions: critiqueDimensions(), verdict: 'changes-requested', idempotencyKey: 'wrong-reviewer', now: '2026-07-11T16:20:00.000Z',
  }), /critique-reviewer-invalid/);
  assert.throws(() => createLocalCreativeCritique({
    brief, iteration, perspective: 'audience-researcher', reviewerId: brief.audienceResearcherId,
    dimensions: critiqueDimensions(), verdict: 'approved', idempotencyKey: 'false-approval', now: '2026-07-11T16:20:00.000Z',
  }), /approved-critique-quality-invalid/);
});

test('requires both prior critiques and complete issue closure on a newer immutable revision', () => {
  const { brief, iteration } = firstCreativeIteration();
  const leadCritique = createLocalCreativeCritique({
    brief, iteration, perspective: 'creative-lead', reviewerId: brief.creativeLeadId,
    dimensions: critiqueDimensions(), verdict: 'changes-requested', idempotencyKey: 'lead-changes', now: '2026-07-11T16:20:00.000Z',
  });
  const audienceCritique = createLocalCreativeCritique({
    brief, iteration, perspective: 'audience-researcher', reviewerId: brief.audienceResearcherId,
    dimensions: critiqueDimensions({ 'audience-fit': { scoreBps: 6800, findingText: 'Student entry point needs clearer sequencing.', blocking: true } }),
    verdict: 'changes-requested', idempotencyKey: 'audience-changes', now: '2026-07-11T16:21:00.000Z',
  });
  const requiredIssueIds = [...creativeCritiqueIssueIds(leadCritique), ...creativeCritiqueIssueIds(audienceCritique)].sort();
  assert.equal(requiredIssueIds.length, 2);
  const revisionInput = {
    brief,
    previousIteration: iteration,
    priorCritiques: [leadCritique, audienceCritique],
    submission: submission({ id: 'creative-submission-2', artifactChecksum: 'artifact-checksum-2', artifactStorageProofChecksum: 'storage-proof-checksum-2', createdAt: '2026-07-11T16:30:00.000Z' }),
    deliverableIds: ['hero-image', 'launch-pdf'],
    changeSummary: 'Revision closes hierarchy and audience sequencing issues.',
    idempotencyKey: 'creative-iteration-2',
    now: '2026-07-11T16:31:00.000Z',
  };
  assert.throws(() => createLocalCreativeIteration({ ...revisionInput, addressedIssueIds: requiredIssueIds.slice(0, 1) }), /critique-issues-unresolved/);
  const revision = createLocalCreativeIteration({ ...revisionInput, addressedIssueIds: requiredIssueIds });
  assert.equal(revision.iterationVersion, 2);
  assert.equal(revision.previousIterationId, iteration.id);
  assert.deepEqual(revision.requiredIssueIds, requiredIssueIds);
  assert.equal(verifyLocalCreativeIteration(revision, brief, iteration, [leadCritique, audienceCritique]).valid, true);
  const workflow = buildLocalCreativeStudioWorkflow({
    project: {
      id: brief.projectId, workModeContract: { workMode: 'creative-studio' }, localCreativeBriefs: [brief],
      localCreativeIterations: [revision, iteration], localCreativeCritiques: [audienceCritique, leadCritique],
    },
    now: '2026-07-11T16:32:00.000Z',
  });
  assert.equal(workflow.integrity.valid, true);
  assert.equal(workflow.latestIteration.id, revision.id);
  assert.equal(workflow.status, 'critique-required');
  const duplicatePerspective = buildLocalCreativeStudioWorkflow({
    project: {
      id: brief.projectId, workModeContract: { workMode: 'creative-studio' }, localCreativeBriefs: [brief],
      localCreativeIterations: [iteration], localCreativeCritiques: [leadCritique, { ...leadCritique, id: 'duplicate-lead-critique' }],
    },
    now: '2026-07-11T16:32:00.000Z',
  });
  assert.equal(duplicatePerspective.integrity.valid, false);
});

function approvedCreativeWork() {
  const { brief, iteration } = firstCreativeIteration();
  const dimensions = critiqueDimensions({ 'audience-fit': { scoreBps: 8200, findingText: 'Audience hierarchy is clear.', blocking: false } });
  const leadCritique = createLocalCreativeCritique({
    brief, iteration, perspective: 'creative-lead', reviewerId: brief.creativeLeadId,
    dimensions, verdict: 'approved', idempotencyKey: 'approved-lead', now: '2026-07-11T16:20:00.000Z',
  });
  const audienceCritique = createLocalCreativeCritique({
    brief, iteration, perspective: 'audience-researcher', reviewerId: brief.audienceResearcherId,
    dimensions, verdict: 'approved', idempotencyKey: 'approved-audience', now: '2026-07-11T16:21:00.000Z',
  });
  return { brief, iteration, leadCritique, audienceCritique };
}

const exportChecks = (iteration, overrides = {}) => [
  {
    deliverableId: 'hero-image', format: 'png', width: 1600, height: 900, durationMs: null, colorSpace: 'srgb',
    fileBytes: 1_500_000, outputChecksum: 'a'.repeat(64), evidenceIds: [iteration.artifactStorageProofChecksum], accessibilityEvidenceIds: ['hero-alt-text-proof'],
  },
  {
    deliverableId: 'launch-pdf', format: 'pdf', width: null, height: null, durationMs: null, colorSpace: 'srgb',
    fileBytes: 3_000_000, outputChecksum: 'b'.repeat(64), evidenceIds: [iteration.artifactStorageProofChecksum], accessibilityEvidenceIds: ['pdf-reading-order-proof'],
  },
].map((row) => ({ ...row, ...(overrides[row.deliverableId] || {}) }));

test('requires dual approval and exact complete export-quality evidence', () => {
  const { brief, iteration, leadCritique, audienceCritique } = approvedCreativeWork();
  const creativeExport = createLocalCreativeExport({
    brief, iteration, critiques: [leadCritique, audienceCritique], checks: exportChecks(iteration),
    actorId: brief.artDirectorId, idempotencyKey: 'creative-export-1', now: '2026-07-11T16:30:00.000Z',
  });
  assert.equal(creativeExport.schemaVersion, 'local-creative-export/v1');
  assert.equal(creativeExport.readyForHandoff, true);
  assert.equal(creativeExport.readyForExternalRelease, false);
  assert.equal(creativeExport.checks.length, brief.deliverables.length);
  assert.throws(() => createLocalCreativeExport({
    brief, iteration, critiques: [leadCritique, audienceCritique], checks: exportChecks(iteration).slice(0, 1),
    actorId: brief.artDirectorId, idempotencyKey: 'incomplete-export', now: '2026-07-11T16:30:00.000Z',
  }), /export-deliverable-coverage-incomplete/);
  assert.throws(() => createLocalCreativeExport({
    brief, iteration, critiques: [leadCritique, audienceCritique], checks: exportChecks(iteration, { 'hero-image': { width: 1200 } }),
    actorId: brief.artDirectorId, idempotencyKey: 'wrong-size', now: '2026-07-11T16:30:00.000Z',
  }), /export-spec-mismatch/);
  assert.throws(() => createLocalCreativeExport({
    brief, iteration, critiques: [leadCritique, audienceCritique], checks: exportChecks(iteration, { 'hero-image': { accessibilityEvidenceIds: [] } }),
    actorId: brief.artDirectorId, idempotencyKey: 'missing-accessibility', now: '2026-07-11T16:30:00.000Z',
  }), /export-accessibility-evidence-required/);
});

test('binds an acknowledged collaboration handoff to the exact export manifest', () => {
  const { brief, iteration, leadCritique, audienceCritique } = approvedCreativeWork();
  const creativeExport = createLocalCreativeExport({
    brief, iteration, critiques: [leadCritique, audienceCritique], checks: exportChecks(iteration),
    actorId: brief.artDirectorId, idempotencyKey: 'handoff-export', now: '2026-07-11T16:30:00.000Z',
  });
  const handoff = createLocalCreativeHandoff({
    brief, iteration, creativeExport,
    senderId: brief.artDirectorId, recipientId: brief.creativeLeadId,
    editableSourceEvidenceIds: ['editable-source-package-proof'],
    toolchain: [{ toolId: 'local-design-tool', toolVersion: '5.0.0' }],
    dependencyIds: ['font-family-local-001'],
    instructionsText: 'Open the editable source, verify linked assets, then use the checked export presets.',
    knownLimitationsText: 'The PDF uses the local font fallback when the primary family is unavailable.',
    idempotencyKey: 'creative-handoff-1', now: '2026-07-11T16:31:00.000Z',
  });
  assert.equal(handoff.schemaVersion, 'local-creative-handoff/v1');
  assert.equal(handoff.instructionsText, undefined);
  assert.match(handoff.instructionsHash, /^[a-f0-9]{64}$/);
  assert.throws(() => createLocalCreativeHandoff({
    brief, iteration, creativeExport, senderId: brief.artDirectorId, recipientId: brief.audienceResearcherId,
    editableSourceEvidenceIds: ['source'], toolchain: [{ toolId: 'tool', toolVersion: '1' }], dependencyIds: ['font'],
    instructionsText: 'Wrong recipient.', knownLimitationsText: 'None known.', idempotencyKey: 'wrong-recipient', now: '2026-07-11T16:31:00.000Z',
  }), /handoff-role-invalid/);
  const acknowledgement = createLocalCreativeHandoffAcknowledgement({
    handoff, actorId: brief.creativeLeadId, evidenceIds: ['handoff-opened-and-verified'],
    idempotencyKey: 'creative-handoff-ack', now: '2026-07-11T16:32:00.000Z',
  });
  assert.equal(acknowledgement.status, 'accepted');
  const project = {
    id: brief.projectId, workModeContract: { workMode: 'creative-studio' }, localCreativeBriefs: [brief],
    localCreativeIterations: [iteration], localCreativeCritiques: [audienceCritique, leadCritique],
    localCreativeExports: [creativeExport], localCreativeHandoffs: [handoff], localCreativeHandoffAcknowledgements: [acknowledgement],
  };
  const ready = buildLocalCreativeStudioWorkflow({ project, now: '2026-07-11T16:33:00.000Z' });
  assert.equal(ready.integrity.valid, true);
  assert.equal(ready.status, 'ready-for-rights-provenance-audit');
  assert.equal(ready.readyForRightsProvenanceAudit, true);
  assert.equal(ready.readyForExternalRelease, false);
  const tampered = structuredClone(handoff);
  tampered.dependencyIds = [];
  const degraded = buildLocalCreativeStudioWorkflow({ project: { ...project, localCreativeHandoffs: [tampered] }, now: '2026-07-11T16:33:00.000Z' });
  assert.equal(degraded.integrity.valid, false);
  assert.equal(degraded.readyForRightsProvenanceAudit, false);
});
