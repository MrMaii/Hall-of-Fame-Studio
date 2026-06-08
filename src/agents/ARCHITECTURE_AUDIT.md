# Agent Consciousness Architecture Audit

This audit maps the product objective to concrete implementation evidence.

## Requirement Coverage

### 1. Meeting communication frames

Requirement: In meetings, every participant must know what to say. Kickoff meetings should clarify what each person will do. Recurring meetings should clarify progress and delivery timing.

Evidence:

- `MEETING_PROTOCOLS.kickoff` defines the Lead frame and member frame.
- `MEETING_PROTOCOLS.sync` defines the recurring sync frame.
- `startAgentSession`, `routeDirectorDirective`, and `runRoundtableExchange` apply those frames when producing Agent turns.
- The dashboard renders kickoff and recurring sync frames in `Governance & Speech Protocol`.

Status: covered.

### 2. Lead-led governance

Requirement: Every team starts with one Lead. The Lead discusses and decides work coordination. The mode must be explicit.

Evidence:

- `createAgentNetwork` selects governance for the team.
- `chooseGovernance` respects a Director-confirmed `isLeader` marker before falling back to inferred Lead selection, then chooses a Reviewer.
- The Lead coordinates all non-lead Agents.
- The Reviewer reviews the Lead.
- The dashboard renders `Lead decides` and `Reviewer challenges`.
- `evaluateCollaborationState` checks that Lead and Reviewer exist and are separate.

Status: covered.

### 3. Long-running autonomous station operation

Requirement: Agents must work over hours/days without user interference and without turning everything into explicit user-driven process.

Evidence:

- `planAutonomousWorkCycle` computes hourly/daily private work and public publishing.
- `evaluateAutonomousSchedule` determines due status, waiting reason, due time, and next run time for enabled projects.
- `advanceAutonomousProjectCycle` writes the cycle back into project state: logs, task touches, progress, autonomous ledger, scheduler ledger, per-Agent state, last run time, and next run time.
- `agentStates` persists each Agent's manager relation, inbox, open obligations, current plan, owned tasks, private worklog, status, and last active time.
- The app scheduler checks due cycles for enabled projects and records whether a cycle came from the scheduler, a manual pulse, or the manager demo seed path.
- The dashboard exposes `Hour Pulse` and `Day Report` for manual verification.
- The dashboard Team panel surfaces each Agent's independent state and management relation.
- Project and chat state persist through browser `localStorage` in the prototype.

Status: covered for local prototype runtime; production backend can replace storage and scheduler while keeping the same contract.

### 4. Multi-Agent speaking logic

Requirement: The system must define how multiple Agents decide who speaks.

Evidence:

- `buildIntentions` ranks Agent meeting speakers.
- `selectTargets` routes Director directives to explicit targets or top-ranked Agents.
- `processWorkCommunication` ranks work-stream responders by attention score.
- `readCommunication` marks each Agent as `speak`, `read`, or `ignore`.
- `buildAgentChatReplies` adapts work-stream speaking decisions into UI chat replies.

Status: covered.

### 5. Reading logic for work communication

Requirement: Since Agents do not call meetings themselves during work, their communication happens inside the work stream. They must know how to read other Agents' messages.

Evidence:

- `readCommunication` scores direct mentions, Lead broadcasts, managed peer messages, capability matches, and ambient signals.
- It extracts obligations for action, review, and unblock cases.
- `processWorkCommunication` exposes diagnostics for every Agent reading a message.
- Autonomous cycles preserve non-ignored communication diagnostics in the ledger.
- Autonomous cycles also write relevant communication diagnostics into each Agent's inbox.
- The dashboard shows recent communication diagnostics from the autonomous ledger.

Status: covered.

### 6. Perfect collaboration invariants

Requirement: Collaboration must not silently drift. Tasks, blockers, risks, deadlines, and Director escalations need governance.

Evidence:

