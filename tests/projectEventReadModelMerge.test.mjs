import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendProjectEvents,
  createProjectLedgerEvent,
  summarizeProjectEventLedger,
  verifyProjectEventLedger,
} from '../src/agents/agentRuntime.js';
import { mergeBackendEventReadModel } from '../src/project/projectEventReadModel.js';

test('event read-model rows and integrity metadata replace the browser snapshot atomically', () => {
  const initial = appendProjectEvents({ id: 'p_event_sync', eventLedger: [] }, [
    createProjectLedgerEvent({ id: 'evt_initial', type: 'initial', summary: 'Initial event' }),
  ]);
  const backendProject = appendProjectEvents(initial, [
    createProjectLedgerEvent({ id: 'evt_backend', type: 'backend-update', summary: 'Backend event' }),
  ]);

  const merged = mergeBackendEventReadModel(initial, {
    eventLedger: backendProject.eventLedger,
    summary: summarizeProjectEventLedger(backendProject),
  });

  assert.equal(merged.eventLedger.length, 2);
  assert.equal(merged.eventLedgerRootHash, backendProject.eventLedgerRootHash);
  assert.equal(merged.eventLedgerLastSequence, backendProject.eventLedgerLastSequence);
  assert.equal(merged.eventLedgerEventCount, backendProject.eventLedgerEventCount);
  assert.equal(verifyProjectEventLedger(merged).valid, true);
});
