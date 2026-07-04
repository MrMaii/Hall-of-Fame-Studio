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
npm run skills:blend
npm run agents:scenario
npm run agents:server:validate
npm run agents:local-mvp-startup-readiness
npm run agents:public-production-startup-readiness
npm run agents:managed-infrastructure-cutover-attestations
npm run agents:settings-health-readiness
npm run agents:settings-runtime-readiness
npm run agents:model-provider-adapter
npm run agents:settings-provider-readiness
npm run agents:settings-integration-readiness
npm run agents:evidence-index-readiness
npm run agents:budget-alert-readiness
npm run agents:error-reporting-readiness
npm run agents:search-provider:vault-endpoint
npm run agents:project-settings:privacy
npm run agents:project-settings:provider-budget
npm run agents:project-settings:tool-grants
npm run agents:project-settings:integrations
npm run agents:project-settings:workspace
npm run agents:product-team:smoke
npm run agents:transcript-search
npm run agents:transcript-channel-pin
npm run agents:transcript-pin
npm run agents:transcript-reply
npm run agents:transcript-mention
npm run agents:transcript-attachment
npm run agents:transcript-member-presence
npm run agents:real-user-zero-to-autonomy
npm run agents:product-team:core
npm run agents:product-team:research-sample
npm run agents:product-team:cycle-consistency
npm run ui:manager-backend:core
npm run ui:manager-backend:real-user-chain
npm run ui:manager-backend:proof-navigation
npm run ui:manager-backend:private-pilot-panels
npm run ui:manager-backend:production-controls
npm run ui:manager-provider-proof
npm run ui:settings-agents-server
npm run ui:manager-mission-runner
npm run ui:real-user-zero-to-autonomy
npm run launch:local-mvp:check
```

Required product evidence:

- Kickoff meeting, role clarification, self-marketing, Leader/Reviewer governance.
- Brainstorm Layer through generic `brainstorm-board` submissions.
- Search/Evidence Layer with provider receipt, source snapshots, source quality, and source safety.
- Agent submissions for `discovery-report`, `brainstorm-board`, `evidence-packet`, `product-brief`, `decision-proposal`, `risk-review`, `revision-note`, `implementation-plan`, and `final-deliverable`.
- Reviewer requested-changes review, linked revision response, accepted final deliverable.
- Planner / Executor / Reviewer state machine through `planner-executor-reviewer-state-machine/v1`, proving role lanes and handoff transitions from backend proof.
- Manager Dashboard, Manager Flow Graph, Readiness Proof Map, Agent Dashboard, transcript, timeline, and event-ledger proof.
- Backend Group Chat transcript search through `GET /projects/:id/transcripts/search`, so Manager search results come from backend transcript/proof messages instead of a disabled UI placeholder or browser-local chat history.
- Backend Group Chat channel pins through `POST /projects/:id/transcripts/:channelId/channel-pin`, so a Manager channel pin creates `transcript-channel-pin/v1` receipt, channel system message, timeline/event proof, Flow Graph node, and Readiness Proof Map route instead of a disabled header placeholder.
- Backend Group Chat message pins through `POST /projects/:id/transcripts/:channelId/pins`, so a Manager pin creates `transcript-pin/v1` receipt, chat system message, timeline/event proof, Flow Graph node, and Readiness Proof Map route instead of a disabled per-message placeholder.
- Backend Group Chat replies through `POST /projects/:id/transcripts/:channelId/replies`, so a Manager reply creates `transcript-reply/v1` receipt, reply transcript message, direct-target receipt proof, timeline/event proof, Flow Graph node, and Readiness Proof Map route instead of a disabled per-message placeholder.
- Backend Group Chat mentions through `POST /projects/:id/transcripts/:channelId/mentions`, so a Manager @mention creates `transcript-mention/v1` receipt, mention transcript message, target Agent inbox proof, timeline/event proof, Flow Graph node, and Readiness Proof Map route instead of a disabled per-message placeholder.
- Backend Group Chat attachments through `POST /projects/:id/transcripts/:channelId/attachments`, so a Manager file attach creates `transcript-attachment/v1` receipt, file transcript message, content checksum proof, timeline/event proof, Flow Graph node, and Readiness Proof Map route instead of a disabled attachment placeholder.
- Backend Group Chat member presence through `GET /projects/:id/transcripts/:channelId/members`, so the member control reads `transcript-member-presence/v1` from backend receipts and exposes Proof Map / Flow Graph coverage instead of a disabled header placeholder.
- Backend scheduler and Agent worker proof, including autonomous strategy, queued Agent action evidence, and the Product Team Operating Loop summary for C/A continuation.
- Runtime Autonomy Status through `GET /projects/:id/runtime-autonomy-status`, so C-side startup, A-side Autopilot/session receipts, worker queue recovery, queue adapter rehearsal, persistence snapshot, Flow Graph, Proof Map, Ready Package, and scheduler recovery routes are visible as one backend contract while unattended public production stays blocked.
- Local MVP startup readiness through `local-mvp-startup-readiness/v1` at `GET /local-mvp-startup-readiness`: it aggregates backend reachability, Secret Vault readiness, model/search runtime status, provider-vault redaction, project catalog readability, next action, and validation commands before the UI claims a user can start a local MVP session. It must appear in Manager Ready Package as `localMvpStartupReadiness` and in Readiness Proof Map as `localMvpStartupReadinessRoutes`. It may mark Settings/provider setup ready, but public production remains blocked by managed secrets, persistence, queue, provider audit, and incident controls.
- Public production startup readiness through `public-production-startup-readiness/v1` at `GET /public-production-startup-readiness`: it is a global backend-only launch preflight for public traffic. It checks enforced access control, signed requests, replay protection, audit fail-closed mode, managed Secret Manager/KMS, managed persistence cutover, managed worker queue cutover, provider runtime/redaction, adapter gateway attestation, centralized observability, alert routing, on-call ownership, managed incident system, restore drill proof, and centralized audit retention. Settings runtime readiness, Manager Ready Package, Readiness Proof Map, Manager UI, and the project-level Production Launch Control Center must link this route, and it must keep `readyForPublicProduction=false` until those managed production controls exist.
- Settings health readiness through `settings-health-readiness/v1` at `GET /settings/health-readiness`: Quick Check must read a backend-owned health contract instead of synthesizing rows in the browser. The contract lists backend API, startup readiness, Secret Vault, model/search provider status, explicit test routes, worker status route, project catalog, validation commands, and production blockers without issuing provider calls or creating probe projects. It must appear in Manager Ready Package as `settingsHealthReadiness` and in Readiness Proof Map as `settingsHealthReadinessRoutes`.
- Settings runtime readiness through `settings-runtime-readiness/v1` at `GET /settings/runtime-readiness` and `GET /projects/:id/settings-runtime-readiness`: Deployment and Models must read backend-owned runtime rows for model/search runtime, provider-vault binding proof, worker status route, local persistence adapter, worker queue adapter, deployment preflight linkage, validation commands, and production blockers instead of inferring deployment/model readiness in the browser. It must appear in Manager Ready Package as `settingsRuntimeReadiness` and in Readiness Proof Map as `settingsRuntimeReadinessRoutes`.
- Manager Use Case Audit proof through `GET /projects/:id/manager-use-case-audit` and Readiness Proof Map `managerUseCaseAuditRoutes`, so customer-story coverage is route-backed rather than inferred from frontend fallback rows.
- MVP readiness operator actions through `GET /projects/:id/mvp-readiness` and `POST /projects/:id/mvp-readiness/operator-actions/:actionId/run`, so the Manager sees and records the routed next step for core closure, private-pilot handoff, or production hardening. Runnable core closure receipts must hand an `autopilot-delivery-target-control/v1` target to Collaboration Intent Queue and Autonomous Run Control, and running the target must create the requested Agent submission, evidence, or review proof node across the generic product-team chain. Production-hardening receipts must stay non-autonomous and must not treat local MVP proof or an operator receipt as production readiness.
- Product Team Mission Runner through `POST /product-team-missions` and `GET /projects/:id/product-team-missions`, so a customer goal can become a real backend project with kickoff approval, Leader/Reviewer decisions, bounded Autopilot startup, optional first A-side tick, and `product-team-mission-run/v1` proof in Manager Dashboard, Flow Graph, Readiness Proof Map, Delivery Trace, Operating Loop, Collaboration Intent Queue, Runtime Autonomy Status, and Autonomous Run Control. The Manager-facing React initiation approval must use this route and, when a kickoff meeting already exists, the mission receipt must prove it reused that meeting instead of creating a disconnected project start. This gate proves local/private-MVP mission startup only; production autonomy still requires the P2 controls below.
- Project privacy policy writes are receipt-backed through `project-settings/v1`: retention mode, provider log mode, model-training policy, and evidence-export approval policy must persist in the backend store with project settings audit, timeline, and event-ledger proof while `readyForProduction` remains false until managed security and operations controls exist.
- Project provider budget policy writes are receipt-backed through `project-settings/v1`: daily provider budget and hourly request limits must persist in the backend store, appear in provider settings audit/timeline/event proof, and feed `provider-readiness/v1` plus `provider-controlled-run/v1` budget/headroom calculations while production alerting and centralized cost controls remain P2 blockers.
- Project tool grant policy writes are receipt-backed through `project-settings/v1`: Agent provider-test, model kickoff/intent/artifact-draft, and search-evidence grants must persist in the backend store, appear in settings audit/timeline/event proof, and feed `provider-readiness/v1` plus `provider-controlled-run/v1` Agent tool decisions while production task-scoped authorization and managed runtime identity remain P2 blockers.
- Project integration capability rows are receipt-backed through `project-settings/v1`: `project-integration-capabilities/v1` must mark provider budget and Agent tool grants as backend-backed editable controls, and must mark Vector Store, Proxy/Webhook, MCP Tools, Budget Alerts, and Error Reporting as backend-backed read-only route contracts rather than missing backend APIs. Those read-only rows must point to Evidence Index readiness, Adapter Gateway preflight, Provider Readiness, Budget Alert readiness, and Error Reporting readiness, remain `editable=false`, and keep production readiness blocked until managed adapter, registry, alerting, observability, and operations controls exist.
- Settings integration readiness is backend-owned through `settings-integration-readiness/v1` at `GET /projects/:id/settings-integration-readiness`: Integrations must read one project-scoped contract that aggregates provider budget, Agent tool grants, Proxy/Webhook, MCP Tools, Vector Store, Budget Alerts, and Error Reporting rows with current status, route, schema, checksum, action-required counts, validation commands, and production blockers. It must appear in Manager Ready Package as `settingsIntegrationReadiness` and in Readiness Proof Map as `settingsIntegrationReadinessRoutes`, so the UI cannot present route rows as if they were finished production integrations.
- Project workspace capability rows are receipt-backed through `project-settings/v1`: `project-workspace-policy/v1` persists interface density, default visibility, and autosave cadence, while `project-workspace-capabilities/v1` must mark global interface language as browser-local; project language, interface density, default visibility, autosave cadence, runtime contract rules, long-term memory readiness, and meeting summaries as backend-backed. Runtime contract rules must point to `GET /projects/:id/runtime-contracts`, expose `runtime-contract-freeze/v1`, remain non-editable from Settings, and keep production runtime approval blocked. Long-term memory must point to `GET /projects/:id/memory-readiness`, expose `project-memory-readiness/v1`, remain non-editable, enter Manager Ready Package as `projectMemoryReadiness`, enter Readiness Proof Map as `projectMemoryReadinessRoutes`, and prove local transcript/meeting/evidence/artifact/persistence-plan memory readiness without claiming managed long-term memory production readiness. `meeting-summaries/v1` must be derived from backend transcript, timeline, and event-ledger proof and must keep production readiness blocked until summary provenance, transcript retention, and human review policy exist.
- Settings Proxy/Webhook exposes backend Adapter Gateway preflight instead of a fake editable control: the Settings row must point to `GET /projects/:id/adapter-gateway-preflight`, which returns `adapter-gateway-preflight/v1` and keeps production adapter cutover blocked until private gateway delivery, signatures, retries, and dead-letter storage exist.
- Settings MCP Tools exposes backend Provider Readiness instead of a fake editable control: the Settings row must point to `GET /projects/:id/provider-readiness`, keeping MCP/tool adapters under provider policy, Agent tool grants, and runtime identity until a managed tool registry exists.
- Settings Vector Store exposes backend Evidence Index readiness instead of a fake editable control: `GET /projects/:id/evidence-index-readiness` must return `evidence-index-readiness/v1`, index local evidence searches, source snapshots, provider receipts, Agent submissions, and artifact storage proofs, and keep managed vector memory as a production blocker.
- Settings Budget Alerts exposes backend Budget Alert readiness instead of a fake editable control: `GET /projects/:id/budget-alert-readiness` must return `budget-alert-readiness/v1`, compute local daily budget and hourly request headroom from the project provider budget policy plus provider usage ledger, enter Manager Ready Package as `budgetAlertReadiness`, enter Readiness Proof Map as `budgetAlertReadinessRoutes`, and keep centralized alert routing/on-call ownership as production blockers.
- Settings Error Reporting exposes backend Error Reporting readiness instead of a fake editable control: `GET /projects/:id/error-reporting-readiness` must return `error-reporting-readiness/v1`, surface local log streams, alert rules, recovery runbook, incident-drill status, and error-signal counts from Operations Readiness, appear in Manager Ready Package as `errorReportingReadiness`, appear in Readiness Proof Map as `errorReportingReadinessRoutes`, and keep centralized logs/traces/incident ownership as production blockers.
- Settings provider/runtime sync must prefer project-scoped readiness when a project is active: `/projects/:id/settings-provider-readiness`, `/projects/:id/settings-runtime-readiness`, and `/projects/:id/provider-vault-bindings` should drive the visible BYOK/Vault state before falling back to global Settings routes.
- Settings provider readiness is backend-owned through `settings-provider-readiness/v1`: `/settings/provider-readiness` and `/projects/:id/settings-provider-readiness` must explain whether API fields can be typed, whether `Seal` can run, what backend action is required, and which Vault/provider routes prove it. It must appear in Manager Ready Package as `settingsProviderReadiness` and in Readiness Proof Map as `settingsProviderReadinessRoutes`. The browser must not infer or persist provider secrets as local settings.
- Real-user agents:server API zero-to-autonomy proof on the real local backend: without launching a browser or running a build, the same validation must start `scripts/agent-project-server.mjs`, seal model key plus search endpoint/key through `/secret-vault/seal`, prove `/search/test`, create a product-team mission through `POST /product-team-missions`, record provider-backed Agent evidence, submit all required generic artifact types from discovery through final deliverable, request changes, submit linked revision, accept final deliverable, verify Artifact Quality Audit coverage, and verify Manager Flow Graph, Readiness Proof Map, Product Team Delivery Trace, Group Chat transcript, Agent Dashboard, Evidence Index, timeline, and event ledger traceability.
- Real-user Settings provider seal plus zero-to-autonomy browser proof on the real local backend: the same session must save model key plus search endpoint/key through backend Vault receipts, prove search can return evidence, approve kickoff, run the C/A handoff, expose an Agent submission node plus all required generic artifact nodes from discovery through final deliverable, verify Artifact Quality Audit coverage, and show those backend submissions in the Manager UI with Flow Graph, Proof Map, Product Team Delivery Trace, transcript, timeline, and event-ledger traceability.

`npm run agents:product-team:smoke` is the low-write core-chain smoke gate. It uses the in-memory backend API, does not launch a browser/server, and does not write workspace artifact files. It verifies the generic kickoff, canonical persona registry access, persona/professional skill-blend self-marketing, Leader/Reviewer selection, backend meeting turns, evidence search, all required generic artifact types (`discovery-report`, `brainstorm-board`, `evidence-packet`, `product-brief`, `decision-proposal`, `risk-review`, `revision-note`, `implementation-plan`, `final-deliverable`), requested-changes review, linked revision-note, accepted final-deliverable, Planner / Executor / Reviewer state machine, Manager Ready Package embedding, Manager Flow Graph, Readiness Proof Map, Brainstorm Layer, Artifact Quality Audit, Submission Review Workflow, Product Team Delivery Trace, transcript, timeline, event ledger, Agent Dashboard, and Evidence Index readiness. Use it before the heavier `agents:product-team:core` gate when disk write volume matters; it does not replace the full file-backed, HTTP, or browser gates.

`npm run agents:transcript-search` is the low-write Group Chat transcript search gate. It uses the in-memory backend API to create a generic product-team mission, calls `GET /projects/:id/transcripts/search?query=...&channelId=main`, verifies `transcript-search/v1` result routes and proof ids, and confirms empty searches stay empty instead of synthesizing browser matches. It does not launch a browser/server or write workspace artifact files.

`npm run agents:transcript-channel-pin` is the low-write Group Chat channel pin gate. It uses the in-memory backend API to create a generic product-team mission, pins the main channel through `POST /projects/:id/transcripts/main/channel-pin`, verifies `transcript-channel-pin/v1`, channel pin message proof, channel `channelPins`, Readiness Proof Map routes, and Manager Flow Graph channel pin nodes without launching a browser/server or writing workspace artifact files.

`npm run agents:transcript-pin` is the low-write Group Chat transcript pin gate. It uses the in-memory backend API to create a generic product-team mission, pins a real backend transcript message through `POST /projects/:id/transcripts/main/pins`, verifies `transcript-pin/v1`, timeline/event proof, channel `pinnedMessages`, Readiness Proof Map routes, and Manager Flow Graph pin nodes without launching a browser/server or writing workspace artifact files.

`npm run agents:transcript-reply` is the low-write Group Chat transcript reply gate. It uses the in-memory backend API to create a generic product-team mission, replies to a real backend transcript message through `POST /projects/:id/transcripts/main/replies`, verifies `transcript-reply/v1`, appended reply message proof, channel `replies`, Readiness Proof Map routes, and Manager Flow Graph reply nodes without launching a browser/server or writing workspace artifact files.

`npm run agents:transcript-mention` is the low-write Group Chat transcript mention gate. It uses the in-memory backend API to create a generic product-team mission, mentions a target Agent from a real backend transcript message through `POST /projects/:id/transcripts/main/mentions`, verifies `transcript-mention/v1`, appended mention message proof, target Agent inbox delivery, channel `mentions`, Readiness Proof Map routes, and Manager Flow Graph mention nodes without launching a browser/server or writing workspace artifact files.

`npm run agents:transcript-attachment` is the low-write Group Chat transcript attachment gate. It uses the in-memory backend API to create a generic product-team mission, attaches a validation file through `POST /projects/:id/transcripts/main/attachments`, verifies `transcript-attachment/v1`, content checksum proof, appended file message, channel `attachments`, Readiness Proof Map routes, and Manager Flow Graph attachment nodes without launching a browser/server or writing workspace artifact files.

`npm run agents:transcript-member-presence` is the low-write Group Chat member presence gate. It uses the in-memory backend API to create a generic product-team mission, reads `GET /projects/:id/transcripts/main/members`, verifies `transcript-member-presence/v1`, Agent receipt/authored counts, Readiness Proof Map routes, Manager Flow Graph presence nodes, and React source replacement without launching a browser/server or writing workspace artifact files.

`npm run agents:real-user-zero-to-autonomy` is the low-write real-backend zero-to-autonomy gate. It starts the real `agents:server` process with Secret Vault plus local mock model/search endpoints, seals model key plus search endpoint/key through `/secret-vault/seal`, proves `/search/test`, then drives the generic product-team mission, provider-backed Agent evidence, all required generic artifact types (`discovery-report`, `brainstorm-board`, `evidence-packet`, `product-brief`, `decision-proposal`, `risk-review`, `revision-note`, `implementation-plan`, `final-deliverable`), requested-change review, linked revision-note, accepted final-deliverable, Artifact Quality Audit, Flow Graph, Proof Map, Product Team Delivery Trace, Group Chat transcript, timeline, event ledger, Agent Dashboard, and Evidence Index readiness through HTTP API calls. Use it before the browser `ui:real-user-zero-to-autonomy` gate when disk write volume matters; it does not replace the full browser proof.

`npm run agents:product-team:research-sample` is the fastest explicit Research Project validation-sample gate. It runs the same generic product-team backend and HTTP delivery trace plus Product Team Operating Loop, a three-step autonomous loop, and Runtime Autonomy Status, then asserts that the proven stages are kickoff, self-marketing, brainstorm, evidence, draft, review/revision, final deliverable, proof surfaces, Manager continuation, Agent strategy, runtime recovery, and production blockers rather than paper/thesis/manuscript-specific protocol fields.

Product-team acceptance stages write isolated temporary stores under `.tmp/product-team-acceptance/<stage>-<pid>` while they run, then clean the run directory by default, including normal interruption signals. Use `HOFS_PRODUCT_TEAM_PRESERVE_TMP=1` only for debugging a failed stage; the normal P0/P1 gates should not leave large acceptance stores behind.

The stage runner defaults to quiet output for low-write validation, including UI harnesses that prepare product-team acceptance stores before opening the browser. Set `HOFS_PROGRESS=1` only when debugging a long-running acceptance stage and needing per-step progress on stderr.

P2 adapter gateway rehearsals clean their gateway/project temp stores by default, including normal interruption signals. Use `HOFS_ADAPTER_GATEWAY_PRESERVE_TMP=1` only when debugging a failed adapter gateway rehearsal.

`npm run agents:product-team:cycle-consistency` is the focused P0 autonomy consistency gate. It continues past the Research sample into signed membership access, runs a bounded three-step autonomous loop, and verifies `autonomous-cycle-consistency/v1`, Manager Flow Graph, Readiness Proof Map, Manager Ready Package, and persisted loop/run receipts without running the full P1/P2 launch-hardening receipt chain.

`npm run ui:manager-provider-proof` is the focused C-side proof gate for provider-backed autonomous evidence. It starts a real local backend with deterministic provider search, advances bounded Autopilot through the scheduler, verifies the provider evidence receipt, opens the Manager Flow Graph node, and clicks back into the backend Group Chat transcript proof.

`npm run ui:settings-agents-server` is the focused Settings gate for the real local backend process. It builds the React UI, starts `npm run agents:server` with Secret Vault env on an ephemeral port, opens the Settings Keys tab in a browser, seals model key plus search endpoint/key through `/secret-vault/seal`, verifies `/secret-vault/records` exposes only encrypted metadata, checks the model provider becomes runtime-enabled, and proves `/search/test` can call a user-configured local search gateway. This catches the customer-facing failure mode where the UI has provider fields but the documented backend startup path cannot accept them or cannot move the runtime into a callable state.

`npm run ui:settings-agents-server:dev` runs the same Settings browser proof against an already running Vite dev server at `http://127.0.0.1:5173` through `--ui-base-url`. Use it while replacing Settings mocks because it skips `vite build`; it does not replace the built `ui:settings-agents-server` launch gate.

