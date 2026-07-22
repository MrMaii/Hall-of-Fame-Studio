# Agent Peer Meeting Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Preserve the current dirty worktree and do not revert unrelated changes.

**Goal:** Make kickoff and live meetings behave as causal peer conversations: agents may challenge or support one another, every peer response names its parent turn and intent, discussion is capped at three peer exchanges, and the Leader (or designated synthesizer before confirmation) converges the topic into a decision, risk, or question for the Director.

**Architecture:** Add one small, pure meeting-interaction protocol module beside the model I/O code. It will normalize model turns into a validated causal chain, enforce a bounded exchange state machine, and build a compact context packet containing stable project facts, a rolling summary, unresolved questions, and only the most recent turns. Existing meeting service functions remain the persistence boundary; they will call the protocol before storing provider output. The React meeting surfaces will render the persisted reply and intent metadata rather than infer relationships in the browser.

**Tech Stack:** Node.js ES modules, `node:test`, existing local model-provider abstraction, React/Vite, file-backed meeting store.

## Global Constraints

- Keep Director precedence and the existing 800 ms queue grace period unchanged.
- The Director remains the final approver. A Leader may synthesize a proposal but cannot self-confirm election or close the meeting.
- Permit at most three peer-response edges for one topic before a mandatory `synthesize` or `escalate` turn.
- Model output is untrusted: unknown agents, dangling reply ids, self-replies, duplicate loop turns, and over-budget chains must be normalized or rejected before persistence.
- Preserve existing language localization changes and current uncommitted meeting floor-control work.
- Keep deterministic/local behavior available for validation, while provider-backed text remains the normal live path when configured.

---

### Task 1: Specify the causal interaction state machine with failing tests

**Files:**
- Create: `tests/meetingInteractionProtocol.test.mjs`
- Create: `src/agents/meetingInteractionProtocol.js`

**Step 1: Write failing tests**

Cover these exact contracts:

1. A Leader candidate turn can be followed by another agent with `interactionIntent: "challenge"` and `replyToTurnId` pointing to the candidate turn.
2. Each later peer turn points to an earlier stored/planned turn, never itself, and addresses a valid team member.
3. Three peer edges force the final turn to `synthesize` or `escalate`; a fourth challenge is dropped.
4. Repeated A/B challenge pairs cannot create an unbounded loop.
5. When no Leader is confirmed, the recommended Leader is the synthesizer; once confirmed, the selected Leader is.
6. A malformed provider batch receives stable generated ids and safe defaults without inventing unknown speakers.

**Step 2: Verify red**

Run: `node --test tests/meetingInteractionProtocol.test.mjs`

Expected: FAIL because the protocol module does not exist.

**Step 3: Implement the minimum pure protocol**

Export:

```js
export const MEETING_MAX_PEER_EXCHANGES = 3;
export const MEETING_INTERACTION_INTENTS = [
  'support', 'challenge', 'clarify', 'compete', 'synthesize', 'escalate', 'yield',
];

export function normalizeMeetingInteractionChain({
  meeting,
  turns,
  now,
  maxPeerExchanges = MEETING_MAX_PEER_EXCHANGES,
}) {}
```

Return `{ turns, state }`, where `state` contains `topicId`, `peerExchangeCount`, `status`, `synthesizerId`, and `droppedTurnCount`. Store canonical fields on every agent turn: `replyToTurnId`, `targetSpeakerId`, `interactionIntent`, `topicId`, `exchangeIndex`, and `addressedAgentIds`.

**Step 4: Verify green**

Run: `node --test tests/meetingInteractionProtocol.test.mjs`

Expected: all tests pass.

---

### Task 2: Build a bounded context packet instead of replaying the transcript

**Files:**
- Modify: `src/agents/meetingInteractionProtocol.js`
- Modify: `tests/meetingInteractionProtocol.test.mjs`

**Step 1: Add failing context tests**

Prove that the packet:

- retains project id/name/brief, team identities, selected/recommended Leader, latest decision summary, unresolved risks/questions, and current discussion state;
- contains at most six recent turns;
- omits old verbatim transcript text after compaction;
- stays under a configurable character budget and reports `compactedTurnCount`.

