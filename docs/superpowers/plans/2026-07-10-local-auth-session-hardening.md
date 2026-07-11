# Local Auth Session Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the built-in local user system safe to use on a private LAN or a shared workstation without relying on an external identity provider.

**Architecture:** Extend the existing file-backed `localAuthStore` rather than introducing a second user database. Authentication failures are tracked per normalized username in the encrypted-or-local auth snapshot; a bounded lockout stops repeated password checks. Disabled accounts revoke every existing session. HTTP/API responses expose only redacted, operator-actionable state.

**Tech Stack:** Node.js ESM, `node:crypto` scrypt hashes, existing atomic file replacement, Node test runner, existing local-auth HTTP API.

## Global Constraints

- No cloud identity provider, SaaS dependency, network callback, or external account is introduced.
- Never persist plaintext passwords, session tokens, recovery codes, or raw authorization headers.
- Preserve the existing `security-admin`, `manager`, and `observer` role vocabulary.
- Lockouts must be deterministic from the supplied `now` value in tests; no timer is used for correctness.
- All auth-store mutations use the existing atomic replace and Windows file-lock retry path.
- Existing valid sessions remain valid unless their account is disabled, explicitly revoked, or expired.

---

### Task 1: Add bounded failed-login lockout to the local auth store

**Files:**

- Modify: `tests/localAuthStore.test.mjs`
- Modify: `src/agents/localAuthStore.js`

**Interfaces:**

- `createLocalAuthStore({ maxFailedLoginAttempts = 5, loginLockoutMs = 900000 })`.
- `login({ username, password, now })` returns `{ verified: false, reason: 'local-auth-login-locked', retryAt }` while the normalized account is locked.
- Successful login clears the account's failure counter and lockout timestamp.

- [x] **Step 1: Write the failing store test**

```js
test('locks repeated local password failures and clears the lockout after a successful retry window', () => {
  const auth = createLocalAuthStore({ filePath, maxFailedLoginAttempts: 2, loginLockoutMs: 60_000 });
  auth.bootstrap({ username: 'owner', password: 'correct horse battery staple', now: '2026-07-10T00:00:00.000Z' });
  assert.equal(auth.login({ username: 'owner', password: 'wrong password', now: '2026-07-10T00:00:01.000Z' }).reason, 'local-auth-invalid-credentials');
  assert.equal(auth.login({ username: 'owner', password: 'wrong password', now: '2026-07-10T00:00:02.000Z' }).reason, 'local-auth-login-locked');
  assert.equal(auth.login({ username: 'owner', password: 'correct horse battery staple', now: '2026-07-10T00:00:03.000Z' }).reason, 'local-auth-login-locked');
  assert.equal(auth.login({ username: 'owner', password: 'correct horse battery staple', now: '2026-07-10T00:01:03.000Z' }).verified, true);
});
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/localAuthStore.test.mjs`

Expected: failure because repeated invalid passwords currently never return `local-auth-login-locked`.

- [x] **Step 3: Add persisted, redacted failure state**

```js
const updatedUser = {
  ...user,
  failedLoginAttempts: nextFailureCount,
  loginLockedUntil: nextFailureCount >= maxFailedLoginAttempts
    ? new Date(nowMs + loginLockoutMs).toISOString()
    : null,
};
```

Use `Date.parse(now)` only once per login. `publicUser()` must not expose `failedLoginAttempts` or `loginLockedUntil`; return `retryAt` only on the locked login response.

- [x] **Step 4: Verify focused tests pass**

Run: `node --test tests/localAuthStore.test.mjs`

Expected: all local auth store tests pass.

### Task 2: Disable a local account and revoke its active sessions atomically

**Files:**

- Modify: `tests/localAuthStore.test.mjs`
- Modify: `tests/localAuthApi.test.mjs`
- Modify: `src/agents/localAuthStore.js`
- Modify: `src/agents/agentProjectApi.js`

