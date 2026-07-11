# Local runtime observability

`npm run dev` and `npm run agents:server` now write a bounded local JSONL request stream. Every HTTP response includes `x-hofs-trace-id`; each local record contains only the trace ID, method, query-free path, status code, timestamp, and duration. Request bodies, authorization headers, local-auth tokens, provider keys, and query-string values are never written.

`GET /runtime-observability` returns a local, redacted summary with request count, client/server error counts, p50/p95 latency, recent events, and a `local-runtime-slo-status/v1` contract. The SLO contract contains the effective policy, current bounded window, persisted trend snapshots, and the active operator alert. When local authentication is required, a local security administrator session is required for this route as well.

Each completed request interval writes a `local-runtime-slo-snapshot/v1` row into the same bounded JSONL file. One warning window is treated as possible transient local load; the default policy requires two consecutive warning windows before an alert becomes active. A critical p95 or critical server-error-rate window alerts immediately. A healthy snapshot clears the consecutive breach chain. Alert recommendations distinguish observing the next window, inspecting slow/error routes before continuing, and pausing autonomous work for critical degradation.

## Local runtime errors

Unhandled HTTP exceptions are converted into `local-runtime-error-issue/v1` records before the server returns a generic response. The response contains only `agent-project-http-error`, a normalized error code, and the request trace id; the raw exception message and stack are never returned or persisted. A deterministic SHA-256 fingerprint uses only the normalized category, error code, method, and query-free path, so repeated occurrences update one issue rather than flooding the operator with duplicates.

`GET /runtime-errors` returns the bounded `local-runtime-error-registry/v1`. `POST /runtime-errors/:fingerprint/acknowledge` marks investigation ownership, and `POST /runtime-errors/:fingerprint/resolve` records recovery. If the same fingerprint occurs after resolution, it reopens with an incremented `reopenedCount`. Each issue retains the latest 20 redacted lifecycle transitions through JSONL compaction and restart. Submitted operator notes are redacted before persistence.

Every issue links a local runbook selected from its stable error code/category: Worker/lease failures link scheduler health and supervised tick routes, Provider failures link Provider transport guidance, security failures link the runtime security audit, and unknown failures link trace/health inspection. When strict local authentication is enabled, all error registry reads and transitions require a local security-administrator session.

For Agent work routes, the server-owned trace is also propagated into durable local task records. Inbound `x-hofs-trace-id` (or the compatibility `x-hofs-request-id`) is accepted only when it is 3-160 safe correlation characters; otherwise the server generates a local trace id. Every response returns both `x-hofs-trace-id` and a unique `x-hofs-span-id`. Active HTTP draining is keyed by span, so concurrent requests may intentionally share one trace without overwriting each other.

`GET /projects/:projectId/traces/:traceId` returns `local-project-trace/v2`: a content-minimized causal graph over durable queue, idempotent execution, Agent cycle, Provider, evidence, submission, artifact-storage, and independent-review evidence. Spans contain only ids, hashes, closed kind/status fields, timestamps, durations, and causal parent/link metadata. The graph checks duplicate ids, missing parents/links, cycles, project/trace mismatch, time reversal, and invalid root count. Each traced mutation seals the current span manifest into a bounded checksum-linked `local-trace-graph-receipt/v1` chain. A later submission review inherits the submission's task trace while a hash-only link records its distinct HTTP request trace. Body trace/span values cannot replace the server context.

The local chain can correlate a Provider call with its stored usage and receipt. If an external Provider accepts a side effect but does not return its own receipt or idempotency identifier, the graph reports an unattested Provider boundary and cannot independently prove the Provider-side outcome. There is no remote collector, cross-host clock guarantee, or distributed trace sampling claim.

Use these optional local environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AGENT_LOCAL_TELEMETRY_LOG` | `.tmp/agent-runtime-observability.jsonl` | Local JSONL destination. |
| `AGENT_LOCAL_TELEMETRY_MAX_RECORDS` | `500` | In-memory and rotated-file record limit. |
| `AGENT_LOCAL_TELEMETRY_MAX_FILE_BYTES` | `1000000` | Rotate the local stream above this size. |
| `AGENT_LOCAL_ERROR_MAX_ISSUES` | `100` | Latest deduplicated runtime error issues retained through compaction and restart. |
| `AGENT_LOCAL_SLO_WINDOW_SIZE` | `20` | Number of recent requests evaluated per SLO window. |
| `AGENT_LOCAL_SLO_SNAPSHOT_EVERY_REQUESTS` | `20` | Persist one trend snapshot after this many requests. |
| `AGENT_LOCAL_SLO_MIN_SAMPLES` | `10` | Samples required before classifying a window; capped at the window size. |
| `AGENT_LOCAL_SLO_WARNING_P95_MS` | `2000` | Warning threshold for local p95 request latency. |
| `AGENT_LOCAL_SLO_CRITICAL_P95_MS` | `10000` | Critical threshold that activates an alert after one completed window. |
| `AGENT_LOCAL_SLO_MAX_SERVER_ERROR_RATE` | `0.1` | Warning server-error ratio; twice this value is critical, capped at 1. |
| `AGENT_LOCAL_SLO_CONSECUTIVE_BREACH_WINDOWS` | `2` | Consecutive warning snapshots required for an active alert. |
| `AGENT_LOCAL_SLO_MAX_SNAPSHOTS` | `120` | Bounded trend snapshots retained across restart. |

The telemetry file is included in an encrypted `npm run local:backup` recovery bundle. This is a local diagnostic and recovery control, not cloud telemetry or a public-production observability claim.

`GET /local-runtime-health` is the compact operator entry point. It combines local store attachment, local-auth bootstrap state, telemetry error counts, the `latency-slo` check, active `runtime-errors`, scheduler state, secret-vault status, and the backup/recovery commands into one redacted `local-runtime-health/v1` response. A sustained/critical SLO alert or active unhandled issue changes runtime health to `attention-needed`. When strict local authentication is enabled, it requires a local security-administrator session.

Snapshots, alerts, and error issues recover from the local JSONL after restart and are included in the encrypted local backup path. This provides bounded single-machine trend and issue evidence; it does not deliver remote pages, guarantee wall-clock accuracy across hosts, or replace an on-call/incident system.
