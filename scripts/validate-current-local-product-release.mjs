import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts || {};
const viteConfig = read('vite.config.js');
const frontendBundleGate = read('scripts/validate-frontend-bundle.mjs');
const app = read('src/App.jsx');
const simpleMeeting = read('src/meeting/ProjectSimpleMeeting.jsx');
const simpleChat = read('src/project/ProjectSimpleChat.jsx');
const teamWorkspacePanels = read('src/project/ProjectDashboardTeamWorkspacePanels.jsx');
const settingsModalView = read('src/settings/SettingsModalView.jsx');
const workspaceView = read('src/workspace/WorkspaceView.jsx');
const projectChatRouteView = read('src/project/ProjectChatRouteView.jsx');
const projectTimelineRouteView = read('src/project/ProjectTimelineRouteView.jsx');
const projectDashboardAdvancedView = read('src/project/ProjectDashboardAdvancedView.jsx');
const projectDashboardContentLayout = read('src/project/ProjectDashboardContentLayout.jsx');
const projectDashboardTopPanels = read('src/project/ProjectDashboardTopPanels.jsx');
const projectDashboardManagerBody = read('src/project/ProjectDashboardManagerBody.jsx');
const projectDashboardManagerCorePanels = read('src/project/ProjectDashboardManagerCorePanels.jsx');
const projectDashboardWorkLoopPanels = read('src/project/ProjectDashboardWorkLoopPanels.jsx');
const projectDashboardKickoffCollaborationPanels = read('src/project/ProjectDashboardKickoffCollaborationPanels.jsx');
const projectDashboardCollaborationOperationsPanels = read('src/project/ProjectDashboardCollaborationOperationsPanels.jsx');
const projectDashboardManagerProofRoutePanels = read('src/project/ProjectDashboardManagerProofRoutePanels.jsx');
const projectDashboardCoordinationTeamPanels = read('src/project/ProjectDashboardCoordinationTeamPanels.jsx');
const projectDashboardManagerCollaborationBody = read('src/project/ProjectDashboardManagerCollaborationBody.jsx');
const projectDashboardManagerReadyPackageSnapshot = read('src/project/ProjectDashboardManagerReadyPackageSnapshot.jsx');
const projectDashboardManagerReadyPackageCorePanels = read('src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx');
const projectDashboardManagerReadyPackageOperationalPanels = read('src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx');
const projectDashboardManagerBackendSnapshotPanels = read('src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx');
const projectDashboardManagerBackendActivityPanels = read('src/project/ProjectDashboardManagerBackendActivityPanels.jsx');
const projectDashboardManagerBackendReadModelPanels = read('src/project/ProjectDashboardManagerBackendReadModelPanels.jsx');
const projectDashboardManagerWorkerStationPanels = read('src/project/ProjectDashboardManagerWorkerStationPanels.jsx');
const projectDashboardManagerBackendStationContent = read('src/project/ProjectDashboardManagerBackendStationContent.jsx');
const projectDashboardManagerBackendStationRegion = read('src/project/ProjectDashboardManagerBackendStationRegion.jsx');
const main = read('src/main.jsx');
const legacyStyles = read('src/styles/legacyApp.css');
const primaryUiGate = read('scripts/validate-primary-user-ui.mjs');
const primaryProjectGate = read('scripts/validate-primary-project-flow-ui.mjs');
const managerCoreGate = read('scripts/validate-manager-backend-core-ui.mjs');

