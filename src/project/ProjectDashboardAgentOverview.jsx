import React from 'react';
import { Activity, Database, Network } from 'lucide-react';

export default function ProjectDashboardAgentOverview({ view = {} }) {
  const {
    activeProject,
    agentStateSummary,
    agentStateSummaryAllowsLocalProofFallback,
    backendCommandAvailable,
    backendStation,
    backendWorkerStationSyncDisabled,
    continuousWorkRows,
    kickoffGenerationLabel,
    kickoffGenerationProvenance,
    managerReadModelSourceBadge,
    onOpenManagerFlowGraph,
    onRunAgentPulse,
    onSyncCockpit,
    operationsBoardBackendRequired,
    operationsBoardRows,
    projectText,
    sceneTransition,
  } = view;

  return (
    <>
      {kickoffGenerationProvenance && (
        <div data-testid="kickoff-dashboard-generation-source" className="border border-[#d8c99f] bg-[#efe2bd]/65 p-4 mb-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Kickoff Generation Source</div>
              <div className="mt-1 font-serif text-xl leading-tight">{projectText(kickoffGenerationLabel)}</div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                {projectText(kickoffGenerationProvenance.label || 'Generation provenance not recorded')} / {projectText(kickoffGenerationProvenance.mode || 'missing')}
              </div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                {projectText(kickoffGenerationProvenance.productionBlocker || 'Production claim remains blocked until provider controls are recorded.')}
              </div>
            </div>
            <span className={`node-status-tag ${kickoffGenerationProvenance.productionClaim === 'blocked' ? 'bg-[#8f1e18] text-white' : 'bg-[#59684b] text-white'}`}>
              {projectText(kickoffGenerationProvenance.productionClaim || 'blocked')}
            </span>
          </div>
        </div>
      )}

      <div data-testid="dashboard-agent-status" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Agent Current Work Status')}</div>
            <div className="font-serif text-2xl leading-tight">{projectText('What each employee is doing, running, and accountable for now.')}</div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {managerReadModelSourceBadge(agentStateSummary, 'dashboard-agent-status-source')}
            <button
              type="button"
              onClick={onOpenManagerFlowGraph}
              disabled={Boolean(sceneTransition)}
              className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#251b13] px-4 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40"
            >
              <Network size={12} /> {projectText('Open Flow Graph')}
            </button>
          </div>
        </div>
        {operationsBoardBackendRequired && (
          <div data-testid="dashboard-agent-status-backend-required" className="mb-4 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
            <div>{projectText('Backend Agent State Summary required. Local Agent status rows are suppressed for this backend project.')}</div>
            <button
              type="button"
              data-testid="dashboard-agent-status-sync-cockpit"
              onClick={onSyncCockpit}
              disabled={backendWorkerStationSyncDisabled}
              className="mt-2 inline-flex items-center gap-1 border border-[#8f1e18] bg-white px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Database size={10} /> {projectText('Sync Cockpit')}
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
          {operationsBoardRows.map(row => {
            const loopRow = continuousWorkRows.find(item => item.agent.id === row.agent.id) || {};
            const agentStatusLocalTasksAllowed = agentStateSummaryAllowsLocalProofFallback;
            const ownedOpenTasks = agentStatusLocalTasksAllowed ? (activeProject.tasks || []).filter(task => (
              task.status !== 'done'
              && (
                task.ownerId === row.agent.id
                || task.assignee === row.agent.id
                || task.assignee === row.agent.name
                || task.ownerName === row.agent.name
              )
            )) : [];
            const backendOwnedOpenTaskCount = row.openTaskCount
              ?? row.ownedOpenTaskCount
              ?? row.taskCount
              ?? row.ownedTaskCount
              ?? row.tasks?.openCount
              ?? row.tasks?.length
              ?? row.taskIds?.length
              ?? 0;
            const displayOpenTaskCount = agentStatusLocalTasksAllowed ? ownedOpenTasks.length : backendOwnedOpenTaskCount;
            const currentTask = agentStatusLocalTasksAllowed ? ownedOpenTasks[0] || null : null;
            const backendCurrentTaskText = row.currentTaskText
              || row.currentTask?.text
              || row.currentTask?.title
              || row.activeTaskText
              || row.task?.text
              || row.task?.title
              || row.state.currentPlan?.taskText
              || null;
            const statusLabel = row.state.status || row.latestWorker.reason || row.trigger || 'waiting';
            return (
              <div key={`dashboard-agent-status-${row.agent.id}`} data-testid={`dashboard-agent-status-${row.agent.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-serif text-xl leading-tight">{row.agent.name}</div>
                      {row.agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                      <span className={`node-status-tag ${row.state.status === 'blocked' ? 'bg-[#8f1e18] text-white' : row.lastRunAt ? 'bg-[#59684b] text-white' : 'bg-[#b9782b] text-white'}`}>
                        {projectText(statusLabel)}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{row.agent.role}</div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Doing')}</div>
                        <div className="font-serif text-sm leading-tight text-[#4d412d]">{projectText(row.state.currentPlan?.focus || loopRow.focus || backendCurrentTaskText || currentTask?.text || 'Monitoring project lane')}</div>
                      </div>
                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Skill')}</div>
                        <div className="font-serif text-sm leading-tight text-[#4d412d]">{projectText(loopRow.professionalSkill?.label || row.professionalSkill?.label || 'General judgment')}</div>
                      </div>
                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Running')}</div>
                        <div className="font-serif text-sm leading-tight text-[#4d412d]">{projectText(loopRow.routineLabel || row.state.currentPlan?.routine?.label || row.trigger || 'Routine pending')}</div>
                      </div>
                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Next')}</div>
                        <div className="font-serif text-sm leading-tight text-[#4d412d]">{row.nextRunAt ? new Date(row.nextRunAt).toLocaleString() : projectText(row.state.currentPlan?.next || 'Awaiting next pulse')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 lg:w-36">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 text-center">
                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Tasks')}</div>
                        <div className="font-serif text-lg leading-tight">{displayOpenTaskCount}</div>
                      </div>
                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 text-center">
                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Proof')}</div>
                        <div className="font-serif text-lg leading-tight">{(loopRow.timelineIds?.length || 0) + (loopRow.chatIds?.length || 0)}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRunAgentPulse(row.agent.id)}
                      disabled={!backendCommandAvailable || backendStation.loading}
                      className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40"
                    >
                      <Activity size={11} /> {projectText('Pulse')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
