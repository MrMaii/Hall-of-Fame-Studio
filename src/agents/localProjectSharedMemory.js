import { createHash } from 'node:crypto';

const MEMORY_KINDS = new Set(['fact', 'decision', 'preference', 'constraint', 'lesson']);
const CONFIDENCE_BASES = new Set(['observed', 'verified', 'inferred', 'reported']);
const CITATION_TYPES = new Set(['task', 'submission', 'evidence-search', 'transcript-message', 'event']);
const VISIBILITIES = new Set(['project', 'team', 'management', 'agents']);
const GOVERNANCE_ROLES = new Set(['manager', 'security-admin']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function localProjectMemoryChecksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function identifier(value, field, { optional = false } = {}) {
  const normalized = String(value || '').trim();
  if (!normalized && optional) return null;
  if (!normalized || normalized.length > 180 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(normalized)) {
    throw new Error(`project-memory-${field}-invalid`);
  }
  return normalized;
}

function timestamp(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`project-memory-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function normalizeCitations(citations = []) {
  if (!Array.isArray(citations) || !citations.length || citations.length > 24) {
    throw new Error('project-memory-citation-required');
  }
  const rows = citations.map((citation = {}) => {
    const sourceType = String(citation.sourceType || '').trim();
    if (!CITATION_TYPES.has(sourceType)) throw new Error('project-memory-citation-type-invalid');
    const sourceChecksum = citation.sourceChecksum
      ? String(citation.sourceChecksum).trim().toLowerCase()
      : null;
    if (sourceChecksum && !/^[a-f0-9]{64}$/.test(sourceChecksum)) {
      throw new Error('project-memory-citation-checksum-invalid');
    }
    return {
      sourceType,
      sourceId: identifier(citation.sourceId, 'citation-source-id'),
      sourceChecksum,
    };
  });
  const unique = new Map(rows.map((row) => [`${row.sourceType}:${row.sourceId}`, row]));
  return [...unique.values()].sort((left, right) => (
    `${left.sourceType}:${left.sourceId}`.localeCompare(`${right.sourceType}:${right.sourceId}`)
  ));
}

function normalizeAccessScope(scope = {}) {
  const visibility = String(scope.visibility || 'project').trim();
  if (!VISIBILITIES.has(visibility)) throw new Error('project-memory-access-visibility-invalid');
  const agentIds = [...new Set((Array.isArray(scope.agentIds) ? scope.agentIds : [])
    .map((value) => identifier(value, 'access-agent-id')))].sort();
  if (visibility === 'agents' && !agentIds.length) throw new Error('project-memory-access-agent-required');
  if (visibility !== 'agents' && agentIds.length) throw new Error('project-memory-access-agent-scope-invalid');
  return { visibility, agentIds };
}

function contentValue(value) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > 20_000) throw new Error('project-memory-content-invalid');
  return normalized;
}

export function createLocalProjectMemoryEntry({
  projectId,
  memoryKey,
  kind = 'fact',
  content,
  citations,
  confidence,
  confidenceBasis,
  expiresAt,
  accessScope,
  version = 1,
  previousVersionId = null,
  previousVersionChecksum = null,
  actorId,
  idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  const createdAt = timestamp(now, 'created-at');
  const normalizedExpiresAt = timestamp(expiresAt, 'expires-at');
  const ttlMs = Date.parse(normalizedExpiresAt) - Date.parse(createdAt);
  if (ttlMs < 5 * 60_000 || ttlMs > 366 * 24 * 60 * 60_000) {
    throw new Error('project-memory-expiry-window-invalid');
  }
  const normalizedKind = String(kind || '').trim();
  if (!MEMORY_KINDS.has(normalizedKind)) throw new Error('project-memory-kind-invalid');
  const normalizedBasis = String(confidenceBasis || '').trim();
  if (!CONFIDENCE_BASES.has(normalizedBasis)) throw new Error('project-memory-confidence-basis-invalid');
  const normalizedConfidence = Number(confidence);
  if (!Number.isFinite(normalizedConfidence) || normalizedConfidence < 0 || normalizedConfidence > 1) {
    throw new Error('project-memory-confidence-invalid');
  }
  const normalizedVersion = Number(version);
  if (!Number.isInteger(normalizedVersion) || normalizedVersion < 1) throw new Error('project-memory-version-invalid');
  const normalizedPreviousVersionId = identifier(previousVersionId, 'previous-version-id', { optional: true });
  const normalizedPreviousChecksum = previousVersionChecksum ? String(previousVersionChecksum).trim().toLowerCase() : null;
  if ((normalizedVersion === 1 && (normalizedPreviousVersionId || normalizedPreviousChecksum))
    || (normalizedVersion > 1 && (!normalizedPreviousVersionId || !/^[a-f0-9]{64}$/.test(normalizedPreviousChecksum || '')))) {
    throw new Error('project-memory-version-link-invalid');
  }
  const normalizedContent = contentValue(content);
  const normalized = {
    projectId: identifier(projectId, 'project-id'),
    memoryKey: identifier(memoryKey, 'key'),
    kind: normalizedKind,
    content: normalizedContent,
    contentChecksum: createHash('sha256').update(normalizedContent, 'utf8').digest('hex'),
    citations: normalizeCitations(citations),
    confidence: normalizedConfidence,
    confidenceBasis: normalizedBasis,
    expiresAt: normalizedExpiresAt,
    accessScope: normalizeAccessScope(accessScope),
    version: normalizedVersion,
    previousVersionId: normalizedPreviousVersionId,
    previousVersionChecksum: normalizedPreviousChecksum,
    actorId: identifier(actorId, 'actor-id'),
    idempotencyKey: identifier(idempotencyKey, 'idempotency-key'),
  };
  const base = {
    schemaVersion: 'local-project-memory-entry/v1',
    id: `project_memory_${localProjectMemoryChecksum(`${normalized.projectId}:${normalized.memoryKey}:${normalized.version}:${normalized.idempotencyKey}`).slice(0, 28)}`,
    ...normalized,
    storesRawContent: true,
    createdAt,
  };
  return { ...base, checksum: localProjectMemoryChecksum(base) };
}

export function verifyLocalProjectMemoryEntry(entry = {}, previousEntry = null) {
  const { checksum, ...base } = entry;
  const checksumValid = Boolean(checksum) && checksum === localProjectMemoryChecksum(base);
  const schemaValid = entry.schemaVersion === 'local-project-memory-entry/v1';
  const contentValid = Boolean(entry.content)
    && entry.contentChecksum === createHash('sha256').update(String(entry.content), 'utf8').digest('hex');
  const citationValid = Array.isArray(entry.citations) && entry.citations.length > 0;
  const confidenceValid = Number.isFinite(entry.confidence) && entry.confidence >= 0 && entry.confidence <= 1;
  const expiryValid = Number.isFinite(Date.parse(entry.expiresAt)) && Date.parse(entry.expiresAt) > Date.parse(entry.createdAt);
  const versionLinkValid = entry.version === 1
    ? !entry.previousVersionId && !entry.previousVersionChecksum
    : Boolean(previousEntry
      && entry.version === previousEntry.version + 1
      && entry.memoryKey === previousEntry.memoryKey
      && entry.projectId === previousEntry.projectId
      && entry.previousVersionId === previousEntry.id
      && entry.previousVersionChecksum === previousEntry.checksum);
  return {
    valid: checksumValid && schemaValid && contentValid && citationValid && confidenceValid && expiryValid && versionLinkValid,
    checksumValid,
    schemaValid,
    contentValid,
    citationValid,
    confidenceValid,
    expiryValid,
    versionLinkValid,
  };
}

export function createLocalProjectMemoryRevocation({
  projectId,
  memoryId,
  memoryChecksum,
  reasonCode,
  actorId,
  idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  const normalizedMemoryChecksum = String(memoryChecksum || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedMemoryChecksum)) throw new Error('project-memory-revocation-checksum-invalid');
  const normalized = {
    projectId: identifier(projectId, 'project-id'),
    memoryId: identifier(memoryId, 'memory-id'),
    memoryChecksum: normalizedMemoryChecksum,
    reasonCode: identifier(reasonCode, 'revocation-reason-code'),
    actorId: identifier(actorId, 'actor-id'),
    idempotencyKey: identifier(idempotencyKey, 'idempotency-key'),
  };
  const base = {
    schemaVersion: 'local-project-memory-revocation/v1',
    id: `project_memory_revocation_${localProjectMemoryChecksum(`${normalized.projectId}:${normalized.memoryId}:${normalized.idempotencyKey}`).slice(0, 28)}`,
    ...normalized,
    storesRawContent: false,
    createdAt: timestamp(now, 'revoked-at'),
  };
  return { ...base, checksum: localProjectMemoryChecksum(base) };
}

export function verifyLocalProjectMemoryRevocation(revocation = {}, entry = null) {
  const { checksum, ...base } = revocation;
  const checksumValid = Boolean(checksum) && checksum === localProjectMemoryChecksum(base);
  const schemaValid = revocation.schemaVersion === 'local-project-memory-revocation/v1';
  const targetValid = Boolean(entry
    && revocation.projectId === entry.projectId
    && revocation.memoryId === entry.id
    && revocation.memoryChecksum === entry.checksum);
  return { valid: checksumValid && schemaValid && targetValid, checksumValid, schemaValid, targetValid };
}

function canRead(entry = {}, actor = {}) {
  const role = String(actor.role || '').trim().toLowerCase();
  if (GOVERNANCE_ROLES.has(role)) return true;
  const visibility = entry.accessScope?.visibility;
  if (visibility === 'project') return true;
  if (visibility === 'team') return ['agent', 'reviewer-agent', 'runtime-platform'].includes(role);
  if (visibility === 'management') return false;
  if (visibility === 'agents') {
    const agentId = String(actor.agentId || '').trim();
    return Boolean(agentId && entry.accessScope.agentIds.includes(agentId));
  }
  return false;
}

export function buildLocalProjectSharedMemory({
  project = {},
  actor = {},
  now = new Date().toISOString(),
  includeHistory = false,
  includeContents = true,
} = {}) {
  const generatedAt = timestamp(now, 'generated-at');
  const entries = Array.isArray(project.localProjectMemoryEntries) ? project.localProjectMemoryEntries : [];
  const revocations = Array.isArray(project.localProjectMemoryRevocations) ? project.localProjectMemoryRevocations : [];
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.memoryKey)) groups.set(entry.memoryKey, []);
    groups.get(entry.memoryKey).push(entry);
  }
  for (const rows of groups.values()) rows.sort((left, right) => left.version - right.version);
  const conflictMemoryKeys = [...groups.entries()].filter(([, rows]) => (
    rows.some((entry, index) => (
      entry.version !== index + 1
      || (index > 0 && (
        entry.previousVersionId !== rows[index - 1].id
        || entry.previousVersionChecksum !== rows[index - 1].checksum
      ))
    ))
  )).map(([memoryKey]) => memoryKey).sort();
  const entryIntegrity = entries.map((entry) => {
    const previous = entry.version > 1 ? entriesById.get(entry.previousVersionId) || null : null;
    return { id: entry.id, ...verifyLocalProjectMemoryEntry(entry, previous) };
  });
  const revocationIntegrity = revocations.map((receipt) => ({
    id: receipt.id,
    ...verifyLocalProjectMemoryRevocation(receipt, entriesById.get(receipt.memoryId) || null),
  }));
  const revokedIds = new Set(revocations.filter((receipt, index) => revocationIntegrity[index]?.valid).map((receipt) => receipt.memoryId));
  const latestIds = new Set([...groups.values()].map((rows) => rows.at(-1)?.id).filter(Boolean));
  const projected = entries.map((entry) => {
    const integrity = entryIntegrity.find((row) => row.id === entry.id);
    const revoked = revokedIds.has(entry.id);
    const expired = Date.parse(entry.expiresAt) <= Date.parse(generatedAt);
    const superseded = !latestIds.has(entry.id);
    const status = !integrity?.valid
      ? 'integrity-invalid'
      : revoked
        ? 'revoked'
        : superseded
          ? 'superseded'
          : expired
            ? 'expired'
            : 'active';
    return {
      id: entry.id,
      projectId: entry.projectId,
      memoryKey: entry.memoryKey,
      kind: entry.kind,
      ...(includeContents ? { content: entry.content } : {}),
      contentChecksum: entry.contentChecksum,
      citations: entry.citations,
      confidence: entry.confidence,
      confidenceBasis: entry.confidenceBasis,
      expiresAt: entry.expiresAt,
      accessScope: entry.accessScope,
      version: entry.version,
      previousVersionId: entry.previousVersionId,
      previousVersionChecksum: entry.previousVersionChecksum,
      actorId: entry.actorId,
      createdAt: entry.createdAt,
      checksum: entry.checksum,
      status,
      usableForAutonomy: status === 'active' && entry.confidence >= 0.75,
      integrity,
    };
  });
  const candidates = includeHistory ? projected : projected.filter((row) => latestIds.has(row.id) && row.status === 'active');
  const visible = candidates.filter((row) => canRead(row, actor));
  const hiddenCount = candidates.length - visible.length;
  const integrityValid = conflictMemoryKeys.length === 0
    && entryIntegrity.every((row) => row.valid)
    && revocationIntegrity.every((row) => row.valid);
  const allStatusRows = projected;
  const checksum = localProjectMemoryChecksum({
    schemaVersion: 'local-project-shared-memory/v1',
    projectId: project.id,
    entries: entries.map((entry) => [entry.id, entry.memoryKey, entry.version, entry.contentChecksum, entry.checksum]),
    revocations: revocations.map((receipt) => [receipt.id, receipt.memoryId, receipt.checksum]),
    entryIntegrity: entryIntegrity.map((row) => [row.id, row.valid]),
    revocationIntegrity: revocationIntegrity.map((row) => [row.id, row.valid]),
    conflictMemoryKeys,
  });
  return {
    schemaVersion: 'local-project-shared-memory/v1',
    projectId: identifier(project.id, 'project-id'),
    generatedAt,
    status: !integrityValid
      ? 'degraded-integrity-invalid'
      : allStatusRows.some((row) => row.status === 'expired' || (row.status === 'active' && !row.usableForAutonomy))
        ? 'attention-required'
        : 'shared-memory-ready',
    rows: visible,
    summary: {
      memoryKeyCount: groups.size,
      versionCount: entries.length,
      activeCount: allStatusRows.filter((row) => row.status === 'active').length,
      expiredCount: allStatusRows.filter((row) => row.status === 'expired').length,
      revokedCount: allStatusRows.filter((row) => row.status === 'revoked').length,
      supersededCount: allStatusRows.filter((row) => row.status === 'superseded').length,
      lowConfidenceActiveCount: allStatusRows.filter((row) => row.status === 'active' && !row.usableForAutonomy).length,
      visibleCount: visible.length,
      hiddenCount,
      conflictCount: conflictMemoryKeys.length,
      checksum,
    },
    integrity: { valid: integrityValid, conflictMemoryKeys, entryRows: entryIntegrity, revocationRows: revocationIntegrity },
    backendRoutes: {
      sharedMemories: `/projects/${project.id}/shared-memories`,
      memory: `/projects/${project.id}/shared-memories/:memoryId`,
      revisions: `/projects/${project.id}/shared-memories/:memoryId/revisions`,
      revoke: `/projects/${project.id}/shared-memories/:memoryId/revoke`,
      memoryReadiness: `/projects/${project.id}/memory-readiness`,
    },
    readyForLocalMvp: integrityValid,
    readyForProduction: false,
    checksum,
  };
}
