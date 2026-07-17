import React from 'react';

export default function ProjectDashboardRuntimeContracts({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-runtime-contracts-snapshot" className="mt-3 border border-[#7b6542] bg-[#f7edcf] p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Runtime Contracts')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'backend-model-missing')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalPilotContractFreeze ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalPilotContractFreeze ? text('contracts frozen') : text('proof missing')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Frozen'), `${model.summary?.frozenLocalContractCount ?? 0}/${model.summary?.localContractCount ?? model.contractRows?.length ?? 0}`],
          [text('Failed'), model.summary?.failedLocalContractCount ?? model.failedLocalContracts?.length ?? 0],
          [text('Schemas'), model.frozenSchemaVersions?.length ?? 0],
          [text('Artifacts'), `${model.summary?.coveredArtifactTypeCount ?? 0}/${model.summary?.requiredArtifactTypeCount ?? 0}`],
          [text('Proof IDs'), model.summary?.proofIdCount ?? model.proofIds?.length ?? 0],
          [text('Timeline'), model.summary?.timelineLogIdCount ?? model.timelineLogIds?.length ?? 0],
          [text('Events'), model.summary?.eventIdCount ?? model.eventIds?.length ?? 0],
          [text('Prod Blockers'), model.summary?.productionBlockerCount ?? model.requiredProductionControls?.length ?? 0],
        ].map(([label, value]) => (
          <div key={`runtime-contracts-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-runtime-contracts-rows" className="mt-2 space-y-1">
        {(model.contractRows || []).slice(0, 8).map(row => (
          <div key={`runtime-contract-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{text(row.detail || row.apiPath || 'runtime contract')}</div>
            </div>
            <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : row.productionBlocker ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#8f1e18] text-white'}`}>
              {text(row.ready ? 'frozen' : row.productionBlocker ? 'prod blocked' : 'missing')}
            </span>
          </div>
        ))}
      </div>
      <div data-testid="backend-runtime-contracts-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] break-words">
        Runtime contracts route: {routePath}
      </div>
    </div>
  );
}
