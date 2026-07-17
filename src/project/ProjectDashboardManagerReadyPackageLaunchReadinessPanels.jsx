import React, { lazy, Suspense } from 'react';

const ProjectDashboardPrivatePilotGoLiveReadiness = lazy(() => import('./ProjectDashboardPrivatePilotGoLiveReadiness.jsx'));
const ProjectDashboardProductionInfrastructureRehearsalReadyPackage = lazy(() => import('./ProjectDashboardProductionInfrastructureRehearsalReadyPackage.jsx'));
const ProjectDashboardPublicProductionStartupReadiness = lazy(() => import('./ProjectDashboardPublicProductionStartupReadiness.jsx'));
const ProjectDashboardPublicProductionStartupSummary = lazy(() => import('./ProjectDashboardPublicProductionStartupSummary.jsx'));
const ProjectDashboardProductionLaunchProofPanels = lazy(() => import('./ProjectDashboardProductionLaunchProofPanels.jsx'));

export default function ProjectDashboardManagerReadyPackageLaunchReadinessPanels({
  activeProject,
  managedInfrastructureCutoverAttestationRunReceipt,
  managerProofModelSyncButton,
  managerReadModelSourceBadge,
  managerReadModelSourceClass,
  managerReadModelSourceLabel,
  onRunManagedInfrastructureCutoverAttestation,
  privatePilotGoLiveReadiness,
  productionEvidenceIntegrityAudit,
  productionInfrastructureRehearsal,
  productionLaunchControlCenter,
  productionLaunchEvidenceDossier,
  productionLaunchGapRegister,
  projectId,
  projectText,
  publicProductionStartupReadiness,
  readyPackage,
  runDisabled,
}) {
  return (
    <>
      {privatePilotGoLiveReadiness && (
        <Suspense fallback={<div data-testid="project-dashboard-private-pilot-go-live-readiness-loading" className="min-h-48" role="status" aria-label="正在加载私有试运行就绪状态" />}>
          <ProjectDashboardPrivatePilotGoLiveReadiness
            view={{
              activeProject,
              backendManagerReadyPackage: readyPackage,
              backendPrivatePilotGoLiveReadiness: privatePilotGoLiveReadiness,
              managerReadModelSourceBadge,
              projectText,
            }}
          />
        </Suspense>
      )}
      {productionInfrastructureRehearsal && (
        <Suspense fallback={<div data-testid="project-dashboard-production-infrastructure-rehearsal-ready-package-loading" className="min-h-64" role="status" aria-label="正在加载完整生产基础设施演练" />}>
          <ProjectDashboardProductionInfrastructureRehearsalReadyPackage
            onRunManagedInfrastructureCutoverAttestation={onRunManagedInfrastructureCutoverAttestation}
            projectId={projectId}
            projectText={projectText}
            readyPackage={readyPackage}
            receipt={managedInfrastructureCutoverAttestationRunReceipt}
            rehearsal={productionInfrastructureRehearsal}
            runDisabled={runDisabled}
            sourceClass={managerReadModelSourceClass(productionInfrastructureRehearsal)}
            sourceLabel={managerReadModelSourceLabel(productionInfrastructureRehearsal)}
          />
        </Suspense>
      )}
      {publicProductionStartupReadiness && (
        <Suspense fallback={<div data-testid="project-dashboard-public-production-startup-readiness-loading" className="min-h-96" role="status" aria-label="正在加载公开生产启动详情" />}>
          <ProjectDashboardPublicProductionStartupReadiness
            fallbackRoute={readyPackage.backendRoutes?.publicProductionStartupReadiness}
            projectText={projectText}
            readiness={publicProductionStartupReadiness}
            summary={(
              <Suspense fallback={<div data-testid="project-dashboard-public-production-startup-summary-loading" className="min-h-48" role="status" aria-label="正在加载公开生产启动摘要" />}>
                <ProjectDashboardPublicProductionStartupSummary
                  projectText={projectText}
                  readiness={publicProductionStartupReadiness}
                  sourceBadge={managerReadModelSourceBadge(publicProductionStartupReadiness, 'backend-public-production-startup-readiness-source')}
                />
              </Suspense>
            )}
          />
        </Suspense>
      )}
      {(productionLaunchGapRegister || productionLaunchControlCenter || productionLaunchEvidenceDossier || productionEvidenceIntegrityAudit) && (
        <Suspense fallback={<div data-testid="project-dashboard-production-launch-proof-panels-loading" className="min-h-96" role="status" aria-label="正在加载生产发布证明面板" />}>
          <ProjectDashboardProductionLaunchProofPanels
            controlCenter={productionLaunchControlCenter}
            evidenceDossier={productionLaunchEvidenceDossier}
            fallbackRoutes={{
              gapRegister: readyPackage.backendRoutes?.productionLaunchGapRegister || `/projects/${projectId}/production-launch-gap-register`,
              controlCenter: readyPackage.backendRoutes?.productionLaunchControlCenter || `/projects/${projectId}/production-launch-control-center`,
              evidenceDossier: readyPackage.backendRoutes?.productionLaunchEvidenceDossier || `/projects/${projectId}/production-launch-evidence-dossier`,
              integrityAudit: readyPackage.backendRoutes?.productionEvidenceIntegrityAudit || `/projects/${projectId}/production-evidence-integrity-audit`,
            }}
            gapRegister={productionLaunchGapRegister}
            integrityAudit={productionEvidenceIntegrityAudit}
            projectText={projectText}
            proofSyncButton={managerProofModelSyncButton}
            sourceBadge={managerReadModelSourceBadge}
            sourceClass={managerReadModelSourceClass}
            sourceLabel={managerReadModelSourceLabel}
          />
        </Suspense>
      )}
    </>
  );
}
