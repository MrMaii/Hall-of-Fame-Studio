import { lazy, Suspense } from 'react';
import {
  Activity,
  Box,
  ChevronRight,
  ClipboardList,
  Cpu,
  DoorOpen,
  MessageSquare,
  Plus,
  RefreshCw,
  Server,
  Settings,
} from 'lucide-react';

const ProjectHub = lazy(() => import('../project/ProjectHub.jsx'));
const AdvancedWorkspaceView = lazy(() => import('./AdvancedWorkspaceView.jsx'));

export default function WorkspaceView({ view }) {
  const {
    INITIATION_CONSENSUS,
    LazyPanelFallback,
    activeLanguage,
    backendStation,
    backendUrlConfigured,
    chatMessages,
    hasBackendManagedProjectMarker,
    isBackendKickoffProject,
    isManagerDemoProject,
    launchManagerDemoProject,
    navToInitiation,
    navToProject,
    projectHasBackendSyncEvidence,
    projects,
    providerRuntimeStatus,
    sampleFixtureMeta,
    setSettingsOpen,
    setSettingsTab,
    setWorkspaceAdvancedOpen,
    settingsTabForStartupReadiness,
    syncBackendProjectCatalog,
    syncSettingsProviderRuntime,
    workspaceAdvancedOpen,
  } = view;

  if (!workspaceAdvancedOpen) {
    return (
      <div className="flex-1 overflow-hidden bg-[#f5f4f0]">
        <Suspense fallback={<LazyPanelFallback />}>
          <ProjectHub
            projects={projects.filter(project => !isManagerDemoProject(project))}
            catalogStatus={backendStation.projectCatalogStatus}
            activeLanguage={activeLanguage}
            modelReady={Boolean(providerRuntimeStatus.modelProvider?.enabled && providerRuntimeStatus.modelProvider?.configured)}
            lastSyncedAt={backendStation.lastProjectCatalogSyncAt}
            onCreateProject={navToInitiation}
            onOpenProject={navToProject}
            onOpenSettings={() => { setSettingsTab('keys'); setSettingsOpen(true); }}
            onOpenAdvanced={() => setWorkspaceAdvancedOpen(true)}
          />
        </Suspense>
      </div>
    );
  }

  const localMvpStartupReadiness = providerRuntimeStatus.localMvpStartupReadiness?.schemaVersion === 'local-mvp-startup-readiness/v1'
    ? providerRuntimeStatus.localMvpStartupReadiness
    : null;
  const startupStatus = providerRuntimeStatus.running
    ? 'syncing'
    : localMvpStartupReadiness?.status || 'not synced';
  const startupReadyForFirstRun = localMvpStartupReadiness?.readyForFirstProjectRun === true;
  const startupReadyForProviderSetup = localMvpStartupReadiness?.readyForProviderSetup === true;
  const startupNextActionLabel = !backendUrlConfigured
    ? 'Save Backend URL in Settings Deployment before syncing startup readiness.'
    : localMvpStartupReadiness?.nextAction?.label || 'Sync startup readiness';
  const workspaceBackendCatalogSyncLabel = backendUrlConfigured
    ? 'Sync Backend Projects'
    : 'Save Backend URL first';
  const workspaceBackendCatalogRequiredDetail = backendUrlConfigured
    ? 'Browser rows can still appear as fallback, but backend project truth starts with /projects.'
    : 'Save Backend URL in Settings Deployment before syncing /projects.';
  const openWorkspaceStartInitiation = () => {
    if (!startupReadyForFirstRun) {
      setSettingsTab(settingsTabForStartupReadiness(localMvpStartupReadiness));
      setSettingsOpen(true);
      return;
    }
    navToInitiation();
  };
  const startupStatusClass = startupReadyForFirstRun
    ? 'border-[#59684b] bg-[#edf4e9] text-[#3f5136]'
    : startupReadyForProviderSetup
      ? 'border-[#b9a55f] bg-[#fbf7df] text-[#75631d]'
      : 'border-[#8f1e18] bg-red-50 text-[#8f1e18]';
  const portfolioSourceMeta = (project = {}, fixtureMeta = sampleFixtureMeta(project)) => {
    if (fixtureMeta) {
      return {
        label: fixtureMeta.status || 'sample-fixture',
        detail: fixtureMeta.purpose || 'Sample fixture only / not a real project path',
        className: fixtureMeta.status === 'development-fallback'
          ? 'border-[#8f1e18] bg-red-50 text-[#8f1e18]'
          : 'border-[#b9782b] bg-[#fff6d7] text-[#8a5d1d]',
      };
    }
    if (isBackendKickoffProject(project) || hasBackendManagedProjectMarker(project) || projectHasBackendSyncEvidence(project)) {
      return {
        label: 'backend-backed',
        detail: 'Loaded from backend project catalog or backend receipt sync',
        className: 'border-[#59684b] bg-[#edf4e9] text-[#3f5136]',
      };
    }
    return {
      label: 'frontend-fallback',
      detail: 'Local browser cache only; sync backend before treating this as a real project',
      className: 'border-[#b9a55f] bg-[#fbf7df] text-[#75631d]',
    };
  };
  const localWorkspaceOpenTaskCount = projects.reduce((count, project) => count + ((project.tasks || []).filter(task => task.status !== 'done').length), 0);
  const localWorkspaceStoredMessageCount = chatMessages.length;
  const backendCatalogProjects = Array.isArray(backendStation.projectCatalog) ? backendStation.projectCatalog : [];
  const workspaceActiveProjectCount = backendStation.connectionStatus === 'online'
    ? (
        backendStation.lastProjectCatalogSyncAt
          ? backendCatalogProjects.length
          : 'backend required'
      )
    : projects.length;
  const workspaceBackendProjectCount = backendStation.connectionStatus === 'online'
    ? (
        backendStation.lastProjectCatalogSyncAt
          ? backendCatalogProjects.length
          : 'backend required'
      )
    : 'offline';
  const backendCatalogTaskCountForProject = (project = {}) => {
    const explicitCount = project.tasks?.openCount
      ?? project.taskSummary?.openCount
      ?? project.summary?.openTasks
      ?? project.openTasks;
    if (Number.isFinite(Number(explicitCount))) return Number(explicitCount);
    if (Array.isArray(project.tasks)) return project.tasks.filter(task => task.status !== 'done').length;
    return null;
  };
  const backendCatalogMessageCountForProject = (project = {}) => {
    const explicitCount = project.transcriptIndex?.messageCount
      ?? project.transcriptSummary?.messageCount
      ?? project.summary?.storedMessages
      ?? project.summary?.messageCount
      ?? project.messageCount;
    if (Number.isFinite(Number(explicitCount))) return Number(explicitCount);
    if (Array.isArray(project.messages)) return project.messages.length;
    if (Array.isArray(project.chatMessages)) return project.chatMessages.length;
    if (Array.isArray(project.transcripts?.channels)) {
      return project.transcripts.channels.reduce((count, channel) => {
        const channelCount = channel.messageCount ?? channel.messages?.length;
        return Number.isFinite(Number(channelCount)) ? count + Number(channelCount) : count;
      }, 0);
    }
    return null;
  };
  const backendCatalogTaskCounts = backendCatalogProjects.map(backendCatalogTaskCountForProject);
  const backendCatalogMessageCounts = backendCatalogProjects.map(backendCatalogMessageCountForProject);
  const workspaceOpenTaskCount = backendStation.connectionStatus === 'online'
    ? (
        backendStation.lastProjectCatalogSyncAt && backendCatalogTaskCounts.every(count => count !== null)
          ? backendCatalogTaskCounts.reduce((count, value) => count + value, 0)
          : 'backend required'
      )
    : localWorkspaceOpenTaskCount;
  const workspaceStoredMessageCount = backendStation.connectionStatus === 'online'
    ? (
        backendStation.lastProjectCatalogSyncAt && backendCatalogMessageCounts.every(count => count !== null)
          ? backendCatalogMessageCounts.reduce((count, value) => count + value, 0)
          : 'backend required'
      )
    : localWorkspaceStoredMessageCount;
  const workspaceOpenTaskSourceMeta = backendStation.connectionStatus === 'online'
    ? (
        backendStation.lastProjectCatalogSyncAt && backendCatalogTaskCounts.every(count => count !== null)
          ? {
              label: 'backend-catalog',
              detail: 'Synced backend project task evidence',
              className: 'border-[#59684b] bg-[#edf4e9] text-[#3f5136]',
            }
          : {
              label: 'backend required',
              detail: 'Sync project catalog task evidence',
              className: 'border-[#8f1e18] bg-[#f7e6df] text-[#8f1e18]',
            }
      )
    : {
        label: 'frontend-fallback',
        detail: 'Offline browser task cache',
        className: 'border-[#b9a55f] bg-[#fbf7df] text-[#75631d]',
      };
  const workspaceStoredMessageSourceMeta = backendStation.connectionStatus === 'online'
    ? (
        backendStation.lastProjectCatalogSyncAt && backendCatalogMessageCounts.every(count => count !== null)
          ? {
              label: 'backend-catalog',
              detail: 'Synced backend transcript evidence',
              className: 'border-[#59684b] bg-[#edf4e9] text-[#3f5136]',
            }
          : {
              label: 'backend required',
              detail: 'Sync project catalog transcript evidence',
              className: 'border-[#8f1e18] bg-[#f7e6df] text-[#8f1e18]',
            }
      )
    : {
        label: 'frontend-fallback',
        detail: 'Offline browser message cache',
        className: 'border-[#b9a55f] bg-[#fbf7df] text-[#75631d]',
      };
  const workspaceActiveProjectSourceMeta = backendStation.connectionStatus === 'online'
    ? (
        backendStation.lastProjectCatalogSyncAt
          ? {
              label: 'backend-catalog',
              detail: 'Synced backend project catalog',
              className: 'border-[#59684b] bg-[#edf4e9] text-[#3f5136]',
            }
          : {
              label: 'backend required',
              detail: 'Sync project catalog before trusting this count',
              className: 'border-[#8f1e18] bg-[#f7e6df] text-[#8f1e18]',
            }
      )
    : {
        label: 'frontend-fallback',
        detail: 'Offline browser project cache',
        className: 'border-[#b9a55f] bg-[#fbf7df] text-[#75631d]',
      };
  const workspaceBackendProjectSourceMeta = backendStation.connectionStatus === 'online'
    ? (
        backendStation.lastProjectCatalogSyncAt
          ? {
              label: 'backend-catalog',
              detail: 'Synced backend project catalog',
              className: 'border-[#59684b] bg-[#edf4e9] text-[#3f5136]',
            }
          : {
              label: 'backend required',
              detail: 'Sync backend project catalog',
              className: 'border-[#8f1e18] bg-[#f7e6df] text-[#8f1e18]',
            }
      )
    : {
        label: 'backend offline',
        detail: 'Start backend, then sync project catalog',
        className: 'border-[#7d786b] bg-[#f3f0e8] text-[#5f5a50]',
      };
  const workspaceBackendCatalogSummary = backendStation.connectionStatus === 'online'
    ? (
        backendStation.lastProjectCatalogSyncAt
          ? `Backend catalog ${backendCatalogProjects.length} project${backendCatalogProjects.length === 1 ? '' : 's'}`
          : 'Backend catalog sync required'
      )
    : 'Offline catalog uses local browser fallback';
  const workspacePortfolioCatalogRequired = backendStation.connectionStatus === 'online' && !backendStation.lastProjectCatalogSyncAt;

  return (
    <Suspense fallback={<LazyPanelFallback />}>
      <AdvancedWorkspaceView
        view={{
          Activity,
          Box,
          ChevronRight,
          ClipboardList,
          Cpu,
          DoorOpen,
          INITIATION_CONSENSUS,
          MessageSquare,
          Plus,
          RefreshCw,
          Server,
          Settings,
          activeLanguage,
          backendStation,
          backendUrlConfigured,
          launchManagerDemoProject,
          localMvpStartupReadiness,
          navToInitiation,
          navToProject,
          openWorkspaceStartInitiation,
          portfolioSourceMeta,
          projects,
          providerRuntimeStatus,
          sampleFixtureMeta,
          setSettingsOpen,
          setSettingsTab,
          setWorkspaceAdvancedOpen,
          settingsTabForStartupReadiness,
          startupNextActionLabel,
          startupReadyForFirstRun,
          startupReadyForProviderSetup,
          startupStatus,
          startupStatusClass,
          syncBackendProjectCatalog,
          syncSettingsProviderRuntime,
          workspaceActiveProjectCount,
          workspaceActiveProjectSourceMeta,
          workspaceBackendCatalogRequiredDetail,
          workspaceBackendCatalogSummary,
          workspaceBackendCatalogSyncLabel,
          workspaceBackendProjectCount,
          workspaceBackendProjectSourceMeta,
          workspaceOpenTaskCount,
          workspaceOpenTaskSourceMeta,
          workspacePortfolioCatalogRequired,
          workspaceStoredMessageCount,
          workspaceStoredMessageSourceMeta,
        }}
      />
    </Suspense>
  );
}
