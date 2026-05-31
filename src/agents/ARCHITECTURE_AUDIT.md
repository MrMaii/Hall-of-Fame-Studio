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
- `advanceAutonomousProjectCycle` writes the cycle back into project state: logs, task touches, progress, autonomous ledger, per-Agent state, and last run time.
- `agentStates` persists each Agent's manager relation, inbox, open obligations, current plan, owned tasks, private worklog, status, and last active time.
- The app scheduler checks due cycles for enabled projects.
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
- The current autonomous scheduler and persistence are prototype-local. A production backend should move storage from `localStorage` to an append-only ledger table or local file store.

## Manager Scenario Coverage

### Kickoff with Leader election

Evidence:

- `createKickoffRoleNegotiation` generates the pre-election role clarification transcript, including "what should I own?" questions and self-nomination statements.
- The project initiation meeting step renders that runtime-generated transcript before the result screen, so the manager sees the meeting itself instead of only the final project record.
- `approveInitiationProject` appends that transcript to group chat before the Leader election so Agents hear each other before governance is confirmed.
- `createLeaderElection` generates candidate campaign statements and a recommended leader.
- The initiation result screen renders Leader candidates and lets the Director choose the confirmed Leader.
- `approveInitiationProject` writes the confirmed Leader into team state with `isLeader`.
- `createKickoffCharter` persists the approved meeting result, Leader, Reviewer, team roster, next actions, communication rules, and evidence ids.
- The project dashboard renders the `Kickoff Charter` so the manager can see what the team agreed to do after the meeting.
- `Run Manager Demo` seeds the same kickoff transcript, Leader campaign, Director confirmation, and Leader marker in one click for the manager walkthrough.
- The confirmation is posted into the decisions channel and project logs.

Status: covered for the prototype flow.

### Leader assignment through group chat

Evidence:

- `createLeaderAssignmentPackage` converts open project tasks into Leader-authored `@agent` assignment messages.
- Those assignment messages are appended to group chat after project creation.
- Every assignment also produces an immediate assignee acknowledgement with `assignmentReceipt`, showing the mentioned Agent saw the work and started it.
- Assignment logs are inserted into the project log and therefore appear on the project timeline.
- Assignment acknowledgement logs are also inserted into the project log as `assignment-acknowledged`.
- `handleLeaderChatAssignment` covers live group-chat assignment requests after kickoff: the confirmed Leader emits the actual `@agent` message, a new task is created, the mentioned Agent acknowledges immediately, and both events are logged.
- `submitChatInput` detects live Leader assignment requests, updates project tasks/logs/Agent state, and appends the Leader assignment plus acknowledgement into the active project chat.
- `handlePeerHandoff` covers Agent-to-Agent dependency handoffs after work has started: the requesting Agent emits an `@agent` dependency request, the peer acknowledges immediately, a dependency task is created, `peerHandoffs` records the accepted handoff, and both events are logged.
- Team state now preserves peer-management relationships with `peerManagedIds` and `peerManagerIds`, separate from the Director-confirmed Leader chain.
- The project dashboard now surfaces Leader-assigned tasks with owner, assignment source, work-pulse count, and timeline-published status.
- The project dashboard also surfaces accepted peer handoffs with requester, target, task, channel, request evidence, and acknowledgement evidence.
- Chat messages carry `projectId`, and the project chat view filters by active project plus channel, so assignments are visible in the correct project without cross-project leakage.

Status: covered.

### 24/7 work with visible progress

Evidence:

- `advanceAutonomousProjectCycle` and the app scheduler continue producing logs and autonomous ledger entries.
- `createAutonomousCycleChatMessages` converts those autonomous cycle events into project-scoped group chat records.
- The app scheduler appends due-cycle chat records even when the user did not manually press `Hour Pulse` or `Day Report`.
- Autonomous cycles now move owned tasks through visible work pulses and emit `task-completed` timeline logs when work reaches completion.
- Every autonomous cycle records each Agent's fixed work routine, including routine id, label, checklist, and expected artifact, so 24/7 work is typed by role instead of generic activity.
- `agentStates.currentPlan.routine` preserves the same routine evidence for the team panel, and peer handoff relations survive autonomous cycle state refreshes.
- Manual `Hour Pulse` and `Day Report` controls exercise the same work cycle.
- Project timeline now derives events from project logs when logs exist, so assignment, work pulse, and change events are visible in the large timeline view.
- Runtime-generated timeline events now use stable readable labels for project approval, Leader confirmation, assignments, acknowledgements, changes, work pulses, daily reports, and task completion.
- `Manager Demo Path` on the dashboard gives a direct path into kickoff chat evidence, Google Chat change simulation, and the evidence timeline.
- `Run Manager Demo` creates a fully populated scenario using the same runtime functions, including autonomous work cycles and task completion evidence.

Status: covered for local prototype runtime.

### Mid-project feature change

Evidence:

- `handleFeatureChangeRequest` creates a discussion sequence: Lead acknowledges, Reviewer challenges risk when present, responsible Agent confirms.
- The same protocol adds a responsible-owner plan sync after confirmation, so the owner explicitly tells everyone that the change entered their plan.
- That plan sync now updates the responsible owner's `agentStates` entry immediately, including inbox source channel, open obligation, task id, worklog, and `currentPlan` pointing at the accepted change.
- The same protocol returns `changeRecord`, which is stored in `changeLedger` with source channel, owner, reviewer, linked task, confirmation evidence, sync evidence, and plan update text.
- `handleFeatureChangeRequest` also returns a complete updated project state so group chat, Google Chat, and War Room paths persist the same owner-plan state transition.
- `submitChatInput` detects feature-change messages from group chat and invokes that protocol.
- The `Google Chat` channel uses the same path with `google-chat-mention-change-request` source metadata, preserving the channel where the request was made.
- `handleTerminalSubmit` detects feature-change messages inside the War Room meeting and invokes the same protocol.
- The confirmed change creates a new task and project log entries, which flow into chat and timeline.
- The project dashboard renders `Change Ledger` so manager review can inspect accepted mid-project changes without searching the raw chat stream.
- Autonomous cycles read only the active project's recent chat messages when deriving obligations.
- War Room change discussions are mirrored into meeting logs so the live meeting and group chat stay synchronized.

Status: covered.
