import React from 'react';
import { Database } from 'lucide-react';

export default function ProjectDashboardOperationsBoard({ view = {} }) {
  const {
    agentStateSummary,
    backendStatusText,
    cadenceClass,
    cadenceLabel,
    formatRunTime,
    managerReadModelSourceBadge,
    onSyncCockpit,
    projectLastRunLabel,
    projectNextRunLabel,
    projectText,
    rows,
    syncDisabled,
  } = view;

  return (
    <div data-testid="operations-board-24-7" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('24/7 Operations Board')}</div>
          <div className="font-serif text-xl leading-tight">{projectText('Project cadence, backend worker state, and every Agent run queue in one view.')}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {managerReadModelSourceBadge(agentStateSummary, 'agent-state-summary-source')}
          <span className={`node-status-tag ${cadenceClass}`}>
            {cadenceLabel}
          </span>
        </div>
      </div>
      {agentStateSummary.frontendMockSuppressed && (
        <div data-testid="agent-state-summary-backend-required" className="mb-4 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
          <span>Backend Agent State Summary required. Local Agent state rows are suppressed for this backend project.</span>
          <button
            type="button"
            data-testid="agent-state-summary-sync-cockpit"
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
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Project Next Run')}</div>
          <div className="font-serif text-base leading-tight">{projectNextRunLabel}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Project Last Run')}</div>
          <div className="font-serif text-base leading-tight">{projectLastRunLabel}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Backend Worker')}</div>
          <div className="font-serif text-base leading-tight">{backendStatusText}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-3 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Agent Run Queue</div>
          <div className="font-serif text-base leading-tight">{rows.length} Agent{rows.length === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div className="space-y-2">
        {rows.map(row => (
          <div key={`operations-${row.agent.id}`} data-testid={`operations-agent-${row.agent.id}`} className="border-t border-[#d8c99f] pt-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-serif text-lg leading-tight">{row.agent.name}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{row.agent.role}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.state.status || 'standing by'}</span>
                <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{row.openObligations} {projectText(row.openObligations === 1 ? 'open obligation' : 'open obligations')}</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="border border-[#d8c99f] bg-[#efe2bd]/45 px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Next Agent Run')}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{formatRunTime(row.nextRunAt)}</div>
              </div>
              <div className="border border-[#d8c99f] bg-[#efe2bd]/45 px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Latest Agent Work')}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{formatRunTime(row.lastRunAt)}</div>
              </div>
              <div className="border border-[#d8c99f] bg-[#efe2bd]/45 px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Worker Trigger')}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{projectText(row.trigger)}</div>
              </div>
              <div className="border border-[#d8c99f] bg-[#efe2bd]/45 px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Management Priority')}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{projectText(row.priority)} / {projectText(row.reason)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
