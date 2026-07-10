# Super Agent Production Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Hall of Fame Studio from a local deterministic product-team prototype into a trustworthy, production-grade Super Agent platform for learning, academic writing, investigation, technical work, and creative practice.

**Architecture:** Preserve the present React/Vite UI and deterministic runtime as an explicit local rehearsal mode. Add production capability only behind typed ports for identity, persistence, jobs, model/tool providers, artifact storage, and telemetry; a production readiness claim is derived from verified receipts from those ports, never from UI state or environment labels.

**Tech Stack:** React 18, Vite, Node.js ESM, existing agent runtime/API, Node test runner, Playwright, managed Postgres-compatible persistence, managed worker queue, object storage, OpenTelemetry-compatible telemetry, BYOK model/search adapters.

## Global Constraints

- Preserve existing local-MVP behavior and deterministic fallbacks unless a documented bug fix intentionally changes it.
- Never mark `readyForProduction` true from simulated, local, unsigned, or hand-authored receipts.
- Every externally visible write must have actor attribution, tenant/project scope, idempotency, audit evidence, and a tested failure outcome.
- Every autonomous action must be bounded by budget, time, tool grants, policy, and a human escalation path.
- Do not select a cloud vendor implicitly. Vendor selection remains a deployment decision; interfaces and contract tests must stay portable.
- Keep Chinese and English UX paths functionally equivalent.
- Each task must add focused `node:test` coverage first, then retain the smallest relevant existing contract/UI gate.
- Do not overwrite the current dirty working tree; commit each accepted task separately after reviewing its scoped diff.

---

## Production capability register: 50 concrete upgrades

The register is the acceptance scope. “Exists” means a local proof or partial contract already exists; it does **not** mean production-ready.