`npm run ui:manager-mission-runner` is the focused C/A startup gate for real project creation. It drives the browser through kickoff meeting, Manager clarification, Leader and next-action decisions, then approves through `POST /product-team-missions` and verifies the reused-kickoff Mission Runner receipt, Autopilot tick, chat proof, timeline proof, and Manager Flow Graph mission node. Use it when changing initiation approval, Mission Runner receipts, proof exits, or frontend mock replacement around project startup.

`npm run ui:real-user-zero-to-autonomy` is the stronger investor/customer-facing browser gate. It starts the real `agents:server` process with Secret Vault plus local mock model/search endpoints, opens the built React app, seals model key plus search endpoint/key in Settings, proves the search provider returns evidence, then starts from Workspace Hub, holds the kickoff meeting, approves the project, runs the C/A handoff intent from the Manager UI, records provider-backed Agent evidence through the same configured endpoint, creates all required generic artifact types (`discovery-report`, `brainstorm-board`, `evidence-packet`, `product-brief`, `decision-proposal`, `risk-review`, `revision-note`, `implementation-plan`, `final-deliverable`), records requested-change and final-acceptance reviews, and verifies those backend-created nodes are traceable and visible through Manager UI submissions, Artifact Quality Audit, Manager Flow Graph, Readiness Proof Map, Project Memory Readiness, Product Team Delivery Trace, Group Chat transcript, timeline, and event ledger without relying on frontend mock state.

