import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const operationalAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx', import.meta.url), 'utf8');
const exportWorkflowUrl = new URL('../src/project/ProjectDashboardProjectEvidenceExportWorkflow.jsx', import.meta.url);

test('Dashboard project evidence export stays lazy and preserves all handoff actions', () => {
  assert.ok(operationalAssemblySource.includes("const ProjectDashboardProjectEvidenceExportWorkflow = lazy(() => import('./ProjectDashboardProjectEvidenceExportWorkflow.jsx'))"));
  assert.ok(operationalAssemblySource.includes('<ProjectDashboardProjectEvidenceExportWorkflow'));
  assert.ok(existsSync(exportWorkflowUrl), 'Dashboard project evidence export workflow component must exist');

  const exportWorkflowSource = readFileSync(exportWorkflowUrl, 'utf8');
  for (const publicContract of [
    'backend-project-evidence-export-workflow-snapshot',
    'Project Evidence Export Workflow',
    'readyForPrivatePilotHandoff',
    'readyForPrivatePilotDownload',
    'readyForProductionExport',
    'requestCount',
    'approvalCount',
    'downloadAuditCount',
    'packagePassedGateCount',
    'packageGateCount',
    'failedGateCount',
    'archiveChecksum',
    'model.checksum',
    'backend-project-evidence-export-request',
    'backend-project-evidence-export-approve-manager',
    'backend-project-evidence-export-approve-security',
    'backend-project-evidence-export-record-download-audit',
    'onRequestPackage',
    'onApproveManager',
    'onApproveSecurity',
    'onRecordDownload',
    'requestDisabled',
    'managerApprovalDisabled',
    'securityApprovalDisabled',
    'downloadAuditDisabled',
    "text('Request Package')",
    "text('Approve Manager')",
    "text('Approve Security')",
    "text('Record Download')",
    "text('Export route')",
    'routePath',
    '{sourceBadge}',
  ]) {
    assert.ok(exportWorkflowSource.includes(publicContract), `Dashboard evidence export workflow must keep ${publicContract}`);
  }

  for (const appContract of [
    'model: backendProjectEvidenceExportWorkflow',
    "label: 'Project evidence export request'",
    "label: 'Project evidence export manager approval'",
    "label: 'Project evidence export security approval'",
    "label: 'Project evidence export download audit'",
    "action: 'request'",
    "action: 'approve'",
    "action: 'download-audit'",
    "actorRole: 'manager'",
    "actorRole: 'security-admin'",
    "source: 'manager-ui-project-evidence-export'",
    '!backendProjectEvidenceExportPrereqsReady || Boolean(backendProjectEvidencePrivatePilotRequestId)',
    '!backendProjectEvidencePrivatePilotRequestId || backendProjectEvidenceExportManagerApproved',
    '!backendProjectEvidencePrivatePilotRequestId || backendProjectEvidenceExportSecurityApproved',
    '!backendProjectEvidenceExportWorkflow.readyForPrivatePilotHandoff || backendProjectEvidenceExportWorkflow.readyForPrivatePilotDownload',
    'backendProjectEvidenceExportWorkflow.backendRoutes?.projectEvidenceExports',
  ]) {
    assert.ok(appSource.includes(appContract), `Dashboard evidence export App wiring must keep ${appContract}`);
  }
});
