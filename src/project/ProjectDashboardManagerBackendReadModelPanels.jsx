import React, { Suspense, lazy } from 'react';

const ProjectDashboardManagerBackendSnapshotPanels = lazy(() => import('./ProjectDashboardManagerBackendSnapshotPanels.jsx'));
const ProjectDashboardManagerBackendActivityPanels = lazy(() => import('./ProjectDashboardManagerBackendActivityPanels.jsx'));

export default function ProjectDashboardManagerBackendReadModelPanels({ view }) {
  return (
    <>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerBackendSnapshotPanels view={view.snapshot} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerBackendActivityPanels view={view.activity} />
      </Suspense>
    </>
  );
}
