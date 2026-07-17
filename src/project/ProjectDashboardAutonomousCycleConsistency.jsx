import React from 'react';

export default function ProjectDashboardAutonomousCycleConsistency({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-autonomous-cycle-consistency-snapshot" className="mt-3 border border-[#7b6542] bg-[#f7edcf] p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Autonomous Cycle Consistency')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'backend-model-missing')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalPilotCycleConsistency ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalPilotCycleConsistency ? text('cycle consistent') : text('backend required')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Steps'), `${model.summary?.observedStepCount ?? 0}/${model.summary?.requiredStepCount ?? 3}`],
          [text('Action Runs'), model.summary?.actionRunCount ?? 0],
          [text('Loop Runs'), model.summary?.loopRunCount ?? 0],
          [text('Missing Receipts'), model.summary?.missingRunReceiptCount ?? model.missingRunReceiptIds?.length ?? 0],
          [text('Failed Rows'), model.summary?.failedLocalRowCount ?? model.failedLocalRows?.length ?? 0],
          [text('Dead Letters'), model.summary?.workerDeadLetterCount ?? 0],
          [text('Proof IDs'), model.summary?.proofIdCount ?? model.proofIds?.length ?? 0],
          [text('Events'), model.summary?.eventIdCount ?? model.eventIds?.length ?? 0],
        ].map(([label, value]) => (
          <div key={`autonomous-cycle-consistency-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-autonomous-cycle-consistency-rows" className="mt-2 space-y-1">
        {(model.consistencyRows || []).slice(0, 8).map(row => (
          <div key={`autonomous-cycle-consistency-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{text(row.detail || row.apiPath || 'cycle proof')}</div>
            </div>
            <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : row.productionBlocker ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#8f1e18] text-white'}`}>
              {text(row.ready ? 'ready' : row.productionBlocker ? 'prod blocked' : 'missing')}
            </span>
          </div>
        ))}
      </div>
      <div data-testid="backend-autonomous-cycle-consistency-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] break-words">
        Cycle consistency route: {routePath}
      </div>
    </div>
  );
}
