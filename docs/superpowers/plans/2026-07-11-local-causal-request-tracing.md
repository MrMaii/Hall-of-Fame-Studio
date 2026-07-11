# Local Causal Request Tracing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. This thread executes inline because autonomous continuation is authorized and delegation was not requested.

**Goal:** Upgrade capability 27 from exact trace-id grouping to a production-style, content-minimized, integrity-verifiable local causal trace graph across HTTP, Agent work, Provider use, evidence, artifact, review, and asynchronous durable work.

**Architecture:** Normalize untrusted inbound trace context at the HTTP boundary and assign a unique request span id even when callers reuse one trace id. Materialize deterministic content-free spans from durable business evidence, verify parent/link topology, and append checksum-linked trace graph receipts after traced mutations. The trace query returns only span/evidence manifests, latency/status, integrity, gaps, and checksums—not business content. Durable queue and idempotent execution rows become causal links rather than disconnected same-string matches.

**Tech Stack:** Existing local HTTP/API/service/file store, Node SHA-256, project ledgers, Node.js `node:test`.

## Global Constraints

- Pure local only; no OTLP collector, SaaS telemetry, distributed clock claim, or cross-host sampling claim.
- Inbound trace values are untrusted correlation metadata: validate format/length and generate a safe local id when invalid.
- Every accepted HTTP request gets a unique span id; repeated trace ids cannot overwrite active request tracking.
- The server-owned trace/span context overrides body fields.
- Trace output is content-minimized: ids, hashes, closed status/kind fields, timestamps, durations, counts, and routes only.
- Parent/link topology must fail integrity on missing parents, duplicate span ids, cycles, project mismatch, time reversal, or receipt-chain mutation.
- A review may continue the original submission trace while retaining a hashed link to its distinct HTTP request trace.
- External Provider completion remains independently provable only when its response/receipt/idempotency evidence is present.

### Task 1: Safe HTTP trace context and concurrent request identity

**Files:**
- Modify: `src/agents/agentProjectHttpServer.js`
- Modify: `src/agents/localTelemetryPort.js`
- Modify: `tests/localTaskTraceChain.test.mjs`

- [x] Validate/bound inbound trace ids, generate safe fallbacks, emit `x-hofs-trace-id` plus `x-hofs-span-id`, and pass server-owned context into the API.
- [x] Key active requests by unique span id so concurrent reuse of one trace id remains independently drainable.
- [x] Persist only redacted trace/span metadata and query-free routes in runtime telemetry.

### Task 2: Content-minimized causal graph and integrity receipts

**Files:**
- Create: `src/agents/localTraceGraph.js`
- Create: `tests/localTraceGraph.test.mjs`
- Modify: `src/agents/agentProjectService.js`

- [x] Materialize deterministic server/internal/client/queue spans from exact durable evidence with parent/link/status/time/duration metadata.
- [x] Verify topology and source-proof coverage, expose missing-stage/Provider-boundary diagnostics, and reject receipt-chain tampering.
- [x] Append checksum-linked graph receipts after traced Agent work and review; preserve idempotency and restart verification.

### Task 3: Private API, P0 gate, and total verification

**Files:**
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`
- Modify: `docs/LOCAL_RUNTIME_OBSERVABILITY.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Create: `scripts/validate-local-causal-request-tracing.mjs`
- Modify: `package.json`
- Modify: launch/checklist validators and docs

- [x] Return `local-project-trace/v2` as a content-free causal graph with integrity, receipt history, gaps, and async links.
- [x] Keep Manager/security reads private and prove body trace/span spoofing cannot replace server context.
- [x] Register `npm run agents:local-causal-request-tracing`, mark #27 verified with explicit local-only boundaries, and run focused/full/build/bundle/all-50/five-mode/release/smoke/diff gates.

## Self-review

- This deepens the existing trace propagation rather than introducing a second remote observability stack.
- The trace graph reports external Provider ambiguity instead of converting correlation into an outcome guarantee.
