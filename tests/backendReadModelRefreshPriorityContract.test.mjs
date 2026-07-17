import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('every interactive backend operation cancels pending cross-operation read-model refreshes', () => {
  assert.match(appSource, /const cancelPendingBackendReadModelRefreshes = \(\) => \{/);
  for (const timerRef of [
    'backendProjectCommandRefreshTimerRef',
    'backendSchedulerRefreshTimerRef',
    'backendAgentPulseRefreshTimerRef',
    'backendAgentAutonomousActionRefreshTimerRef',
    'backendAutopilotSessionRefreshTimerRef',
  ]) {
    assert.match(appSource, new RegExp(`\\b${timerRef}\\b`));
  }
  assert.match(appSource, /clearTimeout\(timerRef\.current\)/);

  for (const operation of [
    'const runBackendProjectCommand = async',
    'const runBackendSchedulerTickPulse = async',
    'const runBackendAgentPulse = async',
    'const runAgentAutonomousActionQueueRow = async',
    'const enterProjectScene = (mode) =>',
    'const exitProjectScene = () =>',
  ]) {
    const start = appSource.indexOf(operation);
    assert.ok(start >= 0, `${operation} must remain present`);
    assert.ok(appSource.indexOf('cancelPendingBackendReadModelRefreshes();', start) < start + 1200, `${operation} must cancel pending refreshes before work`);
  }

  for (const timerRef of [
    'backendProjectCommandRefreshTimerRef',
    'backendSchedulerRefreshTimerRef',
    'backendAgentPulseRefreshTimerRef',
  ]) {
    assert.match(appSource, new RegExp(`${timerRef}\\.current = setTimeout\\(async \\(\\) => \\{[\\s\\S]*?\\}, 5000\\);`));
  }

  for (const timerRef of [
    'backendAgentAutonomousActionRefreshTimerRef',
    'backendAutopilotSessionRefreshTimerRef',
  ]) {
    assert.match(appSource, new RegExp(`${timerRef}\\.current = setTimeout\\(async \\(\\) => \\{[\\s\\S]*?\\}, 15000\\);`));
  }
});

test('interactive operations cancel queued and active background project reads', () => {
  assert.match(
    appSource,
    /projectReadCoordinatorRef = useRef\(\{ active: 0, queue: \[\], inFlight: new Map\(\), running: new Set\(\) \}\)/,
  );

  const cancelSource = appSource.slice(
    appSource.indexOf('const cancelPendingBackendReadModelRefreshes = () => {'),
    appSource.indexOf('const readyPackageSubmodelSyncInFlightRef', appSource.indexOf('const cancelPendingBackendReadModelRefreshes = () => {')),
  );
  assert.match(cancelSource, /projectReadCoordinatorRef\.current/);
  assert.match(cancelSource, /coordinator\.queue\.splice\(0\)/);
  assert.match(cancelSource, /job\.controller\.abort\(\)/);
  assert.match(cancelSource, /coordinator\.running/);

  const requestSource = appSource.slice(
    appSource.indexOf('const requestAgentBackend = async'),
    appSource.indexOf('const persistLocalAuthSession', appSource.indexOf('const requestAgentBackend = async')),
  );
  assert.match(requestSource, /const jobController = new AbortController\(\)/);
  assert.match(requestSource, /controller: jobController/);
  assert.match(requestSource, /run: \(\) => runRequest\(jobController\.signal\)/);
});
