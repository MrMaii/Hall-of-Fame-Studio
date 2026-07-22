import { lazy, Suspense } from 'react';
import { FileSignature, RefreshCw, Settings } from 'lucide-react';
import { localizeText } from '../i18n/index.jsx';

const ProjectInitiationBriefStep = lazy(() => import('./ProjectInitiationBriefStep.jsx'));
const ProjectInitiationWorkspaceStep = lazy(() => import('./ProjectInitiationWorkspaceStep.jsx'));
const ProjectInitiationInviteStep = lazy(() => import('./ProjectInitiationInviteStep.jsx'));
const ProjectInitiationLobbyStep = lazy(() => import('./ProjectInitiationLobbyStep.jsx'));
const ProjectInitiationResultStep = lazy(() => import('./ProjectInitiationResultStep.jsx'));

export default function ProjectInitiationFlowView({ view }) {
  const {
    INITIATION_MEMBERS,
    INITIATION_WORK_MODES,
    LazyPanelFallback,
    activeLanguage,
    approveInitiationProject,
    backendStation,
    backendUrlConfigured,
    confirmedMemberIds,
    confirmedMembers,
    firstLead,
    goStep,
    initiationActionDrafts,
    initiationDeliverableDrafts,
    initiationDeliverablesReady,
    initiationApprovalState,
    initiationBackendErrorVisible,
    initiationCanApproveProject,
    initiationCanStartKickoff,
    initiationDevelopmentFallbackAllowed,
    initiationDraft,
    initiationGenerationLabel,
    initiationGenerationProvenance,
    initiationMeetingProject,
    initiationMeetingSession,
    initiationMeetingStartState,
    initiationProjectId,
    initiationStartupBlocker,
    initiationStartupGateClass,
    initiationStartupReadyForFirstRun,
    initiationStartupSettingsTab,
    initiationStartupStatus,
    initiationStep,
    initiationWorkMode,
    initiationWorkspaceDraft,
    initiationWorkspacePath,
    initiationWorkspaceReady,
    initiationWorkspaceStatusClass,
    invitedMembers,
    isInitiationMeetingStep,
    managerSteps,
    meetingLeaderElection,
    navToDashboard,
    openInitiationTalentMarket,
    openInitiationWorkspaceFolderPicker,
    prepareInitiationWorkspace,
    providerRuntimeStatus,
    renderProjectMeeting,
    reporter,
    selectMeetingLeaderCandidate,
    setInitiationActionDrafts,
    setInitiationPhase,
    setInitiationWorkMode,
    setInitiationWorkspaceDraft,
    setMeetingElapsed,
    setMeetingStartTime,
    setSettingsOpen,
    setSettingsTab,
    startInitiationMeetingSession,
    stepIndex,
    submitInitiationMeetingInput,
    syncSettingsProviderRuntime,
    toggleConfirmedTeamMember,
    updateDeliverableDraft,
    addDeliverableDraft,
    updateActionDraft,
    updateDraft,
    workingGroup,
  } = view;

  return (
    <div className="flex-1 overflow-hidden bg-[#0d0c0b] text-[#efe2bd] fade-in">
      <div className="h-full">
        <section className="relative h-full overflow-y-auto">
          <div className="absolute inset-0 project-room" />
          <div className="absolute inset-0 opacity-45" style={{ backgroundImage: 'radial-gradient(circle at 48% 35%, transparent 0, rgba(0,0,0,0.78) 70%)' }} />

          {!isInitiationMeetingStep && <header className="sticky top-0 z-30 bg-[#0d0c0b]/72 backdrop-blur border-b border-[#3a2a1c]/70 px-8 py-4">
            <div className="flex items-start justify-between gap-6 mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#bcae86] mb-3 flex items-center gap-3">
                  <FileSignature size={15} className="text-[#8f1e18]" />
                  {activeLanguage === 'zh' ? '项目立项流程' : 'Project Initiation Flow'}
                </div>
                <h1 className="font-serif text-5xl leading-none">{activeLanguage === 'zh' ? '发起立项' : localizeText('Start Initiation', activeLanguage)}</h1>
              </div>
              <button onClick={navToDashboard} className="font-mono text-[10px] uppercase tracking-widest border border-[#3a2a1c] px-4 py-2 text-[#bcae86] hover:text-[#efe2bd] hover:border-[#7b6542] transition-colors">
                {activeLanguage === 'zh' ? '返回' : 'Back'}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {managerSteps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => index <= stepIndex && goStep(step.id)}
                  className={`min-w-[116px] border px-3 py-2 text-left transition-colors ${index === stepIndex ? 'bg-[#efe2bd] text-[#251b13] border-[#efe2bd]' : index < stepIndex ? 'border-[#8f1e18] text-[#efe2bd]' : 'border-[#3a2a1c] text-[#7d6a49]'}`}
                >
                  <div className="font-mono text-[8px] uppercase tracking-widest">0{index + 1}</div>
                  <div className="font-serif text-base leading-tight">{step.label}</div>
                </button>
              ))}
            </div>
          </header>}

          <div className={`relative z-10 ${isInitiationMeetingStep ? 'h-full overflow-hidden p-0' : 'p-8 xl:p-10'}`}>
            {!isInitiationMeetingStep && initiationBackendErrorVisible && (
              <div data-testid="initiation-backend-error" className="max-w-3xl mx-auto mb-5 border border-[#8f1e18] bg-[#251b13] px-5 py-4 text-[#efe2bd]">
                <div className="font-serif text-lg leading-tight">
                  {activeLanguage === 'zh' ? '操作没有完成' : 'The action did not finish'}
                </div>
                <div className="mt-2 font-serif text-sm leading-relaxed text-[#d8c99f]">
                  {activeLanguage === 'zh' ? '请重试；如果问题持续出现，请打开设置检查本地服务和模型。' : 'Try again. If the problem continues, open Settings and check the local service and model.'}
                </div>
                <details className="mt-3 font-mono text-[9px] leading-relaxed text-[#bcae86]">
                  <summary className="cursor-pointer">{activeLanguage === 'zh' ? '查看技术信息' : 'View technical details'}</summary>
                  <div data-no-localize="" className="mt-2 break-all">{backendStation.lastAction || 'Backend action failed'}</div>
                  <div data-no-localize="" className="mt-1 break-all">{backendStation.error}</div>
                </details>
              </div>
            )}
            {!isInitiationMeetingStep && !initiationStartupReadyForFirstRun && (
              <div data-testid="initiation-startup-readiness-gate" className={`mx-auto mb-5 max-w-3xl border px-5 py-4 ${initiationStartupGateClass}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="font-mono text-[9px] uppercase tracking-[0.24em]">
                      {activeLanguage === 'zh' ? '开始条件' : 'Start requirements'}
                    </div>
                    <div className="mt-1 font-serif text-lg leading-tight">
                      {initiationStartupReadyForFirstRun
                        ? (activeLanguage === 'zh' ? '已可开始 Agent 工作' : 'Ready to start Agent work')
                        : initiationDevelopmentFallbackAllowed
                          ? (activeLanguage === 'zh' ? '开发回退已启用，不能作为上线证据' : 'Development fallback enabled; not launch evidence')
                          : (activeLanguage === 'zh' ? '配置模型后即可开始 Agent 工作' : 'Backend startup required before real kickoff')}
                    </div>
                    <div className="mt-2 font-serif text-sm leading-relaxed">
                      {initiationStartupReadyForFirstRun
                        ? (activeLanguage === 'zh' ? '本地服务和模型已经就绪。' : 'The local service and model are ready.')
                        : initiationDevelopmentFallbackAllowed
                          ? (activeLanguage === 'zh' ? '当前仅用于开发检查，正式使用前仍需完成模型设置。' : 'This mode is for development checks only. Complete model setup before real use.')
                          : (activeLanguage === 'zh' ? '你可以继续填写项目信息和准备文件夹；开始立项会议前需要完成模型设置。' : 'You can continue preparing the project details and folder. Model setup is required before the kickoff meeting.')}
                    </div>
                    <details data-testid="initiation-startup-technical-details" className="mt-3 font-mono text-[10px] leading-relaxed">
                      <summary className="cursor-pointer normal-case tracking-normal">
                        {activeLanguage === 'zh' ? '查看技术信息' : 'View technical details'}
                      </summary>
                      <div className="mt-2 break-all">/local-mvp-startup-readiness</div>
                      <div className="mt-1 uppercase tracking-[0.12em]">
                        {activeLanguage === 'zh' ? '状态' : 'Status'}: {localizeText(initiationStartupStatus, activeLanguage)} / {activeLanguage === 'zh' ? '首次项目运行' : 'first project run'}: {initiationStartupReadyForFirstRun ? (activeLanguage === 'zh' ? '已就绪' : 'ready') : (activeLanguage === 'zh' ? '尚未就绪' : 'blocked')}
                      </div>
                      {initiationStartupBlocker && (
                        <div className="mt-1 normal-case tracking-normal">{localizeText(initiationStartupBlocker, activeLanguage)}</div>
                      )}
                    </details>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="initiation-sync-startup"
                      onClick={() => syncSettingsProviderRuntime({ runTests: false })}
                      disabled={providerRuntimeStatus.running || !backendUrlConfigured}
                      className="inline-flex items-center justify-center gap-2 border border-current px-3 py-2 font-mono text-[8px] uppercase tracking-widest disabled:opacity-50"
                    >
                      <RefreshCw size={12} /> {activeLanguage === 'zh' ? '重新检查' : 'Check again'}
                    </button>
                    {!initiationStartupReadyForFirstRun && (
                      <button
                        type="button"
                        data-testid="initiation-open-startup-settings"
                        onClick={() => { setSettingsTab(initiationStartupSettingsTab); setSettingsOpen(true); }}
                        className="inline-flex items-center justify-center gap-2 border border-current px-3 py-2 font-mono text-[8px] uppercase tracking-widest"
                      >
                        <Settings size={12} /> {activeLanguage === 'zh' ? '配置模型' : 'Configure model'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {initiationStep === 'brief' && (
              <Suspense fallback={<LazyPanelFallback />}>
                <ProjectInitiationBriefStep
                  activeLanguage={activeLanguage}
                  draft={initiationDraft}
                  workMode={initiationWorkMode}
                  workModes={INITIATION_WORK_MODES}
                  onDraftChange={updateDraft}
                  onWorkModeChange={setInitiationWorkMode}
                  onContinue={() => goStep('workspace')}
                />
              </Suspense>
            )}

            {initiationStep === 'workspace' && (
              <Suspense fallback={<LazyPanelFallback />}>
                <ProjectInitiationWorkspaceStep
                  activeLanguage={activeLanguage}
                  workspaceDraft={initiationWorkspaceDraft}
                  workspaceReady={initiationWorkspaceReady}
                  workspaceStatusClass={initiationWorkspaceStatusClass}
                  workspacePath={initiationWorkspacePath}
                  backendUrlConfigured={backendUrlConfigured}
                  projectId={initiationProjectId}
                  onBasePathChange={(basePath) => setInitiationWorkspaceDraft(prev => ({
                    ...prev,
                    basePath,
                    preparedPath: '',
                    receipt: null,
                    verification: null,
                    notice: null,
                    error: null,
                  }))}
                  onFolderNameChange={(folderName) => setInitiationWorkspaceDraft(prev => ({
                    ...prev,
                    folderName,
                    folderNameEdited: true,
                    preparedPath: '',
                    receipt: null,
                    verification: null,
                    notice: null,
                    error: null,
                  }))}
                  onOpenFolderPicker={openInitiationWorkspaceFolderPicker}
                  onPrepareWorkspace={prepareInitiationWorkspace}
                  onContinue={() => { goStep('invite'); openInitiationTalentMarket(); }}
                />
              </Suspense>
            )}

            {initiationStep === 'invite' && (
              <Suspense fallback={<LazyPanelFallback />}>
                <ProjectInitiationInviteStep
                  activeLanguage={activeLanguage}
                  invitedMembers={invitedMembers}
                  onOpenTalentMarket={openInitiationTalentMarket}
                  onContinue={() => goStep('lobby')}
                />
              </Suspense>
            )}

            {initiationStep === 'lobby' && (
              <Suspense fallback={<LazyPanelFallback />}>
                <ProjectInitiationLobbyStep
                  activeLanguage={activeLanguage}
                  projectName={initiationDraft.name}
                  intent={initiationDraft.intent}
                  invitedMembers={invitedMembers}
                  participants={[INITIATION_MEMBERS[0], ...invitedMembers]}
                  canStart={initiationCanStartKickoff}
                  providerRunning={providerRuntimeStatus.running}
                  startState={initiationMeetingStartState}
                  onStartMeeting={startInitiationMeetingSession}
                />
              </Suspense>
            )}

            {initiationStep === 'meeting' && renderProjectMeeting(initiationMeetingProject, {
              forceTimer: true,
              title: 'Initiation Roundtable',
              onBack: () => {
                setMeetingStartTime(null);
                setMeetingElapsed(0);
                goStep('lobby');
              },
              onComplete: () => {
                setMeetingStartTime(null);
                setMeetingElapsed(0);
                setInitiationPhase('decision');
                goStep('result');
              },
              onSubmit: submitInitiationMeetingInput,
              hideMeetingTelemetry: true,
            })}

            {initiationStep === 'meeting' && (
              <div data-testid="initiation-meeting-generation-source" className="absolute left-6 top-6 z-30 border border-[#7b6542] bg-[#0d0c0b] px-3 py-2">
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{activeLanguage === 'zh' ? '立项内容生成来源' : 'Kickoff Generation Source'}</div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd]">{initiationGenerationLabel}</div>
              </div>
            )}

            {initiationStep === 'result' && (
              <Suspense fallback={<LazyPanelFallback />}>
                <ProjectInitiationResultStep
                  activeLanguage={activeLanguage}
                  draft={initiationDraft}
                  workModeLabel={INITIATION_WORK_MODES.find(mode => mode.id === initiationWorkMode)?.[activeLanguage === 'zh' ? 'zhLabel' : 'label'] || initiationWorkMode}
                  firstLead={firstLead}
                  reporter={reporter}
                  workingGroup={workingGroup}
                  workspaceDraft={initiationWorkspaceDraft}
                  workspacePath={initiationWorkspacePath}
                  invitedMembers={invitedMembers}
                  confirmedMemberIds={confirmedMemberIds}
                  confirmedMembersCount={confirmedMembers.length}
                  actionDrafts={initiationActionDrafts}
                  deliverableDrafts={initiationDeliverableDrafts}
                  deliverablesReady={initiationDeliverablesReady}
                  meetingSession={initiationMeetingSession}
                  generationLabel={initiationGenerationLabel}
                  generationProvenance={initiationGenerationProvenance}
                  leaderCandidates={meetingLeaderElection.candidates}
                  approvalDisabled={!initiationCanApproveProject || providerRuntimeStatus.running}
                  approvalRunning={initiationApprovalState.running}
                  approvalLabel={initiationApprovalState.label}
                  onToggleConfirmedMember={toggleConfirmedTeamMember}
                  onUpdateAction={updateActionDraft}
                  onAddAction={() => setInitiationActionDrafts(prev => [...prev, ''])}
                  onUpdateDeliverable={updateDeliverableDraft}
                  onAddDeliverable={addDeliverableDraft}
                  onSelectLeader={selectMeetingLeaderCandidate}
                  onApprove={approveInitiationProject}
                />
              </Suspense>
            )}
          </div>
        </section>

        {!isInitiationMeetingStep && <aside className="border-l border-[#3a2a1c] bg-[#efe2bd] text-[#251b13] p-7 overflow-y-auto">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#8f1e18] mb-4">{activeLanguage === 'zh' ? '立项摘要' : 'Initiation Summary'}</div>
          <h2 className="font-serif text-4xl leading-none mb-5">{initiationDraft.name || (activeLanguage === 'zh' ? '未命名项目' : 'Untitled Project')}</h2>
          <p className="font-serif text-xl leading-relaxed text-[#4d3c28] mb-6">{initiationDraft.summary}</p>
          <div className="space-y-3 mb-8">
            {[
              [activeLanguage === 'zh' ? '当前阶段' : 'Current Stage', managerSteps[stepIndex]?.label],
              [activeLanguage === 'zh' ? '参与成员' : 'Participants', invitedMembers.map(member => member.name).join(' / ') || (activeLanguage === 'zh' ? '尚未选择' : 'None selected')],
              [activeLanguage === 'zh' ? '工作类型' : 'Operating Mode', INITIATION_WORK_MODES.find(mode => mode.id === initiationWorkMode)?.[activeLanguage === 'zh' ? 'zhLabel' : 'label'] || initiationWorkMode],
              [activeLanguage === 'zh' ? '预期产出' : 'Expected Output', initiationDraft.output],
              [activeLanguage === 'zh' ? '进入项目看板的条件' : 'Dashboard Gate', initiationStep === 'result' ? (activeLanguage === 'zh' ? '可以创建' : 'Ready to create') : (activeLanguage === 'zh' ? '立项会议批准后' : 'After meeting approval')],
            ].map(([label, value]) => (
              <div key={label} className="border border-[#b8a57d] bg-[#f7edcf] p-4">
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{label}</div>
                <div className="font-serif text-xl leading-tight">{value}</div>
              </div>
            ))}
          </div>
          <div className="border-2 border-[#8f1e18] p-5 rotate-[-1deg]">
            <div className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#8f1e18] mb-3">{activeLanguage === 'zh' ? '规则' : 'Rule'}</div>
            <p className="font-serif text-2xl leading-snug">
              {activeLanguage === 'zh' ? '只有立项圆桌会议批准后，项目才会进入项目看板。' : 'A project enters the dashboard only after the kickoff roundtable is approved.'}
            </p>
          </div>
        </aside>}
      </div>
    </div>
  );
}
