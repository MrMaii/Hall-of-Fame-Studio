import React from 'react';

export default function ProjectDashboardProviderEvalRunWorkflow({
  view = {},
  onRecordShadowReplay,
  recordShadowReplayDisabled = false,
}) {
  const {
    activeProject,
    backendManagerReadyPackage = {},
    backendProviderEvalRunWorkflow = {},
    managerReadModelSourceBadge,
  } = view;

  return (
    <div data-testid="backend-provider-eval-run-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Provider Eval Runs</div>
          <div className="font-serif text-base leading-tight">{backendProviderEvalRunWorkflow.status || 'unknown'} / {backendProviderEvalRunWorkflow.latestRun?.mode || 'shadow replay'}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {managerReadModelSourceBadge(backendProviderEvalRunWorkflow, 'backend-provider-eval-run-workflow-source')}
          <span className={`node-status-tag ${backendProviderEvalRunWorkflow.readyForPrivatePilotProviderEval ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {backendProviderEvalRunWorkflow.readyForPrivatePilotProviderEval ? 'Eval Ready' : 'Eval Record Needed'}
          </span>
          <button
            type="button"
            data-testid="backend-provider-eval-record-shadow-replay"
            onClick={onRecordShadowReplay}
            disabled={recordShadowReplayDisabled}
            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Record Eval
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Runs', `${backendProviderEvalRunWorkflow.summary?.passedRunCount ?? 0}/${backendProviderEvalRunWorkflow.summary?.runCount ?? 0}`],
          ['Critical Replay', `${backendProviderEvalRunWorkflow.summary?.replayedCriticalOperationCount ?? 0}/${backendProviderEvalRunWorkflow.summary?.criticalOperationCount ?? 0}`],
          ['Operations', `${backendProviderEvalRunWorkflow.summary?.replayedOperationCount ?? 0}/${backendProviderEvalRunWorkflow.summary?.operationCount ?? 0}`],
          ['Gates', `${backendProviderEvalRunWorkflow.summary?.passedGateCount ?? 0}/${backendProviderEvalRunWorkflow.summary?.gateCount ?? 0}`],
          ['Proofs', backendProviderEvalRunWorkflow.summary?.proofIdCount ?? 0],
          ['Events', backendProviderEvalRunWorkflow.summary?.eventIdCount ?? 0],
          ['Latest Run', backendProviderEvalRunWorkflow.summary?.latestRunStatus || 'missing'],
          ['Packet', backendProviderEvalRunWorkflow.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`provider-eval-run-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(backendProviderEvalRunWorkflow.failedGates?.length ? backendProviderEvalRunWorkflow.failedGates : backendProviderEvalRunWorkflow.latestRun?.operationRows || backendProviderEvalRunWorkflow.requiredProductionControls || []).slice(0, 4).map(row => (
          <div key={`provider-eval-run-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.operation || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.evalStatus || row.detail || ''}</div>
              {(row.apiPath || row.route) && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath || row.route}</div>
              )}
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status || row.evalStatus || 'watch'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Provider eval route: {backendProviderEvalRunWorkflow.backendRoutes?.providerEvalRuns || backendManagerReadyPackage.backendRoutes?.providerEvalRuns || `/projects/${activeProject.id}/provider-eval-runs`}
      </div>
    </div>
  );
}
