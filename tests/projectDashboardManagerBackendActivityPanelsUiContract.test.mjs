import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const parentAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendReadModelPanels.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerBackendActivityPanels.jsx', import.meta.url);

test('Manager backend activity panels share one lazy assembly while every command and proof operation stays in App', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerBackendActivityPanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(parentAssemblySource.includes("const ProjectDashboardManagerBackendActivityPanels = lazy(() => import('./ProjectDashboardManagerBackendActivityPanels.jsx'));"));
  assert.ok(parentAssemblySource.includes('<ProjectDashboardManagerBackendActivityPanels'));

  const components = [
    'ProjectDashboardManagerReadModelSummaryPanels',
    'ProjectDashboardAutonomousRunControl',
    'ProjectDashboardAgentAutonomousActionQueue',
    'ProjectDashboardLatestBackendWork',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`), `${component} must remain lazy`);
    assert.ok(assemblySource.includes(`<${component}`), `${component} must remain rendered`);
  }
  const order = components.map(component => assemblySource.indexOf(`<${component}`));
  assert.deepEqual(order, [...order].sort((left, right) => left - right), 'Manager backend activity panels must keep their original order');

  assert.ok(assemblySource.includes('view.autonomousRunControl &&'));
  assert.ok(assemblySource.includes('view.agentAutonomousActionQueue &&'));
  assert.equal(assemblySource.includes('view.backendError &&'), false);
  assert.equal(assemblySource.includes('{view.backendError}'), false);

  for (const operation of [
    'onRunLoop: runAutonomousRunControlLoop',
    'onStartSession: startAutonomousRunControlSession',
    'onSchedulerTick: runAutopilotSessionThroughScheduler',
    'onDirectTick: tickAutonomousRunControlSession',
    'onPauseSession: pauseAutonomousRunControlSession',
    'onCancelSession: cancelAutonomousRunControlSession',
    'onRunAction: runAutonomousRunControlAction',
    'onRunRow: runAgentAutonomousActionQueueRow',
    "onOpenChatProof: proofIds => openProjectChatProof(activeProject, proofIds, 'main')",
    'onOpenTimelineProof: openProjectTimelineProof',
    'commandDisabled: !backendCommandAvailable || backendStation.loading',
    'runDisabled: !backendCommandAvailable || backendStation.loading',
  ]) {
    assert.ok(appSource.includes(operation), `App must retain ${operation}`);
  }
});