for (const path of [
  'Start Hall of Fame Studio.cmd',
  'start-hall-of-fame-studio.sh',
  'scripts/start-local-app.mjs',
  'scripts/local-dev.mjs',
  'scripts/agent-project-server.mjs',
  'scripts/validate-dashboard-upgrade-completion.mjs',
  'src/common/LocalUiErrorBoundary.jsx',
  'src/scenes/AgentMarketRouteView.jsx',
  'src/scenes/AgentDossierRouteView.jsx',
  'src/onboarding/LocalFirstRunFlow.jsx',
  'src/onboarding/ProjectInitiationFlowView.jsx',
  'src/project/ProjectHub.jsx',
  'src/workspace/WorkspaceView.jsx',
  'src/workspace/AdvancedWorkspaceView.jsx',
  'src/project/ProjectSimpleChat.jsx',
  'src/project/ProjectChatPanel.jsx',
  'src/project/ProjectChatRouteView.jsx',
  'src/project/ProjectTimelineRouteView.jsx',
  'src/project/ProjectDashboardAdvancedView.jsx',
  'src/project/ProjectDashboardContentLayout.jsx',
  'src/project/ProjectDashboardTopPanels.jsx',
  'src/project/ProjectDashboardManagerBody.jsx',
  'src/project/ProjectDashboardManagerCorePanels.jsx',
  'src/project/ProjectDashboardWorkLoopPanels.jsx',
  'src/project/ProjectDashboardKickoffCollaborationPanels.jsx',
  'src/project/ProjectDashboardCollaborationOperationsPanels.jsx',
  'src/project/ProjectDashboardManagerProofRoutePanels.jsx',
  'src/project/ProjectDashboardCoordinationTeamPanels.jsx',
  'src/project/ProjectDashboardManagerCollaborationBody.jsx',
  'src/project/ProjectDashboardManagerReadyPackageSnapshot.jsx',
  'src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx',
  'src/project/ProjectDashboardManagerReadyPackageOperationalPanels.jsx',
  'src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx',
  'src/project/ProjectDashboardManagerBackendActivityPanels.jsx',
  'src/project/ProjectDashboardManagerBackendReadModelPanels.jsx',
  'src/project/ProjectDashboardManagerWorkerStationPanels.jsx',
  'src/project/ProjectDashboardManagerBackendStationContent.jsx',
  'src/project/ProjectDashboardManagerBackendStationRegion.jsx',
  'src/project/ProjectDashboardTeamWorkspacePanels.jsx',
  'src/project/ProjectDashboardActiveThreads.jsx',
  'src/project/ProjectDashboardTeam.jsx',
  'src/project/ProjectTimelineSummary.jsx',
  'src/meeting/ProjectSimpleMeeting.jsx',
  'src/meeting/ProjectSimpleMeetingRouteView.jsx',
  'src/meeting/AdvancedMeetingRoomRouteView.jsx',
  'src/settings/LocalModelSettings.jsx',
  'src/settings/SettingsModalView.jsx',
  'src/settings/LocalHealthSettings.jsx',
  'src/styles/legacyApp.css',
]) {
  assert(existsSync(resolve(root, path)), `Required local product file is missing: ${path}`);
}

assert(packageJson.engines?.node === '>=20', 'The local product must require a supported Node.js version.');
assert(scripts.dev === 'node scripts/local-dev.mjs', 'The development command must use the supervised local runtime.');
assert(scripts['ui:dashboard-upgrade:check'] === 'node scripts/validate-dashboard-upgrade-completion.mjs', 'The local product must retain the concentrated Dashboard upgrade check.');
assert(viteConfig.includes('chunkSizeWarningLimit: 700'), 'The production build warning limit must match the enforced 700 KB application-entry budget.');
assert(frontendBundleGate.includes('entry.bytes < 700_000'), 'The frontend bundle gate must enforce the 700 KB application-entry budget.');
assert(scripts['ui:real-user-zero-to-autonomy']?.includes('validate-primary-user-ui.mjs'), 'The release UI command must run the current primary browser gate.');
assert(scripts['ui:real-user-zero-to-autonomy']?.includes('validate-primary-project-flow-ui.mjs'), 'The release UI command must run the real local project browser flow.');
assert(scripts['ui:real-user-zero-to-autonomy']?.includes('validate-real-user-zero-to-autonomy-agents-server-api.mjs'), 'The release UI command must retain the real local backend autonomy gate.');

