import React from 'react';
import { Activity, CornerDownRight, MessageSquare, Play } from 'lucide-react';

export default function ProjectDashboardManagerCommandCenters({ view = {} }) {
  const {
    activeProject,
    backendCommandAvailable = false,
    backendManagerCommandCenterRunReceipt,
    backendStation = {},
    backendWorkerStationSyncDisabled = false,
    chatProofIdsFromIds,
    chatProofIdsFromRow,
    managerCommandCenter = {},
    managerProofMap = {},
    managerReadModelSourceBadge,
    openManagerCommandAttentionRow,
    openProjectChatProof,
    openProjectTimelineProof,
    projectText,
    runManagerCommandCenterNext,
    scenarioControlSteps = [],
    sceneTransition,
    syncBackendManagerCommandCenter,
  } = view;

  return (
    <>
              <div data-testid="scenario-control-center" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Scenario Control Center')}</div>
                    <div className="font-serif text-2xl leading-tight">{projectText('Kickoff to 24/7 execution, management sync, change intake, and proof exit.')}</div>
                  </div>
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{projectText(managerProofMap.status)}</span>
                </div>
                <div className="space-y-2">
                  {scenarioControlSteps.map((step, index) => (
                    <div key={`scenario-control-${step.id}`} data-testid={`scenario-control-step-${step.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#7b6542] bg-[#251b13] font-mono text-[10px] text-[#efe2bd]">
                            {index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-serif text-lg leading-tight">{projectText(step.title)}</span>
                            <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">{projectText(step.status)} / {projectText(step.proof)}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid={`scenario-control-action-${step.id}`}
                          onClick={step.action}
                          disabled={Boolean(step.disabled) || Boolean(sceneTransition)}
                          className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Activity size={10} /> {projectText(step.actionLabel)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="manager-live-command-center" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Manager Live Command Center')}</div>
                    <div className="font-serif text-2xl leading-tight">{projectText(managerCommandCenter.headline)}</div>
                    <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                      {projectText('Next best action')}: {projectText(managerCommandCenter.nextBestActionLabel || 'Keep monitoring live operations')}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {managerReadModelSourceBadge(managerCommandCenter, 'manager-command-center-source')}
                    <span className={`node-status-tag ${managerCommandCenter.status === 'live' ? 'bg-green-700 text-white' : managerCommandCenter.status === 'action-ready' ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#b9782b] text-white'}`}>
                      {projectText(managerCommandCenter.status)}
                    </span>
                    <button
                      type="button"
                      data-testid="manager-command-run-next"
                      onClick={() => runManagerCommandCenterNext()}
                      disabled={!backendCommandAvailable || backendStation.loading || !managerCommandCenter.nextBestAction?.canRun}
                      className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play size={10} /> {projectText('Run next')}
                    </button>
                  </div>
                </div>
                {backendManagerCommandCenterRunReceipt && (
                  <div data-testid="manager-command-run-receipt" className="mb-4 border border-[#7b6542] bg-[#efe2bd]/70 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
                    Command Center run: {backendManagerCommandCenterRunReceipt.actionLabel || backendManagerCommandCenterRunReceipt.requirementId} / {backendManagerCommandCenterRunReceipt.delegatedRunApiPath || 'delegated action'} / messages {(backendManagerCommandCenterRunReceipt.resultMessageIds || []).length} / timeline {(backendManagerCommandCenterRunReceipt.timelineLogIds || []).length}
                    <button
                      type="button"
                      data-testid="manager-command-run-proof"
                      onClick={() => openProjectTimelineProof(backendManagerCommandCenterRunReceipt.timelineLogIds || [])}
                      disabled={!(backendManagerCommandCenterRunReceipt.timelineLogIds || []).length}
                      className="mt-2 inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CornerDownRight size={10} /> Command run proof
                    </button>
                  </div>
                )}
                {managerCommandCenter.frontendMockSuppressed && (
                  <div data-testid="manager-command-center-backend-required" className="mb-4 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
                    Backend Manager Command Center is required for this real project. Local command rows are suppressed until /manager-command-center returns manager-command-center/v1.
                    <button
                      type="button"
                      data-testid="manager-command-center-sync-read-model"
                      onClick={() => syncBackendManagerCommandCenter({ silent: false, projectId: activeProject.id })}
                      disabled={backendWorkerStationSyncDisabled}
                      className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Activity size={10} /> Sync Command
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {[
                    ['Scenario', managerCommandCenter.stats?.scenarioTrail || '0/0'],
                    ['Protocols', managerCommandCenter.stats?.syncProtocols || '0/0'],
                    ['Agents Scheduled', managerCommandCenter.stats?.agentsScheduled || '0/0'],
                    ['Attention', managerCommandCenter.attentionCount || 0],
                  ].map(([label, value]) => (
                    <div key={`manager-command-stat-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
                      <div className="font-serif text-base leading-tight break-words">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 xl:grid-cols-5 mb-4">
                  {(managerCommandCenter.liveLanes || []).map(lane => (
                    <div key={`manager-command-lane-${lane.id}`} data-testid={`manager-command-lane-${lane.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-serif text-base leading-tight">{projectText(lane.label)}</div>
                        <span className={`node-status-tag ${lane.status === 'active' || lane.status === 'ready' ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                          {projectText(lane.status)}
                        </span>
                      </div>
                      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">{projectText(lane.detail)}</div>
                      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">{projectText('Proof')} {lane.proofCount || 0}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 xl:grid-cols-3 2xl:grid-cols-6">
                  <div data-testid="manager-command-kickoff-board" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Kickoff Decision Board')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Brief, roles, Leader election, roster, and next actions')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.kickoffBoard?.readyCount || 0}/{managerCommandCenter.kickoffBoard?.count || 0} {projectText('ready')}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.kickoffBoard?.rows || []).map(row => (
                        <div key={`manager-command-kickoff-${row.id}`} data-testid={`manager-command-kickoff-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.label)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.detail)}</div>
                            </div>
                            <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                              {projectText(row.passed ? 'ready' : 'pending')}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-kickoff-proof-${row.id}`}
                              onClick={() => (row.timelineLogIds || []).length ? openProjectTimelineProof(row.timelineLogIds || []) : openProjectChatProof(activeProject, chatProofIdsFromRow(row), 'main')}
                              disabled={!((row.timelineLogIds || []).length || chatProofIdsFromRow(row).length)}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Kickoff proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div data-testid="manager-command-work-loop-board" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Work Loop Board')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('24/7 schedules, routines, first pulse, and proof')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.workLoopBoard?.runningCount || 0}/{managerCommandCenter.workLoopBoard?.count || 0} {projectText('running')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      <span>{projectText('Scheduled')} {managerCommandCenter.workLoopBoard?.scheduledCount || 0}</span>
                      <span>{projectText('Proofed')} {managerCommandCenter.workLoopBoard?.proofedCount || 0}</span>
                      <span>{projectText('Routines')} {managerCommandCenter.workLoopBoard?.routineCount || 0}</span>
                      <span>{projectText('Timeline')} {managerCommandCenter.workLoopBoard?.timelineProofCount || 0}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.workLoopBoard?.rows || []).slice(0, 5).map(row => (
                        <div key={`manager-command-work-loop-${row.agentId}`} data-testid={`manager-command-work-loop-${row.agentId}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{row.name}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.routineLabel || 'fixed routine')} / {projectText(row.focus || row.loopState)}</div>
                            </div>
                            <span className={`node-status-tag ${row.status === 'running' ? 'bg-green-700 text-white' : row.status === 'scheduled' ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#b9782b] text-white'}`}>
                              {projectText(row.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`node-status-tag ${row.scheduled ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Scheduled')}</span>
                            <span className={`node-status-tag ${row.routineReady ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Routine')}</span>
                            <span className={`node-status-tag ${row.firstPulseReady ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('First Pulse')}</span>
                            <span className={`node-status-tag ${row.timelineReady ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Timeline')}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            <span>{projectText('Next')} {row.nextRunAt ? new Date(row.nextRunAt).toLocaleTimeString() : projectText('none')}</span>
                            <span>{projectText('Last')} {row.lastRunAt ? new Date(row.lastRunAt).toLocaleTimeString() : projectText('none')}</span>
                          </div>
                          <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                            {projectText('Next step')}: {projectText(row.nextStep || 'publish the next proof marker')}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-work-loop-chat-proof-${row.agentId}`}
                              onClick={() => openProjectChatProof(activeProject, row.chatProofIds || [], 'main')}
                              disabled={!(row.chatProofIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Loop chat')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-work-loop-proof-${row.agentId}`}
                              onClick={() => openProjectTimelineProof(row.timelineLogIds || [])}
                              disabled={!(row.timelineLogIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Loop proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div data-testid="manager-command-collaboration-board" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Collaboration Board')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Leader @assignments, Agent messages, handoffs, and mutual management')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.collaborationBoard?.readyCount || 0}/{managerCommandCenter.collaborationBoard?.count || 0} {projectText('synced')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      <span>{projectText('Assignments')} {managerCommandCenter.collaborationBoard?.assignmentCount || 0}</span>
                      <span>{projectText('Messages')} {managerCommandCenter.collaborationBoard?.agentMessageCount || 0}</span>
                      <span>{projectText('Delivered')} {managerCommandCenter.collaborationBoard?.deliveredMessageCount || 0}</span>
                      <span>{projectText('Peer links')} {managerCommandCenter.collaborationBoard?.managementLinkCount || 0}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.collaborationBoard?.rows || []).map(row => (
                        <div key={`manager-command-collaboration-${row.id}`} data-testid={`manager-command-collaboration-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.label)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.detail)}</div>
                            </div>
                            <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : row.status === 'waiting' ? 'bg-[#b9782b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
                              {projectText(row.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-collaboration-chat-proof-${row.id}`}
                              onClick={() => openProjectChatProof(activeProject, chatProofIdsFromRow(row), 'main')}
                              disabled={!chatProofIdsFromRow(row).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Collaboration chat')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-collaboration-proof-${row.id}`}
                              onClick={() => openProjectTimelineProof(row.timelineLogIds || [])}
                              disabled={!(row.timelineLogIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Collaboration proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div data-testid="manager-command-change-protocol-board" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Change Protocol Board')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Meeting plus Google Chat, discussion, owner plan, and team resync')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.changeProtocolBoard?.readyCount || 0}/{managerCommandCenter.changeProtocolBoard?.count || 0} {projectText('ready')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      <span>{projectText('Dual')} {managerCommandCenter.changeProtocolBoard?.dualChannelCount || 0}</span>
                      <span>{projectText('Sources')} {managerCommandCenter.changeProtocolBoard?.sourceReadyCount || 0}</span>
                      <span>{projectText('Plans')} {managerCommandCenter.changeProtocolBoard?.ownerPlanCount || 0}</span>
                      <span>{projectText('Syncs')} {managerCommandCenter.changeProtocolBoard?.teamSyncCount || 0}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.changeProtocolBoard?.rows || []).map(row => (
                        <div key={`manager-command-change-protocol-${row.id}`} data-testid={`manager-command-change-protocol-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.label)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.detail)}</div>
                            </div>
                            <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : row.status === 'waiting' ? 'bg-[#b9782b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
                              {projectText(row.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-change-protocol-chat-proof-${row.id}`}
                              onClick={() => openProjectChatProof(activeProject, chatProofIdsFromRow(row), row.channelId || 'main')}
                              disabled={!chatProofIdsFromRow(row).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Change protocol chat')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-change-protocol-proof-${row.id}`}
                              onClick={() => openProjectTimelineProof(row.timelineLogIds || [])}
                              disabled={!(row.timelineLogIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Change protocol proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Attention Queue')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('What needs manager eyes now')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.criticalCount || 0} {projectText('critical')}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.attentionRows || []).slice(0, 5).map(row => (
                        <div key={`manager-command-attention-${row.id}`} data-testid={`manager-command-attention-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.title)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.detail)}</div>
                            </div>
                            <span className={`node-status-tag ${row.severity === 'critical' ? 'bg-[#8f1e18] text-white' : row.severity === 'action' ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#b9782b] text-white'}`}>
                              {projectText(row.severity)}
                            </span>
                          </div>
                          <button
                            type="button"
                            data-testid={`manager-command-attention-open-${row.id}`}
                            onClick={() => openManagerCommandAttentionRow(row)}
                            className="mt-2 inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13]"
                          >
                            <CornerDownRight size={10} /> {projectText('Open')}
                          </button>
                        </div>
                      ))}
                      {!(managerCommandCenter.attentionRows || []).length && (
                        <div className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          {projectText('No command attention rows.')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div data-testid="manager-command-change-sync" className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Change Owner Sync')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Owner confirmation, plan, team sync, and first work')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerCommandCenter.changeReadyCount || 0}/{(managerCommandCenter.changeRows || []).length} {projectText('synced')}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.changeRows || []).slice(0, 4).map(row => (
                        <div key={`manager-command-change-${row.changeId}`} data-testid={`manager-command-change-${row.changeId}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{projectText(row.requestText)}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                                {projectText('Owner')} {row.ownerName} / {row.passedCount || 0}-{row.totalCount || 0} {projectText('checks')} / {projectText(row.status)}
                              </div>
                            </div>
                            <span className={`node-status-tag ${row.status === 'synced' ? 'bg-green-700 text-white' : row.status === 'waiting' ? 'bg-[#b9782b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
                              {projectText(row.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`node-status-tag ${row.sourceReady ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Source')}</span>
                            <span className={`node-status-tag ${row.discussed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Discussion')}</span>
                            <span className={`node-status-tag ${row.ownerConfirmed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Owner Confirmed')}</span>
                            <span className={`node-status-tag ${row.ownerPlanLinked ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Plan Updated')}</span>
                            <span className={`node-status-tag ${row.teamSynced ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Team Synced')}</span>
                            <span className={`node-status-tag ${row.ownerWorkStarted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Owner Work')}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            <span>{projectText('Discussion')} {row.discussionCount || 0}</span>
                            <span>{projectText('Team')} {row.teamSyncCount || 0}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-change-proof-${row.changeId}`}
                              onClick={() => openProjectChatProof(activeProject, chatProofIdsFromRow(row), row.sourceChannelId === 'google_chat' ? 'google_chat' : 'main')}
                              disabled={!chatProofIdsFromRow(row).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Change proof')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-change-timeline-proof-${row.changeId}`}
                              onClick={() => openProjectTimelineProof(row.timelineLogIds || [])}
                              disabled={!(row.timelineLogIds || []).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Timeline proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                      {!(managerCommandCenter.changeRows || []).length && (
                        <div className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          {projectText('No change requests yet.')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Agent Readiness')}</div>
                        <div className="font-serif text-lg leading-tight">{projectText('Routines, obligations, and next runs')}</div>
                      </div>
                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{(managerCommandCenter.agentRows || []).filter(row => row.needsAttention).length} {projectText('watch')}</span>
                    </div>
                    <div className="space-y-2">
                      {(managerCommandCenter.agentRows || []).slice(0, 5).map(row => (
                        <div key={`manager-command-agent-${row.agentId}`} data-testid={`manager-command-agent-${row.agentId}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-serif text-base leading-tight">{row.name}</div>
                              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(row.routineLabel || 'fixed routine')} / {projectText(row.focus || row.status)}</div>
                            </div>
                            <span className={`node-status-tag ${row.needsAttention ? 'bg-[#b9782b] text-white' : 'bg-green-700 text-white'}`}>
                              {projectText(row.needsAttention ? 'watch' : 'ready')}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`node-status-tag ${row.receivedLatestSignal ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Receipt')}</span>
                            <span className={`node-status-tag ${row.obligatedLatestSignal ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Obligation')}</span>
                            <span className={`node-status-tag ${row.workingLatestSignal ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{projectText('Work Started')}</span>
                          </div>
                          <div className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/60 p-2">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Latest @Signal')}</div>
                            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                              {projectText(row.latestInbox?.text || row.latestInbox?.source || 'No direct signal yet')}
                            </div>
                          </div>
                          <div className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/60 p-2">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Latest Work')}</div>
                            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                              {projectText(row.latestWorklog?.text || row.latestWorklog?.source || 'No work pulse yet')}
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            <span>{projectText('Open')} {row.openObligationCount || 0}</span>
                            <span>{projectText('Next')} {row.nextRunAt ? new Date(row.nextRunAt).toLocaleTimeString() : projectText('none')}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`manager-command-agent-inbox-proof-${row.agentId}`}
                              onClick={() => openProjectChatProof(activeProject, chatProofIdsFromIds([...(row.inboxProofIds || []), ...(row.obligationProofIds || [])]), row.latestInbox?.channelId || row.latestInbox?.sourceChannelId || 'main')}
                              disabled={!chatProofIdsFromIds([...(row.inboxProofIds || []), ...(row.obligationProofIds || [])]).length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> {projectText('Signal proof')}
                            </button>
                            <button
                              type="button"
                              data-testid={`manager-command-agent-work-proof-${row.agentId}`}
                              onClick={() => (row.timelineLogIds || []).length ? openProjectTimelineProof(row.timelineLogIds || []) : openProjectChatProof(activeProject, chatProofIdsFromIds(row.workProofIds || []), row.latestWorklog?.channelId || row.latestWorklog?.sourceChannelId || 'main')}
                              disabled={!((row.timelineLogIds || []).length || chatProofIdsFromIds(row.workProofIds || []).length)}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CornerDownRight size={10} /> {projectText('Work proof')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
    </>
  );
}

