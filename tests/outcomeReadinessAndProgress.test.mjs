import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function projectFixture({ material = false } = {}) {
  return {
    id: 'outcome-readiness-project',
    name: 'Research readiness',
    objective: 'Research traceable evidence and produce a reviewed synthesis.',
    status: 'executing',
    team: [{ id: 'researcher', name: 'Researcher', role: 'Evidence Researcher' }],
    tasks: [{
      id: 'research-task',
      text: 'Search and synthesize evidence.',
      ownerId: 'researcher',
      status: material ? 'awaiting-review' : 'in-progress',
      outcome: material ? { material: true, accepted: false } : { material: false, accepted: false },
    }],
    agentStates: {},
    logs: [],
    eventLedger: [],
    evidenceSearches: material ? [{ id: 'search-1', provider: 'test-search', sources: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] }] : [],
    agentSubmissions: material ? [{ id: 'submission-1', taskId: 'research-task', body: 'A substantive evidence synthesis.' }] : [],
    submissionReviews: [],
  };
}

const modelProvider = { status: () => ({ provider: 'test-model', model: 'test-v1', enabled: true, configured: true }) };
const searchProvider = { status: () => ({ provider: 'test-search', enabled: true, configured: true }) };

test('runtime autonomy readiness fails closed when scheduler is disabled', () => {
  const service = createAgentProjectService({
    projects: [projectFixture({ material: true })],
    messages: [],
    llmProvider: modelProvider,
    searchProvider,
    runtimeControls: { autonomousSchedulerEnabled: false },
  });
  const status = service.getRuntimeAutonomyStatus('outcome-readiness-project', { now: '2026-07-20T12:00:00.000Z' });
  const gate = status.gates.find((row) => row.id === 'autonomous-scheduler-running');

  assert.ok(gate);
  assert.equal(gate.ready, false);
  assert.equal(status.readyForLocalAutonomy, false);
});

test('runtime autonomy readiness distinguishes work-plane health from receipt infrastructure', () => {
  const service = createAgentProjectService({
    projects: [projectFixture({ material: false })],
    messages: [],
    llmProvider: modelProvider,
    searchProvider,
    runtimeControls: { autonomousSchedulerEnabled: true },
  });
  const status = service.getRuntimeAutonomyStatus('outcome-readiness-project', { now: '2026-07-20T12:00:00.000Z' });
  const providerGate = status.gates.find((row) => row.id === 'required-work-providers-ready');
  const materialGate = status.gates.find((row) => row.id === 'material-output-observed');

  assert.equal(providerGate.ready, true);
  assert.equal(materialGate.ready, false);
  assert.equal(status.readyForLocalAutonomy, false);
  assert.equal(status.workPlane.schedulerEnabled, true);
  assert.equal(status.workPlane.materialOutcomeCount, 0);
});

test('an enabled idle scheduler is ready when it is accepting scheduled ticks', () => {
  const service = createAgentProjectService({
    projects: [projectFixture({ material: true })],
    messages: [],
    llmProvider: modelProvider,
    searchProvider,
    runtimeControls: {
      schedulerStatus: () => ({ enabled: true, running: false, acceptingTicks: true }),
    },
  });
  const status = service.getRuntimeAutonomyStatus('outcome-readiness-project', { now: '2026-07-20T12:00:00.000Z' });
  const gate = status.gates.find((row) => row.id === 'autonomous-scheduler-running');

  assert.equal(gate.ready, true);
  assert.equal(status.workPlane.schedulerRunning, true);
});

test('configured providers are not ready while their live transport is failing', () => {
  const failingModelProvider = {
    status: () => ({
      provider: 'test-model',
      model: 'test-v1',
      enabled: true,
      configured: true,
      transportReliability: { circuit: { state: 'closed', failureCount: 2 } },
    }),
  };
  const service = createAgentProjectService({
    projects: [projectFixture({ material: true })],
    messages: [],
    llmProvider: failingModelProvider,
    searchProvider,
    runtimeControls: { autonomousSchedulerEnabled: true },
  });
  const status = service.getRuntimeAutonomyStatus('outcome-readiness-project', { now: '2026-07-20T12:00:00.000Z' });
  const providerGate = status.gates.find((row) => row.id === 'required-work-providers-ready');

  assert.equal(providerGate.ready, false);
  assert.equal(status.readyForLocalAutonomy, false);
});

test('provider transport failures invalidate a previously cached readiness result', () => {
  let failureCount = 0;
  const mutableModelProvider = {
    status: () => ({
      provider: 'test-model',
      model: 'test-v1',
      enabled: true,
      configured: true,
      transportReliability: { circuit: { state: 'closed', failureCount } },
    }),
  };
  const service = createAgentProjectService({
    projects: [projectFixture({ material: true })],
    messages: [],
    llmProvider: mutableModelProvider,
    searchProvider,
    runtimeControls: { autonomousSchedulerEnabled: true },
  });

  const first = service.getRuntimeAutonomyStatus('outcome-readiness-project');
  failureCount = 1;
  const second = service.getRuntimeAutonomyStatus('outcome-readiness-project');

  assert.equal(first.workPlane.requiredProvidersReady, true);
  assert.equal(second.workPlane.requiredProvidersReady, false);
});

test('direct local Agent server enables the autonomous outcome loop unless explicitly disabled', () => {
  const source = readFileSync(new URL('../scripts/agent-project-server.mjs', import.meta.url), 'utf8');
  for (const variable of [
    'AGENT_AUTONOMOUS_SCHEDULER',
    'AGENT_AUTONOMOUS_AGENT_STRATEGY',
    'AGENT_AUTONOMOUS_AGENT_SUBMISSIONS',
    'AGENT_AUTONOMOUS_AGENT_REVIEWS',
    'AGENT_AUTONOMOUS_AGENT_REVIEW_RESPONSES',
  ]) {
    assert.match(source, new RegExp(`envFlag\\('${variable}', true\\)`));
  }
  assert.match(source, /envFlag\('AGENT_AUTONOMOUS_PROJECT_COORDINATION', false\)/);
  assert.match(source, /envFlag\('AGENT_AUTONOMOUS_LEGACY_AUTOPILOT', false\)/);
  assert.match(source, /runProjectCoordinationCycles: autonomousProjectCoordinationEnabled/);
});
