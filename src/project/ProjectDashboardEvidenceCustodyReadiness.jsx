import React from 'react';

export default function ProjectDashboardEvidenceCustodyReadiness({
  view = {},
  sourceBadge = null,
  syncProofModelsButton = null,
}) {
  const {
    activeProject,
    backendEvidenceCustodyReadiness = {},
    backendManagerReadyPackage = {},
  } = view;

  return (
    <div data-testid="backend-evidence-custody-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Evidence Custody Readiness</div>
          <div className="font-serif text-base leading-tight">{backendEvidenceCustodyReadiness.status || 'unknown'} / {backendEvidenceCustodyReadiness.readyForProduction ? 'production-ready' : 'managed-storage-blocked'}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncProofModelsButton}
          <span className={`node-status-tag ${backendEvidenceCustodyReadiness.readyForPrivatePilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {backendEvidenceCustodyReadiness.readyForPrivatePilot ? 'Local Custody Ready' : 'Needs Custody Work'}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Gates', `${backendEvidenceCustodyReadiness.summary?.passedGateCount ?? 0}/${backendEvidenceCustodyReadiness.summary?.gateCount ?? 0}`],
          ['Custody Records', backendEvidenceCustodyReadiness.summary?.custodyRecordCount ?? 0],
          ['Source Snapshots', backendEvidenceCustodyReadiness.summary?.sourceSnapshotCount ?? 0],
          ['Provider Receipts', backendEvidenceCustodyReadiness.summary?.providerReceiptCount ?? 0],
          ['Source Decisions', backendEvidenceCustodyReadiness.summary?.sourceReviewDecisionCount ?? 0],
          ['Persistence Rows', `${backendEvidenceCustodyReadiness.summary?.sourceSnapshotPersistenceCount ?? 0}/${backendEvidenceCustodyReadiness.summary?.providerReceiptPersistenceCount ?? 0}`],
          ['Managed Storage', backendEvidenceCustodyReadiness.managedStorage?.configured ? 'configured' : 'missing'],
          ['Production Controls', backendEvidenceCustodyReadiness.summary?.productionControlCount ?? 0],
        ].map(([label, value]) => (
          <div key={`evidence-custody-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(backendEvidenceCustodyReadiness.failedGates?.length ? backendEvidenceCustodyReadiness.failedGates : backendEvidenceCustodyReadiness.requiredProductionControls || []).slice(0, 3).map(row => (
          <div key={`evidence-custody-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Custody route: {backendManagerReadyPackage.backendRoutes?.evidenceCustodyReadiness || `/projects/${activeProject.id}/evidence-custody-readiness`}
      </div>
    </div>
  );
}
