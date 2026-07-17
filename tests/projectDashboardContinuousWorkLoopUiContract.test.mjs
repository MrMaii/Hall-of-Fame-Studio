import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBodySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBody.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardWorkLoopPanels.jsx', import.meta.url), 'utf8');
const continuousWorkLoopUrl = new URL('../src/project/ProjectDashboardContinuousWorkLoop.jsx', import.meta.url);

test('Dashboard Continuous Work Loop stays lazy and keeps Agent pulse and proof operations', () => {
  assert.ok(managerBodySource.includes("const ProjectDashboardWorkLoopPanels = lazy(() => import('./ProjectDashboardWorkLoopPanels.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardContinuousWorkLoop = lazy(() => import('./ProjectDashboardContinuousWorkLoop.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardContinuousWorkLoop'));
  assert.ok(existsSync(continuousWorkLoopUrl), 'Dashboard Continuous Work Loop component must exist');

  const componentSource = readFileSync(continuousWorkLoopUrl, 'utf8');
  for (const publicContract of [
    'continuous-work-loop',
    'continuous-work-loop-source',
    'continuous-work-loop-backend-required',
    'continuous-work-loop-sync-cockpit',
    'continuous-loop-agent-',
    'Run Loop Pulse',
    'Loop chat proof',
    'Loop timeline proof',
    'onSyncCockpit',
    'onRunAgentPulse',
    'onOpenChatProof',
    'onOpenTimelineProof',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Continuous Work Loop must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('pulseDisabled: !backendCommandAvailable || backendStation.loading'));
  assert.ok(appSource.includes('onRunAgentPulse: runBackendAgentPulse'));
  assert.ok(appSource.includes("onOpenChatProof: ids => openProjectChatProof(activeProject, ids, 'main')"));
  assert.ok(appSource.includes('onOpenTimelineProof: openProjectTimelineProof'));
  const localRowsStart = appSource.indexOf('const localContinuousWorkRows = localOperationsBoardRows.map(row => {');
  const localRowsEnd = appSource.indexOf('const agentForStateRow =', localRowsStart);
  const localRowsSource = appSource.slice(localRowsStart, localRowsEnd);
  for (const identityField of ['agentId: row.agent.id', 'name: row.agent.name', 'role: row.agent.role']) {
    assert.ok(
      localRowsSource.includes(identityField),
      `local Continuous Work Loop rows must expose stable Agent identity: ${identityField}`,
    );
  }
});