`npm run ui:real-user-zero-to-autonomy:dev` runs the same browser script against an already running Vite dev server at `http://127.0.0.1:5173` through `--ui-base-url`. Use it as a lower-write preflight while replacing mocks because it skips `vite build`; it does not replace the built `ui:real-user-zero-to-autonomy` launch gate.

`npm run agents:server` is the local backend process used by the React UI for real backend-online work. For Settings provider entry, it must be started with `SECRET_VAULT_ENABLED=true` and `SECRET_VAULT_KEY` so `/secret-vault/status` reports ready and the Settings Keys tab can seal model/search secrets through `/secret-vault/seal`. `npm run agents:server:validate` proves the model-key startup path by launching the server on an ephemeral port, sealing a test key, checking safe record metadata, verifying runtime provider binding, restarting against the encrypted records file, verifying provider rehydration, and deleting its temporary store.

`npm run agents:local-mvp-startup-readiness` is the low-write backend startup contract gate. It reads `GET /local-mvp-startup-readiness` with and without a Secret Vault, verifies the response moves from `backend-vault-required` to `provider-setup-required`, confirms the route links `/settings/provider-readiness`, `/secret-vault/status`, `/secret-vault/seal`, `/llm/status`, `/search/status`, `/projects`, and `/product-team-missions`, confirms Manager Ready Package and Readiness Proof Map include startup readiness, and checks startup readiness never exposes plaintext provider secrets or public-production readiness.