**Step 2: Verify red**

Run: `node --test tests/meetingInteractionProtocol.test.mjs`

Expected: context-packet assertions fail.

**Step 3: Implement context builder**

Export:

```js
export function buildMeetingContextPacket({
  meeting,
  latestDirectorInput = '',
  maxRecentTurns = 6,
  maxCharacters = 7000,
}) {}
```

Use structured fields, truncating individual text fields before removing required decision/risk/question metadata. Do not add semantic summarization through another provider call in this phase; use the already persisted decision summary and unresolved rows.

**Step 4: Verify green**

Run: `node --test tests/meetingInteractionProtocol.test.mjs`

Expected: all protocol and budget tests pass.

---

### Task 3: Make model prompts request causal peer turns

**Files:**
- Modify: `src/agents/modelKickoffParsing.js`
- Create: `tests/modelKickoffPeerInteraction.test.mjs`

**Step 1: Write failing prompt/parser tests**

Assert the kickoff continuation prompt:

- includes `discussionState`, compact `recentTurns`, and the unresolved context packet;
- requires `replyToTurnId`, `interactionIntent`, and `targetSpeakerId` for peer replies;
- instructs the model to use two or three causal exchanges and then synthesize/escalate;
- no longer sends the last fourteen raw transcript turns;
- preserves line fallback compatibility for simple single turns.

**Step 2: Verify red**

Run: `node --test tests/modelKickoffPeerInteraction.test.mjs`

Expected: FAIL against the current parallel Director-response shape.

**Step 3: Update the prompt builder minimally**

Call `buildMeetingContextPacket` inside `buildModelKickoffMeetingTurnMessages`. Expand `requiredShape.agentTurns[]` with the causal fields. Keep the existing topic/language validation and JSON repair path.

**Step 4: Verify green**

Run: `node --test tests/modelKickoffPeerInteraction.test.mjs tests/meetingInteractionProtocol.test.mjs`

Expected: all tests pass.

---

### Task 4: Enforce and persist the interaction chain in kickoff meetings

**Files:**
- Modify: `src/agents/agentProjectService.js` at `appendModelKickoffMeetingTurns` and kickoff evidence construction
- Create: `tests/kickoffPeerMeetingService.test.mjs`

**Step 1: Write failing service tests**

Create a meeting with three agents and append provider turns representing candidate A, challenger B, reply A, and synthesis by the recommended Leader. Assert:

- persisted transcript order follows causal parent order;
- causal metadata survives persistence;
- the fourth peer challenge is not persisted after the three-edge cap;
- `meeting.discussionState` and `evidence.peerInteractionEdgeCount`, `evidence.convergedTopicIds`, and `evidence.droppedMeetingTurnCount` are correct;
- unknown speaker ids and dangling reply ids cannot enter the transcript.

Expose the normalizer through the exported service path needed by the test; do not duplicate protocol logic in the service.

**Step 2: Verify red**

Run: `node --test tests/kickoffPeerMeetingService.test.mjs`

Expected: FAIL because the service currently stores parallel turns without causal validation.

**Step 3: Wire persistence**

Normalize provider turns before `nextTranscript` is built. Persist the returned discussion state and evidence counters. Extend the repair `expectedShape` to include causal fields. Do not change unrelated kickoff approval or file-store behavior.

**Step 4: Verify green**

Run: `node --test tests/kickoffPeerMeetingService.test.mjs tests/modelKickoffPeerInteraction.test.mjs tests/meetingInteractionProtocol.test.mjs`

Expected: all tests pass.

---

### Task 5: Upgrade deterministic roundtable behavior without breaking meeting routing

**Files:**
- Modify: `src/agents/agentRuntime.js` at `runRoundtableExchange`
- Modify: `tests/meetingResponderService.test.mjs`
- Modify: `scripts/validate-smart-meeting-runtime-contract.mjs`

**Step 1: Add failing deterministic-chain assertions**

