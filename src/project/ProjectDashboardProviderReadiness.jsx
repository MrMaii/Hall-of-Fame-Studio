import React from 'react';

export default function ProjectDashboardProviderReadiness({ view = {} }) {
  const {
    activeProject,
    backendManagerReadyPackage = {},
    backendProviderReadiness = {},
    managerReadModelSourceBadge,
  } = view;

  return (
    <div data-testid="backend-provider-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Provider Readiness</div>
          <div className="font-serif text-base leading-tight">{backendProviderReadiness.status || 'unknown'} / {backendProviderReadiness.rollout?.production || 'blocked'}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {managerReadModelSourceBadge(backendProviderReadiness, 'backend-provider-readiness-source')}
          <span className={`node-status-tag ${backendProviderReadiness.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {backendProviderReadiness.readyForLocalPilot ? 'Local Contract Ready' : 'Needs Provider Work'}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Gates', `${backendProviderReadiness.summary?.passedGateCount ?? 0}/${backendProviderReadiness.summary?.gateCount ?? 0}`],
          ['Provider Searches', backendProviderReadiness.summary?.providerBackedSearchCount ?? 0],
          ['Evidence Sources', backendProviderReadiness.summary?.evidenceSourceCount ?? 0],
          ['Source Snapshots', backendProviderReadiness.summary?.evidenceSourceSnapshotCount ?? 0],
          ['Provider Receipts', backendProviderReadiness.summary?.evidenceProviderReceiptCount ?? 0],
          ['Source Audit', backendProviderReadiness.summary?.sourceAuditCoverageReady ? 'ready' : 'blocked'],
          ['Production Controls', backendProviderReadiness.summary?.productionControlCount ?? 0],
          ['Local Controls', backendProviderReadiness.summary?.localProductionControlCount ?? 0],
          ['Usage Rows', backendProviderReadiness.summary?.providerUsageCount ?? 0],
          ['Daily Cost', `${backendProviderReadiness.summary?.providerDailyCostCents ?? 0}c`],
          ['Model Drafts', backendProviderReadiness.summary?.modelArtifactDraftCount ?? 0],
          ['Draft Quality', `${backendProviderReadiness.summary?.modelArtifactDraftQualityReadyCount ?? 0}/${backendProviderReadiness.summary?.modelArtifactDraftCount ?? 0}`],
          ['Human Review', backendProviderReadiness.summary?.modelArtifactDraftHumanReviewRequiredCount ?? 0],
          ['Failure Control', backendProviderReadiness.summary?.providerFailureControlReady ? 'ready' : 'blocked'],
          ['Open Circuits', backendProviderReadiness.summary?.providerOpenCircuitCount ?? 0],
          ['Retry Attempts', backendProviderReadiness.summary?.providerRetryAttempts ?? 0],
          ['Secret Vault', backendProviderReadiness.summary?.providerSecretVaultReady ? 'ready' : 'blocked'],
          ['Vault Records', backendProviderReadiness.summary?.providerSecretVaultEncryptedRecordCount ?? 0],
          ['Vault Rotation', backendProviderReadiness.summary?.providerSecretVaultRotationReady ? 'ready' : 'blocked'],
          ['Source Safety', backendProviderReadiness.summary?.sourceSafetyReady ? 'ready' : 'blocked'],
          ['Blocked Sources', backendProviderReadiness.summary?.sourceSafetyBlockedSourceCount ?? 0],
          ['Search Enabled', backendProviderReadiness.summary?.searchEnabled ? 'yes' : 'no'],
          ['Response Leaks', backendProviderReadiness.summary?.responseLeakCount ?? 0],
          ['Next Provider Gap', backendProviderReadiness.rollout?.nextProductionGapId || 'none'],
        ].map(([label, value]) => (
          <div key={`provider-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(backendProviderReadiness.failedGates?.length ? backendProviderReadiness.failedGates : backendProviderReadiness.requiredProductionControls || []).slice(0, 3).map(row => (
          <div key={`provider-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
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
        Provider route: {backendManagerReadyPackage.backendRoutes?.providerReadiness || `/projects/${activeProject.id}/provider-readiness`}
      </div>
    </div>
  );
}
