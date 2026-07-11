import { portableSha256Hex } from './accessControl.js';

const HYPOTHESIS_TYPES = new Set(['primary', 'alternative', 'null']);
const RELATION_STANCES = new Set(['supports', 'contradicts', 'neutral']);
const CUSTODY_EVENT_TYPES = new Set(['verify', 'transfer', 'seal']);
const RESOLUTION_CODES = new Set(['source-preferred', 'scope-difference', 'temporal-change', 'inconclusive']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function checksum(value) {
  return portableSha256Hex(JSON.stringify(canonicalize(value)));
}

function receiptValid(receipt = {}, schemaVersion = '') {
  const { checksum: expected, ...base } = receipt;
  return receipt.schemaVersion === schemaVersion && Boolean(expected) && expected === checksum(base);
}

function id(value, field, optional = false) {
  const text = String(value || '').trim();
  if (!text && optional) return null;
  if (!text || text.length > 220 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(text)) throw new Error(`investigation-${field}-invalid`);
  return text;
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`investigation-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function bps(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 10_000) throw new Error(`investigation-${field}-invalid`);
  return number;
}

function memberIds(caseRecord = {}) {
  return new Set([caseRecord.leadId, caseRecord.investigatorId, caseRecord.analystId, caseRecord.reviewerId].filter(Boolean));
}

function normalizeHypotheses(input = []) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 24) throw new Error('investigation-competing-hypotheses-required');
  const rows = input.map((row) => {
    const statement = String(row.statement || '').trim();
    const falsification = String(row.falsificationCriteria || '').trim();
    const type = String(row.type || '').trim();
    if (!statement || statement.length > 20_000 || !falsification || falsification.length > 20_000) throw new Error('investigation-hypothesis-content-invalid');
    if (!HYPOTHESIS_TYPES.has(type)) throw new Error('investigation-hypothesis-type-invalid');
    return {
      id: id(row.id, 'hypothesis-id'),
      type,
      statementHash: portableSha256Hex(statement),
      statementLength: statement.length,
      falsificationCriteriaHash: portableSha256Hex(falsification),
      falsificationCriteriaLength: falsification.length,
      priorBps: bps(row.priorBps, 'hypothesis-prior-bps'),
    };
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('investigation-hypothesis-id-duplicate');
  if (!rows.some((row) => row.type === 'alternative' || row.type === 'null')) throw new Error('investigation-competing-hypotheses-required');
  return rows;
}

export function createLocalInvestigationCase({
  projectId, leadId, investigatorId, analystId, reviewerId, scope, hypotheses = [],
  version = 1, previousCaseId = null, previousCaseChecksum = null,
  actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  const roles = [leadId, investigatorId, analystId, reviewerId].map((value, index) => id(value, ['lead-id', 'investigator-id', 'analyst-id', 'reviewer-id'][index]));
  if (new Set(roles).size !== roles.length) throw new Error('investigation-independent-roles-required');
  const scopeText = String(scope || '').trim();
  if (!scopeText || scopeText.length > 20_000) throw new Error('investigation-scope-invalid');
  const normalizedVersion = Number(version);
  if (!Number.isInteger(normalizedVersion) || normalizedVersion < 1 || normalizedVersion > 10_000) throw new Error('investigation-case-version-invalid');
  const previousId = id(previousCaseId, 'previous-case-id', true);
  const previousChecksum = previousCaseChecksum ? String(previousCaseChecksum).toLowerCase() : null;
  if ((normalizedVersion === 1 && (previousId || previousChecksum))
    || (normalizedVersion > 1 && (!previousId || !/^[a-f0-9]{64}$/.test(previousChecksum || '')))) throw new Error('investigation-case-version-link-invalid');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const createdAt = iso(now, 'created-at');
  const base = {
    schemaVersion: 'local-investigation-case/v1',
    id: `investigation_case_${checksum(`${projectId}:${normalizedVersion}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: id(projectId, 'project-id'),
    leadId: roles[0], investigatorId: roles[1], analystId: roles[2], reviewerId: roles[3],
    scopeHash: portableSha256Hex(scopeText), scopeLength: scopeText.length,
    hypotheses: normalizeHypotheses(hypotheses),
    version: normalizedVersion,
    previousCaseId: previousId,
    previousCaseChecksum: previousChecksum,
    actorId: id(actorId, 'actor-id'),
    idempotencyKey: normalizedIdempotencyKey,
    status: 'active',
    storesRawContent: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalInvestigationCase(caseRecord = {}, previous = null) {
  const checksumValid = receiptValid(caseRecord, 'local-investigation-case/v1');
  const rolesValid = new Set([caseRecord.leadId, caseRecord.investigatorId, caseRecord.analystId, caseRecord.reviewerId]).size === 4;
  const hypothesesValid = Array.isArray(caseRecord.hypotheses) && caseRecord.hypotheses.length >= 2
    && caseRecord.hypotheses.some((row) => row.type === 'alternative' || row.type === 'null');
  const linkValid = caseRecord.version === 1
    ? !caseRecord.previousCaseId && !caseRecord.previousCaseChecksum
    : previous
      ? caseRecord.version === previous.version + 1 && caseRecord.previousCaseId === previous.id && caseRecord.previousCaseChecksum === previous.checksum
      : Boolean(caseRecord.previousCaseId && /^[a-f0-9]{64}$/.test(caseRecord.previousCaseChecksum || ''));
  return { valid: checksumValid && rolesValid && hypothesesValid && linkValid, checksumValid, rolesValid, hypothesesValid, linkValid };
}

function reliability(input = {}) {
  const normalized = {
    authorityBps: bps(input.authorityBps, 'reliability-authority-bps'),
    proximityBps: bps(input.proximityBps, 'reliability-proximity-bps'),
    corroborationBps: bps(input.corroborationBps, 'reliability-corroboration-bps'),
    recencyBps: bps(input.recencyBps, 'reliability-recency-bps'),
    biasRiskBps: bps(input.biasRiskBps, 'reliability-bias-risk-bps'),
  };
  const scoreBps = Math.floor((normalized.authorityBps + normalized.proximityBps + normalized.corroborationBps
    + normalized.recencyBps + (10_000 - normalized.biasRiskBps)) / 5);
  return { ...normalized, scoreBps };
}

function normalizeRelations(input = [], caseRecord = {}) {
  if (!Array.isArray(input) || !input.length) throw new Error('investigation-evidence-relations-required');
  const hypothesisIds = new Set((caseRecord.hypotheses || []).map((row) => row.id));
  const rows = input.map((row) => {
    const hypothesisId = id(row.hypothesisId, 'relation-hypothesis-id');
    const stance = String(row.stance || '').trim();
    if (!hypothesisIds.has(hypothesisId)) throw new Error('investigation-relation-hypothesis-unknown');
    if (!RELATION_STANCES.has(stance)) throw new Error('investigation-relation-stance-invalid');
    return { hypothesisId, stance, strengthBps: bps(row.strengthBps, 'relation-strength-bps') };
  });
  if (new Set(rows.map((row) => row.hypothesisId)).size !== rows.length || !rows.some((row) => row.stance !== 'neutral')) throw new Error('investigation-evidence-relations-invalid');
  return rows.sort((a, b) => a.hypothesisId.localeCompare(b.hypothesisId));
}

export function createLocalInvestigationEvidence({
  caseRecord, sourceSnapshot, sourceReview, collectorId, analystId, custodianId,
  observation, reliability: reliabilityInput, relations = [], acquiredAt, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!verifyLocalInvestigationCase(caseRecord).valid) throw new Error('investigation-case-integrity-invalid');
  if (!sourceSnapshot?.id || !sourceSnapshot?.checksum) throw new Error('investigation-source-snapshot-required');
  if (sourceReview?.decision !== 'approved' || sourceReview.reviewerAgentId !== caseRecord.reviewerId || !sourceReview.checksum) throw new Error('investigation-approved-source-review-required');
  if (String(sourceReview.sourceId) !== String(sourceSnapshot.sourceId)
    || String(sourceReview.evidenceSearchId) !== String(sourceSnapshot.evidenceSearchId)) throw new Error('investigation-snapshot-review-binding-invalid');
  if (collectorId !== caseRecord.investigatorId || analystId !== caseRecord.analystId || !memberIds(caseRecord).has(custodianId)) throw new Error('investigation-evidence-role-invalid');
  const observationText = String(observation || '').trim();
  if (!observationText || observationText.length > 20_000) throw new Error('investigation-observation-invalid');
  const acquired = iso(acquiredAt, 'acquired-at');
  const createdAt = iso(now, 'evidence-created-at');
  if (Date.parse(acquired) > Date.parse(createdAt)) throw new Error('investigation-acquired-at-future');
  const sourceReadyAt = Math.max(Date.parse(sourceSnapshot.capturedAt || 0), Date.parse(sourceReview.createdAt || 0));
  if (Number.isFinite(sourceReadyAt) && Date.parse(acquired) < sourceReadyAt) throw new Error('investigation-evidence-acquired-before-source-ready');
  const normalizedReliability = reliability(reliabilityInput);
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const evidenceId = `investigation_evidence_${checksum(`${caseRecord.id}:${sourceSnapshot.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`;
  const initialCustodyBase = {
    eventType: 'acquired', sequence: 0, evidenceId, custodianId: id(custodianId, 'custodian-id'),
    actorId: id(collectorId, 'collector-id'), occurredAt: acquired,
  };
  const initialCustody = { ...initialCustodyBase, checksum: checksum(initialCustodyBase) };
  const base = {
    schemaVersion: 'local-investigation-evidence/v1', id: evidenceId,
    projectId: caseRecord.projectId, caseId: caseRecord.id, caseChecksum: caseRecord.checksum,
    sourceSnapshotId: id(sourceSnapshot.id, 'source-snapshot-id'), sourceSnapshotChecksum: String(sourceSnapshot.checksum),
    sourceSnapshotEvidenceSearchId: id(sourceSnapshot.evidenceSearchId, 'source-snapshot-search-id'),
    sourceSnapshotSourceId: id(sourceSnapshot.sourceId, 'source-snapshot-source-id'),
    sourceReviewId: id(sourceReview.id, 'source-review-id'), sourceReviewChecksum: String(sourceReview.checksum),
    collectorId: caseRecord.investigatorId, analystId: caseRecord.analystId,
    observationHash: portableSha256Hex(observationText), observationLength: observationText.length,
    reliability: normalizedReliability, reliabilityScoreBps: normalizedReliability.scoreBps,
    relations: normalizeRelations(relations, caseRecord),
    initialCustody,
    idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false,
    acquiredAt: acquired,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalInvestigationEvidence(evidence = {}, caseRecord = {}) {
  const checksumValid = receiptValid(evidence, 'local-investigation-evidence/v1');
  const caseValid = evidence.caseId === caseRecord.id && evidence.caseChecksum === caseRecord.checksum;
  const roleValid = evidence.collectorId === caseRecord.investigatorId && evidence.analystId === caseRecord.analystId;
  const reliabilityValid = evidence.reliabilityScoreBps === reliability(evidence.reliability || {}).scoreBps;
  const initial = evidence.initialCustody || {};
  const { checksum: initialExpected, ...initialBase } = initial;
  const custodyValid = initial.sequence === 0 && initial.eventType === 'acquired' && initial.evidenceId === evidence.id && initialExpected === checksum(initialBase);
  return { valid: checksumValid && caseValid && roleValid && reliabilityValid && custodyValid, checksumValid, caseValid, roleValid, reliabilityValid, custodyValid };
}

export function createLocalInvestigationCustodyEvent({
  caseRecord, evidence, previousEvent = null, eventType, fromCustodianId, toCustodianId, actorId,
  occurredAt, idempotencyKey,
} = {}) {
  if (!verifyLocalInvestigationEvidence(evidence, caseRecord).valid) throw new Error('investigation-evidence-integrity-invalid');
  const type = String(eventType || '').trim();
  if (!CUSTODY_EVENT_TYPES.has(type)) throw new Error('investigation-custody-event-type-invalid');
  const sequence = previousEvent ? Number(previousEvent.sequence) + 1 : 1;
  if (previousEvent && (!receiptValid(previousEvent, 'local-investigation-custody-event/v1') || previousEvent.evidenceId !== evidence.id)) throw new Error('investigation-custody-previous-event-invalid');
  if (previousEvent?.eventType === 'seal') throw new Error('investigation-custody-already-sealed');
  const currentCustodianId = previousEvent?.toCustodianId || evidence.initialCustody.custodianId;
  if (fromCustodianId !== currentCustodianId) throw new Error('investigation-custody-current-custodian-invalid');
  if (!memberIds(caseRecord).has(toCustodianId) || !memberIds(caseRecord).has(actorId)) throw new Error('investigation-custody-actor-invalid');
  if (type === 'transfer' ? toCustodianId === fromCustodianId : toCustodianId !== fromCustodianId) throw new Error('investigation-custody-transition-invalid');
  if (type === 'seal' && actorId !== caseRecord.reviewerId) throw new Error('investigation-custody-independent-seal-required');
  const occurred = iso(occurredAt, 'custody-occurred-at');
  const previousOccurredAt = previousEvent?.occurredAt || evidence.acquiredAt;
  if (Date.parse(occurred) <= Date.parse(previousOccurredAt)) throw new Error('investigation-custody-time-not-monotonic');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-investigation-custody-event/v1',
    id: `investigation_custody_${checksum(`${evidence.id}:${sequence}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: caseRecord.projectId, caseId: caseRecord.id, caseChecksum: caseRecord.checksum,
    evidenceId: evidence.id, evidenceChecksum: evidence.checksum,
    eventType: type, sequence,
    previousCustodyEventId: previousEvent?.id || null,
    previousCustodyChecksum: previousEvent?.checksum || evidence.initialCustody.checksum,
    fromCustodianId: id(fromCustodianId, 'from-custodian-id'),
    toCustodianId: id(toCustodianId, 'to-custodian-id'),
    actorId: id(actorId, 'custody-actor-id'),
    idempotencyKey: normalizedIdempotencyKey,
    occurredAt: occurred,
    createdAt: occurred,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalInvestigationCustodyChain(evidence = {}, events = [], caseRecord = {}) {
  if (!verifyLocalInvestigationEvidence(evidence, caseRecord).valid) return { valid: false, sealed: false, eventRows: [] };
  const ordered = [...events].filter((row) => row.evidenceId === evidence.id).sort((a, b) => a.sequence - b.sequence);
  let previousId = null;
  let previousChecksum = evidence.initialCustody.checksum;
  let previousAt = evidence.acquiredAt;
  let custodianId = evidence.initialCustody.custodianId;
  const eventRows = ordered.map((row, index) => {
    const valid = receiptValid(row, 'local-investigation-custody-event/v1')
      && row.sequence === index + 1
      && row.previousCustodyEventId === previousId
      && row.previousCustodyChecksum === previousChecksum
      && row.fromCustodianId === custodianId
      && Date.parse(row.occurredAt) > Date.parse(previousAt);
    previousId = row.id;
    previousChecksum = row.checksum;
    previousAt = row.occurredAt;
    custodianId = row.toCustodianId;
    return { id: row.id, valid };
  });
  const sealed = ordered.at(-1)?.eventType === 'seal';
  return { valid: eventRows.every((row) => row.valid), sealed, currentCustodianId: custodianId, latestEventId: previousId, latestEventChecksum: previousChecksum, eventRows };
}

export function investigationContradictionIds(evidenceRecords = []) {
  const byHypothesis = new Map();
  for (const evidence of evidenceRecords) {
    for (const relation of evidence.relations || []) {
      if (relation.stance === 'neutral') continue;
      if (!byHypothesis.has(relation.hypothesisId)) byHypothesis.set(relation.hypothesisId, { supports: [], contradicts: [] });
      byHypothesis.get(relation.hypothesisId)[relation.stance].push(evidence);
    }
  }
  const rows = [];
  for (const [hypothesisId, groups] of byHypothesis) {
    for (const support of groups.supports) {
      for (const contradiction of groups.contradicts) {
        const evidenceIds = [support.id, contradiction.id].sort();
        rows.push({
          id: `investigation_contradiction_${checksum(`${hypothesisId}:${evidenceIds.join(':')}`).slice(0, 28)}`,
          hypothesisId,
          evidenceIds,
          evidenceChecksums: evidenceIds.map((evidenceId) => evidenceRecords.find((row) => row.id === evidenceId)?.checksum),
        });
      }
    }
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

export function createLocalInvestigationContradictionResolution({
  caseRecord, contradiction, evidenceRecords = [], reviewerId, resolutionCode, rationale,
  idempotencyKey, now = new Date().toISOString(),
} = {}) {
  const known = investigationContradictionIds(evidenceRecords).find((row) => row.id === contradiction?.id);
  if (!known || JSON.stringify(known.evidenceIds) !== JSON.stringify(contradiction.evidenceIds)) throw new Error('investigation-contradiction-invalid');
  if (reviewerId !== caseRecord.reviewerId) throw new Error('investigation-independent-contradiction-reviewer-required');
  const code = String(resolutionCode || '').trim();
  if (!RESOLUTION_CODES.has(code)) throw new Error('investigation-contradiction-resolution-code-invalid');
  const rationaleText = String(rationale || '').trim();
  if (!rationaleText || rationaleText.length > 20_000) throw new Error('investigation-resolution-rationale-invalid');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const createdAt = iso(now, 'resolution-created-at');
  const latestEvidenceAt = Math.max(...known.evidenceIds.map((evidenceId) => Date.parse(evidenceRecords.find((row) => row.id === evidenceId)?.createdAt || 0)));
  if (Date.parse(createdAt) <= latestEvidenceAt) throw new Error('investigation-resolution-before-evidence');
  const base = {
    schemaVersion: 'local-investigation-contradiction-resolution/v1',
    id: `investigation_resolution_${checksum(`${contradiction.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: caseRecord.projectId, caseId: caseRecord.id, caseChecksum: caseRecord.checksum,
    contradictionId: contradiction.id, hypothesisId: contradiction.hypothesisId,
    evidenceIds: [...contradiction.evidenceIds], evidenceChecksums: [...known.evidenceChecksums],
    reviewerId, resolutionCode: code,
    rationaleHash: portableSha256Hex(rationaleText), rationaleLength: rationaleText.length,
    idempotencyKey: normalizedIdempotencyKey, storesRawContent: false, createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

function verifyContradictionResolution(resolution = {}, caseRecord = {}, contradictions = []) {
  const checksumValid = receiptValid(resolution, 'local-investigation-contradiction-resolution/v1');
  const contradiction = contradictions.find((row) => row.id === resolution.contradictionId);
  const bindingValid = resolution.caseId === caseRecord.id && resolution.caseChecksum === caseRecord.checksum
    && Boolean(contradiction)
    && JSON.stringify(resolution.evidenceIds || []) === JSON.stringify(contradiction?.evidenceIds || [])
    && JSON.stringify(resolution.evidenceChecksums || []) === JSON.stringify(contradiction?.evidenceChecksums || []);
  const reviewerValid = resolution.reviewerId === caseRecord.reviewerId;
  return { valid: checksumValid && bindingValid && reviewerValid, checksumValid, bindingValid, reviewerValid };
}

function hypothesisRows(caseRecord, evidenceRecords) {
  return (caseRecord.hypotheses || []).map((hypothesis) => {
    let supportWeight = 0;
    let contradictionWeight = 0;
    const evidenceIds = [];
    for (const evidence of evidenceRecords) {
      const relation = (evidence.relations || []).find((row) => row.hypothesisId === hypothesis.id);
      if (!relation || relation.stance === 'neutral') continue;
      const weight = Math.floor(evidence.reliabilityScoreBps * relation.strengthBps / 10_000);
      if (relation.stance === 'supports') supportWeight += weight;
      if (relation.stance === 'contradicts') contradictionWeight += weight;
      evidenceIds.push(evidence.id);
    }
    const directionalWeight = supportWeight + contradictionWeight;
    const evidenceDerivedBps = directionalWeight ? Math.floor(supportWeight * 10_000 / directionalWeight) : 5_000;
    const confidenceBps = Math.floor((hypothesis.priorBps + evidenceDerivedBps) / 2);
    const status = confidenceBps >= 7_000 && supportWeight > contradictionWeight
      ? 'supported'
      : confidenceBps <= 3_000 && contradictionWeight > supportWeight
        ? 'refuted'
        : 'inconclusive';
    return { hypothesisId: hypothesis.id, priorBps: hypothesis.priorBps, supportWeight, contradictionWeight, evidenceDerivedBps, confidenceBps, status, evidenceIds: evidenceIds.sort() };
  });
}

export function createLocalInvestigationConclusion({
  caseRecord, evidenceRecords = [], custodyEvents = [], resolutions = [], selectedHypothesisId,
  analystId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (analystId !== caseRecord.analystId) throw new Error('investigation-conclusion-analyst-invalid');
  if (!evidenceRecords.length || evidenceRecords.some((row) => !verifyLocalInvestigationEvidence(row, caseRecord).valid)) throw new Error('investigation-conclusion-evidence-invalid');
  const selected = (caseRecord.hypotheses || []).find((row) => row.id === selectedHypothesisId);
  if (!selected) throw new Error('investigation-selected-hypothesis-invalid');
  const custodyHeads = evidenceRecords.map((evidence) => {
    const chain = verifyLocalInvestigationCustodyChain(evidence, custodyEvents, caseRecord);
    if (!chain.valid || !chain.sealed) throw new Error('investigation-evidence-not-sealed');
    return { evidenceId: evidence.id, latestEventId: chain.latestEventId, latestEventChecksum: chain.latestEventChecksum };
  }).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  const contradictions = investigationContradictionIds(evidenceRecords);
  const resolutionByContradiction = new Map(resolutions.map((row) => [row.contradictionId, row]));
  if (contradictions.some((row) => !resolutionByContradiction.has(row.id))) throw new Error('investigation-contradictions-unresolved');
  if (resolutions.some((row) => !verifyContradictionResolution(row, caseRecord, contradictions).valid)) throw new Error('investigation-resolution-integrity-invalid');
  const rows = hypothesisRows(caseRecord, evidenceRecords);
  const selectedRow = rows.find((row) => row.hypothesisId === selectedHypothesisId);
  if (!selectedRow.evidenceIds.length) throw new Error('investigation-selected-hypothesis-evidence-required');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const createdAt = iso(now, 'conclusion-created-at');
  const latestDependencyAt = Math.max(
    ...evidenceRecords.map((row) => Date.parse(row.createdAt || 0)),
    ...custodyEvents.map((row) => Date.parse(row.occurredAt || row.createdAt || 0)),
    ...resolutions.map((row) => Date.parse(row.createdAt || 0)),
  );
  if (Date.parse(createdAt) <= latestDependencyAt) throw new Error('investigation-conclusion-before-dependencies');
  const evidenceManifest = evidenceRecords.map((row) => ({ id: row.id, checksum: row.checksum })).sort((a, b) => a.id.localeCompare(b.id));
  const resolutionManifest = resolutions.map((row) => ({ id: row.id, contradictionId: row.contradictionId, checksum: row.checksum })).sort((a, b) => a.id.localeCompare(b.id));
  const base = {
    schemaVersion: 'local-investigation-conclusion/v1',
    id: `investigation_conclusion_${checksum(`${caseRecord.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: caseRecord.projectId, caseId: caseRecord.id, caseChecksum: caseRecord.checksum,
    selectedHypothesisId, analystId,
    hypothesisRows: rows,
    outcome: selectedRow.status,
    confidenceBps: selectedRow.confidenceBps,
    evidenceManifest, custodyHeads, contradictionIds: contradictions.map((row) => row.id), resolutionManifest,
    idempotencyKey: normalizedIdempotencyKey,
    readyForIndependentClosureReview: true,
    readyForProduction: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalInvestigationConclusion(conclusion = {}, caseRecord = {}, evidenceRecords = [], custodyEvents = [], resolutions = []) {
  const checksumValid = receiptValid(conclusion, 'local-investigation-conclusion/v1');
  const caseValid = conclusion.caseId === caseRecord.id && conclusion.caseChecksum === caseRecord.checksum;
  const evidenceManifest = evidenceRecords.map((row) => ({ id: row.id, checksum: row.checksum })).sort((a, b) => a.id.localeCompare(b.id));
  const evidenceValid = JSON.stringify(conclusion.evidenceManifest || []) === JSON.stringify(evidenceManifest)
    && evidenceRecords.every((row) => verifyLocalInvestigationEvidence(row, caseRecord).valid)
    && evidenceRecords.every((row) => {
      const chain = verifyLocalInvestigationCustodyChain(row, custodyEvents, caseRecord);
      return chain.valid && chain.sealed;
    });
  const resolutionManifest = resolutions.map((row) => ({ id: row.id, contradictionId: row.contradictionId, checksum: row.checksum })).sort((a, b) => a.id.localeCompare(b.id));
  const resolutionValid = JSON.stringify(conclusion.resolutionManifest || []) === JSON.stringify(resolutionManifest)
    && investigationContradictionIds(evidenceRecords).every((row) => resolutions.some((resolution) => resolution.contradictionId === row.id))
    && resolutions.every((row) => verifyContradictionResolution(row, caseRecord, investigationContradictionIds(evidenceRecords)).valid);
  return { valid: checksumValid && caseValid && evidenceValid && resolutionValid, checksumValid, caseValid, evidenceValid, resolutionValid };
}

export function createLocalInvestigationClosure({
  caseRecord, conclusion, reviewerId, decision, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (reviewerId !== caseRecord.reviewerId || reviewerId === conclusion.analystId) throw new Error('investigation-independent-closure-reviewer-required');
  if (decision !== 'accepted') throw new Error('investigation-closure-acceptance-required');
  if (!receiptValid(conclusion, 'local-investigation-conclusion/v1') || conclusion.caseId !== caseRecord.id) throw new Error('investigation-conclusion-integrity-invalid');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const createdAt = iso(now, 'closure-created-at');
  if (Date.parse(createdAt) <= Date.parse(conclusion.createdAt || 0)) throw new Error('investigation-closure-before-conclusion');
  const base = {
    schemaVersion: 'local-investigation-closure/v1',
    id: `investigation_closure_${checksum(`${conclusion.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: caseRecord.projectId, caseId: caseRecord.id, caseChecksum: caseRecord.checksum,
    conclusionId: conclusion.id, conclusionChecksum: conclusion.checksum,
    reviewerId, decision,
    status: conclusion.outcome === 'inconclusive' ? 'closed-inconclusive' : `closed-${conclusion.outcome}`,
    confidenceBps: conclusion.confidenceBps,
    idempotencyKey: normalizedIdempotencyKey,
    readyForLocalCaseClosure: true,
    readyForProduction: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalInvestigationClosure(closure = {}, caseRecord = {}, conclusion = {}) {
  const checksumValid = receiptValid(closure, 'local-investigation-closure/v1');
  const bindingValid = closure.caseId === caseRecord.id && closure.caseChecksum === caseRecord.checksum
    && closure.conclusionId === conclusion.id && closure.conclusionChecksum === conclusion.checksum;
  const reviewerValid = closure.reviewerId === caseRecord.reviewerId && closure.reviewerId !== conclusion.analystId && closure.decision === 'accepted';
  return { valid: checksumValid && bindingValid && reviewerValid, checksumValid, bindingValid, reviewerValid };
}

export function buildLocalInvestigationCaseWorkflow({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = iso(now, 'generated-at');
  const backendRoutes = {
    investigationCase: project.id ? `/projects/${project.id}/investigation-case` : null,
    cases: project.id ? `/projects/${project.id}/investigation-case/cases` : null,
    evidence: project.id ? `/projects/${project.id}/investigation-case/evidence` : null,
    conclusions: project.id ? `/projects/${project.id}/investigation-case/conclusions` : null,
    closures: project.id ? `/projects/${project.id}/investigation-case/closures` : null,
  };
  const empty = (status) => ({
    schemaVersion: 'local-investigation-case-workflow/v1', projectId: project.id || null, generatedAt, status,
    caseRecord: null, conclusion: null, closure: null, contradictions: [], unresolvedContradictions: [],
    summary: { caseVersionCount: 0, evidenceCount: 0, custodyEventCount: 0, contradictionCount: 0, resolutionCount: 0 },
    integrity: { valid: true, caseRows: [], evidenceRows: [], custodyRows: [], resolutionRows: [], conclusionRows: [], closureRows: [] },
    backendRoutes, readyForLocalCaseClosure: false, readyForProduction: false,
  });
  if (project.workModeContract?.workMode !== 'investigation') return empty('investigation-work-mode-required');
  const cases = [...(project.localInvestigationCases || [])].sort((a, b) => a.version - b.version);
  if (!cases.length) return empty('case-required');
  const caseRows = cases.map((row, index) => ({ id: row.id, ...verifyLocalInvestigationCase(row, index ? cases[index - 1] : null) }));
  const caseRecord = cases.at(-1);
  const evidenceRecords = (project.localInvestigationEvidence || []).filter((row) => row.caseId === caseRecord.id);
  const sourceSnapshots = project.evidenceSourceSnapshots || (project.evidenceSearches || []).flatMap((row) => row.sourceSnapshots || []);
  const sourceReviews = project.evidenceSourceReviews || [];
  const requireExternalBinding = sourceSnapshots.length > 0 || sourceReviews.length > 0;
  const evidenceRows = evidenceRecords.map((row) => {
    const verification = verifyLocalInvestigationEvidence(row, caseRecord);
    const snapshot = sourceSnapshots.find((item) => item.id === row.sourceSnapshotId);
    const review = sourceReviews.find((item) => item.id === row.sourceReviewId);
    const externalBindingValid = !requireExternalBinding || Boolean(
      snapshot?.checksum === row.sourceSnapshotChecksum
      && review?.checksum === row.sourceReviewChecksum
      && review?.decision === 'approved'
      && review?.reviewerAgentId === caseRecord.reviewerId
    );
    return { id: row.id, ...verification, externalBindingValid, valid: verification.valid && externalBindingValid };
  });
  const custodyEvents = (project.localInvestigationCustodyEvents || []).filter((row) => row.caseId === caseRecord.id);
  const custodyRows = evidenceRecords.map((row) => ({ evidenceId: row.id, ...verifyLocalInvestigationCustodyChain(row, custodyEvents, caseRecord) }));
  const contradictions = investigationContradictionIds(evidenceRecords);
  const resolutions = (project.localInvestigationContradictionResolutions || []).filter((row) => row.caseId === caseRecord.id);
  const resolutionRows = resolutions.map((row) => ({ id: row.id, ...verifyContradictionResolution(row, caseRecord, contradictions) }));
  const unresolvedContradictions = contradictions.filter((row) => !resolutions.some((resolution) => resolution.contradictionId === row.id && verifyContradictionResolution(resolution, caseRecord, contradictions).valid));
  const conclusions = (project.localInvestigationConclusions || []).filter((row) => row.caseId === caseRecord.id);
  const conclusionRows = conclusions.map((row) => ({ id: row.id, ...verifyLocalInvestigationConclusion(row, caseRecord, evidenceRecords, custodyEvents, resolutions) }));
  const conclusion = conclusions[0] || null;
  const closures = (project.localInvestigationClosures || []).filter((row) => row.caseId === caseRecord.id);
  const closureRows = closures.map((row) => ({ id: row.id, ...verifyLocalInvestigationClosure(row, caseRecord, conclusions.find((item) => item.id === row.conclusionId) || {}) }));
  const closure = closures[0] || null;
  const integrityValid = [...caseRows, ...evidenceRows, ...custodyRows, ...resolutionRows, ...conclusionRows, ...closureRows].every((row) => row.valid);
  const status = !integrityValid
    ? 'degraded-integrity-invalid'
    : closure
      ? closure.status
      : conclusion
        ? 'conclusion-recorded'
        : unresolvedContradictions.length
          ? 'contradictions-open'
          : evidenceRecords.length
            ? 'evidence-collection'
            : 'evidence-required';
  return {
    schemaVersion: 'local-investigation-case-workflow/v1', projectId: project.id, generatedAt, status,
    caseRecord, conclusion, closure, contradictions, unresolvedContradictions,
    summary: {
      caseVersionCount: cases.length, hypothesisCount: caseRecord.hypotheses.length, evidenceCount: evidenceRecords.length,
      custodyEventCount: custodyEvents.length, sealedEvidenceCount: custodyRows.filter((row) => row.sealed).length,
      contradictionCount: contradictions.length, unresolvedContradictionCount: unresolvedContradictions.length,
      resolutionCount: resolutions.length, conclusionCount: conclusions.length, closureCount: closures.length,
    },
    integrity: { valid: integrityValid, caseRows, evidenceRows, custodyRows, resolutionRows, conclusionRows, closureRows },
    backendRoutes,
    readyForLocalCaseClosure: Boolean(integrityValid && closure?.readyForLocalCaseClosure),
    readyForProduction: false,
  };
}