`npm run agents:public-production-startup-readiness` is the low-write public production startup contract gate. It reads `GET /public-production-startup-readiness`, verifies the response exposes `public-production-startup-readiness/v1`, confirms current local/private-MVP infrastructure remains blocked for public production, checks concrete blocker gates for access control, managed secrets, persistence, queue, observability, incident response, restore drill, and audit retention, verifies Settings runtime, Manager Ready Package, Production Launch Control Center, Readiness Proof Map, and Manager UI link the route, and checks plaintext provider secrets are never exposed.

`npm run agents:managed-infrastructure-cutover-attestations` is the low-write backend bridge gate for real managed infrastructure evidence. It verifies `POST /projects/:id/managed-infrastructure-cutover-attestations` returns `managed-infrastructure-cutover-attestation-run/v1`, fails closed without a configured adapter gateway, refuses to write receipt evidence before the gateway has query-bound readback parity plus project dry-run receipt evidence, then uses the private adapter gateway to issue signed managed-production attestations for `managed-persistence-cutover` and `managed-worker-queue-cutover`. The route writes those attestations into `production-operations-control-receipt/v1`, projects them into `production-infrastructure-rehearsal/v1`, and lets `production-evidence-integrity-audit/v1` classify those two controls as managed-production evidence while keeping broader public production blocked.

