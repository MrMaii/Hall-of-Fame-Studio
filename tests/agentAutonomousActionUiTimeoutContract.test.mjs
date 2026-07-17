import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const validationSource = readFileSync(new URL('../scripts/validate-manager-backend-ui.mjs', import.meta.url), 'utf8');
const coreValidationSource = readFileSync(new URL('../scripts/validate-manager-backend-core-ui.mjs', import.meta.url), 'utf8');

test('manual Agent autonomous actions tolerate a busy local worker runtime', () => {
  const actionSource = appSource.slice(
    appSource.indexOf('const runAgentAutonomousActionQueueRow = async'),
    appSource.indexOf('const runCollaborationIntentQueueRow = async', appSource.indexOf('const runAgentAutonomousActionQueueRow = async')),
  );
  assert.match(actionSource, /timeoutMs: 60_000/);
  assert.doesNotMatch(actionSource, /if \(!activeProject \|\| !backendCommandAvailable/);
  assert.match(validationSource, /agentAutonomousRunResponse[\s\S]*timeout: 65000/);
  assert.match(coreValidationSource, /backend-agent-autonomous-action-run-output'\)\.waitFor\(\{ state: 'visible', timeout: 65000 \}\)/);
});

test('Autopilot scheduler ticks tolerate a busy local worker runtime', () => {
  const actionSource = appSource.slice(
    appSource.indexOf('const runAutopilotSessionThroughScheduler = async'),
    appSource.indexOf('const pauseAutonomousRunControlSession = async', appSource.indexOf('const runAutopilotSessionThroughScheduler = async')),
  );
  assert.match(actionSource, /timeoutMs: 60_000/);
  assert.match(actionSource, /requestAgentBackend\('\/workers\/autopilot\/due'/);
  assert.doesNotMatch(actionSource, /requestAgentBackend\('\/workers\/autonomous\/tick'/);
  assert.doesNotMatch(actionSource, /if \(!activeProject \|\| !backendCommandAvailable/);
  assert.doesNotMatch(actionSource, /forceProjectRun: true/);
  assert.doesNotMatch(actionSource, /forceAgentRun: true/);
  assert.match(actionSource, /cancelPendingBackendReadModelRefreshes\(\)/);
  assert.match(coreValidationSource, /backend-autonomous-run-control-session-worker-receipt'\)\.waitFor\(\{ state: 'visible', timeout: 65000 \}\)/);

  const sessionPreflightSource = appSource.slice(
    appSource.indexOf('const ensureBackendAutopilotSessionForScheduler = async'),
    appSource.indexOf('const runAutopilotSessionThroughScheduler = async', appSource.indexOf('const ensureBackendAutopilotSessionForScheduler = async')),
  );
  assert.match(sessionPreflightSource, /const knownSession =/);
  assert.match(sessionPreflightSource, /if \(knownSession\) return knownSession;/);

  const sessionStartSource = appSource.slice(
    appSource.indexOf('const startAutonomousRunControlSession = async'),
    appSource.indexOf('const ensureBackendAutopilotSessionForScheduler = async', appSource.indexOf('const startAutonomousRunControlSession = async')),
  );
  assert.match(sessionStartSource, /cancelPendingBackendReadModelRefreshes\(\)/);
  assert.match(sessionStartSource, /backendAutopilotSessionRefreshTimerRef\.current = setTimeout\(async \(\) =>/);
  assert.ok(sessionStartSource.indexOf('backendAutopilotSessionRefreshTimerRef.current = setTimeout') < sessionStartSource.indexOf('await refreshAutonomousRunControlReadModels'));
});

test('Agent autonomous actions do not block the next user command with read-model refreshes', () => {
  assert.match(appSource, /const backendAgentAutonomousActionRefreshTimerRef = useRef\(null\);/);
  assert.match(appSource, /const backendAutopilotSessionRefreshTimerRef = useRef\(null\);/);
  const actionSource = appSource.slice(
    appSource.indexOf('const runAgentAutonomousActionQueueRow = async'),
    appSource.indexOf('const runCollaborationIntentQueueRow = async', appSource.indexOf('const runAgentAutonomousActionQueueRow = async')),
  );

  assert.match(actionSource, /cancelPendingBackendReadModelRefreshes\(\)/);
  assert.match(actionSource, /backendAgentAutonomousActionRefreshTimerRef\.current = setTimeout\(async \(\) =>/);
  assert.match(actionSource, /}, 15000\);/);
  assert.match(actionSource, /await refreshAgentWriteReadModels/);
  assert.match(actionSource, /await syncBackendAgentAutonomousActionQueue/);
  assert.match(actionSource, /await syncBackendCollaborationIntentQueue/);
  assert.doesNotMatch(actionSource, /setTimeout\(\(\) => syncBackendAgentAutonomousActionQueue/);

  const intentSyncSource = appSource.slice(
    appSource.indexOf('const syncBackendCollaborationIntentQueue = async'),
    appSource.indexOf('const syncBackendAutonomousCycleConsistency = async', appSource.indexOf('const syncBackendCollaborationIntentQueue = async')),
  );
  assert.match(intentSyncSource, /if \(!silent\) cancelPendingBackendReadModelRefreshes\(\)/);
});
