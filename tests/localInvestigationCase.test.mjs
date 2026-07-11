import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLocalInvestigationCaseWorkflow,
  createLocalInvestigationCase,
  createLocalInvestigationClosure,
  createLocalInvestigationConclusion,
  createLocalInvestigationContradictionResolution,
  createLocalInvestigationCustodyEvent,
  createLocalInvestigationEvidence,
  investigationContradictionIds,
  verifyLocalInvestigationCase,
  verifyLocalInvestigationClosure,
  verifyLocalInvestigationConclusion,
  verifyLocalInvestigationCustodyChain,
  verifyLocalInvestigationEvidence,
} from '../src/agents/localInvestigationCase.js';

const caseInput = {
  projectId: 'investigation-project', leadId: 'lead', investigatorId: 'investigator', analystId: 'analyst', reviewerId: 'reviewer',
  scope: 'PRIVATE INCIDENT SCOPE',
  hypotheses: [
    { id: 'deployment-change', type: 'primary', statement: 'PRIVATE PRIMARY HYPOTHESIS', falsificationCriteria: 'PRIVATE PRIMARY FALSIFICATION', priorBps: 5500 },
    { id: 'traffic-shift', type: 'alternative', statement: 'PRIVATE ALTERNATIVE HYPOTHESIS', falsificationCriteria: 'PRIVATE ALTERNATIVE FALSIFICATION', priorBps: 4500 },
  ],
  actorId: 'lead', idempotencyKey: 'case-v1', now: '2026-07-11T10:00:00.000Z',
};

const sourceSnapshot = (id, sourceId, evidenceSearchId, checksumChar) => ({
  schemaVersion: 'evidence-source-snapshot/v1', id, sourceId, evidenceSearchId,
  checksum: checksumChar.repeat(64), capturedAt: '2026-07-11T10:05:00.000Z',
});
const sourceReview = (id, sourceId, evidenceSearchId, checksumChar) => ({
  schemaVersion: 'evidence-source-review/v1', id, sourceId, evidenceSearchId,
  reviewerAgentId: 'reviewer', decision: 'approved', checksum: checksumChar.repeat(64), createdAt: '2026-07-11T10:06:00.000Z',
});

function evidence(caseRecord, overrides = {}) {
  return createLocalInvestigationEvidence({
    caseRecord,
    sourceSnapshot: sourceSnapshot('snapshot-a', 'source-a', 'search-1', 'a'),
    sourceReview: sourceReview('source-review-a', 'source-a', 'search-1', 'b'),
    collectorId: 'investigator', analystId: 'analyst', custodianId: 'investigator',
    observation: 'PRIVATE OBSERVATION A',
    reliability: { authorityBps: 9000, proximityBps: 8000, corroborationBps: 7000, recencyBps: 10000, biasRiskBps: 2000 },
    relations: [
      { hypothesisId: 'deployment-change', stance: 'supports', strengthBps: 9000 },
      { hypothesisId: 'traffic-shift', stance: 'contradicts', strengthBps: 6000 },
    ],
    acquiredAt: '2026-07-11T10:10:00.000Z', idempotencyKey: 'evidence-a', now: '2026-07-11T10:11:00.000Z',
    ...overrides,
  });
}

test('creates a versioned content-minimized investigation with competing hypotheses and exact independent roles', () => {
  const caseRecord = createLocalInvestigationCase(caseInput);
  assert.equal(verifyLocalInvestigationCase(caseRecord).valid, true);
  assert.equal(caseRecord.hypotheses.length, 2);
  assert.equal(caseRecord.hypotheses[0].statementHash.length, 64);
  assert.equal(JSON.stringify(caseRecord).includes('PRIVATE INCIDENT SCOPE'), false);
  assert.equal(JSON.stringify(caseRecord).includes('PRIVATE PRIMARY HYPOTHESIS'), false);
  assert.throws(() => createLocalInvestigationCase({ ...caseInput, hypotheses: [caseInput.hypotheses[0]] }), /competing-hypotheses-required/);
  assert.throws(() => createLocalInvestigationCase({ ...caseInput, reviewerId: 'analyst' }), /independent-roles-required/);
  const revision = createLocalInvestigationCase({
    ...caseInput, scope: 'PRIVATE REVISED SCOPE', version: 2,
    previousCaseId: caseRecord.id, previousCaseChecksum: caseRecord.checksum,
    idempotencyKey: 'case-v2', now: '2026-07-11T10:02:00.000Z',
  });
  assert.equal(verifyLocalInvestigationCase(revision, caseRecord).valid, true);
  assert.equal(verifyLocalInvestigationCase({ ...revision, scopeLength: 1 }, caseRecord).valid, false);
});

