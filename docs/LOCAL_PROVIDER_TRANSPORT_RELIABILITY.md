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
