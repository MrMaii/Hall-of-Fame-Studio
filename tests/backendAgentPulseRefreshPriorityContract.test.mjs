import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('Agent pulses prioritize the next user action over post-write read-model refreshes', () => {
  assert.match(appSource, /const backendAgentPulseRefreshTimerRef = useRef\(null\);/);

  const pulseStart = appSource.indexOf('const runBackendAgentPulse = async');
  const pulseEnd = appSource.indexOf('const defaultBackendReviewerAgentId', pulseStart);
  const pulseSource = appSource.slice(pulseStart, pulseEnd);

  assert.match(pulseSource, /cancelPendingBackendReadModelRefreshes\(\)/);
  assert.match(pulseSource, /timeoutMs: 60_000/);
  assert.match(pulseSource, /backendAgentPulseRefreshTimerRef\.current = setTimeout\(async \(\) =>/);
  assert.match(pulseSource, /await refreshAgentWriteReadModels\(\{ payload, agentId, projectId \}\)/);
  assert.doesNotMatch(pulseSource, /await refreshAgentWriteReadModels\(\{ payload, agentId, projectId: activeProject\.id \}\)/);
});