| # | Domain | Capability | Current position | Production acceptance proof |
|---|---|---|---|---|
| 1 | Truth | Environment classification | Partial local/managed labels | Signed environment attestation is required for a production claim |
| 2 | Truth | Capability registry | Scattered readiness receipts | One versioned registry maps each capability to owner, port, tests, SLO and launch state |
| 3 | Truth | Release gate | Local MVP gates | CI blocks a release unless required production receipts are fresh and verified |
| 4 | Identity | User authentication | Local/private contract | OIDC session lifecycle, rotation, logout and revoked-session tests |
| 5 | Identity | Tenant isolation | Project membership proof | Database-level tenant scoping and cross-tenant denial tests |
| 6 | Identity | Fine-grained authorization | Role checks | Policy decisions record subject, action, resource, reason and policy version |
| 7 | Identity | Service identity | Partial signed headers | Short-lived workload identities replace shared static worker credentials |
| 8 | Secrets | Managed secrets | Local encrypted vault | KMS/secret-manager rotation receipt and no-secret-in-log scan |
| 9 | Data | Durable relational persistence | File/memory adapter | Transactional database adapter with migration, backup and restore proof |
| 10 | Data | Schema migration safety | Migration plan/dry-run | Forward migration, rollback strategy and compatibility check run in CI |
| 11 | Data | Object artifacts | Local workspace paths | Encrypted object store, immutable version IDs, retention and malware scan receipt |
| 12 | Data | Audit integrity | Local JSONL hash chain | Central append-only audit stream with checksum verification and retention policy |
| 13 | Data | Privacy lifecycle | Settings-level policies | Export, delete, retention and legal-hold policy execute and are auditable |
| 14 | Data | Backup recovery | Not proved end-to-end | Restore drill meets declared RPO/RTO and is recorded as a release requirement |
| 15 | Jobs | Durable queue | Local shadow adapter | Real enqueue/lease/ack/nack/dead-letter implementation passes integration test |
| 16 | Jobs | Idempotency | In-memory/file proof | Duplicate delivery produces exactly one durable business effect |
| 17 | Jobs | Retry/backoff | Static retry model | Bounded exponential backoff with jitter, classification and retry budget |
| 18 | Jobs | Timeout/cancellation | Per-provider timeout partial | Cooperative cancellation propagates to work, tools, child tasks and user UI |
| 19 | Jobs | Scheduling | Local worker tick | Durable schedules survive restart, timezone changes and missed-tick recovery |
| 20 | Jobs | Dead-letter operations | Local receipt | Operator can inspect, redact, replay and resolve a dead-letter task safely |
| 21 | Reliability | Health/readiness/liveness | Startup readiness | Dependency-aware readiness plus degraded-mode contract and alert routing |
| 22 | Reliability | Rate/concurrency control | Provider limiter partial | Per-user, tenant, provider and tool limits reject safely with retry guidance |
| 23 | Reliability | Circuit breakers | Provider receipt partial | Provider outage opens circuit, serves bounded fallback and probes recovery |
| 24 | Reliability | Graceful shutdown | Not guaranteed | Drain window protects in-flight requests and releases/requeues leases safely |
| 25 | Reliability | Incident recovery | Runbook-shaped receipt | Tested incident drill covers detection, containment, recovery and postmortem ID |
| 26 | Observability | Structured logs | Console/local logs | Correlated, redacted JSON logs have request/project/task/trace identifiers |
| 27 | Observability | Traces | None end-to-end | One user request traces through API, queue, provider and artifact operations |
| 28 | Observability | Metrics/SLOs | Readiness counts | Latency, success, queue age, cost and quality SLOs trigger alert thresholds |
| 29 | Observability | Error reporting | Readiness-shaped | Deduplicated actionable errors include safe context and runbook link |
| 30 | Observability | Cost ledger | Provider usage partial | Token/tool/storage costs are attributable, budgeted and alertable per project |
| 31 | Agent safety | Tool grants | Project settings proof | Least-privilege grants, expiry, approval and immutable tool-use receipts |
| 32 | Agent safety | Prompt/data boundaries | Partial redaction | Untrusted content is labeled; secrets and instruction injection are blocked/tested |
| 33 | Agent safety | Human approval | Meeting/review workflow | Irreversible, high-cost and external side effects require policy-driven approval |
| 34 | Agent safety | Evaluation and quality | Deterministic contract tests | Versioned scenario/eval suite gates model, prompt, tool and policy changes |
| 35 | Agent safety | Model fallback | Deterministic fallback | Provider/model fallback is explicit, budget-aware, quality-labeled and visible |
| 36 | Team system | Team composer | Persona/role selection | Task decomposition selects required roles, explains fit, risks and coverage gaps |
| 37 | Team system | Delegation graph | Lead/reviewer protocol | Dependency DAG detects cycles, blocked owners, overdue work and escalation |
| 38 | Team system | Shared memory | Local project memory | Scoped, cited project memory with source/version/confidence/expiry controls |
| 39 | Team system | Handoffs/reviews | Transcript/review contracts | Every deliverable has owner, acceptance criteria, reviewer verdict and revision lineage |
| 40 | Team system | Autonomy governor | Bounded local loop | Per-project stop/pause/resume, duration/cost/tool limits and safe checkpoints |
| 41 | Learning | Study planner | Generic project flow | Syllabus-to-plan, adaptive practice, mastery evidence and learner-controlled pacing |
| 42 | Learning | Tutor safety | None domain-specific | Age/academic-integrity policy and uncertainty-aware explanations with citations |
| 43 | Writing | Research writing pipeline | Generic drafting | Outline, sources, claims, citations, style pass, plagiarism-risk review and revision trace |
| 44 | Writing | Citation integrity | Evidence-search packets | Claim-to-source graph detects missing, stale, contradictory and unsupported citations |
| 45 | Investigation | Investigation case workflow | Generic evidence flow | Hypotheses, chain of custody, source reliability, contradiction matrix and conclusion confidence |
| 46 | Investigation | Research safety | Provider boundary | Source policy, consent/PII controls and explicit no-claim-beyond-evidence guard |
| 47 | Technical | Software delivery workflow | Workspace/tool proof | Requirements-to-PR plan, sandboxed execution, tests, review, deploy gate and rollback plan |
| 48 | Technical | Engineering security | Local controls | Dependency/SAST/secret/permission checks enter risk ledger and block unsafe release |
| 49 | Creative | Creative studio workflow | Persona/artifact draft | Brief, references/licensing, iterations, critique, provenance and export-quality checks |
| 50 | Creative | Rights and provenance | Partial artifact metadata | Rights declaration, source attribution, generated-content provenance and export audit |

## Delivery sequence

The scope is intentionally split into six independently reviewable programs. No later program may convert an earlier local rehearsal artifact into production evidence.

1. Production truth, testability, and service seams: capabilities 1–3, 21, 26–30.
2. Identity, data, privacy, and security controls: capabilities 4–14, 31–35.
3. Durable asynchronous execution: capabilities 15–20, 22–25, 40.
4. Trustworthy team composition and collaboration: capabilities 36–39.
5. Five professional work modes: capabilities 41–50.
6. Deployment, operations, acceptance, and controlled rollout: all capabilities as a verified whole.