`npm run agents:settings-health-readiness` is the low-write Settings health contract gate. It reads `GET /settings/health-readiness` with and without a Secret Vault, verifies Quick Check rows come from the backend contract, confirms Manager Ready Package and Readiness Proof Map include Settings health readiness, checks provider setup remains action-required until keys are sealed, and confirms plaintext provider secrets and public-production readiness are never exposed.

`npm run agents:settings-runtime-readiness` is the low-write Settings runtime contract gate. It reads `GET /settings/runtime-readiness` and `GET /projects/:id/settings-runtime-readiness` with and without a Secret Vault, verifies Deployment/Models rows come from the backend contract, checks provider-vault metadata remains redacted after sealing a model key, verifies persistence/worker queue adapter and deployment-preflight route linkage, confirms Manager Ready Package / Readiness Proof Map inclusion, and confirms public-production readiness is never exposed.

`npm run agents:model-provider-adapter` is the low-write model-provider adapter contract gate. It verifies `model-provider-adapter-manifest/v1`, confirms the local backend can select OpenAI-compatible, OpenAI, Anthropic, and Gemini adapter styles through the shared `createModelProvider` boundary, proves OpenAI-compatible chat-completion request/response mapping with a local fake fetch, checks missing-key calls fail closed without network access, and verifies provider status never exposes plaintext keys.

`npm run agents:settings-provider-readiness` is the low-write Settings provider readiness contract gate. It calls `/settings/provider-readiness` with and without a local Secret Vault, verifies the backend tells the UI when API fields are editable but Seal persistence is blocked by missing Vault readiness, verifies project-scoped `/projects/:id/settings-provider-readiness`, confirms Manager Ready Package / Readiness Proof Map inclusion, and checks the response never exposes plaintext provider secrets.

`npm run agents:settings-integration-readiness` is the low-write Settings integration readiness gate. It calls `/projects/:id/settings-integration-readiness`, verifies `settings-integration-readiness/v1` aggregates provider budget, Agent tool grants, Adapter Gateway preflight, Provider Readiness, Evidence Index readiness, Budget Alert readiness, and Error Reporting readiness, confirms Manager Ready Package and Readiness Proof Map inclusion, checks the project settings capability route points to the aggregate, and confirms public-production readiness is never exposed.

`npm run agents:evidence-index-readiness` is the low-write Evidence Index readiness gate. It starts with an empty backend project, verifies the index is not ready, records one Agent evidence search plus one Agent artifact submission, then verifies `/projects/:id/evidence-index-readiness` becomes locally ready, links evidence/search/submission routes, redacts source URL tokens, and still keeps managed vector storage production-blocked.

