import test from 'node:test';
import assert from 'node:assert/strict';

import {
  projectActivityText,
  recentUserFacingProjectActivity,
} from '../src/project/projectActivity.js';

test('ordinary project activity shows the newest real work and never renders an empty log row', () => {
  const project = {
    logs: [
      { id: 'old', time: '2026-07-14T09:00:00.000Z', log: '较早的真实工作' },
      { id: 'internal-author', time: '2026-07-14T12:00:00.000Z', agent: 'Agent Runtime', log: 'backend-backed runtime update' },
      { id: 'latest', time: '2026-07-14T13:00:00.000Z', log: '最新的真实工作' },
      { id: 'internal-route', time: '2026-07-14T11:30:00.000Z', text: 'POST /projects/internal-id/runtime' },
      { id: 'middle', time: '2026-07-14T11:00:00.000Z', message: '中间的真实工作' },
    ],
  };

  const rows = recentUserFacingProjectActivity(project, 3);

  assert.deepEqual(rows.map((row) => row.id), ['latest', 'middle', 'old']);
  assert.deepEqual(rows.map(projectActivityText), ['最新的真实工作', '中间的真实工作', '较早的真实工作']);
});
