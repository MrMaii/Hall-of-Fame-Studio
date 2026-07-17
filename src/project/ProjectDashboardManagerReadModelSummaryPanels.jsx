import React, { lazy, Suspense } from 'react';

const ProjectDashboardManagerReadModelSnapshots = lazy(() => import('./ProjectDashboardManagerReadModelSnapshots.jsx'));
const ProjectDashboardManagerActionQueueSnapshot = lazy(() => import('./ProjectDashboardManagerActionQueueSnapshot.jsx'));

export default function ProjectDashboardManagerReadModelSummaryPanels({
  activeProjectId,
  managerActionQueue,
  managerCommandCenter,
  managerDashboard,
  managerReadModelSourceBadge,
  managerRequirementMatrix,
  managerScenarioTrail,
  managerScenarioWalkthrough,
  managerUseCaseAudit,
  projectText,
  syncProtocolAudit,
}) {
  return (
    <>
      <Suspense fallback={<div data-testid="project-dashboard-manager-read-model-snapshots-loading" className="min-h-64" role="status" aria-label="正在加载管理状态面板" />}>
        <ProjectDashboardManagerReadModelSnapshots
          backendManagerDashboard={managerDashboard}
          activeProjectId={activeProjectId}
          backendManagerCommandCenter={managerCommandCenter}
          backendManagerScenarioWalkthrough={managerScenarioWalkthrough}
          backendManagerScenarioTrail={managerScenarioTrail}
          backendManagerRequirementMatrix={managerRequirementMatrix}
          backendSyncProtocolAudit={syncProtocolAudit}
          backendManagerUseCaseAudit={managerUseCaseAudit}
          managerReadModelSourceBadge={managerReadModelSourceBadge}
          projectText={projectText}
        />
      </Suspense>
      <Suspense fallback={<div data-testid="project-dashboard-manager-action-queue-snapshot-loading" className="min-h-32" role="status" aria-label="正在加载经理行动队列摘要" />}>
        <ProjectDashboardManagerActionQueueSnapshot
          activeProjectId={activeProjectId}
          backendManagerActionQueue={managerActionQueue}
          backendManagerDashboard={managerDashboard}
          managerReadModelSourceBadge={managerReadModelSourceBadge}
          projectText={projectText}
        />
      </Suspense>
    </>
  );
}
