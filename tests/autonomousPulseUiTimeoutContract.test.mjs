import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('manual Hour and Day pulses tolerate a busy local worker runtime', () => {
  assert.match(
    appSource,
    /lastActionPrefix: cadence === 'daily' \? 'Server day report' : 'Server hour pulse',\s*timeoutMs: 60_000,/,
  );
});

test('the manual Server Pulse tolerates a busy local worker runtime', () => {
  assert.match(
    appSource,
    /lastActionPrefix: 'Server pulse',\s*timeoutMs: 60_000,/,
  );
});

test('scheduler pulses do not enqueue every dashboard refresh ahead of the next user pulse', () => {
  assert.match(appSource, /const backendSchedulerRefreshTimerRef = useRef\(null\);/);

  const pulseStart = appSource.indexOf('const runBackendSchedulerTickPulse = async');
  const pulseEnd = appSource.indexOf('const runBackendServerPulse = async', pulseStart);
  const pulseSource = appSource.slice(pulseStart, pulseEnd);

  assert.match(pulseSource, /cancelPendingBackendReadModelRefreshes\(\)/);
  assert.match(pulseSource, /backendSchedulerRefreshTimerRef\.current = setTimeout\(async \(\) =>/);
  assert.match(pulseSource, /await syncBackendManagerDashboard/);
  assert.match(pulseSource, /await syncBackendProjectTranscripts/);
  assert.match(pulseSource, /await syncBackendTimelineAndEvents/);
  assert.doesNotMatch(pulseSource, /setTimeout\(\(\) => syncBackendProjectTranscripts/);
  assert.doesNotMatch(pulseSource, /setTimeout\(\(\) => syncBackendTimelineAndEvents/);
});
