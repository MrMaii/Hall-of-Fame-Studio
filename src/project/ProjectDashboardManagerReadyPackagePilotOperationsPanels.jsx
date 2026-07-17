import React, { lazy, Suspense } from 'react';

const ProjectDashboardPrivatePilotWorkflowPanels = lazy(() => import('./ProjectDashboardPrivatePilotWorkflowPanels.jsx'));
const ProjectDashboardProductionOperationsReadiness = lazy(() => import('./ProjectDashboardProductionOperationsReadiness.jsx'));
const ProjectDashboardProductionOperationsControlReceipts = lazy(() => import('./ProjectDashboardProductionOperationsControlReceipts.jsx'));
const ProjectDashboardProductionDeploymentControlReceipts = lazy(() => import('./ProjectDashboardProductionDeploymentControlReceipts.jsx'));
const ProjectDashboardProductionSecurityControlReceipts = lazy(() => import('./ProjectDashboardProductionSecurityControlReceipts.jsx'));
const ProjectDashboardProductionProviderControlReceipts = lazy(() => import('./ProjectDashboardProductionProviderControlReceipts.jsx'));
const ProjectDashboardProductionLaunchAudit = lazy(() => import('./ProjectDashboardProductionLaunchAudit.jsx'));
const ProjectDashboardLaunchApprovalWorkflow = lazy(() => import('./ProjectDashboardLaunchApprovalWorkflow.jsx'));

export default function ProjectDashboardManagerReadyPackagePilotOperationsPanels({
  launchAcceptanceReport,
  launchApprovalPrereqsReady,
  launchApprovalWorkflow,
  launchApprovalWorkflowAvailable,
  launchHealth,
  launchManagerApproved,
  launchRun,
  launchSecurityApproved,
  managerReadModelSourceBadge,
  onRecordPrivatePilotReceipt,
  onRecordProductionControlReceipt,
  privatePilotReleaseCandidate,
  productionDeploymentControlReceiptWorkflow,
  productionLaunchAudit,
  productionLaunchAuditAvailable,
  productionOperationsControlReceiptWorkflow,
  productionOperationsReadiness,
  productionProviderControlReceiptWorkflow,
  productionSecurityControlReceiptWorkflow,
  projectId,
  projectText,
  providerEvalReady,
  readyPackage,
  recordPrivatePilotDisabled,
  recordProductionControlDisabled,
}) {
  return (
    <>
      {(privatePilotReleaseCandidate || launchRun || launchHealth || launchAcceptanceReport) && (
        <Suspense fallback={<div data-testid="project-dashboard-private-pilot-workflow-panels-loading" className="min-h-96" role="status" aria-label="正在加载私有试运行工作流" />}>
          <ProjectDashboardPrivatePilotWorkflowPanels
            acceptanceReport={launchAcceptanceReport}
            fallbackRoutes={{
              releaseCandidates: readyPackage.backendRoutes?.privatePilotReleaseCandidates || `/projects/${projectId}/private-pilot-release-candidates`,
              launchRuns: readyPackage.backendRoutes?.privatePilotLaunchRuns || `/projects/${projectId}/private-pilot-launch-runs`,
              launchHealthChecks: readyPackage.backendRoutes?.privatePilotLaunchHealthChecks || `/projects/${projectId}/private-pilot-launch-health-checks`,
              acceptanceReports: readyPackage.backendRoutes?.privatePilotAcceptanceReports || `/projects/${projectId}/private-pilot-acceptance-reports`,
            }}
            launchHealth={launchHealth}
            launchRun={launchRun}
            onRecordReceipt={onRecordPrivatePilotReceipt}
            projectText={projectText}
            recordDisabled={recordPrivatePilotDisabled}
            releaseCandidate={privatePilotReleaseCandidate}
            sourceBadge={managerReadModelSourceBadge}
          />
        </Suspense>
      )}
      {productionOperationsReadiness && (
        <Suspense fallback={null}>
          <ProjectDashboardProductionOperationsReadiness
            fallbackRoute={readyPackage.backendRoutes?.productionOperationsReadiness}
            projectId={projectId}
            projectText={projectText}
            readiness={productionOperationsReadiness}
          />
        </Suspense>
      )}
      {productionOperationsControlReceiptWorkflow && (
        <Suspense fallback={null}>
          <ProjectDashboardProductionOperationsControlReceipts
            fallbackRoute={productionOperationsReadiness?.backendRoutes?.productionOperationsControlReceipts}
            onRecordReceipt={onRecordProductionControlReceipt}
            projectId={projectId}
            projectText={projectText}
            recordDisabled={recordProductionControlDisabled}
            workflow={productionOperationsControlReceiptWorkflow}
          />
        </Suspense>
      )}
      {productionDeploymentControlReceiptWorkflow && (
        <Suspense fallback={null}>
          <ProjectDashboardProductionDeploymentControlReceipts
            onRecordReceipt={onRecordProductionControlReceipt}
            projectId={projectId}
            projectText={projectText}
            recordDisabled={recordProductionControlDisabled}
            workflow={productionDeploymentControlReceiptWorkflow}
          />
        </Suspense>
      )}
      {productionSecurityControlReceiptWorkflow && (
        <Suspense fallback={null}>
          <ProjectDashboardProductionSecurityControlReceipts
            onRecordReceipt={onRecordProductionControlReceipt}
            projectId={projectId}
            projectText={projectText}
            recordDisabled={recordProductionControlDisabled}
            workflow={productionSecurityControlReceiptWorkflow}
          />
        </Suspense>
      )}
      {productionProviderControlReceiptWorkflow && (
        <Suspense fallback={null}>
          <ProjectDashboardProductionProviderControlReceipts
            onRecordReceipt={onRecordProductionControlReceipt}
            projectId={projectId}
            projectText={projectText}
            providerEvalReady={providerEvalReady}
            recordDisabled={recordProductionControlDisabled}
            workflow={productionProviderControlReceiptWorkflow}
          />
        </Suspense>
      )}
      {productionLaunchAuditAvailable && productionLaunchAudit && (
        <Suspense fallback={null}>
          <ProjectDashboardProductionLaunchAudit
            audit={productionLaunchAudit}
            projectId={projectId}
            projectText={projectText}
            route={readyPackage.backendRoutes?.productionLaunchAudit}
          />
        </Suspense>
      )}
      {launchApprovalWorkflowAvailable && launchApprovalWorkflow && (
        <Suspense fallback={null}>
          <ProjectDashboardLaunchApprovalWorkflow
            fallbackRoute={readyPackage.backendRoutes?.launchApprovals}
            managerApproved={launchManagerApproved}
            onRecordReceipt={onRecordPrivatePilotReceipt}
            prereqsReady={launchApprovalPrereqsReady}
            projectId={projectId}
            projectText={projectText}
            recordDisabled={recordPrivatePilotDisabled}
            securityApproved={launchSecurityApproved}
            sourceBadge={managerReadModelSourceBadge(launchApprovalWorkflow, 'backend-launch-approval-workflow-source')}
            workflow={launchApprovalWorkflow}
          />
        </Suspense>
      )}
    </>
  );
}
