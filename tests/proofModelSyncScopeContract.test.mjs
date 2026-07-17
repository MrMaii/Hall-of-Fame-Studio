import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const controlsSource = await readFile(new URL('../src/project/ProjectDashboardBackendSchedulerControls.jsx', import.meta.url), 'utf8');

test('manager refresh keeps launch-control models out of the automatic proof sync', () => {
  assert.match(
    appSource,
    /setTimeout\(\(\) => syncBackendReadyPackageSubmodels\(\{ silent: true, projectId, includeLaunchControls: false \}\), 0\)/,
  );
});

test('the proof-model button only loads the core proof models shown in the manager view', () => {
  assert.match(
    controlsSource,
    /data-testid="backend-sync-proof-models"[\s\S]{0,240}onClick=\{onSyncProofModels\}/,
  );
  assert.match(
    appSource,
    /onSyncProofModels: \(\) => syncBackendReadyPackageSubmodels\(\{ silent: false, includeLaunchControls: false \}\)/,
  );
});

test('repeated proof-model refreshes are coalesced per project', () => {
  assert.match(appSource, /const readyPackageSubmodelSyncInFlightRef = useRef\(\{\}\)/);
  assert.match(appSource, /const readyPackageSubmodelSyncPendingRef = useRef\(\{\}\)/);
  assert.match(
    appSource,
    /const inFlight = readyPackageSubmodelSyncInFlightRef\.current\[syncKey\][\s\S]{0,700}return inFlight\.then\(\(\) => readyPackageSubmodelSyncInFlightRef\.current\[syncKey\] \|\| null\)/,
  );
});