- `evaluateCollaborationState` checks Lead presence, Reviewer presence, Lead/Reviewer separation, ownerless tasks, blocked task ownership, Reviewer visibility for risk signals, and collaboration evidence in cycles.
- The dashboard renders `Collaboration Health`, status, and each check.
- `evaluateManagerScenarioReadiness` checks the requested manager scenario directly, including kickoff approval, role clarification, hearing edges, Leader election, Leader assignments, autonomous work, scheduler evidence, timeline progress, group chat evidence, peer handoff, War Room meeting change source, Google Chat change source, and owner plan sync.
- The readiness audit also checks that evidence-bearing tasks link back to their chat messages and timeline log ids.
- The readiness audit treats group-chat evidence as durable project state, not only as the latest visible chat window, so older kickoff and assignment evidence remains valid after long autonomous runs.
- The dashboard renders `Manager Scenario Readiness` with pass/fail detail for those scenario-specific requirements.
- The dashboard also renders `Manager Proof Map`, which turns each readiness check into a direct proof route to kickoff chat, group chat, change proof, management proof, timeline proof, or the relevant dashboard evidence surface.
- The backend service/API now exposes the same evidence routing through `getReadinessProofMap` and `GET /projects/:id/readiness-proof-map`, returning typed `proofKind`, `apiPath`, chat proof ids, timeline log ids, task ids, event ids, and Agent ids for every readiness check.
- The backend service/API also exposes `getManagerDashboard` and `GET /projects/:id/manager-dashboard`, an aggregate manager read model containing readiness, proof-map routes, transcript summaries, timeline/event summaries, 24/7 operations rows, Agent management mesh rows, kickoff flow, assignment flow, change flow, handoffs, and task evidence rows.
- The kickoff portion of that read model includes concrete conversation rows for role clarification, self-nomination, and Leader campaign speeches, so backend clients can inspect the actual meeting turns instead of only seeing counts.
- The same read model includes `kickoffExecutionFlow`, connecting charter next actions, Leader assignment evidence, first-pulse scheduler/chat/timeline proof, and 24/7 readiness.
- That aggregate manager read model now includes `agentCommunicationFlow`, which traces Agent-authored messages from sender worklog to target inbox/obligation state and exact transcript proof.
- The backend service/API also exposes `getAgentDashboard` and `GET /projects/:id/agents/:agentId/dashboard`, a per-Agent aggregate read model containing the Agent's inbox, obligations, private worklog, current plan, next run, latest worker, owned task evidence, management relationships, management proof logs, relevant chat/timeline/event proof ids, and route hints.
- The backend service/API now exposes Agent-authored communication through `submitAgentMessage` and `POST /projects/:id/agents/:agentId/message`. The sender is resolved from the URL, target Agents are explicit, receipts use the same group-chat delivery path, target inboxes and sender worklogs update immediately, and `eventLedger` stores the message with `source: agent-to-agent-message`.
- The project dashboard now surfaces that route in each Team row as an `Agent Message` control, so managers can initiate a real backend Agent-to-Agent message, then verify target inbox proof and sender worklog proof from the same screen.
- The project dashboard also renders `Agent Communication Flow`, so the manager can scan Agent-to-Agent communication as a proof chain instead of searching through group chat, Agent inboxes, and worklogs separately.
- The React `Backend Worker Station` now fetches and renders that aggregate as `Backend Manager Snapshot` after online backend actions and through a manual `Sync Manager View` control, so managers can verify the backend's own readiness, proof route, operations, management, assignment, and change counts from the dashboard itself.
- `README.md` documents collaboration invariants.

Status: covered.

## Verification Evidence

Current verification is source-level plus build-level:

- Runtime entry points exist in `src/agents/agentRuntime.js`.
- User-facing architecture docs exist in `src/agents/README.md`.
- This audit documents requirement-to-evidence coverage.
- `npm run agents:scenario` validates the first manager scenario end to end at the runtime/data level.
- `npm run build` passes after the changes.

## Remaining Non-Blocking Cleanup

- `runRoomSimulation` still contains unreachable legacy simulation code after an early `return`. It is not executed and does not affect runtime behavior, but should be cleaned when editing the large legacy React file is safer.
- The React scheduler is still prototype-local, but the Node HTTP server now has an optional autonomous scheduler loop backed by the file store. A production backend can replace the interval runner with cron/queue infrastructure and move storage to an append-only ledger table while preserving the same scheduler ledger contract.

