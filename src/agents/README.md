# Agent Consciousness Architecture

This folder owns the app-facing agent runtime. It is intentionally model-agnostic: today it produces deterministic behavior for the React prototype, and later the same protocol can wrap BYOK LLM calls.

## Core Idea

An Agent is not only a prompt. In this product, an Agent is a working node with five layers:

1. **Identity**: name, role, persona skill, capability lanes.
2. **Mind**: current goal, open obligations, working memory, confidence, attention policy.
3. **Relations**: lead, reviewer, manager, managed peers, lateral peers.
4. **Communication Policy**: when to read, when to stay silent, when to respond, when to escalate.
5. **Work Cycle**: hourly private work pulses and daily public reports.

The Director does not continuously drive the team. The Director starts or changes intent; the Agent network then works through its own communication loop.

## Lead Mode

Every project starts with one Lead. The Lead is selected by task fit plus management score.

The Lead does not micromanage every sentence. The Lead owns:

- agenda and decision framing
- owner/deadline assignment
- cross-agent dependency resolution
- deciding whether an issue needs Director input
- maintaining the project ledger

The Reviewer is selected separately. The Reviewer can challenge the Lead and force evidence or verification before a decision becomes durable.

The default relationship graph is:

- Lead coordinates all non-lead Agents.
- Reviewer reviews the Lead.
- Every Agent can read peers directly.
- Agents only escalate to the Director when a decision changes scope, budget, deadline, acceptance criteria, or risk tolerance.

## Meeting Speech Frames

Agents do not improvise randomly in meetings. Each meeting type gives every participant a required speech frame.

### Kickoff

Lead says:

- goal
- scope
- owners
- first-cycle deadline
- decision log

Each Agent says:

- role
- first artifact
- dependency
- risk
- deadline

The output is a project charter. In the runtime this is stored as `kickoffCharter`, including the approved meeting result, confirmed Leader, Reviewer, team roster, next actions, communication rules, and evidence ids for role negotiation, Leader campaigns, and assignments.
The charter also stores hearing edges for role negotiation and Leader campaigns, so the system can prove that Agent turns were visible to peers rather than isolated one-on-one responses.

### Recurring Sync

Lead says:

- progress map
- blockers
- deadline pressure
- decision queue

Each Agent says:

- done
- doing
- blocked-by
- next-delivery
- confidence

The output is a status ledger.

### Review

Lead says:

- review target
- acceptance bar
- open risks
- owner fixes

Each Agent says:

- finding
- evidence
- severity
- fix owner
- verification

The output is a review verdict.

### Working Discussion

This is the non-ceremonial work channel.

Lead says:

- current objective
- coordination need
- handoff point

Each Agent says:

- signal
- interpretation
- action
- request

The output is work notes or a handoff.

## Work Communication Logic

Agents themselves do not "call meetings" during normal work. They communicate inside the work stream.

For every message, each Agent runs a read pass:

1. Is this a direct mention?
2. Is this from the Lead?
3. Is this from someone I manage?
4. Does this match my capability lane?
5. Does it contain a blocker, handoff, decision, risk, or deadline?

The runtime converts that into an attention score.

- Below 45: ignore for now.
- 45-71: read silently and update working memory.
- 72+: speak if the Agent can improve the plan.
- Direct mention: always speak unless the message is only FYI.

The speaking Agent must produce one of:

- acknowledgement
- correction
- handoff
- blocker report
- evidence request
- deadline negotiation
- decision proposal

This avoids noisy "everyone comments on everything" behavior.

## Long-Running Work

A station can run without user interference by scheduling work cycles.

### Hourly Cycle

Each Agent privately does:

- inspect new messages
- update obligations
- advance the current artifact
- detect blockers
- publish only if something changed

Hourly public frame:

- last observable change
- current task
- blocked signal
- next hour

### Daily Cycle

Each Agent produces a more durable report:

- completed
- planned
- deadline
- risks
- requests

The Lead consolidates daily reports into the project ledger. The Reviewer attaches verification notes when the work touches evidence, quality, risk, security, or acceptance criteria.

The runtime supports this through two layers:

- `planAutonomousWorkCycle`: computes what every Agent should read, work on, publish, or keep private.
- `evaluateAutonomousSchedule`: decides whether an enabled project is due to run, why it is due or waiting, and what the next scheduled time is.
- `advanceAutonomousProjectCycle`: turns that cycle into a project-state update with logs, task touches, task-completion events, progress movement, scheduler evidence, `lastAutonomousRunAt`, and `nextAutonomousRunAt`.
- `publishAutonomousCycleChat`: publishes the visible autonomous cycle messages into group chat semantics, delivering direct management mentions into Agent inboxes/worklogs and appending `group-chat-message` entries to the unified event ledger.

In the local backend, the HTTP server can run the same hourly/daily worker loop on an interval. A production backend can replace the interval runner with a queue or cron process while keeping the same due-worker contract, then optionally call the configured BYOK model provider only for Agent plans that actually need generation.

### Backend Service Boundary

`agentProjectService.js` is the backend-oriented facade over the pure runtime. It is intentionally independent from React and localStorage so an API route, queue worker, or local prototype can call the same contract:

