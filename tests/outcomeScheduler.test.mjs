import assert from 'node:assert/strict';
import test from 'node:test';

import { createAutonomousSchedulerController } from '../src/agents/agentProjectHttpServer.js';

test('outcome scheduler consumes due asynchronous Agent actions while legacy chatter loops stay disabled', async () => {
  const calls = [];
  const api = {
    store: { listProjects: () => [{ id: 'research-project' }] },
    service: {
      getAgentAutonomousActionQueue: () => ({
        rows: [{
          agentId: 'researcher',
          selectedAction: 'continue-owned-work',
          canRun: true,
          due: true,
          runApiPath: '/projects/research-project/agent-autonomous-action-queue/researcher/run',
        }],
      }),
    },
    handle: ({ path }) => {
      calls.push({ kind: 'sync', path });
      return { status: 200, body: { processed: [], skipped: [], messages: [], messageCount: 0 } };
    },
    handleAsync: async ({ path }) => {
      calls.push({ kind: 'async', path });
      return { status: 200, body: { submission: { id: 'submission-1' }, evidenceSearch: { id: 'search-1' } } };
    },
  };
  const scheduler = createAutonomousSchedulerController({ api });
  const result = await scheduler.tick({
    runProjectCoordinationCycles: false,
    runLegacyAgentPulseCycles: false,
    runAgentOutcomeActions: true,
    now: '2026-07-20T14:00:00.000Z',
  });

  assert.deepEqual(calls, [{
    kind: 'async',
    path: '/projects/research-project/agent-autonomous-action-queue/researcher/run',
  }]);
  assert.equal(result.result.agentOutcomeActions[0].submissionId, 'submission-1');
  assert.equal(scheduler.status().agentOutcomeActionCount, 1);
});