For an explicit `@all` meeting, require the first response to answer the Director, the second to reply to the first with a peer intent, and the final response to synthesize or escalate. Preserve current responder count and delay assertions.

**Step 2: Verify red**

Run: `node --test tests/meetingResponderService.test.mjs && node scripts/validate-smart-meeting-runtime-contract.mjs`

Expected: causal metadata assertions fail.

**Step 3: Generate a deterministic causal plan**

Reuse the protocol constants and return causal fields on `responses`. Keep the existing response text builder and scoring. Do not add another scheduler or agent process.

**Step 4: Verify green**

Run: `node --test tests/meetingResponderService.test.mjs && node scripts/validate-smart-meeting-runtime-contract.mjs`

Expected: tests and contract pass.

---

### Task 6: Preserve causal metadata through browser transcript state and display it

**Files:**
- Modify: `src/meeting/meetingMessageState.js`
- Modify: `src/meeting/AdvancedMeetingRoom.jsx`
- Modify: `src/App.jsx` kickoff transcript mapping only
- Modify: `tests/meetingMessageState.test.mjs`
- Create: `tests/meetingPeerInteractionUiContract.test.mjs`

**Step 1: Write failing state/UI tests**

Assert that transcript conversion retains `replyToTurnId`, `targetSpeakerId`, `interactionIntent`, `topicId`, and `exchangeIndex`. Assert the meeting UI source renders a reply label and an intent badge from persisted metadata. Assert kickoff transcript mapping passes those fields through.

**Step 2: Verify red**

Run: `node --test tests/meetingMessageState.test.mjs tests/meetingPeerInteractionUiContract.test.mjs`

Expected: metadata/UI assertions fail.

**Step 3: Add minimal rendering**

Show a compact localized label such as `回应 Alan · 质疑` / `Replying to Alan · Challenge` above the text. Do not redesign the room.

**Step 4: Verify green**

Run: `node --test tests/meetingMessageState.test.mjs tests/meetingPeerInteractionUiContract.test.mjs`

Expected: all tests pass.

---

### Task 7: Document and verify the full Harness behavior

**Files:**
- Modify: `docs/LOCAL_MEETING_AUTONOMY.md`
- Modify: `src/agents/ARCHITECTURE_AUDIT.md`
- Modify: `scripts/validate-smart-meeting-runtime-contract.mjs`

**Step 1: Document the contract**

Describe causal peer edges, the three-exchange cap, Leader/synthesizer convergence, compact context packets, Director authority, and audit fields. Explicitly state that this is a local/private Harness and not a claim of distributed agent processes.

**Step 2: Run focused verification**

Run:

```powershell
node --test tests/meetingInteractionProtocol.test.mjs tests/modelKickoffPeerInteraction.test.mjs tests/kickoffPeerMeetingService.test.mjs tests/meetingResponderService.test.mjs tests/meetingMessageState.test.mjs tests/meetingPeerInteractionUiContract.test.mjs tests/meetingFloorControl.test.mjs tests/meetingFloorControlWiring.test.mjs
node scripts/validate-smart-meeting-runtime-contract.mjs
node scripts/validate-local-meeting-autonomy-chain.mjs
```

Expected: all focused tests and both contracts pass.

**Step 3: Run proportional regression gates**

Run:

```powershell
npm run agents:scenario:contract
npm run agents:product-team:smoke
npm run ui:bundle:check
```

Expected: pass. If the pre-existing product-team smoke failure remains, report its exact unchanged source-contract error separately and do not attribute it to this change without diff evidence.

**Step 4: Inspect the final diff**

Run: `git diff --check` and a scoped `git diff --stat`/`git diff` for only the files above. Confirm every changed line maps to this plan and no existing user changes were reverted.

## Self-Review

- The plan covers both provider-backed kickoff meetings and deterministic War Room fallback, so the product does not demonstrate peer interaction only in one mode.
- The protocol is pure and small; persistence stays in the existing service and UI remains a projection of backend facts.
- The loop limit is structural, not merely a prompt instruction.
- Context efficiency is measurable through a character budget and compacted-turn count.
- No new distributed queue, database, or speculative abstraction is introduced.
