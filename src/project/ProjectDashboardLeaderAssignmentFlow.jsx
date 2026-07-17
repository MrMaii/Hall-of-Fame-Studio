import React from 'react';
import { Activity, CheckCircle2, Database, GitCommit, MessageSquare, ScrollText } from 'lucide-react';

export default function ProjectDashboardLeaderAssignmentFlow({ view = {} }) {
  const {
    agentNameById,
    assignmentDerivedFrontendRowsAllowed,
    assignmentFlowRows,
    assignmentTimelineMatrix,
    assignmentTimelineRows,
    assignmentWorkProgressRows,
    channelNameById,
    managerReadModelSourceBadge,
    onOpenChatProof,
    onOpenTimelineProof,
    onSyncCockpit,
    syncDisabled,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Leader Assignment Flow</div>
          <div className="font-serif text-2xl leading-tight">Group @assignment to Agent work proof</div>
        </div>
        <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{assignmentDerivedFrontendRowsAllowed ? assignmentFlowRows.length : 0} traced</span>
      </div>
      <div data-testid="assignment-timeline-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Assignment Timeline Matrix</div>
            <div className="font-serif text-lg leading-tight">Leader @assignment, Agent receipt, acknowledgement, and timeline event in one chain.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {managerReadModelSourceBadge(assignmentTimelineMatrix, 'assignment-timeline-matrix-source')}
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
              {assignmentTimelineRows.filter(row => row.assignmentPosted && row.assigneeReceived && row.timelineRecorded).length}/{assignmentTimelineRows.length} timeline-ready
            </span>
          </div>
        </div>
        {assignmentTimelineMatrix.frontendMockSuppressed && (
          <div data-testid="assignment-timeline-matrix-backend-required" className="mt-3 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
            <span>Backend Assignment Timeline Matrix required. Local assignment/work-progress rows are suppressed for this backend project.</span>
            <button
              type="button"
              data-testid="assignment-timeline-matrix-sync-cockpit"
              onClick={onSyncCockpit}
              disabled={syncDisabled}
              className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Database size={10} /> Sync Cockpit
            </button>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {assignmentTimelineRows.map(row => (
            <div key={`assignment-timeline-${row.task.id}`} data-testid={`assignment-timeline-row-${row.task.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="font-serif text-base leading-tight">{row.task.text}</div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                    Leader {agentNameById[row.task.assignedBy] || row.task.assignedBy || 'Leader'} {'->'} {row.owner?.name || row.task.assignee || row.task.ownerId || 'Agent'} / {channelNameById[row.sourceChannelId] || row.sourceChannelId}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <span className={`node-status-tag ${row.assignmentPosted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>@Assignment Posted</span>
                  <span className={`node-status-tag ${row.assigneeReceived ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Assignee Saw It</span>
                  <span className={`node-status-tag ${row.assigneeAccepted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Acknowledged</span>
                  <span className={`node-status-tag ${row.timelineRecorded ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Assignment Timeline Event</span>
                  <span className={`node-status-tag ${row.workSeen ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Agent Work Started</span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2">
                {[
                  ['Group Chat @Mention', row.assignmentPosted ? 'posted' : 'pending'],
                  ['Inbox Delivery', row.assigneeReceived ? 'received' : 'waiting'],
                  ['Agent Ack', row.assigneeAccepted ? 'accepted' : 'pending'],
                  ['Assignment Timeline Event', `${row.assignmentTimelineIds.length || row.evidence.timelineCount} log${(row.assignmentTimelineIds.length || row.evidence.timelineCount) === 1 ? '' : 's'}`],
                  ['Work Pulse Timeline', `${row.workTimelineIds.length} work log${row.workTimelineIds.length === 1 ? '' : 's'}`],
                ].map(([label, value]) => (
                  <div key={`${row.task.id}-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1 min-w-0">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{label}</div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {row.evidence.chatIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenChatProof(row.evidence.chatIds, row.sourceChannelId)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <MessageSquare size={10} /> Assignment receipt proof
                  </button>
                )}
                {row.evidence.timelineIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenTimelineProof(row.evidence.timelineIds)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <GitCommit size={10} /> Assignment timeline event proof
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {assignmentDerivedFrontendRowsAllowed && (
        <div data-testid="assignment-work-progress-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Assignment Work Progress Matrix</div>
              <div className="font-serif text-lg leading-tight">Assigned work pulses, latest progress, and completion proof mapped to the timeline.</div>
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
              {assignmentWorkProgressRows.filter(row => row.progressPublished).length}/{assignmentWorkProgressRows.length} progress-published
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {assignmentWorkProgressRows.map(row => (
              <div key={`assignment-progress-${row.task.id}`} data-testid={`assignment-work-progress-row-${row.task.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="font-serif text-base leading-tight">{row.task.text}</div>
                    <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                      {row.owner?.name || row.task.assignee || row.task.ownerId || 'Agent'} / {row.workPulseCount} pulse{row.workPulseCount === 1 ? '' : 's'} / {row.task.status || 'active'}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <span className={`node-status-tag ${row.chatProgressIds.length ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Progress Chat</span>
                    <span className={`node-status-tag ${row.progressPublished ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Timeline Progress</span>
                    <span className={`node-status-tag ${row.completionPublished ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>Completion Proof</span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
                  {[
                    ['Work Pulses', `${row.workPulseCount}`],
                    ['Progress Logs', `${row.timelineProgressIds.length}`],
                    ['Completion Logs', `${row.completionLogs.length}`],
                    ['Latest Update', row.latestProgressText || 'waiting'],
                  ].map(([label, value]) => (
                    <div key={`${row.task.id}-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1 min-w-0">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{label}</div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words line-clamp-2">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.chatProgressIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenChatProof(row.chatProgressIds, row.sourceChannelId)}
                      className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <MessageSquare size={10} /> Progress chat proof
                    </button>
                  )}
                  {row.timelineProgressIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenTimelineProof(row.timelineProgressIds)}
                      className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <Activity size={10} /> Progress timeline proof
                    </button>
                  )}
                  {row.completionLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenTimelineProof(row.completionLogs.map(log => log.id))}
                      className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <CheckCircle2 size={10} /> Completion timeline proof
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {assignmentDerivedFrontendRowsAllowed && (
        <div className="space-y-3">
          {assignmentFlowRows.map(row => (
            <div key={row.task.id} data-testid={`assignment-flow-${row.task.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="font-serif text-lg leading-tight">{row.task.text}</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mt-1">
                    Owner {row.owner?.name || row.task.assignee || row.task.ownerId || 'unassigned'} / From {channelNameById[row.sourceChannelId] || row.sourceChannelId}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {row.evidence.chatIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenChatProof(row.evidence.chatIds, row.sourceChannelId)}
                      className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <MessageSquare size={10} /> Assignment chat proof
                    </button>
                  )}
                  {row.timelineSeen && (
                    <button
                      type="button"
                      onClick={() => onOpenTimelineProof(row.evidence.timelineIds)}
                      className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <ScrollText size={10} /> Assignment timeline proof
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Group @Assignment</div>
                  <div className="font-serif text-base leading-tight">{row.assignmentIds.length ? 'posted' : 'pending'}</div>
                </div>
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Assignee Inbox</div>
                  <div className="font-serif text-base leading-tight">{row.inboxSeen || row.obligationSeen ? 'received' : 'waiting'}</div>
                </div>
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Acknowledgement</div>
                  <div className="font-serif text-base leading-tight">{row.acknowledgementIds.length ? 'accepted' : 'pending'}</div>
                </div>
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Work Pulse</div>
                  <div className="font-serif text-base leading-tight">{row.task.workPulseCount || (row.workSeen ? 1 : 0)} pulse{(row.task.workPulseCount || (row.workSeen ? 1 : 0)) === 1 ? '' : 's'}</div>
                </div>
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Timeline Proof</div>
                  <div className="font-serif text-base leading-tight">{row.evidence.timelineCount} log{row.evidence.timelineCount === 1 ? '' : 's'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
