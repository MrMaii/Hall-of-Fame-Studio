# Local Prompt and Untrusted Data Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure external evidence and other context data can improve Agent work without ever being interpreted as higher-priority instructions or carrying detected injection/secrets into a local model request.

**Architecture:** Add a focused `localPromptBoundary.js` module that normalizes untrusted text, detects injection/secret patterns, creates citation-addressed `UNTRUSTED_DATA` envelopes, physically removes quarantined content, and emits a content-free checksummed receipt. The model artifact-draft path keeps the operator instruction separate as trusted instruction, passes only included envelopes as quoted data, persists the boundary receipt alongside Provider usage, and exposes project readiness through an HTTP-shaped API. Existing evidence source-safety uses the same detector so critical injection is blocked rather than merely labeled for review.

**Tech Stack:** Node.js ESM, built-in SHA-256, project file store, model Provider adapter, HTTP-shaped project API, Node test runner.

## Global Constraints

- Pure local execution and persistence; no remote moderation, SaaS scanner, or cloud policy dependency.
- Operator instruction remains a distinct trusted instruction field; project/task/evidence/source/finding/prior-work/review content is context data, never system or developer instruction.
- Every included context item is labeled `UNTRUSTED_DATA`, has a stable citation id and SHA-256 content checksum, and is delimited in structured JSON.
- Critical injection, tool-bypass, role-override, exfiltration, hidden-instruction, or raw-secret patterns are physically replaced by `[QUARANTINED_UNTRUSTED_CONTENT]` before a model call.
- A quarantined envelope and persisted receipt contain no original content, prompt fragment, secret, query, source summary, finding, or review text.
- Review-only signals may remain included as quoted data but cannot alter instruction priority.
- Prompt-boundary receipts contain manifest metadata only, are checksummed, and are persisted with Provider usage across restart.
- Provider allowlists, tool grants, budgets, circuit breakers, cancellation, and model-output human review remain independently authoritative.
- Deterministic pattern detection is a local defense layer, not a claim of complete semantic attack detection or hardware-backed immutable audit.

---

### Task 1: Physically isolate injected context before model dispatch

**Files:**
- Create: `src/agents/localPromptBoundary.js`
- Create: `tests/localPromptBoundary.test.mjs`
- Modify: `src/agents/agentProjectService.js`

**Interfaces:**
- Produces: `inspectUntrustedContent(value)`.
- Produces: `buildArtifactDraftPromptBoundary(input)` returning `{ messages, receipt, envelopes }`.
- Consumes: `llmProvider.createChatCompletion({ messages, json, maxTokens })`.

- [x] **Step 1: Write one failing model-capture test**

Create a file-backed project, record one safe evidence source and one source/finding containing a known prompt-injection plus fake secret, then generate a model-backed artifact draft with a fake local model that captures messages. Assert the safe source is present under `UNTRUSTED_DATA` with a citation id, malicious text is absent, a quarantine placeholder is present, and the trusted operator instruction remains separate.

- [x] **Step 2: Run the focused test and verify red**

Run: `node --test tests/localPromptBoundary.test.mjs`

Expected: FAIL because the artifact prompt currently sends ordinary context JSON and has no quarantine receipt.

- [x] **Step 3: Implement normalization, detection, envelopes, and model message boundary**

Detect English and Chinese ignore/override, role/system impersonation, secret exfiltration, tool bypass, hidden delimiter, encoded-execution, and raw credential patterns after Unicode normalization and zero-width removal. Build citation envelopes, exclude quarantined content, add explicit system instructions that envelope content is data only, and require model evidence references to use citation ids.

- [x] **Step 4: Run the focused test and verify green**

Run: `node --test tests/localPromptBoundary.test.mjs`

Expected: PASS for safe inclusion, malicious physical absence, citation labels, and unchanged trusted instruction.

---

### Task 2: Persist auditable boundary receipts and readiness

