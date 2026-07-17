import React from 'react';
import { CheckCircle2, MessageSquare, ScrollText } from 'lucide-react';

export default function ProjectDashboardCollaborationIntentQueue({ view = {} }) {
  const {
    chatProofIds,
    onOpenChat,
    onOpenTimeline,
    queue,
    routePath,
    sourceBadge,
    syncButton,
    timelineIds,
  } = view;
  const ready = queue.readyForLocalPilotIntentQueue;

  return (
    <div data-testid="proof-map-collaboration-intent-queue" className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 size={14} className={ready ? 'text-green-700' : 'text-[#8f1e18]'} />
            <div className="font-serif text-base leading-tight">Collaboration Intent Queue</div>
            {sourceBadge}
            <span className={`node-status-tag ${ready ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
              {ready ? 'Ready' : 'Needs proof'}
            </span>
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
            Intent routing / {queue.summary?.runnableCount ?? 0} runnable of {queue.summary?.rowCount ?? queue.rows?.length ?? 0} rows / {queue.summary?.agentInitiativeIntentCount ?? 0} Agent initiatives
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed break-words">
            Route: {routePath}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          {syncButton}
          <button
            type="button"
            data-testid="proof-map-collaboration-intent-chat-open"
            onClick={onOpenChat}
            disabled={!chatProofIds.length}
            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageSquare size={10} />
            Intent chat proof
          </button>
          <button
            type="button"
            data-testid="proof-map-collaboration-intent-timeline-open"
            onClick={onOpenTimeline}
            disabled={!timelineIds.length}
            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ScrollText size={10} />
            Intent timeline proof
          </button>
        </div>
      </div>
    </div>
  );
}
