import { lazy, Suspense } from 'react';

const ProjectDashboardActiveThreads = lazy(() => import('./ProjectDashboardActiveThreads.jsx'));
const ProjectDashboardTeam = lazy(() => import('./ProjectDashboardTeam.jsx'));

export default function ProjectDashboardTeamWorkspacePanels({ activeThreadsView, teamView }) {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <Suspense fallback={<div data-testid="project-dashboard-active-threads-loading" className="min-h-72 border border-[#b8a57d]" role="status" aria-label="正在加载进行中的任务" />}>
        <ProjectDashboardActiveThreads view={activeThreadsView} />
      </Suspense>
      <Suspense fallback={<div data-testid="project-dashboard-team-loading" className="min-h-72 border border-[#b8a57d]" role="status" aria-label="正在加载 Agent 团队" />}>
        <ProjectDashboardTeam view={teamView} />
      </Suspense>
    </div>
  );
}
