import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceFileWithRetry } from './atomicFileReplace.js';

const AUTH_STORE_VERSION = 1;
const PASSWORD_HASH_VERSION = 'scrypt';
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_COST = 1 << 15;
const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const USER_ROLES = new Set(['security-admin', 'manager', 'observer']);

function resolveFilePath(filePath) {
  if (!filePath) return null;
  return filePath instanceof URL ? fileURLToPath(filePath) : filePath;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeUsername(username = '') {
  const normalized = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(normalized)) {
    throw new Error('Username must be 3-64 characters using letters, numbers, dot, underscore, or hyphen.');
  }
  return normalized;
}

function requirePassword(password = '') {
  const value = String(password || '');
  if (value.length < 12) throw new Error('Password must be at least 12 characters.');
  if (value.length > 1024) throw new Error('Password is too long.');
  return value;
}

function normalizeRole(role = 'observer') {
  const normalized = String(role || 'observer').trim().toLowerCase();
  if (!USER_ROLES.has(normalized)) throw new Error(`Unsupported local user role: ${role}`);
  return normalized;
}

function sha256(value = '') {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function passwordHash(password = '') {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(requirePassword(password), salt, PASSWORD_KEY_LENGTH, {
    N: PASSWORD_COST,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  }).toString('base64url');
  return `${PASSWORD_HASH_VERSION}$${salt}$${hash}`;
}

function passwordMatches(password = '', stored = '') {
  const [version, salt, encodedHash] = String(stored || '').split('$');
  if (version !== PASSWORD_HASH_VERSION || !salt || !encodedHash) return false;
  try {
    const expected = Buffer.from(encodedHash, 'base64url');
    const actual = scryptSync(String(password || ''), salt, expected.length, {
      N: PASSWORD_COST,
      r: 8,
      p: 1,
      maxmem: 128 * 1024 * 1024,
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function publicUser(user = {}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
    disabledAt: user.disabledAt || null,
  };
}

function publicSession(session = {}) {
  return {
    id: session.id,
    userId: session.userId,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt || null,
  };
}

function readSnapshot(filePath) {
  if (!filePath || !existsSync(filePath)) return { users: [], sessions: [] };
  const raw = readFileSync(filePath, 'utf8').trim();
  if (!raw) return { users: [], sessions: [] };
  const parsed = JSON.parse(raw);
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
  };
}

function writeSnapshot(filePath, snapshot) {
  if (!filePath) return;
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify({
    version: AUTH_STORE_VERSION,
    updatedAt: nowIso(),
    users: snapshot.users,
    sessions: snapshot.sessions,
  }, null, 2));
  replaceFileWithRetry(tempPath, filePath);
}

export function createLocalAuthStore({ filePath = null, sessionTtlMs = DEFAULT_SESSION_TTL_MS } = {}) {
  const resolvedPath = resolveFilePath(filePath);
  const snapshot = readSnapshot(resolvedPath);
  let users = snapshot.users;
  let sessions = snapshot.sessions;
  const persist = () => writeSnapshot(resolvedPath, { users, sessions });
  const activeUsers = () => users.filter((user) => !user.disabledAt);
  const findUserByUsername = (username) => users.find((user) => user.username === username) || null;
  const issueSession = (user, now = nowIso(), ttlMs = sessionTtlMs) => {
    const token = randomBytes(32).toString('base64url');
    const session = {
      id: `las_${randomBytes(12).toString('base64url')}`,
      userId: user.id,
      tokenHash: sha256(token),
      issuedAt: now,
      expiresAt: new Date((Date.parse(now) || Date.now()) + Number(ttlMs || sessionTtlMs)).toISOString(),
      revokedAt: null,
    };
    sessions = [session, ...sessions].slice(0, 512);
    persist();
    return { token, session: publicSession(session) };
  };

  return {
    status() {
      return {
        schemaVersion: 'local-auth-status/v1',
        enabled: true,
        storage: resolvedPath ? 'file' : 'memory',
        bootstrapRequired: activeUsers().length === 0,
        userCount: activeUsers().length,
        sessionTtlMs,
        passwordHashAlgorithm: 'scrypt',
      };
    },
    bootstrap({ username, password, displayName = '', now = nowIso() } = {}) {
      if (activeUsers().length) throw new Error('Local auth bootstrap is already complete.');
      const normalizedUsername = normalizeUsername(username);
      const user = {
        id: `usr_${randomBytes(12).toString('base64url')}`,
        username: normalizedUsername,
        displayName: String(displayName || normalizedUsername).trim().slice(0, 120) || normalizedUsername,
        role: 'security-admin',
        passwordHash: passwordHash(password),
        createdAt: now,
        lastLoginAt: now,
        disabledAt: null,
      };
      users = [user, ...users];
      persist();
      const issued = issueSession(user, now);
      return { user: publicUser(user), ...issued };
    },
    createUser({ username, password, displayName = '', role = 'observer', now = nowIso() } = {}) {
      const normalizedUsername = normalizeUsername(username);
      if (findUserByUsername(normalizedUsername)) throw new Error('Username is already in use.');
      const user = {
        id: `usr_${randomBytes(12).toString('base64url')}`,
        username: normalizedUsername,
        displayName: String(displayName || normalizedUsername).trim().slice(0, 120) || normalizedUsername,
        role: normalizeRole(role),
        passwordHash: passwordHash(password),
        createdAt: now,
        lastLoginAt: null,
        disabledAt: null,
      };
      users = [user, ...users];
      persist();
      return { user: publicUser(user) };
    },
    listUsers() {
      return users.map(publicUser);
    },
    login({ username, password, now = nowIso() } = {}) {
      let normalizedUsername = '';
      try {
        normalizedUsername = normalizeUsername(username);
      } catch {
        return { verified: false, reason: 'local-auth-invalid-credentials' };
      }
      const user = findUserByUsername(normalizedUsername);
      if (!user || user.disabledAt || !passwordMatches(password, user.passwordHash)) {
        return { verified: false, reason: 'local-auth-invalid-credentials' };
      }
      const updatedUser = { ...user, lastLoginAt: now };
      users = users.map((item) => (item.id === user.id ? updatedUser : item));
      const issued = issueSession(updatedUser, now);
      return { verified: true, user: publicUser(updatedUser), ...issued };
    },
    verifySession({ token, now = nowIso() } = {}) {
      const tokenHash = sha256(token);
      const session = sessions.find((item) => item.tokenHash === tokenHash) || null;
      if (!session) return { verified: false, reason: 'local-auth-session-not-found' };
      if (session.revokedAt) return { verified: false, reason: 'local-auth-session-revoked', session: publicSession(session) };
      if ((Date.parse(session.expiresAt) || 0) <= (Date.parse(now) || Date.now())) {
        return { verified: false, reason: 'local-auth-session-expired', session: publicSession(session) };
      }
      const user = users.find((item) => item.id === session.userId) || null;
      if (!user || user.disabledAt) return { verified: false, reason: 'local-auth-user-disabled', session: publicSession(session) };
      return { verified: true, user: publicUser(user), session: publicSession(session) };
    },
    logout({ token, now = nowIso() } = {}) {
      const tokenHash = sha256(token);
      const session = sessions.find((item) => item.tokenHash === tokenHash) || null;
      if (!session) return { revoked: false, reason: 'local-auth-session-not-found' };
      if (session.revokedAt) return { revoked: true, session: publicSession(session) };
      const revoked = { ...session, revokedAt: now };
      sessions = sessions.map((item) => (item.id === session.id ? revoked : item));
      persist();
      return { revoked: true, session: publicSession(revoked) };
    },
    filePath: resolvedPath,
  };
}