**Interfaces:**

- `disableUser({ userId, now })` returns `{ user, revokedSessionCount }`.
- `POST /local-auth/users/:userId/disable` is security-admin-only and returns a redacted `localAuth` receipt.
- A disabled user's existing token fails verification with `local-auth-user-disabled`.

- [x] **Step 1: Write the failing store and API tests**

```js
const disabled = auth.disableUser({ userId: manager.user.id, now: '2026-07-10T01:00:00.000Z' });
assert.equal(disabled.revokedSessionCount, 1);
assert.equal(auth.verifySession({ token: manager.token }).reason, 'local-auth-session-revoked');

const response = api.handle({ method: 'POST', path: `/local-auth/users/${manager.user.id}/disable`, headers: ownerHeaders });
assert.equal(response.status, 200);
assert.equal(response.body.localAuth.user.disabledAt, '2026-07-10T01:00:00.000Z');
```

- [x] **Step 2: Run the focused tests and confirm they fail**

Run: `node --test tests/localAuthStore.test.mjs tests/localAuthApi.test.mjs`

Expected: failure because the store and route do not yet expose account disablement.

- [x] **Step 3: Implement store mutation and API dispatch**

```js
const revokedAt = now;
users = users.map((item) => item.id === userId ? { ...item, disabledAt: revokedAt } : item);
sessions = sessions.map((session) => (
  session.userId === userId && !session.revokedAt ? { ...session, revokedAt } : session
));
persist();
```

Reject an attempt to disable the last active security administrator with `local-auth-last-security-admin`.

- [x] **Step 4: Verify focused tests pass**

Run: `node --test tests/localAuthStore.test.mjs tests/localAuthApi.test.mjs`

Expected: all focused tests pass, with no token or password material in serialized responses.

### Task 3: Expose a local operator contract and UI recovery state

**Files:**

- Modify: `src/agents/localAuthStore.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/App.jsx`
- Modify: `tests/localAuthUiContract.test.mjs`

**Interfaces:**

- `status()` includes only `{ userCount, disabledUserCount, bootstrapRequired, passwordHashAlgorithm, sessionTtlMs, maxFailedLoginAttempts, loginLockoutMs }`.
- The Settings local-auth panel tells an administrator that a locked account must wait until `retryAt`; it never reveals whether another username exists.

- [x] **Step 1: Write a failing UI contract assertion**

```js
assert.match(appSource, /settings-local-auth-login-locked/);
assert.match(appSource, /local-auth-login-locked/);
assert.doesNotMatch(appSource, /failedLoginAttempts/);
```

- [x] **Step 2: Run the focused UI contract test and confirm it fails**

Run: `node --test tests/localAuthUiContract.test.mjs`

Expected: failure because the locked-account recovery state is not rendered.

- [x] **Step 3: Render the redacted recovery message**

```jsx
{localAuthStatus.error === 'local-auth-login-locked' && (
  <p data-testid="settings-local-auth-login-locked">
    This local account is temporarily locked. Retry after {localAuthStatus.retryAt}.
  </p>
)}
```

Map only the backend's `retryAt` field; do not calculate a second browser-side timer or store credentials in React state.

- [x] **Step 4: Verify local auth regressions**

Run: `npm.cmd test && npm.cmd run ui:local-auth && npm.cmd run launch:local-mvp:check`

Expected: every command exits 0.

## Self-Review

- Covers the current local user-system gaps that are meaningful without a cloud provider: brute-force resistance, administrator-controlled revocation, and safe operator feedback.
- Keeps the current local roles and project membership boundary intact.
- Does not misrepresent local file-backed identity as a hosted multi-tenant identity service.

## Execution Handoff

Execute inline in this workspace with `executing-plans`, beginning with Task 1. The broader 50-capability program remains partitioned into local identity, durability, execution recovery, safety/observability, team governance, and the five work-mode contracts.
