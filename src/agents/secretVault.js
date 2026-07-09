const DEFAULT_SECRET_VAULT_PROVIDER = 'local-aes-gcm';
const DEFAULT_SECRET_VAULT_ALGORITHM = 'AES-GCM';
const DEFAULT_SECRET_VAULT_KDF = 'PBKDF2-SHA256';
const DEFAULT_SECRET_VAULT_ITERATIONS = 120_000;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function encoder() {
  return new TextEncoder();
}

function decoder() {
  return new TextDecoder();
}

function getCrypto() {
  return globalThis.crypto || null;
}

function getSubtleCrypto() {
  return getCrypto()?.subtle || null;
}

function randomBytes(length = 16) {
  const bytes = new Uint8Array(length);
  const cryptoApi = getCrypto();
  if (!cryptoApi?.getRandomValues) throw new Error('secret-vault-crypto-unavailable');
  cryptoApi.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64(bytes = new Uint8Array()) {
  if (typeof btoa === 'function') {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  throw new Error('secret-vault-base64-unavailable');
}

function base64ToBytes(value = '') {
  if (typeof atob === 'function') {
    const binary = atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(String(value || ''), 'base64'));
  }
  throw new Error('secret-vault-base64-unavailable');
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getNodeBuiltin(name = '') {
  const loader = globalThis.process?.getBuiltinModule;
  if (typeof loader !== 'function') return null;
  return loader(`node:${name}`) || loader(name);
}

function cleanRecords(records = []) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === 'object')
    .map((record) => ({
      ...record,
      value: undefined,
      plaintext: undefined,
      secret: undefined,
    }));
}

function readRecordFile(filePath = '') {
  const resolvedPath = String(filePath || '').trim();
  const fs = getNodeBuiltin('fs');
  if (!resolvedPath || !fs?.existsSync?.(resolvedPath)) return [];
  return cleanRecords(safeJsonParse(fs.readFileSync(resolvedPath, 'utf8'), []));
}

function writeRecordFile(filePath = '', records = []) {
  const resolvedPath = String(filePath || '').trim();
  const fs = getNodeBuiltin('fs');
  const path = getNodeBuiltin('path');
  if (!fs || !path) return;
  if (!resolvedPath) return;
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(cleanRecords(records), null, 2)}\n`, 'utf8');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  const text = stableJson(value);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return `chk_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function recordIsEncrypted(record = {}) {
  return Boolean(
    record.schemaVersion === 'secret-vault-record/v1'
    && record.algorithm === DEFAULT_SECRET_VAULT_ALGORITHM
    && record.kdf === DEFAULT_SECRET_VAULT_KDF
    && record.ciphertext
    && record.iv
    && record.salt
  );
}