**Files:**
- Modify: `tests/localPromptBoundary.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `src/agents/agentProjectApi.js`
- Modify: `src/agents/accessControl.js`

**Interfaces:**
- Produces: `local-prompt-boundary-receipt/v1` rows in `project.promptBoundaryReceipts`.
- Produces: `GET /projects/:projectId/prompt-boundary-readiness` returning `local-prompt-boundary-readiness/v1`.
- Adds receipt id/checksum to model Provider usage and `agent-artifact-draft/v1`.

- [x] **Step 1: Add failing persistence, redaction, integrity, and restart assertions**

Assert the artifact and Provider usage reference the same receipt, the receipt manifest exposes included/quarantined/review counts and citation checksums without raw text, readiness verifies every receipt checksum, and file-backed restart preserves proof. Mutate one stored manifest field and assert readiness degrades instead of trusting it.

- [x] **Step 2: Persist receipts with Provider usage and expose readiness**

Append a bounded receipt list in the same save as Provider usage, expose only public manifest metadata, verify receipt SHA-256 on read, summarize injection/quarantine counts, add Manager/runtime/security-admin read access, and keep `readyForProduction: false` with explicit local boundaries.

- [x] **Step 3: Run focused Provider and cancellation regressions**

Run: `node --test tests/localPromptBoundary.test.mjs tests/localProviderBudgetReservation.test.mjs tests/localAutopilotCancellation.test.mjs`

Expected: prompt isolation, Provider reservation, and cancellation terminal-state tests all pass.

---

### Task 3: Unify evidence safety, gate the local release, and document boundaries

**Files:**
- Modify: `tests/localPromptBoundary.test.mjs`
- Create: `scripts/validate-local-prompt-boundary.mjs`
- Modify: `package.json`
- Modify: `scripts/validate-local-mvp-release-checklist.mjs`
- Modify: `docs/LAUNCH_READINESS_GATES.md`
- Modify: `docs/LOCAL_PROVIDER_TRANSPORT_RELIABILITY.md`
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`

**Interfaces:**
- Produces: evidence source `promptBoundaryDecision`, citation id/checksum, and blocked safety state for critical injection.
- Produces: `npm.cmd run agents:prompt-boundary`.

- [x] **Step 1: Add a failing evidence-safety assertion**

Assert a critical injection source is `blocked`, carries `promptBoundaryDecision: quarantined`, cannot make source safety ready, and appears in prompt-boundary readiness quarantine totals while a benign source remains usable.

- [x] **Step 2: Reuse the boundary detector in evidence source safety**

Replace duplicate injection regex decisions with `inspectUntrustedContent`, persist only signals/citation/checksum/decision metadata, and preserve existing safe-source quality/snapshot/provider-receipt behavior.

- [x] **Step 3: Add focused gate and operator documentation**

Add `agents:prompt-boundary` to the local release checklist and launch gate document. Document trust classification, included-vs-quarantined behavior, citation format, receipt redaction, restart integrity, false-positive review path, and limits of deterministic local scanning.

- [x] **Step 4: Run full verification**

Run: `node --check scripts/agent-project-server.mjs`, `node --check src/agents/localPromptBoundary.js`, `npm.cmd test`, `npm.cmd run agents:prompt-boundary`, `npm.cmd run launch:local-mvp:check`, and `git diff --check`.

Expected: all tests and local release contracts pass with no whitespace errors.

- [x] **Step 5: Record exact verification results**

Append exact test counts and gate results without claiming the complete 50-capability objective is finished.

## Verification Results

- `node --check scripts/agent-project-server.mjs`: PASS (exit 0).
- `node --check src/agents/localPromptBoundary.js`: PASS (exit 0).
- `node --check src/agents/agentProjectService.js`: PASS (exit 0).
- `npm.cmd test`: PASS (148 tests, 148 passed, 0 failed).
- `npm.cmd run agents:prompt-boundary`: PASS (`Local prompt and untrusted data boundary validation passed.`).
- `npm.cmd run launch:local-mvp:check`: PASS (`Local MVP release checklist validation passed.`).
- `git diff --check`: PASS (exit 0; existing CRLF normalization warnings only).
