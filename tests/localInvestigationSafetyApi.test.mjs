import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';

const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-investigation-manager' };

test('makes minimized unexpired one-time safety authorization mandatory on a real investigation evidence write', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-investigation-safety-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    const call = (method, path, body = {}) => api.handleAsync({ method, path, headers, body });
    let response = await call('POST', '/projects/initiate', {
      projectId: 'investigation_safety_api_project', name: 'Investigation Safety', brief: 'Prove mandatory local investigation safety.',
      workMode: 'investigation', includeReadModels: false,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.readModels.investigationSafetyRoute, '/projects/investigation_safety_api_project/investigation-safety');
    const project = response.body.project;
    const role = (id) => project.workModeContract.roles.find((row) => row.id === id)?.personaSlug;
    const leadId = role('investigation-lead');
    const investigatorId = role('evidence-investigator');
    const reviewerId = role('risk-reviewer');
    response = await call('POST', `/projects/${project.id}/investigation-case/cases`, {
      scope: 'PRIVATE SAFETY CASE SCOPE',
      hypotheses: [
        { id: 'cause-a', type: 'primary', statement: 'PRIVATE A', falsificationCriteria: 'PRIVATE NOT A', priorBps: 5000 },
        { id: 'cause-b', type: 'alternative', statement: 'PRIVATE B', falsificationCriteria: 'PRIVATE NOT B', priorBps: 5000 },
      ],
      actorId: leadId, idempotencyKey: 'safety-case', now: '2026-07-11T12:00:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const caseRecord = response.body.investigationCase;
    response = await call('POST', `/projects/${project.id}/investigation-safety/policies`, {
      authorityBasis: 'subject-consent', authorityEvidenceIds: [caseRecord.id], allowedDataCategories: ['contact'],
      retentionDays: 30, decisionTtlMinutes: 15, actorId: leadId, idempotencyKey: 'invalid-self-authority', now: '2026-07-11T12:00:30.000Z',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /authority-evidence-not-found/);
    response = await call('POST', `/projects/${project.id}/investigation-safety/policies`, {
      authorityBasis: 'public-record-research', authorityEvidenceIds: [], allowedDataCategories: ['operational', 'public-record'],
      retentionDays: 30, decisionTtlMinutes: 15, actorId: leadId, idempotencyKey: 'safety-policy', now: '2026-07-11T12:01:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));

    const prohibitedText = 'Doxx the employee and steal their password.';
    response = await call('POST', `/projects/${project.id}/investigation-safety/evaluate`, {
      requestText: prohibitedText,
      context: { actionType: 'external-action', targetIds: ['employee-1'], requestedDataCategories: ['public-record'], collectionMethod: 'not-applicable', subjectType: 'adult', externalEffect: true },
      idempotencyKey: 'prohibited-decision', now: '2026-07-11T12:02:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const blocked = response.body.investigationSafetyDecision;
    assert.equal(blocked.responseAuthorization.canProceed, false);
    assert.equal(blocked.responseAuthorization.mode, 'prohibited-investigation-refusal');
    assert.equal(JSON.stringify(blocked).includes(prohibitedText), false);
    response = await call('POST', `/projects/${project.id}/investigation-safety/decisions/${blocked.id}/resolve`, {
      actorId: reviewerId, resolutionCode: 'deny', evidenceIds: [caseRecord.id], idempotencyKey: 'blocked-resolution', now: '2026-07-11T12:03:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.investigationSafetyResolution.authorizesOperation, false);

    response = await call('POST', `/projects/${project.id}/agents/${investigatorId}/evidence-searches`, {
      query: 'Public operational record', purpose: 'Collect bounded public evidence.', includeReadModels: false,
      sources: [{ id: 'safe-source', title: 'Safe source', url: 'https://example.test/safe-source' }],
      findings: ['Bounded public operational evidence.'], confidence: 'high', now: '2026-07-11T12:04:00.000Z',
    });
    const search = response.body.evidenceSearch;
    response = await call('POST', `/projects/${project.id}/evidence-source-review-workflow`, {
      evidenceSearchId: search.id, sourceId: search.sources[0].id, reviewerAgentId: reviewerId, decision: 'approved',
      includeReadModels: false, now: '2026-07-11T12:05:00.000Z',
    });
    const sourceReview = response.body.evidenceSourceReview;
    const evidenceBody = {
      sourceSnapshotId: search.sourceSnapshotIds[0], sourceReviewId: sourceReview.id,
      observation: 'PRIVATE SAFE OBSERVATION',
      reliability: { authorityBps: 8000, proximityBps: 8000, corroborationBps: 7000, recencyBps: 9000, biasRiskBps: 2000 },
      relations: [{ hypothesisId: 'cause-a', stance: 'supports', strengthBps: 8000 }],
      acquiredAt: '2026-07-11T12:06:00.000Z', idempotencyKey: 'safe-evidence', now: '2026-07-11T12:07:00.000Z',
    };
    response = await call('POST', `/projects/${project.id}/investigation-case/evidence`, evidenceBody);
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /investigation-safety-decision-required/);

    const allowedRequest = 'Collect the public operational source snapshot.';
    response = await call('POST', `/projects/${project.id}/investigation-safety/evaluate`, {
      requestText: allowedRequest,
      context: { actionType: 'collect-evidence', targetIds: [search.sourceSnapshotIds[0]], requestedDataCategories: ['operational'], collectionMethod: 'public-source', subjectType: 'organization', externalEffect: false },
      idempotencyKey: 'allowed-collection', now: '2026-07-11T12:05:30.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const allowed = response.body.investigationSafetyDecision;
    assert.equal(allowed.responseAuthorization.canProceed, true);
    response = await call('POST', `/projects/${project.id}/investigation-case/evidence`, { ...evidenceBody, safetyDecisionId: allowed.id });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.investigationSafetyUse.decisionId, allowed.id);
    response = await call('POST', `/projects/${project.id}/investigation-case/evidence`, {
      ...evidenceBody, safetyDecisionId: allowed.id, idempotencyKey: 'reuse-decision-evidence', now: '2026-07-11T12:08:00.000Z',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /investigation-safety-decision-already-used/);
    response = await call('POST', `/projects/${project.id}/investigation-safety/evaluate`, {
      requestText: 'Collect the same bounded public source for a separate observation.',
      context: { actionType: 'collect-evidence', targetIds: [search.sourceSnapshotIds[0]], requestedDataCategories: ['operational'], collectionMethod: 'public-source', subjectType: 'organization', externalEffect: false },
      idempotencyKey: 'unused-after-tamper', now: '2026-07-11T12:08:30.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const unusedAfterTamper = response.body.investigationSafetyDecision;

    const snapshotText = JSON.stringify(store.snapshot());
    assert.equal(snapshotText.includes(prohibitedText), false);
    assert.equal(snapshotText.includes(allowedRequest), false);
    api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/investigation-safety`, headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.investigationSafety.integrity.valid, true);
    assert.equal(response.body.investigationSafety.summary.consumedDecisionCount, 1);

    const tamperedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const tampered = tamperedStore.getProject(project.id);
    tampered.localInvestigationSafetyUses[0].targetIds = ['other-target'];
    tamperedStore.saveProject(tampered);
    api = createAgentProjectApi({ service: createAgentProjectService({ store: tamperedStore }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/investigation-safety`, headers });
    assert.equal(response.body.investigationSafety.status, 'degraded-integrity-invalid');
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/investigation-case/evidence`, headers,
      body: { ...evidenceBody, safetyDecisionId: unusedAfterTamper.id, idempotencyKey: 'blocked-by-tampered-safety-ledger', now: '2026-07-11T12:09:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /investigation-safety-current-state-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps investigation safety private and investigation-only', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/investigation-safety' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/investigation-safety/evaluate' }).allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'learning', workModeContract: { workMode: 'learning' } }] });
  assert.throws(() => service.createLocalInvestigationSafetyPolicy({ projectId: 'learning' }), /investigation-safety-investigation-work-mode-required/);
});
