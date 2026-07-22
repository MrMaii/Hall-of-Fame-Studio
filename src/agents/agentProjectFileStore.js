import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgentProjectMemoryStore } from './agentProjectStore.js';
import { replaceFileWithRetry } from './atomicFileReplace.js';
import { createLocalRateLimitLedger } from './localRateLimitLedger.js';

const STORE_VERSION = 2;
const SECURITY_AUDIT_LOG_VERSION = 1;
const SECURITY_AUDIT_STREAM_GENESIS_HASH = 'stream_genesis_v1';
const SECURITY_AUDIT_CHECKPOINT_GENESIS_HASH = '0'.repeat(64);
const SNAPSHOT_MIGRATIONS = new Map([
  [1, {
    up: (snapshot) => snapshot,
    down: (snapshot) => snapshot,
    validate: (snapshot) => Boolean(snapshot && ['projects', 'messages', 'kickoffMeetings', 'securityAccessAuditRecords', 'accessReplayRecords']
      .every((field) => Array.isArray(snapshot[field]))),
  }],
]);

function sha256(value = '') {
  return createHash('sha256').update(String(value)).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function stableAuditChecksum(value) {
  const text = stableJson(value);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  return `chk_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function auditStreamChecksumPayload(record = {}) {
  const payload = {
    id: record.id,
    projectId: record.projectId,
    streamType: record.streamType,
    streamSequence: record.streamSequence,
    method: record.method,
    path: record.path,
    routeKey: record.routeKey,
    allowed: record.allowed,
    status: record.status,
    actor: record.actor,
    replay: record.replay,
    membership: record.membership,
    identitySession: record.identitySession,
    time: record.time,
  };
  if (record.traceId) payload.traceId = record.traceId;
  if (record.auditScope) payload.auditScope = record.auditScope;
  if (record.scopeId) payload.scopeId = record.scopeId;
  if (record.authentication) payload.authentication = record.authentication;
  return payload;
}

function verifySecurityAuditRecords(records = []) {
  const duplicateIds = records.map((row) => row.id).filter((id, index, ids) => !id || ids.indexOf(id) !== index);
  const findings = duplicateIds.map((id) => ({ code: 'duplicate-record-id', targetId: id || 'missing' }));
  const scopes = new Map();
  records.forEach((record) => {
    const scopeId = record.scopeId || record.projectId || 'local-runtime';
    if (!scopes.has(scopeId)) scopes.set(scopeId, []);
    scopes.get(scopeId).push(record);
  });
  const scopeRoots = {};
  scopes.forEach((rows, scopeId) => {
    rows.sort((left, right) => Number(left.streamSequence || 0) - Number(right.streamSequence || 0));
    let previousHash = SECURITY_AUDIT_STREAM_GENESIS_HASH;
    rows.forEach((record, index) => {
      const expectedSequence = index + 1;
      const expectedChecksum = stableAuditChecksum(auditStreamChecksumPayload(record));
      const expectedHash = stableAuditChecksum({ ...auditStreamChecksumPayload(record), previousStreamHash: record.previousStreamHash || SECURITY_AUDIT_STREAM_GENESIS_HASH, streamChecksum: record.streamChecksum || expectedChecksum });
      if (record.streamSequence !== expectedSequence) findings.push({ code: 'stream-sequence-gap', targetId: record.id, scopeId });
      if (record.previousStreamHash !== previousHash) findings.push({ code: 'stream-previous-hash-mismatch', targetId: record.id, scopeId });
      if (record.streamChecksum !== expectedChecksum) findings.push({ code: 'stream-checksum-mismatch', targetId: record.id, scopeId });
      if (record.streamHash !== expectedHash) findings.push({ code: 'stream-hash-mismatch', targetId: record.id, scopeId });
      previousHash = record.streamHash;
    });
    scopeRoots[scopeId] = { recordCount: rows.length, firstSequence: rows[0]?.streamSequence || null, lastSequence: rows.at(-1)?.streamSequence || null, latestStreamHash: rows.at(-1)?.streamHash || null };
  });
  findings.sort((a, b) => `${a.scopeId}:${a.code}:${a.targetId}`.localeCompare(`${b.scopeId}:${b.code}:${b.targetId}`));
  return { valid: findings.length === 0, findings, scopeRoots };
}

function securityAuditCheckpointDirectory(filePath) {
  return `${filePath}.security-audit-checkpoints`;
}

function checkpointHash(checkpoint = {}) {
  const { checkpointHash: _checkpointHash, ...base } = checkpoint;
  return sha256(JSON.stringify(base));
}

function readSecurityAuditCheckpoints(filePath) {
  const directory = securityAuditCheckpointDirectory(filePath);
  if (!existsSync(directory)) return [];
  const checkpoints = readdirSync(directory).filter((name) => name.endsWith('.checkpoint.json')).map((name) => {
    let checkpoint;
    try {
      checkpoint = JSON.parse(readFileSync(join(directory, name), 'utf8'));
    } catch {
      throw new Error('security-audit-checkpoint-manifest-invalid');
    }
    if (checkpoint.schemaVersion !== 'local-security-audit-checkpoint/v1' || checkpoint.checkpointHash !== checkpointHash(checkpoint)) throw new Error('security-audit-checkpoint-manifest-invalid');
    return checkpoint;
  }).sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  let previousCheckpointHash = SECURITY_AUDIT_CHECKPOINT_GENESIS_HASH;
  checkpoints.forEach((checkpoint) => {
    if (checkpoint.previousCheckpointHash !== previousCheckpointHash) throw new Error('security-audit-checkpoint-chain-invalid');
    previousCheckpointHash = checkpoint.checkpointHash;
  });
  return checkpoints;
}

function writeSecurityAuditCheckpoint(filePath, records, { now = new Date().toISOString(), retentionDays = 365 } = {}) {
  const verification = verifySecurityAuditRecords(records);
  if (!verification.valid) throw new Error('security-audit-stream-integrity-invalid');
  const directory = securityAuditCheckpointDirectory(filePath);
  mkdirSync(directory, { recursive: true });
  const createdAt = new Date(Date.parse(now) || Date.now()).toISOString();
  const normalizedRetentionDays = Math.max(1, Math.min(3650, Number(retentionDays) || 365));
  const archiveText = records.map((record) => JSON.stringify({ auditLogVersion: SECURITY_AUDIT_LOG_VERSION, checkpointedAt: createdAt, record })).join('\n') + (records.length ? '\n' : '');
  const archiveChecksum = sha256(archiveText);
  const id = `audit_checkpoint_${sha256(`${createdAt}:${archiveChecksum}`).slice(0, 24)}`;
  const archivePath = join(directory, `${id}.jsonl`);
  const checkpoints = readSecurityAuditCheckpoints(filePath);
  const existingCheckpoint = checkpoints.find((row) => row.id === id);
  if (existingCheckpoint) {
    readCheckpointArchive(existingCheckpoint);
    if (existingCheckpoint.archiveChecksum !== archiveChecksum || existingCheckpoint.recordCount !== records.length) throw new Error('security-audit-checkpoint-idempotency-conflict');
    return { ...existingCheckpoint, idempotent: true };
  }
  if (existsSync(archivePath) && sha256(readFileSync(archivePath, 'utf8')) !== archiveChecksum) throw new Error('security-audit-checkpoint-archive-conflict');
  if (!existsSync(archivePath)) {
    const tempPath = `${archivePath}.tmp`;
    writeFileSync(tempPath, archiveText, 'utf8');
    replaceFileWithRetry(tempPath, archivePath);
  }
  const previous = checkpoints.at(-1) || null;
  const base = {
    schemaVersion: 'local-security-audit-checkpoint/v1', id, status: 'committed', recordCount: records.length,
    scopeRoots: verification.scopeRoots, archivePath, archiveChecksum,
    previousCheckpointHash: previous?.checkpointHash || SECURITY_AUDIT_CHECKPOINT_GENESIS_HASH,
    retentionDays: normalizedRetentionDays,
    retainUntil: new Date(Date.parse(createdAt) + normalizedRetentionDays * 86_400_000).toISOString(),
    createdAt,
    localOnly: true,
    externalWormStorage: false,
  };
  const checkpoint = { ...base, checkpointHash: checkpointHash(base) };
  writeJsonAtomic(join(directory, `${id}.checkpoint.json`), checkpoint);
  return checkpoint;
}

function readCheckpointArchive(checkpoint = {}) {
  if (!checkpoint.archivePath || !existsSync(checkpoint.archivePath)) throw new Error('security-audit-checkpoint-archive-invalid');
  const raw = readFileSync(checkpoint.archivePath, 'utf8');
  if (sha256(raw) !== checkpoint.archiveChecksum) throw new Error('security-audit-checkpoint-archive-invalid');
  const details = readSecurityAuditLogDetails(checkpoint.archivePath);
  const verification = verifySecurityAuditRecords(details.records);
  if (details.malformedLineCount || details.records.length !== checkpoint.recordCount || !verification.valid
    || JSON.stringify(verification.scopeRoots) !== JSON.stringify(checkpoint.scopeRoots)) throw new Error('security-audit-checkpoint-archive-invalid');
  return { raw, records: details.records, verification };
}

function securityAuditRecoveryLogPath(filePath) {
  return `${filePath}.security-audit-recoveries.jsonl`;
}

function auditRecoveryReceiptChecksum(receipt = {}) {
  const { checksum: _checksum, ...base } = receipt;
  return sha256(JSON.stringify(base));
}

function readSecurityAuditRecoveryReceipts(filePath) {
  const path = securityAuditRecoveryLogPath(filePath);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  if (!raw.trim()) return [];
  return raw.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    let receipt;
    try {
      receipt = JSON.parse(line);
    } catch {
      throw new Error('security-audit-recovery-receipt-invalid');
    }
    if (receipt.schemaVersion !== 'local-security-audit-recovery/v1' || receipt.checksum !== auditRecoveryReceiptChecksum(receipt)) throw new Error('security-audit-recovery-receipt-invalid');
    return receipt;
  });
}

function eventCheckpointDirectory(filePath, projectId) {
  return join(`${filePath}.event-checkpoints`, sha256(projectId).slice(0, 24));
}

function eventRecoveryDirectory(filePath, projectId) {
  return join(`${filePath}.event-recoveries`, sha256(projectId).slice(0, 24));
}

function eventRecoveryQuarantineDirectory(filePath, projectId) {
  return join(`${filePath}.event-recovery-quarantine`, sha256(projectId).slice(0, 24));
}

function eventDocumentChecksum(document = {}, checksumField = 'checksum') {
  const { [checksumField]: _checksum, ...base } = document;
  return sha256(stableJson(base));
}

function readEventCheckpoint(filePath, projectId, checkpointId) {
  const normalizedId = String(checkpointId || '').trim();
  if (!/^event_checkpoint_[a-f0-9]{24}$/.test(normalizedId)) throw new Error('project-event-checkpoint-id-invalid');
  const path = join(eventCheckpointDirectory(filePath, projectId), `${normalizedId}.json`);
  if (!existsSync(path)) throw new Error('project-event-checkpoint-not-found');
  let checkpoint;
  try {
    checkpoint = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('project-event-checkpoint-invalid');
  }
  if (checkpoint.schemaVersion !== 'local-project-event-checkpoint/v1'
    || checkpoint.projectId !== projectId
    || checkpoint.checksum !== eventDocumentChecksum(checkpoint)) throw new Error('project-event-checkpoint-invalid');
  return checkpoint;
}

function listEventCheckpoints(filePath, projectId) {
  const directory = eventCheckpointDirectory(filePath, projectId);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => /^event_checkpoint_[a-f0-9]{24}\.json$/.test(name))
    .map((name) => readEventCheckpoint(filePath, projectId, name.slice(0, -5)))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

function writeEventCheckpoint(filePath, { projectId, eventSnapshot, actorId = null, now = new Date().toISOString() } = {}) {
  if (!projectId || !eventSnapshot || !Array.isArray(eventSnapshot.eventLedger)) throw new Error('project-event-checkpoint-input-invalid');
  const contentChecksum = sha256(stableJson(eventSnapshot));
  const id = `event_checkpoint_${sha256(`${projectId}:${eventSnapshot.eventLedgerRootHash}:${eventSnapshot.eventLedgerLastSequence}:${contentChecksum}`).slice(0, 24)}`;
  const directory = eventCheckpointDirectory(filePath, projectId);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${id}.json`);
  if (existsSync(path)) {
    const existing = readEventCheckpoint(filePath, projectId, id);
    if (existing.contentChecksum !== contentChecksum) throw new Error('project-event-checkpoint-idempotency-conflict');
    return { ...existing, idempotent: true };
  }
  const base = {
    schemaVersion: 'local-project-event-checkpoint/v1',
    id,
    projectId,
    status: 'committed',
    eventSnapshot,
    contentChecksum,
    actorId,
    createdAt: new Date(Date.parse(now) || Date.now()).toISOString(),
    localOnly: true,
    externalWormStorage: false,
  };
  const checkpoint = { ...base, checksum: eventDocumentChecksum(base) };
  writeJsonAtomic(path, checkpoint);
  return { ...checkpoint, idempotent: false };
}

