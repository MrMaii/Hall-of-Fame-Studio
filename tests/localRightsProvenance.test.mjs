import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalCreativeStudioWorkflow,
  createLocalCreativeBrief,
  createLocalCreativeCritique,
  createLocalCreativeExport,
  createLocalCreativeHandoff,
  createLocalCreativeHandoffAcknowledgement,
  createLocalCreativeIteration,
} from '../src/agents/localCreativeStudio.js';
import {
  buildLocalRightsProvenance,
  createLocalRightsAssetDeclaration,
  createLocalRightsDerivativeLineage,
  createLocalRightsExportAudit,
  createLocalRightsGenerationProvenance,
  verifyLocalRightsAssetDeclaration,
} from '../src/agents/localRightsProvenance.js';

function creativeFixture() {
  const brief = createLocalCreativeBrief({
    projectId: 'rights_project', creativeLeadId: 'creative-lead', artDirectorId: 'art-director',
    audienceResearcherId: 'audience-researcher', rightsReviewerId: 'rights-reviewer',
    creativeDirection: 'A locally produced evidence-led launch system.',
    audienceSegments: [{ id: 'operators', description: 'Operators who need trustworthy local workflows.', evidenceIds: ['audience-proof'] }],
    deliverables: [{ id: 'hero', mediaType: 'image', format: 'png', width: 1600, height: 900, colorSpace: 'srgb', maxBytes: 2_000_000, accessibilityRequired: true }],
    constraints: [{ id: 'local', text: 'All production stays local.' }], successCriteria: [{ id: 'clear', text: 'The hierarchy is immediately clear.' }],
    knownEvidenceIds: ['audience-proof'], actorId: 'creative-lead', idempotencyKey: 'brief', now: '2026-07-11T17:00:00.000Z',
  });
  const iteration = createLocalCreativeIteration({
    brief, submission: { id: 'submission', agentId: 'art-director', artifactType: 'creative-work', artifactChecksum: 'artifact', artifactStorageProofChecksum: 'storage-proof', createdAt: '2026-07-11T17:01:00.000Z' },
    deliverableIds: ['hero'], changeSummary: 'Complete hero artwork.', idempotencyKey: 'iteration', now: '2026-07-11T17:02:00.000Z',
  });
  const dimensions = ['brief-alignment', 'craft', 'audience-fit', 'accessibility'].map((id) => ({ id, scoreBps: 8000, findingText: `${id} passes.`, blocking: false }));
  const lead = createLocalCreativeCritique({ brief, iteration, perspective: 'creative-lead', reviewerId: 'creative-lead', dimensions, verdict: 'approved', idempotencyKey: 'lead', now: '2026-07-11T17:03:00.000Z' });
  const audience = createLocalCreativeCritique({ brief, iteration, perspective: 'audience-researcher', reviewerId: 'audience-researcher', dimensions, verdict: 'approved', idempotencyKey: 'audience', now: '2026-07-11T17:04:00.000Z' });
  const creativeExport = createLocalCreativeExport({
    brief, iteration, critiques: [lead, audience], actorId: 'art-director', idempotencyKey: 'export', now: '2026-07-11T17:05:00.000Z',
    checks: [{ deliverableId: 'hero', format: 'png', width: 1600, height: 900, durationMs: null, colorSpace: 'srgb', fileBytes: 1_000_000, outputChecksum: 'a'.repeat(64), evidenceIds: ['storage-proof'], accessibilityEvidenceIds: ['alt-proof'] }],
  });
  const handoff = createLocalCreativeHandoff({
    brief, iteration, creativeExport, senderId: 'art-director', recipientId: 'creative-lead', editableSourceEvidenceIds: ['editable-source'],
    toolchain: [{ toolId: 'local-editor', toolVersion: '1.0.0' }], dependencyIds: ['local-font'], instructionsText: 'Open and verify all linked assets.',
    knownLimitationsText: 'No known limitations.', idempotencyKey: 'handoff', now: '2026-07-11T17:06:00.000Z',
  });
  const acknowledgement = createLocalCreativeHandoffAcknowledgement({ handoff, actorId: 'creative-lead', evidenceIds: ['ack-proof'], idempotencyKey: 'ack', now: '2026-07-11T17:07:00.000Z' });
  const project = { id: brief.projectId, workModeContract: { workMode: 'creative-studio' }, localCreativeBriefs: [brief], localCreativeIterations: [iteration], localCreativeCritiques: [lead, audience], localCreativeExports: [creativeExport], localCreativeHandoffs: [handoff], localCreativeHandoffAcknowledgements: [acknowledgement] };
  const creativeWorkflow = buildLocalCreativeStudioWorkflow({ project, now: '2026-07-11T17:08:00.000Z' });
  return { brief, creativeExport, handoff, acknowledgement, project, creativeWorkflow };
}

