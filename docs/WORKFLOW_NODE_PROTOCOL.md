# Workflow Node Protocol

## Product outcome

The Timeline is not a passive activity log. It is the durable, inspectable publication surface for Agent work. Every meaningful Agent action becomes a typed node with an author, intent, relationship context, description, evidence, and a semantic visibility level. Zoom changes the meaning density of the graph instead of only changing pixel size.

## 1. Node classification model

The protocol uses a stable family plus an open subtype:

- `family` controls color, icon, lane, default semantic level, and minimum required fields.
- `subtype` preserves the precise action (`joint-deliverable`, `idea-proposal`, `review-requested`, and future actions).
- Unknown subtypes are retained and assigned to the closest family. This is how the system covers future Agent behaviors without an impossible closed enumeration.

| Family | Representative subtypes | Meaning | Default level |
| --- | --- | --- | --- |
| `thinking` | idea, hypothesis, question, analysis, plan | An Agent externalized reasoning or a proposal | Activity |
| `self-marketing` | self-nomination, leader-campaign, capability-claim | An Agent argued for ownership or a role | Activity |
| `decision` | proposal, decision, approval, rejection, escalation | A choice changed the project path | Milestone |
| `confirmation` | acknowledge, confirm, sign-off, acceptance | A person explicitly accepted or confirmed state | Phase |
| `collaboration` | request, handoff, co-authoring, joint-work | Two or more people coordinated responsibility | Activity |
| `execution` | start, progress, change, block, resume, complete | Work moved through its operating state | Activity |
| `submission` | individual-submit, joint-submit, team-submit, revision, final-deliverable | One or more Agents published work for review | Phase |
| `summary` | meeting-summary, daily-report, phase-report, final-report | An Agent compressed prior work into a durable report | Phase |
| `review` | review-started, feedback, changes-requested, accepted | A Reviewer evaluated a submission | Phase |
| `communication` | message, mention, announcement, meeting-turn | Information was sent or discussed | Trace |
| `monitoring` | heartbeat, risk-check, quality-check, alert | Runtime or Agent observation reported health | Trace |
| `evidence` | research, citation, test-result, proof, attachment | Evidence supports another node | Activity |
| `recovery` | retry, rollback, incident, restore | The system or Agent recovered from failure | Phase |
| `governance` | assignment, permission, policy, launch-gate | Authority or operating rules changed | Milestone |

Submission authorship is orthogonal to family:

- Individual: one `committerId`.
- Joint: one primary committer plus one or more `coAuthorIds`.
- Team: multiple committers with explicit relationship roles.

## 2. Semantic time zoom

The graph has four semantic scales. The camera remains pointer-anchored and continuous; only node eligibility changes when a threshold is crossed.

| Scale | Semantic ceiling | Shows | Hides |
| --- | --- | --- | --- |
| Month / Outcome | Milestone | major decisions, governance gates, final outcomes, critical reports | routine work and evidence detail |
| Week / Phase | Phase | submissions, confirmations, reviews, summaries, recoveries | chat and heartbeat trace |
| Day / Activity | Activity | ideas, collaboration, execution, evidence | raw communication and monitoring trace |
| Hour / Trace | Trace | every retained node | nothing |

Urgency (`importance`) and abstraction (`semanticLevel`) are independent: a critical trace remains a trace, while a normal milestone remains a milestone. Explicit `semanticLevel` supplied by a trusted backend record wins over inferred defaults. The selected-node drawer remains open only while the node is visible; when a user zooms out past it, the graph should preserve its proof focus and restore selection when zooming back in.

Interaction requirements:

- Mouse wheel or trackpad performs continuous, pointer-anchored zoom.
- Slider offers an accessible equivalent and names the current semantic scale.
- Shift-wheel pans horizontally; drag pans freely.
- A scale guide states what entered or left the graph and shows `visible / total` counts.
- Node size changes at compact, medium, and expanded detail thresholds; semantic filtering is independent from card detail density.
- Same-time nodes branch vertically from one time column; they do not falsify ordering by spreading across the time axis.

## 3. Node detail anatomy

Every detail drawer contains:

1. Identity: family color, node logo, family, subtype, title, status, semantic level, timestamp.
2. Agent-authored description: why the node exists, what changed, and the expected next action. Runtime fallback text is visibly marked as generated.
3. Submission packet: intent, commit message, primary committer, co-authors, participants, and completeness score.
4. Relationship graph: typed roles around the node, including primary committer, co-committer, reviewer, participant, impacted person, and related Agent.
5. Attachments: artifact, transcript, timeline proof, ledger proof, test result, or evidence route.
6. Evidence and routes: exact backend proof/submission routes and chat/timeline exits.
7. Relationships: incoming/outgoing workflow edges and their meaning.
8. Manager actions: confirm, supersede, note, edit, or complete through existing backend receipts.

## 4. Agent submission intention

Every Agent work pulse retains a lightweight trace, but the contribution policy separately decides whether that trace represents a formal publication opportunity. The decision is one of:

- `submit`: a completed checkpoint, independent review, revision response, or management-state change is valuable now;
- `defer`: work is active but not reviewable yet, or an active submission already represents the same task;
- `decline`: monitoring found no meaningful change and publishing would only add noise.

Completed work may additionally publish a typed artifact submission. The runtime records why the Agent submitted, deferred, or declined instead of treating every pulse as motivation evidence. Caller-forced publication is labeled `explicit-publication-request` and does not count as autonomous intent in acceptance runs.

Required Agent-owned fields:

- `title`
- `description`
- `family` and `subtype`
- `intent`
- `commitMessage`
- at least one committer
- relationship roles for every listed person
- at least one attachment or proof reference

System-owned fields include id, timestamp, status, importance, semantic level, source, and checksums.

The quality receipt is `workflow-node-submission-quality/v1` and contains:

- field-by-field status
- `completenessScore` from 0 to 100
- `readyForTimeline`
- missing field ids
- authorship mode: `individual`, `joint`, or `team`
- counts for committers, relationships, attachments, and proof references

The contribution intent keeps the compatible `agent-workflow-node-intent/v1` schema and identifies the policy contract as `agent-contribution-intent/v1`. It records:

- decision and reason code;
- why the checkpoint is or is not valuable now;
- expected value and proposed family/subtype;
- primary author, co-authors, Reviewer, and typed relationship roles;
- evidence plan and required fields;
- duplicate risk and matching submission ids.

## 5. Acceptance metrics

A real task run passes this feature only when:

- every participating Agent produces at least one timeline submission;
- unfinished first pulses are deferred rather than counted as submissions;
- at least one idle monitoring pulse is explicitly declined;
- at least one completed task creates a typed artifact submission;
- every published node has title, description, family, subtype, intent, and commit message;
- every published node has a primary committer and typed relationship role;
- joint work preserves all co-authors and renders them in the relationship graph;
- every node has an attachment or proof reference;
- every quality receipt reports `readyForTimeline: true` and score at least 85;
- every `submit` intent converts into a formal Timeline node, review, revision, or artifact;
- no `defer`, `decline`, or high-duplicate-risk opportunity creates a formal publication outcome;
- autonomous joint work derives co-authors from task ownership metadata without caller-supplied submission controls;
- Month, Week, Day, and Hour views form a monotonic sequence: each finer scale contains every node from the coarser scale plus optional additional nodes;
- node detail exposes the same authorship, relationship, attachment, and proof data returned by the backend read model.

This is a local/private MVP contract. It does not claim that an Agent has human motivation or consciousness; “submission intention” means an explicit runtime decision, recorded reason, and observable publication behavior.
