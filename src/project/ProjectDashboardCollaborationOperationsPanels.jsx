import React, { Suspense, lazy } from 'react';

const ProjectDashboardChangeFlow = lazy(() => import('./ProjectDashboardChangeFlow.jsx'));
const ProjectDashboardCommunicationFlow = lazy(() => import('./ProjectDashboardCommunicationFlow.jsx'));
const ProjectDashboardAgentManagementMesh = lazy(() => import('./ProjectDashboardAgentManagementMesh.jsx'));
const ProjectDashboardManagerScenarioReadiness = lazy(() => import('./ProjectDashboardManagerScenarioReadiness.jsx'));

export default function ProjectDashboardCollaborationOperationsPanels({ view }) {
  return (
    <>
      {(view.changeFlowDisplayRows.length > 0 || view.changeFlow.frontendMockSuppressed || (view.changeDerivedFrontendRowsAllowed && view.changeLedger.length > 0)) && (
        <Suspense fallback={<div data-testid="project-dashboard-change-flow-loading" className="min-h-72" role="status" aria-label="正在加载变更流程" />}>
          <ProjectDashboardChangeFlow view={view.changeFlowView} />
        </Suspense>
      )}

      {(view.peerHandoffs.length > 0 || view.agentCommunicationRows.length > 0) && (
        <Suspense fallback={<div data-testid="project-dashboard-communication-flow-loading" className="min-h-72" role="status" aria-label="正在加载 Agent 沟通流程" />}>
          <ProjectDashboardCommunicationFlow view={view.communicationFlowView} />
        </Suspense>
      )}

      <Suspense fallback={<div data-testid="project-dashboard-agent-management-mesh-loading" className="min-h-72" role="status" aria-label="正在加载 Agent 管理关系" />}>
        <ProjectDashboardAgentManagementMesh view={view.agentManagementMeshView} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-manager-scenario-readiness-loading" className="min-h-48" role="status" aria-label="正在加载经理场景就绪度" />}>
        <ProjectDashboardManagerScenarioReadiness view={view.managerScenarioReadinessView} />
      </Suspense>
    </>
  );
}
