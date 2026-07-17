import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageProviderSecurityPanels.jsx', import.meta.url);

test('Manager Ready Package provider and security panels stay lazy while App retains every write and sync rule', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package provider security wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(operationalAssemblySource.includes("const ProjectDashboardManagerReadyPackageProviderSecurityPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageProviderSecurityPanels.jsx'));"));
  assert.ok(operationalAssemblySource.includes('<ProjectDashboardManagerReadyPackageProviderSecurityPanels'));

  for (const contract of [
    'providerEvalAvailable: readyPackageModelAvailable(backendProviderEvalRunWorkflow)',
    'onRecordProviderEvalShadowReplay: () => runBackendPrivatePilotReceipt({',
    "label: 'Provider eval shadow replay'",
    "workflowKey: 'providerEvalRunWorkflow'",
    "receiptKey: 'providerEvalRun'",
    "mode: 'shadow-replay'",
    'providerEvalShadowReplayDisabled: (',
    'backendProviderEvalRunWorkflow.readyForPrivatePilotProviderEval',
    'backendProviderControlledRun?.readyForPrivatePilotRun',
    'evidenceCustodyAvailable: readyPackageModelAvailable(backendEvidenceCustodyReadiness)',
    'data-testid="backend-evidence-custody-readiness-source"',
    "evidenceCustodySyncProofModelsButton: managerProofModelSyncButton(backendEvidenceCustodyReadiness, 'backend-evidence-custody-readiness-sync-proof-models')",
    'securityBoundaryAvailable: readyPackageModelAvailable(backendSecurityBoundary)',
  ]) {
    assert.ok(appSource.includes(contract), `App must retain ${contract}`);
  }

  const components = [
    'ProjectDashboardProviderEvalRunWorkflow',
    'ProjectDashboardEvidenceCustodyReadiness',
    'ProjectDashboardSecurityBoundary',
  ];
  for (const component of components) {
    assert.ok(wrapperSource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`), `${component} must remain lazy`);
    assert.ok(wrapperSource.includes(`<${component}`), `${component} must remain mounted`);
  }
  const mountOrder = components.map(component => wrapperSource.indexOf(`<${component}`));
  assert.deepEqual(mountOrder, [...mountOrder].sort((left, right) => left - right), 'Provider and security panels must retain their original order');

  for (const contract of [
    'onRecordShadowReplay={onRecordProviderEvalShadowReplay}',
    'recordShadowReplayDisabled={providerEvalShadowReplayDisabled}',
    'sourceBadge={evidenceCustodySourceBadge}',
    'syncProofModelsButton={evidenceCustodySyncProofModelsButton}',
    'Package route: {packageRoute}',
  ]) {
    assert.ok(wrapperSource.includes(contract), `Provider security wrapper must retain ${contract}`);
  }
});
