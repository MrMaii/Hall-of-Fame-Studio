import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/project/AgentContractProjectPicker.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('talent contract project picker uses ordinary Chinese without project ids or status codes', () => {
  for (const label of ['选择签约项目', '团队成员', '已经加入团队', '打开项目', '加入项目', '创建新项目']) {
    assert.match(source, new RegExp(label));
  }
  assert.doesNotMatch(source, /project\.id}\s*\//);
  assert.doesNotMatch(source, /Project Contract Target|Backend target required|Open Project|Start new project/);
});

test('talent contract project picker is a named modal with a reachable close action', () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-label="关闭项目选择"/);
});

test('the application uses the ordinary contract picker without losing contract eligibility checks', () => {
  assert.match(appSource, /lazy\(\(\) => import\('\.\/project\/AgentContractProjectPicker\.jsx'\)\)/);
  assert.match(appSource, /<AgentContractProjectPicker/);
  assert.match(appSource, /const backendTargetMissing = !shouldAttemptBackendProjectWrite\(project\) && !canUseLocalContractFallback/);
  assert.match(appSource, /alreadyInTeam\s*\? openContractedProjectFromPicker\(projectId\)\s*:\s*confirmAgentContractForProject\(projectId\)/);
});
