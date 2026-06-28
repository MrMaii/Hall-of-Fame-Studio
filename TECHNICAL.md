# Hall of Fame Studio Technical Overview

> Status: pre-alpha technical design and prototype implementation notes.
>
> This document explains the technical direction behind Hall of Fame Studio. For product requirements, see `PRD.md`. For the detailed Agent runtime API and verification notes, see `src/agents/README.md` and `src/agents/ARCHITECTURE_AUDIT.md`.

## 1. System Principle

Hall of Fame Studio is designed around a simple technical thesis:

An Agent is not a passive prompt response. An Agent is an independently addressable work node with identity, memory, obligations, communication policy, work cadence, and evidence output.

In the current prototype this is implemented through the five-layer Agent model:

1. Identity: name, persona skill, capability lane, project role.
2. Mind: current goal, open obligations, confidence, attention state.
3. Relations: Leader, Reviewer, managed peers, peer dependencies.
4. Communication Policy: when to read, stay silent, respond, escalate, or ask for evidence.
5. Work Cycle: Hour Pulse, Day Report, task progress, private worklog, public group-chat update.

The Director starts or changes intent. After that, Agents should be able to coordinate through meetings, group chat, task ownership, and worker cycles without requiring the Director to manually drive every step.

### 1.1 General Product-Team System

The system is not a research-only tool, paper-writing tool, or single vertical workflow.

The target is a general AI product-team operating system. A project may be a market research brief, product strategy, technical plan, content system, brand campaign, prototype specification, or research paper. The same primitives should apply:

- clarify intent
- recruit a suitable team
- hold a kickoff meeting
- negotiate ownership
- brainstorm alternatives
- collect and evaluate evidence
- write or build artifacts
- review and revise
- submit work nodes to the manager flow graph
- preserve proof in chat, timeline, task evidence, and event ledger

Research Project is an early validation scenario because it exercises many of these primitives at once. It should test whether the general system can produce a product-quality outcome, not create a separate research-specific runtime.

## 2. Agent Subjective Agency

Each Agent should behave as an independent project participant, not as a decorative persona.

### 2.1 Existing Prototype Behavior

The prototype already supports several forms of Agent agency:

- Agents ask role-clarification questions during kickoff.
- Agents self-nominate for work lanes before Leader confirmation.
- Leader candidates present campaign-style claims before the Director confirms the Leader.
- Agents receive direct group-chat mentions into their inbox and obligations.
- Agents publish autonomous work updates through project cycles.
- Agents can send Agent-to-Agent messages through the backend route.
- Agent state is queryable through per-Agent dashboards.

Relevant implementation:

- `src/agents/agentRuntime.js`
- `src/agents/agentProjectService.js`
- `src/agents/agentProjectApi.js`
- `src/agents/agentProjectHttpServer.js`
- `src/skills/personSkillSystem.js`

### 2.2 Agent Self-Marketing

Agent self-marketing means an Agent can actively explain why it should own a role, lead a work lane, review a risk, or submit a particular artifact.

This is not advertising copy. It is an operational signal.

Examples:

- "I should own the market-sizing node because my evidence discipline fits the uncertainty."
- "I should review this decision because the plan depends on assumptions that need stress testing."
- "I am submitting a discovery memo node and asking the Reviewer to validate source quality."

In the current prototype, this appears in:

- role clarification
- self-nomination
- Leader campaign turns
- Agent worklog summaries
- management-priority reasons

Current implementation:

- `Manager Flow Graph` now emits `self-marketing` nodes for role self-nominations and Leader campaign pitches.
- Role-clarification turns are emitted as proofed kickoff conversation nodes.
- `Readiness Proof Map` exposes `roleNegotiationRoutes`, `roleNegotiationSummary`, `selfMarketingRoutes`, and `selfMarketingSummary` so API clients can inspect who pitched, who heard it, and which transcript/event proof supports it.
- Product-team acceptance validation fails if those self-marketing nodes or proof routes disappear.

## 3. Flow Graph Submission System

The flow graph should not only visualize system state. It should become the team's submission surface.

Each Agent should be able to submit work products into the graph under a typed node contract. The manager can then inspect submissions, compare them, approve them, request changes, or open a meeting around them.

### 3.1 Current Prototype Basis

The project already has several evidence streams that can support this:

- `kickoffCharter`: approved startup agreement.
- `tasks`: owned work items with assignment and evidence ids.
- `logs`: project timeline records.
- `eventLedger`: append-only event stream with sequence numbers.
- `changeLedger`: accepted project changes and owner sync.
- `agentStates`: inbox, obligations, worklog, current plan.
- `evidenceSearches`: Agent-recorded evidence/source searches with query, source quality, findings, proof ids, and task/submission links.
- `submissionReviews`: Reviewer verdict records with accepted / changes-requested state, comments, requested changes, proof ids, and task/submission links.
- `managerFlowGraph`: manager-readable graph projection.
- `managerDashboard`: aggregate manager read model.
- `readinessProofMap`: proof routes back to chat, timeline, tasks, events, and Agent dashboards.

The prototype now supports explicit Agent submissions, evidence searches, and submission reviews through backend service/API routes. Flow graph nodes can still be inferred from logs and messages, but Agent-submitted artifacts are stored as first-class `agentSubmissions` project records, evidence/source searches are stored as `evidenceSearches`, and Reviewer verdicts are stored as `submissionReviews`.

### 3.2 Proposed Submission Node Contract

A submitted node should follow a stable shape:

