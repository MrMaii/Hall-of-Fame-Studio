import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../src/scenes/AgentMarketRouteView.jsx', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('../src/scenes/AgentMarketScene.jsx', import.meta.url), 'utf8');

test('locally available talent opens immediately without a fixed loading delay', () => {
  assert.equal(appSource.includes('setTimeout(() => setIsDecrypting(false)'), false);
  assert.equal(appSource.includes('const [isDecrypting, setIsDecrypting]'), false);
  assert.equal(routeSource.includes('isDecrypting'), false);
  assert.equal(sceneSource.includes('Loading talent profiles'), false);
});
