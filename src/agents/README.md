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
- `createAgentProjectMemoryStore`: the in-memory repository adapter for tests and browser-adjacent prototypes. It stores hydrated project snapshots, retained project messages, and durable kickoff meeting sessions, exposes `saveProject`, `saveKickoffMeeting`, `appendMessages`, `getMessages`, and `snapshot`, and can be replaced by another adapter with the same shape.
- `createAgentProjectFileStore`: the Node-backed repository adapter. It persists the same project/message/kickoff-meeting snapshot to JSON on disk, reloads it on service restart, and proves the backend command facade can survive process boundaries before a database adapter exists.
- `createAgentProjectApi`: an HTTP-shaped command handler over the service. It accepts `{ method, path, body }` and returns `{ status, body }` for `GET /kickoff-meetings`, `POST /kickoff-meetings`, `GET /kickoff-meetings/:id`, `POST /kickoff-meetings/:id/approve`, `GET /projects`, `POST /projects/initiate`, `GET /projects/:id`, `GET /projects/:id/messages`, `GET /projects/:id/timeline`, `GET /projects/:id/events`, `GET /projects/:id/tasks`, `GET /projects/:id/tasks/:taskId`, `GET /projects/:id/tasks/:taskId/evidence`, `GET /projects/:id/readiness`, `GET /projects/:id/readiness-proof-map`, `GET /projects/:id/manager-dashboard`, `GET /projects/:id/agents`, `GET /projects/:id/agents/:agentId`, `GET /projects/:id/agents/:agentId/dashboard`, `GET /projects/:id/agents/:agentId/inbox`, `GET /projects/:id/agents/:agentId/worklog`, `GET /projects/:id/agents/:agentId/obligations`, `GET /projects/:id/agents/:agentId/plan`, `POST /projects/:id/agents/:agentId/message`, `POST /projects/:id/agents/:agentId/work-cycle`, `POST /projects/:id/chat`, `POST /projects/:id/meeting`, `POST /projects/:id/autonomous-cycle`, `POST /workers/autonomous/due`, and `POST /workers/agents/due`.
- Project-scoped command responses such as kickoff initiation, chat, meeting, autonomous-cycle, and per-Agent work-cycle include `managerDashboard` in the response body, so manager clients can update the aggregate backend view immediately after a command without waiting for a second read.
- Due-worker processed items from `POST /workers/autonomous/due`, `POST /workers/agents/due`, and scheduler ticks also include `managerDashboard`, so background 24/7 worker results can feed the same manager aggregate view without a follow-up read per processed project.
- `createFileBackedAgentProjectApi`: combines the API handler with the Node file store so a future backend process can start from a JSON snapshot, handle commands, persist results, and restart without losing Agent state.
- `createAgentProjectHttpServer`: mounts the API handler on a real Node HTTP server with JSON request/response handling, CORS headers, and an optional autonomous scheduler controller for `GET /workers/autonomous/status`, `POST /workers/autonomous/tick`, `POST /workers/autonomous/start`, and `POST /workers/autonomous/stop`.
- `npm run agents:server`: starts that local backend on `AGENT_PROJECT_HOST`/`AGENT_PROJECT_PORT` with `AGENT_PROJECT_STORE` pointing at the JSON store file. Set `AGENT_AUTONOMOUS_SCHEDULER=1` to start the backend worker loop automatically, and `AGENT_AUTONOMOUS_INTERVAL_MS` to adjust the polling interval.
- `createKickoffMeetingSession` and `approveKickoffMeetingSession`: split initiation into a durable meeting resource and a later manager approval. A session stores the Director brief, invited Agents, role-clarification questions, self-nominations, Leader campaign turns, peer-hearing evidence, recommended Leader/Reviewer, and selectable decision options. Approval reuses the saved transcript to create the project, Leader marker, kickoff charter, assignments, first autonomous pulse, and the session/project link.
- `createKickoffProjectFromMeeting`: creates a project from a Director brief and team roster, generates role clarification, self-nomination, Leader campaign, Director-confirmed Leader marker, kickoff charter, Leader assignments, acknowledgements, and the first autonomous work pulse.
- `submitProjectChatMessage`: accepts Director/group-chat/Google Chat text, resolves `@agent`/`@all`, persists the source message into Agent state and `eventLedger`, routes feature changes, Leader assignments, peer handoffs, or ordinary Agent replies, and returns the updated project plus messages to publish.
- `submitProjectMeetingMessage`: accepts War Room meeting input, persists the Director source message, then routes meeting feature changes through the same confirmation/owner-sync protocol.
- `submitAgentMessage`: accepts one Agent as the message author and optional `targetAgentIds`, publishes the Agent-authored message through the same group-chat receipt path, writes direct targets into their inbox/obligations, writes the sender's worklog, appends a ledger event with `source: agent-to-agent-message`, and returns publishable chat messages plus manager/Agent dashboard proof.
- `runProjectAutonomousCycle`: runs `advanceAutonomousProjectCycle`, publishes visible Agent work back to group chat, and appends those chat messages to Agent state and the unified ledger.
- `runAgentWorkCycle`: advances one named Agent as an independently callable worker. It reads that Agent's current plan and owned task, writes private worklog evidence, publishes a visible group-chat progress message, sends management check-ins to any managed or peer-managed Agents, appends timeline/event-ledger proof, updates task evidence ids, and records the run in `agentWorkerLedger`.
- `evaluateAgentWorkSchedule` and `runDueAgentWorkCycles`: scan each project's team for Agents whose `nextAgentRunAt` is due, rank due Agents by management pressure, run only the selected independent Agent workers, persist processed projects/messages, and report skipped Agents whose personal cadence is still waiting or whose priority lost to the per-project cap.
- `agentManagementPriority`: folds each Agent's manager relation, peer-manager relation, open owned tasks, open obligations, management inbox signals, peer handoffs, and review sweep signals into a priority score and human-readable reasons. Those reasons are returned by `POST /workers/agents/due`, written into `agentWorkerLedger`, and echoed in the visible Agent work message.
- `runDueProjectAutonomousCycles`: scans persisted projects, uses `evaluateAutonomousSchedule` to separate due from not-due projects, runs only due autonomous cycles, persists processed projects, and reports skipped projects without mutating them.
- The HTTP scheduler controller wraps both due-worker routes with status, manual tick, start, and stop controls, so a running backend can keep autonomy-enabled projects and independently due Agents moving without a browser tab. Scheduler status includes project processed/skipped counts and Agent processed/skipped counts.
- The project dashboard renders a `Backend Worker Station` panel. It checks the configured backend URL (`VITE_AGENT_BACKEND_URL`, default `http://127.0.0.1:8787`), lets the manager edit and persist that URL, shows online/offline scheduler counters, exposes start/stop/status controls, can sync the current project to the backend for a `Server Pulse`, and can pull the backend project/messages snapshot back into the manager UI with `Sync State`.
- The same station now pulls `GET /projects/:id/manager-dashboard` after online status checks, syncs, backend chat/meeting commands, Server Pulse, and Agent Pulse. It also exposes `Sync Manager View` for a manual aggregate-only refresh. The resulting `Backend Manager Snapshot` shows readiness score, proof-route count, transcript proof count, operations Agents, management checks, assignment rows, change rows, and open task count so the manager can see the backend's aggregate view without leaving the dashboard.
- When the backend station is online, project group-chat and War Room meeting submissions use backend project commands first, then merge the returned project/messages into the UI. If the backend command fails, the same input falls back to the local runtime path so the manager interaction does not dead-end.
- Real initiation approval also uses the backend kickoff endpoint when the backend station is online. The returned project, kickoff messages, role negotiation, Leader election, charter, and assignment package are merged into the UI; if the command fails, the local kickoff runtime still creates the project.
- `getTimeline`, `getEventLedger`, `listTasks`, `getTask`, and `getTaskEvidence`: expose the manager's backend read model for project logs, replayable ledger events, task ownership, and task-level chat/log/event proof.
- `listAgentStates` and `getAgentState`: expose each Agent as an independently queryable backend resource, including inbox, obligations, current plan, fixed routine, and private worklog.
- `getAgentDashboard`: returns the per-Agent aggregate read model for one Agent: identity, state, inbox, obligations, worklog, current plan/routine, next run, latest worker, owned tasks with evidence routes, management relationships, management proof logs, relevant chat/timeline/event proof ids, and backend route hints. This is the Agent-level counterpart to `getManagerDashboard`.
- `evaluateReadiness`: audits the persisted project and service message window against the manager-ready scenario checks.
- `getReadinessProofMap`: turns each readiness check into a backend evidence route with `proofKind`, `apiPath`, chat proof ids, timeline log ids, task ids, event ids, and Agent ids so the manager UI and future API clients can prove every pass/fail condition without duplicating front-end mapping logic.
- `getManagerDashboard`: returns the manager-ready aggregate read model for one project: readiness, proof map, transcript index, latest messages, event-ledger/timeline summary, 24/7 operations rows, Agent management mesh, Agent communication flow, kickoff meeting flow with conversation rows, kickoff execution flow, Leader assignment flow, change flow, peer handoffs, task evidence rows, and backend route hints.

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
- `npm run ui:manager-demo` builds the production bundle, serves `dist/` through a local static server, clicks `Run Manager Demo`, verifies the manager dashboard contains autonomous work, the backend worker station and state sync controls, unified event-ledger replay counts, kickoff charter, change ledger, peer handoffs, `100%` manager-readiness, then clicks and sends the manager demo action path for Google Chat change, War Room meeting change, Leader assignment, and peer handoff, verifies the resulting confirmations/syncs/assignment acknowledgement/accepted handoff, opens the evidence timeline, and writes `dist/manager-demo-ui-validation.png`.
- `npm run ui:manager-backend` builds the production bundle, starts a real Agent project backend on a dynamic local port, injects that URL into the manager dashboard, verifies `Check`, `Server Pulse`, and `Sync State` from the `Backend Worker Station`, confirms the backend store persisted the manager demo project plus backend-published chat messages, sends a real Agent-to-Agent message from a Team row, sends Google Chat and War Room change requests through the online UI, verifies backend change-ledger persistence, then walks the real initiation flow and verifies backend persistence of the new kickoff project, charter, event ledger, and first-pulse chat evidence.
- `npm run build` verifies the React/Vite app still compiles with the same runtime.
