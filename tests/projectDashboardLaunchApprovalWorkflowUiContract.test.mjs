import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardLaunchApprovalWorkflow.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx', import.meta.url);

test('launch approval workflow stays lazy and preserves both original approval commands', () => {
  assert.ok(existsSync(componentUrl), 'Launch approval workflow component must exist');
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package pilot operations wrapper must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(wrapperSource.includes("const ProjectDashboardLaunchApprovalWorkflow = lazy(() => import('./ProjectDashboardLaunchApprovalWorkflow.jsx'));"));
  assert.ok(wrapperSource.includes('<ProjectDashboardLaunchApprovalWorkflow'));
  assert.ok(wrapperSource.includes('fallbackRoute={readyPackage.backendRoutes?.launchApprovals}'));
  assert.ok(wrapperSource.includes('managerApproved={launchManagerApproved}'));
  assert.ok(wrapperSource.includes('onRecordReceipt={onRecordPrivatePilotReceipt}'));
  assert.ok(wrapperSource.includes('prereqsReady={launchApprovalPrereqsReady}'));
  assert.ok(wrapperSource.includes('recordDisabled={recordPrivatePilotDisabled}'));
  assert.ok(wrapperSource.includes('securityApproved={launchSecurityApproved}'));
  assert.ok(wrapperSource.includes("sourceBadge={managerReadModelSourceBadge(launchApprovalWorkflow, 'backend-launch-approval-workflow-source')}"));
  assert.ok(wrapperSource.includes('workflow={launchApprovalWorkflow}'));
  assert.ok(appSource.includes('launchManagerApproved: backendLaunchPrivatePilotManagerApproved'));
  assert.ok(appSource.includes('onRecordPrivatePilotReceipt: runBackendPrivatePilotReceipt'));
  assert.ok(appSource.includes('launchApprovalPrereqsReady: backendLaunchApprovalPrereqsReady'));
  assert.ok(appSource.includes('recordPrivatePilotDisabled: !backendCommandAvailable || backendStation.loading'));
  assert.ok(appSource.includes('launchSecurityApproved: backendLaunchPrivatePilotSecurityApproved'));
  assert.ok(appSource.includes('launchApprovalWorkflow: backendLaunchApprovalWorkflow'));

  for (const contract of [
    'backend-launch-approval-workflow-snapshot',
    'Launch Approval Workflow',
    'Pilot Approval',
    'Approvals',
    'Pilot Roles',
    'Production Roles',
    'Latest Checksum',
    'workflow.rows.slice(0, 3)',
    'backend-launch-approval-record-manager',
    "label: 'Private-pilot manager launch approval'",
    "workflowKey: 'launchApprovalWorkflow'",
    "receiptKey: 'launchApproval'",
    "reason: 'Manager approves the private-pilot launch from the Ready Package command panel.'",
    "approverRole: 'manager'",
    "approverId: 'director'",
    "approverName: 'Product Director'",
    "actorRole: 'manager'",
    "actorId: 'director'",
    'recordDisabled || !prereqsReady || managerApproved',
    'Approve Manager',
    'backend-launch-approval-record-security',
    "label: 'Private-pilot security launch approval'",
    "reason: 'Security approves the private-pilot launch from the Ready Package command panel.'",
    "approverRole: 'security-admin'",
    "approverId: 'security-lead'",
    "approverName: 'Security Lead'",
    "actorRole: 'security-admin'",
    "actorId: 'security-lead'",
    "source: 'manager-ui-launch-approval'",
    'recordDisabled || !prereqsReady || securityApproved',
    'Approve Security',
    'Approval route',
    '`/projects/${projectId}/launch-approvals`',
  ]) {
    assert.ok(componentSource.includes(contract), `Launch approval workflow must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-launch-approval-workflow-snapshot"'),
    false,
    'Launch approval workflow markup must no longer remain duplicated in App',
  );
});
