import React, { lazy, Suspense } from 'react';

const ProjectDashboardRuntimeContracts = lazy(() => import('./ProjectDashboardRuntimeContracts.jsx'));
const ProjectDashboardAutonomousCycleConsistency = lazy(() => import('./ProjectDashboardAutonomousCycleConsistency.jsx'));
const ProjectDashboardRuntimeAutonomyStatus = lazy(() => import('./ProjectDashboardRuntimeAutonomyStatus.jsx'));
const ProjectDashboardZeroToAutonomyReport = lazy(() => import('./ProjectDashboardZeroToAutonomyReport.jsx'));
const ProjectDashboardProductTeamDeliveryTrace = lazy(() => import('./ProjectDashboardProductTeamDeliveryTrace.jsx'));

export default function ProjectDashboardManagerReadyPackageRuntimePanels({
  autonomousCycleConsistency,
  fallback,
  managerProofModelSyncButton,
  managerReadModelSourceClass,
  managerReadModelSourceLabel,
  onOpenRuntimeAutonomyChat,
  onOpenRuntimeAutonomyFlowNode,
  onOpenRuntimeAutonomyTimeline,
  productTeamDeliveryTrace,
  projectId,
  projectText,
  readyPackage,
  runtimeAutonomyChatProofIds,
  runtimeAutonomyFlowNodeId,
  runtimeAutonomyStatus,
  runtimeAutonomyTimelineIds,
  runtimeContracts,
  zeroToAutonomyReport,
}) {
  return (
    <>
      {runtimeContracts && (
        <Suspense fallback={fallback}>
          <ProjectDashboardRuntimeContracts
            view={{
              model: runtimeContracts,
              routePath: runtimeContracts.backendRoutes?.runtimeContracts || readyPackage.backendRoutes?.runtimeContracts || `/projects/${projectId}/runtime-contracts`,
              sourceBadge: (
                <span data-testid="backend-runtime-contracts-source" className={`node-status-tag ${managerReadModelSourceClass(runtimeContracts)}`}>
                  {managerReadModelSourceLabel(runtimeContracts)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(runtimeContracts, 'backend-runtime-contracts-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {autonomousCycleConsistency && (
        <Suspense fallback={fallback}>
          <ProjectDashboardAutonomousCycleConsistency
            view={{
              model: autonomousCycleConsistency,
              routePath: autonomousCycleConsistency.backendRoutes?.autonomousCycleConsistency || readyPackage.backendRoutes?.autonomousCycleConsistency || `/projects/${projectId}/autonomous-cycle-consistency`,
              sourceBadge: (
                <span data-testid="backend-autonomous-cycle-consistency-source" className={`node-status-tag ${managerReadModelSourceClass(autonomousCycleConsistency)}`}>
                  {managerReadModelSourceLabel(autonomousCycleConsistency)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(autonomousCycleConsistency, 'backend-autonomous-cycle-consistency-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {runtimeAutonomyStatus && (
        <Suspense fallback={fallback}>
          <ProjectDashboardRuntimeAutonomyStatus
            view={{
              autopilotDuePath: runtimeAutonomyStatus.backendRoutes?.autopilotDueWorker || '/workers/autopilot/due',
              chatProofIds: runtimeAutonomyChatProofIds,
              flowNodeId: runtimeAutonomyFlowNodeId,
              model: runtimeAutonomyStatus,
              onOpenChat: onOpenRuntimeAutonomyChat,
              onOpenFlowNode: onOpenRuntimeAutonomyFlowNode,
              onOpenTimeline: onOpenRuntimeAutonomyTimeline,
              routePath: runtimeAutonomyStatus.backendRoutes?.runtimeAutonomyStatus || readyPackage.backendRoutes?.runtimeAutonomyStatus || `/projects/${projectId}/runtime-autonomy-status`,
              schedulerPath: runtimeAutonomyStatus.backendRoutes?.schedulerStatus || '/workers/autonomous/status',
              sourceBadge: (
                <span data-testid="backend-runtime-autonomy-status-source" className={`node-status-tag ${managerReadModelSourceClass(runtimeAutonomyStatus)}`}>
                  {managerReadModelSourceLabel(runtimeAutonomyStatus)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(runtimeAutonomyStatus, 'backend-runtime-autonomy-status-sync-proof-models'),
              text: projectText,
              timelineIds: runtimeAutonomyTimelineIds,
              workerQueuePath: runtimeAutonomyStatus.backendRoutes?.workerQueue || readyPackage.backendRoutes?.workerQueue || `/projects/${projectId}/worker-queue`,
            }}
          />
        </Suspense>
      )}
      {zeroToAutonomyReport && (
        <Suspense fallback={fallback}>
          <ProjectDashboardZeroToAutonomyReport
            view={{
              model: zeroToAutonomyReport,
              routePath: zeroToAutonomyReport.backendRoutes?.zeroToAutonomyReport || readyPackage.backendRoutes?.zeroToAutonomyReport || `/projects/${projectId}/zero-to-autonomy-report`,
              sourceBadge: (
                <span data-testid="backend-zero-to-autonomy-report-source" className={`node-status-tag ${managerReadModelSourceClass(zeroToAutonomyReport)}`}>
                  {managerReadModelSourceLabel(zeroToAutonomyReport)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(zeroToAutonomyReport, 'backend-zero-to-autonomy-report-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
      {productTeamDeliveryTrace && (
        <Suspense fallback={fallback}>
          <ProjectDashboardProductTeamDeliveryTrace
            view={{
              model: productTeamDeliveryTrace,
              routePath: productTeamDeliveryTrace.backendRoutes?.productTeamDeliveryTrace || readyPackage.backendRoutes?.productTeamDeliveryTrace || `/projects/${projectId}/product-team-delivery-trace`,
              sourceBadge: (
                <span data-testid="backend-product-team-delivery-trace-source" className={`node-status-tag ${managerReadModelSourceClass(productTeamDeliveryTrace)}`}>
                  {managerReadModelSourceLabel(productTeamDeliveryTrace)}
                </span>
              ),
              syncButton: managerProofModelSyncButton(productTeamDeliveryTrace, 'backend-product-team-delivery-trace-sync-proof-models'),
              text: projectText,
            }}
          />
        </Suspense>
      )}
    </>
  );
}
