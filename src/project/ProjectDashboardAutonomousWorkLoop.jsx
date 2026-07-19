import React from 'react';

export default function ProjectDashboardAutonomousWorkLoop({ view = {} }) {
  const {
    backendRequired,
    commandDisabled,
    cycles,
    lastRunAt,
    latestSchedulerRecord,
    nextRunAt,
    onRunPulse,
    projectText,
    team,
    title,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Autonomous Work Loop')}</div>
          <div className="font-serif text-xl leading-tight">
            {projectText(title)}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mt-2">
            {projectText('Last run')}: {lastRunAt ? new Date(lastRunAt).toLocaleString() : projectText(backendRequired ? 'backend required' : 'not yet')}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mt-1">
            {projectText('Next run')}: {nextRunAt ? new Date(nextRunAt).toLocaleString() : projectText(backendRequired ? 'backend required' : 'not scheduled')}
          </div>
          {latestSchedulerRecord && (
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
              {projectText(latestSchedulerRecord.trigger)} / {projectText(latestSchedulerRecord.reason)} / {projectText('next')} {latestSchedulerRecord.nextRunAt ? new Date(latestSchedulerRecord.nextRunAt).toLocaleTimeString() : projectText('pending')}
            </div>
          )}
          {backendRequired && (
            <div data-testid="autonomous-work-loop-backend-required" className="mt-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
              {projectText('Backend operations board is required before this real project can show scheduler or autonomous-cycle history.')}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            data-testid="autonomous-work-loop-hour-pulse"
            onClick={() => onRunPulse('hourly')}
            disabled={commandDisabled}
            className="border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {projectText('Hour Pulse')}
          </button>
          <button
            type="button"
            data-testid="autonomous-work-loop-day-report"
            onClick={() => onRunPulse('daily')}
            disabled={commandDisabled}
            className="border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {projectText('Day Report')}
          </button>
        </div>
      </div>
      {cycles.length > 0 && (
        <div className="mt-4 border-t border-[#d8c99f] pt-3 space-y-2">
          {cycles.slice(0, 2).map((cycle, index) => (
            <div key={cycle.id || `autonomous-work-loop-cycle-${index}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                <span>{cycle.cadence || cycle.trigger || 'cycle'} / {cycle.publishedEventCount || 0} published / {cycle.managementEventCount || 0} managed</span>
                <span>{cycle.ranAt ? new Date(cycle.ranAt).toLocaleString() : 'recent'}</span>
              </div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                {cycle.trigger || 'cycle'} / due {cycle.dueAt ? new Date(cycle.dueAt).toLocaleTimeString() : 'now'} / next {cycle.nextRunAt ? new Date(cycle.nextRunAt).toLocaleTimeString() : 'pending'}
              </div>
              {cycle.managementEvents?.slice(0, 3).map((item, index) => {
                const manager = team.find(member => member.id === item.agentId);
                const target = team.find(member => member.id === item.targetAgentId);
                return (
                  <div key={`${cycle.id}-management-${index}`} className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
                    {item.kind}: {manager?.name || item.agentId} {'->'} {target?.name || item.targetAgentId || 'team'} / {item.taskIds?.length || 0} task proof link{(item.taskIds?.length || 0) === 1 ? '' : 's'}
                  </div>
                );
              })}
              {cycle.communicationDiagnostics?.slice(0, 2).map((item, index) => {
                const agent = team.find(member => member.id === item.agentId);
                return (
                  <div key={`${cycle.id}-diag-${index}`} className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                    {agent?.name || item.agentId}: {item.decision} / {item.attentionScore} / {item.explanation}
                  </div>
                );
              })}
              {cycle.agentPlans?.slice(0, 3).map((plan) => {
                const agent = team.find(member => member.id === plan.agentId);
                return (
                  <div key={`${cycle.id}-routine-${plan.agentId}`} className="font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d]">
                    {agent?.name || plan.agentId}: {plan.routineLabel || 'Routine'} / {plan.routineArtifact || 'work evidence'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
