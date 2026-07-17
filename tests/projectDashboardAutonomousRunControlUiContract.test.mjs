import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendActivityPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardAutonomousRunControl.jsx', import.meta.url);

test('Autonomous Run Control stays lazy while App retains every command and proof callback', () => {
  assert.ok(existsSync(componentUrl), 'Autonomous Run Control component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardAutonomousRunControl = lazy(() => import('./ProjectDashboardAutonomousRunControl.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardAutonomousRunControl'));
  for (const appContract of [
    'onRunLoop: runAutonomousRunControlLoop',
    'onStartSession: startAutonomousRunControlSession',
    'onSchedulerTick: runAutopilotSessionThroughScheduler',
    'onDirectTick: tickAutonomousRunControlSession',
    'onPauseSession: pauseAutonomousRunControlSession',
    'onCancelSession: cancelAutonomousRunControlSession',
    'onRunAction: runAutonomousRunControlAction',
    "onOpenChatProof: proofIds => openProjectChatProof(activeProject, proofIds, 'main')",
    'onOpenTimelineProof: openProjectTimelineProof',
    'commandDisabled: !backendCommandAvailable || backendStation.loading',
    'sessionSchedulerPending: backendStation.autonomousRunControlSessionSchedulerPending',
    'autonomousRunControlSessionSchedulerPending: true',
    'autonomousRunControlSessionSchedulerPending: false',
  ]) {
    assert.ok(appSource.includes(appContract), `App must retain ${appContract}`);
  }

  for (const id of [
    'backend-autonomous-run-control-snapshot',
    'backend-autonomous-run-control-loop-run',
    'backend-autonomous-run-control-session-start',
    'backend-autonomous-run-control-session-scheduler-tick',
    'backend-autonomous-run-control-session-tick',
    'backend-autonomous-run-control-session-pause',
    'backend-autonomous-run-control-session-cancel',
    'backend-autonomous-run-control-run-receipt',
    'backend-autonomous-run-control-run-output',
    'backend-autonomous-run-control-run-output-empty',
    'backend-autonomous-run-control-run-output-rows',
    'backend-autonomous-run-control-loop-receipt',
    'backend-autonomous-run-control-session-receipt',
    'backend-autonomous-run-control-session-tick-receipt',
    'backend-autonomous-run-control-session-worker-receipt',
    'backend-autonomous-run-control-session-scheduler-running',
    'backend-autopilot-provider-evidence-receipt',
  ]) {
    assert.ok(componentSource.includes(`data-testid="${id}"`), `missing run-control surface: ${id}`);
  }

  assert.ok(componentSource.includes("projectText('Running Scheduler Tick…')"));

  for (const dynamicId of [
    'backend-autonomous-run-control-output-${row.id}',
    'autonomous-run-control-output-chat-proof-${row.id}',
    'autonomous-run-control-output-timeline-proof-${row.id}',
    'backend-autonomous-run-control-action-run-${action.id}',
  ]) {
    assert.ok(componentSource.includes(dynamicId), `missing dynamic run-control surface: ${dynamicId}`);
  }

  assert.equal(
    (componentSource.match(/output\.artifact && !output\.workSubmission \?/g) || []).length,
    1,
    'one artifact output must render exactly one row',
  );
});
