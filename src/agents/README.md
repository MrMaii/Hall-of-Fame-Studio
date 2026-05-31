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
- `advanceAutonomousProjectCycle`: turns that cycle into a project-state update with logs, task touches, task-completion events, progress movement, and a `lastAutonomousRunAt` timestamp.

In a real backend, an hourly or daily worker would call `advanceAutonomousProjectCycle`, persist the returned project state, then optionally call the configured BYOK model provider only for Agent plans that actually need generation.

The current React app already exercises the same contract:

- Projects can set `autonomy.enabled` and `autonomy.cadence`.
- The workspace periodically checks whether a project is due for its next cycle.
- The project dashboard exposes `Hour Pulse` and `Day Report` controls for immediate verification.
- Cycle output is written into project logs, task state, task-completion logs, progress, `lastAutonomousRunAt`, and project-scoped group chat records.
- Each cycle also writes `agentStates`: per-Agent manager relation, inbox, open obligations, current plan, owned task ids, private worklog, status, and last active timestamp.
- Each Agent has a fixed work routine derived from its role capability. Autonomous cycles store the routine label, checklist, and expected artifact in both `agentStates.currentPlan.routine` and `autonomousLedger.agentPlans`.
- Approved kickoff meetings write a structured `kickoffCharter` so the project has a durable starting agreement before autonomous work begins.
- The project dashboard exposes a `Manager Demo Path` that jumps directly to kickoff chat evidence, a Google Chat change-request simulation, and the evidence timeline.
- The same path can prefill a live Leader assignment request; submitting it makes the confirmed Leader post the actual `@agent` assignment and makes the assignee acknowledge immediately.
- The project dashboard renders the `Kickoff Charter` with meeting result, Leader, Reviewer, next actions, and communication rules.
- The project initiation meeting step renders the runtime-generated kickoff transcript directly, including the Director brief, Agent role questions, self-nominations, and Leader campaign turns before the manager confirms the result.
- The project dashboard renders a `Change Ledger` with change source, owner, reviewer, confirmation status, linked task, and owner plan sync.
- Active task rows show the responsible owner, Leader assignment marker, source channel, work-pulse count, and timeline publication marker.
- Team rows show each Agent's independent state, including manager/managed relationship, peer-managed dependency relationship, status, current plan, inbox count, and worklog count.
- `Peer Handoffs` shows accepted Agent-to-Agent dependency requests with requester, target, task, channel, request evidence, and acknowledgement evidence.
- Confirmed feature changes update the responsible owner's Agent state immediately: the source channel enters inbox, the change task enters obligations and task ids, and `currentPlan` points at the accepted change before the next autonomous cycle.
- The global dashboard exposes `Run Manager Demo`, which seeds the full requested scenario using the same runtime functions: kickoff role negotiation, Leader election, Director confirmation, Leader `@agent` task assignment, Google Chat change request, autonomous work cycles, task completion, and timeline evidence.
- Chat messages are project-scoped with `projectId`; channel views and autonomous message reading only use the active project's messages so manager-demo evidence does not bleed into other projects.
- Project state, chat messages, and the autonomous ledger are persisted in browser `localStorage` for the prototype. A production backend should replace this with an append-only project ledger table or local file store using the same cycle shape.
- The project dashboard also renders the current Lead, Reviewer, kickoff frame, and recurring sync frame so the team governance model is visible instead of hidden inside runtime code.

The autonomous ledger stores:

- cycle id
- cadence
- run timestamp
- lead id
- published event count
- per-Agent priority, read count, obligation count, and publish status
- per-Agent status derived from the persisted `agentStates`
- per-Agent fixed work routine id, label, checklist, and expected artifact
- communication diagnostics showing which Agent read, spoke, ignored, or accepted an obligation, with attention score and reason

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
- `advanceAutonomousProjectCycle`: applies an autonomous cycle to project state.
- `createAutonomousCycleChatMessages`: converts autonomous work cycles into project-scoped group chat records.
- `isFeatureChangeRequest`: detects English and Chinese feature-change requests.
- `handleFeatureChangeRequest`: turns group chat, Google Chat, or meeting change requests into discussion, confirmation, task, owner sync, change ledger, and timeline records.
- It also returns a fully updated project state with owner plan sync persisted into `agentStates`.
- `evaluateCollaborationState`: checks whether the team still satisfies collaboration invariants.
- `buildAgentChatReplies`: adapts work communication into UI chat messages.

## Verification

- `npm run agents:scenario` validates the manager scenario data path in Node: kickoff role clarification, self-nomination, visible initiation meeting transcript, structured kickoff charter, Leader election, confirmed `isLeader` governance, kickoff Leader `@agent` assignment, live group-chat Leader assignment, Agent-to-Agent peer handoff, assignee acknowledgement, Google Chat change discussion, change ledger, responsible-owner sync, autonomous work progress, autonomous group chat records, per-Agent state persistence, task completion, and timeline logs.
- `npm run build` verifies the React/Vite app still compiles with the same runtime.