test('binds reliable evidence to append-only custody, resolves automatic contradictions, derives confidence and closes independently', () => {
  const caseRecord = createLocalInvestigationCase(caseInput);
  const evidenceA = evidence(caseRecord);
  assert.equal(evidenceA.reliabilityScoreBps, 8400);
  assert.equal(verifyLocalInvestigationEvidence(evidenceA, caseRecord).valid, true);
  assert.equal(JSON.stringify(evidenceA).includes('PRIVATE OBSERVATION A'), false);
  assert.throws(() => evidence(caseRecord, { sourceReview: sourceReview('bad-review', 'source-a', 'search-1', 'b'), sourceSnapshot: sourceSnapshot('wrong-snapshot', 'different-source', 'search-1', 'a') }), /snapshot-review-binding-invalid/);
  assert.throws(() => evidence(caseRecord, { sourceReview: { ...sourceReview('bad-review', 'source-a', 'search-1', 'b'), decision: 'needs-corroboration' } }), /approved-source-review-required/);
  assert.throws(() => evidence(caseRecord, { acquiredAt: '2026-07-11T10:04:00.000Z' }), /evidence-acquired-before-source-ready/);

  const evidenceB = evidence(caseRecord, {
    sourceSnapshot: sourceSnapshot('snapshot-b', 'source-b', 'search-2', 'c'),
    sourceReview: sourceReview('source-review-b', 'source-b', 'search-2', 'd'),
    observation: 'PRIVATE OBSERVATION B',
    reliability: { authorityBps: 8000, proximityBps: 9000, corroborationBps: 7000, recencyBps: 9000, biasRiskBps: 1000 },
    relations: [
      { hypothesisId: 'deployment-change', stance: 'contradicts', strengthBps: 7000 },
      { hypothesisId: 'traffic-shift', stance: 'supports', strengthBps: 5000 },
    ],
    acquiredAt: '2026-07-11T10:12:00.000Z', idempotencyKey: 'evidence-b', now: '2026-07-11T10:13:00.000Z',
  });
  assert.equal(evidenceB.reliabilityScoreBps, 8400);
  const contradictions = investigationContradictionIds([evidenceA, evidenceB]);
  assert.equal(contradictions.length, 2);
  assert.ok(contradictions.every((row) => row.id.startsWith('investigation_contradiction_')));

  const verifyA = createLocalInvestigationCustodyEvent({
    caseRecord, evidence: evidenceA, eventType: 'verify', fromCustodianId: 'investigator', toCustodianId: 'investigator', actorId: 'analyst',
    occurredAt: '2026-07-11T10:20:00.000Z', idempotencyKey: 'verify-a',
  });
  const transferA = createLocalInvestigationCustodyEvent({
    caseRecord, evidence: evidenceA, previousEvent: verifyA, eventType: 'transfer', fromCustodianId: 'investigator', toCustodianId: 'reviewer', actorId: 'investigator',
    occurredAt: '2026-07-11T10:21:00.000Z', idempotencyKey: 'transfer-a',
  });
  const sealA = createLocalInvestigationCustodyEvent({
    caseRecord, evidence: evidenceA, previousEvent: transferA, eventType: 'seal', fromCustodianId: 'reviewer', toCustodianId: 'reviewer', actorId: 'reviewer',
    occurredAt: '2026-07-11T10:22:00.000Z', idempotencyKey: 'seal-a',
  });
  const sealB = createLocalInvestigationCustodyEvent({
    caseRecord, evidence: evidenceB, eventType: 'seal', fromCustodianId: 'investigator', toCustodianId: 'investigator', actorId: 'reviewer',
    occurredAt: '2026-07-11T10:22:00.000Z', idempotencyKey: 'seal-b',
  });
  assert.equal(verifyLocalInvestigationCustodyChain(evidenceA, [verifyA, transferA, sealA], caseRecord).valid, true);
  assert.equal(verifyLocalInvestigationCustodyChain(evidenceB, [sealB], caseRecord).valid, true);
  assert.throws(() => createLocalInvestigationCustodyEvent({
    caseRecord, evidence: evidenceA, previousEvent: sealA, eventType: 'verify', fromCustodianId: 'reviewer', toCustodianId: 'reviewer', actorId: 'analyst',
    occurredAt: '2026-07-11T10:23:00.000Z', idempotencyKey: 'after-seal',
  }), /custody-already-sealed/);
  assert.throws(() => createLocalInvestigationCustodyEvent({
    caseRecord, evidence: evidenceA, previousEvent: transferA, eventType: 'seal', fromCustodianId: 'investigator', toCustodianId: 'investigator', actorId: 'reviewer',
    occurredAt: '2026-07-11T10:20:30.000Z', idempotencyKey: 'stale-seal',
  }), /custody-current-custodian-invalid|custody-time-not-monotonic/);

  assert.throws(() => createLocalInvestigationConclusion({
    caseRecord, evidenceRecords: [evidenceA, evidenceB], custodyEvents: [verifyA, transferA, sealA, sealB], resolutions: [],
    selectedHypothesisId: 'deployment-change', analystId: 'analyst', idempotencyKey: 'premature-conclusion', now: '2026-07-11T10:30:00.000Z',
  }), /contradictions-unresolved/);
  const resolutions = contradictions.map((contradiction, index) => createLocalInvestigationContradictionResolution({
    caseRecord, contradiction, evidenceRecords: [evidenceA, evidenceB], reviewerId: 'reviewer',
    resolutionCode: index === 0 ? 'source-preferred' : 'scope-difference', rationale: `PRIVATE RESOLUTION ${index + 1}`,
    idempotencyKey: `resolution-${index + 1}`, now: `2026-07-11T10:2${4 + index}:00.000Z`,
  }));
  assert.throws(() => createLocalInvestigationContradictionResolution({
    caseRecord, contradiction: contradictions[0], evidenceRecords: [evidenceA, evidenceB], reviewerId: 'reviewer',
    resolutionCode: 'inconclusive', rationale: 'PRIVATE EARLY RESOLUTION', idempotencyKey: 'early-resolution', now: '2026-07-11T10:12:30.000Z',
  }), /resolution-before-evidence/);
  assert.ok(resolutions.every((row) => !JSON.stringify(row).includes('PRIVATE RESOLUTION')));
  assert.throws(() => createLocalInvestigationConclusion({
    caseRecord, evidenceRecords: [evidenceA, evidenceB], custodyEvents: [verifyA, transferA, sealA, sealB], resolutions,
    selectedHypothesisId: 'deployment-change', analystId: 'analyst', idempotencyKey: 'early-conclusion', now: '2026-07-11T10:23:00.000Z',
  }), /conclusion-before-dependencies/);
  const conclusion = createLocalInvestigationConclusion({
    caseRecord, evidenceRecords: [evidenceA, evidenceB], custodyEvents: [verifyA, transferA, sealA, sealB], resolutions,
    selectedHypothesisId: 'deployment-change', analystId: 'analyst', idempotencyKey: 'conclusion-1', now: '2026-07-11T10:30:00.000Z',
  });
  assert.equal(verifyLocalInvestigationConclusion(conclusion, caseRecord, [evidenceA, evidenceB], [verifyA, transferA, sealA, sealB], resolutions).valid, true);
  assert.equal(conclusion.selectedHypothesisId, 'deployment-change');
  assert.equal(conclusion.hypothesisRows.find((row) => row.hypothesisId === 'deployment-change').confidenceBps, 5562);
  assert.equal(conclusion.outcome, 'inconclusive');
  const closure = createLocalInvestigationClosure({
    caseRecord, conclusion, reviewerId: 'reviewer', decision: 'accepted', idempotencyKey: 'closure-1', now: '2026-07-11T10:31:00.000Z',
  });
  assert.throws(() => createLocalInvestigationClosure({
    caseRecord, conclusion, reviewerId: 'reviewer', decision: 'accepted', idempotencyKey: 'early-closure', now: '2026-07-11T10:29:00.000Z',
  }), /closure-before-conclusion/);
  assert.equal(verifyLocalInvestigationClosure(closure, caseRecord, conclusion).valid, true);
  assert.equal(closure.status, 'closed-inconclusive');
  assert.equal(closure.readyForProduction, false);

  const project = {
    id: caseRecord.projectId, workModeContract: { workMode: 'investigation' },
    localInvestigationCases: [caseRecord], localInvestigationEvidence: [evidenceA, evidenceB],
    localInvestigationCustodyEvents: [verifyA, transferA, sealA, sealB],
    localInvestigationContradictionResolutions: resolutions, localInvestigationConclusions: [conclusion], localInvestigationClosures: [closure],
  };
  const workflow = buildLocalInvestigationCaseWorkflow({ project, now: '2026-07-11T10:32:00.000Z' });
  assert.equal(workflow.status, 'closed-inconclusive');
  assert.equal(workflow.integrity.valid, true);
  assert.equal(workflow.readyForLocalCaseClosure, true);
  const degradedResolution = buildLocalInvestigationCaseWorkflow({
    project: { ...project, localInvestigationContradictionResolutions: [{ ...resolutions[0], resolutionCode: 'inconclusive' }, resolutions[1]] },
    now: '2026-07-11T10:32:00.000Z',
  });
  assert.equal(degradedResolution.status, 'degraded-integrity-invalid');
  const degraded = buildLocalInvestigationCaseWorkflow({
    project: { ...project, localInvestigationEvidence: [{ ...evidenceA, reliabilityScoreBps: 1 }, evidenceB] },
    now: '2026-07-11T10:32:00.000Z',
  });
  assert.equal(degraded.status, 'degraded-integrity-invalid');
  assert.equal(degraded.readyForLocalCaseClosure, false);
});