```json
{
  "id": "submission_project_agent_timestamp",
  "projectId": "project_id",
  "agentId": "agent_id",
  "nodeType": "agent-submission",
  "artifactType": "discovery-report",
  "title": "Market map for segment A",
  "summary": "Short manager-readable summary",
  "body": "Inline content or pointer to a workspace file",
  "workspacePath": "reports/market-map.md",
  "status": "submitted",
  "reviewStatus": "pending-review",
  "taskId": "linked_task_id",
  "dependsOn": ["node_or_task_id"],
  "revisesSubmissionId": "previous_submission_id_or_null",
  "respondsToReviewId": "submission_review_id_or_null",
  "supersedesSubmissionIds": ["superseded_submission_id"],
  "evidenceIds": ["chat_message_id", "timeline_log_id", "event_id"],
  "requestedReviewAgentId": "reviewer_agent_id",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Initial artifact types:

- `discovery-report`
- `research-report`
- `evidence-packet`
- `brainstorm-board`
- `product-brief`
- `decision-proposal`
- `risk-review`
- `implementation-plan`
- `progress-brief`
- `final-deliverable`

Initial node statuses:

- `drafting`
- `submitted`
- `under-review`
- `accepted`
- `changes-requested`
- `superseded`

Revision lineage:

- `revisesSubmissionId`: the prior submission this artifact revises.
- `respondsToReviewId`: the Reviewer verdict this artifact answers.
- `supersedesSubmissionIds`: submissions replaced by this artifact.

When a linked revision is submitted, the previous submission is marked `superseded`, the submitter's matching review obligation is resolved, Manager Flow Graph emits `revision` edges, and Readiness Proof Map exposes `revisionRoutes` / `revisionSummary`.

### 3.3 Evidence Search Contract

Evidence search is a generic product-team primitive, not a research-only feature. An Agent can record a source search, link it to a task or submission, and make it visible through group chat, timeline, event ledger, task evidence, Agent Dashboard, Manager Dashboard, Manager Flow Graph, and Readiness Proof Map.

```json
{
  "id": "evidence_search_project_agent_timestamp",
  "agentId": "agent_id",
  "query": "market / product / technical evidence question",
  "purpose": "why this search matters",
  "provider": "search provider or harness source",
  "searchMode": "agent-directed",
  "status": "completed",
  "confidence": "high",
  "taskId": "linked_task_id",
  "submissionId": "optional_submission_id",
  "evidenceJudgement": "strong-evidence",
  "qualityScore": 82,
  "qualitySummary": {
    "judgement": "strong-evidence",
    "decisionUse": "decision-ready",
    "strongSourceCount": 2
  },
  "sources": [{
    "title": "Source title",
    "kind": "runtime-proof",
    "confidence": "high",
    "qualityScore": 90,
    "qualityLevel": "strong",
    "qualitySignals": ["confidence:high", "internal-runtime-proof"]
  }],
  "findings": ["short finding"],
  "evidenceIds": ["chat_message_id", "timeline_log_id", "event_id"]
}
```

Evidence judgement is deterministic and provider-agnostic in the prototype. The service scores each source from confidence, kind, URL/source trace, summary presence, and internal runtime-proof status, then stores an aggregate `qualitySummary`. Manager Dashboard, Manager Flow Graph, Task Evidence, and Readiness Proof Map all expose this judgement so the Reviewer can distinguish decision-ready evidence from material that needs corroboration.

### 3.4 Submission Review Contract

Submission review is also a first-class project resource. A Reviewer can accept a submission or request changes. The result updates the linked submission and task, creates a review node in the flow graph, publishes a review message into group chat, and appends a ledger event.

```json
{
  "id": "submission_review_project_submission_reviewer_timestamp",
  "submissionId": "agent_submission_id",
  "reviewerAgentId": "reviewer_agent_id",
  "submitterAgentId": "submitter_agent_id",
  "verdict": "changes-requested",
  "comments": "manager-readable review note",
  "requestedChanges": ["revision request"],
  "evidenceIds": ["chat_message_id", "timeline_log_id", "event_id"]
}
```

### 3.5 Flow Graph Node Categories

The manager flow graph should distinguish:

- intent nodes: Director brief, meeting intent, change request
- self-marketing nodes: role pitch, Leader campaign, ownership proposal
- coordination nodes: assignment, handoff, blocker, queue item
- execution nodes: work pulse, artifact draft, submission
- review nodes: Reviewer challenge, evidence request, approval
- evidence nodes: evidence search, source packet, chat proof, timeline proof, workspace file, ledger event

The important principle is that the graph should answer:

- who proposed this work
- who accepted ownership
- what was submitted
- who reviewed it
- where the proof lives
- what changed after review

## 4. Working Mode

### 4.1 Continuous Autonomous Work

After kickoff approval, Agents should continue working without the Director repeatedly prompting them.

The current runtime supports this through:

- project-level autonomous cycles
- per-Agent work cycles
- due-worker scans
- scheduler status/tick/start/stop controls
- project and Agent worker ledgers

Core functions:

- `planAutonomousWorkCycle`
- `advanceAutonomousProjectCycle`
- `publishAutonomousCycleChat`
- `evaluateAutonomousSchedule`
- `runProjectAutonomousCycle`
- `evaluateAgentWorkSchedule`
- `runAgentWorkCycle`
- `runDueProjectAutonomousCycles`
- `runDueAgentWorkCycles`

### 4.2 Group Chat Coordination

Group chat is not only a visual chat surface. It is the collaboration bus.

Messages can:

- mention one Agent or all Agents
- create inbox entries
- create obligations
- trigger Leader assignments
- trigger peer handoffs
- trigger feature-change discussions
- create evidence for readiness and dashboard proof routes

Every important message should retain:

- source channel
- author
- direct targets
- receipts / heard-by evidence
- linked task or event ids
- proof route back to the exact transcript item

### 4.3 Leader, Reviewer, and Meetings

The system uses governance rather than free-for-all conversation.

Leader responsibilities:

- frame agenda
- assign owners
- track deadlines
- resolve handoffs
- decide whether a question needs Director input
- maintain execution continuity

Reviewer responsibilities:

- challenge weak evidence
- inspect risk
- request verification
- prevent decisions from becoming durable without support

Meeting protocols:

- Kickoff: role clarification, self-nomination, Leader campaign, first assignments.
- Sync: progress, blockers, deadline pressure, next delivery.
- Review: evidence, severity, fix owner, verification.
- Working Discussion: handoff, interpretation, action, request.
- Change Meeting: new intent, team discussion, owner confirmation, plan sync.

### 4.4 Queue System

There are three queue-like layers:

1. Project due queue: which projects need an autonomous cycle.
2. Agent due queue: which Agents need an independent work cycle.
3. Manager action queue: which manager-readable actions can be run or verified next.

The queue system should be observable. A manager should be able to see:

- why an Agent is due
- why an Agent was skipped
- which management-priority reasons moved an Agent forward
- which queue item produced which chat/timeline/event proof

Current local backend contract:

- `GET|POST /workers/queue-snapshot` and `GET|POST /projects/:id/worker-queue` return `worker-queue-snapshot/v1`.
- Project and Agent queue rows include stable `idempotencyKey`, `leaseKey`, due-worker route, direct recovery route, retry state, and an expected execution receipt marker.
- Completed project scheduler and Agent worker runs expose `worker-execution-receipt/v1` rows with receipt checksums, message proof ids, timeline proof ids, run status, idempotency key, and lease key.
- The snapshot includes `worker-queue-retry-policy/v1` and `worker-dead-letter-policy/v1` so local MVP validation can prove retry/dead-letter semantics before a production queue adapter exists.
- `GET /projects/:id/worker-queue-adapter-plan` returns `worker-queue-adapter-plan/v1`, the minimum production queue/cron adapter method contract for enqueue, lease acquisition, dispatch, receipt ack, retry, dead-letter, recovery, and inspection.
- `GET /projects/:id/worker-queue-adapter-dry-run` returns `worker-queue-adapter-dry-run/v1`, executing the queue cutover checks through `src/agents/workerQueueAdapter.js` by default. The adapter facade exposes `worker-queue-adapter-status/v1` from `WORKER_QUEUE_ADAPTER_DRIVER`, `WORKER_QUEUE_HTTP_ENDPOINT`, `ADAPTER_GATEWAY_HTTP_ENDPOINT`, and `WORKER_QUEUE_REQUIRE_REAL_ADAPTER`. The default `local-shadow` driver emits `worker-queue-adapter-execution-receipt/v1` rows for enqueue, lease acquisition, dispatch, execution receipt ack, retry import, dead-letter storage/recovery, queue inspection, and `worker-queue-adapter-snapshot-parity/v1`. When `WORKER_QUEUE_ADAPTER_DRIVER=http-json` and an endpoint is configured, the API async handler calls `POST /worker-queue/dry-run` on the private gateway and returns `adapterExecution.schemaVersion = worker-queue-adapter-gateway-execution/v1` with the gateway `worker-queue-adapter-execution-receipt/v1`. `managed-queue` is still a future real driver; all dry-run paths keep `productionCutoverReady` false until real queue cutover is separately approved.
- `GET /projects/:id/operations-readiness` checks that worker runs, receipts, retry state, dead-letter summary, queue adapter dry-run, managed persistence adapter dry-run, alert rules, persistence export, recovery runbook, and `operations-incident-drill/v1` rehearsal receipts are visible in Manager Ready Package.

## 5. Engineering Implementation

### 5.1 Runtime Layer

The runtime layer is deterministic and model-agnostic. It owns collaboration behavior:

- Agent network creation
- meeting frames
- communication routing
- attention scoring
- Leader assignments
- peer handoffs
- feature changes
- autonomous cycles
- event ledger generation

Main file:

- `src/agents/agentRuntime.js`

### 5.2 Service Boundary

The service layer turns runtime behavior into backend-style commands that React, tests, workers, or HTTP routes can call.

Main file:

- `src/agents/agentProjectService.js`

Important capabilities:

- create durable kickoff meeting sessions
- approve kickoff sessions into projects
- submit project chat
- submit meeting changes
- run project cycles
- run per-Agent cycles
- evaluate readiness
- build manager dashboards
- build manager flow graphs
- expose Agent dashboards

### 5.3 Storage Adapters

Current storage is prototype-grade but has a replaceable boundary.

Adapters:

- `createAgentProjectMemoryStore`: in-memory test/prototype store.
- `createAgentProjectFileStore`: JSON file-backed store for Node local backend.
- Browser `localStorage`: React prototype persistence.

Production direction:

- append-only project event table
- durable message transcript table
- task/submission table
- Agent state table
- worker queue table
- workspace artifact storage

The local backend now exposes two bridge read models before a real managed database adapter exists:

- `GET /projects/:id/persistence-adapter-plan` returns `managed-persistence-adapter-plan/v1`, including the `managed-persistence-adapter-contract/v2` method list for schema creation, transactional imports, table reads, event/audit/replay/checkpoint appends, checksum verification, RLS verification, backup/restore, shadow reads, cutover commit, and rollback.
- `GET /projects/:id/persistence-adapter-dry-run` returns `managed-persistence-adapter-dry-run/v1`, executing the cutover checks against the current snapshot and migration dry-run through `src/agents/managedPersistenceAdapter.js` by default. The adapter facade exposes `managed-persistence-adapter-status/v1` from `MANAGED_PERSISTENCE_ADAPTER_DRIVER`, `MANAGED_PERSISTENCE_DATABASE_URL`, `MANAGED_PERSISTENCE_HTTP_ENDPOINT`, `ADAPTER_GATEWAY_HTTP_ENDPOINT`, and `MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER`. The default `local-shadow` driver implements the same method names as the production-facing contract and emits `managed-persistence-adapter-execution-receipt/v1` rows for connect, schema creation, import batches, checksum verification, relation verification, RLS verification, backup creation, restore, shadow-read comparison, and rollback. When `MANAGED_PERSISTENCE_ADAPTER_DRIVER=http-json` and an endpoint is configured, the API async handler sends the current project snapshot, table plans, migration dry-run summary, adapter contract, and shadow-read plan to `POST /persistence/dry-run` on the private gateway, then returns `adapterExecution.schemaVersion = managed-persistence-adapter-gateway-execution/v1` with the gateway `managed-persistence-adapter-execution-receipt/v1`. `postgres` is still a future real driver; all dry-run paths keep `productionCutoverReady` false until real database cutover is separately approved. The dry-run verifies critical table coverage for projects, messages, events, tasks, Agent states, submissions, evidence searches, submission reviews, project membership policies, replay records, security audit rows, provider usage rows, worker runs, and read-model checkpoints; it also checks shadow-read parity, transaction rollback, backup/restore readiness, audit-stream continuity, RLS coverage, and read-model checkpoint parity.

`src/agents/adapterGatewayClient.js` defines the shared `http-json` private adapter gateway contract used by the async persistence and queue dry-run routes. A gateway must expose:

- `GET /health` returning `adapter-gateway-health/v1` with `managed-persistence-adapter-contract/v2` and `worker-queue-adapter-contract/v1` capabilities.
- `GET /state` returning `adapter-gateway-state-summary/v1` with storage adapter, persistence dry-run, table-record, queue-row, lease, and receipt summaries.
- `POST /persistence/dry-run` returning `managed-persistence-adapter-execution-receipt/v1`.
- `POST /worker-queue/dry-run` returning `worker-queue-adapter-execution-receipt/v1`.

`npm run adapters:gateway` starts local mock gateways and validates the contract shape. It also configures the service to `http-json`, creates a backend project, and proves the project API dry-run routes return gateway execution receipts. It is a deployment-prep contract test, not a substitute for a real managed database or durable queue cutover.

`src/agents/adapterGatewayStore.js` defines the storage adapter contract behind the runnable gateway. It exposes `adapter-gateway-storage-adapter-status/v1`, async-compatible `readState`, `writeState`, and `summary` methods, with current `json-file`, `memory`, and `postgres` / `postgres-compatible` drivers. `json-file` persists imported shadow table records, queue rows, queue leases, dead-letter rows, and dry-run receipt summaries to `ADAPTER_GATEWAY_STORE`; `memory` is available for ephemeral validation. The Postgres-compatible driver exposes `adapter-gateway-postgres-schema-plan/v1`, redacted `ADAPTER_GATEWAY_POSTGRES_URL` status, `ADAPTER_GATEWAY_POSTGRES_SCHEMA`, query-bound execution status, schema/upsert/snapshot write operations for project summaries, table records, queue rows, queue leases, dead letters, dry-run receipts, and state snapshots, plus `adapter-gateway-postgres-readback/v1` for snapshot checksum and table/queue count parity. It is a gateway storage boundary rehearsal until a real managed Postgres client, real database readback, backup/restore drill, RLS enforcement, monitoring, and cutover approval are added. `ADAPTER_GATEWAY_STORAGE_DRIVER` selects the driver.

`src/agents/adapterGatewayServer.js` is the runnable local private gateway reference implementation. It exposes `GET /health`, `GET /state`, `POST /persistence/dry-run`, and `POST /worker-queue/dry-run`; supports bearer auth through `ADAPTER_GATEWAY_AUTH_TOKEN`; writes through the storage adapter; and keeps `productionCutoverReady: false`. `GET /projects/:id/adapter-gateway-preflight` returns `adapter-gateway-preflight/v1`: in local-shadow mode it records that no external gateway is required for the current private-pilot rehearsal, and in `http-json` mode it calls the live gateway `GET /health` and `GET /state`, checks managed-persistence and worker-queue capabilities, exposes storage/queue state metadata without secrets, and feeds the deployment preflight gateway gate while still keeping production cutover blocked. `npm run adapters:gateway-server` starts that process, and `npm run adapters:gateway-server:validate` verifies bearer rejection, the shared client contract, project API dry-run integration, live project API gateway preflight, the storage adapter status contract, persisted table records, persisted queue rows, and persisted lease state. `npm run adapters:gateway-postgres-store:validate` binds the Postgres-compatible store to a fake query function and proves that the same private gateway and project API dry-run paths emit schema-plan, table-record, queue-row, lease, dry-run receipt, snapshot write, and readback parity operations. This process gives the project a deployable adapter boundary before the storage engine is replaced with a real managed database and durable queue.

### 5.4 API and HTTP Server

The API layer is HTTP-shaped and can be mounted behind a real backend.

Main files:

- `src/agents/agentProjectApi.js`
- `src/agents/agentProjectHttpServer.js`
- `scripts/agent-project-server.mjs`

Important route groups:

- `/llm/status`
- `/llm/test`
- `/search/status`
- `/search/test`
- `/kickoff-meetings`
- `/projects/:id/chat`
- `/projects/:id/meeting`
- `/projects/:id/autonomous-cycle`
- `/projects/:id/worker-queue`
- `/projects/:id/submissions`
- `/projects/:id/agents/:agentId/submissions`
- `/projects/:id/evidence-searches`
- `/projects/:id/agents/:agentId/evidence-searches`
- `/projects/:id/submissions/:submissionId/reviews`
- `/projects/:id/submission-reviews`
- `/projects/:id/agents/:agentId/work-cycle`
- `/workers/autonomous/due`
- `/workers/agents/due`
- `/workers/queue-snapshot`
- `/projects/:id/manager-dashboard`
- `/projects/:id/manager-flow-graph`
- `/projects/:id/readiness-proof-map`
- `/projects/:id/mvp-readiness`
- `/projects/:id/persistence-snapshot`
- `/projects/:id/persistence-migration-plan`
- `/projects/:id/persistence-migration-dry-run`
- `/projects/:id/persistence-adapter-plan`
- `/projects/:id/persistence-adapter-dry-run`
- `/projects/:id/pilot-launch-readiness`
- `/projects/:id/deployment-preflight`
- `/projects/:id/production-launch-audit`
- `/projects/:id/launch-approvals`
- `/projects/:id/project-evidence-archive`
- `/projects/:id/operations-readiness`
- `/projects/:id/provider-readiness`
- `/projects/:id/security-boundary`
- `/projects/:id/security-access-audit`
- `/projects/:id/security-audit-stream`
- `/projects/:id/transcripts`
- `/projects/:id/tasks/:taskId/evidence`

### 5.5 Local Workspace Runtime

The local runtime binds a project to a workspace folder and can expose:

- project memory folders
- workspace file list/read/write/delete
- explicitly allowed command execution
- local runtime project archive output
- backend `project-evidence-archive/v1` read model for manager-verifiable project evidence bundles

Main file:

- `src/agents/localProjectRuntime.js`

Command execution must remain disabled by default and allowlisted when enabled.

### 5.6 Model Provider Layer

The model provider is BYOK-oriented and currently optional.

Main file:

- `src/agents/modelProvider.js`
- `src/agents/searchProvider.js`
- `src/agents/secretVault.js`

Design direction:

- deterministic fallback remains available for validation
- configured model calls enrich kickoff meetings and runtime intent
- configured search calls can populate evidence-search sources through a private search gateway
- provider failures should not erase saved meetings or project state
- production deployments must manage secrets outside browser state; local pilots can use the envelope secret-vault contract, while public production still needs managed KMS/Secret Manager
- provider status endpoints must never return API keys or raw secrets

The search provider is intentionally generic. `SEARCH_PROVIDER=deterministic` supports validation without external network calls. `SEARCH_PROVIDER=http-json` can call a private BYOK search gateway that returns `sources` or `results`; the backend stores normalized source packets in `evidenceSearches`.

Evidence source normalization now also computes `evidence-source-safety/v1`: every stored source receives `sourceSafetyLevel`, `sourceSafetyScore`, `sourceSafetySignals`, prompt-injection signal counts, secret-pattern signal counts, and a `sourceSafetyJudgement`. The aggregate evidence search stores `sourceSafetySummary`, which is exposed through task evidence, Manager Dashboard, Manager Flow Graph attachments, Readiness Proof Map, persistence snapshot rows, and provider readiness. The screening is provider-agnostic and checks URL scheme, local/private hosts, credentialed URLs, sensitive query parameters, raw secret-looking content, and prompt-injection language.

`getProviderReadiness` and `GET /projects/:id/provider-readiness` expose the real-provider rollout gate as `provider-readiness/v1`. It reads the redacted model/search provider status, deterministic validation provider, provider-backed evidence-search provenance, proof routes, security-boundary redaction state, provider control policy, retry policy, circuit-breaker policy, local secret-vault seal/open/rotation status, provider usage/cost ledger, evidence source-safety summary, and production rollout controls. The service facade evaluates provider calls against `provider-control-policy/v1`: allowed providers/models, per-project hourly request limits, daily budget cents, Agent tool grants, retry attempts/backoff, and provider circuit state. Provider-backed evidence search and model runtime-intent calls write `provider-usage` events plus `project.providerUsageLedger` rows with policy decision, retry metadata, circuit-breaker metadata, outcome, cost estimate, and evidence ids. The persistence snapshot exports those rows as `provider_usage_ledger`, including retry/circuit columns, and exports source-safety fields through `evidence_searches` / `evidence_sources`. The read model may mark the local provider contract ready for an MVP pilot, but it always keeps `readyForProduction: false` until managed KMS/Secret Manager, revocation, managed provider audit storage, centralized alerting, and real-provider incident handling exist.

### 5.7 Secret Redaction Boundary

`src/agents/secretRedaction.js` provides the current prototype redaction boundary for provider status, provider errors, evidence sources, Agent submissions, workspace artifact drafts, review comments, task source refs, and event-ledger payloads.

`src/agents/secretVault.js` provides the local BYOK secret-vault contract. It uses Web Crypto AES-GCM with PBKDF2-derived envelope keys to seal/open provider secret records in local/private pilots, and can rehearse local key rotation by decrypting with the current envelope key and resealing records under a new key id. Rotation emits `secret-vault-rotation-receipt/v1` with record counts, checksums, and `plaintextExposed: false`; readiness responses never return key material or plaintext secrets. `createLocalSecretVault` and `createSecretVaultFromEnv` expose `secret-vault-status/v1` with provider, key id, readiness, encrypted record count, raw secret record count, rotation support, and latest rotation receipt metadata only. `agentProjectService` injects this status into Security Boundary and Provider Readiness, and provider status can show `apiKeySource: local-secret-vault` without exposing the key.

This is not a replacement for encrypted secret storage or scoped credentials. It is a minimum persistence guard: obvious API keys, bearer tokens, secret-bearing URL query params, and secret-looking submission text are redacted before records are written to the JSON store, workspace artifact files, group-chat proof, timeline proof, or ledger payloads.

Production deployments still need managed KMS/Secret Manager storage, real rotation/revocation workflows, access control, audit policy, and provider-specific request isolation. Until those exist, BYOK remains private-MVP-grade rather than public-production-grade.

### 5.8 Access Control Boundary

`src/agents/accessControl.js` provides a prototype access decision layer for the backend API. Local demos remain backward-compatible in `prototype-open` mode. When a request sets `x-hofs-access-mode: enforced`, the API evaluates `x-hofs-role`, `x-hofs-agent-id`, and `x-hofs-user-id` before dispatching the route. If `AGENT_ACCESS_SIGNING_SECRET` is configured, enforced requests must also include `x-hofs-signed-at` and `x-hofs-signature`; the backend verifies an HMAC-SHA256 payload covering method, route path, mode, role, Agent id, user id, timestamp, and optional request id before role policy is evaluated. If an API instance sets `requireSignedRequestIds` or the server sets `AGENT_ACCESS_REPLAY_PROTECTION=true`, signed enforced requests must include `x-hofs-request-id`, and the API rejects duplicate request ids from the same actor within the signature freshness window. The file-backed Node backend stores these accepted request ids in `accessReplayRecords`, so a reused signed request id is still rejected after a local backend restart; custom in-memory prototypes fall back to an API memory cache. If an API instance sets `failClosedOnAuditError` or the server sets `AGENT_ACCESS_AUDIT_FAIL_CLOSED=true`, enforced project access returns `503 access-audit-write-failed` instead of dispatching the route whenever the access audit sink is missing or throws. If an API instance sets `requireProjectMembership`, project-scoped enforced requests then pass through a `project-membership-policy/v1` check for manager/security/observer/runtime user ids, project Agent ids, Reviewer Agent ids, optional Agent runtime user bindings, and revoked user/Agent lists. The local backend exposes `GET|PUT /projects/:id/membership-policy`, persists the active policy plus revision audit in project state, and exports normalized `project_membership_policies` / `project_membership_grants` persistence rows.

`GET|POST /projects/:id/identity-sessions` adds the local runtime credential bridge used by the MVP Harness. `issueIdentitySession` creates an `identity-session/v1` row, returns the bearer token once, stores only `tokenHash`, checksum, role/user/Agent binding, expiry, scope, and revocation metadata in project state, then writes timeline and event-ledger proof. `x-hofs-session-token` can be supplied on project routes; `createAgentProjectApi` verifies the token hash, converts it into enforced actor headers, still runs project membership policy checks, and records the verified session id/status on `securityAccessAudit` plus the backend audit stream. `revokeIdentitySession` marks a session revoked and future requests with that token fail closed before dispatch. The persistence snapshot exports `identity_sessions` rows, migration seed order includes the table, and Security Boundary / Manager Ready Package summarize active, revoked, and expired sessions. This is still a local/private-MVP credential contract, not a production identity provider or managed service-account system.

Current enforced-mode coverage:

- Manager and security-admin project control/read routes
- Agent self-scoped dashboard/work/submission/evidence routes
- Reviewer Agent review writes with reviewer identity matching
- runtime-platform worker and queue routes
- observer read-only routes without sensitive export permission
- security-admin-only persistence snapshot export
- optional signed access-header verification for enforced-mode identity claims, including unsigned/tampered request rejection and signed HTTP scheduler worker calls
- optional signed request replay protection with `x-hofs-request-id`, file-backed local replay records, duplicate request denial across backend restart, memory fallback for custom prototypes, and signed scheduler request ids
- optional audit fail-closed behavior for enforced project routes, returning `503 access-audit-write-failed` when a required audit record cannot be persisted before dispatch
- optional project membership policy verification for project-scoped routes, including persisted policy reads/writes, signed-but-nonmember manager denial, Agent runtime binding denial, non-Reviewer review denial, revoked runtime denial, policy revision audit, and membership policy/grant persistence rows
- local identity-session verification through `x-hofs-session-token`, including one-time token return, token-hash-only persistence, Manager/security-admin issue/list/revoke routes, verified-session access audit rows, revoked-token fail-closed behavior, `identity_sessions` persistence rows, and migration seed coverage
- persisted access-decision audit rows in project state, `GET /projects/:id/security-access-audit`, `GET /projects/:id/security-audit-stream`, `security-access` event-ledger events, store-level audit-stream records with sequence/checksum and tamper-evident hash-chain proof, an append-only JSONL audit sink (`AGENT_SECURITY_AUDIT_LOG`, defaulting to `${AGENT_PROJECT_STORE}.security-audit.jsonl`), and the `security_access_audit` plus `security_audit_stream` persistence tables

This is a backend contract, not a production identity provider. The HMAC header reduces role-header spoofing in local/private deployments once a signing secret exists, file-backed replay protection reduces short-window duplicate request reuse across local backend restarts, fail-closed audit writes stop audited access from proceeding silently when the audit sink fails, the persisted project membership policy reduces project-boundary mistakes in private MVP pilots, and local identity sessions make runtime credential use auditable without storing raw tokens. Production still needs first-party user sessions, service identity issuance, rotation/revocation, durable shared replay storage for multi-instance deployments, managed project membership tables, invitation/revocation flows, database row-level authorization, centralized immutable security audit logs, alerting, and recovery playbooks.

## 6. Backend Harness and Reliability

The current Harness verifies that the architecture is not only documented.

Primary command:

```bash
npm run agents:scenario
```

It validates:

- durable kickoff meeting session create/read/clarify/approve
- Leader and Reviewer governance
- role clarification and Leader campaign transcript evidence
- group-chat assignment and acknowledgement
- Agent-to-Agent messaging
- peer handoff
- meeting and Google Chat change requests
- autonomous project cycle
- independent per-Agent worker cycle
- due-worker processing and skipping
- file-backed persistence and restart
- HTTP server request path
- scheduler status/tick/start/stop
- manager dashboard, flow graph, proof map, transcripts, task evidence, and Agent dashboard reads

Product-team acceptance command:

```bash
npm run agents:product-team
```

It uses Research Project as a validation sample for the general product-team system, then verifies the generic submission chain:

- kickoff meeting
- role clarification and Leader campaign
- evidence search record
- evidence quality judgement and source quality signals
- brainstorm-board submission
- evidence-packet submission
- product-brief submission
- formal changes-requested submission review
- risk-review submission
- revision-note submission
- revision lineage from requested-changes review to revision-note and final-deliverable
- final-deliverable submission
- formal accepted submission review
- Manager Dashboard submission, evidence-search, and review summaries
- Manager Flow Graph submission, evidence, and review nodes
- Readiness Proof Map submission, evidence-search, and review routes
- Task Evidence submission, evidence-search, and review links
- Agent Dashboard owned submissions, evidence searches, and reviews
- Group Chat transcript submission, evidence-search, and review messages
- Event Ledger `agent-submission`, `evidence-search`, and `submission-review` events
- Search provider status/test path without exposing secrets
- Secret fixture injection and persistence scanning across the file store and workspace artifact files
- Manager Dashboard / Manager Flow Graph / Readiness Proof Map revision lineage, including superseded submissions and resolved review obligations
- real HTTP backend scheduler tick for the same acceptance project, including scheduler status, project/Agent due-worker processing, Manager Dashboard operations evidence, Manager Ready Package operations evidence, and Manager Flow Graph runtime monitoring proof
- worker API response stability: `/workers/autonomous/due` and `/workers/agents/due` reuse per-project Manager Dashboard / Manager Ready Package read models inside one response, and the local HTTP server drains idle/keep-alive sockets during shutdown so validation and desktop backend restarts do not stall on retained fetch connections
- service-instance read-model caching: `agentProjectService` caches Manager Dashboard, Manager Flow Graph, Manager Ready Package, MVP/pilot/deployment/production-launch readiness, security/provider/operations readiness, persistence adapter dry-runs, and worker queue adapter dry-runs for the same project state, then clears the cache on project/message/meeting writes. This keeps heavy proof packages repeatable enough for long manager and product-team Harness runs without changing the API contracts.
- MVP readiness gate through `GET /projects/:id/mvp-readiness` and Manager Ready Package, separating local-pilot readiness from production blockers such as secret vault/RBAC, managed persistence, queue/cron infrastructure, real provider rollout, and observability/recovery
- private pilot launch package through `GET /projects/:id/pilot-launch-readiness` and Manager Ready Package, returning `pilot-launch-readiness/v1` with private-pilot go/no-go, production no-go, evidence routes, failed gates, production blockers, and a launch packet checksum aggregated from the backend readiness contracts
- deployment preflight through `GET /projects/:id/deployment-preflight` and Manager Ready Package, returning `deployment-preflight/v1` with backend store/audit sink, scheduler, access-control hardening, signed/replay/audit-fail-closed flags, secret-vault readiness, provider policy, adapter status, adapter gateway preflight, operations readiness, blocker gates, warnings, production controls, and a checksum
- production launch audit through `GET /projects/:id/production-launch-audit` and Manager Ready Package, returning `production-launch-audit/v1` with private-pilot and production decisions, private-pilot gates, production gates, audit-integrity gates, evidence routes, production blockers, next-shortest-path guidance, and a checksum while keeping production `no-go` until real managed controls exist
- project evidence archive through `GET /projects/:id/project-evidence-archive` and Manager Ready Package, returning full standalone `project-evidence-archive/v1` redacted contents plus a Manager Ready Package manifest-only snapshot with the same status, route, gates, counts, and checksums. The full archive covers manifest checksums, integrity gates, transcript channels, Agent submissions, final deliverables, evidence searches, submission reviews, revision lineage, Flow Graph nodes, Proof Map routes, timeline logs, event ledger rows, readiness summaries, persistence summary, and worker recovery summary. It is a private-pilot/customer handoff proof contract, not a production export/download system until approval, encrypted storage, retention, audit, and data residency controls exist
- launch approval workflow through `GET|POST /projects/:id/launch-approvals` and Manager Ready Package, returning `launch-approval-workflow/v1` and persisting `launch-approval/v1` records with release mode, decision, approver role/id/name, reason, linked audit checksum, and record checksum. Private pilot requires Manager plus security-admin approval; production additionally requires operations-owner. Approval records are mirrored into timeline, event ledger, Manager Flow Graph decision nodes, Readiness Proof Map `launchApprovalRoutes`, production launch audit gates, and the `launch_approvals` migration seed path
- local identity-session contract through `GET|POST /projects/:id/identity-sessions`, `POST /projects/:id/identity-sessions/:sessionId/revoke`, and `x-hofs-session-token`, proving one-time token return, token-hash-only project persistence, verified session access decisions, revoked-token fail-closed behavior, Security Boundary summary fields, Manager Ready Package route exposure, `identity_sessions` persistence rows, migration seed coverage, and absence of raw session tokens from the file store
- production persistence snapshot through `GET /projects/:id/persistence-snapshot`, exporting the current project into normalized table records, foreign-key refs, checksums, access replay rows, and integrity checks for the future managed database migration
- managed persistence migration plan through `GET /projects/:id/persistence-migration-plan`, deriving Postgres-compatible table plans, seed batches, RLS/security guidance, cutover steps, and verification gates from the current persistence snapshot
- managed persistence dry-run verification through `GET /projects/:id/persistence-migration-dry-run`, simulating the adapter import contract and checking seed coverage, row counts, checksum preservation, primary-key uniqueness, relation integrity, RLS guidance, and migration-plan gates before a real database adapter is introduced
- managed persistence adapter cutover verification through `GET /projects/:id/persistence-adapter-plan` and `GET /projects/:id/persistence-adapter-dry-run`, proving adapter method coverage, local shadow adapter execution receipts, membership/replay/audit/provider/worker/read-model table coverage, shadow-read parity, transaction rollback, backup/restore readiness, RLS coverage, audit-stream continuity, and read-model checkpoint parity before the JSON/file store is replaced
- http-json adapter gateway contract verification through `npm run adapters:gateway`, proving shared health, persistence receipt, queue receipt, and backend project API dry-run gateway execution against local mock gateways before a real private adapter gateway is deployed
- runnable private adapter gateway verification through `npm run adapters:gateway-server:validate`, proving bearer auth, shared client contract compatibility, backend project API dry-run integration, live project API gateway preflight, storage adapter status, persisted table records, persisted queue rows, persisted leases, and receipt summaries against `src/agents/adapterGatewayServer.js` / `src/agents/adapterGatewayStore.js`
- production worker queue snapshot and adapter verification through `GET|POST /workers/queue-snapshot`, `GET|POST /projects/:id/worker-queue`, `GET /projects/:id/worker-queue-adapter-plan`, and `GET /projects/:id/worker-queue-adapter-dry-run`, exporting project and Agent due rows, management priority, idempotency keys, lease keys, run routes, concurrency policy, retry/dead-letter policy, execution receipts, adapter methods, local shadow queue adapter execution receipts, `worker-queue-adapter-snapshot-parity/v1`, and lease/dispatch/ack/recovery gates for future queue/cron infrastructure
- operations readiness through `GET /projects/:id/operations-readiness`, combining worker-run observability, queue idempotency/lease checks, queue adapter dry-run status, security audit-stream ordering/hash-chain verification, persistence recovery source integrity, migration dry-run status, managed persistence adapter cutover dry-run status, proof-surface replayability, alert-rule drafts, a recovery runbook, and `operations-incident-drill/v1` rehearsal receipts into one backend read model
- provider readiness through `GET /projects/:id/provider-readiness`, proving redacted provider status, deterministic validation provider, provider-backed evidence provenance, source-safety review, proof routes, leak scanning, provider control policy, retry/circuit-breaker policy, local secret-vault seal/open/rotation status, provider usage/cost ledger rows, enforced access-policy coverage, and explicit production controls for real LLM/search rollout
- security boundary snapshot through `GET /projects/:id/security-boundary` and Manager Ready Package, exporting route policies, signed replay-protection metadata, audit fail-closed metadata, project membership policy metadata, local secret-vault metadata, audit-stream hash-chain metadata, sensitive-field coverage, provider status boundaries, redaction scan counts, and explicit auth/RBAC/secret-vault production blockers
- enforced access-control checks through `src/agents/accessControl.js`, including allowed own-Agent dashboard access, rejected cross-Agent dashboard/submission access, rejected reviewer identity mismatch, rejected observer persistence export, optional signed identity-header verification, optional signed request replay protection, optional audit fail-closed rejection, persisted project-membership policy verification with revocation, persisted security access audit rows, backend audit-stream rows with sequence/checksum/hash-chain proof, append-only JSONL audit file proof, event-ledger proof, `project_membership_policies`/`project_membership_grants`/`access_replay_records`/`security_access_audit`/`security_audit_stream` persistence export, migration-plan readiness gates, migration dry-run gates, and HTTP header propagation for the same decisions
- operations readiness checks for local operations gates, alert-rule drafts, recovery steps, `operations-incident-drill/v1` receipts, audit stream ordering/hash-chain verification, persistence recovery metrics, and migration dry-run metrics

Persona validation:

```bash
npm run skills:check
npm run skills:blend
```

Frontend validation:

```bash
npm run ui:manager-demo
npm run ui:manager-backend
npm run build
```

## 7. Current Status and Gaps

### Already covered in prototype

- persona skill registry
- deterministic Agent collaboration runtime
- durable kickoff session protocol
- Leader/Reviewer governance
- group-chat routing and receipts
- autonomous project and Agent workers
- file-backed local backend
- HTTP-shaped API
- explicit Agent submission records and artifact writing
- explicit artifact revision lineage across submissions, reviews, superseded drafts, and resolved obligations
- explicit evidence-search records and source packets
- explicit submission-review records for accepted and changes-requested verdicts
- BYOK-safe search provider status, local secret-vault seal/open/rotation validation, and deterministic provider-backed evidence search validation
- provider readiness contract for local MVP provider validation, including provider control policy, retry/circuit-breaker policy, and usage/cost ledger rows, without claiming production LLM/search rollout readiness
- prototype secret redaction for provider status/errors, submissions, evidence sources, review notes, persisted store records, and workspace artifact files
- production persistence snapshot contract for normalized records, checksums, relation checks, and event-ledger sequence validation
- managed persistence adapter dry-run contract for database cutover readiness, including local shadow adapter execution receipts, critical table coverage, shadow-read parity, rollback, backup/restore, RLS, audit-stream continuity, and read-model checkpoint gates
- production worker queue snapshot and adapter dry-run contracts for due project/Agent rows, idempotency, leases, priority ordering, retry/dead-letter policy, execution receipts, queue adapter execution receipts, adapter methods, dispatch coverage, snapshot parity, and recovery routes
- operations readiness contract for local observability/recovery gates, alert-rule drafts, managed persistence adapter metrics, queue adapter dry-run metrics, worker receipt/dead-letter metrics, audit/persistence/migration metrics, a recovery runbook, and checksummed incident drill receipts
- security boundary snapshot contract for route policy coverage, sensitive-field coverage, local secret-vault status, audit-stream hash-chain status, redaction scan status, provider secret exposure status, and security production blockers
- project evidence archive contract for redacted manager/customer handoff bundles with manifest checksums across transcripts, submissions, final deliverables, evidence, reviews, revision lineage, Flow Graph, Proof Map, timeline, event ledger, readiness, persistence, and worker recovery evidence
- prototype enforced access-control contract for role capabilities, Agent self-scope, Reviewer identity matching, runtime worker identity, sensitive export denial, and access-decision audit replay
- manager dashboard and flow graph projections
- event ledger and proof-map surfaces
- Harness coverage for the manager scenario and product-team acceptance sample

### Still needed for product-grade implementation

- richer flow graph editing, filtering, and version comparison
- richer submission review UI controls and multi-round versioning
- production queue/cron infrastructure with durable leases, managed dead-letter storage, replay tooling, and recovery drills
- database-backed persistence with implemented managed adapter, real shadow-read comparison, backup/restore drills, rollback drills, and database RLS enforcement
- production identity provider, signed runtime identities, project membership storage, database row-level permissions, and workspace permissions
- managed BYOK secret isolation, KMS-backed encrypted secret storage, rotation, revocation, and access audit
- stronger security review for redaction bypasses, prompt injection, cross-Agent data contamination, and provider-specific secret handling
- real external search gateway adapters, source-quality scoring, and source-safety screening
- LLM retry, validation, and cost controls
- long-running observability and recovery
- production-grade export/download service for project archives, including approval workflow, encrypted object storage, retention policy, download audit, watermarking, and data residency controls

## 8. Design Rule

Every new Agent capability should answer three questions:

1. What intent or obligation caused this action?
2. What artifact or decision did the Agent produce?
3. Where can the manager verify the proof?

If the answer cannot be represented in chat, timeline, event ledger, task evidence, Agent dashboard, or flow graph, the feature is not yet operationally complete.
