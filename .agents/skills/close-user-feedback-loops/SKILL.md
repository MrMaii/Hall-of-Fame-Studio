---
name: close-user-feedback-loops
description: Turn leadership or user-experience feedback into an evidence-backed systemic product fix. Use when a leader reports that Hall-of-Fame-Studio is confusing, unreliable, only appears runnable, or fails a real user journey; when one symptom may reveal related design defects; or when work must move from local technical success to verified user usability.
---

# Close User Feedback Loops

Move the product from "appears to run" to "a real user can complete the intended outcome." Treat the reported symptom as an investigation entry point, not the full defect boundary.

## Start with an executive work brief

Before changing code, report the following in compact, technically credible language:

- **Preparation:** State what repository guidance, runtime contracts, current worktree state, dependencies, and validation entry points were actually checked. Never claim a download, installation, test, or readiness result without evidence from the current turn.
- **Initial judgement:** State the likely product or system boundary involved and label it as a hypothesis until reproduced.
- **Impact:** Explain which user outcome is blocked or made unreliable.
- **Plan:** State the investigation, related-problem scan, implementation, and verification sequence.
- **Success criteria:** Define observable user behavior and proof commands before implementation.
- **Risks or decisions:** Surface material tradeoffs, blockers, destructive actions, or scope decisions. Do not teach basic technical concepts unless asked.

Give brief updates at meaningful evidence points: reproduction, root cause confirmation, scope expansion, implementation completion, and verification. Report failed checks directly and explain the next action.

## Establish the feedback contract

Translate the feedback into:

1. Observed user behavior.
2. Expected user outcome.
3. User and business impact.
4. Reproduction path and environment.
5. Evidence that will prove the issue resolved.

Make reasonable, reversible assumptions when details are discoverable from the product. Ask only when a missing choice would materially change the outcome.

## Reproduce the real journey

Read the smallest set of current product and runtime contracts needed to understand the path. Inspect the worktree before editing and preserve unrelated changes.

Reproduce through the same surface the user used whenever practical. Prefer the real UI, backend, persistence, provider, restart, and recovery boundaries over isolated mocks. Record the earliest point where observed behavior diverges from the intended outcome.

Do not accept these as proof of usability by themselves:

- a process starts;
- a page renders;
- a unit test passes;
- a mocked fixture succeeds;
- a backend record exists but the user cannot find or act on it.

## Build a causal map

Trace the symptom to violated design invariants across the relevant layers:

- entry point, navigation, affordance, and information hierarchy;
- state ownership, source of truth, hydration, cache, and persistence;
- frontend/backend contracts, asynchronous ordering, retries, and idempotency;
- Agent goals, handoffs, review gates, evidence, and completion semantics;
- permissions, secrets, provider readiness, and degraded modes;
- errors, recovery actions, observability, and operator visibility;
- language, accessibility, responsive layout, and first-use expectations.

Distinguish the root cause from contributing factors and secondary symptoms. Confirm the causal link with code, runtime evidence, or a failing test before implementing.

## Scan the full sibling scope

Define a causal boundary such as "all commands using browser-local optimistic writes for backend-owned projects." Search every call site and parallel workflow inside that boundary.

Create a compact coverage matrix:

| Surface | Same violated invariant? | User impact | Action | Verification |
|---|---|---|---|---|
| Reported path | Yes/No | Blocked or degraded outcome | Fix or exclude with reason | Evidence |
| Related path | Yes/No | Potential sibling failure | Fix or exclude with reason | Evidence |

Do not equate "all similar issues" with every possible bug in the repository. Claim completeness only for the explicitly audited invariant and searched scope.

## Implement the systemic fix

Fix the violated invariant at its owning boundary. Prefer one source-of-truth correction over repeated UI patches. Add a regression test that fails for the original defect and representative sibling paths, then make it pass.

Keep the change minimal:

- preserve existing style and unrelated work;
- avoid speculative abstraction or adjacent refactors;
- remove only code made obsolete by this change;
- document a remaining limitation instead of hiding it behind a fallback.

If the audit finds multiple unrelated causes, separate them into explicit fix lanes and verify each one. Do not bundle them under a vague redesign.

## Verify from narrow proof to actual use

Run fresh evidence in increasing scope, selecting current commands from `package.json` and repository docs rather than assuming names remain valid:

1. Focused regression tests for the root invariant and sibling paths.
2. Relevant contract, integration, and persistence/recovery checks.
3. Product build and static checks.
4. The smallest real-backend journey that proves the changed contract.
5. A real browser user journey when the feedback concerns UI or end-to-end usability.
6. Restart, degraded-provider, failure-recovery, or device/language checks when implicated by the causal map.

For Hall-of-Fame-Studio, consider the existing local MVP, zero-to-autonomy, Manager UI, and launch-readiness gates, but verify their current definitions before running them. A lower-level gate does not substitute for the user-facing gate relevant to the feedback.

## Report to the leader

Lead the final report with the decision and usable outcome:

1. **Verdict:** Whether the affected user outcome is now usable, partially usable, or blocked.
2. **Root cause:** The violated design invariant in plain technical language.
3. **Systemic coverage:** Every related surface audited, fixed, or explicitly excluded.
4. **Changes:** The minimal product and engineering corrections made.
5. **Evidence:** Fresh commands and real-user observations, with pass/fail results.
6. **Residual risk:** Known limitations, production blockers, or untested boundaries.
7. **Next decision:** Include only if leadership input or a separate investment decision is genuinely required.

Never substitute activity for assurance. Communicate what was prepared, what was learned, what changed, and what evidence supports the conclusion.
