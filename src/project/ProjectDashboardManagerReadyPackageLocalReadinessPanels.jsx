import React, { lazy, Suspense } from 'react';

const ProjectDashboardPilotLaunchReadiness = lazy(() => import('./ProjectDashboardPilotLaunchReadiness.jsx'));
const ProjectDashboardDeploymentPreflight = lazy(() => import('./ProjectDashboardDeploymentPreflight.jsx'));
const ProjectDashboardMvpReadiness = lazy(() => import('./ProjectDashboardMvpReadiness.jsx'));
const ProjectDashboardOperationsReadiness = lazy(() => import('./ProjectDashboardOperationsReadiness.jsx'));
const ProjectDashboardProviderReadiness = lazy(() => import('./ProjectDashboardProviderReadiness.jsx'));
const ProjectDashboardProviderControlledRun = lazy(() => import('./ProjectDashboardProviderControlledRun.jsx'));

export default function ProjectDashboardManagerReadyPackageLocalReadinessPanels({
  activeProject,
  adapterGatewayPreflight,
  backendCommandAvailable,
  deploymentPreflight,
  deploymentPreflightAvailable,
  managerReadyPackage,
  managerReadModelSourceBadge,
  mvpReadiness,
  mvpReadinessOperatorActionRunReceipt,
  operationsReadiness,
  operationsReadinessAvailable,
  persistenceAdapterDryRun,
  persistenceAdapterPlan,
  pilotLaunchReadiness,
  pilotLaunchReadinessAvailable,
  providerControlledRun,
  providerControlledRunAvailable,
  providerReadiness,
  providerReadinessAvailable,
  runMvpReadinessOperatorAction,
  station,
  workerQueueAdapterDryRun,
  workerQueueAdapterPlan,
}) {
  return (
    <>
      {pilotLaunchReadinessAvailable && (
        <Suspense fallback={<div data-testid="project-dashboard-pilot-launch-readiness-loading" className="min-h-48" role="status" aria-label="正在加载私有试运行发布状态" />}>
          <ProjectDashboardPilotLaunchReadiness
            view={{
              activeProject,
              backendManagerReadyPackage: managerReadyPackage,
              backendPilotLaunchReadiness: pilotLaunchReadiness,
            }}
          />
        </Suspense>
      )}
      {deploymentPreflightAvailable && (
        <Suspense fallback={<div data-testid="project-dashboard-deployment-preflight-loading" className="min-h-48" role="status" aria-label="正在加载发布前检查" />}>
          <ProjectDashboardDeploymentPreflight
            gatewayPreflight={adapterGatewayPreflight}
            preflight={deploymentPreflight}
            projectId={activeProject.id}
            readyPackage={managerReadyPackage}
          />
        </Suspense>
      )}
      {mvpReadiness && (
        <Suspense fallback={<div data-testid="project-dashboard-mvp-readiness-loading" className="min-h-56" role="status" aria-label="正在加载本地 MVP 就绪状态" />}>
          <ProjectDashboardMvpReadiness
            view={{
              activeProject,
              backendCommandAvailable,
              backendManagerReadyPackage: managerReadyPackage,
              backendMvpReadiness: mvpReadiness,
              backendMvpReadinessOperatorActionRunReceipt: mvpReadinessOperatorActionRunReceipt,
              backendStation: station,
              runMvpReadinessOperatorAction,
            }}
          />
        </Suspense>
      )}
      {operationsReadinessAvailable && (
        <Suspense fallback={<div data-testid="project-dashboard-operations-readiness-loading" className="min-h-64" role="status" aria-label="正在加载本地运行就绪状态" />}>
          <ProjectDashboardOperationsReadiness
            view={{
              activeProject,
              backendManagerReadyPackage: managerReadyPackage,
              backendOperationsReadiness: operationsReadiness,
              backendPersistenceAdapterDryRun: persistenceAdapterDryRun,
              backendPersistenceAdapterPlan: persistenceAdapterPlan,
              backendWorkerQueueAdapterDryRun: workerQueueAdapterDryRun,
              backendWorkerQueueAdapterPlan: workerQueueAdapterPlan,
              managerReadModelSourceBadge,
            }}
          />
        </Suspense>
      )}
      {providerReadinessAvailable && (
        <Suspense fallback={<div data-testid="project-dashboard-provider-readiness-loading" className="min-h-64" role="status" aria-label="正在加载本地模型供应商就绪状态" />}>
          <ProjectDashboardProviderReadiness
            view={{
              activeProject,
              backendManagerReadyPackage: managerReadyPackage,
              backendProviderReadiness: providerReadiness,
              managerReadModelSourceBadge,
            }}
          />
        </Suspense>
      )}
      {providerControlledRunAvailable && (
        <Suspense fallback={<div data-testid="project-dashboard-provider-controlled-run-loading" className="min-h-56" role="status" aria-label="正在加载受控模型运行状态" />}>
          <ProjectDashboardProviderControlledRun
            view={{
              activeProject,
              backendManagerReadyPackage: managerReadyPackage,
              backendProviderControlledRun: providerControlledRun,
              managerReadModelSourceBadge,
            }}
          />
        </Suspense>
      )}
    </>
  );
}
