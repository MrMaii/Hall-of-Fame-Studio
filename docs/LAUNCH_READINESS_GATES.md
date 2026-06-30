# Launch Readiness Gates

This document is the operational launch gate for Hall of Fame Studio. It keeps the project positioned as a general AI product-team system. Research Project remains a validation sample, not a research-only product surface.

## Gate Summary

| Gate | Target | Decision | Required proof | Not allowed |
| --- | --- | --- | --- | --- |
| P0 - Local Backend MVP | Internal product-team validation on one workstation | Can keep developing and demoing locally | Generic kickoff-to-final-deliverable loop, Agent submissions, evidence, reviews, Flow Graph, Proof Map, Agent Dashboard, persona skill regression, build | Claiming customer readiness or production readiness |
| P1 - Customer Private Pilot | Controlled customer rehearsal with non-sensitive or approved pilot data | Can run a private pilot only with explicit operator oversight | P0 plus launch approvals, project evidence archive/export, release candidate, launch run, health check, customer acceptance report, UI handoff receipts | Public production launch, unattended production daemon, sensitive data without approved controls |
| P2 - Public Production | External production service | Blocked | Managed database, managed queue/cron, real BYOK/provider controls, centralized observability, immutable audit, security operations, customer acceptance policy | Treating local/test/private-pilot receipts as production certification |

## P0 - Local Backend MVP

P0 proves the core product-team loop is real and backend-backed. It is the fastest gate for ordinary development work.

Required commands:

```bash
npm run build
npm run skills:check
npm run agents:scenario
npm run agents:product-team:core
npm run agents:product-team:research-sample
npm run agents:product-team:cycle-consistency
npm run ui:manager-backend:core
```

Required product evidence:

- Kickoff meeting, role clarification, self-marketing, Leader/Reviewer governance.
- Brainstorm Layer through generic `brainstorm-board` submissions.
- Search/Evidence Layer with provider receipt, source snapshots, source quality, and source safety.
- Agent submissions for `discovery-report`, `brainstorm-board`, `evidence-packet`, `product-brief`, `decision-proposal`, `risk-review`, `implementation-plan`, and `final-deliverable`.
- Reviewer requested-changes review, linked revision response, accepted final deliverable.
- Manager Dashboard, Manager Flow Graph, Readiness Proof Map, Agent Dashboard, transcript, timeline, and event-ledger proof.
- Backend scheduler and Agent worker proof, including autonomous strategy, queued Agent action evidence, and the Product Team Operating Loop summary for C/A continuation.
- Manager Use Case Audit proof through `GET /projects/:id/manager-use-case-audit` and Readiness Proof Map `managerUseCaseAuditRoutes`, so customer-story coverage is route-backed rather than inferred from frontend fallback rows.

`npm run agents:product-team:research-sample` is the fastest explicit Research Project validation-sample gate. It runs the same generic product-team backend and HTTP delivery trace plus Product Team Operating Loop, then asserts that the proven stages are kickoff, self-marketing, brainstorm, evidence, draft, review/revision, final deliverable, proof surfaces, Manager continuation, Agent strategy, and production blockers rather than paper/thesis/manuscript-specific protocol fields.

`npm run agents:product-team:cycle-consistency` is the focused P0 autonomy consistency gate. It continues past the Research sample into signed membership access, runs a bounded three-step autonomous loop, and verifies `autonomous-cycle-consistency/v1`, Manager Flow Graph, Readiness Proof Map, Manager Ready Package, and persisted loop/run receipts without running the full P1/P2 launch-hardening receipt chain.

P0 is not enough for a customer pilot because evidence handoff, launch receipts, customer acceptance, and operator controls are not required by this tier.

## P1 - Customer Private Pilot

P1 proves a controlled private-pilot handoff can close from both backend and browser paths. This is the current shortest gate for a customer-facing rehearsal.

Required commands:

```bash
npm run agents:product-team:private-pilot
npm run ui:manager-backend
npm run ui:manager-private-pilot
```

Optional narrower gates when only one phase changed:

```bash
npm run agents:product-team:private-pilot:release
npm run agents:product-team:private-pilot:launch
npm run agents:product-team:private-pilot:health
npm run agents:product-team:private-pilot:acceptance
npm run agents:product-team:private-pilot:ops-readiness
```

Required product evidence:

- P0 evidence remains passing.
- Launch approval workflow has Manager and security-admin approval receipts.
- Project Evidence Archive is ready, redacted, checksummed, and safe for local handoff.
- Project Evidence Export has request, approval, and download-audit receipts.
- Private-pilot release candidate freezes the delivery, evidence, provider-eval, deployment, operations, persistence, and queue checksums.
- Private-pilot launch run, health check, and acceptance report all write timeline/event proof and appear in Flow Graph and Proof Map.
- Browser Manager UI can perform the same handoff through backend receipts instead of frontend mutation.

P1 still requires explicit operator supervision. It does not approve public production, unmanaged sensitive data, or 24/7 unattended production operation.

`npm run agents:product-team:private-pilot:ops-readiness` is the focused bridge from P1 into production hardening. It stops after customer acceptance and verifies `production-operations-readiness/v1`, proving local/private-pilot operations proof is closed while centralized logs, metrics, traces, alert routing, on-call ownership, managed incident records, restore drills, centralized audit retention, and managed database/queue cutover remain explicit P2 blockers. Private-pilot release, launch, health, and acceptance write routes support lightweight receipt responses with deferred read-model refresh routes so the Harness can validate the handoff without repeatedly embedding the full Manager Ready Package.

