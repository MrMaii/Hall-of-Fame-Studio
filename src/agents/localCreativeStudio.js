import { portableSha256Hex } from './accessControl.js';

const MEDIA_FORMATS = Object.freeze({
  image: new Set(['png', 'jpeg', 'svg']),
  video: new Set(['mp4', 'webm']),
  audio: new Set(['wav', 'mp3']),
  document: new Set(['pdf']),
});
const COLOR_SPACES = new Set(['srgb', 'display-p3', 'cmyk']);

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

function identifier(value, field, optional = false) {
  const normalized = String(value || '').trim();
  if (!normalized && optional) return null;
  if (!normalized || normalized.length > 240 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(normalized)) throw new Error(`creative-studio-${field}-invalid`);
  return normalized;
}

function narrative(value, field, max = 10_000) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max) throw new Error(`creative-studio-${field}-invalid`);
  return { hash: portableSha256Hex(normalized), length: normalized.length };
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`creative-studio-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function integer(value, field, min, max) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < min || normalized > max) throw new Error(`creative-studio-${field}-invalid`);
  return normalized;
}

function uniqueIds(values, field, { allowEmpty = false, max = 100 } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && !values.length) || values.length > max) throw new Error(`creative-studio-${field}-invalid`);
  const normalized = values.map((value) => identifier(value, field)).sort();
  if (new Set(normalized).size !== normalized.length) throw new Error(`creative-studio-${field}-duplicate`);
  return normalized;
}

function normalizeNarrativeRows(rows, field) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) throw new Error(`creative-studio-${field}-invalid`);
  const normalized = rows.map((row) => {
    const content = narrative(row?.text, `${field}-text`);
    return { id: identifier(row?.id, `${field}-id`), [`${field}Hash`]: content.hash, [`${field}Length`]: content.length };
  }).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(normalized.map((row) => row.id)).size !== normalized.length) throw new Error(`creative-studio-${field}-duplicate`);
  return normalized;
}

function normalizeAudienceSegments(rows, knownEvidenceIds) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 50) throw new Error('creative-studio-audience-segments-invalid');
  const normalized = rows.map((row) => {
    const description = narrative(row?.description, 'audience-description');
    const evidenceIds = uniqueIds(row?.evidenceIds, 'audience-evidence-id');
    if (evidenceIds.some((evidenceId) => !knownEvidenceIds.has(evidenceId))) throw new Error('creative-studio-audience-evidence-invalid');
    return {
      id: identifier(row?.id, 'audience-id'),
      descriptionHash: description.hash,
      descriptionLength: description.length,
      evidenceIds,
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(normalized.map((row) => row.id)).size !== normalized.length) throw new Error('creative-studio-audience-id-duplicate');
  return normalized;
}

function normalizeDeliverables(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) throw new Error('creative-studio-deliverables-invalid');
  const normalized = rows.map((row) => {
    const mediaType = String(row?.mediaType || '').trim();
    const format = String(row?.format || '').trim();
    if (!MEDIA_FORMATS[mediaType] || !MEDIA_FORMATS[mediaType].has(format)) throw new Error('creative-studio-deliverable-format-invalid');
    const needsDimensions = ['image', 'video'].includes(mediaType);
    const needsDuration = ['video', 'audio'].includes(mediaType);
    const width = needsDimensions ? integer(row.width, 'deliverable-width', 1, 100_000) : null;
    const height = needsDimensions ? integer(row.height, 'deliverable-height', 1, 100_000) : null;
    if (!needsDimensions && (row.width != null || row.height != null)) throw new Error('creative-studio-deliverable-dimensions-invalid');
    const durationMs = needsDuration ? integer(row.durationMs, 'deliverable-duration', 1, 86_400_000) : null;
    if (!needsDuration && row.durationMs != null) throw new Error('creative-studio-deliverable-duration-invalid');
    const colorSpace = mediaType === 'audio' ? null : String(row.colorSpace || '').trim();
    if (mediaType !== 'audio' && !COLOR_SPACES.has(colorSpace)) throw new Error('creative-studio-deliverable-color-space-invalid');
    return {
      id: identifier(row?.id, 'deliverable-id'),
      mediaType,
      format,
      width,
      height,
      durationMs,
      colorSpace,
      maxBytes: integer(row.maxBytes, 'deliverable-max-bytes', 1, 2_000_000_000),
      accessibilityRequired: row.accessibilityRequired === true,
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(normalized.map((row) => row.id)).size !== normalized.length) throw new Error('creative-studio-deliverable-id-duplicate');
  return normalized;
}

export function createLocalCreativeBrief({
  projectId, creativeLeadId, artDirectorId, audienceResearcherId, rightsReviewerId,
  creativeDirection, audienceSegments, deliverables, constraints, successCriteria, knownEvidenceIds = [],
  version = 1, previousBriefId = null, previousBriefChecksum = null, actorId, idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  const roles = [creativeLeadId, artDirectorId, audienceResearcherId, rightsReviewerId].map((value, index) => identifier(value, ['creative-lead-id', 'art-director-id', 'audience-researcher-id', 'rights-reviewer-id'][index]));
  if (new Set(roles).size !== roles.length) throw new Error('creative-studio-role-separation-required');
  const normalizedActor = identifier(actorId, 'actor-id');
  if (normalizedActor !== roles[0]) throw new Error('creative-studio-creative-lead-required');
  const direction = narrative(creativeDirection, 'creative-direction');
  const evidenceSet = new Set(uniqueIds(knownEvidenceIds, 'known-evidence-id'));
  const normalizedAudienceSegments = normalizeAudienceSegments(audienceSegments, evidenceSet);
  const usedEvidenceIds = [...new Set(normalizedAudienceSegments.flatMap((row) => row.evidenceIds))].sort();
  const normalizedVersion = integer(version, 'brief-version', 1, 10_000);
  const previousId = identifier(previousBriefId, 'previous-brief-id', true);
  const previousChecksum = previousBriefChecksum ? String(previousBriefChecksum).trim().toLowerCase() : null;
  if ((normalizedVersion === 1 && (previousId || previousChecksum))
    || (normalizedVersion > 1 && (!previousId || !/^[a-f0-9]{64}$/.test(previousChecksum || '')))) throw new Error('creative-studio-brief-link-invalid');
  const normalizedProjectId = identifier(projectId, 'project-id');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-creative-brief/v1',
    id: `creative_brief_${checksum(`${normalizedProjectId}:${normalizedVersion}:${normalizedKey}`).slice(0, 28)}`,
    projectId: normalizedProjectId,
    creativeLeadId: roles[0],
    artDirectorId: roles[1],
    audienceResearcherId: roles[2],
    rightsReviewerId: roles[3],
    creativeDirectionHash: direction.hash,
    creativeDirectionLength: direction.length,
    audienceSegments: normalizedAudienceSegments,
    deliverables: normalizeDeliverables(deliverables),
    constraints: normalizeNarrativeRows(constraints, 'constraint'),
    successCriteria: normalizeNarrativeRows(successCriteria, 'successCriterion'),
    knownEvidenceIds: usedEvidenceIds,
    version: normalizedVersion,
    previousBriefId: previousId,
    previousBriefChecksum: previousChecksum,
    actorId: normalizedActor,
    idempotencyKey: normalizedKey,
    storesRawNarrative: false,
    status: 'ready-for-iteration',
    createdAt: iso(now, 'brief-created-at'),
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalCreativeBrief(brief = {}, previous = null) {
  const checksumValid = receiptValid(brief, 'local-creative-brief/v1');
  const linkValid = brief.version === 1
    ? !brief.previousBriefId && !brief.previousBriefChecksum
    : Boolean(previous && brief.version === previous.version + 1 && brief.previousBriefId === previous.id && brief.previousBriefChecksum === previous.checksum
      && Date.parse(brief.createdAt) > Date.parse(previous.createdAt));
  const roles = [brief.creativeLeadId, brief.artDirectorId, brief.audienceResearcherId, brief.rightsReviewerId];
  const roleValid = roles.every(Boolean) && new Set(roles).size === 4 && brief.actorId === brief.creativeLeadId;
  const knownEvidenceIds = new Set(brief.knownEvidenceIds || []);
  const audienceValid = Array.isArray(brief.audienceSegments) && brief.audienceSegments.length > 0
    && new Set(brief.audienceSegments.map((row) => row.id)).size === brief.audienceSegments.length
    && brief.audienceSegments.every((row) => /^[a-f0-9]{64}$/.test(row.descriptionHash || '') && row.descriptionLength > 0
      && Array.isArray(row.evidenceIds) && row.evidenceIds.length > 0 && row.evidenceIds.every((id) => knownEvidenceIds.has(id)));
  let deliverablesValid = false;
  try {
    deliverablesValid = JSON.stringify(normalizeDeliverables(brief.deliverables)) === JSON.stringify(brief.deliverables);
  } catch {
    deliverablesValid = false;
  }
  const narrativeRowsValid = ['constraints', 'successCriteria'].every((field) => Array.isArray(brief[field]) && brief[field].length > 0
    && brief[field].every((row) => Object.entries(row).some(([key, value]) => key.endsWith('Hash') && /^[a-f0-9]{64}$/.test(value))
      && Object.entries(row).some(([key, value]) => key.endsWith('Length') && Number.isInteger(value) && value > 0)));
  const semanticValid = roleValid && audienceValid && deliverablesValid && narrativeRowsValid
    && /^[a-f0-9]{64}$/.test(brief.creativeDirectionHash || '') && brief.creativeDirectionLength > 0 && brief.storesRawNarrative === false;
  return { valid: checksumValid && linkValid && semanticValid, checksumValid, linkValid, semanticValid };
}

function creativeSubmissionSnapshot(submission, brief) {
  if (!submission?.id || submission.artifactType !== 'creative-work' || submission.agentId !== brief.artDirectorId) throw new Error('creative-studio-art-director-submission-required');
  if (!submission.artifactChecksum || !submission.artifactStorageProofChecksum) throw new Error('creative-studio-immutable-storage-proof-required');
  return {
    submissionId: identifier(submission.id, 'submission-id'),
    artifactType: 'creative-work',
    artDirectorId: brief.artDirectorId,
    artifactChecksum: String(submission.artifactChecksum),
    artifactStorageProofChecksum: String(submission.artifactStorageProofChecksum),
    submissionCreatedAt: iso(submission.createdAt, 'submission-created-at'),
  };
}

export function createLocalCreativeIteration({
  brief, submission, deliverableIds, changeSummary, previousIteration = null, priorCritiques = [], addressedIssueIds = [],
  idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(brief, 'local-creative-brief/v1')) throw new Error('creative-studio-brief-integrity-invalid');
  const snapshot = creativeSubmissionSnapshot(submission, brief);
  const coveredDeliverableIds = uniqueIds(deliverableIds, 'iteration-deliverable-id');
  const knownDeliverableIds = new Set(brief.deliverables.map((row) => row.id));
  if (coveredDeliverableIds.some((value) => !knownDeliverableIds.has(value))) throw new Error('creative-studio-iteration-deliverable-invalid');
  const summary = narrative(changeSummary, 'iteration-change-summary');
  const isRevision = Boolean(previousIteration);
  let iterationVersion = 1;
  let previousIterationId = null;
  let previousIterationChecksum = null;
  let priorCritiqueManifest = [];
  let requiredIssueIds = [];
  let addressed = [];
  if (isRevision) {
    if (!receiptValid(previousIteration, 'local-creative-iteration/v1')
      || previousIteration.briefId !== brief.id || previousIteration.briefChecksum !== brief.checksum) throw new Error('creative-studio-previous-iteration-invalid');
    if (!Array.isArray(priorCritiques) || priorCritiques.length !== 2
      || new Set(priorCritiques.map((row) => row.perspective)).size !== 2
      || !['creative-lead', 'audience-researcher'].every((perspective) => priorCritiques.some((row) => row.perspective === perspective))) {
      throw new Error('creative-studio-revision-dual-critique-required');
    }
    if (priorCritiques.some((row) => !verifyLocalCreativeCritique(row, brief, previousIteration).valid)) throw new Error('creative-studio-revision-critique-invalid');
    if (priorCritiques.every((row) => row.verdict === 'approved')) throw new Error('creative-studio-revision-after-approval-forbidden');
    requiredIssueIds = [...new Set(priorCritiques.flatMap(creativeCritiqueIssueIds))].sort();
    addressed = uniqueIds(addressedIssueIds, 'addressed-issue-id');
    if (!requiredIssueIds.length || JSON.stringify(addressed) !== JSON.stringify(requiredIssueIds)) throw new Error('creative-studio-critique-issues-unresolved');
    if (snapshot.submissionId === previousIteration.submissionId
      || Date.parse(snapshot.submissionCreatedAt) <= Date.parse(previousIteration.submissionCreatedAt)) throw new Error('creative-studio-revision-must-use-new-submission');
    iterationVersion = previousIteration.iterationVersion + 1;
    previousIterationId = previousIteration.id;
    previousIterationChecksum = previousIteration.checksum;
    priorCritiqueManifest = priorCritiques.map((row) => [row.id, row.checksum]).sort((left, right) => left[0].localeCompare(right[0]));
  } else if ((priorCritiques || []).length || (addressedIssueIds || []).length) {
    throw new Error('creative-studio-revision-critique-required');
  }
  const createdAt = iso(now, 'iteration-created-at');
  if (Date.parse(createdAt) <= Date.parse(brief.createdAt) || Date.parse(createdAt) <= Date.parse(snapshot.submissionCreatedAt)) throw new Error('creative-studio-iteration-time-invalid');
  if (isRevision && (Date.parse(createdAt) <= Date.parse(previousIteration.createdAt)
    || priorCritiques.some((row) => Date.parse(createdAt) <= Date.parse(row.createdAt)))) throw new Error('creative-studio-revision-time-invalid');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-creative-iteration/v1',
    id: `creative_iteration_${checksum(`${brief.id}:${snapshot.submissionId}:${normalizedKey}`).slice(0, 28)}`,
    projectId: brief.projectId,
    briefId: brief.id,
    briefVersion: brief.version,
    briefChecksum: brief.checksum,
    iterationVersion,
    previousIterationId,
    previousIterationChecksum,
    priorCritiqueManifest,
    requiredIssueIds,
    addressedIssueIds: addressed,
    ...snapshot,
    deliverableIds: coveredDeliverableIds,
    changeSummaryHash: summary.hash,
    changeSummaryLength: summary.length,
    idempotencyKey: normalizedKey,
    storesRawContent: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalCreativeIteration(iteration = {}, brief = {}, previousIteration = null, priorCritiques = []) {
  const checksumValid = receiptValid(iteration, 'local-creative-iteration/v1');
  const briefValid = receiptValid(brief, 'local-creative-brief/v1') && iteration.briefId === brief.id
    && iteration.briefVersion === brief.version && iteration.briefChecksum === brief.checksum;
  const first = iteration.iterationVersion === 1;
  const lineageValid = first
    ? !iteration.previousIterationId && !iteration.previousIterationChecksum
      && !(iteration.priorCritiqueManifest || []).length && !(iteration.requiredIssueIds || []).length && !(iteration.addressedIssueIds || []).length
    : Boolean(previousIteration && iteration.iterationVersion === previousIteration.iterationVersion + 1
      && iteration.previousIterationId === previousIteration.id && iteration.previousIterationChecksum === previousIteration.checksum
      && iteration.submissionId !== previousIteration.submissionId
      && Date.parse(iteration.submissionCreatedAt) > Date.parse(previousIteration.submissionCreatedAt)
      && Date.parse(iteration.createdAt) > Date.parse(previousIteration.createdAt));
  let critiqueValid = first;
  if (!first) {
    const manifest = (priorCritiques || []).map((row) => [row.id, row.checksum]).sort((left, right) => left[0].localeCompare(right[0]));
    const issues = [...new Set((priorCritiques || []).flatMap(creativeCritiqueIssueIds))].sort();
    critiqueValid = priorCritiques.length === 2
      && new Set(priorCritiques.map((row) => row.perspective)).size === 2
      && priorCritiques.every((row) => verifyLocalCreativeCritique(row, brief, previousIteration).valid)
      && priorCritiques.some((row) => row.verdict === 'changes-requested')
      && JSON.stringify(iteration.priorCritiqueManifest) === JSON.stringify(manifest)
      && JSON.stringify(iteration.requiredIssueIds) === JSON.stringify(issues)
      && JSON.stringify(iteration.addressedIssueIds) === JSON.stringify(issues);
  }
  const submissionValid = iteration.artifactType === 'creative-work' && iteration.artDirectorId === brief.artDirectorId
    && Boolean(iteration.submissionId && iteration.artifactChecksum && iteration.artifactStorageProofChecksum)
    && Array.isArray(iteration.deliverableIds) && iteration.deliverableIds.length > 0
    && iteration.deliverableIds.every((id) => (brief.deliverables || []).some((row) => row.id === id))
    && Date.parse(iteration.createdAt) > Date.parse(iteration.submissionCreatedAt);
  return { valid: checksumValid && briefValid && lineageValid && critiqueValid && submissionValid, checksumValid, briefValid, lineageValid, critiqueValid, submissionValid };
}

const CRITIQUE_DIMENSIONS = Object.freeze(['accessibility', 'audience-fit', 'brief-alignment', 'craft']);

function normalizeCritiqueDimensions(dimensions, iteration, perspective) {
  if (!Array.isArray(dimensions) || dimensions.length !== CRITIQUE_DIMENSIONS.length) throw new Error('creative-studio-critique-dimension-set-invalid');
  const normalized = dimensions.map((row) => {
    const id = String(row?.id || '').trim();
    if (!CRITIQUE_DIMENSIONS.includes(id)) throw new Error('creative-studio-critique-dimension-set-invalid');
    const finding = narrative(row.findingText, 'critique-finding', 5_000);
    const scoreBps = integer(row.scoreBps, 'critique-score-bps', 0, 10_000);
    const blocking = row.blocking === true;
    const issueId = blocking || scoreBps < 7_000
      ? `creative_issue_${checksum(`${iteration.id}:${perspective}:${id}`).slice(0, 28)}`
      : null;
    return { id, scoreBps, findingHash: finding.hash, findingLength: finding.length, blocking, issueId };
  }).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(normalized.map((row) => row.id)).size !== CRITIQUE_DIMENSIONS.length
    || CRITIQUE_DIMENSIONS.some((id) => !normalized.some((row) => row.id === id))) throw new Error('creative-studio-critique-dimension-set-invalid');
  return normalized;
}

export function createLocalCreativeCritique({
  brief, iteration, perspective, reviewerId, dimensions, verdict, idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(iteration, 'local-creative-iteration/v1') || !receiptValid(brief, 'local-creative-brief/v1')
    || iteration.briefId !== brief.id || iteration.briefChecksum !== brief.checksum) throw new Error('creative-studio-critique-iteration-invalid');
  const normalizedPerspective = String(perspective || '').trim();
  const expectedReviewer = normalizedPerspective === 'creative-lead'
    ? brief.creativeLeadId
    : normalizedPerspective === 'audience-researcher' ? brief.audienceResearcherId : null;
  if (!expectedReviewer || reviewerId !== expectedReviewer || reviewerId === brief.artDirectorId) throw new Error('creative-studio-critique-reviewer-invalid');
  const normalizedDimensions = normalizeCritiqueDimensions(dimensions, iteration, normalizedPerspective);
  const normalizedVerdict = String(verdict || '').trim();
  if (!['changes-requested', 'approved'].includes(normalizedVerdict)) throw new Error('creative-studio-critique-verdict-invalid');
  const issueIds = normalizedDimensions.map((row) => row.issueId).filter(Boolean).sort();
  if (normalizedVerdict === 'approved' && issueIds.length) throw new Error('creative-studio-approved-critique-quality-invalid');
  if (normalizedVerdict === 'changes-requested' && !issueIds.length) throw new Error('creative-studio-changes-critique-issue-required');
  const createdAt = iso(now, 'critique-created-at');
  if (Date.parse(createdAt) <= Date.parse(iteration.createdAt)) throw new Error('creative-studio-critique-before-iteration');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-creative-critique/v1',
    id: `creative_critique_${checksum(`${iteration.id}:${normalizedPerspective}:${normalizedKey}`).slice(0, 28)}`,
    projectId: brief.projectId,
    briefId: brief.id,
    briefChecksum: brief.checksum,
    iterationId: iteration.id,
    iterationChecksum: iteration.checksum,
    submissionId: iteration.submissionId,
    artifactChecksum: iteration.artifactChecksum,
    perspective: normalizedPerspective,
    reviewerId: expectedReviewer,
    dimensions: normalizedDimensions,
    issueIds,
    verdict: normalizedVerdict,
    idempotencyKey: normalizedKey,
    storesRawCritique: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function creativeCritiqueIssueIds(critique = {}) {
  return [...new Set((critique.issueIds || []).map(String))].sort();
}

export function verifyLocalCreativeCritique(critique = {}, brief = {}, iteration = {}) {
  const checksumValid = receiptValid(critique, 'local-creative-critique/v1');
  const expectedReviewer = critique.perspective === 'creative-lead'
    ? brief.creativeLeadId
    : critique.perspective === 'audience-researcher' ? brief.audienceResearcherId : null;
  const linkValid = receiptValid(iteration, 'local-creative-iteration/v1') && receiptValid(brief, 'local-creative-brief/v1')
    && iteration.briefId === brief.id && iteration.briefChecksum === brief.checksum
    && critique.briefId === brief.id && critique.briefChecksum === brief.checksum
    && critique.iterationId === iteration.id && critique.iterationChecksum === iteration.checksum
    && critique.submissionId === iteration.submissionId && critique.artifactChecksum === iteration.artifactChecksum
    && critique.reviewerId === expectedReviewer && critique.reviewerId !== brief.artDirectorId
    && Date.parse(critique.createdAt) > Date.parse(iteration.createdAt);
  const dimensionValid = Array.isArray(critique.dimensions) && critique.dimensions.length === CRITIQUE_DIMENSIONS.length
    && CRITIQUE_DIMENSIONS.every((id) => critique.dimensions.some((row) => row.id === id))
    && new Set(critique.dimensions.map((row) => row.id)).size === CRITIQUE_DIMENSIONS.length
    && critique.dimensions.every((row) => Number.isInteger(row.scoreBps) && row.scoreBps >= 0 && row.scoreBps <= 10_000
      && typeof row.blocking === 'boolean' && /^[a-f0-9]{64}$/.test(row.findingHash || '') && Number.isInteger(row.findingLength) && row.findingLength > 0
      && row.issueId === (row.blocking || row.scoreBps < 7_000 ? `creative_issue_${checksum(`${iteration.id}:${critique.perspective}:${row.id}`).slice(0, 28)}` : null));
  const issues = (critique.dimensions || []).filter((row) => row.blocking || row.scoreBps < 7_000).map((row) => row.issueId).sort();
  const verdictValid = (critique.verdict === 'approved' && issues.length === 0)
    || (critique.verdict === 'changes-requested' && issues.length > 0);
  return { valid: checksumValid && linkValid && dimensionValid && verdictValid && JSON.stringify(issues) === JSON.stringify(creativeCritiqueIssueIds(critique)), checksumValid, linkValid, dimensionValid, verdictValid };
}

function normalizeExportChecks(checks, brief, iteration) {
  if (!Array.isArray(checks) || checks.length !== brief.deliverables.length) throw new Error('creative-studio-export-deliverable-coverage-incomplete');
  const deliverableMap = new Map(brief.deliverables.map((row) => [row.id, row]));
  const normalized = checks.map((row) => {
    const deliverableId = identifier(row?.deliverableId, 'export-deliverable-id');
    const deliverable = deliverableMap.get(deliverableId);
    if (!deliverable) throw new Error('creative-studio-export-deliverable-coverage-incomplete');
    const outputChecksum = String(row.outputChecksum || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(outputChecksum)) throw new Error('creative-studio-export-output-checksum-invalid');
    const evidenceIds = uniqueIds(row.evidenceIds, 'export-evidence-id');
    if (!evidenceIds.includes(iteration.artifactStorageProofChecksum)) throw new Error('creative-studio-export-storage-evidence-required');
    const accessibilityEvidenceIds = uniqueIds(row.accessibilityEvidenceIds || [], 'export-accessibility-evidence-id', { allowEmpty: true });
    if (deliverable.accessibilityRequired && !accessibilityEvidenceIds.length) throw new Error('creative-studio-export-accessibility-evidence-required');
    const candidate = {
      deliverableId,
      format: String(row.format || '').trim(),
      width: row.width == null ? null : integer(row.width, 'export-width', 1, 100_000),
      height: row.height == null ? null : integer(row.height, 'export-height', 1, 100_000),
      durationMs: row.durationMs == null ? null : integer(row.durationMs, 'export-duration', 1, 86_400_000),
      colorSpace: row.colorSpace == null ? null : String(row.colorSpace).trim(),
      fileBytes: integer(row.fileBytes, 'export-file-bytes', 1, 2_000_000_000),
      outputChecksum,
      evidenceIds,
      accessibilityEvidenceIds,
    };
    if (candidate.format !== deliverable.format || candidate.width !== deliverable.width || candidate.height !== deliverable.height
      || candidate.durationMs !== deliverable.durationMs || candidate.colorSpace !== deliverable.colorSpace
      || candidate.fileBytes > deliverable.maxBytes) throw new Error('creative-studio-export-spec-mismatch');
    return candidate;
  }).sort((left, right) => left.deliverableId.localeCompare(right.deliverableId));
  if (new Set(normalized.map((row) => row.deliverableId)).size !== brief.deliverables.length
    || brief.deliverables.some((row) => !normalized.some((check) => check.deliverableId === row.id))) throw new Error('creative-studio-export-deliverable-coverage-incomplete');
  return normalized;
}

export function createLocalCreativeExport({
  brief, iteration, critiques, checks, actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(brief, 'local-creative-brief/v1') || !receiptValid(iteration, 'local-creative-iteration/v1')
    || iteration.briefId !== brief.id || iteration.briefChecksum !== brief.checksum) throw new Error('creative-studio-export-lineage-invalid');
  const requiredDeliverableIds = brief.deliverables.map((row) => row.id).sort();
  if (JSON.stringify([...iteration.deliverableIds].sort()) !== JSON.stringify(requiredDeliverableIds)) throw new Error('creative-studio-export-iteration-coverage-incomplete');
  if (!Array.isArray(critiques) || critiques.length !== 2 || new Set(critiques.map((row) => row.perspective)).size !== 2
    || !critiques.every((row) => verifyLocalCreativeCritique(row, brief, iteration).valid && row.verdict === 'approved')) {
    throw new Error('creative-studio-export-dual-approval-required');
  }
  if (actorId !== brief.artDirectorId) throw new Error('creative-studio-export-art-director-required');
  const normalizedChecks = normalizeExportChecks(checks, brief, iteration);
  const createdAt = iso(now, 'export-created-at');
  if (Date.parse(createdAt) <= Math.max(Date.parse(iteration.createdAt), ...critiques.map((row) => Date.parse(row.createdAt)))) throw new Error('creative-studio-export-before-approval');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const critiqueManifest = critiques.map((row) => [row.id, row.checksum]).sort((left, right) => left[0].localeCompare(right[0]));
  const base = {
    schemaVersion: 'local-creative-export/v1',
    id: `creative_export_${checksum(`${iteration.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: brief.projectId,
    briefId: brief.id,
    briefChecksum: brief.checksum,
    iterationId: iteration.id,
    iterationChecksum: iteration.checksum,
    submissionId: iteration.submissionId,
    artifactChecksum: iteration.artifactChecksum,
    artifactStorageProofChecksum: iteration.artifactStorageProofChecksum,
    critiqueManifest,
    checks: normalizedChecks,
    actorId: brief.artDirectorId,
    idempotencyKey: normalizedKey,
    readyForHandoff: true,
    readyForExternalRelease: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalCreativeExport(creativeExport = {}, brief = {}, iteration = {}, critiques = []) {
  const checksumValid = receiptValid(creativeExport, 'local-creative-export/v1');
  const critiqueManifest = critiques.map((row) => [row.id, row.checksum]).sort((left, right) => left[0].localeCompare(right[0]));
  const linkValid = receiptValid(brief, 'local-creative-brief/v1') && receiptValid(iteration, 'local-creative-iteration/v1')
    && creativeExport.briefId === brief.id && creativeExport.briefChecksum === brief.checksum
    && creativeExport.iterationId === iteration.id && creativeExport.iterationChecksum === iteration.checksum
    && creativeExport.submissionId === iteration.submissionId && creativeExport.artifactChecksum === iteration.artifactChecksum
    && creativeExport.artifactStorageProofChecksum === iteration.artifactStorageProofChecksum
    && JSON.stringify(creativeExport.critiqueManifest) === JSON.stringify(critiqueManifest)
    && critiques.length === 2 && critiques.every((row) => verifyLocalCreativeCritique(row, brief, iteration).valid && row.verdict === 'approved')
    && Date.parse(creativeExport.createdAt) > Math.max(Date.parse(iteration.createdAt), ...critiques.map((row) => Date.parse(row.createdAt)));
  let checksValid = false;
  try {
    checksValid = JSON.stringify(normalizeExportChecks(creativeExport.checks, brief, iteration)) === JSON.stringify(creativeExport.checks);
  } catch {
    checksValid = false;
  }
  return { valid: checksumValid && linkValid && checksValid && creativeExport.readyForHandoff === true && creativeExport.readyForExternalRelease === false, checksumValid, linkValid, checksValid };
}

function normalizeToolchain(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 50) throw new Error('creative-studio-handoff-toolchain-invalid');
  const normalized = rows.map((row) => ({
    toolId: identifier(row?.toolId, 'handoff-tool-id'),
    toolVersion: identifier(row?.toolVersion, 'handoff-tool-version'),
  })).sort((left, right) => left.toolId.localeCompare(right.toolId));
  if (new Set(normalized.map((row) => row.toolId)).size !== normalized.length) throw new Error('creative-studio-handoff-toolchain-duplicate');
  return normalized;
}

export function createLocalCreativeHandoff({
  brief, iteration, creativeExport, senderId, recipientId, editableSourceEvidenceIds, toolchain, dependencyIds,
  instructionsText, knownLimitationsText, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(creativeExport, 'local-creative-export/v1') || creativeExport.briefId !== brief?.id
    || creativeExport.iterationId !== iteration?.id || creativeExport.readyForHandoff !== true) throw new Error('creative-studio-handoff-export-invalid');
  if (senderId !== brief.artDirectorId || recipientId !== brief.creativeLeadId || senderId === recipientId) throw new Error('creative-studio-handoff-role-invalid');
  const instructions = narrative(instructionsText, 'handoff-instructions');
  const limitations = narrative(knownLimitationsText, 'handoff-known-limitations');
  const createdAt = iso(now, 'handoff-created-at');
  if (Date.parse(createdAt) <= Date.parse(creativeExport.createdAt)) throw new Error('creative-studio-handoff-before-export');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-creative-handoff/v1',
    id: `creative_handoff_${checksum(`${creativeExport.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: brief.projectId,
    briefId: brief.id,
    briefChecksum: brief.checksum,
    iterationId: iteration.id,
    iterationChecksum: iteration.checksum,
    exportId: creativeExport.id,
    exportChecksum: creativeExport.checksum,
    senderId: brief.artDirectorId,
    recipientId: brief.creativeLeadId,
    editableSourceEvidenceIds: uniqueIds(editableSourceEvidenceIds, 'handoff-editable-source-evidence-id'),
    toolchain: normalizeToolchain(toolchain),
    dependencyIds: uniqueIds(dependencyIds, 'handoff-dependency-id'),
    instructionsHash: instructions.hash,
    instructionsLength: instructions.length,
    knownLimitationsHash: limitations.hash,
    knownLimitationsLength: limitations.length,
    manifestChecksum: checksum({
      exportId: creativeExport.id,
      exportChecksum: creativeExport.checksum,
      editableSourceEvidenceIds: uniqueIds(editableSourceEvidenceIds, 'handoff-editable-source-evidence-id'),
      toolchain: normalizeToolchain(toolchain),
      dependencyIds: uniqueIds(dependencyIds, 'handoff-dependency-id'),
    }),
    idempotencyKey: normalizedKey,
    storesRawNarrative: false,
    status: 'awaiting-acknowledgement',
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalCreativeHandoff(handoff = {}, brief = {}, iteration = {}, creativeExport = {}) {
  const checksumValid = receiptValid(handoff, 'local-creative-handoff/v1');
  const linkValid = receiptValid(creativeExport, 'local-creative-export/v1')
    && handoff.briefId === brief.id && handoff.briefChecksum === brief.checksum
    && handoff.iterationId === iteration.id && handoff.iterationChecksum === iteration.checksum
    && handoff.exportId === creativeExport.id && handoff.exportChecksum === creativeExport.checksum
    && handoff.senderId === brief.artDirectorId && handoff.recipientId === brief.creativeLeadId
    && Date.parse(handoff.createdAt) > Date.parse(creativeExport.createdAt);
  const manifestValid = handoff.manifestChecksum === checksum({
    exportId: creativeExport.id,
    exportChecksum: creativeExport.checksum,
    editableSourceEvidenceIds: handoff.editableSourceEvidenceIds,
    toolchain: handoff.toolchain,
    dependencyIds: handoff.dependencyIds,
  });
  const packageValid = Array.isArray(handoff.editableSourceEvidenceIds) && handoff.editableSourceEvidenceIds.length > 0
    && Array.isArray(handoff.dependencyIds) && handoff.dependencyIds.length > 0
    && Array.isArray(handoff.toolchain) && handoff.toolchain.length > 0
    && handoff.toolchain.every((row) => Boolean(row.toolId && row.toolVersion))
    && /^[a-f0-9]{64}$/.test(handoff.instructionsHash || '') && handoff.instructionsLength > 0
    && /^[a-f0-9]{64}$/.test(handoff.knownLimitationsHash || '') && handoff.knownLimitationsLength > 0;
  return { valid: checksumValid && linkValid && manifestValid && packageValid && handoff.storesRawNarrative === false && handoff.status === 'awaiting-acknowledgement', checksumValid, linkValid, manifestValid, packageValid };
}

export function createLocalCreativeHandoffAcknowledgement({
  handoff, actorId, evidenceIds, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(handoff, 'local-creative-handoff/v1')) throw new Error('creative-studio-handoff-integrity-invalid');
  if (actorId !== handoff.recipientId) throw new Error('creative-studio-handoff-recipient-required');
  const createdAt = iso(now, 'handoff-acknowledgement-created-at');
  if (Date.parse(createdAt) <= Date.parse(handoff.createdAt)) throw new Error('creative-studio-handoff-acknowledgement-before-handoff');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-creative-handoff-acknowledgement/v1',
    id: `creative_handoff_ack_${checksum(`${handoff.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: handoff.projectId,
    handoffId: handoff.id,
    handoffChecksum: handoff.checksum,
    manifestChecksum: handoff.manifestChecksum,
    actorId: handoff.recipientId,
    evidenceIds: uniqueIds(evidenceIds, 'handoff-acknowledgement-evidence-id'),
    idempotencyKey: normalizedKey,
    status: 'accepted',
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalCreativeHandoffAcknowledgement(acknowledgement = {}, handoff = {}) {
  const checksumValid = receiptValid(acknowledgement, 'local-creative-handoff-acknowledgement/v1');
  const linkValid = receiptValid(handoff, 'local-creative-handoff/v1')
    && acknowledgement.handoffId === handoff.id && acknowledgement.handoffChecksum === handoff.checksum
    && acknowledgement.manifestChecksum === handoff.manifestChecksum && acknowledgement.actorId === handoff.recipientId
    && Date.parse(acknowledgement.createdAt) > Date.parse(handoff.createdAt);
  const evidenceValid = Array.isArray(acknowledgement.evidenceIds) && acknowledgement.evidenceIds.length > 0;
  return { valid: checksumValid && linkValid && evidenceValid && acknowledgement.status === 'accepted', checksumValid, linkValid, evidenceValid };
}

function duplicateValues(rows, selector) {
  const seen = new Set();
  const duplicates = [];
  rows.forEach((row) => {
    const value = selector(row);
    if (seen.has(value)) duplicates.push(value);
    seen.add(value);
  });
  return [...new Set(duplicates)];
}

export function buildLocalCreativeStudioWorkflow({ project = {}, now = new Date().toISOString() } = {}) {
  const briefs = [...(project.localCreativeBriefs || [])].sort((left, right) => left.version - right.version);
  const iterations = [...(project.localCreativeIterations || [])].sort((left, right) => left.iterationVersion - right.iterationVersion);
  const critiques = project.localCreativeCritiques || [];
  const exports = project.localCreativeExports || [];
  const handoffs = project.localCreativeHandoffs || [];
  const acknowledgements = project.localCreativeHandoffAcknowledgements || [];
  const briefMap = new Map(briefs.map((row) => [row.id, row]));
  const iterationMap = new Map(iterations.map((row) => [row.id, row]));
  const critiqueMap = new Map(critiques.map((row) => [row.id, row]));
  const exportMap = new Map(exports.map((row) => [row.id, row]));
  const handoffMap = new Map(handoffs.map((row) => [row.id, row]));
  const invalidReceiptIds = [];
  briefs.forEach((row, index) => { if (!verifyLocalCreativeBrief(row, index ? briefs[index - 1] : null).valid || row.projectId !== project.id) invalidReceiptIds.push(row.id); });
  iterations.forEach((row) => {
    const priorCritiques = (row.priorCritiqueManifest || []).map(([id]) => critiqueMap.get(id)).filter(Boolean);
    if (!verifyLocalCreativeIteration(row, briefMap.get(row.briefId), iterationMap.get(row.previousIterationId), priorCritiques).valid) invalidReceiptIds.push(row.id);
  });
  critiques.forEach((row) => { if (!verifyLocalCreativeCritique(row, briefMap.get(row.briefId), iterationMap.get(row.iterationId)).valid) invalidReceiptIds.push(row.id); });
  exports.forEach((row) => {
    const exportCritiques = (row.critiqueManifest || []).map(([id]) => critiqueMap.get(id)).filter(Boolean);
    if (!verifyLocalCreativeExport(row, briefMap.get(row.briefId), iterationMap.get(row.iterationId), exportCritiques).valid) invalidReceiptIds.push(row.id);
  });
  handoffs.forEach((row) => { if (!verifyLocalCreativeHandoff(row, briefMap.get(row.briefId), iterationMap.get(row.iterationId), exportMap.get(row.exportId)).valid) invalidReceiptIds.push(row.id); });
  acknowledgements.forEach((row) => { if (!verifyLocalCreativeHandoffAcknowledgement(row, handoffMap.get(row.handoffId)).valid) invalidReceiptIds.push(row.id); });
  const duplicateIds = duplicateValues([...briefs, ...iterations, ...critiques, ...exports, ...handoffs, ...acknowledgements], (row) => row.id);
  const duplicateSubmissionIds = duplicateValues(iterations, (row) => row.submissionId);
  const duplicateCritiquePerspectives = duplicateValues(critiques, (row) => `${row.iterationId}:${row.perspective}`);
  const duplicateIterationExports = duplicateValues(exports, (row) => row.iterationId);
  const duplicateExportHandoffs = duplicateValues(handoffs, (row) => row.exportId);
  const duplicateHandoffAcknowledgements = duplicateValues(acknowledgements, (row) => row.handoffId);
  const modeValid = project.workModeContract?.workMode === 'creative-studio';
  const integrityValid = modeValid && invalidReceiptIds.length === 0 && duplicateIds.length === 0
    && duplicateSubmissionIds.length === 0 && duplicateCritiquePerspectives.length === 0
    && duplicateIterationExports.length === 0 && duplicateExportHandoffs.length === 0 && duplicateHandoffAcknowledgements.length === 0;
  const latestBrief = briefs.at(-1) || null;
  const latestIteration = [...iterations].reverse().find((row) => row.briefId === latestBrief?.id) || null;
  const latestCritiques = critiques.filter((row) => row.iterationId === latestIteration?.id);
  const dualCritiqueComplete = latestCritiques.length === 2
    && ['creative-lead', 'audience-researcher'].every((perspective) => latestCritiques.some((row) => row.perspective === perspective));
  const dualApproved = dualCritiqueComplete && latestCritiques.every((row) => row.verdict === 'approved');
  const latestExport = exports.find((row) => row.iterationId === latestIteration?.id) || null;
  const latestHandoff = handoffs.find((row) => row.exportId === latestExport?.id) || null;
  const latestHandoffAcknowledgement = acknowledgements.find((row) => row.handoffId === latestHandoff?.id) || null;
  const status = !integrityValid ? 'degraded-integrity-invalid'
    : !latestBrief ? 'brief-required'
      : !latestIteration ? 'iteration-required'
        : !dualCritiqueComplete ? 'critique-required'
          : !dualApproved ? 'revision-required'
            : !latestExport ? 'export-required'
              : !latestHandoff ? 'handoff-required'
                : !latestHandoffAcknowledgement ? 'handoff-acknowledgement-required'
                  : 'ready-for-rights-provenance-audit';
  return {
    schemaVersion: 'local-creative-studio-workflow/v1',
    projectId: project.id || null,
    generatedAt: iso(now, 'workflow-generated-at'),
    localOnly: true,
    status,
    latestBrief,
    latestIteration,
    latestCritiques,
    latestExport,
    latestHandoff,
    latestHandoffAcknowledgement,
    integrity: {
      valid: integrityValid,
      modeValid,
      invalidReceiptIds: [...new Set(invalidReceiptIds)],
      duplicateIds: [...new Set([...duplicateIds, ...duplicateSubmissionIds, ...duplicateCritiquePerspectives, ...duplicateIterationExports, ...duplicateExportHandoffs, ...duplicateHandoffAcknowledgements])],
    },
    readyForExport: integrityValid && dualApproved,
    readyForHandoff: Boolean(integrityValid && latestExport),
    readyForRightsProvenanceAudit: Boolean(integrityValid && latestHandoffAcknowledgement?.status === 'accepted'),
    readyForExternalRelease: false,
    summary: { briefVersionCount: briefs.length, iterationCount: iterations.length, critiqueCount: critiques.length, exportCount: exports.length, handoffCount: handoffs.length, acknowledgementCount: acknowledgements.length },
  };
}
