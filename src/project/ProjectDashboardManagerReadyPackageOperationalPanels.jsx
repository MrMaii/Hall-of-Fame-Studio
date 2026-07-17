import React, { Suspense, lazy } from 'react';

const ProjectDashboardProjectEvidenceExportWorkflow = lazy(() => import('./ProjectDashboardProjectEvidenceExportWorkflow.jsx'));
const ProjectDashboardManagerReadyPackageLaunchReadinessPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageLaunchReadinessPanels.jsx'));
const ProjectDashboardManagerReadyPackagePilotOperationsPanels = lazy(() => import('./ProjectDashboardManagerReadyPackagePilotOperationsPanels.jsx'));
const ProjectDashboardManagerReadyPackageLocalReadinessPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageLocalReadinessPanels.jsx'));
const ProjectDashboardManagerReadyPackageProviderSecurityPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageProviderSecurityPanels.jsx'));

export default function ProjectDashboardManagerReadyPackageOperationalPanels({ view }) {
  return (
    <>
      {view.projectEvidenceExportWorkflow && (
        <Suspense fallback={view.fallback}>
          <ProjectDashboardProjectEvidenceExportWorkflow view={view.projectEvidenceExportView} />
        </Suspense>
      )}
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageLaunchReadinessPanels {...view.launchReadiness} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackagePilotOperationsPanels {...view.pilotOperations} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageLocalReadinessPanels {...view.localReadiness} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageProviderSecurityPanels {...view.providerSecurity} />
      </Suspense>
    </>
  );
}
