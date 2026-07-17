import React from 'react';
import { MessageSquare, Network, ScrollText } from 'lucide-react';

export default function ProjectDashboardRuntimeAutonomyStatus({ view = {} }) {
  const {
    autopilotDuePath,
    chatProofIds = [],
    flowNodeId,
    model,
    onOpenChat,
    onOpenFlowNode,
    onOpenTimeline,
    routePath,
    schedulerPath,
    sourceBadge,
    syncButton,
    text = value => value,
    timelineIds = [],
    workerQueuePath,
  } = view;

  return (
    <div data-testid="backend-runtime-autonomy-status-snapshot" className="mt-3 border border-[#7b6542] bg-[#f7edcf] p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Runtime Autonomy Status')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'backend-model-missing')}</div>
          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
            {text('C-side')} {model.cSide?.missionRunId || 'mission pending'} / {text('A-side')} {model.aSide?.sessionCount ?? 0} {text('session(s)')} / {text('B-side proof')} {model.bSide?.proofIdCount ?? model.summary?.proofIdCount ?? 0}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalAutonomy ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalAutonomy ? text('local autonomy ready') : text('backend required')}
          </span>
          <span className={`node-status-tag ${model.readyForUnattendedProduction ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
            {model.readyForUnattendedProduction ? text('production ready') : text('production blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Local Gates'), `${model.summary?.readyLocalGateCount ?? 0}/${model.summary?.localGateCount ?? (model.gates || []).filter(row => !row.productionBlocker).length}`],
          [text('Failed Gates'), model.summary?.failedLocalGateCount ?? model.failedLocalGates?.length ?? 0],
          [text('Mission Runner'), model.cSide?.missionRunId || (model.summary?.missionRunCount ? 'started' : 'pending')],
          [text('Mission Runs'), model.summary?.missionRunCount ?? 0],
          [text('Sessions'), `${model.summary?.activeSessionCount ?? model.aSide?.activeSessionCount ?? 0}/${model.summary?.sessionCount ?? model.aSide?.sessionCount ?? 0}`],
          [text('Ticks'), model.summary?.sessionTickCount ?? model.aSide?.sessionTickCount ?? 0],
          [text('Action Runs'), model.summary?.actionRunCount ?? model.aSide?.actionRunCount ?? 0],
          [text('Queued Workers'), model.summary?.queuedWorkerCount ?? model.workerQueue?.queuedWorkerCount ?? 0],
          [text('Dead Letters'), model.summary?.deadLetterCount ?? model.workerQueue?.deadLetterCount ?? 0],
          [text('Recoverable Queue'), model.summary?.recoverableAutopilotQueueCount ?? model.aSide?.recoverableAutopilotQueueCount ?? 0],
          [text('Adapter'), model.adapter?.dryRunStatus || model.adapter?.planStatus || 'unknown'],
          [text('Persistence'), model.persistence?.status || 'unknown'],
          [text('Proof IDs'), model.summary?.proofIdCount ?? model.proofIds?.length ?? 0],
        ].map(([label, value]) => (
          <div key={`runtime-autonomy-status-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-runtime-autonomy-status-gates" className="mt-2 space-y-1">
        {(model.gates || []).slice(0, 8).map(row => (
          <div key={`runtime-autonomy-status-gate-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{text(row.detail || row.apiPath || 'runtime autonomy gate')}</div>
            </div>
            <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : row.productionBlocker ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#8f1e18] text-white'}`}>
              {text(row.ready ? 'ready' : row.productionBlocker ? 'prod blocked' : 'missing')}
            </span>
          </div>
        ))}
      </div>
      <div data-testid="backend-runtime-autonomy-status-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
        Runtime autonomy route: {routePath}
        {' '} / Worker queue: {workerQueuePath}
        {' '} / Scheduler: {schedulerPath}
        {' '} / Autopilot due: {autopilotDuePath}
      </div>
      <div data-testid="backend-runtime-autonomy-status-production-boundary" className="mt-2 border border-[#251b13] bg-[#0d0c0b] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#efe2bd] leading-relaxed">
        {text('Private/local autonomy can be proven here; unattended public production stays blocked until managed queue, managed database, BYOK/provider policy, observability, cost controls, incident recovery, and immutable audit are proven.')}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="backend-runtime-autonomy-status-chat-proof"
          onClick={onOpenChat}
          disabled={!chatProofIds.length}
          className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MessageSquare size={10} /> Runtime chat proof
        </button>
        <button
          type="button"
          data-testid="backend-runtime-autonomy-status-timeline-proof"
          onClick={onOpenTimeline}
          disabled={!timelineIds.length}
          className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ScrollText size={10} /> Runtime timeline proof
        </button>
        <button
          type="button"
          data-testid="backend-runtime-autonomy-status-flow-node"
          onClick={onOpenFlowNode}
          disabled={!flowNodeId}
          className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Network size={10} /> Runtime Flow node
        </button>
      </div>
    </div>
  );
}
