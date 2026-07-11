# Local provider transport reliability

Model and search adapters now protect each direct local provider call with a small, in-process transport policy. This is separate from the project service's existing project-scoped permissions, budgets, retry ledger, and provider-use circuit breaker.

- Each adapter queues work above its local concurrency limit.
- Retryable transport failures (`408`, `409`, `425`, `429`, `5xx`, network failures, and timeouts) can use a bounded adapter retry budget.
- Repeated retryable failures open an adapter-local circuit. After cooldown, exactly one half-open probe is allowed; a success closes the circuit.
- A supplied caller abort signal no longer disables the adapter's own timeout.
- `GET /llm/status` and `GET /search/status` include redacted `transportReliability` state. No request text, API key, or upstream error body is stored in that state.

The adapter retry budget defaults to `0`. Project workflows already apply their own policy-controlled retry budget and write project audit receipts; leaving the adapter default at zero prevents a project retry from multiplying external calls. Direct adapter calls (including explicit health tests) still get queueing, timeout cancellation, and circuit protection.

Optional local-only environment variables:

| Model | Search | Meaning |
| --- | --- | --- |
| `MODEL_TRANSPORT_MAX_RETRIES` | `SEARCH_TRANSPORT_MAX_RETRIES` | Extra direct-adapter retries; default `0`. |
| `MODEL_TRANSPORT_RETRY_BACKOFF_MS` | `SEARCH_TRANSPORT_RETRY_BACKOFF_MS` | Comma-separated retry waits, capped at 5 seconds each. |
| `MODEL_TRANSPORT_CIRCUIT_FAILURE_THRESHOLD` | `SEARCH_TRANSPORT_CIRCUIT_FAILURE_THRESHOLD` | Consecutive retryable failures before opening; default `3`. |
| `MODEL_TRANSPORT_CIRCUIT_FAILURE_WINDOW_MS` | `SEARCH_TRANSPORT_CIRCUIT_FAILURE_WINDOW_MS` | Failure lookback window; default 15 minutes. |
| `MODEL_TRANSPORT_CIRCUIT_COOLDOWN_MS` | `SEARCH_TRANSPORT_CIRCUIT_COOLDOWN_MS` | Open-circuit cooldown; default 5 minutes. |

All behavior runs in the local Node process. No telemetry, queue, or incident data is sent to a cloud service.

## Project cost forecast and overage approval

`GET /projects/:projectId/budget-alert-readiness` now combines the settled Provider usage ledger with the project budget. Its `local-provider-cost-forecast/v1` divides observed UTC-day cost by the elapsed fraction of the UTC day and projects that burn rate to 24 hours. The result is explicitly marked `estimateOnly`; fewer than three dispatched usage rows is low confidence, three through nine is medium, and ten or more is high. A projection at 80% of the daily budget is a warning; a projection at or above the budget is critical. Policy-denied rows remain in audit totals but do not count as Provider dispatch/cost burn.

Critical work may use `POST /projects/:projectId/provider-budget-approvals`. An approval must bind an exact operation, an approving local user, optional Agent id, positive extra cost and/or request limits, and an expiry within 24 hours. `GET /projects/:projectId/provider-budget-approvals` exposes remaining/reserved/consumed headroom. `POST /projects/:projectId/provider-budget-approvals/:approvalId/revoke` removes unused authority.

The approval is not a flag that disables policy. It can remove only daily-budget or hourly-request denials; provider/model allowlists, Agent tool grants, circuit breakers, network policy, authentication, and authorization still apply. Provider reservation and approval headroom are occupied in one project save. Failed/cancelled transport releases that provisional headroom, while settled work consumes actual cost and one approved request. Exhausted, expired, or revoked approval remains visible and cannot dispatch new work after restart.

These controls govern one local project store. They do not claim consolidated billing across machines, exchange-rate reconciliation, Provider invoice authority, remote finance approval, or centralized cost alert delivery.

## Temporary Agent tool grants

The baseline `project-tool-grant-policy/v1` remains the project's durable allowlist. A Manager or security administrator can add a narrow exception with `POST /projects/:projectId/tool-grant-leases`; `GET /projects/:projectId/tool-grant-leases` returns `local-tool-grant-governance/v1`, and `POST /projects/:projectId/tool-grant-leases/:leaseId/revoke` removes unused authority. A lease must bind one supported operation, one existing Agent, an optional exact task, the granting local user, a redacted purpose, one to 100 attempts, and an expiry within 24 hours. It never edits the baseline policy.

A matching lease removes only `agent-tool-grant-missing`. Provider and model allowlists, project membership, route authorization, budgets, hourly request limits, network restrictions, and circuit breakers still fail closed. One invocation is provisionally occupied in the same file-store save as the Provider budget reservation. A dispatched attempt consumes it whether the Provider succeeds, fails, or is cancelled; a policy denial before dispatch consumes none. If the process stops while a reservation is active, the lease derives its effective reserved count from unexpired Provider reservations, so expired crash residue releases automatically after restart.

Every Provider decision writes a `local-tool-invocation-receipt/v1`. The receipt records only project/trace/usage ids, Agent/task/operation scope, authorization source, lease id/checksum when applicable, outcome, timestamps, the previous receipt checksum, and its own checksum. It never contains the prompt, query, result body, credentials, or Provider error body. Public APIs provide no receipt update or delete operation. Readback verifies each checksum, adjacent previous-checksum links, and unexpected fields; corruption reports `degraded` rather than silently trusting the chain.

