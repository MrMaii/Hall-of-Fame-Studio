# Workflow Node Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared, testable workflow-node protocol that classifies all Agent actions, drives semantic Timeline zoom, enriches node details, and proves Agents actively publish complete nodes during real work.

**Architecture:** Add one deep, dependency-free workflow module that owns family metadata, subtype inference, semantic levels, scale eligibility, and submission-quality evaluation. The backend decorates every Manager Flow Graph node and Agent timeline submission through that module; the Timeline UI consumes the same family and scale metadata so it cannot drift from runtime behavior.

**Tech Stack:** JavaScript ES modules, Node test runner, React 18, Lucide React, existing Agent project service and Manager Flow Graph.

## Global Constraints

- Preserve all unrelated modified and untracked files in the current worktree.
- Keep unknown subtypes open and lossless; do not implement a closed enum that rejects future Agent behavior.
- Preserve existing backend routes and `manager-flow-graph/v1` compatibility.
- Preserve pointer-anchored wheel zoom, drag pan, proof focus, and backend-first missing-state behavior.
- Treat submission intention as explicit runtime evidence, not human-like consciousness.

---

### Task 1: Shared workflow-node protocol

**Files:**
- Create: `src/workflow/workflowNodeProtocol.js`
- Create: `tests/workflowNodeProtocol.test.mjs`

**Interfaces:**
- Produces: `WORKFLOW_NODE_FAMILIES`, `WORKFLOW_NODE_FAMILY_ORDER`, `WORKFLOW_NODE_SCALES`, `inferWorkflowNodeFamily(node)`, `decorateWorkflowNode(node)`, `workflowNodeVisibleAtScale(node, scale)`, and `evaluateWorkflowNodeSubmissionQuality({ node, submission, attachments })`.

- [x] **Step 1: Write the classification and scale test**