function readEventRecoveryReceipt(filePath, projectId, operationId) {
  const normalizedOperationId = String(operationId || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(normalizedOperationId)) throw new Error('project-event-recovery-operation-id-invalid');
  const path = join(eventRecoveryDirectory(filePath, projectId), `${sha256(normalizedOperationId)}.json`);
  if (!existsSync(path)) return null;
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('project-event-recovery-receipt-invalid');
  }
  if (receipt.schemaVersion !== 'local-project-event-recovery/v1'
    || receipt.projectId !== projectId
    || receipt.operationId !== normalizedOperationId
    || receipt.checksum !== eventDocumentChecksum(receipt)) throw new Error('project-event-recovery-receipt-invalid');
  return receipt;
}

function listEventRecoveryReceipts(filePath, projectId) {
  const directory = eventRecoveryDirectory(filePath, projectId);
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((name) => /^[a-f0-9]{64}\.json$/.test(name)).map((name) => {
    let receipt;
    try {
      receipt = JSON.parse(readFileSync(join(directory, name), 'utf8'));
    } catch {
      throw new Error('project-event-recovery-receipt-invalid');
    }
    return readEventRecoveryReceipt(filePath, projectId, receipt.operationId);
  }).sort((left, right) => Date.parse(left.recoveredAt) - Date.parse(right.recoveredAt));
}

