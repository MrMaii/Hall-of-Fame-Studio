import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const activityAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendActivityPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadModelSummaryPanels.jsx', import.meta.url);

test('Manager read-model snapshots and action queue summary stay lazy without changing the complete controls', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager read-model summary wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(activityAssemblySource.includes("const ProjectDashboardManagerReadModelSummaryPanels = lazy(() => import('./ProjectDashboardManagerReadModelSummaryPanels.jsx'));"));
  assert.ok(activityAssemblySource.includes('<ProjectDashboardManagerReadModelSummaryPanels'));

  const components = [
    'ProjectDashboardManagerReadModelSnapshots',
    'ProjectDashboardManagerActionQueueSnapshot',
  ];
  for (const component of components) {
    assert.ok(wrapperSource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`), `${component} must remain lazy`);
    assert.ok(wrapperSource.includes(`<${component}`), `${component} must remain mounted`);
  }
  const mountOrder = components.map(component => wrapperSource.indexOf(`<${component}`));
  assert.deepEqual(mountOrder, [...mountOrder].sort((left, right) => left - right), 'Manager read-model summaries must retain their original order');

  for (const contract of [
    'backendManagerDashboard={managerDashboard}',
    'activeProjectId={activeProjectId}',
    'backendManagerCommandCenter={managerCommandCenter}',
    'backendManagerScenarioWalkthrough={managerScenarioWalkthrough}',
    'backendManagerScenarioTrail={managerScenarioTrail}',
    'backendManagerRequirementMatrix={managerRequirementMatrix}',
    'backendSyncProtocolAudit={syncProtocolAudit}',
    'backendManagerUseCaseAudit={managerUseCaseAudit}',
    'managerReadModelSourceBadge={managerReadModelSourceBadge}',
    'projectText={projectText}',
    'backendManagerActionQueue={managerActionQueue}',
  ]) {
    assert.ok(wrapperSource.includes(contract), `Manager read-model summary wrapper must retain ${contract}`);
  }

  for (const retainedCompleteControl of [
    "const ProjectDashboardAutonomousRunControl = lazy(() => import('./ProjectDashboardAutonomousRunControl.jsx'));",
    '<ProjectDashboardAutonomousRunControl',
    'onRunAction: runAutonomousRunControlAction',
    'onSchedulerTick: runAutopilotSessionThroughScheduler',
    'onStartSession: startAutonomousRunControlSession',
  ]) {
    const source = retainedCompleteControl.includes('lazy(()') || retainedCompleteControl.startsWith('<') ? activityAssemblySource : appSource;
    assert.ok(source.includes(retainedCompleteControl), `Complete autonomous control must retain ${retainedCompleteControl}`);
  }
});
