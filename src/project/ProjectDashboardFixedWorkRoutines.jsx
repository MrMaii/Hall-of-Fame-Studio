import React from 'react';
import { Database } from 'lucide-react';

export default function ProjectDashboardFixedWorkRoutines({ view = {} }) {
  const {
    agentStateSummary,
    managerReadModelSourceBadge,
    onSyncCockpit,
    projectText,
    rows,
    syncDisabled,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Fixed Work Routines')}</div>
          <div className="font-serif text-xl leading-tight">{projectText('Every Agent has a recurring routine, artifact, next step, and evidence source.')}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {managerReadModelSourceBadge(agentStateSummary, 'fixed-work-routines-source')}
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{rows.length} {projectText('Agents')}</span>
        </div>
      </div>
      {agentStateSummary.frontendMockSuppressed && (
        <div data-testid="fixed-work-routines-backend-required" className="mb-4 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
          <span>Backend Agent State Summary required. Local fixed-routine rows are suppressed for this backend project.</span>
          <button
            type="button"
            data-testid="fixed-work-routines-sync-cockpit"
            onClick={onSyncCockpit}
            disabled={syncDisabled}
            className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Database size={10} /> Sync Cockpit
          </button>
        </div>
      )}
      <div className="space-y-3">
        {rows.map(({ agent, state, routine, focus, next, latestWorklog, latestWorker }) => (
          <div key={`routine-${agent.id}`} data-testid={`routine-row-${agent.id}`} className="border-t border-[#d8c99f] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-serif text-lg leading-tight">{agent.name}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{projectText(routine?.label || 'Routine pending')}</span>
                <span className="node-status-tag bg-[#59684b] text-white">{projectText(routine?.artifact || 'work evidence')}</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Routine Checklist')}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                  {projectText((routine?.checklist || []).slice(0, 3).join(' -> ') || 'read state -> publish progress')}
                </div>
              </div>
              <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Current Focus')}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{projectText(focus)}</div>
              </div>
              <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Next Evidence')}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                  {projectText(next)} / {projectText(latestWorker?.trigger || latestWorklog?.source || state.status || 'waiting')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