## Manager Scenario Coverage

### Kickoff with Leader election

Evidence:

- `createKickoffRoleNegotiation` generates the pre-election role clarification transcript, including "what should I own?" questions and self-nomination statements.
- The project initiation meeting step renders that runtime-generated transcript before the result screen, so the manager sees the meeting itself instead of only the final project record.
- Initiation transcript cards show the peers that heard each turn, and `createKickoffCharter` persists role and Leader hearing edges as durable evidence.
- `approveInitiationProject` appends that transcript to group chat before the Leader election so Agents hear each other before governance is confirmed.
- `createLeaderElection` generates candidate campaign statements and a recommended leader.
- The initiation result screen renders Leader candidates and lets the Director choose the confirmed Leader.
- `approveInitiationProject` writes the confirmed Leader into team state with `isLeader`.
- `createKickoffCharter` persists the approved meeting result, Leader, Reviewer, team roster, next actions, communication rules, and evidence ids.
- Real initiation and manager-demo kickoff chat messages preserve the runtime transcript ids stored in `kickoffCharter.evidence`, and the dashboard exposes a `Kickoff chat proof` jump that highlights those group-chat records.
- `createKickoffCharter` now emits unified ledger events for role questions, self-nominations, Leader campaign speeches, and the final approved charter, so the kickoff meeting is replayable from the backend event stream.
- Group-chat messages now carry `heardBy`, `directTargetIds`, per-Agent `receipts`, and a `visibility` summary, while timeline logs created from those messages preserve `receiptCount` and `directTargetIds`.
- This gives the manager a durable proof trail that the team could hear a message and that directly mentioned Agents saw the request, even when old chat records are later recovered from logs.
- `Group Chat Transcript Index` renders project-scoped channel transcripts on the dashboard with message counts, archived proof recovery counts, latest speaker/message, receipt coverage, direct mentions, and proof jumps into the exact chat transcript.
- `GET /projects/:id/transcripts` and `GET /projects/:id/transcripts/:channelId` expose the same transcript read model through the backend service/API/HTTP stack, including current messages and recovered proof messages rebuilt from kickoff transcripts and timeline logs.
- Ordinary group-chat messages are applied through `applyChatMessagesToAgentStates`, so direct mentions update the target Agent's inbox/obligations and Agent-authored replies update the author's worklog even when no special assignment/change command was detected.
- Special manager commands use the same source-message path before side effects: live Leader assignment commands, Google Chat change requests, and War Room meeting change requests are written to Agent state and `eventLedger` before assignment/change handlers append their specialized records.
- `agentProjectService.js` now wraps those runtime operations in backend-style project commands. `submitProjectChatMessage`, `submitProjectMeetingMessage`, and `runProjectAutonomousCycle` accept a project plus request payload, return the next project state and messages to publish, and can be used by React, an API route, or a worker without duplicating orchestration logic.
- `agentProjectStore.js` provides the repository seam behind that service. The memory adapter persists hydrated project snapshots, retained messages, and durable kickoff meeting sessions in process, supports `snapshot`, and can be swapped without changing command routing.
- `agentProjectFileStore.js` is the first Node-backed adapter for that seam. It writes the same project/message/kickoff-meeting snapshot to JSON, reloads it after service restart, and keeps post-restart chat and worker-cycle dispatch on the same service contract.
- `agentProjectApi.js` is the HTTP-shaped command layer over the service. It routes durable kickoff meeting session create/read/approve, project chat, War Room meeting input, autonomous worker cycles, messages, snapshots, timeline reads, event-ledger reads, task evidence reads, readiness checks, readiness proof-map reads, and aggregate manager-dashboard reads through `{ method, path, body }` requests, returning `{ status, body }` responses that can be mounted behind a real server.
- Project-scoped command responses also include `managerDashboard`, so a frontend can refresh the backend aggregate view immediately after initiation, chat, meeting, autonomous-cycle, or per-Agent worker commands without issuing a second read first.
- Due-worker processed items and scheduler tick results include the same manager-dashboard snapshot per processed project, so unattended 24/7 backend work still returns manager-readable aggregate evidence with each processed result.
- `agentProjectHttpServer.js` mounts that command layer on a real Node HTTP server, adds scheduler status/tick/start/stop controls, and `npm run agents:server` starts it against a JSON store path so backend endpoints can be exercised outside React.
- Agent state is now independently addressable through backend endpoints: `GET /projects/:id/agents`, `GET /projects/:id/agents/:agentId/dashboard`, `inbox`, `worklog`, `obligations`, and `plan`, plus `POST /projects/:id/agents/:agentId/message` for Agent-authored group-chat publishing. Direct `@agent` messages, Agent-authored target messages, and kickoff Leader assignments carry task ids or source message ids into those inbox resources, while the dashboard endpoint aggregates each Agent's state, worker ledger, owned tasks, management relations, and proof routes.
- Project evidence is now independently addressable through backend endpoints: `GET /projects/:id/timeline`, `GET /projects/:id/events`, `GET /projects/:id/tasks`, `GET /projects/:id/tasks/:taskId`, and `GET /projects/:id/tasks/:taskId/evidence`. The task evidence endpoint resolves linked chat messages, timeline logs, and unified ledger entries from each task's durable evidence ids.
- `createKickoffMeetingSession`, `approveKickoffMeetingSession`, `POST /kickoff-meetings`, and `POST /kickoff-meetings/:id/approve` make the initiation meeting a durable pre-project backend resource. The session stores Director brief, invited Agents, role questions, self-nominations, Leader campaigns, peer-hearing evidence, recommended Leader/Reviewer, and manager decision options; approval reuses that saved transcript to create the project, Leader marker, kickoff charter, assignments, first pulse, and manager-dashboard proof.
- `createKickoffProjectFromMeeting` and `POST /projects/initiate` still provide the one-shot kickoff creation flow behind the backend boundary: from a Director brief and team roster they generate role questions, self-nominations, Leader campaigns, the confirmed Leader marker, kickoff charter, Leader assignments, acknowledgements, chat evidence, and the first autonomous pulse.
- `runDueProjectAutonomousCycles` and `POST /workers/autonomous/due` provide the backend project scheduler path: they scan persisted projects, run only autonomy-enabled projects whose `nextAutonomousRunAt` is due, publish group-chat work evidence, and return skipped projects without mutating them.
- `evaluateAgentWorkSchedule`, `runDueAgentWorkCycles`, and `POST /workers/agents/due` provide the independent Agent scheduler path: they scan each team member's `nextAgentRunAt`, rank due Agents by management pressure, run selected Agents through `runAgentWorkCycle`, publish per-Agent group-chat proof plus managed-Agent check-ins, update `agentWorkerLedger`, and return skipped Agents without mutating their state. The manager dashboard mirrors that per-Agent backend state in Team rows with latest inbox, open obligation, worklog, and next-run details instead of only aggregate counts.
- Management pressure is computed from manager/peer-manager relations, open owned tasks, open obligations, management inbox check-ins, peer handoffs, and review sweep signals. The chosen Agent run stores `managementPriority` and `managementReasons` so the scheduler decision is auditable instead of being a hidden queue heuristic.
- `GET /workers/autonomous/status`, `POST /workers/autonomous/tick`, `POST /workers/autonomous/start`, and `POST /workers/autonomous/stop` wrap both due-worker routes in a server-level autonomous loop, so a running backend can continue project-level and Agent-level 24/7 work without relying on an open browser tab.
- The project dashboard includes a `Backend Worker Station` panel that checks the configured local backend, lets the manager edit and persist the backend URL, displays scheduler counters, exposes start/stop/status controls, can run a backend-backed `Server Pulse` for the active project, and can pull the latest backend project/messages snapshot into the manager UI.
- When that backend station is online, group-chat and War Room meeting submissions call the backend project command routes first and merge the returned project/messages into the UI. If the command fails, the UI falls back to the same local runtime path so the manager can keep moving.
- Real initiation approval follows the same backend-first pattern through `POST /projects/initiate`, then merges the returned project and kickoff messages into the UI. If the backend command fails, the local kickoff runtime still completes the approval.
- The React initiation approval, group chat, and Roundtable input paths call that service boundary directly, so manager-demo clicks and real kickoff approval exercise the same command facade a future backend will expose.
- Projects now maintain an append-only `eventLedger` with retained-window contiguous sequence numbers plus `eventLedgerFirstSequence`, `eventLedgerLastSequence`, and `eventLedgerEventCount` cursors. It aggregates kickoff approval, Leader assignments, peer handoffs, confirmed changes, autonomous scheduler runs, work pulses, management check-ins, and task completions into one backend-oriented event stream.
- `backfillProjectEventLedger` runs during project hydration, so older localStorage/imported projects that only have kickoff transcripts, logs, change records, peer handoffs, and scheduler records are migrated into the same replayable event stream.
- `publishAutonomousCycleChat` is now the App/worker boundary for autonomous work publication: after `advanceAutonomousProjectCycle`, manual pulses, scheduler pulses, initiation first-pulse, and manager-demo seed cycles publish their visible group-chat messages back into Agent state and `eventLedger` as `group-chat-message` records.
- `projectEventReplayProjection` derives replay-stage counts from that event stream, and the dashboard exposes them in `Unified Event Ledger`.
- `evaluateManagerScenarioReadiness` requires both event-ledger continuity and replay readiness for the manager-ready path.
- `approveInitiationProject` immediately calls `advanceAutonomousProjectCycle` with `trigger: initiation-approval`, persists the first scheduler ledger entry, moves the project to executing, and posts first-pulse work messages into group chat.
- The project dashboard renders the `Kickoff Charter` so the manager can see what the team agreed to do after the meeting.
- The project dashboard also renders `Kickoff Meeting Flow`, showing role clarification, self-nomination, peer-hearing edges, Leader campaign count, Director confirmation, and the persisted Leader marker with a proof jump to the kickoff chat transcript. It now includes `Conversation Evidence` rows for the actual meeting turns plus per-row proof jumps.
- The project dashboard also renders `Kickoff Execution Flow`, making the transition from meeting decisions to Leader assignments and the first autonomous pulse visible as a single proof chain.
- `Run Manager Demo` seeds the same kickoff transcript, Leader campaign, Director confirmation, and Leader marker in one click for the manager walkthrough.
- The confirmation is posted into the decisions channel and project logs.

