import { portableSha256Hex } from './accessControl.js';

const CLAIM_KINDS = new Set(['empirical', 'theoretical', 'methodological', 'limitation']);

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

function id(value, field, optional = false) {
  const text = String(value || '').trim();
  if (!text && optional) return null;
  if (!text || text.length > 220 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(text)) throw new Error(`academic-writing-${field}-invalid`);
  return text;
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`academic-writing-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function integer(value, field, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`academic-writing-${field}-invalid`);
  return number;
}

function checksumReceiptValid(receipt = {}, schemaVersion = '') {
  const { checksum: expected, ...base } = receipt;
  return receipt.schemaVersion === schemaVersion && Boolean(expected) && expected === checksum(base);
}

function orderSections(input = []) {
  if (!Array.isArray(input) || !input.length || input.length > 80) throw new Error('academic-writing-sections-invalid');
  const sections = input.map((section) => ({
    id: id(section.id, 'section-id'),
    title: String(section.title || '').trim().slice(0, 240),
    dependsOn: [...new Set((Array.isArray(section.dependsOn) ? section.dependsOn : []).map((value) => id(value, 'section-dependency-id')))].sort(),
  }));
  if (sections.some((section) => !section.title)) throw new Error('academic-writing-section-title-invalid');
  if (new Set(sections.map((section) => section.id)).size !== sections.length) throw new Error('academic-writing-section-duplicate');
  const byId = new Map(sections.map((section) => [section.id, section]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];
  const visit = (section) => {
    if (visiting.has(section.id)) throw new Error('academic-writing-section-dependency-cycle');
    if (visited.has(section.id)) return;
    visiting.add(section.id);
    for (const dependencyId of section.dependsOn) {
      const dependency = byId.get(dependencyId);
      if (!dependency) throw new Error('academic-writing-section-dependency-invalid');
      visit(dependency);
    }
    visiting.delete(section.id);
    visited.add(section.id);
    ordered.push(section);
  };
  sections.forEach(visit);
  return ordered;
}

export function createLocalAcademicWritingBlueprint({
  projectId, authorId, reviewerId, researchQuestion, styleGuideId, sections = [], claims = [], knownSourceEvidenceIds = [],
  version = 1, previousBlueprintId = null, previousBlueprintChecksum = null, governanceStartedAt = null,
  actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  const normalizedAuthorId = id(authorId, 'author-id');
  const normalizedReviewerId = id(reviewerId, 'reviewer-id');
  if (normalizedAuthorId === normalizedReviewerId) throw new Error('academic-writing-independent-reviewer-required');
  const question = String(researchQuestion || '').trim();
  if (!question || question.length > 5_000) throw new Error('academic-writing-research-question-invalid');
  const normalizedSections = orderSections(sections);
  const sectionIds = new Set(normalizedSections.map((section) => section.id));
  const knownSources = new Set((Array.isArray(knownSourceEvidenceIds) ? knownSourceEvidenceIds : []).map((value) => id(value, 'known-source-evidence-id')));
  const normalizedClaims = (Array.isArray(claims) ? claims : []).map((claim) => {
    const statement = String(claim.statement || '').trim();
    const kind = String(claim.kind || '').trim();
    if (!statement || statement.length > 10_000) throw new Error('academic-writing-claim-statement-invalid');
    if (!CLAIM_KINDS.has(kind)) throw new Error('academic-writing-claim-kind-invalid');
    const sourceEvidenceIds = [...new Set((Array.isArray(claim.sourceEvidenceIds) ? claim.sourceEvidenceIds : []).map((value) => id(value, 'claim-source-evidence-id')))].sort();
    if (!sourceEvidenceIds.length || sourceEvidenceIds.some((sourceId) => !knownSources.has(sourceId))) throw new Error('academic-writing-source-evidence-invalid');
    const sectionId = id(claim.sectionId, 'claim-section-id');
    if (!sectionIds.has(sectionId)) throw new Error('academic-writing-claim-section-invalid');
    return {
      id: id(claim.id, 'claim-id'),
      sectionId,
      kind,
      statementHash: portableSha256Hex(statement),
      statementLength: statement.length,
      sourceEvidenceIds,
    };
  });
  if (!normalizedClaims.length || new Set(normalizedClaims.map((claim) => claim.id)).size !== normalizedClaims.length) throw new Error('academic-writing-claims-invalid');
  const normalizedVersion = integer(version, 'version', 1, 10_000);
  const previousId = id(previousBlueprintId, 'previous-blueprint-id', true);
  const previousChecksum = previousBlueprintChecksum ? String(previousBlueprintChecksum).toLowerCase() : null;
  if ((normalizedVersion === 1 && (previousId || previousChecksum))
    || (normalizedVersion > 1 && (!previousId || !/^[a-f0-9]{64}$/.test(previousChecksum || '')))) throw new Error('academic-writing-blueprint-link-invalid');
  const createdAt = iso(now, 'created-at');
  const normalized = {
    projectId: id(projectId, 'project-id'),
    authorId: normalizedAuthorId,
    reviewerId: normalizedReviewerId,
    researchQuestionHash: portableSha256Hex(question),
    researchQuestionLength: question.length,
    styleGuideId: id(styleGuideId, 'style-guide-id'),
    sections: normalizedSections,
    claims: normalizedClaims,
    knownSourceEvidenceIds: [...knownSources].sort(),
    version: normalizedVersion,
    previousBlueprintId: previousId,
    previousBlueprintChecksum: previousChecksum,
    governanceStartedAt: governanceStartedAt ? iso(governanceStartedAt, 'governance-started-at') : createdAt,
    actorId: id(actorId, 'actor-id'),
    idempotencyKey: id(idempotencyKey, 'idempotency-key'),
  };
  const base = {
    schemaVersion: 'local-academic-writing-blueprint/v1',
    id: `academic_blueprint_${checksum(`${normalized.projectId}:${normalized.version}:${normalized.idempotencyKey}`).slice(0, 28)}`,
    ...normalized,
    status: 'ready-for-draft',
    citationIntegrityPending: true,
    storesRawContent: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalAcademicWritingBlueprint(blueprint = {}, previous = null) {
  const checksumValid = checksumReceiptValid(blueprint, 'local-academic-writing-blueprint/v1');
  const linkValid = blueprint.version === 1
    ? !blueprint.previousBlueprintId && !blueprint.previousBlueprintChecksum
    : Boolean(previous && blueprint.version === previous.version + 1 && blueprint.previousBlueprintId === previous.id && blueprint.previousBlueprintChecksum === previous.checksum);
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

function normalizedCoverage(values, knownIds, field) {
  const result = [...new Set((Array.isArray(values) ? values : []).map((value) => id(value, field)))].sort();
  if (result.some((value) => !knownIds.has(value))) throw new Error(`academic-writing-${field}-invalid`);
  return result;
}

function submissionSnapshot(submission, blueprint) {
  if (!submission?.id || submission.artifactType !== 'academic-manuscript') throw new Error('academic-writing-manuscript-submission-required');
  if (submission.agentId !== blueprint.authorId) throw new Error('academic-writing-author-submission-required');
  if (!submission.artifactChecksum || !submission.artifactStorageProofChecksum) throw new Error('academic-writing-immutable-storage-proof-required');
  return {
    submissionId: id(submission.id, 'submission-id'),
    authorId: id(submission.agentId, 'submission-author-id'),
    artifactType: 'academic-manuscript',
    artifactChecksum: String(submission.artifactChecksum),
    artifactStorageProofChecksum: String(submission.artifactStorageProofChecksum),
    submissionCreatedAt: iso(submission.createdAt, 'submission-created-at'),
  };
}

export function createLocalAcademicDraftReceipt({
  blueprint, submission, coveredSectionIds = [], coveredClaimIds = [], wordCount,
  idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!checksumReceiptValid(blueprint, 'local-academic-writing-blueprint/v1')) throw new Error('academic-writing-blueprint-integrity-invalid');
  const snapshot = submissionSnapshot(submission, blueprint);
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-academic-draft-receipt/v1',
    id: `academic_draft_${checksum(`${blueprint.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: blueprint.projectId,
    blueprintId: blueprint.id,
    blueprintVersion: blueprint.version,
    blueprintChecksum: blueprint.checksum,
    draftVersion: 1,
    previousDraftId: null,
    ...snapshot,
    coveredSectionIds: normalizedCoverage(coveredSectionIds, new Set(blueprint.sections.map((row) => row.id)), 'covered-section-id'),
    coveredClaimIds: normalizedCoverage(coveredClaimIds, new Set(blueprint.claims.map((row) => row.id)), 'covered-claim-id'),
    wordCount: integer(wordCount, 'word-count', 1, 2_000_000),
    idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false,
    createdAt: iso(now, 'draft-created-at'),
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalAcademicDraftReceipt(draft = {}, blueprint = {}) {
  const checksumValid = checksumReceiptValid(draft, 'local-academic-draft-receipt/v1');
  const linkValid = draft.blueprintId === blueprint.id && draft.blueprintVersion === blueprint.version && draft.blueprintChecksum === blueprint.checksum;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function academicReviewIssueIds(review = {}) {
  return (Array.isArray(review.requestedChanges) ? review.requestedChanges : [])
    .map((change, index) => `academic_issue_${portableSha256Hex(`${review.id}:${index}:${String(change || '').trim()}`).slice(0, 28)}`);
}

function academicReviewChecksum(review = {}) {
  return checksum({
    id: id(review.id, 'review-id'),
    submissionId: id(review.submissionId, 'review-submission-id'),
    reviewerAgentId: id(review.reviewerAgentId, 'reviewer-agent-id'),
    verdict: String(review.verdict || '').trim(),
    requestedChanges: (Array.isArray(review.requestedChanges) ? review.requestedChanges : []).map((change) => String(change || '').trim()),
    createdAt: review.createdAt ? iso(review.createdAt, 'review-created-at') : null,
  });
}

export function createLocalAcademicRevisionReceipt({
  blueprint, previousDraft, submission, review, addressedIssueIds = [], coveredSectionIds = [], coveredClaimIds = [],
  wordCount, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!checksumReceiptValid(blueprint, 'local-academic-writing-blueprint/v1')) throw new Error('academic-writing-blueprint-integrity-invalid');
  if (!checksumReceiptValid(previousDraft, previousDraft.schemaVersion)) throw new Error('academic-writing-previous-draft-integrity-invalid');
  if (review?.verdict !== 'changes-requested' || review.submissionId !== previousDraft.submissionId || review.reviewerAgentId !== blueprint.reviewerId) throw new Error('academic-writing-changes-review-invalid');
  const requiredIssueIds = academicReviewIssueIds(review).sort();
  const addressed = [...new Set((Array.isArray(addressedIssueIds) ? addressedIssueIds : []).map((value) => id(value, 'addressed-issue-id')))].sort();
  if (!requiredIssueIds.length || JSON.stringify(addressed) !== JSON.stringify(requiredIssueIds)) throw new Error('academic-writing-review-issues-unresolved');
  const snapshot = submissionSnapshot(submission, blueprint);
  if (snapshot.submissionId === previousDraft.submissionId || Date.parse(snapshot.submissionCreatedAt) <= Date.parse(previousDraft.submissionCreatedAt)) throw new Error('academic-writing-revision-must-be-newer');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-academic-revision-receipt/v1',
    id: `academic_revision_${checksum(`${previousDraft.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: blueprint.projectId,
    blueprintId: blueprint.id,
    blueprintVersion: blueprint.version,
    blueprintChecksum: blueprint.checksum,
    draftVersion: integer(previousDraft.draftVersion, 'previous-draft-version', 1, 10_000) + 1,
    previousDraftId: previousDraft.id,
    previousDraftChecksum: previousDraft.checksum,
    reviewId: id(review.id, 'review-id'),
    reviewChecksum: academicReviewChecksum(review),
    requiredIssueIds,
    addressedIssueIds: addressed,
    ...snapshot,
    coveredSectionIds: normalizedCoverage(coveredSectionIds, new Set(blueprint.sections.map((row) => row.id)), 'covered-section-id'),
    coveredClaimIds: normalizedCoverage(coveredClaimIds, new Set(blueprint.claims.map((row) => row.id)), 'covered-claim-id'),
    wordCount: integer(wordCount, 'word-count', 1, 2_000_000),
    idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false,
    createdAt: iso(now, 'revision-created-at'),
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalAcademicRevisionReceipt(revision = {}, blueprint = {}, previousDraft = {}, review = {}) {
  const checksumValid = checksumReceiptValid(revision, 'local-academic-revision-receipt/v1');
  const linkValid = revision.blueprintId === blueprint.id && revision.blueprintChecksum === blueprint.checksum
    && revision.previousDraftId === previousDraft.id && revision.previousDraftChecksum === previousDraft.checksum
    && revision.reviewId === review.id && revision.reviewChecksum === academicReviewChecksum(review);
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function createLocalAcademicFinalization({
  blueprint, latestDraft, acceptedReview, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!checksumReceiptValid(blueprint, 'local-academic-writing-blueprint/v1') || !checksumReceiptValid(latestDraft, latestDraft?.schemaVersion)) throw new Error('academic-writing-finalization-lineage-invalid');
  if (acceptedReview?.verdict !== 'accepted' || acceptedReview.submissionId !== latestDraft.submissionId
    || acceptedReview.reviewerAgentId !== blueprint.reviewerId) throw new Error('academic-writing-accepted-review-required');
  const sectionIds = blueprint.sections.map((row) => row.id).sort();
  const claimIds = blueprint.claims.map((row) => row.id).sort();
  if (JSON.stringify([...latestDraft.coveredSectionIds].sort()) !== JSON.stringify(sectionIds)
    || JSON.stringify([...latestDraft.coveredClaimIds].sort()) !== JSON.stringify(claimIds)) throw new Error('academic-writing-final-coverage-incomplete');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-academic-finalization/v1',
    id: `academic_finalization_${checksum(`${latestDraft.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: blueprint.projectId,
    blueprintId: blueprint.id,
    blueprintChecksum: blueprint.checksum,
    latestDraftId: latestDraft.id,
    latestDraftChecksum: latestDraft.checksum,
    submissionId: latestDraft.submissionId,
    artifactChecksum: latestDraft.artifactChecksum,
    artifactStorageProofChecksum: latestDraft.artifactStorageProofChecksum,
    acceptedReviewId: id(acceptedReview.id, 'accepted-review-id'),
    acceptedReviewChecksum: academicReviewChecksum(acceptedReview),
    reviewerId: blueprint.reviewerId,
    sectionCoverageCount: sectionIds.length,
    claimCoverageCount: claimIds.length,
    readyForCitationIntegrityAudit: true,
    readyForProduction: false,
    idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false,
    createdAt: iso(now, 'finalization-created-at'),
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalAcademicFinalization(finalization = {}, blueprint = {}, latestDraft = {}, acceptedReview = {}) {
  const checksumValid = checksumReceiptValid(finalization, 'local-academic-finalization/v1');
  const linkValid = finalization.blueprintId === blueprint.id && finalization.blueprintChecksum === blueprint.checksum
    && finalization.latestDraftId === latestDraft.id && finalization.latestDraftChecksum === latestDraft.checksum
    && finalization.acceptedReviewId === acceptedReview.id && finalization.acceptedReviewChecksum === academicReviewChecksum(acceptedReview);
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

export function buildLocalAcademicWritingPipeline({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = iso(now, 'generated-at');
  const backendRoutes = {
    academicWritingPipeline: project.id ? `/projects/${project.id}/academic-writing-pipeline` : null,
    blueprints: project.id ? `/projects/${project.id}/academic-writing-pipeline/blueprints` : null,
    drafts: project.id ? `/projects/${project.id}/academic-writing-pipeline/drafts` : null,
    finalize: project.id ? `/projects/${project.id}/academic-writing-pipeline/finalize` : null,
  };
  if (project.workModeContract?.workMode !== 'academic-writing') return {
    schemaVersion: 'local-academic-writing-pipeline/v1', projectId: project.id || null, generatedAt,
    status: 'academic-writing-work-mode-required', blueprint: null, backendRoutes,
    integrity: { valid: true, blueprintRows: [], draftRows: [], revisionRows: [], finalizationRows: [] }, readyForLocalWriting: false, readyForProduction: false,
  };
  const blueprints = [...(project.localAcademicWritingBlueprints || [])].sort((a, b) => a.version - b.version);
  if (!blueprints.length) return {
    schemaVersion: 'local-academic-writing-pipeline/v1', projectId: project.id, generatedAt,
    status: 'blueprint-required', blueprint: null, backendRoutes,
    integrity: { valid: true, blueprintRows: [], draftRows: [], revisionRows: [], finalizationRows: [] }, readyForLocalWriting: false, readyForProduction: false,
  };
  const blueprintRows = blueprints.map((row, index) => ({ id: row.id, ...verifyLocalAcademicWritingBlueprint(row, index ? blueprints[index - 1] : null) }));
  const blueprintById = new Map(blueprints.map((row) => [row.id, row]));
  const drafts = project.localAcademicDraftReceipts || [];
  const draftRows = drafts.map((row) => ({ id: row.id, ...verifyLocalAcademicDraftReceipt(row, blueprintById.get(row.blueprintId) || {}) }));
  const allDrafts = [...drafts];
  const draftById = new Map(drafts.map((row) => [row.id, row]));
  const revisions = [...(project.localAcademicRevisionReceipts || [])].sort((a, b) => a.draftVersion - b.draftVersion);
  const revisionRows = revisions.map((row) => {
    const previous = draftById.get(row.previousDraftId) || allDrafts.find((item) => item.id === row.previousDraftId) || {};
    const checksumValid = checksumReceiptValid(row, 'local-academic-revision-receipt/v1');
    const linkValid = row.previousDraftId === previous.id && row.previousDraftChecksum === previous.checksum;
    allDrafts.push(row);
    draftById.set(row.id, row);
    return { id: row.id, valid: checksumValid && linkValid, checksumValid, linkValid };
  });
  const finalizations = project.localAcademicFinalizations || [];
  const finalizationRows = finalizations.map((row) => {
    const latestDraft = draftById.get(row.latestDraftId) || {};
    const checksumValid = checksumReceiptValid(row, 'local-academic-finalization/v1');
    const linkValid = row.latestDraftId === latestDraft.id && row.latestDraftChecksum === latestDraft.checksum;
    return { id: row.id, valid: checksumValid && linkValid, checksumValid, linkValid };
  });
  const integrityValid = [...blueprintRows, ...draftRows, ...revisionRows, ...finalizationRows].every((row) => row.valid);
  const blueprint = blueprints.at(-1);
  const latestDraft = [...drafts, ...revisions].sort((a, b) => b.draftVersion - a.draftVersion)[0] || null;
  const finalization = finalizations[0] || null;
  return {
    schemaVersion: 'local-academic-writing-pipeline/v1',
    projectId: project.id,
    generatedAt,
    status: !integrityValid ? 'degraded-integrity-invalid' : finalization ? 'finalized-awaiting-citation-integrity' : latestDraft ? 'draft-or-revision-in-progress' : 'blueprint-ready',
    blueprint,
    latestDraft,
    finalization,
    summary: {
      blueprintVersion: blueprint.version,
      sectionCount: blueprint.sections.length,
      claimCount: blueprint.claims.length,
      draftVersionCount: drafts.length + revisions.length,
      revisionCount: revisions.length,
      finalizedCount: finalizations.length,
    },
    citationIntegrityPending: true,
    backendRoutes,
    integrity: { valid: integrityValid, blueprintRows, draftRows, revisionRows, finalizationRows },
    readyForLocalWriting: integrityValid,
    readyForCitationIntegrityAudit: Boolean(integrityValid && finalization),
    readyForProduction: false,
  };
}
