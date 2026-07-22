import { lazy, Suspense } from 'react';
import {
  Activity,
  CheckCircle2,
  KeyRound,
  Play,
  PlugZap,
  RefreshCw,
  Server,
  Shield,
  SlidersHorizontal,
  UserCircle,
} from 'lucide-react';
import { localizeText } from '../i18n/index.jsx';

const LocalAccountSettings = lazy(() => import('./LocalAccountSettings.jsx'));
const LocalModelSettings = lazy(() => import('./LocalModelSettings.jsx'));
const LocalHealthSettings = lazy(() => import('./LocalHealthSettings.jsx'));
const LocalPrivacySettings = lazy(() => import('./LocalPrivacySettings.jsx'));
const LocalDeploymentSettings = lazy(() => import('./LocalDeploymentSettings.jsx'));
const LocalWorkspaceSettings = lazy(() => import('./LocalWorkspaceSettings.jsx'));
const LocalToolsSettings = lazy(() => import('./LocalToolsSettings.jsx'));
const SettingsDialogShell = lazy(() => import('./SettingsDialogShell.jsx'));

export default function SettingsModalView({ view }) {
  const {
    DEFAULT_AGENT_BACKEND_URL,
    DEFAULT_SETTINGS_TOOL_GRANTS,
    LazyPanelFallback,
    SETTINGS_TOOL_GRANT_OPTIONS,
    activeLanguage,
    activeProject,
    backendConfiguredTargetLabel,
    backendHealthTargetLabel,
    backendStation,
    backendUrlConfigured,
    bindProjectWorkspaceFromSettings,
    changeLocalAuthPassword,
    committedBackendBaseUrl,
    createLocalAuthUser,
    disableLocalAuthUser,
    healthCheck,
    language,
    localAuthDraft,
    localAuthPasswordDraft,
    localAuthSessionForCurrentBackend,
    localAuthStatus,
    localAuthUserDraft,
    localAuthUsers,
    localProjectMembership,
    normalizeBackendBaseUrl,
    privacyPolicySaving,
    projectSettingsDraftRef,
    providerBudgetPolicySaving,
    providerRuntimeStatus,
    providerSecretDrafts,
    runSettingsFooterConnectionTest,
    runSettingsHealthCheck,
    saveBackendBaseUrl,
    sealSettingsProviderSecret,
    setBackendStation,
    setLanguage,
    setLocalAuthDraft,
    setLocalAuthPasswordDraft,
    setLocalAuthUserDraft,
    setLocalProjectUserAccess,
    setProjectToolGrantSetting,
    setProviderSecretDrafts,
    setSettingsOpen,
    focusedModelSetup,
    setFocusedModelSetup,
    setSettingsTab,
    setWorkspaceBindDraft,
    settingsTab,
    shouldAttemptBackendProjectWrite,
    submitLocalAuth,
    syncBackendMeetingSummaries,
    syncBackendProjectMemoryReadiness,
    syncBackendProjectState,
    syncLocalAuthStatus,
    syncLocalAuthUsers,
    syncLocalProjectMembership,
    syncSettingsIntegrationReadiness,
    syncSettingsProviderRuntime,
    t,
    toolGrantPolicySaving,
    updateProjectLanguageSetting,
    updateProjectPrivacyPolicySetting,
    updateProjectProviderBudgetPolicySetting,
    updateProjectWorkspacePolicySetting,
    workspaceBindDraft,
    workspacePolicySaving,
  } = view;

    const closeSettingsDialog = () => {
      setSettingsOpen(false);
      setFocusedModelSetup(false);
    };
    const openLocalServiceSettings = () => {
      setFocusedModelSetup(false);
      setSettingsTab('deployment');
    };
    const navItems = [
      { id: 'keys', label: t('settings.keys'), icon: KeyRound },
      { id: 'account', label: activeLanguage === 'zh' ? '本地账户' : 'Local account', icon: UserCircle },
      { id: 'deployment', label: t('settings.deployment'), icon: Server },
      { id: 'health', label: activeLanguage === 'zh' ? '运行检查' : 'Health', icon: Activity },
      { id: 'privacy', label: t('settings.privacy'), icon: Shield },
      { id: 'workspace', label: t('settings.workspace'), icon: SlidersHorizontal },
      { id: 'integrations', label: t('settings.integrations'), icon: PlugZap },
    ];

    const fieldClass = 'w-full border border-[#d1d0c9] bg-[#f8f6ee] px-3 py-2 font-mono text-xs text-[#1a1a1a] outline-none transition-colors focus:border-[#1a1a1a]';
    const labelClass = 'font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]';
    const activeProjectSettingsDraft = activeProject?.id
      ? (projectSettingsDraftRef.current[activeProject.id] || {})
      : {};
    const activePrivacyPolicy = activeProjectSettingsDraft.privacyPolicy || activeProject?.projectSettings?.privacyPolicy || {};
    const privacyPolicy = {
      retentionMode: activePrivacyPolicy.retentionMode || 'project-local',
      modelTrainingAllowed: activePrivacyPolicy.modelTrainingAllowed === true,
      providerLogMode: activePrivacyPolicy.providerLogMode || 'redacted',
      evidenceExportRequiresApproval: activePrivacyPolicy.evidenceExportRequiresApproval !== false,
      readyForProduction: activePrivacyPolicy.readyForProduction === true,
    };
    const activeProviderBudgetPolicy = activeProjectSettingsDraft.providerBudgetPolicy || activeProject?.projectSettings?.providerBudgetPolicy || {};
    const providerBudgetPolicy = {
      dailyBudgetCents: Number(activeProviderBudgetPolicy.dailyBudgetCents) || 0,
      maxRequestsPerProjectHour: Number(activeProviderBudgetPolicy.maxRequestsPerProjectHour) || 0,
      currency: activeProviderBudgetPolicy.currency || 'USD',
      readyForProduction: activeProviderBudgetPolicy.readyForProduction === true,
    };
    const activeToolGrantPolicy = activeProjectSettingsDraft.toolGrantPolicy || activeProject?.projectSettings?.toolGrantPolicy || {};
    const toolGrantPolicy = {
      defaultToolGrants: Array.isArray(activeToolGrantPolicy.defaultToolGrants)
        ? activeToolGrantPolicy.defaultToolGrants
        : DEFAULT_SETTINGS_TOOL_GRANTS,
      agentToolGrants: activeToolGrantPolicy.agentToolGrants || {},
      readyForProduction: activeToolGrantPolicy.readyForProduction === true,
    };
    const activeWorkspacePolicy = activeProjectSettingsDraft.workspacePolicy || activeProject?.projectSettings?.workspacePolicy || {};
    const workspacePolicy = {
      interfaceDensity: activeWorkspacePolicy.interfaceDensity || 'comfortable',
      defaultVisibility: activeWorkspacePolicy.defaultVisibility || 'team',
      autosaveCadenceSeconds: Number(activeWorkspacePolicy.autosaveCadenceSeconds) || 60,
      readyForProduction: activeWorkspacePolicy.readyForProduction === true,
    };
    const activeToolGrantSet = new Set(toolGrantPolicy.defaultToolGrants);
    const integrationCapabilities = activeProject?.projectSettings?.integrationCapabilities || null;
    const workspaceCapabilities = activeProject?.projectSettings?.workspaceCapabilities || null;
    const workspaceCapabilityRows = Array.isArray(workspaceCapabilities?.rows)
      ? workspaceCapabilities.rows
      : [];
    const workspaceCapabilitySummary = workspaceCapabilities?.summary || {};
    const workspaceCapabilityBackendRequiredLabel = workspaceCapabilities
      ? String(workspaceCapabilitySummary.backendRequiredCount ?? 0)
      : 'not synced';
    const currentWorkspaceRuntime = activeProject?.localRuntime || {};
    const currentWorkspacePath = currentWorkspaceRuntime.workspacePath || workspaceBindDraft.receipt?.workspacePath || '';
    const currentWorkspaceBoundAt = currentWorkspaceRuntime.workspaceBoundAt || workspaceBindDraft.receipt?.workspaceBoundAt || null;
    const backendMeetingSummaries = backendStation.meetingSummaries?.projectId === activeProject?.id
      ? backendStation.meetingSummaries
      : null;
    const meetingSummaryRows = Array.isArray(backendMeetingSummaries?.rows)
      ? backendMeetingSummaries.rows
      : [];
    const meetingSummarySourceStatus = backendMeetingSummaries?.schemaVersion === 'meeting-summaries/v1'
      ? 'backend-backed'
      : 'backend-required';
    const meetingSummarySourceClass = meetingSummarySourceStatus === 'backend-backed'
      ? 'border-[#59684b] text-[#3f5136]'
      : 'border-[#b9a55f] text-[#75631d]';
    const meetingSummarySourceDetail = backendMeetingSummaries?.schemaVersion === 'meeting-summaries/v1'
      ? 'Backend meeting-summaries/v1 route synced'
      : 'Sync /projects/:id/meeting-summaries before trusting summaries';
    const backendProjectMemoryReadiness = backendStation.projectMemoryReadiness?.projectId === activeProject?.id
      ? backendStation.projectMemoryReadiness
      : (
          String(backendStation.readyPackageSubmodelsProjectId || '').toLowerCase() === String(activeProject?.id || '').toLowerCase()
            ? backendStation.readyPackageSubmodels?.projectMemoryReadiness || null
            : null
        );
    const projectMemoryReadinessSourceStatus = backendProjectMemoryReadiness?.schemaVersion === 'project-memory-readiness/v1'
      ? 'backend-backed'
      : 'backend-required';
    const projectMemoryReadinessSourceClass = projectMemoryReadinessSourceStatus === 'backend-backed'
      ? 'border-[#59684b] text-[#3f5136]'
      : 'border-[#b9a55f] text-[#75631d]';
    const projectMemoryReadinessSourceDetail = backendProjectMemoryReadiness?.schemaVersion === 'project-memory-readiness/v1'
      ? 'Backend project-memory-readiness/v1 route synced'
      : 'Sync /projects/:id/memory-readiness before trusting memory readiness';
    const projectMemoryReadinessRows = Array.isArray(backendProjectMemoryReadiness?.rows)
      ? backendProjectMemoryReadiness.rows
      : [];
    const projectMemoryReadinessGates = Array.isArray(backendProjectMemoryReadiness?.gates)
      ? backendProjectMemoryReadiness.gates
      : [];
    const settingsActiveProjectIdKey = String(activeProject?.id || '').toLowerCase();
    const scopedProviderRuntimeReadModel = (readModel = null) => {
      if (!readModel) return null;
      const readModelProjectId = String(
        readModel.projectId
        || readModel.project?.id
        || providerRuntimeStatus.projectId
        || ''
      ).toLowerCase();
      return !settingsActiveProjectIdKey || !readModelProjectId || readModelProjectId === settingsActiveProjectIdKey
        ? readModel
        : null;
    };
    const backendSettingsIntegrationReadiness = scopedProviderRuntimeReadModel(providerRuntimeStatus.settingsIntegrationReadiness)?.schemaVersion === 'settings-integration-readiness/v1'
      ? scopedProviderRuntimeReadModel(providerRuntimeStatus.settingsIntegrationReadiness)
      : (
          String(backendStation.readyPackageSubmodelsProjectId || '').toLowerCase() === String(activeProject?.id || '').toLowerCase()
            ? backendStation.readyPackageSubmodels?.settingsIntegrationReadiness || null
            : null
        );
    const settingsIntegrationReadinessSourceStatus = backendSettingsIntegrationReadiness?.schemaVersion === 'settings-integration-readiness/v1'
      ? 'backend-backed'
      : 'backend-required';
    const settingsIntegrationReadinessSourceClass = settingsIntegrationReadinessSourceStatus === 'backend-backed'
      ? 'border-[#59684b] text-[#3f5136]'
      : 'border-[#b9a55f] text-[#75631d]';
    const settingsIntegrationReadinessSourceDetail = backendSettingsIntegrationReadiness?.schemaVersion === 'settings-integration-readiness/v1'
      ? 'Backend settings-integration-readiness/v1 route synced'
      : 'Sync /projects/:id/settings-integration-readiness before trusting integration readiness';
    const settingsBackendProjectWriteAvailable = shouldAttemptBackendProjectWrite(activeProject);
    const settingsBackendProjectSyncDisabled = !settingsBackendProjectWriteAvailable || backendStation.loading;
    const settingsProviderProjectSyncDisabled = !settingsBackendProjectWriteAvailable || providerRuntimeStatus.running;

    const SettingField = ({ label, hint, children }) => (
      <div className="space-y-2">
        <div className={labelClass}>{localizeText(label, activeLanguage)}</div>
        {children}
        {hint && <p className="font-mono text-[10px] leading-relaxed text-[#8b8678]">{localizeText(hint, activeLanguage)}</p>}
      </div>
    );

    const SmallButton = ({ children, onClick, disabled = false, ...buttonProps }) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        {...buttonProps}
        className={`border border-[#1a1a1a] bg-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#f5f4f0] transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#3a3429]'}`}
      >
        {children}
      </button>
    );

    const tabTitle = focusedModelSetup
      ? (activeLanguage === 'zh' ? '配置模型' : 'Configure model')
      : settingsTab === 'models'
      ? (activeLanguage === 'zh' ? '模型技术状态' : 'Model technical status')
      : navItems.find(item => item.id === settingsTab)?.label;
    const healthRows = healthCheck.rows.length ? healthCheck.rows : [
      { id: 'backend', label: 'Backend worker station', status: 'idle', detail: 'Not checked yet.' },
      { id: 'provider', label: 'Model provider config', status: 'idle', detail: 'Not checked yet.' },
      { id: 'request', label: 'Model request loop', status: 'idle', detail: 'Not checked yet.' },
      { id: 'workflow', label: 'Workflow smoke', status: 'idle', detail: 'Run workflow smoke when you want to validate autonomous collaboration.' },
    ];
    const healthStatusClass = {
      pass: 'border-green-700 bg-green-50 text-green-800',
      fail: 'border-red-800 bg-red-50 text-red-800',
      blocked: 'border-[#8f1e18] bg-red-50 text-[#8f1e18]',
      running: 'border-[#8f1e18] bg-[#f7edcf] text-[#8f1e18]',
      pending: 'border-[#d1d0c9] bg-[#f8f6ee] text-[#7d786b]',
      idle: 'border-[#d1d0c9] bg-[#f8f6ee] text-[#7d786b]',
    };
    const healthStatusLabel = {
      pass: '通过',
      fail: '失败',
      blocked: '需要处理',
      running: '检查中',
      pending: '等待检查',
      idle: '尚未检查',
    };
    const settingsProviderReadiness = scopedProviderRuntimeReadModel(providerRuntimeStatus.settingsProviderReadiness)?.schemaVersion === 'settings-provider-readiness/v1'
      ? scopedProviderRuntimeReadModel(providerRuntimeStatus.settingsProviderReadiness)
      : null;
    const settingsRuntimeReadiness = scopedProviderRuntimeReadModel(providerRuntimeStatus.settingsRuntimeReadiness)?.schemaVersion === 'settings-runtime-readiness/v1'
      ? scopedProviderRuntimeReadModel(providerRuntimeStatus.settingsRuntimeReadiness)
      : null;
    const settingsProviderReadinessDisplayRoute = activeProject?.id
      ? `/projects/${activeProject.id}/settings-provider-readiness`
      : '/settings/provider-readiness';
    const settingsRuntimeReadinessDisplayRoute = activeProject?.id
      ? `/projects/${activeProject.id}/settings-runtime-readiness`
      : '/settings/runtime-readiness';
    const settingsProviderReadinessSourceStatus = settingsProviderReadiness?.schemaVersion === 'settings-provider-readiness/v1'
      ? 'backend-backed'
      : 'backend-required';
    const settingsProviderReadinessSourceClass = settingsProviderReadinessSourceStatus === 'backend-backed'
      ? 'border-[#59684b] text-[#3f5136]'
      : 'border-[#b9a55f] text-[#75631d]';
    const settingsProviderReadinessSourceDetail = settingsProviderReadiness?.schemaVersion === 'settings-provider-readiness/v1'
      ? 'Backend settings-provider-readiness/v1 route synced'
      : backendUrlConfigured
        ? `Click Sync status to read ${settingsProviderReadinessDisplayRoute}`
        : 'Save Backend URL in Deployment before provider draft entry or readiness sync';
    const settingsRuntimeReadinessSourceStatus = settingsRuntimeReadiness?.schemaVersion === 'settings-runtime-readiness/v1'
      ? 'backend-backed'
      : 'backend-required';
    const settingsRuntimeReadinessSourceClass = settingsRuntimeReadinessSourceStatus === 'backend-backed'
      ? 'border-[#59684b] text-[#3f5136]'
      : 'border-[#b9a55f] text-[#75631d]';
    const settingsRuntimeReadinessSourceDetail = settingsRuntimeReadiness?.schemaVersion === 'settings-runtime-readiness/v1'
      ? 'Backend settings-runtime-readiness/v1 route synced'
      : backendUrlConfigured
        ? `Click Sync runtime to read ${settingsRuntimeReadinessDisplayRoute}`
        : 'Save Backend URL in Deployment before runtime readiness sync';
    const settingsRuntimeRows = Array.isArray(settingsRuntimeReadiness?.rows)
      ? settingsRuntimeReadiness.rows
      : [];
    const settingsProviderVaultBindings = scopedProviderRuntimeReadModel(providerRuntimeStatus.providerVaultBindings);
    const localMvpStartupReadiness = providerRuntimeStatus.localMvpStartupReadiness?.schemaVersion === 'local-mvp-startup-readiness/v1'
      ? providerRuntimeStatus.localMvpStartupReadiness
      : null;
    const settingsSecretVaultReady = Boolean(settingsProviderReadiness?.canSealSecrets ?? providerRuntimeStatus.secretVaultStatus?.ready);
    const settingsSecretVaultUnreachable = providerRuntimeStatus.secretVaultStatus?.provider === 'unreachable';
    const settingsSecretVaultStatusSynced = Boolean(providerRuntimeStatus.secretVaultStatus) && !settingsSecretVaultUnreachable;
    const settingsSecretVaultBadgeLabel = settingsSecretVaultReady
      ? 'ready'
      : settingsSecretVaultUnreachable
        ? 'backend unreachable'
        : settingsSecretVaultStatusSynced
          ? 'vault required'
          : 'sync required';
    const settingsSecretVaultBadgeClass = settingsSecretVaultReady
      ? healthStatusClass.pass
      : settingsSecretVaultUnreachable
        ? healthStatusClass.fail
        : settingsSecretVaultStatusSynced
          ? healthStatusClass.fail
          : healthStatusClass.pending;
    const settingsProviderCanTypeApiFields = settingsProviderReadiness?.canTypeApiFields !== false;
    const settingsProviderSealReady = Boolean(backendUrlConfigured && settingsSecretVaultReady);
    const settingsProviderSecretInputReady = Boolean(backendUrlConfigured && settingsProviderCanTypeApiFields && !providerSecretDrafts.running);
    const settingsProviderSecretInputStateLabel = settingsProviderSecretInputReady
      ? (settingsProviderSealReady ? 'input and seal enabled' : 'draft input enabled')
      : 'input locked';
    const settingsSecretVaultUnavailableMessage = settingsSecretVaultUnreachable
      ? 'Seal is locked because the backend status route is unreachable. Draft input stays in memory only; save the backend URL in Deployment, start agents:server with Secret Vault env, then Sync status.'
      : settingsSecretVaultStatusSynced
      ? 'Seal is locked because the Secret Vault is not ready. You can type a temporary draft after saving the backend URL, but saving requires SECRET_VAULT_ENABLED=true and SECRET_VAULT_KEY.'
      : 'Seal is locked until backend provider status is synced. You can type a temporary draft after saving the backend URL; the browser will not persist provider secrets.';
    const settingsSecretVaultActionMessage = settingsSecretVaultReady
      ? (settingsProviderReadiness?.uiGuidance?.message || 'Provider secret fields are enabled and can be sealed through the backend Vault. Plaintext is cleared after the receipt returns.')
      : (settingsProviderReadiness?.uiGuidance?.message || 'Provider secret draft fields are editable after a backend URL is saved, but Seal is locked until the saved backend target and Secret Vault are ready. The browser will not persist provider secrets.');
    const settingsSecretVaultSetupRows = [
      ['Target backend', backendConfiguredTargetLabel],
      ['Local vault', 'auto-loaded from .tmp/agent-local-user-runtime.json'],
      ['API fields after refresh', 'plaintext stays blank; backend Vault status is the saved source of truth'],
      ['Startup preflight route', localMvpStartupReadiness?.backendRoutes?.localMvpStartupReadiness || '/local-mvp-startup-readiness'],
      ['Startup readiness', localMvpStartupReadiness?.status || 'not synced'],
      ['Startup next action', localMvpStartupReadiness?.nextAction?.label || 'Sync local MVP startup readiness'],
      ['Settings / provider / first run', `${localMvpStartupReadiness?.readyForSettingsEntry ? 'yes' : 'unknown'} / ${localMvpStartupReadiness?.readyForProviderSetup ? 'yes' : 'no'} / ${localMvpStartupReadiness?.readyForFirstProjectRun ? 'yes' : 'no'}`],
      ['Readiness route', '/settings/provider-readiness and /secret-vault/status'],
      ['Seal route', '/secret-vault/seal after canSealSecrets=true'],
    ];
    const providerStatusReachedBackend = (status) => Boolean(
      status
      && status.provider
      && status.provider !== 'unreachable'
    );
    const settingsBackendReady = backendUrlConfigured && (
      backendStation.connectionStatus === 'online'
      || Boolean(settingsProviderReadiness)
      || settingsSecretVaultReady
      || Boolean(providerRuntimeStatus.secretVaultStatus?.ready)
      || providerStatusReachedBackend(providerRuntimeStatus.modelProvider)
      || providerStatusReachedBackend(providerRuntimeStatus.searchProvider)
    );
    const settingsHealthCheckedForTarget = backendUrlConfigured
      && Boolean(healthCheck.lastRunAt)
      && Boolean(healthCheck.summary)
      && normalizeBackendBaseUrl(healthCheck.baseUrl || DEFAULT_AGENT_BACKEND_URL) === committedBackendBaseUrl();
    const settingsHealthRows = Array.isArray(healthCheck.rows) ? healthCheck.rows : [];
    const settingsHealthHasFailure = Boolean(healthCheck.error)
      || ['failed', 'blocked'].includes(String(healthCheck.summary || '').toLowerCase())
      || settingsHealthRows.some(row => ['fail', 'blocked'].includes(String(row.status || '').toLowerCase()));
    const settingsHealthPassedForTarget = settingsHealthCheckedForTarget && !settingsHealthHasFailure;
    const settingsBackendFooterReady = settingsBackendReady && settingsHealthPassedForTarget;
    const settingsBackendStatusLabel = activeLanguage === 'zh'
      ? !backendUrlConfigured
        ? '请先保存并同步本地服务地址，再填写模型密钥'
        : !settingsHealthCheckedForTarget
          ? '本地服务地址已保存；首次创建项目前请运行健康检查'
          : settingsHealthHasFailure
            ? '健康检查未通过；请先完成本地服务设置'
            : settingsBackendReady
              ? '本地服务已就绪，本项目的设置会自动保存'
              : providerRuntimeStatus.lastRunAt || backendStation.connectionStatus === 'offline'
                ? '本地安全存储尚未就绪，模型密钥暂未保存'
                : '请先同步本地服务状态，再填写模型密钥'
      : !backendUrlConfigured
        ? 'Save and sync the backend URL before entering provider secrets'
        : !settingsHealthCheckedForTarget
          ? 'Backend target saved; run Health check before first project'
          : settingsHealthHasFailure
            ? 'Health check failed or blocked; backend setup required before first project'
            : settingsBackendReady
              ? 'Backend-backed controls save on change for this project'
              : providerRuntimeStatus.lastRunAt || backendStation.connectionStatus === 'offline'
                ? 'Provider drafts are in-memory only until backend Secret Vault readiness is synced'
                : 'Sync backend readiness before entering provider secrets';
    const SettingsBackendStatusIcon = settingsBackendFooterReady ? CheckCircle2 : Server;
    const settingsFooterConnectionLabel = backendUrlConfigured && !settingsHealthPassedForTarget
      ? (activeLanguage === 'zh' ? '运行健康检查' : 'Run Health Check')
      : t('settings.testConnection');
    const settingsProviderApiEntryRows = [
      ['API input fields', settingsProviderSecretInputReady ? 'enabled as transient draft after backend URL' : 'locked until backend URL is saved'],
      ['Seal persistence', settingsSecretVaultReady ? 'available through /secret-vault/seal' : 'waiting for backend Secret Vault'],
      ['Draft persistence', 'memory only until Seal succeeds'],
      ['Refresh behavior', 'saved credentials stay in backend Vault; plaintext fields are intentionally empty'],
      ['Browser persistence', settingsProviderReadiness?.browserPersistsSecrets === true ? 'blocked: unexpected browser persistence' : 'disabled'],
      ['Plaintext after Seal', 'cleared after backend receipt'],
    ];
    const settingsWorkflowSmoke = healthCheck.workflowSmoke?.schemaVersion === 'settings-workflow-smoke/v1'
      ? healthCheck.workflowSmoke
      : null;
    const settingsWorkflowSmokeProofRows = settingsWorkflowSmoke ? [
      ['Probe project', settingsWorkflowSmoke.project?.id || settingsWorkflowSmoke.projectId || 'missing'],
      ['Submission', `${settingsWorkflowSmoke.submission?.artifactType || 'missing'} / ${settingsWorkflowSmoke.submission?.id || 'missing'}`],
      ['Provider Evidence', `${settingsWorkflowSmoke.providerEvidenceProof?.status || 'missing'} / ${settingsWorkflowSmoke.providerEvidenceProof?.provider || 'provider'} / sources ${settingsWorkflowSmoke.providerEvidenceProof?.sourceCount ?? 'missing'}`],
      ['Evidence Search', settingsWorkflowSmoke.providerEvidenceProof?.evidenceSearchRoute || settingsWorkflowSmoke.evidenceSearch?.route || 'missing'],
      ['Provider Usage', settingsWorkflowSmoke.providerEvidenceProof?.providerUsageRoute || settingsWorkflowSmoke.providerUsage?.route || 'missing'],
      ['Flow Graph', settingsWorkflowSmoke.graphProof?.route || 'missing'],
      ['Proof Map', settingsWorkflowSmoke.proofMapProof?.route || 'missing'],
      ['Group Chat', settingsWorkflowSmoke.transcriptProof?.route || 'missing'],
      ['Timeline', settingsWorkflowSmoke.timelineProof?.route || 'missing'],
      ['Event Ledger', settingsWorkflowSmoke.eventLedgerProof?.route || 'missing'],
    ] : [];

    return (
      <Suspense fallback={<div className="fixed inset-0 z-[120] bg-black/45"><LazyPanelFallback /></div>}>
        <SettingsDialogShell
          navItems={navItems}
          activeTab={settingsTab}
          onTabChange={setSettingsTab}
          onClose={closeSettingsDialog}
          closeLabel={t('common.close')}
          directorName={t('nav.studioDirector')}
          directorHandle={t('nav.directorHandle')}
          eyebrow={t('settings.title')}
          title={tabTitle}
          StatusIcon={SettingsBackendStatusIcon}
          footerReady={settingsBackendFooterReady}
          footerLabel={settingsBackendStatusLabel}
          connectionLabel={settingsFooterConnectionLabel}
          onConnectionTest={runSettingsFooterConnectionTest}
          connectionDisabled={healthCheck.running || !backendUrlConfigured}
          focused={focusedModelSetup}
          showFooter={!focusedModelSetup}
        >
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
              {settingsTab === 'account' && (
                <Suspense fallback={<LazyPanelFallback />}>
                <LocalAccountSettings
                  labelClass={labelClass}
                  SmallButton={SmallButton}
                  backendUrlConfigured={backendUrlConfigured}
                  onOpenDeployment={setSettingsTab}
                  localAuthStatus={localAuthStatus}
                  syncLocalAuthStatus={syncLocalAuthStatus}
                  localAuthSession={localAuthSessionForCurrentBackend}
                  localAuthDraft={localAuthDraft}
                  setLocalAuthDraft={setLocalAuthDraft}
                  submitLocalAuth={submitLocalAuth}
                  localAuthPasswordDraft={localAuthPasswordDraft}
                  setLocalAuthPasswordDraft={setLocalAuthPasswordDraft}
                  changeLocalAuthPassword={changeLocalAuthPassword}
                  localAuthUsers={localAuthUsers}
                  syncLocalAuthUsers={syncLocalAuthUsers}
                  localAuthUserDraft={localAuthUserDraft}
                  setLocalAuthUserDraft={setLocalAuthUserDraft}
                  createLocalAuthUser={createLocalAuthUser}
                  disableLocalAuthUser={disableLocalAuthUser}
                  activeProject={activeProject}
                  localProjectMembership={localProjectMembership}
                  syncLocalProjectMembership={syncLocalProjectMembership}
                  setLocalProjectUserAccess={setLocalProjectUserAccess}
                />
                </Suspense>
              )}

              {settingsTab === 'deployment' && (
                <Suspense fallback={<LazyPanelFallback />}>
                  <LocalDeploymentSettings
                    labelClass={labelClass}
                    SmallButton={SmallButton}
                    backendUrlConfigured={backendUrlConfigured}
                    backendConfiguredTargetLabel={backendConfiguredTargetLabel}
                    backendStation={backendStation}
                    onBackendUrlDraftChange={(value) => setBackendStation(prev => ({ ...prev, draftBaseUrl: value }))}
                    onSaveBackendUrl={saveBackendBaseUrl}
                    onSyncRuntime={() => syncSettingsProviderRuntime({ runTests: false })}
                    providerRuntimeStatus={providerRuntimeStatus}
                    settingsRuntimeReadiness={settingsRuntimeReadiness}
                    settingsRuntimeRows={settingsRuntimeRows}
                    settingsRuntimeReadinessSourceClass={settingsRuntimeReadinessSourceClass}
                    settingsRuntimeReadinessSourceStatus={settingsRuntimeReadinessSourceStatus}
                    settingsRuntimeReadinessSourceDetail={settingsRuntimeReadinessSourceDetail}
                    healthStatusClass={healthStatusClass}
                    activeProject={activeProject}
                    settingsProviderVaultBindings={settingsProviderVaultBindings}
                  />
                </Suspense>
              )}

              {settingsTab === 'keys' && (
                <div className="space-y-5" data-testid={focusedModelSetup ? 'first-run-model-setup' : undefined}>
                  {focusedModelSetup && (
                    <div className="border border-[#b9a55f] bg-[#fff8e7] p-4">
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8f1e18]">{activeLanguage === 'zh' ? '首次设置 · 唯一任务' : 'First setup · One task'}</div>
                      <p className="mt-2 text-sm leading-relaxed text-[#5c574d]">{activeLanguage === 'zh' ? '选择模型提供商，填写所需连接信息并保存。健康检查、部署和其他管理功能可稍后从“设置”进入。' : 'Choose a model provider, enter the required connection details, and save. Health, deployment, and other administration remain available later in Settings.'}</p>
                    </div>
                  )}
                  <Suspense fallback={<LazyPanelFallback />}>
                  <LocalModelSettings
                    backendUrlConfigured={backendUrlConfigured}
                    targetLabel={backendConfiguredTargetLabel}
                    providerRuntimeStatus={providerRuntimeStatus}
                    secretInputReady={settingsProviderSecretInputReady}
                    sealReady={settingsProviderSealReady}
                    activeLanguage={activeLanguage}
                    drafts={providerSecretDrafts}
                    setDrafts={setProviderSecretDrafts}
                    onSync={() => syncSettingsProviderRuntime({ runTests: false })}
                    onTest={() => syncSettingsProviderRuntime({ runTests: true })}
                    onSaveModel={(options) => sealSettingsProviderSecret('model', options)}
                    onSaveSearch={() => sealSettingsProviderSecret('search')}
                    onOpenLocalService={openLocalServiceSettings}
                  />
                  </Suspense>
                  {!focusedModelSetup && <div className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                    <button type="button" data-testid="settings-open-model-technical-status" onClick={() => setSettingsTab('models')} className="text-sm underline underline-offset-4">
                      {activeLanguage === 'zh' ? '查看模型技术状态' : 'View model technical status'}
                    </button>
                  </div>}
                  {focusedModelSetup && providerRuntimeStatus.modelProvider?.configured && (
                    <button type="button" data-testid="first-run-model-setup-complete" onClick={closeSettingsDialog} className="w-full border border-[#251b13] bg-[#251b13] px-6 py-3 text-white">
                      {activeLanguage === 'zh' ? '完成并返回' : 'Finish and return'}
                    </button>
                  )}
                </div>
              )}

              {false && settingsTab === 'keys' && (
                <div className="space-y-6" data-testid="settings-provider-boundary">
                  <div className="border border-[#d1d0c9] bg-[#f5f4f0] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-2xl">
                        <div className={labelClass}>BYOK Runtime Boundary</div>
                        <h3 className="mt-2 font-serif text-2xl leading-none text-[#1a1a1a]">Backend-owned provider credentials</h3>
                        <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                          The frontend never stores provider keys. It only reads redacted backend status, runs provider tests through backend routes, and shows whether the secret-vault boundary is active.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SmallButton
                          data-testid="settings-provider-sync-status"
                          onClick={() => syncSettingsProviderRuntime({ runTests: false })}
                          disabled={providerRuntimeStatus.running || !backendUrlConfigured}
                        >
                          <RefreshCw size={12} className="inline-block mr-2" />Sync status
                        </SmallButton>
                        <button
                          type="button"
                          data-testid="settings-provider-runtime-test"
                          onClick={() => syncSettingsProviderRuntime({ runTests: true })}
                          disabled={providerRuntimeStatus.running || !backendUrlConfigured}
                          className={`border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${providerRuntimeStatus.running || !backendUrlConfigured ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                        >
                          <Play size={12} className="inline-block mr-2" />Run tests
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#7d786b] md:grid-cols-2">
                      <div data-testid="settings-provider-base-url" className="break-all">Target: {backendConfiguredTargetLabel}</div>
                      <div>Last sync: {providerRuntimeStatus.lastRunAt ? new Date(providerRuntimeStatus.lastRunAt).toLocaleTimeString() : 'never'}</div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {[
                      {
                        id: 'model',
                        label: 'Model provider',
                        route: '/llm/status',
                        testRoute: '/llm/test',
                        status: providerRuntimeStatus.modelProvider,
                        test: providerRuntimeStatus.modelTest,
                      },
                      {
                        id: 'search',
                        label: 'Evidence provider',
                        route: '/search/status',
                        testRoute: '/search/test',
                        status: providerRuntimeStatus.searchProvider,
                        test: providerRuntimeStatus.searchTest,
                      },
                    ].map(item => {
                      const status = item.status || {};
                      const ready = Boolean(status.enabled && status.configured);
                      const configuredButDisabled = Boolean(status.configured && !status.enabled);
                      const hasBackendKey = Boolean(status.hasApiKey || status.apiKeySource === 'not-required');
                      const statusLabel = ready
                        ? 'Backend ready'
                        : configuredButDisabled
                          ? 'Runtime disabled'
                          : hasBackendKey
                            ? 'Key saved'
                            : 'Vault required';
                      const statusClass = ready
                        ? healthStatusClass.pass
                        : configuredButDisabled || hasBackendKey
                          ? healthStatusClass.pending
                          : healthStatusClass.pending;
                      const vault = status.secretVault || {};
                      const testStatus = item.test ? (item.test.ok ? 'pass' : 'fail') : 'idle';
                      return (
                        <div key={item.id} data-testid={`settings-provider-${item.id}-status`} className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className={labelClass}>{item.route}</div>
                              <div className="mt-2 font-serif text-xl leading-tight">{item.label}</div>
                            </div>
                            <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f5a50]">
                            <div>Provider: {status.provider || 'not synced'}</div>
                            <div>Configured: {status.configured ? 'yes' : 'no'} / enabled: {status.enabled ? 'yes' : 'no'}</div>
                            <div>Runtime enabled: {status.runtimeEnabled ? 'yes' : 'no'} / source {status.enabledSource || 'not synced'}</div>
                            <div>Secret source: {status.apiKeySource || (status.hasApiKey ? 'configured' : 'missing')}</div>
                      <div>API field: {settingsProviderSecretInputReady ? 'draft enabled' : 'locked'} / Seal: {settingsProviderSealReady ? 'available' : 'waiting for Secret Vault'}</div>
                            <div>Vault: {vault.provider || 'none'} / ready {vault.ready ? 'yes' : 'no'} / key {vault.keyId || 'none'}</div>
                            <div>Endpoint source: {status.endpointSource || (status.hasEndpoint ? 'configured' : 'missing')}</div>
                            <div className="break-all">Endpoint: {status.baseURL || status.endpoint || 'not exposed'}</div>
                            <div>Test route: {item.testRoute}</div>
                            <div>Test: <span className={testStatus === 'pass' ? 'text-green-700' : testStatus === 'fail' ? 'text-red-800' : 'text-[#7d786b]'}>{item.test ? (item.test.ok ? 'pass' : item.test.reason || item.test.error || 'failed') : 'not run'}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div data-testid="settings-provider-vault-bindings" className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className={labelClass}>/provider-vault-bindings</div>
                        <div className="mt-2 font-serif text-xl leading-tight">Provider-vault binding proof</div>
                      </div>
                      <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${settingsProviderVaultBindings?.redaction?.rawLeakCount === 0 && settingsProviderVaultBindings?.summary?.boundProviderCount > 0 ? healthStatusClass.pass : healthStatusClass.idle}`}>
                        {settingsProviderVaultBindings?.summary?.boundProviderCount > 0 ? 'vault backed' : 'sync required'}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f5a50] md:grid-cols-2">
                      <div>Schema: {settingsProviderVaultBindings?.schemaVersion || 'not synced'}</div>
                      <div>Bound providers: {settingsProviderVaultBindings?.summary?.boundProviderCount ?? 'not synced'}</div>
                      <div>Vault records: {settingsProviderVaultBindings?.summary?.encryptedVaultRecordCount ?? 'not synced'}</div>
                      <div>Redaction leaks: {settingsProviderVaultBindings?.redaction?.rawLeakCount ?? 'not synced'}</div>
                      <div className="break-all md:col-span-2">Project route: {activeProject?.id ? `/projects/${activeProject.id}/provider-vault-bindings` : '/projects/:id/provider-vault-bindings'}</div>
                      <div className="break-all md:col-span-2">Checksum: {settingsProviderVaultBindings?.checksum || 'not synced'}</div>
                    </div>
                  </div>

                  <div data-testid="settings-secret-vault-status" className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className={labelClass}>/secret-vault/status</div>
                        <div className="mt-2 font-serif text-xl leading-tight">Secret vault</div>
                      </div>
                      <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${settingsSecretVaultBadgeClass}`}>
                        {settingsSecretVaultBadgeLabel}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f5a50] md:grid-cols-2">
                      <div>Provider: {providerRuntimeStatus.secretVaultStatus?.provider || 'not synced'}</div>
                      <div>Key: {providerRuntimeStatus.secretVaultStatus?.keyId || 'missing'}</div>
                      <div>Encrypted records: {providerRuntimeStatus.secretVaultStatus?.encryptedRecordCount ?? providerRuntimeStatus.secretVaultRecords?.records?.length ?? 'not synced'}</div>
                      <div>Raw leaks: {providerRuntimeStatus.secretVaultStatus?.rawSecretRecordCount ?? 'not synced'}</div>
                      <div className="break-all md:col-span-2">Seal route: /secret-vault/seal</div>
                    </div>
                    <div data-testid="settings-provider-readiness-contract" className="mt-3 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                      <div>Status: {settingsProviderReadiness?.status || 'not synced'}</div>
                      <div>API fields: {settingsProviderSecretInputReady ? 'enabled for draft entry' : 'locked until backend URL'} / Seal: {settingsProviderSealReady ? 'available' : 'requires backend Vault'}</div>
                      <div>Next action: {settingsProviderReadiness?.actionRequired?.label || 'Sync provider readiness'}</div>
                      <div className="break-all">Readiness route: {settingsProviderReadiness?.backendRoutes?.settingsProviderReadiness || '/settings/provider-readiness'}</div>
                      <div className="break-all">Checksum: {settingsProviderReadiness?.checksum || 'not synced'}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span data-testid="settings-provider-readiness-source" className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${settingsProviderReadinessSourceClass}`}>
                          {settingsProviderReadinessSourceStatus}
                        </span>
                        <span data-testid="settings-provider-readiness-source-detail" className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7d786b]">
                          {settingsProviderReadinessSourceDetail}
                        </span>
                      </div>
                    </div>
                    <div data-testid="settings-secret-vault-local-startup-contract" className="mt-3 border border-[#b9a55f] bg-[#fbf7df] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#75631d]">
                      {settingsSecretVaultSetupRows.map(([label, value]) => (
                        <div key={label} className="break-all">
                          {label}: {value}
                        </div>
                      ))}
                    </div>
                    {!settingsSecretVaultReady && (
                      <div data-testid="settings-secret-vault-unavailable" className="mt-3 border border-red-800 bg-red-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-red-800">
                        {settingsSecretVaultUnavailableMessage}
                      </div>
                    )}
                    <div data-testid="settings-secret-vault-action-required" className={`mt-3 border px-3 py-2 font-mono text-[11px] leading-relaxed ${settingsSecretVaultReady ? 'border-[#59684b] bg-[#eef5df] text-[#3f5136]' : 'border-[#b9a55f] bg-[#fbf7df] text-[#75631d]'}`}>
                      {settingsSecretVaultActionMessage}
                    </div>
                  </div>

                  {providerRuntimeStatus.error && (
                    <div className="border border-red-800 bg-red-50 px-4 py-3 font-mono text-[11px] leading-relaxed text-red-800">
                      {providerRuntimeStatus.error}
                    </div>
                  )}

                  <div data-testid="settings-provider-api-entry-state" className="border border-[#b9a55f] bg-[#fbf7df] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className={labelClass}>API Entry Contract</div>
                        <div className="mt-2 font-serif text-xl leading-tight">Backend Vault unlocks entry; saving is backend-only</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${settingsProviderSecretInputReady ? healthStatusClass.pass : healthStatusClass.pending}`}>
                          {settingsProviderSecretInputStateLabel}
                        </span>
                        <button
                          type="button"
                          data-testid="settings-provider-open-backend-target"
                          onClick={() => setSettingsTab('deployment')}
                          className="border border-[#1a1a1a] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-[#f5f4f0]"
                        >
                          Backend URL
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f5a50] md:grid-cols-2">
                      {settingsProviderApiEntryRows.map(([label, value]) => (
                        <div key={label} className="break-all">
                          {label}: {value}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <SettingField label="Model Base URL" hint="Local OpenAI-compatible runtimes such as Ollama use their own API base URL.">
                      <input
                        className={`${fieldClass} ${!settingsProviderSecretInputReady ? 'cursor-not-allowed opacity-50' : ''}`}
                        data-testid="settings-provider-model-base-url-input"
                        type="text"
                        autoComplete="off"
                        value={providerSecretDrafts.modelBaseUrl}
                        placeholder={providerRuntimeStatus.modelProvider?.baseURL || (settingsProviderSecretInputReady ? 'http://127.0.0.1:11434/v1' : 'Save backend URL before entry')}
                        disabled={!settingsProviderSecretInputReady}
                        onChange={(event) => setProviderSecretDrafts(prev => ({ ...prev, modelBaseUrl: event.target.value, lastReceipt: null, error: null }))}
                      />
                    </SettingField>
                    <SettingField label="Model ID" hint="Use the provider model name that belongs to the Base URL.">
                      <input
                        className={`${fieldClass} ${!settingsProviderSecretInputReady ? 'cursor-not-allowed opacity-50' : ''}`}
                        data-testid="settings-provider-model-name-input"
                        type="text"
                        autoComplete="off"
                        value={providerSecretDrafts.modelName}
                        placeholder={providerRuntimeStatus.modelProvider?.model || (settingsProviderSecretInputReady ? 'llama3.2' : 'Save backend URL before entry')}
                        disabled={!settingsProviderSecretInputReady}
                        onChange={(event) => setProviderSecretDrafts(prev => ({ ...prev, modelName: event.target.value, lastReceipt: null, error: null }))}
                      />
                    </SettingField>
                    <SettingField label="Model API Key" hint="Tested with Base URL and Model ID first; only a passing model configuration is saved.">
                      <div className="flex gap-2">
                        <input
                          className={`${fieldClass} ${!settingsProviderSecretInputReady ? 'cursor-not-allowed opacity-50' : ''}`}
                          data-testid="settings-provider-model-key-input"
                          type="password"
                          autoComplete="off"
                          value={providerSecretDrafts.modelApiKey}
                          placeholder={providerRuntimeStatus.modelProvider?.hasApiKey ? 'Configured on backend' : settingsProviderSecretInputReady ? (settingsProviderSealReady ? 'Enter model provider key' : 'Enter draft; Seal waits for Vault') : 'Save backend URL before entry'}
                          disabled={!settingsProviderSecretInputReady}
                          onChange={(event) => setProviderSecretDrafts(prev => ({ ...prev, modelApiKey: event.target.value, lastReceipt: null, error: null }))}
                        />
                        <button
                          type="button"
                          data-testid="settings-provider-seal-model-key"
                          onClick={() => sealSettingsProviderSecret('model')}
                          disabled={providerSecretDrafts.running || !settingsProviderSealReady || !providerSecretDrafts.modelApiKey.trim() || !providerSecretDrafts.modelBaseUrl.trim() || !providerSecretDrafts.modelName.trim()}
                          className={`shrink-0 border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${providerSecretDrafts.running || !settingsProviderSealReady || !providerSecretDrafts.modelApiKey.trim() || !providerSecretDrafts.modelBaseUrl.trim() || !providerSecretDrafts.modelName.trim() ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                        >
                          Seal
                        </button>
                      </div>
                    </SettingField>
                    <SettingField label="Evidence Search API Key" hint="Saved through the backend secret-vault seal route; the browser clears the field after submit.">
                      <div className="flex gap-2">
                        <input
                          className={`${fieldClass} ${!settingsProviderSecretInputReady ? 'cursor-not-allowed opacity-50' : ''}`}
                          data-testid="settings-provider-search-key-input"
                          type="password"
                          autoComplete="off"
                          value={providerSecretDrafts.searchApiKey}
                          placeholder={providerRuntimeStatus.searchProvider?.hasApiKey ? 'Configured on backend' : settingsProviderSecretInputReady ? (settingsProviderSealReady ? 'Enter evidence provider key' : 'Enter draft; Seal waits for Vault') : 'Save backend URL before entry'}
                          disabled={!settingsProviderSecretInputReady}
                          onChange={(event) => setProviderSecretDrafts(prev => ({ ...prev, searchApiKey: event.target.value, lastReceipt: null, error: null }))}
                        />
                        <button
                          type="button"
                          data-testid="settings-provider-seal-search-key"
                          onClick={() => sealSettingsProviderSecret('search')}
                          disabled={providerSecretDrafts.running || !settingsProviderSealReady || !providerSecretDrafts.searchApiKey.trim() || !providerSecretDrafts.searchEndpoint.trim()}
                          className={`shrink-0 border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${providerSecretDrafts.running || !settingsProviderSealReady || !providerSecretDrafts.searchApiKey.trim() || !providerSecretDrafts.searchEndpoint.trim() ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                        >
                          Seal
                        </button>
                      </div>
                    </SettingField>
                    <SettingField label="Evidence Search Endpoint" hint="Saved through the backend secret-vault seal route; status shows only a redacted endpoint.">
                      <div className="flex gap-2">
                        <input
                          className={`${fieldClass} ${!settingsProviderSecretInputReady ? 'cursor-not-allowed opacity-50' : ''}`}
                          data-testid="settings-provider-search-endpoint-input"
                          type="text"
                          autoComplete="off"
                          value={providerSecretDrafts.searchEndpoint}
                          placeholder={providerRuntimeStatus.searchProvider?.hasEndpoint ? 'Configured on backend' : settingsProviderSecretInputReady ? (settingsProviderSealReady ? 'Enter evidence search endpoint' : 'Enter draft; Seal waits for Vault') : 'Save backend URL before entry'}
                          disabled={!settingsProviderSecretInputReady}
                          onChange={(event) => setProviderSecretDrafts(prev => ({ ...prev, searchEndpoint: event.target.value, lastReceipt: null, error: null }))}
                        />
                        <button
                          type="button"
                          data-testid="settings-provider-seal-search-endpoint"
                          onClick={() => sealSettingsProviderSecret('searchEndpoint')}
                          disabled={providerSecretDrafts.running || !settingsProviderSealReady || !providerSecretDrafts.searchApiKey.trim() || !providerSecretDrafts.searchEndpoint.trim()}
                          className={`shrink-0 border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${providerSecretDrafts.running || !settingsProviderSealReady || !providerSecretDrafts.searchApiKey.trim() || !providerSecretDrafts.searchEndpoint.trim() ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                        >
                          Seal
                        </button>
                      </div>
                    </SettingField>
                  </div>

                  {(providerSecretDrafts.lastReceipt || providerSecretDrafts.error) && (
                    <div data-testid="settings-provider-seal-receipt" className={`border px-4 py-3 font-mono text-[11px] leading-relaxed ${providerSecretDrafts.error ? 'border-red-800 bg-red-50 text-red-800' : 'border-[#59684b] bg-[#eef5df] text-[#3f5136]'}`}>
                      {providerSecretDrafts.error
                        ? providerSecretDrafts.error
                        : `Sealed ${providerSecretDrafts.lastReceipt?.recordName || providerSecretDrafts.lastReceipt?.name || 'provider secret'} through backend vault / checksum ${providerSecretDrafts.lastReceipt?.checksum || 'recorded'}`}
                    </div>
                  )}

                  <div data-testid="settings-provider-route-contract" className="border border-[#d1d0c9] bg-[#f5f4f0] p-4 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                    Production rule: Manager and Agent autonomy can call model/search providers only through backend provider policy, usage ledger, retry/circuit controls, and vault/KMS status. Public production remains blocked until managed KMS, revocation, centralized audit, cost alerts, calibrated evals, and incident controls are proven.
                  </div>
                </div>
              )}

              {settingsTab === 'models' && (
                <div className="space-y-6" data-testid="settings-model-runtime-boundary">
                  <button type="button" onClick={() => setSettingsTab('keys')} className="text-sm underline underline-offset-4">
                    {activeLanguage === 'zh' ? '返回 AI 模型设置' : 'Back to AI model settings'}
                  </button>
                  <div className="border border-[#d1d0c9] bg-[#f5f4f0] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-2xl">
                        <div className={labelClass}>Model Runtime Contract</div>
                        <h3 className="mt-2 font-serif text-2xl leading-none text-[#1a1a1a]">Models are selected by backend provider policy</h3>
                        <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                          Agent autonomy uses the model provider configured on the backend. The UI shows model/status evidence and can run a backend test, but it does not choose models from a browser-only list.
                        </p>
                      </div>
                      <button
                        type="button"
                        data-testid="settings-model-runtime-test"
                        onClick={() => syncSettingsProviderRuntime({ runTests: true })}
                        disabled={providerRuntimeStatus.running || !backendUrlConfigured}
                        className={`border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${providerRuntimeStatus.running || !backendUrlConfigured ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                      >
                        <Play size={12} className="inline-block mr-2" />Test model
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div data-testid="settings-model-provider-status" className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                      <div className={labelClass}>/llm/status</div>
                      <div className="mt-2 font-serif text-xl leading-tight">{providerRuntimeStatus.modelProvider?.provider || 'Model provider not synced'}</div>
                      <div className="mt-4 grid gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f5a50]">
                        <div>Model: {providerRuntimeStatus.modelProvider?.model || 'not synced'}</div>
                        <div>Configured: {providerRuntimeStatus.modelProvider?.configured ? 'yes' : 'no'} / enabled: {providerRuntimeStatus.modelProvider?.enabled ? 'yes' : 'no'}</div>
                        <div>Concurrency: {providerRuntimeStatus.modelProvider?.maxConcurrency || 'not synced'}</div>
                        <div>Queued: {providerRuntimeStatus.modelProvider?.queuedRequests ?? 'not synced'} / active: {providerRuntimeStatus.modelProvider?.activeRequests ?? 'not synced'}</div>
                        <div>Key source: {providerRuntimeStatus.modelProvider?.apiKeySource || 'not synced'}</div>
                      </div>
                    </div>
                    <div data-testid="settings-model-policy-boundary" className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                      <div className={labelClass}>Policy Boundary</div>
                      <div className="mt-2 font-serif text-xl leading-tight">Provider policy, not browser routing</div>
                      <div className="mt-4 grid gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f5a50]">
                        <div>Status route: /llm/status</div>
                        <div>Test route: /llm/test</div>
                        <div>Search route: /search/status</div>
                        <div>Vault binding route: /provider-vault-bindings</div>
                        <div>Provider enabled: {providerRuntimeStatus.modelProvider?.enabled ? 'yes' : 'no or unsynced'}</div>
                        <div>Production: blocked until provider-readiness and launch gates pass</div>
                      </div>
                    </div>
                  </div>

                  <div data-testid="settings-model-runtime-readiness-contract" className="border border-[#d1d0c9] bg-[#f5f4f0] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className={labelClass}>/settings/runtime-readiness</div>
                        <div className="mt-2 font-serif text-xl leading-tight">Model policy readiness comes from the backend</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span data-testid="settings-model-runtime-readiness-source" className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${settingsRuntimeReadinessSourceClass}`}>
                            {settingsRuntimeReadinessSourceStatus}
                          </span>
                          <span data-testid="settings-model-runtime-readiness-source-detail" className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7d786b]">
                            {settingsRuntimeReadinessSourceDetail}
                          </span>
                        </div>
                      </div>
                      <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
                        settingsRuntimeReadiness?.readyForExplicitProviderTests ? healthStatusClass.pass : settingsRuntimeReadiness ? healthStatusClass.pending : healthStatusClass.idle
                      }`}>
                        {settingsRuntimeReadiness?.readyForExplicitProviderTests ? 'test ready' : settingsRuntimeReadiness?.status || 'not synced'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f5a50] md:grid-cols-2">
                      <div>Model runtime: {settingsRuntimeReadiness?.summary?.modelRuntimeReady ? 'ready' : 'blocked or unsynced'}</div>
                      <div>Search runtime: {settingsRuntimeReadiness?.summary?.searchRuntimeReady ? 'ready' : 'blocked or unsynced'}</div>
                      <div>Vault redaction: {settingsRuntimeReadiness?.summary?.providerVaultRedacted ? 'ready' : 'blocked or unsynced'}</div>
                      <div>Provider tests: {settingsRuntimeReadiness?.readyForExplicitProviderTests ? '/llm/test and /search/test ready' : 'configure provider first'}</div>
                    </div>
                    <div className="mt-3 break-all font-mono text-[10px] leading-relaxed text-[#7d786b]">
                      Route: {settingsRuntimeReadiness?.backendRoutes?.settingsRuntimeReadiness || (activeProject?.id ? `/projects/${activeProject.id}/settings-runtime-readiness` : '/settings/runtime-readiness')}
                    </div>
                  </div>

                  <div data-testid="settings-model-route-contract" className="border border-[#d1d0c9] bg-[#f5f4f0] p-4 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                    Model routing, temperature, max tokens, fallback policy, and per-Agent prompt strategy must be represented by backend provider policy and Agent Skill/persona contracts before they are treated as real controls. Until then, this UI shows runtime proof only.
                  </div>
                </div>
              )}

              {settingsTab === 'privacy' && (
                <Suspense fallback={<LazyPanelFallback />}>
                  <LocalPrivacySettings
                    project={activeProject}
                    policy={privacyPolicy}
                    saving={privacyPolicySaving}
                    canWrite={settingsBackendProjectWriteAvailable}
                    onUpdate={updateProjectPrivacyPolicySetting}
                  />
                </Suspense>
              )}

              {settingsTab === 'workspace' && (
                <Suspense fallback={<LazyPanelFallback />}>
                  <LocalWorkspaceSettings
                    t={t}
                    language={language}
                    setLanguage={setLanguage}
                    activeProject={activeProject}
                    fieldClass={fieldClass}
                    SettingField={SettingField}
                    updateProjectLanguageSetting={updateProjectLanguageSetting}
                    workspacePolicy={workspacePolicy}
                    settingsBackendProjectWriteAvailable={settingsBackendProjectWriteAvailable}
                    workspacePolicySaving={workspacePolicySaving}
                    updateProjectWorkspacePolicySetting={updateProjectWorkspacePolicySetting}
                    workspaceCapabilities={workspaceCapabilities}
                    workspaceCapabilitySummary={workspaceCapabilitySummary}
                    workspaceCapabilityBackendRequiredLabel={workspaceCapabilityBackendRequiredLabel}
                    currentWorkspacePath={currentWorkspacePath}
                    workspaceBindDraft={workspaceBindDraft}
                    setWorkspaceBindDraft={setWorkspaceBindDraft}
                    bindProjectWorkspaceFromSettings={bindProjectWorkspaceFromSettings}
                    settingsBackendProjectSyncDisabled={settingsBackendProjectSyncDisabled}
                    currentWorkspaceBoundAt={currentWorkspaceBoundAt}
                    workspaceCapabilityRows={workspaceCapabilityRows}
                    labelClass={labelClass}
                    SmallButton={SmallButton}
                    syncBackendProjectState={syncBackendProjectState}
                    syncBackendProjectMemoryReadiness={syncBackendProjectMemoryReadiness}
                    projectMemoryReadinessSourceClass={projectMemoryReadinessSourceClass}
                    projectMemoryReadinessSourceStatus={projectMemoryReadinessSourceStatus}
                    projectMemoryReadinessSourceDetail={projectMemoryReadinessSourceDetail}
                    backendProjectMemoryReadiness={backendProjectMemoryReadiness}
                    projectMemoryReadinessRows={projectMemoryReadinessRows}
                    projectMemoryReadinessGates={projectMemoryReadinessGates}
                    syncBackendMeetingSummaries={syncBackendMeetingSummaries}
                    meetingSummarySourceClass={meetingSummarySourceClass}
                    meetingSummarySourceStatus={meetingSummarySourceStatus}
                    meetingSummarySourceDetail={meetingSummarySourceDetail}
                    backendMeetingSummaries={backendMeetingSummaries}
                    meetingSummaryRows={meetingSummaryRows}
                  />
                </Suspense>
              )}

              {settingsTab === 'integrations' && (
                <Suspense fallback={<LazyPanelFallback />}>
                  <LocalToolsSettings
                    project={activeProject}
                    toolOptions={SETTINGS_TOOL_GRANT_OPTIONS}
                    activeToolIds={activeToolGrantSet}
                    toolPolicy={toolGrantPolicy}
                    toolSaving={toolGrantPolicySaving}
                    canWrite={settingsBackendProjectWriteAvailable}
                    onToolChange={setProjectToolGrantSetting}
                    budget={providerBudgetPolicy}
                    budgetSaving={providerBudgetPolicySaving}
                    onBudgetChange={updateProjectProviderBudgetPolicySetting}
                    onRefresh={() => Promise.allSettled([
                      syncBackendProjectState({ silent: true }),
                      syncSettingsIntegrationReadiness(),
                    ])}
                    refreshing={backendStation.loading || providerRuntimeStatus.running}
                    integrationCapabilities={integrationCapabilities}
                    integrationReadiness={backendSettingsIntegrationReadiness}
                    readinessSourceClass={settingsIntegrationReadinessSourceClass}
                    readinessSourceStatus={settingsIntegrationReadinessSourceStatus}
                    readinessSourceDetail={settingsIntegrationReadinessSourceDetail}
                    onReadinessSync={syncSettingsIntegrationReadiness}
                    readinessSyncDisabled={settingsProviderProjectSyncDisabled}
                    onProjectSettingsSync={() => syncBackendProjectState({ silent: false })}
                    projectSyncDisabled={settingsBackendProjectSyncDisabled}
                  />
                </Suspense>
              )}

              {settingsTab === 'health' && (
                <Suspense fallback={<LazyPanelFallback />}>
                  <LocalHealthSettings
                    healthCheck={healthCheck}
                    rows={healthRows}
                    statusClass={healthStatusClass}
                    statusLabels={healthStatusLabel}
                    backendUrlConfigured={backendUrlConfigured}
                    targetLabel={backendHealthTargetLabel}
                    workflowSmoke={settingsWorkflowSmoke}
                    workflowProofRows={settingsWorkflowSmokeProofRows}
                    onQuickCheck={() => runSettingsHealthCheck({ workflow: false })}
                    onWorkflowCheck={() => runSettingsHealthCheck({ workflow: true })}
                  />
                </Suspense>
              )}
            </div>
        </SettingsDialogShell>
      </Suspense>
    );
  
}
