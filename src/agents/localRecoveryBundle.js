import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { replaceFileWithRetry } from './atomicFileReplace.js';

const BUNDLE_SCHEMA_VERSION = 'local-recovery-bundle/v1';
const ENVELOPE_SCHEMA_VERSION = 'local-recovery-encrypted-envelope/v1';

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function requiredPassphrase(passphrase = '') {
  const normalized = String(passphrase || '');
  if (!normalized) throw new Error('local-recovery-passphrase-required');
  return normalized;
}

function safeRelativePath(value = '') {
  const normalized = String(value || '').replace(/\\/g, '/');
  if (!normalized) return '';
  if (normalized.startsWith('/') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('local-recovery-relative-path-invalid');
  }
  return normalized;
}

function collectDirectoryEntries(rootPath, currentPath = rootPath) {
  return readdirSync(currentPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = join(currentPath, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`local-recovery-symlink-not-supported:${entryPath}`);
      if (entry.isDirectory()) return collectDirectoryEntries(rootPath, entryPath);
      if (!entry.isFile()) return [];
      const relativePath = safeRelativePath(relative(rootPath, entryPath));
      return [{ relativePath, content: readFileSync(entryPath) }];
    });
}

function collectEntries(sources = []) {
  const seenKeys = new Set();
  const entries = [];
  const sourceKinds = {};
  (Array.isArray(sources) ? sources : []).forEach((source) => {
    const key = String(source?.key || '').trim();
    const sourcePath = source?.path ? resolve(source.path) : '';
    const required = Boolean(source?.required);
    if (!key) throw new Error('local-recovery-source-key-required');
    if (seenKeys.has(key)) throw new Error(`local-recovery-source-key-duplicate:${key}`);
    seenKeys.add(key);
    if (!sourcePath || !existsSync(sourcePath)) {
      if (required) throw new Error(`local-recovery-source-missing:${key}`);
      return;
    }
    const stats = statSync(sourcePath);
    const kind = source?.kind || (stats.isDirectory() ? 'directory' : 'file');
    if (kind === 'file' && !stats.isFile()) throw new Error(`local-recovery-source-kind-invalid:${key}`);
    if (kind === 'directory' && !stats.isDirectory()) throw new Error(`local-recovery-source-kind-invalid:${key}`);
    sourceKinds[key] = kind;
    const files = kind === 'directory'
      ? collectDirectoryEntries(sourcePath)
      : [{ relativePath: '', content: readFileSync(sourcePath) }];
    files.forEach((file) => entries.push({
      sourceKey: key,
      sourceKind: kind,
      relativePath: file.relativePath,
      checksum: sha256(file.content),
      size: file.content.byteLength,
      content: file.content.toString('base64'),
    }));
  });
  if (!entries.length) throw new Error('local-recovery-no-sources-found');
  return { entries, sourceKinds };
}

function encryptPayload(payload, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(requiredPassphrase(passphrase), salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decryptPayload(envelope = {}, passphrase) {
  try {
    const key = scryptSync(requiredPassphrase(passphrase), Buffer.from(envelope.salt, 'base64'), 32);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch (error) {
    if (error.message === 'local-recovery-passphrase-required') throw error;
    throw new Error('local-recovery-passphrase-invalid');
  }
}

function bundlePayload({ entries, sourceKinds, bundleId, createdAt }) {
  return {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    bundleId,
    createdAt,
    sourceKinds,
    entries,
  };
}

export function createLocalRecoveryBundle({
  backupDirectory,
  sources = [],
  passphrase,
  now = new Date().toISOString(),
} = {}) {
  const resolvedBackupDirectory = resolve(backupDirectory || '.');
  const { entries, sourceKinds } = collectEntries(sources);
  const bundleId = `recovery_${randomUUID()}`;
  const payload = bundlePayload({ entries, sourceKinds, bundleId, createdAt: now });
  const encrypted = encryptPayload(payload, passphrase);
  const envelope = {
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    bundleId,
    createdAt: now,
    cipher: 'aes-256-gcm',
    kdf: 'scrypt',
    ...encrypted,
  };
  mkdirSync(resolvedBackupDirectory, { recursive: true });
  const compactDate = String(now).replace(/[^0-9]/g, '').slice(0, 14) || Date.now().toString();
  const bundlePath = join(resolvedBackupDirectory, `hofs-local-recovery-${compactDate}-${bundleId.slice(-12)}.json.enc`);
  const tempPath = `${bundlePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(envelope, null, 2), 'utf8');
  replaceFileWithRetry(tempPath, bundlePath);
  return {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    bundleId,
    createdAt: now,
    bundlePath,
    entryCount: entries.length,
    sourceKeys: Object.keys(sourceKinds).sort(),
    encrypted: true,
  };
}

function targetPathForEntry(entry, destination) {
  const resolvedDestination = resolve(destination);
  if (entry.sourceKind === 'file') return resolvedDestination;
  const safePath = safeRelativePath(entry.relativePath);
  const targetPath = resolve(resolvedDestination, ...safePath.split('/'));
  if (!targetPath.startsWith(`${resolvedDestination}${sep}`)) throw new Error('local-recovery-target-path-invalid');
  return targetPath;
}

function preparedRestoreEntries(payload, destinations = {}) {
  if (payload?.schemaVersion !== BUNDLE_SCHEMA_VERSION || !Array.isArray(payload.entries)) {
    throw new Error('local-recovery-bundle-invalid');
  }
  return payload.entries.map((entry) => {
    const destination = destinations[entry.sourceKey];
    if (!destination) throw new Error(`local-recovery-destination-missing:${entry.sourceKey}`);
    if (!['file', 'directory'].includes(entry.sourceKind)) throw new Error('local-recovery-source-kind-invalid');
    const content = Buffer.from(entry.content || '', 'base64');
    if (sha256(content) !== entry.checksum || content.byteLength !== Number(entry.size)) {
      throw new Error('local-recovery-checksum-invalid');
    }
    return { targetPath: targetPathForEntry(entry, destination), content };
  });
}

export function restoreLocalRecoveryBundle({ bundlePath, passphrase, destinations = {} } = {}) {
  if (!bundlePath || !existsSync(bundlePath)) throw new Error('local-recovery-bundle-missing');
  let envelope;
  try {
    envelope = JSON.parse(readFileSync(bundlePath, 'utf8'));
  } catch {
    throw new Error('local-recovery-bundle-invalid');
  }
  if (envelope?.schemaVersion !== ENVELOPE_SCHEMA_VERSION || envelope.cipher !== 'aes-256-gcm' || envelope.kdf !== 'scrypt') {
    throw new Error('local-recovery-bundle-invalid');
  }
  const payload = decryptPayload(envelope, passphrase);
  const entries = preparedRestoreEntries(payload, destinations);
  const tempPaths = [];
  try {
    entries.forEach(({ targetPath, content }) => {
      mkdirSync(dirname(targetPath), { recursive: true });
      const tempPath = `${targetPath}.${randomUUID()}.restore.tmp`;
      writeFileSync(tempPath, content);
      tempPaths.push({ tempPath, targetPath });
    });
    tempPaths.forEach(({ tempPath, targetPath }) => replaceFileWithRetry(tempPath, targetPath, { rename: renameSync }));
  } finally {
    tempPaths.forEach(({ tempPath }) => {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    });
  }
  return {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    bundleId: payload.bundleId,
    createdAt: payload.createdAt,
    entryCount: entries.length,
    sourceKeys: Object.keys(payload.sourceKinds || {}).sort(),
    restoreMode: 'verified-overwrite',
  };
}
