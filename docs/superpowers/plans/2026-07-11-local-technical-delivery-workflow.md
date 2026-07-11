# Local Technical Delivery Workflow Plan

**Goal:** Upgrade capability 47 from artifact-name acceptance into a pure-local, restart-safe technical delivery ledger that fails closed before release evidence can be issued.

**Architecture:** Add a small pure module for immutable plan, verification, independent review, and local release receipts. Persist those receipts on the existing project file store, expose one private project route, and derive readiness only from checksum-valid, correctly linked receipts. This does not deploy to a cloud or execute arbitrary shell commands.

**Success criteria:**

- A delivery plan binds unique requirements, acceptance criteria, the intended change, risk, and a concrete rollback strategy.
- Verification binds an exact implementation revision, covers every requirement, records passed test evidence, and includes a successful rollback rehearsal; medium/high risk also requires passed security evidence.
- Review is performed by someone other than the implementer and plan author, binds the exact revision and verification checksum, and must approve with no blocking findings.
- A local release receipt can be created only from the current valid chain and only once for an exact local target/version.
- Missing coverage, failed tests, self-review, untested rollback, security gaps, stale links, time regression, duplicates, or checksum tampering fail closed.
- The route remains private, file-backed restart preserves the projection, and release-readiness gates run the dedicated P0 validator.

## Task 1: Pure delivery ledger

- [x] Write failing unit tests for plan validation, traceability, test/security/rollback gates, independent review, exact revision links, release uniqueness, time ordering, and tamper detection.
- [x] Implement `localTechnicalDelivery.js` with versioned receipts and a deterministic read model.
- [x] Run the focused unit tests green.

## Task 2: Local service and API

- [x] Write a failing file-backed API test for the full plan -> verification -> review -> release chain and all mandatory release blockers.
- [x] Add project persistence signatures, service methods, deferred route, API dispatch, and private access policy.
- [x] Prove idempotency, restart recovery, role separation, and fail-closed behavior after ledger tampering.

## Task 3: P0 and release evidence

- [x] Add `agents:technical-delivery`, launch-readiness registration, local-MVP registration, and capability documentation.
- [x] Run capability 47 P0, work-mode acceptance, all tests, build, bundle budget, smoke, launch gates, local MVP checklist, and `git diff --check`.