Status: covered for the prototype flow.

### Leader assignment through group chat

Evidence:

- `createLeaderAssignmentPackage` converts open project tasks into Leader-authored `@agent` assignment messages.
- Those assignment messages are appended to group chat after project creation.
- Every assignment also produces an immediate assignee acknowledgement with `assignmentReceipt`, showing the mentioned Agent saw the work and started it.
- The assigned task records persist `assignmentMessageId`, `acknowledgementMessageId`, `acknowledgedAt`, and `timelineLogIds`, so the dashboard can connect each task to chat and timeline proof directly.
- Kickoff Leader assignment tasks also persist `source: kickoff-leader-assignment` and `sourceChannelId: main`, so the manager can use the same Chat proof button on the first assigned work after project creation.
- The manager dashboard consolidates those records into `Leader Assignment Flow`, which shows the full chain from group `@assignment` to the assignee's inbox/obligation state, acknowledgement, work pulse, and timeline proof instead of leaving the evidence scattered across task cards.
- The manager dashboard also renders `Agent Management Mesh`, which reads Leader manager links, peer-management links, latest check-ins, and management timeline logs into one proof surface for Agent-to-Agent management.
- Task proof buttons preserve runtime message ids, jump to the source chat or timeline, and automatically land on and highlight the exact proof messages/logs instead of only opening the broad view.
- Chat proof buttons call the proof-recovery layer first, rebuilding missing proof messages from kickoff transcripts and `log_<messageId>` project logs if the persisted chat buffer has already trimmed them.
- Assignment logs are inserted into the project log and therefore appear on the project timeline.
- Assignment acknowledgement logs are also inserted into the project log as `assignment-acknowledged`.
- `handleLeaderChatAssignment` covers live group-chat assignment requests after kickoff: the confirmed Leader emits the actual `@agent` message, a new task is created, the mentioned Agent acknowledges immediately, and both events are logged.
- Live assignment, peer handoff, and feature-change tasks carry the same task-level evidence links for request/assignment, acknowledgement or confirmation, owner sync, and timeline logs.
- `submitChatInput` detects live Leader assignment requests, updates project tasks/logs/Agent state, and appends the Leader assignment plus acknowledgement into the active project chat.
- `handlePeerHandoff` covers Agent-to-Agent dependency handoffs after work has started: the requesting Agent emits an `@agent` dependency request, the peer acknowledges immediately, a dependency task is created, `peerHandoffs` records the accepted handoff, and both events are logged.
- The dashboard `Peer Handoffs` panel links each accepted handoff back to peer chat proof and timeline proof for the request and acknowledgement.
- Team state now preserves peer-management relationships with `peerManagedIds` and `peerManagerIds`, separate from the Director-confirmed Leader chain.
- The project dashboard now surfaces Leader-assigned tasks with owner, assignment source, work-pulse count, and timeline-published status.
- The project dashboard also surfaces accepted peer handoffs with requester, target, task, channel, request evidence, and acknowledgement evidence.
- Chat messages carry `projectId`, and the project chat view filters by active project plus channel, so assignments are visible in the correct project without cross-project leakage.

