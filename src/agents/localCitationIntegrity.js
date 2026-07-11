import { portableSha256Hex } from './accessControl.js';

const STANCES = new Set(['supports', 'contradicts', 'irrelevant', 'uncertain']);
const SOURCE_STATUSES = new Set(['active', 'corrected', 'retracted', 'unavailable']);
const DAY_MS = 86_400_000;

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
  if (!text || text.length > 220 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(text)) throw new Error(`citation-integrity-${field}-invalid`);
  return text;
}

function iso(value, field, optional = false) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`citation-integrity-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function boundedInteger(value, field, min, max, fallback) {
  const number = value === undefined || value === null ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`citation-integrity-${field}-invalid`);
  return number;
}

function citationLocator(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const valid = /^pp?\.\s?\d+(?:[-–]\d+)?$/i.test(text)
    || /^(?:section|figure|table|paragraph):[a-z0-9._-]+$/i.test(text)
    || /^timestamp:\d{1,2}:\d{2}(?::\d{2})?$/.test(text);
  if (!valid) throw new Error('citation-integrity-locator-invalid');
  return text;
}

function pairKey(claimId, sourceEvidenceId) {
  return `${claimId}\u0000${sourceEvidenceId}`;
}

function requiredPairs(blueprint = {}) {
  return (blueprint.claims || []).flatMap((claim) => (claim.sourceEvidenceIds || []).map((sourceEvidenceId) => ({
    claimId: String(claim.id), sourceEvidenceId: String(sourceEvidenceId), key: pairKey(String(claim.id), String(sourceEvidenceId)),
  })));
}

function sourceSnapshotBindingValid(sourceEvidenceId, snapshot = {}) {
  return String(snapshot.id || '') === String(sourceEvidenceId)
    || String(snapshot.evidenceSearchId || '') === String(sourceEvidenceId);
}

export function createLocalCitationAssessment({
  blueprint, claimId, sourceEvidenceId, sourceSnapshot, assessorId, stance, sourceStatus,
  publishedAt, statusCheckedAt, evidenceExcerpt = '', locator = '', rationale = '',
  version = 1, previousAssessmentId = null, previousAssessmentChecksum = null,
  idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!blueprint?.id || !blueprint?.checksum) throw new Error('citation-integrity-blueprint-required');
  const normalizedClaimId = id(claimId, 'claim-id');
  const normalizedSourceEvidenceId = id(sourceEvidenceId, 'source-evidence-id');
  const claim = (blueprint.claims || []).find((row) => row.id === normalizedClaimId);
  if (!claim || !(claim.sourceEvidenceIds || []).includes(normalizedSourceEvidenceId)) throw new Error('citation-integrity-claim-source-pair-invalid');
  if (!sourceSnapshot?.id || !sourceSnapshot?.checksum || !sourceSnapshotBindingValid(normalizedSourceEvidenceId, sourceSnapshot)) throw new Error('citation-integrity-source-snapshot-binding-invalid');
  const normalizedAssessorId = id(assessorId, 'assessor-id');
  if (normalizedAssessorId !== blueprint.reviewerId || normalizedAssessorId === blueprint.authorId) throw new Error('citation-integrity-independent-assessor-required');
  const normalizedStance = String(stance || '').trim();
  const normalizedSourceStatus = String(sourceStatus || '').trim();
  if (!STANCES.has(normalizedStance)) throw new Error('citation-integrity-stance-invalid');
  if (!SOURCE_STATUSES.has(normalizedSourceStatus)) throw new Error('citation-integrity-source-status-invalid');
  const excerpt = String(evidenceExcerpt || '').trim();
  if (['supports', 'contradicts'].includes(normalizedStance) && !excerpt) throw new Error('citation-integrity-evidence-excerpt-required');
  if (excerpt.length > 20_000) throw new Error('citation-integrity-evidence-excerpt-invalid');
  const rationaleText = String(rationale || '').trim();
  if (rationaleText.length > 20_000) throw new Error('citation-integrity-rationale-invalid');
  const normalizedVersion = boundedInteger(version, 'assessment-version', 1, 10_000, 1);
  const previousId = id(previousAssessmentId, 'previous-assessment-id', true);
  const previousChecksum = previousAssessmentChecksum ? String(previousAssessmentChecksum).toLowerCase() : null;
  if ((normalizedVersion === 1 && (previousId || previousChecksum))
    || (normalizedVersion > 1 && (!previousId || !/^[a-f0-9]{64}$/.test(previousChecksum || '')))) throw new Error('citation-integrity-assessment-link-invalid');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const createdAt = iso(now, 'created-at');
  const normalizedPublishedAt = iso(publishedAt, 'published-at');
  const normalizedStatusCheckedAt = iso(statusCheckedAt, 'status-checked-at');
  if (Date.parse(normalizedPublishedAt) > Date.parse(createdAt)) throw new Error('citation-integrity-published-at-future');
  if (Date.parse(normalizedStatusCheckedAt) > Date.parse(createdAt)) throw new Error('citation-integrity-status-checked-at-future');
  if (Date.parse(normalizedStatusCheckedAt) < Date.parse(normalizedPublishedAt)) throw new Error('citation-integrity-status-check-before-publication');
  const base = {
    schemaVersion: 'local-citation-assessment/v1',
    id: `citation_assessment_${checksum(`${blueprint.id}:${normalizedClaimId}:${normalizedSourceEvidenceId}:${normalizedVersion}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: id(blueprint.projectId, 'project-id'),
    blueprintId: id(blueprint.id, 'blueprint-id'),
    blueprintVersion: blueprint.version,
    blueprintChecksum: String(blueprint.checksum),
    claimId: normalizedClaimId,
    sourceEvidenceId: normalizedSourceEvidenceId,
    sourceSnapshotId: id(sourceSnapshot.id, 'source-snapshot-id'),
    sourceSnapshotChecksum: String(sourceSnapshot.checksum),
    sourceSnapshotEvidenceSearchId: id(sourceSnapshot.evidenceSearchId, 'source-snapshot-search-id', true),
    assessorId: normalizedAssessorId,
    stance: normalizedStance,
    sourceStatus: normalizedSourceStatus,
    publishedAt: normalizedPublishedAt,
    statusCheckedAt: normalizedStatusCheckedAt,
    evidenceExcerptHash: excerpt ? portableSha256Hex(excerpt) : null,
    evidenceExcerptLength: excerpt.length,
    locator: citationLocator(locator),
    rationaleHash: rationaleText ? portableSha256Hex(rationaleText) : null,
    rationaleLength: rationaleText.length,
    version: normalizedVersion,
    previousAssessmentId: previousId,
    previousAssessmentChecksum: previousChecksum,
    idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalCitationAssessment(assessment = {}, blueprint = {}, previous = null) {
  const checksumValid = receiptValid(assessment, 'local-citation-assessment/v1');
  const claim = (blueprint.claims || []).find((row) => row.id === assessment.claimId);
  const pairValid = Boolean(claim && (claim.sourceEvidenceIds || []).includes(assessment.sourceEvidenceId));
  const blueprintValid = assessment.blueprintId === blueprint.id && assessment.blueprintChecksum === blueprint.checksum;
  const assessorValid = assessment.assessorId === blueprint.reviewerId && assessment.assessorId !== blueprint.authorId;
  const linkValid = assessment.version === 1
    ? !assessment.previousAssessmentId && !assessment.previousAssessmentChecksum
    : previous
      ? assessment.version === previous.version + 1
        && assessment.previousAssessmentId === previous.id && assessment.previousAssessmentChecksum === previous.checksum
      : Boolean(assessment.previousAssessmentId && /^[a-f0-9]{64}$/.test(assessment.previousAssessmentChecksum || ''));
  return { valid: checksumValid && pairValid && blueprintValid && assessorValid && linkValid, checksumValid, pairValid, blueprintValid, assessorValid, linkValid };
}

function finding(code, claimId, sourceEvidenceId = null) {
  return {
    id: `citation_finding_${checksum(`${code}:${claimId}:${sourceEvidenceId || ''}`).slice(0, 28)}`,
    code,
    claimId,
    sourceEvidenceId,
    severity: 'blocking',
  };
}

function auditPolicy(input = {}) {
  return {
    maxPublicationAgeDays: boundedInteger(input.maxPublicationAgeDays, 'max-publication-age-days', 30, 36_500, 730),
    maxStatusCheckAgeDays: boundedInteger(input.maxStatusCheckAgeDays, 'max-status-check-age-days', 1, 365, 30),
  };
}

function deriveFindings({ blueprint, assessments, policy, now }) {
  const timestamp = Date.parse(now);
  const byPair = new Map(assessments.map((row) => [pairKey(row.claimId, row.sourceEvidenceId), row]));
  const findings = [];
  for (const pair of requiredPairs(blueprint)) {
    const row = byPair.get(pair.key);
    if (!row) {
      findings.push(finding('citation-assessment-missing', pair.claimId, pair.sourceEvidenceId));
      continue;
    }
    if (row.stance === 'contradicts') findings.push(finding('citation-contradicts-claim', pair.claimId, pair.sourceEvidenceId));
    if (row.stance === 'irrelevant') findings.push(finding('citation-irrelevant', pair.claimId, pair.sourceEvidenceId));
    if (row.stance === 'uncertain') findings.push(finding('citation-support-uncertain', pair.claimId, pair.sourceEvidenceId));
    if (row.sourceStatus !== 'active') findings.push(finding(`source-${row.sourceStatus}`, pair.claimId, pair.sourceEvidenceId));
    if (timestamp - Date.parse(row.publishedAt) > policy.maxPublicationAgeDays * DAY_MS) findings.push(finding('source-publication-stale', pair.claimId, pair.sourceEvidenceId));
    if (timestamp - Date.parse(row.statusCheckedAt) > policy.maxStatusCheckAgeDays * DAY_MS) findings.push(finding('source-status-check-stale', pair.claimId, pair.sourceEvidenceId));
  }
  for (const claim of blueprint.claims || []) {
    const rows = (claim.sourceEvidenceIds || []).map((sourceEvidenceId) => byPair.get(pairKey(claim.id, sourceEvidenceId))).filter(Boolean);
    if (!rows.some((row) => row.stance === 'supports' && row.sourceStatus === 'active')) findings.push(finding('claim-unsupported', claim.id));
  }
  return findings.sort((a, b) => `${a.claimId}:${a.sourceEvidenceId || ''}:${a.code}`.localeCompare(`${b.claimId}:${b.sourceEvidenceId || ''}:${b.code}`));
}

export function createLocalCitationIntegrityAudit({
  blueprint, finalization, assessments = [], policy: policyInput = {}, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!blueprint?.id || !blueprint?.checksum) throw new Error('citation-integrity-blueprint-required');
  if (!finalization?.id || !finalization?.checksum || finalization.blueprintId !== blueprint.id
    || finalization.blueprintChecksum !== blueprint.checksum || finalization.readyForCitationIntegrityAudit !== true) throw new Error('citation-integrity-finalization-required');
  const rows = Array.isArray(assessments) ? assessments : [];
  const keys = new Set();
  for (const row of rows) {
    if (!verifyLocalCitationAssessment(row, blueprint).valid) throw new Error('citation-integrity-assessment-integrity-invalid');
    const key = pairKey(row.claimId, row.sourceEvidenceId);
    if (keys.has(key)) throw new Error('citation-integrity-assessment-pair-duplicate');
    keys.add(key);
  }
  const policy = auditPolicy(policyInput);
  const createdAt = iso(now, 'audit-created-at');
  const findings = deriveFindings({ blueprint, assessments: rows, policy, now: createdAt });
  const supportedClaimCount = (blueprint.claims || []).filter((claim) => rows.some((row) => row.claimId === claim.id && row.stance === 'supports' && row.sourceStatus === 'active')).length;
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const manifest = rows.map((row) => ({ id: row.id, claimId: row.claimId, sourceEvidenceId: row.sourceEvidenceId, checksum: row.checksum })).sort((a, b) => a.id.localeCompare(b.id));
  const base = {
    schemaVersion: 'local-citation-integrity-audit/v1',
    id: `citation_audit_${checksum(`${finalization.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: id(blueprint.projectId, 'project-id'),
    blueprintId: blueprint.id,
    blueprintChecksum: blueprint.checksum,
    finalizationId: id(finalization.id, 'finalization-id'),
    finalizationChecksum: String(finalization.checksum),
    policy,
    assessmentManifest: manifest,
    findings,
    summary: {
      claimCount: (blueprint.claims || []).length,
      requiredCitationCount: requiredPairs(blueprint).length,
      assessedCitationCount: rows.length,
      supportedClaimCount,
      blockingFindingCount: findings.length,
    },
    status: findings.length ? 'blocked' : 'passed',
    readyForLocalCitationIntegrity: findings.length === 0,
    readyForProduction: false,
    idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalCitationIntegrityAudit(audit = {}, blueprint = {}, finalization = {}, assessments = []) {
  const checksumValid = receiptValid(audit, 'local-citation-integrity-audit/v1');
  const bindingValid = audit.blueprintId === blueprint.id && audit.blueprintChecksum === blueprint.checksum
    && audit.finalizationId === finalization.id && audit.finalizationChecksum === finalization.checksum;
  const expectedManifest = (Array.isArray(assessments) ? assessments : [])
    .map((row) => ({ id: row.id, claimId: row.claimId, sourceEvidenceId: row.sourceEvidenceId, checksum: row.checksum })).sort((a, b) => a.id.localeCompare(b.id));
  const manifestValid = JSON.stringify(audit.assessmentManifest || []) === JSON.stringify(expectedManifest);
  const assessmentIntegrityValid = (assessments || []).every((row) => verifyLocalCitationAssessment(row, blueprint).valid);
  return { valid: checksumValid && bindingValid && manifestValid && assessmentIntegrityValid, checksumValid, bindingValid, manifestValid, assessmentIntegrityValid };
}

export function buildLocalCitationIntegrity({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = iso(now, 'generated-at');
  const backendRoutes = {
    citationIntegrity: project.id ? `/projects/${project.id}/citation-integrity` : null,
    assessments: project.id ? `/projects/${project.id}/citation-integrity/assessments` : null,
    audits: project.id ? `/projects/${project.id}/citation-integrity/audits` : null,
  };
  const empty = (status) => ({
    schemaVersion: 'local-citation-integrity/v1', projectId: project.id || null, generatedAt, status,
    latestAudit: null, findings: [], summary: { assessmentCount: 0, auditCount: 0 },
    backendRoutes, integrity: { valid: true, assessmentRows: [], auditRows: [] },
    readyForLocalCitationIntegrity: false, readyForProduction: false,
  });
  if (project.workModeContract?.workMode !== 'academic-writing') return empty('academic-writing-work-mode-required');
  const blueprint = [...(project.localAcademicWritingBlueprints || [])].sort((a, b) => b.version - a.version)[0];
  if (!blueprint) return empty('blueprint-required');
  const finalization = (project.localAcademicFinalizations || [])[0];
  if (!finalization) return empty('finalization-required');
  const allAssessments = project.localCitationAssessments || [];
  const sourceSnapshots = project.evidenceSourceSnapshots || (project.evidenceSearches || []).flatMap((row) => row.sourceSnapshots || []);
  const sourceSnapshotById = new Map(sourceSnapshots.map((row) => [row.id, row]));
  const byPair = new Map();
  [...allAssessments].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).forEach((row) => byPair.set(pairKey(row.claimId, row.sourceEvidenceId), row));
  const assessments = [...byPair.values()];
  const historyByPair = new Map();
  const assessmentRows = [...allAssessments]
    .sort((a, b) => a.version - b.version)
    .map((row) => {
      const key = pairKey(row.claimId, row.sourceEvidenceId);
      const previous = historyByPair.get(key) || null;
      const verification = verifyLocalCitationAssessment(row, blueprint, previous);
      const snapshot = sourceSnapshotById.get(row.sourceSnapshotId);
      const snapshotBindingValid = Boolean(snapshot && snapshot.checksum === row.sourceSnapshotChecksum
        && sourceSnapshotBindingValid(row.sourceEvidenceId, snapshot));
      const result = { id: row.id, ...verification, snapshotBindingValid, valid: verification.valid && snapshotBindingValid };
      historyByPair.set(key, row);
      return result;
    });
  const audits = [...(project.localCitationIntegrityAudits || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const assessmentById = new Map(allAssessments.map((row) => [row.id, row]));
  const auditRows = audits.map((audit) => ({
    id: audit.id,
    ...verifyLocalCitationIntegrityAudit(audit, blueprint, finalization, (audit.assessmentManifest || []).map((row) => assessmentById.get(row.id)).filter(Boolean)),
  }));
  const integrityValid = [...assessmentRows, ...auditRows].every((row) => row.valid);
  const latestAudit = audits[0] || null;
  return {
    schemaVersion: 'local-citation-integrity/v1',
    projectId: project.id,
    generatedAt,
    status: !integrityValid ? 'degraded-integrity-invalid' : latestAudit ? latestAudit.status : assessments.length ? 'audit-required' : 'assessments-required',
    blueprintId: blueprint.id,
    finalizationId: finalization.id,
    latestAudit,
    findings: latestAudit?.findings || [],
    summary: { assessmentCount: allAssessments.length, currentAssessmentCount: assessments.length, auditCount: audits.length, ...(latestAudit?.summary || {}) },
    backendRoutes,
    integrity: { valid: integrityValid, assessmentRows, auditRows },
    readyForLocalCitationIntegrity: Boolean(integrityValid && latestAudit?.readyForLocalCitationIntegrity),
    readyForProduction: false,
  };
}
