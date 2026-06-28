const ENFORCED_ACCESS_MODES = new Set(['enforced', 'strict']);
const ACCESS_SIGNATURE_HEADER = 'x-hofs-signature';
const ACCESS_SIGNED_AT_HEADER = 'x-hofs-signed-at';
const ACCESS_REQUEST_ID_HEADER = 'x-hofs-request-id';
const DEFAULT_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const HMAC_BLOCK_SIZE = 64;
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function normalizePath(path = '') {
  return String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
}

function normalizeMethod(method = 'GET') {
  return String(method || 'GET').toUpperCase();
}

function normalizeRole(role = '') {
  const value = String(role || '').trim().toLowerCase().replace(/_/g, '-');
  if (['admin', 'security', 'security-admin', 'owner'].includes(value)) return 'security-admin';
  if (['lead', 'leader', 'manager', 'director'].includes(value)) return 'manager';
  if (['reviewer', 'reviewer-agent', 'review-agent'].includes(value)) return 'reviewer-agent';
  if (['agent', 'persona-agent'].includes(value)) return 'agent';
  if (['runtime', 'runtime-platform', 'scheduler', 'worker'].includes(value)) return 'runtime-platform';
  if (['viewer', 'observer', 'read-only'].includes(value)) return 'observer';
  return value || 'anonymous';
}

function toUtf8Bytes(value = '') {
  return Array.from(new TextEncoder().encode(String(value || '')));
}

function rightRotate(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Bytes(inputBytes = []) {
  const bytes = [...inputBytes];
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const cursor = offset + (i * 4);
      words[i] = (
        (bytes[cursor] << 24)
        | (bytes[cursor + 1] << 16)
        | (bytes[cursor + 2] << 8)
        | bytes[cursor + 3]
      ) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = (rightRotate(words[i - 15], 7) ^ rightRotate(words[i - 15], 18) ^ (words[i - 15] >>> 3)) >>> 0;
      const s1 = (rightRotate(words[i - 2], 17) ^ rightRotate(words[i - 2], 19) ^ (words[i - 2] >>> 10)) >>> 0;
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i += 1) {
      const s1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) >>> 0;
      const ch = ((e & f) ^ ((~e) & g)) >>> 0;
      const temp1 = (h + s1 + ch + SHA256_K[i] + words[i]) >>> 0;
      const s0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.flatMap((word) => [
    (word >>> 24) & 0xff,
    (word >>> 16) & 0xff,
    (word >>> 8) & 0xff,
    word & 0xff,
  ]);
}