Status: covered.

### 24/7 work with visible progress

Evidence:

- `evaluateAutonomousSchedule`, `advanceAutonomousProjectCycle`, and the app scheduler continue producing logs, autonomous ledger entries, scheduler ledger entries, and next-run timestamps.
- `createAutonomousCycleChatMessages` converts those autonomous cycle events into project-scoped group chat records.
- The app scheduler appends due-cycle chat records even when the user did not manually press `Hour Pulse` or `Day Report`.
- The project dashboard shows last run, next run, trigger source, due time, scheduler reason, and next scheduled time for recent cycles.
- The dashboard also shows whether the local backend worker station is online, offline, running, or ready, so the manager can distinguish browser-local autonomous work from server-backed 24/7 execution. When online, it periodically syncs the active project snapshot back from the backend so server-run autonomous cycles appear in the same chat and timeline views.
- `24/7 Operations Board` consolidates project next/last run, backend worker state, Agent run queue size, and each Agent's next run, latest work, trigger, open obligations, and management priority so continuous work is manager-readable without inspecting raw scheduler ledgers.
- Backend command responses preserve `responses.changeResponse`, so meeting-change discussion animation and group-chat owner confirmations stay available when the server handles the command.
- Backend initiation responses preserve role negotiation, Leader election, kickoff charter, and assignment-package details so the first manager approval can be persisted by the backend without losing the meeting evidence the UI needs.
- Autonomous cycles now move owned tasks through visible work pulses and emit `task-completed` timeline logs when work reaches completion.
- Autonomous cycles also emit management-loop events: Leader check-ins for managed Agents, Reviewer evidence sweeps, and peer-management check-ins for dependency handoffs.
- Management-loop events are mirrored into group chat as `@agent` messages, written to project logs, counted in `autonomousLedger.managementEventCount`, and delivered into the target Agent's inbox.
- Every autonomous cycle records each Agent's fixed work routine, including routine id, label, checklist, and expected artifact, so 24/7 work is typed by role instead of generic activity.
- `agentStates.currentPlan.routine` preserves the same routine evidence for the team panel, and peer handoff relations survive autonomous cycle state refreshes.
- Manual `Hour Pulse` and `Day Report` controls exercise the same work cycle.
- Project timeline now derives events from project logs when logs exist, so assignment, work pulse, and change events are visible in the large timeline view.
- Runtime-generated timeline events now use stable readable labels for project approval, Leader confirmation, assignments, acknowledgements, changes, work pulses, daily reports, and task completion.
- `Manager Demo Path` on the dashboard gives a direct path into kickoff chat evidence, War Room meeting changes, Google Chat change simulation, and the evidence timeline.
- `Run Manager Demo` creates a fully populated scenario using the same runtime functions, including autonomous work cycles and task completion evidence.

