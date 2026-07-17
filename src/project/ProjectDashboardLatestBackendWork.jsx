export default function ProjectDashboardLatestBackendWork({
  backendLatestAgentsProcessed,
  backendLatestAutopilotProcessed,
  backendLatestResult,
  backendLatestTriggerText,
  projectText,
}) {
  return (
    <div data-testid="backend-last-result" className="mt-3 border-t border-[#d8c99f] pt-3">
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Latest Backend Work')}</div>
      <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
        HTTP-AUTONOMOUS-SCHEDULER-STARTUP-AGENTS / MANAGER-UI-SCHEDULER-START-PULSE{backendLatestTriggerText ? ` / ${backendLatestTriggerText}` : ''}
      </div>
      <div className="grid md:grid-cols-4 gap-2">
        <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Projects')}</div>
          <div className="font-serif text-base leading-tight">
            {projectText((backendLatestResult.processed || []).map(item => item.projectId).slice(0, 2).join(' / ') || 'none due')}
          </div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Agents')}</div>
          <div className="font-serif text-base leading-tight">
            {projectText(backendLatestAgentsProcessed.map(item => [item.agentId, item.result?.cycle?.trigger || item.project?.agentWorkerLedger?.[0]?.trigger || item.managerDashboard?.operationsBoard?.agents?.find(agent => agent.agentId === item.agentId)?.trigger || item.trigger].filter(Boolean).join(' / ')).slice(0, 3).join(' / ') || 'none due')}
          </div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Autopilot')}</div>
          <div className="font-serif text-base leading-tight">
            {projectText(backendLatestAutopilotProcessed.map(item => [item.sessionId, item.tickId || item.autonomousRunControlSessionTick?.id, item.targetStageId || item.autonomousRunControlSessionTick?.targetControl?.targetStageId, item.providerEvidenceSearch?.status || item.autonomousRunControlSessionTick?.providerEvidenceSearch?.status].filter(Boolean).join(' / ')).slice(0, 2).join(' / ') || 'none due')}
          </div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Worker Messages')}</div>
          <div className="font-serif text-base leading-tight">{backendLatestResult.messageCount ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
