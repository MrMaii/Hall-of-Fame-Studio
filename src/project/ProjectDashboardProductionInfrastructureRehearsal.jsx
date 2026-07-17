import { Server } from 'lucide-react';

export default function ProjectDashboardProductionInfrastructureRehearsal({
  onRunManagedInfrastructureCutoverAttestation,
  projectId,
  projectText,
  readyPackage,
  receipt,
  rehearsal,
  runDisabled,
}) {
  return (
    <div data-testid="backend-production-infrastructure-rehearsal-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Infrastructure Rehearsal')}</div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
            {rehearsal.status || 'unknown'} / {rehearsal.readyForInfrastructureRehearsal ? projectText('rehearsal-ready') : projectText('rehearsal-blocked')} / {rehearsal.readyForProduction ? projectText('production-ready') : projectText('production-blocked')}
          </div>
        </div>
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#251b13] text-right">
          {rehearsal.summary?.rehearsalReadyCount ?? 0}/{rehearsal.summary?.domainCount ?? 0} {projectText('domains')}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Gateway'), rehearsal.summary?.gatewayStatus || 'unknown'],
          [projectText('Persistence'), rehearsal.summary?.persistenceStatus || 'unknown'],
          [projectText('Queue'), rehearsal.summary?.queueStatus || 'unknown'],
          [projectText('Managed Cutover'), `${rehearsal.managedCutoverSummary?.productionReadyGateCount ?? 0}/${rehearsal.managedCutoverSummary?.gateCount ?? 0}`],
          [projectText('Prod Blockers'), rehearsal.summary?.productionBlockedCount ?? 0],
          [projectText('Cutover Receipts'), `${rehearsal.managedCutoverSummary?.receiptReadyGateCount ?? 0}/${rehearsal.managedCutoverSummary?.gateCount ?? 0}`],
          [projectText('Next Cutover'), rehearsal.managedCutoverSummary?.nextGateId || 'none'],
        ].map(([label, value]) => (
          <div key={`standalone-production-infrastructure-rehearsal-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(rehearsal.managedCutoverGates || []).slice(0, 4).map(gate => (
          <div data-testid={`backend-production-infrastructure-cutover-gate-${gate.id}`} key={`standalone-production-infrastructure-cutover-gate-${gate.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{projectText(gate.label || gate.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{gate.evidenceTier || 'production-blocked'} / {gate.receiptReady ? 'receipt-ready' : 'receipt-needed'}</div>
            </div>
            <span className={`node-status-tag ${gate.productionReady ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{gate.productionReady ? projectText('ready') : projectText('blocked')}</span>
          </div>
        ))}
      </div>
      <div data-testid="backend-production-infrastructure-rehearsal-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] break-words">
        {projectText('Infrastructure rehearsal route')}: {rehearsal.backendRoutes?.productionInfrastructureRehearsal || `/projects/${projectId}/production-infrastructure-rehearsal`}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="backend-managed-infrastructure-cutover-attestation-run"
          onClick={onRunManagedInfrastructureCutoverAttestation}
          disabled={runDisabled}
          className="inline-flex items-center gap-1 border border-[#7b6542] bg-[#251b13] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Server size={10} /> {projectText('Request managed cutover attestation')}
        </button>
        <span className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
          {readyPackage?.backendRoutes?.managedInfrastructureCutoverAttestations || `/projects/${projectId}/managed-infrastructure-cutover-attestations`}
        </span>
      </div>
      {receipt && (
        <div data-testid="backend-managed-infrastructure-cutover-attestation-receipt" className={`mt-2 border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${receipt.localProofCreated ? 'border-[#d8c99f] bg-[#fff8df] text-[#6b5a3d]' : 'border-[#8f1e18] bg-red-50 text-[#8f1e18]'}`}>
          {receipt.status || 'recorded'} / {receipt.readyForManagedInfrastructureCutoverEvidence ? 'managed evidence ready' : 'managed evidence blocked'} / {receipt.blocker || receipt.backendRoutes?.productionInfrastructureRehearsal || 'proof routes refreshed'}
        </div>
      )}
    </div>
  );
}
