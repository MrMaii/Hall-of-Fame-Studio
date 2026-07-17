import React from 'react';

export default function ProjectDashboardPilotLaunchReadiness({ view = {} }) {
  const {
    activeProject,
    backendManagerReadyPackage = {},
    backendPilotLaunchReadiness = {},
  } = view;

  return (
    <div data-testid="backend-pilot-launch-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Pilot Launch Readiness</div>
          <div className="font-serif text-base leading-tight">{backendPilotLaunchReadiness.status || 'unknown'} / production {backendPilotLaunchReadiness.productionDecision || 'no-go'}</div>
        </div>
        <span className={`node-status-tag ${backendPilotLaunchReadiness.privatePilotDecision === 'go' ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
          Private Pilot {backendPilotLaunchReadiness.privatePilotDecision || 'unknown'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Gates', `${backendPilotLaunchReadiness.summary?.passedGateCount ?? 0}/${backendPilotLaunchReadiness.summary?.gateCount ?? 0}`],
          ['Failed Gates', backendPilotLaunchReadiness.summary?.failedGateCount ?? 0],
          ['Evidence Routes', `${backendPilotLaunchReadiness.summary?.readyEvidenceRouteCount ?? 0}/${backendPilotLaunchReadiness.summary?.evidenceRouteCount ?? 0}`],
          ['Prod Blockers', backendPilotLaunchReadiness.summary?.productionBlockerCount ?? 0],
          ['Packet', backendPilotLaunchReadiness.checksum || 'missing'],
          ['Next Gap', backendPilotLaunchReadiness.nextShortestPath?.id || 'none'],
        ].map(([label, value]) => (
          <div key={`pilot-launch-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(backendPilotLaunchReadiness.failedGates?.length ? backendPilotLaunchReadiness.failedGates : backendPilotLaunchReadiness.productionBlockers || []).slice(0, 3).map(row => (
          <div key={`pilot-launch-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status || row.severity || 'blocked'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Launch route: {backendManagerReadyPackage.backendRoutes?.pilotLaunchReadiness || `/projects/${activeProject.id}/pilot-launch-readiness`}
      </div>
    </div>
  );
}