for (const component of ['AgentMarketRouteView', 'AgentDossierRouteView', 'WorkspaceView', 'ProjectInitiationFlowView', 'ProjectSimpleChat', 'ProjectChatRouteView', 'ProjectTimelineRouteView', 'ProjectDashboardAdvancedView', 'ProjectDashboardManagerBody', 'ProjectDashboardManagerProofRoutePanels', 'ProjectSimpleMeetingRouteView', 'AdvancedMeetingRoomRouteView', 'SettingsModalView']) {
  assert(app.includes(component), `App must use ${component}.`);
}
assert(projectChatRouteView.includes('AdvancedProjectChat'), 'ProjectChatRouteView must retain the complete Group Chat.');
assert(projectTimelineRouteView.includes('AdvancedProjectTimeline'), 'ProjectTimelineRouteView must retain the complete Timeline and Manager Flow Graph.');
const advancedViewBoundaryStart = app.indexOf('<Suspense fallback={<LazyPanelFallback />}>');
const advancedViewUsageStart = app.indexOf('<ProjectDashboardAdvancedView');
const advancedViewBoundaryEnd = app.indexOf('</Suspense>', advancedViewUsageStart);
assert(
  advancedViewBoundaryStart >= 0 && advancedViewBoundaryStart < advancedViewUsageStart && advancedViewUsageStart < advancedViewBoundaryEnd,
  'App must retain a loading boundary around the lazy complete Dashboard advanced view.',
);
for (const component of ['ProjectDashboardContentLayout', 'ProjectDashboardToolLauncher']) {
  assert(projectDashboardAdvancedView.includes(component), `ProjectDashboardAdvancedView must retain ${component}.`);
}
assert(projectDashboardAdvancedView.includes('data-testid="project-dashboard-view" className="project-room relative flex-1 overflow-hidden text-[#251b13]"'), 'ProjectDashboardAdvancedView must retain the original complete Dashboard shell.');
assert(projectDashboardAdvancedView.includes('data-testid="project-overview" className="relative z-10 h-full overflow-x-hidden overflow-y-auto p-3 md:p-6 xl:p-12"'), 'ProjectDashboardAdvancedView must retain the original complete Dashboard overview container.');
assert(projectDashboardAdvancedView.includes('data-testid="project-dashboard-content-layout-loading"'), 'ProjectDashboardAdvancedView must retain the content-layout loading state.');
assert(projectDashboardAdvancedView.includes('data-testid="project-dashboard-tool-launcher-loading"'), 'ProjectDashboardAdvancedView must retain the tool-launcher loading state.');
assert(
  projectDashboardAdvancedView.indexOf('<ProjectDashboardContentLayout') < projectDashboardAdvancedView.indexOf('<ProjectDashboardToolLauncher'),
  'ProjectDashboardAdvancedView must retain Content Layout before Tool Launcher.',
);
for (const component of ['ProjectDashboardTopPanels', 'ProjectDashboardRecentCommitLine']) {
  assert(projectDashboardContentLayout.includes(component), `ProjectDashboardContentLayout must retain ${component}.`);
}
assert(projectDashboardContentLayout.includes('className="project-paper min-w-0 w-full border border-[#7b6542] p-4 md:p-6 xl:p-10 grid grid-cols-12 gap-4 md:gap-6 xl:gap-8 min-h-[calc(100vh-96px)]"'), 'ProjectDashboardContentLayout must retain the original complete Dashboard paper classes.');
assert(
  projectDashboardContentLayout.indexOf('<ProjectDashboardTopPanels') < projectDashboardContentLayout.indexOf('<ProjectDashboardRecentCommitLine'),
  'ProjectDashboardContentLayout must retain Top Panels before Recent Commit Line.',
);
for (const component of ['ProjectDashboardHeader', 'ProjectDashboardSummary', 'ProjectDashboardAgentOverview']) {
  assert(projectDashboardTopPanels.includes(component), `ProjectDashboardTopPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardManagerCorePanels', 'ProjectDashboardWorkLoopPanels', 'ProjectDashboardManagerBackendStationRegion', 'ProjectDashboardManagerCollaborationBody']) {
  assert(projectDashboardManagerBody.includes(component), `ProjectDashboardManagerBody must retain ${component}.`);
}
assert(
  projectDashboardManagerBody.indexOf('<ProjectDashboardManagerCorePanels') < projectDashboardManagerBody.indexOf('<ProjectDashboardWorkLoopPanels')
    && projectDashboardManagerBody.indexOf('<ProjectDashboardWorkLoopPanels') < projectDashboardManagerBody.indexOf('<ProjectDashboardManagerBackendStationRegion')
    && projectDashboardManagerBody.indexOf('<ProjectDashboardManagerBackendStationRegion') < projectDashboardManagerBody.indexOf('<ProjectDashboardManagerCollaborationBody'),
  'ProjectDashboardManagerBody must retain the original Manager child order.',
);
for (const component of ['ProjectDashboardManagerCommandCenters', 'ProjectDashboardManagerScenarioWalkthrough', 'ProjectDashboardManagerActionPlaybook', 'ProjectDashboardManagerActionRunLedger', 'ProjectDashboardManagerScenarioTrail', 'ProjectDashboardSyncProtocolAudit', 'ProjectDashboardManagerUseCaseAudit', 'ProjectDashboardManagerComposers']) {
  assert(projectDashboardManagerCorePanels.includes(component), `ProjectDashboardManagerCorePanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardAutonomousWorkLoop', 'ProjectDashboardOperationsBoard', 'ProjectDashboardContinuousWorkLoop', 'ProjectDashboardFixedWorkRoutines']) {
  assert(projectDashboardWorkLoopPanels.includes(component), `ProjectDashboardWorkLoopPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardGovernanceSpeechProtocol', 'ProjectDashboardKickoffCharter', 'ProjectDashboardKickoffMeetingFlow', 'ProjectDashboardKickoffExecutionFlow', 'ProjectDashboardGroupChatTranscriptIndex']) {
  assert(projectDashboardKickoffCollaborationPanels.includes(component), `ProjectDashboardKickoffCollaborationPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardChangeFlow', 'ProjectDashboardCommunicationFlow', 'ProjectDashboardAgentManagementMesh', 'ProjectDashboardManagerScenarioReadiness']) {
  assert(projectDashboardCollaborationOperationsPanels.includes(component), `ProjectDashboardCollaborationOperationsPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardTranscriptProofCoverage', 'ProjectDashboardTranscriptChannelRoutes', 'ProjectDashboardTranscriptChannelPinRoutes', 'ProjectDashboardTranscriptPinRoutes', 'ProjectDashboardTranscriptReplyRoutes', 'ProjectDashboardTranscriptMentionRoutes', 'ProjectDashboardTranscriptAttachmentRoutes', 'ProjectDashboardTranscriptMemberPresenceRoutes', 'ProjectDashboardAgentMessageRoutes', 'ProjectDashboardAgentContractRoutes', 'ProjectDashboardCollaborationIntentQueue', 'ProjectDashboardSubmissionReviewWorkflow']) {
  assert(projectDashboardManagerProofRoutePanels.includes(component), `ProjectDashboardManagerProofRoutePanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardCollaborationHealth', 'ProjectDashboardSampleFixturePath', 'ProjectDashboardLeaderAssignmentFlow', 'ProjectDashboardTeamWorkspacePanels']) {
  assert(projectDashboardCoordinationTeamPanels.includes(component), `ProjectDashboardCoordinationTeamPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardEventLedger', 'ProjectDashboardKickoffCollaborationPanels', 'ProjectDashboardCollaborationOperationsPanels', 'ProjectDashboardManagerProofMap', 'ProjectDashboardCoordinationTeamPanels']) {
  assert(projectDashboardManagerCollaborationBody.includes(component), `ProjectDashboardManagerCollaborationBody must retain ${component}.`);
}
for (const component of ['ProjectDashboardLaunchOperationsOverview', 'ProjectDashboardManagerReadyPackageSummary', 'ProjectDashboardManagerReadyPackageCoordinationPanels', 'ProjectDashboardCollaborationIntentQueueSnapshot', 'ProjectDashboardManagerReadyPackageRuntimePanels', 'ProjectDashboardManagerReadyPackageEvidencePanels']) {
  assert(projectDashboardManagerReadyPackageCorePanels.includes(component), `ProjectDashboardManagerReadyPackageCorePanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardManagerReadyPackageCorePanels', 'ProjectDashboardManagerReadyPackageOperationalPanels']) {
  assert(projectDashboardManagerReadyPackageSnapshot.includes(component), `ProjectDashboardManagerReadyPackageSnapshot must retain ${component}.`);
}
for (const component of ['ProjectDashboardProjectEvidenceExportWorkflow', 'ProjectDashboardManagerReadyPackageLaunchReadinessPanels', 'ProjectDashboardManagerReadyPackagePilotOperationsPanels', 'ProjectDashboardManagerReadyPackageLocalReadinessPanels', 'ProjectDashboardManagerReadyPackageProviderSecurityPanels']) {
  assert(projectDashboardManagerReadyPackageOperationalPanels.includes(component), `ProjectDashboardManagerReadyPackageOperationalPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardManagerSnapshotExecutionPanels', 'ProjectDashboardManagerCompatibilityProofPanels', 'ProjectDashboardManagerSubmissionRoutePanels']) {
  assert(projectDashboardManagerBackendSnapshotPanels.includes(component), `ProjectDashboardManagerBackendSnapshotPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardManagerReadModelSummaryPanels', 'ProjectDashboardAutonomousRunControl', 'ProjectDashboardAgentAutonomousActionQueue', 'ProjectDashboardLatestBackendWork']) {
  assert(projectDashboardManagerBackendActivityPanels.includes(component), `ProjectDashboardManagerBackendActivityPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardManagerBackendSnapshotPanels', 'ProjectDashboardManagerBackendActivityPanels']) {
  assert(projectDashboardManagerBackendReadModelPanels.includes(component), `ProjectDashboardManagerBackendReadModelPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardBackendWorkerStationStatus', 'ProjectDashboardProductionInfrastructureRehearsal']) {
  assert(projectDashboardManagerWorkerStationPanels.includes(component), `ProjectDashboardManagerWorkerStationPanels must retain ${component}.`);
}
for (const component of ['ProjectDashboardManagerWorkerStationPanels', 'ProjectDashboardManagerReadyPackageSnapshot', 'ProjectDashboardManagerBackendReadModelPanels']) {
  assert(projectDashboardManagerBackendStationContent.includes(component), `ProjectDashboardManagerBackendStationContent must retain ${component}.`);
}
for (const component of ['ProjectDashboardManagerBackendStationContent', 'ProjectDashboardBackendSchedulerControls']) {
  assert(projectDashboardManagerBackendStationRegion.includes(component), `ProjectDashboardManagerBackendStationRegion must retain ${component}.`);
}
for (const component of ['ProjectHub', 'AdvancedWorkspaceView']) {
  assert(workspaceView.includes(component), `WorkspaceView must retain ${component}.`);
}
for (const component of ['LocalAccountSettings', 'LocalModelSettings', 'LocalHealthSettings', 'LocalPrivacySettings', 'LocalDeploymentSettings', 'LocalWorkspaceSettings', 'LocalToolsSettings']) {
  assert(settingsModalView.includes(component), `SettingsModalView must retain ${component}.`);
}
assert(simpleChat.includes('ProjectChatPanel'), 'ProjectSimpleChat must use ProjectChatPanel.');
for (const component of ['ProjectDashboardActiveThreads', 'ProjectDashboardTeam']) {
  assert(teamWorkspacePanels.includes(component), `ProjectDashboardTeamWorkspacePanels must use ${component}.`);
}
for (const component of ['MeetingRoomStage', 'MeetingInputPanel', 'MeetingTranscriptPanel']) {
  assert(simpleMeeting.includes(component), `ProjectSimpleMeeting must use ${component}.`);
}
assert(app.includes('const renderProjectTimeline = () =>'), 'App must retain the project timeline implementation.');
assert(app.includes("{ id: 'timeline', label: 'Manager Flow Graph'"), 'The complete project console must retain the flow-graph entry.');
assert(app.includes('Manager Flow Graph'), 'The original Manager Flow Graph must remain available.');
assert(main.includes('LocalUiErrorBoundary'), 'The root UI must retain its local recovery boundary.');
assert(main.includes("import './styles/legacyApp.css';"), 'The root UI must load the original application styles as a stylesheet.');
assert(main.indexOf("import './styles/legacyApp.css';") > main.indexOf("import './index.css';"), 'The original application stylesheet must load after the shared stylesheet.');
assert(legacyStyles.includes('.project-room {') && legacyStyles.includes('.tl-node-card {') && legacyStyles.includes('.meeting-avatar {'), 'The original application stylesheet must retain Dashboard, node-flow, and meeting styles.');
assert(!app.includes('const globalStyles = `') && !app.includes('styleSheet.textContent = globalStyles'), 'App must not insert the original stylesheet at runtime.');
for (const removed of ['renderLegacyProjectDashboard', 'renderLegacyDashboardView', 'renderLegacyProjectChat', 'renderLegacyProjectTimeline', 'projectAdvancedVisible', 'projectTimelineAdvancedVisible']) {
  assert(!app.includes(removed), `Removed product path returned: ${removed}`);
}

assert(primaryUiGate.includes("{ width: 390, height: 844 }"), 'Primary browser validation must cover the phone viewport.');
assert(primaryUiGate.includes("{ width: 1440, height: 900 }"), 'Primary browser validation must cover the desktop viewport.');
assert(primaryUiGate.includes("{ width: 1280, height: 720 }"), 'Primary browser validation must cover the compact desktop viewport.');
assert(primaryUiGate.includes('assertNoHorizontalOverflow'), 'Primary browser validation must fail on horizontal overflow.');
assert(primaryUiGate.includes('for (const scale of [1, 1.25, 1.5, 2])'), 'Primary browser validation must cover 100%, 125%, 150%, and 200% display scaling.');
assert(managerCoreGate.includes('async function assertDashboardResponsive(page)'), 'The complete Dashboard must retain responsive browser validation.');
for (const viewport of ['{ width: 1440, height: 1100 }', '{ width: 1280, height: 720 }', '{ width: 1024, height: 768 }', '{ width: 960, height: 540 }']) {
  assert(managerCoreGate.includes(viewport), `The complete Dashboard responsive validation must cover ${viewport}.`);
}
assert(primaryProjectGate.includes("route.abort('internetdisconnected')"), 'The real local project browser flow must block external network access.');
assert(!app.includes('https://api.openai.com'), 'The local product must not default to a cloud model endpoint.');
assert(!app.includes('https://supabase'), 'The local product must not depend on a hosted database endpoint.');

console.log('Current local product release checklist passed.');
