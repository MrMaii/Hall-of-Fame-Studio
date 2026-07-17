export default function ProjectDashboardPublicProductionStartupSummary({
  projectText,
  readiness,
  sourceBadge,
}) {
  return (
    <>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Public Production Startup Readiness')}</div>
          <div className="font-serif text-base leading-tight">{projectText(readiness.status || 'public-production-startup-blocked')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          <span className={`node-status-tag ${readiness.readyForPublicProduction ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {readiness.readyForPublicProduction ? projectText('public ready') : projectText('public blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Passed Gates'), `${readiness.summary?.passedGateCount ?? 0}/${readiness.summary?.gateCount ?? 0}`],
          [projectText('Failed Gates'), readiness.summary?.failedGateCount ?? 0],
          [projectText('Blockers'), readiness.summary?.failedBlockerGateCount ?? 0],
          [projectText('Access'), readiness.summary?.accessControlEnforced ? projectText('enforced') : projectText('blocked')],
          [projectText('Managed Identity'), readiness.summary?.managedIdentityStartupReady ? projectText('ready') : projectText('blocked')],
          [projectText('Cost Control'), readiness.summary?.productionCostControlReady ? projectText('ready') : projectText('blocked')],
          [projectText('Data Governance'), readiness.summary?.productionDataGovernanceReady ? projectText('ready') : projectText('blocked')],
          [projectText('Traffic Control'), readiness.summary?.productionTrafficStartupReady ? projectText('ready') : projectText('blocked')],
          [projectText('Customer Acceptance'), readiness.summary?.productionCustomerAcceptanceReady ? projectText('ready') : projectText('blocked')],
          [projectText('Managed Secrets'), readiness.summary?.managedSecretsReady ? projectText('ready') : projectText('blocked')],
          [projectText('Managed DB'), readiness.summary?.managedPersistenceReady ? projectText('ready') : projectText('blocked')],
          [projectText('Managed Queue'), readiness.summary?.managedQueueReady ? projectText('ready') : projectText('blocked')],
          [projectText('Observability'), readiness.summary?.observabilityReady ? projectText('ready') : projectText('blocked')],
          [projectText('Next Action'), readiness.nextAction?.id || 'none'],
          [projectText('Packet'), readiness.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`public-production-startup-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
    </>
  );
}
