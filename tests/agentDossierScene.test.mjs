import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const scenePath = new URL('../src/scenes/AgentDossierScene.jsx', import.meta.url);

test('keeps the Agent Dossier backend-free and delegates contract actions to callbacks', () => {
  assert.equal(existsSync(scenePath), true, 'Agent Dossier must be extracted into its own module.');
  const source = readFileSync(scenePath, 'utf8');
  assert.doesNotMatch(source, /fetch\(|requestAgentBackend\(/);
  assert.match(source, /onStartContract\(agent\.id\)/);
  assert.match(source, /onClose/);
});
