import React, { lazy, Suspense } from 'react';

const ProjectDashboardProviderEvalRunWorkflow = lazy(() => import('./ProjectDashboardProviderEvalRunWorkflow.jsx'));
const ProjectDashboardEvidenceCustodyReadiness = lazy(() => import('./ProjectDashboardEvidenceCustodyReadiness.jsx'));
const ProjectDashboardSecurityBoundary = lazy(() => import('./ProjectDashboardSecurityBoundary.jsx'));

export default function ProjectDashboardManagerReadyPackageProviderSecurityPanels({
  activeProject,
  evidenceCustodyAvailable,
  evidenceCustodyReadiness,
  evidenceCustodySourceBadge,
  evidenceCustodySyncProofModelsButton,
  managerReadyPackage,
  managerReadModelSourceBadge,
  onRecordProviderEvalShadowReplay,
  packageRoute,
  providerEvalAvailable,
  providerEvalRunWorkflow,
  providerEvalShadowReplayDisabled,
  securityBoundary,
  securityBoundaryAvailable,
}) {
  return (
    <>
      {providerEvalAvailable && (
        <Suspense fallback={<div data-testid="project-dashboard-provider-eval-run-workflow-loading" className="min-h-56" role="status" aria-label="正在加载供应商评估运行状态" />}>
          <ProjectDashboardProviderEvalRunWorkflow
            view={{
              activeProject,
              backendManagerReadyPackage: managerReadyPackage,
              backendProviderEvalRunWorkflow: providerEvalRunWorkflow,
              managerReadModelSourceBadge,
            }}
            onRecordShadowReplay={onRecordProviderEvalShadowReplay}
            recordShadowReplayDisabled={providerEvalShadowReplayDisabled}
          />
        </Suspense>
      )}
      {evidenceCustodyAvailable && (
        <Suspense fallback={<div data-testid="project-dashboard-evidence-custody-readiness-loading" className="min-h-56" role="status" aria-label="正在加载证据保管状态" />}>
          <ProjectDashboardEvidenceCustodyReadiness
            view={{
              activeProject,
              backendEvidenceCustodyReadiness: evidenceCustodyReadiness,
              backendManagerReadyPackage: managerReadyPackage,
            }}
            sourceBadge={evidenceCustodySourceBadge}
            syncProofModelsButton={evidenceCustodySyncProofModelsButton}
          />
        </Suspense>
      )}
      {securityBoundaryAvailable && (
        <Suspense fallback={<div data-testid="project-dashboard-security-boundary-loading" className="min-h-56" role="status" aria-label="正在加载安全边界状态" />}>
          <ProjectDashboardSecurityBoundary
            view={{
              activeProject,
              backendManagerReadyPackage: managerReadyPackage,
              backendSecurityBoundary: securityBoundary,
              managerReadModelSourceBadge,
            }}
          />
        </Suspense>
      )}
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Package route: {packageRoute}
      </div>
    </>
  );
}
