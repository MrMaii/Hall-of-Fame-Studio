# Local Service Identity Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn project identity sessions into bounded local service credentials with explicit machine subjects, route audiences, atomic rotation, and restart-durable revocation.

**Architecture:** Reuse the existing project-scoped identity-session store and one-time token contract. A service identity is distinguished from a user identity, is restricted to runtime/Agent roles, and must name at least one access-control route key as its audience. The API classifies the target request before session verification and passes that route key to the verifier. Rotation writes the replacement and revoked predecessor in one project snapshot update.

**Tech Stack:** Node.js ESM, project identity sessions, access-control route classifier, file-backed project store, Node test runner.

## Global Constraints

- Pure local persistence; no cloud IdP, credential broker, or remote revocation service.
- Preserve existing user identity-session behavior for compatibility.
- Never persist or return a service token after its one-time issue/rotation response.
- Service identities require a stable service id, an allowed machine role, and one or more route-key audiences.
- Audience validation happens before role and membership dispatch.
- Rotation revokes the predecessor and issues the replacement through one `saveProject` call.
- Revoked predecessors remain rejected after file-store restart.

---

### Task 1: Specify service subject and audience enforcement

**Files:**
- Create: `tests/localServiceIdentity.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

- [x] **Step 1: Write a failing public-seam test**

Issue a `runtime-platform` service identity for the `worker-queue` audience. Prove it can read that route but cannot use the same token for `provider-readiness`.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localServiceIdentity.test.mjs`

Expected: FAIL because identity sessions do not yet model service subjects or validate route audiences.

- [x] **Step 3: Add the minimal service identity contract**

Persist `identityType`, `serviceId`, and `audiences`; reject privileged human roles for service credentials; classify each target request and require an exact route-key audience match during verification. Include only public service metadata in access decisions and audit records.

- [x] **Step 4: Run the focused test and verify green**

Run: `node --test tests/localServiceIdentity.test.mjs`

Expected: PASS.

---

### Task 2: Add atomic rotation and restart revocation proof

**Files:**
- Modify: `tests/localServiceIdentity.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`

- [x] **Step 1: Extend the test with rotation**

Rotate through `POST /projects/:projectId/identity-sessions/:sessionId/rotate`; assert the old token fails immediately, the replacement succeeds, and the public lineage links both records without exposing either token.

- [x] **Step 2: Implement one-save rotation**

Create the replacement record, mark the predecessor revoked with rotation lineage, append one log/event pair, and save the combined project once. Return the replacement token once under the existing token contract.

- [x] **Step 3: Prove restart durability**

Restart the file-backed store and assert the old token remains revoked while the replacement still passes its audience.

---

### Task 3: Document and verify capability #7

**Files:**
- Modify: `docs/LOCAL_AUTH.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-service-identity-rotation.md`

- [x] **Step 1: Document the local boundary**

Describe machine roles, exact route audiences, one-time token handling, rotation lineage, restart revocation, and the fact that credentials remain project-scoped local identities rather than a distributed workload identity system.

- [x] **Step 2: Run full verification**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests pass, the local MVP checklist passes, and the diff has no whitespace errors.

- [x] **Step 3: Record exact verification results**

Append exact test counts and release-check results to this plan.

## Verification Results

- `npm.cmd test`: 137 tests passed, 0 failed, 0 skipped or cancelled.
- `npm.cmd run agents:production-access-control`: production access-control contract passed.
- `npm.cmd run agents:product-team:private-pilot:handoff-focused`: private-pilot handoff contract passed, including the existing user identity-session issue/use/revoke path.
- `npm.cmd run launch:local-mvp:check`: Local MVP release checklist validation passed.
- `git diff --check`: exited 0 with no whitespace errors; Git reported only existing CRLF-to-LF working-copy warnings.
