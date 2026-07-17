import React from 'react';

export default function ProjectDashboardPrivatePilotGoLiveReadiness({ view = {} }) {
  const {
    activeProject,
    backendManagerReadyPackage = {},
    backendPrivatePilotGoLiveReadiness = {},
    managerReadModelSourceBadge,
    projectText,
  } = view;

  return (
    <div data-testid="backend-private-pilot-go-live-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Private Pilot Go-Live Readiness')}</div>
          <div className="font-serif text-base leading-tight">{projectText(backendPrivatePilotGoLiveReadiness.status || 'go-live-needed')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {managerReadModelSourceBadge(backendPrivatePilotGoLiveReadiness, 'backend-private-pilot-go-live-readiness-source')}
          <span className={`node-status-tag ${backendPrivatePilotGoLiveReadiness.readyForPrivatePilotGoLive ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {backendPrivatePilotGoLiveReadiness.readyForPrivatePilotAcceptance ? projectText('accepted') : backendPrivatePilotGoLiveReadiness.readyForPrivatePilotGoLive ? projectText('go-live ready') : projectText('blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Active Phase'), backendPrivatePilotGoLiveReadiness.activePhase || 'preflight'],
          [projectText('Go-Live Stages'), `${backendPrivatePilotGoLiveReadiness.summary?.goLiveReadyStageCount ?? 0}/${backendPrivatePilotGoLiveReadiness.summary?.goLiveStageCount ?? 0}`],
          [projectText('Acceptance Stages'), `${backendPrivatePilotGoLiveReadiness.summary?.acceptanceReadyStageCount ?? 0}/${backendPrivatePilotGoLiveReadiness.summary?.acceptanceStageCount ?? 0}`],
          [projectText('Failed Go-Live'), backendPrivatePilotGoLiveReadiness.summary?.failedGoLiveStageCount ?? 0],
          [projectText('Next Action'), backendPrivatePilotGoLiveReadiness.nextAction?.id || 'none'],
          [projectText('Owner'), backendPrivatePilotGoLiveReadiness.nextAction?.owner || 'manager'],
          [projectText('Proofs'), backendPrivatePilotGoLiveReadiness.summary?.proofIdCount ?? 0],
          [projectText('Events'), backendPrivatePilotGoLiveReadiness.summary?.eventIdCount ?? 0],
          [projectText('Latest Launch'), backendPrivatePilotGoLiveReadiness.latestRecords?.launchRunId || 'missing'],
          [projectText('Latest Health'), backendPrivatePilotGoLiveReadiness.latestRecords?.launchHealthCheckId || 'missing'],
          [projectText('Acceptance'), backendPrivatePilotGoLiveReadiness.latestRecords?.acceptanceReportId || 'missing'],
          [projectText('Packet'), backendPrivatePilotGoLiveReadiness.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`private-pilot-go-live-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(backendPrivatePilotGoLiveReadiness.failedGoLiveRows?.length ? backendPrivatePilotGoLiveReadiness.failedGoLiveRows : backendPrivatePilotGoLiveReadiness.stageRows || []).slice(0, 5).map(row => (
          <div key={`private-pilot-go-live-stage-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.action || row.detail || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.ready ? projectText('ready') : projectText('action')}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Go-live route')}: {backendPrivatePilotGoLiveReadiness.backendRoutes?.privatePilotGoLiveReadiness || backendManagerReadyPackage.backendRoutes?.privatePilotGoLiveReadiness || `/projects/${activeProject.id}/private-pilot-go-live-readiness`}
      </div>
    </div>
  );
}