function writeEventRecoveryQuarantine(filePath, { projectId, operationId, checkpointId, eventSnapshot, now = new Date().toISOString() } = {}) {
  if (!projectId || !eventSnapshot || !Array.isArray(eventSnapshot.eventLedger)) throw new Error('project-event-recovery-quarantine-input-invalid');
  const normalizedOperationId = String(operationId || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(normalizedOperationId)) throw new Error('project-event-recovery-operation-id-invalid');
  const directory = eventRecoveryQuarantineDirectory(filePath, projectId);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${sha256(normalizedOperationId)}.json`);
  const contentChecksum = sha256(stableJson(eventSnapshot));
  if (existsSync(path)) {
    let existing;
    try {
      existing = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      throw new Error('project-event-recovery-quarantine-invalid');
    }
    if (existing.schemaVersion !== 'local-project-event-quarantine/v1'
      || existing.projectId !== projectId
      || existing.operationId !== normalizedOperationId
      || existing.checkpointId !== checkpointId
      || existing.contentChecksum !== contentChecksum
      || existing.checksum !== eventDocumentChecksum(existing)) throw new Error('project-event-recovery-quarantine-conflict');
    return { ...existing, idempotent: true };
  }
  const base = {
    schemaVersion: 'local-project-event-quarantine/v1', projectId, operationId: normalizedOperationId, checkpointId,
    eventSnapshot, contentChecksum, quarantinedAt: new Date(Date.parse(now) || Date.now()).toISOString(), localOnly: true,
  };
  const quarantine = { ...base, checksum: eventDocumentChecksum(base) };
  writeJsonAtomic(path, quarantine);
  return { ...quarantine, idempotent: false };
}

function readEventRecoveryQuarantine(filePath, projectId, operationId) {
  const normalizedOperationId = String(operationId || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(normalizedOperationId)) throw new Error('project-event-recovery-operation-id-invalid');
  const path = join(eventRecoveryQuarantineDirectory(filePath, projectId), `${sha256(normalizedOperationId)}.json`);
  if (!existsSync(path)) return null;
  let quarantine;
  try {
    quarantine = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('project-event-recovery-quarantine-invalid');
  }
  if (quarantine.schemaVersion !== 'local-project-event-quarantine/v1'
    || quarantine.projectId !== projectId
    || quarantine.operationId !== normalizedOperationId
    || quarantine.checksum !== eventDocumentChecksum(quarantine)
    || quarantine.contentChecksum !== sha256(stableJson(quarantine.eventSnapshot))) throw new Error('project-event-recovery-quarantine-invalid');
  return quarantine;
}

function writeEventRecoveryReceipt(filePath, receiptBase = {}) {
  const { projectId, operationId, checkpointId } = receiptBase;
  const prior = readEventRecoveryReceipt(filePath, projectId, operationId);
  if (prior) {
    if (prior.checkpointId !== checkpointId) throw new Error('project-event-recovery-operation-conflict');
    return { ...prior, idempotent: true };
  }
  const directory = eventRecoveryDirectory(filePath, projectId);
  mkdirSync(directory, { recursive: true });
  const receipt = { ...receiptBase, checksum: eventDocumentChecksum(receiptBase) };
  writeJsonAtomic(join(directory, `${sha256(operationId)}.json`), receipt);
  return { ...receipt, idempotent: false };
}

function securityAuditLogText(records = [], writtenAt = new Date().toISOString()) {
  return records.map((record) => JSON.stringify({ auditLogVersion: SECURITY_AUDIT_LOG_VERSION, writtenAt, record })).join('\n') + (records.length ? '\n' : '');
}

function stableSnapshotPayload(version, snapshot = {}) {
  return JSON.stringify({
    version,
    projects: snapshot.projects || [],
    messages: snapshot.messages || [],
    kickoffMeetings: snapshot.kickoffMeetings || [],
    securityAccessAuditRecords: snapshot.securityAccessAuditRecords || [],
    accessReplayRecords: snapshot.accessReplayRecords || [],
  });
}

function snapshotSemanticChecksum(version, snapshot = {}) {
  return sha256(stableSnapshotPayload(version, snapshot));
}

function migrationJournalPath(filePath) {
  return `${filePath}.migration.json`;
}

function migrationSourceArchivePath(filePath, sourceVersion, targetVersion) {
  return `${filePath}.migration-v${sourceVersion}-to-v${targetVersion}.source.json`;
}

function migrationJournalChecksum(journal = {}) {
  const { checksum: _checksum, ...base } = journal;
  return sha256(JSON.stringify(base));
}

function validMigrationJournal(journal = {}) {
  return journal.schemaVersion === 'agent-project-store-migration-transaction/v1'
    && Boolean(journal.id && journal.checksum) && journal.checksum === migrationJournalChecksum(journal);
}

function writeJsonAtomic(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(value, null, 2));
  replaceFileWithRetry(tempPath, filePath);
}

function writeMigrationJournal(filePath, base = {}) {
  const journal = { ...base, checksum: migrationJournalChecksum(base) };
  writeJsonAtomic(migrationJournalPath(filePath), journal);
  return journal;
}

function readMigrationJournal(filePath) {
  const path = migrationJournalPath(filePath);
  if (!existsSync(path)) return null;
  let journal;
  try {
    journal = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('agent-project-store-migration-journal-invalid');
  }
  if (!validMigrationJournal(journal)) throw new Error('agent-project-store-migration-journal-invalid');
  return journal;
}

function resolveStorePath(filePath) {
  if (!filePath) throw new Error('createAgentProjectFileStore requires filePath.');
  return filePath instanceof URL ? fileURLToPath(filePath) : filePath;
}

function resolveSecurityAuditLogPath(filePath, auditLogPath) {
  if (auditLogPath === false) return null;
  if (auditLogPath) return auditLogPath instanceof URL ? fileURLToPath(auditLogPath) : auditLogPath;
  return `${filePath}.security-audit.jsonl`;
}

function mergeSecurityAuditRecords(...groups) {
  const byId = new Map();
  groups.flat().forEach((record) => {
    if (!record?.id) return;
    byId.set(record.id, {
      ...(byId.get(record.id) || {}),
      ...record,
    });
  });
  return [...byId.values()].sort((a, b) => {
    const sequenceA = Number(a.streamSequence);
    const sequenceB = Number(b.streamSequence);
    if (Number.isFinite(sequenceA) && Number.isFinite(sequenceB) && sequenceA !== sequenceB) {
      return sequenceA - sequenceB;
    }
    return (Date.parse(a.time) || 0) - (Date.parse(b.time) || 0);
  });
}

function securityAuditRecordsForActiveProjects(records = [], projects = []) {
  const activeProjectIds = new Set((projects || []).map((project) => project?.id).filter(Boolean));
  return (records || []).filter((record) => !record?.projectId || activeProjectIds.has(record.projectId));
}

function readSecurityAuditLogDetails(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return { records: [], malformedLineCount: 0, malformedLineNumbers: [] };
  }
  const raw = readFileSync(filePath, 'utf8');
  if (!raw.trim()) return { records: [], malformedLineCount: 0, malformedLineNumbers: [] };
  const malformedLineNumbers = [];
  const records = raw.split(/\r?\n/).flatMap((line, index) => {
    const normalizedLine = line.trim();
    if (!normalizedLine) return [];
    try {
      const parsed = JSON.parse(normalizedLine);
      const record = parsed.record || parsed;
      if (!record?.id) throw new Error('security-audit-record-id-missing');
      return [record];
    } catch {
      malformedLineNumbers.push(index + 1);
      return [];
    }
  });
  return {
    records,
    malformedLineCount: malformedLineNumbers.length,
    malformedLineNumbers,
  };
}

function securityAuditLogIntegrity(filePath, details = {}) {
  const malformedLineNumbers = Array.isArray(details.malformedLineNumbers)
    ? details.malformedLineNumbers
    : [];
  return {
    schemaVersion: 'local-security-audit-log-integrity/v1',
    status: !filePath
      ? 'not-configured'
      : malformedLineNumbers.length ? 'malformed-lines-detected' : 'ready',
    auditLogPath: filePath || null,
    malformedLineCount: malformedLineNumbers.length,
    malformedLineNumbers,
  };
}

function appendSecurityAuditLog(filePath, records = []) {
  if (!filePath || !records.length) return;
  mkdirSync(dirname(filePath), { recursive: true });
  const writtenAt = new Date().toISOString();
  const lines = records.map((record) => JSON.stringify({
    auditLogVersion: SECURITY_AUDIT_LOG_VERSION,
    writtenAt,
    record,
  })).join('\n');
  appendFileSync(filePath, `${lines}\n`);
}

function emptySnapshot() {
  return {
    projects: [],
    messages: [],
    kickoffMeetings: [],
    securityAccessAuditRecords: [],
    accessReplayRecords: [],
  };
}

function snapshotFromParsed(parsed = {}) {
  return {
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    kickoffMeetings: Array.isArray(parsed.kickoffMeetings) ? parsed.kickoffMeetings : [],
    securityAccessAuditRecords: Array.isArray(parsed.securityAccessAuditRecords) ? parsed.securityAccessAuditRecords : [],
    accessReplayRecords: Array.isArray(parsed.accessReplayRecords) ? parsed.accessReplayRecords : [],
  };
}

function normalizeSnapshotVersion(value) {
  if (value === undefined || value === null || value === '') return 1;
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw new Error('agent-project-store-version-unsupported');
  return version;
}

function migrateSnapshot(snapshot, sourceVersion) {
  let version = normalizeSnapshotVersion(sourceVersion);
  if (version > STORE_VERSION) throw new Error('agent-project-store-version-unsupported');
  let currentSnapshot = snapshot;
  while (version < STORE_VERSION) {
    const step = SNAPSHOT_MIGRATIONS.get(version);
    if (!step?.up || !step?.down || !step?.validate) throw new Error('agent-project-store-version-unsupported');
    currentSnapshot = step.up(currentSnapshot);
    if (!step.validate(currentSnapshot)) throw new Error('agent-project-store-migration-validation-failed');
    version += 1;
  }
  return {
    snapshot: currentSnapshot,
    sourceVersion: normalizeSnapshotVersion(sourceVersion),
    currentVersion: version,
    migrated: normalizeSnapshotVersion(sourceVersion) !== version,
  };
}

function snapshotBackupPath(filePath) {
  return `${filePath}.bak`;
}

function readSnapshotCandidate(filePath) {
  if (!existsSync(filePath)) return { exists: false, snapshot: emptySnapshot(), version: STORE_VERSION, raw: '', error: null };
  const raw = readFileSync(filePath, 'utf8');
  if (!raw.trim()) return { exists: true, snapshot: emptySnapshot(), version: STORE_VERSION, raw, error: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      exists: true,
      snapshot: snapshotFromParsed(parsed),
      version: normalizeSnapshotVersion(parsed.version),
      raw,
      error: null,
    };
  } catch (error) {
    return { exists: true, snapshot: null, raw, error };
  }
}

function readSnapshot(filePath) {
  const candidate = readSnapshotCandidate(filePath);
  if (candidate.error) throw candidate.error;
  return candidate.snapshot;
}

function loadSnapshotWithRecovery(filePath) {
  const backupPath = snapshotBackupPath(filePath);
  const primary = readSnapshotCandidate(filePath);
  if (!primary.error && primary.exists) {
    const migration = migrateSnapshot(primary.snapshot, primary.version);
    return {
      snapshot: migration.snapshot,
      integrity: {
        schemaVersion: 'agent-project-file-store-integrity/v1',
        status: migration.migrated ? 'migrated' : 'ready',
        backupPath,
        quarantinePath: null,
        sourceVersion: migration.sourceVersion,
        migratedFromVersion: migration.migrated ? migration.sourceVersion : null,
        currentVersion: migration.currentVersion,
        migrationSourceRaw: migration.migrated ? primary.raw : null,
      },
    };
  }
  const backup = readSnapshotCandidate(backupPath);
  if ((!primary.exists || primary.error) && backup.exists && !backup.error) {
    const quarantinePath = primary.exists
      ? `${filePath}.corrupt-${Date.now()}.json`
      : null;
    if (quarantinePath) replaceFileWithRetry(filePath, quarantinePath);
    const migration = migrateSnapshot(backup.snapshot, backup.version);
    return {
      snapshot: migration.snapshot,
      integrity: {
        schemaVersion: 'agent-project-file-store-integrity/v1',
        status: 'recovered-from-backup',
        backupPath,
        quarantinePath,
        sourceVersion: migration.sourceVersion,
        migratedFromVersion: migration.migrated ? migration.sourceVersion : null,
        currentVersion: migration.currentVersion,
        migrationSourceRaw: migration.migrated ? backup.raw : null,
      },
    };
  }
  if (primary.error) throw new Error('agent-project-store-corrupt-no-backup');
  return {
    snapshot: emptySnapshot(),
      integrity: {
        schemaVersion: 'agent-project-file-store-integrity/v1',
        status: 'ready',
        backupPath,
        quarantinePath: null,
        sourceVersion: STORE_VERSION,
        migratedFromVersion: null,
        currentVersion: STORE_VERSION,
    },
  };
}

function prepareMigrationTransaction(filePath, integrity = {}, migratedSnapshot = {}) {
  const sourceVersion = integrity.migratedFromVersion;
  const targetVersion = integrity.currentVersion;
  const sourceRaw = integrity.migrationSourceRaw;
  if (!sourceRaw || !sourceVersion || !targetVersion || sourceVersion >= targetVersion) {
    throw new Error('agent-project-store-migration-source-invalid');
  }
  const sourceChecksum = sha256(sourceRaw);
  const targetChecksum = snapshotSemanticChecksum(targetVersion, migratedSnapshot);
  const id = `migration_${sha256(`${sourceVersion}:${targetVersion}:${sourceChecksum}`).slice(0, 24)}`;
  const sourceArchivePath = migrationSourceArchivePath(filePath, sourceVersion, targetVersion);
  if (existsSync(sourceArchivePath)) {
    if (sha256(readFileSync(sourceArchivePath, 'utf8')) !== sourceChecksum) throw new Error('agent-project-store-migration-archive-invalid');
  } else {
    const archiveTempPath = `${sourceArchivePath}.tmp`;
    writeFileSync(archiveTempPath, sourceRaw, 'utf8');
    replaceFileWithRetry(archiveTempPath, sourceArchivePath);
  }
  const existing = readMigrationJournal(filePath);
  if (existing && existing.id !== id) throw new Error('agent-project-store-migration-transaction-conflict');
  if (existing?.status === 'committed') return existing;
  return writeMigrationJournal(filePath, {
    schemaVersion: 'agent-project-store-migration-transaction/v1',
    id,
    sourceVersion,
    targetVersion,
    sourceChecksum,
    targetChecksum,
    sourceArchivePath,
    status: 'prepared',
    targetVerified: false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    committedAt: null,
    rolledBackAt: null,
    rollbackArchivePath: null,
  });
}

function reconcilePreparedMigrationTarget(filePath, journal = {}, targetSnapshot = {}) {
  if (!validMigrationJournal(journal) || journal.status !== 'prepared') return journal;
  const targetChecksum = snapshotSemanticChecksum(journal.targetVersion, targetSnapshot);
  if (targetChecksum === journal.targetChecksum) return journal;
  if (!journal.sourceArchivePath || !existsSync(journal.sourceArchivePath)) {
    throw new Error('agent-project-store-migration-archive-invalid');
  }
  const sourceRaw = readFileSync(journal.sourceArchivePath, 'utf8');
  if (sha256(sourceRaw) !== journal.sourceChecksum) {
    throw new Error('agent-project-store-migration-archive-invalid');
  }
  const currentTarget = readSnapshotCandidate(filePath);
  const step = SNAPSHOT_MIGRATIONS.get(journal.sourceVersion);
  if (currentTarget.error
    || currentTarget.version !== journal.targetVersion
    || !step?.validate?.(currentTarget.snapshot)) {
    throw new Error('agent-project-store-migration-target-invalid');
  }
  const targetRecoveryArchivePath = `${filePath}.${journal.id}.target-recovery.json`;
  if (!existsSync(targetRecoveryArchivePath)) {
    copyFileSync(filePath, targetRecoveryArchivePath);
  }
  const { checksum: _checksum, ...base } = journal;
  return writeMigrationJournal(filePath, {
    ...base,
    originalTargetChecksum: journal.originalTargetChecksum || journal.targetChecksum,
    targetChecksum,
    targetRecoveryArchivePath,
    recoveryReason: 'hydrated-target-checksum-reconciled',
    recoveredAt: new Date().toISOString(),
  });
}

function commitMigrationTransaction(filePath, journal = {}) {
  if (!validMigrationJournal(journal) || journal.status !== 'prepared') throw new Error('agent-project-store-migration-journal-invalid');
  const target = readSnapshotCandidate(filePath);
  if (target.error || target.version !== journal.targetVersion) throw new Error('agent-project-store-migration-target-invalid');
  const step = SNAPSHOT_MIGRATIONS.get(journal.sourceVersion);
  if (!step?.validate?.(target.snapshot)) throw new Error('agent-project-store-migration-validation-failed');
  if (snapshotSemanticChecksum(target.version, target.snapshot) !== journal.targetChecksum) throw new Error('agent-project-store-migration-target-checksum-mismatch');
  const { checksum: _checksum, ...base } = journal;
  return writeMigrationJournal(filePath, {
    ...base,
    status: 'committed',
    targetVerified: true,
    committedAt: new Date().toISOString(),
  });
}

function publicMigrationTransaction(filePath, journal = null) {
  if (!journal) return null;
  return {
    id: journal.id,
    status: journal.status,
    sourceVersion: journal.sourceVersion,
    targetVersion: journal.targetVersion,
    sourceChecksum: journal.sourceChecksum,
    targetChecksum: journal.targetChecksum,
    sourceArchivePath: journal.sourceArchivePath,
    targetVerified: journal.targetVerified === true,
    originalTargetChecksum: journal.originalTargetChecksum || null,
    targetRecoveryArchivePath: journal.targetRecoveryArchivePath || null,
    recoveryReason: journal.recoveryReason || null,
    recoveredAt: journal.recoveredAt || null,
    rollbackArchivePath: journal.rollbackArchivePath || null,
    createdAt: journal.createdAt,
    committedAt: journal.committedAt || null,
    rolledBackAt: journal.rolledBackAt || null,
    rollbackChecksum: journal.rollbackChecksum || null,
    rollbackVerified: journal.rollbackVerified === true,
    rollbackCommand: `node scripts/rollback-agent-project-store-migration.mjs --store "${filePath}" --execute --migration-id ${journal.id}`,
  };
}

export function getAgentProjectFileStoreMigrationStatus({ filePath } = {}) {
  const resolvedPath = resolveStorePath(filePath);
  const journal = readMigrationJournal(resolvedPath);
  const primary = readSnapshotCandidate(resolvedPath);
  return {
    schemaVersion: 'agent-project-store-migration-status/v1',
    filePath: resolvedPath,
    primaryReadable: Boolean(primary.exists && !primary.error),
    primaryVersion: primary.error ? null : primary.version,
    migrationTransaction: publicMigrationTransaction(resolvedPath, journal),
    rollbackReady: Boolean(journal?.status === 'committed' && primary.exists && !primary.error && primary.version === journal.targetVersion),
  };
}

export function rollbackAgentProjectFileStoreMigration({ filePath, expectedMigrationId, now = new Date().toISOString() } = {}) {
  const resolvedPath = resolveStorePath(filePath);
  const journal = readMigrationJournal(resolvedPath);
  if (!journal || journal.status !== 'committed') throw new Error('agent-project-store-migration-not-committed');
  if (!expectedMigrationId || expectedMigrationId !== journal.id) throw new Error('agent-project-store-migration-id-mismatch');
  const current = readSnapshotCandidate(resolvedPath);
  if (!current.exists || current.error || current.version !== journal.targetVersion) throw new Error('agent-project-store-migration-rollback-current-snapshot-invalid');
  let version = current.version;
  let snapshot = current.snapshot;
  while (version > journal.sourceVersion) {
    const step = SNAPSHOT_MIGRATIONS.get(version - 1);
    if (!step?.down || !step?.validate) throw new Error('agent-project-store-migration-down-step-missing');
    snapshot = step.down(snapshot);
    if (!step.validate(snapshot)) throw new Error('agent-project-store-migration-rollback-validation-failed');
    version -= 1;
  }
  if (version !== journal.sourceVersion) throw new Error('agent-project-store-migration-down-step-missing');
  const rollbackArchivePath = `${resolvedPath}.rollback-${journal.id}.pre.json`;
  const currentRaw = current.raw;
  if (existsSync(rollbackArchivePath)) {
    if (sha256(readFileSync(rollbackArchivePath, 'utf8')) !== sha256(currentRaw)) throw new Error('agent-project-store-migration-rollback-archive-conflict');
  } else {
    const archiveTempPath = `${rollbackArchivePath}.tmp`;
    writeFileSync(archiveTempPath, currentRaw, 'utf8');
    replaceFileWithRetry(archiveTempPath, rollbackArchivePath);
  }
  writeJsonAtomic(resolvedPath, {
    version,
    updatedAt: now,
    projects: snapshot.projects || [],
    messages: snapshot.messages || [],
    kickoffMeetings: snapshot.kickoffMeetings || [],
    securityAccessAuditRecords: snapshot.securityAccessAuditRecords || [],
    accessReplayRecords: snapshot.accessReplayRecords || [],
  });
  const rolledBack = readSnapshotCandidate(resolvedPath);
  const rollbackChecksum = snapshotSemanticChecksum(version, snapshot);
  if (rolledBack.error || rolledBack.version !== version || snapshotSemanticChecksum(rolledBack.version, rolledBack.snapshot) !== rollbackChecksum) {
    throw new Error('agent-project-store-migration-rollback-verification-failed');
  }
  const { checksum: _checksum, ...base } = journal;
  const updated = writeMigrationJournal(resolvedPath, {
    ...base,
    status: 'rolled-back',
    rolledBackAt: now,
    rollbackArchivePath,
    rollbackChecksum,
    rollbackVerified: true,
  });
  return publicMigrationTransaction(resolvedPath, updated);
}

function writeSnapshot(filePath, snapshot) {
  mkdirSync(dirname(filePath), { recursive: true });
  const backupPath = snapshotBackupPath(filePath);
  if (existsSync(filePath)) {
    const backupTempPath = `${backupPath}.tmp`;
    copyFileSync(filePath, backupTempPath);
    replaceFileWithRetry(backupTempPath, backupPath);
  }
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify({
    version: STORE_VERSION,
    updatedAt: new Date().toISOString(),
    projects: snapshot.projects || [],
    messages: snapshot.messages || [],
    kickoffMeetings: snapshot.kickoffMeetings || [],
    securityAccessAuditRecords: snapshot.securityAccessAuditRecords || [],
    accessReplayRecords: snapshot.accessReplayRecords || [],
  }, null, 2));
  replaceFileWithRetry(tempPath, filePath);
}

function hydrateStartupProjects(filePath, projects = [], hydrateProject = (project) => project) {
  const hydratedProjects = [];
  const quarantinedProjects = [];
  projects.forEach((project, index) => {
    try {
      if (!project?.id) throw new Error('project-id-required');
      const hydrated = hydrateProject(project);
      if (!hydrated?.id) throw new Error('hydrated-project-id-required');
      hydratedProjects.push(hydrated);
    } catch (error) {
      quarantinedProjects.push({
        index,
        projectId: project?.id || null,
        error: error?.message || String(error),
        project,
      });
    }
  });
  if (!quarantinedProjects.length) {
    return { projects: hydratedProjects, quarantine: null };
  }
  const createdAt = new Date().toISOString();
  const path = `${filePath}.project-quarantine-${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}.json`;
  const quarantineBase = {
    schemaVersion: 'agent-project-store-project-quarantine/v1',
    createdAt,
    sourceFilePath: filePath,
    projectCount: quarantinedProjects.length,
    projectIds: quarantinedProjects.map((entry) => entry.projectId).filter(Boolean),
    projects: quarantinedProjects,
  };
  writeJsonAtomic(path, {
    ...quarantineBase,
    checksum: sha256(stableJson(quarantineBase)),
  });
  return {
    projects: hydratedProjects,
    quarantine: {
      schemaVersion: quarantineBase.schemaVersion,
      path,
      createdAt,
      projectCount: quarantineBase.projectCount,
      projectIds: quarantineBase.projectIds,
    },
  };
}

export function createAgentProjectFileStore({
  filePath,
  securityAuditLogPath,
  projects = [],
  messages = [],
  kickoffMeetings = [],
  securityAccessAuditRecords = [],
  messageLimit = 0,
  hydrateProject = (project) => project,
  replaceWithSeed = false,
} = {}) {
  const resolvedPath = resolveStorePath(filePath);
  const resolvedSecurityAuditLogPath = resolveSecurityAuditLogPath(resolvedPath, securityAuditLogPath);
  const hydratedProjectMarker = Symbol('agent-project-file-store-hydrated');
  const hydrateProjectOnce = (project) => {
    if (project?.[hydratedProjectMarker] === true) return project;
    return {
      ...hydrateProject(project),
      [hydratedProjectMarker]: true,
    };
  };
  const localRateLimitLedger = createLocalRateLimitLedger({ filePath: `${resolvedPath}.provider-rate-limits.json` });
  const loadedSnapshot = replaceWithSeed
    ? {
        snapshot: emptySnapshot(),
        integrity: {
          schemaVersion: 'agent-project-file-store-integrity/v1',
          status: 'ready',
          backupPath: snapshotBackupPath(resolvedPath),
          quarantinePath: null,
          sourceVersion: STORE_VERSION,
          migratedFromVersion: null,
          currentVersion: STORE_VERSION,
        },
      }
    : loadSnapshotWithRecovery(resolvedPath);
  const existingSnapshot = loadedSnapshot.snapshot;
  let migrationTransaction = loadedSnapshot.integrity.migratedFromVersion
    ? null
    : readMigrationJournal(resolvedPath);
  if (replaceWithSeed && resolvedSecurityAuditLogPath) {
    mkdirSync(dirname(resolvedSecurityAuditLogPath), { recursive: true });
    writeFileSync(resolvedSecurityAuditLogPath, '');
  }
  const initialAuditLog = replaceWithSeed
    ? { records: [], malformedLineCount: 0, malformedLineNumbers: [] }
    : readSecurityAuditLogDetails(resolvedSecurityAuditLogPath);
  let currentSecurityAuditLogIntegrity = securityAuditLogIntegrity(
    resolvedSecurityAuditLogPath,
    initialAuditLog,
  );
  const existingAuditLogRecords = initialAuditLog.records;
  const sourceSeedProjects = projects.length ? projects : existingSnapshot.projects;
  const startupProjectHydration = hydrateStartupProjects(resolvedPath, sourceSeedProjects, hydrateProjectOnce);
  const seedProjects = startupProjectHydration.projects;
  const seedMessages = messages.length ? messages : existingSnapshot.messages;
  const seedKickoffMeetings = kickoffMeetings.length ? kickoffMeetings : existingSnapshot.kickoffMeetings;
  const seedSecurityAccessAuditRecords = securityAuditRecordsForActiveProjects(securityAccessAuditRecords.length
    ? securityAccessAuditRecords
    : mergeSecurityAuditRecords(existingSnapshot.securityAccessAuditRecords, existingAuditLogRecords), seedProjects);
  const seedAccessReplayRecords = replaceWithSeed ? [] : existingSnapshot.accessReplayRecords;
  const memoryStore = createAgentProjectMemoryStore({
    projects: seedProjects,
    messages: seedMessages,
    kickoffMeetings: seedKickoffMeetings,
    securityAccessAuditRecords: seedSecurityAccessAuditRecords,
    accessReplayRecords: seedAccessReplayRecords,
    messageLimit,
    hydrateProject: (project) => project,
  });
  if (loadedSnapshot.integrity.migratedFromVersion) {
    migrationTransaction = prepareMigrationTransaction(
      resolvedPath,
      loadedSnapshot.integrity,
      memoryStore.snapshot(),
    );
  }
  if (migrationTransaction?.status === 'prepared') {
    migrationTransaction = reconcilePreparedMigrationTarget(
      resolvedPath,
      migrationTransaction,
      memoryStore.snapshot(),
    );
  }

  const persist = () => {
    writeSnapshot(resolvedPath, memoryStore.snapshot());
  };
  const persistErasure = () => {
    persist();
    const backupPath = snapshotBackupPath(resolvedPath);
    const backupTempPath = `${backupPath}.tmp`;
    copyFileSync(resolvedPath, backupTempPath);
    replaceFileWithRetry(backupTempPath, backupPath);
  };
  const refreshSecurityAuditRecords = () => {
    const memoryRecords = memoryStore.snapshot().securityAccessAuditRecords || [];
    const diskRecords = readSnapshot(resolvedPath).securityAccessAuditRecords || [];
    const auditLog = readSecurityAuditLogDetails(resolvedSecurityAuditLogPath);
    currentSecurityAuditLogIntegrity = securityAuditLogIntegrity(resolvedSecurityAuditLogPath, auditLog);
    const logRecords = auditLog.records;
    const merged = securityAuditRecordsForActiveProjects(
      mergeSecurityAuditRecords(memoryRecords, diskRecords, logRecords),
      memoryStore.listProjects(),
    );
    const memoryIds = new Set(memoryRecords.map((record) => record.id));
    const logIds = new Set(logRecords.map((record) => record.id));
    const missingRecords = merged.filter((record) => record?.id && !memoryIds.has(record.id));
    if (missingRecords.length) memoryStore.appendSecurityAuditRecords(missingRecords);
    const missingLogRecords = merged.filter((record) => record?.id && !logIds.has(record.id));
    if (missingLogRecords.length) appendSecurityAuditLog(resolvedSecurityAuditLogPath, missingLogRecords);
    return merged;
  };

  persist();
  if (migrationTransaction?.status === 'prepared') migrationTransaction = commitMigrationTransaction(resolvedPath, migrationTransaction);
  loadedSnapshot.integrity.migrationTransaction = publicMigrationTransaction(resolvedPath, migrationTransaction);
  loadedSnapshot.integrity.projectQuarantine = startupProjectHydration.quarantine;
  delete loadedSnapshot.integrity.migrationSourceRaw;

  return {
    getRevision() {
      return memoryStore.getRevision();
    },
    listProjects() {
      return memoryStore.listProjects();
    },
    getProject(projectId) {
      return memoryStore.getProject(projectId);
    },
    saveProject(project) {
      const hydrated = hydrateProjectOnce(project);
      const saved = memoryStore.saveProject(hydrated);
      persist();
      return saved;
    },
    saveProjectAndAppendMessages(project, nextMessages = []) {
      const hydrated = hydrateProjectOnce(project);
      const saved = memoryStore.saveProject(hydrated);
      const appended = memoryStore.appendMessages(nextMessages);
      persist();
      return { project: saved, messages: appended };
    },
    deleteProject(projectId) {
      const removed = memoryStore.deleteProject(projectId);
      persistErasure();
      return removed;
    },
    listKickoffMeetings() {
      return memoryStore.listKickoffMeetings();
    },
    getKickoffMeeting(meetingId) {
      return memoryStore.getKickoffMeeting(meetingId);
    },
    saveKickoffMeeting(meeting) {
      const saved = memoryStore.saveKickoffMeeting(meeting);
      persist();
      return saved;
    },
    appendMessages(nextMessages = []) {
      const appended = memoryStore.appendMessages(nextMessages);
      if (appended.length) persist();
      return appended;
    },
    getMessages(projectId) {
      return memoryStore.getMessages(projectId);
    },
    appendSecurityAuditRecords(records = []) {
      const appended = memoryStore.appendSecurityAuditRecords(records);
      if (appended.length) {
        appendSecurityAuditLog(resolvedSecurityAuditLogPath, appended);
      }
      return appended;
    },
    listSecurityAuditRecords(projectId) {
      return refreshSecurityAuditRecords().filter((record) => !projectId || record.projectId === projectId);
    },
    createSecurityAuditCheckpoint(options = {}) {
      refreshSecurityAuditRecords();
      const details = readSecurityAuditLogDetails(resolvedSecurityAuditLogPath);
      currentSecurityAuditLogIntegrity = securityAuditLogIntegrity(resolvedSecurityAuditLogPath, details);
      if (details.malformedLineCount) throw new Error('security-audit-log-malformed');
      return writeSecurityAuditCheckpoint(resolvedPath, details.records, options);
    },
    latestSecurityAuditCheckpoint() {
      return readSecurityAuditCheckpoints(resolvedPath).at(-1) || null;
    },
    listSecurityAuditRecoveryReceipts() {
      return readSecurityAuditRecoveryReceipts(resolvedPath).map((row) => ({ ...row }));
    },
    createProjectEventCheckpoint(input = {}) {
      return writeEventCheckpoint(resolvedPath, input);
    },
    getProjectEventCheckpoint(projectId, checkpointId) {
      return readEventCheckpoint(resolvedPath, projectId, checkpointId);
    },
    listProjectEventCheckpoints(projectId) {
      return listEventCheckpoints(resolvedPath, projectId);
    },
    getProjectEventRecoveryReceipt(projectId, operationId) {
      return readEventRecoveryReceipt(resolvedPath, projectId, operationId);
    },
    listProjectEventRecoveryReceipts(projectId) {
      return listEventRecoveryReceipts(resolvedPath, projectId);
    },
    writeProjectEventRecoveryQuarantine(input = {}) {
      return writeEventRecoveryQuarantine(resolvedPath, input);
    },
    getProjectEventRecoveryQuarantine(projectId, operationId) {
      return readEventRecoveryQuarantine(resolvedPath, projectId, operationId);
    },
    writeProjectEventRecoveryReceipt(input = {}) {
      return writeEventRecoveryReceipt(resolvedPath, input);
    },
    recoverSecurityAuditLog({ expectedCheckpointId, operationId, execute = false, now = new Date().toISOString() } = {}) {
      const normalizedOperationId = String(operationId || '').trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(normalizedOperationId)) throw new Error('security-audit-recovery-operation-id-invalid');
      const checkpoints = readSecurityAuditCheckpoints(resolvedPath);
      const checkpoint = checkpoints.find((row) => row.id === expectedCheckpointId);
      if (!checkpoint) throw new Error('security-audit-checkpoint-not-found');
      const priorReceipt = readSecurityAuditRecoveryReceipts(resolvedPath).find((row) => row.operationId === normalizedOperationId);
      if (priorReceipt) {
        if (priorReceipt.checkpointId !== checkpoint.id) throw new Error('security-audit-recovery-operation-conflict');
        return { ...priorReceipt, idempotent: true };
      }
      const archive = readCheckpointArchive(checkpoint);
      const activeDetails = readSecurityAuditLogDetails(resolvedSecurityAuditLogPath);
      const snapshotRecords = memoryStore.snapshot().securityAccessAuditRecords || [];
      const rebuiltRecords = mergeSecurityAuditRecords(archive.records, activeDetails.records, snapshotRecords);
      const verification = verifySecurityAuditRecords(rebuiltRecords);
      if (!verification.valid) throw new Error('security-audit-recovery-continuation-invalid');
      const writtenAt = new Date(Date.parse(now) || Date.now()).toISOString();
      const rebuiltText = securityAuditLogText(rebuiltRecords, writtenAt);
      const activeRaw = existsSync(resolvedSecurityAuditLogPath) ? readFileSync(resolvedSecurityAuditLogPath, 'utf8') : '';
      const plan = {
        schemaVersion: 'local-security-audit-recovery-plan/v1',
        status: 'ready-to-recover',
        execute: false,
        checkpointId: checkpoint.id,
        operationId: normalizedOperationId,
        activeValidRecordCount: activeDetails.records.length,
        activeMalformedLineCount: activeDetails.malformedLineCount,
        checkpointRecordCount: archive.records.length,
        snapshotRecordCount: snapshotRecords.length,
        rebuiltRecordCount: rebuiltRecords.length,
        rebuiltChecksum: sha256(rebuiltText),
        scopeRoots: verification.scopeRoots,
        localOnly: true,
        externalWormStorage: false,
      };
      if (!execute) return plan;
      const quarantinePath = `${resolvedSecurityAuditLogPath}.corrupt-${normalizedOperationId}.jsonl`;
      if (existsSync(quarantinePath)) {
        if (sha256(readFileSync(quarantinePath, 'utf8')) !== sha256(activeRaw)) throw new Error('security-audit-recovery-quarantine-conflict');
      } else {
        const quarantineTempPath = `${quarantinePath}.tmp`;
        writeFileSync(quarantineTempPath, activeRaw, 'utf8');
        replaceFileWithRetry(quarantineTempPath, quarantinePath);
      }
      const rebuiltTempPath = `${resolvedSecurityAuditLogPath}.rebuild-${normalizedOperationId}.tmp`;
      writeFileSync(rebuiltTempPath, rebuiltText, 'utf8');
      replaceFileWithRetry(rebuiltTempPath, resolvedSecurityAuditLogPath);
      const reread = readSecurityAuditLogDetails(resolvedSecurityAuditLogPath);
      const rereadVerification = verifySecurityAuditRecords(reread.records);
      if (reread.malformedLineCount || reread.records.length !== rebuiltRecords.length || !rereadVerification.valid || sha256(readFileSync(resolvedSecurityAuditLogPath, 'utf8')) !== plan.rebuiltChecksum) {
        throw new Error('security-audit-recovery-verification-failed');
      }
      const memoryIds = new Set(snapshotRecords.map((record) => record.id));
      const missingSnapshotRecords = rebuiltRecords.filter((record) => !memoryIds.has(record.id));
      if (missingSnapshotRecords.length) {
        memoryStore.appendSecurityAuditRecords(missingSnapshotRecords);
        persist();
      }
      currentSecurityAuditLogIntegrity = securityAuditLogIntegrity(resolvedSecurityAuditLogPath, reread);
      const receiptBase = {
        schemaVersion: 'local-security-audit-recovery/v1',
        id: `audit_recovery_${sha256(`${checkpoint.id}:${normalizedOperationId}`).slice(0, 24)}`,
        status: 'recovered',
        execute: true,
        checkpointId: checkpoint.id,
        operationId: normalizedOperationId,
        quarantinePath,
        quarantineChecksum: sha256(activeRaw),
        rebuiltChecksum: plan.rebuiltChecksum,
        rebuiltRecordCount: rebuiltRecords.length,
        scopeRoots: rereadVerification.scopeRoots,
        rebuiltVerified: true,
        recoveredAt: writtenAt,
        localOnly: true,
        externalWormStorage: false,
      };
      const receipt = { ...receiptBase, checksum: auditRecoveryReceiptChecksum(receiptBase) };
      appendFileSync(securityAuditRecoveryLogPath(resolvedPath), `${JSON.stringify(receipt)}\n`, 'utf8');
      return { ...receipt, idempotent: false };
    },
    pruneAccessReplayRecords(nowMs = Date.now()) {
      const removed = memoryStore.pruneAccessReplayRecords(nowMs);
      if (removed) persist();
      return removed;
    },
    getAccessReplayRecord(replayKey) {
      return memoryStore.getAccessReplayRecord(replayKey);
    },
    appendAccessReplayRecords(records = []) {
      const appended = memoryStore.appendAccessReplayRecords(records);
      if (appended.length) persist();
      return appended;
    },
    listAccessReplayRecords(projectId) {
      return memoryStore.listAccessReplayRecords(projectId);
    },
    snapshot() {
      return memoryStore.snapshot();
    },
    filePath: resolvedPath,
    localRateLimitLedger,
    integrity: loadedSnapshot.integrity,
    securityAuditLogPath: resolvedSecurityAuditLogPath,
    securityAuditLogIntegrity() {
      return {
        ...currentSecurityAuditLogIntegrity,
        malformedLineNumbers: [...currentSecurityAuditLogIntegrity.malformedLineNumbers],
      };
    },
  };
}