const declarationInput = (fixture, overrides = {}) => ({
  projectId: fixture.brief.projectId, creativeExport: fixture.creativeExport, handoff: fixture.handoff,
  targetType: 'export-output', targetId: 'hero', assetChecksum: 'a'.repeat(64), rightsBasis: 'generated', rightsHolderId: 'studio-owner',
  licenseId: 'model-terms-v1', licenseEvidenceIds: ['model-terms-proof'], allowedUses: ['display', 'distribution', 'modification'],
  channels: ['digital'], territories: ['worldwide'], attributionRequired: true, attributionText: 'Created locally with Model X.',
  attributionEvidenceIds: ['attribution-in-export'], actorId: 'art-director', idempotencyKey: 'declare-hero', now: '2026-07-11T17:09:00.000Z',
  ...overrides,
});

test('records content-minimized rights declarations bound to exact creative assets', () => {
  const fixture = creativeFixture();
  const declaration = createLocalRightsAssetDeclaration(declarationInput(fixture));
  assert.equal(declaration.schemaVersion, 'local-rights-asset-declaration/v1');
  assert.equal(declaration.storesRawLegalText, false);
  assert.equal(declaration.attributionText, undefined);
  assert.match(declaration.attributionHash, /^[a-f0-9]{64}$/);
  assert.equal(verifyLocalRightsAssetDeclaration(declaration, fixture.creativeExport, fixture.handoff).valid, true);
  assert.throws(() => createLocalRightsAssetDeclaration(declarationInput(fixture, { targetId: 'missing' })), /rights-target-invalid/);
  assert.throws(() => createLocalRightsAssetDeclaration(declarationInput(fixture, { allowedUses: ['anything'] })), /rights-allowed-use-invalid/);
  assert.throws(() => createLocalRightsAssetDeclaration(declarationInput(fixture, { actorId: 'rights-reviewer' })), /rights-art-director-required/);
  const tampered = structuredClone(declaration);
  tampered.allowedUses = [];
  assert.equal(verifyLocalRightsAssetDeclaration(tampered, fixture.creativeExport, fixture.handoff).valid, false);
});

test('amends a declaration through checksum-linked history without making old evidence disappear', () => {
  const fixture = creativeFixture();
  const original = createLocalRightsAssetDeclaration(declarationInput(fixture, { allowedUses: ['display'], idempotencyKey: 'original' }));
  const amended = createLocalRightsAssetDeclaration(declarationInput(fixture, {
    previousDeclaration: original, allowedUses: ['display', 'distribution', 'modification'], idempotencyKey: 'amended', now: '2026-07-11T17:10:00.000Z',
  }));
  assert.equal(amended.version, 2);
  assert.equal(amended.previousDeclarationId, original.id);
  assert.equal(amended.previousDeclarationChecksum, original.checksum);
  assert.equal(verifyLocalRightsAssetDeclaration(amended, fixture.creativeExport, fixture.handoff, original).valid, true);
  const projection = buildLocalRightsProvenance({ project: { ...fixture.project, localRightsAssetDeclarations: [amended, original] }, now: '2026-07-11T17:11:00.000Z' });
  assert.equal(projection.integrity.valid, true);
  assert.equal(projection.declarations.length, 1);
  assert.equal(projection.declarationHistory.length, 2);
  assert.equal(projection.declarations[0].id, amended.id);
});

test('records generated-content provenance without retaining prompts and validates declared inputs', () => {
  const fixture = creativeFixture();
  const declaration = createLocalRightsAssetDeclaration(declarationInput(fixture));
  const provenance = createLocalRightsGenerationProvenance({
    declaration, declarations: [declaration], providerId: 'local-runtime', modelId: 'local-image-model-v1', policyId: 'model-terms-v1',
    promptText: 'A detailed private production prompt.', generationEvidenceIds: ['generation-log-proof'], disclosureText: 'AI-assisted and edited by the art director.',
    inputAssetIds: [], humanEditorId: 'art-director', actorId: 'art-director', idempotencyKey: 'generation-hero', now: '2026-07-11T17:10:00.000Z',
  });
  assert.equal(provenance.storesRawPrompt, false);
  assert.equal(JSON.stringify(provenance).includes('detailed private production prompt'), false);
  assert.match(provenance.promptHash, /^[a-f0-9]{64}$/);
  assert.throws(() => createLocalRightsGenerationProvenance({
    declaration, declarations: [declaration], providerId: 'local-runtime', modelId: 'model', policyId: 'policy', promptText: 'Prompt',
    generationEvidenceIds: ['proof'], disclosureText: 'Disclosure', inputAssetIds: ['undeclared-input'], humanEditorId: 'art-director', actorId: 'art-director',
    idempotencyKey: 'bad-input', now: '2026-07-11T17:10:00.000Z',
  }), /rights-generation-input-undeclared/);
});