### Task 1: Freeze a production-truth baseline

**Files:**
- Create: `docs/PRODUCTION_CAPABILITY_REGISTER.md`
- Create: `src/agents/productionCapabilityRegistry.js`
- Create: `tests/productionCapabilityRegistry.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `scripts/report-public-production-readiness.mjs`

**Interfaces:**
- Produces: `buildProductionCapabilityRegistry({ environmentAttestation, capabilities, now })` returning `{ schemaVersion: 'production-capability-registry/v1', readyForProduction, capabilities, blockers }`.
- Consumes: existing production receipts and their checksum/attestation metadata; no UI label is a production fact.

- [ ] **Step 1: Write failing node tests for local, unsigned-managed, and signed-managed receipts.**

```js
assert.equal(registry.readyForProduction, false);
assert.equal(registry.blockers.includes('environment-attestation-missing'), true);
assert.equal(signedRegistry.capabilities.find((item) => item.id === 'durable-queue').evidenceStatus, 'verified');
```

- [ ] **Step 2: Run `npm.cmd test -- tests/productionCapabilityRegistry.test.mjs`; expect the module-not-found failure.**
- [ ] **Step 3: Implement the registry with a fixed list of the 50 IDs above; validate receipt schema, checksum, environment attestation and freshness before setting an item to `verified`.**
- [ ] **Step 4: Expose `GET /production-capabilities` through the existing API and embed its checksum in the public readiness report.**
- [ ] **Step 5: Run `npm.cmd test`, `npm.cmd run agents:public-production-readiness-report:validate`, and `npm.cmd run agents:product-team:production-evidence-integrity`; expect all to pass without a production-ready claim.**
- [ ] **Step 6: Commit only the listed files with `feat: add production capability registry`.**

### Task 2: Make state, identity, and artifacts durable by contract

**Files:**
- Create: `src/agents/productionPersistencePort.js`
- Create: `src/agents/productionArtifactPort.js`
- Create: `tests/productionPersistencePort.test.mjs`
- Create: `tests/productionArtifactPort.test.mjs`
- Modify: `src/agents/managedPersistenceAdapter.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:**
- Produces: `createProductionPersistencePort(config)` and `createProductionArtifactPort(config)`.
- Requires: tenant ID, actor ID, request ID, idempotency key, transaction boundary and retention classification on every write.
- Prohibits: the JSON file store, local workspace paths, or memory stores from advertising managed-production readiness.

- [ ] **Step 1: Add failing tests that reject writes without tenant/actor/idempotency context and prove cross-tenant reads are denied.**
- [ ] **Step 2: Add failing tests that require artifact checksum, immutable version ID, retention class and malware-scan status before an artifact is publishable.**
- [ ] **Step 3: Implement ports as vendor-neutral interfaces; keep file and memory adapters tagged `local-rehearsal`.**
- [ ] **Step 4: Add transaction/rollback and migration verification adapters, with an explicit `managed-driver-not-configured` result rather than a fake success.**
- [ ] **Step 5: Run `npm.cmd test`, `npm.cmd run agents:production-managed-persistence`, `npm.cmd run agents:production-data-governance`, and `npm.cmd run agents:production-access-control`.**
- [ ] **Step 6: Commit with `feat: add production persistence and artifact ports`.**

### Task 3: Replace shadow execution with durable job semantics

