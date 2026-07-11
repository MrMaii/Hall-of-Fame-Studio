import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import {
  createLocalCreativeBrief, createLocalCreativeCritique, createLocalCreativeExport, createLocalCreativeHandoff,
  createLocalCreativeHandoffAcknowledgement, createLocalCreativeIteration,
} from '../src/agents/localCreativeStudio.js';

const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'rights-manager' };

function seededCreativeProject() {
  const brief = createLocalCreativeBrief({
    projectId: 'rights_api_project', creativeLeadId: 'creative-lead', artDirectorId: 'art-director', audienceResearcherId: 'audience-researcher', rightsReviewerId: 'rights-reviewer',
    creativeDirection: 'Local launch artwork.', audienceSegments: [{ id: 'operators', description: 'Local operators.', evidenceIds: ['audience-proof'] }],
    deliverables: [{ id: 'hero', mediaType: 'image', format: 'png', width: 1600, height: 900, colorSpace: 'srgb', maxBytes: 2_000_000, accessibilityRequired: true }],
    constraints: [{ id: 'local', text: 'Stay local.' }], successCriteria: [{ id: 'clear', text: 'Clear hierarchy.' }], knownEvidenceIds: ['audience-proof'],
    actorId: 'creative-lead', idempotencyKey: 'brief', now: '2026-07-11T18:00:00.000Z',
  });
  const iteration = createLocalCreativeIteration({ brief, submission: { id: 'submission', agentId: 'art-director', artifactType: 'creative-work', artifactChecksum: 'artifact', artifactStorageProofChecksum: 'storage', createdAt: '2026-07-11T18:01:00.000Z' }, deliverableIds: ['hero'], changeSummary: 'Complete.', idempotencyKey: 'iteration', now: '2026-07-11T18:02:00.000Z' });
  const dimensions = ['brief-alignment', 'craft', 'audience-fit', 'accessibility'].map((id) => ({ id, scoreBps: 8000, findingText: 'Pass.', blocking: false }));
  const lead = createLocalCreativeCritique({ brief, iteration, perspective: 'creative-lead', reviewerId: 'creative-lead', dimensions, verdict: 'approved', idempotencyKey: 'lead', now: '2026-07-11T18:03:00.000Z' });
  const audience = createLocalCreativeCritique({ brief, iteration, perspective: 'audience-researcher', reviewerId: 'audience-researcher', dimensions, verdict: 'approved', idempotencyKey: 'audience', now: '2026-07-11T18:04:00.000Z' });
  const creativeExport = createLocalCreativeExport({ brief, iteration, critiques: [lead, audience], checks: [{ deliverableId: 'hero', format: 'png', width: 1600, height: 900, durationMs: null, colorSpace: 'srgb', fileBytes: 1_000_000, outputChecksum: 'a'.repeat(64), evidenceIds: ['storage'], accessibilityEvidenceIds: ['alt'] }], actorId: 'art-director', idempotencyKey: 'export', now: '2026-07-11T18:05:00.000Z' });
  const handoff = createLocalCreativeHandoff({ brief, iteration, creativeExport, senderId: 'art-director', recipientId: 'creative-lead', editableSourceEvidenceIds: ['source'], toolchain: [{ toolId: 'editor', toolVersion: '1' }], dependencyIds: ['font'], instructionsText: 'Open locally.', knownLimitationsText: 'None.', idempotencyKey: 'handoff', now: '2026-07-11T18:06:00.000Z' });
  const acknowledgement = createLocalCreativeHandoffAcknowledgement({ handoff, actorId: 'creative-lead', evidenceIds: ['ack'], idempotencyKey: 'ack', now: '2026-07-11T18:07:00.000Z' });
  return {
    id: brief.projectId, name: 'Rights API', workModeContract: { workMode: 'creative-studio', roles: [
      { id: 'creative-lead', personaSlug: 'creative-lead' }, { id: 'art-director', personaSlug: 'art-director' },
      { id: 'audience-researcher', personaSlug: 'audience-researcher' }, { id: 'rights-reviewer', personaSlug: 'rights-reviewer' },
    ] }, localCreativeBriefs: [brief], localCreativeIterations: [iteration], localCreativeCritiques: [lead, audience], localCreativeExports: [creativeExport], localCreativeHandoffs: [handoff], localCreativeHandoffAcknowledgements: [acknowledgement],
  };
}

