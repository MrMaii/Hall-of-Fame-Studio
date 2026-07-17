import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { MEETING_TURN_GRACE_PERIOD_MS } from '../src/agents/meetingQueueProtocol.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-meeting-autonomy-${process.pid}`);
const workspacePath = resolve(tempRoot, 'workspace');
const projectId = 'local_meeting_autonomy_validation';
const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', isLeader: true },
  { id: 'turing', name: 'Alan Turing', role: 'Systems Architect' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer' },
];

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const api = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'store.json'),
    replaceWithSeed: true,
    projectRuntime: createLocalProjectRuntime({ rootPath: resolve(tempRoot, 'runtime') }),
  });
  let response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Local Meeting Autonomy Validation',
      brief: 'Prove a confirmed kickoff writes the leader report to the bound local workspace and exposes it as a Flow Graph attachment.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-07-09T09:00:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Project setup must persist through the backend.');

  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/workspace/bind`,
    body: { workspacePath, createIfMissing: true, now: '2026-07-09T09:01:00.000Z' },
  });
  assert(response.status === 200 && response.body.localRuntime?.workspacePath === workspacePath, 'Workspace bind must be backend-owned.');

  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/meeting`,
    body: {
      includeReadModels: false,
      text: 'Confirm the research scope, assign system design and evidence review, then record the first project meeting report.',
      messageId: 'director_local_meeting_message',
      now: '2026-07-09T09:02:00.000Z',
    },
  });
  assert(response.status === 200, 'Director meeting text must be persisted through the backend.');
  assert(response.body.messages?.[0]?.author === 'Director', 'The Director transcript entry must be persisted before Agent output.');
  assert(response.body.meetingAgentTurns?.[0]?.delayMs >= MEETING_TURN_GRACE_PERIOD_MS, 'The first Agent response must retain the configured queue grace period.');

  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/meeting-report`,
    body: { now: '2026-07-09T09:03:00.000Z' },
  });
  assert(response.status === 200, `Meeting report route returned ${response.status}.`);
  assert(response.body.route === 'kickoff-meeting-report-published', 'Meeting report must return a published receipt.');
  assert(response.body.meetingReport?.leaderId === 'jobs', 'The confirmed Leader must author the meeting report.');
  assert(response.body.submission?.artifactType === 'progress-brief', 'The meeting report must be a typed Agent artifact node.');
  assert(response.body.submission?.workspaceRelativePath === 'meeting-notes/kickoff-summary.md', 'The meeting report must point to the visible local notes path.');

  const reportText = await readFile(resolve(workspacePath, 'meeting-notes', 'kickoff-summary.md'), 'utf8');
  assert(/Local Meeting Autonomy Validation/.test(reportText), 'The local meeting report must identify the confirmed project.');
  assert(/Steve Jobs/.test(reportText), 'The local meeting report must identify its Leader author.');

  response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
  const flow = response.body.managerFlowGraph || response.body;
  assert(response.status === 200, 'Manager Flow Graph must be readable after report publication.');
  assert(flow.nodes?.some((node) => node.submissionId === response.body?.submission?.id || /kickoff meeting report/i.test(node.title || '')), 'Manager Flow Graph must expose the meeting report artifact node.');

  response = api.handle({ method: 'GET', path: `/projects/${projectId}/timeline` });
  assert(response.status === 200 && response.body.logs?.some((row) => row.submissionId), 'Timeline must expose the report submission audit event.');
  response = api.handle({ method: 'GET', path: `/projects/${projectId}/events` });
  assert(response.status === 200 && response.body.eventLedger?.some((row) => row.type === 'agent-submission'), 'Event ledger must expose the report submission audit event.');
  const appSource = await readFile(resolve(repoRoot, 'src', 'App.jsx'), 'utf8');
  assert(appSource.includes('/meeting-report'), 'Confirmed initiation must request the backend Leader meeting report after workspace verification.');
  assert(appSource.includes('meetingReportSubmissionId'), 'Confirmed initiation must retain the meeting-report receipt for UI verification.');
  const runbook = await readFile(resolve(repoRoot, 'docs', 'LOCAL_MEETING_AUTONOMY.md'), 'utf8');
  for (const requiredText of ['npm run dev', '800 ms', 'Director precedence', 'meeting-notes', 'Manager Flow Graph']) {
    assert(runbook.includes(requiredText), `Local meeting runbook must document ${requiredText}.`);
  }
  console.log('Local meeting autonomy chain passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
