import React from 'react';
import { CircleDot, Database, MessageSquare, ScrollText } from 'lucide-react';

export default function ProjectDashboardActiveThreads({ view = {} }) {
  const {
    channelNameById,
    onOpenChatProof,
    onOpenTimelineProof,
    onSyncManagerDashboard,
    rows,
    syncDisabled,
    taskProofBackendRequired,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Active Threads</div>
      {taskProofBackendRequired && (
        <div data-testid="active-threads-task-proof-backend-required" className="mb-4 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          Backend Manager Dashboard task rows are required before this real project can show active threads or task proof.
          <button
            type="button"
            data-testid="active-threads-sync-manager-dashboard"
            onClick={onSyncManagerDashboard}
            disabled={syncDisabled}
            className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Database size={10} /> Sync Manager Dashboard
          </button>
        </div>
      )}
      <div className="space-y-3">
        {rows.map(({ task, evidence, chatProofChannel }) => (
          <div key={task.id} data-testid={`active-thread-task-row-${task.id}`} className="flex items-start gap-3">
            <CircleDot size={14} className={task.status === 'done' ? 'text-green-700 mt-1' : 'text-[#8f1e18] mt-1'} />
            <div className="min-w-0">
              <div className="font-serif text-lg leading-tight">{task.text || task.title || task.label || 'Task'}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                Owner: {task.assignee || task.ownerName || task.ownerId || 'Unassigned'} / {task.status || 'pending'}
              </div>
              <div data-testid={`active-thread-deadline-${task.id}`} className={`mt-1 font-mono text-[9px] uppercase tracking-widest ${task.dueAt && task.status !== 'done' && Date.parse(task.dueAt) < Date.now() ? 'text-[#8f1e18]' : 'text-[#59684b]'}`}>
                Deadline: {task.dueAt ? new Date(task.dueAt).toLocaleString() : 'Leader must set'}
                {task.dueAt && task.status !== 'done' && Date.parse(task.dueAt) < Date.now() ? ' / OVERDUE' : ''}
              </div>
              <div data-testid={`active-thread-current-step-${task.id}`} className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed">
                Current step: {task.currentWorkStep || task.workDefinition?.steps?.[Math.max(0, (task.workPulseCount || 1) - 1)] || task.workDefinition?.steps?.[0] || 'Awaiting first work step'}
                {' '} / {task.currentWorkStepIndex || task.workPulseCount || 0}/{task.requiredWorkPulses || task.workDefinition?.steps?.length || 0}
              </div>
              {task.workDefinition?.deliverable && (
                <div data-testid={`active-thread-deliverable-${task.id}`} className="mt-1 font-serif text-sm leading-snug text-[#4d412d]">
                  Deliverable: {task.workDefinition.deliverable}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {task.assignedBy && <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">Assigned by Leader</span>}
                {task.deadlineSetBy && <span className="node-status-tag bg-[#8f1e18] text-white">Deadline set by Leader</span>}
                {(task.sourceChannelId || task.channelId) && <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">From {channelNameById[task.sourceChannelId || task.channelId] || task.sourceChannelId || task.channelId}</span>}
                {evidence.hasAssignment && <span className="node-status-tag bg-[#b9782b] text-white">Assignment proof</span>}
                {evidence.hasAcknowledgement && <span className="node-status-tag bg-[#59684b] text-white">Accepted</span>}
                {evidence.hasOwnerSync && <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Owner synced</span>}
                {task.workPulseCount > 0 && <span className="node-status-tag bg-[#59684b] text-white">{task.workPulseCount} pulse{task.workPulseCount === 1 ? '' : 's'}</span>}
                {(task.completedAt || evidence.timelineCount > 0) && <span className="node-status-tag bg-green-700 text-white">{evidence.timelineCount || 1} timeline proof{(evidence.timelineCount || 1) === 1 ? '' : 's'}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {evidence.chatIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenChatProof(evidence.chatIds, chatProofChannel)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <MessageSquare size={10} /> Chat proof
                  </button>
                )}
                {evidence.timelineCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenTimelineProof(evidence.timelineIds)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <ScrollText size={10} /> Timeline proof
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