- `createAgentProjectService`: wraps a project repository and exposes backend-style commands for tests, prototype workers, and future API routes.
- `createAgentProjectMemoryStore`: the in-memory repository adapter for tests and browser-adjacent prototypes. It stores hydrated project snapshots, retained project messages, durable kickoff meeting sessions, backend security audit-stream records, and signed access replay records, exposes `saveProject`, `saveKickoffMeeting`, `appendMessages`, `getMessages`, `appendSecurityAuditRecords`, `listSecurityAuditRecords`, `appendAccessReplayRecords`, `listAccessReplayRecords`, and `snapshot`, and can be replaced by another adapter with the same shape.
- `createAgentProjectFileStore`: the Node-backed repository adapter. It persists the same project/message/kickoff-meeting/security-audit-stream/access-replay snapshot to JSON on disk, mirrors security access decisions into an append-only JSONL audit sink, reloads the snapshot, replay records, and audit sink on service restart, and proves the backend command facade can survive process boundaries before a database adapter exists. Security audit-stream rows carry project-local `previousStreamHash` / `streamHash` links so the read model can detect missing, broken, or mismatched local audit chains.
- `createAgentProjectApi`: an HTTP-shaped command handler over the service. It accepts `{ method, path, body }` and returns `{ status, body }` for `GET /kickoff-meetings`, `POST /kickoff-meetings`, `GET /kickoff-meetings/:id`, `POST /kickoff-meetings/:id/approve`, `GET /projects`, `POST /projects/initiate`, `GET /projects/:id`, `GET /projects/:id/messages`, `GET /projects/:id/timeline`, `GET /projects/:id/events`, `GET /projects/:id/tasks`, `GET /projects/:id/tasks/:taskId`, `GET /projects/:id/tasks/:taskId/evidence`, `GET /projects/:id/readiness`, `GET /projects/:id/readiness-proof-map`, `GET /projects/:id/mvp-readiness`, `GET /projects/:id/pilot-launch-readiness`, `GET /projects/:id/deployment-preflight`, `GET|POST /projects/:id/launch-approvals`, `GET|POST /projects/:id/identity-sessions`, `POST /projects/:id/identity-sessions/:sessionId/revoke`, `GET /projects/:id/persistence-snapshot`, `GET /projects/:id/persistence-migration-plan`, `GET /projects/:id/persistence-migration-dry-run`, `GET /projects/:id/persistence-adapter-plan`, `GET /projects/:id/persistence-adapter-dry-run`, `GET /projects/:id/operations-readiness`, `GET /projects/:id/provider-readiness`, `GET /projects/:id/security-boundary`, `GET /projects/:id/security-access-audit`, `GET /projects/:id/security-audit-stream`, `GET|PUT /projects/:id/membership-policy`, `GET /projects/:id/worker-queue`, `GET /projects/:id/worker-queue-adapter-plan`, `GET /projects/:id/worker-queue-adapter-dry-run`, `GET /projects/:id/manager-dashboard`, `GET /projects/:id/agents`, `GET /projects/:id/agents/:agentId`, `GET /projects/:id/agents/:agentId/dashboard`, `GET /projects/:id/agents/:agentId/inbox`, `GET /projects/:id/agents/:agentId/worklog`, `GET /projects/:id/agents/:agentId/obligations`, `GET /projects/:id/agents/:agentId/plan`, `POST /projects/:id/agents/:agentId/message`, `POST /projects/:id/agents/:agentId/work-cycle`, `POST /projects/:id/chat`, `POST /projects/:id/meeting`, `POST /projects/:id/autonomous-cycle`, `POST /workers/autonomous/due`, `POST /workers/agents/due`, and `GET|POST /workers/queue-snapshot`.
- `GET /projects/:id/production-launch-audit` is the unified release audit route. It is also embedded in Manager Ready Package as `production-launch-audit/v1`.
- `GET|POST /projects/:id/launch-approvals` is the release approval and change-management route. It returns `launch-approval-workflow/v1`; POST writes checksummed `launch-approval/v1` records with release mode, decision, approver role/id/name, reason, and linked audit checksum. Private pilot requires Manager plus security-admin approval; production additionally requires operations-owner. Records are persisted to `project.launchApprovals`, timeline, event ledger, Manager Flow Graph, Readiness Proof Map, Manager Ready Package, production launch audit, and the `launch_approvals` persistence/migration seed path.
- Project-scoped command responses such as kickoff initiation, chat, meeting, autonomous-cycle, and per-Agent work-cycle include `managerDashboard` in the response body, so manager clients can update the aggregate backend view immediately after a command without waiting for a second read.
- Due-worker processed items from `POST /workers/autonomous/due`, `POST /workers/agents/due`, and scheduler ticks also include `managerDashboard`, so background 24/7 worker results can feed the same manager aggregate view without a follow-up read per processed project.
- `createFileBackedAgentProjectApi`: combines the API handler with the Node file store so a future backend process can start from a JSON snapshot, handle commands, persist results, and restart without losing Agent state.
- `createAgentProjectHttpServer`: mounts the API handler on a real Node HTTP server with JSON request/response handling, CORS headers for access-control, signed-access, and signed request-id headers, and an optional autonomous scheduler controller for `GET /workers/autonomous/status`, `POST /workers/autonomous/tick`, `POST /workers/autonomous/start`, and `POST /workers/autonomous/stop`.
- `npm run agents:server`: starts that local backend on `AGENT_PROJECT_HOST`/`AGENT_PROJECT_PORT` with `AGENT_PROJECT_STORE` pointing at the JSON store file. `AGENT_SECURITY_AUDIT_LOG` can override the append-only JSONL audit sink path; otherwise it defaults to `${AGENT_PROJECT_STORE}.security-audit.jsonl`. Set `AGENT_AUTONOMOUS_SCHEDULER=1` to start the backend worker loop automatically, `AGENT_AUTONOMOUS_INTERVAL_MS` to adjust the polling interval, `AGENT_ACCESS_CONTROL_MODE=enforced` to require access-control headers by default on API routes, `AGENT_ACCESS_SIGNING_SECRET` to require valid signed identity headers for enforced requests, `AGENT_ACCESS_REPLAY_PROTECTION=true` to require signed request ids with one-use replay protection persisted in the file store, and `AGENT_ACCESS_AUDIT_FAIL_CLOSED=true` to reject enforced project access when the audit write fails before dispatch.
- `createKickoffMeetingSession` and `approveKickoffMeetingSession`: split initiation into a durable meeting resource and a later manager approval. A session stores the Director brief, invited Agents, role-clarification questions, self-nominations, Leader campaign turns, peer-hearing evidence, recommended Leader/Reviewer, and selectable decision options. Approval reuses the saved transcript to create the project, Leader marker, kickoff charter, assignments, first autonomous pulse, and the session/project link.
- `createKickoffProjectFromMeeting`: creates a project from a Director brief and team roster, generates role clarification, self-nomination, Leader campaign, Director-confirmed Leader marker, kickoff charter, Leader assignments, acknowledgements, and the first autonomous work pulse.
- `submitProjectChatMessage`: accepts Director/group-chat/Google Chat text, resolves `@agent`/`@all`, persists the source message into Agent state and `eventLedger`, routes feature changes, Leader assignments, peer handoffs, or ordinary Agent replies, and returns the updated project plus messages to publish.
- `submitProjectMeetingMessage`: accepts War Room meeting input, persists the Director source message, then routes meeting feature changes through the same confirmation/owner-sync protocol.
- `submitAgentMessage`: accepts one Agent as the message author and optional `targetAgentIds`, publishes the Agent-authored message through the same group-chat receipt path, writes direct targets into their inbox/obligations, writes the sender's worklog, appends a ledger event with `source: agent-to-agent-message`, and returns publishable chat messages plus manager/Agent dashboard proof.
- `runProjectAutonomousCycle`: runs `advanceAutonomousProjectCycle`, publishes visible Agent work back to group chat, and appends those chat messages to Agent state and the unified ledger.
- `runAgentWorkCycle`: advances one named Agent as an independently callable worker. It reads that Agent's current plan and owned task, writes private worklog evidence, publishes a visible group-chat progress message, sends management check-ins to any managed or peer-managed Agents, appends timeline/event-ledger proof, updates task evidence ids, and records the run in `agentWorkerLedger` with idempotency, lease, retry state, dead-letter state, and `worker-execution-receipt/v1` checksum metadata.
- `submitAgentArtifact`: lets one Agent submit a typed artifact as a first-class project record. The service writes an artifact through the configured artifact writer, publishes a submission message into group chat, writes a timeline log, appends an `agent-submission` ledger event, links the record to the task evidence, updates the submitting Agent dashboard/worklog, and exposes the submission to Manager Dashboard, Manager Flow Graph, Readiness Proof Map, and project submission routes.
- `GET /projects/:id/submissions`, `GET /projects/:id/submissions/:submissionId`, and `POST /projects/:id/agents/:agentId/submissions`: expose the generic submission contract for artifact types such as `brainstorm-board`, `evidence-packet`, `product-brief`, `risk-review`, `revision-note`, and `final-deliverable`. These routes are product-team primitives; the Research Project scenario uses them only as a validation sample, not as a research-only protocol.
- Artifact revisions are explicit: `submitAgentArtifact` accepts `revisesSubmissionId`, `respondsToReviewId`, and `supersedesSubmissionIds`. A linked revision marks prior submissions `superseded`, resolves matching review obligations for the original submitter, adds revision metadata to the artifact/submission/timeline payload, exposes `revisionRoutes` and `revisionSummary` in Readiness Proof Map, and creates `revision` edges in Manager Flow Graph.
- `recordAgentEvidenceSearch`: lets an Agent record a generic evidence/source search as a first-class project resource. The record stores query, purpose, provider/search mode, confidence, sources, findings, task/submission links, group-chat proof, timeline proof, and ledger proof. It also computes provider-agnostic evidence judgement: source `qualityScore`, `qualityLevel`, `qualitySignals`, aggregate `evidenceJudgement`, and `qualitySummary`; source safety judgement: `sourceSafetyLevel`, `sourceSafetyScore`, `sourceSafetySignals`, `sourceSafetyJudgement`, and aggregate `sourceSafetySummary`. Manager Dashboard summarizes evidence quality and source safety, Agent Dashboard exposes owned evidence searches, Task Evidence includes linked searches with judgement, Manager Flow Graph creates quality/safety-bearing `evidence` nodes, and Readiness Proof Map returns evidence-search routes with quality and source-safety judgement.
- `reviewAgentSubmission`: lets a Reviewer accept a submission or request changes as a durable review record. The review updates the linked submission and task, publishes a group-chat review message, writes a `submission-review` timeline/event record, adds revision obligations to the submitter when changes are requested, and creates Manager Flow Graph `review` nodes.
- `GET /projects/:id/evidence-searches`, `GET /projects/:id/evidence-searches/:evidenceSearchId`, `POST /projects/:id/agents/:agentId/evidence-searches`, `GET /projects/:id/submission-reviews`, `GET /projects/:id/submission-reviews/:reviewId`, and `POST /projects/:id/submissions/:submissionId/reviews`: expose the generic evidence/search and review lifecycle behind the same backend boundary as submissions.
- `searchProvider.js`: exposes a BYOK-safe search provider boundary. `GET /search/status` returns provider/configuration state without raw secrets, `POST /search/test` runs a provider health search, and `POST /projects/:id/agents/:agentId/evidence-searches` can pass `useProvider: true` to populate normalized source packets from the configured provider. The deterministic provider supports Harness validation without external network calls; `http-json` is reserved for a private search gateway.
- `secretVault.js`: exposes the local BYOK secret-vault contract. It can seal/open provider secrets with Web Crypto AES-GCM envelope records for private pilots, rehearse key rotation with `secret-vault-rotation-receipt/v1`, returns `secret-vault-status/v1` with readiness, encrypted/raw record counts, rotation support, and latest rotation metadata, and never returns key material or plaintext secrets through readiness responses. `SECRET_VAULT_ENABLED` / `SECRET_VAULT_KEY` configure the local vault; production should replace this with managed KMS or a secret manager.
- `getProviderReadiness` and `GET /projects/:id/provider-readiness`: export the real-provider rollout gate. The read model returns `provider-readiness/v1` with redacted model/search status, deterministic validation-provider proof, provider-backed evidence-search provenance, source-safety summary, provider proof routes, leak-scan status, `provider-control-policy/v1`, retry policy, circuit-breaker policy, local secret-vault seal/open/rotation status, provider usage/cost ledger rows, and the remaining production controls for managed KMS, revocation, managed audit storage, centralized alerting, and real-provider incident handling. The service facade evaluates configured provider calls against allowlists, per-project hourly request limits, daily budget cents, Agent tool grants, retry attempts/backoff, and provider circuit state, then writes `provider-usage` events plus `project.providerUsageLedger` rows. Manager Ready Package embeds this model, and MVP readiness points the `production-real-providers` blocker to this route without claiming production readiness.
- `secretRedaction.js`: provides the prototype persistence guard for obvious API keys, bearer tokens, secret-bearing URLs, provider errors, evidence source summaries, Agent submission text/source refs, review comments, task source refs, workspace artifact drafts, and ledger payloads. This keeps the local store and proof surfaces from retaining raw BYOK-style fixtures, but it does not replace managed secret storage, revocation, or production access control.
- `accessControl.js`: provides the prototype backend access decision layer. The API defaults to `prototype-open` for local demo compatibility; requests can set `x-hofs-access-mode: enforced` plus `x-hofs-role`, `x-hofs-agent-id`, and `x-hofs-user-id` to prove Manager/Agent/Reviewer/runtime/security-admin/observer decisions before route dispatch. When the API is created with `signingSecret` or the server is started with `AGENT_ACCESS_SIGNING_SECRET`, enforced requests must also include `x-hofs-signed-at` and `x-hofs-signature`; unsigned or tampered identity claims are rejected before role policy evaluation, and the HTTP scheduler signs its own runtime worker calls. When `createAgentProjectApi` receives `requireSignedRequestIds` or the server receives `AGENT_ACCESS_REPLAY_PROTECTION=true`, signed enforced requests must include a signed `x-hofs-request-id` that the file-backed backend stores as an `accessReplayRecords` entry and accepts only once within the freshness window; custom memory-only APIs still use the API memory cache fallback. When `createAgentProjectApi` receives `failClosedOnAuditError` or the server receives `AGENT_ACCESS_AUDIT_FAIL_CLOSED=true`, enforced project access returns `503 access-audit-write-failed` if the audit sink is missing or throws before route dispatch. When `createAgentProjectApi` receives `requireProjectMembership`, project-scoped enforced requests check a `project-membership-policy/v1` record from `projectMemberships`/`projectMembershipResolver` or, by default, from the persisted project state written by `GET|PUT /projects/:id/membership-policy`. That policy covers manager/security/observer/runtime user ids, team Agent ids, Reviewer Agent ids, Agent runtime user bindings, Reviewer runtime user bindings, and revoked user/Agent lists. Enforced mode checks Agent self-scope, Reviewer identity match, runtime worker access, security-admin-only sensitive exports, optional replay protection, optional audit fail-closed behavior, and optional project membership. Enforced decisions are persisted by `recordAccessDecision` into `securityAccessAudit`, linked into the event ledger as `security-access` events, mirrored into the backend security audit stream with sequence/checksum/hash-chain proof, exposed through `GET /projects/:id/security-access-audit` and `GET /projects/:id/security-audit-stream`, and exported in the persistence snapshot as `project_membership_policies`, `project_membership_grants`, `security_access_audit`, and `security_audit_stream`.
- `evaluateAgentWorkSchedule` and `runDueAgentWorkCycles`: scan each project's team for Agents whose `nextAgentRunAt` is due, rank due Agents by management pressure, run only the selected independent Agent workers, persist processed projects/messages, and report skipped Agents whose personal cadence is still waiting or whose priority lost to the per-project cap.
- `agentManagementPriority`: folds each Agent's manager relation, peer-manager relation, open owned tasks, open obligations, management inbox signals, peer handoffs, and review sweep signals into a priority score and human-readable reasons. Those reasons are returned by `POST /workers/agents/due`, written into `agentWorkerLedger`, and echoed in the visible Agent work message.
- `runDueProjectAutonomousCycles`: scans persisted projects, uses `evaluateAutonomousSchedule` to separate due from not-due projects, runs only due autonomous cycles, persists processed projects, and reports skipped projects without mutating them.
- The HTTP scheduler controller wraps both due-worker routes with status, manual tick, start, and stop controls, so a running backend can keep autonomy-enabled projects and independently due Agents moving without a browser tab. Scheduler status includes project processed/skipped counts and Agent processed/skipped counts. Worker API responses reuse per-project Manager Dashboard / Manager Ready Package read models within the same request, and the local HTTP server drains idle/keep-alive sockets during `close()` so validation runs and desktop backend restarts do not hang on retained fetch connections.
- The project dashboard renders a `Backend Worker Station` panel. It checks the configured backend URL (`VITE_AGENT_BACKEND_URL`, default `http://127.0.0.1:8787`), lets the manager edit and persist that URL, shows online/offline scheduler counters, exposes start/stop/status controls, can sync the current project to the backend for a `Server Pulse`, and can pull the backend project/messages snapshot back into the manager UI with `Sync State`.
- The same station now pulls `GET /projects/:id/manager-dashboard` after online status checks, syncs, backend chat/meeting commands, Server Pulse, and Agent Pulse. It also exposes `Sync Manager View` for a manual aggregate-only refresh. The resulting `Backend Manager Snapshot` shows readiness score, proof-route count, transcript proof count, operations Agents, management checks, assignment rows, change rows, and open task count so the manager can see the backend's aggregate view without leaving the dashboard.
- When the backend station is online, project group-chat and War Room meeting submissions use backend project commands first, then merge the returned project/messages into the UI. If the backend command fails, the same input falls back to the local runtime path so the manager interaction does not dead-end.
- Real initiation approval also uses the backend kickoff endpoint when the backend station is online. The returned project, kickoff messages, role negotiation, Leader election, charter, and assignment package are merged into the UI; if the command fails, the local kickoff runtime still creates the project.
- `getTimeline`, `getEventLedger`, `listTasks`, `getTask`, and `getTaskEvidence`: expose the manager's backend read model for project logs, replayable ledger events, task ownership, and task-level chat/log/event proof.
- `listAgentStates` and `getAgentState`: expose each Agent as an independently queryable backend resource, including inbox, obligations, current plan, fixed routine, and private worklog.
- `getAgentDashboard`: returns the per-Agent aggregate read model for one Agent: identity, state, inbox, obligations, worklog, current plan/routine, next run, latest worker, owned tasks with evidence routes, owned submissions, owned evidence searches, relevant submission reviews, management relationships, management proof logs, relevant chat/timeline/event proof ids, and backend route hints. This is the Agent-level counterpart to `getManagerDashboard`.
- `evaluateReadiness`: audits the persisted project and service message window against the manager-ready scenario checks.
- `getReadinessProofMap`: turns each readiness check into a backend evidence route with `proofKind`, `apiPath`, chat proof ids, timeline log ids, task ids, event ids, and Agent ids so the manager UI and future API clients can prove every pass/fail condition without duplicating front-end mapping logic.
- `getManagerDashboard`: returns the manager-ready aggregate read model for one project: readiness, proof map, transcript index, latest messages, event-ledger/timeline summary, 24/7 operations rows, Agent management mesh, Agent communication flow, kickoff meeting flow with conversation rows, kickoff execution flow, Leader assignment flow, change flow, peer handoffs, submission summaries, evidence-search summaries, submission-review summaries, task evidence rows, and backend route hints.
- `agentProjectService` keeps a service-instance cache for heavyweight read models with the current project/message/provider/security signature. The cache covers Manager Dashboard, Manager Flow Graph, Manager Ready Package, readiness/preflight/launch-audit packages, persistence adapter dry-runs, operations readiness, and worker queue adapter dry-runs, and it is cleared whenever the service writes project state, messages, or kickoff meetings. This is a reliability/performance guard for long Harness runs and repeated backend UI refreshes; it does not change the route contracts.
- `getMvpReadiness` and `GET /projects/:id/mvp-readiness`: return the product-team MVP launch gate. It marks the core project as `mvp-local-candidate` only when kickoff governance, self-marketing, brainstorm, evidence judgement, draft-review-revision, final delivery, proof surfaces, backend worker proof, and Agent dashboards are all covered. It separately keeps `readyForProduction: false` while production blockers remain.
- `getPilotLaunchReadiness` and `GET /projects/:id/pilot-launch-readiness`: return the private pilot launch package. The same `pilot-launch-readiness/v1` contract is embedded in Manager Ready Package and exposed as a standalone route. It aggregates MVP readiness, Manager proof routes, Manager Flow Graph, submissions/evidence/reviews, Security Boundary, Provider Readiness, managed persistence adapter dry-run, worker queue adapter dry-run, Operations Readiness, and incident drill receipts. It can return `privatePilotDecision: go` for a completed local acceptance project, but keeps `productionDecision: no-go` until real production controls replace the local contracts.
- `getDeploymentPreflight` and `GET /projects/:id/deployment-preflight`: return the private pilot deployment preflight contract. The same `deployment-preflight/v1` contract is embedded in Manager Ready Package and exposed as a standalone route. It checks backend store/audit sink, scheduler env, access-control hardening flags, signed request/replay/audit fail-closed settings, local secret-vault readiness, provider policy, managed persistence adapter status, worker queue adapter status, adapter gateway preflight, operations readiness, and production controls. It can mark `privatePilotDeploymentReady` when blocker gates pass, but keeps `productionDeploymentReady: false`.
- `getProductionLaunchAudit` and `GET /projects/:id/production-launch-audit`: return the unified release audit contract. The same `production-launch-audit/v1` contract is embedded in Manager Ready Package and exposed as a standalone route. It aggregates MVP readiness, pilot launch readiness, deployment preflight, security/provider/operations readiness, evidence routes, production blockers, audit-integrity checks, next-shortest-path guidance, and a checksum. A completed acceptance project can return `privatePilotDecision: go`, but production remains `no-go` until real managed identity, persistence, queue, provider, audit, and operations controls pass.
- `getProjectEvidenceArchive` and `GET /projects/:id/project-evidence-archive`: return the full manager/customer handoff evidence bundle. The standalone route exposes full `project-evidence-archive/v1` redacted contents, while Manager Ready Package embeds a manifest-only snapshot with the same status, route, gates, counts, and checksums. The full archive redacts sensitive fields, produces manifest checksums, scans for raw secret patterns, and includes project state, transcript channels, Agent submissions, final deliverables, evidence searches, submission reviews, revision lineage, Manager Flow Graph, Readiness Proof Map, timeline, event ledger, readiness summaries, persistence summary, and worker recovery summary. It can be ready for manager handoff/private-pilot evidence while still keeping `readyForProduction: false`.
- `getPersistenceSnapshot` and `GET /projects/:id/persistence-snapshot`: export the current project into a normalized production persistence contract. The snapshot includes table manifests, record counts, compact records, foreign-key refs, checksums, access replay rows, event-ledger sequence checks, and relation issues so a future managed database migration can be validated before replacing the JSON file store.
- `getPersistenceMigrationPlan` and `GET /projects/:id/persistence-migration-plan`: derive a managed database migration plan from the persistence snapshot. The plan includes Postgres-compatible record-envelope DDL, seed batches, table RLS guidance, critical-table coverage, verification gates, blockers, and a cutover checklist for replacing the JSON/file store with managed persistence.
- `getPersistenceMigrationDryRun` and `GET /projects/:id/persistence-migration-dry-run`: simulate the minimum managed persistence adapter contract against the snapshot and migration plan. The dry-run verifies schema-plan coverage, seed order, imported row counts, checksum preservation, primary-key uniqueness, relation integrity, RLS guidance, and migration-plan gates before a real managed Postgres adapter is introduced.
- `getPersistenceAdapterPlan` and `GET /projects/:id/persistence-adapter-plan`: export the managed database cutover bridge. The plan defines `managed-persistence-adapter-contract/v2` methods for schema creation, transactions, batch import, table reads, event/audit/replay/checkpoint writes, checksum and relation verification, RLS verification, backup/restore, shadow-read comparison, cutover commit, and rollback. It requires critical table coverage for project state, messages, events, tasks, Agent states, submissions, evidence searches, reviews, project membership policies, access replay rows, security audit rows, provider usage, worker runs, and read-model checkpoints.
- `managedPersistenceAdapter.js`: provides the configurable managed persistence adapter facade. It exports `managed-persistence-adapter-status/v1` from `MANAGED_PERSISTENCE_ADAPTER_DRIVER`, `MANAGED_PERSISTENCE_DATABASE_URL`, `MANAGED_PERSISTENCE_HTTP_ENDPOINT`, `ADAPTER_GATEWAY_HTTP_ENDPOINT`, and `MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER`. The default `local-shadow` driver is not a database driver, but it executes the production-facing method names against normalized records and emits `managed-persistence-adapter-execution-receipt/v1` data for connect, schema creation, import, checksum verification, relation verification, RLS verification, backup creation, restore, shadow-read comparison, and rollback. `http-json` can execute through the async private gateway dry-run path; `postgres` still needs a future real driver. All paths must keep production cutover blocked until real database approval exists.
- `getPersistenceAdapterDryRun`, `getPersistenceAdapterDryRunAsync`, and `GET /projects/:id/persistence-adapter-dry-run`: simulate the managed database adapter cutover before replacing the file store. In default mode the service executes the local shadow adapter. In `http-json` mode the API async handler sends the current project snapshot, migration plan, migration dry-run summary, adapter contract, and shadow-read plan to the private gateway and returns `managed-persistence-adapter-gateway-execution/v1`. Manager Ready Package and Operations Readiness embed this read model while production still requires a real managed database adapter, real backup/restore drills, real shadow reads, and a cutover approval process.
- `adapterGatewayClient.js`: defines the shared `http-json` private adapter gateway contract used by managed persistence and worker queue adapters. It validates `GET /health`, `GET /state`, `POST /persistence/dry-run`, and `POST /worker-queue/dry-run` responses, requiring `adapter-gateway-health/v1`, `adapter-gateway-state-summary/v1`, `managed-persistence-adapter-execution-receipt/v1`, and `worker-queue-adapter-execution-receipt/v1`.
- `getAdapterGatewayPreflight`, `getAdapterGatewayPreflightAsync`, and `GET /projects/:id/adapter-gateway-preflight`: expose `adapter-gateway-preflight/v1` for Manager Ready Package and deployment preflight. Local-shadow mode proves the private-pilot adapter rehearsal path is explicit without requiring a gateway endpoint. `http-json` mode calls the configured private gateway's health and state endpoints, checks advertised managed-persistence and worker-queue capabilities, surfaces storage/queue metadata without secrets, and keeps both `productionCutoverReady` and `readyForProduction` false.
- `adapterGatewayStore.js`: defines the storage adapter contract behind the runnable gateway. It exposes `adapter-gateway-storage-adapter-status/v1`, async-compatible `readState`, `writeState`, and `summary`, with current `json-file`, `memory`, and `postgres` / `postgres-compatible` drivers selected by `ADAPTER_GATEWAY_STORAGE_DRIVER`. The Postgres-compatible driver exposes `adapter-gateway-postgres-schema-plan/v1`, redacts `ADAPTER_GATEWAY_POSTGRES_URL`, uses `ADAPTER_GATEWAY_POSTGRES_SCHEMA`, and can execute schema/upsert/snapshot write operations plus `adapter-gateway-postgres-readback/v1` snapshot/count parity through a bound query function while still blocking production cutover.
- `adapterGatewayServer.js`: provides the runnable local private adapter gateway reference process. It exposes `GET /health`, `GET /state`, `POST /persistence/dry-run`, and `POST /worker-queue/dry-run`, can require bearer auth, persists imported shadow table records, queue rows, queue leases, dead-letter rows, and receipt summaries through `adapterGatewayStore.js`, and returns gateway execution receipts with `productionCutoverReady: false`. It is the process-level bridge between the backend API dry-run routes and a future real managed database/queue implementation. `npm run adapters:gateway-postgres-store:validate` proves the Postgres-compatible store can emit schema-plan, table-record, queue-row, lease, receipt, snapshot writes, and readback parity through that same bridge.
- `getWorkerQueueSnapshot`, `getProjectWorkerQueue`, `GET|POST /workers/queue-snapshot`, and `GET|POST /projects/:id/worker-queue`: export a no-mutation queue preview for project and Agent workers. Rows include due/waiting status, management priority, idempotency key, lease key, direct run route, due-worker route, concurrency policy, retry state, and expected receipt metadata. The snapshot also includes `worker-queue-retry-policy/v1`, `worker-dead-letter-policy/v1`, completed `worker-execution-receipt/v1` rows, and a derived dead-letter queue so production cron/queue infrastructure can preserve the same scheduling and recovery semantics.
- `workerQueueAdapter.js`: provides the configurable worker queue adapter facade. It exports `worker-queue-adapter-status/v1` from `WORKER_QUEUE_ADAPTER_DRIVER`, `WORKER_QUEUE_HTTP_ENDPOINT`, `ADAPTER_GATEWAY_HTTP_ENDPOINT`, and `WORKER_QUEUE_REQUIRE_REAL_ADAPTER`. The default `local-shadow` driver executes the production-facing method names against due worker rows and emits `worker-queue-adapter-execution-receipt/v1` data for enqueue, lease acquisition, dispatch, execution receipt acknowledgement, retry import, dead-letter storage/recovery, queue inspection, and `worker-queue-adapter-snapshot-parity/v1` parity across queue rows, leases, acknowledgements, and dead-letter recovery. `http-json` can execute through the async private gateway dry-run path; `managed-queue` still needs a future real driver.
- `getWorkerQueueAdapterPlan`, `getWorkerQueueAdapterDryRun`, `getWorkerQueueAdapterDryRunAsync`, `GET /projects/:id/worker-queue-adapter-plan`, and `GET /projects/:id/worker-queue-adapter-dry-run`: export the production queue/cron adapter bridge. The plan defines adapter methods for enqueue, lease acquisition, dispatch, execution receipt acknowledgement, retry, dead-letter, recovery, inspection, and snapshot parity inspection. The dry-run executes the local shadow adapter by default; in `http-json` mode the API async handler sends the project queue snapshot to the private gateway and returns `worker-queue-adapter-gateway-execution/v1` without replacing the local scheduler.
- `getOperationsReadiness` and `GET /projects/:id/operations-readiness`: export the local operations readiness contract. The read model checks worker-run observability, queue idempotency/lease data, queue adapter dry-run status, managed persistence adapter dry-run status, execution receipt coverage, retry/dead-letter recovery readiness, security audit-stream ordering/hash-chain verification, persistence recovery source integrity, migration dry-run status, proof-surface replayability, security boundary visibility, alert-rule drafts, a recovery runbook, and `operations-incident-drill/v1` rehearsal receipts. Each incident drill receipt carries a checksum and proves one local recovery phase such as alert routing, write freeze, persistence verification, queue recovery, audit-chain review, or Manager proof-surface replay. Manager Ready Package embeds this model while production still requires centralized logs/metrics/alerts, incident ownership, a real managed database adapter, durable queue leases, managed dead-letter storage, and backup/restore drills against real infrastructure.
- `getProviderReadiness` and `GET /projects/:id/provider-readiness`: export the local provider readiness contract. It can pass for the deterministic validation-provider path used by the generic product-team Harness when provider policy, retry/circuit-breaker policy, local secret-vault status, usage ledger, and source-safety checks are present, while keeping production blocked until real LLM/search provider controls are fully implemented.
- `getProjectMembershipPolicy`, `setProjectMembershipPolicy`, and `GET|PUT /projects/:id/membership-policy`: persist and read the active `project-membership-policy/v1` record from project state. Updates create a membership audit entry, timeline log, and `project-membership-policy-updated` event-ledger event. The persistence snapshot exports the active policy into `project_membership_policies` and normalized grant/revocation rows into `project_membership_grants`.
- `getIdentitySessions`, `issueIdentitySession`, `verifyIdentitySession`, `revokeIdentitySession`, `GET|POST /projects/:id/identity-sessions`, and `POST /projects/:id/identity-sessions/:sessionId/revoke`: implement the local runtime credential contract. Issuance returns an `identity-session-token/v1` token once, persists only `identity-session/v1` token hashes/checksums/status/expiry/revocation proof, accepts `x-hofs-session-token` on project routes, records verified session ids in access audit rows and backend audit-stream records, and exports `identity_sessions` in the persistence snapshot and migration seed order. This is for private MVP validation; production still needs a real IdP/session store/service credential system.
- `getSecurityBoundary` and `GET /projects/:id/security-boundary`: export the security boundary read model. It returns route policies for manager, Agent, Reviewer, runtime, persistence, queue, membership policy, identity sessions, and security routes; the `access-control-policy/v1` contract including signed-header, replay-protection, audit fail-closed, project-membership, and identity-session contracts; active membership policy summary; local identity-session active/revoked/expired summary plus public rows; access-audit summary, audit-stream hash-chain summary, and routes; sensitive-field coverage for provider config, submissions, evidence searches, reviews, messages, events, artifacts, and identity-session hashes; provider status boundaries; local secret-vault status; redaction scan counts/checksums; and explicit production blockers for identity, project RBAC, managed KMS/secret rotation, immutable access audit logs, and abuse controls. Manager Ready Package embeds this model and MVP readiness points the secret-vault/RBAC blocker to this route.
- `getSecurityAccessAudit` and `GET /projects/:id/security-access-audit`: return `security-access-audit/v1`, including persisted access decisions, denied rows, actor/route/status fields, linked `security-access` event ids for replay, and a backend audit-stream summary.
- `getSecurityAuditStream` and `GET /projects/:id/security-audit-stream`: return `security-audit-stream/v1`, including store-level access decision records, append-order sequence numbers, stream checksums, `previousStreamHash` / `streamHash` links, hash-chain readiness/mismatch counts, storage metadata, append-only JSONL sink path when file-backed, and the `security_audit_stream` migration target. This is still prototype storage, not immutable centralized production logging.

