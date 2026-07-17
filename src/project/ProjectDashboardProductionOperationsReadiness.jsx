export default function ProjectDashboardProductionOperationsReadiness({
  fallbackRoute,
  projectId,
  projectText,
  readiness,
}) {
  return (
    <div data-testid="backend-production-operations-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Operations Readiness')}</div>
          <div className="font-serif text-base leading-tight">{projectText(readiness.status || 'controls-blocked')}</div>
        </div>
        <span className={`node-status-tag ${readiness.managedProductionEvidence?.readyForManagedProductionOperationsEvidence ? 'bg-[#59684b] text-white' : readiness.readyForProductionOperations ? 'bg-[#c2912f] text-[#251b13]' : 'bg-[#8f1e18] text-white'}`}>
          {readiness.managedProductionEvidence?.readyForManagedProductionOperationsEvidence ? projectText('managed evidence ready') : readiness.readyForProductionOperations ? projectText('receipts ready') : readiness.readyForPrivatePilotOperations ? projectText('controls blocked') : projectText('proof blocked')}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Local Proof'), `${readiness.summary?.localProofPassedGateCount ?? 0}/${readiness.summary?.localProofGateCount ?? 0}`],
          [projectText('Local Failures'), readiness.summary?.failedLocalProofGateCount ?? 0],
          [projectText('Prod Controls'), `${readiness.summary?.productionControlPassedGateCount ?? 0}/${readiness.summary?.productionControlGateCount ?? 0}`],
          [projectText('Blocked Controls'), readiness.summary?.failedProductionControlGateCount ?? 0],
          [projectText('Managed Evidence'), readiness.managedProductionEvidence?.readyForManagedProductionOperationsEvidence ? projectText('ready') : projectText('blocked')],
          [projectText('Managed Controls'), `${readiness.managedProductionEvidence?.summary?.managedProductionControlCount ?? 0}/${readiness.managedProductionEvidence?.summary?.requiredControlCount ?? 0}`],
          [projectText('Private Pilot Ops'), readiness.readyForPrivatePilotOperations ? projectText('ready') : projectText('blocked')],
          [projectText('Ops Receipts'), readiness.readyForProductionOperations ? projectText('ready') : projectText('blocked')],
          [projectText('Alert Rules'), `${readiness.observabilityPlan?.localRoutedAlertRuleCount ?? 0}/${readiness.observabilityPlan?.localAlertRuleCount ?? 0}`],
          [projectText('On Call'), readiness.onCallPlan?.configured ? projectText('configured') : projectText('blocked')],
          [projectText('Incident System'), readiness.incidentPlan?.configured ? projectText('configured') : projectText('blocked')],
          [projectText('Restore Drill'), readiness.incidentPlan?.restoreDrillReceiptConfigured ? projectText('configured') : projectText('blocked')],
          [projectText('Next Gap'), readiness.nextShortestPath?.id || 'none'],
          [projectText('Packet'), readiness.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`production-operations-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(readiness.failedProductionControlGates?.length ? readiness.failedProductionControlGates : readiness.failedLocalProofGates || []).slice(0, 4).map(row => (
          <div key={`production-operations-readiness-gate-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className={`node-status-tag ${row.passed ? 'bg-[#59684b] text-white' : row.severity === 'warning' ? 'bg-[#c2912f] text-[#251b13]' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.passed ? projectText('passed') : row.status || 'missing'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Production ops route')}: {readiness.backendRoutes?.productionOperationsReadiness || fallbackRoute || `/projects/${projectId}/production-operations-readiness`}
      </div>
    </div>
  );
}
