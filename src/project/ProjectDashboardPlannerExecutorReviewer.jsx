import React from 'react';

export default function ProjectDashboardPlannerExecutorReviewer({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-planner-executor-reviewer-state-machine-snapshot" className="mt-3 border border-[#7b6542] bg-[#f7edcf] p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Planner / Executor / Reviewer')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'backend-model-missing')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalProductTeamStateMachine ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalProductTeamStateMachine ? text('handoff ready') : text('backend required')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Role Lanes'), `${model.summary?.readyRoleCount ?? 0}/${model.summary?.roleCount ?? model.roleRows?.length ?? 0}`],
          [text('Transitions'), `${model.summary?.readyTransitionCount ?? 0}/${model.summary?.transitionCount ?? model.transitionRows?.length ?? 0}`],
          [text('Executor Agents'), model.summary?.executorAgentCount ?? 0],
          [text('Reviews'), model.summary?.reviewCount ?? 0],
          [text('Revisions'), model.summary?.revisionResponseCount ?? 0],
          [text('Final Accepted'), model.summary?.acceptedFinalDeliverableCount ?? 0],
          [text('Proof IDs'), model.summary?.proofIdCount ?? model.proofIds?.length ?? 0],
          [text('Events'), model.summary?.eventIdCount ?? model.eventIds?.length ?? 0],
        ].map(([label, value]) => (
          <div key={`planner-executor-reviewer-state-machine-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-planner-executor-reviewer-state-machine-roles" className="mt-2 space-y-1">
        {(model.roleRows || model.stateRows || []).slice(0, 3).map(row => (
          <div key={`planner-executor-reviewer-role-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                {text((row.agentNames || row.agentIds || []).join(', ') || row.lane || 'backend responsibility lane')}
              </div>
            </div>
            <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {text(row.ready ? 'ready' : row.status || 'missing')}
            </span>
          </div>
        ))}
      </div>
      <div data-testid="backend-planner-executor-reviewer-state-machine-transitions" className="mt-2 space-y-1">
        {(model.transitionRows || []).slice(0, 4).map(row => (
          <div key={`planner-executor-reviewer-transition-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                {text(row.detail || `${row.from || 'planner'} -> ${row.to || 'reviewer'}`)}
              </div>
            </div>
            <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {text(row.ready ? 'ready' : row.status || 'waiting')}
            </span>
          </div>
        ))}
      </div>
      <div data-testid="backend-planner-executor-reviewer-state-machine-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] break-words">
        Responsibility route: {routePath}
      </div>
    </div>
  );
}
