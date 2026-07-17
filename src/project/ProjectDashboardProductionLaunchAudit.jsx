export default function ProjectDashboardProductionLaunchAudit({
  audit,
  projectId,
  projectText,
  route,
}) {
  const auditRoute = route || `/projects/${projectId}/production-launch-audit`;

  return (
    <div data-testid="backend-production-launch-audit-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Launch Audit')}</div>
          <div className="font-serif text-base leading-tight">{projectText(audit.status || 'unknown')} / {projectText('Production')} {projectText(audit.productionDecision || 'no-go')}</div>
        </div>
        <span className={`node-status-tag ${audit.privatePilotDecision === 'go' ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
          {projectText('Private Pilot')} {projectText(audit.privatePilotDecision || 'unknown')}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Private Gates'), `${audit.summary?.privatePilotPassedGateCount ?? 0}/${audit.summary?.privatePilotGateCount ?? 0}`],
          [projectText('Failed Private Gates'), audit.summary?.failedPrivatePilotGateCount ?? 0],
          [projectText('Production Gates'), `${audit.summary?.productionPassedGateCount ?? 0}/${audit.summary?.productionGateCount ?? 0}`],
          [projectText('Failed Production Gates'), audit.summary?.failedProductionGateCount ?? 0],
          [projectText('Launch Approvals'), audit.summary?.launchApprovalCount ?? 0],
          [projectText('Pilot Approval'), audit.summary?.launchApprovalPrivatePilotReady ? projectText('ready') : projectText('blocked')],
          [projectText('Production Approval'), audit.summary?.launchApprovalProductionReady ? projectText('ready') : projectText('blocked')],
          [projectText('Evidence Routes'), `${audit.summary?.readyEvidenceRouteCount ?? 0}/${audit.summary?.evidenceRouteCount ?? 0}`],
          [projectText('Production Blockers'), audit.summary?.productionBlockerCount ?? 0],
          [projectText('Handoff Package'), audit.summary?.projectEvidenceHandoffReady ? projectText('ready') : projectText('audit-needed')],
          [projectText('Handoff Gates'), `${audit.summary?.privatePilotHandoffPassedGateCount ?? 0}/${audit.summary?.privatePilotHandoffGateCount ?? 0}`],
          [projectText('Packet'), audit.checksum || 'missing'],
          [projectText('Next Gap'), audit.nextShortestPath?.id || 'none'],
        ].map(([label, value]) => (
          <div key={`production-launch-audit-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(audit.failedPrivatePilotGates?.length ? audit.failedPrivatePilotGates : audit.productionBlockers || []).slice(0, 3).map(row => (
          <div key={`production-launch-audit-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
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
        {projectText('Audit route')}: {auditRoute}
      </div>
    </div>
  );
}