Status: covered for local prototype runtime.

### Mid-project feature change

Evidence:

- `handleFeatureChangeRequest` creates a discussion sequence: Lead acknowledges, Reviewer challenges risk when present, responsible Agent confirms.
- Roundtable meeting input detects feature-change requests, sends them through the same protocol, mirrors the discussion into project group chat, and animates the Lead/Reviewer/Owner responses back into the meeting transcript.
- The same protocol adds a responsible-owner plan sync after confirmation, so the owner explicitly tells everyone that the change entered their plan.
- That plan sync now updates the responsible owner's `agentStates` entry immediately, including inbox source channel, open obligation, task id, worklog, and `currentPlan` pointing at the accepted change.
- The same plan sync writes `change-sync` receipts into every non-owner Agent's inbox/worklog, and the change ledger records `teamSyncAgentIds`, `teamSyncCount`, and `teamStateSynced`.
- The same protocol returns `changeRecord`, which is stored in `changeLedger` with source channel, owner, reviewer, linked task, confirmation evidence, sync evidence, and plan update text.
- `handleFeatureChangeRequest` also returns a complete updated project state so group chat, Google Chat, and War Room paths persist the same owner-plan state transition.
- `submitChatInput` detects feature-change messages from group chat and invokes that protocol.
- The `Google Chat` channel uses the same path with `google-chat-mention-change-request` source metadata, preserving the channel where the request was made.
- Both War Room meeting input paths detect feature-change messages and invoke the same protocol.
- The confirmed change creates a new task and project log entries, which flow into chat and timeline.
- The project dashboard renders `Change Ledger` so manager review can inspect accepted mid-project changes without searching the raw chat stream.
- Each `Change Ledger` row can jump directly to chat proof and timeline proof for the related discussion, owner confirmation, owner sync, and log entries.
- The visible change stages now include source request, team discussion, owner confirmation, owner plan, and team sync targets, with owner-plan status derived from the owner's Agent state and team names derived from `teamSyncAgentIds`.
- Autonomous cycles read only the active project's recent chat messages when deriving obligations.
- War Room change discussions are mirrored into meeting logs so the live meeting and group chat stay synchronized.