test('persists private rights provenance through the file-backed API and fails tampering closed', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-rights-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject, projects: [seededCreativeProject()] });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    const call = (method, path, body = {}) => api.handleAsync({ method, path, headers, body });
    const base = { rightsHolderId: 'studio', licenseId: 'license-v1', licenseEvidenceIds: ['license-proof'], allowedUses: ['display', 'distribution', 'modification'], channels: ['digital'], territories: ['worldwide'], attributionRequired: false, attributionEvidenceIds: [] };
    const declare = async (body) => {
      const response = await call('POST', '/projects/rights_api_project/rights-provenance/asset-declarations', body);
      assert.equal(response.status, 201, JSON.stringify(response.body));
      return response.body.rightsAssetDeclaration;
    };
    const output = await declare({ ...base, targetType: 'export-output', targetId: 'hero', assetChecksum: 'a'.repeat(64), rightsBasis: 'generated', attributionRequired: true, attributionText: 'AI-assisted.', attributionEvidenceIds: ['attribution-proof'], actorId: 'caller-override', idempotencyKey: 'output', now: '2026-07-11T18:08:00.000Z' });
    assert.equal(output.actorId, 'art-director');
    assert.equal(output.attributionText, undefined);
    const source = await declare({ ...base, targetType: 'editable-source', targetId: 'source', assetChecksum: 'b'.repeat(64), rightsBasis: 'owned', idempotencyKey: 'source', now: '2026-07-11T18:09:00.000Z' });
    await declare({ ...base, targetType: 'dependency', targetId: 'font', assetChecksum: 'c'.repeat(64), rightsBasis: 'open-license', idempotencyKey: 'font', now: '2026-07-11T18:10:00.000Z' });
    let response = await call('POST', '/projects/rights_api_project/rights-provenance/generation-provenance', {
      declarationId: output.id, providerId: 'local-runtime', modelId: 'model-v1', policyId: 'license-v1', promptText: 'PRIVATE PROMPT', generationEvidenceIds: ['generation-proof'], disclosureText: 'AI-assisted.', inputAssetIds: [source.id], humanEditorId: 'caller-override', actorId: 'caller-override', idempotencyKey: 'generation', now: '2026-07-11T18:11:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(JSON.stringify(response.body.rightsGenerationProvenance).includes('PRIVATE PROMPT'), false);
    response = await call('POST', '/projects/rights_api_project/rights-provenance/derivative-lineage', {
      outputDeclarationId: output.id, inputDeclarationIds: [source.id], transformationText: 'Composed locally.', evidenceIds: ['edit-proof'], actorId: 'caller-override', idempotencyKey: 'lineage', now: '2026-07-11T18:12:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    response = await call('POST', '/projects/rights_api_project/rights-provenance/audits', {
      reviewerId: 'caller-override', requiredUses: ['display', 'distribution'], requiredChannels: ['digital'], requiredTerritories: ['worldwide'], idempotencyKey: 'audit', now: '2026-07-11T18:13:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.rightsExportAudit.reviewerId, 'rights-reviewer');
    assert.equal(response.body.rightsProvenance.readyForRightsGovernedExport, true);
    response = await call('POST', '/projects/rights_api_project/rights-provenance/audits', { reviewerId: 'again', requiredUses: ['display', 'distribution'], requiredChannels: ['digital'], requiredTerritories: ['worldwide'], idempotencyKey: 'audit', now: '2026-07-11T18:14:00.000Z' });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);

    api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
    response = await api.handleAsync({ method: 'GET', path: '/projects/rights_api_project/rights-provenance', headers, body: { now: '2026-07-11T18:14:00.000Z' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.rightsProvenance.integrity.valid, true);
    assert.equal(response.body.rightsProvenance.readyForRightsGovernedExport, true);
    const tamperedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const tampered = tamperedStore.getProject('rights_api_project');
    tampered.localRightsAssetDeclarations[0].allowedUses = [];
    tamperedStore.saveProject(tampered);
    api = createAgentProjectApi({ service: createAgentProjectService({ store: tamperedStore }) });
    response = await api.handleAsync({ method: 'GET', path: '/projects/rights_api_project/rights-provenance', headers, body: { now: '2026-07-11T18:14:00.000Z' } });
    assert.equal(response.body.rightsProvenance.integrity.valid, false);
    assert.equal(response.body.rightsProvenance.readyForRightsGovernedExport, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps rights provenance private and creative-mode-only', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/rights-provenance' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/rights-provenance/audits' }).allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'learning', workModeContract: { workMode: 'learning' } }] });
  assert.throws(() => service.createLocalRightsAssetDeclaration({ projectId: 'learning' }), /rights-provenance-creative-studio-work-mode-required/);
});
