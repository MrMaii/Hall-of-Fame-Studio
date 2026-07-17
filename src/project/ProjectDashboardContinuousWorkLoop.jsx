import React from 'react';
import { Activity, Database, GitCommit, MessageSquare } from 'lucide-react';

export default function ProjectDashboardContinuousWorkLoop({ view = {} }) {
  const {
    backendStatusText,
    continuousWorkLoop,
    formatRunTime,
    managerReadModelSourceBadge,
    nextProjectPulseLabel,
    onOpenChatProof,
    onOpenTimelineProof,
    onRunAgentPulse,
    onSyncCockpit,
    projectText,
    pulseDisabled,
    rows,
    syncDisabled,
  } = view;

  const timelineProofCount = rows.reduce((sum, row) => sum + row.timelineIds.length, 0);

  return (
    <div data-testid="continuous-work-loop" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Continuous Work Loop')}</div>
          <div className="font-serif text-xl leading-tight">{projectText('Scheduler to Agent pulse to timeline proof, visible for every fixed routine.')}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {managerReadModelSourceBadge(continuousWorkLoop, 'continuous-work-loop-source')}
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
            {rows.filter(row => row.proofReady).length}/{rows.length} {projectText('proofed')}
          </span>
        </div>
      </div>
      {continuousWorkLoop.frontendMockSuppressed && (
        <div data-testid="continuous-work-loop-backend-required" className="mb-4 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
          <span>Backend Continuous Work Loop required. Local loop rows are suppressed for this backend project.</span>
          <button
            type="button"
            data-testid="continuous-work-loop-sync-cockpit"
            onClick={onSyncCockpit}
            disabled={syncDisabled}
            className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Database size={10} /> Sync Cockpit
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Scheduler State')}</div>
          <div className="font-serif text-base leading-tight">{projectText(backendStatusText)}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Next Project Pulse')}</div>
          <div className="font-serif text-base leading-tight">{nextProjectPulseLabel}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Agent Loops')}</div>
          <div className="font-serif text-base leading-tight">{rows.filter(row => row.nextRunAt).length} {projectText('scheduled')}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Timeline Proof')}</div>
          <div className="font-serif text-base leading-tight">{timelineProofCount} {projectText(timelineProofCount === 1 ? 'log' : 'logs')}</div>
        </div>
      </div>
      <div className="space-y-2">
        {rows.map(row => (
          <div key={`continuous-loop-${row.agent.id}`} data-testid={`continuous-loop-agent-${row.agent.id}`} className="border-t border-[#d8c99f] pt-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="font-serif text-lg leading-tight">{row.agent.name}</div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                  {projectText(row.routineLabel)} / {projectText(row.loopState)} / {projectText('next')} {formatRunTime(row.nextRunAt)}
                </div>
                <div className="mt-2 font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">
                  {projectText('Focus')}: {projectText(row.focus)} / {projectText('Next')}: {projectText(row.nextStep)}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRunAgentPulse(row.agent.id)}
                  disabled={pulseDisabled}
                  className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Activity size={10} /> {projectText('Run Loop Pulse')}
                </button>
                {row.chatIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenChatProof(row.chatIds)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <MessageSquare size={10} /> {projectText('Loop chat proof')}
                  </button>
                )}
                {row.timelineIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenTimelineProof(row.timelineIds)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <GitCommit size={10} /> {projectText('Loop timeline proof')}
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
