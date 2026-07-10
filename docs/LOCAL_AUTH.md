# Local user accounts

Hall of Fame Studio can run with a completely local account store. It does not call a cloud identity provider, send credentials over the network, or persist plaintext passwords or session tokens.

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
