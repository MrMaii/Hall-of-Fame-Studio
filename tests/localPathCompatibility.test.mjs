import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';

test('local project storage supports Chinese characters and spaces in its path', () => {
  const root = mkdtempSync(join(tmpdir(), 'hofs-path-'));
  const directory = join(root, '名人堂 工作区', '本地 数据');
  const filePath = join(directory, '项目 存档.json');
  try {
    mkdirSync(directory, { recursive: true });
    const store = createAgentProjectFileStore({
      filePath,
      projects: [{ id: 'path_project', name: '中文路径项目', tasks: [], team: [] }],
      replaceWithSeed: true,
    });
    assert.equal(store.getProject('path_project').name, '中文路径项目');
    assert.equal(existsSync(filePath), true);
    const restarted = createAgentProjectFileStore({ filePath });
    assert.equal(restarted.getProject('path_project').name, '中文路径项目');
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
