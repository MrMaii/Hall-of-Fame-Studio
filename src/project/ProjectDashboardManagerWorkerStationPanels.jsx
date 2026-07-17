import React, { Suspense, lazy } from 'react';

const ProjectDashboardBackendWorkerStationStatus = lazy(() => import('./ProjectDashboardBackendWorkerStationStatus.jsx'));
const ProjectDashboardProductionInfrastructureRehearsal = lazy(() => import('./ProjectDashboardProductionInfrastructureRehearsal.jsx'));

export default function ProjectDashboardManagerWorkerStationPanels({ view }) {
  return (
    <>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardBackendWorkerStationStatus {...view.status} />
      </Suspense>
      {view.productionInfrastructureRehearsal && (
        <Suspense fallback={<div data-testid="project-dashboard-production-infrastructure-rehearsal-loading" className="min-h-48" role="status" aria-label="正在加载生产基础设施演练" />}>
          <ProjectDashboardProductionInfrastructureRehearsal {...view.productionInfrastructureRehearsal} />
        </Suspense>
      )}
      {view.proofTranscriptRequired && (
        <div data-testid="backend-proof-transcript-required" className="mt-2 border border-[#8f1e18] bg-[#f3d7bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] leading-relaxed">
          Backend proof transcript required / local recovery suppressed / sync backend transcript before proof navigation.
        </div>
      )}
      {view.proofTimelineRequired && (
        <div data-testid="backend-proof-timeline-required" className="mt-2 border border-[#8f1e18] bg-[#f3d7bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] leading-relaxed">
          Backend timeline proof required / local focus suppressed / sync backend timeline and event ledger before proof navigation.
        </div>
      )}
    </>
  );
}