The React initiation approval, chat input, and Roundtable input now use this service boundary, so the manager demo and the future backend API exercise the same orchestration path. Scenario validation also snapshots the store, rebuilds a fresh service, writes the file-backed store to disk, reloads it, drives the HTTP-shaped API handler, boots the real Node HTTP server, calls it with `fetch`, creates and approves a durable kickoff meeting session, creates a project through `POST /projects/initiate`, restarts it, and proves that kickoff, chat, meeting, Leader assignment, readiness, and autonomous worker dispatch still work after reload.

The current React app already exercises the same contract:

- Projects can set `autonomy.enabled` and `autonomy.cadence`.
- The workspace periodically checks whether a project is due for its next cycle.
- The project dashboard exposes `Hour Pulse` and `Day Report` controls for immediate verification.
- Cycle output is written into project logs, task state, task-completion logs, progress, `lastAutonomousRunAt`, `nextAutonomousRunAt`, scheduler ledger records, and project-scoped group chat records.
- Each cycle also writes `agentStates`: per-Agent manager relation, inbox, open obligations, current plan, owned task ids, private worklog, status, and last active timestamp.
- Each autonomous cycle now emits management-loop evidence: Leader `management-check-in` events for managed Agents with open tasks, Reviewer `review-sweep` events for evidence continuity, and peer `peer-management-check-in` events for accepted dependency handoffs.
- These management events are written to the timeline, counted in the autonomous ledger, delivered to the target Agent's inbox, and mirrored to group chat as visible `@agent` check-ins.
- Each Agent has a fixed work routine derived from its role capability. Autonomous cycles store the routine label, checklist, and expected artifact in both `agentStates.currentPlan.routine` and `autonomousLedger.agentPlans`.
- The manager dashboard renders a `Fixed Work Routines` matrix for every Agent, showing routine label, expected artifact, checklist, current focus, next evidence step, and the latest worker/worklog source.
- Approved kickoff meetings write a structured `kickoffCharter` so the project has a durable starting agreement before autonomous work begins.
- The backend now also supports durable pre-approval kickoff meeting sessions. `POST /kickoff-meetings` stores the meeting transcript and manager decision options before a project exists; `POST /kickoff-meetings/:id/approve` turns that saved session into the normal project, charter, Leader marker, assignments, first pulse, and manager-dashboard proof.
- The project dashboard exposes a `Manager Demo Path` that jumps directly to kickoff chat evidence, a Google Chat change-request simulation, a live meeting-change path through the Roundtable room, and the evidence timeline.
- The same path can prefill a live Leader assignment request; submitting it makes the confirmed Leader post the actual `@agent` assignment and makes the assignee acknowledge immediately.
- The project dashboard renders the `Kickoff Charter` with meeting result, Leader, Reviewer, next actions, and communication rules.
- The `Kickoff Charter` keeps runtime transcript ids for role clarification, self-nomination, Leader campaign, assignment, and acknowledgement messages, and exposes a `Kickoff chat proof` jump that lands back on those group-chat records.
- The dashboard also renders `Kickoff Meeting Flow`, showing role clarification questions, self-nominations, peer-hearing edges, Leader campaign count, Director confirmation, persisted Leader marker, confirmed team count, and a `Kickoff meeting proof` jump back to the exact group-chat evidence.
- `Kickoff Meeting Flow` includes `Conversation Evidence` rows for role questions, self-nominations, and Leader campaigns, including speaker, role, text, heard-by count, and a direct `Conversation proof` jump.
- Manager Flow Graph now turns kickoff self-nominations and Leader campaign turns into first-class `self-marketing` nodes, with transcript proof, event-ledger proof, heard-by participants, attachments, and edges into role analysis or Leader election. Role-clarification turns are also emitted as proofed kickoff conversation nodes.
- `GET /projects/:id/readiness-proof-map` exposes `roleNegotiationRoutes` and `selfMarketingRoutes`, so backend clients can verify role negotiation and Agent self-marketing without reconstructing the kickoff transcript manually.
- The dashboard also renders `Kickoff Execution Flow`, connecting charter next actions to Leader assignment rows, first autonomous pulse evidence, and 24/7 readiness. Managers can jump from this block to assignment chat proof or first-pulse timeline proof.
- The project initiation meeting step renders the runtime-generated kickoff transcript directly, including the Director brief, Agent role questions, self-nominations, and Leader campaign turns before the manager confirms the result.
- Each initiation transcript card shows which peers heard that turn, and the kickoff charter stores those hearing edges as durable evidence.
- `createKickoffCharter` also emits ledger events for each kickoff role question, self-nomination, and Leader campaign speech, so the unified event stream can replay the meeting instead of only storing the final charter.
- Runtime group-chat messages now carry durable receipt metadata: `heardBy`, `directTargetIds`, per-Agent `receipts`, and a `visibility` summary. Assignment, handoff, change discussion, autonomous work, and Director-authored messages all use this shape.
- Group chat rendering shows named `Heard by` and `Direct target` recipients beside receipt counts, so the manager can see which Agents heard a broadcast and which Agent was directly @mentioned.
- The dashboard renders `Group Chat Transcript Index`, which lists every project channel with message count, archived proof recovery count, latest speaker/message, receipt coverage, direct mentions, and an `Open transcript` proof jump.
- The backend exposes the same transcript read model through `GET /projects/:id/transcripts` and `GET /projects/:id/transcripts/:channelId`, including current messages, recoverable proof ids, and archived proof messages when the current chat buffer no longer contains them.
- Timeline logs created from chat messages preserve `receiptCount` and `directTargetIds`, so proof recovery and readiness audits can still prove who saw a message after the visible chat buffer is trimmed.
- Timeline detail panels now surface source channel, receipt count, and direct-target Agent names for runtime events, so assignment and change evidence remains auditable from the big timeline view.
- Ordinary group-chat messages use `applyChatMessagesToAgentStates`: direct `@agent` receipts are delivered into that Agent's inbox and obligations, while Agent-authored replies are written into the author's private worklog. This keeps normal chat stateful even when it is not a Leader assignment, handoff, or feature change.
- The backend exposes Agent-authored group-chat publishing through `POST /projects/:id/agents/:agentId/message`. This makes Agent-to-Agent communication a first-class server route: the sender is fixed by the URL, target Agents are explicit, receipts are durable, target dashboards show the inbox proof, and the sender dashboard shows the worklog proof.
- The manager dashboard exposes the same backend route in each Team row as an `Agent Message` control. A manager can pick a target Agent, edit the message, send it through the backend, and immediately see the target inbox proof plus sender worklog proof without leaving the dashboard.
- The dashboard also renders `Agent Communication Flow`, which consolidates Agent-authored messages into sender, targets, receipt count, target inbox state, target obligation state, sender worklog state, and an exact `Agent chat proof` jump.
- Special manager commands now persist the Director's source message first. Leader assignment commands, Google Chat change requests, and War Room meeting change requests enter Agent inbox/worklog state and the unified event ledger before their runtime handlers create tasks, discussions, confirmations, and sync records.
- Projects maintain a unified append-only `eventLedger` alongside specialized records. Kickoff approval, Leader assignment, peer handoff, confirmed changes, autonomous scheduler runs, work pulses, management check-ins, and task completions all append sequence-numbered events.
- `appendProjectEvents` tracks `eventLedgerFirstSequence`, `eventLedgerLastSequence`, and `eventLedgerEventCount`, so sequence numbers keep increasing even when the retained browser window is trimmed to the latest events.
- `backfillProjectEventLedger` migrates older project shapes into that same stream by rebuilding events from kickoff transcripts, kickoff charter evidence, timeline logs, change ledger records, peer handoffs, and autonomous scheduler records during project hydration.
- `projectEventReplayProjection` derives replay-stage counts from the ledger: kickoff speeches, assignments, changes, peer handoffs, autonomous runs, management events, and completions.
- The project dashboard exposes this `Unified Event Ledger` with retained/total counts, sequence range, and replay-stage counts; the readiness audit checks event-ledger continuity and replay readiness so future backend persistence can map it directly to a project events table.
- The backend API exposes the same evidence as read resources: `/timeline` returns project logs, `/events` returns the append-only ledger plus replay summary, and `/tasks/:taskId/evidence` resolves the task's source chat messages, timeline logs, and ledger entries.
- The manager dashboard exposes backend worker status beside the autonomous project loop, so the user can tell whether 24/7 work is currently browser-local, connected to the local backend, or offline. When the backend is online, the dashboard periodically pulls the active project snapshot and merges returned chat messages so server-run cycles remain visible in the manager view.
- The dashboard renders a `24/7 Operations Board` directly under the autonomous loop. It summarizes project next/last run, backend worker state, Agent run queue size, and each Agent's next run, latest work, worker trigger, open obligations, and management priority.
- Starting the backend scheduler from `Backend Worker Station` first persists the active project to the backend store, requests an immediate first worker tick, publishes a current-project autonomous pulse with `trigger: manager-ui-scheduler-start-pulse`, silently syncs project state after start, and shows `Immediate Start`, running state, latest processed projects, latest processed Agents, and worker message count.
- Each Team row exposes a backend-backed `Agent Pulse` button when the backend station is online. It calls `POST /projects/:id/agents/:agentId/work-cycle`, so a manager can wake one Agent independently and see that Agent's latest inbox item, open obligation, worklog entry, next Agent run, timeline proof, chat proof, latest management priority, priority reasons, and `agentWorkerLedger` update without ticking the whole project.
- The backend also exposes `GET /projects/:id/agents/:agentId/dashboard`, so a manager client can pull one Agent's inbox, obligations, private worklog, owned task evidence, management mesh, worker ledger, and proof routes without reconstructing that view from multiple endpoints.
- Agent Team rows include direct proof jumps from latest inbox, open obligation, and worklog details back to the exact group-chat message or timeline evidence, so the manager can verify that a mention was received, accepted as work, and published as progress without manually searching chat history.
- The dashboard renders `Agent Management Mesh`, a consolidated view of the Director-confirmed Leader chain, peer-management relationships, managed Agents, latest management check-ins, and management timeline proof jumps.
- The backend scheduler tick also calls `POST /workers/agents/due`, so Team-row Agent work is not limited to manual clicks; each Agent can be woken by its own due timestamp while the manager watches Agent run/skip counters in `Backend Worker Station`. When multiple Agents are due, managed Agents with open work, inbox check-ins, peer-manager pressure, or review signals are processed before lower-priority due Agents.
- Backend-connected chat and meeting commands return runtime response details, including change discussions and owner confirmations, so the War Room animation and group-chat evidence continue to work when the server is the command source.
- Backend-connected initiation returns the same role negotiation, Leader election, kickoff charter, and Leader assignment evidence that the local runtime creates, so the project is backend-persisted from the first approval moment.
- The real initiation result screen now has an explicit `Director Decisions` gate before project creation: it shows the confirmed team roster, lets the manager select the final Leader from the campaign slate, shows the Leader marker that will be persisted, and summarizes the first execution plan before approval.
- Confirming a real initiation project immediately runs the first hourly autonomous work pulse, writes scheduler evidence with `trigger: initiation-approval`, moves the project to executing, and mirrors the first pulse back into group chat.
- The project dashboard renders a `Change Ledger` with change source, owner, reviewer, confirmation status, linked task, and owner plan sync.
- Each `Change Ledger` item renders the mid-project change as five visible stages: source request, team discussion, owner confirmation, owner plan update, and team sync count. It also names the synchronized Agents, with chat proof including discussion, confirmation, and sync messages.
- Each `Change Ledger` row can jump directly to the discussion/confirmation/sync chat proof and the related timeline log proof.
- Active task rows show the responsible owner, Leader assignment marker, source channel, work-pulse count, timeline publication marker, and task-level evidence ids for assignment/request messages, acknowledgement or owner-confirmation messages, owner sync messages, and timeline logs.
- Task rows include direct jumps back to the source chat channel and the evidence timeline when those proofs exist; the destination view automatically lands on and highlights the exact proof messages or timeline logs.
- The dashboard now also renders `Leader Assignment Flow`, a manager-readable proof chain for Leader-assigned work: `Group @Assignment`, `Assignee Inbox`, `Acknowledgement`, `Work Pulse`, and `Timeline Proof`. Each row derives the inbox/work evidence from the assigned Agent's private state and offers direct chat/timeline proof jumps.
- Chat proof jumps recover archived proof messages from `project.initiation` transcripts and `project.logs` before opening the channel, so older evidence still resolves even after the visible chat buffer has been trimmed.
- Kickoff Leader assignments are stored as `kickoff-leader-assignment` tasks from the main group channel, so the first tasks created after the initiation meeting have the same Chat proof navigation as live assignments and change requests.
- Team rows show each Agent's independent state, including manager/managed relationship, peer-managed dependency relationship, status, current plan, inbox count, and worklog count.
- `Peer Handoffs` shows accepted Agent-to-Agent dependency requests with requester, target, task, channel, request evidence, and acknowledgement evidence, with direct jumps to the peer chat proof and timeline proof.
- Confirmed feature changes update the responsible owner's Agent state immediately: the source channel enters inbox, the change task enters obligations and task ids, and `currentPlan` points at the accepted change before the next autonomous cycle.
- Confirmed feature changes also write `change-sync` receipts into every non-owner Agent's inbox/worklog, and `changeLedger` records the synchronized Agent count.
- The global dashboard exposes `Run Manager Demo`, which seeds the full requested scenario using the same runtime functions: kickoff role negotiation, Leader election, Director confirmation, Leader `@agent` task assignment, War Room meeting change request, Google Chat change request, autonomous work cycles, task completion, and timeline evidence.
- Chat messages are project-scoped with `projectId`; channel views and autonomous message reading only use the active project's messages so manager-demo evidence does not bleed into other projects.
- Group chat mention parsing resolves targets against the active project team, so full names with spaces such as `@Alan Turing`, ids such as `@turing`, and `@all` route to the intended Agents.
- Project state, chat messages, and the autonomous ledger are persisted in browser `localStorage` for the prototype. A production backend should replace this with an append-only project ledger table or local file store using the same cycle shape.
- The project dashboard also renders the current Lead, Reviewer, kickoff frame, and recurring sync frame so the team governance model is visible instead of hidden inside runtime code.
- The project dashboard renders `Manager Scenario Readiness`, a scenario-specific audit score that checks the requested manager workflow end to end: kickoff approval, role clarification, peer hearing, Leader election, Leader assignments, Agent states, autonomous work, timeline progress, group chat evidence, peer handoffs, War Room meeting changes, Google Chat changes, and owner plan sync.
- `Manager Scenario Readiness` derives group-chat evidence from durable project records such as kickoff assignment ids, handoff records, change ledger discussion ids, and autonomous ledger entries, so long chat histories do not erase readiness proof.
- `Manager Proof Map` turns every readiness check into a direct evidence route. Kickoff checks jump to kickoff chat proof, assignment and change checks jump to source chat proof, autonomous/progress checks jump to timeline proof, and Agent state/management checks jump to their dashboard or timeline proof surfaces.
- The backend exposes the same proof map through `GET /projects/:id/readiness-proof-map`, so Manager Scenario Readiness is now auditable from service/API/HTTP clients, not only from the React dashboard.
- The backend also exposes `GET /projects/:id/manager-dashboard`, an aggregate manager read model that packages readiness/proof-map status, transcript summary, operations board rows, Agent management mesh rows, kickoff/assignment/change flows, peer handoffs, and task evidence into a single response for future manager clients.

