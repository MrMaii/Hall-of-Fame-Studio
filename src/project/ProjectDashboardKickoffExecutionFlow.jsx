import React from 'react';
import { GitCommit, MessageSquare, RefreshCw, ScrollText } from 'lucide-react';

export default function ProjectDashboardKickoffExecutionFlow({ view = {} }) {
  const {
    backendRequired,
    charter,
    flow,
    onOpenChatProof,
    onOpenTimelineProof,
    onSyncManagerDashboard,
  } = view;

  return (
    <>
      {backendRequired && (
        <div data-testid="kickoff-execution-flow-backend-required" className="bg-[#251b13]/95 border border-[#8f1e18] p-5 mb-6 text-[#efe2bd]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#f0c36a] mb-2">Kickoff Execution Flow</div>
              <div className="font-serif text-2xl leading-tight">Backend Manager Dashboard required.</div>
              <div className="mt-2 font-mono text-[8px] uppercase tracking-widest leading-relaxed text-[#d8c99f]">
                Sync Manager Dashboard before treating next actions, first pulse, or startup rows as real backend proof.
              </div>
            </div>
            <button
              type="button"
              data-testid="kickoff-execution-flow-sync-manager-dashboard"
              onClick={onSyncManagerDashboard}
              className="inline-flex shrink-0 items-center gap-2 border border-[#f0c36a] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#f0c36a] hover:bg-[#f0c36a] hover:text-[#251b13] transition-colors"
            >
              <RefreshCw size={12} /> Sync Manager Dashboard
            </button>
          </div>
        </div>
      )}

      {flow && (
        <div data-testid="kickoff-execution-flow" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Kickoff Execution Flow</div>
              <div className="font-serif text-2xl leading-tight">Meeting decisions to first 24/7 work pulse.</div>
            </div>
            <span className={`node-status-tag ${flow.firstPulse.started ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
              {flow.firstPulse.started ? 'First Pulse Started' : 'Waiting'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
            <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Next Actions</div>
              <div className="font-serif text-base leading-tight">{flow.nextActions.length} action{flow.nextActions.length === 1 ? '' : 's'}</div>
            </div>
            <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Leader Assignments</div>
              <div className="font-serif text-base leading-tight">{flow.assignmentRows.length} traced</div>
            </div>
            <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">First Pulse</div>
              <div className="font-serif text-base leading-tight">{flow.firstPulse.started ? 'started' : 'pending'}</div>
            </div>
            <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">24/7 Work</div>
              <div className="font-serif text-base leading-tight">{flow.readyForAutonomy ? 'enabled' : 'pending'}</div>
            </div>
          </div>
          {flow.nextActionResolution && (
            <div data-testid="kickoff-next-action-resolution" className="mb-4 border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Next Action Resolution</div>
                  <div className="mt-1 font-serif text-base leading-tight">
                    {flow.nextActionResolution.taskCount || flow.nextActions.length} first execution action{(flow.nextActionResolution.taskCount || flow.nextActions.length) === 1 ? '' : 's'}
                  </div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                    {flow.nextActionResolution.leaderName || charter?.governance?.leaderName || 'Leader'} assigns / {flow.nextActionResolution.managerConfirmed ? 'manager-confirmed' : 'awaiting confirmation'}
                  </div>
                  {flow.nextActionResolutionDelivery && (
                    <div data-testid="kickoff-next-action-agent-receipts" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                      Agent receipts: {flow.nextActionResolutionDelivery.deliveredAgentIds.length}-{flow.nextActionResolutionDelivery.teamCount} / obligations {flow.nextActionResolutionDelivery.obligationAgentIds.length}-{flow.nextActionResolutionDelivery.teamCount}
                    </div>
                  )}
                </div>
                <span className={`node-status-tag ${flow.nextActionResolution.managerConfirmed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                  {flow.nextActionResolution.status || 'next actions'}
                </span>
              </div>
            </div>
          )}
          {flow.allAgentStartupRows?.length > 0 && (
            <div data-testid="all-agent-startup-matrix" className="mb-4 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">All-Agent Startup Matrix</div>
                  <div className="font-serif text-lg leading-tight">Every confirmed Agent enters a fixed routine and next run queue after approval.</div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <span className={`node-status-tag ${flow.allAgentsStarted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                    {flow.allAgentStartupRows.filter(row => row.started).length}/{flow.allAgentStartupRows.length} started
                  </span>
                  <span className={`node-status-tag ${flow.allAgentsScheduled ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                    {flow.allAgentStartupRows.filter(row => row.scheduled).length}/{flow.allAgentStartupRows.length} scheduled
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {flow.allAgentStartupRows.map(row => {
                  const rowAgentId = row.agent?.id || row.agentId || row.id || 'unknown-agent';
                  const rowAgentName = row.agent?.name || row.name || row.agentName || rowAgentId;
                  const startupProofTypes = Array.isArray(row.startupProofTypes) ? row.startupProofTypes : [];
                  const proofLogIds = Array.isArray(row.proofLogIds) ? row.proofLogIds : [];
                  return (
                    <div key={`startup-${rowAgentId}`} data-testid={`startup-agent-${rowAgentId}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-serif text-base leading-tight">{rowAgentName}</div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                            {row.status} / {row.routineLabel} / next {row.nextRunAt ? new Date(row.nextRunAt).toLocaleString() : 'not scheduled'}
                          </div>
                          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                            {row.planFocus || row.routineArtifact || 'fixed routine ready'} / proof {startupProofTypes.join(' + ') || 'pending'}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          <span className={`node-status-tag ${row.started ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Started</span>
                          <span className={`node-status-tag ${row.scheduled ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Queued</span>
                          <span className={`node-status-tag ${row.hasRoutinePlan ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>Routine Plan</span>
                          <span className={`node-status-tag ${row.hasFirstPulsePlan || row.hasWorkerStartup ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>Startup Proof</span>
                        </div>
                      </div>
                      {proofLogIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenTimelineProof(proofLogIds)}
                          className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                        >
                          <GitCommit size={10} /> Startup timeline proof
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {flow.nextActions.map(action => {
              const assignmentRow = flow.assignmentRows.find(row => (
                String(row.task?.id || row.taskId || '') === String(action.id || action.taskId || '')
              ));
              return (
                <div key={`kickoff-execution-${action.id}`} data-testid={`kickoff-execution-${action.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="font-serif text-base leading-tight">{action.text}</div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{action.ownerName || 'Unassigned'} / {action.status || 'pending'}</div>
                    </div>
                    <span className={`node-status-tag ${action.assignmentSeen ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>
                      {action.assignmentSeen ? 'Assigned' : 'Awaiting @assignment'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assignmentRow?.evidence?.chatIds?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenChatProof(assignmentRow.evidence.chatIds, assignmentRow.sourceChannelId || 'main')}
                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                      >
                        <MessageSquare size={10} /> Assignment proof
                      </button>
                    )}
                    {assignmentRow?.evidence?.timelineIds?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenTimelineProof(assignmentRow.evidence.timelineIds)}
                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                      >
                        <ScrollText size={10} /> Timeline proof
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {flow.firstPulse.messageIds.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenChatProof(flow.firstPulse.messageIds, 'main')}
                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
              >
                <MessageSquare size={10} /> First pulse chat proof
              </button>
            )}
            {flow.firstPulse.timelineLogIds.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenTimelineProof(flow.firstPulse.timelineLogIds)}
                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
              >
                <ScrollText size={10} /> First pulse timeline proof
              </button>
            )}
          </div>
          <div className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
            Trigger: {flow.firstPulse.trigger || 'not recorded'} / Next Run: {flow.firstPulse.nextRunAt ? new Date(flow.firstPulse.nextRunAt).toLocaleString() : 'not scheduled'}
          </div>
        </div>
      )}
    </>
  );
}