This is tamper-evident governance for one local project file, not hardware-backed immutability or cross-machine IAM. `npm run agents:local-tool-grants` proves denial, bounded dispatch, exhaustion, redaction, chain integrity, file persistence, and restart behavior without contacting a remote Provider.

## Prompt and untrusted-data boundary

Model artifact drafting now separates `trustedInstruction` from all context data. Project/task descriptions, evidence queries and purposes, Provider findings, source titles and summaries, prior artifact summaries, and review comments are emitted only as `local-untrusted-content-envelope/v1` rows labeled `UNTRUSTED_DATA`. Every envelope has a citation id and SHA-256 content checksum. The model system message explicitly forbids treating envelope text as instructions and requires evidence references to use citation ids.

Before dispatch, local deterministic inspection applies Unicode normalization, removes zero-width controls, and detects English/Chinese instruction override, system/developer impersonation, secret exfiltration, tool/approval bypass, hidden role delimiters, encoded-execution requests, and common raw credential forms. A critical match replaces the content with `[QUARANTINED_UNTRUSTED_CONTENT]`; the original content is not present anywhere in the model request. Review-only language can remain included as quoted data with risk signals, because discussion of prompt injection is not automatically an attack.

Each dispatched artifact-model request produces `local-prompt-boundary-receipt/v1`. The receipt retains only origin ids/types, citation ids, decisions, signal names, content lengths/checksums, aggregate counts, and its own SHA-256 checksum—never safe or malicious context text. Provider usage and the artifact draft bind the same receipt id/checksum. `GET /projects/:projectId/prompt-boundary-readiness` verifies receipts, summarizes quarantined model context and Evidence Source Safety decisions, and is embedded in Manager Ready Package and Provider Readiness. Receipt corruption produces `degraded` rather than silently passing.

Evidence Source Safety uses the same detector. Critical injected sources become `blocked` with `promptBoundaryDecision: quarantined`, while benign sources retain their existing quality, snapshot, provider-receipt, and review flow. The original evidence record may remain locally visible for human incident review; quarantine specifically guarantees it does not cross into the model prompt or the content-free boundary receipt.

This deterministic layer reduces common prompt-injection risk but cannot prove semantic safety against every language/model attack. Cross-model adversarial evaluation, managed policy distribution, hardware-backed immutable audit, and centralized incident response remain explicit non-local production controls. `npm run agents:prompt-boundary` validates physical prompt absence, citation isolation, receipt redaction/integrity, Manager proof, file persistence, and restart behavior using only fake local Providers.

## Unified local action approvals

High-cost and irreversible operations now share `GET|POST /projects/:projectId/action-approvals` and `POST /projects/:projectId/action-approvals/:approvalId/decisions`. The backend owns a closed action registry for project deletion, Provider budget overage, dead-letter replay, external artifact export, and external workspace writes. A caller cannot lower risk, irreversibility, role coverage, decision count, or the 24-hour maximum expiry. Requests require an exact action key, requester, reason, and idempotency key; identical retries return the original record and conflicting reuse fails closed.

Critical project deletion requires two different people covering Manager and security-admin, and the requester cannot approve their own request. Decisions are append-only and checksummed; rejection is terminal, expiry fails closed, and tampering changes the governance row to `integrity-invalid`. Approval metadata stores no prompt, project content, Provider payload, credential, or privacy confirmation token.

Deletion retains its independent one-time confirmation token. After confirmation, the service still requires an approved `privacy:project-delete` record whose project and action key exactly match the deletion request. Before purge it persists a checksummed `local-action-approval-execution-claim/v1`; after project removal, the residual-boundary tombstone carries the approval and decision checksums plus that claim. Only a hash of the execution key is persisted. If the process fails after claiming but before purge, only the same execution key can resume the claim; a different execution cannot reuse it. `npm run agents:action-approvals` proves denial, independent approval, restart recovery, exact execution, and tombstone proof entirely on the local machine. This does not provide cross-host consensus, hardware-backed signatures, or a SaaS approval queue.

## Model generation degradation provenance

Artifact generation no longer treats every locally available draft as the same kind of output. A successful model Provider response is labeled `model-provider-output`; a requested model that is denied by policy/budget, blocked by the circuit breaker, unavailable, or fails transport becomes `requested-model-fallback`; `useModel=false` becomes `explicit-local-template`. Only the first mode sets `modelUsed=true`.

Every path writes a content-free `local-model-generation-provenance/v1` receipt. Requested failures use the closed codes `policy-denied`, `circuit-open`, `budget-denied`, `provider-unavailable`, or `transport-failed`. Raw Provider errors, prompts, model output, instructions, project content, and credentials are not copied into the receipt. The receipt records a quality tier/ceiling and requires human review; generated submissions are forced to `submitted` plus `pending-review` even if a caller asks for `completed` or `accepted`.

`GET /projects/:projectId/model-degradation-readiness` verifies receipt checksums after restart and summarizes model, fallback, template, reason, and integrity counts. It has no receipt mutation/delete route. Kickoff meetings retain their separate `kickoff-generation-provenance/v1` because meeting provenance and artifact-output provenance have different lifecycle owners. `npm run agents:model-degradation` proves the local artifact path without claiming that a template is semantically equivalent to a model result or that either is ready for public production.
