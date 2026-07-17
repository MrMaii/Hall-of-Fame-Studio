import React from 'react';

export default function ProjectDashboardProductTeamOperatingLoop({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-product-team-operating-loop-snapshot" className="mt-3 border border-[#7b6542] bg-[#f7edcf] p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Product Team Operating Loop')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'backend-model-missing')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalPilotOperatingLoop ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalPilotOperatingLoop ? text('local loop ready') : text('backend required')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Manager Next'), model.customerSide?.nextAction?.id || model.summary?.nextActionId || 'none'],
          [text('Next Lane'), model.summary?.nextActionLane || model.customerSide?.nextAction?.lane || 'none'],
          [text('Handoff Exec'), model.customerSide?.handoffExecution?.status || model.summary?.customerAgentHandoffExecutionStatus || 'pending'],
          [text('Handoff Runs'), model.customerSide?.handoffExecution?.runReceiptIds?.length ?? model.summary?.customerAgentHandoffExecutionRunReceiptCount ?? 0],
          [text('Handoff Outputs'), model.customerSide?.handoffExecution?.submissionIds?.length ?? model.summary?.customerAgentHandoffExecutionSubmissionCount ?? 0],
          [text('Handoff Proof'), model.customerSide?.handoffExecution?.proofIds?.length ?? model.summary?.customerAgentHandoffExecutionResultMessageCount ?? 0],
          [text('Agent Ready'), model.agentSide?.readyCount ?? model.summary?.agentReadyCount ?? 0],
          [text('Agent Strategy'), (model.agentSide?.selectedActions || model.summary?.selectedAgentActions || []).length],
          [text('Agent Initiative'), model.agentSide?.initiativeCount ?? model.summary?.agentInitiativeCount ?? 0],
          [text('Targets'), (model.agentSide?.targetArtifactTypes || model.summary?.initiativeArtifactTypes || []).slice(0, 2).join(', ') || 'none'],
          [text('Trace'), `${model.summary?.traceReadyCount ?? model.deliveryLoop?.readyStageIds?.length ?? 0}/${(model.deliveryLoop?.readyStageIds?.length || 0) + (model.deliveryLoop?.missingStageIds?.length || 0)}`],
          [text('Next Gap'), model.deliveryLoop?.nextMissingStageId || model.summary?.nextMissingStageId || 'complete'],
          [text('Workers'), model.executionLoop?.workerQueuedCount ?? model.summary?.workerQueuedCount ?? 0],
          [text('Runnable'), model.executionLoop?.runnableActionCount ?? model.summary?.runnableActionCount ?? 0],
          [text('Proof Routes'), model.proofLoop?.proofRouteCount ?? model.summary?.proofRouteCount ?? 0],
          [text('Timeline'), model.summary?.timelineLogIdCount ?? model.proofLoop?.timelineLogIds?.length ?? 0],
          [text('Events'), model.summary?.eventIdCount ?? model.proofLoop?.eventIds?.length ?? 0],
          [text('Prod Blockers'), model.summary?.productionBlockerCount ?? model.requiredProductionControls?.length ?? 0],
        ].map(([label, value]) => (
          <div key={`product-team-operating-loop-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      {(model.agentSide?.initiativeRows || []).length > 0 && (
        <div data-testid="backend-product-team-operating-loop-initiatives" className="mt-2 space-y-1">
          {(model.agentSide.initiativeRows || []).slice(0, 4).map(row => (
            <div key={`product-team-operating-loop-initiative-${row.id || row.agentId}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
              <div className="min-w-0">
                <div className="font-serif text-sm leading-tight truncate">{text(row.name || row.agentId || 'Agent')} / {text(row.actionLabel || row.selectedAction || 'initiative')}</div>
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{text(row.intent || 'next intent pending')}</div>
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Target: {row.artifactType || 'progress-brief'} / Route: {row.runApiPath || row.agentWorkCycleApiPath || 'missing'}</div>
              </div>
              <span className={`node-status-tag ${row.canRun ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
                {text(row.canRun ? 'ready' : row.status || 'watch')}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-1">
        {(model.gates || []).slice(0, 7).map(gate => (
          <div key={`product-team-operating-loop-gate-${gate.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(gate.label || gate.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{text(gate.detail || gate.apiPath || 'backend proof')}</div>
            </div>
            <span className={`node-status-tag ${gate.passed ? 'bg-[#59684b] text-white' : gate.productionBlocker ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#8f1e18] text-white'}`}>
              {text(gate.passed ? 'ready' : gate.productionBlocker ? 'prod blocked' : 'missing')}
            </span>
          </div>
        ))}
      </div>
      <div data-testid="backend-product-team-operating-loop-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] break-words">
        Operating loop route: {routePath}
      </div>
    </div>
  );
}