`npm run agents:budget-alert-readiness` is the low-write Budget Alert readiness gate. It creates a backend project, writes `project-provider-budget-policy/v1`, verifies `/projects/:id/budget-alert-readiness` returns `budget-alert-readiness/v1`, confirms daily budget and hourly request headroom are computable from backend state, confirms the Settings capability row points to the route, confirms Manager Ready Package and Readiness Proof Map expose the same budget alert proof, and keeps production alert routing blocked.

`npm run agents:error-reporting-readiness` is the low-write Error Reporting readiness gate. It creates a backend project, verifies `/projects/:id/error-reporting-readiness` returns `error-reporting-readiness/v1`, confirms local log streams, alert rules, recovery runbook, and incident-drill status are route-backed from Operations Readiness, confirms Manager Ready Package and Readiness Proof Map include the same readiness route, confirms the Settings capability row points to the route, and keeps centralized production observability blocked.

`npm run agents:search-provider:vault-endpoint` is the focused search-provider configuration gate. It starts the real local backend with no search endpoint in env, starts a local mock search gateway, seals `search.endpoint` and `search.apiKey` through `/secret-vault/seal`, proves `/search/status` becomes `http-json` and vault-backed, calls `/search/test`, verifies the mock gateway received the sealed key, restarts the backend against the encrypted Vault records, and confirms endpoint/key rehydration. This is the minimum proof that Settings can turn search from "saved but unusable" into a real provider boundary.

`npm run agents:project-settings:privacy` is the focused Settings privacy gate. It creates a backend project, writes language through `project-settings/v1`, then writes a privacy-only policy update and verifies language preservation, privacy policy persistence, project settings audit, timeline proof, event-ledger proof, and file-backed store persistence. It is local MVP evidence only; production privacy still requires the P2 security, operations, provider, and evidence-export controls.

`npm run agents:project-settings:provider-budget` is the focused Settings budget gate. It writes `project-provider-budget-policy/v1` through `project-settings/v1`, verifies project settings audit/timeline/event/file-store proof, then reads Provider Readiness and Provider Controlled Run to prove the daily budget and hourly request limit are consumed by the backend provider policy surfaces. It is local MVP budget enforcement evidence only; production cost alerting, provider incident controls, and managed usage audit remain P2 blockers.

`npm run agents:project-settings:tool-grants` is the focused Settings tool-grant gate. It writes `project-tool-grant-policy/v1` through `project-settings/v1`, verifies project settings audit/timeline/event/file-store proof, then reads Provider Readiness and Provider Controlled Run to prove a removed `search:evidence` grant is denied as `agent-tool-grant-missing`. It is local MVP Agent tool authorization evidence only; production still requires managed runtime identity, task-scoped grants, and centralized provider audit.

`npm run agents:project-settings:integrations` is the focused Settings integration capability gate. It writes project settings, verifies `project-integration-capabilities/v1`, confirms provider budget and Agent tool grants are backend-backed editable controls, confirms Proxy/Webhook points to `/projects/:id/adapter-gateway-preflight`, confirms MCP Tools points to `/projects/:id/provider-readiness`, confirms Vector Store points to `/projects/:id/evidence-index-readiness`, confirms Budget Alerts points to `/projects/:id/budget-alert-readiness`, confirms Error Reporting points to `/projects/:id/error-reporting-readiness`, and confirms those five route-backed rows are backend-backed but read-only with production blockers. It prevents the UI from presenting those integrations as either editable fake controls or missing backend APIs.

`npm run agents:project-settings:workspace` is the focused Settings workspace capability gate. It writes project language plus `project-workspace-policy/v1` through `project-settings/v1`, verifies `project-workspace-capabilities/v1`, confirms global interface language is browser-local, confirms project language/interface density/default visibility/autosave cadence are backend-backed, confirms runtime contract rules are backend-backed and read-only through `GET /projects/:id/runtime-contracts`, confirms long-term memory readiness is backend-backed and read-only through `GET /projects/:id/memory-readiness`, confirms the memory read model appears in Manager Ready Package and Readiness Proof Map, confirms meeting summaries are backend-backed through `GET /projects/:id/meeting-summaries`, and verifies audit, runtime-contract, memory-readiness, transcript-derived meeting summary, timeline, event-ledger, and file-backed persistence proof. It prevents the UI from presenting unfinished workspace controls as editable fake settings.

`npm run launch:local-mvp:check` is the low-write release checklist for P0/P1 readiness metadata. It does not build, launch browsers, or replace the P0/P1 gates above. It verifies the required package scripts, script entry files, persona Skill entry files, launch-gate language, Settings/backend proof boundary, Settings no-op Save removal, Settings provider readiness wiring, and real-user zero-to-autonomy script wiring before a human spends time on the heavier gates.

P0 is not enough for a customer pilot because evidence handoff, launch receipts, customer acceptance, and operator controls are not required by this tier.

## P1 - Customer Private Pilot

P1 proves a controlled private-pilot handoff can close from both backend and browser paths. This is the current shortest gate for a customer-facing rehearsal.

Required commands:

```bash
npm run agents:product-team:private-pilot
npm run ui:manager-private-pilot
```

P1 assumes the P0 split browser gates have already passed. Do not rerun the long Manager backend chain for routine private-pilot signoff unless the change touched the legacy workbench flow directly.

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

`npm run agents:product-team:private-pilot:ops-readiness` is the focused bridge from P1 into production hardening. It stops after customer acceptance and verifies `production-operations-readiness/v1`, proving local/private-pilot operations proof is closed while centralized logs, metrics, traces, alert routing, on-call ownership, managed incident records, restore drills, centralized audit retention, and managed database/queue cutover remain explicit P2 blockers. That model also exposes `production-operations-managed-production-evidence/v1`, so a complete local/test operations receipt set is visible as receipt-complete but still blocked as managed-production evidence until signed control-plane attestations exist. Private-pilot release, launch, health, acceptance, and production-control write routes support lightweight receipt responses with deferred read-model refresh routes, including production infrastructure rehearsal, operations readiness, Flow Graph, Proof Map, transcript, timeline, and event routes, so the Harness and React can validate the handoff without repeatedly embedding the full Manager Ready Package.