The autonomous ledger stores:

- cycle id
- cadence
- run timestamp
- trigger, due timestamp, scheduler reason, and next run timestamp
- lead id
- published event count
- per-Agent priority, read count, obligation count, and publish status
- per-Agent status derived from the persisted `agentStates`
- per-Agent fixed work routine id, label, checklist, and expected artifact
- communication diagnostics showing which Agent read, spoke, ignored, or accepted an obligation, with attention score and reason

The scheduler ledger stores one entry per manual or automatic cycle so a manager can see whether a run came from the page scheduler, the Director's manual pulse, or a seeded demo path.

## Collaboration Invariants

The system should preserve these rules:

- No ownerless task.
- No decision without a recorded reason.
- No blocker without an owner.
- No deadline change without Lead visibility.
- No risk acceptance without Reviewer visibility.
- No Director interruption unless the team cannot decide inside its authority.

The runtime exposes `evaluateCollaborationState` to check these rules against the current project. The dashboard renders the resulting collaboration health score and each failed check so broken coordination is visible before it becomes silent drift.

## Runtime Entry Points

- `createAgentNetwork`: creates Agents, governance, and relations.
- Confirmed team `isLeader` markers are treated as authoritative by network governance before inferred Lead selection.
- `createKickoffRoleNegotiation`: produces kickoff role-clarification and self-nomination turns before Leader election.
- `createKickoffCharter`: turns the approved kickoff, Leader election, and Leader assignments into a durable project charter.
- `createLeaderElection`: produces Leader campaign statements and a recommended Leader.
- `createLeaderAssignmentPackage`: turns open tasks into Leader-authored `@agent` assignment messages plus immediate assignee acknowledgements, receipt metadata, and timeline logs.
- `isLeaderAssignmentRequest` and `handleLeaderChatAssignment`: detect live group-chat assignment requests, let the confirmed Leader emit the actual `@agent` assignment, create the task, record the assignee acknowledgement, update Agent state, and publish both logs to the timeline.
- `isPeerHandoffRequest` and `handlePeerHandoff`: detect Agent-to-Agent dependency handoffs, create the dependency task, record requester and target messages, update peer-management state, write a handoff ledger entry, and publish both logs to the timeline.
- `startAgentSession`: starts a meeting/session with a protocol frame.
- `routeDirectorDirective`: routes explicit Director instructions.
- `runRoundtableExchange`: produces meeting-style Agent turns.
- `processWorkCommunication`: reads a work-stream message and decides who should speak.
- `planAutonomousWorkCycle`: plans hourly/daily autonomous work and reports.
- `evaluateAutonomousSchedule`: checks due status and next-run timing for enabled autonomous projects.
- `advanceAutonomousProjectCycle`: applies an autonomous cycle to project state.
- `createAutonomousCycleChatMessages`: converts autonomous work cycles into project-scoped group chat records.
- `publishAutonomousCycleChat`: publishes those records back into Agent state and the unified event ledger for manual pulses, scheduled pulses, initiation first-pulse, and manager demo seeding.
- `isFeatureChangeRequest`: detects English and Chinese feature-change requests.
- `handleFeatureChangeRequest`: turns group chat, Google Chat, or meeting change requests into discussion, confirmation, task, owner sync, change ledger, and timeline records.
- It also returns a fully updated project state with owner plan sync persisted into `agentStates`.
- `evaluateCollaborationState`: checks whether the team still satisfies collaboration invariants.
- `evaluateManagerScenarioReadiness`: checks whether the requested manager demo scenario is fully evidenced and manager-ready.
- `buildAgentChatReplies`: adapts work communication into UI chat messages.
- `agentProjectService.js`, `agentProjectStore.js`, `agentProjectFileStore.js`, `agentProjectApi.js`, and `agentProjectHttpServer.js`: wrap the runtime into backend-style project operations: create kickoff projects from a Director brief/team roster, hydrate/replace project state, submit chat, submit War Room meeting input, run autonomous worker cycles, scan due projects and management-prioritized due Agents for the backend scheduler, expose project timeline/event/task evidence, retain message history, snapshot/reload repository state, persist a Node JSON store, expose HTTP-shaped commands, run the optional autonomous scheduler loop in a real local HTTP server, and evaluate manager readiness.

