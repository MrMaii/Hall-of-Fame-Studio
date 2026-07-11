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

test('persists a real hypothesis-to-reviewed-evidence-to-sealed-independent-closure case across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-investigation-case-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    const call = (method, path, body = {}) => api.handleAsync({ method, path, headers, body });
    let response = await call('POST', '/projects/initiate', {
      projectId: 'investigation_case_api_project', name: 'Investigation Case', brief: 'Investigate a local service regression.',
      workMode: 'investigation', includeReadModels: false,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.readModels.investigationCaseRoute, '/projects/investigation_case_api_project/investigation-case');
    const project = response.body.project;
    const role = (id) => project.workModeContract.roles.find((row) => row.id === id)?.personaSlug;
    const leadId = role('investigation-lead');
    const investigatorId = role('evidence-investigator');
    const analystId = role('causal-analyst');
    const reviewerId = role('risk-reviewer');

    response = await call('POST', `/projects/${project.id}/agents/${investigatorId}/evidence-searches`, {
      query: 'Local regression evidence', purpose: 'Test competing causes.', includeReadModels: false,
      sources: [
        { id: 'case-source-a', title: 'Deployment record', url: 'https://example.test/deployment-record' },
        { id: 'case-source-b', title: 'Traffic record', url: 'https://example.test/traffic-record' },
      ],
      findings: ['The two local fixtures point in different causal directions.'], confidence: 'high', now: '2026-07-11T10:00:00.000Z',
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const search = response.body.evidenceSearch;
    const reviews = [];
    for (const source of search.sources) {
      response = await call('POST', `/projects/${project.id}/evidence-source-review-workflow`, {
        evidenceSearchId: search.id, sourceId: source.id, reviewerAgentId: reviewerId, decision: 'approved',
        comments: 'Approved for bounded local case use.', includeReadModels: false, now: '2026-07-11T10:01:00.000Z',
      });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      reviews.push(response.body.evidenceSourceReview);
    }

    const rawTexts = ['PRIVATE CASE SCOPE', 'PRIVATE HYPOTHESIS A', 'PRIVATE HYPOTHESIS B', 'PRIVATE OBSERVATION A', 'PRIVATE OBSERVATION B', 'PRIVATE RESOLUTION'];
    response = await call('POST', `/projects/${project.id}/investigation-case/cases`, {
      scope: rawTexts[0],
      hypotheses: [
        { id: 'deployment-change', type: 'primary', statement: rawTexts[1], falsificationCriteria: 'PRIVATE FALSIFICATION A', priorBps: 5500 },
        { id: 'traffic-shift', type: 'alternative', statement: rawTexts[2], falsificationCriteria: 'PRIVATE FALSIFICATION B', priorBps: 4500 },
      ],
      actorId: leadId, idempotencyKey: 'api-case-1', now: '2026-07-11T10:05:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const caseRecord = response.body.investigationCase;
    assert.equal(JSON.stringify(caseRecord).includes(rawTexts[0]), false);
    response = await call('POST', `/projects/${project.id}/investigation-safety/policies`, {
      authorityBasis: 'public-record-research', authorityEvidenceIds: [], allowedDataCategories: ['operational', 'public-record'],
      retentionDays: 30, decisionTtlMinutes: 15, actorId: leadId, idempotencyKey: 'api-investigation-safety-policy', now: '2026-07-11T10:05:30.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));

    const evidenceBodies = [
      {
        sourceSnapshotId: search.sourceSnapshotIds[0], sourceReviewId: reviews[0].id,
        observation: rawTexts[3], reliability: { authorityBps: 9000, proximityBps: 8000, corroborationBps: 7000, recencyBps: 10000, biasRiskBps: 2000 },
        relations: [{ hypothesisId: 'deployment-change', stance: 'supports', strengthBps: 9000 }, { hypothesisId: 'traffic-shift', stance: 'contradicts', strengthBps: 6000 }],
        acquiredAt: '2026-07-11T10:10:00.000Z', idempotencyKey: 'api-evidence-a', now: '2026-07-11T10:11:00.000Z',
      },
      {
        sourceSnapshotId: search.sourceSnapshotIds[1], sourceReviewId: reviews[1].id,
        observation: rawTexts[4], reliability: { authorityBps: 8000, proximityBps: 9000, corroborationBps: 7000, recencyBps: 9000, biasRiskBps: 1000 },
        relations: [{ hypothesisId: 'deployment-change', stance: 'contradicts', strengthBps: 7000 }, { hypothesisId: 'traffic-shift', stance: 'supports', strengthBps: 5000 }],
        acquiredAt: '2026-07-11T10:12:00.000Z', idempotencyKey: 'api-evidence-b', now: '2026-07-11T10:13:00.000Z',
      },
    ];
    const evidenceRecords = [];
    for (let index = 0; index < evidenceBodies.length; index += 1) {
      const body = evidenceBodies[index];
      response = await call('POST', `/projects/${project.id}/investigation-safety/evaluate`, {
        requestText: `Collect bounded public operational evidence ${index + 1}.`,
        context: { actionType: 'collect-evidence', targetIds: [body.sourceSnapshotId], requestedDataCategories: ['operational'], collectionMethod: 'public-source', subjectType: 'organization', externalEffect: false },
        idempotencyKey: `api-evidence-safety-${index + 1}`, now: index === 0 ? '2026-07-11T10:09:00.000Z' : '2026-07-11T10:11:00.000Z',
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      response = await call('POST', `/projects/${project.id}/investigation-case/evidence`, { ...body, safetyDecisionId: response.body.investigationSafetyDecision.id });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      evidenceRecords.push(response.body.investigationEvidence);
    }
    response = await call('POST', `/projects/${project.id}/investigation-case/cases`, {
      scope: 'PRIVATE LATE CASE REVISION', hypotheses: [
        { id: 'deployment-change', type: 'primary', statement: 'A', falsificationCriteria: 'A false', priorBps: 5500 },
        { id: 'traffic-shift', type: 'alternative', statement: 'B', falsificationCriteria: 'B false', priorBps: 4500 },
      ],
      expectedCaseVersion: caseRecord.version, expectedCaseChecksum: caseRecord.checksum,
      idempotencyKey: 'api-case-late-revision', now: '2026-07-11T10:13:30.000Z',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /case-revision-after-evidence-forbidden/);
    response = await call('GET', `/projects/${project.id}/investigation-case`, { now: '2026-07-11T10:14:00.000Z' });
    assert.equal(response.body.investigationCaseWorkflow.status, 'contradictions-open');
    assert.equal(response.body.investigationCaseWorkflow.summary.contradictionCount, 2);
    const contradictions = response.body.investigationCaseWorkflow.contradictions;

    const custodyEvents = [];
    response = await call('POST', `/projects/${project.id}/investigation-case/evidence/${evidenceRecords[0].id}/custody-events`, {
      eventType: 'verify', fromCustodianId: investigatorId, toCustodianId: investigatorId, actorId: analystId,
      occurredAt: '2026-07-11T10:20:00.000Z', idempotencyKey: 'api-verify-a',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    custodyEvents.push(response.body.investigationCustodyEvent);
    response = await call('POST', `/projects/${project.id}/investigation-case/evidence/${evidenceRecords[0].id}/custody-events`, {
      eventType: 'transfer', fromCustodianId: investigatorId, toCustodianId: reviewerId, actorId: investigatorId,
      occurredAt: '2026-07-11T10:21:00.000Z', idempotencyKey: 'api-transfer-a',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    custodyEvents.push(response.body.investigationCustodyEvent);
    response = await call('POST', `/projects/${project.id}/investigation-case/evidence/${evidenceRecords[0].id}/custody-events`, {
      eventType: 'seal', fromCustodianId: reviewerId, toCustodianId: reviewerId, actorId: reviewerId,
      occurredAt: '2026-07-11T10:22:00.000Z', idempotencyKey: 'api-seal-a',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    custodyEvents.push(response.body.investigationCustodyEvent);
    response = await call('POST', `/projects/${project.id}/investigation-case/evidence/${evidenceRecords[1].id}/custody-events`, {
      eventType: 'seal', fromCustodianId: investigatorId, toCustodianId: investigatorId, actorId: reviewerId,
      occurredAt: '2026-07-11T10:22:00.000Z', idempotencyKey: 'api-seal-b',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));

    response = await call('POST', `/projects/${project.id}/investigation-case/conclusions`, {
      selectedHypothesisId: 'deployment-change', idempotencyKey: 'api-premature-conclusion', now: '2026-07-11T10:23:00.000Z',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /contradictions-unresolved/);

    for (let index = 0; index < contradictions.length; index += 1) {
      response = await call('POST', `/projects/${project.id}/investigation-case/contradictions/${contradictions[index].id}/resolutions`, {
        resolutionCode: index ? 'scope-difference' : 'source-preferred', rationale: `${rawTexts[5]} ${index + 1}`,
        idempotencyKey: `api-resolution-${index + 1}`, now: `2026-07-11T10:2${4 + index}:00.000Z`,
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
    }
    response = await call('POST', `/projects/${project.id}/investigation-safety/evaluate`, {
      requestText: 'Draft the bounded local conclusion from sealed resolved evidence.',
      context: { actionType: 'draft-conclusion', targetIds: [caseRecord.id], requestedDataCategories: [], collectionMethod: 'not-applicable', subjectType: 'organization', externalEffect: false },
      idempotencyKey: 'api-conclusion-safety', now: '2026-07-11T10:29:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const conclusionSafetyDecisionId = response.body.investigationSafetyDecision.id;
    response = await call('POST', `/projects/${project.id}/investigation-case/conclusions`, {
      selectedHypothesisId: 'deployment-change', safetyDecisionId: conclusionSafetyDecisionId, idempotencyKey: 'api-conclusion', now: '2026-07-11T10:30:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const conclusion = response.body.investigationConclusion;
    assert.equal(conclusion.confidenceBps, 5562);
    assert.equal(conclusion.outcome, 'inconclusive');
    response = await call('POST', `/projects/${project.id}/investigation-case/closures`, {
      reviewerId: analystId, decision: 'accepted', idempotencyKey: 'api-bad-closure', now: '2026-07-11T10:30:30.000Z',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /independent-closure-reviewer-required/);
    response = await call('POST', `/projects/${project.id}/investigation-safety/evaluate`, {
      requestText: 'Close the local case with the recorded conclusion.',
      context: { actionType: 'close-case', targetIds: [caseRecord.id], requestedDataCategories: [], collectionMethod: 'not-applicable', subjectType: 'organization', externalEffect: false },
      idempotencyKey: 'api-closure-safety', now: '2026-07-11T10:30:45.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const closureSafetyDecisionId = response.body.investigationSafetyDecision.id;
    response = await call('POST', `/projects/${project.id}/investigation-case/closures`, {
      reviewerId, decision: 'accepted', safetyDecisionId: closureSafetyDecisionId, idempotencyKey: 'api-closure', now: '2026-07-11T10:31:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.investigationCaseWorkflow.status, 'closed-inconclusive');
    assert.equal(response.body.investigationCaseWorkflow.readyForLocalCaseClosure, true);
    assert.equal(response.body.investigationCaseWorkflow.readyForProduction, false);
    response = await call('POST', `/projects/${project.id}/investigation-case/evidence`, {
      ...evidenceBodies[0], idempotencyKey: 'api-post-closure-evidence', now: '2026-07-11T10:32:00.000Z',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /investigation-case-closed/);

    const snapshotText = JSON.stringify(store.snapshot());
    assert.ok(rawTexts.every((text) => !snapshotText.includes(text)), 'Case snapshot must omit raw private case reasoning text.');
    api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/investigation-case`, headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.investigationCaseWorkflow.status, 'closed-inconclusive');
    assert.equal(response.body.investigationCaseWorkflow.integrity.valid, true);

    const tamperedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const tampered = tamperedStore.getProject(project.id);
    tampered.evidenceSourceSnapshots[0].checksum = '0'.repeat(64);
    tamperedStore.saveProject(tampered);
    api = createAgentProjectApi({ service: createAgentProjectService({ store: tamperedStore }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/investigation-case`, headers });
    assert.equal(response.body.investigationCaseWorkflow.status, 'degraded-integrity-invalid');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps investigation cases private and investigation-only', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/investigation-case' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/investigation-case/cases' }).allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'learning', workModeContract: { workMode: 'learning' } }] });
  assert.throws(() => service.createLocalInvestigationCase({ projectId: 'learning' }), /investigation-work-mode-required/);
});
