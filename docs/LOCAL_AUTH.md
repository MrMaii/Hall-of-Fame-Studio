# Local user accounts

Hall of Fame Studio can run with a completely local account store. It does not call a cloud identity provider, send credentials over the network, or persist plaintext passwords or session tokens. `npm run dev` enables local authentication and project membership enforcement by default.

Local privacy lifecycle routes use the same verified account identity. Manager and security-admin may read `/projects/:id/privacy/lifecycle`; only security-admin may persist a scan or execute retention. Execution ignores actor fields supplied in the body and uses the authenticated local user. Every manifest is exact and short-lived, and irreversible deletion requires independent Manager plus security-admin approval through `/projects/:id/action-approvals` before `execute=true` is accepted.

The durable local task queue is private project metadata. Manager and security-admin can inspect `/projects/:id/durable-task-queue`; only security-admin can persist a discovery scan or cancel queued work. Cancellation actor identity comes from the verified local request and body overrides are ignored. Scheduler workers use server-owned worker ids and random fenced leases rather than caller identities.

Idempotent Provider operation state is also private. Manager and security-admin may read `/projects/:id/idempotent-executions`; only security-admin may reconcile an ambiguous operation. Reconciliation actor identity comes from the verified local account, the reason is persisted only as a hash, and exact evidence checksum plus outcome is required. A body-supplied actor cannot authorize retry.

Before relying on a machine setup, run `npm run local:verify`. It starts an isolated local backend and UI, confirms that the bootstrap-only account state is protected, then stops both processes and removes its temporary data.

Set `AGENT_LOCAL_AUTH_REQUIRED=true` when starting the backend to protect every normal API request and the scheduler controls. Accounts are stored in `AGENT_LOCAL_AUTH_STORE`; when it is omitted, the server uses `{AGENT_PROJECT_STORE}.local-auth.json`.

```powershell
$env:AGENT_LOCAL_AUTH_REQUIRED = 'true'
$env:AGENT_PROJECT_MEMBERSHIP_REQUIRED = 'true'
$env:AGENT_LOCAL_AUTH_STORE = '.tmp/hofs-local-auth.json'
npm run agents:server
```

Bootstrap exactly one local security administrator (this endpoint is only available while no active account exists):

```powershell
curl.exe -X POST http://127.0.0.1:8787/local-auth/bootstrap -H "content-type: application/json" -d '{"username":"owner","password":"use-a-long-unique-local-password"}'
```

The response returns a session token once. Store it in the local client and use it for API requests:

```powershell
curl.exe http://127.0.0.1:8787/projects -H "x-hofs-local-auth-token: <token>"
```

The built-in UI exposes the same flow under **Settings → Deployment → Local User Account**. Its token is kept in browser `sessionStorage`, is bound to the configured backend URL, and is cleared on sign-out; it is not written to browser `localStorage`.

After signing in as a security administrator, that panel can list local users and create manager, observer, or additional security-administrator accounts. It displays only public account metadata; new-user passwords are not retained in the UI.

Supported routes are `GET /local-auth/status`, `POST /local-auth/bootstrap`, `POST /local-auth/login`, `POST /local-auth/logout`, and administrator-only `GET|POST /local-auth/users`.

`AGENT_PROJECT_MEMBERSHIP_REQUIRED=true` additionally enforces per-project membership. A local manager or security administrator who creates a project through `/projects/initiate` or `/product-team-missions` is written into that project's initial policy. Administrators can then grant managers or observers through `PUT /projects/:projectId/membership-policy`. Enable this switch after existing projects have an explicit membership policy, otherwise their project-scoped requests correctly fail closed.

Passwords use Node's `scrypt` derivation with a random salt. Session tokens are random and only their SHA-256 hash is written to disk. The store supports restart recovery and logout revocation; it is local self-hosted authentication, not a public-SaaS identity claim.

Bootstrap and login outcomes are written to the independent runtime security audit chain. `GET /security-audit-stream` exposes bootstrap success, login success, invalid-credential and lockout outcomes with trace, public user/session identifiers when authenticated, retry time, and a deterministic SHA-256 subject hash. It never stores the submitted username, password, session token, password hash, or request body. These events survive restart and participate in the runtime sequence/hash verification.

The local-auth state file and append-only runtime audit file remain separate local files, but their crash window is governed by a recoverable transaction protocol. Every committed identity mutation atomically stores a content-minimized `audit-pending` receipt with the user/session snapshot. The runtime hash chain deduplicates the receipt transaction id, and successful append acknowledges it in the auth snapshot. Startup replays any valid pending receipt, so a crash before append or before acknowledgement becomes recoverable rather than silently losing the result event. This is a pure-local recovery guarantee, not an external immutable archive or a multi-host database transaction.

## Local service identities

`POST /projects/:projectId/identity-sessions` can issue a project-scoped machine credential by supplying `identityType: "service"`, a stable `serviceId`, an allowed machine role (`runtime-platform`, `agent`, or `reviewer-agent`), and one or more `audiences`. Each audience is an exact access-control route key such as `worker-queue`; a token issued for that route is rejected before dispatch when presented to `provider-readiness` or another audience. The token is returned once through `x-hofs-session-token`, while only its hash and public subject/audience metadata are persisted and audited.

Rotate a credential through `POST /projects/:projectId/identity-sessions/:sessionId/rotate`. Rotation creates the replacement and revokes its predecessor in one project snapshot save, records both lineage ids, and returns the replacement token once. The revoked token remains rejected after a file-store restart. These are local, project-scoped service identities; they do not claim cross-host workload identity, hardware-backed keys, or distributed revocation.
