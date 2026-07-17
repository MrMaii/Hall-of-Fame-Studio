import React, { Suspense, lazy } from 'react';

const ProjectDashboardLaunchOperationsOverview = lazy(() => import('./ProjectDashboardLaunchOperationsOverview.jsx'));
const ProjectDashboardManagerReadyPackageSummary = lazy(() => import('./ProjectDashboardManagerReadyPackageSummary.jsx'));
const ProjectDashboardManagerReadyPackageCoordinationPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageCoordinationPanels.jsx'));
const ProjectDashboardCollaborationIntentQueueSnapshot = lazy(() => import('./ProjectDashboardCollaborationIntentQueueSnapshot.jsx'));
const ProjectDashboardManagerReadyPackageRuntimePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageRuntimePanels.jsx'));
const ProjectDashboardManagerReadyPackageEvidencePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageEvidencePanels.jsx'));

export default function ProjectDashboardManagerReadyPackageCorePanels({ view }) {
  return (
    <>
      <Suspense fallback={<div data-testid="project-dashboard-launch-operations-overview-loading" className="min-h-48" role="status" aria-label="正在加载上线运行概览" />}>
        <ProjectDashboardLaunchOperationsOverview {...view.launchOperationsOverview} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageSummary {...view.summary} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageCoordinationPanels {...view.coordination} />
      </Suspense>
      {view.collaborationIntentQueue && (
        <Suspense fallback={view.fallback}>
          <ProjectDashboardCollaborationIntentQueueSnapshot {...view.collaborationIntentQueueSnapshot} />
        </Suspense>
      )}
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageRuntimePanels {...view.runtime} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageEvidencePanels {...view.evidence} />
      </Suspense>
    </>
  );
}