Status: covered.

## Verification Gates

- `npm run agents:scenario` validates the full manager scenario data path and durable readiness checks.
- The same scenario gate now validates the service facade by dispatching a meeting change, Google Chat change, Leader assignment, peer handoff, backend-worker autonomous cycle, independent per-Agent work cycle, due-Agent worker scan, and management-priority due-Agent competition through `createAgentProjectService`; it also creates and approves a durable kickoff meeting session, snapshots the memory repository, reloads a fresh service, writes a file-backed repository to disk, restarts it, drives the HTTP-shaped API handler, verifies `POST /kickoff-meetings`, `POST /kickoff-meetings/:id/approve`, `POST /projects/:id/agents/:agentId/work-cycle`, and `POST /workers/agents/due`, boots the real Node HTTP server, calls it with `fetch`, creates a project through `POST /projects/initiate`, verifies timeline/event/task evidence HTTP reads, verifies per-Agent worker evidence and persistence, verifies scheduler status/tick/start/stop controls including Agent processed counters, checks dashboard backend worker controls and snapshot sync, restarts that server, and verifies post-reload kickoff session, chat, readiness, worker-cycle dispatch, and due-worker process/skip behavior.
- `npm run ui:manager-demo` validates the built manager demo in a real browser path: click `Run Manager Demo`, assert dashboard evidence panels and `100%` manager-readiness are present, send the Google Chat change, War Room meeting change, Leader assignment, and peer-handoff demo actions, verify the resulting confirmations/syncs/assignment acknowledgement/accepted handoff, open the evidence timeline, and emit a screenshot artifact.
- `npm run ui:manager-backend` validates the backend-connected manager dashboard in a browser path by starting the real Agent project HTTP server, injecting its URL into the UI, running `Check`, `Server Pulse`, `Sync State`, and a Team-row `Agent Pulse`, verifying the backend store contains the UI-driven autonomous cycle, per-Agent worker ledger, and chat evidence, sending online Google Chat and War Room change requests, verifying backend change-ledger persistence, then walking the real initiation approval flow and verifying backend persistence of the kickoff project, charter, event ledger, and first-pulse chat evidence.
