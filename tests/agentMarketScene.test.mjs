import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const scenePath = new URL('../src/scenes/AgentMarketScene.jsx', import.meta.url);

test('keeps Talent Market backend-free and delegates selection to callbacks', () => {
  assert.equal(existsSync(scenePath), true, 'Agent Market scene must be extracted into its own module.');
  const source = readFileSync(scenePath, 'utf8');
  assert.doesNotMatch(source, /fetch\(|requestAgentBackend\(/);
  assert.match(source, /onOpenDossier\(agent\.id\)/);
});
