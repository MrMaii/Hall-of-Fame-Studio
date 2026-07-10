# Local Meeting Autonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one local development command start the UI and backend, then prove a workspace-bound project can move through a user-safe kickoff meeting into a locally inspectable autonomous work trail.

**Architecture:** Keep `agent-project-server.mjs` as the sole local-runtime owner of filesystem writes and project state. Add a small development supervisor that starts it with Vite and shuts both down together. Keep meeting queue ordering backend-derived, while a single frontend delivery gate defers every scheduled Agent turn whenever the Director is typing or dictating.

**Tech Stack:** Node.js, Vite, React, Node HTTP backend, file-backed local runtime, node:test, Playwright contract scripts.

## Global Constraints

- `npm run dev` must start both the Vite UI and `agents:server` for local MVP use.
- The browser must never write workspace paths or artifacts directly; it must use `/projects/:id/workspace/*`.
- The first Agent turn waits at least 5,000 ms; later queue positions use `meetingTurnDelayMs`.
- Director typing or active speech recognition pauses all pending Agent speech and resumes it only after the Director becomes idle.
- Local/private MVP evidence must remain visibly local-only and must not claim public-production readiness.

---

### Task 1: Start the complete local runtime with one command

**Files:**
- Create: `scripts/local-dev.mjs`
- Modify: `package.json`
- Test: `scripts/validate-local-dev-startup.mjs`

**Interfaces:**
- Consumes: `scripts/agent-project-server.mjs`, `node_modules/vite/bin/vite.js`
- Produces: `npm run dev`, an API listener on `http://127.0.0.1:8787`, and a Vite listener on `http://127.0.0.1:5173`.

- [ ] **Step 1: Write the failing startup integration test**

```js
const runtime = await startLocalDev();
assert.equal((await fetch('http://127.0.0.1:8787/projects')).status, 200);
assert.equal((await fetch('http://127.0.0.1:5173')).status, 200);
await runtime.stop();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node scripts/validate-local-dev-startup.mjs`

Expected: failure because the current `dev` script launches Vite but not the project backend.

- [ ] **Step 3: Implement the supervisor and command**

```js
const backend = spawn(process.execPath, ['scripts/agent-project-server.mjs'], { stdio: 'inherit' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' });
const stop = () => [backend, vite].forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
```

Set `package.json` `scripts.dev` to `node scripts/local-dev.mjs` and ensure a backend startup failure terminates Vite.

- [ ] **Step 4: Run the startup integration test**

Run: `node scripts/validate-local-dev-startup.mjs`

Expected: PASS with both HTTP endpoints reachable and both children stopped by the test.

### Task 2: Enforce user precedence in the meeting speech scheduler

**Files:**
- Modify: `src/App.jsx`
- Modify: `scripts/validate-smart-meeting-runtime-contract.mjs`

**Interfaces:**
- Consumes: `meetingTurnDelayMs(index, requestedDelayMs)`, Room input state, speech-recognition state.
- Produces: `scheduleRoomAgentTurn({ intentId, start, yield })` which cannot run `start` until Director intent is inactive.

- [ ] **Step 1: Add a failing source/runtime contract**

```js
assert(appSource.includes('const roomUserIntentActiveRef = useRef(false);'));
assert(appSource.includes('const scheduleRoomAgentTurn ='));
assert(appSource.includes('if (roomUserIntentActiveRef.current)'));
assert(appSource.includes('onFocus={() => setRoomUserIntentActive(true)}'));
```

- [ ] **Step 2: Run the smart-meeting contract to verify it fails**

Run: `npm run agents:smart-meeting-runtime`

Expected: failure because queued callbacks currently speak after a fixed timeout even while the Director is typing.

- [ ] **Step 3: Implement a single gated scheduler**

