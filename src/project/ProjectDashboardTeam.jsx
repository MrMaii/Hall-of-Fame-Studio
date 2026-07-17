import React from 'react';
import {
  Activity,
  FileText,
  MessageSquare,
  RefreshCw,
  ScrollText,
  Search,
  Send,
  Sparkles,
  UserCircle,
} from 'lucide-react';

export default function ProjectDashboardTeam({ view = {} }) {
  const {
    AGENT_WORKBENCH_ARTIFACT_TYPES = [],
    activeProject,
    agentDashboardSnapshotFor,
    agentMessageDraftFor,
    agentNameById = {},
    agentStates = {},
    agentWorkDraftFor,
    agentWorkbenchRevisionDefaults,
    backendCommandAvailable = false,
    backendStation = {},
    isManagerDemoProject,
    latestAgentWorkerById = {},
    openProjectChatProof,
    openProjectTimelineProof,
    runBackendAgentArtifactDraft,
    runBackendAgentArtifactSubmission,
    runBackendAgentEvidenceSearch,
    runBackendAgentMessage,
    runBackendAgentPulse,
    selectedAgentFocusId,
    setSelectedAgentFocusId,
    shouldRequireBackendAgentDashboard,
    syncBackendAgentDashboard,
    taskEvidence,
    updateAgentMessageDraft,
    updateAgentWorkDraft,
  } = view;

  return (
                <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Team</div>
                    <div className="space-y-3">
                    {activeProject.team.map(agent => {
                      const state = agentStates[agent.id] || null;
                      const latestAgentWorker = latestAgentWorkerById[agent.id] || null;
                      const agentBackendDashboard = agentDashboardSnapshotFor(agent.id, activeProject?.id);
                      const backendAgentDashboardRequired = shouldRequireBackendAgentDashboard(activeProject);
                      const backendAgentDashboardMissing = backendAgentDashboardRequired && !agentBackendDashboard;
                      const agentDashboardSourceLabel = backendAgentDashboardMissing
                        ? 'backend-required'
                        : agentBackendDashboard
                          ? 'backend-backed'
                          : isManagerDemoProject(activeProject)
                            ? 'sample-fixture'
                            : 'frontend-fallback';
                      const agentSignalUsesBackendDashboard = Boolean(agentBackendDashboard);
                      const localAgentSignalProofAllowed = !backendAgentDashboardRequired;
                      const signalState = agentSignalUsesBackendDashboard ? agentBackendDashboard.state || {} : state || {};
                      const agentTeamDisplayState = agentSignalUsesBackendDashboard
                        ? agentBackendDashboard.state || null
                        : localAgentSignalProofAllowed ? state : null;
                      const displayLatestAgentWorker = agentSignalUsesBackendDashboard
                        ? agentBackendDashboard.latestWorker || null
                        : localAgentSignalProofAllowed ? latestAgentWorker : null;
                      const latestAgentWorkerManagementPriority = latestAgentWorker ? latestAgentWorker.managementPriority : null;
                      const displayAgentWorkerManagementPriority = displayLatestAgentWorker?.managementPriority ?? latestAgentWorkerManagementPriority ?? 0;
                      const priorityReasons = displayLatestAgentWorker?.managementReasons || displayLatestAgentWorker?.priorityReasons || [];
                      const latestInbox = agentSignalUsesBackendDashboard
                        ? agentBackendDashboard.latestInbox || agentBackendDashboard.inbox?.[0] || null
                        : localAgentSignalProofAllowed ? state?.inbox?.[0] || null : null;
                      const latestObligation = agentSignalUsesBackendDashboard
                        ? agentBackendDashboard.latestObligation
                          || agentBackendDashboard.obligations?.find(item => item.status !== 'done' && item.status !== 'resolved')
                          || agentBackendDashboard.obligations?.[0]
                          || null
                        : localAgentSignalProofAllowed ? state?.obligations?.find(item => item.status !== 'done' && item.status !== 'resolved') || state?.obligations?.[0] || null : null;
                      const latestWorklog = agentSignalUsesBackendDashboard
                        ? agentBackendDashboard.latestWorklog || agentBackendDashboard.worklog?.[0] || null
                        : localAgentSignalProofAllowed ? state?.worklog?.[0] || null : null;
                      const proofSignalAllowed = agentSignalUsesBackendDashboard || localAgentSignalProofAllowed;
                      const localAgentOwnedTasks = activeProject.tasks.filter(task => (
                        task.ownerId === agent.id
                        || task.assignee === agent.id
                        || task.assignee === agent.name
                        || task.ownerName === agent.name
                        || (state?.taskIds || []).map(String).includes(String(task.id))
                      ));
                      const agentOwnedTasks = agentSignalUsesBackendDashboard && Array.isArray(agentBackendDashboard.ownedTasks)
                        ? agentBackendDashboard.ownedTasks
                        : localAgentSignalProofAllowed ? localAgentOwnedTasks : [];
                      const agentDashboardTaskFor = (taskId) => {
                        if (!taskId) return null;
                        const dashboardTask = agentOwnedTasks.find(task => String(task.id) === String(taskId));
                        if (dashboardTask) return dashboardTask;
                        return localAgentSignalProofAllowed
                          ? activeProject.tasks.find(task => String(task.id) === String(taskId)) || null
                          : null;
                      };
                      const obligationTask = agentDashboardTaskFor(latestObligation?.taskId);
                      const worklogTaskId = latestWorklog?.taskId || signalState.currentPlan?.taskId || signalState.taskIds?.[0] || null;
                      const worklogTask = agentDashboardTaskFor(worklogTaskId);
                      const inboxProofIds = proofSignalAllowed ? [latestInbox?.sourceMessageId || latestInbox?.messageId].filter(Boolean) : [];
                      const inboxProofChannel = latestInbox?.channelId || latestInbox?.sourceChannelId || 'main';
                      const obligationEvidence = obligationTask ? taskEvidence(obligationTask) : null;
                      const obligationProofIds = proofSignalAllowed ? [
                        latestObligation?.sourceMessageId,
                        ...(obligationEvidence?.chatIds || []),
                      ].filter(Boolean) : [];
                      const obligationTimelineIds = proofSignalAllowed ? obligationEvidence?.timelineIds || [] : [];
                      const obligationProofChannel = latestObligation?.channelId
                        || latestObligation?.sourceChannelId
                        || (agentSignalUsesBackendDashboard ? null : obligationTask?.sourceChannelId)
                        || 'main';
                      const worklogEvidence = worklogTask ? taskEvidence(worklogTask) : null;
                      const worklogProofIds = proofSignalAllowed ? [
                        latestWorklog?.sourceMessageId,
                        ...(worklogEvidence?.chatIds || []),
                      ].filter(Boolean) : [];
                      const proofLatestAgentWorker = agentSignalUsesBackendDashboard ? agentBackendDashboard.latestWorker || null : latestAgentWorker;
                      const worklogTimelineIds = proofSignalAllowed ? [
                        proofLatestAgentWorker?.agentId === agent.id
                          ? proofLatestAgentWorker?.logId
                          : null,
                        ...(worklogEvidence?.timelineIds || []),
                      ].filter(Boolean) : [];
                      const worklogProofChannel = latestWorklog?.channelId
                        || (agentSignalUsesBackendDashboard ? proofLatestAgentWorker?.channelId : worklogTask?.sourceChannelId || latestAgentWorker?.channelId)
                        || 'main';
                      const messageTargetOptions = activeProject.team.filter(member => member.id !== agent.id);
                      const agentMessageDraft = agentMessageDraftFor(agent.id, activeProject?.id);
                      const agentWorkDraft = agentWorkDraftFor(agent.id, activeProject?.id);
                      const selectedMessageTarget = agentMessageDraft.targetAgentId || messageTargetOptions[0]?.id || '';
                      const agentFocusState = agentSignalUsesBackendDashboard
                        ? agentBackendDashboard.state || {}
                        : localAgentSignalProofAllowed ? state || {} : {};
                      const agentFocusStatusLabel = backendAgentDashboardMissing ? 'backend required' : agentFocusState.status || 'monitoring';
                      const agentFocusStatusClass = backendAgentDashboardMissing ? 'bg-[#8f1e18] text-white' : 'bg-[#251b13] text-[#efe2bd]';
                      const agentFocusCurrentPlan = backendAgentDashboardMissing
                        ? 'backend required'
                        : agentFocusState.currentPlan?.focus || 'monitor project lane';
                      const agentFocusInboxCount = backendAgentDashboardMissing
                        ? 'backend required'
                        : agentSignalUsesBackendDashboard
                          ? agentBackendDashboard.inbox?.length ?? agentBackendDashboard.openInboxCount ?? 0
                          : state?.inbox?.length || 0;
                      const agentFocusObligationCount = backendAgentDashboardMissing
                        ? 'backend required'
                        : agentSignalUsesBackendDashboard
                          ? agentBackendDashboard.obligations?.length ?? agentBackendDashboard.openObligationCount ?? 0
                          : state?.obligations?.length || 0;
                      const agentFocusOwnedTaskCount = backendAgentDashboardMissing ? 'backend required' : agentOwnedTasks.length;
                      const agentProofChatIds = [
                        ...inboxProofIds,
                        ...obligationProofIds,
                        ...worklogProofIds,
                        ...(proofSignalAllowed ? agentOwnedTasks.flatMap(task => taskEvidence(task).chatIds) : []),
                      ].filter(Boolean);
                      const agentProofTimelineIds = [
                        ...obligationTimelineIds,
                        ...worklogTimelineIds,
                        ...(proofSignalAllowed ? agentOwnedTasks.flatMap(task => taskEvidence(task).timelineIds) : []),
                      ].filter(Boolean);
                      const agentFocusOpen = selectedAgentFocusId === agent.id;
                      const agentBackendRunReceipt = agentBackendDashboard?.autonomousRunControlRuns?.latestRun || null;
                      const workbenchBackendContextMissing = backendAgentDashboardRequired && !agentBackendDashboard;
                      const localWorkbenchOptionsAllowed = !backendAgentDashboardRequired;
                      const workbenchTaskOptions = agentBackendDashboard
                        ? agentBackendDashboard.ownedTasks || []
                        : localWorkbenchOptionsAllowed ? (agentOwnedTasks.length ? agentOwnedTasks : activeProject.tasks.slice(0, 6)) : [];
                      const selectedWorkbenchTaskId = workbenchTaskOptions.some(task => String(task.id) === String(agentWorkDraft.taskId))
                        ? agentWorkDraft.taskId
                        : workbenchTaskOptions[0]?.id || '';
                      const selectedWorkbenchArtifactType = agentWorkDraft.artifactType || 'discovery-report';
                      const workbenchRevisionDefaults = agentWorkbenchRevisionDefaults(agent.id, agentWorkDraft, selectedWorkbenchArtifactType);
                      const workbenchReviewOptions = workbenchRevisionDefaults.reviewOptions;
                      const workbenchSubmissionOptions = workbenchRevisionDefaults.submissionOptions;
                      const selectedWorkbenchReviewId = workbenchRevisionDefaults.selectedReviewId || '';
                      const selectedWorkbenchRevisesSubmissionId = workbenchRevisionDefaults.selectedRevisesSubmissionId || '';
                      const latestWorkbenchReceipt = agentWorkDraft.lastReceipt || null;
                      const latestWorkbenchReceiptFailed = latestWorkbenchReceipt?.status === 'failed'
                        || latestWorkbenchReceipt?.localProofCreated === false;
                      const workbenchWriteDisabled = !backendCommandAvailable || backendStation.loading || workbenchBackendContextMissing;
                      const localFocusState = localAgentSignalProofAllowed ? state || {} : {};
                      const focusManagerIds = Array.from(new Set([localFocusState?.managerId, ...(localFocusState?.peerManagerIds || [])].filter(Boolean)));
                      const focusManagedIds = Array.from(new Set([...(localFocusState?.managedIds || agent.managedIds || []), ...(localFocusState?.peerManagedIds || [])].filter(Boolean)));
                      const backendFocusManagerNames = agentBackendDashboard?.management?.managerNames || [];
                      const backendFocusManagedNames = [
                        ...(agentBackendDashboard?.management?.managedNames || []),
                        ...(agentBackendDashboard?.management?.peerManagedNames || []),
                      ];
                      const focusManagementUsesBackend = Boolean(agentBackendDashboard);
                      const focusManagerNames = focusManagementUsesBackend
                        ? backendFocusManagerNames
                        : focusManagerIds.map(id => agentNameById[id] || id).filter(Boolean);
                      const focusManagedNames = focusManagementUsesBackend
                        ? Array.from(new Set(backendFocusManagedNames))
                        : focusManagedIds.map(id => agentNameById[id] || id).filter(Boolean);
                      const focusPeerManagedCount = focusManagementUsesBackend
                        ? agentBackendDashboard?.management?.peerManagedCount ?? agentBackendDashboard?.management?.peerManagedNames?.length ?? 0
                        : (localFocusState?.peerManagedIds || []).length;
                      const focusPeerManagerCount = focusManagementUsesBackend
                        ? agentBackendDashboard?.management?.peerManagerCount ?? agentBackendDashboard?.management?.managerNames?.length ?? 0
                        : (localFocusState?.peerManagerIds || []).length;
                      const localAgentManagementProofIdsAllowed = !backendAgentDashboardRequired;
                      const agentManagementProofIds = agentBackendDashboard?.proof?.managementProofLogIds?.length
                        ? agentBackendDashboard.proof.managementProofLogIds
                        : localAgentManagementProofIdsAllowed ? (activeProject.logs || [])
                          .filter(log => (
                            ['management-check-in', 'peer-management-check-in', 'review-sweep', 'management-response'].includes(log.eventType)
                            && (log.agentId === agent.id || log.targetAgentId === agent.id || log.agent === agent.name)
                          ))
                          .map(log => log.id)
                          .filter(Boolean)
                          : [];
                      const localOwnedTaskFallbackRows = localAgentSignalProofAllowed
                        ? [{ id: `${agent.id}_monitor`, text: state?.currentPlan?.next || 'Monitor project lane and publish useful progress', status: 'monitoring' }]
                        : [];
                      const agentOwnedTaskEvidenceRows = agentOwnedTasks.length ? agentOwnedTasks : localOwnedTaskFallbackRows;
                      const agentStatusDotClass = backendAgentDashboardMissing
                        ? 'bg-[#8f1e18]'
                        : agentTeamDisplayState?.status === 'blocked'
                          ? 'bg-[#8f1e18]'
                          : agentTeamDisplayState
                            ? 'bg-green-700'
                            : 'bg-[#b9782b]';
                      return (
                      <div key={agent.id} className="flex flex-col gap-3 border-b border-[#d8c99f] pb-2">
                        <div className="min-w-0 w-full">
                          <div className="flex items-center gap-2">
                            <div className="font-serif text-lg">{agent.name}</div>
                            {agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                          </div>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                          {backendAgentDashboardMissing && (
                            <div data-testid={`agent-team-dashboard-required-${agent.id}`} className="mt-2 border border-[#8f1e18] bg-red-50 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
                              Backend Agent Dashboard required before showing confirmed Agent state.
                            </div>
                          )}
                          {agentTeamDisplayState && (
                            <div className="mt-2 space-y-1">
                              <div className="flex flex-wrap gap-1.5">
                                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{agentTeamDisplayState.status || 'synced'}</span>
                                {agentTeamDisplayState.managerId && <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">Managed by {activeProject.team.find(item => item.id === agentTeamDisplayState.managerId)?.name || agentTeamDisplayState.managerId}</span>}
                                {agentTeamDisplayState.managedIds?.length > 0 && <span className="node-status-tag bg-[#59684b] text-white">Manages {agentTeamDisplayState.managedIds.length}</span>}
                                {agentTeamDisplayState.peerManagedIds?.length > 0 && <span className="node-status-tag bg-[#b9782b] text-white">Peer manages {agentTeamDisplayState.peerManagedIds.length}</span>}
                                {agentTeamDisplayState.peerManagerIds?.length > 0 && <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Peer managed</span>}
                              </div>
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed">
                                Plan: {agentTeamDisplayState.currentPlan?.focus || 'monitor'} / inbox {agentTeamDisplayState.inbox?.length || 0} / obligations {agentTeamDisplayState.obligations?.length || 0} / worklog {agentTeamDisplayState.worklog?.length || 0}
                              </div>
                              {agentTeamDisplayState.currentPlan?.routine && (
                                <div className="font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed">
                                  Routine: {agentTeamDisplayState.currentPlan.routine.label} / {agentTeamDisplayState.currentPlan.routine.artifact}
                                </div>
                              )}
                              {displayLatestAgentWorker && (
                                <div data-testid={`agent-priority-${agent.id}`} className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] leading-relaxed">
                                  Priority {displayAgentWorkerManagementPriority} / {displayLatestAgentWorker.trigger || 'agent-worker'}{priorityReasons.length ? ` / ${priorityReasons.slice(0, 2).join(' / ')}` : ' / routine cadence'}{displayLatestAgentWorker.managementResponseCount ? ` / RESPONDED TO ${(displayLatestAgentWorker.managementResponseTargetIds || []).map(id => agentNameById[id] || id).filter(Boolean).join(' / ') || 'manager'}` : ''}
                                </div>
                              )}
                              <div data-testid={`agent-state-detail-${agent.id}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                                <div className="border-t border-[#d8c99f] pt-1 min-w-0">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Latest Inbox</div>
                                  <div className="font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">{latestInbox?.text || latestInbox?.source || 'clear'}</div>
                                  {inboxProofIds.length > 0 && (
                                    <button
                                      type="button"
                                      data-testid={`agent-inbox-proof-${agent.id}`}
                                      onClick={() => openProjectChatProof(activeProject, inboxProofIds, inboxProofChannel)}
                                      className="mt-1 inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                    >
                                      <MessageSquare size={9} /> Inbox proof
                                    </button>
                                  )}
                                </div>
                                <div className="border-t border-[#d8c99f] pt-1 min-w-0">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Open Obligation</div>
                                  <div className="font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">{latestObligation?.text || latestObligation?.taskId || 'clear'}</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {obligationProofIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-obligation-proof-${agent.id}`}
                                        onClick={() => openProjectChatProof(activeProject, obligationProofIds, obligationProofChannel)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <MessageSquare size={9} /> Obligation proof
                                      </button>
                                    )}
                                    {obligationTimelineIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-obligation-timeline-${agent.id}`}
                                        onClick={() => openProjectTimelineProof(obligationTimelineIds)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <ScrollText size={9} /> Timeline
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="border-t border-[#d8c99f] pt-1 min-w-0">
                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Latest Worklog</div>
                                  <div className="font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">{latestWorklog?.text || agentTeamDisplayState.currentPlan?.next || 'waiting'}</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {worklogProofIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-worklog-proof-${agent.id}`}
                                        onClick={() => openProjectChatProof(activeProject, worklogProofIds, worklogProofChannel)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <MessageSquare size={9} /> Worklog proof
                                      </button>
                                    )}
                                    {worklogTimelineIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-worklog-timeline-${agent.id}`}
                                        onClick={() => openProjectTimelineProof(worklogTimelineIds)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <ScrollText size={9} /> Timeline
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                                Next Agent Run: {agentTeamDisplayState.nextAgentRunAt ? new Date(agentTeamDisplayState.nextAgentRunAt).toLocaleString() : 'not scheduled'}
                              </div>
                              <button
                                type="button"
                                data-testid={`agent-focus-open-${agent.id}`}
                                onClick={() => {
                                  setSelectedAgentFocusId(current => current === agent.id ? null : agent.id);
                                  if (selectedAgentFocusId !== agent.id) syncBackendAgentDashboard(agent.id, { silent: true });
                                }}
                                className="mt-1 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                              >
                                <UserCircle size={10} /> {agentFocusOpen ? 'Close Agent Workspace' : 'Open Agent Workspace'}
                              </button>
                              {agentFocusOpen && (
                                <div data-testid={`agent-focus-panel-${agent.id}`} className="mt-3 border border-[#b8a57d] bg-[#f7edcf] p-3">
                                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Agent Focus Workspace</div>
                                      <div className="font-serif text-xl leading-tight">{agent.name}</div>
                                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                                        Independent state / plan / proof surface
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                                      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                                        <span data-testid={`agent-focus-status-${agent.id}`} className={`node-status-tag ${agentFocusStatusClass}`}>{agentFocusStatusLabel}</span>
                                        <span
                                          data-testid={`agent-focus-dashboard-source-${agent.id}`}
                                          className={`node-status-tag ${
                                            backendAgentDashboardMissing
                                              ? 'bg-[#8f1e18] text-white'
                                              : agentBackendDashboard
                                                ? 'bg-[#59684b] text-white'
                                                : isManagerDemoProject(activeProject)
                                                  ? 'bg-[#b9782b] text-white'
                                                  : 'bg-[#251b13] text-[#efe2bd]'
                                          }`}
                                        >
                                          {agentDashboardSourceLabel}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        data-testid={`agent-focus-pulse-${agent.id}`}
                                        onClick={() => runBackendAgentPulse(agent.id)}
                                        disabled={!backendCommandAvailable || backendStation.loading}
                                        className="inline-flex items-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Activity size={10} /> Run Agent Pulse
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Current Plan</div>
                                      <div className="font-serif text-base leading-tight">{agentFocusCurrentPlan}</div>
                                    </div>
                                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Open Inbox</div>
                                      <div className="font-serif text-base leading-tight">{agentFocusInboxCount}{typeof agentFocusInboxCount === 'number' ? ` item${agentFocusInboxCount === 1 ? '' : 's'}` : ''}</div>
                                    </div>
                                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Obligations</div>
                                      <div className="font-serif text-base leading-tight">{agentFocusObligationCount}{typeof agentFocusObligationCount === 'number' ? ` item${agentFocusObligationCount === 1 ? '' : 's'}` : ''}</div>
                                    </div>
                                    <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Owned Tasks</div>
                                      <div className="font-serif text-base leading-tight">{agentFocusOwnedTaskCount}{typeof agentFocusOwnedTaskCount === 'number' ? ` task${agentFocusOwnedTaskCount === 1 ? '' : 's'}` : ''}</div>
                                    </div>
                                  </div>
                                  {backendAgentDashboardMissing && (
                                    <div data-testid={`agent-focus-backend-dashboard-required-${agent.id}`} className="mt-3 border border-[#8f1e18] bg-[#251b13]/95 px-3 py-2 text-[#efe2bd]">
                                      <div className="font-mono text-[8px] uppercase tracking-widest">Backend Agent Dashboard missing</div>
                                      <div className="mt-1 font-serif text-sm leading-relaxed">
                                        This real backend project requires `GET /projects/:id/agents/:agentId/dashboard`; local Agent state stays visible as project snapshot context, but it is not treated as the backend Agent Dashboard until Sync Agent Dashboard succeeds.
                                      </div>
                                      <button
                                        type="button"
                                        data-testid={`agent-focus-sync-dashboard-${agent.id}`}
                                        onClick={() => syncBackendAgentDashboard(agent.id, { silent: false })}
                                        disabled={!backendCommandAvailable || backendStation.loading}
                                        className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-white disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <RefreshCw size={10} /> Sync Agent Dashboard
                                      </button>
                                    </div>
                                  )}
                                  {agentBackendDashboard && (
                                    <div data-testid={`agent-focus-backend-dashboard-${agent.id}`} className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Backend Agent Dashboard</div>
                                      <div className="mt-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Open Tasks</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.openTaskCount ?? agentOwnedTasks.filter(task => task.status !== 'done').length}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Chat Proofs</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.proof?.chatProofIds?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Submissions</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.ownedSubmissions?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Evidence</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.ownedEvidenceSearches?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Reviews</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.ownedSubmissionReviews?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Submission Proofs</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.proof?.submissionIds?.length || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Timeline Proofs</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.proof?.timelineLogIds?.length || 0}</div>
                                        </div>
                                        <div data-testid={`agent-focus-backend-control-runs-${agent.id}`}>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Control Runs</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.autonomousRunControlRuns?.count || 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Route</div>
                                          <div className="font-mono text-[8px] leading-tight break-words">{agentBackendDashboard.backendRoutes?.dashboard || `/projects/${activeProject.id}/agents/${agent.id}/dashboard`}</div>
                                        </div>
                                      </div>
                                      <div data-testid={`agent-focus-backend-cadence-${agent.id}`} className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 border-t border-[#d8c99f] pt-2">
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Next Run</div>
                                          <div className="font-mono text-[8px] leading-tight">{agentBackendDashboard.schedule?.nextAgentRunAt ? new Date(agentBackendDashboard.schedule.nextAgentRunAt).toLocaleString() : 'not scheduled'}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Management Priority</div>
                                          <div className="font-serif text-base leading-tight">{agentBackendDashboard.management?.managementPriority ?? agentBackendDashboard.latestWorker?.managementPriority ?? 0}</div>
                                        </div>
                                        <div>
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Routine</div>
                                          <div className="font-mono text-[8px] leading-tight">{agentBackendDashboard.routine?.label || agentBackendDashboard.state?.currentPlan?.routine?.label || 'fixed routine'}</div>
                                        </div>
                                      </div>
                                      <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">
                                        Synced {agentBackendDashboard.syncedAt ? new Date(agentBackendDashboard.syncedAt).toLocaleTimeString() : 'from backend'}
                                      </div>
                                      {agentBackendRunReceipt && (
                                        <div data-testid={`agent-focus-control-run-receipt-${agent.id}`} className="mt-2 border-t border-[#d8c99f] pt-2">
                                          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0">
                                              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Control Run Receipt</div>
                                              <div className="font-serif text-sm leading-tight truncate">{agentBackendRunReceipt.actionLabel || agentBackendRunReceipt.actionId}</div>
                                              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                                                {agentBackendRunReceipt.delegatedRunKind || agentBackendRunReceipt.actionLane || 'autonomous-run'} / {agentBackendRunReceipt.executedAt ? new Date(agentBackendRunReceipt.executedAt).toLocaleTimeString() : 'recorded'}
                                              </div>
                                            </div>
                                            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                                              {(agentBackendRunReceipt.resultMessageIds?.length || 0) + (agentBackendRunReceipt.timelineLogIds?.length || 0)} proof
                                            </span>
                                          </div>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {agentBackendRunReceipt.resultMessageIds?.length > 0 && (
                                              <button
                                                type="button"
                                                data-testid={`agent-focus-control-run-chat-${agent.id}`}
                                                onClick={() => openProjectChatProof(activeProject, agentBackendRunReceipt.resultMessageIds, agentBackendRunReceipt.channelId || 'main')}
                                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                              >
                                                <MessageSquare size={9} /> Run proof
                                              </button>
                                            )}
                                            {agentBackendRunReceipt.timelineLogIds?.length > 0 && (
                                              <button
                                                type="button"
                                                data-testid={`agent-focus-control-run-timeline-${agent.id}`}
                                                onClick={() => openProjectTimelineProof(agentBackendRunReceipt.timelineLogIds)}
                                                className="inline-flex items-center gap-1 border border-[#d8c99f] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                              >
                                                <ScrollText size={9} /> Timeline
                                              </button>
                                            )}
                                          </div>
                                          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
                                            Run route: {agentBackendRunReceipt.runApiPath || agentBackendDashboard.backendRoutes?.autonomousRunControl || `/projects/${activeProject.id}/autonomous-run-control`}
                                          </div>
                                        </div>
                                      )}
                                      {agentBackendDashboard.brainstormContribution && (
                                        <div data-testid={`agent-focus-brainstorm-contribution-${agent.id}`} className="mt-2 border-t border-[#d8c99f] pt-2">
                                          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                                            <div>
                                              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Brainstorm Contribution</div>
                                              <div className="font-serif text-sm leading-tight">
                                                {agentBackendDashboard.brainstormContribution.status || 'no-brainstorm-contribution'}
                                              </div>
                                            </div>
                                            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                                              {agentBackendDashboard.brainstormContribution.summary?.alternativeCount || 0} directions
                                            </span>
                                          </div>
                                          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {[
                                              ['Boards', agentBackendDashboard.brainstormContribution.summary?.brainstormBoardCount || 0],
                                              ['Evidence', agentBackendDashboard.brainstormContribution.summary?.projectEvidenceSearchCount || 0],
                                              ['Downstream', agentBackendDashboard.brainstormContribution.summary?.projectDownstreamArtifactCount || 0],
                                              ['Proofs', agentBackendDashboard.brainstormContribution.summary?.proofIdCount || 0],
                                            ].map(([label, value]) => (
                                              <div key={`agent-brainstorm-${agent.id}-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{label}</div>
                                                <div className="font-serif text-base leading-tight">{value}</div>
                                              </div>
                                            ))}
                                          </div>
                                          {agentBackendDashboard.brainstormContribution.rows?.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                              {agentBackendDashboard.brainstormContribution.rows.slice(0, 2).map(row => (
                                                <div key={row.id} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                                  <div className="grid grid-cols-[1fr_auto] gap-2">
                                                    <div className="min-w-0">
                                                      <div className="font-serif text-sm leading-tight truncate">{row.title}</div>
                                                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                                                        {row.alternativeCount || 0} alternatives / {row.proofIds?.length || 0} proof
                                                      </div>
                                                    </div>
                                                    <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">brainstorm</span>
                                                  </div>
                                                  {row.alternatives?.length > 0 && (
                                                    <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#4d412d] truncate">
                                                      {row.alternatives.slice(0, 3).map(item => item.label).join(' / ')}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
                                            Brainstorm route: {agentBackendDashboard.brainstormContribution.backendRoutes?.brainstormLayer || agentBackendDashboard.backendRoutes?.brainstormLayer || `/projects/${activeProject.id}/brainstorm-layer`}
                                          </div>
                                        </div>
                                      )}
                                      {agentBackendDashboard.ownedSubmissions?.length > 0 && (
                                        <div data-testid={`agent-focus-submissions-${agent.id}`} className="mt-2 border-t border-[#d8c99f] pt-2">
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Owned Submissions</div>
                                          <div className="mt-1 space-y-1">
                                            {agentBackendDashboard.ownedSubmissions.slice(0, 4).map(submission => (
                                              <div key={submission.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                                <div className="min-w-0">
                                                  <div className="font-serif text-sm leading-tight truncate">{submission.title}</div>
                                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{submission.artifactType} / {submission.status} / {submission.reviewStatus}</div>
                                                  {(submission.isGeneratedDraft || submission.artifactDraft) && (
                                                    <div data-testid={`agent-focus-artifact-draft-${agent.id}`} className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18] truncate">
                                                      Draft {submission.artifactDraftModelUsed ? 'model' : 'local'} / {submission.artifactDraftSource || submission.artifactDraft?.source || 'artifact-draft'}
                                                    </div>
                                                  )}
                                                </div>
                                                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{submission.artifactType}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {agentBackendDashboard.ownedEvidenceSearches?.length > 0 && (
                                        <div data-testid={`agent-focus-evidence-searches-${agent.id}`} className="mt-2 border-t border-[#d8c99f] pt-2">
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Evidence Searches</div>
                                          <div className="mt-1 space-y-1">
                                            {agentBackendDashboard.ownedEvidenceSearches.slice(0, 4).map(record => (
                                              <div key={record.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                                <div className="min-w-0">
                                                  <div className="font-serif text-sm leading-tight truncate">{record.query}</div>
                                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{record.sources?.length || 0} sources / {record.confidence} / {record.status}</div>
                                                </div>
                                                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{record.searchMode}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {agentBackendDashboard.ownedSubmissionReviews?.length > 0 && (
                                        <div data-testid={`agent-focus-submission-reviews-${agent.id}`} className="mt-2 border-t border-[#d8c99f] pt-2">
                                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Submission Reviews</div>
                                          <div className="mt-1 space-y-1">
                                            {agentBackendDashboard.ownedSubmissionReviews.slice(0, 4).map(review => (
                                              <div key={review.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                                                <div className="min-w-0">
                                                  <div className="font-serif text-sm leading-tight truncate">{review.comments}</div>
                                                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{review.roleInReview} / {review.submissionId}</div>
                                                </div>
                                                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{review.verdict}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div data-testid={`agent-workbench-${agent.id}`} className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                      <div>
                                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Agent Workbench</div>
                                        <div className="font-serif text-base leading-tight">Submission, evidence, and draft nodes.</div>
                                      </div>
                                      <span className={`node-status-tag ${latestWorkbenchReceiptFailed ? 'bg-[#8f1e18] text-white' : latestWorkbenchReceipt?.readModels?.included === false ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
                                        {latestWorkbenchReceiptFailed ? 'write failed' : latestWorkbenchReceipt?.readModels?.included === false ? 'lightweight receipt' : 'backend write'}
                                      </span>
                                    </div>
                                    {workbenchBackendContextMissing && (
                                      <div data-testid={`agent-workbench-backend-dashboard-required-${agent.id}`} className="mt-2 border border-[#8f1e18] bg-red-50 px-2 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
                                        Backend Agent Dashboard is required before this real project can submit Agent Workbench evidence, artifacts, drafts, reviews, or final delivery from this Agent context.
                                      </div>
                                    )}
                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <select
                                        data-testid={`agent-workbench-artifact-type-${agent.id}`}
                                        value={selectedWorkbenchArtifactType}
                                        onChange={(event) => updateAgentWorkDraft(agent.id, {
                                          artifactType: event.target.value,
                                          respondsToReviewId: '',
                                          revisesSubmissionId: '',
                                        })}
                                        disabled={workbenchWriteDisabled}
                                        className="w-full border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] disabled:opacity-50"
                                      >
                                        {AGENT_WORKBENCH_ARTIFACT_TYPES.map(type => (
                                          <option key={type.id} value={type.id}>{type.label}</option>
                                        ))}
                                      </select>
                                      <select
                                        data-testid={`agent-workbench-task-${agent.id}`}
                                        value={selectedWorkbenchTaskId || ''}
                                        onChange={(event) => updateAgentWorkDraft(agent.id, { taskId: event.target.value })}
                                        disabled={workbenchWriteDisabled || workbenchTaskOptions.length === 0}
                                        className="w-full border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] disabled:opacity-50"
                                      >
                                        {workbenchTaskOptions.length === 0 && <option value="">No task</option>}
                                        {workbenchTaskOptions.map(task => (
                                          <option key={task.id} value={task.id}>{task.text || task.id}</option>
                                        ))}
                                      </select>
                                      <select
                                        data-testid={`agent-workbench-review-${agent.id}`}
                                        value={selectedWorkbenchReviewId}
                                        onChange={(event) => {
                                          const review = workbenchReviewOptions.find(item => String(item.id) === String(event.target.value));
                                          updateAgentWorkDraft(agent.id, {
                                            respondsToReviewId: event.target.value,
                                            revisesSubmissionId: review?.submissionId || '',
                                          });
                                        }}
                                        disabled={workbenchWriteDisabled || workbenchReviewOptions.length === 0}
                                        className="w-full border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] disabled:opacity-50"
                                      >
                                        <option value="">No review link</option>
                                        {workbenchReviewOptions.map(review => (
                                          <option key={review.id} value={review.id}>{review.verdict || review.status || 'review'} / {review.submissionTitle || review.submissionId || review.id}</option>
                                        ))}
                                      </select>
                                      <select
                                        data-testid={`agent-workbench-revises-submission-${agent.id}`}
                                        value={selectedWorkbenchRevisesSubmissionId}
                                        onChange={(event) => updateAgentWorkDraft(agent.id, { revisesSubmissionId: event.target.value })}
                                        disabled={workbenchWriteDisabled || workbenchSubmissionOptions.length === 0}
                                        className="w-full border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] disabled:opacity-50"
                                      >
                                        <option value="">No revision target</option>
                                        {workbenchSubmissionOptions.map(submission => (
                                          <option key={submission.id} value={submission.id}>{submission.artifactType || 'artifact'} / {submission.title || submission.id}</option>
                                        ))}
                                      </select>
                                      <input
                                        data-testid={`agent-workbench-title-${agent.id}`}
                                        value={agentWorkDraft.title || ''}
                                        onChange={(event) => updateAgentWorkDraft(agent.id, { title: event.target.value })}
                                        disabled={workbenchWriteDisabled}
                                        placeholder={`${agent.name} ${selectedWorkbenchArtifactType.replace(/-/g, ' ')}`}
                                        className="w-full min-w-0 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                                      />
                                      <input
                                        data-testid={`agent-workbench-query-${agent.id}`}
                                        value={agentWorkDraft.query || ''}
                                        onChange={(event) => updateAgentWorkDraft(agent.id, { query: event.target.value })}
                                        disabled={workbenchWriteDisabled}
                                        placeholder={`${activeProject.name} evidence query`}
                                        className="w-full min-w-0 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                                      />
                                      <input
                                        data-testid={`agent-workbench-source-url-${agent.id}`}
                                        value={agentWorkDraft.sourceUrl || ''}
                                        onChange={(event) => updateAgentWorkDraft(agent.id, { sourceUrl: event.target.value })}
                                        disabled={workbenchWriteDisabled}
                                        placeholder="https://source.example"
                                        className="w-full min-w-0 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                                      />
                                      <input
                                        data-testid={`agent-workbench-instruction-${agent.id}`}
                                        value={agentWorkDraft.instruction || ''}
                                        onChange={(event) => updateAgentWorkDraft(agent.id, { instruction: event.target.value })}
                                        disabled={workbenchWriteDisabled}
                                        placeholder={`${selectedWorkbenchArtifactType.replace(/-/g, ' ')} instruction`}
                                        className="w-full min-w-0 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                                      />
                                    </div>
                                    <textarea
                                      data-testid={`agent-workbench-summary-${agent.id}`}
                                      value={agentWorkDraft.summary || ''}
                                      onChange={(event) => updateAgentWorkDraft(agent.id, { summary: event.target.value })}
                                      disabled={workbenchWriteDisabled}
                                      rows={3}
                                      placeholder={`${agent.name} work summary`}
                                      className="mt-2 w-full min-w-0 resize-none border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] leading-relaxed text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                                    />
                                    <textarea
                                      data-testid={`agent-workbench-body-${agent.id}`}
                                      value={agentWorkDraft.body || ''}
                                      onChange={(event) => updateAgentWorkDraft(agent.id, { body: event.target.value })}
                                      disabled={workbenchWriteDisabled}
                                      rows={4}
                                      placeholder={`${selectedWorkbenchArtifactType.replace(/-/g, ' ')} body`}
                                      className="mt-2 w-full min-w-0 resize-none border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] leading-relaxed text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                                    />
                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <button
                                        type="button"
                                        data-testid={`agent-workbench-evidence-${agent.id}`}
                                        onClick={() => runBackendAgentEvidenceSearch(agent.id)}
                                        disabled={workbenchWriteDisabled}
                                        className="inline-flex items-center justify-center gap-1.5 border border-[#7b6542] bg-[#efe2bd] px-3 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Search size={11} /> Evidence
                                      </button>
                                      <button
                                        type="button"
                                        data-testid={`agent-workbench-submit-${agent.id}`}
                                        onClick={() => runBackendAgentArtifactSubmission(agent.id)}
                                        disabled={workbenchWriteDisabled}
                                        className="inline-flex items-center justify-center gap-1.5 border border-[#7b6542] bg-[#efe2bd] px-3 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <FileText size={11} /> Submit
                                      </button>
                                      <button
                                        type="button"
                                        data-testid={`agent-workbench-draft-submit-${agent.id}`}
                                        onClick={() => runBackendAgentArtifactDraft(agent.id)}
                                        disabled={workbenchWriteDisabled}
                                        className="inline-flex items-center justify-center gap-1.5 border border-[#7b6542] bg-[#efe2bd] px-3 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Sparkles size={11} /> Draft + Submit
                                      </button>
                                    </div>
                                    {latestWorkbenchReceipt && (
                                      <div data-testid={`agent-workbench-receipt-${agent.id}`} className={`mt-2 border px-2 py-1 ${latestWorkbenchReceiptFailed ? 'border-red-800 bg-red-50' : 'border-[#d8c99f] bg-[#f7edcf]'}`}>
                                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{latestWorkbenchReceiptFailed ? 'Agent Workbench Write Failed' : 'Latest Backend Receipt'}</div>
                                        <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                                          {latestWorkbenchReceiptFailed
                                            ? `${latestWorkbenchReceipt.action} / no local workbench proof was created / ${latestWorkbenchReceipt.error || 'backend write failed'}`
                                            : `${latestWorkbenchReceipt.action} / ${latestWorkbenchReceipt.submissionId || latestWorkbenchReceipt.evidenceSearchId || latestWorkbenchReceipt.artifactDraftId || 'receipt'} / ${latestWorkbenchReceipt.readModels?.managerFlowGraphRoute || `/projects/${activeProject.id}/manager-flow-graph`}`}
                                        </div>
                                        {!latestWorkbenchReceiptFailed && latestWorkbenchReceipt.artifactDraftId && (
                                          <div data-testid={`agent-workbench-artifact-draft-proof-${agent.id}`} className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#59684b] leading-relaxed break-words">
                                            Draft node: {latestWorkbenchReceipt.artifactDraftId}
                                            {' '} / Flow: {latestWorkbenchReceipt.readModels?.managerFlowGraphRoute || `/projects/${activeProject.id}/manager-flow-graph`}
                                            {' '} / Proof: {latestWorkbenchReceipt.readModels?.readinessProofMapRoute || `/projects/${activeProject.id}/readiness-proof-map`}
                                            {' '} / Timeline: {latestWorkbenchReceipt.readModels?.timelineRoute || `/projects/${activeProject.id}/timeline`}
                                            {' '} / Event: {latestWorkbenchReceipt.readModels?.eventsRoute || `/projects/${activeProject.id}/events`}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div data-testid={`agent-focus-management-${agent.id}`} className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                      <div>
                                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Management Surface</div>
                                        <div className="font-serif text-base leading-tight">Leader chain and peer-management proof for this Agent.</div>
                                      </div>
                                      <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                                        {agentManagementProofIds.length} management proof{agentManagementProofIds.length === 1 ? '' : 's'}
                                      </span>
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Managed By</div>
                                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                                          {focusManagerNames.join(' / ') || (agent.isLeader ? 'Director-confirmed lead' : 'self-directed')}
                                        </div>
                                      </div>
                                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Manages</div>
                                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                                          {focusManagedNames.join(' / ') || 'none'}
                                        </div>
                                      </div>
                                      <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                                        <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Peer Management</div>
                                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                                          {focusPeerManagedCount} targets / {focusPeerManagerCount} managers
                                        </div>
                                      </div>
                                    </div>
                                    {agentManagementProofIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-focus-management-proof-${agent.id}`}
                                        onClick={() => openProjectTimelineProof(Array.from(new Set(agentManagementProofIds)).slice(0, 10))}
                                        className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <ScrollText size={10} /> Management proof
                                      </button>
                                    )}
                                  </div>
                                  <div data-testid={`agent-focus-owned-tasks-${agent.id}`} className="mt-3 space-y-2">
                                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Owned Task Evidence</div>
                                    {agentOwnedTaskEvidenceRows.length === 0 && (
                                      <div data-testid={`agent-focus-owned-tasks-empty-${agent.id}`} className="border border-[#8f1e18] bg-red-50 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
                                        No backend owned task evidence returned yet.
                                      </div>
                                    )}
                                    {agentOwnedTaskEvidenceRows.slice(0, 4).map(task => (
                                      <div key={`agent-focus-task-${agent.id}-${task.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="font-serif text-base leading-tight">{task.text}</div>
                                            <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{task.status || 'pending'} / timeline {taskEvidence(task).timelineCount || 0}</div>
                                          </div>
                                          <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{task.workPulseCount || 0} pulse{(task.workPulseCount || 0) === 1 ? '' : 's'}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {agentProofChatIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-focus-chat-proof-${agent.id}`}
                                        onClick={() => openProjectChatProof(activeProject, Array.from(new Set(agentProofChatIds)).slice(0, 10), inboxProofChannel)}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <MessageSquare size={10} /> Agent chat proof
                                      </button>
                                    )}
                                    {agentProofTimelineIds.length > 0 && (
                                      <button
                                        type="button"
                                        data-testid={`agent-focus-timeline-proof-${agent.id}`}
                                        onClick={() => openProjectTimelineProof(Array.from(new Set(agentProofTimelineIds)).slice(0, 10))}
                                        className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18]"
                                      >
                                        <ScrollText size={10} /> Agent timeline proof
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                              {messageTargetOptions.length > 0 && (
                                <div data-testid={`agent-message-panel-${agent.id}`} className="grid w-full grid-cols-1 gap-2 pt-2">
                                  <select
                                    data-testid={`agent-message-target-${agent.id}`}
                                    value={selectedMessageTarget}
                                    onChange={(event) => updateAgentMessageDraft(agent.id, { targetAgentId: event.target.value })}
                                    disabled={!backendCommandAvailable || backendStation.loading}
                                    className="w-full border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] disabled:opacity-50"
                                  >
                                    {messageTargetOptions.map(member => (
                                      <option key={member.id} value={member.id}>{member.name}</option>
                                    ))}
                                  </select>
                                  <input
                                    data-testid={`agent-message-input-${agent.id}`}
                                    value={agentMessageDraft.text || ''}
                                    onChange={(event) => updateAgentMessageDraft(agent.id, { text: event.target.value })}
                                    disabled={!backendCommandAvailable || backendStation.loading}
                                    placeholder={`@${activeProject.team.find(member => member.id === selectedMessageTarget)?.name || 'Agent'} coordination note`}
                                    className="w-full min-w-0 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1.5 font-mono text-[8px] text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    data-testid={`agent-message-send-${agent.id}`}
                                    onClick={() => runBackendAgentMessage(agent.id)}
                                    disabled={!backendCommandAvailable || backendStation.loading || !selectedMessageTarget}
                                    className="inline-flex w-full items-center justify-center gap-1.5 border border-[#7b6542] bg-[#efe2bd] px-3 py-1.5 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <Send size={11} /> Agent Message
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="w-full flex items-center gap-3">
                          <button
                            type="button"
                            data-testid={`agent-work-cycle-${agent.id}`}
                            onClick={() => runBackendAgentPulse(agent.id)}
                            disabled={!backendCommandAvailable || backendStation.loading}
                            className="inline-flex flex-1 items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Activity size={12} /> Agent Pulse
                          </button>
                          <div className={`w-2 h-2 rounded-full ${agentStatusDotClass}`} />
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
  );
}

