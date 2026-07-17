import React, { Suspense, lazy } from 'react';

const ProjectDashboardManagerSnapshotExecutionPanels = lazy(() => import('./ProjectDashboardManagerSnapshotExecutionPanels.jsx'));
const ProjectDashboardManagerCompatibilityProofPanels = lazy(() => import('./ProjectDashboardManagerCompatibilityProofPanels.jsx'));
const ProjectDashboardManagerSubmissionRoutePanels = lazy(() => import('./ProjectDashboardManagerSubmissionRoutePanels.jsx'));

export default function ProjectDashboardManagerBackendSnapshotPanels({ view }) {
  if (!view.managerDashboard) return null;

  return (
    <div data-testid="backend-manager-dashboard-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerSnapshotExecutionPanels {...view.snapshotExecution} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerCompatibilityProofPanels {...view.compatibilityProof} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerSubmissionRoutePanels {...view.submissionRoutes} />
      </Suspense>
    </div>
  );
}
