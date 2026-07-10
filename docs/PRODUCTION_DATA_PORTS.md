# Production Data Ports

`src/agents/productionDataPorts.js` defines the narrow boundary that a managed database and object store must satisfy before Hall of Fame Studio can write customer work in production.

## Required write context

Every write carries `tenantId`, `projectId`, `actorId`, `requestId`, `idempotencyKey`, and `retentionClass`. Missing metadata is rejected before a storage operation starts.

## Persistence port

`createProductionPersistencePort` requires a managed adapter with a transaction function. It records actor/project context in each receipt, serializes concurrent work by idempotency key, returns a duplicate receipt rather than replaying a committed effect, and returns a redacted failure classification when the transaction fails.

## Artifact port

`createProductionArtifactPort` requires managed `scan` and `putImmutable` operations. It refuses artifacts lacking an ID, content checksum, or media type; it never writes an artifact whose scan did not pass; and it publishes only an encrypted, immutable version with a retention class.

## Current status

These are production-facing contracts, not a managed storage implementation. Local/file/shadow adapters remain `local-rehearsal`, and an absent managed adapter is explicitly `managed-driver-not-configured`. A later cutover task must connect a real managed database and object store, execute the integration suite against them, and attach signed evidence to the production capability registry.