test('rejects cyclic derivative lineage and deterministically audits exact final export coverage', () => {
  const fixture = creativeFixture();
  const output = createLocalRightsAssetDeclaration(declarationInput(fixture));
  const source = createLocalRightsAssetDeclaration(declarationInput(fixture, {
    targetType: 'editable-source', targetId: 'editable-source', assetChecksum: 'b'.repeat(64), rightsBasis: 'owned', licenseId: 'ownership-record',
    licenseEvidenceIds: ['ownership-proof'], attributionRequired: false, attributionText: null, attributionEvidenceIds: [], idempotencyKey: 'declare-source',
  }));
  const dependency = createLocalRightsAssetDeclaration(declarationInput(fixture, {
    targetType: 'dependency', targetId: 'local-font', assetChecksum: 'c'.repeat(64), rightsBasis: 'open-license', rightsHolderId: 'font-author',
    licenseId: 'ofl-1.1', licenseEvidenceIds: ['ofl-proof'], attributionRequired: false, attributionText: null, attributionEvidenceIds: [], idempotencyKey: 'declare-font',
  }));
  const declarations = [output, source, dependency];
  const generation = createLocalRightsGenerationProvenance({
    declaration: output, declarations, providerId: 'local-runtime', modelId: 'model-v1', policyId: 'model-terms-v1', promptText: 'Private prompt',
    generationEvidenceIds: ['generation-proof'], disclosureText: 'AI-assisted.', inputAssetIds: [source.id], humanEditorId: 'art-director', actorId: 'art-director',
    idempotencyKey: 'generation', now: '2026-07-11T17:10:00.000Z',
  });
  const lineage = createLocalRightsDerivativeLineage({
    outputDeclaration: output, inputDeclarationIds: [source.id], declarations, existingLineages: [], transformationText: 'Edited and composed locally.',
    evidenceIds: ['edit-history-proof'], actorId: 'art-director', idempotencyKey: 'lineage', now: '2026-07-11T17:11:00.000Z',
  });
  assert.throws(() => createLocalRightsDerivativeLineage({
    outputDeclaration: source, inputDeclarationIds: [output.id], declarations, existingLineages: [lineage], transformationText: 'Cycle.', evidenceIds: ['proof'],
    actorId: 'art-director', idempotencyKey: 'cycle', now: '2026-07-11T17:12:00.000Z',
  }), /rights-derivative-cycle/);
  const audit = createLocalRightsExportAudit({
    creativeWorkflow: fixture.creativeWorkflow, declarations, generationProvenance: [generation], derivativeLineages: [lineage],
    reviewerId: 'rights-reviewer', requiredUses: ['display', 'distribution'], requiredChannels: ['digital'], requiredTerritories: ['worldwide'],
    idempotencyKey: 'audit', now: '2026-07-11T17:12:00.000Z',
  });
  assert.equal(audit.findings.length, 0);
  assert.equal(audit.status, 'rights-governed-export-cleared');
  assert.equal(audit.readyForRightsGovernedExport, true);
  assert.equal(audit.legalOpinion, false);
  const blocked = createLocalRightsExportAudit({
    creativeWorkflow: fixture.creativeWorkflow, declarations: declarations.filter((row) => row.targetType !== 'dependency'), generationProvenance: [], derivativeLineages: [],
    reviewerId: 'rights-reviewer', requiredUses: ['display', 'distribution'], requiredChannels: ['digital'], requiredTerritories: ['worldwide'],
    idempotencyKey: 'blocked-audit', now: '2026-07-11T17:12:00.000Z',
  });
  assert.equal(blocked.readyForRightsGovernedExport, false);
  assert.deepEqual(blocked.findings.map((row) => row.code), ['derivative-lineage-missing', 'generation-provenance-missing', 'target-declaration-missing']);
  const projection = buildLocalRightsProvenance({ project: { ...fixture.project, localRightsAssetDeclarations: declarations, localRightsGenerationProvenance: [generation], localRightsDerivativeLineages: [lineage], localRightsExportAudits: [audit] }, now: '2026-07-11T17:13:00.000Z' });
  assert.equal(projection.integrity.valid, true);
  assert.equal(projection.readyForRightsGovernedExport, true);
  const staleProject = { ...fixture.project, localCreativeExports: [...fixture.project.localCreativeExports, { ...fixture.creativeExport, id: 'new-export' }] };
  const stale = buildLocalRightsProvenance({ project: { ...staleProject, localRightsAssetDeclarations: declarations, localRightsGenerationProvenance: [generation], localRightsDerivativeLineages: [lineage], localRightsExportAudits: [audit] }, now: '2026-07-11T17:13:00.000Z' });
  assert.equal(stale.readyForRightsGovernedExport, false);
});
