import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replaceFileWithRetry } from './atomicFileReplace.js';

const AUTH_STORE_VERSION = 2;
const PASSWORD_HASH_VERSION = 'scrypt';
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_COST = 1 << 15;
const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS = 5;
const DEFAULT_LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
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
  if (value.length < 4) throw new Error('Password must be at least 4 characters.');
  if (!/[A-Za-z]/.test(value)) throw new Error('Password must contain at least one letter.');
  if (!/[0-9]/.test(value)) throw new Error('Password must contain at least one number.');
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

function auditTransactionChecksum(transaction = {}) {
  const { checksum: _checksum, ...base } = transaction;
  return sha256(JSON.stringify(base));
}

function validAuditTransaction(transaction = {}) {
  return Boolean(transaction.id && transaction.checksum && transaction.checksum === auditTransactionChecksum(transaction));
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
  if (!filePath || !existsSync(filePath)) return { users: [], sessions: [], auditTransactions: [] };
  const raw = readFileSync(filePath, 'utf8').trim();
  if (!raw) return { users: [], sessions: [], auditTransactions: [] };
  const parsed = JSON.parse(raw);
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    auditTransactions: Array.isArray(parsed.auditTransactions) ? parsed.auditTransactions : [],
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
    auditTransactions: snapshot.auditTransactions,
  }, null, 2));
  replaceFileWithRetry(tempPath, filePath);
}

