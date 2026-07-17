import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const validationSource = readFileSync(new URL('../scripts/validate-manager-demo-ui.mjs', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('manager demo waits for the focused graph transform to settle before asserting visible nodes', () => {
  assert.ok(validationSource.includes('window.__managerFlowFocusStability'));
  assert.ok(validationSource.includes('transform === stability.transform'));
  assert.ok(validationSource.includes('visibleCount > 0'));
  assert.ok(validationSource.includes('stableForMs >= 320'));
});

test('timeline proof focus uses absolute graph coordinates instead of accumulating animated screen offsets', () => {
  const focusEffectStart = appSource.indexOf("if (projectMode !== 'timeline' || !focusedTimelineProofIds.length) return;");
  const focusEffectEnd = appSource.indexOf('// Auto-scroll transcript', focusEffectStart);
  assert.notEqual(focusEffectStart, -1);
  assert.notEqual(focusEffectEnd, -1);
  const focusEffect = appSource.slice(focusEffectStart, focusEffectEnd);

  assert.ok(focusEffect.includes('node.offsetLeft'));
  assert.ok(focusEffect.includes('viewport.clientWidth / 2'));
  assert.ok(focusEffect.includes('setTlPan({'));
  assert.ok(!focusEffect.includes('setTlPan(prev =>'));
  assert.ok(!focusEffect.includes('node.getBoundingClientRect()'));
});

test('timeline proof focus retries when the asynchronous manager graph has not rendered its node yet', () => {
  const focusEffectStart = appSource.indexOf("if (projectMode !== 'timeline' || !focusedTimelineProofIds.length) return;");
  const focusEffectEnd = appSource.indexOf('// Auto-scroll transcript', focusEffectStart);
  assert.notEqual(focusEffectStart, -1);
  assert.notEqual(focusEffectEnd, -1);
  const focusEffect = appSource.slice(focusEffectStart, focusEffectEnd);

  assert.ok(focusEffect.includes('const focusTimelineProofNode = () => {'));
  assert.ok(focusEffect.includes('focusRetryTimer = window.setTimeout(focusTimelineProofNode, 100)'));
  assert.ok(focusEffect.includes('Date.now() < focusDeadline'));
  assert.ok(focusEffect.includes('window.clearTimeout(focusRetryTimer)'));
});
