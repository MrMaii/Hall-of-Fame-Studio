# Local runtime observability

`npm run dev` and `npm run agents:server` now write a bounded local JSONL request stream. Every HTTP response includes `x-hofs-trace-id`; each local record contains only the trace ID, method, query-free path, status code, timestamp, and duration. Request bodies, authorization headers, local-auth tokens, provider keys, and query-string values are never written.

`GET /runtime-observability` returns a local, redacted summary with request count, client/server error counts, p50/p95 latency, and recent events. When local authentication is required, a local security administrator session is required for this route as well.

Use these optional local environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AGENT_LOCAL_TELEMETRY_LOG` | `.tmp/agent-runtime-observability.jsonl` | Local JSONL destination. |
| `AGENT_LOCAL_TELEMETRY_MAX_RECORDS` | `500` | In-memory and rotated-file record limit. |
| `AGENT_LOCAL_TELEMETRY_MAX_FILE_BYTES` | `1000000` | Rotate the local stream above this size. |

The telemetry file is included in an encrypted `npm run local:backup` recovery bundle. This is a local diagnostic and recovery control, not cloud telemetry or a public-production observability claim.