## Verification

- `npm run agents:scenario` validates the manager scenario data path in Node: kickoff role clarification, self-nomination, visible initiation meeting transcript, structured kickoff charter, Leader election, confirmed `isLeader` governance, kickoff Leader `@agent` assignment, live group-chat Leader assignment, Agent-to-Agent message publishing, Agent-to-Agent peer handoff, assignee acknowledgement, War Room meeting change discussion, Google Chat change discussion, change ledger, responsible-owner sync, autonomous scheduler due checks, autonomous work progress, autonomous group chat records, per-Agent state persistence, task completion, timeline logs, backend kickoff project creation, backend service dispatch for chat/meeting/worker operations, project timeline/event/task-evidence/readiness-proof-map/manager-dashboard/agent-dashboard HTTP reads, HTTP scheduler status/tick/start/stop controls, dashboard backend worker station controls and snapshot sync, repository snapshot/reload continuity, file-backed persistence/restart continuity, API command routing/restart continuity, real HTTP server request/restart continuity, due-worker processing/skipping, and 100% manager-readiness audit coverage.
- `npm run agents:product-team` validates the generic product-team acceptance sample. It creates and approves a durable kickoff meeting, records an Agent evidence search through the deterministic provider, submits `brainstorm-board`, `evidence-packet`, `product-brief`, `risk-review`, `revision-note`, and `final-deliverable` artifacts through `POST /projects/:id/agents/:agentId/submissions`, requests changes on the draft brief, links the revision note and final deliverable back to the requested-changes review, and accepts the final deliverable through `POST /projects/:id/submissions/:submissionId/reviews`. The gate verifies provider status/test without secret exposure, seals/opens fake provider keys through the local secret vault, injects fake secret fixtures into provider configuration/source refs/submission text, scans the persisted file store plus workspace artifact files, boots the real Node HTTP server against that store, runs a scheduler tick through `/workers/autonomous/tick`, and checks that project and Agent worker output is visible in Manager Dashboard, Manager Ready Package, Manager Flow Graph monitoring proof, MVP readiness, provider readiness, project evidence archive, production persistence snapshot, managed persistence migration plan, managed persistence migration dry-run, operations readiness, security boundary, security access audit, backend security audit stream, worker queue snapshot, worker queue adapter plan, and worker queue adapter dry-run. It also writes private-pilot Manager and security-admin launch approvals through `POST /projects/:id/launch-approvals`, verifies `launch-approval-workflow/v1` readback, Manager Flow Graph release-governance edges, Readiness Proof Map `launchApprovalRoutes`, production launch audit private-pilot `go`, `project-evidence-archive/v1` manifest checksums / final deliverable / transcript / evidence / review / Flow Graph / raw-leak gates, and `launch_approvals` persistence/migration rows. It also writes a project membership policy through `PUT /projects/:id/membership-policy`, verifies persisted policy/audit/event proof, checks enforced access decisions for security-admin reads, observer export denial, Agent own-dashboard access, cross-Agent dashboard/submission denial, Reviewer identity mismatch denial, signed access-header rejection/allow/tamper cases, signed request-id replay denial in-process and after file-backed API restart, audit fail-closed rejection, signed HTTP scheduler worker calls under replay protection, project membership allow/deny/revocation cases for Manager, Agent runtime, and Reviewer identities, persisted audit rows, backend audit-stream rows with sequence/checksum/hash-chain proof, append-only JSONL audit sink rows, `security-access` event-ledger proof, `provider-usage` event-ledger proof, `project_membership_policies`, `project_membership_grants`, `access_replay_records`, `security_access_audit`, `security_audit_stream`, `provider_usage_ledger`, and worker receipt/retry/dead-letter persistence rows, migration-plan seed order/RLS/verification gates, migration dry-run adapter contract/import/checksum/primary-key gates, queue adapter enqueue/idempotency/lease/dispatch/receipt/dead-letter dry-run gates, operations readiness gates/alerts/recovery runbook plus `operations-incident-drill/v1` receipts, worker recovery metrics, provider readiness gates/production controls, provider retry/circuit-breaker policy, local secret-vault status, provider policy/usage/cost rows, HTTP header propagation, artifact files, evidence quality judgement/source signals, proofed role-clarification/self-marketing graph nodes, resolved review obligations, superseded draft submissions, group-chat submission/search/review messages, timeline logs, event-ledger events, task evidence links, Agent Dashboard owned submissions/evidence/reviews, Manager Dashboard submission/evidence/review/revision/evidence-quality summaries, Manager Flow Graph submission/evidence/review/revision nodes and edges, Readiness Proof Map role-negotiation/self-marketing/submission/evidence/review/revision routes, local-pilot readiness without production overclaiming, persistence snapshot integrity, and worker queue idempotency/lease/retry rows.
- The same product-team Harness now issues a manager identity session, uses `x-hofs-session-token` to read the Manager Dashboard without signed headers, verifies `securityAccessAudit` and the backend audit stream store the verified session id, revokes that token and confirms fail-closed behavior, keeps a second active security-admin session for Security Boundary proof, checks `identity_sessions` persistence/migration/adapter coverage, and scans the file store to ensure raw session tokens are never persisted.
- The product-team Harness also requires `launch-approval-workflow/v1` and `production-launch-audit/v1` in Manager Ready Package, the standalone signed API routes, and the real HTTP server routes. The completed signed API path asserts private-pilot approvals from Manager and security-admin, private-pilot audit `go`, production `no-go`, zero failed private-pilot gates, visible failed production gates, production blockers, audit-integrity checks, approval/audit routes, and next-shortest-path guidance toward production hardening; the HTTP route verifies the same contract surface without production overclaiming.
- `npm run adapters:gateway` starts mock `http-json` adapter gateways, validates the shared external adapter gateway contract, then verifies the project API dry-run routes can execute through the gateway. It should pass before wiring a real private adapter gateway, but it does not prove production cutover by itself.
- `npm run adapters:gateway-server` starts the local private adapter gateway reference process, and `npm run adapters:gateway-server:validate` verifies bearer auth, shared gateway contract compatibility, project API dry-run integration, live project API gateway preflight, storage adapter status, persisted table records, persisted queue rows, persisted leases, and receipt summaries.
- `npm run adapters:gateway-postgres-store:validate` verifies the Postgres-compatible gateway storage boundary with a query-bound shim; it proves schema/upsert execution and snapshot/count readback parity coverage but not real managed database cutover readiness.
- `npm run ui:manager-demo` builds the production bundle, serves `dist/` through a local static server, clicks `Run Manager Demo`, verifies the manager dashboard contains autonomous work, the backend worker station and state sync controls, unified event-ledger replay counts, kickoff charter, change ledger, peer handoffs, `100%` manager-readiness, then clicks and sends the manager demo action path for Google Chat change, War Room meeting change, Leader assignment, and peer handoff, verifies the resulting confirmations/syncs/assignment acknowledgement/accepted handoff, opens the evidence timeline, and writes `dist/manager-demo-ui-validation.png`.
- `npm run ui:manager-backend` builds the production bundle, starts a real Agent project backend on a dynamic local port, injects that URL into the manager dashboard, verifies `Check`, `Server Pulse`, and `Sync State` from the `Backend Worker Station`, confirms the backend store persisted the manager demo project plus backend-published chat messages, sends a real Agent-to-Agent message from a Team row, sends Google Chat and War Room change requests through the online UI, verifies backend change-ledger persistence, then walks the real initiation flow and verifies backend persistence of the new kickoff project, charter, event ledger, and first-pulse chat evidence.
- `npm run build` verifies the React/Vite app still compiles with the same runtime.