**Files:**
- Create: `src/agents/productionJobPort.js`
- Create: `tests/productionJobPort.test.mjs`
- Modify: `src/agents/workerQueueAdapter.js`
- Modify: `src/agents/agentProjectHttpServer.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `scripts/validate-production-managed-worker-queue-contract.mjs`

**Interfaces:**
- Produces: `enqueue(job)`, `lease(jobId)`, `ack(jobId, receipt)`, `nack(jobId, failure)`, `cancel(jobId)`, and `replay(deadLetterId)`.
- Job input: `{ idempotencyKey, tenantId, projectId, actorId, kind, deadlineAt, retryPolicy, traceContext }`.
- Job receipt: `{ schemaVersion: 'production-job-receipt/v1', status, attempt, leaseExpiresAt, traceId, businessEffectChecksum }`.

- [ ] **Step 1: Write failing tests for duplicate delivery, expired lease, retryable provider timeout, non-retryable policy denial, cancellation and dead-letter replay.**
- [ ] **Step 2: Run `npm.cmd test -- tests/productionJobPort.test.mjs`; expect failure before the port exists.**
- [ ] **Step 3: Implement the port and map the existing local-shadow queue to `local-rehearsal`; do not route a managed driver to shadow execution.**
- [ ] **Step 4: Propagate cancellation/deadline/trace context through autonomous project, agent, and autopilot routes.**
- [ ] **Step 5: Add an operator read model with safe payload previews, failure classification, replay approval and audit receipt.**
- [ ] **Step 6: Run `npm.cmd test`, `npm.cmd run agents:production-managed-worker-queue`, and `npm.cmd run agents:production-operations-startup`.**
- [ ] **Step 7: Commit with `feat: add durable job execution port`.**

### Task 4: Establish reliability, observability, and provider governance

**Files:**
- Create: `src/agents/telemetryPort.js`
- Create: `src/agents/reliabilityPolicy.js`
- Create: `tests/reliabilityPolicy.test.mjs`
- Modify: `src/agents/modelProvider.js`
- Modify: `src/agents/searchProvider.js`
- Modify: `src/agents/agentProjectHttpServer.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `docs/LAUNCH_READINESS_GATES.md`

**Interfaces:**
- Produces: `startSpan`, `recordMetric`, `recordError`, `recordCost`, `withReliabilityPolicy`.
- Reliability policy: timeout, bounded retry with jitter, circuit state, concurrency key, fallback permission, and user-safe error class.

- [ ] **Step 1: Write failing tests for provider timeout, circuit opening/recovery, budget exhaustion, concurrency rejection and redacted error events.**
- [ ] **Step 2: Implement a no-op local telemetry port and a configured external telemetry port; neither may leak prompts, secrets or raw attachment contents.**
- [ ] **Step 3: Wrap model/search calls with one shared reliability policy and emit trace/cost/quality labels into receipts.**
- [ ] **Step 4: Add project budget alerts and a degraded-mode UI/API response that tells the user whether to retry, wait, reduce scope or request approval.**
- [ ] **Step 5: Run `npm.cmd test`, `npm.cmd run agents:production-provider-controls`, `npm.cmd run agents:budget-alert-readiness`, and `npm.cmd run agents:error-reporting-readiness`.**
- [ ] **Step 6: Commit with `feat: add provider reliability and telemetry controls`.**

### Task 5: Make collaboration genuinely delegable

**Files:**
- Create: `src/agents/teamComposition.js`
- Create: `src/agents/teamMemoryPolicy.js`
- Create: `tests/teamComposition.test.mjs`
- Create: `tests/teamMemoryPolicy.test.mjs`
- Modify: `src/agents/agentRuntime.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/App.jsx`
- Modify: `src/i18n/locales/en.js`
- Modify: `src/i18n/locales/zh.js`

**Interfaces:**
- Produces: `composeTeam({ objective, workMode, constraints, availableAgents })` and a DAG of roles, owners, dependencies, reviewer coverage and escalation rules.
- Produces: scoped memory citations with `{ sourceId, version, confidence, expiresAt, accessScope }`.

- [ ] **Step 1: Write failing tests covering each of the five work modes, missing-role warnings, conflicting dependencies, reviewer independence and a blocked task escalation.**
- [ ] **Step 2: Implement capability-based team composition from the existing persona source of truth; do not create a second persona registry.**
- [ ] **Step 3: Implement a typed task DAG and enforce owner, acceptance criteria, reviewer, evidence and deadline fields before work is autonomous.**
- [ ] **Step 4: Add memory scope/expiry/citation policy and reject cross-project or expired memory reuse.**
- [ ] **Step 5: Add Manager controls for pause, resume, stop, spend/tool limits and approval requests; every action records an audit event.**
- [ ] **Step 6: Run `npm.cmd test`, `npm.cmd run agents:scenario`, `npm.cmd run agents:product-team:cycle-consistency`, and `npm.cmd run ui:real-user-zero-to-autonomy`.**
- [ ] **Step 7: Commit with `feat: add governed team composition and memory`.**

### Task 6: Deliver five professional work-mode contracts