export function createLocalAuthStore({
  filePath = null,
  sessionTtlMs = DEFAULT_SESSION_TTL_MS,
  maxFailedLoginAttempts = DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS,
  loginLockoutMs = DEFAULT_LOGIN_LOCKOUT_MS,
} = {}) {
  const resolvedPath = resolveFilePath(filePath);
  const snapshot = readSnapshot(resolvedPath);
  let users = snapshot.users;
  let sessions = snapshot.sessions;
  let auditTransactions = snapshot.auditTransactions;
  const configuredMaxFailedLoginAttempts = Math.max(1, Number(maxFailedLoginAttempts) || DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS);
  const configuredLoginLockoutMs = Math.max(1, Number(loginLockoutMs) || DEFAULT_LOGIN_LOCKOUT_MS);
  const persist = () => writeSnapshot(resolvedPath, { users, sessions, auditTransactions });
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
    return { token, session: publicSession(session) };
  };
  const commitAuditTransaction = ({ operation, username = '', actorUserId = null, targetUserId = null, sessionId = null, outcome = 'committed', now = nowIso() } = {}) => {
    const base = {
      schemaVersion: 'local-auth-audit-transaction/v1',
      id: `lat_${randomBytes(12).toString('base64url')}`,
      operation: String(operation || '').trim(),
      subjectHash: sha256(String(username || '').trim().toLowerCase()),
      actorUserId: actorUserId || null,
      targetUserId: targetUserId || null,
      sessionId: sessionId || null,
      outcome: String(outcome || 'committed'),
      status: 'audit-pending',
      auditRecordId: null,
      auditRecordChecksum: null,
      createdAt: now,
      confirmedAt: null,
    };
    const transaction = { ...base, checksum: auditTransactionChecksum(base) };
    auditTransactions = [transaction, ...auditTransactions].slice(0, 256);
    persist();
    return transaction;
  };

  return {
    status() {
      return {
        schemaVersion: 'local-auth-status/v1',
        enabled: true,
        storage: resolvedPath ? 'file' : 'memory',
        bootstrapRequired: activeUsers().length === 0,
        userCount: activeUsers().length,
        disabledUserCount: users.filter((user) => Boolean(user.disabledAt)).length,
        sessionTtlMs,
        maxFailedLoginAttempts: configuredMaxFailedLoginAttempts,
        loginLockoutMs: configuredLoginLockoutMs,
        passwordHashAlgorithm: 'scrypt',
        pendingAuditTransactionCount: auditTransactions.filter((row) => validAuditTransaction(row) && row.status === 'audit-pending').length,
        confirmedAuditTransactionCount: auditTransactions.filter((row) => validAuditTransaction(row) && row.status === 'audit-confirmed').length,
        invalidAuditTransactionCount: auditTransactions.filter((row) => !validAuditTransaction(row)).length,
      };
    },
    pendingAuditTransactions() {
      return auditTransactions.filter((row) => validAuditTransaction(row) && row.status === 'audit-pending').map((row) => ({ ...row }));
    },
    acknowledgeAuditTransaction({ transactionId, auditRecordId, auditRecordChecksum, now = nowIso() } = {}) {
      const transaction = auditTransactions.find((row) => row.id === transactionId) || null;
      if (!transaction || !validAuditTransaction(transaction)) throw new Error('Local auth audit transaction was not found or is invalid.');
      if (transaction.status === 'audit-confirmed') return { transaction: { ...transaction }, idempotent: true };
      if (!auditRecordId || !(/^[a-f0-9]{64}$/.test(String(auditRecordChecksum || '')) || /^chk_[a-f0-9]{8,64}$/.test(String(auditRecordChecksum || '')))) throw new Error('Local auth audit confirmation proof is invalid.');
      const { checksum: _checksum, ...prior } = transaction;
      const updatedBase = { ...prior, status: 'audit-confirmed', auditRecordId: String(auditRecordId), auditRecordChecksum: String(auditRecordChecksum), confirmedAt: now };
      const updated = { ...updatedBase, checksum: auditTransactionChecksum(updatedBase) };
      auditTransactions = auditTransactions.map((row) => (row.id === transaction.id ? updated : row));
      persist();
      return { transaction: { ...updated }, idempotent: false };
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
      const issued = issueSession(user, now);
      commitAuditTransaction({ operation: 'bootstrap', username: normalizedUsername, actorUserId: user.id, targetUserId: user.id, sessionId: issued.session.id, outcome: 'bootstrap-success', now });
      return { user: publicUser(user), ...issued };
    },
    createUser({ username, password, displayName = '', role = 'observer', actorUserId = null, now = nowIso() } = {}) {
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
      commitAuditTransaction({ operation: 'create-user', username: normalizedUsername, actorUserId, targetUserId: user.id, outcome: 'user-created', now });
      return { user: publicUser(user) };
    },
    listUsers() {
      return users.map(publicUser);
    },
    disableUser({ userId, actorUserId = null, now = nowIso() } = {}) {
      const user = users.find((item) => item.id === userId) || null;
      if (!user) throw new Error('Local user was not found.');
      if (user.disabledAt) return { user: publicUser(user), revokedSessionCount: 0 };
      if (user.role === 'security-admin' && activeUsers().filter((item) => item.role === 'security-admin').length <= 1) {
        throw new Error('Cannot disable the last security administrator.');
      }
      let revokedSessionCount = 0;
      const disabledUser = { ...user, disabledAt: now };
      users = users.map((item) => (item.id === user.id ? disabledUser : item));
      sessions = sessions.map((session) => {
        if (session.userId !== user.id || session.revokedAt) return session;
        revokedSessionCount += 1;
        return { ...session, revokedAt: now };
      });
      commitAuditTransaction({ operation: 'disable-user', actorUserId, targetUserId: user.id, outcome: 'user-disabled', now });
      return { user: publicUser(disabledUser), revokedSessionCount };
    },
    changePassword({ userId, currentPassword, newPassword, now = nowIso() } = {}) {
      const user = users.find((item) => item.id === userId) || null;
      if (!user || user.disabledAt) throw new Error('Local user was not found.');
      if (!passwordMatches(currentPassword, user.passwordHash)) throw new Error('Current local password is not valid.');
      const updatedUser = {
        ...user,
        passwordHash: passwordHash(newPassword),
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        loginLockedUntil: null,
      };
      let revokedSessionCount = 0;
      users = users.map((item) => (item.id === user.id ? updatedUser : item));
      sessions = sessions.map((session) => {
        if (session.userId !== user.id || session.revokedAt) return session;
        revokedSessionCount += 1;
        return { ...session, revokedAt: now };
      });
      const issued = issueSession(updatedUser, now);
      commitAuditTransaction({ operation: 'change-password', username: user.username, actorUserId: user.id, targetUserId: user.id, sessionId: issued.session.id, outcome: 'password-changed', now });
      return { user: publicUser(updatedUser), revokedSessionCount, ...issued };
    },
    login({ username, password, now = nowIso() } = {}) {
      let normalizedUsername = '';
      try {
        normalizedUsername = normalizeUsername(username);
      } catch {
        return { verified: false, reason: 'local-auth-invalid-credentials' };
      }
      const user = findUserByUsername(normalizedUsername);
      const nowMs = Date.parse(now) || Date.now();
      const lockedUntilMs = Date.parse(user?.loginLockedUntil || '');
      if (user && !user.disabledAt && Number.isFinite(lockedUntilMs) && lockedUntilMs > nowMs) {
        commitAuditTransaction({ operation: 'login', username: normalizedUsername, targetUserId: user.id, outcome: 'login-locked', now });
        return { verified: false, reason: 'local-auth-login-locked', retryAt: user.loginLockedUntil };
      }
      if (!user || user.disabledAt || !passwordMatches(password, user.passwordHash)) {
        if (user && !user.disabledAt) {
          const priorFailures = lockedUntilMs > 0 && lockedUntilMs <= nowMs
            ? 0
            : Number(user.failedLoginAttempts || 0);
          const failedLoginAttempts = priorFailures + 1;
          const loginLockedUntil = failedLoginAttempts >= configuredMaxFailedLoginAttempts
            ? new Date(nowMs + configuredLoginLockoutMs).toISOString()
            : null;
          users = users.map((item) => (
            item.id === user.id ? { ...item, failedLoginAttempts, loginLockedUntil } : item
          ));
          if (loginLockedUntil) {
            commitAuditTransaction({ operation: 'login', username: normalizedUsername, targetUserId: user.id, outcome: 'login-locked', now });
            return { verified: false, reason: 'local-auth-login-locked', retryAt: loginLockedUntil };
          }
        }
        commitAuditTransaction({ operation: 'login', username: normalizedUsername, targetUserId: user?.id || null, outcome: 'login-failed', now });
        return { verified: false, reason: 'local-auth-invalid-credentials' };
      }
      const updatedUser = {
        ...user,
        lastLoginAt: now,
        failedLoginAttempts: 0,
        loginLockedUntil: null,
      };
      users = users.map((item) => (item.id === user.id ? updatedUser : item));
      const issued = issueSession(updatedUser, now);
      commitAuditTransaction({ operation: 'login', username: normalizedUsername, actorUserId: user.id, targetUserId: user.id, sessionId: issued.session.id, outcome: 'login-success', now });
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
      commitAuditTransaction({ operation: 'logout', actorUserId: session.userId, targetUserId: session.userId, sessionId: session.id, outcome: 'logout-success', now });
      return { revoked: true, session: publicSession(revoked) };
    },
    filePath: resolvedPath,
  };
}
