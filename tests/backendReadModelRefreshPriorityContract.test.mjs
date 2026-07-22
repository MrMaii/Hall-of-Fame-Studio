import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('every interactive backend operation cancels pending cross-operation read-model refreshes', () => {
  assert.match(appSource, /const cancelPendingBackendReadModelRefreshes = \(\) => \{/);
  for (const timerRef of [
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

test('interactive operations cancel only background project reads', () => {
  assert.match(appSource, /import \{ createProjectReadCoordinator \} from '\.\/project\/projectReadCoordinator\.js';/);
  assert.match(appSource, /projectReadCoordinatorRef\.current = createProjectReadCoordinator\(\{ maxConcurrent: 4 \}\)/);

  const cancelSource = appSource.slice(
    appSource.indexOf('const cancelPendingBackendReadModelRefreshes = () => {'),
    appSource.indexOf('const readyPackageSubmodelSyncInFlightRef', appSource.indexOf('const cancelPendingBackendReadModelRefreshes = () => {')),
  );
  assert.match(cancelSource, /projectReadCoordinatorRef\.current/);
  assert.match(cancelSource, /coordinator\.cancelBackground\(\)/);
  assert.doesNotMatch(cancelSource, /coordinator\.cancelAll\(\)/);

  const requestSource = appSource.slice(
    appSource.indexOf('const requestAgentBackend = async'),
    appSource.indexOf('const persistLocalAuthSession', appSource.indexOf('const requestAgentBackend = async')),
  );
  assert.match(requestSource, /priority = 'background'/);
  assert.match(requestSource, /coordinator\.schedule\(\{/);
  assert.match(requestSource, /run: \(\{ signal, timeoutMs: remainingMs \}\) => runRequest\(signal, remainingMs\)/);
  assert.doesNotMatch(requestSource, /isInteractiveProjectRead/);
});

test('opening a project always enters the complete console and gives its core dashboard read user-visible priority', () => {
  const navigationSource = appSource.slice(
    appSource.indexOf('const navToProject = (id) =>'),
    appSource.indexOf('const navToInitiation', appSource.indexOf('const navToProject = (id) =>')),
  );
  assert.match(navigationSource, /cancelPendingBackendReadModelRefreshes\(\);/);
  assert.match(navigationSource, /setProjectDashboardAdvancedOpen\(true\);/);
  assert.ok(!appSource.includes('project-simple-dashboard'));
  assert.ok(!appSource.includes("ProjectOverview.jsx"));

  const coreSyncEffectStart = appSource.indexOf('shouldStartProjectDashboardCoreSync(projectDashboardCoreSync, activeProject.id)');
  const coreSyncStart = appSource.indexOf('Promise.all([', coreSyncEffectStart);
  const coreSyncSource = appSource.slice(coreSyncStart, appSource.indexOf(']).then', coreSyncStart) + 2);
  assert.equal(coreSyncSource.match(/priority: 'user-visible'/g)?.length, 3);
});
