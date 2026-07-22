const validSession = (session, now) => {
  if (!session?.token || !session?.baseUrl) return false;
  if (!session.expiresAt) return true;
  const expiresAt = Date.parse(session.expiresAt);
  const currentTime = Date.parse(now || new Date().toISOString());
  return Number.isFinite(expiresAt) && Number.isFinite(currentTime) && expiresAt > currentTime;
};

export function selectStoredLocalAuthSession({ sessionSession, persistentSession, now } = {}) {
  if (validSession(sessionSession, now)) {
    return { session: sessionSession, persistence: 'session' };
  }
  if (validSession(persistentSession, now)) {
    return { session: persistentSession, persistence: 'persistent' };
  }
  return { session: null, persistence: null };
}

export function localAuthSessionPersistenceTarget(keepSignedIn = false) {
  return keepSignedIn ? 'persistent' : 'session';
}
