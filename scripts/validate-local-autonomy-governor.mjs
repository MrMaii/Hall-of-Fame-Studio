import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, createKickoffProjectFromMeeting, hydrateAgentProject } from '../src/agents/agentProjectService.js';
import { createLocalAutonomyPolicy, evaluateLocalAutonomyExecution } from '../src/agents/localAutonomyGovernor.js';
import { composeWorkModeTeam } from '../src/agents/workModes.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const modes = ['learning', 'academic-writing', 'investigation', 'technical-delivery', 'creative-studio'];
for (const workMode of modes) {
  const team = composeWorkModeTeam({ workMode, objective: `Validate bounded ${workMode} autonomy.` });
  const projectId = `${workMode.replaceAll('-', '_')}_autonomy_project`;
  const policy = createLocalAutonomyPolicy({
    projectId, maxWallClockMs: 86_400_000, maxSteps: Math.max(2, team.taskNodes.length + 1),
    maxCostCents: 100, maxToolInvocations: 2, allowedToolOperations: ['search:evidence'],
    actorId: 'manager', idempotencyKey: `${workMode}-policy`, now: '2026-07-10T12:00:00.000Z',
  });
  const project = { id: projectId, workMode, localAutonomyPolicies: [policy] };
  const allowed = evaluateLocalAutonomyExecution({ project, now: '2026-07-10T12:01:00.000Z', request: { requestedSteps: 1, estimatedCostCents: 5, toolOperations: ['search:evidence'] } });
  const denied = evaluateLocalAutonomyExecution({ project, now: '2026-07-10T12:01:00.000Z', request: { requestedSteps: policy.maxSteps + 1, estimatedCostCents: 101, toolOperations: ['model:unapproved', 'search:evidence', 'search:evidence'] } });
  assert(team.taskNodes.length > 0 && allowed.allowed, `${workMode} must permit bounded approved work.`);
  assert(['step-limit-exceeded', 'cost-limit-exceeded', 'tool-invocation-limit-exceeded', 'tool-operation-not-allowed'].every((code) => denied.reasonCodes.includes(code)), `${workMode} must fail closed on every projected limit.`);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-autonomy-governor-${process.pid}`);
const filePath = resolve(tempRoot, 'projects.json');
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
try {
  const kickoff = createKickoffProjectFromMeeting({
    projectId: 'autonomy_governor_gate_project', name: 'Autonomy Governor Gate', brief: 'Prove terminal local control.',
    team: [{ id: 'manager', name: 'Manager', title: 'Project Manager', isLeader: true }], now: '2026-07-10T10:00:00.000Z',
  });
  kickoff.project.autonomousRunControlSessionLedger = [{ id: 'gate-session', status: 'running', maxStepsPerLoop: 1, checksum: 'seed' }];
  const store = createAgentProjectFileStore({ filePath, projects: [kickoff.project], replaceWithSeed: true, hydrateProject: hydrateAgentProject });
  let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
  const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'manager-user' };
  let response = await api.handleAsync({
    method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/policies`, headers,
    body: { maxWallClockMs: 86_400_000, maxSteps: 4, maxCostCents: 20, maxToolInvocations: 1, allowedToolOperations: ['search:evidence'], actorId: 'manager', idempotencyKey: 'gate-policy', now: '2026-07-10T11:00:00.000Z' },
  });
  assert(response.status === 201, 'Policy must persist through the local API.');
  const policy = response.body.policy;
  response = await api.handleAsync({ method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/commands`, headers, body: { command: 'pause', expectedPolicyVersion: 1, expectedPolicyChecksum: policy.checksum, actorId: 'manager', reasonCode: 'gate-pause', idempotencyKey: 'gate-pause', now: '2026-07-10T11:01:00.000Z' } });
  assert(response.status === 201 && response.body.project.autonomousRunControlSessionLedger[0].status === 'paused', 'Pause must fence every active session.');
  api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
  response = await api.handleAsync({ method: 'GET', path: `/projects/${kickoff.project.id}/autonomous-run-control`, headers });
  assert(response.body.autonomousRunControl.summary.autonomyGovernorState === 'paused' && response.body.autonomousRunControl.nextActions.every((row) => !row.canRun), 'Paused governance must survive restart and block the unified control plane.');
  response = await api.handleAsync({ method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/commands`, headers, body: { command: 'resume', expectedPolicyVersion: 1, expectedPolicyChecksum: policy.checksum, actorId: 'manager', reasonCode: 'gate-resume', idempotencyKey: 'gate-resume', now: '2026-07-10T11:02:00.000Z' } });
  assert(response.status === 201 && response.body.project.autonomousRunControlSessionLedger[0].status === 'waiting', 'Resume must release only governor-paused sessions.');
  response = await api.handleAsync({ method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/commands`, headers, body: { command: 'stop', expectedPolicyVersion: 1, expectedPolicyChecksum: policy.checksum, actorId: 'manager', reasonCode: 'gate-stop', idempotencyKey: 'gate-stop', now: '2026-07-10T11:03:00.000Z' } });
  assert(response.status === 201 && response.body.project.autonomousRunControlSessionLedger[0].status === 'cancelled', 'Stop must cancel every project session.');
  response = await api.handleAsync({ method: 'POST', path: `/projects/${kickoff.project.id}/autonomy-governor/commands`, headers, body: { command: 'resume', expectedPolicyVersion: 1, expectedPolicyChecksum: policy.checksum, actorId: 'manager', reasonCode: 'gate-invalid-resume', idempotencyKey: 'gate-invalid-resume', now: '2026-07-10T11:04:00.000Z' } });
  assert(response.status === 400 && /terminal-stop/.test(response.body.message || ''), 'Terminal stop must never resume.');
  console.log('Local autonomy governor validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
