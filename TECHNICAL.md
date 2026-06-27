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

In the current prototype, this appears mainly in:

- role clarification
- self-nomination
- Leader campaign turns
- Agent worklog summaries
- management-priority reasons

Target direction:

- expose self-marketing turns as first-class flow graph nodes
- attach each pitch to a proposed owner, task, artifact, or decision
- let the manager inspect which Agent proposed what, who heard it, and whether it became accepted work

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
- `managerFlowGraph`: manager-readable graph projection.
- `managerDashboard`: aggregate manager read model.
- `readinessProofMap`: proof routes back to chat, timeline, tasks, events, and Agent dashboards.

The next step is to make Agent submissions explicit instead of inferring them from logs and messages.

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

### 3.3 Flow Graph Node Categories

The manager flow graph should distinguish:

- intent nodes: Director brief, meeting intent, change request
- self-marketing nodes: role pitch, Leader campaign, ownership proposal
- coordination nodes: assignment, handoff, blocker, queue item
- execution nodes: work pulse, artifact draft, submission
- review nodes: Reviewer challenge, evidence request, approval
- evidence nodes: chat proof, timeline proof, workspace file, ledger event

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

### 5.4 API and HTTP Server

The API layer is HTTP-shaped and can be mounted behind a real backend.

Main files:

- `src/agents/agentProjectApi.js`
- `src/agents/agentProjectHttpServer.js`
- `scripts/agent-project-server.mjs`

Important route groups:

- `/kickoff-meetings`
- `/projects/:id/chat`
- `/projects/:id/meeting`
- `/projects/:id/autonomous-cycle`
- `/projects/:id/agents/:agentId/work-cycle`
- `/workers/autonomous/due`
- `/workers/agents/due`
- `/projects/:id/manager-dashboard`
- `/projects/:id/manager-flow-graph`
- `/projects/:id/readiness-proof-map`
- `/projects/:id/transcripts`
- `/projects/:id/tasks/:taskId/evidence`

### 5.5 Local Workspace Runtime

The local runtime binds a project to a workspace folder and can expose:

- project memory folders
- workspace file list/read/write/delete
- explicitly allowed command execution
- project archive output

Main file:

- `src/agents/localProjectRuntime.js`

Command execution must remain disabled by default and allowlisted when enabled.

### 5.6 Model Provider Layer

The model provider is BYOK-oriented and currently optional.

Main file:

- `src/agents/modelProvider.js`

Design direction:

- deterministic fallback remains available for validation
- configured model calls enrich kickoff meetings and runtime intent
- provider failures should not erase saved meetings or project state
- production deployments must manage secrets outside browser state

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
- manager dashboard and flow graph projections
- event ledger and proof-map surfaces
- Harness coverage for the manager scenario

### Still needed for product-grade implementation

- first-class Agent submission node storage
- richer flow graph editing, filtering, and review states
- production queue infrastructure
- database-backed persistence
- authentication and workspace permissions
- BYOK secret isolation
- LLM retry, validation, and cost controls
- long-running observability and recovery
- exportable project archive with all submissions, transcripts, and evidence

## 8. Design Rule

Every new Agent capability should answer three questions:

1. What intent or obligation caused this action?
2. What artifact or decision did the Agent produce?
3. Where can the manager verify the proof?

If the answer cannot be represented in chat, timeline, event ledger, task evidence, Agent dashboard, or flow graph, the feature is not yet operationally complete.
