import React, { Suspense, lazy } from 'react';

const ProjectDashboardManagerBackendStationContent = lazy(() => import('./ProjectDashboardManagerBackendStationContent.jsx'));
const ProjectDashboardBackendSchedulerControls = lazy(() => import('./ProjectDashboardBackendSchedulerControls.jsx'));

export default function ProjectDashboardManagerBackendStationRegion({ view }) {
  return (
    <div data-testid="backend-worker-station" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Suspense fallback={view.fallback}>
            <ProjectDashboardManagerBackendStationContent view={view.content} />
          </Suspense>
        </div>
        <Suspense fallback={view.schedulerFallback}>
          <ProjectDashboardBackendSchedulerControls {...view.scheduler} />
        </Suspense>
      </div>
    </div>
  );
}
