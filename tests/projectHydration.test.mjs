import assert from 'node:assert/strict';
import test from 'node:test';

import { hydrateUiProject } from '../src/project/projectHydration.js';

test('legacy and catalog-only projects hydrate with a render-safe empty team', () => {
  const legacyProject = hydrateUiProject({
    id: 'legacy-project',
    name: 'Legacy project',
  });

  assert.deepEqual(legacyProject.team, []);
  assert.deepEqual(legacyProject.tasks, []);
  assert.deepEqual(legacyProject.logs, []);
  assert.deepEqual(legacyProject.eventLedger, []);
  assert.deepEqual(legacyProject.autonomousLedger, []);
  assert.deepEqual(legacyProject.autonomousSchedulerLedger, []);
});

test('project hydration preserves an existing team', () => {
  const team = [{ id: 'agent-1', name: 'Agent One' }];

  assert.deepEqual(hydrateUiProject({ id: 'project-1', team }).team, team);
});