```js
const scheduleRoomAgentTurn = ({ delayMs, onStart, onYield }) => {
  const attempt = () => {
    if (roomUserIntentActiveRef.current) {
      roomSimulationTimersRef.current.push(setTimeout(attempt, 250));
      return;
    }
    onStart();
    roomSimulationTimersRef.current.push(setTimeout(onYield, MEETING_TURN_SPEAK_DURATION_MS));
  };
  roomSimulationTimersRef.current.push(setTimeout(attempt, delayMs));
};
```

Set the ref/state on Room input focus, non-empty typing, composition, and speech-recognition start; clear it on blur only when input is empty, after submit, and on speech-recognition end. Route backend meeting turns, local fallback turns, and change-discussion turns through this helper.

- [ ] **Step 4: Re-run the smart-meeting contract**

Run: `npm run agents:smart-meeting-runtime`

Expected: PASS; every Agent owns an intent, preserves queue delay, and Director messages are staged before backend calls.

### Task 3: Prove the user-visible local project path and artifact trail

**Files:**
- Create: `scripts/validate-local-meeting-autonomy-chain.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `/projects/initiate`, `/workspace/bind`, `/workspace/write`, `/meeting`, `/meeting-summaries`, `/manager-flow-graph`, `/timeline`, `/events`.
- Produces: an isolated end-to-end receipt proving project setup, workspace bind, Director transcript entry, queued Agent turns, meeting summary, local artifact, flow attachment, and activity audit rows.

- [ ] **Step 1: Write the failing end-to-end acceptance test**

```js
assert(project.localRuntime.workspacePath === workspacePath);
assert(meetingAgentTurns[0].delayMs >= 5000);
assert(transcript.messages.some((row) => row.author === 'Director'));
assert(await exists(join(workspacePath, 'meeting-notes', 'kickoff-summary.md')));
assert(flow.nodes.some((node) => /meeting|summary|artifact/i.test(node.type + node.title)));
assert(timeline.logs.some((row) => row.eventType));
```

- [ ] **Step 2: Run the test to identify missing proof surfaces**

Run: `node scripts/validate-local-meeting-autonomy-chain.mjs`

Expected: FAIL until all assertions use backend receipts and local files rather than browser-only state.

- [ ] **Step 3: Add only the missing backend/UI linkages found by the test**

Use the existing local runtime artifact writer for the leader’s meeting-note file, attach its artifact receipt to the Manager Flow Graph, and refresh transcript/timeline/event/flow read models after confirmation. Do not add a second filesystem or queue implementation.

- [ ] **Step 4: Run the focused end-to-end acceptance test**

Run: `node scripts/validate-local-meeting-autonomy-chain.mjs`

Expected: PASS with a temporary workspace that contains the summary and a backend-created Flow Graph attachment.

### Task 4: Publish the operator documentation and run release verification

**Files:**
- Create: `docs/LOCAL_MEETING_AUTONOMY.md`
- Modify: `README.md`
- Test: `scripts/validate-local-mvp-release-checklist.mjs`

**Interfaces:**
- Consumes: verified routes and output from Tasks 1–3.
- Produces: a concise runbook covering startup, project/workspace preparation, meeting intent lifecycle, user-precedence rule, close/confirmation behavior, artifact locations, audit surfaces, and the local-vs-production boundary.

- [ ] **Step 1: Write the documentation assertions**

```js
assert(doc.includes('npm run dev'));
assert(doc.includes('5 seconds'));
assert(doc.includes('Director precedence'));
assert(doc.includes('meeting-notes'));
assert(doc.includes('Manager Flow Graph'));
```

- [ ] **Step 2: Create the runbook and README entry**

Document exact commands, the `meeting-notes/` output path, transcript/intent/timeline/Flow Graph evidence, and that unattended public production remains out of scope.

- [ ] **Step 3: Run focused and release checks**

Run: `npm run agents:project-settings:workspace && npm run agents:smart-meeting-runtime && npm run agents:real-user-zero-to-autonomy && npm run launch:local-mvp:check && npm run build`

Expected: all commands exit 0; the real-user HTTP chain includes workspace bind/write/read, meeting, artifact storage, Flow Graph, timeline, and event proof.