**Files:**
- Create: `src/agents/workModes/learning.js`
- Create: `src/agents/workModes/academicWriting.js`
- Create: `src/agents/workModes/investigation.js`
- Create: `src/agents/workModes/technicalDelivery.js`
- Create: `src/agents/workModes/creativeStudio.js`
- Create: `src/agents/workModes/index.js`
- Create: `tests/workModes.test.mjs`
- Modify: `src/agents/teamComposition.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Each mode exports `{ id, requiredRoles, requiredArtifacts, policyChecks, acceptanceChecks, escalationChecks }`.
- All modes consume the shared team DAG, evidence/memory records, provider controls and durable job port; they must not bypass them.

- [ ] **Step 1: Write one failing acceptance test per mode: learning mastery plan; citation-backed writing; contradiction-aware investigation; tested technical change; rights-aware creative deliverable.**
- [ ] **Step 2: Implement learning planning with pacing, practice evidence, mastery and academic-integrity controls.**
- [ ] **Step 3: Implement academic-writing claim/citation/revision lineage and investigation hypothesis/source-confidence/contradiction matrices.**
- [ ] **Step 4: Implement technical-delivery requirements/test/review/rollback artifacts and creative brief/licensing/provenance/critique artifacts.**
- [ ] **Step 5: Add mode-specific red flags that force review instead of generating an unqualified final claim.**
- [ ] **Step 6: Run `npm.cmd test`, `npm.cmd run agents:product-team:research-sample`, `npm.cmd run agents:product-team:core`, and the browser gate.**
- [ ] **Step 7: Commit with `feat: add professional super-agent work modes`.**

### Task 7: Controlled production rollout and operational proof

**Files:**
- Create: `docs/OPERATIONS_RUNBOOK.md`
- Create: `docs/PRODUCTION_ACCEPTANCE.md`
- Create: `scripts/validate-production-super-agent-acceptance.mjs`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `README.md`
- Modify: `scripts/report-public-production-readiness.mjs`

**Interfaces:**
- Produces: a signed `super-agent-production-acceptance/v1` report with every capability ID, evidence links, known gaps, rollout stage, owner and expiry.
- Release states: `local-rehearsal`, `private-pilot`, `managed-staging`, `managed-production`; state promotion requires evidence from the matching environment only.

- [ ] **Step 1: Write a failing acceptance script that rejects any missing/expired/unattested capability evidence and any mode without an end-to-end scenario.**
- [ ] **Step 2: Document on-call ownership, SLOs, alert response, queue recovery, provider outage, data restore, security incident, rollout and rollback procedures.**
- [ ] **Step 3: Execute a managed-staging drill: restart during work, duplicate delivery, provider outage, budget cutoff, authorization revocation, artifact scan failure and restore test.**
- [ ] **Step 4: Capture real receipts, attach them to the registry, and run the complete acceptance report.**
- [ ] **Step 5: Run `npm.cmd test`, `npm.cmd run launch:gates`, `npm.cmd run agents:public-production-readiness-report:validate`, and `npm.cmd run validate-production-super-agent-acceptance` (or its package-script alias).**
- [ ] **Step 6: Commit with `docs: add super-agent production acceptance runbook`.**

## Verification matrix

| Gate | What it proves | What it cannot prove |
|---|---|---|
| `npm.cmd test` | Unit-level behavior and failure semantics | Real cloud service integration |
| Existing `agents:*` contracts | Runtime/API shape and local end-to-end behavior | Managed-production durability |
| Existing `ui:*` contracts | User-visible workflow and safe UI boundaries | Browser-independent SLOs |
| New port integration tests | Identity/persistence/queue/provider port contracts | A specific vendor’s operational SLA |
| Managed staging drills | Restart, outage, recovery and access behavior | Production traffic behavior |
| Signed acceptance report | Evidence-backed eligibility for controlled rollout | Permanent production safety |

## Self-review

- Coverage: all 50 capabilities map to Tasks 1–7; the five requested professional domains map directly to Task 6.
- Production truth: existing local proof remains valuable but cannot promote any item to production by itself.
- Scope safety: no vendor, legal policy, deployment account, or external credential is assumed; those are required inputs before Task 7 can succeed.
- Working-tree safety: this plan intentionally leaves pre-existing modified/untracked source files untouched.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-09-super-agent-production-upgrade.md`.

The executable route is inline, task-by-task implementation with a verification checkpoint after each task. I will begin with Task 1 after the current planning checkpoint; managed staging and the final production claim will require your deployment provider, identity, persistence, queue, object-storage, telemetry, and incident-response ownership decisions.