## P2 - Public Production

P2 is blocked until managed controls replace local/private-pilot rehearsal controls.

Required blocker domains:

| Domain | Minimum production evidence required |
| --- | --- |
| Managed persistence | Real database adapter execution receipts, RLS/tenant isolation, backup/restore proof, migration rollback, read-model checkpoint parity |
| Managed queue/cron | Durable queue adapter receipts, lease/ack/retry/dead-letter proof, scheduled worker operation without browser dependency |
| BYOK and providers | Managed KMS/secret rotation, real provider eval dataset, cost/rate limits, retry/circuit policy, incident controls, immutable provider/source/model-output audit |
| Security | Production identity lifecycle, RBAC/RLS enforcement, signed access/replay protection, audit fail-closed behavior, centralized security audit retention |
| Operations | Centralized logs/metrics/traces, alert routing, on-call ownership, managed incident records, restore drills, recovery runbooks |
| Evidence export | Encrypted object storage, signed expiring download URLs, watermark enforcement, retention/deletion jobs, data-residency controls |
| Launch governance | Production operations/deployment/security/provider control receipts marked as managed-production evidence, not local rehearsal evidence |

Required production-oriented commands before a P2 decision can be considered:

```bash
npm run launch:infra
npm run adapters:gateway
npm run adapters:gateway-server:validate
npm run adapters:gateway-http:validate
npm run adapters:gateway-postgres-store:validate
npm run agents:product-team:production-ops-controls
npm run agents:product-team:production-deployment-controls
npm run agents:product-team:production-security-controls
npm run agents:product-team:production-provider-controls
npm run agents:product-team:production-evidence-integrity
npm run agents:product-team:production-launch-governance
npm run agents:product-team
```

`npm run launch:infra` is the fast P2 infrastructure rehearsal. It runs the launch gate matrix validator, shared adapter gateway contract validation, reference private adapter gateway server validation, Agent HTTP server validation through an env-configured adapter gateway endpoint, and Postgres-compatible gateway storage boundary validation. These commands are necessary but not sufficient for P2. The production launch audit must still show `readyForProduction: true`, and the production evidence integrity audit must classify required control domains as managed-production evidence.

Managed persistence and managed queue/cron cutover evidence is now projected through two layers: the adapter dry-run routes prove rehearsal coverage, and verified `production-operations-control-receipt/v1` rows for `managed-persistence-cutover` / `managed-worker-queue-cutover` clear the matching `production-infrastructure-rehearsal/v1` domain blockers. This does not by itself approve P2; remaining deployment, security, provider, evidence integrity, operations, and launch-governance gates must still close with managed-production evidence.

Deployment hardening uses the same projection pattern: verified `production-deployment-control-receipt/v1` rows now bind the deployment receipt workflow checksum into `production-infrastructure-rehearsal/v1`, mark the `deployment-preflight` domain row `productionReady`, and expose `deploymentReceiptReady` plus the deployment receipt route. This clears only the infrastructure deployment blocker; launch audit, managed-production evidence integrity, security, provider, operations, and approval gates still control the public-production decision.

Security, provider, managed-production evidence integrity, and launch governance now have matching focused gates. `npm run agents:product-team:production-security-controls` proves managed identity/KMS/RBAC/security-audit receipts reach Security Boundary, Proof Map, Flow Graph, and Launch Control. `npm run agents:product-team:production-provider-controls` proves provider rollout receipts reach Provider/Proof/Control surfaces while managed-production evidence integrity still blocks public production. `npm run agents:product-team:production-evidence-integrity` proves local/test receipts remain local rehearsal evidence, then explicit `evidenceEnvironment: "managed-production"` receipts upgrade the evidence-integrity audit and close only that production gap. `npm run agents:product-team:production-launch-governance` then proves Manager, security-admin, and operations-owner can write production launch approvals through signed backend membership, that `launch-approval-workflow/v1` carries checksum/proof/timeline/event evidence, and that Launch Audit / Control Center / Proof Map / Flow Graph see approval readiness while broader public production remains no-go.

## Current Evidence

As of the current workspace state, the verified private-MVP evidence is:

- P0 backend loop: `npm run agents:product-team:core`
- P0 Research validation sample: `npm run agents:product-team:research-sample`
- P0 autonomous cycle consistency: `npm run agents:product-team:cycle-consistency`
- P0 persona supply: `npm run skills:check`
- P0 browser control loop: `npm run ui:manager-backend:core`
- P1 backend private pilot: `npm run agents:product-team:private-pilot`
- P1 production-ops bridge: `npm run agents:product-team:private-pilot:ops-readiness`
- P1 browser handoff: `npm run ui:manager-private-pilot`
- Full Manager browser chain: `npm run ui:manager-backend`
- P2 infrastructure rehearsal: `npm run launch:infra` plus `GET /projects/:id/production-infrastructure-rehearsal`

The current correct claim is: local backend-backed private MVP, customer private-pilot rehearsal, and P2 infrastructure rehearsal are verified. Public production remains blocked until real managed-production evidence replaces local/private rehearsal receipts.

## Maintenance Rule

When adding or changing launch-related read models, scripts, or UI controls, update this document and run:

```bash
npm run launch:gates
```

The gate validator checks that the launch tiers remain tied to runnable package scripts, production blockers, and the generic product-team positioning.
