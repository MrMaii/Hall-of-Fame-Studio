import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeActivityNodeForDisplay } from '../src/project/humanReadableRecords.js';

test('a new timeline keeps meaningful nodes from an older backend visible', () => {
  const legacyNode = normalizeActivityNodeForDisplay({
    id: 'legacy-completed-task',
    subtype: 'task-completed',
    agentName: 'Lincoln',
    commitMessage: 'Lincoln completed the login API',
  });

  assert.equal(legacyNode.displayTitle, 'Lincoln completed the login API');
  assert.equal(legacyNode.publiclyVisible, true);

  const internalOnlyNode = normalizeActivityNodeForDisplay({
    id: 'legacy-runtime-log',
    subtype: 'record',
    title: 'Timeline log',
    summary: 'System record',
  });
  assert.equal(internalOnlyNode.publiclyVisible, false);
});