Use literal examples for idea, joint submission, confirmation, phase summary, recovery, and unknown subtype preservation. Assert Month is a subset of Week, Week of Day, and Day of Hour.

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/workflowNodeProtocol.test.mjs`

Expected: FAIL because `src/workflow/workflowNodeProtocol.js` does not exist.

- [x] **Step 3: Implement the protocol**

Implement the exported catalogs and pure functions. `decorateWorkflowNode` must return the original fields plus normalized `category`, `categoryLabel`, `semanticLevel`, `semanticLabel`, `description`, and `visual`. Unknown subtypes remain unchanged.

- [x] **Step 4: Add and pass the quality-receipt test**

Test an individual complete packet, a joint complete packet, and an incomplete packet. The complete packets must be timeline-ready with scores at least 85; the incomplete packet must name missing description, relationship roles, and attachments.

Run: `node --test tests/workflowNodeProtocol.test.mjs`

Expected: PASS.

### Task 2: Backend node and Agent intent integration

**Files:**
- Modify: `src/agents/agentProjectService.js`
- Create: `tests/workflowNodeRuntimeIntent.test.mjs`

**Interfaces:**
- Consumes: protocol exports from Task 1.
- Produces: decorated `manager-flow-graph/v1` nodes and `workflow-node-submission-quality/v1` receipts on Agent timeline submissions and graph submission packets.

- [x] **Step 1: Write a public-service integration test**

Create a three-Agent project through `createAgentProjectService`, run Agent work cycles, and inspect `getTimeline()` plus `getManagerFlowGraph()`. Assert each participating Agent emits a timeline submission with title, description, intent, relationship roles, attachment/proof, and a passing quality receipt. Assert a joint example reports `authorshipMode: "joint"`.

- [x] **Step 2: Run the test to verify the new contract fails**

Run: `node --test tests/workflowNodeRuntimeIntent.test.mjs`

Expected: FAIL because existing timeline submissions do not expose the new description, visual, semantic, relationship, and quality fields.

- [x] **Step 3: Decorate Manager Flow Graph nodes**

Replace the local family constant with the shared family metadata. In `addNode`, call `decorateWorkflowNode` after assembling the existing node. Preserve explicit category/subtype and all current proof ids, routes, confirmations, and edges.

- [x] **Step 4: Evaluate every graph submission packet**

After attachments and submission fields are built, attach `submission.quality = evaluateWorkflowNodeSubmissionQuality({ node, submission, attachments })` and preserve it during node merges.

- [x] **Step 5: Record explicit Agent publication motivation**

Add `title`, `description`, `committerIds`, `coAuthorIds`, `participantIds`, `relationshipRoles`, `submissionMotivation`, `semanticLevel`, `visual`, and `submissionQuality` to lightweight work-pulse and typed artifact timeline submissions. Collaborators must be co-authors only when they actually co-produced the node; reviewers and managers remain participants with typed roles.

- [x] **Step 6: Run backend tests**

Run: `node --test tests/workflowNodeProtocol.test.mjs tests/workflowNodeRuntimeIntent.test.mjs`

Expected: PASS.

### Task 3: Semantic Timeline zoom and node detail

**Files:**
- Modify: `src/project/ProjectTimelineRouteView.jsx`
- Modify: `src/project/AdvancedProjectTimeline.jsx`
- Modify: `tests/advancedProjectTimelineUiContract.test.mjs`

**Interfaces:**
- Consumes: family metadata and `workflowNodeVisibleAtScale` from Task 1 plus decorated graph nodes from Task 2.
- Produces: Month/Week/Day/Hour semantic filtering, family-specific color/logo, scale guide, and quality-rich node detail.

- [x] **Step 1: Extend the UI contract test**

Require the route view to import the shared protocol and require public test ids for the semantic scale guide, node logo, Agent-authored description, submission quality, authorship mode, relationship graph, and attachments.

- [x] **Step 2: Run the UI test to verify it fails**

Run: `node --test tests/advancedProjectTimelineUiContract.test.mjs`

Expected: FAIL on the new shared-protocol and detail markers.

- [x] **Step 3: Use shared family metadata**

Build React icon bindings from protocol `iconKey` values, include every family including review, self-marketing, confirmation, summary, recovery, and governance, and decorate fallback nodes through the same protocol.

- [x] **Step 4: Replace importance-only filtering with semantic eligibility**

Filter nodes using `workflowNodeVisibleAtScale(node, zoomScale)`. Keep the current pointer-anchored exponential wheel zoom and card-density thresholds. Render a visible scale guide with the current level meaning and visible/total counts.

- [x] **Step 5: Upgrade detail identity and quality**

Render the family color/logo, description, semantic label, quality score/readiness, authorship mode, missing fields, and the existing relationship/attachment/proof sections. Do not add direct backend writes to the route view.

- [x] **Step 6: Run UI contracts**

Run: `node --test tests/advancedProjectTimelineUiContract.test.mjs tests/projectTimelineRouteViewUiContract.test.mjs`

Expected: PASS.

### Task 4: Focused runtime gate and documentation

**Files:**
- Modify: `package.json`
- Create: `scripts/validate-workflow-node-intent-contract.mjs`
- Verify: `docs/WORKFLOW_NODE_PROTOCOL.md`

**Interfaces:**
- Consumes: public service/API and graph read models.
- Produces: `npm run agents:workflow-nodes`, a repeatable feature acceptance gate.

- [x] **Step 1: Add the focused gate**

The script must run a bounded multi-Agent task, assert participation and complete node quality, read all four semantic scales through the shared public function, verify monotonic node sets, and inspect a joint submission relationship packet.

- [x] **Step 2: Register and run the gate**

Add `"agents:workflow-nodes": "node scripts/validate-workflow-node-intent-contract.mjs"`.

Run: `npm.cmd --silent run agents:workflow-nodes`

Expected: `Workflow node intent contract validation passed.`

- [x] **Step 3: Run proportional regression verification**

Run:

```powershell
npm.cmd --silent run agents:timeline-action
node --test tests/workflowNodeProtocol.test.mjs tests/workflowNodeRuntimeIntent.test.mjs tests/advancedProjectTimelineUiContract.test.mjs tests/projectTimelineRouteViewUiContract.test.mjs
npm.cmd --silent run build
```

Expected: all commands exit 0.

- [x] **Step 4: Inspect scope and requirement coverage**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only planned files plus the user's pre-existing changes are present. Check each of the four user requirements against the protocol doc, backend receipt, UI view, and runtime gate.

### Task 5: Value-based Agent contribution policy

**Files:**
- Create: `src/workflow/agentContributionPolicy.js`
- Create: `tests/agentContributionPolicy.test.mjs`
- Modify: `src/agents/agentProjectService.js`
- Modify: `scripts/validate-workflow-node-intent-contract.mjs`
- Modify: `src/project/AdvancedProjectTimeline.jsx`

- [x] **Step 1: Test submit, defer, decline, duplicate suppression, and joint attribution through the policy seam**
- [x] **Step 2: Integrate the policy with the public Agent work cycle and typed artifact submission**
- [x] **Step 3: Remove forced publication from the acceptance gate and report intent, conversion, completeness, and noise metrics**
- [x] **Step 4: Expose the contribution decision, reason, expected value, duplicate risk, and evidence plan in node details**
- [x] **Step 5: Run full regression, build, and real browser verification**