async function deriveVaultKey(masterKey = '', saltBytes = new Uint8Array()) {
  const subtle = getSubtleCrypto();
  if (!subtle) throw new Error('secret-vault-subtle-crypto-unavailable');
  if (!masterKey) throw new Error('secret-vault-key-missing');
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder().encode(String(masterKey)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: DEFAULT_SECRET_VAULT_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: DEFAULT_SECRET_VAULT_ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function sealSecretRecord({
  id = '',
  name = '',
  value = '',
  masterKey = '',
  keyId = 'local',
  metadata = {},
  now = new Date().toISOString(),
} = {}) {
  const secretName = String(name || id || 'secret');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveVaultKey(masterKey, salt);
  const additionalData = encoder().encode(secretName);
  const ciphertext = await getSubtleCrypto().encrypt(
    { name: DEFAULT_SECRET_VAULT_ALGORITHM, iv, additionalData },
    key,
    encoder().encode(String(value || '')),
  );
  return {
    schemaVersion: 'secret-vault-record/v1',
    id: id || `secret_${secretName.replace(/[^a-z0-9_-]/gi, '_')}`,
    name: secretName,
    keyId,
    algorithm: DEFAULT_SECRET_VAULT_ALGORITHM,
    kdf: DEFAULT_SECRET_VAULT_KDF,
    iterations: DEFAULT_SECRET_VAULT_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    createdAt: now,
    updatedAt: now,
    metadata: {
      provider: DEFAULT_SECRET_VAULT_PROVIDER,
      ...metadata,
    },
  };
}

export async function openSecretRecord(record = {}, { masterKey = '' } = {}) {
  if (!recordIsEncrypted(record)) throw new Error('secret-vault-record-not-encrypted');
  const key = await deriveVaultKey(masterKey, base64ToBytes(record.salt));
  const plaintext = await getSubtleCrypto().decrypt(
    {
      name: DEFAULT_SECRET_VAULT_ALGORITHM,
      iv: base64ToBytes(record.iv),
      additionalData: encoder().encode(record.name || record.id || 'secret'),
    },
    key,
    base64ToBytes(record.ciphertext),
  );
  return decoder().decode(plaintext);
}

export async function rotateSecretRecords({
  records = [],
  currentMasterKey = '',
  nextMasterKey = '',
  nextKeyId = '',
  metadata = {},
  now = new Date().toISOString(),
} = {}) {
  if (!currentMasterKey) throw new Error('secret-vault-current-key-missing');
  if (!nextMasterKey) throw new Error('secret-vault-next-key-missing');
  if (!nextKeyId) throw new Error('secret-vault-next-key-id-missing');
  const encryptedRecords = cleanRecords(records);
  const rotatedRecords = [];
  const recordReceipts = [];
  for (const record of encryptedRecords) {
    const plaintext = await openSecretRecord(record, { masterKey: currentMasterKey });
    const rotated = await sealSecretRecord({
      id: record.id,
      name: record.name,
      value: plaintext,
      masterKey: nextMasterKey,
      keyId: nextKeyId,
      metadata: {
        ...(record.metadata || {}),
        ...metadata,
        rotatedFromKeyId: record.keyId || null,
      },
      now,
    });
    rotatedRecords.push(rotated);
    recordReceipts.push({
      id: rotated.id,
      name: rotated.name,
      previousKeyId: record.keyId || null,
      nextKeyId,
      encrypted: recordIsEncrypted(rotated),
      previousChecksum: checksum({
        id: record.id,
        name: record.name,
        keyId: record.keyId,
        ciphertext: record.ciphertext,
      }),
      nextChecksum: checksum({
        id: rotated.id,
        name: rotated.name,
        keyId: rotated.keyId,
        ciphertext: rotated.ciphertext,
      }),
    });
  }
  const receipt = {
    schemaVersion: 'secret-vault-rotation-receipt/v1',
    rotatedAt: now,
    nextKeyId,
    recordCount: encryptedRecords.length,
    rotatedRecordCount: rotatedRecords.length,
    failedRecordCount: 0,
    recordReceipts,
    plaintextExposed: false,
    productionCutoverReady: false,
  };
  receipt.checksum = checksum(receipt);
  return {
    records: rotatedRecords,
    receipt,
  };
}

export function normalizeSecretVaultStatus(status = {}) {
  const safeStatus = status && typeof status === 'object' ? status : {};
  const encryptedRecordCount = Number(safeStatus.encryptedRecordCount || 0);
  const rawSecretRecordCount = Number(safeStatus.rawSecretRecordCount || 0);
  const configured = Boolean(safeStatus.configured);
  const enabled = Boolean(safeStatus.enabled);
  const ready = Boolean(
    safeStatus.ready
    || (enabled && configured && rawSecretRecordCount === 0 && safeStatus.encryptionReady !== false)
  );
  return {
    schemaVersion: 'secret-vault-status/v1',
    provider: safeStatus.provider || (enabled ? DEFAULT_SECRET_VAULT_PROVIDER : 'none'),
    enabled,
    configured,
    ready,
    encryptionReady: Boolean(safeStatus.encryptionReady ?? (configured && Boolean(getSubtleCrypto()))),
    algorithm: safeStatus.algorithm || DEFAULT_SECRET_VAULT_ALGORITHM,
    kdf: safeStatus.kdf || DEFAULT_SECRET_VAULT_KDF,
    keyId: safeStatus.keyId || null,
    keySource: safeStatus.keySource || (configured ? 'configured' : 'missing'),
    secretCount: Number(safeStatus.secretCount || encryptedRecordCount || 0),
    encryptedRecordCount,
    rawSecretRecordCount,
    rawSecretExposure: Boolean(safeStatus.rawSecretExposure || rawSecretRecordCount > 0),
    rotationSupported: Boolean(safeStatus.rotationSupported),
    latestRotation: safeStatus.latestRotation && typeof safeStatus.latestRotation === 'object'
      ? {
        schemaVersion: safeStatus.latestRotation.schemaVersion || 'secret-vault-rotation-receipt/v1',
        rotatedAt: safeStatus.latestRotation.rotatedAt || null,
        nextKeyId: safeStatus.latestRotation.nextKeyId || null,
        recordCount: Number(safeStatus.latestRotation.recordCount || 0),
        rotatedRecordCount: Number(safeStatus.latestRotation.rotatedRecordCount || 0),
        failedRecordCount: Number(safeStatus.latestRotation.failedRecordCount || 0),
        plaintextExposed: Boolean(safeStatus.latestRotation.plaintextExposed),
        checksum: safeStatus.latestRotation.checksum || null,
      }
      : null,
    accessAuditSupported: Boolean(safeStatus.accessAuditSupported),
    productionReady: Boolean(safeStatus.productionReady),
    productionRequirement: safeStatus.productionRequirement
      || 'replace the local envelope vault with a managed KMS or secret manager before public production rollout',
  };
}

export function createLocalSecretVault({
  enabled = false,
  masterKey = '',
  keyId = 'local',
  keySource = 'SECRET_VAULT_KEY',
  records = [],
  recordsFile = '',
} = {}) {
  let currentMasterKey = masterKey;
  let currentKeyId = keyId;
  let currentKeySource = keySource;
  const sealedRecords = cleanRecords(records);
  const rotationReceipts = [];
  const persistRecords = () => {
    if (enabled && recordsFile) writeRecordFile(recordsFile, sealedRecords);
  };
  const vault = {
    async seal(name, value, metadata = {}) {
      const record = await sealSecretRecord({
        name,
        value,
        masterKey: currentMasterKey,
        keyId: currentKeyId,
        metadata,
      });
      const existingIndex = sealedRecords.findIndex((item) => (
        item.id === record.id || item.name === record.name
      ));
      if (existingIndex >= 0) {
        sealedRecords.splice(existingIndex, 1, record);
      } else {
        sealedRecords.push(record);
      }
      persistRecords();
      return record;
    },
    async open(record = {}) {
      return openSecretRecord(record, { masterKey: currentMasterKey });
    },
    async rotate({
      nextMasterKey = '',
      nextKeyId = '',
      metadata = {},
      now = new Date().toISOString(),
    } = {}) {
      const rotation = await rotateSecretRecords({
        records: sealedRecords,
        currentMasterKey,
        nextMasterKey,
        nextKeyId,
        metadata,
        now,
      });
      sealedRecords.splice(0, sealedRecords.length, ...rotation.records);
      currentMasterKey = nextMasterKey;
      currentKeyId = nextKeyId;
      currentKeySource = metadata.keySource || 'local-rotation-rehearsal';
      rotationReceipts.push(rotation.receipt);
      persistRecords();
      return {
        receipt: clone(rotation.receipt),
        records: rotation.records.map((record) => clone(record)),
      };
    },
    records() {
      return sealedRecords.map((record) => ({
        id: record.id,
        name: record.name,
        keyId: record.keyId,
        algorithm: record.algorithm,
        kdf: record.kdf,
        encrypted: recordIsEncrypted(record),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        metadata: record.metadata || {},
      }));
    },
    exportRecords() {
      return sealedRecords.map((record) => clone(record));
    },
    status() {
      const encryptedRecordCount = sealedRecords.filter(recordIsEncrypted).length;
      const rawSecretRecordCount = sealedRecords.filter((record) => !recordIsEncrypted(record)).length;
      const latestRotation = rotationReceipts.at(-1) || null;
      return normalizeSecretVaultStatus({
        provider: enabled ? DEFAULT_SECRET_VAULT_PROVIDER : 'none',
        enabled: Boolean(enabled),
        configured: Boolean(currentMasterKey),
        ready: Boolean(enabled && currentMasterKey && rawSecretRecordCount === 0 && getSubtleCrypto()),
        encryptionReady: Boolean(currentMasterKey && getSubtleCrypto()),
        keyId: currentMasterKey ? currentKeyId : null,
        keySource: currentMasterKey ? currentKeySource : 'missing',
        secretCount: sealedRecords.length,
        encryptedRecordCount,
        rawSecretRecordCount,
        rawSecretExposure: rawSecretRecordCount > 0,
        rotationSupported: Boolean(enabled && currentMasterKey && getSubtleCrypto()),
        latestRotation,
        accessAuditSupported: false,
        productionReady: false,
      });
    },
  };
  return vault;
}

export function createSecretVaultFromEnv(env = globalThis.process?.env || {}) {
  const recordsFile = env.SECRET_VAULT_RECORDS_FILE || '';
  const fileRecords = readRecordFile(recordsFile);
  const records = fileRecords.length ? fileRecords : safeJsonParse(env.SECRET_VAULT_RECORDS_JSON || '[]', []);
  return createLocalSecretVault({
    enabled: parseBoolean(env.SECRET_VAULT_ENABLED, false),
    masterKey: env.SECRET_VAULT_KEY || '',
    keyId: env.SECRET_VAULT_KEY_ID || 'local-env',
    keySource: env.SECRET_VAULT_KEY ? 'SECRET_VAULT_KEY' : 'missing',
    records,
    recordsFile,
  });
}

export {
  DEFAULT_SECRET_VAULT_PROVIDER,
  DEFAULT_SECRET_VAULT_ALGORITHM,
  DEFAULT_SECRET_VAULT_KDF,
};
