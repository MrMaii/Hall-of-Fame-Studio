import React, { Suspense, lazy } from 'react';

const ProjectDashboardManagerWorkerStationPanels = lazy(() => import('./ProjectDashboardManagerWorkerStationPanels.jsx'));
const ProjectDashboardManagerReadyPackageSnapshot = lazy(() => import('./ProjectDashboardManagerReadyPackageSnapshot.jsx'));
const ProjectDashboardManagerBackendReadModelPanels = lazy(() => import('./ProjectDashboardManagerBackendReadModelPanels.jsx'));

export default function ProjectDashboardManagerBackendStationContent({ view }) {
  return (
    <>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerWorkerStationPanels view={view.workerStation} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageSnapshot view={view.readyPackage} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerBackendReadModelPanels view={view.readModel} />
      </Suspense>
    </>
  );
}
