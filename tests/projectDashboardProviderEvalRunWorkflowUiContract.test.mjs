import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProviderEvalRunWorkflow.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageProviderSecurityPanels.jsx', import.meta.url);

test('Dashboard provider eval runs stay lazy while App keeps the real receipt command and disable policy', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package provider security wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardProviderEvalRunWorkflow = lazy(() => import('./ProjectDashboardProviderEvalRunWorkflow.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardProviderEvalRunWorkflow'));
  assert.ok(existsSync(componentUrl), 'Dashboard provider eval run workflow component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-provider-eval-run-workflow-snapshot',
    'Provider Eval Runs',
    'backend-provider-eval-run-workflow-source',
    'Eval Ready',
    'Eval Record Needed',
    'backend-provider-eval-record-shadow-replay',
    'Record Eval',
    'Runs',
    'Critical Replay',
    'Operations',
    'Gates',
    'Proofs',
    'Events',
    'Latest Run',
    'provider-eval-run-row-',
    'Provider eval route',
    'onRecordShadowReplay',
    'recordShadowReplayDisabled',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard provider eval runs must keep ${publicContract}`);
  }

  for (const appContract of [
    'providerEvalAvailable: readyPackageModelAvailable(backendProviderEvalRunWorkflow)',
    'onRecordProviderEvalShadowReplay: () => runBackendPrivatePilotReceipt({',
    "label: 'Provider eval shadow replay'",
    "reason: 'Record controlled provider run shadow replay from the Manager Ready Package.'",
    "workflowKey: 'providerEvalRunWorkflow'",
    "receiptKey: 'providerEvalRun'",
    "mode: 'shadow-replay'",
    "actorRole: 'runtime-platform'",
    "actorId: 'manager-ui-provider-eval'",
    "source: 'manager-ui-provider-eval-receipt'",
    'providerEvalShadowReplayDisabled: (',
    '!backendCommandAvailable',
    'backendStation.loading',
    'backendProviderEvalRunWorkflow.readyForPrivatePilotProviderEval',
    'backendProviderControlledRun?.readyForPrivatePilotRun',
  ]) {
    assert.ok(appSource.includes(appContract), `App must retain provider eval action contract ${appContract}`);
  }
  assert.ok(wrapperSource.includes('onRecordShadowReplay={onRecordProviderEvalShadowReplay}'));
  assert.ok(wrapperSource.includes('recordShadowReplayDisabled={providerEvalShadowReplayDisabled}'));
});
