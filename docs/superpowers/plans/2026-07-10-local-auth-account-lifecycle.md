# Local Auth Account Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a local user rotate their own password safely, and let a local security administrator disable an account from the Settings UI without relying on hidden backend-only routes.

**Architecture:** Extend the existing file-backed `createLocalAuthStore` and `/local-auth` API. Password rotation verifies the authenticated user's current password, atomically revokes all of that user's prior sessions, clears lockout state, and issues one new session; the browser replaces its backend-scoped token with it. Account disable remains security-admin-only and uses the existing last-admin safeguard, now surfaced as a deliberate local Settings operation.

**Tech Stack:** Node.js ESM, scrypt local-auth store, existing Agent Project API, React Settings screen, Node test runner.

## Global Constraints

- Pure local only; credentials, sessions, and user administration remain on the configured loopback backend.
- Password rotation is self-service only: request body user ids are ignored; the verified session identity is authoritative.
- The old password must be verified before a new scrypt hash is written.
- Rotation revokes every prior session for that user and returns exactly one newly issued token.
- The UI never renders, persists, or logs a password; it clears every password input after a response.
- Disable stays security-admin-only and cannot disable the last active security administrator.
- Public test seams: `createLocalAuthStore`, `/local-auth/password`, `/local-auth/users/:id/disable`, and Settings test IDs.

---

### Task 1: Add safe self-service password rotation to the local store and API

**Files:**

- Modify: `src/agents/localAuthStore.js:79-285`
- Modify: `src/agents/agentProjectApi.js:26-34,679-716`
- Modify: `tests/localAuthStore.test.mjs`
- Modify: `tests/localAuthApi.test.mjs`

**Interfaces:**

- `localAuth.changePassword({ userId, currentPassword, newPassword, now })` returns `{ user, token, expiresAt, revokedSessionCount }`.
- `POST /local-auth/password` accepts `{ currentPassword, newPassword, now? }` for the verified user and returns a replacement local session.

- [x] **Step 1: Write the failing store and API tests**

```js
const rotated = auth.changePassword({
  userId: owner.user.id,
  currentPassword: 'correct horse battery staple',
  newPassword: 'new correct horse battery staple',
  now: '2026-07-10T02:00:00.000Z',
});
assert.equal(rotated.revokedSessionCount, 2);
assert.equal(auth.verifySession({ token: owner.token }).reason, 'local-auth-session-revoked');
assert.equal(auth.login({ username: 'owner', password: 'correct horse battery staple' }).verified, false);
assert.equal(auth.login({ username: 'owner', password: 'new correct horse battery staple' }).verified, true);
```

For the API, use a manager token to call `POST /local-auth/password`, then assert its old token is rejected and the returned token can request `/projects`; a wrong current password returns 403 and leaves the existing token usable.

- [x] **Step 2: Run focused tests and confirm failure**

Run: `node --test tests/localAuthStore.test.mjs tests/localAuthApi.test.mjs`

Expected: failure because `changePassword` and `/local-auth/password` do not exist.

- [x] **Step 3: Implement store rotation and API routing**

```js
changePassword({ userId, currentPassword, newPassword, now = nowIso() } = {}) {
  const user = users.find((item) => item.id === userId) || null;
  if (!user || user.disabledAt) throw new Error('Local user was not found.');
  if (!passwordMatches(currentPassword, user.passwordHash)) throw new Error('Current password is not valid.');
  const updatedUser = { ...user, passwordHash: passwordHash(newPassword), passwordChangedAt: now, failedLoginAttempts: 0, loginLockedUntil: null };
  let revokedSessionCount = 0;
  users = users.map((item) => item.id === user.id ? updatedUser : item);
  sessions = sessions.map((session) => session.userId === user.id && !session.revokedAt ? { ...session, revokedAt: now } : session);
  revokedSessionCount = sessions.filter((session) => session.userId === user.id && session.revokedAt === now).length;
  const issued = issueSession(updatedUser, now);
  return { user: publicUser(updatedUser), revokedSessionCount, ...issued };
}
```

Route `/local-auth/password` only after `resolveLocalAuthRequest` succeeds, supply `userId: localRequest.verification.user.id`, and return `403 { error: 'local-auth-current-password-invalid' }` for a bad current password. Do not accept a body-provided user id.

- [x] **Step 4: Run focused tests and confirm pass**

Run: `node --test tests/localAuthStore.test.mjs tests/localAuthApi.test.mjs`

Expected: rotation revokes old tokens, returns a usable replacement, rejects the old password, and preserves a session after a rejected rotation.

### Task 2: Add the Settings account lifecycle controls

**Files:**

- Modify: `src/App.jsx:1790-1805,2880-2960,12390-12435`
- Modify: `tests/localAuthUiContract.test.mjs`

**Interfaces:**

- `settings-local-auth-password-form` posts only `{ currentPassword, newPassword }` to `/local-auth/password`.
- `settings-local-auth-disable-<username>` posts to `/local-auth/users/:id/disable` and refreshes the public user list.

- [x] **Step 1: Write failing UI contract assertions**

```js
assert.match(appSource, /settings-local-auth-password-form/);
assert.match(appSource, /\/local-auth\/password/);
assert.match(appSource, /settings-local-auth-disable-/);
assert.match(appSource, /\/local-auth\/users\/\$\{encodeURIComponent\(user\.id\)\}\/disable/);
```

- [x] **Step 2: Run focused UI contract test and confirm failure**

Run: `node --test tests/localAuthUiContract.test.mjs`

Expected: failure because neither UI control exists.

- [x] **Step 3: Implement password rotation UI**

Create isolated password form state (`currentPassword`, `newPassword`, `confirmPassword`, `pending`, `error`). Reject a mismatched confirmation locally. On a successful backend response, save the returned session for the current backend, clear all three inputs, refresh status/users/project catalog, and never add password values to status or error payloads.

- [x] **Step 4: Implement security-admin disable UI**

Add one `Disable` button per non-disabled public user row. While a request is pending, disable only that row's button. On success refresh users, local auth status, and project membership. Display backend failures (including last-admin protection) through the existing public user-list error field.

- [x] **Step 5: Run focused UI contract test and confirm pass**

Run: `node --test tests/localAuthUiContract.test.mjs`

Expected: the source-level public UI contract detects both controls and still confirms no failed-login counter is rendered.

### Task 3: Update capability evidence and run regressions

**Files:**

- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`

- [x] **Step 1: Update local-auth capability evidence**

Record password rotation, forced prior-session revocation, and administrator disable UI as verified local controls. Keep MFA/recovery factors outside current scope unless a local implementation and acceptance test exist.

- [x] **Step 2: Run focused and regression commands**

Run: `node --test tests/localAuthStore.test.mjs tests/localAuthApi.test.mjs tests/localAuthUiContract.test.mjs && npm.cmd test && npm.cmd run ui:local-auth && npm.cmd run launch:local-mvp:check`

Expected: every command exits 0.

## Self-Review

- Covers the actual password and administrator-control gaps found in the current code.
- Uses authenticated identity, not a client-supplied user id, for self-service rotation.
- Makes session revocation observable and tests it after file-backed persistence.
- Does not overclaim MFA, cloud identity, or hosted recovery capabilities.

## Execution Handoff

Execute inline with `executing-plans`, starting from Task 1.
