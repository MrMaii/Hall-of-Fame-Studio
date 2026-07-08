import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, markers, context) {
  for (const marker of markers) {
    assert(source.includes(marker), `${context} must include ${marker}.`);
  }
}

function assertInputEditableByTestId(source, testId) {
  const match = source.match(new RegExp(`data-testid="${testId}"[\\s\\S]{0,700}?/>`));
  assert(match, `Expected ${testId} input to exist.`);
  assert(match[0].includes('onChange='), `${testId} must remain user-editable.`);
  assert(!match[0].includes('disabled='), `${testId} must not be disabled by backend readiness.`);
}

function assertProviderSecretInputGatedByTestId(source, testId) {
  const match = source.match(new RegExp(`data-testid="${testId}"[\\s\\S]{0,700}?/>`));
  assert(match, `Expected ${testId} input to exist.`);
  assert(match[0].includes('onChange='), `${testId} must keep a controlled input handler for backend-target draft entry.`);
  assert(match[0].includes('disabled={!settingsProviderSecretInputReady}'), `${testId} must stay locked until a backend target is saved.`);
}

function assertReadOnlyRoutePanel(source, context) {
  for (const marker of ['<input', '<select', '<textarea', 'onChange=']) {
    assert(!source.includes(marker), `${context} must remain a backend route read-only panel without fake editable controls.`);
  }
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert(start >= 0, `Missing start marker ${startMarker}.`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(end > start, `Missing end marker ${endMarker}.`);
  return source.slice(start, end);
}

function assertBackendSyncButtonGuardedByTestId(source, testId, expectedGuard = 'disabled={backendWorkerStationSyncDisabled}') {
  const match = source.match(new RegExp(`data-testid="${testId}"[\\s\\S]{0,900}?</button>`));
  assert(match, `Expected backend sync button ${testId} to exist.`);
  assert(
    match[0].includes(expectedGuard),
    `${testId} must use the configured backend project guard.`,
  );
}

const appSource = read('src/App.jsx');
const packageSource = read('package.json');
const registerSource = read('docs/FRONTEND_MOCK_REPLACEMENT_REGISTER.md');

assert(!/local mock|No local mock|mock meeting|mock clarification|mock Leader|mock next actions|mock meeting response/i.test(appSource), 'Real-project user-facing fallback failures must not describe suppressed backend-required work as local mock output.');

assertIncludes(packageSource, [
  '"ui:mock-boundaries"',
  'validate-frontend-mock-boundaries.mjs',
], 'package scripts');

const proofMessagesSection = sliceBetween(
  appSource,
  'const ensureProofMessagesAvailable',
  'const ensureTimelineEventsAvailable',
);
assertIncludes(proofMessagesSection, [
  'shouldRequireBackendProofTranscript(project)',
  'syncBackendProjectTranscripts',
  'Backend proof transcript missing; local recovery suppressed',
  'recoverProofMessages(project, proofIds, fallbackChannelId)',
], 'proof message boundary');
assert(
  proofMessagesSection.indexOf('shouldRequireBackendProofTranscript(project)') < proofMessagesSection.indexOf('recoverProofMessages(project, proofIds, fallbackChannelId)'),
  'Proof recovery must run only after the backend transcript-required branch has failed closed.',
);

const timelineSection = sliceBetween(
  appSource,
  'const ensureTimelineEventsAvailable',
  'const openProjectChatProof',
);
assertIncludes(timelineSection, [
  'shouldRequireBackendTimelineProof(project)',
  'syncBackendTimelineAndEvents',
  'Backend timeline proof missing; local timeline focus suppressed',
], 'timeline proof boundary');

const transcriptCommandSection = sliceBetween(
  appSource,
  'const pinBackendTranscriptMessage = async',
  'const syncBackendMeetingSummaries = async',
);
assertIncludes(transcriptCommandSection, [
  'runBackendProjectCommand(`transcripts/${encodeURIComponent(channelId)}/pins`',
  'runBackendProjectCommand(`transcripts/${encodeURIComponent(channelId)}/channel-pin`',
  'runBackendProjectCommand(`transcripts/${encodeURIComponent(channelId)}/replies`',
  'runBackendProjectCommand(`transcripts/${encodeURIComponent(channelId)}/mentions`',
  'runBackendProjectCommand(`transcripts/${encodeURIComponent(channelId)}/attachments`',
  'syncBackendProjectTranscripts({ silent: true, projectId: activeProject.id, channelId })',
  'syncBackendTimelineAndEvents({ silent: true, projectId: activeProject.id })',
  'syncBackendManagerFlowGraph({ silent: true, projectId: activeProject.id })',
  'syncBackendReadyPackageSubmodels({ silent: true, projectId: activeProject.id })',
  'Backend transcript pin timed out.',
  'Backend transcript channel pin timed out.',
  'Backend transcript reply timed out.',
  'Backend transcript mention timed out.',
  'Backend transcript attachment timed out.',
  'handleBackendTranscriptAttachmentChange',
], 'Group Chat transcript backend command boundary');

const transcriptChannelCreateSection = sliceBetween(
  appSource,
  'const createProjectTranscriptChannel = async',
  'const handleTimelineWheel = (event) =>',
);
assertIncludes(transcriptChannelCreateSection, [
  "runBackendProjectCommand('transcripts'",
  'Backend transcript channel proof refreshed',
  'Backend transcript channel created',
  'Backend channel creation failed; local fallback disabled for backend-online project',
  'Backend channel creation required',
  'Channel creation for backend-online projects must use the backend transcript/channel contract.',
], 'Group Chat transcript channel creation boundary');

const transcriptChatSendSection = sliceBetween(
  appSource,
  'const submitChatInput = async',
  'const createProjectTranscriptChannel = async',
);
assertIncludes(transcriptChatSendSection, [
  'const shouldUseBackendChat = shouldAttemptBackendProjectWrite(activeProject);',
  'const canUseLocalChatFallback = allowLocalRuntimeFallbackForActiveProject(activeProject);',
  'if (!shouldUseBackendChat && !canUseLocalChatFallback) {',
  'Backend chat route required',
  'Chat for backend-online projects must use the backend project command route. Configure Backend URL in Settings Deployment.',
  'if (shouldUseBackendChat) {',
  'const allowFallback = canUseLocalChatFallback;',
  'Backend chat failed; local fallback disabled for backend-online project; draft restored',
  'setChatInput(current => current || text)',
], 'Group Chat backend send fail-closed boundary');
assert(
  transcriptChatSendSection.indexOf('Backend chat route required')
    < transcriptChatSendSection.indexOf('const submittedAt = new Date().toISOString();'),
  'Group Chat must block backend-required sends before clearing the draft or creating local chat proof.',
);

const transcriptRenderSection = sliceBetween(
  appSource,
  'const renderProjectChat = () =>',
  'const renderProjectTimelineLegacy = () =>',
);
assertIncludes(transcriptRenderSection, [
  'const backendChannelTranscriptRequired = Boolean(activeProject)',
  'const backendChannelTranscriptUsable = Boolean(backendChannelTranscript) && (',
  '? backendVisibleMessages',
  ': mergeProjectMessages(localVisibleMessages, backendVisibleMessages)',
  ': (backendChannelTranscriptRequired ? [] : localVisibleMessages);',
  'const canCreateLocalChannel = allowLocalRuntimeFallbackForActiveProject(activeProject);',
  'const canCreateChannel = Boolean(activeProject) && (canCreateLocalChannel || shouldAttemptBackendProjectWrite(activeProject));',
  'const canSendLocalChat = allowLocalRuntimeFallbackForActiveProject(activeProject);',
  'const canSendChat = Boolean(activeProject)',
  'const backendChatSendRequired = Boolean(activeProject)',
  'const canPinBackendTranscriptMessage = Boolean(activeProject)',
  'const canPinBackendTranscriptChannel = Boolean(activeProject)',
  'const canReplyBackendTranscriptMessage = Boolean(activeProject)',
  'const canMentionBackendTranscriptMessage = Boolean(activeProject)',
  'const canAttachBackendTranscriptFile = Boolean(activeProject)',
  'data-testid="project-chat-create-transcript-channel"',
  'onClick={createProjectTranscriptChannel}',
  'disabled={!canCreateChannel}',
  'data-testid="backend-channel-create-required"',
  'data-testid="backend-channel-create-open-deployment"',
  "onClick={() => { setSettingsTab('deployment'); setSettingsOpen(true); }}",
  'data-testid="backend-chat-send-required"',
  'data-testid="backend-chat-send-open-deployment"',
  'data-testid="project-chat-send"',
  'disabled={!canSendChat}',
  'data-testid="project-chat-tool-pin"',
  'onClick={pinBackendTranscriptChannel}',
  'disabled={!canPinBackendTranscriptChannel || activeChannelPinned}',
  'data-testid="project-chat-transcript-search-form"',
  'runBackendTranscriptSearch({ projectId: activeProject.id, channelId: activeChannelId, query: transcriptSearchDraft })',
  'data-testid={`project-chat-transcript-search-result-${safeMessageNodeId(result.messageId)}`}',
  "onClick={() => openProjectChatProof(activeProject, [result.messageId], result.channelId || activeChannelId || 'main')}",
  'data-testid="project-chat-tool-members"',
  'onClick={toggleBackendTranscriptMembers}',
  'data-testid="project-chat-member-presence-panel"',
  'data-testid="project-chat-transcript-backend-required"',
  'pinnedTranscriptRowsByMessageId',
  'transcriptReplyRowsByParentMessageId',
  'transcriptMentionRowsBySourceMessageId',
  'transcriptAttachmentRowsByMessageId',
  'data-testid={`project-chat-message-reply-${message.id}`}',
  'onClick={() => replyToBackendTranscriptMessage(message)}',
  'disabled={!canReplyBackendTranscriptMessage}',
  'data-testid={`project-chat-message-mention-${message.id}`}',
  'onClick={() => mentionBackendTranscriptMessage(message)}',
  'disabled={!canMentionBackendTranscriptMessage}',
  'data-testid={`project-chat-message-pin-${message.id}`}',
  'onClick={() => pinBackendTranscriptMessage(message)}',
  'disabled={!canPinBackendTranscriptMessage || isPinnedTranscriptMessage}',
  'ref={chatAttachmentInputRef}',
  'onChange={handleBackendTranscriptAttachmentChange}',
  'onClick={triggerBackendTranscriptAttachmentPicker}',
  'disabled={!canAttachBackendTranscriptFile}',
  'message.evidenceSearchRoute',
  'message.evidenceSourceReviewRoute',
  'message.submissionReviewRoute',
  'message.submissionRoute',
  'firstBackendRoute(message.evidenceSearchRoute',
  'firstBackendRoute(message.evidenceSourceReviewRoute',
  'firstBackendRoute(message.submissionReviewRoute',
  'firstBackendRoute(message.submissionRoute',
  'evidence-source-review-${message.reviewId}',
], 'Group Chat transcript UI boundary');
assert(
  transcriptRenderSection.indexOf('? backendVisibleMessages')
    < transcriptRenderSection.indexOf(': mergeProjectMessages(localVisibleMessages, backendVisibleMessages)'),
  'Backend-required Group Chat must render backend transcript messages before any offline/demo local merge path.',
);
assert(
  !transcriptRenderSection.includes('onClick={() => setFocusedChatProofIds([result.messageId])}'),
  'Transcript search results must open chat proof through the backend-aware proof opener.',
);

const dashboardTranscriptIndexSection = sliceBetween(
  appSource,
  'const localProjectTranscriptMessages = chatMessages.filter(message => (',
  'const backendCollaborationProofReadModel = backendManagerDashboard',
);
assertIncludes(dashboardTranscriptIndexSection, [
  'const backendTranscriptReadModelRequired = shouldRequireBackendProofTranscript(activeProject);',
  'const transcriptLocalRecoveryAllowed = !backendTranscriptReadModelRequired && !backendTranscriptReadModelReady;',
  ': backendTranscriptReadModelRequired',
  '? backendTranscriptMessages',
  '? mergeProjectMessages(localProjectTranscriptMessages, backendTranscriptMessages)',
], 'Dashboard Transcript Index backend source boundary');
assert(
  dashboardTranscriptIndexSection.indexOf(': backendTranscriptReadModelRequired')
    < dashboardTranscriptIndexSection.indexOf('? mergeProjectMessages(localProjectTranscriptMessages, backendTranscriptMessages)'),
  'Dashboard Transcript Index must choose backend transcript messages before the offline/demo merge path.',
);

const dashboardCollaborationRowsSection = sliceBetween(
  appSource,
  'const backendCollaborationProofReadModel = backendManagerDashboard',
  'const agentCommunicationRows = projectTranscriptMessages',
);
assertIncludes(dashboardCollaborationRowsSection, [
  'const collaborationSourceReviewRows =',
  'firstBackendRoute(row.evidenceSearchRoute',
  'firstBackendRoute(row.submissionRoute',
  'firstBackendRoute(row.submissionReviewRoute',
  'firstBackendRoute(row.evidenceSourceReviewRoute',
  "testKind: 'source-review'",
], 'Dashboard Transcript Index collaboration resource route boundary');

const initialCacheSection = sliceBetween(
  appSource,
  'const readStoredProjectArray',
  'const INITIATION_MEMBERS',
);
assertIncludes(initialCacheSection, [
  'const isBackendManagedBrowserCacheProject = (project = {})',
  'const cachedBackendManagedProjectIds = () => new Set',
  'const cachedBrowserProjectIds = () => new Set',
  'const loadInitialProjects = () =>',
  '.filter(project => !isBackendManagedBrowserCacheProject(project))',
], 'initial project cache boundary');

const initialChatCacheSection = sliceBetween(
  appSource,
  'const loadInitialChatMessages',
  'const createStableIdPart',
);
assertIncludes(initialChatCacheSection, [
  'const loadInitialChatMessages = () =>',
  'const backendManagedCachedIds = cachedBackendManagedProjectIds();',
  '.filter(message => !backendManagedCachedIds.has(message.projectId || DEFAULT_CHAT_PROJECT_ID))',
  'return projectId === DEFAULT_CHAT_PROJECT_ID || browserProjectIds.has(projectId);',
], 'initial chat cache boundary');

const browserCacheWriteSection = sliceBetween(
  appSource,
  'const isBackendManagedRealProject = (project = {})',
  '// Inject Styles',
);
const backendManagedMarkerSection = sliceBetween(
  appSource,
  'const hasBackendManagedProjectMarker = (project = {})',
  'const isManagerDemoMessage = (message = {})',
);
assertIncludes(backendManagedMarkerSection, [
  'project.productTeamDeliveryTrace',
  'project.productTeamOperatingLoop',
  'project.plannerExecutorReviewerStateMachine',
  'project.runtimeAutonomyStatus',
  'project.autonomousRunControl',
  'project.collaborationIntentQueue',
  'project.zeroToAutonomyReport',
  'project.projectEvidenceArchive',
  'project.settingsProviderReadiness',
  'project.settingsRuntimeReadiness',
  'project.settingsIntegrationReadiness',
], 'backend-managed browser cache marker coverage');
assertIncludes(browserCacheWriteSection, [
  'const canPersistProjectToBrowserCache = (project = {})',
  '&& !isBackendManagedRealProject(project)',
  'const isUnscopedProofLikeChatMessage = (message = {})',
  'CHAT_PROOF_ID_PATTERN.test(messageId)',
  'const canPersistChatMessageToBrowserCache = (message = {}, projectById = new Map())',
  'if (projectId === DEFAULT_CHAT_PROJECT_ID) return !isUnscopedProofLikeChatMessage(message);',
  'if (!project) return false;',
  'return canPersistProjectToBrowserCache(project) && !isManagerDemoMessage(message);',
], 'browser cache write boundary');
assertIncludes(appSource, [
  'const browserCacheProjects = projects.filter(canPersistProjectToBrowserCache);',
  'const browserCacheMessages = chatMessages',
  '.filter(message => canPersistChatMessageToBrowserCache(message, projectById))',
], 'browser cache write effects');
const storageHelperSection = sliceBetween(
  appSource,
  'const writeStoredJson = (key, value) => {',
  'const loadBackendBaseUrl = () => {',
);
const localStorageSetItemMatches = appSource.match(/window\.localStorage\.setItem\(/g) || [];
assert(localStorageSetItemMatches.length === 1, 'React must keep localStorage writes centralized through writeStoredJson.');
assertIncludes(storageHelperSection, [
  'window.localStorage.setItem(key, JSON.stringify(value));',
], 'centralized browser storage helper');
assertIncludes(appSource, [
  'const hasConfiguredBackendBaseUrl = () => {',
  'const isValidBackendBaseUrl = (value) => {',
  "return url.protocol === 'http:' || url.protocol === 'https:';",
  'const storedBackendUrl = readStoredJson(STORAGE_KEYS.backendUrl, null);',
  'return isValidBackendBaseUrl(storedBackendUrl)',
  'return storedBackendUrl !== null && isValidBackendBaseUrl(JSON.parse(storedBackendUrl));',
  'return isValidBackendBaseUrl(import.meta.env?.VITE_AGENT_BACKEND_URL);',
  'const [backendUrlConfigured, setBackendUrlConfigured] = useState(hasConfiguredBackendBaseUrl);',
  'const backendConfiguredTargetLabel = backendUrlConfigured',
  'const backendHealthTargetLabel = backendUrlConfigured',
  ": 'Not configured';",
  'const committedBackendBaseUrl = () => normalizeBackendBaseUrl(backendStation.baseUrl || DEFAULT_AGENT_BACKEND_URL);',
  "const rawDraftUrl = String(backendStation.draftBaseUrl || '').trim();",
  'if (!rawDraftUrl || !/^https?:\\/\\//i.test(rawDraftUrl)) {',
  "lastAction: 'Backend URL invalid'",
  'Enter a full backend API URL before saving, for example http://127.0.0.1:8787.',
  'new URL(rawDraftUrl).toString().replace(/\\/+$/, \'\')',
  'setBackendUrlConfigured(true);',
  'syncSettingsProviderRuntime({ runTests: false, baseUrlOverride: baseUrl })',
  'Save the backend API URL in Settings Deployment before syncing provider runtime.',
  'Save the backend API URL in Settings Deployment before running Settings health checks.',
  "providerRuntimeStatus.running || !backendUrlConfigured",
  "activeRoute !== 'dashboard' || providerRuntimeStatus.running || !backendUrlConfigured",
  "activeRoute !== 'project_initiation' || providerRuntimeStatus.running || !backendUrlConfigured",
], 'Settings backend target auto-sync guard');
assert(
  !appSource.includes('backendStation.draftBaseUrl || backendStation.baseUrl')
    && !appSource.includes('normalizeBackendBaseUrl(backendStation.draftBaseUrl'),
  'Runtime backend reads/writes must use the saved backend target; draftBaseUrl is only for the Save URL action.',
);
const manualProviderTargetGuards = appSource.match(/disabled=\{providerRuntimeStatus\.running \|\| !backendUrlConfigured\}/g) || [];
assert(manualProviderTargetGuards.length >= 6, 'Settings/Workspace/Initiation manual provider/startup controls must require a configured backend URL before probing backend routes.');
const manualHealthTargetGuards = appSource.match(/disabled=\{healthCheck\.running \|\| !backendUrlConfigured\}/g) || [];
assert(manualHealthTargetGuards.length >= 3, 'Settings Health manual Quick Check, Workflow Smoke, and footer Test Connection must require a configured backend URL before probing backend routes.');
assertIncludes(appSource, [
  '&& backendUrlConfigured\n    && Boolean((backendStation.baseUrl || \'\').trim())',
  'const syncBackendProjectCatalog = async ({ silent = true, baseUrl = null } = {}) => {',
  'if (!baseUrl && !backendUrlConfigured) {',
  'Save the backend API URL in Settings Deployment before syncing backend projects.',
  'if (!baseUrlOverride && !backendUrlConfigured) {',
  'Save the backend API URL in Settings Deployment before checking backend worker status.',
  'Save the backend API URL in Settings Deployment before running backend worker controls.',
  'Save the backend API URL in Settings Deployment before syncing backend project state.',
  'if (!backendUrlConfigured) return;\n    refreshBackendSchedulerStatus();',
  'data-testid="backend-sync-project-catalog"',
  'data-testid="workspace-portfolio-sync-catalog-required"',
  'data-testid="backend-sync-project-catalog-detail"',
  'const backendWorkerStationSyncDisabled = backendStation.loading || !backendCommandAvailable;',
  'const backendWorkerStationTargetRequiredDetail = backendUrlConfigured',
  'Save Backend URL in Settings Deployment before syncing worker/project read models.',
  'data-testid="backend-worker-station-target-required"',
  'data-testid="backend-worker-station-open-deployment"',
  "onClick={() => { setSettingsTab('deployment'); setSettingsOpen(true); }}",
  'disabled={backendWorkerStationSyncDisabled}',
], 'Workspace and Backend Worker manual backend target guard');
const backendWorkerStationSyncGuards = appSource.match(/disabled=\{backendWorkerStationSyncDisabled\}/g) || [];
assert(backendWorkerStationSyncGuards.length >= 15, 'Backend Worker Station manual sync/read controls must share the configured backend project guard.');
assertIncludes(appSource, [
  'const managerProofModelSyncButton = (readModel = {}, testId) => managerReadModelMeta(readModel).frontendMockSuppressed ? (',
  'const managerProofMapRouteSyncButton = (route = {}, testId) => managerReadModelMeta(route).frontendMockSuppressed ? (',
], 'Manager proof sync helper definitions');
for (const testId of [
  'project-dashboard-next-recommendation-sync-manager-dashboard',
  'dashboard-agent-status-sync-cockpit',
  'manager-command-center-sync-read-model',
  'manager-scenario-walkthrough-sync-read-model',
  'manager-action-playbook-sync-action-queue',
  'manager-action-run-ledger-sync-manager-dashboard',
  'manager-scenario-trail-sync-read-model',
  'sync-protocol-audit-sync-read-model',
  'manager-use-case-audit-sync-read-model',
  'manager-requirement-matrix-sync-read-model',
  'agent-state-summary-sync-cockpit',
  'continuous-work-loop-sync-cockpit',
  'fixed-work-routines-sync-cockpit',
  'active-threads-sync-manager-dashboard',
  'event-ledger-sync-timeline-events',
  'governance-protocol-sync-governance',
  'group-chat-collaboration-proof-sync-manager-dashboard',
  'change-flow-sync-cockpit',
  'agent-management-mesh-sync-cockpit',
  'manager-scenario-readiness-sync-proof-map',
  'manager-proof-map-sync-readiness-proof-map',
  'collaboration-health-sync-diagnostics',
  'assignment-timeline-matrix-sync-cockpit',
  'recent-commit-line-sync-timeline-events',
]) {
  assertBackendSyncButtonGuardedByTestId(appSource, testId);
}
assertBackendSyncButtonGuardedByTestId(appSource, 'manager-flow-backend-required-sync', 'disabled={!backendCommandAvailable || backendStation.loading}');
assertBackendSyncButtonGuardedByTestId(appSource, 'project-chat-transcript-sync', 'disabled={!canSyncBackendTranscriptMembers}');
assertIncludes(appSource, [
  'data-testid={`proof-map-${card.key}-sync-cockpit`}\n                            onClick={() => syncBackendCockpitReadModels({ silent: false, projectId: activeProject.id })}\n                            disabled={backendWorkerStationSyncDisabled}',
  'data-testid={`proof-map-${card.key}-sync-governance`}\n                              onClick={() => syncBackendGovernanceProofMapCard(card.syncKind)}\n                              disabled={backendWorkerStationSyncDisabled}',
  'data-testid={`proof-map-${card.key}-sync-proof-models`}\n                              onClick={() => syncBackendReadyPackageSubmodels({ silent: false, projectId: activeProject.id, includeLaunchControls: true })}\n                              disabled={backendWorkerStationSyncDisabled}',
], 'Proof Map dynamic backend sync route controls');

assertIncludes(appSource, [
  'Local fallback disabled for backend-synced project.',
  'Backend project missing; local seed suppressed',
  'data-testid="backend-save-project"',
  'Seed Sample/Dev',
  'frontendMockSuppressed',
  'backend model missing',
  'manager-flow-backend-required',
  'group-chat-collaboration-proof-backend-required',
  'group-chat-collaboration-proof-sync-manager-dashboard',
  'active-threads-task-proof-backend-required',
  'active-threads-sync-manager-dashboard',
  'recent-commit-line-backend-required',
  'recent-commit-line-sync-timeline-events',
  'agent-focus-backend-dashboard-required',
  'backend-production-launch-gap-register-sync-proof-models',
  'backend-production-launch-control-center-sync-proof-models',
  'backend-production-launch-evidence-dossier-sync-proof-models',
  'backend-production-evidence-integrity-audit-source',
  'backend-production-evidence-integrity-audit-sync-proof-models',
  '/settings/workflow-smoke',
  'settings-workflow-smoke/v1',
  'readyForLocalMvpWorkflowSmoke',
  "workflowSmoke?.transcriptProof?.hasSubmission === true",
  "workflowSmoke?.timelineProof?.hasSubmission === true",
  "workflowSmoke?.eventLedgerProof?.hasSubmission === true",
  'providerEvidenceReady',
  'providerEvidenceProof.providerUsageId',
  'useProviderEvidenceSearch: true',
  'requireProviderEvidenceSearch: true',
  'Backend Workflow Smoke passed: product-brief submission',
  'provider usage',
  'settings-health-workflow-smoke-output',
  'Backend Agent output created',
  'settingsWorkflowSmokeProofRows',
  'Provider Evidence',
  'Evidence Search',
  'Provider Usage',
  'transcript messages',
  'timeline logs',
  'event ledger events',
  'Workflow smoke did not produce expected provider-backed evidence.',
  "dataSource === 'frontend-fallback'",
  "dataSource: 'sample-fixture'",
  'backend-backed',
], 'React mock replacement boundary');
assertIncludes(registerSource, [
  '`POST /settings/workflow-smoke`',
  'React calls this single backend route',
], 'frontend mock replacement register Settings Workflow Smoke boundary');

const managerFallbackHelperSection = sliceBetween(
  appSource,
  'const backendOrAllowedFallback = (backendValue, fallbackValue, missingValue, readModelName) => (',
  'const managerReadModelMeta = (readModel = {}) => readModel || {};',
);
assertIncludes(managerFallbackHelperSection, [
  'const backendOrLazyFallback = (backendValue, fallbackFactory, missingValue, readModelName) => (',
  'allowManagerFrontendFallbacks',
  '? withFrontendFallbackMeta(fallbackFactory(), readModelName)',
], 'Manager lazy fallback helper');
assertIncludes(appSource, [
  'const managerReadModelMeta = (readModel = {}) => readModel || {};',
  'const managerReadModelSourceLabel = (readModel = {}) => {',
  'const meta = managerReadModelMeta(readModel);',
  "meta.dataSource === 'frontend-fallback'",
  'const managerProofModelSyncButton = (readModel = {}, testId) => managerReadModelMeta(readModel).frontendMockSuppressed',
  'const managerProofMapRouteSyncButton = (route = {}, testId) => managerReadModelMeta(route).frontendMockSuppressed',
], 'Manager read-model source helpers must be null-safe');

const managerCommandCenterSection = sliceBetween(
  appSource,
  'const buildFallbackManagerCommandCenter = () => ({',
  'const latestManagerActionRun = backendManagerActionRuns.latestRun',
);
assertIncludes(managerCommandCenterSection, [
  'const managerCommandCenter = backendOrLazyFallback(',
  'buildFallbackManagerCommandCenter,',
  "missingBackendReadModel('manager-command-center/v1'",
  "openTasks: projectText('backend required')",
  "changeRequests: projectText('backend required')",
  'liveLanes: []',
], 'Manager Command Center lazy fallback boundary');
assert(
  managerCommandCenterSection.indexOf('const managerCommandCenter = backendOrLazyFallback(')
    > managerCommandCenterSection.indexOf('const buildFallbackManagerCommandCenter = () => ({'),
  'Manager Command Center fallback must be a lazy builder so backend-online real projects do not construct browser-local command-center rows.',
);

const proofMapAgentMessageRouteSection = sliceBetween(
  appSource,
  'const backendTranscriptProofCoverageSummary =',
  'const backendReadyPackageSubmodels =',
);
assertIncludes(proofMapAgentMessageRouteSection, [
  'const backendTranscriptProofCoverageRouteReadModel =',
  "schemaVersion: 'transcript-proof-coverage-route/missing-backend'",
  'backend-transcript-proof-coverage-route-required',
  'Readiness Proof Map must expose transcriptProofCoverageRoutes from the backend.',
  'const backendTranscriptProofCoverageSource =',
  'const backendTranscriptProofCoverageReady = Boolean(',
  'const backendTranscriptChannelRoutesReadModel =',
  "schemaVersion: 'transcript-channel-route/missing-backend'",
  'backend-transcript-channel-route-required',
  'Readiness Proof Map must expose transcriptChannelRoutes from the backend.',
  'const backendTranscriptChannelSource =',
  'const backendTranscriptChannelReady = Boolean(',
  'const missingTranscriptProofMapRoute =',
  'const routeAwareProofMapRoutes =',
  'const routeAwareProofMapReady =',
  'const backendTranscriptChannelPinRoutesReadModel =',
  "'transcript-channel-pin-route',",
  'backend-transcript-channel-pin-route-required',
  'Readiness Proof Map must expose transcriptChannelPinRoutes from the backend.',
  'const backendTranscriptChannelPinSource =',
  'const backendTranscriptChannelPinReady = routeAwareProofMapReady(',
  'const backendTranscriptPinRoutesReadModel =',
  "'transcript-pin-route',",
  'backend-transcript-pin-route-required',
  'Readiness Proof Map must expose transcriptPinRoutes from the backend.',
  'const backendTranscriptPinSource =',
  'const backendTranscriptPinReady = routeAwareProofMapReady(',
  'const backendTranscriptReplyRoutesReadModel =',
  "'transcript-reply-route',",
  'backend-transcript-reply-route-required',
  'Readiness Proof Map must expose transcriptReplyRoutes from the backend.',
  'const backendTranscriptReplySource =',
  'const backendTranscriptReplyReady = routeAwareProofMapReady(',
  'const backendTranscriptMentionRoutesReadModel =',
  "'transcript-mention-route',",
  'backend-transcript-mention-route-required',
  'Readiness Proof Map must expose transcriptMentionRoutes from the backend.',
  'const backendTranscriptMentionSource =',
  'const backendTranscriptMentionReady = routeAwareProofMapReady(',
  'const backendTranscriptAttachmentRoutesReadModel =',
  "'transcript-attachment-route',",
  'backend-transcript-attachment-route-required',
  'Readiness Proof Map must expose transcriptAttachmentRoutes from the backend.',
  'const backendTranscriptAttachmentSource =',
  'const backendTranscriptAttachmentReady = routeAwareProofMapReady(',
  'const backendTranscriptMemberPresenceRoutesReadModel =',
  "'transcript-member-presence-route',",
  'backend-transcript-member-presence-route-required',
  'Readiness Proof Map must expose transcriptMemberPresenceRoutes from the backend.',
  'const backendTranscriptMemberPresenceSource =',
  'const backendTranscriptMemberPresenceReady = routeAwareProofMapReady(',
  'const backendAgentMessageSummary =',
  'const backendAgentMessageRoutesReadModel =',
  "schemaVersion: 'agent-message-route/missing-backend'",
  'backend-agent-message-route-required',
  'Readiness Proof Map must expose agentMessageRoutes from the backend.',
  'const backendAgentMessageProofMapSource =',
  'const backendAgentMessageProofRouteReady = Boolean(',
  'const backendAgentContractSummary =',
  'const backendAgentContractRoutesReadModel =',
  "schemaVersion: 'agent-contract-route/missing-backend'",
  'backend-agent-contract-route-required',
  'Readiness Proof Map must expose agentContractRoutes from the backend.',
  'const backendAgentContractProofMapSource =',
  'const backendAgentContractProofRouteReady = routeAwareProofMapReady(',
], 'Manager Proof Map Agent-to-Agent message route missing-state boundary');

const proofMapSettingsRouteSection = sliceBetween(
  appSource,
  'const settingsProofMapRouteOrMissing =',
  'const backendTranscriptProofCoverageSummary =',
);
assertIncludes(proofMapSettingsRouteSection, [
  'const backendSettingsProofMapCards = settingsProofMapSpecs.map',
  'localMvpStartupReadinessRoutes',
  'settingsHealthReadinessRoutes',
  'settingsProviderReadinessRoutes',
  'settingsRuntimeReadinessRoutes',
  'settingsIntegrationReadinessRoutes',
  'backend-local-mvp-startup-readiness-route-required',
  'backend-settings-health-readiness-route-required',
  'backend-settings-provider-readiness-route-required',
  'backend-settings-runtime-readiness-route-required',
  'backend-settings-integration-readiness-route-required',
  'Readiness Proof Map must expose localMvpStartupReadinessRoutes from the backend.',
  'Readiness Proof Map must expose settingsHealthReadinessRoutes from the backend.',
  'Readiness Proof Map must expose settingsProviderReadinessRoutes from the backend.',
  'Readiness Proof Map must expose settingsRuntimeReadinessRoutes from the backend.',
  'Readiness Proof Map must expose settingsIntegrationReadinessRoutes from the backend.',
  'const autonomyProofMapRouteOrMissing =',
  'const backendCoreAutonomyProofMapCards = coreAutonomyProofMapSpecs.map',
  'productTeamOperatingLoopRoutes',
  'plannerExecutorReviewerStateMachineRoutes',
  'teamCollaborationDiagnosticRoutes',
  'teamCollaborationDiagnosticsSummary',
  'runtimeAutonomyStatusSummary',
  'agentStateSummarySummary',
  'assignmentTimelineMatrixSummary',
  'changeFlowSummary',
  'continuousWorkLoopSummary',
  'governanceProtocolSummary',
  'managerCommandCenterSummary',
  'managerScenarioTrailSummary',
  'managerScenarioWalkthroughSummary',
  'managerRequirementMatrixSummary',
  'syncProtocolAuditSummary',
  'managerUseCaseAuditSummary',
  'managerActionQueueSummary',
  'runtimeContractFreezeRoutes',
  'autonomousCycleConsistencyRoutes',
  'runtimeAutonomyStatusRoutes',
  'agentStateSummaryRoutes',
  'assignmentTimelineMatrixRoutes',
  'changeFlowRoutes',
  'continuousWorkLoopRoutes',
  'const governanceProofMapSpecs = [',
  'const backendGovernanceProofMapCards = governanceProofMapSpecs.map',
  'governanceProtocolRoutes',
  'managerCommandCenterRoutes',
  'managerScenarioTrailRoutes',
  'managerScenarioWalkthroughRoutes',
  'managerRequirementMatrixRoutes',
  'syncProtocolAuditRoutes',
  'managerUseCaseAuditRoutes',
  'managerActionQueueRoutes',
  'backend-product-team-operating-loop-route-required',
  'backend-planner-executor-reviewer-state-machine-route-required',
  'backend-team-collaboration-diagnostics-route-required',
  'backend-runtime-contract-freeze-route-required',
  'backend-autonomous-cycle-consistency-route-required',
  'backend-runtime-autonomy-status-route-required',
  'backend-agent-state-summary-route-required',
  'backend-assignment-timeline-matrix-route-required',
  'backend-change-flow-route-required',
  'backend-continuous-work-loop-route-required',
  'backend-governance-protocol-route-required',
  'backend-manager-command-center-route-required',
  'backend-manager-scenario-trail-route-required',
  'backend-manager-scenario-walkthrough-route-required',
  'backend-manager-requirement-matrix-route-required',
  'backend-sync-protocol-audit-route-required',
  'backend-manager-use-case-audit-route-required',
  'backend-manager-action-queue-route-required',
  'Readiness Proof Map must expose productTeamOperatingLoopRoutes from the backend.',
  'Readiness Proof Map must expose plannerExecutorReviewerStateMachineRoutes from the backend.',
  'Readiness Proof Map must expose teamCollaborationDiagnosticRoutes from the backend.',
  'Readiness Proof Map must expose runtimeContractFreezeRoutes from the backend.',
  'Readiness Proof Map must expose autonomousCycleConsistencyRoutes from the backend.',
  'Readiness Proof Map must expose runtimeAutonomyStatusRoutes from the backend.',
  'Readiness Proof Map must expose agentStateSummaryRoutes from the backend.',
  'Readiness Proof Map must expose assignmentTimelineMatrixRoutes from the backend.',
  'Readiness Proof Map must expose changeFlowRoutes from the backend.',
  'Readiness Proof Map must expose continuousWorkLoopRoutes from the backend.',
  'Readiness Proof Map must expose governanceProtocolRoutes from the backend.',
  'Readiness Proof Map must expose managerCommandCenterRoutes from the backend.',
  'Readiness Proof Map must expose managerScenarioTrailRoutes from the backend.',
  'Readiness Proof Map must expose managerScenarioWalkthroughRoutes from the backend.',
  'Readiness Proof Map must expose managerRequirementMatrixRoutes from the backend.',
  'Readiness Proof Map must expose syncProtocolAuditRoutes from the backend.',
  'Readiness Proof Map must expose managerUseCaseAuditRoutes from the backend.',
  'Readiness Proof Map must expose managerActionQueueRoutes from the backend.',
  'const outputProofMapRouteOrMissing =',
  'const backendOutputChainProofMapCards = outputChainProofMapSpecs.map',
  'submissionRoutes',
  'submissionSummary',
  'evidenceSearchRoutes',
  'evidenceSearchSummary',
  'evidenceQualityRoutes',
  'evidenceQualitySummary',
  'evidenceSourceReviewWorkflowRoutes',
  'evidenceSourceReviewWorkflowSummary',
  'evidenceIndexReadinessRoutes',
  'evidenceIndexReadinessSummary',
  'brainstormLayerRoutes',
  'brainstormLayerSummary',
  'artifactQualityRoutes',
  'artifactQualitySummary',
  'evidenceCustodyRoutes',
  'evidenceCustodySummary',
  'projectEvidenceArchiveRoutes',
  'projectEvidenceArchiveSummary',
  'backend-agent-submission-routes-required',
  'backend-evidence-search-routes-required',
  'backend-evidence-quality-audit-route-required',
  'backend-evidence-source-review-workflow-route-required',
  'backend-evidence-index-readiness-route-required',
  'backend-brainstorm-layer-route-required',
  'backend-artifact-quality-audit-route-required',
  'backend-evidence-custody-readiness-route-required',
  'backend-project-evidence-archive-route-required',
  'Readiness Proof Map must expose submissionRoutes from the backend when submissions exist.',
  'Readiness Proof Map must expose evidenceSearchRoutes from the backend when evidence searches exist.',
  'Readiness Proof Map must expose evidenceQualityRoutes from the backend.',
  'Readiness Proof Map must expose evidenceSourceReviewWorkflowRoutes from the backend.',
  'Readiness Proof Map must expose evidenceIndexReadinessRoutes from the backend.',
  'Readiness Proof Map must expose brainstormLayerRoutes from the backend.',
  'Readiness Proof Map must expose artifactQualityRoutes from the backend.',
  'Readiness Proof Map must expose evidenceCustodyRoutes from the backend.',
  'Readiness Proof Map must expose projectEvidenceArchiveRoutes from the backend.',
], 'Manager Proof Map Settings readiness route missing-state boundary');

const agentContractSection = sliceBetween(
  appSource,
  'const confirmAgentContractForProject = async',
  'const startContractStamp',
);
assertIncludes(agentContractSection, [
  'const contractTargetProject = targetProject || { id: projectId };',
  'const canUseLocalContractFallback = allowLocalRuntimeFallbackForActiveProject(contractTargetProject);',
  '/agents/contract',
  'includeReadModels: false',
  'applyBackendProjectSnapshot(payload)',
  'syncBackendManagerDashboard({ silent: true, projectId })',
  'syncBackendManagerFlowGraph({ silent: true, projectId })',
  'syncBackendAgentDashboard(agent.id, { silent: true, projectId })',
  'syncBackendTimelineAndEvents({ silent: true, projectId })',
  'const allowFallback = canUseLocalContractFallback;',
  'Backend Agent contract failed; local fallback disabled for backend-online project',
  'Backend Agent contract route required; local roster fallback disabled',
  'Save the backend API URL in Settings Deployment before contracting Agents into this backend-managed project.',
], 'Marketplace Agent contract backend boundary');
const agentContractBackendSuccessReturn = agentContractSection.indexOf('setTimeout(() => setSigningAgentId(null), 900);');
const agentContractBackendRequiredBlock = agentContractSection.indexOf('if (!canUseLocalContractFallback) {');
const agentContractLocalMutation = agentContractSection.indexOf('setProjects(prev => prev.map(project => {');
assert(
  agentContractBackendSuccessReturn >= 0
    && agentContractLocalMutation > agentContractBackendSuccessReturn,
  'Marketplace Agent contract must return after backend success before local roster mutation fallback can run.',
);
assert(
  agentContractBackendRequiredBlock >= 0
    && agentContractLocalMutation > agentContractBackendRequiredBlock,
  'Marketplace Agent contract must block backend-managed roster changes before local project mutation fallback can run.',
);

const agentContractPickerSection = sliceBetween(
  appSource,
  'const renderContractProjectPicker = () => {',
  'const renderSettingsModal = () => {',
);
assertIncludes(agentContractPickerSection, [
  'const canUseLocalContractFallback = allowLocalRuntimeFallbackForActiveProject(project);',
  'const contractBackendTargetMissing = !shouldAttemptBackendProjectWrite(project) && !canUseLocalContractFallback;',
  'const contractActionDisabled = Boolean(signingAgentId) || (!alreadyInTeam && contractBackendTargetMissing);',
  'openContractedProjectFromPicker(project.id);',
  'confirmAgentContractForProject(project.id);',
  'disabled={contractActionDisabled}',
  'contract-project-backend-required',
  'Backend Required',
], 'Marketplace Agent contract picker backend target boundary');

const eventLedgerFallbackSection = sliceBetween(
  appSource,
  'const timelineEventReadModelsRequired = shouldRequireBackendTimelineProof(activeProject);',
  'const eventLedgerDisplayRows = eventLedgerReadModel.eventLedger || [];',
);
assertIncludes(eventLedgerFallbackSection, [
  'const localEventLedgerFallbackAllowed = !timelineEventReadModelsRequired;',
  'const fallbackEventLedgerRows = localEventLedgerFallbackAllowed ? activeProject.eventLedger || [] : [];',
  'const fallbackEventLedgerSummary = localEventLedgerFallbackAllowed ? summarizeProjectEventLedger(activeProject) : missingEventLedgerSummary;',
], 'Unified Event Ledger local fallback boundary');

const dashboardStatsSection = sliceBetween(
  appSource,
  'const localRunStatsAllowed = !timelineEventReadModelsRequired;',
  'const managerLaunchers = [',
);
assertIncludes(dashboardStatsSection, [
  'dashboardBackendManagerDashboard?.autonomousRunControlLoops?.count',
  'dashboardBackendManagerDashboard?.autonomousRunControlRuns?.count',
  "localRunStatsAllowed ? activeProject.autonomousLedger?.length || 0 : projectText('backend required')",
  'dashboardBackendManagerDashboard?.agentAutonomousActionRuns?.count',
  'dashboardBackendManagerDashboard?.agentWorkerSummary?.count',
  "localRunStatsAllowed ? activeProject.agentWorkerLedger?.length || activeProject.autonomousLedger?.length || 0 : projectText('backend required')",
  "timelineEventReadModelsRequired ? projectText('backend required') : chatChannels.length",
  "timelineEventReadModelsRequired ? projectText('backend required') : (activeProject.tasks || []).filter(task => task.status !== 'done').length",
  'const projectDashboardStatSourceMeta = (source, detail) => ({',
  "const projectDashboardTimelineSourceMeta = backendTimelineLogs",
  'const projectDashboardEventLedgerSourceMeta = eventLedgerReadModel.frontendMockSuppressed',
  "const projectDashboardOpenTaskSourceMeta = dashboardBackendManagerDashboard?.tasks?.openCount !== undefined || dashboardBackendTaskRows",
  "const projectDashboardActiveChannelSourceMeta = dashboardBackendTranscriptIndex",
  "const projectDashboardAutonomousCycleSourceMeta = dashboardBackendManagerDashboard?.autonomousRunControlLoops?.count !== undefined || dashboardBackendManagerDashboard?.autonomousRunControlRuns?.count !== undefined",
  "const projectDashboardAgentRunSourceMeta = dashboardBackendManagerDashboard?.agentAutonomousActionRuns?.count !== undefined || dashboardBackendManagerDashboard?.agentWorkerSummary?.count !== undefined",
  'const projectDashboardKickoffExecutionFlowBackendRequired = Boolean(',
  "const projectDashboardFocusSourceMeta = projectDashboardKickoffExecutionFlowBackendRequired",
  "const projectDashboardFocusValue = projectDashboardKickoffExecutionFlowBackendRequired",
  "sourceId: 'focus', sourceMeta: projectDashboardFocusSourceMeta",
  "sourceId: 'active-channels', sourceMeta: projectDashboardActiveChannelSourceMeta",
  "sourceId: 'open-tasks', sourceMeta: projectDashboardOpenTaskSourceMeta",
  "sourceId: 'timeline-logs', sourceMeta: projectDashboardTimelineSourceMeta",
  "sourceId: 'event-ledger', sourceMeta: projectDashboardEventLedgerSourceMeta",
  "sourceId: 'autonomous-cycles', sourceMeta: projectDashboardAutonomousCycleSourceMeta",
  "sourceId: 'agent-runs', sourceMeta: projectDashboardAgentRunSourceMeta",
  "id: `init-log-${log.id || 'row'}-${index}`",
  'sourceLogId: log.id || null',
], 'Dashboard run-count backend boundary');
assertIncludes(appSource, [
  'const projectDashboardSnapshotSourceMeta = fixtureMeta',
  'const projectDashboardKickoffExecutionFlowBackendRequired = Boolean(',
  'const projectDashboardNextRecommendationBackendRequired = projectDashboardKickoffExecutionFlowBackendRequired;',
  '&& !dashboardBackendManagerDashboard?.kickoffExecutionFlow',
  "Sync Manager Dashboard before trusting the next recommendation for this backend project.",
  'data-testid="project-dashboard-snapshot-source"',
  'data-testid="project-dashboard-snapshot-source-detail"',
  'data-testid="project-dashboard-progress-source"',
  'data-testid="project-dashboard-progress-source-detail"',
  'data-testid="project-dashboard-next-recommendation-source"',
  'data-testid="project-dashboard-next-recommendation-source-detail"',
  'data-testid="project-dashboard-next-recommendation-sync-manager-dashboard"',
  "onClick={() => syncBackendManagerDashboard({ silent: false, projectId: activeProject.id })}",
  "data-testid={`project-dashboard-stat-source-${item.sourceId}`}",
  "data-testid={`project-dashboard-stat-source-detail-${item.sourceId}`}",
  "NEXT ACTION RESOLUTION: {projectDashboardNextRecommendationBackendRequired ? 'backend required'",
  "AGENT RECEIPTS: {projectDashboardNextRecommendationBackendRequired ? 'backend required'",
], 'Project Dashboard stat source labels');
assert(
  !appSource.includes('const dashboardStats = [')
    && !appSource.includes('No kickoff evidence has been created for this project yet.'),
  'Project Dashboard must not keep the obsolete browser-local dashboardStats/nextSuggestion mock state.',
);

const workspaceStatsSection = sliceBetween(
  appSource,
  'const localWorkspaceOpenTaskCount = projects.reduce',
  'return (\n    <div className="flex-1 p-12 overflow-y-auto fade-in bg-[#fdfdfc]">',
);
assertIncludes(workspaceStatsSection, [
  'const localWorkspaceOpenTaskCount = projects.reduce',
  'const localWorkspaceStoredMessageCount = chatMessages.length',
  'const backendCatalogProjects = Array.isArray(backendStation.projectCatalog) ? backendStation.projectCatalog : []',
  "const workspaceActiveProjectCount = backendStation.connectionStatus === 'online'",
  "const workspaceBackendProjectCount = backendStation.connectionStatus === 'online'",
  'backendStation.lastProjectCatalogSyncAt',
  'backendCatalogProjects.length',
  'const backendCatalogTaskCountForProject = (project = {}) => {',
  'project.tasks?.openCount',
  "if (Array.isArray(project.tasks)) return project.tasks.filter(task => task.status !== 'done').length;",
  'const backendCatalogMessageCountForProject = (project = {}) => {',
  'project.transcriptIndex?.messageCount',
  'if (Array.isArray(project.chatMessages)) return project.chatMessages.length;',
  "const workspaceOpenTaskCount = backendStation.connectionStatus === 'online'",
  'backendStation.lastProjectCatalogSyncAt && backendCatalogTaskCounts.every(count => count !== null)',
  'backendCatalogTaskCounts.reduce((count, value) => count + value, 0)',
  "const workspaceStoredMessageCount = backendStation.connectionStatus === 'online'",
  'backendStation.lastProjectCatalogSyncAt && backendCatalogMessageCounts.every(count => count !== null)',
  'backendCatalogMessageCounts.reduce((count, value) => count + value, 0)',
  "const workspaceActiveProjectSourceMeta = backendStation.connectionStatus === 'online'",
  "const workspaceBackendProjectSourceMeta = backendStation.connectionStatus === 'online'",
  "const workspaceOpenTaskSourceMeta = backendStation.connectionStatus === 'online'",
  "const workspaceStoredMessageSourceMeta = backendStation.connectionStatus === 'online'",
  'const workspaceBackendCatalogSummary = backendStation.connectionStatus === \'online\'',
  "const workspacePortfolioCatalogRequired = backendStation.connectionStatus === 'online' && !backendStation.lastProjectCatalogSyncAt;",
  "label: 'backend-catalog'",
  "label: 'backend offline'",
  "label: 'frontend-fallback'",
  "'backend required'",
], 'Workspace Hub catalog stats backend boundary');
assert(
  workspaceStatsSection.indexOf("const workspaceOpenTaskCount = backendStation.connectionStatus === 'online'")
    < workspaceStatsSection.indexOf(': localWorkspaceOpenTaskCount'),
  'Workspace Hub Open Tasks must use browser task counts only as the offline/demo fallback branch.',
);
assert(
  workspaceStatsSection.indexOf("const workspaceStoredMessageCount = backendStation.connectionStatus === 'online'")
    < workspaceStatsSection.indexOf(': localWorkspaceStoredMessageCount'),
  'Workspace Hub Stored Messages must use browser message counts only as the offline/demo fallback branch.',
);
assert(
  workspaceStatsSection.indexOf("const workspaceActiveProjectCount = backendStation.connectionStatus === 'online'")
    < workspaceStatsSection.indexOf(': projects.length'),
  'Workspace Hub Active Projects must use browser project counts only as the offline/demo fallback branch.',
);
assert(
  workspaceStatsSection.indexOf("const workspaceBackendProjectCount = backendStation.connectionStatus === 'online'")
    < workspaceStatsSection.indexOf(": 'offline'"),
  'Workspace Hub Backend Projects must show offline only as the non-backend branch.',
);
assertIncludes(appSource, [
  "{ icon: Cpu, label: 'Active Projects', val: workspaceActiveProjectCount }",
  "{ icon: Server, label: 'Backend Projects', val: workspaceBackendProjectCount }",
  "const statSourceMeta = stat.label === 'Open Tasks'",
  "stat.label === 'Active Projects'",
  "stat.label === 'Backend Projects'",
  "data-testid={`workspace-stat-source-${statId}`}",
  "data-testid={`workspace-stat-source-detail-${statId}`}",
  "data-testid={`project-progress-source-${proj.id}`}",
  "data-testid={`project-progress-source-detail-${proj.id}`}",
  '{workspaceBackendCatalogSummary}',
  'data-testid="workspace-portfolio-catalog-required"',
  'data-testid="workspace-portfolio-sync-catalog-required"',
  'const workspaceBackendCatalogSyncLabel = backendUrlConfigured',
  'Save Backend URL in Settings Deployment before syncing /projects.',
  'Save Backend URL in Settings Deployment before syncing backend projects.',
  '!workspacePortfolioCatalogRequired && projects.length === 0',
], 'Workspace Hub stat source labels');
assertIncludes(appSource, [
  'const settingsTabForStartupReadiness = (startupReadiness = null) => {',
  "if (!backendUrlConfigured) return 'deployment';",
  "if (!startupReadiness?.schemaVersion) return 'health';",
  "if (/secret-vault|seal|provider key|api.?key|vault/.test(nextActionText)) return 'keys';",
  "if (/runtime|model|search/.test(nextActionText)) return 'models';",
], 'Startup readiness Settings tab routing helper');
assertIncludes(appSource, [
  'data-testid="start-initiation-button"',
  'data-testid="start-initiation-backend-state"',
  "startupReadyForFirstRun ? 'Backend ready for first run' : backendUrlConfigured ? 'Setup required before kickoff' : 'Set backend URL before kickoff'",
  'const openWorkspaceStartInitiation = () => {',
  'setSettingsTab(settingsTabForStartupReadiness(localMvpStartupReadiness));',
  'data-testid="workspace-open-startup-settings"',
  'navToInitiation();',
  'onClick={openWorkspaceStartInitiation}',
  "const startupNextActionLabel = !backendUrlConfigured",
  'Save Backend URL in Settings Deployment before syncing startup readiness.',
], 'Workspace Start Initiation readiness state boundary');
assert(
  !appSource.includes('data-testid="workspace-open-settings-keys"'),
  'Workspace startup setup action must not be hard-wired to Settings Keys.',
);

const initiationStartupGuardSection = sliceBetween(
  appSource,
  'const ensureInitiationStartupReady',
  'const startInitiationMeetingSession',
);
assertIncludes(initiationStartupGuardSection, [
  "if (!backendUrlConfigured && !isDevelopmentInitiationFallbackEnabled()) {",
  'Save the backend API URL in Settings Deployment before ${actionLabel}. No backend kickoff or local fallback project was created.',
  'startupReadiness?.readyForFirstProjectRun !== true',
  'refreshLocalMvpStartupReadiness({ silent: true })',
  'startupReadiness?.readyForFirstProjectRun === true || isDevelopmentInitiationFallbackEnabled()',
  'Project initiation startup blocked',
  'No backend kickoff or local fallback project was created.',
], 'Initiation startup readiness command guard');

const initiationStartupRenderSection = sliceBetween(
  appSource,
  'const initiationStartupReadiness = providerRuntimeStatus.localMvpStartupReadiness',
  'const updateDraft =',
);
assertIncludes(initiationStartupRenderSection, [
  'const initiationStartupReadyForFirstRun = backendUrlConfigured && initiationStartupReadiness?.readyForFirstProjectRun === true;',
  'const initiationCanStartKickoff = initiationStartupReadyForFirstRun || initiationDevelopmentFallbackAllowed;',
  'const initiationCanApproveProject = initiationCanStartKickoff && (Boolean(initiationMeetingSession) || initiationDevelopmentFallbackAllowed);',
  'Save Backend URL in Settings Deployment before syncing startup readiness.',
  'Sync backend startup readiness before starting a real kickoff.',
  'const initiationStartupSettingsTab = settingsTabForStartupReadiness(initiationStartupReadiness);',
], 'Initiation startup readiness render state');
const localMvpStartupReadinessRefreshSection = sliceBetween(
  appSource,
  'const refreshLocalMvpStartupReadiness = async ({ silent = true } = {}) => {',
  'const ensureInitiationStartupReady',
);
assertIncludes(localMvpStartupReadinessRefreshSection, [
  'if (!backendUrlConfigured) {',
  'Save the backend API URL in Settings Deployment before syncing local MVP startup readiness.',
  'const baseUrl = normalizeBackendBaseUrl(backendStation.baseUrl || DEFAULT_AGENT_BACKEND_URL);',
], 'Local MVP startup readiness configured backend target guard');
assertIncludes(appSource, [
  'data-testid="initiation-startup-readiness-gate"',
  'Backend startup required before real kickoff',
  'data-testid="initiation-sync-startup"',
  'data-testid="initiation-open-startup-settings"',
  'setSettingsTab(initiationStartupSettingsTab);',
  'disabled={!initiationCanStartKickoff || providerRuntimeStatus.running}',
], 'Initiation startup readiness UI boundary');
assert(
  !appSource.includes('data-testid="initiation-open-settings-keys"'),
  'Initiation startup setup action must not be hard-wired to Settings Keys.',
);

const initiationApprovalSection = sliceBetween(
  appSource,
  'const approveInitiationProject = async () => {',
  'let projectReadyForWork = {',
);
assertIncludes(initiationApprovalSection, [
  "ensureInitiationStartupReady('approving the project')",
  'Create a backend kickoff meeting session before approving. No local fallback project was created.',
  "requestAgentBackend('/product-team-missions'",
  "missionType: 'generic-product-team'",
  'reuseExistingKickoffMeeting: Boolean(sessionId)',
  'startAutopilot: true',
  'runInitialTick: true',
  'includeReadModels: false',
  'Product Team Mission Runner approved kickoff and started backend autonomy',
  'refreshProjectInitiationReadModels',
  'No local fallback project was created.',
  'if (!isDevelopmentInitiationFallbackEnabled())',
  "dataSource: 'development-fallback'",
], 'Initiation approval Mission Runner boundary');
assertIncludes(appSource, [
  'data-testid="initiation-approve-create"',
  'disabled={!initiationCanApproveProject || providerRuntimeStatus.running}',
], 'Initiation approval UI boundary');

const projectInitiationRefreshSection = sliceBetween(
  appSource,
  'const refreshProjectInitiationReadModels = async',
  'const syncBackendAgentDashboard = async',
);
assertIncludes(projectInitiationRefreshSection, [
  'fetchReadModel(readRoutes.readinessProofMapRoute, `/projects/${encodeURIComponent(targetProjectId)}/readiness-proof-map`, 8000)',
  'fetchReadModel(readRoutes.agentAutonomousActionQueueRoute, `/projects/${encodeURIComponent(targetProjectId)}/agent-autonomous-action-queue`, 8000)',
  'const readinessProofMap = readinessProofMapResult.status === \'fulfilled\' ? readinessProofMapResult.value : null;',
  'const readinessProofMapAppliedThroughManagerPayload = Boolean(readinessProofMap && (dashboard || readyPackage?.managerDashboard));',
  'managerReadyPackage: readyPackage ? { ...readyPackage, readinessProofMap: readinessProofMap || readyPackage.readinessProofMap } : null,',
  'readinessProofMap,',
  'if (readinessProofMap && !readinessProofMapAppliedThroughManagerPayload) {',
  'agentAutonomousActionQueue: agentAutonomousActionQueue || prev.agentAutonomousActionQueue,',
  'lastAgentAutonomousActionQueueSyncAt: agentAutonomousActionQueue ? new Date().toISOString() : prev.lastAgentAutonomousActionQueueSyncAt,',
  'agentAutonomousActionQueueSyncCount: agentAutonomousActionQueue ? (prev.agentAutonomousActionQueueSyncCount || 0) + 1 : prev.agentAutonomousActionQueueSyncCount,',
], 'Project initiation proof and Agent queue read-model refresh boundary');

const warRoomMeetingCommandSection = sliceBetween(
  appSource,
  'const submitRoomInput = async',
  'const insertMention = (name) =>',
);
assertIncludes(warRoomMeetingCommandSection, [
  "runBackendProjectCommand('meeting'",
  'playBackendMeetingTurns',
  'meetingAgentTurns: backendResult?.meetingAgentTurns || backendResult?.responses?.meetingAgentTurns || []',
  'allowLocalRuntimeFallbackForActiveProject(nextProject)',
  'setRoomInput(current => current || text)',
  'blockMissingBackendMeetingTurns',
  'Backend meeting returned no Agent turns; local simulation blocked; draft restored',
  'Backend meeting failed; local fallback disabled for backend-online project; draft restored',
  'Backend meeting command timed out.',
  'if (!allowFallback) {',
  'return;',
  'const meetingResult = submitProjectMeetingMessage({',
  'runRoomSimulation(text, nextProject)',
], 'War Room meeting backend fail-closed command boundary');
assert(
  warRoomMeetingCommandSection.indexOf("runBackendProjectCommand('meeting'") < warRoomMeetingCommandSection.indexOf('const meetingResult = submitProjectMeetingMessage({'),
  'War Room meeting must try the backend command before any local meeting mutation.',
);
assert(
  warRoomMeetingCommandSection.indexOf('Backend meeting failed; local fallback disabled for backend-online project; draft restored')
    < warRoomMeetingCommandSection.indexOf('const meetingResult = submitProjectMeetingMessage({'),
  'War Room meeting backend-required failures must be handled before local meeting fallback code.',
);

const warRoomMeetingRenderSection = sliceBetween(
  appSource,
  'const renderProjectMeeting = (meetingProject = activeProject, meetingOptions = {}) =>',
  'const renderProjectChat = () =>',
);
assertIncludes(warRoomMeetingRenderSection, [
  'const submitMeetingInput = meetingOptions.onSubmit || submitRoomInput;',
  'const usesCustomMeetingSubmit = Boolean(meetingOptions.onSubmit);',
  'const backendMeetingSendRequired = !usesCustomMeetingSubmit',
  'const canSendMeeting = Boolean(roomInput.trim()) && !backendMeetingSendRequired;',
  'data-testid="backend-meeting-send-required"',
  'data-testid="backend-meeting-send-open-deployment"',
  'data-testid="project-meeting-input"',
  'if (canSendMeeting) submitMeetingInput(meetingProject);',
  'data-testid="project-meeting-send"',
  'onClick={() => submitMeetingInput(meetingProject)}',
  'disabled={!canSendMeeting}',
  'data-testid="project-meeting-input-legacy"',
  "onKeyDown={(e) => { if (e.key === 'Enter' && canSendMeeting) submitMeetingInput(meetingProject); }}",
  'data-testid="project-meeting-send-legacy"',
], 'War Room meeting send UI backend target boundary');

const legacyWarRoomCommandSection = sliceBetween(
  appSource,
  'const startMeeting = async () =>',
  'const renderSettingsModal = () =>',
);
assertIncludes(legacyWarRoomCommandSection, [
  "runBackendProjectCommand('meeting'",
  'Backend meeting start failed; local fallback disabled for backend-online project',
  'Backend meeting start timed out.',
  'Backend meeting start returned no Agent turns; local simulation blocked',
  'blockMissingBackendMeetingTurns',
  'const session = startAgentSession(activeProject.team',
  'Backend legacy terminal meeting returned no Agent turns; local route simulation blocked',
  'Backend legacy terminal meeting failed; local fallback disabled for backend-online project',
  'BACKEND MEETING WRITE FAILED. DIRECTIVE RESTORED.',
  'Backend meeting close failed; local fallback disabled for backend-online project',
  'BACKEND MEETING CLOSE FAILED. SESSION REMAINS OPEN.',
], 'Legacy War Room backend fail-closed command boundary');
assert(
  legacyWarRoomCommandSection.indexOf("runBackendProjectCommand('meeting'") < legacyWarRoomCommandSection.indexOf('const session = startAgentSession(activeProject.team'),
  'Legacy War Room start must try backend meeting before local session fallback.',
);
assert(
  legacyWarRoomCommandSection.indexOf('Backend legacy terminal meeting failed; local fallback disabled for backend-online project')
    < legacyWarRoomCommandSection.indexOf('const meetingSourceMessage = isFeatureChange ? attachMessageReceipts({'),
  'Legacy War Room terminal backend-required failures must be handled before local change proof fallback.',
);
assert(
  legacyWarRoomCommandSection.indexOf('Backend meeting close failed; local fallback disabled for backend-online project')
    < legacyWarRoomCommandSection.indexOf("log: 'Session ended. Directives logged and distributed.'"),
  'Legacy War Room close backend-required failures must be handled before local close log fallback.',
);

const backendProjectCommandRefreshSection = sliceBetween(
  appSource,
  'const runBackendProjectCommand = async (action, body = {}) => {',
  'const recordTimelineAction = async ({',
);
assertIncludes(backendProjectCommandRefreshSection, [
  'applyBackendProjectSnapshot(payload);',
  'syncBackendManagerDashboard({ silent: true, projectId: payload.project?.id || activeProject.id });',
  'setTimeout(() => syncBackendManagerFlowGraph({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
  'setTimeout(() => syncBackendReadinessProofMap({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
  'setTimeout(() => syncBackendProjectTranscripts({',
  'setTimeout(() => syncBackendTimelineAndEvents({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
  'setTimeout(() => syncBackendReadyPackageSubmodels({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
], 'Shared backend project command proof refresh boundary');
assert(
  backendProjectCommandRefreshSection.indexOf('applyBackendProjectSnapshot(payload);')
    < backendProjectCommandRefreshSection.indexOf('setTimeout(() => syncBackendManagerFlowGraph({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);'),
  'Shared backend project command must apply the backend write snapshot before refreshing Flow Graph proof.',
);

const managerFlowNodeOpenSection = sliceBetween(
  appSource,
  'const openManagerFlowNode = async (nodeId, {',
  'const syncBackendManagerCommandCenter = async',
);
assertIncludes(managerFlowNodeOpenSection, [
  'const chatProofReady = await ensureProofMessagesAvailable(project, chatProofIds, \'main\');',
  'if (chatProofReady === false) return;',
  'setFocusedChatProofIds(chatProofIds);',
  'const timelineProofReady = await ensureTimelineEventsAvailable(project, timelineLogIds);',
  'if (timelineProofReady === false) return;',
  'setFocusedTimelineProofIds(timelineLogIds);',
  'await syncBackendManagerFlowGraph({ projectId: project?.id, silent: true });',
], 'Manager Flow node proof opening boundary');
assert(
  managerFlowNodeOpenSection.indexOf('const timelineProofReady = await ensureTimelineEventsAvailable(project, timelineLogIds);')
    < managerFlowNodeOpenSection.indexOf('setFocusedTimelineProofIds(timelineLogIds);'),
  'Manager Flow node timeline proof must be backend-checked before focusing timeline proof ids.',
);
assert(
  managerFlowNodeOpenSection.indexOf('const chatProofReady = await ensureProofMessagesAvailable(project, chatProofIds, \'main\');')
    < managerFlowNodeOpenSection.indexOf('setFocusedChatProofIds(chatProofIds);'),
  'Manager Flow node chat proof must be backend-checked before focusing chat proof ids.',
);

const managerFlowSelectedSubmissionSection = sliceBetween(
  appSource,
  'const selectedNodeSubmissionRouteCandidates = selectedNode ? [',
  'const connectedPeople = selectedNode',
);
assertIncludes(managerFlowSelectedSubmissionSection, [
  'selectedNode.submission?.route',
  'selectedNode.submission?.apiPath',
  'selectedNode.submissionRoute',
  'route.includes(\'/submissions/\')',
  'selectedNode.submission?.id',
  'selectedNode.submissionId',
  'selectedNode.resourceId',
  'agent-submission-',
  'document.querySelector(\'[data-testid="backend-manager-submissions-snapshot"]\')',
], 'Manager Flow selected submission record route boundary');

const timelineActionRefreshSection = sliceBetween(
  appSource,
  'const recordTimelineAction = async ({',
  'const updateProjectLanguageSetting = async',
);
assertIncludes(timelineActionRefreshSection, [
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/timeline/actions`',
  'includeReadModels: false',
  'applyBackendProjectSnapshot(payload);',
  'timelineActionReceipt: payload.timelineActionReceipt',
  'setTimeout(() => syncBackendManagerFlowGraph({ silent: true, projectId }), 0);',
  'setTimeout(() => syncBackendReadinessProofMap({ silent: true, projectId }), 0);',
  'setTimeout(() => syncBackendTimelineAndEvents({ silent: true, projectId }), 0);',
  'setTimeout(() => syncBackendReadyPackageSubmodels({ silent: true, projectId }), 0);',
], 'Timeline action proof refresh boundary');
assert(
  timelineActionRefreshSection.indexOf('applyBackendProjectSnapshot(payload);')
    < timelineActionRefreshSection.indexOf('setTimeout(() => syncBackendManagerFlowGraph({ silent: true, projectId }), 0);'),
  'Timeline action must apply the backend write snapshot before refreshing Flow Graph proof.',
);

const timelineActionRenderSection = sliceBetween(
  appSource,
  'data-testid="timeline-actions-backend-contract"',
  'data-testid="timeline-action-latest-receipt"',
);
assertIncludes(appSource, [
  'const canRecordTimelineAction = Boolean(selected && backendCommandAvailable && !backendStation.loading);',
], 'Timeline action command availability boundary');
assertIncludes(timelineActionRenderSection, [
  'data-testid="timeline-action-save-note"',
  "onClick={() => submitSelectedTimelineAction('note')}",
  'disabled={!canRecordTimelineAction || !timelineActionDraft.trim()}',
  'data-testid="timeline-action-acknowledge"',
  "onClick={() => submitSelectedTimelineAction('acknowledge')}",
  'disabled={!canRecordTimelineAction}',
  'data-testid="timeline-action-complete"',
  "onClick={() => submitSelectedTimelineAction('complete')}",
  'data-testid="timeline-action-edit"',
  "onClick={() => submitSelectedTimelineAction('edit')}",
], 'Timeline action backend route UI boundary');

assertIncludes(appSource, [
  'const timelineIds = changeTimelineProofIds(change);\n                                openProjectTimelineProof(timelineIds);',
  'const timelineIds = handoffTimelineProofIds(handoff);\n                                openProjectTimelineProof(timelineIds);',
  'onClick={() => openProjectTimelineProof(evidence.timelineIds)}',
], 'Dashboard timeline proof buttons must use backend-aware opener');
for (const forbiddenTimelineBypass of [
  'setFocusedTimelineProofIds(evidence.timelineIds);',
  'setFocusedTimelineProofIds(timelineIds);\n                                setSelectedTimelineEventId(timelineIds[0] || null);\n                                enterProjectScene(\'timeline\');',
]) {
  assert(!appSource.includes(forbiddenTimelineBypass), `Dashboard timeline proof buttons must not bypass backend timeline proof gate: ${forbiddenTimelineBypass}.`);
}

const legacyWarRoomRenderSection = sliceBetween(
  appSource,
  'const renderWarRoomView = () =>',
  '// --- Root Layout ---',
);
assertIncludes(legacyWarRoomRenderSection, [
  'const legacyWarRoomLocalFallbackAllowed = allowLocalRuntimeFallbackForActiveProject(activeProject);',
  'const legacyWarRoomBackendTargetMissing = !shouldAttemptBackendProjectWrite(activeProject) && !legacyWarRoomLocalFallbackAllowed;',
  "const openLegacyWarRoomDeploymentSettings = () => { setSettingsTab('deployment'); setSettingsOpen(true); };",
  'data-testid="legacy-war-room-end-meeting"',
  'onClick={endMeeting}',
  'disabled={legacyWarRoomBackendTargetMissing}',
  'data-testid="legacy-war-room-start-meeting"',
  'onClick={startMeeting}',
  'disabled={legacyWarRoomBackendTargetMissing}',
  'data-testid="legacy-war-room-backend-required"',
  'data-testid="legacy-war-room-open-deployment"',
  'data-testid="legacy-war-room-terminal-input"',
  'onKeyDown={handleTerminalSubmit}',
  'disabled={legacyWarRoomBackendTargetMissing}',
], 'Legacy War Room UI backend target boundary');

const legacyWarRoomActionSection = sliceBetween(
  appSource,
  'const startMeeting = async () =>',
  '// --- UI COMPONENTS ---',
);
assertIncludes(legacyWarRoomActionSection, [
  'Backend meeting start route required; local War Room simulation disabled',
  'Save the backend API URL in Settings Deployment before starting meetings for this backend-managed project.',
  'const session = startAgentSession(activeProject.team, {',
  'Backend legacy terminal meeting route required; local route simulation disabled',
  'Save the backend API URL in Settings Deployment before sending War Room directives for this backend-managed project.',
  'BACKEND MEETING ROUTE REQUIRED. DIRECTIVE RESTORED.',
  'const meetingSourceMessage = isFeatureChange ? attachMessageReceipts({',
  'Backend meeting close route required; local meeting close fallback disabled',
  'Save the backend API URL in Settings Deployment before closing meetings for this backend-managed project.',
  'BACKEND MEETING CLOSE ROUTE REQUIRED. SESSION REMAINS OPEN.',
  'Session ended. Directives logged and distributed.',
], 'Legacy War Room backend fail-closed action boundary');
assert(
  legacyWarRoomActionSection.indexOf('Backend meeting start route required; local War Room simulation disabled')
    < legacyWarRoomActionSection.indexOf('const session = startAgentSession(activeProject.team, {'),
  'Legacy War Room start must block backend-required projects before local session simulation.',
);
assert(
  legacyWarRoomActionSection.indexOf('Backend legacy terminal meeting route required; local route simulation disabled')
    < legacyWarRoomActionSection.indexOf('const meetingSourceMessage = isFeatureChange ? attachMessageReceipts({'),
  'Legacy War Room terminal directives must block backend-required projects before local message/change proof.',
);
assert(
  legacyWarRoomActionSection.indexOf('Backend meeting close route required; local meeting close fallback disabled')
    < legacyWarRoomActionSection.indexOf('Session ended. Directives logged and distributed.'),
  'Legacy War Room close must block backend-required projects before local meeting close log mutation.',
);

const managerDirectCommandSection = sliceBetween(
  appSource,
  'const blockManagerLocalCommandFallback = ({ project = activeProject, lastAction, error }) => {',
  'const agentDashboardSnapshotKey = (projectId, agentId) =>',
);
assertIncludes(managerDirectCommandSection, [
  'const blockManagerLocalCommandFallback = ({ project = activeProject, lastAction, error }) => {',
  'if (allowLocalRuntimeFallbackForActiveProject(project)) return false;',
  "runBackendProjectCommand('change-request', body)",
  'Backend dual-channel change failed; local fallback disabled for backend-online project',
  'Backend dual-channel change route required; local manager change fallback disabled',
  'Save the backend API URL in Settings Deployment before broadcasting changes for this backend-managed project.',
  'const result = submitProjectMultiChannelChangeRequest({',
  'const submitManagerChangeIntake = async () => {',
  'const action = isMeeting ? \'meeting\' : \'chat\';',
  'const payload = await runBackendProjectCommand(action, body);',
  'Backend manager change intake failed; local fallback disabled for backend-online project',
  'Backend manager change route required; local manager intake fallback disabled',
  'Save the backend API URL in Settings Deployment before sending Manager changes for this backend-managed project.',
  '? submitProjectMeetingMessage({ project: activeProject, language: activeLanguage, ...body })',
  ': submitProjectChatMessage({ project: activeProject, language: activeLanguage, ...body });',
  'const submitManagerLeaderAssignment = async () => {',
  "const payload = await runBackendProjectCommand('chat', body);",
  'Backend Leader assignment failed; local fallback disabled for backend-online project',
  'Backend Leader assignment route required; local assignment fallback disabled',
  'Save the backend API URL in Settings Deployment before assigning work for this backend-managed project.',
  'const result = submitProjectChatMessage({',
  "requestAgentBackend('/workers/autonomous/tick'",
  'forceProjectRun: true',
  'forceAgentRun: true',
  'reviewPendingSubmissions: true',
  'setTimeout(() => syncBackendProjectTranscripts({ silent: true, projectId: activeProject.id }), 0);',
  'setTimeout(() => syncBackendTimelineAndEvents({ silent: true, projectId: activeProject.id }), 0);',
  'if (backendResult || !allowLocalRuntimeFallbackForActiveProject(activeProject)) return backendResult;',
  'Local autonomous pulse blocked; backend route required',
  'return runAutonomousCycle(activeProject.id, cadence);',
], 'Manager direct command backend fail-closed boundary');
assert(
  managerDirectCommandSection.indexOf("runBackendProjectCommand('change-request', body)")
    < managerDirectCommandSection.indexOf('const result = submitProjectMultiChannelChangeRequest({'),
  'Dual-channel Manager change must try backend change-request before local multi-channel fallback.',
);
assert(
  managerDirectCommandSection.indexOf('Backend dual-channel change route required; local manager change fallback disabled')
    < managerDirectCommandSection.indexOf('const result = submitProjectMultiChannelChangeRequest({'),
  'Dual-channel Manager change must block backend-required projects before local multi-channel fallback.',
);
assert(
  managerDirectCommandSection.indexOf('Backend manager change intake failed; local fallback disabled for backend-online project')
    < managerDirectCommandSection.indexOf('? submitProjectMeetingMessage({ project: activeProject, language: activeLanguage, ...body })'),
  'Manager change intake backend-required failures must be handled before local meeting/chat fallback.',
);
assert(
  managerDirectCommandSection.indexOf('Backend manager change route required; local manager intake fallback disabled')
    < managerDirectCommandSection.indexOf('? submitProjectMeetingMessage({ project: activeProject, language: activeLanguage, ...body })'),
  'Manager change intake must block backend-required projects before local meeting/chat fallback.',
);
assert(
  managerDirectCommandSection.indexOf('Backend Leader assignment failed; local fallback disabled for backend-online project')
    < managerDirectCommandSection.indexOf('const result = submitProjectChatMessage({'),
  'Manager Leader assignment backend-required failures must be handled before local chat fallback.',
);
assert(
  managerDirectCommandSection.indexOf('Backend Leader assignment route required; local assignment fallback disabled')
    < managerDirectCommandSection.indexOf('const result = submitProjectChatMessage({'),
  'Manager Leader assignment must block backend-required projects before local chat fallback.',
);
assert(
  managerDirectCommandSection.indexOf('Local autonomous pulse blocked; backend route required')
    < managerDirectCommandSection.indexOf('return runAutonomousCycle(activeProject.id, cadence);'),
  'Hour/Day pulse must block local autonomous cycle before local fallback code for backend-online projects.',
);

const managerDirectCommandRenderSection = sliceBetween(
  appSource,
  'data-testid="manager-leader-assignment-composer"',
  'data-testid="dual-channel-change-intake-matrix"',
);
assertIncludes(managerDirectCommandRenderSection, [
  'data-testid="manager-assignment-composer-input"',
  'data-testid="manager-assignment-composer-target"',
  'data-testid="manager-assignment-composer-submit"',
  'onClick={submitManagerLeaderAssignment}',
  'disabled={backendStation.loading || backendManagedCommandTargetMissing || !managerAssignmentDraft.text.trim() || Boolean(sceneTransition)}',
  'data-testid="manager-change-composer-input"',
  'data-testid="manager-change-composer-mode"',
  'data-testid="manager-change-composer-submit"',
  'onClick={submitManagerChangeIntake}',
  'disabled={backendStation.loading || backendManagedCommandTargetMissing || !managerChangeDraft.text.trim() || Boolean(sceneTransition)}',
  'data-testid="autonomous-work-loop-backend-required"',
  'data-testid="autonomous-work-loop-hour-pulse"',
  "onClick={() => runProjectAutonomousPulse('hourly')}",
  'disabled={autonomousPulseCommandDisabled}',
  'data-testid="autonomous-work-loop-day-report"',
  "onClick={() => runProjectAutonomousPulse('daily')}",
  'disabled={autonomousPulseCommandDisabled}',
], 'Manager direct command UI boundary');
assertIncludes(appSource, [
  'const localDirectCommandFallbackAllowed = allowLocalRuntimeFallbackForActiveProject(activeProject);',
  'const backendManagedCommandTargetMissing = !backendCommandAvailable && !localDirectCommandFallbackAllowed;',
  'const autonomousPulseCommandDisabled = backendStation.loading || backendManagedCommandTargetMissing;',
], 'Manager direct command pulse disabled boundary');

const readyPackageCoreCoordinationSection = sliceBetween(
  appSource,
  'const missingReadyPackageReadModel =',
  'const backendEvidenceQualityAudit =',
);
assertIncludes(readyPackageCoreCoordinationSection, [
  "const missingProductTeamDeliveryTrace = () => missingReadyPackageReadModel('product-team-delivery-trace'",
  "const missingZeroToAutonomyReport = () => missingReadyPackageReadModel('project-zero-to-autonomy-report'",
  "const missingProjectEvidenceArchive = () => missingReadyPackageReadModel('project-evidence-archive'",
  "const missingProductTeamOperatingLoop = () => missingReadyPackageReadModel('product-team-operating-loop'",
  "const missingPlannerExecutorReviewerStateMachine = () => missingReadyPackageReadModel('planner-executor-reviewer-state-machine'",
  "const missingTeamCollaborationDiagnostics = () => missingReadyPackageReadModel('team-collaboration-diagnostics'",
  "const missingRuntimeContracts = () => missingReadyPackageReadModel('runtime-contracts'",
  "const missingAutonomousCycleConsistency = () => missingReadyPackageReadModel('autonomous-cycle-consistency'",
  "const missingRuntimeAutonomyStatus = () => missingReadyPackageReadModel('runtime-autonomy-status'",
  "dataSource: 'backend-required'",
  'frontendMockSuppressed: true',
  "frontendFallbackMode: 'backend-required'",
  'readyForProduction: false',
], 'Manager Ready Package C/A coordination backend-required boundary');
for (const [modelName, missingName] of [
  ['backendProductTeamDeliveryTrace', 'missingProductTeamDeliveryTrace'],
  ['backendZeroToAutonomyReport', 'missingZeroToAutonomyReport'],
  ['backendProjectEvidenceArchive', 'missingProjectEvidenceArchive'],
  ['backendProductTeamOperatingLoop', 'missingProductTeamOperatingLoop'],
  ['backendPlannerExecutorReviewerStateMachine', 'missingPlannerExecutorReviewerStateMachine'],
  ['backendTeamCollaborationDiagnostics', 'missingTeamCollaborationDiagnostics'],
  ['backendRuntimeContracts', 'missingRuntimeContracts'],
  ['backendAutonomousCycleConsistency', 'missingAutonomousCycleConsistency'],
  ['backendRuntimeAutonomyStatus', 'missingRuntimeAutonomyStatus'],
]) {
  const modelIndex = readyPackageCoreCoordinationSection.indexOf(`const ${modelName} =`);
  const missingIndex = readyPackageCoreCoordinationSection.indexOf(`backendOnlineForReadyPackage && backendManagerReadyPackage ? ${missingName}() : null`);
  assert(modelIndex >= 0 && missingIndex > modelIndex, `${modelName} must use ${missingName} for backend-online real projects when the C/A read model is missing.`);
}

const proofMapProductTeamRouteSection = sliceBetween(
  appSource,
  'const missingReadinessProofRoute =',
  'const backendRuntimeContracts =',
);
assertIncludes(proofMapProductTeamRouteSection, [
  'const backendCollaborationIntentQueueRouteReadModel =',
  "missingReadinessProofRoute('collaboration-intent-queue-route'",
  'backend-collaboration-intent-queue-route-required',
  'Readiness Proof Map must expose collaborationIntentQueueRoutes from the backend.',
  'const backendSubmissionReviewWorkflowRouteReadModel =',
  "missingReadinessProofRoute('submission-review-workflow-route'",
  'backend-submission-review-workflow-route-required',
  'Readiness Proof Map must expose submissionReviewWorkflowRoutes from the backend.',
  'const backendProductTeamAcceptanceChainRouteReadModel =',
  "missingReadinessProofRoute('product-team-acceptance-chain-route'",
  'backend-product-team-acceptance-chain-route-required',
  'Readiness Proof Map must expose productTeamAcceptanceChainRoutes from the backend.',
  'const backendProductTeamDeliveryTraceRouteReadModel =',
  "missingReadinessProofRoute('product-team-delivery-trace-route'",
  'backend-product-team-delivery-trace-route-required',
  'Readiness Proof Map must expose productTeamDeliveryTraceRoutes from the backend.',
  'const backendZeroToAutonomyReportRouteReadModel =',
  "missingReadinessProofRoute('zero-to-autonomy-report-route'",
  'backend-zero-to-autonomy-report-route-required',
  'Readiness Proof Map must expose zeroToAutonomyReportRoutes from the backend.',
], 'Manager Proof Map product-team route missing-state boundary');

const readyPackageCoreCoordinationRenderSection = sliceBetween(
  appSource,
  'data-testid="backend-product-team-operating-loop-snapshot"',
  'data-testid="backend-project-evidence-archive-snapshot"',
);
assertIncludes(readyPackageCoreCoordinationRenderSection, [
  'data-testid="backend-product-team-operating-loop-source"',
  "managerProofModelSyncButton(backendProductTeamOperatingLoop, 'backend-product-team-operating-loop-sync-proof-models')",
  'data-testid="backend-product-team-operating-loop-route"',
  'data-testid="backend-planner-executor-reviewer-state-machine-source"',
  "managerProofModelSyncButton(backendPlannerExecutorReviewerStateMachine, 'backend-planner-executor-reviewer-state-machine-sync-proof-models')",
  'data-testid="backend-planner-executor-reviewer-state-machine-roles"',
  'data-testid="backend-planner-executor-reviewer-state-machine-transitions"',
  'data-testid="backend-planner-executor-reviewer-state-machine-route"',
  'data-testid="backend-team-collaboration-diagnostics-source"',
  "managerProofModelSyncButton(backendTeamCollaborationDiagnostics, 'backend-team-collaboration-diagnostics-sync-proof-models')",
  'data-testid="backend-team-collaboration-diagnostics-route"',
  'data-testid="backend-runtime-contracts-source"',
  "managerProofModelSyncButton(backendRuntimeContracts, 'backend-runtime-contracts-sync-proof-models')",
  'data-testid="backend-runtime-contracts-route"',
  'data-testid="backend-autonomous-cycle-consistency-source"',
  "managerProofModelSyncButton(backendAutonomousCycleConsistency, 'backend-autonomous-cycle-consistency-sync-proof-models')",
  'data-testid="backend-autonomous-cycle-consistency-route"',
  'data-testid="backend-runtime-autonomy-status-source"',
  "managerProofModelSyncButton(backendRuntimeAutonomyStatus, 'backend-runtime-autonomy-status-sync-proof-models')",
  'data-testid="backend-runtime-autonomy-status-route"',
  'data-testid="backend-runtime-autonomy-status-production-boundary"',
  'data-testid="backend-product-team-delivery-trace-source"',
  "managerProofModelSyncButton(backendProductTeamDeliveryTrace, 'backend-product-team-delivery-trace-sync-proof-models')",
  'data-testid="backend-product-team-delivery-trace-route"',
  'data-testid="backend-zero-to-autonomy-report-source"',
  "managerProofModelSyncButton(backendZeroToAutonomyReport, 'backend-zero-to-autonomy-report-sync-proof-models')",
  'data-testid={`backend-zero-to-autonomy-report-stage-proof-count-${row.id}`}',
  'data-testid={`backend-zero-to-autonomy-report-stage-route-${row.id}`}',
  'data-testid="backend-zero-to-autonomy-report-route"',
], 'Manager Ready Package C/A coordination source-label UI boundary');

const proofMapProductTeamRenderSection = sliceBetween(
  appSource,
  'data-testid="proof-map-product-team-acceptance-chain"',
  'managerProofMapDisplayRows.map',
);
const proofMapTranscriptCoverageRenderSection = sliceBetween(
  appSource,
  'data-testid="proof-map-transcript-proof-coverage"',
  'data-testid="proof-map-transcript-channel-routes"',
);
const proofMapSettingsRenderSection = sliceBetween(
  appSource,
  'data-testid="manager-proof-map-core-routes"',
  'data-testid="proof-map-transcript-proof-coverage"',
);
assertIncludes(proofMapSettingsRenderSection, [
  'backendSettingsProofMapCards.map',
  'managerReadModelSourceBadge(card.source, `proof-map-${card.key}-source`)',
  'managerProofMapRouteSyncButton(card.route, `proof-map-${card.key}-sync-proof-map`)',
  'data-testid={`proof-map-${card.key}-open-settings`}',
  'setSettingsTab(card.settingsTab);',
  'setSettingsOpen(true);',
  'data-testid={`proof-map-${card.key}-timeline-open`}',
  'backendCoreAutonomyProofMapCards.map',
  'data-testid={`proof-map-${card.key}-sync-proof-models`}',
  'syncBackendReadyPackageSubmodels({ silent: false, projectId: activeProject.id, includeLaunchControls: true })',
  'Autonomy timeline proof',
  'backendCockpitProofMapCards.map',
  'data-testid={`proof-map-${card.key}-sync-cockpit`}',
  'syncBackendCockpitReadModels({ silent: false, projectId: activeProject.id })',
  'Cockpit timeline proof',
  'backendOutputChainProofMapCards.map',
  'const cardChatProofIds = chatProofIdsFromIds(card.proofIds);',
  'data-testid={`proof-map-${card.key}-sync-proof-models`}',
  'data-testid={`proof-map-${card.key}-chat-open`}',
  'Output chat proof',
  'Output timeline proof',
], 'Manager Proof Map Settings readiness route cards source/sync UI boundary');
const proofMapTranscriptChannelRenderSection = sliceBetween(
  appSource,
  'data-testid="proof-map-transcript-channel-routes"',
  'data-testid="proof-map-transcript-channel-pin-routes"',
);
assertIncludes(proofMapTranscriptCoverageRenderSection, [
  "managerReadModelSourceBadge(backendTranscriptProofCoverageSource, 'proof-map-transcript-proof-coverage-source')",
  "managerProofMapRouteSyncButton(backendTranscriptProofCoverageRoute, 'proof-map-transcript-proof-coverage-sync-proof-map')",
  'backendTranscriptProofCoverageReady',
], 'Manager Proof Map transcript proof coverage route source/sync UI boundary');
assertIncludes(proofMapTranscriptChannelRenderSection, [
  "managerReadModelSourceBadge(backendTranscriptChannelSource, 'proof-map-transcript-channel-routes-source')",
  "managerProofMapRouteSyncButton(backendLatestTranscriptChannelRoute, 'proof-map-transcript-channel-routes-sync-proof-map')",
  'backendTranscriptChannelReady',
], 'Manager Proof Map transcript channel route source/sync UI boundary');
const transcriptActionProofMapCards = [
  {
    label: 'transcript channel pin',
    testId: 'proof-map-transcript-channel-pin-routes',
    nextTestId: 'proof-map-transcript-pin-routes',
    source: 'backendTranscriptChannelPinSource',
    sourceTestId: 'proof-map-transcript-channel-pin-routes-source',
    route: 'backendLatestTranscriptChannelPinRoute',
    syncTestId: 'proof-map-transcript-channel-pin-routes-sync-proof-map',
    ready: 'backendTranscriptChannelPinReady',
  },
  {
    label: 'transcript pin',
    testId: 'proof-map-transcript-pin-routes',
    nextTestId: 'proof-map-transcript-reply-routes',
    source: 'backendTranscriptPinSource',
    sourceTestId: 'proof-map-transcript-pin-routes-source',
    route: 'backendLatestTranscriptPinRoute',
    syncTestId: 'proof-map-transcript-pin-routes-sync-proof-map',
    ready: 'backendTranscriptPinReady',
  },
  {
    label: 'transcript reply',
    testId: 'proof-map-transcript-reply-routes',
    nextTestId: 'proof-map-transcript-mention-routes',
    source: 'backendTranscriptReplySource',
    sourceTestId: 'proof-map-transcript-reply-routes-source',
    route: 'backendLatestTranscriptReplyRoute',
    syncTestId: 'proof-map-transcript-reply-routes-sync-proof-map',
    ready: 'backendTranscriptReplyReady',
  },
  {
    label: 'transcript mention',
    testId: 'proof-map-transcript-mention-routes',
    nextTestId: 'proof-map-transcript-attachment-routes',
    source: 'backendTranscriptMentionSource',
    sourceTestId: 'proof-map-transcript-mention-routes-source',
    route: 'backendLatestTranscriptMentionRoute',
    syncTestId: 'proof-map-transcript-mention-routes-sync-proof-map',
    ready: 'backendTranscriptMentionReady',
  },
  {
    label: 'transcript attachment',
    testId: 'proof-map-transcript-attachment-routes',
    nextTestId: 'proof-map-transcript-member-presence-routes',
    source: 'backendTranscriptAttachmentSource',
    sourceTestId: 'proof-map-transcript-attachment-routes-source',
    route: 'backendLatestTranscriptAttachmentRoute',
    syncTestId: 'proof-map-transcript-attachment-routes-sync-proof-map',
    ready: 'backendTranscriptAttachmentReady',
  },
  {
    label: 'transcript member presence',
    testId: 'proof-map-transcript-member-presence-routes',
    nextTestId: 'proof-map-agent-message-routes',
    source: 'backendTranscriptMemberPresenceSource',
    sourceTestId: 'proof-map-transcript-member-presence-routes-source',
    route: 'backendLatestTranscriptMemberPresenceRoute',
    syncTestId: 'proof-map-transcript-member-presence-routes-sync-proof-map',
    ready: 'backendTranscriptMemberPresenceReady',
  },
];
for (const card of transcriptActionProofMapCards) {
  const section = sliceBetween(
    appSource,
    `data-testid="${card.testId}"`,
    `data-testid="${card.nextTestId}"`,
  );
  assertIncludes(section, [
    `managerReadModelSourceBadge(${card.source}, '${card.sourceTestId}')`,
    `managerProofMapRouteSyncButton(${card.route}, '${card.syncTestId}')`,
    card.ready,
  ], `Manager Proof Map ${card.label} route source/sync UI boundary`);
}
const proofMapCollaborationIntentRenderSection = sliceBetween(
  appSource,
  'data-testid="proof-map-collaboration-intent-queue"',
  'data-testid="proof-map-submission-review-workflow"',
);
const proofMapAgentMessageRenderSection = sliceBetween(
  appSource,
  'data-testid="proof-map-agent-message-routes"',
  'data-testid="proof-map-agent-contract-routes"',
);
const proofMapAgentContractRenderSection = sliceBetween(
  appSource,
  'data-testid="proof-map-agent-contract-routes"',
  'data-testid="proof-map-collaboration-intent-queue"',
);
assertIncludes(proofMapAgentMessageRenderSection, [
  "managerReadModelSourceBadge(backendAgentMessageProofMapSource, 'proof-map-agent-message-routes-source')",
  "managerProofMapRouteSyncButton(backendLatestAgentMessageRoute, 'proof-map-agent-message-routes-sync-proof-map')",
  'backendAgentMessageProofRouteReady',
], 'Manager Proof Map Agent-to-Agent message route source/sync UI boundary');
assertIncludes(proofMapAgentContractRenderSection, [
  "managerReadModelSourceBadge(backendAgentContractProofMapSource, 'proof-map-agent-contract-routes-source')",
  "managerProofMapRouteSyncButton(backendLatestAgentContractRoute, 'proof-map-agent-contract-routes-sync-proof-map')",
  'backendAgentContractProofRouteReady',
  'proof-map-agent-contract-dashboard-open',
  'proof-map-agent-contract-timeline-open',
], 'Manager Proof Map Agent contract route source/sync UI boundary');
assertIncludes(proofMapCollaborationIntentRenderSection, [
  "managerReadModelSourceBadge(backendCollaborationIntentQueueProofMapSource, 'proof-map-collaboration-intent-queue-source')",
  "managerProofMapRouteSyncButton(backendCollaborationIntentQueueRoute, 'proof-map-collaboration-intent-queue-sync-proof-map')",
], 'Manager Proof Map collaboration intent route source/sync UI boundary');
const proofMapSubmissionReviewRenderSection = sliceBetween(
  appSource,
  'data-testid="proof-map-submission-review-workflow"',
  'data-testid="proof-map-product-team-acceptance-chain"',
);
assertIncludes(proofMapSubmissionReviewRenderSection, [
  "managerReadModelSourceBadge(backendSubmissionReviewWorkflowProofMapSource, 'proof-map-submission-review-workflow-source')",
  "managerProofMapRouteSyncButton(backendSubmissionReviewWorkflowRoute, 'proof-map-submission-review-workflow-sync-proof-map')",
], 'Manager Proof Map submission review route source/sync UI boundary');
assertIncludes(proofMapProductTeamRenderSection, [
  "managerReadModelSourceBadge(backendProductTeamAcceptanceChainRoute, 'proof-map-product-team-acceptance-chain-source')",
  "managerProofMapRouteSyncButton(backendProductTeamAcceptanceChainRoute, 'proof-map-product-team-acceptance-chain-sync-proof-map')",
  "managerReadModelSourceBadge(backendProductTeamDeliveryTraceProofMapSource, 'proof-map-product-team-delivery-trace-source')",
  "managerProofMapRouteSyncButton(backendProductTeamDeliveryTraceRoute, 'proof-map-product-team-delivery-trace-sync-proof-map')",
  "managerReadModelSourceBadge(backendZeroToAutonomyReportProofMapSource, 'proof-map-zero-to-autonomy-report-source')",
  "managerProofMapRouteSyncButton(backendZeroToAutonomyReportRoute, 'proof-map-zero-to-autonomy-report-sync-proof-map')",
  'data-testid="proof-map-zero-to-autonomy-report-proof-count"',
], 'Manager Proof Map product-team route source/sync UI boundary');

const readyPackageProjectEvidenceArchiveRenderSection = sliceBetween(
  appSource,
  'data-testid="backend-project-evidence-archive-snapshot"',
  'data-testid="backend-brainstorm-layer-snapshot"',
);
assertIncludes(readyPackageProjectEvidenceArchiveRenderSection, [
  'data-testid="backend-project-evidence-archive-source"',
  "managerProofModelSyncButton(backendProjectEvidenceArchive, 'backend-project-evidence-archive-sync-proof-models')",
  'project-evidence-archive',
  'Storage Proofs',
  'Workspace Files',
  'Source Decisions',
], 'Manager Ready Package Project Evidence Archive source-label UI boundary');

const readyPackageProductionSubmodelSection = sliceBetween(
  appSource,
  'const backendReadyPackageSubmodels = String(backendStation.readyPackageSubmodelsProjectId || \'\').toLowerCase()',
  'const backendBrainstormLayer = backendReadyPackageSubmodels.brainstormLayer',
);
assertIncludes(readyPackageProductionSubmodelSection, [
  "const allowReadyPackageDerivedFallbacks = !backendOnlineForReadyPackage || isManagerDemoProject(activeProject);",
  "const frontendFallbackMode = allowReadyPackageDerivedFallbacks ? 'demo-or-offline' : 'backend-required';",
  'const missingReadyPackageReadModel = (schemaName, routeKey, routeSlug, extra = {}) => ({',
  "dataSource: 'backend-required'",
  'frontendMockSuppressed: true',
  "frontendFallbackMode: 'backend-required'",
  'readyForProduction: false',
  "const missingProductionLaunchGapRegister = () => missingReadyPackageReadModel('production-launch-gap-register'",
  "const missingProductionLaunchControlCenter = () => missingReadyPackageReadModel('production-launch-control-center'",
  "const missingProductionEvidenceIntegrityAudit = () => missingReadyPackageReadModel('production-evidence-integrity-audit'",
  "const missingProductionLaunchEvidenceDossier = () => missingReadyPackageReadModel('production-launch-evidence-dossier'",
  'const backendProductionLaunchGapRegister = backendReadyPackageSubmodels.productionLaunchGapRegister || backendManagerReadyPackage?.productionLaunchGapRegister || (allowReadyPackageDerivedFallbacks && backendManagerReadyPackage ? {',
  "dataSource: 'frontend-fallback'",
  '} : backendOnlineForReadyPackage && backendManagerReadyPackage ? missingProductionLaunchGapRegister() : null);',
  'const backendProductionLaunchControlCenter = backendReadyPackageSubmodels.productionLaunchControlCenter || backendManagerReadyPackage?.productionLaunchControlCenter || (allowReadyPackageDerivedFallbacks && backendManagerReadyPackage ? {',
  '} : backendOnlineForReadyPackage && backendManagerReadyPackage ? missingProductionLaunchControlCenter() : null);',
  'const backendProductionEvidenceIntegrityAudit = backendReadyPackageSubmodels.productionEvidenceIntegrityAudit || backendManagerReadyPackage?.productionEvidenceIntegrityAudit || (allowReadyPackageDerivedFallbacks && backendManagerReadyPackage ? {',
  '} : backendOnlineForReadyPackage && backendManagerReadyPackage ? missingProductionEvidenceIntegrityAudit() : null);',
  'const backendProductionLaunchEvidenceDossier = backendReadyPackageSubmodels.productionLaunchEvidenceDossier || backendManagerReadyPackage?.productionLaunchEvidenceDossier || (allowReadyPackageDerivedFallbacks && backendManagerReadyPackage ? {',
  '} : backendOnlineForReadyPackage && backendManagerReadyPackage ? missingProductionLaunchEvidenceDossier() : null);',
], 'Manager Ready Package production submodel backend-required boundary');
assert(
  readyPackageProductionSubmodelSection.indexOf("const allowReadyPackageDerivedFallbacks = !backendOnlineForReadyPackage || isManagerDemoProject(activeProject);")
    < readyPackageProductionSubmodelSection.indexOf('const backendProductionLaunchGapRegister ='),
  'Ready Package production submodels must compute real-project fallback eligibility before deriving production submodels.',
);
for (const [modelName, missingName] of [
  ['backendProductionLaunchGapRegister', 'missingProductionLaunchGapRegister'],
  ['backendProductionLaunchControlCenter', 'missingProductionLaunchControlCenter'],
  ['backendProductionEvidenceIntegrityAudit', 'missingProductionEvidenceIntegrityAudit'],
  ['backendProductionLaunchEvidenceDossier', 'missingProductionLaunchEvidenceDossier'],
]) {
  const modelIndex = readyPackageProductionSubmodelSection.indexOf(`const ${modelName} =`);
  const missingIndex = readyPackageProductionSubmodelSection.indexOf(`backendOnlineForReadyPackage && backendManagerReadyPackage ? ${missingName}() : null`);
  assert(modelIndex >= 0 && missingIndex > modelIndex, `${modelName} must use ${missingName} for backend-online real projects when the standalone submodel is missing.`);
}

const publicProductionActionPlanRenderSection = sliceBetween(
  appSource,
  'data-testid="backend-public-production-action-plan"',
  'data-testid="backend-production-launch-gap-register-snapshot"',
);
assertIncludes(publicProductionActionPlanRenderSection, [
  'data-testid={`backend-public-production-action-plan-row-${action.id}`}',
  'data-testid="backend-public-production-action-plan-validation-commands"',
  'publicProductionActionPlan.validationCommands.slice(0, 8).map',
  'const requiredEnvVars = action.requiredEnvVars || [];',
  'const visibleRequiredEnvVars = requiredEnvVars.slice(0, 6);',
  'data-testid={`backend-public-production-action-plan-required-env-${action.id}`}',
  "projectText('Required')",
  'data-testid={`backend-public-production-action-plan-route-${action.id}`}',
  "projectText('Route')",
  "projectText('Check')",
], 'Public production action plan operator-detail UI boundary');

const readyPackagePrivatePilotWorkflowSection = sliceBetween(
  appSource,
  'const backendPrivatePilotReleaseCandidateWorkflow = backendReadyPackageSubmodels.privatePilotReleaseCandidateWorkflow',
  'const backendProductionOperationsReadiness = backendReadyPackageSubmodels.productionOperationsReadiness',
);
assertIncludes(readyPackagePrivatePilotWorkflowSection, [
  'const backendPrivatePilotReleaseCandidateWorkflow = backendReadyPackageSubmodels.privatePilotReleaseCandidateWorkflow || backendManagerReadyPackage?.privatePilotReleaseCandidateWorkflow || null;',
  'const backendPrivatePilotLaunchRunWorkflow = backendReadyPackageSubmodels.privatePilotLaunchRunWorkflow || backendManagerReadyPackage?.privatePilotLaunchRunWorkflow || null;',
  'const backendPrivatePilotLaunchHealthCheckWorkflow = backendReadyPackageSubmodels.privatePilotLaunchHealthCheckWorkflow || backendManagerReadyPackage?.privatePilotLaunchHealthCheckWorkflow || null;',
  'const backendPrivatePilotAcceptanceReportWorkflow = backendReadyPackageSubmodels.privatePilotAcceptanceReportWorkflow || backendManagerReadyPackage?.privatePilotAcceptanceReportWorkflow || null;',
], 'Manager Ready Package private-pilot workflow backend-source boundary');
assert(
  !readyPackagePrivatePilotWorkflowSection.includes('frontend-fallback')
    && !readyPackagePrivatePilotWorkflowSection.includes('allowReadyPackageDerivedFallbacks'),
  'Private-pilot launch/health/acceptance workflows must not derive browser fallback read models for real projects.',
);

const readyPackageProductionRenderSection = sliceBetween(
  appSource,
  'data-testid="backend-production-launch-gap-register-snapshot"',
  'data-testid="backend-production-evidence-integrity-audit-snapshot"',
);
assertIncludes(readyPackageProductionRenderSection, [
  'data-testid="backend-production-launch-gap-register-source"',
  "managerProofModelSyncButton(backendProductionLaunchGapRegister, 'backend-production-launch-gap-register-sync-proof-models')",
  'data-testid="backend-production-launch-control-center-source"',
  "managerProofModelSyncButton(backendProductionLaunchControlCenter, 'backend-production-launch-control-center-sync-proof-models')",
  'data-testid="backend-production-launch-evidence-dossier-source"',
  "managerProofModelSyncButton(backendProductionLaunchEvidenceDossier, 'backend-production-launch-evidence-dossier-sync-proof-models')",
], 'Manager Ready Package production submodel source-label UI boundary');

const readyPackagePrivatePilotRenderSection = sliceBetween(
  appSource,
  'data-testid="backend-private-pilot-release-candidate-workflow-snapshot"',
  'data-testid="backend-production-operations-readiness-snapshot"',
);
assertIncludes(readyPackagePrivatePilotRenderSection, [
  "managerReadModelSourceBadge(backendPrivatePilotReleaseCandidateWorkflow, 'backend-private-pilot-release-candidate-workflow-source')",
  'data-testid="backend-private-pilot-record-release-candidate"',
  "workflowKey: 'privatePilotReleaseCandidateWorkflow'",
  "receiptKey: 'privatePilotReleaseCandidate'",
  "managerReadModelSourceBadge(backendPrivatePilotLaunchRunWorkflow, 'backend-private-pilot-launch-run-workflow-source')",
  'data-testid="backend-private-pilot-record-launch-run"',
  "workflowKey: 'privatePilotLaunchRunWorkflow'",
  "receiptKey: 'privatePilotLaunchRun'",
  'disabled={!backendCommandAvailable || backendStation.loading || !backendPrivatePilotLaunchRunWorkflow.readyToLaunch || backendPrivatePilotLaunchRunWorkflow.readyForPrivatePilotLaunch}',
  "managerReadModelSourceBadge(backendPrivatePilotLaunchHealthCheckWorkflow, 'backend-private-pilot-launch-health-check-workflow-source')",
  'data-testid="backend-private-pilot-record-launch-health"',
  "workflowKey: 'privatePilotLaunchHealthCheckWorkflow'",
  "receiptKey: 'privatePilotLaunchHealthCheck'",
  'disabled={!backendCommandAvailable || backendStation.loading || !backendPrivatePilotLaunchHealthCheckWorkflow.readyToCheck || backendPrivatePilotLaunchHealthCheckWorkflow.readyForPrivatePilotMonitoring}',
  "managerReadModelSourceBadge(backendPrivatePilotAcceptanceReportWorkflow, 'backend-private-pilot-acceptance-report-workflow-source')",
  'data-testid="backend-private-pilot-record-acceptance-report"',
  "workflowKey: 'privatePilotAcceptanceReportWorkflow'",
  "receiptKey: 'privatePilotAcceptanceReport'",
  'disabled={!backendCommandAvailable || backendStation.loading || !backendPrivatePilotAcceptanceReportWorkflow.readyToReport || backendPrivatePilotAcceptanceReportWorkflow.readyForPrivatePilotAcceptance}',
  'Launch run route',
  'Health route',
  'Acceptance route',
], 'Manager Ready Package private-pilot launch/health/acceptance UI boundary');

const readyPackageLaunchOperationsOverviewSection = sliceBetween(
  appSource,
  'data-testid="backend-launch-operations-overview"',
  'data-testid="backend-product-team-operating-loop-snapshot"',
);
assertIncludes(readyPackageLaunchOperationsOverviewSection, [
  'Launch Operations Overview',
  'backendLaunchOperationsOverview',
  "managerReadModelSourceBadge(backendLaunchOperationsOverview, 'backend-launch-operations-overview-source')",
  'backendLaunchOperationsPrivatePilotStatus',
  'backendLaunchOperationsPublicProductionReady',
  'backendLaunchOperationsNextAction',
  'backendLaunchOperationsOverviewRows',
  'backendLaunchOperationsBlockerRows',
  'launchOperationsOverview',
  '/launch-operations-overview',
  'data-testid="backend-launch-operations-private-pilot-status"',
  'data-testid="backend-launch-operations-public-production-status"',
  'data-testid="backend-launch-operations-routes"',
  'data-testid="backend-launch-operations-blockers"',
  '/public-production-startup-readiness',
  '/production-customer-acceptance-policy',
], 'Manager Ready Package launch operations overview UI boundary');

const collaborationIntentRunSection = sliceBetween(
  appSource,
  'const runCollaborationIntentQueueRow = async (row) => {',
  'const runBackendPrivatePilotReceipt = async',
);
assertIncludes(collaborationIntentRunSection, [
  'const runApiPath = row.runIntentApiPath || `/projects/${encodeURIComponent(activeProject.id)}/collaboration-intent-queue/${encodeURIComponent(intentId)}/run`;',
  'const routeBackedIntent = Boolean(row.runIntentApiPath || row.runApiPath);',
  "if (error.name === 'AbortError' && routeBackedIntent) return { skippedProjectSnapshotPreflight: true };",
  'if (!projectSnapshot && !routeBackedIntent) await ensureBackendProjectSeed();',
  'body: { now, includeReadModels: false }',
  "timeoutMs: String(runApiPath || '').includes('/collaboration-intent-queue/') ? 120_000 : 45_000",
  "schemaVersion: 'collaboration-intent-run-output/v1'",
  'workSubmission: payload.workSubmission || payload.submission || null',
  'artifact: payload.artifact || null',
  'evidenceSearch: payload.evidenceSearch || null',
  'reviewResponseSubmission: payload.reviewResponseSubmission || null',
  'reviewResponseArtifact: payload.reviewResponseArtifact || null',
  'const outputAgentIds = Array.from(new Set([',
  'payload.agentAutonomousActionRun?.agentId',
  'payload.workSubmission?.agentId',
  'payload.review?.reviewerAgentId',
  'outputAgentIds.forEach(agentId => {',
  'setTimeout(() => syncBackendAgentDashboard(agentId, { silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
  'setTimeout(() => syncBackendCollaborationIntentQueue({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
  'setTimeout(() => syncBackendManagerFlowGraph({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
  'setTimeout(() => syncBackendReadinessProofMap({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
  'setTimeout(() => syncBackendProjectTranscripts({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
  'setTimeout(() => syncBackendTimelineAndEvents({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);',
  'No local intent receipt was created.',
  'localProofCreated: false',
], 'Collaboration intent C/A handoff command boundary');

const privatePilotReceiptCommandSection = sliceBetween(
  appSource,
  'const runBackendPrivatePilotReceipt = async ({',
  'const buildProductionControlReceiptRows = (workflow, {',
);
assertIncludes(privatePilotReceiptCommandSection, [
  'await ensureBackendProjectSeed();',
  'const payload = await requestAgentBackend(route, {',
  "method: 'POST'",
  "source: 'manager-ui-private-pilot-receipt'",
  'includeReadModels: false',
  'applyBackendProjectSnapshot(payload);',
  'const appliedManagerPayload = applyBackendManagerDashboardPayload(payload);',
  '...(payload[workflowKey] ? { [workflowKey]: payload[workflowKey] } : {})',
  'privatePilotReceipt: payload[receiptKey] || prev.privatePilotReceipt',
  'refreshReceiptReadModels({',
  'includeLaunchControls: true',
  'setTimeout(() => syncBackendManagerReadyPackage({ silent: true, projectId }), 0);',
  'setTimeout(() => syncBackendReadyPackageSubmodels({ silent: true, projectId, includeLaunchControls: true }), 0);',
  'setTimeout(() => syncBackendManagerFlowGraph({ silent: true, projectId }), 0);',
  'setTimeout(() => syncBackendProjectTranscripts({ silent: true, projectId }), 0);',
  'setTimeout(() => syncBackendTimelineAndEvents({ silent: true, projectId }), 0);',
], 'Manager Ready Package private-pilot receipt command backend boundary');
assert(
  !privatePilotReceiptCommandSection.includes('localProofCreated: true')
    && !privatePilotReceiptCommandSection.includes('localStorage'),
  'Private-pilot receipt command must not create local/browser proof for launch acceptance.',
);

const collaborationIntentDashboardSection = sliceBetween(
  appSource,
  '{backendCollaborationIntentQueue && !backendManagerReadyPackage && (',
  '{backendTranscriptProofCoverageSummary && (',
);
assertIncludes(collaborationIntentDashboardSection, [
  'data-testid="backend-collaboration-intent-queue-snapshot"',
  "row.id === 'customer-agent-handoff-intent'",
  "row.id !== 'customer-agent-handoff-intent'",
  'dashboard-collaboration-intent-row-${row.id}',
  'data-testid={`collaboration-intent-run-${row.id}`}',
  'disabled={!backendCommandAvailable || backendStation.loading || !row.canRun || !row.runIntentApiPath}',
  'data-testid="backend-collaboration-intent-run-output"',
  'Intent Run Failed',
  'Intent Output Nodes',
  'data-testid="backend-collaboration-intent-output-work-submission"',
  'Agent Submission:',
  'data-testid="backend-collaboration-intent-handoff-output-routes"',
  'Submission route:',
  'data-testid="collaboration-intent-output-chat-proof-work-submission"',
  "openProjectChatProof(activeProject, [backendCollaborationIntentRunOutput.workSubmission.messageId].filter(Boolean), 'main')",
  'data-testid="collaboration-intent-output-timeline-proof-work-submission"',
  'openProjectTimelineProof([backendCollaborationIntentRunOutput.workSubmission.timelineLogId].filter(Boolean))',
  'data-testid="backend-collaboration-intent-standalone-output-rows"',
  "id: 'artifact'",
  "label: 'Artifact'",
  "id: 'evidence-search'",
  "label: 'Evidence Search'",
  "id: 'submission-review'",
  "label: 'Submission Review'",
  "id: 'review-response-submission'",
  "label: 'Review Response'",
  "id: 'review-response-artifact'",
  "label: 'Review Response Artifact'",
  "id: 'result-messages'",
  "label: 'Result Messages'",
  'data-testid={`backend-collaboration-intent-output-${row.id}`}',
  'data-testid={`collaboration-intent-output-chat-proof-${row.id}`}',
  'data-testid={`collaboration-intent-output-timeline-proof-${row.id}`}',
  'data-testid="backend-collaboration-intent-queue-route"',
], 'Manager Dashboard standalone C/A intent queue UI boundary');
assert(
  collaborationIntentDashboardSection.indexOf("filter(row => row.id === 'customer-agent-handoff-intent')")
    < collaborationIntentDashboardSection.indexOf("filter(row => row.id !== 'customer-agent-handoff-intent')"),
  'Manager Dashboard standalone C/A intent queue must prioritize the customer-agent-handoff-intent row.',
);

const managerActionRunsSection = sliceBetween(
  appSource,
  'const fallbackManagerActionRuns = {',
  'const managerReadModelMeta = (readModel = {}) => readModel || {};',
);
assertIncludes(managerActionRunsSection, [
  "schemaVersion: 'manager-action-runs/frontend-fallback'",
  'activeProject.managerActionRunLedger?.length || 0',
  'backendManagerActionRunsReadModel',
  "missingBackendReadModel('manager-action-runs/v1'",
  'backendManagerActionRuns',
], 'Manager action run ledger backend boundary');
assertIncludes(appSource, [
  'manager-action-run-ledger-backend-required',
  'manager-action-run-ledger-sync-manager-dashboard',
  'Backend Manager Action Run Ledger is required for this real project.',
], 'Manager action run ledger UI boundary');

const autonomousRunReceiptSection = sliceBetween(
  appSource,
  'const backendLatestAutonomousRunControlRun = backendLatestAutonomousRunControlRunReadModel',
  'const withFrontendFallbackMeta = (readModel = {}, readModelName =',
);
assertIncludes(autonomousRunReceiptSection, [
  'allowManagerFrontendFallbacks ? activeProject?.autonomousRunControlRunLedger?.[0] : null',
  'allowManagerFrontendFallbacks ? activeProject?.autonomousRunControlLoopLedger?.[0] : null',
], 'Autonomous Run Control receipt backend boundary');

const autonomousRunControlRefreshSection = sliceBetween(
  appSource,
  'const refreshAutonomousRunControlReadModels = async',
  'const refreshProjectInitiationReadModels = async',
);
assertIncludes(autonomousRunControlRefreshSection, [
  'fetchReadModel(readRoutes.readinessProofMapRoute, `/projects/${encodeURIComponent(targetProjectId)}/readiness-proof-map`, 8000)',
  'const readinessProofMap = readinessProofMapResult.status === \'fulfilled\' ? readinessProofMapResult.value : null;',
  'const readinessProofMapAppliedThroughManagerPayload = Boolean(readinessProofMap && (dashboard || readyPackage?.managerDashboard));',
  'managerReadyPackage: readyPackage ? { ...readyPackage, readinessProofMap: readinessProofMap || readyPackage.readinessProofMap } : null,',
  'readinessProofMap,',
  'managerReadyPackage: readyPackage ? { ...readyPackage, readinessProofMap: readinessProofMap || readyPackage.readinessProofMap } : prev.managerReadyPackage,',
  'readinessProofMap: readinessProofMap || prev.readinessProofMap,',
  'readinessProofMap && !readinessProofMapAppliedThroughManagerPayload',
], 'Autonomous Run Control Proof Map refresh boundary');

const mvpReadinessOperatorActionRenderSection = sliceBetween(
  appSource,
  'data-testid="backend-mvp-readiness-snapshot"',
  'data-testid="backend-operations-readiness-snapshot"',
);
assertIncludes(mvpReadinessOperatorActionRenderSection, [
  'data-testid="mvp-readiness-operator-actions"',
  'data-testid={`mvp-readiness-operator-action-run-${action.id}`}',
  'onClick={() => runMvpReadinessOperatorAction(action)}',
  'disabled={!backendCommandAvailable || backendStation.loading}',
], 'MVP readiness operator action UI backend target boundary');

const autonomousRunControlCommandRenderSection = sliceBetween(
  appSource,
  'data-testid="backend-autonomous-run-control-snapshot"',
  'data-testid="backend-agent-autonomous-action-queue-snapshot"',
);
assertIncludes(autonomousRunControlCommandRenderSection, [
  'data-testid="backend-autonomous-run-control-loop-run"',
  'onClick={() => runAutonomousRunControlLoop()}',
  'data-testid="backend-autonomous-run-control-session-start"',
  'onClick={() => startAutonomousRunControlSession()}',
  'data-testid="backend-autonomous-run-control-session-scheduler-tick"',
  'onClick={() => runAutopilotSessionThroughScheduler()}',
  'data-testid="backend-autonomous-run-control-session-tick"',
  'onClick={() => tickAutonomousRunControlSession()}',
  'data-testid="backend-autonomous-run-control-session-pause"',
  'onClick={() => pauseAutonomousRunControlSession()}',
  'disabled={!backendCommandAvailable || backendStation.loading}',
  'disabled={!backendCommandAvailable || backendStation.loading || !backendAutonomousRunControlSessionAvailable}',
], 'Autonomous Run Control UI backend target boundary');

const agentAutonomousActionQueueRenderSection = sliceBetween(
  appSource,
  'data-testid="backend-agent-autonomous-action-queue-snapshot"',
  'data-testid="backend-last-result"',
);
assertIncludes(agentAutonomousActionQueueRenderSection, [
  'data-testid={`backend-agent-autonomous-action-run-${row.agentId}`}',
  'onClick={() => runAgentAutonomousActionQueueRow(row)}',
  'disabled={!backendCommandAvailable || backendStation.loading || !row.canRun || row.routeResolved === false}',
], 'Agent Autonomous Action Queue UI backend target boundary');

const agentAutonomousActionOutputSection = sliceBetween(
  appSource,
  'backendAgentAutonomousActionRunOutput && (',
  '<div className="mt-2 space-y-2">',
);
assertIncludes(agentAutonomousActionOutputSection, [
  'Agent Action Output Nodes',
  'backend-agent-autonomous-action-output-${row.id}',
  'agent-autonomous-action-output-route-${row.id}',
  "route: output.workSubmission.route",
  "route: output.artifact.route",
  "route: output.evidenceSearch.route",
  "route: output.reviewResponseArtifact.route",
  "id: 'review-response-artifact'",
  "label: 'Review Response Artifact'",
  "route: activeProject?.id ? `/projects/${activeProject.id}/transcripts/${output.channelId || 'main'}` : null",
  "Route: {row.route || 'route pending'} / Event: {row.eventId || 'missing'}",
  'agent-autonomous-action-output-chat-proof-${row.id}',
  'agent-autonomous-action-output-timeline-proof-${row.id}',
], 'Agent Autonomous Action output proof route boundary');

const autonomyCockpitReadModelSection = sliceBetween(
  appSource,
  'const backendAgentStateSummaryReadModel =',
  'const changeLedger = allowManagerFrontendFallbacks ? activeProject.changeLedger || [] : [];',
);
assertIncludes(autonomyCockpitReadModelSection, [
  "schemaVersion: 'agent-state-summary/v1'",
  "schemaVersion: 'agent-state-summary/frontend-fallback'",
  'const agentStateSummary = backendOrAllowedFallback(',
  "missingBackendReadModel('agent-state-summary/v1'",
  "'agent-state-summary/v1'",
  "agentStateSummary.schemaVersion === 'agent-state-summary/frontend-fallback'",
  'allowLocalProofFallback: agentStateSummaryAllowsLocalProofFallback',
  "schemaVersion: backendContinuousWorkLoopReadModel.schemaVersion || 'continuous-work-loop/v1'",
  "schemaVersion: 'continuous-work-loop/frontend-fallback'",
  'const continuousWorkLoop = backendOrAllowedFallback(',
  "missingBackendReadModel('continuous-work-loop/v1'",
  "'continuous-work-loop/v1'",
  'const operationsBoardBackendRequired = Boolean(agentStateSummary.frontendMockSuppressed);',
  "const operationsBoardProjectNextRunLabel = operationsBoardBackendRequired",
  "? projectText('backend required')",
  "const operationsBoardProjectLastRunLabel = operationsBoardBackendRequired",
  "const operationsBoardCadenceLabel = operationsBoardBackendRequired",
  'const continuousWorkProjectNextRunLabel = continuousWorkLoop.frontendMockSuppressed',
], 'Manager autonomy cockpit backend-required read-model boundary');
assertIncludes(appSource, [
  'const autonomousWorkLoopTitle = autonomousWorkLoopBackendRequired',
  "? projectText('backend required')",
  ": activeProject.autonomy?.enabled ? `${activeProject.autonomy.cadence || 'hourly'} cadence enabled` : 'Cadence paused';",
  '{autonomousWorkLoopTitle}',
], 'Autonomous Work Loop title backend-required boundary');
assertIncludes(appSource, [
  'data-testid="backend-manager-command-center-route"',
  "backendManagerCommandCenter ? (backendManagerCommandCenter.nextBestAction?.canRun ? 'next action ready' : backendManagerCommandCenter.status || 'monitoring') : 'backend required'",
], 'Manager Dashboard command-center route status backend-required boundary');
assertIncludes(appSource, [
  'data-testid="backend-manager-scenario-trail-route"',
  "backendManagerScenarioTrail ? `${backendManagerScenarioTrail.passedCount ?? 0}-${backendManagerScenarioTrail.count ?? 0} ready` : 'backend required'",
], 'Manager Dashboard scenario-trail route status backend-required boundary');
assertIncludes(appSource, [
  'data-testid="backend-manager-scenario-walkthrough-route"',
  "backendManagerScenarioWalkthrough ? `${backendManagerScenarioWalkthrough.completedCount ?? 0}-${backendManagerScenarioWalkthrough.count ?? 0} complete` : 'backend required'",
], 'Manager Dashboard scenario-walkthrough route status backend-required boundary');
assertIncludes(appSource, [
  'data-testid="backend-manager-requirement-matrix-route"',
  "backendManagerRequirementMatrix ? `${backendManagerRequirementMatrix.passedCount ?? 0}-${backendManagerRequirementMatrix.count ?? 0} ready` : 'backend required'",
], 'Manager Dashboard requirement-matrix route status backend-required boundary');
assertIncludes(appSource, [
  'data-testid="backend-manager-action-queue-route"',
  "backendManagerActionQueue ? `${backendManagerActionQueue.readyCount ?? 0} ready next actions` : 'backend required'",
], 'Manager Dashboard action-queue route status backend-required boundary');
assertIncludes(appSource, [
  'data-testid="backend-agent-autonomous-action-queue-route"',
  "backendAgentAutonomousActionQueue ? `${backendAgentAutonomousActionQueue.readyCount ?? 0} ready Agent actions` : 'backend required'",
], 'Manager Dashboard agent-autonomous-queue route status backend-required boundary');
assertIncludes(appSource, [
  'data-testid="backend-autonomous-run-control-route"',
  "backendAutonomousRunControl ? `${backendAutonomousRunControl.summary?.runnableActionCount ?? 0} runnable actions` : 'backend required'",
], 'Manager Dashboard autonomous-run-control route status backend-required boundary');
assertIncludes(appSource, [
  "['Scenario Trail', backendManagerDashboard.managerScenarioTrail ? backendManagerDashboard.managerScenarioTrail.passedCount ?? 0 : projectText('backend required')]",
  "['Walkthrough', backendManagerScenarioWalkthrough || backendManagerDashboard.managerScenarioWalkthrough ? `${backendManagerScenarioWalkthrough?.completedCount ?? backendManagerDashboard.managerScenarioWalkthrough?.completedCount ?? 0}/${backendManagerScenarioWalkthrough?.count ?? backendManagerDashboard.managerScenarioWalkthrough?.count ?? 0}` : projectText('backend required')]",
  "['Standalone Trail', backendManagerScenarioTrail ? backendManagerScenarioTrail.passedCount ?? 0 : projectText('backend required')]",
  "['Action Queue', backendManagerActionQueue || backendManagerDashboard.managerActionQueue ? `${backendManagerActionQueue?.completedCount ?? backendManagerDashboard.managerActionQueue?.completedCount ?? 0}/${backendManagerActionQueue?.count ?? backendManagerDashboard.managerActionQueue?.count ?? 0}` : projectText('backend required')]",
  "['Agent Queue', backendAgentAutonomousActionQueue || backendManagerDashboard.agentAutonomousActionQueue ? `${backendAgentAutonomousActionQueue?.readyCount ?? backendManagerDashboard.agentAutonomousActionQueue?.readyCount ?? 0}/${backendAgentAutonomousActionQueue?.count ?? backendManagerDashboard.agentAutonomousActionQueue?.count ?? 0}` : projectText('backend required')]",
  "['Run Control', backendAutonomousRunControl ? `${backendAutonomousRunControl.summary?.runnableActionCount ?? 0} runnable` : projectText('backend required')]",
], 'Backend Manager Snapshot standalone route summary backend-required boundary');
assertIncludes(appSource, [
  'const backendManagerReadySummary = backendManagerReadyPackage?.summary || {};',
  'const readyPackageSummaryHas = (key) => Object.prototype.hasOwnProperty.call(backendManagerReadySummary, key);',
  'const readyPackageSummaryValue = (key) => (',
  'const readyPackageSummaryStatus = (key) => (',
  'const readyPackageSummaryBoolean = (key) => (',
  'const readyPackageModelAvailable = (model) => Boolean(',
  'const readyPackageModelValue = (model, externalValue, summaryKey) => (',
  'const readyPackageModelStatus = (model, externalValue, summaryKey) => (',
  'const readyPackageModelRatio = (model, externalReady, externalCount, readyKey, countKey) => (',
  'const readyPackageModelCents = (model, externalValue, summaryKey) => (',
  'const readyPackageModelBoolean = (model, externalValue, summaryKey, trueLabel = \'ready\', falseLabel = \'blocked\') => (',
  "['Pilot Launch', readyPackageModelStatus(backendPilotLaunchReadiness, backendPilotLaunchReadiness?.privatePilotDecision, 'pilotLaunchDecision')]",
  "['Launch Gates', readyPackageModelRatio(backendPilotLaunchReadiness, backendPilotLaunchReadiness?.summary?.passedGateCount, backendPilotLaunchReadiness?.summary?.gateCount, 'pilotLaunchPassedGateCount', 'pilotLaunchGateCount')]",
  "['Preflight', readyPackageModelBoolean(backendDeploymentPreflight, backendDeploymentPreflight?.privatePilotDeploymentReady, 'deploymentPreflightReady')]",
  "['Gateway', readyPackageModelStatus(backendAdapterGatewayPreflight, backendAdapterGatewayPreflight?.status, 'adapterGatewayPreflightStatus')]",
  "[projectText('Infra Rehearsal'), readyPackageModelStatus(backendProductionInfrastructureRehearsal, backendProductionInfrastructureRehearsal?.status, 'productionInfrastructureRehearsalStatus')]",
  "[projectText('Launch Approval'), projectText(readyPackageModelStatus(backendLaunchApprovalWorkflow, backendLaunchApprovalWorkflow?.status, 'launchApprovalStatus'))]",
  "[projectText('Launch Audit'), projectText(readyPackageModelStatus(backendProductionLaunchAudit, backendProductionLaunchAudit?.status, 'productionLaunchAuditStatus'))]",
  "['Evidence Archive', readyPackageModelStatus(backendProjectEvidenceArchive, backendProjectEvidenceArchive?.status, 'projectEvidenceArchiveStatus')]",
  "['Evidence Export', readyPackageModelStatus(backendProjectEvidenceExportWorkflow, backendProjectEvidenceExportWorkflow?.status, 'projectEvidenceExportStatus')]",
  "['Go-Live Status', readyPackageModelStatus(backendPrivatePilotGoLiveReadiness, backendPrivatePilotGoLiveReadiness?.status, 'privatePilotGoLiveStatus')]",
  "['Release Candidate', readyPackageModelStatus(backendPrivatePilotReleaseCandidateWorkflow, backendPrivatePilotReleaseCandidateWorkflow?.status, 'privatePilotReleaseCandidateStatus')]",
  "['Pilot Launch Run', readyPackageModelStatus(backendPrivatePilotLaunchRunWorkflow, backendPrivatePilotLaunchRunWorkflow?.status, 'privatePilotLaunchRunStatus')]",
  "['Post Launch Health', readyPackageModelStatus(backendPrivatePilotLaunchHealthCheckWorkflow, backendPrivatePilotLaunchHealthCheckWorkflow?.status, 'privatePilotLaunchHealthCheckStatus')]",
  "['Acceptance Report', readyPackageModelStatus(backendPrivatePilotAcceptanceReportWorkflow, backendPrivatePilotAcceptanceReportWorkflow?.status, 'privatePilotAcceptanceReportStatus')]",
  "['Production Ops', readyPackageModelStatus(backendProductionOperationsReadiness, backendProductionOperationsReadiness?.status, 'productionOperationsStatus')]",
  "['Artifact Audit', readyPackageModelStatus(backendArtifactQualityAudit, backendArtifactQualityAudit?.status, 'artifactQualityAuditStatus')]",
  "['Review Workflow', readyPackageModelStatus(backendSubmissionReviewWorkflow, backendSubmissionReviewWorkflow?.status, 'submissionReviewWorkflowStatus')]",
  '{readyPackageModelAvailable(backendProductionLaunchAudit) && (',
  '{readyPackageModelAvailable(backendLaunchApprovalWorkflow) && (',
  '{readyPackageModelAvailable(backendPilotLaunchReadiness) && (',
  '{readyPackageModelAvailable(backendDeploymentPreflight) && (',
  '{readyPackageModelAvailable(backendOperationsReadiness) && (',
  '{readyPackageModelAvailable(backendProviderReadiness) && (',
  '{readyPackageModelAvailable(backendProviderControlledRun) && (',
  '{readyPackageModelAvailable(backendProviderEvalRunWorkflow) && (',
  '{readyPackageModelAvailable(backendEvidenceCustodyReadiness) && (',
  '{readyPackageModelAvailable(backendSecurityBoundary) && (',
  "['Delivery Trace', readyPackageModelStatus(backendProductTeamDeliveryTrace, backendProductTeamDeliveryTrace?.status, 'productTeamDeliveryTraceStatus')]",
  "['Trace Ready', readyPackageModelRatio(backendProductTeamDeliveryTrace, backendProductTeamDeliveryTrace?.summary?.readyCount, backendProductTeamDeliveryTrace?.summary?.rowCount, 'productTeamDeliveryTraceReadyCount', 'productTeamDeliveryTraceRowCount')]",
  "['Operating Loop', readyPackageModelStatus(backendProductTeamOperatingLoop, backendProductTeamOperatingLoop?.status, 'productTeamOperatingLoopStatus')]",
  "['Loop Ready', readyPackageModelBoolean(backendProductTeamOperatingLoop, backendProductTeamOperatingLoop?.readyForLocalPilotOperatingLoop, 'productTeamOperatingLoopReady')]",
  "['Collab Diagnostics', readyPackageModelStatus(backendTeamCollaborationDiagnostics, backendTeamCollaborationDiagnostics?.status, 'teamCollaborationDiagnosticsStatus')]",
  "['Intent Rows', readyPackageModelRatio(backendCollaborationIntentQueue, backendCollaborationIntentQueue?.summary?.runnableCount, backendCollaborationIntentQueue?.summary?.rowCount, 'collaborationIntentQueueRunnableCount', 'collaborationIntentQueueRowCount')]",
  "['Runtime Contracts', readyPackageModelStatus(backendRuntimeContracts, backendRuntimeContracts?.status, 'runtimeContractsStatus')]",
  "['Cycle Steps', readyPackageModelRatio(backendAutonomousCycleConsistency, backendAutonomousCycleConsistency?.summary?.observedStepCount, backendAutonomousCycleConsistency?.summary?.requiredStepCount, 'autonomousCycleConsistencyObservedStepCount', 'autonomousCycleConsistencyRequiredStepCount')]",
  "['Runtime Autonomy', readyPackageModelStatus(backendRuntimeAutonomyStatus, backendRuntimeAutonomyStatus?.status, 'runtimeAutonomyStatus')]",
  "['Evidence Audit', readyPackageModelStatus(backendEvidenceQualityAudit, backendEvidenceQualityAudit?.status, 'evidenceQualityAuditStatus')]",
  "['Evidence Quality', readyPackageModelValue(backendEvidenceQualityAudit, backendEvidenceQualityAudit?.summary?.averageQualityScore, 'evidenceQualityAverageScore')]",
  "['Evidence Index', readyPackageModelStatus(backendEvidenceIndexReadiness, backendEvidenceIndexReadiness?.status, 'evidenceIndexReadinessStatus')]",
  "['Index Rows', readyPackageModelRatio(backendEvidenceIndexReadiness, backendEvidenceIndexReadiness?.summary?.evidenceSearchCount, backendEvidenceIndexReadiness?.summary?.submissionCount, 'evidenceIndexReadinessSearchCount', 'evidenceIndexReadinessSubmissionCount')]",
  "['Source Queue', readyPackageModelValue(backendEvidenceSourceReviewWorkflow, backendEvidenceSourceReviewWorkflow?.summary?.reviewRequiredSourceCount, 'evidenceSourceReviewQueuedCount')]",
  "['Source Decisions', readyPackageModelValue(backendEvidenceSourceReviewWorkflow, backendEvidenceSourceReviewWorkflow?.summary?.sourceReviewDecisionCount, 'evidenceSourceReviewDecisionCount')]",
  "['Source Pending', readyPackageModelValue(backendEvidenceSourceReviewWorkflow, backendEvidenceSourceReviewWorkflow?.summary?.pendingDecisionSourceCount, 'evidenceSourceReviewPendingDecisionCount')]",
  "['Source Review', readyPackageModelStatus(backendEvidenceSourceReviewWorkflow, backendEvidenceSourceReviewWorkflow?.status, 'evidenceSourceReviewStatus')]",
  "['Evidence Custody', readyPackageModelStatus(backendEvidenceCustodyReadiness, backendEvidenceCustodyReadiness?.status, 'evidenceCustodyStatus')]",
  "['Custody Ready', readyPackageModelBoolean(backendEvidenceCustodyReadiness, backendEvidenceCustodyReadiness?.readyForPrivatePilot, 'evidenceCustodyReady')]",
  "['Custody Records', readyPackageModelValue(backendEvidenceCustodyReadiness, backendEvidenceCustodyReadiness?.summary?.custodyRecordCount, 'evidenceCustodyRecordCount')]",
  "['Custody Storage', readyPackageModelBoolean(backendEvidenceCustodyReadiness, backendEvidenceCustodyReadiness?.readyForProduction, 'evidenceCustodyProductionReady', 'production-ready', 'managed-blocked')]",
  "['Security', readyPackageModelStatus(backendSecurityBoundary, backendSecurityBoundary?.status, 'securityBoundaryStatus')]",
  "['Providers', readyPackageModelStatus(backendProviderReadiness, backendProviderReadiness?.status, 'providerReadinessStatus')]",
  "['Controlled Run', readyPackageModelStatus(backendProviderControlledRun, backendProviderControlledRun?.status, 'providerControlledRunStatus')]",
  "['Run Ready', readyPackageModelBoolean(backendProviderControlledRun, backendProviderControlledRun?.readyForPrivatePilotRun, 'providerControlledRunReady')]",
  "['Run Ops', readyPackageModelRatio(backendProviderControlledRun, backendProviderControlledRun?.summary?.runnableOperationCount, backendProviderControlledRun?.summary?.operationCount, 'providerControlledRunRunnableOperationCount', 'providerControlledRunOperationCount')]",
  "['Run Cost', readyPackageModelCents(backendProviderControlledRun, backendProviderControlledRun?.summary?.estimatedRunCostCents, 'providerControlledRunEstimatedCostCents')]",
  "['Provider Eval', readyPackageModelStatus(backendProviderEvalRunWorkflow, backendProviderEvalRunWorkflow?.status, 'providerEvalRunWorkflowStatus')]",
  "['Eval Ready', readyPackageModelBoolean(backendProviderEvalRunWorkflow, backendProviderEvalRunWorkflow?.readyForPrivatePilotProviderEval, 'providerEvalRunReady', 'ready', 'record')]",
  "['Eval Runs', readyPackageModelRatio(backendProviderEvalRunWorkflow, backendProviderEvalRunWorkflow?.summary?.passedRunCount, backendProviderEvalRunWorkflow?.summary?.runCount, 'providerEvalRunPassedCount', 'providerEvalRunCount')]",
  "['Eval Critical', readyPackageModelRatio(backendProviderEvalRunWorkflow, backendProviderEvalRunWorkflow?.summary?.replayedCriticalOperationCount, backendProviderEvalRunWorkflow?.summary?.criticalOperationCount, 'providerEvalRunReplayedCriticalCount', 'providerEvalRunCriticalCount')]",
  "['Operations', readyPackageModelStatus(backendOperationsReadiness, backendOperationsReadiness?.status, 'operationsReadinessStatus')]",
  "['Persistence Adapter', readyPackageSummaryStatus('persistenceAdapterDryRunStatus')]",
  "['Queue Adapter', readyPackageSummaryStatus('queueAdapterDryRunStatus')]",
  "['Queue Parity', readyPackageSummaryBoolean('queueAdapterSnapshotParityReady')]",
  "['Worker Recovery', readyPackageSummaryBoolean('workerRecoveryContractReady')]",
  "['Incident Drill', readyPackageSummaryBoolean('operationsIncidentDrillReady')]",
  "['Trail Ready', readyPackageSummaryRatio('scenarioTrailReadyCount', 'scenarioTrailCount')]",
  "['Walkthrough', readyPackageSummaryRatio('walkthroughCompletedCount', 'walkthroughCount')]",
  "['Requirements', readyPackageSummaryRatio('requirementReadyCount', 'requirementCount')]",
  "['Kickoff Board', readyPackageSummaryRatio('kickoffBoardReadyCount', 'kickoffBoardCount')]",
  "['Work Loop Board', readyPackageSummaryRatio('workLoopRunningCount', 'workLoopCount')]",
  "['Collaboration Board', readyPackageSummaryRatio('collaborationReadyCount', 'collaborationBoardCount')]",
  "['Change Protocol', readyPackageSummaryRatio('changeProtocolReadyCount', 'changeProtocolBoardCount')]",
  "['Change Owners', readyPackageSummaryRatio('changeOwnerReadyCount', 'changeOwnerCount')]",
  "['Use Cases', readyPackageSummaryRatio('useCaseCoveredCount', 'useCaseCount')]",
  "['Action Queue', readyPackageSummaryRatio('actionQueueCompletedCount', 'actionQueueCount')]",
  "['Unresolved Routes', readyPackageSummaryValue('actionQueueUnresolvedRouteCount')]",
  "['Transcript Channels', readyPackageSummaryValue('transcriptChannelCount')]",
  "['Ops Agents', readyPackageSummaryValue('operationsAgentCount')]",
  "['Assignments', readyPackageSummaryValue('assignmentCount')]",
  "['Changes', readyPackageSummaryValue('changeCount')]",
], 'Manager Ready Package summary ratio backend-required boundary');
assertIncludes(appSource, [
  "managerScenarioWalkthrough.frontendMockSuppressed ? projectText('backend required') : `${managerScenarioWalkthrough.completedCount || 0}/${managerScenarioWalkthrough.count || 0} ${projectText('complete')}`",
  "['Next Gap', managerScenarioWalkthrough.frontendMockSuppressed ? projectText('backend required') : managerScenarioWalkthrough.nextIncompleteStep?.stage || 'All covered']",
  "['Action Queue', managerScenarioWalkthrough.frontendMockSuppressed || managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : `${managerActionPlaybook.completedCount ?? 0}/${managerActionPlaybook.count ?? 0}`]",
  "managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : `${managerActionPlaybook.completedCount ?? 0}/${managerActionPlaybook.count ?? 0} complete`",
  "['Next', managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : managerActionPlaybook.nextAction?.label || 'All complete']",
], 'Manager Scenario Walkthrough and Action Playbook missing-model summary backend-required boundary');
assert(
  autonomyCockpitReadModelSection.indexOf("const operationsBoardProjectNextRunLabel = operationsBoardBackendRequired")
    < autonomyCockpitReadModelSection.indexOf(': formatRunTime(autonomousWorkLoopNextRunAt);'),
  'Operations Board Project Next Run must use local schedule only after the backend-required branch.',
);
assert(
  autonomyCockpitReadModelSection.indexOf("const operationsBoardProjectLastRunLabel = operationsBoardBackendRequired")
    < autonomyCockpitReadModelSection.indexOf(': formatRunTime(autonomousWorkLoopLastRunAt);'),
  'Operations Board Project Last Run must use local schedule only after the backend-required branch.',
);
assert(
  autonomyCockpitReadModelSection.indexOf('const continuousWorkProjectNextRunLabel = continuousWorkLoop.frontendMockSuppressed')
    < autonomyCockpitReadModelSection.lastIndexOf(': formatRunTime(autonomousWorkLoopNextRunAt);'),
  'Continuous Work Loop project pulse must use local schedule only after the backend-required branch.',
);

const autonomyCockpitRenderSection = sliceBetween(
  appSource,
  'data-testid="operations-board-24-7"',
  'data-testid="backend-worker-station"',
);
assertIncludes(autonomyCockpitRenderSection, [
  "managerReadModelSourceBadge(agentStateSummary, 'agent-state-summary-source')",
  'data-testid="agent-state-summary-backend-required"',
  'Backend Agent State Summary required. Local Agent state rows are suppressed for this backend project.',
  'data-testid="agent-state-summary-sync-cockpit"',
  'onClick={() => syncBackendCockpitReadModels({ silent: false, projectId: activeProject.id })}',
  'data-testid="continuous-work-loop"',
  "managerReadModelSourceBadge(continuousWorkLoop, 'continuous-work-loop-source')",
  'data-testid="continuous-work-loop-backend-required"',
  'Backend Continuous Work Loop required. Local loop rows are suppressed for this backend project.',
  'data-testid="continuous-work-loop-sync-cockpit"',
  "managerReadModelSourceBadge(agentStateSummary, 'fixed-work-routines-source')",
  'data-testid="fixed-work-routines-backend-required"',
  'Backend Agent State Summary required. Local fixed-routine rows are suppressed for this backend project.',
  'data-testid="fixed-work-routines-sync-cockpit"',
], 'Manager autonomy cockpit UI backend-required boundary');

const dashboardAgentStatusRenderSection = sliceBetween(
  appSource,
  'data-testid="dashboard-agent-status"',
  'data-testid="scenario-control-center"',
);
assertIncludes(dashboardAgentStatusRenderSection, [
  "managerReadModelSourceBadge(agentStateSummary, 'dashboard-agent-status-source')",
  'data-testid="dashboard-agent-status-backend-required"',
  'Backend Agent State Summary required. Local Agent status rows are suppressed for this backend project.',
  'data-testid="dashboard-agent-status-sync-cockpit"',
  'onClick={() => syncBackendCockpitReadModels({ silent: false, projectId: activeProject.id })}',
], 'Dashboard Agent Current Work Status backend-required boundary');
assert(
  dashboardAgentStatusRenderSection.indexOf('data-testid="dashboard-agent-status-backend-required"')
    < dashboardAgentStatusRenderSection.indexOf('operationsBoardRows.map(row => {'),
  'Dashboard Agent Current Work Status must show the backend-required recovery action before rendering any Agent rows.',
);

const governanceCockpitReadModelSection = sliceBetween(
  appSource,
  'const fallbackGovernanceProtocol = {',
  'const showSampleFixturePath =',
);
assertIncludes(governanceCockpitReadModelSection, [
  "schemaVersion: 'governance-protocol/frontend-fallback'",
  "schemaVersion: 'governance-protocol/v1'",
  'const backendStationGovernanceProtocol = scopedBackendStationReadModel(backendStation.governanceProtocol)',
  'const backendGovernanceProtocol = backendStationGovernanceProtocol || backendGovernanceProtocolFromCharter;',
  'const governanceProtocol = backendOrAllowedFallback(',
  "missingBackendReadModel('governance-protocol/v1'",
  "'governance-protocol/v1'",
  "schemaVersion: 'collaboration-health/frontend-fallback'",
  "schemaVersion: 'collaboration-health/v1'",
  'const collaborationHealth = backendOrAllowedFallback(',
  "missingBackendReadModel('collaboration-health/v1'",
  "'collaboration-health/v1'",
  'const peerHandoffs = allowManagerFrontendFallbacks ? activeProject.peerHandoffs || [] : [];',
  "schemaVersion: 'agent-management-mesh/frontend-fallback'",
  'const buildLocalManagementMeshRows = () => activeProject.team.map(agent => {',
  'const managementMeshRows = allowManagerFrontendFallbacks ? buildLocalManagementMeshRows() : [];',
  'const agentManagementMesh = backendOrAllowedFallback(',
  "missingBackendReadModel('agent-management-mesh/v1'",
  "'agent-management-mesh/v1'",
  'const buildLocalPeerManagementMatrixRows = () => (activeProject.peerManagementMatrix?.length',
  'const localPeerManagementMatrixRows = allowManagerFrontendFallbacks ? buildLocalPeerManagementMatrixRows() : [];',
  'agentManagementMesh.frontendMockSuppressed || timelineEventReadModelsRequired ? [] : localPeerManagementMatrixRows',
  'const buildLocalAssignmentFlowRows = () => activeProject.tasks',
  'const assignmentFlowRows = allowManagerFrontendFallbacks ? buildLocalAssignmentFlowRows() : [];',
  "schemaVersion: 'assignment-timeline-matrix/frontend-fallback'",
  'const assignmentTimelineMatrix = backendOrAllowedFallback(',
  "missingBackendReadModel('assignment-timeline-matrix/v1'",
  "'assignment-timeline-matrix/v1'",
  'const assignmentDerivedFrontendRowsAllowed = !assignmentTimelineMatrix.frontendMockSuppressed;',
  'const changeLedger = allowManagerFrontendFallbacks ? activeProject.changeLedger || [] : [];',
  'const buildLocalChangeFlowRows = () => changeLedger.slice(0, 8).map(change => {',
  'const changeFlowRows = allowManagerFrontendFallbacks ? buildLocalChangeFlowRows() : [];',
  "schemaVersion: 'change-flow/frontend-fallback'",
  'const changeFlow = backendOrAllowedFallback(',
  "missingBackendReadModel('change-flow/v1'",
  "'change-flow/v1'",
  'const changeDerivedFrontendRowsAllowed = !changeFlow.frontendMockSuppressed;',
  'const localKickoffExecutionFallbackAllowed = allowManagerFrontendFallbacks;',
  'const kickoffActionIds = localKickoffExecutionFallbackAllowed',
  'const firstPulseMessages = localKickoffExecutionFallbackAllowed ? projectTranscriptMessages.filter(message => (',
  'const allAgentStartupRows = localKickoffExecutionFallbackAllowed ? activeProject.team.filter(Boolean).map(agent => {',
  'const nextActionResolution = localKickoffExecutionFallbackAllowed',
  'const backendKickoffExecutionFlow = backendManagerDashboard?.kickoffExecutionFlow || null;',
  'const buildLocalKickoffExecutionFlow = () => kickoffCharter ? {',
  'const normalizeKickoffStartupRow = (row, index) => {',
  'allAgentStartupRows: (flow.allAgentStartupRows || []).filter(Boolean).map(normalizeKickoffStartupRow),',
  'const kickoffExecutionFlow = normalizeKickoffExecutionFlow(',
  'const kickoffExecutionFlowBackendRequired = timelineEventReadModelsRequired && !backendKickoffExecutionFlow;',
  "schemaVersion: 'manager-proof-map/frontend-fallback'",
  "schemaVersion: 'manager-proof-map/v1'",
  'rows: buildManagerProofMapRows(backendReadinessProofMap.readiness.checks, { allowLocalProofFallback: false })',
  'const managerProofMap = backendOrAllowedFallback(',
  "missingBackendReadModel('manager-proof-map/v1'",
  "'manager-proof-map/v1'",
], 'Manager governance/collaboration cockpit backend-required boundary');
assert(
  appSource.includes("String(row.task?.id || row.taskId || '') === String(action.id || action.taskId || '')"),
  'Kickoff execution assignment lookup must support backend taskId rows and local task object rows.',
);
assert(
  governanceCockpitReadModelSection.indexOf('const buildLocalManagementMeshRows = () => activeProject.team.map(agent => {')
    < governanceCockpitReadModelSection.indexOf('const managementMeshRows = allowManagerFrontendFallbacks ? buildLocalManagementMeshRows() : [];'),
  'Agent Management Mesh must only construct browser-local management proof rows inside the offline/demo fallback branch.',
);
assert(
  governanceCockpitReadModelSection.indexOf("schemaVersion: 'agent-management-mesh/frontend-fallback'")
    < governanceCockpitReadModelSection.indexOf('agentManagementMesh.frontendMockSuppressed || timelineEventReadModelsRequired ? [] : localPeerManagementMatrixRows'),
  'Agent Management Mesh must suppress local peer-management rows after the backend-required read-model branch.',
);
assert(
  governanceCockpitReadModelSection.indexOf('const buildLocalPeerManagementMatrixRows = () => (activeProject.peerManagementMatrix?.length')
    < governanceCockpitReadModelSection.indexOf('const localPeerManagementMatrixRows = allowManagerFrontendFallbacks ? buildLocalPeerManagementMatrixRows() : [];'),
  'Peer Management Matrix must only construct browser-local peer rows inside the offline/demo fallback branch.',
);
assert(
  governanceCockpitReadModelSection.indexOf('const buildLocalAssignmentFlowRows = () => activeProject.tasks')
    < governanceCockpitReadModelSection.indexOf('const assignmentFlowRows = allowManagerFrontendFallbacks ? buildLocalAssignmentFlowRows() : [];'),
  'Assignment Timeline Matrix must only construct browser-local assignment rows inside the offline/demo fallback branch.',
);
assert(
  governanceCockpitReadModelSection.indexOf('const assignmentDerivedFrontendRowsAllowed = !assignmentTimelineMatrix.frontendMockSuppressed;')
    < governanceCockpitReadModelSection.indexOf('const assignmentWorkProgressRows = assignmentTimelineMatrixRows.map'),
  'Assignment work-progress rows must stay gated by the backend-required Assignment Timeline Matrix state.',
);
assert(
  governanceCockpitReadModelSection.indexOf('const buildLocalChangeFlowRows = () => changeLedger.slice(0, 8).map(change => {')
    < governanceCockpitReadModelSection.indexOf('const changeFlowRows = allowManagerFrontendFallbacks ? buildLocalChangeFlowRows() : [];'),
  'Change Flow must only construct browser-local change rows inside the offline/demo fallback branch.',
);
assert(
  governanceCockpitReadModelSection.indexOf('const changeDerivedFrontendRowsAllowed = !changeFlow.frontendMockSuppressed;')
    < governanceCockpitReadModelSection.indexOf('const changeSourceIntakeRows = changeSourceIntakeReadModelRows'),
  'Change source-intake rows must stay gated by the backend-required Change Flow state.',
);
assert(
  governanceCockpitReadModelSection.indexOf('const localKickoffExecutionFallbackAllowed = allowManagerFrontendFallbacks;')
    < governanceCockpitReadModelSection.indexOf('const buildLocalKickoffExecutionFlow = () => kickoffCharter ? {'),
  'Kickoff Execution Flow local next-action/startup proof must only be constructed through the offline/demo fallback branch.',
);
const scenarioControlCenterSection = sliceBetween(
  appSource,
  'const scenarioAutonomyCycleLabel = dashboardAutonomousCycleCount',
  'const managerScenarioTrailRows = allowManagerFrontendFallbacks ? [',
);
assertIncludes(scenarioControlCenterSection, [
  'const scenarioAutonomyStatus = autonomousWorkLoopBackendRequired',
  'status: scenarioAutonomyStatus',
  'const scenarioManagementStatus = agentManagementMesh.frontendMockSuppressed',
  'status: scenarioManagementStatus',
  'const scenarioKickoffExecutionFlow = backendManagerDashboard?.kickoffExecutionFlow',
  'const scenarioKickoffBackendRequired = timelineEventReadModelsRequired && !backendManagerDashboard?.kickoffExecutionFlow;',
  'status: scenarioKickoffStatus',
  'proof: scenarioKickoffProof',
], 'Scenario Control Center backend-required status boundary');
assert(
  scenarioControlCenterSection.indexOf('const scenarioAutonomyStatus = autonomousWorkLoopBackendRequired')
    < scenarioControlCenterSection.indexOf('status: scenarioAutonomyStatus'),
  'Scenario Control Center 24/7 Work Pulse status must fail closed with the backend-required autonomy boundary.',
);
assert(
  scenarioControlCenterSection.indexOf('const scenarioManagementStatus = agentManagementMesh.frontendMockSuppressed')
    < scenarioControlCenterSection.indexOf('status: scenarioManagementStatus'),
  'Scenario Control Center Agent Management Sync status must fail closed with the backend-required Agent Management Mesh boundary.',
);

const managerDerivedFallbackSection = sliceBetween(
  appSource,
  'const managerScenarioTrailRows = allowManagerFrontendFallbacks ? [',
  'const buildFallbackManagerCommandCenter = () => ({',
);
assertIncludes(managerDerivedFallbackSection, [
  'const managerScenarioTrailRows = allowManagerFrontendFallbacks ? [',
  'const managerRequirementMatrixRows = allowManagerFrontendFallbacks ? [',
  'const fallbackManagerUseCaseAuditRows = allowManagerFrontendFallbacks ? localManagerUseCaseAuditSpecs.map',
  'const firstPendingPlaybookIndex = allowManagerFrontendFallbacks ? managerRequirementMatrixRows.findIndex(row => !row.passed) : -1;',
  'rows: allowManagerFrontendFallbacks ? managerRequirementMatrixRows.map((row, index) => {',
  'const fallbackManagerScenarioWalkthroughRows = allowManagerFrontendFallbacks ? managerWalkthroughSpecs.map',
  'const fallbackManagerCommandAttentionRows = allowManagerFrontendFallbacks ? [',
], 'Manager derived fallback rows offline/demo-only boundary');

const syncProtocolAuditReadModelSection = sliceBetween(
  appSource,
  'const buildFallbackSyncProtocolAudit = () => {',
  'const handoffTimelineProofIds = (handoff) => (',
);
assertIncludes(syncProtocolAuditReadModelSection, [
  'const buildFallbackSyncProtocolAudit = () => {',
  'const fallbackSyncProtocolRows = [',
  'const syncProtocolAudit = backendOrLazyFallback(',
  'buildFallbackSyncProtocolAudit',
  "missingBackendReadModel('sync-protocol-audit/v1'",
  "'sync-protocol-audit/v1'",
], 'Sync Protocol Audit lazy fallback boundary');

const managerScenarioTrailRenderSection = sliceBetween(
  appSource,
  'data-testid="manager-scenario-trail"',
  'data-testid="sync-protocol-audit"',
);
assertIncludes(managerScenarioTrailRenderSection, [
  "managerReadModelSourceBadge(managerScenarioTrail, 'manager-scenario-trail-source')",
  'managerScenarioTrail.frontendMockSuppressed',
  'data-testid="manager-scenario-trail-backend-required"',
  'Backend Manager Scenario Trail is required for this real project.',
  'data-testid="manager-scenario-trail-sync-read-model"',
  'onClick={() => syncBackendManagerScenarioTrail({ silent: false, projectId: activeProject.id })}',
], 'Manager Scenario Trail backend-required recovery action');

const governanceCockpitRenderSection = sliceBetween(
  appSource,
  "managerReadModelSourceBadge(governanceProtocol, 'governance-protocol-source')",
  'data-testid="active-threads-task-proof-backend-required"',
);
assertIncludes(governanceCockpitRenderSection, [
  "managerReadModelSourceBadge(governanceProtocol, 'governance-protocol-source')",
  'data-testid="governance-protocol-backend-required"',
  'Backend Kickoff Charter governance required. Local governance inference is suppressed for this backend project.',
  'data-testid="governance-protocol-sync-governance"',
  'onClick={() => syncBackendGovernanceProtocol({ silent: false, projectId: activeProject.id })}',
  "managerReadModelSourceBadge(changeFlow, 'change-flow-source')",
  'data-testid="change-flow-backend-required"',
  'data-testid="change-flow-sync-cockpit"',
  "managerReadModelSourceBadge(agentManagementMesh, 'agent-management-mesh-source')",
  'data-testid="agent-management-mesh-backend-required"',
  'Backend Agent Management Mesh required. Local management and peer-proof rows are suppressed until Manager Dashboard returns agent-management-mesh/v1.',
  'data-testid="agent-management-mesh-sync-cockpit"',
  "managerReadModelSourceBadge(managerProofMap, 'manager-scenario-readiness-source')",
  'data-testid="manager-scenario-readiness-backend-required"',
  'data-testid="manager-scenario-readiness-sync-proof-map"',
  "managerReadModelSourceBadge(managerProofMap, 'manager-proof-map-source')",
  'data-testid="manager-proof-map-sync-readiness-proof-map"',
  "managerReadModelSourceBadge(collaborationHealth, 'collaboration-health-source')",
  'data-testid="collaboration-health-backend-required"',
  'data-testid="collaboration-health-sync-diagnostics"',
  "managerReadModelSourceBadge(assignmentTimelineMatrix, 'assignment-timeline-matrix-source')",
  'data-testid="assignment-timeline-matrix-backend-required"',
  'data-testid="assignment-timeline-matrix-sync-cockpit"',
], 'Manager governance/collaboration cockpit UI backend-required boundary');

const agentFocusDashboardReadModelSection = sliceBetween(
  appSource,
  'const agentBackendDashboard = agentDashboardSnapshotFor',
  'const agentStatusDotClass = backendAgentDashboardMissing',
);
assertIncludes(agentFocusDashboardReadModelSection, [
  'const agentBackendDashboard = agentDashboardSnapshotFor(agent.id, activeProject?.id);',
  'const backendAgentDashboardRequired = shouldRequireBackendAgentDashboard(activeProject);',
  'const backendAgentDashboardMissing = backendAgentDashboardRequired && !agentBackendDashboard;',
  "const agentDashboardSourceLabel = backendAgentDashboardMissing",
  "? 'backend-required'",
  'const agentSignalUsesBackendDashboard = Boolean(agentBackendDashboard);',
  'const localAgentSignalProofAllowed = !backendAgentDashboardRequired;',
  'const agentTeamDisplayState = agentSignalUsesBackendDashboard',
  ': localAgentSignalProofAllowed ? state : null;',
  'const proofSignalAllowed = agentSignalUsesBackendDashboard || localAgentSignalProofAllowed;',
  'const agentDashboardTaskFor = (taskId) => {',
  'const dashboardTask = agentOwnedTasks.find(task => String(task.id) === String(taskId));',
  'return localAgentSignalProofAllowed',
  'const obligationTask = agentDashboardTaskFor(latestObligation?.taskId);',
  'const worklogTask = agentDashboardTaskFor(worklogTaskId);',
  'const agentOwnedTasks = agentSignalUsesBackendDashboard && Array.isArray(agentBackendDashboard.ownedTasks)',
  ': localAgentSignalProofAllowed ? localAgentOwnedTasks : [];',
  "const agentFocusCurrentPlan = backendAgentDashboardMissing",
  "? 'backend required'",
  "const agentFocusStatusLabel = backendAgentDashboardMissing ? 'backend required' : agentFocusState.status || 'monitoring';",
  "const agentFocusStatusClass = backendAgentDashboardMissing ? 'bg-[#8f1e18] text-white' : 'bg-[#251b13] text-[#efe2bd]';",
  'const agentFocusInboxCount = backendAgentDashboardMissing',
  'const agentFocusObligationCount = backendAgentDashboardMissing',
  "const agentFocusOwnedTaskCount = backendAgentDashboardMissing ? 'backend required' : agentOwnedTasks.length;",
  'const workbenchBackendContextMissing = backendAgentDashboardRequired && !agentBackendDashboard;',
  'const localWorkbenchOptionsAllowed = !backendAgentDashboardRequired;',
  'const workbenchWriteDisabled = !backendCommandAvailable || backendStation.loading || workbenchBackendContextMissing;',
  'const localFocusState = localAgentSignalProofAllowed ? state || {} : {};',
  'const localAgentManagementProofIdsAllowed = !backendAgentDashboardRequired;',
  'const localOwnedTaskFallbackRows = localAgentSignalProofAllowed',
], 'Agent Focus Dashboard backend-required read-model boundary');
assert(
  agentFocusDashboardReadModelSection.indexOf('const localAgentSignalProofAllowed = !backendAgentDashboardRequired;')
    < agentFocusDashboardReadModelSection.indexOf(': localAgentSignalProofAllowed ? state : null;'),
  'Agent Focus team state must only read local Agent state after local fallback has been allowed.',
);
assert(
  agentFocusDashboardReadModelSection.indexOf('const agentOwnedTasks = agentSignalUsesBackendDashboard && Array.isArray(agentBackendDashboard.ownedTasks)')
    < agentFocusDashboardReadModelSection.indexOf('const obligationTask = agentDashboardTaskFor(latestObligation?.taskId);'),
  'Agent Focus obligation proof must resolve tasks from Agent Dashboard ownedTasks before local project tasks can be considered.',
);
assert(
  agentFocusDashboardReadModelSection.indexOf('return localAgentSignalProofAllowed')
    < agentFocusDashboardReadModelSection.indexOf('? activeProject.tasks.find(task => String(task.id) === String(taskId)) || null'),
  'Agent Focus local task fallback must stay behind localAgentSignalProofAllowed before local project tasks can supply proof.',
);
assert(
  agentFocusDashboardReadModelSection.indexOf('const agentFocusCurrentPlan = backendAgentDashboardMissing')
    < agentFocusDashboardReadModelSection.indexOf(': agentFocusState.currentPlan?.focus || \'monitor project lane\';'),
  'Agent Focus current plan must show backend required before falling back to Agent state.',
);
assert(
  agentFocusDashboardReadModelSection.indexOf('const localAgentManagementProofIdsAllowed = !backendAgentDashboardRequired;')
    < agentFocusDashboardReadModelSection.indexOf(': localAgentManagementProofIdsAllowed ? (activeProject.logs || [])'),
  'Agent Focus management proof must only read local logs after local fallback has been allowed.',
);

const agentFocusDashboardRenderSection = sliceBetween(
  appSource,
  'data-testid={`agent-team-dashboard-required-${agent.id}`}',
  'data-testid={`agent-message-panel-${agent.id}`}',
);
assertIncludes(agentFocusDashboardRenderSection, [
  'Backend Agent Dashboard required before showing confirmed Agent state.',
  'data-testid={`agent-focus-open-${agent.id}`}',
  'syncBackendAgentDashboard(agent.id, { silent: true })',
  'data-testid={`agent-focus-panel-${agent.id}`}',
  'data-testid={`agent-focus-status-${agent.id}`}',
  'data-testid={`agent-focus-dashboard-source-${agent.id}`}',
  'agentFocusStatusClass',
  'agentFocusStatusLabel',
  'agentDashboardSourceLabel',
  'agentFocusCurrentPlan',
  'agentFocusInboxCount',
  'agentFocusObligationCount',
  'agentFocusOwnedTaskCount',
  'data-testid={`agent-focus-backend-dashboard-required-${agent.id}`}',
  'Backend Agent Dashboard missing',
  'This real backend project requires `GET /projects/:id/agents/:agentId/dashboard`; local Agent state stays visible as project snapshot context, but it is not treated as the backend Agent Dashboard until Sync Agent Dashboard succeeds.',
  'data-testid={`agent-focus-sync-dashboard-${agent.id}`}',
  'syncBackendAgentDashboard(agent.id, { silent: false })',
  'data-testid={`agent-focus-backend-dashboard-${agent.id}`}',
  'data-testid={`agent-focus-management-proof-${agent.id}`}',
  'data-testid={`agent-focus-owned-tasks-empty-${agent.id}`}',
  'No backend owned task evidence returned yet.',
  'data-testid={`agent-focus-chat-proof-${agent.id}`}',
  'data-testid={`agent-focus-timeline-proof-${agent.id}`}',
  'data-testid={`agent-workbench-artifact-draft-proof-${agent.id}`}',
  'Draft node: {latestWorkbenchReceipt.artifactDraftId}',
  'latestWorkbenchReceipt.readModels?.managerFlowGraphRoute',
  'latestWorkbenchReceipt.readModels?.readinessProofMapRoute',
  'latestWorkbenchReceipt.readModels?.timelineRoute',
  'latestWorkbenchReceipt.readModels?.eventsRoute',
], 'Agent Focus Dashboard backend-required UI boundary');

const agentWriteReadModelRefreshSection = sliceBetween(
  appSource,
  'const refreshAgentWriteReadModels = async',
  'const refreshAutonomousRunControlReadModels = async',
);
assertIncludes(agentWriteReadModelRefreshSection, [
  'fetchReadModel(readRoutes.readinessProofMapRoute, `/projects/${encodeURIComponent(targetProjectId)}/readiness-proof-map`, 8000)',
  'const readinessProofMap = readinessProofMapResult.status === \'fulfilled\' ? readinessProofMapResult.value : null;',
  'const readinessProofMapAppliedThroughManagerPayload = Boolean(readinessProofMap && (dashboard || readyPackage?.managerDashboard));',
  'managerReadyPackage: readyPackage ? { ...readyPackage, readinessProofMap: readinessProofMap || readyPackage.readinessProofMap } : null,',
  'readinessProofMap,',
  'if (readinessProofMap && !readinessProofMapAppliedThroughManagerPayload) {',
  'readinessProofMap,',
  'lastReadinessProofMapSyncAt: new Date().toISOString(),',
  'readinessProofMapSyncCount: (prev.readinessProofMapSyncCount || 0) + 1,',
], 'Agent write Proof Map independent refresh boundary');
assert(
  agentWriteReadModelRefreshSection.indexOf('const readinessProofMapAppliedThroughManagerPayload = Boolean(readinessProofMap && (dashboard || readyPackage?.managerDashboard));')
    < agentWriteReadModelRefreshSection.indexOf('if (readinessProofMap && !readinessProofMapAppliedThroughManagerPayload) {'),
  'Agent write refresh must decide whether Proof Map was applied through Manager payload before the independent Proof Map fallback.',
);

const agentWorkbenchCommandSection = sliceBetween(
  appSource,
  'const AGENT_WORKBENCH_BACKEND_DASHBOARD_REQUIRED_MESSAGE',
  'const runBackendAgentPulse = async',
);
assertIncludes(agentWorkbenchCommandSection, [
  'Backend Agent Dashboard is required before this real project can create Agent Workbench proof. No local workbench proof was created.',
  'const agentWorkbenchBackendDashboardMissing = (agentId, project = activeProject) => Boolean',
  'shouldRequireBackendAgentDashboard(project)',
  '!agentDashboardSnapshotFor(agentId, project.id)',
  'localProofCreated: false',
  'failAgentWorkbenchBackendDashboardRequired(agentId, \'agent-workbench-backend-dashboard-required\');',
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/agents/${encodeURIComponent(agentId)}/evidence-searches`',
  'useProvider: true',
  "searchMode: 'manual-source-record'",
  'No manual source URL was provided, so no local evidence receipt was created.',
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/agents/${encodeURIComponent(agentId)}/submissions`',
  'No local artifact receipt was created.',
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/agents/${encodeURIComponent(agentId)}/artifact-drafts`',
  'No local draft receipt was created.',
  'includeReadModels: false',
  'refreshAgentWriteReadModels({ payload, agentId, projectId: activeProject.id })',
], 'Agent Workbench backend write boundary');
assert(
  !agentWorkbenchCommandSection.includes("searchMode: 'agent-note'")
    && !agentWorkbenchCommandSection.includes("kind: 'agent-note'"),
  'Agent Workbench evidence must not restore no-source agent-note fallback proof.',
);

const agentPulseCommandSection = sliceBetween(
  appSource,
  'const runBackendAgentPulse = async',
  'const defaultBackendReviewerAgentId =',
);
assertIncludes(agentPulseCommandSection, [
  'if (!activeProject || !agentId || !shouldAttemptBackendProjectWrite(activeProject)) return;',
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/agents/${encodeURIComponent(agentId)}/work-cycle`',
  'includeReadModels: false',
  '...backendAgentCollaborationBody(agentId)',
  'refreshAgentWriteReadModels({ payload, agentId, projectId: activeProject.id })',
  "lastAction: 'Agent pulse failed'",
], 'Agent Pulse backend work-cycle command boundary');

const agentPulseCollaborationBodySection = sliceBetween(
  appSource,
  'const backendAgentCollaborationBody = (agentId) => {',
  'const backendSchedulerAgentSweepBody = () => {',
);
assertIncludes(agentPulseCollaborationBodySection, [
  'useAutonomousStrategy: true',
  'submitWorkArtifact: true',
  'reviewPendingSubmission: true',
  'respondToReviewObligation: true',
  "reviewResponseArtifactType: 'revision-note'",
], 'Agent Pulse collaboration strategy body boundary');

const agentWorkbenchRenderSection = sliceBetween(
  appSource,
  'data-testid={`agent-workbench-${agent.id}`}',
  'data-testid={`agent-focus-management-${agent.id}`}',
);
assertIncludes(agentWorkbenchRenderSection, [
  'AGENT_WORKBENCH_ARTIFACT_TYPES.map',
  'data-testid={`agent-workbench-backend-dashboard-required-${agent.id}`}',
  'Backend Agent Dashboard is required before this real project can submit Agent Workbench evidence, artifacts, drafts, reviews, or final delivery from this Agent context.',
  'disabled={workbenchWriteDisabled}',
  'data-testid={`agent-workbench-evidence-${agent.id}`}',
  'onClick={() => runBackendAgentEvidenceSearch(agent.id)}',
  'data-testid={`agent-workbench-submit-${agent.id}`}',
  'onClick={() => runBackendAgentArtifactSubmission(agent.id)}',
  'data-testid={`agent-workbench-draft-submit-${agent.id}`}',
  'onClick={() => runBackendAgentArtifactDraft(agent.id)}',
  'data-testid={`agent-workbench-receipt-${agent.id}`}',
  'Agent Workbench Write Failed',
  'Latest Backend Receipt',
  'no local workbench proof was created',
], 'Agent Workbench UI backend-required boundary');
assertIncludes(appSource, [
  "id: 'discovery-report'",
  "id: 'brainstorm-board'",
  "id: 'evidence-packet'",
  "id: 'product-brief'",
  "id: 'decision-proposal'",
  "id: 'risk-review'",
  "id: 'implementation-plan'",
  "id: 'revision-note'",
  "id: 'final-deliverable'",
], 'Agent Workbench generic artifact type options');

const reviewerCommandSection = sliceBetween(
  appSource,
  'const runBackendSubmissionReview = async (submission = {}) => {',
  'const runBackendAgentEvidenceSearch = async',
);
assertIncludes(reviewerCommandSection, [
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/submissions/${encodeURIComponent(submission.id)}/reviews`',
  "action: 'submission-review-pending'",
  "action: 'submission-review'",
  "action: 'submission-review-failed'",
  'No local review receipt was created.',
  'localProofCreated: false',
  'refreshAgentWriteReadModels({ payload, agentId: reviewerAgentId, projectId: activeProject.id })',
], 'Reviewer composer backend write boundary');

const agentMessageFlowCommandSection = sliceBetween(
  appSource,
  'const updateAgentMessageDraft = (agentId, patch = {}) => {',
  'useEffect(() => {',
);
assertIncludes(agentMessageFlowCommandSection, [
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/agents/${encodeURIComponent(agentId)}/message`',
  'targetAgentIds: [targetAgentId]',
  'messageId: `manager_ui_agent_message_${agentId}_${Date.parse(now) || Date.now()}`',
  'refreshAgentWriteReadModels({ payload, agentId, projectId: activeProject.id })',
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/manager-flow-graph/nodes/${encodeURIComponent(nodeId)}/confirm`',
  'includeReadModels: false',
  'Manager flow node confirmation failed',
], 'Agent Message and Flow confirmation backend write boundary');

const reviewerRenderSection = sliceBetween(
  appSource,
  'data-testid={`submission-review-composer-${row.id}`}',
  'data-testid="backend-manager-submission-reviews-snapshot"',
);
assertIncludes(reviewerRenderSection, [
  'data-testid={`submission-review-reviewer-${row.id}`}',
  'data-testid={`submission-review-verdict-${row.id}`}',
  'data-testid={`submission-review-submit-${row.id}`}',
  'onClick={() => runBackendSubmissionReview(row)}',
  'disabled={!backendCommandAvailable || backendStation.loading || !rowReviewerId}',
  'data-testid={`submission-review-receipt-${row.id}`}',
  'Review write failed:',
  'no local review receipt was created.',
], 'Reviewer composer backend receipt UI boundary');

const agentMessageRenderSection = sliceBetween(
  appSource,
  'data-testid={`agent-message-panel-${agent.id}`}',
  'data-testid={`agent-work-cycle-${agent.id}`}',
);
assertIncludes(agentMessageRenderSection, [
  'data-testid={`agent-message-target-${agent.id}`}',
  'data-testid={`agent-message-input-${agent.id}`}',
  'data-testid={`agent-message-send-${agent.id}`}',
  'onClick={() => runBackendAgentMessage(agent.id)}',
  'disabled={!backendCommandAvailable || backendStation.loading || !selectedMessageTarget}',
], 'Agent Message backend route UI boundary');

const agentFocusPulseRenderSection = sliceBetween(
  appSource,
  'data-testid={`agent-focus-pulse-${agent.id}`}',
  'data-testid={`agent-focus-backend-dashboard-required-${agent.id}`}',
);
assertIncludes(agentFocusPulseRenderSection, [
  'onClick={() => runBackendAgentPulse(agent.id)}',
  'disabled={!backendCommandAvailable || backendStation.loading}',
], 'Agent Focus pulse backend route UI boundary');

const agentWorkCyclePulseRenderSection = sliceBetween(
  appSource,
  'data-testid={`agent-work-cycle-${agent.id}`}',
  '<div className={`w-2 h-2 rounded-full ${agentStatusDotClass}`} />',
);
assertIncludes(agentWorkCyclePulseRenderSection, [
  'onClick={() => runBackendAgentPulse(agent.id)}',
  'disabled={!backendCommandAvailable || backendStation.loading}',
], 'Agent Work Cycle pulse backend route UI boundary');

const managerFlowConfirmationRenderSection = sliceBetween(
  appSource,
  "Confirmation: {selectedNode.confirmation?.confirmedAt ? graphTime(selectedNode.confirmation.confirmedAt) : 'not confirmed by user'}",
  '</aside>',
);
assertIncludes(managerFlowConfirmationRenderSection, [
  'onClick={() => confirmManagerFlowNode(selectedNode.id, true)}',
  "disabled={!backendCommandAvailable || backendStation.loading || selectedNode.status === 'confirmed'}",
  'Confirm Valid Work',
  'onClick={() => confirmManagerFlowNode(selectedNode.id, false)}',
  'disabled={!backendCommandAvailable || backendStation.loading}',
  'Supersede',
], 'Manager Flow confirmation backend route UI boundary');

assertIncludes(appSource, [
  'settings-provider-api-entry-state',
  'Backend Vault unlocks entry; saving is backend-only',
  'settings-secret-vault-action-required',
  'Provider secret draft fields are editable',
  'settingsProviderCanTypeApiFields',
  'settingsProviderSecretInputReady',
  'API field: {settingsProviderSecretInputReady',
  'waiting for Secret Vault',
  'The browser will not persist provider secrets',
], 'Settings provider entry boundary');
for (const editableSettingsInput of [
  'settings-deployment-backend-url-input',
  'settings-workspace-bind-path-input',
]) {
  assertInputEditableByTestId(appSource, editableSettingsInput);
}
for (const gatedProviderSecretInput of [
  'settings-provider-model-key-input',
  'settings-provider-search-key-input',
  'settings-provider-search-endpoint-input',
]) {
  assertProviderSecretInputGatedByTestId(appSource, gatedProviderSecretInput);
}
const settingsProviderEntrySection = sliceBetween(
  appSource,
  'const settingsSecretVaultUnavailableMessage',
  'const SettingsBackendStatusIcon',
);
const settingsProviderRenderSection = sliceBetween(
  appSource,
  'data-testid="settings-secret-vault-status"',
  'data-testid="settings-provider-route-contract"',
);
const settingsDeploymentRuntimeReadinessSection = sliceBetween(
  appSource,
  'data-testid="settings-runtime-readiness-contract"',
  '<div className="grid gap-4 md:grid-cols-3">',
);
const settingsModelRuntimeReadinessSection = sliceBetween(
  appSource,
  'data-testid="settings-model-runtime-readiness-contract"',
  'data-testid="settings-model-route-contract"',
);
for (const forbiddenSettingsCopy of [
  '后端 API 缺失',
  '后端 API 缺失',
  'Backend API missing',
  'backend API missing',
  'input blocked',
  'blocked by backend contract',
]) {
  assert(
    !settingsProviderEntrySection.includes(forbiddenSettingsCopy)
      && !settingsProviderRenderSection.includes(forbiddenSettingsCopy),
    `Settings provider entry must not render stale blocked-copy marker: ${forbiddenSettingsCopy}.`,
  );
}

assertIncludes(settingsProviderRenderSection, [
  'data-testid="settings-provider-readiness-source"',
  'data-testid="settings-provider-readiness-source-detail"',
  'settingsProviderReadinessSourceStatus',
  'settingsProviderReadinessSourceDetail',
], 'Settings Provider readiness source-label boundary');
assertIncludes(settingsDeploymentRuntimeReadinessSection, [
  'data-testid="settings-runtime-readiness-source"',
  'data-testid="settings-runtime-readiness-source-detail"',
  'settingsRuntimeReadinessSourceStatus',
  'settingsRuntimeReadinessSourceDetail',
  'Save Backend URL in Deployment before runtime readiness sync.',
], 'Settings Deployment runtime readiness source-label boundary');
assertIncludes(settingsModelRuntimeReadinessSection, [
  'data-testid="settings-model-runtime-readiness-source"',
  'data-testid="settings-model-runtime-readiness-source-detail"',
  'settingsRuntimeReadinessSourceStatus',
  'settingsRuntimeReadinessSourceDetail',
], 'Settings Models runtime readiness source-label boundary');
assertIncludes(appSource, [
  "settingsProviderReadinessSourceStatus === 'backend-backed'",
  "settingsRuntimeReadinessSourceStatus === 'backend-backed'",
  'const settingsBackendReady = backendUrlConfigured && (',
  "['Target backend', backendConfiguredTargetLabel]",
  'data-testid="settings-deployment-backend-url" className="mt-2 break-all font-mono text-xs text-[#1a1a1a]">{backendConfiguredTargetLabel}',
  '<div data-testid="settings-provider-base-url" className="break-all">Target: {backendConfiguredTargetLabel}</div>',
  '<div className="mt-2 break-all font-mono text-xs text-[#1a1a1a]">{backendHealthTargetLabel}</div>',
  'Backend settings-provider-readiness/v1 route synced',
  'Click Sync status to read ${settingsProviderReadinessDisplayRoute}',
  'Save Backend URL in Deployment before provider draft entry or readiness sync',
  'Backend settings-runtime-readiness/v1 route synced',
  'Click Sync runtime to read ${settingsRuntimeReadinessDisplayRoute}',
  'Save Backend URL in Deployment before runtime readiness sync',
  "backendUrlConfigured ? 'Check required' : 'Save Backend URL first'",
], 'Settings provider/runtime readiness source-label model');
assertIncludes(appSource, [
  'const settingsHealthCheckedForTarget = backendUrlConfigured',
  '&& Boolean(healthCheck.lastRunAt)',
  '&& Boolean(healthCheck.summary)',
  '=== committedBackendBaseUrl();',
  'const settingsHealthRows = Array.isArray(healthCheck.rows) ? healthCheck.rows : [];',
  'const settingsHealthHasFailure = Boolean(healthCheck.error)',
  "|| ['failed', 'blocked'].includes(String(healthCheck.summary || '').toLowerCase())",
  "|| settingsHealthRows.some(row => ['fail', 'blocked'].includes(String(row.status || '').toLowerCase()));",
  'const settingsHealthPassedForTarget = settingsHealthCheckedForTarget && !settingsHealthHasFailure;',
  'const settingsBackendFooterReady = settingsBackendReady && settingsHealthPassedForTarget;',
  'Backend target saved; run Health check before first project',
  'Health check failed or blocked; backend setup required before first project',
  'const settingsFooterConnectionLabel = backendUrlConfigured && !settingsHealthPassedForTarget',
  "? 'Run Health Check'",
  '{settingsFooterConnectionLabel}',
  "settingsBackendFooterReady ? 'text-green-700' : 'text-[#75631d]'",
], 'Settings footer must not mark backend saved until Health has run for the configured target');
assertIncludes(appSource, [
  "blocked: 'border-[#8f1e18] bg-red-50 text-[#8f1e18]'",
  "blocked: 'Blocked'",
  "{ id: 'settings-health-readiness', label: 'Settings Health', status: 'blocked', detail }",
], 'Settings Health blocked rows must render as explicit blocked states');

const settingsProjectSettingsCommandSection = sliceBetween(
  appSource,
  'const updateProjectLanguageSetting = async',
  'const runMultiChannelChangeBroadcast = async',
);
assertIncludes(settingsProjectSettingsCommandSection, [
  'const updateProjectLanguageSetting = async',
  'const updateProjectPrivacyPolicySetting = async',
  'const updateProjectProviderBudgetPolicySetting = async',
  'const updateProjectWorkspacePolicySetting = async',
  'const bindProjectWorkspaceFromSettings = async',
  'const updateProjectToolGrantPolicySetting = async',
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/project-settings`',
  "source: 'settings-project-language'",
  "source: 'settings-project-privacy'",
  "source: 'settings-provider-budget'",
  "source: 'settings-workspace-policy'",
  "source: 'settings-tool-grants'",
  'requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/workspace/bind`',
  'Project workspace bound through backend local runtime',
  'Backend workspace bind failed; no local binding was created',
], 'Settings project settings backend receipt boundary');

const settingsRenderSection = sliceBetween(
  appSource,
  "settingsTab === 'privacy'",
  '<footer className="flex h-16 shrink-0 items-center justify-between border-t border-[#d1d0c9] px-7">',
);
assertIncludes(settingsRenderSection, [
  'data-testid="settings-privacy-retention-mode"',
  'data-testid="settings-privacy-provider-log-mode"',
  'data-testid="settings-privacy-export-approval"',
  'data-testid="settings-workspace-interface-density"',
  'data-testid="settings-workspace-default-visibility"',
  'data-testid="settings-workspace-autosave-cadence"',
  'data-testid="settings-workspace-bind-submit"',
  'data-testid="settings-workspace-capabilities-sync-project-state"',
  'data-testid="settings-integration-capabilities-sync-project-state"',
  'onClick={() => syncBackendProjectState({ silent: false })}',
  'data-testid="settings-tool-grant-policy"',
  'data-testid="settings-provider-budget-policy"',
  'project-settings/v1',
  '/projects/:id/project-settings',
  '/projects/:id/workspace/bind',
  'Global language: browser-local UI preference only',
  "readyForProduction ? 'ready' : 'blocked'",
], 'Settings backend-backed control render boundary');
assertIncludes(appSource, [
  'const settingsBackendProjectWriteAvailable = shouldAttemptBackendProjectWrite(activeProject);',
  'const settingsBackendProjectSyncDisabled = !settingsBackendProjectWriteAvailable || backendStation.loading;',
  'const settingsProviderProjectSyncDisabled = !settingsBackendProjectWriteAvailable || providerRuntimeStatus.running;',
  'Save the backend API URL in Settings Deployment before syncing integration readiness.',
  'Save the backend API URL in Settings Deployment before syncing meeting summaries.',
  'Save the backend API URL in Settings Deployment before syncing project memory readiness.',
  'Backend privacy policy route required; local fallback disabled',
  'Backend provider budget route required; local fallback disabled',
  'Backend workspace policy route required; local fallback disabled',
  'Backend tool grant route required; local fallback disabled',
], 'Settings backend project write guard');
assertIncludes(settingsRenderSection, [
  'disabled={!settingsBackendProjectWriteAvailable || privacyPolicySaving}',
  'disabled={!settingsBackendProjectWriteAvailable || workspacePolicySaving}',
  'disabled={settingsBackendProjectSyncDisabled || workspaceBindDraft.saving || !workspaceBindDraft.path.trim()}',
  'disabled={settingsBackendProjectSyncDisabled}',
  'disabled={settingsProviderProjectSyncDisabled}',
  'disabled={!settingsBackendProjectWriteAvailable || toolGrantPolicySaving}',
  'disabled={!settingsBackendProjectWriteAvailable || providerBudgetPolicySaving}',
], 'Settings backend-backed controls disabled until backend project is writable');

const settingsWorkspaceMemoryReadinessSection = sliceBetween(
  settingsRenderSection,
  'data-testid="settings-workspace-memory-readiness"',
  'data-testid="settings-workspace-meeting-summaries"',
);
assertIncludes(settingsWorkspaceMemoryReadinessSection, [
  'data-testid="settings-workspace-sync-memory-readiness"',
  'data-testid="settings-workspace-memory-readiness-source"',
  'data-testid="settings-workspace-memory-readiness-source-detail"',
  'data-testid="settings-workspace-memory-readiness-route"',
  '/projects/:id/memory-readiness',
  'settings-workspace-memory-readiness-rows',
  'settings-workspace-memory-readiness-gates',
], 'Settings Workspace memory readiness route boundary');
assertIncludes(appSource, [
  "projectMemoryReadinessSourceStatus === 'backend-backed'",
  'Sync /projects/:id/memory-readiness before trusting memory readiness',
], 'Settings Workspace memory readiness source-label model');
assertReadOnlyRoutePanel(settingsWorkspaceMemoryReadinessSection, 'Settings Workspace memory readiness');

const settingsWorkspaceMeetingSummarySection = sliceBetween(
  settingsRenderSection,
  'data-testid="settings-workspace-meeting-summaries"',
  'data-testid="settings-workspace-route-contract"',
);
assertIncludes(settingsWorkspaceMeetingSummarySection, [
  'Read-only summaries derived from backend transcripts, timeline logs, and event-ledger proof.',
  'data-testid="settings-workspace-sync-meeting-summaries"',
  'data-testid="settings-workspace-meeting-summary-source"',
  'data-testid="settings-workspace-meeting-summary-source-detail"',
  'data-testid="settings-workspace-meeting-summary-route"',
  '/projects/:id/meeting-summaries',
  'settings-workspace-meeting-summary-rows',
], 'Settings Workspace meeting summaries route boundary');
assertIncludes(appSource, [
  "meetingSummarySourceStatus === 'backend-backed'",
  'Sync /projects/:id/meeting-summaries before trusting summaries',
], 'Settings Workspace meeting summaries source-label model');
assertReadOnlyRoutePanel(settingsWorkspaceMeetingSummarySection, 'Settings Workspace meeting summaries');

const settingsIntegrationReadinessSection = sliceBetween(
  settingsRenderSection,
  'data-testid="settings-integration-capabilities-summary"',
  'data-testid="settings-integration-browser-tools-boundary"',
);
assertIncludes(settingsIntegrationReadinessSection, [
  'data-testid="settings-integration-readiness-summary"',
  'settings-integration-readiness not synced',
  'data-testid="settings-integration-readiness-source"',
  'data-testid="settings-integration-readiness-source-detail"',
  'data-testid="settings-integration-readiness-route"',
  '/projects/:id/settings-integration-readiness',
  'data-testid="settings-integration-readiness-contract"',
  'settings-integration-readiness-row-${row.id}',
  'Route sync: {integrationCapabilityRouteSyncLabel}',
  'contract not synced',
  'Route: {row.requiredBackendRoute}',
  "Schema: {row.readinessSchemaVersion || 'not synced'}",
  "Checksum: {row.readinessChecksum || 'not synced'}",
  'data-testid="settings-integration-capability-contract"',
  'data-testid="settings-integration-capabilities-missing"',
  'Integration capability contract not synced.',
  'data-testid="settings-integration-capabilities-sync-project-state"',
], 'Settings Integration readiness/capability route boundary');
assertIncludes(appSource, [
  "settingsIntegrationReadinessSourceStatus === 'backend-backed'",
  'Sync /projects/:id/settings-integration-readiness before trusting integration readiness',
], 'Settings Integration readiness source-label model');

for (const panel of [
  {
    start: 'data-testid="settings-integration-proxy-webhook-boundary"',
    end: 'data-testid="settings-integration-mcp-tools-boundary"',
    context: 'Settings Proxy/Webhook adapter gateway',
    markers: ['data-testid="settings-proxy-webhook-preflight-route"', '/projects/:id/adapter-gateway-preflight'],
  },
  {
    start: 'data-testid="settings-integration-mcp-tools-boundary"',
    end: 'data-testid="settings-integration-vector-boundary"',
    context: 'Settings MCP tools readiness',
    markers: ['data-testid="settings-mcp-tools-readiness-route"', '/projects/:id/provider-readiness'],
  },
  {
    start: 'data-testid="settings-integration-vector-boundary"',
    end: 'data-testid="settings-integration-budget-boundary"',
    context: 'Settings Vector Store evidence index readiness',
    markers: ['data-testid="settings-evidence-index-readiness-route"', '/projects/:id/evidence-index-readiness'],
  },
  {
    start: 'data-testid="settings-integration-budget-boundary"',
    end: 'data-testid="settings-integration-error-reporting-boundary"',
    context: 'Settings Budget Alerts readiness',
    markers: ['data-testid="settings-budget-alert-readiness-route"', '/projects/:id/budget-alert-readiness'],
  },
  {
    start: 'data-testid="settings-integration-error-reporting-boundary"',
    end: 'data-testid="settings-tool-grant-policy"',
    context: 'Settings Error Reporting readiness',
    markers: ['data-testid="settings-error-reporting-readiness-route"', '/projects/:id/error-reporting-readiness'],
  },
]) {
  const panelSection = sliceBetween(settingsRenderSection, panel.start, panel.end);
  assertIncludes(panelSection, panel.markers, `${panel.context} route boundary`);
  assertReadOnlyRoutePanel(panelSection, panel.context);
}

const settingsAutoSyncSection = sliceBetween(
  appSource,
  'settingsAutoIntegrationSyncRef.current[syncKey] = true;',
  'const shouldAttemptBackendProjectWrite =',
);
assertIncludes(settingsAutoSyncSection, [
  'syncBackendProjectState({ silent: true })',
  'syncSettingsIntegrationReadiness()',
  'syncBackendProjectMemoryReadiness({ silent: true })',
  'syncBackendMeetingSummaries({ silent: true })',
], 'Settings Workspace/Integrations auto-sync backend project state boundary');

const settingsFooterSection = sliceBetween(
  appSource,
  '<footer className="flex h-16 shrink-0 items-center justify-between border-t border-[#d1d0c9] px-7">',
  'const renderSidebar = () =>',
);
assertIncludes(settingsFooterSection, [
  'data-testid="settings-footer-backend-save-status"',
  'settingsBackendStatusLabel',
  'data-testid="settings-footer-test-connection"',
  'onClick={runSettingsFooterConnectionTest}',
], 'Settings footer boundary');
assert(
  !settingsFooterSection.includes('Save Settings')
    && !settingsFooterSection.includes('settings-footer-save')
    && !settingsFooterSection.includes('onClick={saveSettings'),
  'Settings footer must remain status/test-only; backend-backed controls save through their own receipts.',
);

assertIncludes(registerSource, [
  'This does not finish frontend mock replacement.',
  'Move lower-priority local project mutation paths away from browser-first `localStorage`',
  'Add source labels to lower-priority panels',
  'Browser messages/logs remain offline/demo/legacy fallback only',
  'API key/search endpoint fields are draft-enabled',
  '`Seal` persistence stays locked until the Secret Vault is ready',
  'production-customer-acceptance-startup-readiness/v1',
  'workspace-portfolio-catalog-required',
  'Workspace Hub Active Projects and Backend Projects now follow the same catalog boundary',
  'workspace-stat-source-active-projects',
  'workspace-stat-source-backend-projects',
  'Workspace Hub Open Tasks now follows the project catalog boundary',
  'workspace-stat-source-open-tasks',
  'Workspace Hub Stored Messages follows the same catalog/transcript boundary',
  'workspace-stat-source-stored-messages',
  'Recent Commit Line now consumes `timelineDisplayLogs`',
  'duplicate-key warnings',
  'stable unique UI keys',
  'Active Threads rows and task proof buttons now read Manager Dashboard task rows',
  'Group Chat Collaboration Proof Rows now require current-project Manager Dashboard collaboration read models',
  'Project Dashboard stat cards now render source labels',
  'project-dashboard-snapshot-source',
  'project-dashboard-progress-source',
  'project-dashboard-next-recommendation-source',
  'project-dashboard-next-recommendation-sync-manager-dashboard',
  'project-dashboard-stat-source-focus',
  'project-dashboard-stat-source-active-channels',
  'project-dashboard-stat-source-autonomous-cycles',
], 'mock replacement register');

console.log('Frontend mock boundary validation passed.');
