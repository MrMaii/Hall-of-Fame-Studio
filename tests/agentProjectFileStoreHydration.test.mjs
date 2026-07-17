import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';

test('an internally derived project save does not repeat full hydration', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-project-store-hydration-'));
  const filePath = join(directory, 'projects.json');
  let hydrationCount = 0;
  try {
    const store = createAgentProjectFileStore({
      filePath,
      hydrateProject: (project) => {
        hydrationCount += 1;
        return { ...project, hydratedRevision: (project.hydratedRevision || 0) + 1 };
      },
    });

    const first = store.saveProject({ id: 'project_1', name: 'First name' });
    const second = store.saveProject({ ...first, name: 'Updated name' });

    assert.equal(hydrationCount, 1);
    assert.equal(second.hydratedRevision, 1);
    assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).projects[0].name, 'Updated name');

    let reloadHydrationCount = 0;
    const reloaded = createAgentProjectFileStore({
      filePath,
      hydrateProject: (project) => {
        reloadHydrationCount += 1;
        return { ...project, reloaded: true };
      },
    });
    assert.equal(reloadHydrationCount, 1);
    assert.equal(reloaded.getProject('project_1').reloaded, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
