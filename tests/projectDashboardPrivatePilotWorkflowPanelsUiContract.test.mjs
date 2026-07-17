import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardPrivatePilotWorkflowPanels.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx', import.meta.url);

test('private-pilot workflow panels stay lazy while App retains the record function and routes', () => {
  assert.ok(existsSync(componentUrl), 'Private-pilot workflow panels component must exist');
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package pilot operations wrapper must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(componentSource.includes("import { Activity, CheckCircle2, PackageCheck, Play } from 'lucide-react';"));

  assert.ok(wrapperSource.includes("const ProjectDashboardPrivatePilotWorkflowPanels = lazy(() => import('./ProjectDashboardPrivatePilotWorkflowPanels.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardPrivatePilotWorkflowPanels'));
  assert.ok(wrapperSource.includes('onRecordReceipt={onRecordPrivatePilotReceipt}'));
  assert.ok(wrapperSource.includes('sourceBadge={managerReadModelSourceBadge}'));
  assert.ok(appSource.includes('onRecordPrivatePilotReceipt: runBackendPrivatePilotReceipt'));
  assert.ok(appSource.includes('readyPackage: backendManagerReadyPackage'));
  for (const route of [
    'readyPackage.backendRoutes?.privatePilotReleaseCandidates',
    'readyPackage.backendRoutes?.privatePilotLaunchRuns',
    'readyPackage.backendRoutes?.privatePilotLaunchHealthChecks',
    'readyPackage.backendRoutes?.privatePilotAcceptanceReports',
  ]) {
    assert.ok(wrapperSource.includes(route), `Pilot operations wrapper must retain route source ${route}`);
  }

  for (const contract of [
    'backend-private-pilot-release-candidate-workflow-snapshot',
    'backend-private-pilot-record-release-candidate',
    "workflowKey: 'privatePilotReleaseCandidateWorkflow'",
    "receiptKey: 'privatePilotReleaseCandidate'",
    'backend-private-pilot-launch-run-workflow-snapshot',
    'backend-private-pilot-record-launch-run',
    "workflowKey: 'privatePilotLaunchRunWorkflow'",
    "receiptKey: 'privatePilotLaunchRun'",
    'backend-private-pilot-launch-health-check-workflow-snapshot',
    'backend-private-pilot-record-launch-health',
    "workflowKey: 'privatePilotLaunchHealthCheckWorkflow'",
    "receiptKey: 'privatePilotLaunchHealthCheck'",
    'backend-private-pilot-acceptance-report-workflow-snapshot',
    'backend-private-pilot-record-acceptance-report',
    "workflowKey: 'privatePilotAcceptanceReportWorkflow'",
    "receiptKey: 'privatePilotAcceptanceReport'",
  ]) {
    assert.ok(componentSource.includes(contract), `Private-pilot workflow panels must keep ${contract}`);
  }
});