Latest P1 confirmation on 2026-07-04: `npm run agents:product-team:private-pilot` and `npm run ui:manager-private-pilot` both pass. This verifies the backend private-pilot receipt chain plus the browser Manager handoff path for launch approvals, evidence export request/approval/download audit, release candidate, launch run, health check, acceptance report, Flow Graph, and Readiness Proof Map. It remains a supervised private-pilot rehearsal, not public production approval.

## P2 - Public Production

P2 is blocked until managed controls replace local/private-pilot rehearsal controls.

Required blocker domains:

| Domain | Minimum production evidence required |
| --- | --- |
| Managed persistence | Real database adapter execution receipts, RLS/tenant isolation, backup/restore proof, migration rollback, read-model checkpoint parity |
| Managed queue/cron | Durable queue adapter receipts for project, Agent, and Autopilot-session lanes; lease/ack/retry/dead-letter proof; scheduled worker operation without browser dependency |
| BYOK and providers | Managed KMS/secret rotation, real provider eval dataset, cost/rate limits, retry/circuit policy, incident controls, immutable provider/source/model-output audit |
| Security | Production identity lifecycle, RBAC/RLS enforcement, signed access/replay protection, audit fail-closed behavior, centralized security audit retention |
| Operations | Centralized logs/metrics/traces, alert routing, on-call ownership, managed incident records, restore drills, recovery runbooks |
| Evidence export | Encrypted object storage, signed expiring download URLs, watermark enforcement, retention/deletion jobs, data-residency controls |
| Launch governance | Production operations/deployment/security/provider control receipts marked as managed-production evidence with signed control-plane attestation, not local rehearsal evidence or unattested claims |

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

`npm run launch:infra` is the fast P2 infrastructure rehearsal. It runs the launch gate matrix validator, public-production startup readiness blocker contract, shared adapter gateway contract validation, reference private adapter gateway server validation, Agent HTTP server validation through an env-configured adapter gateway endpoint, Postgres-compatible gateway storage boundary validation, and the managed infrastructure cutover attestation bridge. The Postgres gateway validation now also proves `POST /attestations/managed-production-control` stays blocked until query-bound Postgres readback parity exists, then issues an HMAC-signed control-plane attestation whose payload matches `production-evidence-integrity-audit/v1`. The managed cutover bridge then verifies the project API can request those signed attestations, write `production-operations-control-receipt/v1` for persistence/queue cutover, and project them into infrastructure/evidence proof without closing unrelated launch gates. These commands are necessary but not sufficient for P2. The production launch audit must still show `readyForProduction: true`, and the production evidence integrity audit must classify required control domains as managed-production evidence.

Managed persistence and managed queue/cron cutover evidence is now projected through two layers: the adapter dry-run routes prove rehearsal coverage, and verified `production-operations-control-receipt/v1` rows for `managed-persistence-cutover` / `managed-worker-queue-cutover` clear the matching `production-infrastructure-rehearsal/v1` domain blockers and managed cutover gates. `managedCutoverSummary` reports the ready/blocked cutover gate counts and the next blocked gate so C-side operators can see exactly why public production remains blocked. This does not by itself approve P2; remaining deployment, security, provider, evidence integrity, operations, and launch-governance gates must still close with managed-production evidence.

Deployment hardening uses the same projection pattern: verified `production-deployment-control-receipt/v1` rows now bind the deployment receipt workflow checksum into `production-infrastructure-rehearsal/v1`, mark the `deployment-preflight` domain row and `deployment-cutover` managed gate `productionReady`, and expose `deploymentReceiptReady` plus the deployment receipt route. This clears only the infrastructure deployment blocker; launch audit, managed-production evidence integrity, security, provider, operations, and approval gates still control the public-production decision.

Security, provider, managed-production evidence integrity, and launch governance now have matching focused gates. `npm run agents:product-team:production-security-controls` proves managed identity/KMS/RBAC/security-audit receipts reach Security Boundary, Proof Map, Flow Graph, and Launch Control. `npm run agents:product-team:production-provider-controls` proves provider rollout receipts reach Provider/Proof/Control surfaces while managed-production evidence integrity still blocks public production. `npm run agents:product-team:production-evidence-integrity` proves local/test receipts remain local rehearsal evidence, proves unsigned `evidenceEnvironment: "managed-production"` attestation claims remain `external-unattested`, then requires explicit managed-production receipt evidence with a valid attestation signature before closing the evidence-integrity gap. `npm run agents:product-team:production-launch-governance` then proves Manager, security-admin, and operations-owner can write production launch approvals through signed backend membership, that `launch-approval-workflow/v1` carries checksum/proof/timeline/event evidence, and that Launch Audit / Control Center / Proof Map / Flow Graph see approval readiness while the Control Center still keeps global public-production startup readiness as an explicit no-go row until the managed runtime gates pass.

Latest P2 evidence-integrity confirmation on 2026-07-04: `npm run agents:product-team:production-evidence-integrity` now runs the focused `scripts/validate-production-evidence-integrity-contract.mjs` validator instead of replaying the full private-pilot chain. It creates a minimal backend product-team project, writes production operations/deployment/security/provider receipt batches through signed membership routes, verifies local receipts stay `local-rehearsal`, verifies unsigned managed-production claims stay `external-unattested`, verifies signed managed-production attestations upgrade `production-evidence-integrity-audit/v1`, and checks Launch Audit, Gap Register, Control Center, Proof Map, and Flow Graph projection. This closes only the evidence-classification proof; public production remains blocked by the rest of the P2 managed runtime, governance, observability, incident, restore, and approval controls.

Latest P2 launch-governance confirmation on 2026-07-04: `npm run agents:product-team:production-launch-governance` now runs the focused `scripts/validate-production-launch-governance-contract.mjs` validator instead of replaying the full private-pilot chain. It creates a minimal backend product-team project, writes signed managed-production operations/deployment/security/provider receipts, confirms evidence integrity is ready, records Manager, security-admin, and operations-owner production approvals through signed membership, and verifies `launch-approval-workflow/v1`, Launch Audit, Production Launch Control Center, Readiness Proof Map, and Manager Flow Graph projection. This closes the approval-contract proof only; the Control Center must still keep public production `no-go` while global startup/runtime gates remain blocked.

