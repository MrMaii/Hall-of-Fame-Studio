import React from 'react';

export default function ProjectDashboardProductTeamMissionRunner({
  view = {},
  onRunHandoffIntent,
  runHandoffIntentDisabled = false,
  onOpenHandoffChatProof,
  handoffChatProofDisabled = false,
  onOpenHandoffTimelineProof,
  handoffTimelineProofDisabled = false,
  onOpenMissionChatProof,
  missionChatProofDisabled = false,
  onOpenMissionTimelineProof,
  missionTimelineProofDisabled = false,
  onOpenMissionFlowNode,
  missionFlowNodeDisabled = false,
}) {
  const {
    MessageSquare,
    Network,
    Play,
    ScrollText,
    activeProject,
    backendLatestProductTeamMissionRun = {},
    backendMissionHandoffExecution,
    backendMissionHandoffExecutionOutputRows = [],
    backendMissionHandoffIntentRow,
    backendProductTeamMissionRows = [],
    backendProductTeamMissionRuns,
    projectText,
  } = view;

  return (
    <div data-testid="backend-product-team-mission-runs-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase text-[#8f1e18]">Product Team Mission Runner</div>
          <div className="font-serif text-base leading-tight break-words">
            {backendLatestProductTeamMissionRun.missionName || backendLatestProductTeamMissionRun.id}
          </div>
          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {backendLatestProductTeamMissionRun.status || 'started'} / Leader {backendLatestProductTeamMissionRun.selectedLeaderId || 'pending'} / Reviewer {backendLatestProductTeamMissionRun.reviewerId || 'pending'}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <span className={`node-status-tag ${backendLatestProductTeamMissionRun.researchOnly ? 'bg-[#8f1e18] text-white' : 'bg-[#59684b] text-white'}`}>
            {backendLatestProductTeamMissionRun.researchOnly ? 'Research Only' : 'Generic Product Team'}
          </span>
          <span className={`node-status-tag ${backendLatestProductTeamMissionRun.reusedKickoffMeeting ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
            {backendLatestProductTeamMissionRun.reusedKickoffMeeting ? 'Reused Kickoff' : 'New Kickoff'}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Runs', backendProductTeamMissionRuns?.count ?? backendProductTeamMissionRows.length ?? 0],
          ['Agents', backendLatestProductTeamMissionRun.agentIds?.length ?? 0],
          ['Tasks', backendLatestProductTeamMissionRun.taskIds?.length ?? 0],
          ['Autopilot', backendLatestProductTeamMissionRun.autonomousSessionId ? 'started' : 'not started'],
          ['Tick', backendLatestProductTeamMissionRun.autonomousSessionTickId ? 'recorded' : 'pending'],
          ['C/A Handoff', backendLatestProductTeamMissionRun.customerAgentHandoff?.status || 'pending'],
          ['Handoff Tick', backendLatestProductTeamMissionRun.customerAgentHandoff?.firstTickRecorded ? 'recorded' : 'pending'],
          ['Handoff Stage', backendLatestProductTeamMissionRun.customerAgentHandoff?.targetStageId || backendLatestProductTeamMissionRun.targetNextMissingStageId || 'delivery trace'],
          ['Run Receipts', backendLatestProductTeamMissionRun.runReceiptIds?.length ?? 0],
          ['Loop Receipts', backendLatestProductTeamMissionRun.loopReceiptIds?.length ?? 0],
          ['Next Stage', backendLatestProductTeamMissionRun.targetNextMissingStageId || backendLatestProductTeamMissionRun.targetStatus || 'delivery trace'],
        ].map(([label, value]) => (
          <div key={`product-team-mission-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-product-team-mission-runs-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
        Mission route: {backendLatestProductTeamMissionRun.routeLabel || `/projects/${activeProject.id}/product-team-missions/${backendLatestProductTeamMissionRun.id}`}
        {' '} / Operating loop: {backendLatestProductTeamMissionRun.readRoutes?.productTeamOperatingLoop || `/projects/${activeProject.id}/product-team-operating-loop`}
        {' '} / Autonomy: {backendLatestProductTeamMissionRun.readRoutes?.autonomousRunControl || `/projects/${activeProject.id}/autonomous-run-control`}
        {' '} / C/A handoff: {backendLatestProductTeamMissionRun.customerAgentHandoff?.nextRoutes?.autonomousRunControl || backendLatestProductTeamMissionRun.readRoutes?.autonomousRunControl || `/projects/${activeProject.id}/autonomous-run-control`}
      </div>
      {backendMissionHandoffExecution && (
        <div data-testid="backend-product-team-mission-handoff-execution" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">A-side handoff execution</div>
              <div className="font-serif text-sm leading-tight break-words">
                {projectText(backendMissionHandoffExecution.status || 'waiting-for-a-side-output')}
              </div>
            </div>
            <span className={`node-status-tag ${backendMissionHandoffExecution.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {backendMissionHandoffExecution.ready ? 'A-side proof' : 'awaiting output'}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ['Run Receipts', backendMissionHandoffExecution.runReceiptIds?.length ?? 0],
              ['Agent Runs', backendMissionHandoffExecution.agentActionRunIds?.length ?? 0],
              ['Submissions', backendMissionHandoffExecution.submissionIds?.length ?? 0],
              ['Messages', backendMissionHandoffExecution.resultMessageIds?.length ?? 0],
            ].map(([label, value]) => (
              <div key={`mission-handoff-execution-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
                <div className="font-mono text-[7px] uppercase text-[#7d6a49]">{label}</div>
                <div className="font-serif text-sm leading-tight break-words">{value}</div>
              </div>
            ))}
          </div>
          {backendMissionHandoffExecution.latestOutput && (
            <div data-testid="backend-product-team-mission-handoff-latest-output" className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
              <div className="font-serif text-sm leading-tight truncate">
                Latest output: {projectText(backendMissionHandoffExecution.latestOutput.title || backendMissionHandoffExecution.latestOutput.artifactType || backendMissionHandoffExecution.latestOutput.id)}
              </div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                {projectText(backendMissionHandoffExecution.latestOutput.artifactType || 'artifact')} / {projectText(backendMissionHandoffExecution.latestOutput.status || 'submitted')}
              </div>
            </div>
          )}
          {backendMissionHandoffExecutionOutputRows.length > 1 && (
            <div data-testid="backend-product-team-mission-handoff-output-rows" className="mt-2 grid gap-1 md:grid-cols-2">
              {backendMissionHandoffExecutionOutputRows.slice(0, 4).map((row) => (
                <div key={`mission-handoff-output-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
                  <div className="font-serif text-sm leading-tight truncate">{projectText(row.title || row.artifactType || row.id)}</div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{projectText(row.artifactType || 'artifact')} / {projectText(row.agentId || row.agentName || 'agent')}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="backend-product-team-mission-run-handoff-intent"
              onClick={onRunHandoffIntent}
              disabled={runHandoffIntentDisabled}
              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={10} /> Run C/A handoff
            </button>
            <button
              type="button"
              data-testid="backend-product-team-mission-handoff-chat-proof"
              onClick={onOpenHandoffChatProof}
              disabled={handoffChatProofDisabled}
              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MessageSquare size={10} /> Handoff chat proof
            </button>
            <button
              type="button"
              data-testid="backend-product-team-mission-handoff-timeline-proof"
              onClick={onOpenHandoffTimelineProof}
              disabled={handoffTimelineProofDisabled}
              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ScrollText size={10} /> Handoff timeline proof
            </button>
          </div>
          <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#59684b] leading-relaxed break-words">
            Run route: {backendMissionHandoffExecution.runApiPath || backendMissionHandoffIntentRow?.runIntentApiPath || '/projects/:id/collaboration-intent-queue/customer-agent-handoff-intent/run'}
            {' '} / Operating loop: {backendMissionHandoffExecution.route || `/projects/${activeProject.id}/product-team-operating-loop`}
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="backend-product-team-mission-chat-proof"
          onClick={onOpenMissionChatProof}
          disabled={missionChatProofDisabled}
          className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MessageSquare size={10} /> Mission chat proof
        </button>
        <button
          type="button"
          data-testid="backend-product-team-mission-timeline-proof"
          onClick={onOpenMissionTimelineProof}
          disabled={missionTimelineProofDisabled}
          className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ScrollText size={10} /> Mission timeline proof
        </button>
        <button
          type="button"
          data-testid="backend-product-team-mission-flow-node"
          onClick={onOpenMissionFlowNode}
          disabled={missionFlowNodeDisabled}
          className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Network size={10} /> Flow node
        </button>
      </div>
      {backendProductTeamMissionRows.length > 1 && (
        <div className="mt-2 space-y-1">
          {backendProductTeamMissionRows.slice(1, 4).map(row => (
            <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
              <div className="min-w-0">
                <div className="font-serif text-sm leading-tight truncate">{row.missionName || row.id}</div>
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.status || 'started'} / {row.missionType || 'generic-product-team'}</div>
              </div>
              <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.autonomousSessionId ? 'Autopilot' : 'Kickoff'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
