import React, { Suspense, lazy } from 'react';

const ProjectDashboardAutonomousWorkLoop = lazy(() => import('./ProjectDashboardAutonomousWorkLoop.jsx'));
const ProjectDashboardOperationsBoard = lazy(() => import('./ProjectDashboardOperationsBoard.jsx'));
const ProjectDashboardContinuousWorkLoop = lazy(() => import('./ProjectDashboardContinuousWorkLoop.jsx'));
const ProjectDashboardFixedWorkRoutines = lazy(() => import('./ProjectDashboardFixedWorkRoutines.jsx'));

export default function ProjectDashboardWorkLoopPanels({ view }) {
  return (
    <>
      <Suspense fallback={<div data-testid="project-dashboard-autonomous-work-loop-loading" className="min-h-64" role="status" aria-label="正在加载自动工作循环" />}>
        <ProjectDashboardAutonomousWorkLoop view={view.autonomousWorkLoop} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-operations-board-loading" className="min-h-80" role="status" aria-label="正在加载运行状态" />}>
        <ProjectDashboardOperationsBoard view={view.operationsBoard} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-continuous-work-loop-loading" className="min-h-80" role="status" aria-label="正在加载持续工作循环" />}>
        <ProjectDashboardContinuousWorkLoop view={view.continuousWorkLoop} />
      </Suspense>

      <Suspense fallback={<div data-testid="project-dashboard-fixed-work-routines-loading" className="min-h-72" role="status" aria-label="正在加载固定工作任务" />}>
        <ProjectDashboardFixedWorkRoutines view={view.fixedWorkRoutines} />
      </Suspense>
    </>
  );
}