## Current Evidence

As of the current workspace state, the verified private-MVP evidence is:

Latest built browser confirmation on 2026-07-03: `npm run ui:real-user-zero-to-autonomy` passes as the real-backend browser proof for a fresh user journey from Settings provider seal through kickoff, C/A handoff, autonomous Agent action, provider-backed evidence, generic artifact submissions, review/revision closure, accepted final deliverable, Flow Graph, Proof Map, transcript, timeline, event ledger, Agent Dashboard, and Evidence Index readback. This confirms the private-MVP browser path only; public production still requires the P2 managed controls below.

Latest full Manager browser regression on 2026-07-03: `node scripts/validate-manager-backend-ui.mjs` passes against the built `dist` bundle after explicitly seeding the Manager Demo sample into the backend and syncing standalone Manager read models. This broad legacy regression proves the old Manager workbench can run in backend-backed mode without relying on frontend fallback rows for scenario trail, walkthrough, requirement matrix, sync protocol, use-case audit, Manager command center, Flow Graph, Proof Map, transcript, timeline, event, Agent action, review/revision/final-deliverable, and collaboration proof surfaces.

Latest low-write browser preflight on 2026-07-03: `npm run ui:real-user-zero-to-autonomy:dev` also passes against an already running Vite dev server. It is useful while replacing mocks because it skips `vite build`, but it remains a preflight and does not replace the built launch gate above.

- P0 backend loop: `npm run agents:product-team:core`
- P0 Research validation sample: `npm run agents:product-team:research-sample`
- P0 autonomous cycle consistency: `npm run agents:product-team:cycle-consistency`
- P0 persona supply: `npm run skills:check`
- P0 persona skill blending: `npm run skills:blend`
- P0 manager/backend Harness scenario: `npm run agents:scenario`
- P0 local backend Secret Vault startup: `npm run agents:server:validate`
- P0 local MVP startup readiness: `npm run agents:local-mvp-startup-readiness`
- P0 public-production startup blocker contract: `npm run agents:public-production-startup-readiness`
- P0 Settings health readiness contract: `npm run agents:settings-health-readiness`
- P0 Settings runtime readiness contract: `npm run agents:settings-runtime-readiness`
- P0 model provider adapter contract: `npm run agents:model-provider-adapter`
- P0 Settings provider readiness contract: `npm run agents:settings-provider-readiness`
- P0 search provider Vault endpoint/key proof: `npm run agents:search-provider:vault-endpoint`
- P0 browser control loop: `npm run ui:manager-backend:core`
- P0 browser real-user product-team chain: `npm run ui:manager-backend:real-user-chain`
- P0 browser proof navigation: `npm run ui:manager-backend:proof-navigation`
- P0 browser private-pilot Manager panels: `npm run ui:manager-backend:private-pilot-panels`
- P0 browser production-control Manager panels: `npm run ui:manager-backend:production-controls`
- P0 provider proof browser link: `npm run ui:manager-provider-proof`
- P0 Settings privacy policy backend receipt: `npm run agents:project-settings:privacy`
- P0 Settings provider budget backend receipt: `npm run agents:project-settings:provider-budget`
- P0 Settings tool grant backend receipt: `npm run agents:project-settings:tool-grants`
- P0 Settings integration readiness contract: `npm run agents:settings-integration-readiness`
- P0 Settings workspace capability backend receipt: `npm run agents:project-settings:workspace`
- P0 Evidence Index readiness contract: `npm run agents:evidence-index-readiness`
- P0 Budget Alert readiness contract: `npm run agents:budget-alert-readiness`
- P0 Error Reporting readiness contract: `npm run agents:error-reporting-readiness`
- P0 Mission Runner browser startup: `npm run ui:manager-mission-runner`
- P0 real-user zero-to-autonomy API startup: `npm run agents:real-user-zero-to-autonomy`
- P0 real-user zero-to-autonomy browser startup: `npm run ui:real-user-zero-to-autonomy`
- P0/P1 low-write release checklist: `npm run launch:local-mvp:check`
- P1 backend private pilot: `npm run agents:product-team:private-pilot`
- P1 production-ops bridge: `npm run agents:product-team:private-pilot:ops-readiness`
- P1 browser handoff: `npm run ui:manager-private-pilot`
- Legacy full Manager browser chain, optional broad regression only: `npm run ui:manager-backend:legacy-full`
- P2 infrastructure rehearsal: `npm run launch:infra` plus `GET /projects/:id/production-infrastructure-rehearsal`

The current correct claim is: local backend-backed private MVP, customer private-pilot rehearsal, and P2 infrastructure rehearsal are verified. Public production remains blocked until real managed-production evidence replaces local/private rehearsal receipts.

The current production-hardening rehearsal evidence is also verified:

- P2 operations controls: `npm run agents:product-team:production-ops-controls`
- P2 deployment controls: `npm run agents:product-team:production-deployment-controls`
- P2 security controls: `npm run agents:product-team:production-security-controls`
- P2 provider controls: `npm run agents:product-team:production-provider-controls`
- P2 managed-evidence classification: `npm run agents:product-team:production-evidence-integrity`
- P2 launch-governance approval contract: `npm run agents:product-team:production-launch-governance`

These P2 focused gates prove the backend contracts, receipt projections, evidence classification, Flow Graph / Proof Map surfaces, and launch-governance approval path. They are production-hardening rehearsal evidence, not public-production certification. The project-level Production Launch Control Center now also carries the global `public-production-startup-readiness` blocker, so a project cannot look production-ready while the runtime environment is still local/private-pilot only. The public production decision remains blocked until those contracts are connected to the real managed database, durable queue/cron, provider/BYOK credentials, centralized audit/observability, incident process, and customer production policy.

## Maintenance Rule

When adding or changing launch-related read models, scripts, or UI controls, update this document and run:

```bash
npm run launch:gates
```

The gate validator checks that the launch tiers remain tied to runnable package scripts, production blockers, and the generic product-team positioning.
