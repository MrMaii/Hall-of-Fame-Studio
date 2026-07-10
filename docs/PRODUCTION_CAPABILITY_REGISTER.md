# Production Capability Register

This register is the production truth boundary for Hall of Fame Studio. It turns the 50-item Super Agent upgrade program into one machine-readable decision surface.

## What this prevents

- A local rehearsal, an environment variable, a UI badge, or an unsigned JSON receipt cannot claim production readiness.
- A capability cannot be verified without a managed-production environment attestation, a receipt ID, a receipt checksum, and an unexpired evidence record bound to that attestation.
- The registry remains blocked when any one of its 50 capabilities is missing, stale, local-only, or externally unattested.

## Contract

The runtime exposes `GET /production-capabilities` with `production-capability-registry/v1`.

The response contains only redacted attestation metadata and capability receipt identifiers/checksums. It never returns attestation signatures, secrets, credentials, provider keys, or endpoints.

`readyForProduction` is true only if all of these are true:

1. The environment attestation is schema-valid, checksum-bearing, signature-verified, unexpired, and explicitly for `managed-production`.
2. Every one of the 50 capabilities has a `verified` evidence record.
3. Every evidence record has an ID, checksum, matching attestation ID, explicit verified status, and unexpired lifetime.

## Capability scope

The full numbered list, acceptance proofs, ownership boundaries, and staged implementation order are in [the Super Agent production implementation plan](superpowers/plans/2026-07-09-super-agent-production-upgrade.md).

The current public-production operator report embeds a redacted summary and links the route. Run `npm.cmd run agents:public-production-readiness-report:validate` to check that environment-only configuration remains fail-closed.
