import React from 'react';

export default function ProjectDashboardProviderControlledRun({ view = {} }) {
  const {
    activeProject,
    backendManagerReadyPackage = {},
    backendProviderControlledRun = {},
    managerReadModelSourceBadge,
  } = view;

  return (
    <div data-testid="backend-provider-controlled-run-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Provider Controlled Run</div>
          <div className="font-serif text-base leading-tight">{backendProviderControlledRun.status || 'unknown'} / {backendProviderControlledRun.runMode || 'policy dry-run'}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {managerReadModelSourceBadge(backendProviderControlledRun, 'backend-provider-controlled-run-source')}
          <span className={`node-status-tag ${backendProviderControlledRun.readyForPrivatePilotRun ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {backendProviderControlledRun.readyForPrivatePilotRun ? 'Controlled Run Ready' : 'Run Blocked'}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Operations', `${backendProviderControlledRun.summary?.runnableOperationCount ?? 0}/${backendProviderControlledRun.summary?.operationCount ?? 0}`],
          ['Blocked Ops', backendProviderControlledRun.summary?.blockedOperationCount ?? 0],
          ['Gates', `${backendProviderControlledRun.summary?.passedGateCount ?? 0}/${backendProviderControlledRun.summary?.gateCount ?? 0}`],
          ['Estimated Cost', `${backendProviderControlledRun.summary?.estimatedRunCostCents ?? 0}c`],
          ['Budget Left', backendProviderControlledRun.budget?.remainingDailyBudgetCents ?? 'unlimited'],
          ['Hourly Left', backendProviderControlledRun.budget?.remainingHourlyRequests ?? 'unlimited'],
          ['Model Proof', backendProviderControlledRun.summary?.modelProofReady ? 'ready' : 'missing'],
          ['Search Proof', backendProviderControlledRun.summary?.searchProofReady ? 'ready' : 'missing'],
          ['Human Review', backendProviderControlledRun.summary?.humanReviewReady ? 'ready' : 'blocked'],
          ['Evidence Gov', backendProviderControlledRun.summary?.evidenceReady ? 'ready' : 'blocked'],
          ['Redaction', backendProviderControlledRun.summary?.redactionReady ? 'ready' : 'blocked'],
          ['Packet', backendProviderControlledRun.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`provider-controlled-run-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(backendProviderControlledRun.failedGates?.length ? backendProviderControlledRun.failedGates : backendProviderControlledRun.operationPlan || []).slice(0, 4).map(row => (
          <div key={`provider-controlled-run-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.operation || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.purpose || row.policyReason || ''}</div>
              {(row.apiPath || row.route) && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath || row.route}</div>
              )}
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status || row.decision || 'watch'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Controlled run route: {backendProviderControlledRun.backendRoutes?.providerControlledRun || backendManagerReadyPackage.backendRoutes?.providerControlledRun || `/projects/${activeProject.id}/provider-controlled-run`}
      </div>
    </div>
  );
}
