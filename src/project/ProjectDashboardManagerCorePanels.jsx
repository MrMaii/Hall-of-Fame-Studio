import React, { Suspense, lazy } from 'react';

const ProjectDashboardManagerCommandCenters = lazy(() => import('./ProjectDashboardManagerCommandCenters.jsx'));
const ProjectDashboardManagerScenarioWalkthrough = lazy(() => import('./ProjectDashboardManagerScenarioWalkthrough.jsx'));
const ProjectDashboardManagerActionPlaybook = lazy(() => import('./ProjectDashboardManagerActionPlaybook.jsx'));
const ProjectDashboardManagerActionRunLedger = lazy(() => import('./ProjectDashboardManagerActionRunLedger.jsx'));
const ProjectDashboardManagerScenarioTrail = lazy(() => import('./ProjectDashboardManagerScenarioTrail.jsx'));
const ProjectDashboardSyncProtocolAudit = lazy(() => import('./ProjectDashboardSyncProtocolAudit.jsx'));
const ProjectDashboardManagerUseCaseAudit = lazy(() => import('./ProjectDashboardManagerUseCaseAudit.jsx'));
const ProjectDashboardManagerComposers = lazy(() => import('./ProjectDashboardManagerComposers.jsx'));

export default function ProjectDashboardManagerCorePanels({ view }) {
  return (
    <>
      <Suspense fallback={<div data-testid="project-dashboard-manager-command-centers-loading" className="min-h-96" role="status" aria-label="正在加载经理控制中心" />}>
        <ProjectDashboardManagerCommandCenters view={view.commandCenters} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-manager-scenario-walkthrough-loading" className="min-h-80" role="status" aria-label="正在加载管理场景步骤" />}>
        <ProjectDashboardManagerScenarioWalkthrough view={view.scenarioWalkthrough} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-manager-action-playbook-loading" className="min-h-64" role="status" aria-label="正在加载管理操作步骤" />}>
        <ProjectDashboardManagerActionPlaybook view={view.actionPlaybook} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-manager-action-run-ledger-loading" className="min-h-80" role="status" aria-label="正在加载管理运行记录" />}>
        <ProjectDashboardManagerActionRunLedger view={view.actionRunLedger} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-manager-scenario-trail-loading" className="min-h-56" role="status" aria-label="正在加载管理流程记录" />}>
        <ProjectDashboardManagerScenarioTrail view={view.scenarioTrail} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-sync-protocol-audit-loading" className="min-h-64" role="status" aria-label="正在加载同步协议检查" />}>
        <ProjectDashboardSyncProtocolAudit view={view.syncProtocolAudit} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-manager-use-case-audit-loading" className="min-h-64" role="status" aria-label="正在加载管理用例检查" />}>
        <ProjectDashboardManagerUseCaseAudit view={view.useCaseAudit} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-manager-composers-loading" className="min-h-96" role="status" aria-label="正在加载管理命令区域" />}>
        <ProjectDashboardManagerComposers view={view.composers} />
      </Suspense>
    </>
  );
}
