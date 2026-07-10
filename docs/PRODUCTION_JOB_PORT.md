# Production Job Port

`src/agents/productionJobPort.js` defines the managed-queue contract required for autonomous work that may outlive a web request.

Each job must name its tenant, project, initiating actor, idempotency key, work kind, deadline, and bounded retry policy. The port refuses malformed/expired jobs and refuses all work when a managed queue adapter is absent.

The contract supports delayed availability, lease acquisition, acknowledgement, cancellation, retry scheduling with capped exponential backoff, dead-letter routing, and human-approved replay. A duplicate enqueue returns the original receipt rather than creating a second business effect.

This is deliberately not a queue implementation. The existing local-shadow adapter remains rehearsal-only. Production cutover requires a managed adapter implementing all seven operations, integration proof for lease expiry/recovery, and signed evidence attached to the production capability registry.
