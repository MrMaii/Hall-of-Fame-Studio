import React, { Suspense, lazy } from 'react';

const ProjectDashboardManagerCorePanels = lazy(() => import('./ProjectDashboardManagerCorePanels.jsx'));
const ProjectDashboardWorkLoopPanels = lazy(() => import('./ProjectDashboardWorkLoopPanels.jsx'));
const ProjectDashboardManagerBackendStationRegion = lazy(() => import('./ProjectDashboardManagerBackendStationRegion.jsx'));
const ProjectDashboardManagerCollaborationBody = lazy(() => import('./ProjectDashboardManagerCollaborationBody.jsx'));

export default function ProjectDashboardManagerBody({
  coreView,
  workLoopView,
  stationFallback,
  stationView,
  collaborationView,
}) {
  return (
    <>
      <ProjectDashboardManagerCorePanels view={coreView} />
      <ProjectDashboardWorkLoopPanels view={workLoopView} />
      <Suspense fallback={stationFallback}>
        <ProjectDashboardManagerBackendStationRegion view={stationView} />
      </Suspense>
      <ProjectDashboardManagerCollaborationBody view={collaborationView} />
    </>
  );
}