function bytesToHex(bytes = []) {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hmacSha256Hex(secret = '', message = '') {
  let key = toUtf8Bytes(secret);
  if (key.length > HMAC_BLOCK_SIZE) key = sha256Bytes(key);
  const paddedKey = [...key, ...Array(Math.max(0, HMAC_BLOCK_SIZE - key.length)).fill(0)].slice(0, HMAC_BLOCK_SIZE);
  const outerPad = paddedKey.map((byte) => byte ^ 0x5c);
  const innerPad = paddedKey.map((byte) => byte ^ 0x36);
  return bytesToHex(sha256Bytes([...outerPad, ...sha256Bytes([...innerPad, ...toUtf8Bytes(message)])]));
}

function constantTimeStringEqual(left = '', right = '') {
  const a = String(left || '');
  const b = String(right || '');
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function compactStrings(items = []) {
  return [...new Set((items || [])
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .map((item) => String(item || '').trim())
    .filter(Boolean))];
}

function policyList(policy = {}, ...keys) {
  return compactStrings(keys.flatMap((key) => policy[key] || []));
}

function policyAgentUsers(policy = {}, key = '', agentId = '') {
  const map = policy[key] || {};
  if (!agentId || !map || typeof map !== 'object') return [];
  return compactStrings(map[agentId] || map[String(agentId)] || []);
}

function membershipFailure({ decision = {}, policy = {}, reason = 'project-membership-mismatch' } = {}) {
  return {
    ...decision,
    allowed: false,
    status: 'denied',
    reason,
    membership: {
      required: true,
      verified: false,
      status: 'denied',
      reason,
      schemaVersion: policy.schemaVersion || 'project-membership-policy/v1',
      projectId: decision.route?.projectId || policy.projectId || null,
      role: decision.actor?.role || 'anonymous',
      agentId: decision.actor?.agentId || null,
      userId: decision.actor?.userId || null,
      source: policy.source || 'access-control-project-membership',
      revision: policy.revision || null,
      updatedAt: policy.updatedAt || null,
    },
  };
}

function membershipSuccess({ decision = {}, policy = {} } = {}) {
  return {
    ...decision,
    membership: {
      required: true,
      verified: true,
      status: 'allowed',
      schemaVersion: policy.schemaVersion || 'project-membership-policy/v1',
      projectId: decision.route?.projectId || policy.projectId || null,
      role: decision.actor?.role || 'anonymous',
      agentId: decision.actor?.agentId || null,
      userId: decision.actor?.userId || null,
      source: policy.source || 'access-control-project-membership',
      revision: policy.revision || null,
      updatedAt: policy.updatedAt || null,
    },
  };
}

function readHeader(headers = {}, key = '') {
  if (!headers || !key) return '';
  if (typeof headers.get === 'function') return headers.get(key) || headers.get(key.toLowerCase()) || '';
  const normalizedKey = key.toLowerCase();
  const match = Object.entries(headers).find(([headerKey]) => String(headerKey || '').toLowerCase() === normalizedKey);
  return match ? match[1] : '';
}

function canonicalAccessSignaturePayload({
  method = 'GET',
  path = '/',
  mode = 'enforced',
  role = '',
  agentId = '',
  userId = '',
  signedAt = '',
  requestId = '',
} = {}) {
  const fields = [
    normalizeMethod(method),
    normalizePath(path),
    String(mode || '').trim().toLowerCase(),
    normalizeRole(role),
    String(agentId || '').trim(),
    String(userId || '').trim(),
    String(signedAt || '').trim(),
  ];
  const normalizedRequestId = String(requestId || '').trim();
  if (normalizedRequestId) fields.push(normalizedRequestId);
  return fields.join('\n');
}

function normalizeSignature(signature = '') {
  return String(signature || '').trim().replace(/^sha256=/i, '').toLowerCase();
}

function signedAccessFailure({
  reason,
  context,
  route,
  signedAt = '',
  requestId = '',
  signature = '',
  maxAgeMs = DEFAULT_SIGNATURE_MAX_AGE_MS,
} = {}) {
  return {
    allowed: false,
    enforced: true,
    mode: context.mode,
    status: 'denied',
    reason,
    actor: {
      role: context.role,
      agentId: context.agentId || null,
      userId: context.userId || null,
    },
    route,
    signature: {
      required: true,
      verified: false,
      algorithm: 'hmac-sha256',
      signedAt: signedAt || null,
      requestId: requestId || null,
      supplied: Boolean(signature),
      maxAgeMs,
    },
  };
}

function verifySignedAccess({
  request = {},
  method = 'GET',
  path = '/',
  context,
  route,
  signingSecret = '',
  signatureMaxAgeMs = DEFAULT_SIGNATURE_MAX_AGE_MS,
  nowMs = Date.now(),
} = {}) {
  const maxAgeMs = Number.isFinite(Number(signatureMaxAgeMs))
    ? Math.max(0, Number(signatureMaxAgeMs))
    : DEFAULT_SIGNATURE_MAX_AGE_MS;
  const secret = String(signingSecret || '');
  if (!secret) {
    return signedAccessFailure({
      reason: 'signed-access-secret-missing',
      context,
      route,
      maxAgeMs,
    });
  }
  const headers = request.headers || {};
  const signedAt = String(
    request.accessSignedAt
    || request.signedAt
    || readHeader(headers, ACCESS_SIGNED_AT_HEADER)
    || '',
  ).trim();
  const signature = normalizeSignature(
    request.accessSignature
    || readHeader(headers, ACCESS_SIGNATURE_HEADER)
    || '',
  );
  const requestId = String(
    request.accessRequestId
    || request.requestId
    || readHeader(headers, ACCESS_REQUEST_ID_HEADER)
    || '',
  ).trim();
  if (!signedAt || !signature) {
    return signedAccessFailure({
      reason: 'signed-access-missing',
      context,
      route,
      signedAt,
      requestId,
      signature,
      maxAgeMs,
    });
  }
  const signedAtMs = Date.parse(signedAt);
  if (!Number.isFinite(signedAtMs)) {
    return signedAccessFailure({
      reason: 'signed-access-invalid-timestamp',
      context,
      route,
      signedAt,
      requestId,
      signature,
      maxAgeMs,
    });
  }
  if (maxAgeMs > 0 && Math.abs(Number(nowMs) - signedAtMs) > maxAgeMs) {
    return signedAccessFailure({
      reason: 'signed-access-expired',
      context,
      route,
      signedAt,
      requestId,
      signature,
      maxAgeMs,
    });
  }
  const expected = hmacSha256Hex(secret, canonicalAccessSignaturePayload({
    method,
    path,
    mode: context.mode,
    role: context.role,
    agentId: context.agentId,
    userId: context.userId,
    signedAt,
    requestId,
  }));
  if (!constantTimeStringEqual(signature, expected)) {
    return signedAccessFailure({
      reason: 'signed-access-invalid',
      context,
      route,
      signedAt,
      requestId,
      signature,
      maxAgeMs,
    });
  }
  return {
    required: true,
    verified: true,
    algorithm: 'hmac-sha256',
    signedAt,
    requestId: requestId || null,
    supplied: true,
    maxAgeMs,
  };
}

export function signAgentProjectAccessHeaders({
  method = 'GET',
  path = '/',
  mode = 'enforced',
  role = '',
  agentId = '',
  userId = '',
  signedAt = new Date().toISOString(),
  requestId = '',
  secret = '',
} = {}) {
  const normalizedMode = String(mode || 'enforced').trim().toLowerCase();
  const normalizedRole = normalizeRole(role);
  const normalizedAgentId = String(agentId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  const normalizedSignedAt = String(signedAt || new Date().toISOString()).trim();
  const normalizedRequestId = String(requestId || '').trim();
  const signature = hmacSha256Hex(secret, canonicalAccessSignaturePayload({
    method,
    path,
    mode: normalizedMode,
    role: normalizedRole,
    agentId: normalizedAgentId,
    userId: normalizedUserId,
    signedAt: normalizedSignedAt,
    requestId: normalizedRequestId,
  }));
  return {
    'x-hofs-access-mode': normalizedMode,
    'x-hofs-role': normalizedRole,
    ...(normalizedAgentId ? { 'x-hofs-agent-id': normalizedAgentId } : {}),
    ...(normalizedUserId ? { 'x-hofs-user-id': normalizedUserId } : {}),
    [ACCESS_SIGNED_AT_HEADER]: normalizedSignedAt,
    ...(normalizedRequestId ? { [ACCESS_REQUEST_ID_HEADER]: normalizedRequestId } : {}),
    [ACCESS_SIGNATURE_HEADER]: `sha256=${signature}`,
  };
}

function parseProjectRoute(path = '') {
  const parts = normalizePath(path).split('/').filter(Boolean);
  const rootIndex = parts.indexOf('projects');
  if (rootIndex < 0 || !parts[rootIndex + 1]) return null;
  return {
    projectId: decodeURIComponent(parts[rootIndex + 1]),
    action: parts[rootIndex + 2] || 'get',
    tail: parts.slice(rootIndex + 3),
  };
}

function parseKickoffMeetingRoute(path = '') {
  const parts = normalizePath(path).split('/').filter(Boolean);
  if (parts[0] !== 'kickoff-meetings') return null;
  return {
    meetingId: parts[1] ? decodeURIComponent(parts[1]) : null,
    action: parts[2] || 'get',
  };
}

function parseWorkerRoute(path = '') {
  const parts = normalizePath(path).split('/').filter(Boolean);
  if (parts[0] !== 'workers') return null;
  return {
    worker: parts[1] || '',
    action: parts[2] || '',
  };
}

function extractAccessContext(request = {}, defaultMode = 'prototype-open') {
  const body = request.body || {};
  const headers = request.headers || {};
  const mode = String(
    request.accessMode
    || body.accessMode
    || readHeader(headers, 'x-hofs-access-mode')
    || defaultMode
    || 'prototype-open',
  ).trim().toLowerCase();
  const role = normalizeRole(
    request.actorRole
    || body.actorRole
    || body.accessRole
    || readHeader(headers, 'x-hofs-role'),
  );
  const agentId = String(
    request.actorAgentId
    || body.actorAgentId
    || body.accessAgentId
    || readHeader(headers, 'x-hofs-agent-id')
    || '',
  ).trim();
  const userId = String(
    request.actorUserId
    || body.actorUserId
    || body.accessUserId
    || readHeader(headers, 'x-hofs-user-id')
    || '',
  ).trim();
  return {
    mode,
    enforced: ENFORCED_ACCESS_MODES.has(mode),
    role,
    agentId,
    userId,
  };
}

function accessRoute({
  routeKey,
  capability,
  sensitivity = 'project-data',
  projectId = null,
  agentId = null,
  allowedRoles = ['manager', 'security-admin'],
  selfAgent = false,
  reviewerMatch = false,
  runtimeOnly = false,
}) {
  return {
    routeKey,
    capability,
    sensitivity,
    projectId,
    agentId,
    allowedRoles,
    selfAgent,
    reviewerMatch,
    runtimeOnly,
  };
}

export function classifyAccessRequest({ method = 'GET', path = '/', body = {} } = {}) {
  const resolvedMethod = normalizeMethod(method);
  const resolvedPath = normalizePath(path);
  const kickoffRoute = parseKickoffMeetingRoute(resolvedPath);
  const workerRoute = parseWorkerRoute(resolvedPath);
  const projectRoute = parseProjectRoute(resolvedPath);

  if (resolvedPath === '/snapshot') {
    return accessRoute({
      routeKey: 'snapshot',
      capability: 'export local service snapshot',
      sensitivity: 'cross-project-state',
      allowedRoles: ['security-admin'],
    });
  }
  if (resolvedPath === '/llm/status' || resolvedPath === '/search/status') {
    return accessRoute({
      routeKey: resolvedPath === '/llm/status' ? 'llm-status' : 'search-status',
      capability: 'read provider status',
      sensitivity: 'provider-status',
      allowedRoles: ['manager', 'security-admin'],
    });
  }
  if (resolvedPath === '/llm/test' || resolvedPath === '/search/test') {
    return accessRoute({
      routeKey: resolvedPath === '/llm/test' ? 'llm-test' : 'search-test',
      capability: 'run provider health check',
      sensitivity: 'provider-request',
      allowedRoles: ['manager', 'security-admin'],
    });
  }
  if (resolvedPath === '/projects') {
    return accessRoute({
      routeKey: 'projects',
      capability: resolvedMethod === 'GET' ? 'list projects' : 'create project',
      sensitivity: resolvedMethod === 'GET' ? 'project-metadata' : 'project-creation',
      allowedRoles: resolvedMethod === 'GET'
        ? ['manager', 'security-admin', 'observer']
        : ['manager', 'security-admin'],
    });
  }
  if (resolvedPath === '/projects/initiate') {
    return accessRoute({
      routeKey: 'project-initiate',
      capability: 'initiate project',
      sensitivity: 'project-creation',
      allowedRoles: ['manager', 'security-admin'],
    });
  }
  if (kickoffRoute) {
    return accessRoute({
      routeKey: 'kickoff-meetings',
      capability: resolvedMethod === 'GET' ? 'read kickoff meeting' : 'write kickoff meeting',
      sensitivity: 'project-initiation',
      allowedRoles: resolvedMethod === 'GET'
        ? ['manager', 'security-admin', 'observer']
        : ['manager', 'security-admin'],
    });
  }
  if (workerRoute) {
    return accessRoute({
      routeKey: workerRoute.worker === 'queue-snapshot' ? 'global-worker-queue' : `worker-${workerRoute.worker}-${workerRoute.action}`,
      capability: workerRoute.worker === 'queue-snapshot' ? 'preview global worker queue' : 'run backend worker',
      sensitivity: 'runtime-scheduler',
      allowedRoles: ['runtime-platform', 'security-admin'],
      runtimeOnly: true,
    });
  }
  if (!projectRoute) {
    return accessRoute({
      routeKey: 'unknown',
      capability: 'unknown route',
      sensitivity: 'unknown',
      allowedRoles: ['security-admin'],
    });
  }

  const projectId = projectRoute.projectId;
  const action = projectRoute.action;
  if (action === 'agents') {
    const agentId = projectRoute.tail[0] ? decodeURIComponent(projectRoute.tail[0]) : null;
    const section = projectRoute.tail[1] || 'state';
    if (!agentId) {
      return accessRoute({
        routeKey: 'agents',
        capability: 'list project Agents',
        sensitivity: 'agent-state',
        projectId,
        allowedRoles: ['manager', 'security-admin'],
      });
    }
    if (resolvedMethod === 'POST' && ['message', 'submissions', 'evidence-searches', 'work-cycle'].includes(section)) {
      return accessRoute({
        routeKey: `agent-${section}`,
        capability: `write Agent ${section}`,
        sensitivity: section === 'submissions' ? 'artifact-content' : section === 'evidence-searches' ? 'search-and-evidence' : 'agent-work',
        projectId,
        agentId,
        allowedRoles: ['agent', 'reviewer-agent', 'security-admin'],
        selfAgent: true,
      });
    }
    return accessRoute({
      routeKey: 'agent-read',
      capability: `read Agent ${section}`,
      sensitivity: 'agent-state',
      projectId,
      agentId,
      allowedRoles: ['manager', 'security-admin', 'agent', 'reviewer-agent'],
      selfAgent: true,
    });
  }

  if (action === 'submissions' && resolvedMethod === 'POST' && projectRoute.tail[1] === 'reviews') {
    return accessRoute({
      routeKey: 'submission-review-create',
      capability: 'write submission review',
      sensitivity: 'review-comments-and-artifact-lineage',
      projectId,
      allowedRoles: ['manager', 'reviewer-agent', 'security-admin'],
      reviewerMatch: true,
    });
  }
  if (action === 'security-boundary' || action === 'security-access-audit' || action === 'security-audit-stream') {
    const capability = action === 'security-boundary'
      ? 'read security boundary'
      : action === 'security-access-audit'
        ? 'read security access audit'
        : 'read backend security audit stream';
    return accessRoute({
      routeKey: action,
      capability,
      sensitivity: 'security-posture-metadata',
      projectId,
      allowedRoles: ['manager', 'security-admin'],
    });
  }
  if (action === 'membership-policy') {
    return accessRoute({
      routeKey: 'membership-policy',
      capability: resolvedMethod === 'GET' ? 'read project membership policy' : 'update project membership policy',
      sensitivity: 'project-membership-and-runtime-bindings',
      projectId,
      allowedRoles: ['manager', 'security-admin'],
    });
  }
  if (action === 'identity-sessions') {
    return accessRoute({
      routeKey: 'identity-sessions',
      capability: resolvedMethod === 'GET' ? 'read identity session contract' : projectRoute.tail[1] === 'revoke' ? 'revoke identity session' : 'issue identity session',
      sensitivity: 'identity-session-and-runtime-credential',
      projectId,
      allowedRoles: ['manager', 'security-admin'],
    });
  }
  if (action === 'persistence-snapshot') {
    return accessRoute({
      routeKey: 'persistence-snapshot',
      capability: 'export persistence snapshot',
      sensitivity: 'compact-project-records-and-checksums',
      projectId,
      allowedRoles: ['security-admin'],
    });
  }
  if (action === 'persistence-migration-plan') {
    return accessRoute({
      routeKey: 'persistence-migration-plan',
      capability: 'export managed persistence migration plan',
      sensitivity: 'database-schema-cutover-and-security-policy',
      projectId,
      allowedRoles: ['security-admin'],
    });
  }
  if (action === 'persistence-migration-dry-run') {
    return accessRoute({
      routeKey: 'persistence-migration-dry-run',
      capability: 'run managed persistence migration dry-run verification',
      sensitivity: 'database-import-verification-and-security-policy',
      projectId,
      allowedRoles: ['security-admin'],
    });
  }
  if (action === 'persistence-adapter-plan') {
    return accessRoute({
      routeKey: 'persistence-adapter-plan',
      capability: 'read managed persistence adapter plan',
      sensitivity: 'database-adapter-cutover-and-backup-policy',
      projectId,
      allowedRoles: ['security-admin'],
    });
  }
  if (action === 'persistence-adapter-dry-run') {
    return accessRoute({
      routeKey: 'persistence-adapter-dry-run',
      capability: 'run managed persistence adapter cutover dry-run',
      sensitivity: 'database-shadow-read-rollback-and-cutover-metadata',
      projectId,
      allowedRoles: ['security-admin'],
    });
  }
  if (action === 'worker-queue') {
    return accessRoute({
      routeKey: 'worker-queue',
      capability: 'preview project worker queue',
      sensitivity: 'runtime-scheduler',
      projectId,
      allowedRoles: ['manager', 'runtime-platform', 'security-admin'],
    });
  }
  if (action === 'worker-queue-adapter-plan') {
    return accessRoute({
      routeKey: 'worker-queue-adapter-plan',
      capability: 'read worker queue adapter plan',
      sensitivity: 'queue-cutover-schedule-and-runtime-metadata',
      projectId,
      allowedRoles: ['manager', 'runtime-platform', 'security-admin'],
    });
  }
  if (action === 'worker-queue-adapter-dry-run') {
    return accessRoute({
      routeKey: 'worker-queue-adapter-dry-run',
      capability: 'run worker queue adapter dry-run verification',
      sensitivity: 'queue-dispatch-lease-and-recovery-metadata',
      projectId,
      allowedRoles: ['manager', 'runtime-platform', 'security-admin'],
    });
  }
  if (action === 'adapter-gateway-preflight') {
    return accessRoute({
      routeKey: 'adapter-gateway-preflight',
      capability: 'read private adapter gateway preflight',
      sensitivity: 'gateway-health-storage-and-queue-metadata',
      projectId,
      allowedRoles: ['manager', 'runtime-platform', 'security-admin'],
    });
  }
  if (action === 'project-evidence-archive') {
    return accessRoute({
      routeKey: 'project-evidence-archive',
      capability: 'export manager-verifiable project evidence archive',
      sensitivity: 'project-export-evidence-bundle',
      projectId,
      allowedRoles: ['manager', 'security-admin', 'observer'],
    });
  }
  if (action === 'project-evidence-exports') {
    return accessRoute({
      routeKey: 'project-evidence-exports',
      capability: resolvedMethod === 'GET' ? 'read project evidence export workflow' : 'write project evidence export approval',
      sensitivity: 'project-export-approval-and-download-audit',
      projectId,
      allowedRoles: resolvedMethod === 'GET'
        ? ['manager', 'security-admin', 'observer']
        : ['manager', 'security-admin', 'operations-owner'],
    });
  }
  if (action === 'operations-readiness') {
    return accessRoute({
      routeKey: 'operations-readiness',
      capability: 'read operations readiness and recovery contract',
      sensitivity: 'runtime-health-security-and-recovery-metadata',
      projectId,
      allowedRoles: ['manager', 'runtime-platform', 'security-admin'],
    });
  }
  if (action === 'provider-readiness') {
    return accessRoute({
      routeKey: 'provider-readiness',
      capability: 'read provider readiness and rollout blocker contract',
      sensitivity: 'provider-configuration-and-rollout-metadata',
      projectId,
      allowedRoles: ['manager', 'runtime-platform', 'security-admin'],
    });
  }
  if (action === 'evidence-quality-audit') {
    return accessRoute({
      routeKey: 'evidence-quality-audit',
      capability: 'read evidence quality and source-safety audit',
      sensitivity: 'evidence-quality-and-source-safety-audit',
      projectId,
      allowedRoles: ['manager', 'security-admin', 'observer'],
    });
  }
  if (action === 'evidence-source-review-workflow') {
    return accessRoute({
      routeKey: 'evidence-source-review-workflow',
      capability: 'read evidence source review workflow',
      sensitivity: 'evidence-source-review-policy-and-proof-routes',
      projectId,
      allowedRoles: ['manager', 'security-admin', 'observer'],
    });
  }
  if (action === 'launch-approvals') {
    return accessRoute({
      routeKey: 'launch-approvals',
      capability: resolvedMethod === 'GET' ? 'read launch approval workflow' : 'write launch approval decision',
      sensitivity: 'release-approval-and-change-management-audit',
      projectId,
      allowedRoles: resolvedMethod === 'GET'
        ? ['manager', 'security-admin', 'observer']
        : ['manager', 'security-admin'],
    });
  }
  if (['workspace', 'local-runtime'].includes(action)) {
    return accessRoute({
      routeKey: action,
      capability: `${resolvedMethod === 'GET' ? 'read' : 'write'} local workspace runtime`,
      sensitivity: 'local-filesystem',
      projectId,
      allowedRoles: ['manager', 'security-admin'],
    });
  }
  if ([
    'chat',
    'meeting',
    'autonomous-cycle',
    'manager-flow-graph',
    'manager-command-center',
    'manager-scenario-walkthrough',
    'manager-action-queue',
  ].includes(action) && resolvedMethod !== 'GET') {
    return accessRoute({
      routeKey: action,
      capability: `write ${action}`,
      sensitivity: 'project-command',
      projectId,
      allowedRoles: ['manager', 'security-admin'],
    });
  }
  if (['submissions', 'evidence-searches', 'submission-reviews'].includes(action)) {
    return accessRoute({
      routeKey: action,
      capability: `read ${action}`,
      sensitivity: action === 'submissions' ? 'artifact-content' : action === 'evidence-searches' ? 'search-and-evidence' : 'review-comments',
      projectId,
      allowedRoles: ['manager', 'security-admin', 'observer'],
    });
  }
  if (['messages', 'transcripts', 'timeline', 'events', 'tasks', 'readiness', 'readiness-proof-map', 'manager-dashboard', 'manager-flow-graph', 'manager-ready-package', 'pilot-launch-readiness', 'deployment-preflight', 'production-launch-audit', 'mvp-readiness', 'manager-command-center', 'manager-scenario-trail', 'manager-scenario-walkthrough', 'manager-requirement-matrix', 'manager-use-case-audit', 'manager-action-queue', 'get'].includes(action)) {
    return accessRoute({
      routeKey: action === 'get' ? 'project' : action,
      capability: `read ${action === 'get' ? 'project' : action}`,
      sensitivity: 'project-state-and-proof-routes',
      projectId,
      allowedRoles: ['manager', 'security-admin', 'observer'],
    });
  }

  return accessRoute({
    routeKey: action,
    capability: `${resolvedMethod} ${action}`,
    sensitivity: 'project-data',
    projectId,
    allowedRoles: ['manager', 'security-admin'],
  });
}

function evaluateAccess({ context, route, body = {} } = {}) {
  if (context.role === 'security-admin') return { allowed: true, reason: 'security-admin' };
  if (!route.allowedRoles.includes(context.role)) {
    return {
      allowed: false,
      reason: `role ${context.role} is not allowed for ${route.routeKey}`,
    };
  }
  if (route.runtimeOnly && context.role !== 'runtime-platform') {
    return {
      allowed: false,
      reason: `${route.routeKey} requires runtime-platform role`,
    };
  }
  if (route.selfAgent && ['agent', 'reviewer-agent'].includes(context.role) && route.agentId && context.agentId !== route.agentId) {
    return {
      allowed: false,
      reason: `Agent ${context.agentId || 'unknown'} cannot access Agent ${route.agentId}`,
    };
  }
  if (route.reviewerMatch && context.role === 'reviewer-agent') {
    const reviewerAgentId = String(body.reviewerAgentId || body.reviewerId || '').trim();
    if (!reviewerAgentId || reviewerAgentId !== context.agentId) {
      return {
        allowed: false,
        reason: `Reviewer ${context.agentId || 'unknown'} cannot submit review for ${reviewerAgentId || 'unknown reviewer'}`,
      };
    }
  }
  return { allowed: true, reason: 'role-policy-match' };
}

export function evaluateProjectMembershipAccess(decision = {}, policy = {}, {
  required = false,
} = {}) {
  if (!required || !decision.enforced || !decision.allowed || !decision.route?.projectId) return decision;
  if (!policy || typeof policy !== 'object' || !Object.keys(policy).length) {
    return membershipFailure({ decision, policy: {}, reason: 'project-membership-policy-missing' });
  }

  const role = decision.actor?.role || 'anonymous';
  const userId = decision.actor?.userId || '';
  const agentId = decision.actor?.agentId || '';
  const routeAgentId = decision.route?.agentId || agentId;
  const hasUser = (items = []) => compactStrings(items).includes(userId);
  const hasAgent = (items = []) => compactStrings(items).includes(routeAgentId || agentId);
  const agentIds = policyList(policy, 'agentIds', 'teamAgentIds');
  const reviewerAgentIds = policyList(policy, 'reviewerAgentIds', 'reviewerIds');
  const revokedUserIds = policyList(policy, 'revokedUserIds', 'revokedUsers');
  const revokedAgentIds = policyList(policy, 'revokedAgentIds', 'revokedAgents');

  if (userId && revokedUserIds.includes(userId)) {
    return membershipFailure({ decision, policy, reason: 'project-membership-revoked' });
  }
  if ((routeAgentId || agentId) && revokedAgentIds.includes(routeAgentId || agentId)) {
    return membershipFailure({ decision, policy, reason: 'project-membership-revoked' });
  }

  if (role === 'security-admin') {
    if (policy.allowSecurityAdminBypass || hasUser(policyList(policy, 'securityAdminUserIds', 'securityAdmins'))) {
      return membershipSuccess({ decision, policy });
    }
    return membershipFailure({ decision, policy });
  }
  if (role === 'manager') {
    if (hasUser(policyList(policy, 'managerUserIds', 'managerUsers', 'ownerUserIds'))) {
      return membershipSuccess({ decision, policy });
    }
    return membershipFailure({ decision, policy });
  }
  if (role === 'observer') {
    if (hasUser(policyList(policy, 'observerUserIds', 'observerUsers'))) {
      return membershipSuccess({ decision, policy });
    }
    return membershipFailure({ decision, policy });
  }
  if (role === 'runtime-platform') {
    if (hasUser(policyList(policy, 'runtimeUserIds', 'runtimeUsers', 'serviceUserIds'))) {
      return membershipSuccess({ decision, policy });
    }
    return membershipFailure({ decision, policy });
  }
  if (role === 'agent') {
    if (!hasAgent(agentIds)) return membershipFailure({ decision, policy });
    const boundUsers = policyAgentUsers(policy, 'agentUserIds', routeAgentId || agentId);
    if (boundUsers.length && !hasUser(boundUsers)) return membershipFailure({ decision, policy });
    return membershipSuccess({ decision, policy });
  }
  if (role === 'reviewer-agent') {
    const allowedReviewerIds = reviewerAgentIds.length ? reviewerAgentIds : agentIds;
    if (!hasAgent(allowedReviewerIds)) return membershipFailure({ decision, policy });
    const boundUsers = policyAgentUsers(policy, 'reviewerUserIds', routeAgentId || agentId);
    if (boundUsers.length && !hasUser(boundUsers)) return membershipFailure({ decision, policy });
    return membershipSuccess({ decision, policy });
  }

  return membershipFailure({ decision, policy });
}

export function authorizeAgentProjectRequest(request = {}, {
  defaultMode = 'prototype-open',
  signingSecret = '',
  requireSignedHeaders = false,
  signatureMaxAgeMs = DEFAULT_SIGNATURE_MAX_AGE_MS,
  signatureNowMs = Date.now(),
} = {}) {
  const method = normalizeMethod(request.method);
  const path = normalizePath(request.path || request.url || '/');
  const body = request.body || {};
  const context = extractAccessContext(request, defaultMode);
  const route = classifyAccessRequest({ method, path, body });
  if (!context.enforced) {
    return {
      allowed: true,
      enforced: false,
      mode: context.mode,
      status: 'allowed-prototype-open',
      reason: 'access control is in prototype-open/report-only mode',
      actor: {
        role: context.role,
        agentId: context.agentId || null,
        userId: context.userId || null,
      },
      route,
    };
  }
  if (requireSignedHeaders || signingSecret) {
    const signatureResult = verifySignedAccess({
      request,
      method,
      path,
      context,
      route,
      signingSecret,
      signatureMaxAgeMs,
      nowMs: signatureNowMs,
    });
    if (!signatureResult.verified) return signatureResult;
    context.signature = signatureResult;
  }
  const result = evaluateAccess({ context, route, body });
  return {
    allowed: result.allowed,
    enforced: true,
    mode: context.mode,
    status: result.allowed ? 'allowed' : 'denied',
    reason: result.reason,
    actor: {
      role: context.role,
      agentId: context.agentId || null,
      userId: context.userId || null,
    },
    route,
    signature: context.signature || {
      required: false,
      verified: false,
      algorithm: 'hmac-sha256',
      signedAt: null,
      requestId: null,
      supplied: false,
      maxAgeMs: signatureMaxAgeMs,
    },
  };
}

export function publicAccessDecision(decision = {}) {
  return {
    allowed: Boolean(decision.allowed),
    enforced: Boolean(decision.enforced),
    mode: decision.mode || 'prototype-open',
    status: decision.status || 'unknown',
    reason: decision.reason || '',
    actor: decision.actor || { role: 'anonymous', agentId: null, userId: null },
    replay: decision.replay ? {
      required: Boolean(decision.replay.required),
      verified: Boolean(decision.replay.verified),
      detected: Boolean(decision.replay.detected),
      requestId: decision.replay.requestId || null,
      cache: decision.replay.cache || 'api-memory',
      storage: decision.replay.storage || decision.replay.cache || 'api-memory',
      maxAgeMs: decision.replay.maxAgeMs || DEFAULT_SIGNATURE_MAX_AGE_MS,
    } : null,
    membership: decision.membership ? {
      required: Boolean(decision.membership.required),
      verified: Boolean(decision.membership.verified),
      status: decision.membership.status || 'unknown',
      reason: decision.membership.reason || '',
      schemaVersion: decision.membership.schemaVersion || 'project-membership-policy/v1',
      projectId: decision.membership.projectId || null,
      role: decision.membership.role || decision.actor?.role || 'anonymous',
      agentId: decision.membership.agentId || null,
      userId: decision.membership.userId || null,
      source: decision.membership.source || 'access-control-project-membership',
      revision: decision.membership.revision || null,
      updatedAt: decision.membership.updatedAt || null,
    } : null,
    identitySession: decision.identitySession ? {
      required: Boolean(decision.identitySession.required),
      verified: Boolean(decision.identitySession.verified),
      sessionId: decision.identitySession.sessionId || null,
      status: decision.identitySession.status || 'unknown',
      expiresAt: decision.identitySession.expiresAt || null,
    } : null,
    signature: decision.signature ? {
      required: Boolean(decision.signature.required),
      verified: Boolean(decision.signature.verified),
      algorithm: decision.signature.algorithm || 'hmac-sha256',
      signedAt: decision.signature.signedAt || null,
      requestId: decision.signature.requestId || null,
      supplied: Boolean(decision.signature.supplied),
      maxAgeMs: decision.signature.maxAgeMs || DEFAULT_SIGNATURE_MAX_AGE_MS,
    } : null,
    route: decision.route ? {
      routeKey: decision.route.routeKey,
      capability: decision.route.capability,
      sensitivity: decision.route.sensitivity,
      projectId: decision.route.projectId || null,
      agentId: decision.route.agentId || null,
      allowedRoles: decision.route.allowedRoles || [],
      selfAgent: Boolean(decision.route.selfAgent),
      reviewerMatch: Boolean(decision.route.reviewerMatch),
      runtimeOnly: Boolean(decision.route.runtimeOnly),
    } : null,
  };
}

export function buildAccessControlPolicySnapshot() {
  return {
    schemaVersion: 'access-control-policy/v1',
    status: 'enforceable-prototype-policy',
    defaultMode: 'prototype-open',
    enforcedModeHeader: 'x-hofs-access-mode: enforced',
    actorHeaders: ['x-hofs-role', 'x-hofs-agent-id', 'x-hofs-user-id'],
    optionalSignedIdentityHeaders: [ACCESS_SIGNED_AT_HEADER, ACCESS_REQUEST_ID_HEADER, ACCESS_SIGNATURE_HEADER],
    signedIdentityContract: {
      status: 'optional-until-secret-configured',
      algorithm: 'hmac-sha256',
      canonicalPayload: 'METHOD\\nPATH\\nMODE\\nROLE\\nAGENT_ID\\nUSER_ID\\nSIGNED_AT[\\nREQUEST_ID]',
      maxAgeMs: DEFAULT_SIGNATURE_MAX_AGE_MS,
      behavior: 'When a backend signing secret is configured, enforced-mode requests must include valid signed identity headers before role policy is evaluated.',
    },
    replayProtectionContract: {
      status: 'optional-until-requireSignedRequestIds-enabled',
      requestIdHeader: ACCESS_REQUEST_ID_HEADER,
      behavior: 'When replay protection is enabled, signed enforced requests must include a signed request id that is accepted once within the signature freshness window.',
      storage: 'file-backed API replay records for the local Node backend, with in-memory fallback for custom prototypes; production needs shared database or centralized replay storage.',
    },
    auditWriteContract: {
      status: 'optional-until-failClosedOnAuditError-enabled',
      behavior: 'When fail-closed audit mode is enabled, enforced project access is rejected if the backend cannot persist the security access audit decision before route dispatch.',
      failureStatusCode: 503,
      productionRequirement: 'Production deployments should combine fail-closed writes with durable centralized audit storage and operational alerting.',
    },
    projectMembershipContract: {
      status: 'optional-until-requireProjectMembership-enabled',
      schemaVersion: 'project-membership-policy/v1',
      behavior: 'When the API is configured with requireProjectMembership, project-scoped enforced requests must match the configured or persisted project membership policy after signature and role checks.',
      policyFields: ['managerUserIds', 'securityAdminUserIds', 'observerUserIds', 'runtimeUserIds', 'agentIds', 'reviewerAgentIds', 'agentUserIds', 'reviewerUserIds', 'revokedUserIds', 'revokedAgentIds'],
      persistedProjectRoute: '/projects/:projectId/membership-policy',
      persistenceTables: ['project_membership_policies', 'project_membership_grants'],
    },
    identitySessionContract: {
      status: 'local-token-hash-contract',
      schemaVersion: 'identity-session/v1',
      behavior: 'Manager or security-admin can issue a project-scoped identity-session token that is returned once, stored as a token hash, accepted through x-hofs-session-token, and revocable through the same backend route.',
      tokenHeader: 'x-hofs-session-token',
      persistedProjectRoute: '/projects/:projectId/identity-sessions',
      persistenceTables: ['identity_sessions'],
      productionRequirement: 'Replace local token hashing with first-party IdP/session storage, service credential issuance, rotation, audience binding, and centralized audit.',
    },
    roles: [
      { id: 'manager', purpose: 'Director/manager project control and read access.' },
      { id: 'agent', purpose: 'Persona Agent self-scoped work and submission access.' },
      { id: 'reviewer-agent', purpose: 'Reviewer Agent self-scoped review access.' },
      { id: 'runtime-platform', purpose: 'Scheduler and worker queue execution.' },
      { id: 'security-admin', purpose: 'Security, export, and cross-project administrative access.' },
      { id: 'observer', purpose: 'Read-only project status access without artifact write privileges.' },
    ],
    capabilities: [
      { id: 'project-read', roles: ['manager', 'security-admin', 'observer'], examples: ['/projects/:id', '/projects/:id/manager-dashboard'] },
      { id: 'project-command', roles: ['manager', 'security-admin'], examples: ['/projects/:id/chat', '/projects/:id/meeting'] },
      { id: 'agent-self-write', roles: ['agent', 'reviewer-agent', 'security-admin'], examples: ['/projects/:id/agents/:agentId/submissions'] },
      { id: 'review-write', roles: ['manager', 'reviewer-agent', 'security-admin'], examples: ['/projects/:id/submissions/:submissionId/reviews'] },
      { id: 'runtime-worker', roles: ['runtime-platform', 'security-admin'], examples: ['/workers/autonomous/due', '/workers/agents/due'] },
      { id: 'security-read', roles: ['manager', 'security-admin'], examples: ['/projects/:id/security-boundary'] },
      { id: 'security-audit-read', roles: ['manager', 'security-admin'], examples: ['/projects/:id/security-access-audit'] },
      { id: 'security-audit-stream-read', roles: ['manager', 'security-admin'], examples: ['/projects/:id/security-audit-stream'] },
      { id: 'identity-session-control', roles: ['manager', 'security-admin'], examples: ['/projects/:id/identity-sessions'] },
      { id: 'pilot-launch-readiness-read', roles: ['manager', 'security-admin', 'observer'], examples: ['/projects/:id/pilot-launch-readiness'] },
      { id: 'deployment-preflight-read', roles: ['manager', 'security-admin', 'observer'], examples: ['/projects/:id/deployment-preflight'] },
      { id: 'adapter-gateway-preflight-read', roles: ['manager', 'runtime-platform', 'security-admin'], examples: ['/projects/:id/adapter-gateway-preflight'] },
      { id: 'production-launch-audit-read', roles: ['manager', 'security-admin', 'observer'], examples: ['/projects/:id/production-launch-audit'] },
      { id: 'project-evidence-archive-export', roles: ['manager', 'security-admin', 'observer'], examples: ['/projects/:id/project-evidence-archive'] },
      { id: 'project-evidence-export-approval', roles: ['manager', 'security-admin', 'operations-owner'], examples: ['/projects/:id/project-evidence-exports'] },
      { id: 'evidence-quality-audit-read', roles: ['manager', 'security-admin', 'observer'], examples: ['/projects/:id/evidence-quality-audit'] },
      { id: 'evidence-source-review-workflow-read', roles: ['manager', 'security-admin', 'observer'], examples: ['/projects/:id/evidence-source-review-workflow'] },
      { id: 'launch-approval-workflow', roles: ['manager', 'security-admin'], examples: ['/projects/:id/launch-approvals'] },
      { id: 'operations-readiness-read', roles: ['manager', 'runtime-platform', 'security-admin'], examples: ['/projects/:id/operations-readiness'] },
      { id: 'queue-adapter-read', roles: ['manager', 'runtime-platform', 'security-admin'], examples: ['/projects/:id/worker-queue-adapter-plan', '/projects/:id/worker-queue-adapter-dry-run'] },
      { id: 'provider-readiness-read', roles: ['manager', 'runtime-platform', 'security-admin'], examples: ['/projects/:id/provider-readiness'] },
      { id: 'persistence-export', roles: ['security-admin'], examples: ['/projects/:id/persistence-snapshot', '/projects/:id/persistence-migration-plan', '/projects/:id/persistence-migration-dry-run', '/projects/:id/persistence-adapter-plan', '/projects/:id/persistence-adapter-dry-run'] },
    ],
    limitations: [
      'Prototype-open mode remains the default for local demos and backward compatibility.',
      'Enforced mode proves backend decisions but is not a replacement for production identity providers, sessions, encrypted secrets, or database row-level security.',
      'Signed access headers reduce spoofing risk once AGENT_ACCESS_SIGNING_SECRET is configured, and the file-backed backend can persist request-id replay records across restarts; production still needs first-party login, service identity issuance, rotation, shared replay storage, and database-backed membership.',
      'Local identity-session tokens can stand in for signed headers during MVP validation, but they are project-state token-hash records and not a production IdP, browser session, or managed service credential system.',
      'Project membership policies are enforceable at the API boundary when configured or persisted in project state, including runtime bindings and revoked users/Agents, but production still needs managed membership tables, invitations, revocation workflow, and row-level authorization.',
      'Audit fail-closed mode can stop sensitive access when local audit writes fail, but production still needs immutable centralized audit storage, retention policy, alerting, and recovery playbooks.',
      'Agent self-scope is enforced by route Agent id and supplied actor Agent id; production must bind this to durable runtime identity.',
    ],
  };
}
