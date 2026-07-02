import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAgentProjectApi, createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { signAgentProjectAccessHeaders } from '../src/agents/accessControl.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let lastProgressAt = Date.now();
const ACCEPTANCE_STAGE = process.env.HOFS_PRODUCT_TEAM_STAGE || 'full';
const ACCEPTANCE_STAGE_STOPS = {
  core: 'start local HTTP runtime checks',
  'research-sample': 'research validation sample delivery trace ready',
  'cycle-consistency': 'autonomous cycle consistency persistence ready',
  'private-pilot-launch-handoff': 'private-pilot launch approval record ready',
  'private-pilot-handoff': 'private-pilot release candidate record ready',
  'private-pilot-release': 'private-pilot release candidate receipt ready',
  'private-pilot-launch': 'private-pilot launch run receipt ready',
  'private-pilot-health': 'private-pilot launch health check receipt ready',
  'private-pilot-acceptance': 'private-pilot acceptance report ready',
  'private-pilot': 'private-pilot acceptance report ready',
  'private-pilot-ops-readiness': 'production operations readiness model ready',
  'production-ops-controls': 'production operations control receipt projection ready',
  'production-deployment-controls': 'production deployment control receipt projection ready',
  'production-security-controls': 'production security control receipt ready',
  'production-provider-controls': 'production provider control receipt ready',
  'production-evidence-integrity': 'managed production evidence integrity ready',
  'production-launch-governance': 'production launch governance approval ready',
};

if (!['full', ...Object.keys(ACCEPTANCE_STAGE_STOPS)].includes(ACCEPTANCE_STAGE)) {
  throw new Error(`Unsupported HOFS_PRODUCT_TEAM_STAGE: ${ACCEPTANCE_STAGE}`);
}

function maybeStopAtStage(label) {
  if (ACCEPTANCE_STAGE === 'full') return;
  if (ACCEPTANCE_STAGE_STOPS[ACCEPTANCE_STAGE] !== label) return;
  console.log(`Product team acceptance ${ACCEPTANCE_STAGE} stage validation passed.`);
  process.exit(0);
}

function progress(label) {
  const now = Date.now();
  const elapsedMs = now - lastProgressAt;
  lastProgressAt = now;
  const message = `${label} (+${elapsedMs}ms)`;
  if (process.env.HOFS_PROGRESS === '1') {
    console.error(`[product-team] ${message}`);
  }
  if (process.env.HOFS_PROGRESS_LOG === '1') {
    appendFileSync(fileURLToPath(new URL('../.tmp/product-team-acceptance-progress.log', import.meta.url)), `${new Date().toISOString()} ${message}\n`);
  }
  maybeStopAtStage(label);
}

function readSmallTextFiles(rootPath) {
  if (!existsSync(rootPath)) return '';
  const entries = readdirSync(rootPath, { withFileTypes: true });
  return entries.map((entry) => {
    const path = `${rootPath}/${entry.name}`;
    if (entry.isDirectory()) return readSmallTextFiles(path);
    if (!entry.isFile()) return '';
    const stats = statSync(path);
    if (stats.size > 2_000_000) return '';
    return readFileSync(path, 'utf8');
  }).join('\n');
}

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'protocol design' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Cross-domain Inventor', skill: 'brainstorm synthesis' },
];

const FAKE_SEARCH_SECRET = 'SEARCH_SECRET_SHOULD_NOT_LEAK_12345';
const FAKE_MODEL_SECRET = 'MODEL_SECRET_SHOULD_NOT_LEAK_12345';
const FAKE_SOURCE_SECRET = 'SOURCE_SECRET_SHOULD_NOT_LEAK_12345';
const FAKE_VAULT_MASTER_KEY = 'VAULT_MASTER_KEY_SHOULD_NOT_LEAK_12345';
const FAKE_VAULT_ROTATED_MASTER_KEY = 'VAULT_ROTATED_MASTER_KEY_SHOULD_NOT_LEAK_12345';
const ACCESS_SIGNING_SECRET = 'ACCESS_SIGNING_SECRET_SHOULD_NOT_LEAK_12345';
const enforcedManagerHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'manager',
  'x-hofs-user-id': 'director',
};
const enforcedSecurityHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'security-admin',
  'x-hofs-user-id': 'security-lead',
};
const enforcedObserverHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'observer',
  'x-hofs-user-id': 'observer',
};
const enforcedJobsAgentHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'agent',
  'x-hofs-agent-id': 'jobs',
  'x-hofs-user-id': 'agent-runtime-jobs',
};
const enforcedDaVinciAgentHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'agent',
  'x-hofs-agent-id': 'da_vinci',
  'x-hofs-user-id': 'agent-runtime-da_vinci',
};
const enforcedCurieReviewerHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'reviewer-agent',
  'x-hofs-agent-id': 'curie',
  'x-hofs-user-id': 'agent-runtime-curie',
};
const signedHeadersFor = ({
  method = 'GET',
  path,
  role = 'security-admin',
  agentId = '',
  userId = 'security-lead',
  requestId = '',
} = {}) => signAgentProjectAccessHeaders({
  method,
  path,
  role,
  agentId,
  userId,
  requestId,
  secret: ACCESS_SIGNING_SECRET,
});

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const managerBackendUiSource = readFileSync(new URL('./validate-manager-backend-ui.mjs', import.meta.url), 'utf8');
const managerBackendCoreUiSource = readFileSync(new URL('./validate-manager-backend-core-ui.mjs', import.meta.url), 'utf8');
const managerProviderProofUiSource = readFileSync(new URL('./validate-manager-provider-proof-ui.mjs', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../src/agents/agentProjectApi.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/agents/agentProjectService.js', import.meta.url), 'utf8');
const secretVaultSource = readFileSync(new URL('../src/agents/secretVault.js', import.meta.url), 'utf8');
const modelProviderSource = readFileSync(new URL('../src/agents/modelProvider.js', import.meta.url), 'utf8');
const searchProviderSource = readFileSync(new URL('../src/agents/searchProvider.js', import.meta.url), 'utf8');
assert(appSource.includes('backend-manager-submissions-snapshot'), 'Manager Dashboard UI must expose Agent submissions.');
assert(appSource.includes('submission-review-composer-') && appSource.includes('runBackendSubmissionReview') && appSource.includes('/submissions/${encodeURIComponent(submission.id)}/reviews') && appSource.includes('submission-review-receipt-'), 'Manager Dashboard UI must let a Reviewer submit backend-backed submission reviews from Agent submission rows.');
assert(appSource.includes('backend-manager-artifact-drafts-route') && appSource.includes('backend-manager-artifact-drafts-snapshot'), 'Manager Dashboard UI must expose generated artifact draft routes and rows.');
assert(appSource.includes('agent-focus-submissions-'), 'Agent Dashboard UI must expose owned submissions.');
assert(appSource.includes('agent-focus-artifact-draft-'), 'Agent Dashboard UI must expose generated artifact draft metadata.');
assert(appSource.includes('agent-focus-brainstorm-contribution-') && appSource.includes('Brainstorm Contribution'), 'Agent Dashboard UI must expose personal brainstorm contribution evidence.');
assert(appSource.includes('agentDashboardSnapshotKey') && appSource.includes('agentDashboardSnapshotFor') && appSource.includes('[agentDashboardSnapshotKey(resolvedProjectId, resolvedAgentId)]') && !appSource.includes('agentDashboardSnapshots[agent.id]'), 'Agent Dashboard UI cache must be scoped by project plus Agent so one project cannot reuse another project Agent read model.');
assert(appSource.includes('projectAgentUiStateKey') && appSource.includes('projectSubmissionUiStateKey') && appSource.includes('agentWorkDraftFor') && appSource.includes('agentMessageDraftFor') && appSource.includes('submissionReviewDraftFor') && !appSource.includes('agentWorkDrafts[agent.id]') && !appSource.includes('agentMessageDrafts[agent.id]') && !appSource.includes('submissionReviewDrafts[row.id]'), 'Agent Workbench, Agent Message, and Reviewer composer drafts must be scoped by project before they can become backend submissions, evidence, messages, or reviews.');
assert(serviceSource.includes('agentMessageRoutes') && serviceSource.includes('readyForAgentMessageDelivery') && serviceSource.includes("eventType: 'agent-message'") && appSource.includes('proof-map-agent-message-routes') && appSource.includes('backendAgentMessageSummary') && appSource.includes('Agent message timeline proof'), 'Agent-to-Agent messages must be promoted into Readiness Proof Map routes with timeline proof and rendered as backend proof, not only chat bubbles.');
assert(appSource.includes('projectManagerUiStateKey') && appSource.includes('managerChangeDraftFor') && appSource.includes('managerAssignmentDraftFor') && appSource.includes('updateManagerChangeDraft') && appSource.includes('updateManagerAssignmentDraft') && !appSource.includes('setManagerChangeDraft(prev') && !appSource.includes('setManagerAssignmentDraft(prev'), 'Manager change and Leader assignment drafts must be scoped by project before they can become backend C-side command proof.');
assert(appSource.includes('projectInputUiStateKey') && appSource.includes('chatInputDrafts') && appSource.includes('roomInputDrafts') && appSource.includes('activeChannelDrafts') && !appSource.includes("const [chatInput, setChatInput] = useState('')") && !appSource.includes("const [roomInput, setRoomInput] = useState('')") && !appSource.includes("const [activeChannelId, setActiveChannelId] = useState('main')"), 'Project chat input, meeting input, and active chat channel must be scoped by project before they can write backend transcript or meeting proof.');
assert(appSource.includes('focusedChatProofIdDrafts') && appSource.includes('focusedTimelineProofIdDrafts') && appSource.includes('selectedTimelineEventDrafts') && !appSource.includes('const [focusedChatProofIds, setFocusedChatProofIds] = useState([])') && !appSource.includes('const [focusedTimelineProofIds, setFocusedTimelineProofIds] = useState([])') && !appSource.includes('const [selectedTimelineEventId, setSelectedTimelineEventId] = useState(null)'), 'Chat and timeline proof focus must be scoped by project so Manager monitoring cannot carry proof ids across projects.');
assert(appSource.includes('backend-manager-evidence-searches-snapshot'), 'Manager Dashboard UI must expose evidence searches.');
assert(appSource.includes('Agent provider evidence search running') && appSource.includes('useProvider: true') && appSource.includes('provider-evidence-search') && appSource.includes("searchMode: 'manual-source-record'") && appSource.includes('No manual source URL was provided, so no local source note was created.') && !appSource.includes("kind: 'agent-note'"), 'Agent Focus evidence search must attempt backend provider search first and must not create browser-authored agent-note evidence when no provider/source exists.');
assert(appSource.includes('settings-provider-boundary') && appSource.includes('settings-deployment-runtime-boundary') && appSource.includes('settings-model-runtime-boundary') && appSource.includes('settings-privacy-runtime-boundary') && appSource.includes('settings-workspace-runtime-boundary') && appSource.includes('settings-workspace-route-contract') && appSource.includes('settings-global-language-local-preference') && appSource.includes('Global language: browser-local UI preference only') && appSource.includes('Project language and workspace policy write through project-settings/v1') && appSource.includes('settings-integrations-runtime-boundary') && appSource.includes('settings-integrations-route-contract') && appSource.includes('settings-integration-capabilities-summary') && appSource.includes('settings-integration-capability-contract') && appSource.includes('settings-integration-capabilities-missing') && appSource.includes('settings-provider-vault-bindings') && appSource.includes('settings-secret-vault-status') && appSource.includes('settings-secret-vault-unavailable') && appSource.includes('settingsSecretVaultReady') && appSource.includes('settings-provider-model-key-input') && appSource.includes('settings-provider-search-key-input') && appSource.includes('settings-provider-search-endpoint-input') && appSource.includes('settings-provider-seal-model-key') && appSource.includes('settings-provider-seal-search-key') && appSource.includes('settings-provider-seal-search-endpoint') && appSource.includes('settings-privacy-retention-mode') && appSource.includes('settings-privacy-provider-log-mode') && appSource.includes('sealSettingsProviderSecret') && appSource.includes('/secret-vault/seal') && appSource.includes('SECRET_VAULT_ENABLED=true') && appSource.includes('syncSettingsProviderRuntime') && appSource.includes('/llm/status') && appSource.includes('/search/status') && appSource.includes('/provider-vault-bindings') && appSource.includes('/workers/autonomous/status') && appSource.includes('Backend-owned provider credentials') && appSource.includes('Deployment is owned by the worker station') && appSource.includes('Models are selected by backend provider policy') && appSource.includes('External tools are backend-governed.') && serviceSource.includes('project-integration-capabilities/v1') && serviceSource.includes('vector-store') && serviceSource.includes('proxy-webhook') && serviceSource.includes('mcp-tools') && !appSource.includes('settings-provider-key-readonly') && !appSource.includes('Paste token...') && !appSource.includes('Unified API Gateway') && !appSource.includes('GPT-4.1') && !appSource.includes('Model Routing Rules') && !appSource.includes('https://proxy.company.com:8080') && !appSource.includes('https://hooks.company.com/hof') && !appSource.includes('$120 / month') && !appSource.includes('Data Retention') && !appSource.includes('Log Level') && !appSource.includes('Default Project Visibility') && !appSource.includes('Autosave Interval') && !appSource.includes('Enable Long-Term Memory'), 'Settings provider/deployment/model/privacy/workspace/integration UI must expose backend runtime contracts, allow provider secrets only through backend secret-vault seal routes, require vault readiness before sealing, and avoid browser-only provider/model/privacy/workspace/integration controls.');
assert(appSource.includes("const integrationRouteStatusFallback = integrationCapabilities ? 'contract-row-missing' : 'sync-required'") && appSource.includes('Missing backend rows:'), 'Settings Integrations route-backed cards must show sync-required/row-missing when the capability contract is absent instead of defaulting to backend-required.');
assert(managerProviderProofUiSource.includes('settings-provider-boundary') && managerProviderProofUiSource.includes('settings-deployment-runtime-boundary') && managerProviderProofUiSource.includes('settings-model-runtime-boundary') && managerProviderProofUiSource.includes('/search/status') && managerProviderProofUiSource.includes('/provider-vault-bindings') && managerProviderProofUiSource.includes('/secret-vault/seal') && managerProviderProofUiSource.includes('settings-provider-seal-model-key') && managerProviderProofUiSource.includes('settings-provider-seal-search-key') && managerProviderProofUiSource.includes('settings-provider-search-endpoint-input') && managerProviderProofUiSource.includes('Settings key seal must not expose plaintext keys through backend record metadata.'), 'Provider proof browser Harness must verify the settings BYOK/deployment/model boundary uses backend secret-vault seal instead of browser-only configuration.');
assert(apiSource.includes('/secret-vault/status') && apiSource.includes('/secret-vault/records') && apiSource.includes('/secret-vault/seal') && apiSource.includes('/secret-vault/rotate') && apiSource.includes('/provider-vault-bindings'), 'Project API must expose backend secret-vault status, records, seal, rotate, and provider-vault binding routes.');
assert(serviceSource.includes('secretVaultSealReceipt') && serviceSource.includes('secretVaultRotationReceipt') && serviceSource.includes('secret-vault-record-list/v1') && serviceSource.includes('provider-vault-bindings/v1') && serviceSource.includes('providerVaultBindings') && serviceSource.includes('autonomous-provider-preflight/v1') && serviceSource.includes('autonomousProviderPreflight') && serviceSource.includes('autonomous-action-decision/v1') && serviceSource.includes('autonomousActionDecision') && serviceSource.includes('plaintextExposed: false'), 'Project service must return secret-vault receipts, provider-vault binding evidence, autonomous provider preflight evidence, autonomous action decision evidence, and metadata without plaintext exposure.');
assert(serviceSource.includes('bindProviderApiKeyFromVaultRecord') && serviceSource.includes('providerRuntimeBinding') && serviceSource.includes("setApiKey(secretValue, 'local-secret-vault')") && serviceSource.includes("setEndpoint(secretValue, 'local-secret-vault'") && modelProviderSource.includes('runtimeEnabled') && modelProviderSource.includes('setApiKey(nextApiKey') && searchProviderSource.includes('runtimeEnabled') && searchProviderSource.includes('setApiKey(nextApiKey') && searchProviderSource.includes('setEndpoint(nextEndpoint'), 'Secret-vault provider secret seal must bind and enable the running model/search provider runtimes instead of only saving vault records.');
assert(secretVaultSource.includes('SECRET_VAULT_RECORDS_FILE') && secretVaultSource.includes('readRecordFile') && secretVaultSource.includes('writeRecordFile') && secretVaultSource.includes('exportRecords()'), 'Secret-vault provider key seal must persist encrypted records and expose restart-safe encrypted record export without returning plaintext.');
assert(appSource.includes('refreshAgentWriteReadModels') && appSource.includes('readinessProofMapResult') && appSource.includes('transcriptIndexResult') && appSource.includes('mainTranscriptResult') && appSource.includes('timelineResult') && appSource.includes('eventsResult'), 'Agent/Reviewer write refresh must pull backend Proof Map, transcript, timeline, and event read models directly from lightweight receipt routes.');
assert(appSource.includes("await runBackendProjectCommand('meeting'") && appSource.includes('Backend meeting close failed; local fallback disabled for backend-online project') && appSource.includes('meeting_close_'), 'Project meeting close must write through the backend meeting command before using local fallback.');
assert(serviceSource.includes('runRoundtableExchange') && serviceSource.includes("schemaVersion: 'meeting-agent-turn/v1'") && serviceSource.includes('meetingAgentTurns') && serviceSource.includes("source: 'war-room-meeting-agent-turn'") && serviceSource.includes("eventType: 'meeting-agent-turn'") && serviceSource.includes('timelineLogIds: uniqueStrings([meetingAgentLogs[index]?.id])'), 'Backend meeting command must persist Agent-authored meeting turns as transcript, timeline, and event-ledger collaboration proof.');
assert(apiSource.includes('meetingAgentTurns: result.meetingAgentTurns || []') && appSource.includes('playBackendMeetingTurns') && appSource.includes('backendResult?.meetingAgentTurns') && appSource.includes('backendTurnEvents.length') && appSource.includes('blockMissingBackendMeetingTurns') && appSource.includes('Backend meeting returned no Agent turns; local simulation blocked') && !appSource.includes('if (!renderedBackendTurns) runRoomSimulation(text, nextProject);'), 'Manager War Room UI must consume backend-authored meeting turns and fail closed instead of presenting frontend-only meeting simulation for backend projects.');
assert(appSource.includes('const startMeeting = async') && appSource.includes('BACKEND WAR ROOM SESSION OPENED') && appSource.includes('Backend meeting start failed; local fallback disabled for backend-online project'), 'Legacy War Room session start must be backend-first for real projects before local meeting simulation can run.');
assert(serviceSource.includes('createProjectTranscriptChannel') && serviceSource.includes("schemaVersion: 'transcript-channel-created/v1'") && serviceSource.includes('transcriptChannelReceipts') && serviceSource.includes('transcriptChannelRoutes'), 'Project service must create backend transcript channels with receipt, timeline, event, and Readiness Proof Map route proof.');
assert(apiSource.includes("method === 'POST' && route.action === 'transcripts'") && apiSource.includes('transcriptChannelReceipt') && apiSource.includes('transcriptChannelRoute'), 'Project API must expose backend transcript channel creation through the transcripts route.');
assert(appSource.includes('mergeTranscriptChannelsIntoUi') && appSource.includes("await runBackendProjectCommand('transcripts'") && appSource.includes('Backend transcript channel created') && appSource.includes('project-chat-create-transcript-channel') && !appSource.includes('project-chat-create-local-channel') && appSource.includes('backend-channel-create-required') && appSource.includes('proof-map-transcript-channel-routes'), 'Project chat must create backend transcript channels for real projects and render their Proof Map routes while keeping local-only channel creation disabled when no backend contract is available.');
assert(appSource.includes('/project-settings') && appSource.includes('updateProjectLanguageSetting') && appSource.includes('Backend project language failed; local fallback disabled for backend-online project') && appSource.includes("Object.prototype.hasOwnProperty.call(body, 'language')"), 'Project language settings must save through the backend settings contract without forcing inherited language into a browser-only mutation.');
assert([
  'backend-manager-dashboard-source',
  'backend-manager-command-center-source',
  'backend-manager-scenario-walkthrough-source',
  'backend-manager-scenario-trail-source',
  'backend-manager-requirement-matrix-source',
  'backend-sync-protocol-audit-source',
  'backend-manager-use-case-audit-source',
  'backend-manager-action-queue-source',
  'backend-autonomous-run-control-source',
  'backend-agent-autonomous-action-queue-source',
].every((testId) => appSource.includes(testId)), 'Manager UI must label C/A orchestration and autonomous scheduling read-model sources.');
assert(appSource.includes('backend-brainstorm-layer-snapshot'), 'Manager Ready Package UI must expose the brainstorm layer.');
assert(appSource.includes('/brainstorm-layer') && appSource.includes('Brainstorm Layer') && appSource.includes('Brainstorm route'), 'Manager UI must expose the brainstorm layer route and status.');
assert(appSource.includes('backend-artifact-quality-audit-snapshot'), 'Manager Ready Package UI must expose the artifact quality audit.');
assert(appSource.includes('/artifact-quality-audit') && appSource.includes('Artifact Quality Audit') && appSource.includes('Artifact Ready'), 'Manager UI must expose the artifact quality audit route, status, and readiness.');
assert(appSource.includes('backend-submission-review-workflow-snapshot'), 'Manager Ready Package UI must expose the submission review workflow.');
assert(appSource.includes('/submission-review-workflow') && appSource.includes('Submission Review Workflow') && appSource.includes('Review workflow route'), 'Manager UI must expose the submission review workflow route, rounds, and closure status.');
assert(appSource.includes('backend-product-team-delivery-trace-snapshot'), 'Manager Ready Package UI must expose the product-team delivery trace.');
assert(appSource.includes('/product-team-delivery-trace') && appSource.includes('Product Team Delivery Trace') && appSource.includes('Trace route') && appSource.includes('missingProductTeamDeliveryTrace') && appSource.includes('fetch-product-team-delivery-trace'), 'Manager UI must expose the product-team delivery trace route, rows, closure status, and backend-required missing state.');
assert(appSource.includes('proof-map-product-team-acceptance-chain') && appSource.includes('Generic Product-Team Acceptance Chain') && appSource.includes('Chain chat proof') && appSource.includes('Chain timeline proof'), 'Manager Proof Map UI must expose the generic product-team acceptance chain with chat and timeline proof exits.');
assert(appSource.includes('backend-product-team-operating-loop-snapshot'), 'Manager Ready Package UI must expose the product-team operating loop.');
assert(appSource.includes('/product-team-operating-loop') && appSource.includes('Product Team Operating Loop') && appSource.includes('Operating loop route') && appSource.includes('missingProductTeamOperatingLoop') && appSource.includes('fetch-product-team-operating-loop') && appSource.includes('Handoff Exec') && appSource.includes('Handoff Outputs'), 'Manager UI must expose the product-team operating loop route, C/A status, handoff execution output, and backend-required missing state.');
assert(appSource.includes('/product-team-missions') && appSource.includes('Product Team Mission Runner approved kickoff and started backend autonomy'), 'Manager UI initiation approval must start real projects through the Product Team Mission Runner instead of only the older kickoff/initiate path.');
assert(appSource.includes('const submitInitiationMeetingInput = async') && appSource.includes('Kickoff meeting input saved through backend clarification') && appSource.includes('No local mock meeting response was saved.') && !appSource.includes('runRoomSimulation(text, meetingProject);'), 'Initiation Roundtable free input must be recorded through the backend kickoff meeting session instead of local mock meeting simulation.');
assert(appSource.includes('backend-product-team-mission-runs-snapshot') && appSource.includes('backend-product-team-mission-runs-route') && appSource.includes('Product Team Mission Runner') && appSource.includes('Reused Kickoff'), 'Manager Dashboard UI must expose Product Team Mission Runner receipts, reused-kickoff status, and proof routes after real project approval.');
assert(appSource.includes('C/A Handoff') && appSource.includes('Handoff Tick') && appSource.includes('Handoff Stage'), 'Manager Dashboard UI must expose the Product Team Mission Runner customer-to-Agent handoff status.');
assert(appSource.includes('manager-action-run-output') && appSource.includes('Manager Action Output Nodes') && appSource.includes('manager-action-output-${row.id}') && appSource.includes('manager-action-output-chat-proof'), 'Manager UI must expose Manager Action Queue run outputs as backend result nodes, not just ledger receipts.');
assert(apiSource.includes('schedulerTick: result.schedulerTick') && apiSource.includes('workSubmission: result.workSubmission || result.submission') && apiSource.includes('reviewResponseArtifact: result.reviewResponseArtifact'), 'Manager Action Queue API write responses must return delegated scheduler and Agent output objects.');
assert(appSource.includes('backendProjectSeedInFlightRef') && appSource.includes('lastProjectSyncProjectId') && appSource.includes('local snapshot reseeding is suppressed'), 'Manager UI must coalesce sample backend seeding and suppress stale browser snapshot reseeding after a backend project sync.');
assert(managerBackendCoreUiSource.includes('managerDemoProjectPutCount') && managerBackendCoreUiSource.includes('Manager Demo compatibility seed may write the sample snapshot at most once.') && managerBackendCoreUiSource.includes('must not reseed the browser snapshot after backend proof is written.'), 'Manager backend core UI Harness must reject duplicate browser snapshot seeding after backend proof is written.');
assert(appSource.includes('Mission Handoff'), 'Manager UI must expose Mission Runner handoff intent counts in Collaboration Intent Queue.');
assert(appSource.includes('Intent Runs') && appSource.includes('collaboration-intent-run-') && appSource.includes('backend-collaboration-intent-run-receipt') && appSource.includes('Run intent'), 'Manager UI must expose a real Collaboration Intent Queue run control and receipt, not just read-only queue rows.');
assert(appSource.includes('backend-collaboration-intent-run-output') && appSource.includes('backend-collaboration-intent-run-output-rows') && appSource.includes('Intent Output Nodes') && appSource.includes("'work-submission'") && appSource.includes("'evidence-search'") && appSource.includes("'submission-review'"), 'Manager UI must expose delegated Collaboration Intent Queue outputs as backend product nodes, not just a run receipt.');
assert(apiSource.includes('evidenceSearch: result.evidenceSearch') && apiSource.includes('reviewResponseSubmission: result.reviewResponseSubmission') && apiSource.includes('workSubmissionLog: result.workSubmissionLog'), 'Collaboration Intent Queue API write responses must return delegated Agent submission, evidence, and review-response outputs.');
assert(appSource.includes('backend-autonomous-run-control-run-output') && appSource.includes('Run Control Output Nodes') && appSource.includes('backend-autonomous-run-control-output-${row.id}') && appSource.includes('autonomous-run-control-output-chat-proof'), 'Manager UI must expose direct Autonomous Run Control outputs as backend product nodes, not just a run receipt.');
assert(appSource.includes('renderAutonomousActionDecision') && appSource.includes('backend-run-control-action-decision') && appSource.includes('backend-agent-autonomous-action-decision') && appSource.includes('backend-collaboration-intent-action-decision') && appSource.includes('manager-flow-autonomous-action-decision-'), 'Manager UI must render backend autonomous action decisions on Run Control, Agent Queue, Collaboration Intent, and Flow Graph surfaces.');
assert(apiSource.includes('artifact: result.artifact') && apiSource.includes('reviewedSubmission: result.reviewedSubmission') && apiSource.includes('reviewResponseArtifact: result.reviewResponseArtifact'), 'Autonomous Run Control API write responses must return delegated artifact, reviewed-submission, and review-response artifact outputs.');
assert(appSource.includes('backend-agent-autonomous-action-run-output') && appSource.includes('Agent Action Output Nodes') && appSource.includes('backend-agent-autonomous-action-output-${row.id}') && appSource.includes('agent-autonomous-action-output-chat-proof'), 'Manager UI must expose direct Agent Autonomous Action Queue outputs as backend product nodes, not just an action receipt.');
assert(appSource.includes('backend-product-team-mission-chat-proof') && appSource.includes('backend-product-team-mission-timeline-proof') && appSource.includes('backend-product-team-mission-flow-node') && appSource.includes('openManagerFlowNode(backendProductTeamMissionFlowNodeId'), 'Manager Dashboard Mission Runner receipt must provide chat, timeline, and Flow Graph proof exits.');
assert(appSource.includes('refreshProjectInitiationReadModels') && appSource.includes('productTeamMissionRunsResult') && appSource.includes('productTeamOperatingLoopResult') && appSource.includes('autonomousRunControlResult') && appSource.includes('runtimeAutonomyStatusResult'), 'Project initiation refresh must pull Mission Runner, Operating Loop, Run Control, and Runtime Autonomy Status read models directly after approval.');
assert(appSource.includes('backend-team-collaboration-diagnostics-snapshot'), 'Manager Ready Package UI must expose team collaboration diagnostics.');
assert(appSource.includes('/team-collaboration-diagnostics') && appSource.includes('Team Collaboration Diagnostics') && appSource.includes('Collaboration diagnostics route') && appSource.includes('missingTeamCollaborationDiagnostics'), 'Manager UI must expose the collaboration diagnostics route, handoff status, and backend-required missing state.');
assert(appSource.includes('backend-runtime-contracts-snapshot'), 'Manager Ready Package UI must expose runtime contracts.');
assert(appSource.includes('/runtime-contracts') && appSource.includes('Runtime Contracts') && appSource.includes('Runtime contracts route') && appSource.includes('missingRuntimeContracts'), 'Manager UI must expose the runtime contracts route, freeze status, and backend-required missing state.');
assert(appSource.includes('backend-autonomous-cycle-consistency-snapshot'), 'Manager Ready Package UI must expose autonomous cycle consistency.');
assert(appSource.includes('/autonomous-cycle-consistency') && appSource.includes('Autonomous Cycle Consistency') && appSource.includes('Cycle consistency route') && appSource.includes('missingAutonomousCycleConsistency'), 'Manager UI must expose the autonomous cycle consistency route, N-step status, and backend-required missing state.');
assert(appSource.includes('backend-runtime-autonomy-status-snapshot'), 'Manager Ready Package UI must expose Runtime Autonomy Status.');
assert(appSource.includes('/runtime-autonomy-status') && appSource.includes('Runtime Autonomy Status') && appSource.includes('Runtime autonomy route') && appSource.includes('missingRuntimeAutonomyStatus'), 'Manager UI must expose the Runtime Autonomy Status route, C/A recovery status, and backend-required missing state.');
assert(appSource.includes('backend-runtime-autonomy-status-chat-proof') && appSource.includes('backend-runtime-autonomy-status-timeline-proof') && appSource.includes('backend-runtime-autonomy-status-flow-node'), 'Manager UI Runtime Autonomy Status panel must expose chat, timeline, and Flow Graph proof exits.');
assert(appSource.includes('backend-evidence-quality-audit-snapshot'), 'Manager Ready Package UI must expose the evidence quality audit.');
assert(appSource.includes('/evidence-quality-audit') && appSource.includes('Evidence Quality Audit') && appSource.includes('Decision Gates'), 'Manager UI must expose the evidence quality audit route, status, and gates.');
assert(appSource.includes('backend-evidence-source-review-workflow-snapshot'), 'Manager Ready Package UI must expose the evidence source review workflow.');
assert(appSource.includes('/evidence-source-review-workflow') && appSource.includes('Evidence Source Review Workflow') && appSource.includes('Source review route'), 'Manager UI must expose the source review workflow route, status, and proof route.');
assert(appSource.includes('Source Decisions') && appSource.includes('Source Pending') && appSource.includes('Decision Required'), 'Manager UI must expose evidence source review decision counts.');
assert(appSource.includes('Source Snapshots') && appSource.includes('Provider Receipts') && appSource.includes('Source Audit'), 'Manager UI must expose source snapshot and provider receipt coverage.');
assert(appSource.includes('Evidence Custody') && appSource.includes('Custody Storage') && appSource.includes('Evidence Custody Readiness'), 'Manager UI must expose evidence custody readiness and managed-storage blocker coverage.');
assert(appSource.includes('backend-manager-submission-reviews-snapshot'), 'Manager Dashboard UI must expose submission reviews.');
assert(appSource.includes('backend-mvp-readiness-snapshot'), 'Manager Ready Package UI must expose MVP readiness.');
assert(appSource.includes('/mvp-readiness'), 'Manager UI must expose the MVP readiness route.');
assert(appSource.includes('mvp-readiness-operator-actions'), 'Manager UI must expose MVP readiness operator actions.');
assert(appSource.includes('runMvpReadinessOperatorAction'), 'Manager UI must run MVP readiness operator actions through the backend.');
assert(appSource.includes('mvp-readiness-operator-action-receipt'), 'Manager UI must display MVP readiness operator action receipts.');
assert(appSource.includes('mvp-readiness-operator-action-receipt') && appSource.includes('targetStageId'), 'Manager UI must expose whether MVP readiness receipts have an autonomous target stage.');
assert(appSource.includes('backend-pilot-launch-readiness-snapshot'), 'Manager Ready Package UI must expose pilot launch readiness.');
assert(appSource.includes('/pilot-launch-readiness') && appSource.includes('Pilot Launch') && appSource.includes('Private Pilot'), 'Manager UI must expose the pilot launch readiness route and decision.');
assert(appSource.includes('backend-deployment-preflight-snapshot'), 'Manager Ready Package UI must expose deployment preflight readiness.');
assert(appSource.includes('/deployment-preflight') && appSource.includes('Deployment Preflight') && appSource.includes('Preflight Warnings'), 'Manager UI must expose the deployment preflight route and warning count.');
assert(appSource.includes('/adapter-gateway-preflight') && appSource.includes('Gateway Live') && appSource.includes('Gateway State'), 'Manager UI must expose the adapter gateway preflight route and live/state status.');
assert(appSource.includes('backend-production-infrastructure-rehearsal-snapshot'), 'Manager Ready Package UI must expose production infrastructure rehearsal.');
assert(appSource.includes('/production-infrastructure-rehearsal') && appSource.includes('Production Infrastructure Rehearsal') && appSource.includes('Infrastructure rehearsal route'), 'Manager UI must expose the production infrastructure rehearsal route, status, and domain summary.');
assert(appSource.includes('backend-production-infrastructure-rehearsal-source'), 'Manager UI must label whether production infrastructure rehearsal is backend-backed, backend-required, or demo fallback.');
assert(appSource.includes('Managed Cutover') && appSource.includes('Next Cutover') && appSource.includes('backend-production-infrastructure-cutover-gate-'), 'Manager UI must expose backend managed cutover gates from production infrastructure rehearsal.');
assert(appSource.includes('backend-production-launch-audit-snapshot'), 'Manager Ready Package UI must expose production launch audit readiness.');
assert(appSource.includes('/production-launch-audit') && appSource.includes('Production Launch Audit') && appSource.includes('Private Pilot Audit') && appSource.includes('Handoff Package'), 'Manager UI must expose the production launch audit route, decisions, and handoff package status.');
assert(appSource.includes('backend-project-evidence-archive-snapshot'), 'Manager Ready Package UI must expose the project evidence archive.');
assert(appSource.includes('/project-evidence-archive') && appSource.includes('Project Evidence Archive') && appSource.includes('Archive route'), 'Manager UI must expose the project evidence archive route and status.');
assert(appSource.includes('backend-project-evidence-archive-source'), 'Manager UI must label whether the project evidence archive is backend-backed, backend-required, or demo fallback.');
assert(appSource.includes('backend-project-evidence-export-workflow-snapshot'), 'Manager Ready Package UI must expose the project evidence export workflow.');
assert(appSource.includes('/project-evidence-exports') && appSource.includes('Project Evidence Export Workflow') && appSource.includes('Export route') && appSource.includes('Package Gates'), 'Manager UI must expose the project evidence export workflow route, package gates, and status.');
assert(appSource.includes('backend-private-pilot-go-live-readiness-snapshot'), 'Manager Ready Package UI must expose private-pilot go-live readiness.');
assert(appSource.includes('/private-pilot-go-live-readiness') && appSource.includes('Private Pilot Go-Live Readiness') && appSource.includes('Go-live route'), 'Manager UI must expose the private-pilot go-live readiness route, phase, and next action.');
assert(appSource.includes('backend-project-evidence-export-workflow-source') && appSource.includes('backend-private-pilot-go-live-readiness-source'), 'Manager UI must label private-pilot handoff and go-live read-model sources.');
assert(appSource.includes('backend-production-launch-gap-register-snapshot'), 'Manager Ready Package UI must expose the production launch gap register.');
assert(appSource.includes('/production-launch-gap-register') && appSource.includes('Production Launch Gap Register') && appSource.includes('Gap register route'), 'Manager UI must expose the production launch gap register route and next action.');
assert(appSource.includes('backend-production-launch-gap-register-source') && appSource.includes("dataSource: 'frontend-fallback'"), 'Manager UI must label production launch gap register source and mark derived fallback rows as frontend fallback.');
assert(appSource.includes('backend-production-launch-control-center-snapshot'), 'Manager Ready Package UI must expose the production launch control center.');
assert(appSource.includes('/production-launch-control-center') && appSource.includes('Production Launch Control Center') && appSource.includes('Control center route'), 'Manager UI must expose the production launch control center route and no-go decision.');
assert(appSource.includes('backend-production-launch-control-center-source'), 'Manager UI must label production launch control center source.');
assert(appSource.includes('managed-production-evidence-integrity') && appSource.includes('Managed production evidence integrity'), 'Manager UI must include managed-production evidence integrity as a production launch control row.');
assert(appSource.includes('backend-production-launch-evidence-dossier-snapshot'), 'Manager Ready Package UI must expose the production launch evidence dossier.');
assert(appSource.includes('/production-launch-evidence-dossier') && appSource.includes('Production Launch Evidence Dossier') && appSource.includes('Dossier route'), 'Manager UI must expose the production launch evidence dossier route, manifest, and no-go decision.');
assert(appSource.includes('backend-production-launch-evidence-dossier-source'), 'Manager UI must label production launch evidence dossier source.');
assert(appSource.includes('backend-production-evidence-integrity-audit-snapshot'), 'Manager Ready Package UI must expose production evidence integrity audit.');
assert(appSource.includes('/production-evidence-integrity-audit') && appSource.includes('Production Evidence Integrity Audit') && appSource.includes('Evidence integrity route'), 'Manager UI must expose the production evidence integrity audit route, managed proof counts, and no-go status.');
assert(appSource.includes('backend-private-pilot-release-candidate-workflow-snapshot'), 'Manager Ready Package UI must expose private-pilot release candidate readiness.');
assert(appSource.includes('/private-pilot-release-candidates') && appSource.includes('Private Pilot Release Candidate') && appSource.includes('Candidate route'), 'Manager UI must expose the private-pilot release candidate route, gates, and status.');
assert(appSource.includes('backend-private-pilot-launch-run-workflow-snapshot'), 'Manager Ready Package UI must expose private-pilot launch run readiness.');
assert(appSource.includes('/private-pilot-launch-runs') && appSource.includes('Private Pilot Launch Run') && appSource.includes('Launch run route'), 'Manager UI must expose the private-pilot launch run route, gates, and status.');
assert(appSource.includes('backend-private-pilot-launch-health-check-workflow-snapshot'), 'Manager Ready Package UI must expose private-pilot post-launch health readiness.');
assert(appSource.includes('/private-pilot-launch-health-checks') && appSource.includes('Private Pilot Launch Health') && appSource.includes('Health route'), 'Manager UI must expose the private-pilot launch health route, gates, and status.');
assert(appSource.includes('backend-private-pilot-acceptance-report-workflow-snapshot'), 'Manager Ready Package UI must expose private-pilot acceptance report readiness.');
assert(appSource.includes('/private-pilot-acceptance-reports') && appSource.includes('Private Pilot Acceptance Report') && appSource.includes('Acceptance route'), 'Manager UI must expose the private-pilot acceptance report route, gates, and status.');
assert([
  'backend-private-pilot-release-candidate-workflow-source',
  'backend-private-pilot-launch-run-workflow-source',
  'backend-private-pilot-launch-health-check-workflow-source',
  'backend-private-pilot-acceptance-report-workflow-source',
].every((testId) => appSource.includes(testId)), 'Manager UI must label private-pilot receipt workflow read-model sources.');
assert(appSource.includes('backend-production-operations-readiness-snapshot'), 'Manager Ready Package UI must expose production operations readiness.');
assert(appSource.includes('/production-operations-readiness') && appSource.includes('Production Operations Readiness') && appSource.includes('Production ops route'), 'Manager UI must expose the production operations route, gates, and status.');
assert(appSource.includes('backend-production-operations-control-receipts-snapshot'), 'Manager Ready Package UI must expose production operations control receipts.');
assert(appSource.includes('/production-operations-control-receipts') && appSource.includes('Production Operations Control Receipts') && appSource.includes('Ops receipts route'), 'Manager UI must expose the production operations control receipt route, gates, and status.');
assert(appSource.includes('backend-production-deployment-control-receipts-snapshot'), 'Manager Ready Package UI must expose production deployment control receipts.');
assert(appSource.includes('/production-deployment-control-receipts') && appSource.includes('Production Deployment Control Receipts') && appSource.includes('Deployment receipts route'), 'Manager UI must expose the production deployment control receipt route, controls, and status.');
assert(appSource.includes('backend-production-security-control-receipts-snapshot'), 'Manager Ready Package UI must expose production security control receipts.');
assert(appSource.includes('/production-security-control-receipts') && appSource.includes('Production Security Control Receipts') && appSource.includes('Security receipts route'), 'Manager UI must expose the production security control receipt route, controls, and status.');
assert(appSource.includes('backend-production-provider-control-receipts-snapshot'), 'Manager Ready Package UI must expose production provider control receipts.');
assert(appSource.includes('/production-provider-control-receipts') && appSource.includes('Production Provider Control Receipts') && appSource.includes('Provider receipts route'), 'Manager UI must expose the production provider control receipt route, controls, and status.');
assert(appSource.includes('runBackendProductionControlReceipt') && appSource.includes('manager-ui-production-control-receipt') && appSource.includes("evidenceEnvironment: 'local-rehearsal'"), 'Manager UI production control receipt commands must stay backend-backed rehearsal receipts instead of production certification.');
assert(appSource.includes('refreshReceiptReadModels') && appSource.includes('readRoutes.productionInfrastructureRehearsalRoute') && appSource.includes('readRoutes.productionOperationsReadinessRoute') && appSource.includes('readRoutes.productionLaunchControlCenterRoute') && appSource.includes('readRoutes.productionEvidenceIntegrityAuditRoute'), 'Manager UI receipt commands must consume lightweight backend receipt routes for production infrastructure, operations, launch-control, and evidence-integrity refresh instead of relying only on full Ready Package sync.');
assert(apiSource.includes('productionControlReceiptReadModels') && apiSource.includes('productionInfrastructureRehearsalRoute') && apiSource.includes('productionOperationsReadinessRoute') && apiSource.includes('deploymentPreflightRoute') && apiSource.includes('adapterGatewayPreflightRoute'), 'Production control lightweight receipts must expose production infrastructure rehearsal, operations, deployment, and adapter gateway refresh routes.');
assert(apiSource.includes('privatePilotReceiptReadModels') && apiSource.includes('productionInfrastructureRehearsalRoute') && apiSource.includes('productionOperationsReadinessRoute'), 'Private-pilot lightweight receipts must expose the P1-to-P2 infrastructure and operations refresh routes.');
for (const testId of ['backend-production-operations-record-controls', 'backend-production-deployment-record-controls', 'backend-production-security-record-controls', 'backend-production-provider-record-controls']) {
  assert(appSource.includes(testId), `Manager UI must expose ${testId} as a backend production-control rehearsal command.`);
}
assert(appSource.includes('backend-launch-approval-workflow-snapshot'), 'Manager Ready Package UI must expose launch approval workflow readiness.');
assert(appSource.includes('/launch-approvals') && appSource.includes('Launch Approval Workflow') && appSource.includes('Pilot Approval'), 'Manager UI must expose the launch approval workflow route and pilot approval status.');
assert(appSource.includes('backend-provider-readiness-snapshot'), 'Manager Ready Package UI must expose provider readiness.');
assert(appSource.includes('/provider-readiness'), 'Manager UI must expose the provider readiness route.');
assert(appSource.includes('backend-provider-controlled-run-snapshot'), 'Manager Ready Package UI must expose the provider controlled run plan.');
assert(appSource.includes('/provider-controlled-run') && appSource.includes('Provider Controlled Run') && appSource.includes('Run Ready'), 'Manager UI must expose the provider controlled run route, status, and readiness.');
assert(appSource.includes('backend-provider-eval-run-workflow-snapshot'), 'Manager Ready Package UI must expose provider eval run workflow.');
assert(appSource.includes('/provider-eval-runs') && appSource.includes('Provider Eval Runs') && appSource.includes('Eval Ready'), 'Manager UI must expose the provider eval run route, status, and readiness.');
assert(appSource.includes('backend-provider-eval-record-shadow-replay') && appSource.includes('manager-ui-provider-eval-receipt') && appSource.includes("workflowKey: 'providerEvalRunWorkflow'") && appSource.includes("receiptKey: 'providerEvalRun'"), 'Manager UI must expose a backend receipt command for provider eval shadow replay instead of requiring Harness-only setup.');
assert(appSource.includes('refreshAutonomousRunControlReadModels') && appSource.includes('readRoutes.autonomousRunControlSessionsRoute') && appSource.includes('readRoutes.productTeamOperatingLoopRoute') && appSource.includes('readRoutes.autonomousCycleConsistencyRoute'), 'Manager UI must consume Autonomous Run Control receipt refresh routes instead of inferring Autopilot session state from browser-local data.');
assert(appSource.includes('Failure Control') && appSource.includes('Open Circuits') && appSource.includes('Retry Attempts'), 'Manager Ready Package UI must expose provider failure-control readiness.');
assert(appSource.includes('Model Drafts') && appSource.includes('Draft Quality') && appSource.includes('Human Review'), 'Manager Ready Package UI must expose model draft quality and human-review readiness.');
assert(appSource.includes('backend-operations-readiness-snapshot'), 'Manager Ready Package UI must expose operations readiness.');
assert(appSource.includes('Persistence Adapter') && appSource.includes('DB Adapter Dry Run'), 'Manager Ready Package UI must expose managed persistence adapter readiness.');
assert(appSource.includes('Queue Adapter') && appSource.includes('Adapter Dry Run'), 'Manager Ready Package UI must expose queue adapter readiness.');
assert(appSource.includes('Queue Parity') && appSource.includes('Snapshot Parity') && appSource.includes('Lease Parity'), 'Manager Ready Package UI must expose queue adapter parity readiness.');
assert(appSource.includes('Worker Recovery') && appSource.includes('Dead Letters') && appSource.includes('Receipts'), 'Manager Ready Package UI must expose worker recovery readiness.');
assert(appSource.includes('Incident Drill') && appSource.includes('Drill Receipts') && appSource.includes('Drill Alerts'), 'Manager Ready Package UI must expose operations incident drill readiness.');
assert(appSource.includes('backend-security-boundary-snapshot'), 'Manager Ready Package UI must expose security boundary status.');
assert(appSource.includes('Audit Stream'), 'Manager Ready Package UI must expose backend security audit stream status.');
assert(appSource.includes('Secret Vault') && appSource.includes('Vault Records') && appSource.includes('Vault Rotation'), 'Manager Ready Package UI must expose secret-vault readiness and rotation.');
assert(appSource.includes('Identity Sessions') && appSource.includes('/identity-sessions'), 'Manager Ready Package UI must expose identity-session readiness and route.');
assert(appSource.includes('/security-boundary'), 'Manager UI must expose the security boundary route.');
assert([
  'backend-launch-approval-workflow-source',
  'backend-operations-readiness-source',
  'backend-provider-readiness-source',
  'backend-provider-controlled-run-source',
  'backend-provider-eval-run-workflow-source',
  'backend-security-boundary-source',
].every((testId) => appSource.includes(testId)), 'Manager UI must label launch approval, operations, provider, and security read-model sources.');
assert(appSource.includes('agent-focus-evidence-searches-'), 'Agent Dashboard UI must expose owned evidence searches.');
assert(appSource.includes('agent-focus-submission-reviews-'), 'Agent Dashboard UI must expose owned submission reviews.');
assert(
  [
    'Real project brainstorm board',
    'Real project evidence route validation',
    'agent-workbench-draft-submit-turing',
    'submission-review-composer-',
    'agent-workbench-review-turing',
    'agent-workbench-revises-submission-turing',
    'change-requests-closed-by-revision',
    'final-deliverable-accepted',
    'brainstormLayerRoutes',
    'evidenceSearchRoutes',
    'submission-review-workflow',
    'productTeamAcceptanceChainRoutes',
  ].every((marker) => managerBackendUiSource.includes(marker)),
  'Manager backend UI Harness must cover the same real-project product-team browser chain: brainstorm, evidence, generated draft, review, revision, final delivery, and accepted closure.'
);

const ACCEPTANCE_RUN_ID = (process.env.HOFS_PRODUCT_TEAM_RUN_ID || `${ACCEPTANCE_STAGE}-${process.pid}`)
  .replace(/[^a-zA-Z0-9_.-]/g, '-');
const rootBase = fileURLToPath(new URL('../.tmp/product-team-acceptance', import.meta.url));
const root = fileURLToPath(new URL(`../.tmp/product-team-acceptance/${ACCEPTANCE_RUN_ID}/`, import.meta.url));
const normalizeHarnessPath = (value) => value.replaceAll('\\', '/').replace(/\/+$/g, '');
const rootBaseNormalized = normalizeHarnessPath(rootBase);
const rootNormalized = normalizeHarnessPath(root);
assert(
  rootBaseNormalized.endsWith('/.tmp/product-team-acceptance')
    && rootNormalized.startsWith(`${rootBaseNormalized}/`)
    && rootNormalized.endsWith(`/${ACCEPTANCE_RUN_ID}`),
  'Acceptance harness cleanup must stay inside the product-team temp run directory.',
);
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const preserveAcceptanceTmp = process.env.HOFS_PRODUCT_TEAM_PRESERVE_TMP === '1'
  || process.env.HOFS_KEEP_PRODUCT_TEAM_TMP === '1';
process.on('exit', () => {
  if (preserveAcceptanceTmp) return;
  rmSync(root, { recursive: true, force: true });
});

const projectRuntime = createLocalProjectRuntime({
  rootPath: `${root}/runtime`,
  enableCommandExecution: false,
});
const secretVault = createLocalSecretVault({
  enabled: true,
  masterKey: FAKE_VAULT_MASTER_KEY,
  keyId: 'acceptance-local-v1',
  keySource: 'acceptance-harness',
});
const sealedSearchSecret = await secretVault.seal('search.apiKey', FAKE_SEARCH_SECRET, { scope: 'search-provider' });
const sealedModelSecret = await secretVault.seal('model.apiKey', FAKE_MODEL_SECRET, { scope: 'model-provider' });
const searchApiKey = await secretVault.open(sealedSearchSecret);
const modelApiKey = await secretVault.open(sealedModelSecret);
const vaultRotation = await secretVault.rotate({
  nextMasterKey: FAKE_VAULT_ROTATED_MASTER_KEY,
  nextKeyId: 'acceptance-local-v2',
  metadata: {
    reason: 'product-team-acceptance-rotation-rehearsal',
    keySource: 'acceptance-rotation-harness',
  },
  now: '2026-06-01T10:05:00.000Z',
});
const rotatedSearchRecord = vaultRotation.records.find((record) => record.name === 'search.apiKey');
const rotatedModelRecord = vaultRotation.records.find((record) => record.name === 'model.apiKey');
const rotatedSearchApiKey = await secretVault.open(rotatedSearchRecord);
const rotatedModelApiKey = await secretVault.open(rotatedModelRecord);
const secretVaultStatus = secretVault.status();
assert(searchApiKey === FAKE_SEARCH_SECRET && modelApiKey === FAKE_MODEL_SECRET, 'Local secret vault must seal and open provider secrets.');
assert(rotatedSearchApiKey === FAKE_SEARCH_SECRET && rotatedModelApiKey === FAKE_MODEL_SECRET, 'Local secret vault rotation must preserve provider secret readability through the new key.');
assert(vaultRotation.receipt?.schemaVersion === 'secret-vault-rotation-receipt/v1' && vaultRotation.receipt.rotatedRecordCount === 2, 'Local secret vault rotation must return a rotation receipt.');
assert(secretVaultStatus.ready && secretVaultStatus.encryptedRecordCount === 2 && secretVaultStatus.rawSecretRecordCount === 0, 'Local secret vault status must prove encrypted records without raw secret rows.');
assert(secretVaultStatus.rotationSupported === true && secretVaultStatus.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1', 'Local secret vault status must expose rotation support and the latest rotation receipt.');
assert(secretVaultStatus.keyId === 'acceptance-local-v2', 'Local secret vault status must expose the rotated key id.');
const routeSecretVault = createLocalSecretVault({
  enabled: true,
  masterKey: 'route-vault-master-v1',
  keyId: 'route-local-v1',
  keySource: 'acceptance-route-harness',
});
const routeVaultApi = createFileBackedAgentProjectApi({
  filePath: `${root}/secret-vault-route-store.json`,
  replaceWithSeed: true,
  secretVault: routeSecretVault,
});
let vaultRouteResponse = routeVaultApi.handle({ method: 'GET', path: '/secret-vault/status' });
assert(vaultRouteResponse.status === 200 && vaultRouteResponse.body.secretVaultStatus?.schemaVersion === 'secret-vault-status/v1', 'Secret-vault status route must return the redacted status contract.');
vaultRouteResponse = await routeVaultApi.handleAsync({
  method: 'POST',
  path: '/secret-vault/seal',
  body: {
    name: 'search.apiKey',
    value: FAKE_SEARCH_SECRET,
    metadata: { scope: 'search-provider', source: 'acceptance-route-test' },
    now: '2026-06-01T10:06:00.000Z',
  },
});
let serializedVaultRoute = JSON.stringify(vaultRouteResponse.body);
assert(vaultRouteResponse.status === 200 && vaultRouteResponse.body.secretVaultSealReceipt?.schemaVersion === 'secret-vault-seal-receipt/v1', 'Secret-vault seal route must return a seal receipt.');
assert(!serializedVaultRoute.includes(FAKE_SEARCH_SECRET) && !serializedVaultRoute.includes('route-vault-master-v1'), 'Secret-vault seal route must not return plaintext secret or master key material.');
vaultRouteResponse = routeVaultApi.handle({ method: 'GET', path: '/secret-vault/records' });
serializedVaultRoute = JSON.stringify(vaultRouteResponse.body);
assert(vaultRouteResponse.status === 200 && vaultRouteResponse.body.secretVaultRecords?.schemaVersion === 'secret-vault-record-list/v1' && vaultRouteResponse.body.secretVaultRecords.records.length === 1, 'Secret-vault records route must return safe record metadata.');
assert(!serializedVaultRoute.includes('ciphertext') && !serializedVaultRoute.includes(FAKE_SEARCH_SECRET), 'Secret-vault records route must not expose ciphertext or plaintext secrets.');
vaultRouteResponse = await routeVaultApi.handleAsync({
  method: 'POST',
  path: '/secret-vault/rotate',
  body: {
    nextMasterKey: 'route-vault-master-v2',
    nextKeyId: 'route-local-v2',
    metadata: { reason: 'acceptance-route-rotation', keySource: 'acceptance-route-harness' },
    now: '2026-06-01T10:07:00.000Z',
  },
});
serializedVaultRoute = JSON.stringify(vaultRouteResponse.body);
assert(vaultRouteResponse.status === 200 && vaultRouteResponse.body.secretVaultRotationReceipt?.schemaVersion === 'secret-vault-rotation-receipt/v1' && vaultRouteResponse.body.secretVaultRotationReceipt.rotatedRecordCount === 1, 'Secret-vault rotate route must return a rotation receipt.');
assert(vaultRouteResponse.body.secretVaultStatus?.keyId === 'route-local-v2' && vaultRouteResponse.body.secretVaultStatus?.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1', 'Secret-vault rotate route must update redacted status and latest rotation metadata.');
assert(!serializedVaultRoute.includes(FAKE_SEARCH_SECRET) && !serializedVaultRoute.includes('route-vault-master-v2'), 'Secret-vault rotate route must not return plaintext secret or rotated master key material.');
const searchProvider = createSearchProvider({
  provider: 'deterministic',
  enabled: true,
  apiKey: rotatedSearchApiKey,
  apiKeySource: 'local-secret-vault',
  secretVaultStatus,
  endpoint: `https://search.local/query?api_key=${FAKE_SEARCH_SECRET}`,
  maxResults: 3,
});
const modelFetchCalls = [];
const modelProvider = createModelProvider({
  provider: 'openai-compatible',
  enabled: true,
  apiKey: rotatedModelApiKey,
  apiKeySource: 'local-secret-vault',
  secretVaultStatus,
  baseURL: `https://models.local/v1?api_key=${FAKE_MODEL_SECRET}`,
  fetchImpl: async (url, init = {}) => {
    modelFetchCalls.push({
      url: String(url || '').replace(FAKE_MODEL_SECRET, '[REDACTED_MODEL_SECRET]'),
      bodyLength: String(init.body || '').length,
    });
    return new Response(JSON.stringify({
      id: `deterministic-model-${modelFetchCalls.length}`,
      model: 'gpt-4o-mini',
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'Model drafted implementation progress brief',
            summary: 'The model-backed draft connects implementation evidence, prior decisions, and review signals into a manager-visible product-team artifact.',
            body: '# Model drafted implementation progress brief\n\n## Context\nThe product-team workflow has submitted discovery, evidence, decision, risk, implementation, and final-deliverable artifacts.\n\n## Model Draft Output\nThis model-backed progress brief summarizes implementation status, links the evidence search, and prepares the next manager review handoff without becoming a research-only paper section.\n\n## Handoff\nReviewer should compare this model-authored draft with the local fallback draft and keep production rollout blocked until real BYOK controls are approved.',
            tags: ['model-draft', 'artifact-draft', 'product-team'],
          }),
        },
      }],
      usage: {
        prompt_tokens: 180,
        completion_tokens: 90,
        total_tokens: 270,
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  },
});
const providerPolicy = {
  enabled: true,
  mode: 'enforced',
  allowedModelProviders: ['openai-compatible'],
  allowedSearchProviders: ['deterministic'],
  allowedModels: ['gpt-4o-mini'],
  allowedSearchEndpointHosts: ['search.local'],
  maxRequestsPerProjectHour: 20,
  dailyBudgetCents: 500,
  searchCostCentsPerRequest: 1,
  retryAttempts: 2,
  retryBackoffMs: [0, 0],
  circuitFailureThreshold: 3,
  circuitWindowMinutes: 15,
  circuitCooldownSeconds: 60,
  defaultToolGrants: ['provider:test', 'model:kickoff', 'model:intent', 'model:artifact-draft'],
  agentToolGrants: {
    curie: ['search:evidence'],
  },
};
progress('create primary file-backed API');
const api = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  replaceWithSeed: true,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
});
progress('primary file-backed API created');

const missionRunnerApi = createFileBackedAgentProjectApi({
  filePath: `${root}/mission-runner-store.json`,
  replaceWithSeed: true,
  projectRuntime,
});
let missionResponse = missionRunnerApi.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'generic_product_team_mission_runner_receipt',
    meetingId: 'generic_product_team_mission_runner_meeting',
    projectId: 'generic_product_team_mission_runner_project',
    name: 'Generic Product Team Mission Runner Project',
    missionBrief: 'Use a research-style customer goal only as a validation sample for a general AI product team that can kickoff, discuss, search, review, revise, and deliver.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    maxLoops: 2,
    maxStepsPerLoop: 2,
    runInitialTick: true,
    now: '2026-06-01T09:45:00.000Z',
  },
});
assert(
  missionResponse.status === 200 && missionResponse.body.productTeamMissionRun?.schemaVersion === 'product-team-mission-run/v1',
  `Product Team Mission Runner must create a mission-run receipt through one backend API call. status=${missionResponse.status} error=${missionResponse.body?.error || 'none'} message=${missionResponse.body?.message || 'none'}`,
);
assert(missionResponse.body.productTeamMissionRun.researchOnly === false && missionResponse.body.productTeamMissionRun.missionType === 'generic-product-team', 'Product Team Mission Runner must keep Research as a validation sample, not a research-only workflow.');
assert(missionResponse.body.project?.id === 'generic_product_team_mission_runner_project' && missionResponse.body.meeting?.status === 'approved', 'Product Team Mission Runner must approve kickoff into a real backend project.');
assert(missionResponse.body.autonomousRunControlSession?.schemaVersion === 'autonomous-run-control-session/v1' && missionResponse.body.productTeamMissionRun.autonomousSessionId === missionResponse.body.autonomousRunControlSession.id, 'Product Team Mission Runner must start a bounded Autopilot session and link it to the mission receipt.');
assert(missionResponse.body.autonomousRunControlSessionTick?.schemaVersion === 'autonomous-run-control-session-tick/v1' && missionResponse.body.productTeamMissionRun.autonomousSessionTickId === missionResponse.body.autonomousRunControlSessionTick.id, 'Product Team Mission Runner must optionally run the first A-side autonomous tick and link it to the mission receipt.');
assert(missionResponse.body.productTeamMissionRun.customerAgentHandoff?.schemaVersion === 'product-team-customer-agent-handoff/v1' && missionResponse.body.productTeamMissionRun.customerAgentHandoff?.status === 'a-side-first-tick-recorded', 'Product Team Mission Runner must record a C/A handoff receipt when the first A-side tick runs.');
assert(missionResponse.body.productTeamMissionRun.customerAgentHandoff?.selectedLeaderId === 'jobs' && missionResponse.body.productTeamMissionRun.customerAgentHandoff?.reviewerId === 'curie' && missionResponse.body.productTeamMissionRun.customerAgentHandoff?.selectedTeamIds?.length === team.length, 'C/A handoff receipt must preserve the Manager-confirmed Leader, Reviewer, and selected team.');
assert(missionResponse.body.productTeamMissionRun.customerAgentHandoff?.nextRoutes?.autonomousRunControl?.endsWith('/autonomous-run-control') && missionResponse.body.productTeamMissionRun.customerAgentHandoff?.nextRoutes?.collaborationIntentQueue?.endsWith('/collaboration-intent-queue'), 'C/A handoff receipt must expose A-side run-control and intent-queue routes.');
assert(missionResponse.body.productTeamMissionRun.readRoutes?.runtimeAutonomyStatus?.endsWith('/runtime-autonomy-status'), 'Product Team Mission Runner receipt must expose the Runtime Autonomy Status recovery route.');
assert(missionResponse.body.readModels?.included === false && missionResponse.body.readModels?.productTeamMissionRunsRoute?.endsWith('/product-team-missions') && missionResponse.body.readModels?.autonomousRunControlSessionsRoute?.endsWith('/autonomous-run-control/sessions') && missionResponse.body.readModels?.runtimeAutonomyStatusRoute?.endsWith('/runtime-autonomy-status'), 'Product Team Mission Runner must return deferred backend read-model routes instead of embedding only frontend state.');
const missionProjectId = missionResponse.body.project.id;
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/product-team-missions` });
assert(missionResponse.status === 200 && missionResponse.body.productTeamMissionRuns?.some((run) => run.id === 'generic_product_team_mission_runner_receipt'), 'Project API must expose persisted Product Team Mission Runner receipts.');
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/manager-dashboard` });
assert(missionResponse.status === 200 && missionResponse.body.productTeamMissionRuns?.latestRun?.id === 'generic_product_team_mission_runner_receipt' && missionResponse.body.productTeamMissionRuns.latestRun.researchOnly === false, 'Manager Dashboard must expose Product Team Mission Runner receipts as generic product-team work.');
assert(missionResponse.body.productTeamMissionRuns.latestRun.customerAgentHandoff?.readyForLocalAutonomy === true && missionResponse.body.productTeamMissionRuns.firstTickHandoffCount >= 1, 'Manager Dashboard must expose persisted C/A handoff status for Mission Runner receipts.');
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/readiness-proof-map` });
assert(missionResponse.status === 200 && missionResponse.body.productTeamMissionRunRoutes?.some((route) => route.id === 'generic_product_team_mission_runner_receipt' && route.autonomousSessionId), 'Readiness Proof Map must expose the Product Team Mission Runner route and autonomous session linkage.');
assert(missionResponse.body.productTeamMissionRunRoutes?.some((route) => route.id === 'generic_product_team_mission_runner_receipt' && route.customerAgentHandoffReady === true && route.customerAgentHandoffFirstTickRecorded === true && route.customerAgentHandoffChecksum), 'Readiness Proof Map must expose C/A handoff proof for Product Team Mission Runner receipts.');
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/collaboration-intent-queue` });
assert(missionResponse.status === 200 && missionResponse.body.collaborationIntentQueue?.rows?.some((row) => row.source === 'product-team-customer-agent-handoff' && row.id === 'customer-agent-handoff-intent' && row.canRun && row.runApiPath?.endsWith('/autonomous-run-control/run-backend-scheduler-tick/run')), 'Collaboration Intent Queue must turn Product Team Mission Runner C/A handoff into a runnable A-side continuation intent.');
assert(missionResponse.body.collaborationIntentQueue?.summary?.customerAgentHandoffIntentCount >= 1, 'Collaboration Intent Queue summary must count Mission Runner C/A handoff intents.');
assert(missionResponse.body.collaborationIntentQueue?.summary?.customerAgentHandoffExecutionReadyCount >= 1 && missionResponse.body.collaborationIntentQueue.rows.some((row) => row.id === 'customer-agent-handoff-intent' && row.relatedIds?.some((id) => /autonomous_run_control_run_|agent_submission_/i.test(id))), 'Collaboration Intent Queue must link Mission Runner handoff intents to A-side execution receipts or submissions.');
missionResponse = missionRunnerApi.handle({
  method: 'POST',
  path: `/projects/${missionProjectId}/collaboration-intent-queue/customer-agent-handoff-intent/run`,
  body: {
    includeReadModels: false,
    now: '2026-06-01T09:46:30.000Z',
  },
});
assert(missionResponse.status === 200 && missionResponse.body.collaborationIntentRun?.schemaVersion === 'collaboration-intent-run/v1', 'Collaboration Intent Queue must expose a backend run endpoint that records a collaboration-intent-run receipt.');
assert(missionResponse.body.collaborationIntentRun.intentId === 'customer-agent-handoff-intent' && missionResponse.body.collaborationIntentRun.delegatedRunKind === 'autonomous-run-control' && missionResponse.body.collaborationIntentRun.delegatedReceiptId, 'Collaboration intent runs must delegate C/A handoff continuation into Autonomous Run Control and preserve the delegated receipt id.');
assert(missionResponse.body.collaborationIntentQueue?.summary?.collaborationIntentRunCount >= 1 && missionResponse.body.collaborationIntentQueue.rows?.some((row) => row.id === 'customer-agent-handoff-intent' && row.latestRunId === missionResponse.body.collaborationIntentRun.id), 'Collaboration Intent Queue must read back the latest intent run receipt on the source row.');
assert(missionResponse.body.productTeamOperatingLoop?.customerSide?.handoffExecution?.ready === true && missionResponse.body.productTeamOperatingLoop.customerSide.handoffExecution.runReceiptIds.length >= 1, 'Running a collaboration intent must keep the C/A handoff execution visible on the Product Team Operating Loop.');
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/collaboration-intent-queue` });
const missionAgentIntentRow = missionResponse.body.collaborationIntentQueue?.rows?.find((row) => row.source === 'agent-autonomous-initiative' && row.canRun && row.runIntentApiPath && row.runApiPath?.includes('/agent-autonomous-action-queue/'));
assert(missionResponse.status === 200 && missionAgentIntentRow, 'Collaboration Intent Queue must expose generic Agent initiative rows as runnable intent-run targets.');
missionResponse = missionRunnerApi.handle({
  method: 'POST',
  path: missionAgentIntentRow.runIntentApiPath,
  body: {
    includeReadModels: false,
    now: '2026-06-01T09:47:00.000Z',
  },
});
assert(missionResponse.status === 200 && missionResponse.body.collaborationIntentRun?.schemaVersion === 'collaboration-intent-run/v1', 'Collaboration Intent Queue must run generic Agent initiative rows through the same backend intent-run receipt contract.');
assert(missionResponse.body.collaborationIntentRun.intentId === missionAgentIntentRow.id && missionResponse.body.collaborationIntentRun.delegatedRunKind === 'agent-autonomous-action-queue' && missionResponse.body.collaborationIntentRun.delegatedReceiptId === missionResponse.body.agentAutonomousActionRun?.id, 'Agent initiative intent runs must delegate into Agent Autonomous Action Queue and preserve the delegated Agent run receipt.');
assert(missionResponse.body.agentAutonomousActionRun?.schemaVersion === 'agent-autonomous-action-run/v1' && missionResponse.body.agentAutonomousActionRun.workSubmissionId && (missionResponse.body.workSubmission?.id || missionResponse.body.submission?.id), 'Agent initiative intent runs must create an Agent action run receipt plus a submitted work artifact.');
assert(missionResponse.body.autonomousActionDecision?.schemaVersion === 'autonomous-action-decision/v1' && missionResponse.body.agentAutonomousActionRun.autonomousActionDecisionChecksum === missionResponse.body.autonomousActionDecision.checksum, 'Agent initiative intent runs must preserve the Agent autonomous action decision on the delegated run receipt.');
assert(missionResponse.body.collaborationIntentRun.autonomousActionDecisionChecksum === missionResponse.body.autonomousActionDecision.checksum && missionResponse.body.autonomousActionDecision.action === 'run-now', 'Collaboration intent receipts must expose the delegated Agent action decision for C/A audit.');
assert(missionResponse.body.collaborationIntentQueue?.rows?.some((row) => row.id === missionAgentIntentRow.id && row.latestRunId === missionResponse.body.collaborationIntentRun.id && row.latestDelegatedReceiptId === missionResponse.body.agentAutonomousActionRun.id), 'Collaboration Intent Queue must read back the latest Agent initiative intent run on the source row.');
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/collaboration-intent-queue` });
const missionGroupChatIntentRow = missionResponse.body.collaborationIntentQueue?.rows?.find((row) => row.id === 'group-chat-attention-intent' && row.canRun && row.runIntentApiPath && row.runApiPath?.includes('/manager-action-queue/'));
assert(missionResponse.status === 200 && missionGroupChatIntentRow, 'Collaboration Intent Queue must expose the group-chat attention row as a runnable intent-run target.');
missionResponse = missionRunnerApi.handle({
  method: 'POST',
  path: missionGroupChatIntentRow.runIntentApiPath,
  body: {
    includeReadModels: false,
    now: '2026-06-01T09:47:30.000Z',
  },
});
const missionGroupChatIntentMessageIds = missionResponse.body.collaborationIntentRun?.resultMessageIds || [];
assert(missionResponse.status === 200 && missionResponse.body.collaborationIntentRun?.schemaVersion === 'collaboration-intent-run/v1', 'Collaboration Intent Queue must run group-chat attention rows through the same backend intent-run receipt contract.');
assert(missionResponse.body.collaborationIntentRun.intentId === 'group-chat-attention-intent' && missionResponse.body.collaborationIntentRun.delegatedRunKind === 'manager-action-queue' && missionResponse.body.collaborationIntentRun.delegatedReceiptId === missionResponse.body.managerActionRun?.id, 'Group-chat attention intent runs must delegate into Manager Action Queue and preserve the delegated Manager action receipt.');
assert(missionResponse.body.managerActionRun?.resultMessageCount >= 1 && missionGroupChatIntentMessageIds.length >= 1, 'Group-chat attention intent runs must produce result messages for transcript visibility.');
assert(missionResponse.body.collaborationIntentQueue?.rows?.some((row) => row.id === 'group-chat-attention-intent' && row.latestRunId === missionResponse.body.collaborationIntentRun.id && row.latestDelegatedReceiptId === missionResponse.body.managerActionRun.id), 'Collaboration Intent Queue must read back the latest group-chat attention intent run on the source row.');
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/transcripts/main` });
assert(missionResponse.status === 200 && missionGroupChatIntentMessageIds.some((id) => missionResponse.body.messages?.some((message) => message.id === id)), 'Group-chat attention intent run result messages must be visible in the backend Group Chat transcript.');
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/collaboration-intent-queue` });
const missionManagerIntentRow = missionResponse.body.collaborationIntentQueue?.rows?.find((row) => row.id === 'manager-next-action-intent' && row.canRun && row.runIntentApiPath && row.runApiPath?.includes('/manager-action-queue/'))
  || missionResponse.body.collaborationIntentQueue?.rows?.find((row) => row.source === 'manager-action-queue' && row.canRun && row.runIntentApiPath && row.runApiPath?.includes('/manager-action-queue/'));
assert(missionResponse.status === 200 && missionManagerIntentRow, 'Collaboration Intent Queue must expose Manager action rows as runnable intent-run targets.');
missionResponse = missionRunnerApi.handle({
  method: 'POST',
  path: missionManagerIntentRow.runIntentApiPath,
  body: {
    includeReadModels: false,
    now: '2026-06-01T09:48:00.000Z',
  },
});
assert(missionResponse.status === 200 && missionResponse.body.collaborationIntentRun?.schemaVersion === 'collaboration-intent-run/v1', 'Collaboration Intent Queue must run Manager action rows through the same backend intent-run receipt contract.');
assert(missionResponse.body.collaborationIntentRun.intentId === missionManagerIntentRow.id && missionResponse.body.collaborationIntentRun.delegatedRunKind === 'manager-action-queue' && missionResponse.body.collaborationIntentRun.delegatedReceiptId === missionResponse.body.managerActionRun?.id, 'Manager intent runs must delegate into Manager Action Queue and preserve the delegated Manager action receipt.');
assert(missionResponse.body.managerActionRun?.id?.startsWith('manager_action_run_') && missionResponse.body.managerActionRun.resultMessageCount >= 1, 'Manager intent runs must create a Manager action run receipt with result messages.');
assert(missionResponse.body.collaborationIntentQueue?.rows?.some((row) => row.id === missionManagerIntentRow.id && row.latestRunId === missionResponse.body.collaborationIntentRun.id && row.latestDelegatedReceiptId === missionResponse.body.managerActionRun.id), 'Collaboration Intent Queue must read back the latest Manager intent run on the source row.');
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/product-team-operating-loop` });
assert(missionResponse.status === 200 && missionResponse.body.productTeamOperatingLoop?.customerSide?.handoffExecution?.schemaVersion === 'product-team-customer-agent-handoff-execution/v1', 'Product Team Operating Loop must expose the Mission Runner handoff execution read model.');
assert(missionResponse.body.productTeamOperatingLoop.customerSide.handoffExecution.ready === true && missionResponse.body.productTeamOperatingLoop.customerSide.handoffExecution.runReceiptIds.length >= 1 && missionResponse.body.productTeamOperatingLoop.customerSide.handoffExecution.resultMessageIds.length >= 1, 'Mission Runner handoff execution must prove A-side run receipts and result messages.');
assert(missionResponse.body.productTeamOperatingLoop.customerSide.handoffExecution.proofIds.length && missionResponse.body.productTeamOperatingLoop.summary.customerAgentHandoffExecutionReady === true, 'Mission Runner handoff execution must preserve proof ids and summary readiness.');
missionResponse = missionRunnerApi.handle({ method: 'GET', path: `/projects/${missionProjectId}/manager-flow-graph` });
assert(missionResponse.status === 200 && missionResponse.body.nodes?.some((node) => node.id === 'product-team-mission-run-generic_product_team_mission_runner_receipt' && node.subtype === 'product-team-mission-run'), 'Manager Flow Graph must render Product Team Mission Runner receipts as first-class nodes.');
assert(missionResponse.body.nodes?.some((node) => node.id === 'product-team-mission-run-generic_product_team_mission_runner_receipt' && node.attachments?.some((attachment) => attachment.type === 'product-team-customer-agent-handoff' && attachment.status === 'a-side-first-tick-recorded')), 'Manager Flow Graph must render the Product Team Mission Runner C/A handoff attachment.');
assert(missionResponse.body.nodes?.some((node) => node.id === 'product-team-operating-loop' && node.attachments?.some((attachment) => attachment.type === 'operating-loop-customer-agent-handoff' && attachment.executionReady === true && attachment.runReceiptCount >= 1)), 'Manager Flow Graph must render the Product Team Mission Runner C/A handoff execution proof on the operating loop node.');
assert(missionResponse.body.edges?.some((edge) => edge.source === 'productTeamMissionRuns' && edge.fromNodeId === 'product-team-mission-run-generic_product_team_mission_runner_receipt'), 'Manager Flow Graph must connect the Product Team Mission Runner node into kickoff/autonomous proof surfaces.');
progress('generic product team mission runner backend chain ready');

let reusedMissionResponse = missionRunnerApi.handle({
  method: 'POST',
  path: '/kickoff-meetings',
  body: {
    meetingId: 'generic_product_team_reused_kickoff_meeting',
    projectId: 'generic_product_team_reused_kickoff_project',
    name: 'Generic Product Team Reused Kickoff Project',
    brief: 'Validate that a customer-approved kickoff meeting can be handed into the generic product-team mission runner.',
    team,
    selectedLeaderId: 'turing',
    reviewerId: 'curie',
    tasks: [
      { id: 'reused_task_brainstorm', text: 'Create a reusable brainstorm board from the approved kickoff meeting.', assignee: 'Leonardo da Vinci', status: 'pending' },
      { id: 'reused_task_evidence', text: 'Collect evidence and prepare the manager proof route.', assignee: 'Marie Curie', status: 'pending' },
    ],
    now: '2026-06-01T09:50:00.000Z',
  },
});
assert(reusedMissionResponse.status === 200 && reusedMissionResponse.body.meeting?.id === 'generic_product_team_reused_kickoff_meeting', 'Mission Runner reuse fixture must first create a durable kickoff meeting.');
const reusedQuestionId = reusedMissionResponse.body.meeting.transcript?.find((turn) => turn.type === 'role-question' || turn.stage === 'role-clarification')?.id;
reusedMissionResponse = missionRunnerApi.handle({
  method: 'POST',
  path: '/kickoff-meetings/generic_product_team_reused_kickoff_meeting/clarify',
  body: {
    questionId: reusedQuestionId,
    text: 'Manager clarification: keep the kickoff decision intact and hand the project to the Product Team Mission Runner.',
    now: '2026-06-01T09:51:00.000Z',
  },
});
assert(reusedMissionResponse.status === 200 && reusedMissionResponse.body.meeting?.managerClarifications?.length === 1, 'Mission Runner reuse fixture must preserve pre-approval manager clarification evidence.');
reusedMissionResponse = missionRunnerApi.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'generic_product_team_reused_kickoff_receipt',
    meetingId: 'generic_product_team_reused_kickoff_meeting',
    kickoffMeetingId: 'generic_product_team_reused_kickoff_meeting',
    reuseExistingKickoffMeeting: true,
    projectId: 'generic_product_team_reused_kickoff_project',
    name: 'Generic Product Team Reused Kickoff Project',
    missionBrief: 'Reuse the customer-approved kickoff meeting, then start the generic product-team autonomy contract.',
    team,
    selectedLeaderId: 'turing',
    reviewerId: 'curie',
    tasks: [
      { id: 'reused_task_brainstorm', text: 'Create a reusable brainstorm board from the approved kickoff meeting.', assignee: 'Leonardo da Vinci', status: 'pending' },
      { id: 'reused_task_evidence', text: 'Collect evidence and prepare the manager proof route.', assignee: 'Marie Curie', status: 'pending' },
    ],
    maxLoops: 1,
    maxStepsPerLoop: 1,
    runInitialTick: false,
    now: '2026-06-01T09:52:00.000Z',
  },
});
assert(reusedMissionResponse.status === 200 && reusedMissionResponse.body.productTeamMissionRun?.reusedKickoffMeeting === true, 'Product Team Mission Runner must reuse an existing kickoff meeting when requested.');
assert(reusedMissionResponse.body.productTeamMissionRun.kickoffMeetingId === 'generic_product_team_reused_kickoff_meeting' && reusedMissionResponse.body.meeting?.approvedProjectId === 'generic_product_team_reused_kickoff_project', 'Reused kickoff mission receipt must link the approved meeting to the backend project.');
assert(reusedMissionResponse.body.productTeamMissionRun.customerAgentHandoff?.status === 'a-side-session-started' && reusedMissionResponse.body.productTeamMissionRun.customerAgentHandoff?.firstTickRecorded === false, 'Reused kickoff Mission Runner receipt must record C/A handoff even when the first A-side tick is deferred.');
assert(reusedMissionResponse.body.productTeamMissionRun.proofIds?.some((id) => /director_brief|director_clarification|role_negotiation_|leader_bid_/.test(id)), 'Reused kickoff mission receipt must include kickoff transcript proof ids for Manager chat proof exits.');
assert(reusedMissionResponse.body.project?.initiation?.managerClarifications?.some((turn) => /Product Team Mission Runner/i.test(turn.text || '')), 'Reused kickoff mission must carry manager clarification evidence into the created project.');
reusedMissionResponse = missionRunnerApi.handle({ method: 'GET', path: '/projects/generic_product_team_reused_kickoff_project/manager-flow-graph' });
assert(reusedMissionResponse.status === 200 && reusedMissionResponse.body.nodes?.some((node) => node.id === 'product-team-mission-run-generic_product_team_reused_kickoff_receipt' && node.attachments?.some((attachment) => attachment.type === 'product-team-mission-run' && attachment.reusedKickoffMeeting === true)), 'Manager Flow Graph must expose reused-kickoff Mission Runner proof as a first-class node attachment.');
progress('reused kickoff mission runner backend chain ready');

let response = api.handle({
  method: 'POST',
  path: '/kickoff-meetings',
  body: {
    meetingId: 'product_team_acceptance_meeting',
    projectId: 'product_team_acceptance_project',
    name: 'General Product Team Acceptance Project',
    brief: 'Use a research-style project only as a validation sample for a general AI product team operating system.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    now: '2026-06-01T10:00:00.000Z',
    tasks: [
      { id: 'task_discovery', text: 'Produce discovery findings for the generic product-team system.', assignee: 'Alan Turing', status: 'pending' },
      { id: 'task_brainstorm', text: 'Create alternative product-team directions from multiple persona viewpoints.', assignee: 'Leonardo da Vinci', status: 'pending' },
      { id: 'task_evidence', text: 'Collect and evaluate evidence for the strongest direction.', assignee: 'Marie Curie', status: 'pending' },
      { id: 'task_brief', text: 'Draft a manager-readable product brief and decision proposal.', assignee: 'Steve Jobs', status: 'pending' },
      { id: 'task_decision', text: 'Submit a decision proposal for the manager review lane.', assignee: 'Steve Jobs', status: 'pending' },
      { id: 'task_review', text: 'Review the draft, request revisions, and approve final delivery.', assignee: 'Marie Curie', status: 'pending' },
      { id: 'task_implementation', text: 'Map the implementation plan for backend, proof, and handoff surfaces.', assignee: 'Alan Turing', status: 'pending' },
    ],
  },
});
assert(response.status === 200, 'Acceptance Harness must create a durable kickoff meeting.');
assert(response.body.meeting.generationProvenance?.schemaVersion === 'kickoff-generation-provenance/v1' && response.body.meeting.generationProvenance.validationOnly === true && response.body.meeting.generationProvenance.productionClaim === 'blocked', 'Acceptance kickoff meeting must label deterministic generation as validation-only, not production provider-backed output.');
assert(response.body.meeting.transcript.some((turn) => turn.stage === 'role-clarification'), 'Kickoff meeting must include role-clarification turns.');
assert(response.body.meeting.transcript.some((turn) => turn.stage === 'leader-campaign'), 'Kickoff meeting must include Leader campaign turns.');

response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'product_team_acceptance_mission_receipt',
    meetingId: 'product_team_acceptance_meeting',
    kickoffMeetingId: 'product_team_acceptance_meeting',
    reuseExistingKickoffMeeting: true,
    projectId: 'product_team_acceptance_project',
    name: 'General Product Team Acceptance Project',
    missionBrief: 'Use a research-style project only as a validation sample for a general AI product team operating system.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_discovery', text: 'Produce discovery findings for the generic product-team system.', assignee: 'Alan Turing', status: 'pending' },
      { id: 'task_brainstorm', text: 'Create alternative product-team directions from multiple persona viewpoints.', assignee: 'Leonardo da Vinci', status: 'pending' },
      { id: 'task_evidence', text: 'Collect and evaluate evidence for the strongest direction.', assignee: 'Marie Curie', status: 'pending' },
      { id: 'task_brief', text: 'Draft a manager-readable product brief and decision proposal.', assignee: 'Steve Jobs', status: 'pending' },
      { id: 'task_decision', text: 'Submit a decision proposal for the manager review lane.', assignee: 'Steve Jobs', status: 'pending' },
      { id: 'task_review', text: 'Review the draft, request revisions, and approve final delivery.', assignee: 'Marie Curie', status: 'pending' },
      { id: 'task_implementation', text: 'Map the implementation plan for backend, proof, and handoff surfaces.', assignee: 'Alan Turing', status: 'pending' },
    ],
    maxLoops: 2,
    maxStepsPerLoop: 2,
    runInitialTick: false,
    now: '2026-06-01T10:10:00.000Z',
  },
});
assert(
  response.status === 200 && response.body.project?.id === 'product_team_acceptance_project',
  `Product Team Mission Runner must create the acceptance project from the approved kickoff contract. status=${response.status} message=${response.body?.message || response.body?.error || 'none'} projectId=${response.body?.project?.id || 'none'}`,
);
assert(response.body.productTeamMissionRun?.schemaVersion === 'product-team-mission-run/v1' && response.body.productTeamMissionRun.id === 'product_team_acceptance_mission_receipt', 'Acceptance project startup must persist a Product Team Mission Runner receipt.');
assert(response.body.productTeamMissionRun.reusedKickoffMeeting === true && response.body.productTeamMissionRun.kickoffMeetingId === 'product_team_acceptance_meeting', 'Acceptance Mission Runner receipt must reuse the durable kickoff meeting.');
assert(response.body.autonomousRunControlSession?.schemaVersion === 'autonomous-run-control-session/v1' && response.body.productTeamMissionRun.autonomousSessionId === response.body.autonomousRunControlSession.id, 'Acceptance Mission Runner must start bounded A-side autonomy and link the session to the startup receipt.');
assert(response.body.productTeamMissionRun.customerAgentHandoff?.schemaVersion === 'product-team-customer-agent-handoff/v1' && response.body.productTeamMissionRun.customerAgentHandoff?.readyForLocalAutonomy === true && response.body.productTeamMissionRun.customerAgentHandoff?.nextRoutes?.productTeamDeliveryTrace?.endsWith('/product-team-delivery-trace'), 'Acceptance Mission Runner must expose the generic C/A handoff into Product Team Delivery Trace routes.');
assert(response.body.productTeamMissionRun.readRoutes?.runtimeAutonomyStatus?.endsWith('/runtime-autonomy-status'), 'Acceptance Mission Runner receipt must expose the Runtime Autonomy Status recovery route.');
assert(response.body.readModels?.included === false && response.body.readModels?.projectRoute?.endsWith('/product_team_acceptance_project') && response.body.readModels?.transcriptsRoute?.endsWith('/transcripts') && response.body.readModels?.readinessProofMapRoute?.endsWith('/readiness-proof-map') && response.body.readModels?.productTeamMissionRunsRoute?.endsWith('/product-team-missions') && response.body.readModels?.autonomousRunControlSessionsRoute?.endsWith('/autonomous-run-control/sessions') && response.body.readModels?.runtimeAutonomyStatusRoute?.endsWith('/runtime-autonomy-status'), 'Product Team Mission Runner must return lightweight project/transcript/proof/mission/autonomy/runtime refresh routes.');
assert(!response.body.managerDashboard && !response.body.managerReadyPackage && !response.body.managerFlowGraph, 'Product Team Mission Runner startup must not embed large Manager read models when includeReadModels is false.');

const projectId = response.body.project.id;
response = api.handle({
  method: 'PUT',
  path: `/projects/${projectId}/project-settings`,
  body: {
    includeReadModels: false,
    language: 'en',
    updatedBy: 'director',
    source: 'acceptance-project-language',
  },
});
assert(response.status === 200 && response.body.projectSettings?.schemaVersion === 'project-settings/v1', 'Project API must persist project settings through a backend contract.');
assert(response.body.project?.language === 'en' && response.body.projectSettings.effectiveLanguage === 'en', 'Project settings must persist the project language used by Agent/read-model output.');
assert(response.body.projectSettingsAuditEntry?.eventId && response.body.log?.eventType === 'project-settings-updated', 'Project settings updates must create audit and timeline proof.');
assert(response.body.project.eventLedger.some((event) => event.type === 'project-settings-updated'), 'Project settings updates must enter the event ledger.');
assert(response.body.readModels?.included === false && response.body.readModels?.projectSettingsRoute?.endsWith('/project-settings') && response.body.readModels?.managerDashboardRoute?.endsWith('/manager-dashboard'), 'Project settings writes must support lightweight read-model refresh routes.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/project-settings` });
assert(response.status === 200 && response.body.projectSettings?.language === 'en', 'Project API must expose the saved project settings read model.');
response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/transcripts`,
  body: {
    includeReadModels: false,
    channelId: 'brainstorm_room',
    name: 'Brainstorm Room',
    description: 'A backend-created collaboration room for generic product-team ideation.',
    category: 'text',
    actor: 'Product Director',
    actorId: 'director',
    now: '2026-06-01T10:11:00.000Z',
  },
});
assert(response.status === 200 && response.body.transcriptChannel?.schemaVersion === 'transcript-channel/v1' && response.body.transcriptChannel.channelId === 'brainstorm_room', 'Project API must create a backend transcript channel for generic team collaboration.');
assert(response.body.transcriptChannelReceipt?.schemaVersion === 'transcript-channel-created/v1' && response.body.transcriptChannelReceipt.messageId && response.body.transcriptChannelReceipt.timelineLogId && response.body.transcriptChannelReceipt.eventId && response.body.transcriptChannelReceipt.checksum, 'Backend transcript channel creation must return receipt, chat, timeline, event, and checksum proof.');
const createdTranscriptChannelReceipt = response.body.transcriptChannelReceipt;
assert(response.body.messages?.some((message) => message.channelId === 'brainstorm_room' && message.transcriptChannelReceiptChecksum === response.body.transcriptChannelReceipt.checksum), 'Backend transcript channel creation must write a transcript-visible system message.');
assert(response.body.project?.transcriptChannelReceipts?.some((receipt) => receipt.channelId === 'brainstorm_room' && receipt.checksum === response.body.transcriptChannelReceipt.checksum), 'Backend transcript channel receipts must persist on the project state.');
assert(response.body.readModels?.included === false && response.body.readModels?.transcriptsRoute?.endsWith('/transcripts') && response.body.readModels?.transcriptChannelRoute?.endsWith('/transcripts/brainstorm_room') && response.body.readModels?.timelineRoute?.endsWith('/timeline') && response.body.readModels?.eventsRoute?.endsWith('/events'), 'Backend transcript channel writes must return lightweight transcript/timeline/event refresh routes.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/transcripts` });
assert(response.status === 200 && response.body.channels?.some((channel) => channel.channelId === 'brainstorm_room' && channel.name === 'Brainstorm Room' && channel.messageCount > 0 && channel.apiPath?.endsWith('/transcripts/brainstorm_room')), 'Transcript index must expose backend-created collaboration channels with metadata and route proof.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/transcripts/brainstorm_room` });
assert(response.status === 200 && response.body.messages?.some((message) => message.transcriptChannelReceiptChecksum), 'Channel transcript must expose the backend channel creation proof message.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/timeline` });
assert(response.status === 200 && response.body.logs?.some((log) => log.eventType === 'transcript-channel-created' && log.transcriptChannelId === 'brainstorm_room'), 'Timeline must expose backend transcript channel creation.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/events` });
assert(response.status === 200 && response.body.eventLedger?.some((event) => event.type === 'transcript-channel-created' && event.channelId === 'brainstorm_room'), 'Event ledger must expose backend transcript channel creation.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
assert(response.status === 200 && response.body.nodes?.some((node) => node.channelId === 'brainstorm_room' && node.route?.endsWith('/transcripts/brainstorm_room')), 'Manager Flow Graph must expose backend-created transcript channels as collaboration proof nodes.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assert(response.status === 200 && response.body.transcriptChannelRoutes?.some((route) => route.channelId === 'brainstorm_room' && route.apiPath?.endsWith('/transcripts/brainstorm_room') && route.readyForBackendTranscriptChannel === true && route.proofIds?.includes(createdTranscriptChannelReceipt.checksum) && route.timelineLogIds?.includes(createdTranscriptChannelReceipt.timelineLogId) && route.eventIds?.includes(createdTranscriptChannelReceipt.eventId)), 'Readiness Proof Map must expose backend-created transcript channels as routed proof with chat, timeline, and event ids.');
assert(response.body.transcriptChannelSummary?.readyForBackendTranscriptChannels === true && response.body.transcriptChannelSummary.channelIds?.includes('brainstorm_room'), 'Readiness Proof Map must summarize backend transcript channel route readiness.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-dashboard` });
assert(response.body.projectId === projectId && response.body.kickoffMeetingFlow?.generationProvenance?.productionClaim === 'blocked', 'Kickoff approval read-model refresh must preserve generation provenance into the Manager Dashboard.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/mvp-readiness` });
assert(response.status === 200 && response.body.mvpReadiness?.status === 'needs-core-work', 'Early MVP readiness must expose missing core work before submissions.');
const earlyMvpCoreAction = response.body.mvpReadiness.operatorActions?.find((row) => row.id === 'close-mvp-core-gap');
assert(earlyMvpCoreAction?.autonomousRunnable === true && earlyMvpCoreAction.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1', 'MVP readiness core-gap action must translate the C-side choice into an autonomous target control.');
assert(earlyMvpCoreAction.targetControl.targetStageId === 'brainstorm-layer' && earlyMvpCoreAction.targetControl.preferredLane === 'agent-autonomy' && earlyMvpCoreAction.targetControl.workArtifactType === 'brainstorm-board', 'Early MVP readiness target control must point the A-side toward the next generic product-team stage.');
response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/mvp-readiness/operator-actions/close-mvp-core-gap/run`,
  body: {
    includeReadModels: false,
    actor: 'Product Director',
    now: '2026-06-01T10:12:00.000Z',
  },
});
assert(response.status === 200 && response.body.mvpReadinessOperatorActionRun?.targetStageId === 'brainstorm-layer' && response.body.mvpReadinessOperatorActionRun.autonomousRunnable === true, 'MVP readiness core-gap receipts must preserve the autonomous target stage.');
assert(response.body.mvpReadinessOperatorActionRun.targetControl?.checksum && response.body.readModels?.operatorActionAutonomousRunRoute?.endsWith('/autonomous-run-control/run-mvp-readiness-target/run'), 'MVP readiness core-gap receipts must return the autonomous handoff route and target checksum.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/collaboration-intent-queue` });
assert(response.status === 200 && response.body.collaborationIntentQueue?.rows?.some((row) => row.source === 'mvp-readiness-operator-action-run' && row.canRun && row.runApiPath?.endsWith('/autonomous-run-control/run-mvp-readiness-target/run')), 'Collaboration Intent Queue must turn runnable MVP readiness receipts into A-side handoff intents.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/autonomous-run-control` });
assert(response.status === 200 && response.body.autonomousRunControl?.nextActions?.some((row) => row.id === 'run-mvp-readiness-target' && row.canRun && row.targetStageId === 'brainstorm-layer' && row.requestBodyTemplate?.autopilotTargetControl?.targetStageId === 'brainstorm-layer'), 'Autonomous Run Control must expose the MVP readiness target as a runnable A-side action.');
response = api.handle({
  method: 'POST',
  path: '/kickoff-meetings',
  body: {
    meetingId: 'mvp_readiness_target_execution_meeting',
    projectId: 'mvp_readiness_target_execution_project',
    name: 'MVP Readiness Target Execution Project',
    brief: 'A minimal generic product-team project used only to prove C-side readiness target handoff can execute A-side Agent work.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    now: '2026-06-01T10:13:00.000Z',
    tasks: [
      { id: 'target_task_brainstorm', text: 'Create a generic product-team brainstorm board from multiple persona viewpoints.', assignee: 'Leonardo da Vinci', status: 'pending' },
      { id: 'target_task_evidence', text: 'Collect evidence after the brainstorm target lands.', assignee: 'Marie Curie', status: 'pending' },
    ],
  },
});
assert(response.status === 200, 'MVP readiness target execution fixture must create a separate kickoff meeting.');
response = api.handle({
  method: 'POST',
  path: '/kickoff-meetings/mvp_readiness_target_execution_meeting/approve',
  body: {
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    now: '2026-06-01T10:14:00.000Z',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.project?.id === 'mvp_readiness_target_execution_project', 'MVP readiness target execution fixture must create a separate project.');
const targetExecutionProjectId = response.body.project.id;
const runNextMvpReadinessTarget = ({
  expectedStageId,
  expectedStepId,
  recordNow,
  runNow,
  checkResult,
}) => {
  response = api.handle({ method: 'GET', path: `/projects/${targetExecutionProjectId}/mvp-readiness` });
  const action = response.body.mvpReadiness?.operatorActions?.find((row) => row.id === 'close-mvp-core-gap');
  assert(response.status === 200 && action?.targetControl?.targetStageId === expectedStageId, `MVP readiness target must select ${expectedStageId}.`);
  assert(!expectedStepId || action.targetControl.targetStepId === expectedStepId, `MVP readiness target must select step ${expectedStepId}.`);
  response = api.handle({
    method: 'POST',
    path: `/projects/${targetExecutionProjectId}/mvp-readiness/operator-actions/close-mvp-core-gap/run`,
    body: {
      includeReadModels: false,
      actor: 'Product Director',
      now: recordNow,
    },
  });
  assert(response.status === 200 && response.body.mvpReadinessOperatorActionRun?.targetStageId === expectedStageId, `MVP readiness receipt must preserve target stage ${expectedStageId}.`);
  assert(!expectedStepId || response.body.mvpReadinessOperatorActionRun?.targetStepId === expectedStepId, `MVP readiness receipt must preserve target step ${expectedStepId}.`);
  if (response.body.mvpReadinessOperatorActionRun?.targetControl?.workArtifactType) {
    assert(response.body.mvpReadinessOperatorActionRun.targetControl.submitWorkArtifactOn === 'always', 'MVP readiness artifact targets must force the first A-side run to submit the requested artifact node.');
  }
  response = api.handle({ method: 'GET', path: `/projects/${targetExecutionProjectId}/collaboration-intent-queue` });
  const targetIntent = response.body.collaborationIntentQueue?.rows?.find((row) => (
    row.source === 'mvp-readiness-operator-action-run'
    && row.canRun
    && row.runIntentApiPath
    && row.runApiPath?.endsWith('/autonomous-run-control/run-mvp-readiness-target/run')
    && (!expectedStageId || row.relatedIds?.includes(expectedStageId) || row.artifactType === action.targetControl?.workArtifactType)
  ));
  assert(response.status === 200 && targetIntent, `Collaboration Intent Queue must expose the MVP readiness ${expectedStageId} target as a runnable intent.`);
  response = api.handle({
    method: 'POST',
    path: targetIntent.runIntentApiPath,
    body: {
      includeReadModels: false,
      now: runNow,
    },
  });
  assert(response.body.collaborationIntentRun?.schemaVersion === 'collaboration-intent-run/v1' && response.body.collaborationIntentRun.intentId === targetIntent.id, `Collaboration Intent Queue must record a run receipt for MVP readiness target ${expectedStageId}.`);
  assert(response.body.collaborationIntentRun.delegatedRunKind === 'autonomous-run-control' && response.body.collaborationIntentRun.delegatedReceiptId === response.body.autonomousRunControlRun?.id, `MVP readiness intent ${expectedStageId} must delegate through Autonomous Run Control and preserve the delegated receipt.`);
  assert(response.status === 200 && response.body.autonomousRunControlRun?.actionId === 'run-mvp-readiness-target' && response.body.autonomousRunControlRun?.autopilotTargetStageId === expectedStageId, `Autonomous Run Control must execute target stage ${expectedStageId}.`);
  checkResult(response);
  response = api.handle({ method: 'GET', path: `/projects/${targetExecutionProjectId}/autonomous-run-control` });
  assert(!response.body.autonomousRunControl?.nextActions?.some((row) => row.id === 'run-mvp-readiness-target' && row.targetStepId === expectedStepId), `Autonomous Run Control must expire completed target step ${expectedStepId}.`);
};
runNextMvpReadinessTarget({
  expectedStageId: 'brainstorm-layer',
  expectedStepId: 'brainstorm-layer',
  recordNow: '2026-06-01T10:15:00.000Z',
  runNow: '2026-06-01T10:16:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.workSubmission?.artifactType === 'brainstorm-board' && targetResponse.body.agentAutonomousActionRun?.workSubmissionId === targetResponse.body.workSubmission.id, 'MVP readiness target execution must produce a brainstorm-board Agent submission.');
    assert(targetResponse.body.workSubmission?.messageId && targetResponse.body.workSubmission?.timelineLogId && targetResponse.body.workSubmission?.eventId && targetResponse.body.workSubmission?.artifactStorageProofChecksum, 'Executed MVP readiness target submissions must carry chat, timeline, event, and workspace proof.');
  },
});
runNextMvpReadinessTarget({
  expectedStageId: 'evidence-quality',
  expectedStepId: 'evidence-quality',
  recordNow: '2026-06-01T10:17:00.000Z',
  runNow: '2026-06-01T10:18:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.workSubmission?.artifactType === 'evidence-packet', 'MVP readiness target execution must produce an evidence-packet submission.');
    assert(targetResponse.body.evidenceSearch?.qualityScore >= 60 && targetResponse.body.evidenceSearch?.eventId, 'Evidence target execution must create a quality-scored evidence search with event proof.');
  },
});
runNextMvpReadinessTarget({
  expectedStageId: 'draft-artifact',
  expectedStepId: 'draft-product-brief',
  recordNow: '2026-06-01T10:19:00.000Z',
  runNow: '2026-06-01T10:20:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.workSubmission?.artifactType === 'product-brief', 'MVP readiness draft target must produce a product-brief submission.');
  },
});
runNextMvpReadinessTarget({
  expectedStageId: 'review-and-revision',
  expectedStepId: 'review-product-brief',
  recordNow: '2026-06-01T10:21:00.000Z',
  runNow: '2026-06-01T10:22:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.review?.verdict === 'changes-requested' && targetResponse.body.review?.eventId, 'MVP readiness review target must create a changes-requested review with event proof.');
  },
});
runNextMvpReadinessTarget({
  expectedStageId: 'review-and-revision',
  expectedStepId: 'submit-revision-note',
  recordNow: '2026-06-01T10:23:00.000Z',
  runNow: '2026-06-01T10:24:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.reviewResponseSubmission?.artifactType === 'revision-note' && targetResponse.body.reviewResponseSubmission?.respondsToReviewId, 'MVP readiness revision target must create a linked revision-note response.');
  },
});
runNextMvpReadinessTarget({
  expectedStageId: 'final-deliverable',
  expectedStepId: 'submit-final-deliverable',
  recordNow: '2026-06-01T10:25:00.000Z',
  runNow: '2026-06-01T10:26:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.workSubmission?.artifactType === 'final-deliverable', 'MVP readiness final target must produce a final-deliverable submission.');
  },
});
runNextMvpReadinessTarget({
  expectedStageId: 'final-deliverable',
  expectedStepId: 'accept-final-deliverable',
  recordNow: '2026-06-01T10:27:00.000Z',
  runNow: '2026-06-01T10:28:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.review?.verdict === 'accepted' && targetResponse.body.review?.eventId, 'MVP readiness final acceptance target must create an accepted final-deliverable review.');
  },
});
response = api.handle({ method: 'GET', path: `/projects/${targetExecutionProjectId}/manager-flow-graph` });
assert(response.status === 200 && ['brainstorm-board', 'evidence-packet', 'product-brief', 'revision-note', 'final-deliverable'].every((artifactType) => response.body.nodes?.some((node) => node.source === 'agentSubmissions' && node.subtype === artifactType && node.proofIds?.length && node.timelineLogIds?.length && node.eventIds?.length)), 'Manager Flow Graph must show every A-side artifact node created from C-side readiness targets.');
response = api.handle({ method: 'GET', path: `/projects/${targetExecutionProjectId}/readiness-proof-map` });
assert(response.status === 200 && ['brainstorm-board', 'evidence-packet', 'product-brief', 'revision-note', 'final-deliverable'].every((artifactType) => response.body.submissionRoutes?.some((route) => route.artifactType === artifactType && route.proofIds?.length && route.timelineLogIds?.length && route.eventIds?.length)), 'Readiness Proof Map must expose every submission route created from readiness target execution.');
response = api.handle({ method: 'GET', path: `/projects/${targetExecutionProjectId}/autonomous-run-control` });
assert(!response.body.autonomousRunControl?.nextActions?.some((row) => row.id === 'run-mvp-readiness-target' && row.targetStageId === 'brainstorm-layer'), 'Autonomous Run Control must stop offering the completed brainstorm target after execution.');
progress('mvp readiness target execution chain completed');
progress('kickoff meeting approved and project created');
const projectMembershipPolicy = {
  schemaVersion: 'project-membership-policy/v1',
  projectId,
  source: 'product-team-acceptance-membership-fixture',
  managerUserIds: ['director'],
  securityAdminUserIds: ['security-lead'],
  operationsOwnerUserIds: ['ops-lead'],
  observerUserIds: ['observer'],
  runtimeUserIds: ['http-autonomous-scheduler', 'runtime-ops'],
  agentIds: team.map((member) => member.id),
  reviewerAgentIds: ['curie'],
  agentUserIds: Object.fromEntries(team.map((member) => [member.id, [`agent-runtime-${member.id}`]])),
  reviewerUserIds: {
    curie: ['agent-runtime-curie'],
  },
};

response = api.handle({ method: 'GET', path: '/search/status' });
assert(response.status === 200 && response.body.searchProvider.enabled, 'Search provider status must be exposed without requiring a secret.');
assert(!('apiKey' in response.body.searchProvider), 'Search provider status must not expose API keys.');
assert(!JSON.stringify(response.body.searchProvider).includes(FAKE_SEARCH_SECRET), 'Search provider status must redact secret-bearing endpoints.');
assert(!JSON.stringify(modelProvider.status()).includes(FAKE_MODEL_SECRET), 'Model provider status must redact secret-bearing endpoints.');

response = await api.handleAsync({
  method: 'POST',
  path: '/search/test',
  body: {
    query: 'generic AI product team acceptance evidence',
  },
});
assert(response.status === 200 && response.body.sources?.length > 0, 'Search provider test must return sources.');

response = await api.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/curie/evidence-searches`,
  body: {
    query: 'generic AI product team acceptance evidence',
    purpose: 'Verify the product-team workflow with reusable evidence primitives rather than research-only logic.',
    taskId: 'task_evidence',
    useProvider: true,
    maxResults: 3,
    includeReadModels: false,
    now: '2026-06-01T10:20:00.000Z',
  },
});
assert(response.status === 200 && response.body.evidenceSearch?.sources?.length === 3, 'Agent evidence search must be accepted by the API.');
assert(response.body.readModels?.included === false && response.body.readModels.managerReadyPackageRoute?.endsWith('/manager-ready-package') && response.body.readModels.transcriptsRoute?.endsWith('/transcripts') && response.body.readModels.timelineRoute?.endsWith('/timeline') && response.body.readModels.eventsRoute?.endsWith('/events'), 'Provider-backed evidence search must support deferred read-model and proof-surface refresh for frontend mock replacement.');
assert(response.body.evidenceSearch.provider === 'deterministic', 'Agent evidence search must preserve provider provenance.');
assert(response.body.evidenceSearch.evidenceJudgement === 'strong-evidence', 'Agent evidence search must include an aggregate evidence judgement.');
assert(response.body.evidenceSearch.qualityScore >= 70, 'Agent evidence search must include a usable aggregate quality score.');
assert(response.body.evidenceSearch.sources.every((source) => source.qualityScore > 0 && source.qualityLevel && source.qualitySignals?.length), 'Every evidence source must include quality judgement signals.');
assert(response.body.evidenceSearch.sourceSafetySummary?.sourceSafetyReady === true, 'Agent evidence search must include a ready source-safety summary.');
assert(response.body.evidenceSearch.sourceSafetySummary?.blockedSourceCount === 0, 'Agent evidence search must not include blocked sources in the acceptance path.');
assert(response.body.evidenceSearch.sources.every((source) => source.sourceSafetyScore > 0 && source.sourceSafetyLevel === 'safe' && source.sourceSafetySignals?.includes('source-safety-screened')), 'Every evidence source must include source-safety judgement signals.');
assert(response.body.providerReceipt?.schemaVersion === 'evidence-provider-receipt/v1' && response.body.providerReceipt.checksum, 'Provider-backed evidence search must return a checksummed provider receipt.');
assert(response.body.providerReceipt?.providerVaultBindingChecksum && response.body.providerReceipt?.providerVaultBindingRoute?.endsWith('/provider-vault-bindings'), 'Provider-backed evidence receipt must bind the provider call to the provider-vault proof route.');
assert(response.body.providerUsage?.providerVaultBindingChecksum && response.body.providerUsage?.providerVaultBindingRoute?.endsWith('/provider-vault-bindings'), 'Provider-backed evidence usage must bind the provider call to the provider-vault proof route.');
assert(response.body.sourceSnapshots?.length === 3 && response.body.sourceSnapshots.every((snapshot) => snapshot.schemaVersion === 'evidence-source-snapshot/v1' && snapshot.checksum && snapshot.sourceChecksum), 'Provider-backed evidence search must create checksummed source snapshots.');
assert(response.body.evidenceSearch.providerReceiptId === response.body.providerReceipt.id, 'Evidence search must link to the provider receipt.');
assert(response.body.evidenceSearch.sources.every((source) => source.sourceSnapshotId && source.sourceSnapshotChecksum && source.providerReceiptId === response.body.providerReceipt.id), 'Every evidence source must link to its source snapshot and provider receipt.');
const evidenceSearch = response.body.evidenceSearch;
progress('provider-backed evidence search recorded');

response = await api.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agent-autonomous-action-queue/curie/run`,
  body: {
    force: true,
    includeReadModels: false,
    now: '2026-06-01T10:21:00.000Z',
    requestBodyOverrides: {
      useProviderEvidenceSearch: true,
      evidenceSearchQuery: 'autonomous provider preflight proof',
      evidenceSearchPurpose: 'Verify the A-side autonomous queue decides provider calls through preflight before running.',
      submitAgentWorkArtifacts: false,
      reviewPendingSubmissions: false,
      respondToReviewObligations: false,
    },
  },
});
assert(response.status === 200 && response.body.autonomousProviderPreflight?.schemaVersion === 'autonomous-provider-preflight/v1', 'Agent Autonomous Action Queue provider path must return autonomous provider preflight proof.');
assert(response.body.autonomousActionDecision?.schemaVersion === 'autonomous-action-decision/v1', 'Agent Autonomous Action Queue provider path must return a general autonomous action decision.');
assert(response.body.agentAutonomousActionRun?.autonomousActionDecisionChecksum === response.body.autonomousActionDecision.checksum && response.body.autonomousActionDecision.providerPreflightChecksum === response.body.autonomousProviderPreflight.checksum, 'Agent autonomous action decision must bind the selected Agent action to the provider preflight proof.');
assert(response.body.autonomousProviderPreflight.action === 'call-provider' && response.body.autonomousProviderPreflight.canCallProvider === true, 'Agent autonomous provider preflight must decide to call the provider when provider, vault, policy, circuit, and queue gates pass.');
assert(response.body.autonomousProviderPreflight.providerVaultBindingChecksum && response.body.autonomousProviderPreflight.providerVaultBindingRoute?.endsWith('/provider-vault-bindings'), 'Agent autonomous provider preflight must bind provider execution to provider-vault proof.');
assert(response.body.providerUsage?.autonomousProviderPreflightChecksum === response.body.autonomousProviderPreflight.checksum && response.body.providerUsage?.autonomousProviderPreflightAction === 'call-provider', 'Provider usage rows must persist the autonomous preflight decision that allowed the call.');
assert(response.body.agentAutonomousActionRun?.autonomousProviderPreflightChecksum === response.body.autonomousProviderPreflight.checksum && response.body.agentAutonomousActionRun?.autonomousProviderPreflightAction === 'call-provider', 'Agent action run receipts must carry the autonomous preflight decision.');
assert(response.body.providerEvidenceSearch?.autonomousProviderPreflightChecksum === response.body.autonomousProviderPreflight.checksum, 'Provider evidence result must expose the autonomous preflight checksum.');
progress('agent autonomous provider preflight recorded');

const submissionPlan = [
  {
    agentId: 'turing',
    artifactType: 'discovery-report',
    title: 'Discovery report for generic product-team validation',
    summary: 'Discovery notes separating the reusable product-team system from the Research Project validation sample.',
    taskId: 'task_discovery',
    body: '# Discovery report\n\nProblem: prove a general AI product-team system can coordinate work, not a research-only workflow.\n\nDiscovery finding: every work product must become a typed submission node with proof routes.',
  },
  {
    agentId: 'da_vinci',
    artifactType: 'brainstorm-board',
    title: 'Three product-team directions',
    summary: 'A cross-domain board comparing product strategy, market narrative, and technical feasibility.',
    taskId: 'task_brainstorm',
    body: '# Three product-team directions\n\n1. Product strategy lens\n2. Evidence-first validation lens\n3. Implementation architecture lens\n\nRecommended synthesis: build the smallest proof-bearing product-team workflow.',
  },
  {
    agentId: 'curie',
    artifactType: 'evidence-packet',
    title: 'Evidence quality packet',
    summary: 'Source-quality notes and confidence levels for the product-team validation path.',
    taskId: 'task_evidence',
    sourceRefs: [
      ...evidenceSearch.sources,
      {
        id: 'secret-bearing-source',
        title: 'Secret-bearing source should be redacted',
        kind: 'security-fixture',
        url: `https://example.test/source?token=${FAKE_SOURCE_SECRET}`,
        summary: `Fixture source includes api_key=${FAKE_SOURCE_SECRET} and must never persist raw.`,
      },
    ],
    body: `# Evidence quality packet\n\n- Strong internal evidence: kickoff transcript, task evidence, event ledger.\n- Remaining gap: live external search integration is not required for this generic contract test.\n- Security fixture: token=${FAKE_SOURCE_SECRET}`,
  },
  {
    agentId: 'jobs',
    artifactType: 'product-brief',
    title: 'Product-team MVP brief',
    summary: 'A manager-readable brief that frames the generic AI product team MVP.',
    taskId: 'task_brief',
    body: '# Product-team MVP brief\n\nThe product is a general AI product team operating system. Research validates the workflow; it does not define the vertical.',
  },
  {
    agentId: 'jobs',
    artifactType: 'decision-proposal',
    title: 'Decision proposal for the MVP lane',
    summary: 'Decision proposal recommending the smallest product-team loop that proves meetings, artifacts, evidence, review, and handoff.',
    taskId: 'task_decision',
    body: '# Decision proposal\n\nRecommendation: ship the generic product-team acceptance loop first, then harden production storage, provider, and operations controls.\n\nDecision owner: Manager with Reviewer evidence sign-off.',
  },
  {
    agentId: 'curie',
    artifactType: 'risk-review',
    title: 'Reviewer risk review',
    summary: 'Reviewer asks for clearer separation between generic product-team primitives and the research sample.',
    taskId: 'task_review',
    reviewStatus: 'changes-requested',
    body: '# Reviewer risk review\n\nRisk: confusing the validation sample with a research-only product. Required revision: keep artifact and evidence contracts generic.',
  },
  {
    agentId: 'turing',
    artifactType: 'revision-note',
    title: 'Generic contract revision note',
    summary: 'Revision maps brainstorm, evidence, brief, review, and final delivery to generic submission nodes.',
    taskId: 'task_brief',
    body: '# Generic contract revision note\n\nAll nodes now use artifactType and submission protocol fields rather than research-only route names.',
  },
  {
    agentId: 'turing',
    artifactType: 'implementation-plan',
    title: 'Implementation plan for the generic workflow',
    summary: 'Implementation plan mapping backend contracts, Flow Graph nodes, Proof Map routes, and production hardening blockers.',
    taskId: 'task_implementation',
    body: '# Implementation plan\n\n1. Keep Agent submissions generic.\n2. Route every artifact through backend contracts.\n3. Verify Flow Graph, Proof Map, archive, persistence, and UI surfaces.\n4. Keep production hardening blockers explicit.',
  },
  {
    agentId: 'jobs',
    artifactType: 'final-deliverable',
    title: 'Final product-team validation package',
    summary: 'Final deliverable tying kickoff, brainstorm, evidence, draft, review, revision, and proof routes together.',
    taskId: 'task_brief',
    status: 'final',
    reviewStatus: 'accepted',
    body: '# Final product-team validation package\n\nThis package proves the general product-team workflow can submit and trace work nodes end to end.',
  },
];

const submissionsByType = new Map();
const reviewsByVerdict = new Map();
progress('agent submission loop starting');
for (const item of submissionPlan) {
  progress(`submit ${item.artifactType} starting`);
  const submissionBody = {
    ...item,
    reviewerAgentId: 'curie',
    includeReadModels: false,
    now: item.artifactType === 'final-deliverable'
      ? '2026-06-01T11:10:00.000Z'
      : '2026-06-01T10:30:00.000Z',
  };
  if (item.artifactType === 'revision-note') {
    submissionBody.revisesSubmissionId = submissionsByType.get('product-brief')?.id;
    submissionBody.respondsToReviewId = reviewsByVerdict.get('changes-requested')?.id;
  }
  if (item.artifactType === 'final-deliverable') {
    submissionBody.revisesSubmissionId = submissionsByType.get('revision-note')?.id;
    submissionBody.respondsToReviewId = reviewsByVerdict.get('changes-requested')?.id;
    submissionBody.supersedesSubmissionIds = [
      submissionsByType.get('product-brief')?.id,
      submissionsByType.get('revision-note')?.id,
    ].filter(Boolean);
  }
  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/agents/${item.agentId}/submissions`,
    body: submissionBody,
  });
  assert(response.status === 200, `Submission ${item.artifactType} must be accepted by the API; got ${response.status} ${JSON.stringify(response.body || {})}.`);
  assert(response.body.readModels?.included === false && response.body.readModels.managerFlowGraphRoute?.endsWith('/manager-flow-graph') && response.body.readModels.readinessProofMapRoute?.endsWith('/readiness-proof-map') && response.body.readModels.transcriptsRoute?.endsWith('/transcripts') && response.body.readModels.timelineRoute?.endsWith('/timeline') && response.body.readModels.eventsRoute?.endsWith('/events'), `Submission ${item.artifactType} must support deferred manager and proof-surface read-model refresh.`);
  assert(response.body.submission?.artifactType === item.artifactType, `Submission ${item.artifactType} must preserve artifactType.`);
  assert(response.body.submission?.messageId && response.body.submission?.timelineLogId && response.body.submission?.eventId, `Submission ${item.artifactType} must link chat, timeline, and event proof.`);
  assert(response.body.artifact?.existsOnDisk && existsSync(response.body.artifact.absolutePath), `Submission ${item.artifactType} must write a workspace artifact.`);
  assert(response.body.artifact?.storageProof?.schemaVersion === 'agent-artifact-storage-proof/v1' && response.body.artifact.storageProof.checksum && response.body.artifact.storageProof.contentChecksum, `Submission ${item.artifactType} must return checksummed artifact storage proof.`);
  assert(response.body.submission?.artifactStorageProofChecksum === response.body.artifact.storageProof.checksum && response.body.submission?.workspaceFileProof?.checksum === response.body.artifact.storageProof.checksum, `Submission ${item.artifactType} must link its storage proof into the submission contract.`);
  submissionsByType.set(item.artifactType, response.body.submission);
  progress(`submit ${item.artifactType} completed`);

  if (item.artifactType === 'product-brief') {
    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/submissions/${encodeURIComponent(item.artifactType === 'product-brief' ? response.body.submission.id : '')}/reviews`,
      body: {
        reviewerAgentId: 'curie',
        verdict: 'changes-requested',
        comments: 'Keep the workflow primitives generic and cite the evidence search record.',
        requestedChanges: [
          'Separate product-team primitives from the research validation sample.',
          'Link the evidence search to the revised artifact.',
        ],
        now: '2026-06-01T10:55:00.000Z',
      },
    });
    assert(response.status === 200 && response.body.review?.verdict === 'changes-requested', `Reviewer must be able to request changes on a submitted brief. status=${response.status} body=${JSON.stringify(response.body)}`);
    reviewsByVerdict.set('changes-requested', response.body.review);
  }

  if (item.artifactType === 'final-deliverable') {
    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/submissions/${encodeURIComponent(response.body.submission.id)}/reviews`,
      body: {
        reviewerAgentId: 'curie',
        verdict: 'accepted',
        comments: 'Final package accepted because the chain proves kickoff, evidence, revision, and final delivery.',
        now: '2026-06-01T11:20:00.000Z',
      },
    });
    assert(response.status === 200 && response.body.review?.verdict === 'accepted', 'Reviewer must be able to accept the final deliverable.');
    reviewsByVerdict.set('accepted', response.body.review);
  }
}
progress('agent submission loop completed');

response = await api.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/artifact-drafts`,
  body: {
    artifactType: 'progress-brief',
    taskId: 'task_implementation',
    instruction: 'Generate a backend-authored progress brief proving artifact drafts can become first-class submissions without hand-written body payloads.',
    evidenceSearchIds: [evidenceSearch.id],
    priorSubmissionIds: [
      submissionsByType.get('implementation-plan')?.id,
      submissionsByType.get('decision-proposal')?.id,
    ].filter(Boolean),
    reviewIds: [reviewsByVerdict.get('changes-requested')?.id].filter(Boolean),
    useModel: false,
    submit: true,
    reviewerAgentId: 'curie',
    includeReadModels: false,
    now: '2026-06-01T11:12:00.000Z',
  },
});
assert(response.status === 200 && response.body.artifactDraft?.schemaVersion === 'agent-artifact-draft/v1', 'Agent artifact draft route must return the draft contract.');
assert(response.body.readModels?.included === false && response.body.readModels.agentDashboardRoute?.endsWith('/agents/turing/dashboard') && response.body.readModels.transcriptsRoute?.endsWith('/transcripts') && response.body.readModels.timelineRoute?.endsWith('/timeline') && response.body.readModels.eventsRoute?.endsWith('/events'), 'Local artifact draft submission must support deferred Agent and proof-surface read-model refresh.');
assert(response.body.artifactDraft.source === 'local-artifact-draft-generator' && response.body.artifactDraft.modelUsed === false, 'Agent artifact draft must use the local draft generator when model use is disabled for the request.');
assert(response.body.submission?.artifactType === 'progress-brief' && response.body.submission?.messageId && response.body.submission?.timelineLogId && response.body.submission?.eventId, 'Agent artifact draft route must submit the generated draft as a proofed Agent submission.');
assert(response.body.artifact?.existsOnDisk && existsSync(response.body.artifact.absolutePath), 'Generated artifact draft submission must write a workspace artifact.');
assert(response.body.artifact?.storageProof?.schemaVersion === 'agent-artifact-storage-proof/v1' && response.body.artifact.storageProof.checksum && response.body.submission?.artifactStorageProofChecksum === response.body.artifact.storageProof.checksum, 'Generated artifact draft submission must preserve checksummed storage proof.');
assert(response.body.artifactDraft.proofContext?.evidenceSearchIds?.includes(evidenceSearch.id), 'Generated artifact draft must carry evidence-search proof context.');
assert(response.body.artifactDraft.artifactDraftQuality?.schemaVersion === 'artifact-draft-quality/v1' && response.body.artifactDraft.artifactDraftQuality.readyForLocalPilot === true && response.body.artifactDraft.artifactDraftQuality.readyForProduction === false, 'Generated local artifact drafts must carry local-pilot-ready quality gates without production overclaim.');
assert(response.body.artifactDraft.artifactDraftQuality.gates.every((gate) => gate.passed), 'Generated local artifact draft quality gates must pass for the acceptance scenario.');
const generatedDraftSubmission = response.body.submission;

response = await api.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/artifact-drafts`,
  body: {
    artifactType: 'progress-brief',
    taskId: 'task_implementation',
    instruction: 'Use the configured model provider to draft a second progress brief and preserve model provenance without leaking BYOK secrets.',
    evidenceSearchIds: [evidenceSearch.id],
    priorSubmissionIds: [
      generatedDraftSubmission.id,
      submissionsByType.get('implementation-plan')?.id,
    ].filter(Boolean),
    reviewIds: [reviewsByVerdict.get('changes-requested')?.id].filter(Boolean),
    useModel: true,
    requireModel: true,
    submit: true,
    reviewerAgentId: 'curie',
    includeReadModels: false,
    now: '2026-06-01T11:13:00.000Z',
  },
});
assert(response.status === 200 && response.body.artifactDraft?.source === 'model-artifact-draft' && response.body.artifactDraft?.modelUsed === true, 'Agent artifact draft route must support provider-backed model drafts.');
assert(response.body.readModels?.included === false && response.body.readModels.managerReadyPackageRoute?.endsWith('/manager-ready-package') && response.body.readModels.transcriptsRoute?.endsWith('/transcripts') && response.body.readModels.timelineRoute?.endsWith('/timeline') && response.body.readModels.eventsRoute?.endsWith('/events'), 'Model artifact draft submission must support deferred manager and proof-surface read-model refresh.');
assert(response.body.providerUsage?.operation === 'model:artifact-draft' && response.body.providerUsage?.allowed === true && response.body.providerUsage?.ok === true, 'Model-backed artifact drafts must write allowed provider usage proof.');
assert(response.body.providerUsage?.providerVaultBindingChecksum && response.body.providerUsage?.providerVaultBindingRoute?.endsWith('/provider-vault-bindings'), 'Model-backed artifact draft usage must bind the provider call to the provider-vault proof route.');
assert(response.body.artifactDraft?.providerVaultBinding?.schemaVersion === 'provider-vault-binding-proof/v1' && response.body.artifactDraft.providerVaultBinding.bound === true, 'Model-backed artifact draft must expose provider-vault binding proof without secrets.');
assert(response.body.submission?.isGeneratedDraft === true && response.body.submission?.artifactDraftModelUsed === true && response.body.submission?.artifactDraftSource === 'model-artifact-draft', 'Submitted model-backed artifact drafts must preserve model provenance.');
assert(response.body.artifact?.storageProof?.schemaVersion === 'agent-artifact-storage-proof/v1' && response.body.artifact.storageProof.contentChecksum && response.body.submission?.artifactStorageProofChecksum === response.body.artifact.storageProof.checksum, 'Model-backed artifact draft submission must preserve checksummed storage proof.');
assert(response.body.artifactDraft.artifactDraftQuality?.schemaVersion === 'artifact-draft-quality/v1' && response.body.artifactDraft.artifactDraftQuality.readyForLocalPilot === true && response.body.artifactDraft.artifactDraftQuality.humanReviewRequired === true && response.body.artifactDraft.artifactDraftQuality.readyForProduction === false, 'Model-backed artifact drafts must carry local-pilot-ready quality gates and an explicit human-review requirement.');
assert(response.body.artifactDraft.artifactDraftQuality.gates.every((gate) => gate.passed), 'Model-backed artifact draft quality gates must pass for the acceptance scenario.');
assert(modelFetchCalls.length >= 1, 'Model-backed artifact draft validation must exercise the deterministic model provider fetch path.');
assert(!JSON.stringify(response.body).includes(FAKE_MODEL_SECRET), 'Model-backed artifact draft response must not expose the model secret fixture.');
const modelGeneratedDraftSubmission = response.body.submission;
const expectedSubmissionCount = submissionPlan.length + 2;
progress('artifact draft routes completed');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/submissions` });
assert(response.status === 200 && response.body.submissions.length === expectedSubmissionCount, 'Project API must list all Agent submissions, including generated artifact drafts.');
assert(response.body.submissions.every((submission) => submission.artifactStorageProof?.schemaVersion === 'agent-artifact-storage-proof/v1' && submission.artifactStorageProofChecksum && submission.workspaceFileProof?.checksum === submission.artifactStorageProofChecksum), 'Project API must list Agent submissions with checksummed artifact storage proof.');
assert(response.body.submissions.some((submission) => submission.artifactType === 'final-deliverable' && submission.status === 'final'), 'Project submissions must include a final deliverable.');
assert(response.body.submissions.some((submission) => submission.id === generatedDraftSubmission.id && submission.artifactType === 'progress-brief'), 'Project submissions must include the generated progress brief draft submission.');
assert(response.body.submissions.some((submission) => submission.id === modelGeneratedDraftSubmission.id && submission.artifactDraftModelUsed === true), 'Project submissions must include the model-backed generated progress brief submission.');
assert(response.body.submissions.some((submission) => submission.id === modelGeneratedDraftSubmission.id && submission.artifactDraftQuality?.readyForLocalPilot === true && submission.artifactDraftHumanReviewRequired === true), 'Project submissions must preserve model-backed draft quality and human-review metadata.');
const revisedProductBrief = response.body.submissions.find((submission) => submission.id === submissionsByType.get('product-brief')?.id);
const revisionNote = response.body.submissions.find((submission) => submission.artifactType === 'revision-note');
const finalDeliverable = response.body.submissions.find((submission) => submission.artifactType === 'final-deliverable');
assert(revisedProductBrief?.status === 'superseded' && revisedProductBrief.latestRevisionId, 'Original draft submission must be superseded by a linked revision.');
assert(revisionNote?.revisesSubmissionId === submissionsByType.get('product-brief')?.id, 'Revision note must link to the draft it revises.');
assert(revisionNote?.respondsToReviewId === reviewsByVerdict.get('changes-requested')?.id, 'Revision note must link to the review it answers.');
assert(finalDeliverable?.revisesSubmissionId === revisionNote?.id && finalDeliverable?.supersedesSubmissionIds?.includes(submissionsByType.get('product-brief')?.id), 'Final deliverable must preserve revision lineage.');

const finalSubmissionId = response.body.submissions.find((submission) => submission.artifactType === 'final-deliverable')?.id;
response = api.handle({ method: 'GET', path: `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmissionId)}` });
assert(response.status === 200 && /Final product-team validation package/.test(response.body.submission.title), 'Project API must read a single Agent submission.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/evidence-searches` });
assert(response.status === 200 && response.body.evidenceSearches.length === 1, 'Project API must list Agent evidence searches.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/evidence-searches/${encodeURIComponent(evidenceSearch.id)}` });
assert(response.status === 200 && response.body.evidenceSearch.confidence === 'high', 'Project API must read one Agent evidence search.');
assert(response.body.evidenceSearch.sourceSafetySummary?.sourceSafetyReady === true, 'Project API must preserve evidence source-safety summary.');
assert(response.body.evidenceSearch.sourceSnapshots?.length === 3 && response.body.evidenceSearch.providerReceipt?.schemaVersion === 'evidence-provider-receipt/v1', 'Project API must preserve source snapshots and provider receipt on the evidence search.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/evidence-quality-audit` });
assert(response.status === 200 && response.body.evidenceQualityAudit?.schemaVersion === 'evidence-quality-audit/v1', 'Project API must expose a standalone evidence quality audit contract.');
assert(response.body.evidenceQualityAudit.readyForDecision === true && response.body.evidenceQualityAudit.readyForProduction === false, 'Evidence quality audit must be decision-ready without overclaiming production readiness.');
assert(response.body.evidenceQualityAudit.summary?.rowCount === 1 && response.body.evidenceQualityAudit.summary?.sourceCount === 3, 'Evidence quality audit must summarize evidence search rows and source count.');
assert(response.body.evidenceQualityAudit.summary?.averageQualityScore >= 70 && response.body.evidenceQualityAudit.summary?.strongEvidenceCount === 1, 'Evidence quality audit must expose quality scoring and strong evidence count.');
assert(response.body.evidenceQualityAudit.summary?.sourceSafetyReady === true && response.body.evidenceQualityAudit.summary?.sourceSafetyBlockedSourceCount === 0, 'Evidence quality audit must expose source-safety readiness.');
assert(response.body.evidenceQualityAudit.summary?.sourceSnapshotCount === 3 && response.body.evidenceQualityAudit.summary?.providerReceiptCount === 1, 'Evidence quality audit must summarize source snapshots and provider receipts.');
assert(response.body.evidenceQualityAudit.rows.some((row) => row.id === evidenceSearch.id && row.proofRoute?.apiPath?.includes('/evidence-searches/')), 'Evidence quality audit must link each search row to a proof route.');
assert(response.body.evidenceQualityAudit.sourceRows.length === 3 && response.body.evidenceQualityAudit.sourceRows.every((row) => row.qualityScore >= 60 && row.sourceSafetyLevel === 'safe' && row.sourceSnapshotId && row.sourceSnapshotChecksum && row.providerReceiptId), 'Evidence quality audit must expose per-source quality, safety, snapshot, and receipt rows.');
assert(response.body.evidenceQualityAudit.sourceSnapshotRows.length === 3 && response.body.evidenceQualityAudit.providerReceiptRows.length === 1, 'Evidence quality audit must expose source snapshot and provider receipt rows.');
assert(response.body.evidenceQualityAudit.gates.some((gate) => gate.id === 'quality-judgement-ready' && gate.passed), 'Evidence quality audit must gate decision-quality evidence.');
assert(response.body.evidenceQualityAudit.gates.some((gate) => gate.id === 'source-safety-ready' && gate.passed), 'Evidence quality audit must gate source-safety readiness.');
assert(response.body.evidenceQualityAudit.gates.some((gate) => gate.id === 'source-snapshots-ready' && gate.passed), 'Evidence quality audit must gate source snapshot readiness.');
assert(response.body.evidenceQualityAudit.gates.some((gate) => gate.id === 'provider-receipts-ready' && gate.passed), 'Evidence quality audit must gate provider receipt readiness.');
assert(response.body.evidenceQualityAudit.requiredProductionControls.some((control) => control.id === 'calibrated-source-quality-policy'), 'Evidence quality audit must keep calibrated source-quality policy as an explicit production control.');
assert(response.body.evidenceQualityAudit.backendRoutes.evidenceQualityAudit?.endsWith('/evidence-quality-audit'), 'Evidence quality audit must expose its own backend route.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/brainstorm-layer` });
assert(response.status === 200 && response.body.brainstormLayer?.schemaVersion === 'brainstorm-layer/v1', 'Project API must expose a standalone brainstorm layer contract.');
assert(response.body.brainstormLayer.readyForPrivatePilotBrainstorm === true && response.body.brainstormLayer.readyForProduction === false, 'Brainstorm layer must be private-pilot ready without production overclaim.');
assert(response.body.brainstormLayer.summary?.brainstormBoardCount === 1 && response.body.brainstormLayer.summary?.alternativeCount >= 3, 'Brainstorm layer must summarize board count and visible alternatives.');
assert(response.body.brainstormLayer.gates.every((gate) => gate.passed), 'Brainstorm layer must pass all local generic brainstorm gates for the acceptance sample.');
assert(response.body.brainstormLayer.rows.some((row) => row.artifactType === 'brainstorm-board' && row.proofIds.length && row.timelineLogIds.length && row.eventIds.length), 'Brainstorm layer rows must preserve chat, timeline, and event proof.');
assert(response.body.brainstormLayer.backendRoutes.brainstormLayer?.endsWith('/brainstorm-layer'), 'Brainstorm layer must expose its own backend route.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/artifact-quality-audit` });
assert(response.status === 200 && response.body.artifactQualityAudit?.schemaVersion === 'artifact-quality-audit/v1', 'Project API must expose a standalone artifact quality audit contract.');
assert(response.body.artifactQualityAudit.readyForLocalPilot === true && response.body.artifactQualityAudit.readyForProduction === false, 'Artifact quality audit must be locally ready without production overclaim.');
assert(response.body.artifactQualityAudit.summary?.submissionCount === expectedSubmissionCount && response.body.artifactQualityAudit.summary?.failedLocalDecisionGateCount === 0, 'Artifact quality audit must cover all submissions with no failed local gates.');
assert(response.body.artifactQualityAudit.summary?.storageProofReadyCount === expectedSubmissionCount, 'Artifact quality audit must count checksummed artifact storage proof coverage for every submission.');
assert(response.body.artifactQualityAudit.gates.some((gate) => gate.id === 'generic-artifact-type-coverage' && gate.passed), 'Artifact quality audit must gate generic product-team artifact coverage.');
assert(response.body.artifactQualityAudit.gates.some((gate) => gate.id === 'artifact-storage-proof-ready' && gate.passed), 'Artifact quality audit must gate checksummed artifact storage proof coverage.');
assert(response.body.artifactQualityAudit.gates.some((gate) => gate.id === 'draft-review-revision-final-loop' && gate.passed), 'Artifact quality audit must gate the draft-review-revision-final loop.');
assert(response.body.artifactQualityAudit.backendRoutes.artifactQualityAudit?.endsWith('/artifact-quality-audit'), 'Artifact quality audit must expose its own backend route.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/submission-review-workflow` });
assert(response.status === 200 && response.body.submissionReviewWorkflow?.schemaVersion === 'submission-review-workflow/v1', 'Project API must expose a standalone submission review workflow contract.');
assert(response.body.submissionReviewWorkflow.readyForPrivatePilotReview === true && response.body.submissionReviewWorkflow.readyForProduction === false, 'Submission review workflow must close the private-pilot review loop without production overclaim.');
assert(response.body.submissionReviewWorkflow.summary?.reviewRoundCount >= 2 && response.body.submissionReviewWorkflow.summary?.openChangeRequestCount === 0, 'Submission review workflow must summarize review rounds and close requested changes.');
assert(response.body.submissionReviewWorkflow.summary?.revisionResponseCount >= 1 && response.body.submissionReviewWorkflow.summary?.acceptedFinalDeliverableCount >= 1, 'Submission review workflow must link revision responses and final deliverable acceptance.');
assert(response.body.submissionReviewWorkflow.roundRows.every((row) => row.proofReady && row.route && row.proofIds.length && row.timelineLogIds.length && row.eventIds.length), 'Submission review workflow rows must preserve proof routes, chat, timeline, and event evidence.');
assert(response.body.submissionReviewWorkflow.productionControls.some((control) => control.id === 'production-review-governance-blocked'), 'Submission review workflow must keep calibrated production review governance as a blocker.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/product-team-delivery-trace` });
assert(response.status === 200 && response.body.productTeamDeliveryTrace?.schemaVersion === 'product-team-delivery-trace/v1', 'Project API must expose a standalone product-team delivery trace contract.');
assert(response.body.productTeamDeliveryTrace.readyForPrivatePilotDelivery === true && response.body.productTeamDeliveryTrace.readyForProduction === false, 'Product-team delivery trace must close the private-pilot delivery loop without production overclaim.');
assert(response.body.productTeamDeliveryTrace.summary?.readyCount === response.body.productTeamDeliveryTrace.summary?.rowCount && response.body.productTeamDeliveryTrace.summary?.acceptedFinalDeliverableCount >= 1, 'Product-team delivery trace must show every required stage ready and final delivery accepted.');
assert(response.body.productTeamDeliveryTrace.rows.some((row) => row.id === 'brainstorm-layer' && row.ready && row.artifactIds.length), 'Product-team delivery trace must include a proofed brainstorm stage.');
assert(response.body.productTeamDeliveryTrace.rows.some((row) => row.id === 'review-and-revision' && row.ready && row.reviewIds.length), 'Product-team delivery trace must include a proofed review/revision stage.');
assert(response.body.productTeamDeliveryTrace.rows.every((row) => row.ready && (row.proofIds.length || row.timelineLogIds.length || row.eventIds.length)), 'Every ready product-team delivery trace row must carry proof, timeline, or event evidence.');
assert(response.body.productTeamDeliveryTrace.backendRoutes?.productTeamDeliveryTrace?.endsWith('/product-team-delivery-trace'), 'Product-team delivery trace must expose its own backend route.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/product-team-operating-loop` });
assert(response.status === 200 && response.body.productTeamOperatingLoop?.schemaVersion === 'product-team-operating-loop/v1', 'Project API must expose a standalone product-team operating loop contract.');
assert(response.body.productTeamOperatingLoop.readyForLocalPilotOperatingLoop === true && response.body.productTeamOperatingLoop.readyForProduction === false, 'Product-team operating loop must prove local C/A autonomy without production overclaim.');
assert(response.body.productTeamOperatingLoop.status === 'local-autonomous-product-team-loop-ready', `Product-team operating loop must be locally ready after the generic acceptance chain. Actual: ${response.body.productTeamOperatingLoop.status}`);
assert(response.body.productTeamOperatingLoop.customerSide?.nextAction?.runApiPath?.includes('/autonomous-run-control/'), 'Product-team operating loop must route C-side continuation through Autonomous Run Control.');
assert(response.body.productTeamOperatingLoop.customerSide?.handoff?.schemaVersion === 'product-team-customer-agent-handoff/v1' && response.body.productTeamOperatingLoop.customerSide.handoff.runApiPath?.endsWith('/autonomous-run-control/run-backend-scheduler-tick/run'), 'Product-team operating loop must expose the Mission Runner C/A handoff as a runnable continuation route.');
assert(response.body.productTeamOperatingLoop.customerSide?.handoffExecution?.schemaVersion === 'product-team-customer-agent-handoff-execution/v1' && response.body.productTeamOperatingLoop.customerSide.handoffExecution.sessionId, 'Product-team operating loop must expose the Mission Runner C/A handoff execution read model and A-side session linkage.');
assert(typeof response.body.productTeamOperatingLoop.summary?.customerAgentHandoffExecutionStatus === 'string' && response.body.productTeamOperatingLoop.summary.customerAgentHandoffExecutionRunReceiptCount >= 0, 'Product-team operating loop summary must preserve C/A handoff execution status and receipt counts.');
assert(response.body.productTeamOperatingLoop.agentSide?.selectedActions?.length > 0 && response.body.productTeamOperatingLoop.agentSide?.queueCount >= team.length, 'Product-team operating loop must summarize A-side Agent strategy selections.');
assert(response.body.productTeamOperatingLoop.agentSide?.initiativeRows?.length >= team.length && response.body.productTeamOperatingLoop.agentSide.initiativeRows.every((row) => row.schemaVersion === 'agent-autonomous-initiative/v1' && row.intent && row.selectedAction && row.artifactType && row.runApiPath?.includes('/agent-autonomous-action-queue/')), 'Product-team operating loop must expose A-side Agent initiative rows with intent, artifact target, and runnable backend route.');
assert(response.body.productTeamOperatingLoop.agentSide?.targetArtifactTypes?.length > 0 && response.body.productTeamOperatingLoop.summary?.agentInitiativeCount >= team.length, 'Product-team operating loop summary must preserve Agent initiative artifact targets.');
assert(response.body.productTeamOperatingLoop.deliveryLoop?.readyStageIds?.includes('final-deliverable') && response.body.productTeamOperatingLoop.deliveryLoop?.missingStageIds?.length === 0, 'Product-team operating loop must see the generic delivery trace through final deliverable.');
assert(response.body.productTeamOperatingLoop.executionLoop?.runnableActionCount >= 1 && response.body.productTeamOperatingLoop.executionLoop?.workerQueuedCount >= team.length, 'Product-team operating loop must expose runnable scheduler/worker continuation.');
assert(response.body.productTeamOperatingLoop.proofLoop?.proofRouteCount > 0 && response.body.productTeamOperatingLoop.proofLoop?.timelineLogIds?.length > 0 && response.body.productTeamOperatingLoop.proofLoop?.eventIds?.length > 0, 'Product-team operating loop must preserve proof, timeline, and event traceability.');
assert(response.body.productTeamOperatingLoop.gates?.some((gate) => gate.id === 'production-autonomy-boundary' && gate.productionBlocker && gate.passed === false), 'Product-team operating loop must keep public production autonomy blocked until managed controls exist.');
assert(response.body.productTeamOperatingLoop.backendRoutes?.productTeamOperatingLoop?.endsWith('/product-team-operating-loop'), 'Product-team operating loop must expose its own backend route.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/team-collaboration-diagnostics` });
assert(response.status === 200 && response.body.teamCollaborationDiagnostics?.schemaVersion === 'team-collaboration-diagnostics/v1', 'Project API must expose standalone team collaboration diagnostics.');
assert(response.body.teamCollaborationDiagnostics.readyForLocalPilotCollaboration === true && response.body.teamCollaborationDiagnostics.readyForProduction === false, `Team collaboration diagnostics must prove the local C/A chain without production overclaim. Actual: ${response.body.teamCollaborationDiagnostics.status}`);
assert(response.body.teamCollaborationDiagnostics.diagnosticRows?.some((row) => row.id === 'group-chat-collaboration-visible' && row.passed && row.apiPath?.endsWith('/transcripts')), 'Team collaboration diagnostics must prove group chat transcript visibility.');
assert(response.body.teamCollaborationDiagnostics.diagnosticRows?.some((row) => row.id === 'artifact-review-revision-final' && row.passed && row.proofIds.length && row.timelineLogIds.length && row.eventIds.length), 'Team collaboration diagnostics must prove artifact, review, revision, and final-deliverable closure.');
assert(response.body.teamCollaborationDiagnostics.diagnosticRows?.some((row) => row.id === 'autonomous-continuation-visible' && row.passed && row.apiPath?.endsWith('/product-team-operating-loop')), 'Team collaboration diagnostics must prove C-side/A-side autonomous continuation from the operating loop.');
assert(response.body.teamCollaborationDiagnostics.handoffBreaks?.length === 0, 'Team collaboration diagnostics must not report local handoff breaks after the generic acceptance chain closes.');
assert(response.body.teamCollaborationDiagnostics.backendRoutes?.teamCollaborationDiagnostics?.endsWith('/team-collaboration-diagnostics'), 'Team collaboration diagnostics must expose its own backend route.');
assert(response.body.teamCollaborationDiagnostics.requiredProductionControls?.includes('real-provider-and-byok-policy'), 'Team collaboration diagnostics must keep production provider/BYOK controls explicit.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/collaboration-intent-queue` });
assert(response.status === 200 && response.body.collaborationIntentQueue?.schemaVersion === 'collaboration-intent-queue/v1', 'Project API must expose a standalone collaboration intent queue contract.');
assert(response.body.collaborationIntentQueue.readyForLocalPilotIntentQueue === true && response.body.collaborationIntentQueue.readyForProduction === false, `Collaboration intent queue must prove local meeting/chat/Agent intent routing without production overclaim. Actual: ${response.body.collaborationIntentQueue.status}`);
assert(response.body.collaborationIntentQueue.meetingProtocol?.schemaVersion === 'collaboration-intent-protocol/v1' && response.body.collaborationIntentQueue.meetingProtocol.ready === true, 'Collaboration intent queue must expose the meeting intent protocol.');
assert(response.body.collaborationIntentQueue.rows?.some((row) => row.id === 'kickoff-role-self-marketing-intent' && row.lane === 'meeting-intent' && row.proofIds.length), 'Collaboration intent queue must include kickoff self-marketing and role-negotiation meeting intent.');
assert(response.body.collaborationIntentQueue.rows?.some((row) => row.id === 'group-chat-attention-intent' && row.lane === 'chat-intent' && row.apiPath?.endsWith('/transcripts/main')), 'Collaboration intent queue must include group-chat attention intent.');
assert(response.body.collaborationIntentQueue.rows?.some((row) => row.id === 'customer-agent-handoff-intent' && row.source === 'product-team-customer-agent-handoff' && row.canRun && row.runApiPath?.endsWith('/autonomous-run-control/run-backend-scheduler-tick/run')), 'Collaboration intent queue must include a runnable Mission Runner C/A handoff intent.');
assert(response.body.collaborationIntentQueue.rows?.filter((row) => row.source === 'agent-autonomous-initiative' && row.runApiPath?.includes('/agent-autonomous-action-queue/')).length >= team.length, 'Collaboration intent queue must include one runnable A-side initiative row per Agent.');
assert(response.body.collaborationIntentQueue.rows?.some((row) => row.id === 'review-revision-final-intent' && row.lane === 'review-intent' && row.proofIds.length && row.timelineLogIds.length && row.eventIds.length), 'Collaboration intent queue must include review, revision, and final-deliverable closure intent.');
assert(response.body.collaborationIntentQueue.nextRunnableIntent?.runApiPath && response.body.collaborationIntentQueue.proofIds.length && response.body.collaborationIntentQueue.timelineLogIds.length && response.body.collaborationIntentQueue.eventIds.length, 'Collaboration intent queue must preserve next runnable route plus proof, timeline, and event evidence.');
assert(response.body.collaborationIntentQueue.backendRoutes?.collaborationIntentQueue?.endsWith('/collaboration-intent-queue'), 'Collaboration intent queue must expose its own backend route.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/runtime-contracts` });
assert(response.status === 200 && response.body.runtimeContracts?.schemaVersion === 'runtime-contract-freeze/v1', 'Project API must expose standalone runtime contract freeze manifest.');
assert(response.body.runtimeContracts.readyForLocalPilotContractFreeze === true && response.body.runtimeContracts.readyForProduction === false, `Runtime contracts must be locally frozen without production overclaim. Actual: ${response.body.runtimeContracts.status}`);
assert(response.body.runtimeContracts.contractRows?.some((row) => row.id === 'agent-submission-artifact-contract' && row.ready && row.schemaVersions.includes('agent-artifact-storage-proof/v1')), 'Runtime contracts must freeze the Agent submission/artifact storage proof contract.');
assert(response.body.runtimeContracts.contractRows?.some((row) => row.id === 'evidence-search-contract' && row.ready && row.schemaVersions.includes('agent-evidence-search/v1')), 'Runtime contracts must freeze the evidence/search contract.');
assert(response.body.runtimeContracts.contractRows?.some((row) => row.id === 'review-revision-final-contract' && row.ready && row.schemaVersions.includes('submission-review-workflow/v1')), 'Runtime contracts must freeze the review/revision/final contract.');
assert(response.body.runtimeContracts.contractRows?.some((row) => row.id === 'production-runtime-contract-boundary' && row.productionBlocker && row.ready === false), 'Runtime contracts must keep managed-production runtime controls as a visible blocker.');
assert(response.body.runtimeContracts.failedLocalContracts?.length === 0, 'Runtime contracts must not report missing local MVP contracts after the generic acceptance chain closes.');
assert(response.body.runtimeContracts.backendRoutes?.runtimeContracts?.endsWith('/runtime-contracts'), 'Runtime contracts must expose its own backend route.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/evidence-source-review-workflow` });
assert(response.status === 200 && response.body.evidenceSourceReviewWorkflow?.schemaVersion === 'evidence-source-review-workflow/v1', 'Project API must expose a standalone evidence source review workflow contract.');
assert(response.body.evidenceSourceReviewWorkflow.summary?.reviewItemCount === 3, 'Evidence source review workflow must derive one review item per evidence source before decisions are submitted.');
const initialEvidenceSourceReviewWorkflow = response.body.evidenceSourceReviewWorkflow;
const evidenceSourceReviewDecisions = [];
for (const [index, item] of initialEvidenceSourceReviewWorkflow.reviewItems.entries()) {
  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/evidence-source-review-workflow`,
    body: {
      reviewerAgentId: 'curie',
      evidenceSearchId: item.evidenceSearchId,
      sourceId: item.sourceId,
      decision: 'approved',
      comments: `Approved source ${index + 1} for product-team local pilot evidence use.`,
      requestedActions: ['Use as governed supporting evidence in the product-team deliverable.'],
      now: `2026-06-01T10:${25 + index}:00.000Z`,
    },
  });
  assert(response.status === 200 && response.body.evidenceSourceReview?.schemaVersion === 'evidence-source-review/v1', 'Project API must accept Reviewer source review decisions.');
  assert(response.body.evidenceSourceReview.decision === 'approved' && response.body.evidenceSourceReview.messageId && response.body.evidenceSourceReview.timelineLogId && response.body.evidenceSourceReview.eventId, 'Evidence source review decisions must create chat, timeline, and event proof.');
  assert(response.body.evidenceSourceReviewWorkflow?.summary?.sourceReviewDecisionCount >= index + 1, 'Source review workflow must reflect submitted source decisions immediately.');
  evidenceSourceReviewDecisions.push(response.body.evidenceSourceReview);
}

response = api.handle({ method: 'GET', path: `/projects/${projectId}/evidence-source-review-workflow` });
assert(response.status === 200 && response.body.evidenceSourceReviewWorkflow?.schemaVersion === 'evidence-source-review-workflow/v1', 'Project API must read the updated evidence source review workflow contract.');
assert(response.body.evidenceSourceReviewWorkflow.readyForLocalPilot === true && response.body.evidenceSourceReviewWorkflow.readyForProduction === false, 'Evidence source review workflow must be local-pilot ready without overclaiming production readiness.');
assert(response.body.evidenceSourceReviewWorkflow.summary?.reviewItemCount === 3 && response.body.evidenceSourceReviewWorkflow.summary?.blockedSourceCount === 0, 'Evidence source review workflow must derive one review item per evidence source and keep blocked sources at zero.');
assert(response.body.evidenceSourceReviewWorkflow.summary?.sourceReviewDecisionCount === 3 && response.body.evidenceSourceReviewWorkflow.summary?.pendingDecisionSourceCount === 0, 'Evidence source review workflow must require and count submitted Reviewer source decisions.');
assert(response.body.evidenceSourceReviewWorkflow.summary?.approvedSourceReviewCount === 3, 'Evidence source review workflow must count approved source decisions.');
assert(response.body.evidenceSourceReviewWorkflow.reviewItems.every((item) => item.sourceId && item.evidenceSearchId === evidenceSearch.id && item.proofRoute?.apiPath?.includes('/evidence-searches/')), 'Every source review item must link to the evidence search proof route.');
assert(response.body.evidenceSourceReviewWorkflow.reviewItems.every((item) => item.sourceSnapshotId && item.sourceSnapshotChecksum && item.providerReceiptId), 'Every source review item must expose source snapshot and provider receipt ids.');
assert(response.body.evidenceSourceReviewWorkflow.reviewItems.every((item) => item.latestDecision?.decision === 'approved' && item.reviewDecisionRoute?.includes('/evidence-source-review-workflow#')), 'Every source review item must link to the latest Reviewer source decision.');
assert(response.body.evidenceSourceReviewWorkflow.gates.some((gate) => gate.id === 'source-review-proof-routes-ready' && gate.passed), 'Evidence source review workflow must gate source proof routes.');
assert(response.body.evidenceSourceReviewWorkflow.gates.some((gate) => gate.id === 'source-review-decisions-ready' && gate.passed), 'Evidence source review workflow must gate submitted source review decisions.');
assert(response.body.evidenceSourceReviewWorkflow.requiredProductionControls.some((control) => control.id === 'human-source-review-policy'), 'Evidence source review workflow must keep human source-review policy as a production control.');
assert(response.body.evidenceSourceReviewWorkflow.backendRoutes.evidenceSourceReviewWorkflow?.endsWith('/evidence-source-review-workflow'), 'Evidence source review workflow must expose its own backend route.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/evidence-custody-readiness` });
assert(response.status === 200 && response.body.evidenceCustodyReadiness?.schemaVersion === 'evidence-custody-readiness/v1', 'Project API must expose a standalone evidence custody readiness contract.');
assert(response.body.evidenceCustodyReadiness.readyForPrivatePilot === true && response.body.evidenceCustodyReadiness.readyForProduction === false, 'Evidence custody readiness must be local-ready without overclaiming production storage.');
assert(response.body.evidenceCustodyReadiness.summary?.sourceSnapshotCount === 3 && response.body.evidenceCustodyReadiness.summary?.providerReceiptCount === 1, 'Evidence custody readiness must count source snapshots and provider receipts.');
assert(response.body.evidenceCustodyReadiness.summary?.sourceReviewDecisionCount === 3 && response.body.evidenceCustodyReadiness.summary?.custodyRecordCount === 4, 'Evidence custody readiness must count source review decisions and custody records.');
assert(response.body.evidenceCustodyReadiness.gates.every((gate) => gate.passed || gate.severity === 'warning'), 'Evidence custody readiness local gates must pass for the acceptance scenario.');
assert(response.body.evidenceCustodyReadiness.gates.some((gate) => gate.id === 'persistence-custody-table-coverage' && gate.passed), 'Evidence custody readiness must gate persistence table coverage.');
assert(response.body.evidenceCustodyReadiness.requiredProductionControls.some((control) => control.id === 'managed-immutable-object-storage' && control.status === 'blocked'), 'Evidence custody readiness must keep managed immutable storage as a production blocker.');
assert(response.body.evidenceCustodyReadiness.backendRoutes.evidenceCustodyReadiness?.endsWith('/evidence-custody-readiness'), 'Evidence custody readiness must expose its own backend route.');
assert(!JSON.stringify(response.body.evidenceCustodyReadiness).includes(FAKE_SEARCH_SECRET), 'Evidence custody readiness must not expose the search secret fixture.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/submission-reviews` });
assert(response.status === 200 && response.body.submissionReviews.length === 2, 'Project API must list submission reviews.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/submission-reviews/${encodeURIComponent(reviewsByVerdict.get('accepted').id)}` });
assert(response.status === 200 && response.body.submissionReview.verdict === 'accepted', 'Project API must read one submission review.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-dashboard` });
assert(response.status === 200 && response.body.submissions.count === expectedSubmissionCount, 'Manager Dashboard must expose submission summary, including generated artifact drafts.');
assert(response.body.submissions.generatedDraftCount === 2 && response.body.submissions.localGeneratedDraftCount === 1 && response.body.submissions.modelGeneratedDraftCount === 1, 'Manager Dashboard must count local and model generated artifact drafts without production overclaim.');
assert(response.body.submissions.draftQualityReadyCount === 2 && response.body.submissions.modelDraftHumanReviewRequiredCount === 1, 'Manager Dashboard must count generated draft quality readiness and model human-review requirements.');
assert(response.body.submissions.rows.some((row) => row.id === generatedDraftSubmission.id && row.isGeneratedDraft && row.artifactDraftId === response.body.submissions.rows.find((candidate) => candidate.id === generatedDraftSubmission.id)?.artifactDraft?.draftId && row.artifactDraftRoute?.includes('/artifact-drafts')), 'Manager Dashboard submission rows must expose generated draft metadata and route.');
assert(response.body.submissions.rows.some((row) => row.id === modelGeneratedDraftSubmission.id && row.isGeneratedDraft && row.artifactDraftModelUsed === true && row.artifactDraftSource === 'model-artifact-draft'), 'Manager Dashboard submission rows must expose model-backed draft provenance.');
assert(response.body.submissions.rows.some((row) => row.id === generatedDraftSubmission.id && row.artifactDraftQuality?.readyForLocalPilot === true && row.artifactDraftQualityStatus === 'local-quality-ready'), 'Manager Dashboard rows must expose local generated draft quality readiness.');
assert(response.body.submissions.rows.some((row) => row.id === modelGeneratedDraftSubmission.id && row.artifactDraftQuality?.readyForLocalPilot === true && row.artifactDraftHumanReviewRequired === true), 'Manager Dashboard rows must expose model generated draft quality readiness and human-review requirement.');
assert(response.body.submissions.finalDeliverableCount === 1, 'Manager Dashboard must count final deliverables.');
assert(response.body.submissions.revisionCount >= 2 && response.body.submissions.supersededCount >= 2, 'Manager Dashboard must summarize revision lineage and superseded submissions.');
assert(response.body.evidenceSearches.count === 1 && response.body.evidenceSearches.sourceCount === 3, 'Manager Dashboard must expose evidence search summary.');
assert(response.body.evidenceSearches.averageQualityScore >= 70 && response.body.evidenceSearches.strongEvidenceCount === 1, 'Manager Dashboard must expose evidence quality summary.');
assert(response.body.evidenceSearches.sourceSafetyReadyCount === 1 && response.body.evidenceSearches.sourceSafetyBlockedSourceCount === 0, 'Manager Dashboard must expose source-safety summary.');
assert(response.body.evidenceSearches.sourceSnapshotCount === 3 && response.body.evidenceSearches.providerReceiptCount === 1, 'Manager Dashboard must expose source snapshot and provider receipt counts.');
assert(response.body.evidenceSourceReviews.count === 3 && response.body.evidenceSourceReviews.approvedCount === 3, 'Manager Dashboard must expose evidence source review decisions.');
assert(response.body.evidenceSourceReviews.rows.every((row) => row.proofRoute?.includes('/evidence-source-review-workflow#') && row.evidenceSearchRoute?.includes('/evidence-searches/')), 'Manager Dashboard source review rows must expose proof and evidence search routes.');
assert(response.body.submissionReviews.acceptedCount === 1 && response.body.submissionReviews.changesRequestedCount === 1, 'Manager Dashboard must expose review summary.');
assert(response.body.brainstormLayer?.schemaVersion === 'brainstorm-layer/v1' && response.body.brainstormLayer?.readyForPrivatePilotBrainstorm === true && response.body.brainstormLayer?.route?.endsWith('/brainstorm-layer'), 'Manager Dashboard must expose a ready generic brainstorm layer summary and route.');
assert(response.body.autonomousRunControl?.schemaVersion === 'autonomous-run-control/v1', 'Manager Dashboard must expose the autonomous run control contract.');
assert(response.body.autonomousRunControl?.backendRoutes?.autonomousRunControl?.endsWith('/autonomous-run-control') && response.body.autonomousRunControl?.backendRoutes?.schedulerTick === '/workers/autonomous/tick', 'Autonomous run control must expose backend run and scheduler routes.');
assert(response.body.autonomousRunControl?.nextActions?.some((row) => row.id === 'run-backend-scheduler-tick' && row.canRun), 'Autonomous run control must expose a runnable scheduler tick action for the product-team loop.');
assert(response.body.autonomousRunControl?.nextActions?.every((row) => row.runApiPath?.includes('/autonomous-run-control/')), 'Autonomous run control next actions must expose unified run routes.');
assert(response.body.autonomousRunControl?.nextActions?.some((row) => row.lane === 'agent-autonomy' && row.initiative?.schemaVersion === 'agent-autonomous-initiative/v1' && row.initiativeId && row.initiativeArtifactType), 'Autonomous run control Agent actions must carry Agent initiative proof into the C-side run surface.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/autonomous-run-control` });
assert(response.status === 200 && response.body.autonomousRunControl?.schemaVersion === 'autonomous-run-control/v1', 'Project API must expose standalone autonomous run control.');
assert(response.body.autonomousRunControl?.summary?.runnableActionCount >= 1 && response.body.autonomousRunControl?.workerQueue?.schemaVersion === 'worker-queue-snapshot/v1', 'Standalone autonomous run control must summarize runnable work and worker queue proof.');
assert(response.body.autonomousRunControl?.backendRoutes?.autonomousRunControlRunTemplate?.endsWith('/autonomous-run-control/:actionId/run'), 'Standalone autonomous run control must expose the unified run route template.');
assert(!response.body.autonomousRunControl?.nextActions?.some((row) => row.id === 'run-mvp-readiness-target' && row.targetStageId === 'brainstorm-layer'), 'Autonomous Run Control must drop stale MVP readiness targets after the targeted core gap closes.');

progress('initial manager ready package read starting');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-ready-package` });
progress('initial manager ready package read completed');
assert(response.status === 200 && response.body.mvpReadiness?.readyForLocalPilot, 'Manager Ready Package must include a local-pilot-ready MVP readiness gate.');
assert(response.body.mvpReadiness?.readyForProduction === false, 'MVP readiness must not claim production readiness while production blockers remain.');
assert(response.body.mvpReadiness?.production?.blockerCount >= 3, 'MVP readiness must enumerate production blockers.');
assert(response.body.summary?.mvpCorePassedCount === response.body.summary?.mvpCoreTotalCount, 'Manager Ready Package summary must expose full MVP core coverage.');
assert(response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Manager Ready Package must include the security boundary contract.');
assert(response.body.securityBoundary?.status === 'local-boundary-ready', 'Security boundary must pass local redaction scanning.');
assert(response.body.securityBoundary?.readyForProduction === false, 'Security boundary must not claim production readiness before auth/RBAC/vault hardening.');
assert(response.body.securityBoundary?.redactionScan?.rawLeakCount === 0, 'Security boundary must not detect raw secret fixture leakage.');
assert(response.body.securityBoundary?.redactionScan?.redactionMarkerCount > 0, 'Security boundary must prove secret-bearing fields were redacted.');
assert(response.body.securityBoundary?.accessControl?.schemaVersion === 'access-control-policy/v1', 'Security boundary must include the access-control policy contract.');
assert(response.body.securityBoundary?.accessControl?.status === 'enforceable-prototype-policy', 'Security boundary must expose an enforceable prototype access policy.');
assert(response.body.securityBoundary?.accessControl?.replayProtectionContract?.requestIdHeader === 'x-hofs-request-id', 'Security boundary must expose the signed request replay-protection contract.');
assert(response.body.securityBoundary?.accessControl?.auditWriteContract?.failureStatusCode === 503, 'Security boundary must expose the audit fail-closed contract.');
assert(response.body.securityBoundary?.accessControl?.projectMembershipContract?.schemaVersion === 'project-membership-policy/v1', 'Security boundary must expose the project membership policy contract.');
assert(response.body.securityBoundary?.secretVault?.ready === true && response.body.securityBoundary?.secretVault?.encryptedRecordCount === 2, 'Security boundary must expose the local encrypted secret-vault contract.');
assert(response.body.securityBoundary?.secretVault?.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1', 'Security boundary must expose the local secret-vault rotation receipt.');
assert(response.body.securityBoundary?.summary?.secretVaultRotationReady === true, 'Security boundary summary must expose secret-vault rotation readiness.');
assert(response.body.securityBoundary?.production?.rows?.some((control) => control.id === 'encrypted-secret-vault' && control.status === 'local-control-ready'), 'Security boundary must mark only the local encrypted vault rehearsal ready before managed KMS receipts are recorded.');
assert(response.body.securityBoundary?.production?.missingControlIds?.includes('managed-kms-secret-manager'), 'Security boundary must expose the missing managed KMS security control id.');
assert(response.body.productionSecurityControlReceiptWorkflow?.schemaVersion === 'production-security-control-receipt-workflow/v1', 'Manager Ready Package must include production security control receipt workflow.');
assert(response.body.productionSecurityControlReceiptWorkflow?.readyForProductionSecurity === false && response.body.productionSecurityControlReceiptWorkflow?.summary?.missingControlCount > 0, 'Production security control receipt workflow must require managed identity, KMS, RBAC, audit, and replay hardening evidence.');
assert(response.body.summary?.productionSecurityMissingControlCount === response.body.productionSecurityControlReceiptWorkflow?.summary?.missingControlCount, 'Manager Ready Package summary must expose missing production security control counts.');
assert(response.body.brainstormLayer?.schemaVersion === 'brainstorm-layer/v1' && response.body.brainstormLayer?.readyForPrivatePilotBrainstorm === true, 'Manager Ready Package must embed the generic brainstorm layer contract.');
assert(response.body.summary?.brainstormLayerReady === true && response.body.summary?.brainstormLayerAlternativeCount >= 3, 'Manager Ready Package summary must expose brainstorm layer readiness and alternatives.');
assert(response.body.artifactQualityAudit?.schemaVersion === 'artifact-quality-audit/v1', 'Manager Ready Package must include the artifact quality audit contract.');
assert(response.body.artifactQualityAudit?.status === 'local-artifact-quality-ready' && response.body.artifactQualityAudit?.readyForLocalPilot === true && response.body.artifactQualityAudit?.readyForProduction === false, 'Artifact quality audit must pass locally without production overclaim.');
assert(response.body.artifactQualityAudit?.summary?.submissionCount === expectedSubmissionCount && response.body.artifactQualityAudit?.summary?.missingArtifactTypeCount === 0, 'Artifact quality audit must cover all generic product-team submission types.');
assert(response.body.artifactQualityAudit?.summary?.proofReadyCount === expectedSubmissionCount && response.body.artifactQualityAudit?.summary?.qualityReadyCount === expectedSubmissionCount, 'Artifact quality audit must mark every submission proof-ready and locally quality-ready.');
assert(response.body.artifactQualityAudit?.summary?.storageProofReadyCount === expectedSubmissionCount && response.body.artifactQualityAudit?.gates?.some((gate) => gate.id === 'artifact-storage-proof-ready' && gate.passed), 'Artifact quality audit must prove every Agent submission has checksummed file storage proof.');
assert(response.body.artifactQualityAudit?.gates?.every((gate) => gate.passed), 'Artifact quality audit gates must all pass for the acceptance scenario.');
assert(response.body.artifactQualityAudit?.requiredProductionControls?.some((control) => control.id === 'calibrated-artifact-quality-rubric' && control.status === 'blocked'), 'Artifact quality audit must keep calibrated production rubric as an explicit blocker.');
assert(response.body.summary?.artifactQualityReady === true && response.body.summary?.artifactQualityFailedLocalGateCount === 0 && response.body.summary?.artifactQualitySubmissionCount === expectedSubmissionCount, 'Manager Ready Package summary must expose artifact quality readiness.');
assert(response.body.submissionReviewWorkflow?.schemaVersion === 'submission-review-workflow/v1', 'Manager Ready Package must include the submission review workflow contract.');
assert(response.body.submissionReviewWorkflow?.readyForPrivatePilotReview === true && response.body.submissionReviewWorkflow?.readyForProduction === false, 'Submission review workflow must pass locally without production overclaim.');
assert(response.body.submissionReviewWorkflow?.summary?.openChangeRequestCount === 0 && response.body.submissionReviewWorkflow?.summary?.acceptedFinalDeliverableCount >= 1, 'Submission review workflow must close change requests and preserve final deliverable acceptance.');
assert(response.body.summary?.submissionReviewWorkflowReady === true && response.body.summary?.submissionReviewOpenChangeRequestCount === 0, 'Manager Ready Package summary must expose submission review workflow readiness.');
assert(response.body.productTeamDeliveryTrace?.schemaVersion === 'product-team-delivery-trace/v1', 'Manager Ready Package must include the product-team delivery trace contract.');
assert(response.body.productTeamDeliveryTrace?.readyForPrivatePilotDelivery === true && response.body.productTeamDeliveryTrace?.readyForProduction === false, 'Product-team delivery trace must pass locally without production overclaim.');
assert(response.body.productTeamDeliveryTrace?.summary?.readyCount === response.body.productTeamDeliveryTrace?.summary?.rowCount && response.body.productTeamDeliveryTrace?.summary?.acceptedFinalDeliverableCount >= 1, 'Product-team delivery trace must expose a closed kickoff-to-final-delivery path.');
assert(response.body.summary?.productTeamDeliveryTraceReady === true && response.body.summary?.productTeamDeliveryTraceMissingCount === 0, 'Manager Ready Package summary must expose product-team delivery trace readiness.');
assert(response.body.autonomousRunControl?.schemaVersion === 'autonomous-run-control/v1' && response.body.autonomousRunControl?.workerQueue?.schemaVersion === 'worker-queue-snapshot/v1', 'Manager Ready Package must include autonomous run control with worker queue proof.');
assert(response.body.autonomousRunControl?.summary?.runnableActionCount >= 1 && response.body.autonomousRunControl?.summary?.workerQueuedCount >= team.length, 'Autonomous run control must summarize runnable actions and queued Agent worker rows.');
assert(response.body.summary?.autonomousRunControlRunnableCount === response.body.autonomousRunControl?.summary?.runnableActionCount && response.body.summary?.autonomousRunControlChecksum === response.body.autonomousRunControl?.checksum, 'Manager Ready Package summary must expose autonomous run control status and checksum.');
assert(response.body.privatePilotGoLiveReadiness?.schemaVersion === 'private-pilot-go-live-readiness/v1', 'Manager Ready Package must include the private-pilot go-live readiness command view.');
assert(response.body.privatePilotGoLiveReadiness?.readyForPrivatePilotGoLive === false && response.body.privatePilotGoLiveReadiness?.readyForProduction === false, 'Initial private-pilot go-live readiness must wait for release receipts without production overclaim.');
assert(response.body.privatePilotGoLiveReadiness?.stageRows?.length >= 8 && response.body.privatePilotGoLiveReadiness?.nextAction?.apiPath, 'Private-pilot go-live readiness must expose stage rows and a routed next action.');
assert(response.body.summary?.privatePilotGoLiveStatus === response.body.privatePilotGoLiveReadiness?.status && response.body.summary?.privatePilotGoLiveFailedStageCount >= 1, 'Manager Ready Package summary must expose private-pilot go-live status and missing stages.');
assert(response.body.productionLaunchGapRegister?.schemaVersion === 'production-launch-gap-register/v1', 'Manager Ready Package must include the production launch gap register.');
assert(response.body.productionLaunchGapRegister?.readyForProduction === false && response.body.productionLaunchGapRegister?.gapRows?.length >= 5, 'Production launch gap register must keep production blocked with actionable gap rows.');
assert(response.body.productionLaunchGapRegister?.nextAction?.apiPath && response.body.productionLaunchGapRegister?.summary?.openGapCount === response.body.productionLaunchGapRegister?.gapRows?.length, 'Production launch gap register must expose routed next action and open gap count.');
assert(response.body.productionLaunchGapRegister?.gapRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.apiPath?.endsWith('/production-evidence-integrity-audit')), 'Production launch gap register must expose managed-production evidence integrity as a routed production gap.');
assert(response.body.summary?.productionLaunchGapStatus === response.body.productionLaunchGapRegister?.status && response.body.summary?.productionLaunchGapOpenCount === response.body.productionLaunchGapRegister?.summary?.openGapCount, 'Manager Ready Package summary must expose production launch gap status and counts.');
assert(response.body.productionLaunchControlCenter?.schemaVersion === 'production-launch-control-center/v1', 'Manager Ready Package must include the production launch control center.');
assert(response.body.productionLaunchControlCenter?.readyForProduction === false && response.body.productionLaunchControlCenter?.productionDecision === 'no-go', 'Production launch control center must keep public production blocked.');
assert(response.body.productionLaunchControlCenter?.controlRows?.length >= 8 && response.body.productionLaunchControlCenter?.nextAction?.apiPath, 'Production launch control center must expose release controls and a routed next action.');
assert(response.body.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.ready === false && row.apiPath?.endsWith('/production-evidence-integrity-audit')), 'Production launch control center must include managed-production evidence integrity as a blocked launch control before production evidence exists.');
assert(response.body.summary?.productionLaunchControlStatus === response.body.productionLaunchControlCenter?.status && response.body.summary?.productionLaunchControlBlockedCount === response.body.productionLaunchControlCenter?.summary?.blockedControlCount, 'Manager Ready Package summary must expose production launch control status and blocked count.');
assert(response.body.productionLaunchEvidenceDossier?.schemaVersion === 'production-launch-evidence-dossier/v1', 'Manager Ready Package must include the production launch evidence dossier.');
assert(response.body.productionLaunchEvidenceDossier?.readyForProduction === false && response.body.productionLaunchEvidenceDossier?.productionDecision === 'no-go', 'Production launch evidence dossier must not overclaim production readiness.');
assert(response.body.productionLaunchEvidenceDossier?.summary?.manifestEntryCount >= 9 && response.body.productionLaunchEvidenceDossier?.manifest?.some((row) => row.id === 'production-launch-control-center') && response.body.productionLaunchEvidenceDossier?.manifest?.some((row) => row.id === 'production-evidence-integrity-audit'), 'Production launch evidence dossier must aggregate the launch manifest.');
assert(response.body.productionLaunchEvidenceDossier?.controlDomainRows?.length === 4 && ['operations', 'deployment', 'security', 'provider'].every((domain) => response.body.productionLaunchEvidenceDossier.controlDomainRows.some((row) => row.id === domain)), 'Production launch evidence dossier must expose every production control domain.');
assert(response.body.productionLaunchEvidenceDossier?.backendRoutes?.productionLaunchEvidenceDossier?.endsWith('/production-launch-evidence-dossier'), 'Production launch evidence dossier must expose its standalone backend route.');
assert(response.body.summary?.productionLaunchEvidenceDossierManifestEntryCount >= 9 && response.body.summary?.productionLaunchEvidenceDossierReadyForProduction === false, 'Manager Ready Package summary must expose production launch evidence dossier coverage without production overclaim.');
assert(response.body.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1', 'Manager Ready Package must include the production evidence integrity audit.');
assert(response.body.productionEvidenceIntegrityAudit?.readyForProduction === false && response.body.productionEvidenceIntegrityAudit?.summary?.missingControlCount > 0, 'Production evidence integrity audit must keep public production blocked before production control receipts.');
assert(response.body.summary?.productionEvidenceIntegrityStatus === response.body.productionEvidenceIntegrityAudit?.status, 'Manager Ready Package summary must expose production evidence integrity status.');
assert(response.body.providerReadiness?.schemaVersion === 'provider-readiness/v1', 'Manager Ready Package must include the provider readiness contract.');
const failedProviderReadinessGates = (response.body.providerReadiness?.gates || []).filter((gate) => !gate.passed);
assert(response.body.providerReadiness?.status === 'local-provider-contract-ready', `Provider readiness must pass the local provider contract for the acceptance project. Failed gates: ${failedProviderReadinessGates.map((gate) => `${gate.id}:${gate.detail}`).join('; ') || 'none'}`);
assert(response.body.providerReadiness?.readyForProduction === false, 'Provider readiness must not claim production readiness before rollout controls exist.');
assert(response.body.providerReadiness?.gates?.every((gate) => gate.passed), `Provider readiness gates must all pass for the acceptance project. Failed gates: ${failedProviderReadinessGates.map((gate) => `${gate.id}:${gate.detail}`).join('; ') || 'none'}`);
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'provider-allowlist'), 'Provider readiness must keep provider allowlists as an explicit production control.');
assert(response.body.providerReadiness?.providerControlPolicy?.schemaVersion === 'provider-control-policy/v1', 'Provider readiness must include the provider control policy.');
assert(response.body.providerReadiness?.providerControlPolicy?.enforcementEnabled === true, 'Provider readiness must prove provider policy enforcement is enabled.');
assert(response.body.providerReadiness?.providerUsage?.count >= 1, 'Provider readiness must expose provider usage audit rows.');
assert(response.body.providerReadiness?.providerUsage?.dailyCostCents >= 1, 'Provider readiness must expose provider cost tracking.');
assert(response.body.providerReadiness?.providerUsage?.rows?.some((row) => row.operation === 'model:artifact-draft' && row.allowed === true && row.ok === true), 'Provider readiness must expose model-backed artifact draft usage rows.');
assert(response.body.providerReadiness?.summary?.modelArtifactDraftCount === 1 && response.body.providerReadiness?.summary?.modelArtifactDraftQualityReadyCount === 1 && response.body.providerReadiness?.summary?.modelArtifactDraftHumanReviewRequiredCount === 1 && response.body.providerReadiness?.summary?.modelArtifactDraftQualityReady === true, 'Provider readiness must summarize model draft quality and human-review readiness.');
assert(response.body.providerReadiness?.gates?.some((gate) => gate.id === 'model-artifact-draft-quality' && gate.passed), 'Provider readiness must gate model-backed artifact draft quality.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'model-output-quality-review' && control.status === 'local-control-ready'), 'Provider readiness must mark local model output quality review ready while keeping production rollout blocked.');
assert(response.body.providerReadiness?.providerBoundaries?.model?.artifactDrafts?.ready === true && response.body.providerReadiness.providerBoundaries.model.artifactDrafts.count === 1, 'Provider readiness must expose model artifact draft quality boundaries.');
assert(response.body.providerReadiness?.summary?.evidenceSourceSnapshotCount === 3 && response.body.providerReadiness?.summary?.evidenceProviderReceiptCount === 1 && response.body.providerReadiness?.summary?.sourceAuditCoverageReady === true, 'Provider readiness must expose source snapshot and provider receipt coverage.');
assert(response.body.providerReadiness?.gates?.some((gate) => gate.id === 'source-snapshot-provider-receipt-coverage' && gate.passed), 'Provider readiness must gate source snapshot and provider receipt coverage.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'source-snapshot-and-provider-receipts' && control.status === 'local-control-ready'), 'Provider readiness must mark local source snapshots and provider receipts ready.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'provider-audit-and-cost-ledger' && control.status === 'local-control-ready'), 'Provider readiness must mark the local provider audit ledger as ready.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'source-safety-review' && control.status === 'local-control-ready'), 'Provider readiness must mark local source-safety review ready.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'failure-retry-circuit-breaker' && control.status === 'local-control-ready'), 'Provider readiness must mark local provider failure controls ready.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'encrypted-secret-vault' && control.status === 'local-control-ready'), 'Provider readiness must mark the local encrypted secret vault control ready.');
assert(response.body.providerReadiness?.providerBoundaries?.evidence?.sourceSafetySummary?.sourceSafetyReady === true, 'Provider readiness must expose evidence source-safety summary.');
assert(response.body.providerReadiness?.providerBoundaries?.failureControl?.ready === true, 'Provider readiness must expose provider retry/circuit-breaker summary.');
assert(response.body.providerReadiness?.providerBoundaries?.secretVault?.ready === true, 'Provider readiness must expose provider secret-vault summary.');
assert(response.body.providerReadiness?.providerBoundaries?.secretVault?.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1', 'Provider readiness must expose provider secret-vault rotation summary.');
assert(response.body.providerReadiness?.summary?.providerSecretVaultRotationReady === true, 'Provider readiness summary must expose secret-vault rotation readiness.');
assert(response.body.summary?.providerReadinessFailedGateCount === 0, 'Manager Ready Package summary must expose provider readiness gate status.');
assert(response.body.summary?.providerBackedSearchCount >= 1, 'Manager Ready Package summary must expose provider-backed search count.');
assert(response.body.providerControlledRun?.schemaVersion === 'provider-controlled-run/v1', 'Manager Ready Package must include the provider controlled run contract.');
assert(response.body.providerControlledRun?.status === 'local-controlled-run-ready' && response.body.providerControlledRun?.readyForPrivatePilotRun === true && response.body.providerControlledRun?.readyForProductionRun === false, 'Provider controlled run must pass locally without issuing production readiness.');
assert(response.body.providerControlledRun?.runMode === 'policy-dry-run-no-provider-call-issued', 'Provider controlled run must be a policy dry-run, not an untracked provider call.');
assert(response.body.providerControlledRun?.operationPlan?.length >= 5 && response.body.providerControlledRun.operationPlan.every((row) => row.canRunPrivatePilot), 'Provider controlled run must list runnable model/search operations for private pilot.');
assert(response.body.providerControlledRun?.operationPlan?.some((row) => row.operation === 'model:artifact-draft' && row.usageProof.count >= 1), 'Provider controlled run must link model artifact draft usage proof.');
assert(response.body.providerControlledRun?.operationPlan?.some((row) => row.operation === 'search:evidence' && row.usageProof.count >= 1), 'Provider controlled run must link search evidence usage proof.');
assert(response.body.providerControlledRun?.gates?.every((gate) => gate.passed), 'Provider controlled run local gates must pass for the acceptance scenario.');
assert(response.body.providerControlledRun?.requiredProductionControls?.some((control) => control.id === 'real-provider-eval-run' && control.status === 'blocked'), 'Provider controlled run must keep real-provider eval as a production blocker.');
assert(response.body.summary?.providerControlledRunReady === true && response.body.summary?.providerControlledRunRunnableOperationCount === response.body.summary?.providerControlledRunOperationCount, 'Manager Ready Package summary must expose provider controlled run readiness.');
assert(response.body.providerEvalRunWorkflow?.schemaVersion === 'provider-eval-run-workflow/v1', 'Manager Ready Package must include the provider eval run workflow.');
assert(response.body.providerEvalRunWorkflow?.status === 'provider-eval-run-needed' && response.body.providerEvalRunWorkflow?.readyForPrivatePilotProviderEval === false, 'Provider eval workflow must start as run-needed before a shadow replay receipt is recorded.');
assert(response.body.summary?.providerEvalRunCount === 0 && response.body.summary?.providerEvalRunReady === false, 'Manager Ready Package summary must expose provider eval run-needed status before the receipt is recorded.');
assert(response.body.evidenceQualityAudit?.schemaVersion === 'evidence-quality-audit/v1', 'Manager Ready Package must include the evidence quality audit contract.');
assert(response.body.evidenceQualityAudit?.readyForDecision === true && response.body.evidenceQualityAudit?.readyForProduction === false, 'Manager Ready Package evidence quality audit must be decision-ready without overclaiming production.');
assert(response.body.evidenceQualityAudit?.checksum && response.body.summary?.evidenceQualityChecksum === response.body.evidenceQualityAudit.checksum, 'Manager Ready Package summary must expose evidence quality audit checksum.');
assert(response.body.summary?.evidenceQualityDecisionReady === true && response.body.summary?.evidenceQualityAverageScore >= 70, 'Manager Ready Package summary must expose evidence quality decision readiness.');
assert(response.body.summary?.evidenceQualityFailedDecisionGateCount === 0, 'Manager Ready Package summary must expose evidence quality decision gate status.');
assert(response.body.summary?.evidenceSourceSnapshotCount === 3 && response.body.summary?.evidenceProviderReceiptCount === 1, 'Manager Ready Package summary must expose source snapshot and provider receipt counts.');
assert(response.body.evidenceSourceReviewWorkflow?.schemaVersion === 'evidence-source-review-workflow/v1', 'Manager Ready Package must include the evidence source review workflow contract.');
assert(response.body.evidenceSourceReviewWorkflow?.readyForLocalPilot === true && response.body.evidenceSourceReviewWorkflow?.readyForProduction === false, 'Manager Ready Package source review workflow must be local-ready without production overclaim.');
assert(response.body.evidenceSourceReviewWorkflow?.reviewItems?.length === 3 && response.body.evidenceSourceReviewWorkflow?.summary?.blockedSourceCount === 0, 'Manager Ready Package source review workflow must expose source review items and blocked-source count.');
assert(response.body.evidenceSourceReviewWorkflow?.summary?.sourceReviewDecisionCount === 3 && response.body.evidenceSourceReviewWorkflow?.summary?.pendingDecisionSourceCount === 0, 'Manager Ready Package source review workflow must expose submitted source decision counts.');
assert(response.body.summary?.evidenceSourceReviewReady === true && response.body.summary?.evidenceSourceReviewChecksum === response.body.evidenceSourceReviewWorkflow.checksum, 'Manager Ready Package summary must expose source review workflow readiness and checksum.');
assert(response.body.summary?.evidenceSourceReviewDecisionCount === 3 && response.body.summary?.evidenceSourceReviewPendingDecisionCount === 0, 'Manager Ready Package summary must expose source review decision and pending counts.');
assert(response.body.evidenceCustodyReadiness?.schemaVersion === 'evidence-custody-readiness/v1', 'Manager Ready Package must include the evidence custody readiness contract.');
assert(response.body.evidenceCustodyReadiness?.readyForPrivatePilot === true && response.body.evidenceCustodyReadiness?.readyForProduction === false, 'Manager Ready Package evidence custody must be local-ready without production overclaim.');
assert(response.body.evidenceCustodyReadiness?.summary?.custodyRecordCount === 4 && response.body.summary?.evidenceCustodyRecordCount === 4, 'Manager Ready Package summary must expose evidence custody record counts.');
assert(response.body.summary?.evidenceCustodyReady === true && response.body.summary?.evidenceCustodyChecksum === response.body.evidenceCustodyReadiness.checksum, 'Manager Ready Package summary must expose evidence custody readiness and checksum.');
assert(response.body.operationsReadiness?.schemaVersion === 'operations-readiness/v1', 'Manager Ready Package must include the operations readiness contract.');
assert(response.body.operationsReadiness?.recovery?.runbookReady === true, 'Manager Ready Package must expose the recovery runbook.');
assert(response.body.operationsReadiness?.observability?.alertRules?.length >= 3, 'Manager Ready Package must expose local alert-rule drafts.');
assert(response.body.operationsReadiness?.incidentDrill?.schemaVersion === 'operations-incident-drill/v1', 'Manager Ready Package must expose the operations incident drill receipt.');
assert(typeof response.body.operationsReadiness?.incidentDrill?.drillReady === 'boolean', 'Manager Ready Package must expose operations incident drill readiness status.');
assert(response.body.operationsReadiness?.incidentDrill?.productionCutoverReady === false, 'Manager Ready Package incident drill must not claim production cutover readiness.');
assert(response.body.operationsReadiness?.incidentDrill?.receipts?.every((receipt) => receipt.receiptChecksum), 'Manager Ready Package incident drill receipts must be checksummed.');
assert(response.body.pilotLaunchReadiness?.schemaVersion === 'pilot-launch-readiness/v1', 'Manager Ready Package must include the pilot launch readiness contract.');
assert(['go', 'no-go'].includes(response.body.pilotLaunchReadiness?.privatePilotDecision), 'Pilot launch readiness must expose a private-pilot decision.');
assert(response.body.pilotLaunchReadiness?.productionDecision === 'no-go', 'Pilot launch readiness must keep production launch blocked.');
assert(response.body.pilotLaunchReadiness?.checksum, 'Pilot launch readiness must expose a checksummed launch packet.');
assert(response.body.pilotLaunchReadiness?.evidenceRoutes?.some((route) => route.id === 'artifact-quality-audit' && route.ready), 'Pilot launch readiness must include a ready artifact quality audit route.');
assert(response.body.summary?.pilotLaunchGateCount === response.body.pilotLaunchReadiness?.summary?.gateCount, 'Manager Ready Package summary must expose pilot launch gate count.');
assert(response.body.deploymentPreflight?.schemaVersion === 'deployment-preflight/v1', 'Manager Ready Package must include deployment preflight.');
assert(response.body.deploymentPreflight?.productionDeploymentReady === false, 'Deployment preflight must not claim production deployment readiness.');
assert(response.body.deploymentPreflight?.checksum, 'Deployment preflight must expose a checksum.');
assert(response.body.summary?.deploymentPreflightStatus === response.body.deploymentPreflight?.status, 'Manager Ready Package summary must expose deployment preflight status.');
assert(response.body.adapterGatewayPreflight?.schemaVersion === 'adapter-gateway-preflight/v1', 'Manager Ready Package must include adapter gateway preflight.');
assert(response.body.adapterGatewayPreflight?.privateGatewayReady === true, 'Adapter gateway preflight must pass the private local-shadow rehearsal path.');
assert(response.body.adapterGatewayPreflight?.productionCutoverReady === false, 'Adapter gateway preflight must not claim production cutover readiness.');
assert(response.body.adapterGatewayPreflight?.backendRoutes?.adapterGatewayPreflight?.endsWith('/adapter-gateway-preflight'), 'Adapter gateway preflight must expose its standalone backend route.');
assert(response.body.deploymentPreflight?.gates?.some((gate) => gate.id === 'adapter-gateway-preflight' && gate.passed), 'Deployment preflight must include a passing adapter gateway preflight gate.');
assert(response.body.deploymentPreflight?.adapters?.gateway?.preflight?.route?.endsWith('/adapter-gateway-preflight'), 'Deployment preflight must point to the adapter gateway preflight route.');
assert(response.body.summary?.adapterGatewayPreflightStatus === response.body.adapterGatewayPreflight?.status, 'Manager Ready Package summary must expose adapter gateway preflight status.');
assert(response.body.summary?.adapterGatewayLiveReady === false && response.body.summary?.adapterGatewayStateReadable === false, 'Local-shadow Manager Ready Package summary must keep live gateway/state checks pending until an endpoint is configured.');
assert(response.body.productionInfrastructureRehearsal?.schemaVersion === 'production-infrastructure-rehearsal/v1', 'Manager Ready Package must include the production infrastructure rehearsal contract.');
assert(typeof response.body.productionInfrastructureRehearsal?.readyForInfrastructureRehearsal === 'boolean' && response.body.productionInfrastructureRehearsal?.readyForProduction === false, 'Production infrastructure rehearsal must expose rehearsal readiness while keeping public production blocked.');
assert(response.body.productionInfrastructureRehearsal?.domainRows?.some((row) => row.id === 'managed-persistence' && typeof row.rehearsalReady === 'boolean' && row.productionReady === false && row.route?.endsWith('/persistence-adapter-dry-run')), 'Production infrastructure rehearsal must expose managed persistence rehearsal state without production cutover.');
assert(response.body.productionInfrastructureRehearsal?.domainRows?.some((row) => row.id === 'managed-worker-queue' && typeof row.rehearsalReady === 'boolean' && row.productionReady === false && row.route?.endsWith('/worker-queue-adapter-dry-run')), 'Production infrastructure rehearsal must expose queue/cron rehearsal state without production cutover.');
assert(response.body.productionInfrastructureRehearsal?.managedCutoverSummary?.productionCutoverReady === false && response.body.productionInfrastructureRehearsal?.managedCutoverSummary?.productionBlockedGateCount >= 1, 'Production infrastructure rehearsal must expose a managed cutover summary that keeps public production blocked.');
assert(response.body.productionInfrastructureRehearsal?.managedCutoverGates?.some((gate) => gate.id === 'managed-persistence-cutover' && gate.productionReady === false && gate.receiptReady === false && gate.route?.endsWith('/persistence-adapter-dry-run')), 'Production infrastructure rehearsal must expose the managed persistence cutover gate before receipts.');
assert(response.body.productionInfrastructureRehearsal?.managedCutoverGates?.some((gate) => gate.id === 'managed-worker-queue-cutover' && gate.productionReady === false && gate.receiptReady === false && gate.route?.endsWith('/worker-queue-adapter-dry-run')), 'Production infrastructure rehearsal must expose the managed queue cutover gate before receipts.');
assert(response.body.productionInfrastructureRehearsal?.backendRoutes?.productionInfrastructureRehearsal?.endsWith('/production-infrastructure-rehearsal'), 'Production infrastructure rehearsal must expose its standalone backend route.');
assert(response.body.summary?.productionInfrastructureRehearsalReady === response.body.productionInfrastructureRehearsal?.readyForInfrastructureRehearsal && response.body.summary?.productionInfrastructureRehearsalProductionBlockedCount >= 1, 'Manager Ready Package summary must expose infrastructure rehearsal readiness and production blockers.');
assert(response.body.summary?.productionInfrastructureManagedCutoverGateCount === response.body.productionInfrastructureRehearsal?.managedCutoverSummary?.gateCount && response.body.summary?.productionInfrastructureManagedCutoverNextGateId === response.body.productionInfrastructureRehearsal?.managedCutoverSummary?.nextGateId, 'Manager Ready Package summary must expose managed cutover gate counts and next gate.');
assert(response.body.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1', 'Manager Ready Package must include the launch approval workflow contract.');
assert(response.body.launchApprovalWorkflow?.readyForPrivatePilot === false, 'Launch approval workflow must require explicit private-pilot approvals before release.');
assert(response.body.launchApprovalWorkflow?.checksum && Array.isArray(response.body.launchApprovalWorkflow?.proofIds), 'Launch approval workflow must expose a checksum and proof id array even before approvals exist.');
assert(response.body.summary?.launchApprovalStatus === response.body.launchApprovalWorkflow?.status, 'Manager Ready Package summary must expose launch approval status.');
assert(response.body.summary?.launchApprovalPrivatePilotReady === false, 'Manager Ready Package summary must expose private-pilot approval readiness.');
assert(response.body.productionLaunchAudit?.schemaVersion === 'production-launch-audit/v1', 'Manager Ready Package must include the production launch audit contract.');
assert(['go', 'no-go'].includes(response.body.productionLaunchAudit?.privatePilotDecision), 'Production launch audit must expose a private-pilot decision.');
assert(response.body.productionLaunchAudit?.productionDecision === 'no-go', 'Production launch audit must keep public production blocked.');
assert(response.body.productionLaunchAudit?.readyForProduction === false, 'Production launch audit must not claim production readiness before final controls exist.');
assert(response.body.productionLaunchAudit?.failedPrivatePilotGates?.some((gate) => gate.id === 'private-pilot-launch-approval-ready'), 'Production launch audit must require launch approval before private-pilot go.');
assert(response.body.productionLaunchAudit?.summary?.failedProductionGateCount > 0, 'Production launch audit must keep production gates failed until real controls exist.');
assert(response.body.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'managed-production-evidence-integrity' && gate.passed === false && gate.apiPath?.endsWith('/production-evidence-integrity-audit')), 'Production launch audit must gate public production on managed-production evidence integrity.');
assert(response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'managed-production-evidence-integrity' && row.apiPath?.endsWith('/production-evidence-integrity-audit')), 'Production launch audit must list managed-production evidence integrity as a production blocker.');
assert(response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'production-managed-persistence'), 'Production launch audit must retain managed persistence as a production blocker.');
assert(response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'production-real-providers'), 'Production launch audit must retain real providers as a production blocker.');
assert(response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'production-evidence-custody-storage' || row.id === 'managed-immutable-object-storage'), 'Production launch audit must retain evidence custody storage as a production blocker.');
assert(response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'calibrated-artifact-quality-rubric'), 'Production launch audit must retain calibrated artifact quality as a production blocker.');
assert(response.body.productionLaunchAudit?.evidenceRoutes?.some((route) => route.id === 'artifact-quality-audit' && route.ready), 'Production launch audit must include a ready artifact quality audit route.');
assert(response.body.productionLaunchAudit?.evidenceRoutes?.some((route) => route.id === 'evidence-custody-readiness' && route.ready), 'Production launch audit must include a ready evidence custody route.');
assert(response.body.productionLaunchAudit?.evidenceRoutes?.some((route) => route.id === 'production-evidence-integrity-audit' && route.ready === false && route.route?.endsWith('/production-evidence-integrity-audit')), 'Production launch audit must expose the production evidence integrity audit route while keeping it blocked.');
assert(response.body.productionLaunchAudit?.auditIntegrityGates?.some((gate) => gate.id === 'production-overclaim-guard' && gate.passed), 'Production launch audit must prove production overclaim is blocked.');
assert(response.body.summary?.productionLaunchAuditStatus === response.body.productionLaunchAudit?.status, 'Manager Ready Package summary must expose production launch audit status.');
assert(response.body.summary?.productionLaunchProductionDecision === 'no-go', 'Manager Ready Package summary must expose the production launch no-go decision.');
assert(response.body.summary?.productionLaunchProductionBlockerCount === response.body.productionLaunchAudit?.summary?.productionBlockerCount, 'Manager Ready Package summary must expose production launch blocker count.');
assert(response.body.persistenceAdapterPlan?.schemaVersion === 'managed-persistence-adapter-plan/v1', 'Manager Ready Package must include the managed persistence adapter plan.');
assert(response.body.persistenceAdapterDryRun?.schemaVersion === 'managed-persistence-adapter-dry-run/v1', 'Manager Ready Package must include the managed persistence adapter dry-run.');
assert(response.body.summary?.persistenceAdapterDryRunStatus, 'Manager Ready Package summary must expose managed persistence adapter dry-run status.');
assert(response.body.summary?.persistenceAdapterDriver === 'local-shadow', 'Manager Ready Package summary must expose the active managed persistence adapter driver.');
assert(response.body.summary?.persistenceAdapterProductionCutoverReady === false, 'Manager Ready Package summary must keep production database cutover blocked for local shadow runs.');
assert(response.body.workerQueueAdapterPlan?.schemaVersion === 'worker-queue-adapter-plan/v1' && response.body.workerQueueAdapterPlan?.status === 'ready-for-queue-adapter-pilot', 'Manager Ready Package must include a ready worker queue adapter plan.');
assert(response.body.workerQueueAdapterDryRun?.schemaVersion === 'worker-queue-adapter-dry-run/v1' && response.body.workerQueueAdapterDryRun?.status === 'passed', 'Manager Ready Package must include a passing worker queue adapter dry-run.');
assert(response.body.summary?.queueAdapterDryRunStatus === 'passed' && response.body.summary?.queueAdapterDispatchCount >= 1, 'Manager Ready Package summary must expose queue adapter dry-run status and dispatch count.');
assert(response.body.summary?.queueAdapterDriver === 'local-shadow', 'Manager Ready Package summary must expose the active worker queue adapter driver.');
assert(response.body.summary?.queueAdapterProductionCutoverReady === false, 'Manager Ready Package summary must keep production queue cutover blocked for local shadow runs.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_SEARCH_SECRET), 'Security boundary must not expose the search secret fixture.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_MODEL_SECRET), 'Security boundary must not expose the model secret fixture.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_SOURCE_SECRET), 'Security boundary must not expose the source secret fixture.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_VAULT_MASTER_KEY), 'Security boundary must not expose the vault master key fixture.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_VAULT_ROTATED_MASTER_KEY), 'Security boundary must not expose the rotated vault master key fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_SEARCH_SECRET), 'Provider readiness must not expose the search secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_MODEL_SECRET), 'Provider readiness must not expose the model secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_SOURCE_SECRET), 'Provider readiness must not expose the source secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_VAULT_MASTER_KEY), 'Provider readiness must not expose the vault master key fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_VAULT_ROTATED_MASTER_KEY), 'Provider readiness must not expose the rotated vault master key fixture.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/mvp-readiness` });
assert(response.status === 200 && response.body.mvpReadiness?.status === 'mvp-local-candidate', 'Project API must expose MVP readiness as a standalone read model.');
assert(response.body.mvpReadiness.rows.some((row) => row.id === 'backend-worker-loop' && row.passed), 'MVP readiness must prove backend/runtime worker coverage.');
assert(response.body.mvpReadiness.nextShortestPath?.scope === 'production-hardening' && response.body.mvpReadiness.nextShortestPath?.method === 'GET' && response.body.mvpReadiness.nextShortestPath?.apiPath?.endsWith('/security-boundary'), 'MVP readiness must expose a routed next shortest path after core closure.');
assert(response.body.mvpReadiness.operatorActions?.some((row) => row.id === 'prepare-private-pilot-handoff' && row.scope === 'private-pilot' && row.apiPath?.endsWith('/private-pilot-go-live-readiness')), 'MVP readiness must expose the private-pilot handoff operator action.');
assert(response.body.mvpReadiness.operatorActions?.some((row) => row.id === 'harden-production-next-gap' && row.scope === 'production-hardening' && row.productionBlocker === true && row.apiPath?.endsWith('/security-boundary')), 'MVP readiness must expose the next production-hardening operator action.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-secret-vault-rbac' && row.apiPath?.endsWith('/security-boundary')), 'MVP readiness must point secret-vault/RBAC hardening to the security boundary route.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-managed-persistence' && row.apiPath?.endsWith('/persistence-adapter-dry-run')), 'MVP readiness must point managed-persistence hardening to the persistence adapter dry-run route.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-queue-cron' && row.apiPath?.endsWith('/worker-queue-adapter-dry-run')), 'MVP readiness must point queue/cron hardening to the worker queue adapter dry-run route.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-real-providers' && row.apiPath?.endsWith('/provider-readiness')), 'MVP readiness must point real provider rollout hardening to the provider readiness route.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-evidence-custody-storage' && row.apiPath?.endsWith('/evidence-custody-readiness')), 'MVP readiness must point evidence custody hardening to the custody readiness route.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-observability-recovery' && row.apiPath?.endsWith('/operations-readiness')), 'MVP readiness must point observability/recovery hardening to the operations readiness route.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/mvp-readiness/operator-actions/harden-production-next-gap/run`,
  body: {
    actor: 'Manager',
    source: 'product-team-acceptance-scenario',
    includeReadModels: false,
    now: '2026-06-01T11:24:30.000Z',
  },
});
assert(response.status === 200 && response.body.mvpReadinessOperatorActionRun?.schemaVersion === 'mvp-readiness-operator-action-run/v1', 'MVP readiness operator actions must produce backend run receipts.');
assert(response.body.mvpReadinessOperatorActionRun.actionId === 'harden-production-next-gap' && response.body.mvpReadinessOperatorActionRun.productionBlocker === true, 'MVP readiness production-hardening runs must preserve production blocker context.');
assert(response.body.mvpReadinessOperatorActionRun.autonomousRunnable === false && !response.body.mvpReadinessOperatorActionRun.targetStageId, 'MVP readiness production-hardening receipts must not create autonomous target controls.');
assert(response.body.mvpReadinessOperatorActionRun.timelineLogId && response.body.mvpReadinessOperatorActionRun.eventId && response.body.mvpReadinessOperatorActionRun.checksum, 'MVP readiness operator action receipts must include timeline, event, and checksum proof.');
assert(response.body.readModels?.mvpReadinessRoute?.endsWith('/mvp-readiness') && response.body.readModels?.managerFlowGraphRoute?.endsWith('/manager-flow-graph') && response.body.readModels?.operatorActionTargetRoute?.endsWith('/security-boundary'), 'MVP readiness operator action receipts must defer heavy read models but return follow-up routes.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assert(response.status === 200 && response.body.mvpReadinessOperatorActionRunRoutes?.some((route) => route.actionId === 'harden-production-next-gap' && route.proofIds?.length && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must expose MVP readiness operator action run proof routes.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
assert(response.status === 200 && response.body.nodes?.some((node) => node.subtype === 'mvp-readiness-operator-action-run' && node.route?.includes('/mvp-readiness/operator-actions/harden-production-next-gap/run') && node.proofIds?.length && node.timelineLogIds?.length && node.eventIds?.length), 'Manager Flow Graph must include proofed MVP readiness operator action run nodes.');
assert(response.body.edges?.some((edge) => edge.source === 'mvpReadinessOperatorActionRuns' && edge.toNodeId?.startsWith('mvp-readiness-operator-action-run-') && edge.proofIds?.length && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect MVP readiness operator action runs to the evidence ledger.');

response = api.handle({
  method: 'PUT',
  path: `/projects/${projectId}/membership-policy`,
  body: {
    policy: projectMembershipPolicy,
    updatedBy: 'security-lead',
    source: 'product-team-acceptance-membership-api',
    now: '2026-06-01T11:25:00.000Z',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', 'Project API must persist a project membership policy.');
assert(response.body.projectMembershipSummary?.managerUserCount === 1 && response.body.projectMembershipSummary?.operationsOwnerUserCount === 1 && response.body.projectMembershipSummary?.agentBindingCount === team.length, 'Project membership policy summary must count manager, operations owner, and Agent runtime bindings.');
assert(response.body.projectMembershipAuditEntry?.eventId && response.body.log?.eventType === 'project-membership-policy-updated', 'Project membership policy updates must create audit and timeline proof.');
assert(response.body.project.eventLedger.some((event) => event.type === 'project-membership-policy-updated'), 'Project membership policy updates must enter the event ledger.');
assert(response.body.readModels?.included === false && response.body.readModels?.securityBoundaryRoute?.endsWith('/security-boundary') && response.body.readModels?.membershipPolicyRoute?.endsWith('/membership-policy'), 'Project membership policy writes must support lightweight security read-model refresh routes.');
assert(!response.body.managerReadyPackage && !response.body.managerDashboard, 'Project membership policy writes must not embed large Manager read models when includeReadModels is false.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/membership-policy` });
assert(response.status === 200 && response.body.projectMembershipPolicy?.revision === 1, 'Project API must read the persisted project membership policy.');

progress('security boundary and route manifest checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/security-boundary` });
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Project API must expose a standalone security boundary contract.');
assert(response.body.securityBoundary.redactionScan.status === 'ready', 'Standalone security boundary must report a ready redaction scan.');
assert(response.body.securityBoundary.providerBoundary.exposedSecrets === false, 'Standalone security boundary must not expose provider secrets.');
assert(response.body.securityBoundary.projectMembership?.configured && response.body.securityBoundary.projectMembership.revision === 1, 'Security boundary must expose persisted project membership policy status.');
assert(response.body.securityBoundary.secretVault?.ready === true && response.body.securityBoundary.secretVault.rawSecretRecordCount === 0, 'Standalone security boundary must expose encrypted secret vault readiness.');
assert(response.body.securityBoundary.secretVault?.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1' && response.body.securityBoundary.summary?.secretVaultRotationReady === true, 'Standalone security boundary must expose secret-vault rotation readiness.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_VAULT_ROTATED_MASTER_KEY), 'Standalone security boundary must not expose the rotated vault master key fixture.');
for (const routeKey of ['submissions', 'evidence-searches', 'brainstorm-layer', 'artifact-quality-audit', 'submission-review-workflow', 'product-team-operating-loop', 'team-collaboration-diagnostics', 'collaboration-intent-queue', 'runtime-contracts', 'autonomous-cycle-consistency', 'runtime-autonomy-status', 'evidence-quality-audit', 'evidence-source-review-workflow', 'evidence-custody-readiness', 'submission-reviews', 'pilot-launch-readiness', 'deployment-preflight', 'adapter-gateway-preflight', 'production-infrastructure-rehearsal', 'production-launch-audit', 'production-launch-gap-register', 'production-launch-control-center', 'production-launch-evidence-dossier', 'production-evidence-integrity-audit', 'launch-approvals', 'project-evidence-exports', 'private-pilot-go-live-readiness', 'private-pilot-release-candidates', 'private-pilot-launch-runs', 'private-pilot-launch-health-checks', 'private-pilot-acceptance-reports', 'production-operations-readiness', 'production-operations-control-receipts', 'production-deployment-control-receipts', 'production-security-control-receipts', 'production-provider-control-receipts', 'mvp-readiness', 'persistence-snapshot', 'persistence-migration-plan', 'persistence-migration-dry-run', 'persistence-adapter-plan', 'persistence-adapter-dry-run', 'worker-queue', 'worker-queue-adapter-plan', 'worker-queue-adapter-dry-run', 'operations-readiness', 'provider-readiness', 'provider-vault-bindings', 'provider-controlled-run', 'provider-eval-runs', 'security-boundary', 'security-access-audit', 'security-audit-stream', 'membership-policy', 'identity-sessions', 'project-settings']) {
  assert(response.body.securityBoundary.routeSummary.routeKeys.includes(routeKey), `Security boundary route manifest must include ${routeKey}.`);
}
assert(response.body.securityBoundary.production.status === 'production-blocked' && response.body.securityBoundary.production.blockerCount >= 4, 'Security boundary must keep production hardening blockers visible.');

progress('artifact quality audit checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/artifact-quality-audit` });
assert(response.status === 200 && response.body.artifactQualityAudit?.schemaVersion === 'artifact-quality-audit/v1', 'Project API must expose a standalone artifact quality audit contract.');
assert(response.body.artifactQualityAudit.status === 'local-artifact-quality-ready' && response.body.artifactQualityAudit.readyForLocalPilot === true && response.body.artifactQualityAudit.readyForProduction === false, 'Standalone artifact quality audit must pass locally without production overclaim.');
assert(response.body.artifactQualityAudit.summary?.coveredArtifactTypeCount === response.body.artifactQualityAudit.summary?.requiredArtifactTypeCount && response.body.artifactQualityAudit.summary?.missingArtifactTypeCount === 0, 'Standalone artifact quality audit must cover generic product-team artifact types.');
assert(response.body.artifactQualityAudit.summary?.proofReadyCount === expectedSubmissionCount && response.body.artifactQualityAudit.summary?.generatedDraftQualityReadyCount === 2, 'Standalone artifact quality audit must preserve proof readiness and generated-draft quality readiness.');
assert(response.body.artifactQualityAudit.summary?.storageProofReadyCount === expectedSubmissionCount && response.body.artifactQualityAudit.rows.every((row) => row.storageProofReady && row.artifactStorageProof?.checksum), 'Standalone artifact quality audit must preserve checksummed storage proof readiness for every submission.');
assert(response.body.artifactQualityAudit.gates.some((gate) => gate.id === 'artifact-storage-proof-ready' && gate.passed), 'Standalone artifact quality audit must include the artifact storage proof gate.');
assert(response.body.artifactQualityAudit.rows.some((row) => row.id === modelGeneratedDraftSubmission.id && row.artifactDraftQualityStatus === 'local-quality-ready' && row.artifactDraftHumanReviewRequired === true), 'Standalone artifact quality audit must expose model-backed draft quality and human-review metadata.');
assert(response.body.artifactQualityAudit.requiredProductionControls.some((control) => control.id === 'calibrated-artifact-quality-rubric' && control.status === 'blocked'), 'Standalone artifact quality audit must expose calibrated production rubric as a blocker.');

progress('submission review workflow checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/submission-review-workflow` });
assert(response.status === 200 && response.body.submissionReviewWorkflow?.schemaVersion === 'submission-review-workflow/v1', 'Project API must expose a standalone submission review workflow contract.');
assert(response.body.submissionReviewWorkflow.status === 'submission-review-loop-closed' && response.body.submissionReviewWorkflow.readyForPrivatePilotReview === true, 'Standalone submission review workflow must close the review loop.');
assert(response.body.submissionReviewWorkflow.summary?.reviewRoundCount >= 2 && response.body.submissionReviewWorkflow.summary?.failedLocalGateCount === 0, 'Standalone submission review workflow must expose review rounds and passing local gates.');
assert(response.body.submissionReviewWorkflow.backendRoutes?.submissionReviewWorkflow?.endsWith('/submission-review-workflow'), 'Standalone submission review workflow must expose its own backend route.');

progress('provider readiness checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/provider-readiness` });
assert(response.status === 200 && response.body.providerReadiness?.schemaVersion === 'provider-readiness/v1', 'Project API must expose a standalone provider readiness contract.');
assert(response.body.providerReadiness.status === 'local-provider-contract-ready', 'Standalone provider readiness must pass local provider gates.');
assert(response.body.providerReadiness.readyForProduction === false, 'Standalone provider readiness must keep production rollout blocked.');
assert(response.body.providerReadiness.providerBoundaries?.search?.status?.provider === 'deterministic', 'Provider readiness must expose deterministic provider provenance for local validation.');
assert(response.body.providerReadiness.providerBoundaries?.evidence?.providerBackedSearchCount >= 1, 'Provider readiness must link provider-backed evidence searches.');
assert(response.body.providerReadiness.requiredProductionControls.some((control) => control.id === 'budget-and-rate-limits'), 'Provider readiness must expose budget and rate-limit production controls.');
assert(response.body.providerReadiness.requiredProductionControls.some((control) => control.id === 'budget-and-rate-limits' && control.status === 'local-control-ready'), 'Provider readiness must mark local budget and rate controls ready.');
assert(response.body.providerReadiness.gates.some((gate) => gate.id === 'search-source-safety-review' && gate.passed), 'Provider readiness must gate provider-backed evidence source safety.');
assert(response.body.providerReadiness.gates.some((gate) => gate.id === 'provider-retry-circuit-breaker' && gate.passed), 'Provider readiness must gate provider retry/circuit-breaker controls.');
assert(response.body.providerReadiness.gates.some((gate) => gate.id === 'provider-secret-vault-contract' && gate.passed), 'Provider readiness must gate provider secret-vault controls.');
assert(response.body.providerReadiness.gates.some((gate) => gate.id === 'model-artifact-draft-quality' && gate.passed), 'Provider readiness must gate model-backed artifact draft quality in the standalone route.');
assert(response.body.providerReadiness.summary?.sourceSafetyReady === true && response.body.providerReadiness.summary?.sourceSafetyBlockedSourceCount === 0, 'Standalone provider readiness must summarize source-safety readiness.');
assert(response.body.providerReadiness.summary?.providerFailureControlReady === true && response.body.providerReadiness.summary?.providerOpenCircuitCount === 0 && response.body.providerReadiness.summary?.providerRetryAttempts === 2, 'Standalone provider readiness must summarize retry/circuit-breaker readiness.');
assert(response.body.providerReadiness.summary?.providerSecretVaultReady === true && response.body.providerReadiness.summary?.providerSecretVaultEncryptedRecordCount === 2, 'Standalone provider readiness must summarize secret-vault readiness.');
assert(response.body.providerReadiness.summary?.providerSecretVaultRotationReady === true, 'Standalone provider readiness must summarize secret-vault rotation readiness.');
assert(response.body.providerReadiness.providerVaultBindings?.schemaVersion === 'provider-vault-bindings/v1' && response.body.providerReadiness.providerVaultBindings.summary?.boundProviderCount >= 2, 'Standalone provider readiness must embed provider-vault binding evidence.');
assert(response.body.providerReadiness.summary?.providerVaultBoundProviderCount >= 2 && response.body.providerReadiness.backendRoutes?.providerVaultBindings?.endsWith('/provider-vault-bindings'), 'Standalone provider readiness must summarize and route provider-vault bindings.');
assert(response.body.providerReadiness.summary?.modelArtifactDraftCount === 1 && response.body.providerReadiness.summary?.modelArtifactDraftQualityReadyCount === 1 && response.body.providerReadiness.summary?.modelArtifactDraftHumanReviewRequiredCount === 1 && response.body.providerReadiness.summary?.modelArtifactDraftQualityReady === true, 'Standalone provider readiness must summarize model draft quality and human-review readiness.');
assert(response.body.providerReadiness.requiredProductionControls.some((control) => control.id === 'model-output-quality-review' && control.status === 'local-control-ready'), 'Standalone provider readiness must expose the model output quality review production control.');
assert(response.body.providerReadiness.providerBoundaries?.model?.artifactDrafts?.rows?.some((row) => row.id === modelGeneratedDraftSubmission.id && row.qualityStatus === 'local-quality-ready' && row.humanReviewRequired === true), 'Standalone provider readiness must expose model draft quality boundary rows.');
assert(response.body.providerReadiness.backendRoutes.providerReadiness?.endsWith('/provider-readiness'), 'Provider readiness must expose its own backend route.');
assert(response.body.providerReadiness.providerUsage?.rows?.some((row) => row.operation === 'search:evidence' && row.allowed === true && row.retry?.attemptCount >= 1 && row.circuitBreaker?.state === 'closed'), 'Provider readiness must expose allowed provider usage rows with retry/circuit metadata.');
assert(response.body.providerReadiness.redaction?.responseLeakCount === 0, 'Provider readiness must report zero response secret leaks.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_SEARCH_SECRET), 'Standalone provider readiness must not expose the search secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_MODEL_SECRET), 'Standalone provider readiness must not expose the model secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_SOURCE_SECRET), 'Standalone provider readiness must not expose the source secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_VAULT_MASTER_KEY), 'Standalone provider readiness must not expose the vault master key fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_VAULT_ROTATED_MASTER_KEY), 'Standalone provider readiness must not expose the rotated vault master key fixture.');

response = api.handle({ method: 'GET', path: '/provider-vault-bindings' });
assert(response.status === 200 && response.body.providerVaultBindings?.schemaVersion === 'provider-vault-bindings/v1', 'Project API must expose the top-level provider-vault binding contract.');
assert(response.body.providerVaultBindings.summary?.boundProviderCount >= 2 && response.body.providerVaultBindings.gates?.every((gate) => gate.passed), 'Top-level provider-vault bindings must prove local vault-backed provider status.');
assert(response.body.providerVaultBindings.bindings?.some((row) => row.kind === 'model' && row.bound && row.apiKeySource === 'local-secret-vault'), 'Top-level provider-vault bindings must bind model provider status to the local vault.');
assert(response.body.providerVaultBindings.bindings?.some((row) => row.kind === 'search' && row.bound && row.apiKeySource === 'local-secret-vault'), 'Top-level provider-vault bindings must bind search provider status to the local vault.');
assert(!JSON.stringify(response.body.providerVaultBindings).includes(FAKE_SEARCH_SECRET) && !JSON.stringify(response.body.providerVaultBindings).includes(FAKE_MODEL_SECRET) && !JSON.stringify(response.body.providerVaultBindings).includes(FAKE_VAULT_MASTER_KEY), 'Top-level provider-vault bindings must not expose provider secrets or vault key material.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/provider-vault-bindings` });
assert(response.status === 200 && response.body.providerVaultBindings?.projectId === projectId && response.body.providerVaultBindings?.backendRoutes?.providerReadiness?.endsWith('/provider-readiness'), 'Project API must expose project-scoped provider-vault binding routes.');

progress('provider controlled run checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/provider-controlled-run` });
assert(response.status === 200 && response.body.providerControlledRun?.schemaVersion === 'provider-controlled-run/v1', 'Project API must expose a standalone provider controlled run contract.');
assert(response.body.providerControlledRun.status === 'local-controlled-run-ready' && response.body.providerControlledRun.readyForPrivatePilotRun === true, 'Standalone provider controlled run must pass local private-pilot gates.');
assert(response.body.providerControlledRun.readyForProductionRun === false && response.body.providerControlledRun.readyForProduction === false, 'Standalone provider controlled run must not claim production provider readiness.');
assert(response.body.providerControlledRun.operationPlan.some((row) => row.operation === 'model:kickoff' && row.policyAllowed && row.circuitAllowed), 'Provider controlled run must include model kickoff policy checks.');
assert(response.body.providerControlledRun.operationPlan.some((row) => row.operation === 'model:intent' && row.policyAllowed && row.circuitAllowed), 'Provider controlled run must include model intent policy checks.');
assert(response.body.providerControlledRun.operationPlan.some((row) => row.operation === 'model:artifact-draft' && row.usageProof.count >= 1), 'Provider controlled run must include model artifact draft usage proof.');
assert(response.body.providerControlledRun.operationPlan.some((row) => row.operation === 'search:evidence' && row.agentId === 'curie' && row.usageProof.count >= 1), 'Provider controlled run must include search evidence policy checks and usage proof for the granted Reviewer Agent.');
assert(response.body.providerControlledRun.budget.estimatedRunCostCents >= 1 && response.body.providerControlledRun.budget.remainingDailyBudgetCents >= response.body.providerControlledRun.budget.estimatedRunCostCents, 'Provider controlled run must expose budget headroom for the private-pilot run.');
assert(response.body.providerControlledRun.summary.modelProofReady === true && response.body.providerControlledRun.summary.searchProofReady === true, 'Provider controlled run summary must expose model and search proof readiness.');
assert(response.body.providerControlledRun.summary.humanReviewReady === true && response.body.providerControlledRun.summary.evidenceReady === true && response.body.providerControlledRun.summary.redactionReady === true, 'Provider controlled run summary must preserve human-review, evidence-governance, and redaction boundaries.');
assert(response.body.providerControlledRun.backendRoutes.providerControlledRun?.endsWith('/provider-controlled-run'), 'Provider controlled run must expose its standalone backend route.');
assert(response.body.providerControlledRun.requiredProductionControls.some((control) => control.id === 'managed-provider-audit-storage' && control.status === 'blocked'), 'Provider controlled run must retain managed provider audit storage as a production blocker.');
assert(!JSON.stringify(response.body.providerControlledRun).includes(FAKE_SEARCH_SECRET), 'Standalone provider controlled run must not expose the search secret fixture.');
assert(!JSON.stringify(response.body.providerControlledRun).includes(FAKE_MODEL_SECRET), 'Standalone provider controlled run must not expose the model secret fixture.');
assert(!JSON.stringify(response.body.providerControlledRun).includes(FAKE_VAULT_ROTATED_MASTER_KEY), 'Standalone provider controlled run must not expose the rotated vault master key fixture.');

progress('provider eval workflow preflight checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/provider-eval-runs` });
assert(response.status === 200 && response.body.providerEvalRunWorkflow?.schemaVersion === 'provider-eval-run-workflow/v1', 'Project API must expose a standalone provider eval run workflow.');
assert(response.body.providerEvalRunWorkflow.status === 'provider-eval-run-needed' && response.body.providerEvalRunWorkflow.readyForPrivatePilotProviderEval === false, 'Standalone provider eval workflow must require a recorded shadow replay before it is ready.');
assert(response.body.providerEvalRunWorkflow.backendRoutes.providerEvalRuns?.endsWith('/provider-eval-runs'), 'Provider eval workflow must expose its standalone backend route.');

progress('provider eval shadow replay receipt checks');
response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/provider-eval-runs`,
  body: {
    mode: 'shadow-replay',
    actorRole: 'runtime-platform',
    actorId: 'provider-eval-harness',
    reason: 'Record controlled provider run shadow replay for private-pilot acceptance.',
    now: '2026-06-01T11:24:00.000Z',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.providerEvalRun?.schemaVersion === 'provider-eval-run/v1', 'Project API must record a provider eval shadow replay receipt.');
assert(response.body.providerEvalRun.mode === 'shadow-replay-from-provider-usage-ledger' && response.body.providerEvalRun.status === 'shadow-replay-passed', 'Provider eval run must use shadow replay and pass for the acceptance scenario.');
assert(response.body.providerEvalRun.readyForPrivatePilotProviderEval === true && response.body.providerEvalRun.readyForProduction === false, 'Provider eval run must be private-pilot ready without production overclaim.');
assert(response.body.providerEvalRun.operationRows.some((row) => row.operation === 'model:artifact-draft' && row.evalStatus === 'replayed-from-usage-ledger' && row.usageProof.proofIds.length && row.usageProof.eventIds.length), 'Provider eval run must replay model artifact draft proof from the provider usage ledger.');
assert(response.body.providerEvalRun.operationRows.some((row) => row.operation === 'search:evidence' && row.evalStatus === 'replayed-from-usage-ledger' && row.usageProof.proofIds.length && row.usageProof.eventIds.length), 'Provider eval run must replay search evidence proof from the provider usage ledger.');
assert(response.body.providerEvalRun.gates.every((gate) => gate.passed), 'Provider eval run gates must pass locally for the shadow replay.');
assert(response.body.providerEvalRun.requiredProductionControls.some((control) => control.id === 'managed-provider-eval-storage' && control.status === 'blocked'), 'Provider eval run must keep managed eval storage as a production blocker.');
assert(response.body.providerEvalRun.eventId && response.body.providerEvalRun.timelineLogId, 'Provider eval run must write timeline and event proof.');
assert(response.body.providerEvalRunWorkflow?.readyForPrivatePilotProviderEval === true && response.body.providerEvalRunWorkflow?.summary?.runCount >= 1, 'Provider eval workflow must become ready after the shadow replay is recorded.');
assert(response.body.readModels?.included === false && response.body.readModels?.providerEvalRunWorkflowRoute?.endsWith('/provider-eval-runs') && response.body.readModels?.providerControlledRunRoute?.endsWith('/provider-controlled-run') && response.body.readModels?.managerReadyPackageRoute?.endsWith('/manager-ready-package'), 'Provider eval receipt must return lightweight provider/manager read-model refresh routes.');
assert(!response.body.managerReadyPackage && !response.body.managerDashboard, 'Provider eval receipt must not embed large Manager read models when includeReadModels is false.');
assert(!JSON.stringify(response.body.providerEvalRun).includes(FAKE_SEARCH_SECRET), 'Provider eval run must not expose the search secret fixture.');
assert(!JSON.stringify(response.body.providerEvalRun).includes(FAKE_MODEL_SECRET), 'Provider eval run must not expose the model secret fixture.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/provider-eval-runs` });
assert(response.status === 200 && response.body.providerEvalRunWorkflow?.status === 'provider-eval-shadow-ready', 'Standalone provider eval workflow must become ready after recording the receipt.');
assert(response.body.providerEvalRunWorkflow.latestRun?.status === 'shadow-replay-passed' && response.body.providerEvalRunWorkflow.summary?.replayedCriticalOperationCount === 2, 'Provider eval workflow must expose the latest passed shadow replay and critical operation coverage.');
assert(response.body.providerEvalRunWorkflow.proofIds.length >= 2 && response.body.providerEvalRunWorkflow.eventIds.length >= 2 && response.body.providerEvalRunWorkflow.timelineLogIds.length >= 1, 'Provider eval workflow must expose proof, event, and timeline links.');
assert(response.body.providerEvalRunWorkflow.readyForProduction === false, 'Provider eval workflow must not claim production provider readiness.');

progress('production deployment control workflow checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/production-deployment-control-receipts` });
assert(response.status === 200 && response.body.productionDeploymentControlReceiptWorkflow?.schemaVersion === 'production-deployment-control-receipt-workflow/v1', 'Project API must expose a standalone production deployment control receipt workflow.');
assert(response.body.productionDeploymentControlReceiptWorkflow.status === 'production-deployment-control-receipts-needed' && response.body.productionDeploymentControlReceiptWorkflow.readyForProductionDeployment === false, 'Production deployment control receipt workflow must require production deployment evidence before deployment readiness can pass.');
assert(typeof response.body.productionDeploymentControlReceiptWorkflow.readyForPrivatePilotDeployment === 'boolean', 'Production deployment control receipt workflow must expose private-pilot deployment proof status.');
assert(response.body.productionDeploymentControlReceiptWorkflow.backendRoutes.productionDeploymentControlReceipts?.endsWith('/production-deployment-control-receipts'), 'Production deployment control receipt workflow must expose its standalone backend route.');
assert(response.body.productionDeploymentControlReceiptWorkflow.missingControlIds.includes('environment-promotion-audit') && response.body.productionDeploymentControlReceiptWorkflow.missingControlIds.includes('rollback-plan-and-smoke-test'), 'Production deployment control receipt workflow must expose promotion and rollback controls as missing.');

progress('production provider control workflow checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/production-provider-control-receipts` });
assert(response.status === 200 && response.body.productionProviderControlReceiptWorkflow?.schemaVersion === 'production-provider-control-receipt-workflow/v1', 'Project API must expose a standalone production provider control receipt workflow.');
assert(response.body.productionProviderControlReceiptWorkflow.status === 'production-provider-control-receipts-needed' && response.body.productionProviderControlReceiptWorkflow.readyForProductionProvider === false, 'Production provider control receipt workflow must require production evidence before provider rollout is ready.');
assert(response.body.productionProviderControlReceiptWorkflow.readyForLocalProviderContract === true, 'Production provider control receipt workflow must see the local provider contract and shadow eval as ready.');
assert(response.body.productionProviderControlReceiptWorkflow.backendRoutes.productionProviderControlReceipts?.endsWith('/production-provider-control-receipts'), 'Production provider control receipt workflow must expose its standalone backend route.');
assert(response.body.productionProviderControlReceiptWorkflow.missingControlIds.includes('real-provider-eval-run') && response.body.productionProviderControlReceiptWorkflow.missingControlIds.includes('managed-provider-eval-storage'), 'Production provider control receipt workflow must expose real eval and managed storage as missing controls.');

progress('enforced access route checks');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-boundary`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.securityBoundary.accessControl.status === 'enforceable-prototype-policy', 'Security admin must be able to read the security boundary in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/provider-readiness`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.providerReadiness.status === 'local-provider-contract-ready', 'Security admin must be able to read provider readiness in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/provider-controlled-run`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.providerControlledRun.status === 'local-controlled-run-ready', 'Security admin must be able to read provider controlled run in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/provider-eval-runs`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.providerEvalRunWorkflow.status === 'provider-eval-shadow-ready', 'Security admin must be able to read provider eval runs in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/evidence-quality-audit`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.evidenceQualityAudit.readyForDecision === true, 'Security admin must be able to read evidence quality audit in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/submission-review-workflow`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.submissionReviewWorkflow.readyForPrivatePilotReview === true, 'Security admin must be able to read submission review workflow in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/evidence-source-review-workflow`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.evidenceSourceReviewWorkflow.readyForLocalPilot === true, 'Security admin must be able to read evidence source review workflow in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/evidence-custody-readiness`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.evidenceCustodyReadiness.readyForPrivatePilot === true, 'Security admin must be able to read evidence custody readiness in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-snapshot`,
  headers: enforcedObserverHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.route?.routeKey === 'persistence-snapshot', 'Observer must not export persistence snapshots in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/agents/jobs/dashboard`,
  headers: enforcedJobsAgentHeaders,
});
assert(response.status === 200 && response.body.agentId === 'jobs', 'Agent must be able to read its own dashboard in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/agents/curie/dashboard`,
  headers: enforcedJobsAgentHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.route?.routeKey === 'agent-read', 'Agent must not read another Agent dashboard in enforced mode.');
response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/curie/submissions`,
  headers: enforcedJobsAgentHeaders,
  body: {
    artifactType: 'risk-review',
    title: 'Unauthorized cross-Agent submission',
    summary: 'This should be rejected by the access layer.',
    body: 'Denied before persistence.',
  },
});
assert(response.status === 403 && response.body.accessDecision?.route?.routeKey === 'agent-submissions', 'Agent must not submit artifacts as another Agent in enforced mode.');
response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmissionId)}/reviews`,
  headers: enforcedCurieReviewerHeaders,
  body: {
    reviewerAgentId: 'jobs',
    verdict: 'accepted',
    comments: 'Reviewer identity mismatch should be rejected.',
  },
});
assert(response.status === 403 && response.body.accessDecision?.route?.routeKey === 'submission-review-create', 'Reviewer Agent must not submit a review under another reviewer id.');
response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/evidence-source-review-workflow`,
  headers: enforcedCurieReviewerHeaders,
  body: {
    reviewerAgentId: 'jobs',
    evidenceSearchId: evidenceSearch.id,
    sourceId: evidenceSourceReviewDecisions[0].sourceId,
    decision: 'approved',
    comments: 'Reviewer identity mismatch should be rejected for source review.',
  },
});
assert(response.status === 403 && response.body.accessDecision?.route?.routeKey === 'evidence-source-review-workflow', 'Reviewer Agent must not submit a source review decision under another reviewer id.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-access-audit`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.securityAccessAudit?.schemaVersion === 'security-access-audit/v1', 'Security admin must be able to read the persisted access audit.');
assert(response.body.securityAccessAudit.count >= 6, 'Security access audit must persist enforced-mode allow and deny decisions.');
assert(response.body.securityAccessAudit.deniedCount >= 4, 'Security access audit must persist denied decisions.');
assert(response.body.securityAccessAudit.rows.every((row) => row.id && row.routeKey && row.actor?.role), 'Security access audit rows must include id, route, and actor proof.');
assert(response.body.securityAccessAudit.eventIds.length >= response.body.securityAccessAudit.count, 'Security access audit must link decisions to event-ledger proof.');
assert(response.body.securityAccessAudit.stream?.count >= response.body.securityAccessAudit.count, 'Security access audit must expose the backend audit stream summary.');
assert(response.body.securityAccessAudit.stream?.sequenceGapCount === 0, 'Security audit stream must preserve contiguous project-local append order.');
assert(response.body.securityAccessAudit.stream?.hashChainReady === true, 'Security access audit must expose a verified backend audit hash chain.');

progress('security audit stream checks');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-audit-stream`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.securityAuditStream?.schemaVersion === 'security-audit-stream/v1', 'Security admin must be able to read the backend audit stream.');
assert(response.body.securityAuditStream.count >= 7, 'Backend security audit stream must persist enforced-mode allow and deny decisions.');
assert(response.body.securityAuditStream.deniedCount >= 4, 'Backend security audit stream must persist denied decisions.');
assert(response.body.securityAuditStream.sequenceGapCount === 0, 'Backend security audit stream must preserve contiguous append order.');
assert(response.body.securityAuditStream.hashChainReady === true && response.body.securityAuditStream.chainBreakCount === 0 && response.body.securityAuditStream.hashMismatchCount === 0, 'Backend security audit stream must expose a verified hash-chain proof.');
assert(response.body.securityAuditStream.rows.every((row) => row.streamRecordId && row.streamChecksum && row.streamSequence && row.previousStreamHash && row.streamHash), 'Backend security audit stream rows must include stream ids, checksums, sequence proof, and hash-chain links.');
assert(response.body.securityAuditStream.storage?.type === 'file-store-append-log', 'Backend security audit stream must use the file-store append log sink.');
assert(response.body.securityAuditStream.storage?.hashChain?.ready === true && response.body.securityAuditStream.storage?.hashChain?.latestStreamHash, 'Backend security audit stream storage must expose hash-chain metadata.');
assert(response.body.securityAuditStream.storage?.auditLogPath?.endsWith('store.json.security-audit.jsonl'), 'Backend security audit stream must expose the append log path.');
assert(response.body.securityAuditStream.storage?.migrationTable === 'security_audit_stream', 'Backend security audit stream must name its persistence migration table.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-boundary`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.securityBoundary.accessAudit?.count >= 8, 'Security boundary must summarize persisted access-audit decisions.');
assert(response.body.securityBoundary.accessAudit?.deniedCount >= 4, 'Security boundary must summarize denied access decisions.');
assert(response.body.securityBoundary.accessAudit?.stream?.count >= response.body.securityBoundary.accessAudit?.count, 'Security boundary must summarize backend audit stream decisions.');
assert(response.body.securityBoundary.accessAudit?.stream?.sequenceGapCount === 0, 'Security boundary must expose contiguous backend audit stream proof.');
assert(response.body.securityBoundary.accessAudit?.stream?.hashChainReady === true, 'Security boundary must expose verified audit-stream hash-chain proof.');

progress('persistence snapshot checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/persistence-snapshot` });
assert(response.status === 200 && response.body.persistenceSnapshot?.schemaVersion === 'production-persistence-snapshot/v1', 'Project API must expose a production persistence snapshot contract.');
assert(response.body.persistenceSnapshot.integrity.status === 'ready', 'Production persistence snapshot must pass integrity checks for the acceptance project.');
for (const table of ['projects', 'project_membership_policies', 'project_membership_grants', 'project_messages', 'project_event_ledger', 'project_timeline_logs', 'project_tasks', 'agent_states', 'agent_submissions', 'evidence_searches', 'evidence_source_snapshots', 'evidence_provider_receipts', 'evidence_source_reviews', 'submission_reviews', 'security_access_audit', 'security_audit_stream', 'provider_usage_ledger', 'provider_eval_runs', 'worker_runs', 'read_model_checkpoints']) {
  assert(response.body.persistenceSnapshot.recordCounts[table] > 0, `Production persistence snapshot must include ${table} records.`);
}
assert(response.body.persistenceSnapshot.recordsByTable.project_membership_policies.some((record) => record.data.revision === 1), 'Production persistence snapshot must include project membership policy rows.');
assert(response.body.persistenceSnapshot.recordsByTable.project_membership_grants.some((record) => record.data.role === 'agent-runtime-binding' && record.data.agentId === 'jobs'), 'Production persistence snapshot must include Agent runtime membership binding rows.');
assert(response.body.persistenceSnapshot.recordsByTable.agent_submissions.some((record) => record.data.artifactType === 'final-deliverable'), 'Production persistence snapshot must include final deliverable submission rows.');
assert(response.body.persistenceSnapshot.recordsByTable.agent_submissions.every((record) => record.data.artifactStorageProofChecksum && record.data.artifactContentChecksum && record.data.artifactStorageStatus === 'local-file-written'), 'Production persistence snapshot must preserve submission artifact storage proof columns.');
assert(response.body.persistenceSnapshot.recordsByTable.artifact_files?.every((record) => record.data.storageProofChecksum && record.data.contentChecksum && record.data.storageStatus === 'local-file-written'), 'Production persistence snapshot artifact file rows must preserve checksummed storage proof columns.');
for (const type of ['discovery-report', 'decision-proposal', 'implementation-plan', 'progress-brief']) {
  assert(response.body.persistenceSnapshot.recordsByTable.agent_submissions.some((record) => record.data.artifactType === type), `Production persistence snapshot must include ${type} submission rows.`);
  assert(response.body.persistenceSnapshot.recordsByTable.artifact_files?.some((record) => record.data.artifactType === type), `Production persistence snapshot must include ${type} artifact file rows.`);
}
assert(response.body.persistenceSnapshot.recordsByTable.agent_submissions.some((record) => record.data.artifactType === 'progress-brief' && record.data.id === generatedDraftSubmission.id), 'Production persistence snapshot must include generated progress-brief draft submission rows.');
assert(response.body.persistenceSnapshot.recordsByTable.agent_submissions.some((record) => record.data.id === generatedDraftSubmission.id && record.data.isGeneratedDraft === true && record.data.artifactDraftSource === 'local-artifact-draft-generator' && record.data.artifactDraftChecksum && record.data.artifactDraftQualityStatus === 'local-quality-ready'), 'Production persistence snapshot must preserve generated draft provenance and quality fields.');
assert(response.body.persistenceSnapshot.recordsByTable.agent_submissions.some((record) => record.data.id === modelGeneratedDraftSubmission.id && record.data.isGeneratedDraft === true && record.data.artifactDraftSource === 'model-artifact-draft' && record.data.artifactDraftModelUsed === true && record.data.artifactDraftChecksum && record.data.artifactDraftQualityStatus === 'local-quality-ready' && record.data.artifactDraftHumanReviewRequired === true), 'Production persistence snapshot must preserve model-generated draft provenance and quality fields.');
assert(response.body.persistenceSnapshot.recordsByTable.artifact_files?.some((record) => record.data.artifactType === 'progress-brief' && record.data.submissionId === generatedDraftSubmission.id), 'Production persistence snapshot must include generated progress-brief artifact file rows.');
assert(response.body.persistenceSnapshot.recordsByTable.artifact_files?.some((record) => record.data.artifactType === 'progress-brief' && record.data.submissionId === modelGeneratedDraftSubmission.id), 'Production persistence snapshot must include model-generated progress-brief artifact file rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_searches.some((record) => record.data.evidenceJudgement === 'strong-evidence'), 'Production persistence snapshot must include evidence judgement rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_searches.some((record) => record.data.sourceSafetyReady === true), 'Production persistence snapshot must include evidence source-safety readiness rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_sources.some((record) => record.data.sourceSafetyLevel === 'safe' && record.data.sourceSafetySignals?.includes('source-safety-screened')), 'Production persistence snapshot must include source-level safety judgement rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_source_snapshots.length === 3 && response.body.persistenceSnapshot.recordsByTable.evidence_source_snapshots.every((record) => record.data.schemaVersion === 'evidence-source-snapshot/v1' && record.data.sourceChecksum && record.data.checksum), 'Production persistence snapshot must include checksummed evidence source snapshot rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_provider_receipts.length === 1 && response.body.persistenceSnapshot.recordsByTable.evidence_provider_receipts.every((record) => record.data.schemaVersion === 'evidence-provider-receipt/v1' && record.data.requestChecksum && record.data.resultChecksum && record.data.checksum), 'Production persistence snapshot must include checksummed evidence provider receipt rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_source_reviews.length === 3, 'Production persistence snapshot must include evidence source review rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_source_reviews.every((record) => record.data.schemaVersion === 'evidence-source-review/v1' && record.data.decision === 'approved' && record.data.commentsChecksum), 'Evidence source review persistence rows must preserve schema version, decision, and comment checksum.');
assert(response.body.persistenceSnapshot.recordsByTable.security_access_audit.some((record) => record.data.allowed === false), 'Production persistence snapshot must include denied access-audit rows.');
assert(response.body.persistenceSnapshot.recordsByTable.security_audit_stream.some((record) => record.data.allowed === false && record.data.streamChecksum), 'Production persistence snapshot must include denied backend audit-stream rows.');
assert(response.body.persistenceSnapshot.recordsByTable.security_audit_stream.every((record) => record.data.previousStreamHash && record.data.streamHash), 'Production persistence snapshot must include audit-stream hash-chain columns.');
assert(response.body.persistenceSnapshot.recordsByTable.provider_usage_ledger.some((record) => record.data.retryPolicyConfigured === true && record.data.circuitBreakerConfigured === true && record.data.retryAttemptCount >= 1), 'Production persistence snapshot must include provider retry/circuit-breaker ledger columns.');
assert(response.body.persistenceSnapshot.recordsByTable.provider_usage_ledger.some((record) => record.data.providerReceiptId && record.data.evidenceIds?.includes(record.data.providerReceiptId)), 'Production persistence snapshot must link provider usage rows to provider receipt evidence.');
assert(response.body.persistenceSnapshot.recordsByTable.provider_usage_ledger.some((record) => record.data.operation === 'model:artifact-draft' && record.data.allowed === true && record.data.ok === true && record.data.model === 'gpt-4o-mini'), 'Production persistence snapshot must include model artifact draft usage rows.');
assert(response.body.persistenceSnapshot.recordsByTable.provider_eval_runs.some((record) => record.data.schemaVersion === 'provider-eval-run/v1' && record.data.readyForPrivatePilotProviderEval === true && record.data.replayedCriticalOperationCount === 2 && record.data.eventId && record.data.timelineLogId), 'Production persistence snapshot must include provider eval shadow replay rows with proof links.');
assert(response.body.persistenceSnapshot.recordsByTable.worker_runs.every((record) => record.data.idempotencyKey && record.data.leaseKey && record.data.receiptChecksum && record.data.executionStatus), 'Production persistence snapshot must include worker idempotency, lease, execution receipt, and status columns.');
assert(response.body.persistenceSnapshot.recordsByTable.worker_runs.every((record) => record.data.maxAttempts >= 3 && typeof record.data.retryable === 'boolean' && typeof record.data.deadLettered === 'boolean'), 'Production persistence snapshot must include worker retry/dead-letter columns.');
assert(response.body.persistenceSnapshot.recordsByTable.read_model_checkpoints.some((record) => record.data.readModel === 'security-boundary'), 'Production persistence snapshot must include the security boundary read-model checkpoint.');

progress('worker queue snapshot checks');
response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/worker-queue`,
  body: {
    now: '2026-06-01T11:25:00.000Z',
    forceDue: true,
    forceProjectIds: [projectId],
    maxAgentsPerProject: team.length,
    maxProjects: 1,
  },
});
assert(response.status === 200 && response.body.workerQueueSnapshot?.schemaVersion === 'worker-queue-snapshot/v1', 'Project API must expose a worker queue snapshot contract.');
assert(response.body.workerQueueSnapshot.summary.projectQueuedCount >= 1, 'Worker queue snapshot must include queued project work when forced due.');
assert(response.body.workerQueueSnapshot.summary.agentQueuedCount >= team.length, 'Worker queue snapshot must include queued Agent work when forced due.');
assert(response.body.workerQueueSnapshot.summary.agentInitiativeCount >= team.length && response.body.workerQueueSnapshot.summary.queuedAgentInitiativeCount >= team.length, 'Worker queue snapshot must summarize Agent initiative coverage for queued Agent work.');
assert(response.body.workerQueueSnapshot.retryPolicy?.schemaVersion === 'worker-queue-retry-policy/v1' && response.body.workerQueueSnapshot.deadLetterPolicy?.schemaVersion === 'worker-dead-letter-policy/v1', 'Worker queue snapshot must expose retry and dead-letter policies.');
assert(response.body.workerQueueSnapshot.agentQueue.every((row) => row.idempotencyKey && row.leaseKey && row.runApiPath === '/workers/agents/due' && row.retry?.schemaVersion === 'worker-retry-state/v1' && row.executionReceiptExpected === true), 'Agent worker queue rows must include idempotency, lease, retry, receipt, and worker route contract.');
assert(response.body.workerQueueSnapshot.agentQueue.every((row) => row.initiative?.schemaVersion === 'agent-autonomous-initiative/v1' && row.initiativeId && row.initiativeIntent && row.initiativeArtifactType && row.agentAutonomousActionRunApiPath?.includes('/agent-autonomous-action-queue/') && row.requestBody?.agentInitiativeId === row.initiativeId), 'Agent worker queue rows must carry the backend Agent initiative into queue/import/lease request bodies.');
assert(response.body.workerQueueSnapshot.executionReceipts.length >= 1 && response.body.workerQueueSnapshot.executionReceipts.every((receipt) => receipt.receiptChecksum && receipt.idempotencyKey && receipt.leaseKey), 'Worker queue snapshot must expose execution receipts for completed worker runs.');
assert(Array.isArray(response.body.workerQueueSnapshot.deadLetterQueue) && response.body.workerQueueSnapshot.summary.workerDeadLetterCount === response.body.workerQueueSnapshot.deadLetterQueue.length, 'Worker queue snapshot must expose dead-letter queue summary and rows.');

response = api.handle({
  method: 'POST',
  path: '/workers/queue-snapshot',
  body: {
    now: '2026-06-01T11:25:00.000Z',
    forceDue: true,
    forceProjectIds: [projectId],
    maxAgentsPerProject: team.length,
    maxProjects: 1,
  },
});
assert(response.status === 200 && response.body.workerQueueSnapshot?.projectQueue.some((row) => row.projectId === projectId), 'Global worker queue snapshot must include the acceptance project.');
assert(response.body.workerQueueSnapshot.summary.workerRunReceiptCount >= 1, 'Global worker queue snapshot must include worker execution receipt counts.');

progress('worker queue adapter plan checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/worker-queue-adapter-plan` });
assert(response.status === 200 && response.body.workerQueueAdapterPlan?.schemaVersion === 'worker-queue-adapter-plan/v1', 'Project API must expose a worker queue adapter plan.');
assert(response.body.workerQueueAdapterPlan.status === 'ready-for-queue-adapter-pilot', 'Worker queue adapter plan must pass for the acceptance project.');
assert(response.body.workerQueueAdapterPlan.adapterContract?.methods?.includes('ackExecutionReceipt(workerExecutionReceipt)'), 'Worker queue adapter plan must include execution receipt acknowledgement.');
assert(response.body.workerQueueAdapterPlan.adapterContract?.methods?.includes('inspectSnapshotParity(workerQueueSnapshot, projectId)'), 'Worker queue adapter plan must include snapshot parity inspection.');
assert(response.body.workerQueueAdapterPlan.queuePlans?.some((plan) => plan.id === 'agent-work' && plan.dueCount >= team.length), 'Worker queue adapter plan must include the Agent worker queue.');
assert(response.body.workerQueueAdapterPlan.adapterStatus?.schemaVersion === 'worker-queue-adapter-status/v1', 'Worker queue adapter plan must expose adapter driver status.');
assert(response.body.workerQueueAdapterPlan.adapterStatus.driver === 'local-shadow', 'Default worker queue adapter plan must use the local-shadow driver.');
assert(response.body.workerQueueAdapterPlan.adapterStatus.productionCutoverReady === false, 'Default worker queue adapter plan must not claim production queue cutover readiness.');

progress('worker queue adapter dry-run checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/worker-queue-adapter-dry-run` });
assert(response.status === 200 && response.body.workerQueueAdapterDryRun?.schemaVersion === 'worker-queue-adapter-dry-run/v1', 'Project API must expose a worker queue adapter dry-run.');
assert(response.body.workerQueueAdapterDryRun.status === 'passed', 'Worker queue adapter dry-run must pass for the acceptance project.');
assert(response.body.workerQueueAdapterDryRun.gates.every((gate) => gate.passed), 'Worker queue adapter dry-run gates must all pass.');
assert(response.body.workerQueueAdapterDryRun.gates.some((gate) => gate.id === 'adapter-driver-status' && gate.passed), 'Worker queue adapter dry-run must prove adapter driver status.');
assert(response.body.workerQueueAdapterDryRun.gates.some((gate) => gate.id === 'adapter-execution-receipt' && gate.passed), 'Worker queue adapter dry-run must prove the adapter execution receipt.');
assert(response.body.workerQueueAdapterDryRun.gates.some((gate) => gate.id === 'snapshot-parity' && gate.passed), 'Worker queue adapter dry-run must prove queue snapshot parity.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution?.schemaVersion === 'worker-queue-adapter-shadow-execution/v1', 'Worker queue adapter dry-run must expose the shadow adapter execution record.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.adapterStatus?.driver === 'local-shadow', 'Worker queue adapter dry-run must expose the local-shadow queue adapter driver.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.adapterStatus.productionCutoverReady === false, 'Worker queue adapter dry-run must keep production queue cutover blocked until a real adapter runs.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.finalReceipt?.schemaVersion === 'worker-queue-adapter-execution-receipt/v1', 'Worker queue adapter dry-run must expose a final queue adapter execution receipt.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.snapshotParityReceipt?.schemaVersion === 'worker-queue-adapter-snapshot-parity/v1', 'Worker queue adapter dry-run must expose a snapshot parity receipt.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.snapshotParityReceipt?.parityReady === true, 'Worker queue adapter snapshot parity receipt must pass.');
assert(response.body.workerQueueAdapterDryRun.summary.adapterOperationCount >= team.length + 4, 'Worker queue adapter dry-run summary must expose executed queue adapter operations.');
assert(response.body.workerQueueAdapterDryRun.summary.adapterQueueRowCount >= team.length, 'Worker queue adapter dry-run summary must expose imported queue row coverage.');
assert(response.body.workerQueueAdapterDryRun.summary.snapshotParityReady === true, 'Worker queue adapter dry-run summary must expose snapshot parity readiness.');
assert(response.body.workerQueueAdapterDryRun.summary.snapshotLeaseParityReady === true, 'Worker queue adapter dry-run summary must expose lease parity readiness.');
assert(response.body.workerQueueAdapterDryRun.summary.snapshotDeadLetterParityReady === true, 'Worker queue adapter dry-run summary must expose dead-letter parity readiness.');
assert(response.body.workerQueueAdapterDryRun.summary.adapterDriver === 'local-shadow', 'Worker queue adapter dry-run summary must expose the active queue adapter driver.');
assert(response.body.workerQueueAdapterDryRun.summary.adapterProductionCutoverReady === false, 'Worker queue adapter dry-run summary must not claim production queue cutover readiness for local shadow runs.');
assert(response.body.workerQueueAdapterDryRun.summary.dispatchCount >= team.length && response.body.workerQueueAdapterDryRun.summary.leaseAcquisitionCount >= team.length, 'Worker queue adapter dry-run must simulate dispatch and lease acquisition.');

progress('manager flow graph checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
const graph = response.body;
const submissionNodes = graph.nodes.filter((node) => node.category === 'submission' && node.source === 'agentSubmissions');
const evidenceNodes = graph.nodes.filter((node) => node.category === 'evidence' && node.source === 'evidenceSearches');
const reviewNodes = graph.nodes.filter((node) => node.category === 'review' && node.source === 'submissionReviews');
const submissionReviewWorkflowNodes = graph.nodes.filter((node) => node.id === 'submission-review-workflow' && node.source === 'submissionReviewWorkflow');
const evidenceSourceReviewNodes = graph.nodes.filter((node) => node.category === 'review' && node.source === 'evidenceSourceReviews');
const evidenceCustodyNodes = graph.nodes.filter((node) => node.category === 'evidence' && node.source === 'evidenceCustodyReadiness');
const providerEvalRunNodes = graph.nodes.filter((node) => node.category === 'monitoring' && node.source === 'providerEvalRuns');
const selfMarketingNodes = graph.nodes.filter((node) => node.category === 'self-marketing');
const roleClarificationNodes = graph.nodes.filter((node) => node.subtype === 'role-clarification');
const autonomousRunControlNodes = graph.nodes.filter((node) => node.id === 'autonomous-run-control' && node.source === 'autonomousRunControl');
const autonomousRunControlEdges = graph.edges.filter((edge) => edge.source === 'autonomousRunControl');
const agentAutonomousActionNodes = graph.nodes.filter((node) => node.source === 'agentAutonomousActionQueue' && node.id?.startsWith('agent-autonomous-action-'));
const productTeamOperatingLoopNodes = graph.nodes.filter((node) => node.id === 'product-team-operating-loop' && node.source === 'productTeamOperatingLoop');
const productTeamOperatingLoopEdges = graph.edges.filter((edge) => edge.source === 'productTeamOperatingLoop');
const teamCollaborationDiagnosticNodes = graph.nodes.filter((node) => node.id === 'team-collaboration-diagnostics' && node.source === 'teamCollaborationDiagnostics');
const teamCollaborationDiagnosticEdges = graph.edges.filter((edge) => edge.source === 'teamCollaborationDiagnostics');
const collaborationIntentQueueNodes = graph.nodes.filter((node) => node.id === 'collaboration-intent-queue' && node.source === 'collaborationIntentQueue');
const collaborationIntentQueueEdges = graph.edges.filter((edge) => edge.source === 'collaborationIntentQueue');
const runtimeContractNodes = graph.nodes.filter((node) => node.id === 'runtime-contract-freeze' && node.source === 'runtimeContracts');
const runtimeContractEdges = graph.edges.filter((edge) => edge.source === 'runtimeContracts');
const revisionEdges = graph.edges.filter((edge) => edge.type === 'revision');
const submissionReviewWorkflowEdges = graph.edges.filter((edge) => edge.source === 'submissionReviewWorkflow');
const sourceReviewEdges = graph.edges.filter((edge) => edge.source === 'evidenceSourceReviews');
const evidenceCustodyEdges = graph.edges.filter((edge) => edge.source === 'evidenceCustodyReadiness');
const providerEvalRunEdges = graph.edges.filter((edge) => edge.source === 'providerEvalRuns');
const brainstormLayerNodes = graph.nodes.filter((node) => node.id === 'brainstorm-layer' && node.subtype === 'brainstorm-layer');
const brainstormLayerEdges = graph.edges.filter((edge) => edge.source === 'brainstormLayer');
const graphTypes = new Set(submissionNodes.map((node) => node.subtype));
for (const type of ['discovery-report', 'brainstorm-board', 'evidence-packet', 'product-brief', 'decision-proposal', 'risk-review', 'revision-note', 'implementation-plan', 'progress-brief', 'final-deliverable']) {
  assert(graphTypes.has(type), `Manager Flow Graph must include ${type} submission node.`);
}
assert(roleClarificationNodes.length > 0 && roleClarificationNodes.every((node) => node.proofIds.length && node.eventIds.length && node.attachments.length), 'Manager Flow Graph must include proofed role-clarification nodes.');
assert(selfMarketingNodes.some((node) => node.subtype === 'role-self-nomination'), 'Manager Flow Graph must include role self-nomination self-marketing nodes.');
assert(selfMarketingNodes.some((node) => node.subtype === 'leader-campaign'), 'Manager Flow Graph must include Leader campaign self-marketing nodes.');
assert(selfMarketingNodes.every((node) => node.proofIds.length && node.eventIds.length && node.attachments.length), 'Every self-marketing node must have transcript, event, and attachment proof.');
assert(submissionNodes.every((node) => node.proofIds.length && node.timelineLogIds.length && node.eventIds.length && node.attachments.length), 'Every explicit submission node must have chat, timeline, event, and artifact proof.');
assert(submissionNodes.every((node) => node.attachments.some((attachment) => attachment.storageProof?.schemaVersion === 'agent-artifact-storage-proof/v1' && attachment.storageProof.checksum)), 'Every explicit submission node must expose checksummed artifact storage proof in its Flow Graph attachment.');
assert(brainstormLayerNodes.length === 1 && brainstormLayerNodes[0].route?.endsWith('/brainstorm-layer') && brainstormLayerNodes[0].proofIds.length && brainstormLayerNodes[0].timelineLogIds.length && brainstormLayerNodes[0].eventIds.length, 'Manager Flow Graph must include a proofed brainstorm layer node.');
assert(brainstormLayerEdges.some((edge) => edge.toNodeId === 'brainstorm-layer') && brainstormLayerEdges.some((edge) => edge.fromNodeId === 'brainstorm-layer'), 'Manager Flow Graph must connect brainstorm submissions into downstream product-team artifacts.');
assert(revisionEdges.length >= 3 && revisionEdges.every((edge) => edge.proofIds.length && edge.timelineLogIds.length && edge.eventIds.length), 'Manager Flow Graph must include proofed revision lineage edges.');
assert(submissionReviewWorkflowNodes.length === 1 && submissionReviewWorkflowNodes[0].route?.endsWith('/submission-review-workflow') && submissionReviewWorkflowNodes[0].proofIds.length && submissionReviewWorkflowNodes[0].timelineLogIds.length && submissionReviewWorkflowNodes[0].eventIds.length, 'Manager Flow Graph must include a proofed submission review workflow closure node.');
assert(submissionReviewWorkflowEdges.some((edge) => edge.toNodeId === 'submission-review-workflow' && edge.proofIds.length && edge.timelineLogIds.length && edge.eventIds.length), 'Manager Flow Graph must connect review and revision nodes into the submission review workflow.');
assert(evidenceNodes.length === 1 && evidenceNodes.every((node) => node.proofIds.length && node.timelineLogIds.length && node.eventIds.length && node.attachments.length), 'Manager Flow Graph must include proofed evidence-search nodes.');
const evidenceSourceAttachments = evidenceNodes[0].attachments.filter((attachment) => attachment.source === 'evidenceSearches');
assert(evidenceNodes[0].summary.includes('strong-evidence') && evidenceSourceAttachments.every((attachment) => attachment.qualityScore > 0 && attachment.qualityLevel), 'Manager Flow Graph evidence node must expose source quality judgement.');
assert(evidenceNodes[0].sourceSafetySummary?.sourceSafetyReady === true && evidenceNodes[0].sourceSafetySummary?.blockedSourceCount === 0 && evidenceSourceAttachments.every((attachment) => attachment.sourceSafetyLevel === 'safe' && attachment.sourceSafetySignals?.includes('source-safety-screened')), 'Manager Flow Graph evidence node must expose source-safety judgement.');
assert(evidenceNodes[0].attachments.filter((attachment) => attachment.type === 'evidence-source-snapshot').length === 3, 'Manager Flow Graph evidence node must include source snapshot attachments.');
assert(evidenceNodes[0].attachments.some((attachment) => attachment.type === 'evidence-provider-receipt' && attachment.checksum), 'Manager Flow Graph evidence node must include provider receipt attachment.');
assert(evidenceSourceReviewNodes.length === 3 && evidenceSourceReviewNodes.every((node) => node.proofIds.length && node.timelineLogIds.length && node.eventIds.length && node.attachments.some((attachment) => attachment.type === 'evidence-source-review')), 'Manager Flow Graph must include proofed evidence-source-review nodes.');
assert(sourceReviewEdges.some((edge) => edge.fromNodeId === `evidence-search-${evidenceSearch.id}` && edge.toNodeId.startsWith('evidence-source-review-')), 'Manager Flow Graph must connect evidence searches to source review decisions.');
assert(evidenceCustodyNodes.length === 1 && evidenceCustodyNodes.every((node) => node.route?.endsWith('/evidence-custody-readiness') && node.proofIds.length && node.timelineLogIds.length && node.eventIds.length && node.attachments.some((attachment) => attachment.type === 'evidence-custody')), 'Manager Flow Graph must include a proofed evidence-custody readiness node.');
assert(evidenceCustodyEdges.some((edge) => edge.fromNodeId === `evidence-search-${evidenceSearch.id}` && edge.toNodeId === 'evidence-custody-readiness' && edge.proofIds.length && edge.timelineLogIds.length && edge.eventIds.length), 'Manager Flow Graph must connect evidence searches to custody readiness.');
assert(providerEvalRunNodes.length >= 1 && providerEvalRunNodes.every((node) => node.subtype === 'provider-eval-run' && node.route?.endsWith('/provider-eval-runs') && node.proofIds.length && node.timelineLogIds.length && node.eventIds.length && node.attachments.some((attachment) => attachment.type === 'provider-eval-operations')), 'Manager Flow Graph must include proofed provider eval shadow replay nodes.');
assert(providerEvalRunEdges.some((edge) => edge.toNodeId.startsWith('provider-eval-run-') && edge.proofIds.length && edge.timelineLogIds.length && edge.eventIds.length), 'Manager Flow Graph must connect provider eval runs to the project evidence ledger.');
assert(reviewNodes.length === 2 && reviewNodes.every((node) => node.proofIds.length && node.timelineLogIds.length && node.eventIds.length && node.attachments.length), 'Manager Flow Graph must include proofed submission-review nodes.');
assert(autonomousRunControlNodes.length === 1 && autonomousRunControlNodes[0].route?.endsWith('/autonomous-run-control') && autonomousRunControlNodes[0].attachments.some((attachment) => attachment.type === 'autonomous-run-next-action') && autonomousRunControlNodes[0].attachments.some((attachment) => attachment.type === 'autonomous-run-gate'), 'Manager Flow Graph must include autonomous run control node with next-action and gate attachments.');
assert(autonomousRunControlEdges.some((edge) => edge.fromNodeId === 'autonomous-run-control' && edge.toNodeId.startsWith('agent-autonomous-action-')), 'Manager Flow Graph must connect autonomous run control into Agent-selected action nodes.');
assert(agentAutonomousActionNodes.length >= team.length && agentAutonomousActionNodes.every((node) => node.attachments.some((attachment) => attachment.type === 'agent-autonomous-initiative' && attachment.schemaVersion === 'agent-autonomous-initiative/v1' && attachment.intent && attachment.artifactType && attachment.runApiPath?.includes('/agent-autonomous-action-queue/'))), 'Manager Flow Graph Agent autonomous action nodes must expose Agent initiative intent attachments.');
assert(productTeamOperatingLoopNodes.length === 1 && productTeamOperatingLoopNodes[0].route?.endsWith('/product-team-operating-loop') && productTeamOperatingLoopNodes[0].proofIds.length && productTeamOperatingLoopNodes[0].timelineLogIds.length && productTeamOperatingLoopNodes[0].eventIds.length, 'Manager Flow Graph must include a proofed product-team operating loop node.');
assert(productTeamOperatingLoopNodes[0].attachments.some((attachment) => attachment.type === 'operating-loop-c-side' && attachment.runApiPath?.includes('/autonomous-run-control/')) && productTeamOperatingLoopNodes[0].attachments.some((attachment) => attachment.type === 'operating-loop-customer-agent-handoff' && attachment.runApiPath?.endsWith('/autonomous-run-control/run-backend-scheduler-tick/run') && typeof attachment.executionStatus === 'string') && productTeamOperatingLoopNodes[0].attachments.some((attachment) => attachment.type === 'operating-loop-a-side' && attachment.selectedActions?.length && attachment.initiativeRows?.length >= team.length) && productTeamOperatingLoopNodes[0].attachments.some((attachment) => attachment.type === 'operating-loop-proof' && attachment.deliveryTraceRoute?.endsWith('/product-team-delivery-trace')) && productTeamOperatingLoopNodes[0].attachments.some((attachment) => attachment.type === 'operating-loop-gate' && attachment.status === 'production-blocked'), 'Manager Flow Graph operating loop node must expose C-side control, C/A handoff execution state, A-side initiative strategy, proof route, and production boundary attachments.');
assert(productTeamOperatingLoopEdges.some((edge) => edge.fromNodeId === 'product-team-delivery-trace' && edge.toNodeId === 'product-team-operating-loop') && productTeamOperatingLoopEdges.some((edge) => edge.fromNodeId === 'autonomous-run-control' && edge.toNodeId === 'product-team-operating-loop') && productTeamOperatingLoopEdges.some((edge) => edge.fromNodeId.startsWith('agent-autonomous-action-') && edge.toNodeId === 'product-team-operating-loop'), 'Manager Flow Graph must connect Delivery Trace, Run Control, and Agent strategy nodes into the Product Team Operating Loop.');
assert(teamCollaborationDiagnosticNodes.length === 1 && teamCollaborationDiagnosticNodes[0].route?.endsWith('/team-collaboration-diagnostics') && teamCollaborationDiagnosticNodes[0].proofIds.length && teamCollaborationDiagnosticNodes[0].timelineLogIds.length && teamCollaborationDiagnosticNodes[0].eventIds.length, 'Manager Flow Graph must include a proofed team collaboration diagnostics node.');
assert(teamCollaborationDiagnosticNodes[0].attachments.some((attachment) => attachment.type === 'collaboration-diagnostics-loop' && attachment.route?.endsWith('/product-team-operating-loop')) && teamCollaborationDiagnosticNodes[0].attachments.some((attachment) => attachment.type === 'collaboration-diagnostics-proof' && attachment.transcriptRoute?.endsWith('/transcripts') && attachment.timelineRoute?.endsWith('/timeline') && attachment.eventLedgerRoute?.endsWith('/events')) && teamCollaborationDiagnosticNodes[0].attachments.some((attachment) => attachment.type === 'collaboration-diagnostics-production-boundary' && attachment.status === 'production-blocked'), 'Manager Flow Graph collaboration diagnostics node must expose operating loop, proof surfaces, and production boundary attachments.');
assert(teamCollaborationDiagnosticEdges.some((edge) => edge.fromNodeId === 'product-team-operating-loop' && edge.toNodeId === 'team-collaboration-diagnostics') && teamCollaborationDiagnosticEdges.some((edge) => edge.fromNodeId === 'product-team-delivery-trace' && edge.toNodeId === 'team-collaboration-diagnostics') && teamCollaborationDiagnosticEdges.some((edge) => edge.fromNodeId === 'submission-review-workflow' && edge.toNodeId === 'team-collaboration-diagnostics'), 'Manager Flow Graph must connect operating loop, delivery trace, and review workflow into team collaboration diagnostics.');
assert(collaborationIntentQueueNodes.length === 1 && collaborationIntentQueueNodes[0].route?.endsWith('/collaboration-intent-queue') && collaborationIntentQueueNodes[0].proofIds.length && collaborationIntentQueueNodes[0].timelineLogIds.length && collaborationIntentQueueNodes[0].eventIds.length, 'Manager Flow Graph must include a proofed collaboration intent queue node.');
assert(collaborationIntentQueueNodes[0].attachments.some((attachment) => attachment.type === 'collaboration-intent-protocol' && attachment.route?.endsWith('/collaboration-intent-queue')) && collaborationIntentQueueNodes[0].attachments.some((attachment) => attachment.type === 'agent-autonomous-initiative' && attachment.route?.endsWith('/agent-autonomous-action-queue')) && collaborationIntentQueueNodes[0].attachments.some((attachment) => attachment.type === 'collaboration-intent-production-boundary' && attachment.status === 'production-blocked'), 'Manager Flow Graph collaboration intent queue node must expose meeting protocol, Agent initiative source, and production boundary attachments.');
assert(collaborationIntentQueueEdges.some((edge) => edge.fromNodeId === 'team-collaboration-diagnostics' && edge.toNodeId === 'collaboration-intent-queue') && collaborationIntentQueueEdges.some((edge) => edge.fromNodeId === 'product-team-operating-loop' && edge.toNodeId === 'collaboration-intent-queue'), 'Manager Flow Graph must connect diagnostics and operating loop into the collaboration intent queue.');
assert(runtimeContractNodes.length === 1 && runtimeContractNodes[0].route?.endsWith('/runtime-contracts') && runtimeContractNodes[0].proofIds.length && runtimeContractNodes[0].timelineLogIds.length && runtimeContractNodes[0].eventIds.length, 'Manager Flow Graph must include a proofed runtime contract freeze node.');
assert(runtimeContractNodes[0].attachments.some((attachment) => attachment.type === 'runtime-contract-freeze-local' && attachment.route?.endsWith('/runtime-contracts')) && runtimeContractNodes[0].attachments.some((attachment) => attachment.type === 'runtime-contract-freeze-proof' && attachment.proofIds?.length && attachment.timelineLogIds?.length && attachment.eventIds?.length) && runtimeContractNodes[0].attachments.some((attachment) => attachment.type === 'runtime-contract-freeze-production-boundary' && attachment.status === 'production-blocked'), 'Manager Flow Graph runtime contract node must expose local contracts, proof surfaces, and production boundary attachments.');
assert(runtimeContractEdges.some((edge) => edge.fromNodeId === 'team-collaboration-diagnostics' && edge.toNodeId === 'runtime-contract-freeze') && runtimeContractEdges.some((edge) => edge.fromNodeId === 'collaboration-intent-queue' && edge.toNodeId === 'runtime-contract-freeze') && runtimeContractEdges.some((edge) => edge.fromNodeId === 'product-team-operating-loop' && edge.toNodeId === 'runtime-contract-freeze') && runtimeContractEdges.some((edge) => edge.fromNodeId === 'product-team-delivery-trace' && edge.toNodeId === 'runtime-contract-freeze'), 'Manager Flow Graph must connect diagnostics, intent queue, operating loop, and delivery trace into runtime contract freeze.');

progress('initial readiness proof map checks');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assert(response.status === 200 && response.body.submissionSummary.count === expectedSubmissionCount, 'Readiness Proof Map must summarize Agent submissions, including generated artifact drafts.');
assert(response.body.submissionSummary.artifactStorageProofCount === expectedSubmissionCount && response.body.submissionRoutes.every((route) => route.storageProofReady && route.artifactStorageProofChecksum), 'Readiness Proof Map must summarize checksummed artifact storage proof coverage for every Agent submission route.');
assert(response.body.transcriptProofCoverageSummary?.readyForBackendTranscriptProof === true && response.body.transcriptProofCoverageSummary?.missingProofIdCount === 0 && response.body.transcriptProofCoverageSummary?.submissionProofIdCount === expectedSubmissionCount && response.body.transcriptProofCoverageSummary?.evidenceSearchProofIdCount >= 1 && response.body.transcriptProofCoverageSummary?.evidenceSourceReviewProofIdCount >= 3 && response.body.transcriptProofCoverageSummary?.submissionReviewProofIdCount >= 2, 'Readiness Proof Map must summarize complete backend transcript proof coverage for submissions, evidence, source reviews, and submission reviews.');
assert(response.body.transcriptProofCoverageRoutes?.some((route) => route.apiPath?.endsWith('/transcripts') && route.readyForBackendTranscriptProof === true && route.archivedProofIdCount === route.expectedProofIdCount && route.missingProofIdCount === 0), 'Readiness Proof Map must expose transcript proof coverage as a backend route.');
assert(response.body.roleNegotiationSummary.roleClarificationCount > 0 && response.body.roleNegotiationSummary.selfNominationCount > 0, 'Readiness Proof Map must expose role-negotiation routes.');
assert(response.body.selfMarketingSummary.selfNominationCount > 0 && response.body.selfMarketingSummary.leaderCampaignCount > 0, 'Readiness Proof Map must expose self-marketing routes.');
assert(response.body.selfMarketingRoutes.every((route) => route.proofIds.length && route.eventIds.length && route.apiPath), 'Self-marketing proof routes must include transcript and event proof.');
assert(response.body.brainstormLayerRoutes?.some((route) => route.apiPath?.endsWith('/brainstorm-layer') && route.readyForPrivatePilotBrainstorm === true && route.alternativeCount >= 3), 'Readiness Proof Map must expose brainstorm layer routes with alternatives and readiness.');
assert(response.body.brainstormLayerSummary?.proofIds?.length && response.body.brainstormLayerSummary?.timelineLogIds?.length && response.body.brainstormLayerSummary?.eventIds?.length, 'Readiness Proof Map brainstorm layer summary must preserve chat, timeline, and event proof.');
assert(response.body.revisionSummary.count >= 2 && response.body.revisionSummary.respondedReviewIds.includes(reviewsByVerdict.get('changes-requested')?.id), 'Readiness Proof Map must summarize artifact revision lineage.');
assert(response.body.revisionRoutes.every((route) => route.proofIds.length && route.timelineLogIds.length && route.eventIds.length && route.apiPath), 'Revision proof routes must include chat, timeline, event, and API proof.');
assert(response.body.submissionRoutes.some((route) => route.artifactType === 'final-deliverable'), 'Readiness Proof Map must expose final deliverable submission route.');
assert(response.body.productTeamDeliveryTraceSummary?.count === 1 && response.body.productTeamDeliveryTraceSummary?.proofIds?.length && response.body.productTeamDeliveryTraceSummary?.revisionCount >= 1, 'Readiness Proof Map must summarize the product-team delivery trace.');
assert(response.body.productTeamDeliveryTraceRoutes?.some((route) => route.apiPath?.endsWith('/product-team-delivery-trace') && route.acceptedFinalDeliverableCount >= 1 && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map must expose the product-team delivery trace proof route.');
const expectedGenericAcceptanceStageIds = [
  'kickoff-meeting',
  'agent-self-marketing',
  'brainstorm-layer',
  'evidence-quality',
  'draft-artifact',
  'review-and-revision',
  'final-deliverable',
  'proof-surfaces',
];
const productTeamAcceptanceChainRoute = response.body.productTeamAcceptanceChainRoutes?.find((route) => route.apiPath?.endsWith('/product-team-delivery-trace'));
assert(response.body.productTeamAcceptanceChainSummary?.readyForGenericProductTeamAcceptance === true && response.body.productTeamAcceptanceChainSummary?.readyForBsideProductTeamRun === true && response.body.productTeamAcceptanceChainSummary?.readyForProduction === false, 'Readiness Proof Map must summarize the generic product-team acceptance chain without production overclaim.');
assert(expectedGenericAcceptanceStageIds.every((stageId) => response.body.productTeamAcceptanceChainSummary?.readyStageIds?.includes(stageId)) && response.body.productTeamAcceptanceChainSummary?.missingStageIds?.length === 0, 'Readiness Proof Map product-team acceptance summary must close every generic stage.');
assert(productTeamAcceptanceChainRoute?.readyForGenericProductTeamAcceptance === true && productTeamAcceptanceChainRoute.readyForBsideProductTeamRun === true && productTeamAcceptanceChainRoute.productionBlocked === true && productTeamAcceptanceChainRoute.readyForProduction === false, 'Readiness Proof Map must expose a route-backed generic product-team acceptance chain with B-side loop readiness and production blockers.');
assert(expectedGenericAcceptanceStageIds.every((stageId) => productTeamAcceptanceChainRoute?.stageIds?.includes(stageId)) && expectedGenericAcceptanceStageIds.every((stageId) => productTeamAcceptanceChainRoute?.readyStageIds?.includes(stageId)) && productTeamAcceptanceChainRoute?.missingStageIds?.length === 0, 'Generic product-team acceptance route must keep the stage contract explicit and complete.');
assert(productTeamAcceptanceChainRoute?.stageRows?.every((row) => !/\b(paper|thesis|manuscript)\b|论文/i.test(`${row.id} ${row.label} ${row.detail}`)) && productTeamAcceptanceChainRoute?.proofIds?.length && productTeamAcceptanceChainRoute?.timelineLogIds?.length && productTeamAcceptanceChainRoute?.eventIds?.length, 'Generic product-team acceptance route must not be research-specific and must preserve proof, timeline, and event links.');
assert(response.body.autonomousRunControlSummary?.routeReady === true && response.body.autonomousRunControlRoutes?.some((route) => route.apiPath?.endsWith('/autonomous-run-control') && route.schedulerRoute === '/workers/autonomous/tick'), 'Readiness Proof Map must expose autonomous run control routes with scheduler linkage.');
assert(response.body.productTeamOperatingLoopSummary?.routeReady === true && response.body.productTeamOperatingLoopSummary?.readyForLocalPilotOperatingLoop === true && response.body.productTeamOperatingLoopSummary?.readyForProduction === false, 'Readiness Proof Map must summarize the product-team operating loop without production overclaim.');
assert(response.body.productTeamOperatingLoopRoutes?.some((route) => route.apiPath?.endsWith('/product-team-operating-loop') && route.deliveryTraceRoute?.endsWith('/product-team-delivery-trace') && route.autonomousRunControlRoute?.endsWith('/autonomous-run-control') && route.schedulerRoute === '/workers/autonomous/tick' && route.readyForLocalPilotOperatingLoop === true && route.productionBlocker === true && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map must expose the product-team operating loop proof route with delivery, run-control, scheduler, and production-boundary evidence.');
assert(response.body.managerUseCaseAuditSummary?.routeReady === true && response.body.managerUseCaseAuditSummary?.readyForProduction === false, 'Readiness Proof Map must summarize Manager Use Case Audit route coverage without production overclaim.');
assert(response.body.managerUseCaseAuditRoutes?.some((route) => route.apiPath?.endsWith('/manager-use-case-audit') && route.managerDashboardRoute?.endsWith('/manager-dashboard') && route.managerActionQueueRoute?.endsWith('/manager-action-queue') && route.readyForProduction === false && route.productionBlocker === true && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map must expose Manager Use Case Audit as a C-side proof route with action-queue linkage.');
assert(response.body.teamCollaborationDiagnosticsSummary?.routeReady === true && response.body.teamCollaborationDiagnosticsSummary?.readyForLocalPilotCollaboration === true && response.body.teamCollaborationDiagnosticsSummary?.readyForProduction === false, 'Readiness Proof Map must summarize team collaboration diagnostics without production overclaim.');
assert(response.body.teamCollaborationDiagnosticRoutes?.some((route) => route.apiPath?.endsWith('/team-collaboration-diagnostics') && route.productTeamOperatingLoopRoute?.endsWith('/product-team-operating-loop') && route.productTeamDeliveryTraceRoute?.endsWith('/product-team-delivery-trace') && route.transcriptRoute?.endsWith('/transcripts') && route.timelineRoute?.endsWith('/timeline') && route.eventLedgerRoute?.endsWith('/events') && route.readyForLocalPilotCollaboration === true && route.productionBlocker === true && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map must expose team collaboration diagnostics proof route with operating-loop, transcript, timeline, event, and production-boundary evidence.');
assert(response.body.collaborationIntentQueueSummary?.routeReady === true && response.body.collaborationIntentQueueSummary?.readyForLocalPilotIntentQueue === true && response.body.collaborationIntentQueueSummary?.readyForProduction === false, 'Readiness Proof Map must summarize collaboration intent queue without production overclaim.');
assert(response.body.collaborationIntentQueueRoutes?.some((route) => route.apiPath?.endsWith('/collaboration-intent-queue') && route.productTeamOperatingLoopRoute?.endsWith('/product-team-operating-loop') && route.teamCollaborationDiagnosticsRoute?.endsWith('/team-collaboration-diagnostics') && route.agentAutonomousActionQueueRoute?.endsWith('/agent-autonomous-action-queue') && route.managerCommandCenterRoute?.endsWith('/manager-command-center') && route.readyForLocalPilotIntentQueue === true && route.productionBlocker === true && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map must expose collaboration intent queue proof route with operating-loop, diagnostics, Agent queue, Manager command, and production-boundary evidence.');
assert(response.body.runtimeContractFreezeSummary?.routeReady === true && response.body.runtimeContractFreezeSummary?.readyForLocalPilotContractFreeze === true && response.body.runtimeContractFreezeSummary?.readyForProduction === false, 'Readiness Proof Map must summarize runtime contract freeze without production overclaim.');
assert(response.body.runtimeContractFreezeRoutes?.some((route) => route.apiPath?.endsWith('/runtime-contracts') && route.productTeamOperatingLoopRoute?.endsWith('/product-team-operating-loop') && route.teamCollaborationDiagnosticsRoute?.endsWith('/team-collaboration-diagnostics') && route.readyForLocalPilotContractFreeze === true && route.productionBlocker === true && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map must expose runtime contract freeze proof route with operating-loop, diagnostics, proof, and production-boundary evidence.');
assert(response.body.artifactQualitySummary?.count === expectedSubmissionCount && response.body.artifactQualitySummary?.generatedDraftCount === 2 && response.body.artifactQualitySummary?.productionQualityReady === false, 'Readiness Proof Map must summarize artifact quality audit coverage and production quality status.');
assert(response.body.artifactQualityRoutes?.some((route) => route.apiPath?.endsWith('/artifact-quality-audit') && route.proofIds.length === expectedSubmissionCount && route.artifactTypes.includes('final-deliverable')), 'Readiness Proof Map must expose artifact quality audit proof route.');
assert(response.body.providerControlledRunSummary?.count >= 2 && response.body.providerControlledRunSummary?.operations.includes('model:artifact-draft') && response.body.providerControlledRunSummary?.operations.includes('search:evidence'), 'Readiness Proof Map must summarize provider controlled run usage operations.');
assert(response.body.providerControlledRunRoutes?.some((route) => route.apiPath?.endsWith('/provider-controlled-run') && route.proofIds.length >= 2 && route.eventIds.length >= 2), 'Readiness Proof Map must expose provider controlled run proof route with provider usage event links.');
assert(response.body.providerEvalRunSummary?.count >= 1 && response.body.providerEvalRunSummary?.readyCount >= 1 && response.body.providerEvalRunSummary?.operations.includes('model:artifact-draft') && response.body.providerEvalRunSummary?.operations.includes('search:evidence'), 'Readiness Proof Map must summarize provider eval shadow replay operations.');
assert(response.body.providerEvalRunRoutes?.some((route) => route.apiPath?.endsWith('/provider-eval-runs') && route.proofIds.length >= 2 && route.timelineLogIds.length >= 1 && route.eventIds.length >= 2 && route.readyForPrivatePilotProviderEval === true), 'Readiness Proof Map must expose provider eval proof route with timeline and event links.');
assert(response.body.evidenceSearchSummary.count === 1 && response.body.evidenceSearchSummary.averageQualityScore >= 70 && response.body.evidenceSearchRoutes.some((route) => route.sourceCount === 3 && route.evidenceJudgement === 'strong-evidence'), 'Readiness Proof Map must expose evidence search routes and quality judgement.');
assert(response.body.evidenceSearchSummary.sourceSafetyReadyCount === 1 && response.body.evidenceSearchSummary.sourceSafetyBlockedSourceCount === 0 && response.body.evidenceSearchRoutes.some((route) => route.sourceSafetySummary?.sourceSafetyReady), 'Readiness Proof Map must expose source-safety routes and summary.');
assert(response.body.evidenceSearchSummary.sourceSnapshotCount === 3 && response.body.evidenceProviderReceiptSummary.count === 1, 'Readiness Proof Map must summarize source snapshots and provider receipts.');
assert(response.body.evidenceSearchRoutes.some((route) => route.sourceSnapshotIds?.length === 3 && route.providerReceiptIds?.length === 1), 'Readiness Proof Map evidence route must include source snapshot and provider receipt ids.');
assert(response.body.evidenceSourceReviewSummary.count === 3 && response.body.evidenceSourceReviewSummary.approvedCount === 3, 'Readiness Proof Map must summarize evidence source review decisions.');
assert(response.body.evidenceSourceReviewRoutes.every((route) => route.apiPath?.includes('/evidence-source-review-workflow#') && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map source review routes must include API, chat, timeline, and event proof.');
assert(response.body.evidenceCustodySummary?.count === 4 && response.body.evidenceCustodySummary?.productionStorageReady === false, 'Readiness Proof Map must summarize evidence custody records and production storage status.');
assert(response.body.evidenceCustodyRoutes?.some((route) => route.apiPath?.endsWith('/evidence-custody-readiness') && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map custody route must include API, checksum, timeline, and event proof.');
assert(response.body.submissionReviewSummary.acceptedCount === 1 && response.body.submissionReviewRoutes.some((route) => route.verdict === 'changes-requested'), 'Readiness Proof Map must expose submission review routes.');
assert(response.body.submissionReviewWorkflowSummary?.reviewCount >= 2 && response.body.submissionReviewWorkflowSummary?.revisionCount >= 1, 'Readiness Proof Map must summarize the submission review workflow.');
assert(response.body.submissionReviewWorkflowRoutes?.some((route) => route.apiPath?.endsWith('/submission-review-workflow') && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length && route.acceptedCount >= 1), 'Readiness Proof Map must expose the submission review workflow proof route.');
for (const type of ['discovery-report', 'decision-proposal', 'implementation-plan']) {
  assert(response.body.submissionRoutes.some((route) => route.artifactType === type && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), `Readiness Proof Map must expose ${type} submission proof routes.`);
}
assert(response.body.submissionRoutes.some((route) => route.artifactType === 'progress-brief' && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map must expose generated progress-brief draft submission proof routes.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/tasks/task_brief/evidence` });
assert(response.status === 200 && response.body.submissions.some((submission) => submission.artifactType === 'final-deliverable'), 'Task evidence must include linked Agent submissions.');
assert(response.body.submissionReviews.some((review) => review.verdict === 'accepted'), 'Task evidence must include linked submission reviews.');

for (const [taskId, artifactType] of [
  ['task_discovery', 'discovery-report'],
  ['task_decision', 'decision-proposal'],
  ['task_implementation', 'implementation-plan'],
]) {
  response = api.handle({ method: 'GET', path: `/projects/${projectId}/tasks/${taskId}/evidence` });
  assert(response.status === 200 && response.body.submissions.some((submission) => submission.artifactType === artifactType), `Task evidence must include linked ${artifactType} submissions.`);
}
response = api.handle({ method: 'GET', path: `/projects/${projectId}/tasks/task_implementation/evidence` });
assert(response.status === 200 && response.body.submissions.some((submission) => submission.id === generatedDraftSubmission.id && submission.artifactType === 'progress-brief'), 'Task evidence must include the generated progress-brief draft submission.');
assert(response.body.submissions.some((submission) => submission.id === modelGeneratedDraftSubmission.id && submission.artifactDraftModelUsed === true), 'Task evidence must include model-backed generated draft submissions.');
assert(response.body.submissions.some((submission) => submission.id === modelGeneratedDraftSubmission.id && submission.artifactDraftQuality?.readyForLocalPilot === true && submission.artifactDraftHumanReviewRequired === true), 'Task evidence must preserve model-backed draft quality metadata.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/tasks/task_evidence/evidence` });
assert(response.status === 200 && response.body.evidenceSearches.some((record) => record.id === evidenceSearch.id), 'Task evidence must include linked evidence searches.');
assert(response.body.evidenceSearches.some((record) => record.qualitySummary?.judgement === 'strong-evidence'), 'Task evidence must preserve evidence quality judgement.');
assert(response.body.evidenceSearches.some((record) => record.sourceSafetySummary?.sourceSafetyReady), 'Task evidence must preserve source-safety judgement.');
assert(response.body.evidenceSourceSnapshots?.length === 3 && response.body.evidenceProviderReceipts?.length === 1, 'Task evidence must include linked source snapshots and provider receipts.');
assert(response.body.evidenceSourceReviews?.length === 3 && response.body.evidenceSourceReviews.every((review) => review.decision === 'approved'), 'Task evidence must include linked evidence source review decisions.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agents/jobs/dashboard` });
assert(response.status === 200 && response.body.ownedSubmissions.some((submission) => submission.artifactType === 'final-deliverable'), 'Agent Dashboard must expose owned submissions.');
assert(response.body.ownedSubmissionReviews.some((review) => review.verdict === 'accepted'), 'Agent Dashboard must expose submission reviews relevant to the Agent.');
assert(response.body.obligations.some((obligation) => (
  obligation.reviewId === reviewsByVerdict.get('changes-requested')?.id
  && obligation.status === 'resolved'
  && obligation.resolvedBySubmissionId === finalDeliverable?.id
)), 'Original submitter obligation must be resolved by the linked revision/final deliverable.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agents/da_vinci/dashboard` });
assert(response.status === 200 && response.body.brainstormContribution?.schemaVersion === 'agent-brainstorm-contribution/v1', 'Agent Dashboard must expose the personal brainstorm contribution contract.');
assert(response.body.brainstormContribution.readyForPrivatePilotContribution === true && response.body.brainstormContribution.summary?.alternativeCount >= 3, 'Brainstorming Agent Dashboard must expose ready alternatives for the submitting Agent.');
assert(response.body.ownedBrainstormContributions?.some((row) => row.submissionId === submissionsByType.get('brainstorm-board')?.id && row.proofIds.length && row.timelineLogIds.length && row.eventIds.length), 'Agent Dashboard brainstorm contribution rows must preserve submission proof.');
assert(response.body.brainstormContribution.backendRoutes?.brainstormLayer?.endsWith('/brainstorm-layer'), 'Agent Dashboard brainstorm contribution must link to the Manager brainstorm layer.');
assert(response.body.proof?.brainstormSubmissionIds?.includes(submissionsByType.get('brainstorm-board')?.id) && response.body.proof?.brainstormAlternativeCount >= 3, 'Agent Dashboard proof summary must include brainstorm submission ids and alternative count.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agents/turing/dashboard` });
assert(response.status === 200 && response.body.ownedSubmissions.some((submission) => submission.id === generatedDraftSubmission.id && submission.isGeneratedDraft && submission.artifactDraft?.source === 'local-artifact-draft-generator' && submission.artifactDraftRoute?.includes('/artifact-drafts')), 'Agent Dashboard must expose generated artifact draft provenance for the submitting Agent.');
assert(response.body.ownedSubmissions.some((submission) => submission.id === modelGeneratedDraftSubmission.id && submission.isGeneratedDraft && submission.artifactDraft?.source === 'model-artifact-draft' && submission.artifactDraftModelUsed === true), 'Agent Dashboard must expose model-backed artifact draft provenance for the submitting Agent.');
assert(response.body.ownedSubmissions.some((submission) => submission.id === modelGeneratedDraftSubmission.id && submission.artifactDraftQuality?.readyForLocalPilot === true && submission.artifactDraftHumanReviewRequired === true), 'Agent Dashboard must expose model-backed artifact draft quality and human-review metadata.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agents/curie/dashboard` });
assert(response.status === 200 && response.body.ownedEvidenceSearches.some((record) => record.id === evidenceSearch.id), 'Agent Dashboard must expose owned evidence searches.');
assert(response.body.ownedEvidenceSourceReviews?.length === 3 && response.body.ownedEvidenceSourceReviews.every((review) => review.roleInSourceReview === 'reviewer'), 'Reviewer Agent Dashboard must expose owned source review decisions.');
assert(response.body.ownedSubmissionReviews.some((review) => review.verdict === 'changes-requested'), 'Reviewer Agent Dashboard must expose completed reviews.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/transcripts/main` });
assert(response.status === 200 && response.body.messages.some((message) => message.type === 'submission'), 'Group Chat transcript must include submission messages.');
assert(response.body.messages.some((message) => message.type === 'evidence-search'), 'Group Chat transcript must include evidence-search messages.');
assert(response.body.messages.some((message) => message.type === 'submission-review'), 'Group Chat transcript must include submission-review messages.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/events` });
assert(response.status === 200 && response.body.eventLedger.filter((event) => event.type === 'agent-submission').length >= expectedSubmissionCount, 'Event ledger must include Agent submission events, including generated artifact drafts.');
assert(response.body.eventLedger.some((event) => event.type === 'evidence-search'), 'Event ledger must include evidence-search events.');
assert(response.body.eventLedger.filter((event) => event.type === 'submission-review').length >= 2, 'Event ledger must include submission-review events.');
assert(response.body.eventLedger.filter((event) => event.type === 'security-access').length >= 6, 'Event ledger must include security access audit events.');
assert(response.body.eventLedger.some((event) => event.type === 'provider-usage'), 'Event ledger must include provider usage audit events.');

const httpServer = createAgentProjectHttpServer({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  autonomousScheduler: {
    intervalMs: 1_000,
  },
});
progress('start local HTTP runtime checks');
const httpRuntime = await httpServer.listen();
try {
  let httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/status`);
  let httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.scheduler.enabled === false, 'Product-team HTTP backend must expose scheduler status before start.');

  httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/tick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-01T11:30:00.000Z',
      trigger: 'product-team-http-scheduler-tick',
      source: 'product-team-http-scheduler-chat',
      forceProjectRun: true,
      forceProjectIds: [projectId],
      forceAgentRun: true,
      forceAgentProjectIds: [projectId],
      maxAgentProjects: 1,
      maxAgentsPerProject: team.length,
      agentTrigger: 'product-team-http-scheduler-tick-agents',
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.skipped === false, 'Product-team HTTP scheduler tick must run through the real backend server.');
  assert(httpBody.result.processed.some((item) => item.projectId === projectId), 'Product-team HTTP scheduler tick must process the acceptance project.');
  assert(httpBody.result.agentProcessed.some((item) => item.projectId === projectId), 'Product-team HTTP scheduler tick must process due Agent work for the acceptance project.');
  assert(httpBody.result.processed.some((item) => item.managerDashboard?.operationsBoard?.latestProjectCycle?.trigger === 'product-team-http-scheduler-tick'), 'HTTP processed project rows must include Manager Dashboard operations evidence.');
  assert(httpBody.result.agentProcessed.some((item) => item.managerReadyPackage?.operationsBoard?.agents?.length > 0), 'HTTP processed Agent rows must include Manager Ready Package Agent evidence.');
  assert(httpBody.status.tickCount >= 1 && httpBody.status.agentProcessedCount >= 1, 'Product-team HTTP scheduler tick must update project and Agent scheduler counters.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/autonomous-run-control/sessions/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-01T11:31:00.000Z',
      actor: 'HTTP acceptance scheduler',
      reason: 'provider-preflight-autopilot-start',
      maxLoops: 2,
      maxTotalSteps: 2,
      includeReadModels: false,
      requestBodyOverrides: {
        language: 'en',
      },
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.autonomousRunControlSession?.schemaVersion === 'autonomous-run-control-session/v1', 'HTTP Autopilot preflight setup must start a bounded backend session.');

  httpResponse = await fetch(`${httpRuntime.url}/workers/autopilot/due`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-01T11:31:10.000Z',
      actor: 'HTTP acceptance scheduler',
      reason: 'provider-preflight-autopilot-due-worker',
      forceDue: true,
      forceProjectIds: [projectId],
      maxProjects: 1,
      maxSessionsPerProject: 1,
      providerEvidenceSearchEnabled: true,
      useProviderEvidenceSearch: true,
      includeReadModels: false,
      requestBodyOverrides: {
        useProviderEvidenceSearch: true,
        evidenceSearchQuery: 'autonomous due-worker provider preflight proof',
        evidenceSearchPurpose: 'Verify the scheduler-owned A-side due-worker records preflight before provider-backed evidence.',
        autopilotTargetControl: {
          targetStageId: 'evidence-quality',
          targetIntent: 'scheduler-owned provider preflight validation',
          targetReason: 'acceptance-provider-preflight',
          preferredLane: 'agent-autonomy',
          recordEvidenceSearch: true,
          workArtifactType: 'evidence-packet',
        },
      },
    }),
  });
  httpBody = await httpResponse.json();
  const httpPreflightProcessed = httpBody.processed?.find((item) => item.projectId === projectId && item.autonomousProviderPreflight?.schemaVersion === 'autonomous-provider-preflight/v1');
  assert(httpResponse.status === 200 && httpPreflightProcessed, 'HTTP Autopilot due-worker must expose autonomous provider preflight proof on processed sessions.');
  assert(httpPreflightProcessed.autonomousProviderPreflight.action === 'call-provider' && httpPreflightProcessed.autonomousProviderPreflight.canCallProvider === true, 'HTTP Autopilot provider preflight must allow the provider call when all gates pass.');
  assert(httpPreflightProcessed.autonomousProviderPreflightChecksum === httpPreflightProcessed.autonomousProviderPreflight.checksum && httpPreflightProcessed.autonomousProviderPreflightAction === 'call-provider', 'HTTP Autopilot due-worker summary must carry the preflight checksum and action.');
  assert(httpPreflightProcessed.providerUsage?.autonomousProviderPreflightChecksum === httpPreflightProcessed.autonomousProviderPreflight.checksum, 'HTTP Autopilot provider usage must persist the preflight decision.');
  assert(httpPreflightProcessed.autonomousActionDecision?.schemaVersion === 'autonomous-action-decision/v1', 'HTTP Autopilot due-worker must expose the delegated Agent action decision.');
  assert(httpPreflightProcessed.autonomousActionDecision.providerPreflightChecksum === httpPreflightProcessed.autonomousProviderPreflight.checksum && httpPreflightProcessed.autonomousActionDecisionChecksum === httpPreflightProcessed.autonomousActionDecision.checksum, 'HTTP Autopilot action decision must bind to the provider preflight and summary checksum.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/evidence-source-review-workflow`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.evidenceSourceReviewWorkflow?.schemaVersion === 'evidence-source-review-workflow/v1', 'HTTP Autopilot provider evidence must expose the updated source review workflow.');
  const httpPendingSourceReviewItems = (httpBody.evidenceSourceReviewWorkflow.reviewItems || [])
    .filter((item) => item.decisionRequired && !item.latestDecisionId);
  for (const [index, item] of httpPendingSourceReviewItems.entries()) {
    const reviewResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/evidence-source-review-workflow`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reviewerAgentId: 'curie',
        evidenceSearchId: item.evidenceSearchId,
        sourceId: item.sourceId,
        decision: 'approved',
        comments: `Approved HTTP Autopilot provider source ${index + 1} for local product-team validation.`,
        requestedActions: ['Use as governed supporting evidence in the product-team acceptance chain.'],
        now: `2026-06-01T11:31:${20 + index}.000Z`,
      }),
    });
    const reviewBody = await reviewResponse.json();
    assert(reviewResponse.status === 200 && reviewBody.evidenceSourceReview?.schemaVersion === 'evidence-source-review/v1' && reviewBody.evidenceSourceReview.decision === 'approved', 'HTTP Reviewer must close Autopilot provider source review decisions.');
  }
  if (httpPendingSourceReviewItems.length) {
    httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/evidence-source-review-workflow`);
    httpBody = await httpResponse.json();
    assert(httpResponse.status === 200 && httpBody.evidenceSourceReviewWorkflow?.summary?.pendingDecisionSourceCount === 0, 'HTTP Autopilot provider evidence source reviews must be closed before Manager Ready Package acceptance.');
  }

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/submission-review-workflow`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.submissionReviewWorkflow?.schemaVersion === 'submission-review-workflow/v1', 'HTTP Autopilot provider evidence must expose the updated submission review workflow.');
  const httpOpenChangeReviewRows = (httpBody.submissionReviewWorkflow.roundRows || [])
    .filter((row) => row.verdict === 'changes-requested' && row.status === 'open' && row.submissionId && row.submitterAgentId);
  for (const [index, row] of httpOpenChangeReviewRows.entries()) {
    const revisionResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/agents/${encodeURIComponent(row.submitterAgentId)}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        artifactType: 'revision-note',
        title: `HTTP Autopilot revision response ${index + 1}`,
        summary: 'Linked revision response closing the HTTP Autopilot provider-evidence review request.',
        taskId: row.taskId || 'task_implementation',
        reviewerAgentId: row.reviewerAgentId || 'curie',
        revisesSubmissionId: row.submissionId,
        respondsToReviewId: row.id,
        body: '# HTTP Autopilot revision response\n\nThe submitter addressed the provider-evidence review request and linked this revision to the open review.',
        includeReadModels: false,
        now: `2026-06-01T11:31:${30 + index}.000Z`,
      }),
    });
    const revisionBody = await revisionResponse.json();
    assert(revisionResponse.status === 200 && revisionBody.submission?.artifactType === 'revision-note' && revisionBody.submission.respondsToReviewId === row.id, 'HTTP submitter must close Autopilot provider review requests with linked revision notes.');
  }
  if (httpOpenChangeReviewRows.length) {
    httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/submission-review-workflow`);
    httpBody = await httpResponse.json();
    assert(httpResponse.status === 200 && httpBody.submissionReviewWorkflow?.summary?.openChangeRequestCount === 0, 'HTTP Autopilot provider review requests must be closed before Manager Ready Package acceptance.');
  }

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-dashboard`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.operationsBoard.latestProjectCycle?.trigger === 'product-team-http-scheduler-tick', 'HTTP Manager Dashboard must expose the scheduler-produced project cycle.');
  assert(httpBody.continuousWorkLoop.proofedAgentCount > 0, 'HTTP Manager Dashboard must expose proofed continuous Agent work after scheduler tick.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-ready-package`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.operationsBoard.latestProjectCycle?.trigger === 'product-team-http-scheduler-tick', 'HTTP Manager Ready Package must expose scheduler-produced operations evidence.');
  assert(httpBody.mvpReadiness?.readyForLocalPilot && httpBody.mvpReadiness?.production?.status === 'production-blocked', 'HTTP Manager Ready Package must expose local-pilot readiness without overclaiming production readiness.');
  assert(
    httpBody.providerReadiness?.status === 'local-provider-contract-ready' && httpBody.providerReadiness?.readyForProduction === false,
    `HTTP Manager Ready Package must expose provider readiness without overclaiming production readiness. Actual: ${JSON.stringify({
      status: httpBody.providerReadiness?.status,
      readyForLocalPilot: httpBody.providerReadiness?.readyForLocalPilot,
      readyForProduction: httpBody.providerReadiness?.readyForProduction,
      failedGateCount: httpBody.providerReadiness?.summary?.failedGateCount,
      failedGates: (httpBody.providerReadiness?.failedGates || []).map((gate) => ({
        id: gate.id,
        status: gate.status,
        detail: gate.detail,
      })),
    })}`,
  );
  assert(httpBody.providerControlledRun?.schemaVersion === 'provider-controlled-run/v1' && httpBody.providerControlledRun?.readyForPrivatePilotRun === true && httpBody.summary?.providerControlledRunReady === true, 'HTTP Manager Ready Package must expose provider controlled run readiness.');
  assert(httpBody.providerEvalRunWorkflow?.schemaVersion === 'provider-eval-run-workflow/v1' && httpBody.providerEvalRunWorkflow?.readyForPrivatePilotProviderEval === true && httpBody.summary?.providerEvalRunReady === true, 'HTTP Manager Ready Package must expose provider eval shadow replay readiness.');
  assert(httpBody.evidenceQualityAudit?.schemaVersion === 'evidence-quality-audit/v1' && httpBody.evidenceQualityAudit?.readyForDecision === true, 'HTTP Manager Ready Package must expose decision-ready evidence quality audit.');
  assert(httpBody.summary?.evidenceQualityChecksum === httpBody.evidenceQualityAudit?.checksum, 'HTTP Manager Ready Package summary must expose the evidence quality audit checksum.');
  const httpReadyEvidenceSummary = httpBody.evidenceQualityAudit?.summary || {};
  const httpReadyProviderSummary = httpBody.providerReadiness?.summary || {};
  assert(
    httpReadyEvidenceSummary.sourceSnapshotCount >= 3
      && httpBody.summary?.evidenceSourceSnapshotCount === httpReadyEvidenceSummary.sourceSnapshotCount
      && httpReadyProviderSummary.evidenceSourceSnapshotCount === httpReadyEvidenceSummary.sourceSnapshotCount,
    'HTTP Manager Ready Package must expose source snapshot counts for every scheduler-produced evidence source.',
  );
  assert(
    httpReadyEvidenceSummary.providerReceiptCount >= 1
      && httpBody.summary?.evidenceProviderReceiptCount === httpReadyEvidenceSummary.providerReceiptCount
      && httpReadyProviderSummary.evidenceProviderReceiptCount === httpReadyEvidenceSummary.providerReceiptCount
      && httpReadyEvidenceSummary.providerBackedReceiptCount === httpReadyEvidenceSummary.providerBackedSearchCount,
    'HTTP Manager Ready Package must expose provider receipt counts for every provider-backed evidence search.',
  );
  assert(
    httpBody.evidenceSourceReviewWorkflow?.schemaVersion === 'evidence-source-review-workflow/v1' && httpBody.evidenceSourceReviewWorkflow?.readyForLocalPilot === true,
    `HTTP Manager Ready Package must expose local-ready evidence source review workflow. Actual: ${JSON.stringify({
      status: httpBody.evidenceSourceReviewWorkflow?.status,
      readyForLocalPilot: httpBody.evidenceSourceReviewWorkflow?.readyForLocalPilot,
      summary: httpBody.evidenceSourceReviewWorkflow?.summary,
      failedGates: (httpBody.evidenceSourceReviewWorkflow?.failedGates || []).map((gate) => ({
        id: gate.id,
        status: gate.status,
        detail: gate.detail,
      })),
    })}`,
  );
  assert(httpBody.summary?.evidenceSourceReviewChecksum === httpBody.evidenceSourceReviewWorkflow?.checksum, 'HTTP Manager Ready Package summary must expose the source review workflow checksum.');
  assert(httpBody.evidenceSourceReviewWorkflow?.summary?.sourceReviewDecisionCount >= 3 && httpBody.summary?.evidenceSourceReviewDecisionCount === httpBody.evidenceSourceReviewWorkflow?.summary?.sourceReviewDecisionCount, 'HTTP Manager Ready Package must expose source review decision counts.');
  assert(httpBody.evidenceCustodyReadiness?.schemaVersion === 'evidence-custody-readiness/v1' && httpBody.evidenceCustodyReadiness?.readyForPrivatePilot === true, 'HTTP Manager Ready Package must expose local-ready evidence custody readiness.');
  assert(
    httpBody.summary?.evidenceCustodyChecksum === httpBody.evidenceCustodyReadiness?.checksum
      && httpBody.summary?.evidenceCustodyRecordCount === httpBody.evidenceCustodyReadiness?.summary?.custodyRecordCount
      && httpBody.evidenceCustodyReadiness?.summary?.custodyRecordCount === httpReadyEvidenceSummary.sourceSnapshotCount + httpReadyEvidenceSummary.providerReceiptCount,
    'HTTP Manager Ready Package summary must expose evidence custody checksum and record count.',
  );
  assert(httpBody.brainstormLayer?.schemaVersion === 'brainstorm-layer/v1' && httpBody.brainstormLayer?.readyForPrivatePilotBrainstorm === true, 'HTTP Manager Ready Package must expose ready brainstorm layer readiness.');
  assert(httpBody.summary?.brainstormLayerReady === true && httpBody.summary?.brainstormLayerAlternativeCount >= 3, 'HTTP Manager Ready Package summary must expose brainstorm layer alternatives.');
  assert(httpBody.artifactQualityAudit?.schemaVersion === 'artifact-quality-audit/v1' && httpBody.artifactQualityAudit?.readyForLocalPilot === true, 'HTTP Manager Ready Package must expose local-ready artifact quality audit.');
  assert(
    httpBody.summary?.artifactQualityChecksum === httpBody.artifactQualityAudit?.checksum
      && httpBody.summary?.artifactQualitySubmissionCount === httpBody.artifactQualityAudit?.summary?.submissionCount
      && httpBody.summary?.artifactQualitySubmissionCount >= expectedSubmissionCount,
    'HTTP Manager Ready Package summary must expose artifact quality checksum and dynamic submission count.',
  );
  assert(httpBody.submissionReviewWorkflow?.schemaVersion === 'submission-review-workflow/v1' && httpBody.submissionReviewWorkflow?.readyForPrivatePilotReview === true, 'HTTP Manager Ready Package must expose local-ready submission review workflow.');
  assert(httpBody.summary?.submissionReviewWorkflowChecksum === httpBody.submissionReviewWorkflow?.checksum && httpBody.summary?.submissionReviewOpenChangeRequestCount === 0, 'HTTP Manager Ready Package summary must expose review workflow checksum and closure count.');
  assert(httpBody.privatePilotGoLiveReadiness?.schemaVersion === 'private-pilot-go-live-readiness/v1' && httpBody.privatePilotGoLiveReadiness?.readyForProduction === false, 'HTTP Manager Ready Package must expose private-pilot go-live readiness without production overclaim.');
  assert(httpBody.privatePilotGoLiveReadiness?.nextAction?.apiPath && httpBody.summary?.privatePilotGoLiveStatus === httpBody.privatePilotGoLiveReadiness?.status, 'HTTP Manager Ready Package summary must expose go-live status and routed next action.');
  assert(httpBody.productionLaunchGapRegister?.schemaVersion === 'production-launch-gap-register/v1' && httpBody.productionLaunchGapRegister?.readyForProduction === false, 'HTTP Manager Ready Package must expose production launch gap register without production overclaim.');
  assert(httpBody.productionLaunchGapRegister?.gapRows?.length >= 5 && httpBody.productionLaunchGapRegister?.nextAction?.apiPath, 'HTTP Manager Ready Package production launch gap register must expose open gaps and a routed next action.');
  assert(httpBody.summary?.productionLaunchGapOpenCount === httpBody.productionLaunchGapRegister?.summary?.openGapCount, 'HTTP Manager Ready Package summary must expose production launch gap counts.');
  assert(httpBody.productionLaunchControlCenter?.schemaVersion === 'production-launch-control-center/v1' && httpBody.productionLaunchControlCenter?.readyForProduction === false, 'HTTP Manager Ready Package must expose production launch control center without production overclaim.');
  assert(httpBody.productionLaunchControlCenter?.controlRows?.length >= 8 && httpBody.productionLaunchControlCenter?.nextAction?.apiPath, 'HTTP Manager Ready Package production launch control center must expose gate rows and a routed next action.');
  assert(httpBody.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.ready === false && row.apiPath?.endsWith('/production-evidence-integrity-audit')), 'HTTP Manager Ready Package production launch control center must include blocked managed-production evidence integrity.');
  assert(httpBody.summary?.productionLaunchControlBlockedCount === httpBody.productionLaunchControlCenter?.summary?.blockedControlCount, 'HTTP Manager Ready Package summary must expose production launch control blocked counts.');
  assert(httpBody.productionLaunchEvidenceDossier?.schemaVersion === 'production-launch-evidence-dossier/v1' && httpBody.productionLaunchEvidenceDossier?.readyForProduction === false, 'HTTP Manager Ready Package must expose production launch evidence dossier without production overclaim.');
  assert(httpBody.productionLaunchEvidenceDossier?.summary?.manifestEntryCount >= 9 && httpBody.productionLaunchEvidenceDossier?.backendRoutes?.productionLaunchEvidenceDossier?.endsWith('/production-launch-evidence-dossier'), 'HTTP Manager Ready Package production launch evidence dossier must expose manifest coverage and its route.');
  assert(httpBody.summary?.productionLaunchEvidenceDossierManifestEntryCount >= 9 && httpBody.summary?.productionLaunchEvidenceDossierReadyForProduction === false, 'HTTP Manager Ready Package summary must expose production launch evidence dossier readiness.');
  assert(httpBody.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1' && httpBody.productionEvidenceIntegrityAudit?.readyForProduction === false, 'HTTP Manager Ready Package must expose production evidence integrity audit without production overclaim.');
  assert(httpBody.summary?.productionEvidenceIntegrityStatus === httpBody.productionEvidenceIntegrityAudit?.status, 'HTTP Manager Ready Package summary must expose production evidence integrity status.');
  assert(httpBody.securityBoundary?.status === 'local-boundary-ready' && httpBody.securityBoundary?.redactionScan?.rawLeakCount === 0, 'HTTP Manager Ready Package must expose a clean local security boundary.');
  assert(httpBody.persistenceAdapterPlan?.schemaVersion === 'managed-persistence-adapter-plan/v1' && httpBody.persistenceAdapterDryRun?.schemaVersion === 'managed-persistence-adapter-dry-run/v1', 'HTTP Manager Ready Package must expose managed persistence adapter plan and dry-run readiness.');
  assert(httpBody.operationsReadiness?.summary?.workerRecoveryContractReady === true, 'HTTP Manager Ready Package must expose worker recovery readiness.');
  assert(httpBody.pilotLaunchReadiness?.schemaVersion === 'pilot-launch-readiness/v1' && httpBody.pilotLaunchReadiness?.productionDecision === 'no-go', 'HTTP Manager Ready Package must expose pilot launch readiness without production overclaim.');
  assert(httpBody.deploymentPreflight?.schemaVersion === 'deployment-preflight/v1' && httpBody.deploymentPreflight?.productionDeploymentReady === false, 'HTTP Manager Ready Package must expose deployment preflight without production overclaim.');
  assert(httpBody.adapterGatewayPreflight?.schemaVersion === 'adapter-gateway-preflight/v1' && httpBody.adapterGatewayPreflight?.productionCutoverReady === false, 'HTTP Manager Ready Package must expose adapter gateway preflight without production overclaim.');
  assert(httpBody.summary?.adapterGatewayPreflightStatus === httpBody.adapterGatewayPreflight?.status, 'HTTP Manager Ready Package summary must expose adapter gateway preflight status.');
  assert(httpBody.productionInfrastructureRehearsal?.schemaVersion === 'production-infrastructure-rehearsal/v1' && typeof httpBody.productionInfrastructureRehearsal?.readyForInfrastructureRehearsal === 'boolean' && httpBody.productionInfrastructureRehearsal?.readyForProduction === false, 'HTTP Manager Ready Package must expose production infrastructure rehearsal without production overclaim.');
  assert(httpBody.summary?.productionInfrastructureRehearsalReady === httpBody.productionInfrastructureRehearsal?.readyForInfrastructureRehearsal && httpBody.summary?.productionInfrastructureRehearsalProductionBlockedCount >= 1, 'HTTP Manager Ready Package summary must expose production infrastructure rehearsal state.');
  assert(httpBody.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1' && httpBody.launchApprovalWorkflow?.readyForProduction === false, 'HTTP Manager Ready Package must expose launch approval workflow without production overclaim.');
  assert(httpBody.productionLaunchAudit?.schemaVersion === 'production-launch-audit/v1' && httpBody.productionLaunchAudit?.productionDecision === 'no-go', 'HTTP Manager Ready Package must expose production launch audit without production overclaim.');
  assert(['go', 'no-go'].includes(httpBody.productionLaunchAudit?.privatePilotDecision) && httpBody.productionLaunchAudit?.readyForProduction === false, 'HTTP Manager Ready Package must expose launch audit status without claiming production readiness.');
  assert(httpBody.productionOperationsReadiness?.schemaVersion === 'production-operations-readiness/v1' && httpBody.productionOperationsReadiness?.readyForProduction === false, 'HTTP Manager Ready Package must expose production operations readiness without production overclaim.');
  assert(httpBody.summary?.productionOperationsStatus === httpBody.productionOperationsReadiness?.status, 'HTTP Manager Ready Package summary must expose production operations readiness status.');
  assert(httpBody.productionOperationsControlReceiptWorkflow?.schemaVersion === 'production-operations-control-receipt-workflow/v1' && httpBody.productionOperationsControlReceiptWorkflow?.readyForProduction === false, 'HTTP Manager Ready Package must expose production operations control receipt workflow without production overclaim.');
  assert(httpBody.productionSecurityControlReceiptWorkflow?.schemaVersion === 'production-security-control-receipt-workflow/v1' && httpBody.productionSecurityControlReceiptWorkflow?.readyForProductionSecurity === false, 'HTTP Manager Ready Package must expose production security control receipt workflow before managed controls are verified.');
  assert(httpBody.summary?.productionSecurityMissingControlCount === httpBody.productionSecurityControlReceiptWorkflow?.summary?.missingControlCount, 'HTTP Manager Ready Package summary must expose production security missing control counts.');
  assert(httpBody.projectEvidenceArchive?.schemaVersion === 'project-evidence-archive/v1' && httpBody.projectEvidenceArchive?.readyForProduction === false, 'HTTP Manager Ready Package must expose the project evidence archive without production overclaim.');
  assert(httpBody.projectEvidenceArchive?.summary?.rawLeakCount === 0 && httpBody.summary?.projectEvidenceArchiveStatus === httpBody.projectEvidenceArchive?.status, 'HTTP Manager Ready Package summary must expose archive status and zero raw leaks.');
  assert(httpBody.projectEvidenceArchive?.summary?.evidenceQualityDecisionReady === true, 'HTTP Manager Ready Package archive summary must include evidence quality decision readiness.');
  assert(httpBody.workerQueueAdapterPlan?.schemaVersion === 'worker-queue-adapter-plan/v1' && httpBody.workerQueueAdapterDryRun?.status === 'passed', 'HTTP Manager Ready Package must expose queue adapter plan and dry-run readiness.');
  assert(httpBody.summary?.workerExecutionReceiptCount >= 1 && httpBody.summary?.workerDeadLetterCount === 0, 'HTTP Manager Ready Package summary must expose worker receipt and dead-letter counts.');
  assert(httpBody.summary?.queueAdapterDryRunStatus === 'passed' && httpBody.summary?.queueAdapterDispatchCount >= 1, 'HTTP Manager Ready Package summary must expose queue adapter dry-run status.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/pilot-launch-readiness`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.pilotLaunchReadiness?.schemaVersion === 'pilot-launch-readiness/v1', 'HTTP pilot launch readiness endpoint must expose the launch contract.');
  assert(['go', 'no-go'].includes(httpBody.pilotLaunchReadiness?.privatePilotDecision), 'HTTP pilot launch readiness must expose a private-pilot decision.');
  assert(httpBody.pilotLaunchReadiness?.productionDecision === 'no-go', 'HTTP pilot launch readiness must keep production launch blocked.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/deployment-preflight`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.deploymentPreflight?.schemaVersion === 'deployment-preflight/v1', 'HTTP deployment preflight endpoint must expose the deployment contract.');
  assert(httpBody.deploymentPreflight?.productionDeploymentReady === false, 'HTTP deployment preflight must keep production deployment blocked.');
  assert(httpBody.deploymentPreflight?.backendRoutes?.adapterGatewayPreflight?.endsWith('/adapter-gateway-preflight'), 'HTTP deployment preflight must expose the adapter gateway preflight route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/adapter-gateway-preflight`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.adapterGatewayPreflight?.schemaVersion === 'adapter-gateway-preflight/v1', 'HTTP adapter gateway preflight endpoint must expose the gateway preflight contract.');
  assert(httpBody.adapterGatewayPreflight?.privateGatewayReady === true, 'HTTP adapter gateway preflight must pass the local-shadow private rehearsal path.');
  assert(httpBody.adapterGatewayPreflight?.productionCutoverReady === false, 'HTTP adapter gateway preflight must keep production cutover blocked.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-infrastructure-rehearsal`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionInfrastructureRehearsal?.schemaVersion === 'production-infrastructure-rehearsal/v1', 'HTTP production infrastructure rehearsal endpoint must expose the infrastructure rehearsal contract.');
  assert(typeof httpBody.productionInfrastructureRehearsal.readyForInfrastructureRehearsal === 'boolean' && httpBody.productionInfrastructureRehearsal.readyForProduction === false, 'HTTP production infrastructure rehearsal must expose rehearsal readiness and keep production blocked.');
  assert(httpBody.productionInfrastructureRehearsal.domainRows?.some((row) => row.id === 'private-adapter-gateway' && row.rehearsalReady === true) && httpBody.productionInfrastructureRehearsal.domainRows?.some((row) => row.id === 'managed-worker-queue' && row.productionReady === false), 'HTTP production infrastructure rehearsal must aggregate gateway and queue cutover state.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/project-evidence-archive`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.projectEvidenceArchive?.schemaVersion === 'project-evidence-archive/v1', 'HTTP project evidence archive endpoint must expose the archive contract.');
  assert(httpBody.projectEvidenceArchive?.summary?.finalDeliverableCount >= 1, 'HTTP project evidence archive must include final deliverable evidence.');
  assert(httpBody.projectEvidenceArchive?.summary?.rawLeakCount === 0, 'HTTP project evidence archive must keep redaction clean.');
  assert(httpBody.projectEvidenceArchive?.manifest?.some((entry) => entry.id === 'evidence-quality-audit' && entry.ready), 'HTTP project evidence archive must include a ready evidence quality audit manifest entry.');
  assert(httpBody.projectEvidenceArchive?.manifest?.some((entry) => entry.id === 'artifact-storage-proofs' && entry.ready && entry.count >= 1), 'HTTP project evidence archive must include ready artifact storage proof coverage.');
  assert(httpBody.projectEvidenceArchive?.summary?.artifactStorageProofCoverageReady === true && httpBody.projectEvidenceArchive?.summary?.workspaceFileProofCount >= 1, 'HTTP project evidence archive must summarize workspace artifact proof coverage.');
  assert(httpBody.projectEvidenceArchive?.manifest?.some((entry) => entry.id === 'evidence-source-snapshots' && entry.ready), 'HTTP project evidence archive must include source snapshot records.');
  assert(httpBody.projectEvidenceArchive?.manifest?.some((entry) => entry.id === 'evidence-provider-receipts' && entry.ready), 'HTTP project evidence archive must include provider receipt records.');
  assert(httpBody.projectEvidenceArchive?.manifest?.some((entry) => entry.id === 'evidence-source-review-workflow' && entry.ready), 'HTTP project evidence archive must include a ready evidence source review workflow manifest entry.');
  assert(httpBody.projectEvidenceArchive?.manifest?.some((entry) => entry.id === 'evidence-source-review-decisions' && entry.ready), 'HTTP project evidence archive must include source review decision records.');
  assert(httpBody.projectEvidenceArchive?.manifest?.some((entry) => entry.id === 'evidence-custody-readiness' && entry.ready), 'HTTP project evidence archive must include evidence custody readiness.');
  assert(httpBody.projectEvidenceArchive?.summary?.evidenceSourceReviewReady === true, 'HTTP project evidence archive summary must include source review readiness.');
  assert(httpBody.projectEvidenceArchive?.summary?.evidenceSourceReviewDecisionCount >= 3, 'HTTP project evidence archive summary must include source review decision count.');
  assert(httpBody.projectEvidenceArchive?.summary?.transcriptProofCoverageReady === true && httpBody.projectEvidenceArchive?.summary?.transcriptMissingProofIdCount === 0, 'HTTP project evidence archive must prove critical work-node chat proof coverage from backend transcripts.');
  assert(
    httpBody.projectEvidenceArchive?.summary?.evidenceCustodyReady === true
      && httpBody.projectEvidenceArchive?.summary?.evidenceCustodyRecordCount === (
        (httpBody.projectEvidenceArchive?.summary?.evidenceSourceSnapshotCount || 0)
        + (httpBody.projectEvidenceArchive?.summary?.evidenceProviderReceiptCount || 0)
      ),
    'HTTP project evidence archive summary must include custody readiness and record count.',
  );
  assert(httpBody.projectEvidenceArchive?.backendRoutes?.projectEvidenceArchive?.endsWith('/project-evidence-archive'), 'HTTP project evidence archive must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/evidence-quality-audit`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.evidenceQualityAudit?.schemaVersion === 'evidence-quality-audit/v1', 'HTTP evidence quality audit endpoint must expose the audit contract.');
  assert(httpBody.evidenceQualityAudit?.readyForDecision === true && httpBody.evidenceQualityAudit?.readyForProduction === false, 'HTTP evidence quality audit must be decision-ready without production overclaim.');
  assert(httpBody.evidenceQualityAudit?.summary?.sourceSafetyReady === true && httpBody.evidenceQualityAudit?.summary?.failedDecisionGateCount === 0, 'HTTP evidence quality audit must expose source-safety and decision gate status.');
  assert(
    httpBody.evidenceQualityAudit?.summary?.sourceSnapshotCount >= 3
      && httpBody.evidenceQualityAudit?.summary?.providerReceiptCount >= 1
      && httpBody.evidenceQualityAudit?.summary?.sourceSnapshotCount === httpBody.evidenceQualityAudit?.summary?.sourceCount
      && httpBody.evidenceQualityAudit?.summary?.providerBackedReceiptCount === httpBody.evidenceQualityAudit?.summary?.providerBackedSearchCount,
    'HTTP evidence quality audit must expose source snapshot and provider receipt counts.',
  );
  assert(httpBody.evidenceQualityAudit?.backendRoutes?.evidenceQualityAudit?.endsWith('/evidence-quality-audit'), 'HTTP evidence quality audit must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/brainstorm-layer`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.brainstormLayer?.schemaVersion === 'brainstorm-layer/v1', 'HTTP brainstorm layer endpoint must expose the brainstorm layer contract.');
  assert(httpBody.brainstormLayer?.readyForPrivatePilotBrainstorm === true && httpBody.brainstormLayer?.summary?.alternativeCount >= 3 && httpBody.brainstormLayer?.backendRoutes?.brainstormLayer?.endsWith('/brainstorm-layer'), 'HTTP brainstorm layer must expose alternatives and its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/artifact-quality-audit`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.artifactQualityAudit?.schemaVersion === 'artifact-quality-audit/v1', 'HTTP artifact quality audit endpoint must expose the audit contract.');
  assert(httpBody.artifactQualityAudit?.readyForLocalPilot === true && httpBody.artifactQualityAudit?.readyForProduction === false, 'HTTP artifact quality audit must be locally ready without production overclaim.');
  assert(httpBody.artifactQualityAudit?.summary?.submissionCount >= expectedSubmissionCount && httpBody.artifactQualityAudit?.summary?.failedLocalDecisionGateCount === 0, 'HTTP artifact quality audit must expose dynamic submission coverage and local gate status.');
  assert(httpBody.artifactQualityAudit?.backendRoutes?.artifactQualityAudit?.endsWith('/artifact-quality-audit'), 'HTTP artifact quality audit must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/submission-review-workflow`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.submissionReviewWorkflow?.schemaVersion === 'submission-review-workflow/v1', 'HTTP submission review workflow endpoint must expose the workflow contract.');
  assert(httpBody.submissionReviewWorkflow?.readyForPrivatePilotReview === true && httpBody.submissionReviewWorkflow?.readyForProduction === false, 'HTTP submission review workflow must be local-ready without production overclaim.');
  assert(httpBody.submissionReviewWorkflow?.summary?.openChangeRequestCount === 0 && httpBody.submissionReviewWorkflow?.summary?.acceptedFinalDeliverableCount >= 1, 'HTTP submission review workflow must expose closed changes and final acceptance.');
  assert(httpBody.submissionReviewWorkflow?.backendRoutes?.submissionReviewWorkflow?.endsWith('/submission-review-workflow'), 'HTTP submission review workflow must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/product-team-delivery-trace`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productTeamDeliveryTrace?.schemaVersion === 'product-team-delivery-trace/v1', 'HTTP product-team delivery trace endpoint must expose the delivery trace contract.');
  assert(httpBody.productTeamDeliveryTrace?.readyForPrivatePilotDelivery === true && httpBody.productTeamDeliveryTrace?.readyForProduction === false, 'HTTP product-team delivery trace must be local-ready without production overclaim.');
  assert(httpBody.productTeamDeliveryTrace?.summary?.readyCount === httpBody.productTeamDeliveryTrace?.summary?.rowCount && httpBody.productTeamDeliveryTrace?.summary?.acceptedFinalDeliverableCount >= 1, 'HTTP product-team delivery trace must expose a closed kickoff-to-final-delivery path.');
  assert(httpBody.productTeamDeliveryTrace?.backendRoutes?.productTeamDeliveryTrace?.endsWith('/product-team-delivery-trace'), 'HTTP product-team delivery trace must expose its own route.');
  const researchSampleTraceStageIds = (httpBody.productTeamDeliveryTrace.rows || []).map((row) => row.id);
  const expectedGenericTraceStageIds = [
    'kickoff-meeting',
    'agent-self-marketing',
    'brainstorm-layer',
    'evidence-quality',
    'draft-artifact',
    'review-and-revision',
    'final-deliverable',
    'proof-surfaces',
  ];
  assert(
    expectedGenericTraceStageIds.every((id) => researchSampleTraceStageIds.includes(id)),
    `Research validation sample must prove the generic product-team delivery stages, not research-only stages. Got: ${researchSampleTraceStageIds.join(', ')}`,
  );
  assert(
    (httpBody.productTeamDeliveryTrace.rows || []).every((row) => (
      !/\b(paper|thesis|manuscript)\b|论文/i.test(`${row.id || ''} ${row.stage || ''} ${row.label || ''}`)
    )),
    'Research validation sample trace rows must not introduce paper/thesis/manuscript-specific protocol fields.',
  );
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/product-team-operating-loop`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productTeamOperatingLoop?.schemaVersion === 'product-team-operating-loop/v1', 'HTTP product-team operating loop endpoint must expose the C/A operating contract.');
assert(httpBody.productTeamOperatingLoop?.readyForLocalPilotOperatingLoop === true && httpBody.productTeamOperatingLoop?.readyForProduction === false, 'HTTP product-team operating loop must prove local C/A autonomy without production overclaim.');
assert(httpBody.productTeamOperatingLoop?.deliveryLoop?.readyStageIds?.includes('final-deliverable') && httpBody.productTeamOperatingLoop?.deliveryLoop?.missingStageIds?.length === 0, 'HTTP product-team operating loop must read the generic trace through final deliverable.');
assert(httpBody.productTeamOperatingLoop?.customerSide?.nextAction?.runApiPath?.includes('/autonomous-run-control/') && httpBody.productTeamOperatingLoop?.agentSide?.selectedActions?.length > 0, 'HTTP product-team operating loop must join C-side continuation with A-side strategy selection.');
assert(httpBody.productTeamOperatingLoop?.agentSide?.initiativeRows?.length >= team.length && httpBody.productTeamOperatingLoop.agentSide.initiativeRows.every((row) => row.schemaVersion === 'agent-autonomous-initiative/v1' && row.intent && row.artifactType && row.runApiPath?.includes('/agent-autonomous-action-queue/')), 'HTTP product-team operating loop must expose A-side Agent initiative rows.');
assert(httpBody.productTeamOperatingLoop?.proofLoop?.proofRouteCount > 0 && httpBody.productTeamOperatingLoop?.proofLoop?.eventIds?.length > 0, 'HTTP product-team operating loop must keep proof routes and event evidence attached.');
  assert(httpBody.productTeamOperatingLoop?.backendRoutes?.productTeamOperatingLoop?.endsWith('/product-team-operating-loop'), 'HTTP product-team operating loop must expose its own route.');
  assert(httpBody.productTeamOperatingLoop?.gates?.some((gate) => gate.id === 'production-autonomy-boundary' && gate.productionBlocker && gate.passed === false), 'HTTP product-team operating loop must keep production autonomy blocked.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/team-collaboration-diagnostics`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.teamCollaborationDiagnostics?.schemaVersion === 'team-collaboration-diagnostics/v1', 'HTTP team collaboration diagnostics endpoint must expose the C/A break-diagnostics contract.');
  assert(httpBody.teamCollaborationDiagnostics?.readyForLocalPilotCollaboration === true && httpBody.teamCollaborationDiagnostics?.readyForProduction === false, 'HTTP team collaboration diagnostics must prove local collaboration without production overclaim.');
  assert(httpBody.teamCollaborationDiagnostics?.diagnosticRows?.some((row) => row.id === 'group-chat-collaboration-visible' && row.passed), 'HTTP team collaboration diagnostics must preserve group-chat proof.');
  assert(httpBody.teamCollaborationDiagnostics?.diagnosticRows?.some((row) => row.id === 'autonomous-continuation-visible' && row.passed && row.apiPath?.endsWith('/product-team-operating-loop')), 'HTTP team collaboration diagnostics must preserve C/A operating-loop proof.');
  assert(httpBody.teamCollaborationDiagnostics?.backendRoutes?.teamCollaborationDiagnostics?.endsWith('/team-collaboration-diagnostics'), 'HTTP team collaboration diagnostics must expose its own route.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/runtime-contracts`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.runtimeContracts?.schemaVersion === 'runtime-contract-freeze/v1', 'HTTP runtime contracts endpoint must expose the runtime contract freeze manifest.');
  assert(httpBody.runtimeContracts?.readyForLocalPilotContractFreeze === true && httpBody.runtimeContracts?.readyForProduction === false, 'HTTP runtime contracts must prove local contract freeze without production overclaim.');
  assert(httpBody.runtimeContracts?.contractRows?.some((row) => row.id === 'agent-submission-artifact-contract' && row.ready) && httpBody.runtimeContracts?.contractRows?.some((row) => row.id === 'production-runtime-contract-boundary' && row.productionBlocker), 'HTTP runtime contracts must preserve frozen local contracts and production boundary.');
  assert(httpBody.runtimeContracts?.backendRoutes?.runtimeContracts?.endsWith('/runtime-contracts'), 'HTTP runtime contracts must expose its own route.');
  if (ACCEPTANCE_STAGE === 'research-sample') {
    httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/autonomous-run-control/run-loop`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        now: '2026-06-01T19:10:00.000Z',
        maxSteps: 3,
        force: true,
        includeReadModels: false,
        useAgentAutonomousStrategy: true,
        submitAgentWorkArtifacts: true,
        reviewPendingSubmissions: true,
        respondToReviewObligations: true,
      }),
    });
    httpBody = await httpResponse.json();
    assert(httpResponse.status === 200 && httpBody.autonomousRunControlLoop?.schemaVersion === 'autonomous-run-control-loop-run/v1', 'HTTP research-sample autonomous consistency loop must record a bounded loop receipt.');
    assert(httpBody.autonomousRunControlLoop.stepCount >= 3 && httpBody.autonomousRunControlLoop.runReceiptIds?.length >= 3 && !httpBody.autonomousRunControlLoop.failedStep, `HTTP research-sample autonomous consistency loop must run at least three receipt-backed steps. Actual: ${httpBody.autonomousRunControlLoop.stepCount}`);

    httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/autonomous-cycle-consistency`);
    httpBody = await httpResponse.json();
    assert(httpResponse.status === 200 && httpBody.autonomousCycleConsistency?.schemaVersion === 'autonomous-cycle-consistency/v1', 'HTTP autonomous cycle consistency endpoint must expose the N-step consistency contract.');
    assert(httpBody.autonomousCycleConsistency?.readyForLocalPilotCycleConsistency === true && httpBody.autonomousCycleConsistency?.readyForProduction === false, 'HTTP autonomous cycle consistency must prove local N-step continuity without production overclaim.');
    assert(httpBody.autonomousCycleConsistency?.summary?.observedStepCount >= 3 && httpBody.autonomousCycleConsistency?.summary?.missingRunReceiptCount === 0 && httpBody.autonomousCycleConsistency?.summary?.failedLocalRowCount === 0, 'HTTP autonomous cycle consistency must expose three or more consistent steps with no missing receipts or failed local rows.');
    assert(httpBody.autonomousCycleConsistency?.consistencyRows?.some((row) => row.id === 'flow-proof-surfaces-linked' && row.ready) && httpBody.autonomousCycleConsistency?.consistencyRows?.some((row) => row.id === 'production-autonomy-boundary' && row.productionBlocker), 'HTTP autonomous cycle consistency must prove Flow/Proof linkage and keep production autonomy blocked.');

    httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/runtime-autonomy-status`);
    httpBody = await httpResponse.json();
    assert(httpResponse.status === 200 && httpBody.runtimeAutonomyStatus?.schemaVersion === 'runtime-autonomy-status/v1', 'HTTP Runtime Autonomy Status endpoint must expose the C/A recovery contract.');
    assert(httpBody.runtimeAutonomyStatus?.readyForLocalAutonomy === true && httpBody.runtimeAutonomyStatus?.readyForUnattendedProduction === false, 'HTTP Runtime Autonomy Status must prove local autonomy without public production overclaim.');
    assert(httpBody.runtimeAutonomyStatus?.gates?.some((row) => row.id === 'mission-runner-started' && row.ready), 'HTTP Runtime Autonomy Status must prove Mission Runner startup.');
    assert(httpBody.runtimeAutonomyStatus?.gates?.some((row) => row.id === 'autopilot-session-restorable' && row.ready), 'HTTP Runtime Autonomy Status must prove Autopilot session recovery.');
    assert(httpBody.runtimeAutonomyStatus?.gates?.some((row) => row.id === 'worker-queue-recovery-clean' && row.ready), 'HTTP Runtime Autonomy Status must prove worker queue recovery.');
    assert(httpBody.runtimeAutonomyStatus?.gates?.some((row) => row.id === 'queue-adapter-rehearsal-passed' && row.ready), 'HTTP Runtime Autonomy Status must prove queue adapter rehearsal.');
    assert(httpBody.runtimeAutonomyStatus?.gates?.some((row) => row.id === 'production-unattended-autonomy-blocked' && row.productionBlocker && row.ready === false), 'HTTP Runtime Autonomy Status must keep unattended production autonomy blocked.');
    assert(httpBody.runtimeAutonomyStatus?.backendRoutes?.runtimeAutonomyStatus?.endsWith('/runtime-autonomy-status') && httpBody.runtimeAutonomyStatus?.backendRoutes?.autopilotDueWorker === '/workers/autopilot/due', 'HTTP Runtime Autonomy Status must expose its route and Autopilot due-worker recovery route.');

    httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/readiness-proof-map`);
    httpBody = await httpResponse.json();
    assert(httpResponse.status === 200 && httpBody.autonomousCycleConsistencySummary?.readyForLocalPilotCycleConsistency === true && httpBody.autonomousCycleConsistencySummary?.observedStepCount >= 3, 'HTTP Readiness Proof Map must summarize autonomous cycle consistency after the research-sample loop.');
    assert(httpBody.autonomousCycleConsistencyRoutes?.some((route) => route.apiPath?.endsWith('/autonomous-cycle-consistency') && route.runReceiptCount >= 3 && route.loopReceiptCount >= 1 && route.readyForLocalPilotCycleConsistency === true), 'HTTP Readiness Proof Map must expose the autonomous cycle consistency proof route.');
    assert(httpBody.runtimeAutonomyStatusSummary?.readyForLocalAutonomy === true && httpBody.runtimeAutonomyStatusSummary?.readyForUnattendedProduction === false, 'HTTP Readiness Proof Map must summarize Runtime Autonomy Status after the research-sample loop.');
    assert(httpBody.runtimeAutonomyStatusRoutes?.some((route) => route.apiPath?.endsWith('/runtime-autonomy-status') && route.readyForLocalAutonomy === true && route.productionBlocked === true && route.upstreamRoutes?.autopilotDueWorker === '/workers/autopilot/due'), 'HTTP Readiness Proof Map must expose Runtime Autonomy Status route with scheduler recovery proof.');

    httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-flow-graph`);
    httpBody = await httpResponse.json();
    const httpConsistencyGraph = httpBody.managerFlowGraph || httpBody;
    const httpConsistencyNode = httpConsistencyGraph?.nodes?.find((node) => node.id === 'autonomous-cycle-consistency' && node.source === 'autonomousCycleConsistency');
    const httpRuntimeAutonomyNode = httpConsistencyGraph?.nodes?.find((node) => node.id === 'runtime-autonomy-status' && node.source === 'runtimeAutonomyStatus');
    assert(httpResponse.status === 200 && httpConsistencyNode?.route?.endsWith('/autonomous-cycle-consistency') && httpConsistencyNode.proofIds?.length && httpConsistencyNode.attachments?.some((attachment) => attachment.type === 'autonomous-cycle-consistency-loop' && attachment.ready === true), 'HTTP Manager Flow Graph must expose the autonomous cycle consistency node and loop attachment.');
    assert(httpRuntimeAutonomyNode?.route?.endsWith('/runtime-autonomy-status') && httpRuntimeAutonomyNode.proofIds?.length && httpRuntimeAutonomyNode.attachments?.some((attachment) => attachment.type === 'runtime-autonomy-c-a-handoff' && attachment.ready === true) && httpRuntimeAutonomyNode.attachments?.some((attachment) => attachment.type === 'runtime-autonomy-production-boundary' && attachment.status === 'production-blocked'), 'HTTP Manager Flow Graph must expose the Runtime Autonomy Status node with C/A and production-boundary attachments.');

    httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-ready-package`);
    httpBody = await httpResponse.json();
    assert(httpResponse.status === 200 && httpBody.autonomousCycleConsistency?.schemaVersion === 'autonomous-cycle-consistency/v1' && httpBody.summary?.autonomousCycleConsistencyReady === true, 'HTTP Manager Ready Package must embed autonomous cycle consistency after the research-sample loop.');
    assert(httpResponse.status === 200 && httpBody.runtimeAutonomyStatus?.schemaVersion === 'runtime-autonomy-status/v1' && httpBody.summary?.runtimeAutonomyReady === true && httpBody.summary?.runtimeAutonomyProductionReady === false, 'HTTP Manager Ready Package must embed Runtime Autonomy Status after the research-sample loop.');
  }
  progress('research validation sample delivery trace ready');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/private-pilot-go-live-readiness`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.privatePilotGoLiveReadiness?.schemaVersion === 'private-pilot-go-live-readiness/v1', 'HTTP private-pilot go-live readiness endpoint must expose the command view.');
  assert(httpBody.privatePilotGoLiveReadiness?.readyForProduction === false && httpBody.privatePilotGoLiveReadiness?.stageRows?.length >= 8, 'HTTP private-pilot go-live readiness must expose stages without production overclaim.');
  assert(httpBody.privatePilotGoLiveReadiness?.backendRoutes?.privatePilotGoLiveReadiness?.endsWith('/private-pilot-go-live-readiness'), 'HTTP private-pilot go-live readiness must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-launch-gap-register`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionLaunchGapRegister?.schemaVersion === 'production-launch-gap-register/v1', 'HTTP production launch gap register endpoint must expose the gap register contract.');
  assert(httpBody.productionLaunchGapRegister?.readyForProduction === false && httpBody.productionLaunchGapRegister?.gapRows?.length >= 5, 'HTTP production launch gap register must expose open production gaps without overclaim.');
  assert(httpBody.productionLaunchGapRegister?.nextAction?.apiPath && httpBody.productionLaunchGapRegister?.backendRoutes?.productionLaunchGapRegister?.endsWith('/production-launch-gap-register'), 'HTTP production launch gap register must expose its own route and routed next action.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-launch-control-center`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionLaunchControlCenter?.schemaVersion === 'production-launch-control-center/v1', 'HTTP production launch control center endpoint must expose the control center contract.');
  assert(httpBody.productionLaunchControlCenter?.readyForProduction === false && httpBody.productionLaunchControlCenter?.productionDecision === 'no-go', 'HTTP production launch control center must keep public production blocked.');
  assert(httpBody.productionLaunchControlCenter?.controlRows?.length >= 8 && httpBody.productionLaunchControlCenter?.nextAction?.apiPath && httpBody.productionLaunchControlCenter?.backendRoutes?.productionLaunchControlCenter?.endsWith('/production-launch-control-center'), 'HTTP production launch control center must expose its own route, gate rows, and routed next action.');
  assert(httpBody.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.ready === false && row.apiPath?.endsWith('/production-evidence-integrity-audit')), 'HTTP production launch control center endpoint must include blocked managed-production evidence integrity.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-launch-evidence-dossier`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionLaunchEvidenceDossier?.schemaVersion === 'production-launch-evidence-dossier/v1', 'HTTP production launch evidence dossier endpoint must expose the dossier contract.');
  assert(httpBody.productionLaunchEvidenceDossier?.readyForProduction === false && httpBody.productionLaunchEvidenceDossier?.productionDecision === 'no-go', 'HTTP production launch evidence dossier must keep public production blocked without managed production evidence.');
  assert(httpBody.productionLaunchEvidenceDossier?.manifest?.some((row) => row.id === 'production-launch-control-center') && httpBody.productionLaunchEvidenceDossier?.manifest?.some((row) => row.id === 'production-evidence-integrity-audit'), 'HTTP production launch evidence dossier must aggregate launch control and evidence integrity manifest entries.');
  assert(httpBody.productionLaunchEvidenceDossier?.controlDomainRows?.length === 4 && httpBody.productionLaunchEvidenceDossier?.backendRoutes?.productionLaunchEvidenceDossier?.endsWith('/production-launch-evidence-dossier'), 'HTTP production launch evidence dossier must expose four control domains and its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-evidence-integrity-audit`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1', 'HTTP production evidence integrity audit endpoint must expose the audit contract.');
  assert(httpBody.productionEvidenceIntegrityAudit?.readyForProduction === false && httpBody.productionEvidenceIntegrityAudit?.backendRoutes?.productionEvidenceIntegrityAudit?.endsWith('/production-evidence-integrity-audit'), 'HTTP production evidence integrity audit must expose its own route without production overclaim.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-deployment-control-receipts`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionDeploymentControlReceiptWorkflow?.schemaVersion === 'production-deployment-control-receipt-workflow/v1', 'HTTP production deployment control receipt endpoint must expose the workflow contract.');
  assert(httpBody.productionDeploymentControlReceiptWorkflow?.readyForProductionDeployment === false && httpBody.productionDeploymentControlReceiptWorkflow?.summary?.missingControlCount > 0, 'HTTP production deployment control receipt endpoint must require deployment evidence before deployment readiness.');
  assert(httpBody.productionDeploymentControlReceiptWorkflow?.backendRoutes?.productionDeploymentControlReceipts?.endsWith('/production-deployment-control-receipts'), 'HTTP production deployment control receipt workflow must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-security-control-receipts`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionSecurityControlReceiptWorkflow?.schemaVersion === 'production-security-control-receipt-workflow/v1', 'HTTP production security control receipt endpoint must expose the workflow contract.');
  assert(httpBody.productionSecurityControlReceiptWorkflow?.readyForProductionSecurity === false && httpBody.productionSecurityControlReceiptWorkflow?.summary?.missingControlCount > 0, 'HTTP production security control receipt endpoint must require managed security evidence before security readiness.');
  assert(httpBody.productionSecurityControlReceiptWorkflow?.backendRoutes?.productionSecurityControlReceipts?.endsWith('/production-security-control-receipts'), 'HTTP production security control receipt workflow must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/evidence-source-review-workflow`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.evidenceSourceReviewWorkflow?.schemaVersion === 'evidence-source-review-workflow/v1', 'HTTP evidence source review workflow endpoint must expose the workflow contract.');
  assert(httpBody.evidenceSourceReviewWorkflow?.readyForLocalPilot === true && httpBody.evidenceSourceReviewWorkflow?.readyForProduction === false, 'HTTP evidence source review workflow must be local-ready without production overclaim.');
  assert(httpBody.evidenceSourceReviewWorkflow?.reviewItems?.length >= 3 && httpBody.evidenceSourceReviewWorkflow?.reviewItems?.length === httpBody.evidenceSourceReviewWorkflow?.summary?.reviewItemCount && httpBody.evidenceSourceReviewWorkflow?.backendRoutes?.evidenceSourceReviewWorkflow?.endsWith('/evidence-source-review-workflow'), 'HTTP evidence source review workflow must expose source review items and its own route.');
  assert(httpBody.evidenceSourceReviewWorkflow?.summary?.sourceReviewDecisionCount >= 3 && httpBody.evidenceSourceReviewWorkflow?.summary?.pendingDecisionSourceCount === 0, 'HTTP evidence source review workflow must expose submitted source review decisions.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/evidence-custody-readiness`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.evidenceCustodyReadiness?.schemaVersion === 'evidence-custody-readiness/v1', 'HTTP evidence custody readiness endpoint must expose the custody contract.');
  assert(httpBody.evidenceCustodyReadiness?.readyForPrivatePilot === true && httpBody.evidenceCustodyReadiness?.readyForProduction === false, 'HTTP evidence custody readiness must be local-ready without production storage overclaim.');
  assert(
    httpBody.evidenceCustodyReadiness?.summary?.custodyRecordCount === (
      (httpBody.evidenceCustodyReadiness?.summary?.sourceSnapshotCount || 0)
      + (httpBody.evidenceCustodyReadiness?.summary?.providerReceiptCount || 0)
    )
      && httpBody.evidenceCustodyReadiness?.backendRoutes?.evidenceCustodyReadiness?.endsWith('/evidence-custody-readiness'),
    'HTTP evidence custody readiness must expose custody record count and route.',
  );

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/project-evidence-exports`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.projectEvidenceExportWorkflow?.schemaVersion === 'project-evidence-export-workflow/v1', 'HTTP project evidence export workflow endpoint must expose the export governance contract.');
  assert(httpBody.projectEvidenceExportWorkflow?.readyForProductionExport === false, 'HTTP project evidence export workflow must keep production export blocked.');
  assert(httpBody.projectEvidenceExportWorkflow?.backendRoutes?.projectEvidenceExports?.endsWith('/project-evidence-exports'), 'HTTP project evidence export workflow must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/launch-approvals`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1' && httpBody.launchApprovalWorkflow?.checksum, 'HTTP launch approvals endpoint must expose the checksummed approval workflow contract.');
  assert(httpBody.launchApprovalWorkflow?.readyForProduction === false, 'HTTP launch approvals endpoint must not claim production approval readiness.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-launch-audit`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionLaunchAudit?.schemaVersion === 'production-launch-audit/v1', 'HTTP production launch audit endpoint must expose the audit contract.');
  assert(['go', 'no-go'].includes(httpBody.productionLaunchAudit?.privatePilotDecision), 'HTTP production launch audit must expose a private-pilot decision.');
  assert(httpBody.productionLaunchAudit?.productionDecision === 'no-go', 'HTTP production launch audit must keep public production blocked.');
  assert(httpBody.productionLaunchAudit?.summary?.failedProductionGateCount > 0, 'HTTP production launch audit must keep failed production gates visible.');
  assert(httpBody.productionLaunchAudit?.evidenceRoutes?.some((route) => route.id === 'artifact-quality-audit' && route.ready), 'HTTP production launch audit must include a ready artifact quality audit route.');
  assert(httpBody.productionLaunchAudit?.evidenceRoutes?.some((route) => route.id === 'evidence-custody-readiness' && route.ready), 'HTTP production launch audit must include a ready evidence custody route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/mvp-readiness`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.mvpReadiness?.summary?.schedulerProofedAgentCount > 0, 'HTTP MVP readiness endpoint must include scheduler-produced Agent proof.');
  assert(httpBody.mvpReadiness?.nextShortestPath?.scope === 'production-hardening', 'HTTP MVP readiness must point to production hardening after core acceptance passes.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/security-boundary`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.securityBoundary?.schemaVersion === 'security-boundary/v1', 'HTTP security boundary endpoint must expose the security contract.');
  assert(httpBody.securityBoundary?.routeSummary?.routeKeys?.includes('security-boundary'), 'HTTP security boundary route manifest must include itself.');
  assert(httpBody.securityBoundary?.redactionScan?.status === 'ready' && httpBody.securityBoundary?.providerBoundary?.exposedSecrets === false, 'HTTP security boundary must preserve redaction guarantees.');
  assert(httpBody.securityBoundary?.accessControl?.status === 'enforceable-prototype-policy', 'HTTP security boundary must expose the access-control policy contract.');
  assert(httpBody.securityBoundary?.secretVault?.ready === true, 'HTTP security boundary must expose local secret-vault readiness.');

  httpResponse = await fetch(`${httpRuntime.url}/secret-vault/status`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.secretVaultStatus?.schemaVersion === 'secret-vault-status/v1' && httpBody.secretVaultStatus?.ready === true, 'HTTP secret-vault status route must expose redacted local vault readiness.');
  assert(!JSON.stringify(httpBody).includes(FAKE_SEARCH_SECRET) && !JSON.stringify(httpBody).includes(FAKE_MODEL_SECRET), 'HTTP secret-vault status route must not expose provider secret fixtures.');

  httpResponse = await fetch(`${httpRuntime.url}/secret-vault/records`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.secretVaultRecords?.schemaVersion === 'secret-vault-record-list/v1' && httpBody.secretVaultRecords?.records?.length >= 2, 'HTTP secret-vault records route must expose safe record metadata.');
  assert(!JSON.stringify(httpBody).includes('ciphertext') && !JSON.stringify(httpBody).includes(FAKE_SEARCH_SECRET) && !JSON.stringify(httpBody).includes(FAKE_MODEL_SECRET), 'HTTP secret-vault records route must not expose ciphertext or plaintext provider secrets.');

  httpResponse = await fetch(`${httpRuntime.url}/provider-vault-bindings`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.providerVaultBindings?.schemaVersion === 'provider-vault-bindings/v1', 'HTTP provider-vault binding route must expose the provider/vault binding contract.');
  assert(httpBody.providerVaultBindings?.summary?.boundProviderCount >= 2 && httpBody.providerVaultBindings?.redaction?.rawLeakCount === 0, 'HTTP provider-vault binding route must prove vault-backed providers without raw secret leaks.');
  assert(!JSON.stringify(httpBody).includes(FAKE_SEARCH_SECRET) && !JSON.stringify(httpBody).includes(FAKE_MODEL_SECRET) && !JSON.stringify(httpBody).includes(FAKE_VAULT_MASTER_KEY), 'HTTP provider-vault binding route must not expose provider secrets or vault key material.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/provider-vault-bindings`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.providerVaultBindings?.projectId === projectId && httpBody.providerVaultBindings?.backendRoutes?.providerReadiness?.endsWith('/provider-readiness'), 'HTTP project provider-vault binding route must expose project-scoped provider proof routes.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/provider-readiness`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.providerReadiness?.schemaVersion === 'provider-readiness/v1', 'HTTP provider readiness endpoint must expose the provider rollout contract.');
  assert(httpBody.providerReadiness?.status === 'local-provider-contract-ready', 'HTTP provider readiness endpoint must pass local provider gates.');
  assert(httpBody.providerReadiness?.providerControlPolicy?.enforcementEnabled === true, 'HTTP provider readiness must expose enforced provider policy.');
  assert(httpBody.providerReadiness?.providerUsage?.count >= 1, 'HTTP provider readiness must expose provider usage audit rows.');
  assert(httpBody.providerReadiness?.providerBoundaries?.evidence?.sourceSafetySummary?.sourceSafetyReady === true, 'HTTP provider readiness must expose source-safety summary.');
  assert(httpBody.providerReadiness?.providerBoundaries?.failureControl?.ready === true, 'HTTP provider readiness must expose provider failure-control summary.');
  assert(httpBody.providerReadiness?.providerBoundaries?.secretVault?.ready === true, 'HTTP provider readiness must expose provider secret-vault summary.');
  assert(httpBody.providerReadiness?.providerVaultBindings?.schemaVersion === 'provider-vault-bindings/v1' && httpBody.providerReadiness?.summary?.providerVaultBoundProviderCount >= 2, 'HTTP provider readiness must embed provider-vault binding evidence.');
  assert(httpBody.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'encrypted-secret-vault' && control.status === 'local-control-ready'), 'HTTP provider readiness must expose encrypted secret vault as a local control.');
  assert(!JSON.stringify(httpBody.providerReadiness).includes(FAKE_SEARCH_SECRET), 'HTTP provider readiness must not expose the search secret fixture.');
  assert(!JSON.stringify(httpBody.providerReadiness).includes(FAKE_MODEL_SECRET), 'HTTP provider readiness must not expose the model secret fixture.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/provider-controlled-run`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.providerControlledRun?.schemaVersion === 'provider-controlled-run/v1', 'HTTP provider controlled run endpoint must expose the run contract.');
  assert(httpBody.providerControlledRun?.status === 'local-controlled-run-ready' && httpBody.providerControlledRun?.readyForPrivatePilotRun === true, 'HTTP provider controlled run endpoint must pass local run gates.');
  assert(httpBody.providerControlledRun?.operationPlan?.some((row) => row.operation === 'model:artifact-draft' && row.usageProof.count >= 1), 'HTTP provider controlled run must preserve model usage proof.');
  assert(httpBody.providerControlledRun?.operationPlan?.some((row) => row.operation === 'search:evidence' && row.usageProof.count >= 1), 'HTTP provider controlled run must preserve search usage proof.');
  assert(httpBody.providerControlledRun?.requiredProductionControls?.some((control) => control.id === 'real-provider-eval-run' && control.status === 'blocked'), 'HTTP provider controlled run must expose real-provider eval as a blocker.');
  assert(!JSON.stringify(httpBody.providerControlledRun).includes(FAKE_MODEL_SECRET), 'HTTP provider controlled run must not expose the model secret fixture.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/provider-eval-runs`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.providerEvalRunWorkflow?.schemaVersion === 'provider-eval-run-workflow/v1', 'HTTP provider eval run endpoint must expose the workflow contract.');
  assert(httpBody.providerEvalRunWorkflow?.readyForPrivatePilotProviderEval === true && httpBody.providerEvalRunWorkflow?.latestRun?.status === 'shadow-replay-passed', 'HTTP provider eval workflow must expose the persisted shadow replay readiness.');
  assert(httpBody.providerEvalRunWorkflow?.backendRoutes?.providerEvalRuns?.endsWith('/provider-eval-runs'), 'HTTP provider eval workflow must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-provider-control-receipts`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionProviderControlReceiptWorkflow?.schemaVersion === 'production-provider-control-receipt-workflow/v1', 'HTTP production provider control receipt endpoint must expose the workflow contract.');
  assert(httpBody.productionProviderControlReceiptWorkflow?.readyForLocalProviderContract === true && httpBody.productionProviderControlReceiptWorkflow?.readyForProductionProvider === false, 'HTTP production provider control receipt workflow must see local provider proof while keeping production provider blocked.');
  assert(httpBody.productionProviderControlReceiptWorkflow?.backendRoutes?.productionProviderControlReceipts?.endsWith('/production-provider-control-receipts'), 'HTTP production provider control receipt workflow must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/provider-eval-runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: 'shadow-replay',
      actorRole: 'runtime-platform',
      actorId: 'provider-eval-http-harness',
      reason: 'HTTP provider eval shadow replay acceptance coverage.',
      now: '2026-06-01T11:36:00.000Z',
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.providerEvalRun?.schemaVersion === 'provider-eval-run/v1' && httpBody.providerEvalRun?.readyForPrivatePilotProviderEval === true, 'HTTP provider eval run endpoint must record a shadow replay receipt.');
  assert(httpBody.providerEvalRun?.operationRows?.some((row) => row.operation === 'model:artifact-draft' && row.evalStatus === 'replayed-from-usage-ledger'), 'HTTP provider eval run must replay model usage proof.');
  assert(httpBody.providerEvalRun?.operationRows?.some((row) => row.operation === 'search:evidence' && row.evalStatus === 'replayed-from-usage-ledger'), 'HTTP provider eval run must replay search usage proof.');
  assert(httpBody.managerReadyPackage?.providerEvalRunWorkflow?.readyForPrivatePilotProviderEval === true, 'HTTP provider eval run write must return an updated Manager Ready Package.');
  assert(!JSON.stringify(httpBody.providerEvalRun).includes(FAKE_MODEL_SECRET), 'HTTP provider eval run must not expose the model secret fixture.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/security-boundary`, {
    headers: enforcedObserverHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 403 && httpBody.accessDecision?.route?.routeKey === 'security-boundary', 'HTTP enforced mode must reject observer security-boundary access.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/agents/jobs/dashboard`, {
    headers: enforcedJobsAgentHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.agentId === 'jobs', 'HTTP enforced mode must allow an Agent to read its own dashboard.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/agents/da_vinci/dashboard`, {
    headers: enforcedDaVinciAgentHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.brainstormContribution?.schemaVersion === 'agent-brainstorm-contribution/v1' && httpBody.brainstormContribution?.readyForPrivatePilotContribution === true, 'HTTP Agent Dashboard must expose the submitting Agent brainstorm contribution contract.');
  assert(httpBody.brainstormContribution?.backendRoutes?.brainstormLayer?.endsWith('/brainstorm-layer') && httpBody.proof?.brainstormAlternativeCount >= 3, 'HTTP Agent Dashboard brainstorm contribution must include brainstorm layer route and alternative proof.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/agents/curie/dashboard`, {
    headers: enforcedJobsAgentHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 403 && httpBody.accessDecision?.route?.routeKey === 'agent-read', 'HTTP enforced mode must reject cross-Agent dashboard access.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/security-access-audit`, {
    headers: enforcedSecurityHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.securityAccessAudit?.count >= 10, 'HTTP security access audit endpoint must expose persisted access decisions.');
  assert(httpBody.securityAccessAudit?.deniedCount >= 5, 'HTTP security access audit endpoint must include denied access decisions.');
  assert(httpBody.securityAccessAudit?.eventIds?.length >= httpBody.securityAccessAudit?.count, 'HTTP security access audit rows must link to event-ledger proof.');
  assert(httpBody.securityAccessAudit?.stream?.count >= httpBody.securityAccessAudit?.count, 'HTTP security access audit endpoint must expose backend audit stream summary.');
  assert(httpBody.securityAccessAudit?.stream?.sequenceGapCount === 0, 'HTTP security access audit endpoint must preserve contiguous backend audit stream proof.');
  assert(httpBody.securityAccessAudit?.stream?.hashChainReady === true, 'HTTP security access audit endpoint must preserve backend audit hash-chain proof.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/security-audit-stream`, {
    headers: enforcedSecurityHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.securityAuditStream?.schemaVersion === 'security-audit-stream/v1', 'HTTP security audit stream endpoint must expose the backend audit stream contract.');
  assert(httpBody.securityAuditStream?.count >= 11, 'HTTP security audit stream endpoint must expose persisted access decisions.');
  assert(httpBody.securityAuditStream?.deniedCount >= 5, 'HTTP security audit stream endpoint must include denied decisions.');
  assert(httpBody.securityAuditStream?.sequenceGapCount === 0, 'HTTP security audit stream endpoint must preserve contiguous append order.');
  assert(httpBody.securityAuditStream?.hashChainReady === true && httpBody.securityAuditStream?.chainBreakCount === 0 && httpBody.securityAuditStream?.hashMismatchCount === 0, 'HTTP security audit stream endpoint must expose a verified hash chain.');
  assert(httpBody.securityAuditStream?.rows?.every((row) => row.streamRecordId && row.streamChecksum && row.streamSequence && row.previousStreamHash && row.streamHash), 'HTTP security audit stream rows must include stream ids, checksums, sequence proof, and hash-chain links.');
  assert(httpBody.securityAuditStream?.storage?.type === 'file-store-append-log', 'HTTP security audit stream endpoint must use the file-store append log sink.');
  assert(httpBody.securityAuditStream?.storage?.hashChain?.ready === true, 'HTTP security audit stream storage must expose hash-chain metadata.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/persistence-snapshot`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.persistenceSnapshot?.integrity?.status === 'ready', 'HTTP persistence snapshot endpoint must expose a ready normalized persistence contract.');
  assert(httpBody.persistenceSnapshot.recordCounts.worker_runs > 0 && httpBody.persistenceSnapshot.recordCounts.read_model_checkpoints > 0, 'HTTP persistence snapshot must include worker and read-model checkpoint rows.');
  assert(httpBody.persistenceSnapshot.recordCounts.security_access_audit > 0, 'HTTP persistence snapshot must include security access audit rows.');
  assert(httpBody.persistenceSnapshot.recordCounts.security_audit_stream > 0, 'HTTP persistence snapshot must include backend security audit stream rows.');
  assert(httpBody.persistenceSnapshot.recordCounts.provider_usage_ledger > 0, 'HTTP persistence snapshot must include provider usage ledger rows.');
  assert(httpBody.persistenceSnapshot.recordCounts.provider_eval_runs > 0, 'HTTP persistence snapshot must include provider eval run rows.');
  assert(
    httpBody.persistenceSnapshot.recordCounts.evidence_source_snapshots >= 3
      && httpBody.persistenceSnapshot.recordCounts.evidence_provider_receipts >= 1
      && httpBody.persistenceSnapshot.recordCounts.evidence_source_snapshots === httpBody.persistenceSnapshot.recordsByTable?.evidence_source_snapshots?.length
      && httpBody.persistenceSnapshot.recordCounts.evidence_provider_receipts === httpBody.persistenceSnapshot.recordsByTable?.evidence_provider_receipts?.length,
    'HTTP persistence snapshot must include source snapshot and provider receipt rows.',
  );

  httpResponse = await fetch(`${httpRuntime.url}/workers/queue-snapshot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-01T11:35:00.000Z',
      forceDue: true,
      forceProjectIds: [projectId],
      maxAgentsPerProject: team.length,
      maxProjects: 1,
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.workerQueueSnapshot?.summary?.agentQueuedCount >= team.length, 'HTTP worker queue snapshot must expose forced due Agent queue rows.');
  assert(httpBody.workerQueueSnapshot.agentQueue.every((row) => row.idempotencyKey && row.leaseKey && row.retry?.schemaVersion === 'worker-retry-state/v1' && row.initiative?.schemaVersion === 'agent-autonomous-initiative/v1' && row.requestBody?.agentInitiativeId === row.initiativeId), 'HTTP worker queue snapshot rows must include idempotency, lease, retry keys, and Agent initiative proof.');
  assert(httpBody.workerQueueSnapshot.deadLetterPolicy?.schemaVersion === 'worker-dead-letter-policy/v1' && httpBody.workerQueueSnapshot.executionReceipts?.length >= 1, 'HTTP worker queue snapshot must expose dead-letter policy and execution receipts.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-flow-graph`);
  httpBody = await httpResponse.json();
  assert(
    httpResponse.status === 200
    && httpBody.nodes.some((node) => (
      node.category === 'monitoring'
      && (node.eventIds?.length || node.timelineLogIds?.length)
    )),
    'HTTP Manager Flow Graph must expose scheduler/runtime monitoring proof nodes.',
  );
} finally {
  await httpServer.close();
}

progress('signed access and replay checks');
const signedApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
  },
});
const signedSecurityPath = `/projects/${projectId}/security-boundary`;
response = signedApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-missing', 'Signed access mode must reject unsigned enforced requests when a signing secret is configured.');
response = signedApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: signedHeadersFor({ method: 'GET', path: signedSecurityPath }),
});
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Signed access mode must allow valid signed security-admin requests.');
const tamperedSignedHeaders = signedHeadersFor({ method: 'GET', path: signedSecurityPath });
tamperedSignedHeaders['x-hofs-role'] = 'observer';
response = signedApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: tamperedSignedHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-invalid', 'Signed access mode must reject tampered identity headers before role policy evaluation.');

const replayApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireSignedRequestIds: true,
  },
});
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: signedHeadersFor({ method: 'GET', path: signedSecurityPath }),
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-request-id-missing', 'Replay protection must require a signed request id.');
const replayHeaders = signedHeadersFor({
  method: 'GET',
  path: signedSecurityPath,
  requestId: 'product-team-replay-once-security-boundary',
});
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: replayHeaders,
});
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Replay protection must allow the first use of a signed request id.');
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: replayHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-replay-detected', 'Replay protection must reject reuse of the same signed request id.');
const persistentReplayHeaders = signedHeadersFor({
  method: 'GET',
  path: signedSecurityPath,
  requestId: 'product-team-persistent-replay-security-boundary',
});
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: persistentReplayHeaders,
});
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Persistent replay protection must allow the first use of a new signed request id.');
const restartedReplayApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireSignedRequestIds: true,
  },
});
response = restartedReplayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: persistentReplayHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-replay-detected', 'Replay protection must reject reused request ids after a file-backed backend restart.');
assert(response.body.accessDecision?.replay?.storage === 'file-store', 'Replay protection must report file-backed storage for restarted API checks.');
assert(restartedReplayApi.store.snapshot().accessReplayRecords.some((record) => record.requestId === 'product-team-persistent-replay-security-boundary'), 'File-backed store must persist signed request replay records.');
response = replayApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-access-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/security-access-audit`,
    role: 'security-admin',
    userId: 'security-lead',
    requestId: 'product-team-replay-audit-read',
  }),
});
assert(response.status === 200 && response.body.securityAccessAudit?.rows?.some((row) => row.replay?.detected === true), 'Security access audit must persist replay-denied decisions.');

const auditFailClosedApi = createAgentProjectApi({
  service: {
    recordAccessDecision() {
      throw new Error('audit-sink-offline');
    },
  },
  accessControl: {
    failClosedOnAuditError: true,
  },
});
response = auditFailClosedApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-dashboard`,
  headers: enforcedManagerHeaders,
});
assert(response.status === 503 && response.body.error === 'access-audit-write-failed', 'Audit fail-closed mode must reject allowed project access when audit write fails.');
assert(response.body.accessDecision?.audit?.written === false && response.body.accessDecision?.audit?.reason === 'access-audit-write-failed', 'Audit fail-closed response must explain the audit write failure.');

const signedHttpServer = createAgentProjectHttpServer({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireSignedRequestIds: true,
  },
  autonomousScheduler: {
    intervalMs: 1_000,
  },
});
const signedHttpRuntime = await signedHttpServer.listen();
try {
  let signedHttpResponse = await fetch(`${signedHttpRuntime.url}${signedSecurityPath}`, {
    headers: enforcedSecurityHeaders,
  });
  let signedHttpBody = await signedHttpResponse.json();
  assert(signedHttpResponse.status === 403 && signedHttpBody.accessDecision?.reason === 'signed-access-missing', 'HTTP signed access mode must reject unsigned enforced requests.');

  signedHttpResponse = await fetch(`${signedHttpRuntime.url}${signedSecurityPath}`, {
    headers: signedHeadersFor({
      method: 'GET',
      path: signedSecurityPath,
      requestId: 'product-team-signed-http-security-boundary',
    }),
  });
  signedHttpBody = await signedHttpResponse.json();
  assert(signedHttpResponse.status === 200 && signedHttpBody.securityBoundary?.schemaVersion === 'security-boundary/v1', 'HTTP signed access mode must allow valid signed security-admin requests.');

  signedHttpResponse = await fetch(`${signedHttpRuntime.url}/workers/autonomous/tick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-01T11:40:00.000Z',
      trigger: 'product-team-signed-http-scheduler-tick',
      source: 'product-team-signed-http-scheduler-chat',
      forceProjectRun: true,
      forceProjectIds: [projectId],
      forceAgentRun: true,
      forceAgentProjectIds: [projectId],
      maxAgentProjects: 1,
      maxAgentsPerProject: team.length,
      agentTrigger: 'product-team-signed-http-scheduler-tick-agents',
    }),
  });
  signedHttpBody = await signedHttpResponse.json();
  assert(signedHttpResponse.status === 200 && signedHttpBody.skipped === false, 'HTTP scheduler must sign its internal worker calls when access signing is enabled.');
  assert(signedHttpBody.result.processed.some((item) => item.projectId === projectId), 'Signed HTTP scheduler tick must process the acceptance project.');
} finally {
  await signedHttpServer.close();
}

progress('membership enforced private-pilot chain');
const membershipApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireProjectMembership: true,
  },
});
progress('membership API created');
const membershipManagerPath = `/projects/${projectId}/manager-dashboard`;
response = membershipApi.handle({
  method: 'GET',
  path: membershipManagerPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipManagerPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.projectId === projectId, 'Project membership policy must allow the signed project manager.');

if (ACCEPTANCE_STAGE === 'cycle-consistency') {
  progress('autonomous cycle consistency loop starting');
  const consistencyLoopPath = `/projects/${projectId}/autonomous-run-control/run-loop`;
  response = membershipApi.handle({
    method: 'POST',
    path: consistencyLoopPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: consistencyLoopPath,
      role: 'manager',
      userId: 'director',
    }),
    body: {
      now: '2026-06-01T19:10:00.000Z',
      maxSteps: 3,
      force: true,
      includeReadModels: false,
      useAgentAutonomousStrategy: true,
      submitAgentWorkArtifacts: true,
      reviewPendingSubmissions: true,
      respondToReviewObligations: true,
    },
  });
  assert(response.status === 200 && response.body.autonomousRunControlLoop?.schemaVersion === 'autonomous-run-control-loop-run/v1', 'Autonomous cycle consistency stage must record a signed bounded loop receipt.');
  assert(response.body.autonomousRunControlLoop.stepCount >= 3 && response.body.autonomousRunControlLoop.runReceiptIds?.length >= 3 && !response.body.autonomousRunControlLoop.failedStep, `Autonomous cycle consistency stage must run at least three signed receipt-backed steps. Actual: ${response.body.autonomousRunControlLoop.stepCount}`);
  progress('autonomous cycle consistency loop completed');

  const consistencyPath = `/projects/${projectId}/autonomous-cycle-consistency`;
  response = membershipApi.handle({
    method: 'GET',
    path: consistencyPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: consistencyPath,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.autonomousCycleConsistency?.schemaVersion === 'autonomous-cycle-consistency/v1', 'Autonomous cycle consistency stage must expose standalone consistency proof.');
  assert(response.body.autonomousCycleConsistency.readyForLocalPilotCycleConsistency === true && response.body.autonomousCycleConsistency.readyForProduction === false, `Autonomous cycle consistency stage must prove local signed N-step continuity without production overclaim. Actual: ${response.body.autonomousCycleConsistency.status}`);
  assert(response.body.autonomousCycleConsistency.summary?.observedStepCount >= 3 && response.body.autonomousCycleConsistency.summary?.missingRunReceiptCount === 0 && response.body.autonomousCycleConsistency.summary?.failedLocalRowCount === 0, 'Autonomous cycle consistency stage must show consistent steps with no missing receipts or failed local rows.');

  response = membershipApi.handle({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    headers: signedHeadersFor({
      method: 'GET',
      path: `/projects/${projectId}/readiness-proof-map`,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.autonomousCycleConsistencySummary?.readyForLocalPilotCycleConsistency === true && response.body.autonomousCycleConsistencySummary?.observedStepCount >= 3, 'Autonomous cycle consistency stage must expose Proof Map consistency summary.');
  assert(response.body.autonomousCycleConsistencyRoutes?.some((route) => route.apiPath?.endsWith('/autonomous-cycle-consistency') && route.runReceiptCount >= 3 && route.loopReceiptCount >= 1 && route.readyForLocalPilotCycleConsistency === true && route.productionBlocker === true), 'Autonomous cycle consistency stage must expose Proof Map consistency route.');

  response = membershipApi.handle({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    headers: signedHeadersFor({
      method: 'GET',
      path: `/projects/${projectId}/manager-flow-graph`,
      role: 'manager',
      userId: 'director',
    }),
  });
  const stageConsistencyGraph = response.body.managerFlowGraph || response.body;
  const stageConsistencyNode = stageConsistencyGraph?.nodes?.find((node) => node.id === 'autonomous-cycle-consistency' && node.source === 'autonomousCycleConsistency');
  assert(response.status === 200 && stageConsistencyNode?.route?.endsWith('/autonomous-cycle-consistency') && stageConsistencyNode.proofIds?.length && stageConsistencyNode.attachments?.some((attachment) => attachment.type === 'autonomous-cycle-consistency-loop' && attachment.ready === true), 'Autonomous cycle consistency stage must expose Flow Graph consistency node and loop attachment.');

  response = membershipApi.handle({
    method: 'GET',
    path: `/projects/${projectId}/manager-ready-package`,
    headers: signedHeadersFor({
      method: 'GET',
      path: `/projects/${projectId}/manager-ready-package`,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.autonomousCycleConsistency?.schemaVersion === 'autonomous-cycle-consistency/v1' && response.body.summary?.autonomousCycleConsistencyReady === true, 'Autonomous cycle consistency stage must embed consistency proof in Manager Ready Package.');

  const consistencyStageStoreSnapshot = JSON.parse(readFileSync(`${root}/store.json`, 'utf8'));
  const consistencyStageProject = consistencyStageStoreSnapshot.projects.find((project) => project.id === projectId);
  assert(consistencyStageProject?.autonomousRunControlLoopLedger?.some((record) => record.schemaVersion === 'autonomous-run-control-loop-run/v1' && record.stepCount >= 3 && record.runReceiptIds?.length >= 3 && record.eventId && record.logId), 'Autonomous cycle consistency stage must persist N-step loop receipts.');
  assert(consistencyStageProject?.autonomousRunControlRunLedger?.length >= 3, 'Autonomous cycle consistency stage must persist child action run receipts.');
  progress('autonomous cycle consistency persistence ready');
}

response = membershipApi.handle({
  method: 'GET',
  path: membershipManagerPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipManagerPath,
    role: 'manager',
    userId: 'outside-manager',
  }),
});
assert(response.status === 403 && response.body.accessDecision?.membership?.reason === 'project-membership-mismatch', 'Project membership policy must reject a signed manager outside the project.');

const membershipProviderReadinessPath = `/projects/${projectId}/provider-readiness`;
response = membershipApi.handle({
  method: 'GET',
  path: membershipProviderReadinessPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipProviderReadinessPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.providerReadiness?.schemaVersion === 'provider-readiness/v1', 'Project membership policy must allow security admin provider readiness reads.');

const membershipEvidenceCustodyPath = `/projects/${projectId}/evidence-custody-readiness`;
response = membershipApi.handle({
  method: 'GET',
  path: membershipEvidenceCustodyPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipEvidenceCustodyPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.evidenceCustodyReadiness?.schemaVersion === 'evidence-custody-readiness/v1', 'Project membership policy must allow security admin evidence custody readiness reads.');

progress('membership identity-session checks');
const identitySessionsPath = `/projects/${projectId}/identity-sessions`;
response = membershipApi.handle({
  method: 'POST',
  path: identitySessionsPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: identitySessionsPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    role: 'manager',
    userId: 'director',
    issuerRole: 'manager',
    issuerId: 'director',
    ttlMs: 60 * 60 * 1000,
    scope: ['project', 'manager-dashboard'],
    source: 'product-team-acceptance-identity-session',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.identitySession?.schemaVersion === 'identity-session/v1', 'Project API must issue a local identity-session record.');
assert(response.body.tokenContract?.schemaVersion === 'identity-session-token/v1' && response.body.tokenContract.returnedOnce === true && response.body.tokenContract.header === 'x-hofs-session-token', 'Identity-session issuance must return the one-time token contract.');
assert(response.body.token && response.body.token.startsWith('hofs_sess_'), 'Identity-session issuance must return a bearer token once.');
const managerIdentitySessionToken = response.body.token;
const managerIdentitySessionId = response.body.identitySession.id;
assert(response.body.identitySession.status === 'active' && response.body.identitySession.tokenHash !== managerIdentitySessionToken, 'Identity-session response must expose only public token-hash proof, never the raw token as session data.');
assert(!JSON.stringify(response.body.project).includes(managerIdentitySessionToken), 'Persisted project state returned by the API must not include the raw identity-session token.');
assert(response.body.project.eventLedger.some((event) => event.type === 'identity-session-issued' && event.entityIds?.identitySessionId === managerIdentitySessionId), 'Identity-session issuance must enter the project event ledger.');
assert(response.body.readModels?.included === false && response.body.readModels?.identitySessionsRoute?.endsWith('/identity-sessions') && response.body.readModels?.securityAccessAuditRoute?.endsWith('/security-access-audit'), 'Identity-session issuance must support lightweight security read-model refresh routes.');
assert(!response.body.managerReadyPackage && !response.body.managerDashboard && !response.body.securityBoundary, 'Identity-session issuance must not embed large Manager or Security Boundary read models when includeReadModels is false.');

response = membershipApi.handle({
  method: 'GET',
  path: identitySessionsPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: identitySessionsPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.identitySessions?.summary?.activeCount >= 1, 'Project API must list active local identity sessions.');
assert(response.body.identitySessions.rows.some((row) => row.id === managerIdentitySessionId && row.status === 'active'), 'Identity-session list must include the newly issued active session.');
assert(!JSON.stringify(response.body.identitySessions).includes(managerIdentitySessionToken), 'Identity-session list must not expose the raw session token.');

response = membershipApi.handle({
  method: 'GET',
  path: membershipManagerPath,
  headers: {
    'x-hofs-session-token': managerIdentitySessionToken,
  },
});
assert(response.status === 200 && response.body.projectId === projectId, 'Identity-session token must authorize the project manager without signed headers.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-access-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/security-access-audit`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.securityAccessAudit?.rows?.some((row) => row.identitySession?.verified === true && row.identitySession?.sessionId === managerIdentitySessionId), 'Security access audit must persist identity-session verified access decisions.');

const revokeIdentitySessionPath = `${identitySessionsPath}/${encodeURIComponent(managerIdentitySessionId)}/revoke`;
response = membershipApi.handle({
  method: 'POST',
  path: revokeIdentitySessionPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: revokeIdentitySessionPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    revokedBy: 'security-lead',
    reason: 'Acceptance harness proves revoked sessions fail closed.',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.identitySession?.status === 'revoked', 'Project API must revoke local identity sessions.');
assert(response.body.project.eventLedger.some((event) => event.type === 'identity-session-revoked' && event.entityIds?.identitySessionId === managerIdentitySessionId), 'Identity-session revocation must enter the project event ledger.');
assert(response.body.readModels?.included === false && response.body.readModels?.identitySessionsRoute?.endsWith('/identity-sessions') && response.body.readModels?.securityBoundaryRoute?.endsWith('/security-boundary'), 'Identity-session revocation must support lightweight security read-model refresh routes.');
assert(!response.body.managerReadyPackage && !response.body.managerDashboard && !response.body.securityBoundary, 'Identity-session revocation must not embed large Manager or Security Boundary read models when includeReadModels is false.');

response = membershipApi.handle({
  method: 'GET',
  path: membershipManagerPath,
  headers: {
    'x-hofs-session-token': managerIdentitySessionToken,
  },
});
assert(response.status === 403 && response.body.error === 'identity-session-invalid', 'Revoked identity-session tokens must fail closed before route dispatch.');

response = membershipApi.handle({
  method: 'POST',
  path: identitySessionsPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: identitySessionsPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    role: 'security-admin',
    userId: 'security-lead',
    issuerRole: 'security-admin',
    issuerId: 'security-lead',
    ttlMs: 60 * 60 * 1000,
    scope: ['project', 'security-boundary'],
    source: 'product-team-acceptance-active-identity-session',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.identitySession?.status === 'active', 'Project API must keep a second active identity-session proof row.');
const activeSecurityIdentitySessionToken = response.body.token;
const activeSecurityIdentitySessionId = response.body.identitySession.id;

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-boundary`,
  headers: {
    'x-hofs-session-token': activeSecurityIdentitySessionToken,
  },
});
assert(response.status === 200 && response.body.securityBoundary?.identitySessions?.activeCount >= 1, 'Security boundary must accept active identity-session tokens and summarize active sessions.');
assert(response.body.securityBoundary.identitySessions.rows.some((row) => row.id === activeSecurityIdentitySessionId && row.status === 'active'), 'Security boundary must expose public identity-session rows.');
assert(response.body.securityBoundary.summary?.identitySessionRevokedCount >= 1, 'Security boundary must summarize revoked identity sessions.');
assert(response.body.securityBoundary.routeSummary.routeKeys.includes('identity-sessions'), 'Security boundary route manifest must include identity sessions after issuance.');

const membershipAgentPath = `/projects/${projectId}/agents/jobs/dashboard`;
response = membershipApi.handle({
  method: 'GET',
  path: membershipAgentPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipAgentPath,
    role: 'agent',
    agentId: 'jobs',
    userId: 'agent-runtime-jobs',
  }),
});
assert(response.status === 200 && response.body.agentId === 'jobs', 'Project membership policy must allow the bound Agent runtime identity.');

response = membershipApi.handle({
  method: 'PUT',
  path: `/projects/${projectId}/membership-policy`,
  headers: signedHeadersFor({
    method: 'PUT',
    path: `/projects/${projectId}/membership-policy`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    policy: {
      ...projectMembershipPolicy,
      revokedUserIds: ['agent-runtime-jobs'],
    },
    updatedBy: 'security-lead',
    source: 'product-team-acceptance-revocation',
    now: '2026-06-01T11:35:00.000Z',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.projectMembershipPolicy?.revision === 2, 'Signed project membership updates must persist a new policy revision.');
assert(response.body.projectMembershipSummary?.revokedUserCount === 1, 'Project membership policy summary must expose revoked users.');
assert(response.body.readModels?.included === false && response.body.readModels?.membershipPolicyRoute?.endsWith('/membership-policy') && response.body.readModels?.securityAuditStreamRoute?.endsWith('/security-audit-stream'), 'Signed project membership updates must support lightweight security read-model refresh routes.');

response = membershipApi.handle({
  method: 'GET',
  path: membershipAgentPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipAgentPath,
    role: 'agent',
    agentId: 'jobs',
    userId: 'agent-runtime-jobs',
  }),
});
assert(response.status === 403 && response.body.accessDecision?.membership?.reason === 'project-membership-revoked', 'Project membership policy must reject revoked Agent runtime identities.');

response = membershipApi.handle({
  method: 'GET',
  path: membershipAgentPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipAgentPath,
    role: 'agent',
    agentId: 'jobs',
    userId: 'agent-runtime-outsider',
  }),
});
assert(response.status === 403 && response.body.accessDecision?.membership?.reason === 'project-membership-mismatch', 'Project membership policy must reject a signed Agent runtime user that is not bound to the project Agent.');

const membershipReviewPath = `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmissionId)}/reviews`;
response = membershipApi.handle({
  method: 'POST',
  path: membershipReviewPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: membershipReviewPath,
    role: 'reviewer-agent',
    agentId: 'turing',
    userId: 'agent-runtime-turing',
  }),
  body: {
    reviewerAgentId: 'turing',
    verdict: 'accepted',
    comments: 'This should fail because Turing is not the project Reviewer in the membership policy.',
  },
});
assert(response.status === 403 && response.body.accessDecision?.membership?.reason === 'project-membership-mismatch', 'Project membership policy must reject non-Reviewer Agent review attempts even when role and signature are otherwise valid.');
response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-access-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/security-access-audit`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.securityAccessAudit?.rows?.some((row) => row.membership?.verified === false), 'Security access audit must persist project membership denials.');
assert(response.body.securityAccessAudit?.rows?.some((row) => row.membership?.verified === true), 'Security access audit must persist project membership allows.');
assert(response.body.securityAccessAudit?.rows?.some((row) => row.membership?.reason === 'project-membership-revoked' && row.membership?.revision === 2), 'Security access audit must persist membership revocation decisions with policy revision.');

progress('membership persistence and adapter checks');
response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-snapshot`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-snapshot`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceSnapshot?.recordCounts?.access_replay_records > 0, 'Production persistence snapshot must include signed access replay records after replay protection runs.');
assert(response.body.persistenceSnapshot.recordsByTable.access_replay_records.some((record) => record.data.requestId === 'product-team-persistent-replay-security-boundary'), 'Production persistence snapshot must include the persistent replay request id record.');
assert(response.body.persistenceSnapshot.recordCounts.identity_sessions >= 2, 'Production persistence snapshot must include identity-session rows after local session issuance.');
assert(response.body.persistenceSnapshot.recordsByTable.identity_sessions.some((record) => record.data.id === activeSecurityIdentitySessionId && record.data.status === 'active'), 'Production persistence snapshot must include active identity-session rows.');
assert(response.body.persistenceSnapshot.recordsByTable.identity_sessions.some((record) => record.data.id === managerIdentitySessionId && record.data.status === 'revoked'), 'Production persistence snapshot must include revoked identity-session rows.');
assert(response.body.persistenceSnapshot.recordsByTable.security_access_audit.some((record) => record.data.identitySessionVerified === true && record.data.identitySessionId === managerIdentitySessionId), 'Production persistence snapshot must include identity-session access-audit columns.');
assert(!JSON.stringify(response.body.persistenceSnapshot).includes(managerIdentitySessionToken), 'Production persistence snapshot must not expose revoked raw identity-session tokens.');
assert(!JSON.stringify(response.body.persistenceSnapshot).includes(activeSecurityIdentitySessionToken), 'Production persistence snapshot must not expose active raw identity-session tokens.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-migration-plan`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-migration-plan`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceMigrationPlan?.schemaVersion === 'managed-persistence-migration-plan/v1', 'Project API must expose a managed persistence migration plan.');
assert(response.body.persistenceMigrationPlan.status === 'ready-for-managed-database-pilot', 'Migration plan must be ready once critical acceptance records are present.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('project_membership_policies'), 'Migration plan must seed project membership policies.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('identity_sessions'), 'Migration plan must seed identity-session rows.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('access_replay_records'), 'Migration plan must seed signed access replay records.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('evidence_source_snapshots'), 'Migration plan must seed evidence source snapshot rows.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('evidence_provider_receipts'), 'Migration plan must seed evidence provider receipt rows.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('evidence_source_reviews'), 'Migration plan must seed evidence source review rows.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('provider_eval_runs'), 'Migration plan must seed provider eval run rows.');
assert(response.body.persistenceMigrationPlan.tablePlans.some((plan) => plan.table === 'evidence_sources' && plan.primaryKey?.includes('evidenceSearchId')), 'Migration plan must scope evidence source primary keys by evidence search.');
assert(response.body.persistenceMigrationPlan.tablePlans.some((plan) => plan.table === 'security_audit_stream' && /security-admin/.test(plan.rlsDraft)), 'Migration plan must include security audit stream RLS guidance.');
assert(response.body.persistenceMigrationPlan.verificationGates.every((gate) => gate.passed), 'Migration plan verification gates must all pass for the acceptance project.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-migration-dry-run`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-migration-dry-run`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceMigrationDryRun?.schemaVersion === 'managed-persistence-dry-run/v1', 'Project API must expose a managed persistence dry-run verifier.');
assert(response.body.persistenceMigrationDryRun.status === 'passed', 'Managed persistence dry-run must pass for the acceptance project.');
assert(response.body.persistenceMigrationDryRun.adapterContract?.methods?.includes('importBatch(table, rows)'), 'Dry-run verifier must expose the minimum database adapter contract.');
assert(response.body.persistenceMigrationDryRun.summary.importedRecordCount === response.body.persistenceMigrationDryRun.summary.expectedRecordCount, 'Dry-run verifier must import every snapshot row.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.access_replay_records > 0, 'Dry-run verifier must import signed access replay rows.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.identity_sessions >= 2, 'Dry-run verifier must import identity-session rows.');
const dryRunImportedCounts = response.body.persistenceMigrationDryRun.importedTableCounts || {};
assert(
  dryRunImportedCounts.evidence_source_snapshots >= 3
    && dryRunImportedCounts.evidence_provider_receipts >= 1
    && dryRunImportedCounts.evidence_source_snapshots >= dryRunImportedCounts.evidence_provider_receipts,
  'Dry-run verifier must import source snapshot and provider receipt rows.',
);
assert(response.body.persistenceMigrationDryRun.importedTableCounts.provider_eval_runs > 0, 'Dry-run verifier must import provider eval run rows.');
assert(response.body.persistenceMigrationDryRun.gates.some((gate) => gate.id === 'checksum-preserved' && gate.passed), 'Dry-run verifier must check checksum preservation.');
assert(response.body.persistenceMigrationDryRun.gates.some((gate) => gate.id === 'rls-policy-drafts' && gate.passed), 'Dry-run verifier must check RLS guidance coverage.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-adapter-plan`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-adapter-plan`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceAdapterPlan?.schemaVersion === 'managed-persistence-adapter-plan/v1', 'Project API must expose a managed persistence adapter cutover plan.');
assert(response.body.persistenceAdapterPlan.status === 'ready-for-managed-adapter-pilot', 'Managed persistence adapter plan must be ready once migration, membership, replay, worker, and read-model records are present.');
assert(response.body.persistenceAdapterPlan.adapterContract?.schemaVersion === 'managed-persistence-adapter-contract/v2', 'Managed persistence adapter plan must expose the v2 database adapter contract.');
assert(response.body.persistenceAdapterPlan.adapterContract.methods.includes('compareShadowRead(projectId)'), 'Managed persistence adapter plan must require shadow-read comparison.');
assert(response.body.persistenceAdapterPlan.adapterContract.methods.includes('rollbackCutover(projectId)'), 'Managed persistence adapter plan must require rollback support.');
assert(response.body.persistenceAdapterPlan.shadowReadPlan.some((row) => row.tables.includes('evidence_source_snapshots') && row.tables.includes('evidence_provider_receipts') && row.ready), 'Managed persistence adapter plan must shadow-read source snapshot and provider receipt tables.');
assert(response.body.persistenceAdapterPlan.backupRestorePlan.length >= 3, 'Managed persistence adapter plan must include backup and restore cutover steps.');
assert(response.body.persistenceAdapterPlan.shadowReadPlan.some((row) => row.id === 'runtime-security-proof' && row.tables.includes('project_membership_policies') && row.tables.includes('identity_sessions') && row.ready), 'Managed persistence adapter shadow reads must cover project membership and identity-session rows.');
assert(response.body.persistenceAdapterPlan.shadowReadPlan.some((row) => row.id === 'runtime-security-proof' && row.tables.includes('provider_usage_ledger') && row.tables.includes('provider_eval_runs') && row.ready), 'Managed persistence adapter shadow reads must cover provider usage and eval rows.');
assert(response.body.persistenceAdapterPlan.adapterStatus?.schemaVersion === 'managed-persistence-adapter-status/v1', 'Managed persistence adapter plan must expose adapter driver status.');
assert(response.body.persistenceAdapterPlan.adapterStatus.driver === 'local-shadow', 'Default managed persistence adapter plan must use the local-shadow driver.');
assert(response.body.persistenceAdapterPlan.adapterStatus.productionCutoverReady === false, 'Default managed persistence adapter plan must not claim production database cutover readiness.');
assert(response.body.persistenceAdapterPlan.verificationGates.every((gate) => gate.passed), 'Managed persistence adapter plan gates must all pass for the acceptance project.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-adapter-dry-run`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-adapter-dry-run`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceAdapterDryRun?.schemaVersion === 'managed-persistence-adapter-dry-run/v1', 'Project API must expose a managed persistence adapter dry-run verifier.');
assert(response.body.persistenceAdapterDryRun.status === 'passed', 'Managed persistence adapter dry-run must pass for the acceptance project.');
assert(response.body.persistenceAdapterDryRun.gates.every((gate) => gate.passed), 'Managed persistence adapter dry-run gates must all pass for the acceptance project.');
assert(response.body.persistenceAdapterDryRun.gates.some((gate) => gate.id === 'adapter-driver-status' && gate.passed), 'Managed persistence adapter dry-run must prove adapter driver status.');
assert(response.body.persistenceAdapterDryRun.gates.some((gate) => gate.id === 'adapter-execution-receipt' && gate.passed), 'Managed persistence adapter dry-run must prove the adapter execution receipt.');
assert(response.body.persistenceAdapterDryRun.adapterExecution?.schemaVersion === 'managed-persistence-adapter-shadow-execution/v1', 'Managed persistence adapter dry-run must expose the shadow adapter execution record.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.adapterStatus?.driver === 'local-shadow', 'Managed persistence adapter dry-run must expose the local-shadow adapter driver.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.adapterStatus.productionCutoverReady === false, 'Managed persistence adapter dry-run must keep production cutover blocked until a real adapter runs.');
assert(response.body.persistenceAdapterDryRun.adapterExecution?.preRollbackReceipt?.schemaVersion === 'managed-persistence-adapter-execution-receipt/v1', 'Managed persistence adapter dry-run must expose a pre-rollback execution receipt.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.preRollbackReceipt.tableCounts.project_membership_policies > 0, 'Managed persistence adapter execution must import project membership policy rows before rollback.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.preRollbackReceipt.tableCounts.identity_sessions >= 2, 'Managed persistence adapter execution must import identity-session rows before rollback.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.preRollbackReceipt.tableCounts.security_audit_stream > 0, 'Managed persistence adapter execution must import security audit stream rows before rollback.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.finalReceipt?.schemaVersion === 'managed-persistence-adapter-execution-receipt/v1', 'Managed persistence adapter dry-run must expose a final rollback receipt.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.finalReceipt.tableCounts.project_membership_policies === 0, 'Managed persistence adapter dry-run must roll back imported table rows after verification.');
assert(response.body.persistenceAdapterDryRun.summary.adapterOperationCount >= 8, 'Managed persistence adapter dry-run summary must expose executed adapter operations.');
assert(response.body.persistenceAdapterDryRun.summary.adapterImportedTableCount >= 10, 'Managed persistence adapter dry-run summary must expose imported adapter table coverage.');
assert(response.body.persistenceAdapterDryRun.summary.adapterDriver === 'local-shadow', 'Managed persistence adapter dry-run summary must expose the active adapter driver.');
assert(response.body.persistenceAdapterDryRun.summary.adapterProductionCutoverReady === false, 'Managed persistence adapter dry-run summary must not claim production cutover readiness for local shadow runs.');
assert(response.body.persistenceAdapterDryRun.summary.shadowReadParityCount === response.body.persistenceAdapterDryRun.summary.shadowReadGroupCount, 'Managed persistence adapter dry-run must prove shadow-read parity.');
assert(response.body.persistenceAdapterDryRun.summary.transactionRollbackReady === true, 'Managed persistence adapter dry-run must prove rollback readiness.');
assert(response.body.persistenceAdapterDryRun.summary.backupRestoreReady === true, 'Managed persistence adapter dry-run must prove backup/restore readiness.');
assert(response.body.persistenceAdapterDryRun.readModelProbe.expectedReadModels.every((name) => response.body.persistenceAdapterDryRun.readModelProbe.checkpointNames.includes(name)), 'Managed persistence adapter dry-run must prove read-model checkpoint parity.');

progress('membership operations readiness checks');
response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/operations-readiness`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/operations-readiness`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.operationsReadiness?.schemaVersion === 'operations-readiness/v1', 'Project API must expose an operations readiness contract.');
assert(response.body.operationsReadiness.status === 'local-operations-contract-ready', 'Operations readiness must pass once worker proof, audit stream, persistence, and dry-run evidence exist.');
assert(response.body.operationsReadiness.gates.every((gate) => gate.passed), 'Operations readiness gates must all pass for the acceptance project.');
assert(response.body.operationsReadiness.gates.some((gate) => gate.id === 'worker-failure-recovery-contract' && gate.passed), 'Operations readiness must include a passing worker failure recovery gate.');
assert(response.body.operationsReadiness.gates.some((gate) => gate.id === 'queue-adapter-dry-run' && gate.passed), 'Operations readiness must include a passing queue adapter dry-run gate.');
assert(response.body.operationsReadiness.gates.some((gate) => gate.id === 'managed-persistence-adapter-cutover' && gate.passed), 'Operations readiness must include a passing managed persistence adapter cutover gate.');
assert(response.body.operationsReadiness.gates.some((gate) => gate.id === 'incident-drill-rehearsal' && gate.passed), 'Operations readiness must include a passing incident drill rehearsal gate.');
assert(response.body.operationsReadiness.incidentDrill?.schemaVersion === 'operations-incident-drill/v1', 'Operations readiness must expose a structured incident drill receipt.');
assert(response.body.operationsReadiness.incidentDrill?.drillReady === true, 'Operations incident drill must pass for the acceptance project.');
assert(response.body.operationsReadiness.incidentDrill?.summary?.failedReceiptCount === 0, 'Operations incident drill must have no failed local rehearsal receipts.');
assert(response.body.operationsReadiness.incidentDrill?.summary?.routedAlertRuleCount === response.body.operationsReadiness.incidentDrill?.summary?.alertRuleCount, 'Operations incident drill must route every alert rule to a backend proof surface.');
assert(response.body.operationsReadiness.incidentDrill?.receipts?.some((receipt) => receipt.id === 'verify-queue-recovery' && receipt.passed && receipt.receiptChecksum), 'Operations incident drill must prove queue recovery readiness with a checksummed receipt.');
assert(response.body.operationsReadiness.incidentDrill?.receipts?.some((receipt) => receipt.id === 'verify-persistence-recovery' && receipt.passed && receipt.receiptChecksum), 'Operations incident drill must prove persistence recovery readiness with a checksummed receipt.');
assert(response.body.operationsReadiness.summary?.incidentDrillReady === true, 'Operations readiness summary must expose incident drill readiness.');
assert(response.body.operationsReadiness.observability?.metrics?.incidentDrillReady === true, 'Operations readiness observability metrics must expose incident drill readiness.');
assert(response.body.operationsReadiness.observability.metrics.securityAuditStreamCount >= 11, 'Operations readiness must surface security audit stream metrics.');
assert(response.body.operationsReadiness.observability.metrics.securityAuditStreamHashChainReady === true, 'Operations readiness must surface verified audit hash-chain status.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterDryRunStatus === 'passed', 'Operations readiness must surface managed persistence adapter dry-run status.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterShadowReadParityCount === response.body.operationsReadiness.observability.metrics.persistenceAdapterShadowReadGroupCount, 'Operations readiness must surface managed persistence adapter shadow-read parity metrics.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterRollbackReady === true, 'Operations readiness must surface managed persistence adapter rollback readiness.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterBackupRestoreReady === true, 'Operations readiness must surface managed persistence adapter backup/restore readiness.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterOperationCount >= 8, 'Operations readiness must surface managed persistence adapter execution operation metrics.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterImportedTableCount >= 10, 'Operations readiness must surface managed persistence adapter imported table metrics.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterDriver === 'local-shadow', 'Operations readiness must surface managed persistence adapter driver status.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterProductionCutoverReady === false, 'Operations readiness must keep production database cutover blocked for local shadow runs.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterDryRunStatus === 'passed', 'Operations readiness must surface queue adapter dry-run status.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterDispatchCount >= team.length, 'Operations readiness must surface queue adapter dispatch metrics.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterLeaseAcquisitionCount >= team.length, 'Operations readiness must surface queue adapter lease metrics.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterOperationCount >= team.length + 4, 'Operations readiness must surface worker queue adapter execution operation metrics.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterQueueRowCount >= team.length, 'Operations readiness must surface worker queue adapter row import metrics.');
assert(typeof response.body.operationsReadiness.observability.metrics.queueAdapterAutopilotQueueRowCount === 'number' && typeof response.body.operationsReadiness.observability.metrics.queueAdapterAutopilotDispatchCount === 'number', 'Operations readiness must surface Autopilot-session queue adapter row and dispatch metrics.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterDriver === 'local-shadow', 'Operations readiness must surface worker queue adapter driver status.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterProductionCutoverReady === false, 'Operations readiness must keep production queue cutover blocked for local shadow runs.');
assert(response.body.operationsReadiness.observability.metrics.workerRecoveryContractReady === true, 'Operations readiness must surface worker recovery contract readiness.');
assert(response.body.operationsReadiness.observability.metrics.workerExecutionReceiptCount >= 1, 'Operations readiness must surface worker execution receipt metrics.');
assert(typeof response.body.operationsReadiness.observability.metrics.autopilotResumeReady === 'boolean' && typeof response.body.operationsReadiness.observability.metrics.autopilotExecutionReceiptCount === 'number', 'Operations readiness must surface Autopilot resume readiness and execution receipt metrics.');
assert(response.body.operationsReadiness.gates.some((gate) => gate.id === 'provider-audit-recovery-contract' && gate.passed), 'Operations readiness must gate provider usage/eval/source audit recovery.');
assert(response.body.operationsReadiness.observability.metrics.providerAuditRecoveryReady === true, 'Operations readiness must surface provider audit recovery readiness.');
assert(response.body.operationsReadiness.observability.metrics.providerUsageRecoveryReady === true && response.body.operationsReadiness.observability.metrics.providerUsagePersistenceCount >= response.body.operationsReadiness.observability.metrics.providerUsageCount, 'Operations readiness must surface provider usage ledger persistence recovery metrics.');
assert(response.body.operationsReadiness.observability.metrics.providerEvalRecoveryReady === true && response.body.operationsReadiness.observability.metrics.providerEvalPersistenceCount >= response.body.operationsReadiness.observability.metrics.providerEvalRunCount, 'Operations readiness must surface provider eval replay persistence recovery metrics.');
assert(response.body.operationsReadiness.observability.metrics.providerSourceAuditRecoveryReady === true && response.body.operationsReadiness.observability.metrics.providerReceiptChecksumCount >= 1 && response.body.operationsReadiness.observability.metrics.sourceSnapshotChecksumCount >= 1, 'Operations readiness must surface provider receipt and source snapshot recovery metrics.');
assert(response.body.operationsReadiness.observability.metrics.providerSecretBoundaryReady === true, 'Operations readiness must surface provider secret boundary recovery readiness.');
assert(response.body.operationsReadiness.observability.metrics.workerDeadLetterCount === 0, 'Operations readiness must surface worker dead-letter metrics.');
assert(response.body.operationsReadiness.observability.metrics.persistenceRecordCount > 0, 'Operations readiness must surface persistence recovery metrics.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'audit-stream-hash-chain-break'), 'Operations readiness must include an audit hash-chain alert rule.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'migration-dry-run-failed'), 'Operations readiness must include a migration dry-run alert rule.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'persistence-adapter-dry-run-failed'), 'Operations readiness must include a managed persistence adapter dry-run alert rule.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'queue-adapter-dry-run-failed'), 'Operations readiness must include a queue adapter dry-run alert rule.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'worker-dead-letter-nonempty'), 'Operations readiness must include a worker dead-letter alert rule.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'provider-ledger-proof-regression' && rule.route?.endsWith('/provider-readiness')), 'Operations readiness must include a provider ledger recovery alert rule.');
assert(response.body.operationsReadiness.recovery.steps.some((step) => step.id === 'verify-import' && step.evidenceRoute?.endsWith('/persistence-migration-dry-run')), 'Operations readiness must include a recovery step for migration import verification.');
assert(response.body.operationsReadiness.recovery.steps.some((step) => step.id === 'verify-database-adapter' && step.evidenceRoute?.endsWith('/persistence-adapter-dry-run')), 'Operations readiness must include a recovery step for managed persistence adapter verification.');
assert(response.body.operationsReadiness.recovery.steps.some((step) => step.id === 'verify-provider-ledger' && step.evidenceRoute?.endsWith('/provider-readiness')), 'Operations readiness must include a recovery step for provider ledger verification.');
assert(response.body.operationsReadiness.recovery.steps.some((step) => step.id === 'verify-queue-adapter' && step.evidenceRoute?.endsWith('/worker-queue-adapter-dry-run')), 'Operations readiness must include a recovery step for queue adapter verification.');
assert(response.body.operationsReadiness.incidentDrill.receipts.some((receipt) => receipt.id === 'verify-provider-audit-recovery' && receipt.passed && receipt.observed?.providerAuditRecoveryReady === true), 'Operations readiness incident drill must verify provider audit recovery.');
assert(response.body.operationsReadiness.backendRoutes.operationsReadiness?.endsWith('/operations-readiness'), 'Operations readiness must expose its own backend route.');
assert(response.body.operationsReadiness.backendRoutes.persistenceAdapterDryRun?.endsWith('/persistence-adapter-dry-run'), 'Operations readiness must expose the managed persistence adapter dry-run route.');
assert(response.body.operationsReadiness.backendRoutes.workerQueueAdapterDryRun?.endsWith('/worker-queue-adapter-dry-run'), 'Operations readiness must expose the queue adapter dry-run route.');
assert(response.body.operationsReadiness.backendRoutes.providerReadiness?.endsWith('/provider-readiness') && response.body.operationsReadiness.backendRoutes.providerEvalRuns?.endsWith('/provider-eval-runs'), 'Operations readiness must expose provider recovery routes.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/pilot-launch-readiness`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/pilot-launch-readiness`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.pilotLaunchReadiness?.schemaVersion === 'pilot-launch-readiness/v1', 'Project API must expose a standalone pilot launch readiness contract.');
assert(response.body.pilotLaunchReadiness.privatePilotDecision === 'go', 'Pilot launch readiness must approve the completed acceptance project for private pilot.');
assert(response.body.pilotLaunchReadiness.productionDecision === 'no-go', 'Pilot launch readiness must keep production launch blocked.');
assert(response.body.pilotLaunchReadiness.summary?.failedGateCount === 0, 'Pilot launch readiness must have no failed private-pilot gates after full acceptance.');
assert(response.body.pilotLaunchReadiness.summary?.readyEvidenceRouteCount === response.body.pilotLaunchReadiness.summary?.evidenceRouteCount, 'Pilot launch readiness must have every evidence route ready.');
assert(response.body.pilotLaunchReadiness.productionBlockers?.some((row) => row.id === 'production-managed-persistence'), 'Pilot launch readiness must retain managed persistence as a production blocker.');
assert(response.body.pilotLaunchReadiness.productionBlockers?.some((row) => row.id === 'production-real-providers'), 'Pilot launch readiness must retain real providers as a production blocker.');
assert(response.body.pilotLaunchReadiness.productionBlockers?.some((row) => row.id === 'calibrated-artifact-quality-rubric'), 'Pilot launch readiness must retain calibrated artifact quality as a production blocker.');
assert(response.body.pilotLaunchReadiness.gates.some((gate) => gate.id === 'production-overclaim-blocked' && gate.passed), 'Pilot launch readiness must prove production overclaim is blocked.');
assert(response.body.pilotLaunchReadiness.evidenceRoutes.some((route) => route.id === 'artifact-quality-audit' && route.ready), 'Pilot launch readiness must link artifact quality audit as a ready evidence route.');
assert(response.body.pilotLaunchReadiness.evidenceRoutes.some((route) => route.id === 'operations-readiness' && route.ready), 'Pilot launch readiness must link operations readiness as a ready evidence route.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/deployment-preflight`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/deployment-preflight`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.deploymentPreflight?.schemaVersion === 'deployment-preflight/v1', 'Project API must expose a standalone deployment preflight contract.');
assert(response.body.deploymentPreflight.privatePilotDeploymentReady === true, 'Deployment preflight must pass blocker gates for the completed acceptance project.');
assert(response.body.deploymentPreflight.productionDeploymentReady === false, 'Deployment preflight must keep production deployment blocked.');
assert(response.body.deploymentPreflight.gates.some((gate) => gate.id === 'secret-vault-ready' && gate.passed), 'Deployment preflight must verify local secret vault readiness.');
assert(response.body.deploymentPreflight.gates.some((gate) => gate.id === 'managed-persistence-preflight' && gate.passed), 'Deployment preflight must verify managed persistence dry-run readiness.');
assert(response.body.deploymentPreflight.gates.some((gate) => gate.id === 'worker-queue-preflight' && gate.passed), 'Deployment preflight must verify worker queue dry-run readiness.');
assert(response.body.deploymentPreflight.gates.some((gate) => gate.id === 'adapter-gateway-preflight' && gate.passed), 'Deployment preflight must verify adapter gateway preflight readiness.');
assert(response.body.deploymentPreflight.productionControls.some((control) => control.id === 'scheduler-autostart' && control.ready === false), 'Deployment preflight must keep scheduler autostart as an explicit deployment control when env is not enabled.');
assert(response.body.deploymentPreflight.backendRoutes.deploymentPreflight?.endsWith('/deployment-preflight'), 'Deployment preflight must expose its own backend route.');
assert(response.body.deploymentPreflight.backendRoutes.adapterGatewayPreflight?.endsWith('/adapter-gateway-preflight'), 'Deployment preflight must expose the adapter gateway preflight backend route.');
const deploymentPreflightChecksum = response.body.deploymentPreflight.checksum;

const adapterGatewayPreflightPath = `/projects/${projectId}/adapter-gateway-preflight`;
response = membershipApi.handle({
  method: 'GET',
  path: adapterGatewayPreflightPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: adapterGatewayPreflightPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.adapterGatewayPreflight?.schemaVersion === 'adapter-gateway-preflight/v1', 'Project API must expose a standalone adapter gateway preflight contract.');
assert(response.body.adapterGatewayPreflight.privateGatewayReady === true, 'Standalone adapter gateway preflight must pass the local-shadow private rehearsal path.');
assert(response.body.adapterGatewayPreflight.productionCutoverReady === false, 'Standalone adapter gateway preflight must keep production cutover blocked.');
assert(response.body.adapterGatewayPreflight.backendRoutes.adapterGatewayPreflight?.endsWith('/adapter-gateway-preflight'), 'Standalone adapter gateway preflight must expose its own backend route.');

const productionInfrastructureRehearsalPath = `/projects/${projectId}/production-infrastructure-rehearsal`;
response = membershipApi.handle({
  method: 'GET',
  path: productionInfrastructureRehearsalPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionInfrastructureRehearsalPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionInfrastructureRehearsal?.schemaVersion === 'production-infrastructure-rehearsal/v1', 'Project API must expose a standalone production infrastructure rehearsal contract.');
assert(response.body.productionInfrastructureRehearsal.readyForInfrastructureRehearsal === true && response.body.productionInfrastructureRehearsal.readyForProduction === false, 'Standalone production infrastructure rehearsal must pass rehearsal and keep production blocked.');
assert(response.body.productionInfrastructureRehearsal.domainRows?.some((row) => row.id === 'managed-persistence' && row.route?.endsWith('/persistence-adapter-dry-run')), 'Standalone production infrastructure rehearsal must route managed persistence proof.');
assert(response.body.productionInfrastructureRehearsal.managedCutoverSummary?.productionCutoverReady === false && response.body.productionInfrastructureRehearsal.managedCutoverGates?.some((gate) => gate.id === 'managed-persistence-cutover' && gate.evidenceTier === 'rehearsal-ready-production-blocked'), 'Standalone production infrastructure rehearsal must expose managed cutover gates without overclaiming production readiness.');

progress('membership launch approval and launch audit checks');
const launchApprovalPath = `/projects/${projectId}/launch-approvals`;
progress('private-pilot launch approval record ready');
response = membershipApi.handle({
  method: 'POST',
  path: launchApprovalPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: launchApprovalPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    mode: 'private-pilot',
    decision: 'approved',
    approverRole: 'manager',
    approverId: 'director',
    approverName: 'Product Director',
    reason: 'Manager approves the private pilot after complete product-team acceptance proof.',
    linkedAuditChecksum: deploymentPreflightChecksum,
    now: '2026-06-01T12:10:00.000Z',
  },
});
assert(response.status === 200 && response.body.launchApproval?.schemaVersion === 'launch-approval/v1', 'Project API must persist a manager launch approval record.');
assert(response.body.launchApproval.approverRole === 'manager' && response.body.launchApproval.decision === 'approved', 'Manager launch approval must preserve role and decision.');
assert(response.body.launchApprovalWorkflow?.readyForPrivatePilot === false, 'Private-pilot launch approval must still require security approval after manager approval.');
assert(response.body.project.eventLedger.some((event) => event.type === 'launch-approval' && event.entityIds?.launchApprovalId === response.body.launchApproval.id), 'Launch approval must enter the project event ledger.');

response = membershipApi.handle({
  method: 'POST',
  path: launchApprovalPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: launchApprovalPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    mode: 'private-pilot',
    decision: 'approved',
    approverRole: 'security-admin',
    approverId: 'security-lead',
    approverName: 'Security Lead',
    reason: 'Security approves the private pilot with production controls still blocked.',
    linkedAuditChecksum: deploymentPreflightChecksum,
    now: '2026-06-01T12:12:00.000Z',
  },
});
assert(response.status === 200 && response.body.launchApproval?.schemaVersion === 'launch-approval/v1', 'Project API must persist a security launch approval record.');
assert(response.body.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1', 'Launch approval POST must return the workflow snapshot.');
assert(response.body.launchApprovalWorkflow.readyForPrivatePilot === true, 'Launch approval workflow must mark private pilot ready after manager and security approvals.');
assert(response.body.launchApprovalWorkflow.readyForProduction === false, 'Launch approval workflow must keep production blocked without operations-owner approval.');
assert(response.body.launchApprovalWorkflow.checksum && response.body.launchApprovalWorkflow.proofIds?.length >= 4 && response.body.launchApprovalWorkflow.timelineLogIds?.length >= 2 && response.body.launchApprovalWorkflow.eventIds?.length >= 2, 'Launch approval workflow must aggregate private-pilot approval checksum, proof, timeline, and event ids.');
assert(response.body.managerReadyPackage?.launchApprovalWorkflow?.readyForPrivatePilot === true, 'Manager Ready Package must embed the updated launch approval workflow.');
assert(response.body.managerReadyPackage?.launchApprovalWorkflow?.checksum === response.body.launchApprovalWorkflow.checksum, 'Manager Ready Package must embed the same launch approval workflow checksum returned by the write path.');
assert(response.body.managerReadyPackage?.productionLaunchAudit?.privatePilotDecision === 'go', `Manager Ready Package launch audit must move to private-pilot go after approvals. failedPrivatePilotGates=${JSON.stringify(response.body.managerReadyPackage?.productionLaunchAudit?.failedPrivatePilotGates || [])}`);
assert(response.body.managerReadyPackage?.productionLaunchAudit?.productionDecision === 'no-go', 'Manager Ready Package launch audit must keep production no-go after private-pilot approval.');

response = membershipApi.handle({
  method: 'GET',
  path: launchApprovalPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: launchApprovalPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.launchApprovalWorkflow?.rows?.length >= 2, 'Project API must read back persisted launch approvals.');
assert(response.body.launchApprovalWorkflow.modes.some((mode) => mode.id === 'private-pilot' && mode.ready && mode.approvedRoles.includes('manager') && mode.approvedRoles.includes('security-admin')), 'Launch approval workflow must summarize private-pilot role approvals.');
assert(response.body.launchApprovalWorkflow.modes.some((mode) => mode.id === 'production' && !mode.ready && mode.missingRoles.includes('operations-owner')), 'Launch approval workflow must summarize missing production approver roles.');
assert(response.body.launchApprovalWorkflow.checksum && response.body.launchApprovalWorkflow.summary?.proofIdCount >= 4 && response.body.launchApprovalWorkflow.summary?.eventIdCount >= 2, 'Launch approval workflow read model must preserve aggregate proof counts.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes.filter((node) => node.source === 'launchApprovals' && node.subtype === 'launch-approval').length >= 2, 'Manager Flow Graph must include launch approval decision nodes.');
assert(response.body.edges.some((edge) => edge.source === 'launchApprovals' && edge.label === 'Release governance' && edge.eventIds?.length), 'Manager Flow Graph must connect launch approvals to release-governance evidence.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.launchApprovalSummary?.count >= 2, 'Readiness Proof Map must summarize launch approval proof.');
assert(response.body.launchApprovalRoutes?.every((route) => route.apiPath?.endsWith('/launch-approvals') && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map launch approval routes must include API, checksum, timeline, and event proof.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-snapshot`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-snapshot`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceSnapshot?.recordsByTable?.launch_approvals?.length >= 2, 'Production persistence snapshot must include launch approval rows after approval.');
assert(response.body.persistenceSnapshot.recordsByTable.launch_approvals.every((record) => record.data.schemaVersion === 'launch-approval/v1' && record.data.checksum), 'Launch approval persistence rows must preserve schema version and checksum.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/production-launch-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/production-launch-audit`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionLaunchAudit?.schemaVersion === 'production-launch-audit/v1', 'Project API must expose a standalone production launch audit contract.');
assert(response.body.productionLaunchAudit.privatePilotDecision === 'go', 'Production launch audit must approve the completed acceptance project for private pilot.');
assert(response.body.productionLaunchAudit.productionDecision === 'no-go', 'Production launch audit must keep public production blocked.');
assert(response.body.productionLaunchAudit.summary?.failedPrivatePilotGateCount === 0, 'Standalone production launch audit must have no failed private-pilot gates after full acceptance.');
assert(response.body.productionLaunchAudit.summary?.failedProductionGateCount > 0, 'Standalone production launch audit must keep production gates failed.');
assert(response.body.productionLaunchAudit.evidenceRoutes.some((route) => route.id === 'production-launch-audit' && route.ready), 'Standalone production launch audit must include its own evidence route.');
assert(response.body.productionLaunchAudit.evidenceRoutes.some((route) => route.id === 'artifact-quality-audit' && route.ready), 'Standalone production launch audit must include a ready artifact quality audit route.');
assert(response.body.productionLaunchAudit.evidenceRoutes.some((route) => route.id === 'evidence-quality-audit' && route.ready), 'Standalone production launch audit must include a ready evidence quality audit route.');
assert(response.body.productionLaunchAudit.evidenceRoutes.some((route) => route.id === 'evidence-source-review-workflow' && route.ready), 'Standalone production launch audit must include a ready evidence source review workflow route.');
assert(response.body.productionLaunchAudit.evidenceRoutes.some((route) => route.id === 'evidence-custody-readiness' && route.ready), 'Standalone production launch audit must include a ready evidence custody route.');
assert(response.body.productionLaunchAudit.backendRoutes.productionLaunchAudit?.endsWith('/production-launch-audit'), 'Production launch audit must expose its own backend route.');
assert(response.body.productionLaunchAudit.projectEvidenceHandoff?.readyForPrivatePilotPackage === false, 'Production launch audit must show evidence handoff package as pending before download audit.');
assert(response.body.productionLaunchAudit.nextShortestPath?.scope === 'private-pilot-handoff', 'Production launch audit must point to evidence handoff before local package audit is recorded.');

progress('membership project evidence archive and export checks');
response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/project-evidence-archive`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/project-evidence-archive`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.projectEvidenceArchive?.schemaVersion === 'project-evidence-archive/v1', 'Project API must expose a standalone project evidence archive contract.');
assert(response.body.projectEvidenceArchive.status === 'archive-ready', `Project evidence archive must be ready after the full acceptance scenario. failed=${JSON.stringify(response.body.projectEvidenceArchive.integrity?.failedGates || [])}`);
assert(response.body.projectEvidenceArchive.readyForManagerHandoff === true, 'Project evidence archive must be ready for manager/customer handoff.');
assert(response.body.projectEvidenceArchive.readyForProduction === false, 'Project evidence archive must not claim production readiness.');
assert(response.body.projectEvidenceArchive.summary?.finalDeliverableCount >= 1, 'Project evidence archive must include the final deliverable.');
assert(response.body.projectEvidenceArchive.summary?.artifactQualityReady === true && response.body.projectEvidenceArchive.summary?.artifactQualityAverageScore >= 75, 'Project evidence archive must include artifact quality readiness.');
assert(response.body.projectEvidenceArchive.summary?.evidenceSearchCount >= 1, 'Project evidence archive must include evidence searches.');
const standaloneArchiveSummary = response.body.projectEvidenceArchive.summary || {};
const archiveSubmissionCount = standaloneArchiveSummary.submissionCount || response.body.projectEvidenceArchive.contents?.submissions?.length || 0;
assert(archiveSubmissionCount >= expectedSubmissionCount, 'Project evidence archive must include at least the explicit acceptance submissions plus generated drafts.');
assert(standaloneArchiveSummary.evidenceSourceSnapshotCount >= 3, 'Project evidence archive must include source snapshots.');
assert(standaloneArchiveSummary.evidenceProviderReceiptCount >= 1, 'Project evidence archive must include provider receipts.');
assert(standaloneArchiveSummary.evidenceSourceReviewDecisionCount >= 3, 'Project evidence archive must include evidence source review decisions.');
assert(
  standaloneArchiveSummary.evidenceCustodyReady === true
    && standaloneArchiveSummary.evidenceCustodyRecordCount === (
      (standaloneArchiveSummary.evidenceSourceSnapshotCount || 0)
      + (standaloneArchiveSummary.evidenceProviderReceiptCount || 0)
    ),
  'Project evidence archive must include evidence custody readiness and custody record count.',
);
assert(response.body.projectEvidenceArchive.summary?.submissionReviewCount >= 2, 'Project evidence archive must include submission reviews.');
assert(response.body.projectEvidenceArchive.summary?.transcriptMessageCount > 0, 'Project evidence archive must include transcript messages.');
assert(response.body.projectEvidenceArchive.summary?.transcriptProofCoverageReady === true && response.body.projectEvidenceArchive.summary?.transcriptMissingProofIdCount === 0, 'Project evidence archive must report complete backend transcript proof coverage.');
assert(response.body.projectEvidenceArchive.summary?.flowGraphProofedNodeCount > 0, 'Project evidence archive must include proofed Flow Graph nodes.');
assert(response.body.projectEvidenceArchive.summary?.rawLeakCount === 0, 'Project evidence archive must report zero raw secret leaks.');
assert(response.body.projectEvidenceArchive.manifest.every((entry) => entry.checksum), 'Every project evidence archive manifest entry must carry a checksum.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'final-deliverables' && entry.ready), 'Project evidence archive manifest must include ready final-deliverable evidence.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'artifact-storage-proofs' && entry.ready && entry.count === archiveSubmissionCount), 'Project evidence archive manifest must include ready checksummed artifact storage proof coverage.');
const archiveArtifactProofManifest = response.body.projectEvidenceArchive.manifest.find((entry) => entry.id === 'artifact-storage-proofs');
assert(archiveArtifactProofManifest.storageProofCount === archiveSubmissionCount && archiveArtifactProofManifest.workspaceFileProofCount === archiveSubmissionCount, 'Project evidence archive artifact proof manifest must count storage and workspace proof coverage for every submission.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'artifact-quality-audit' && entry.ready), 'Project evidence archive manifest must include ready artifact quality audit evidence.');
const archiveTranscriptManifest = response.body.projectEvidenceArchive.manifest.find((entry) => entry.id === 'group-chat-transcripts');
assert(archiveTranscriptManifest?.ready && archiveTranscriptManifest.transcriptProofIdCount >= archiveSubmissionCount && archiveTranscriptManifest.archivedTranscriptProofIdCount === archiveTranscriptManifest.transcriptProofIdCount && archiveTranscriptManifest.missingTranscriptProofIdCount === 0, 'Project evidence archive manifest must include ready backend transcript proof coverage.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'evidence-source-snapshots' && entry.ready), 'Project evidence archive manifest must include ready source snapshot evidence.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'evidence-provider-receipts' && entry.ready), 'Project evidence archive manifest must include ready provider receipt evidence.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'evidence-source-review-workflow' && entry.ready), 'Project evidence archive manifest must include ready evidence source review workflow evidence.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'evidence-source-review-decisions' && entry.ready), 'Project evidence archive manifest must include evidence source review decision records.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'evidence-custody-readiness' && entry.ready), 'Project evidence archive manifest must include evidence custody readiness.');
assert(response.body.projectEvidenceArchive.integrity.gates.every((gate) => gate.passed), 'Project evidence archive integrity gates must all pass for the acceptance scenario.');
assert(response.body.projectEvidenceArchive.backendRoutes.projectEvidenceArchive?.endsWith('/project-evidence-archive'), 'Project evidence archive must expose its own backend route.');
assert(response.body.projectEvidenceArchive.contents.artifactQualityAudit?.schemaVersion === 'artifact-quality-audit/v1' && response.body.projectEvidenceArchive.contents.artifactQualityAudit.readyForLocalPilot === true, 'Project evidence archive must preserve artifact quality audit contents.');
assert(response.body.projectEvidenceArchive.contents.finalDeliverables.some((submission) => submission.id === finalSubmissionId && submission.bodyChecksum), 'Project evidence archive must include the final deliverable body checksum.');
assert(response.body.projectEvidenceArchive.contents.submissions.some((submission) => submission.id === generatedDraftSubmission.id && submission.isGeneratedDraft === true && submission.artifactDraft?.source === 'local-artifact-draft-generator' && submission.artifactDraftChecksum), 'Project evidence archive must preserve generated artifact draft provenance.');
assert(response.body.projectEvidenceArchive.contents.submissions.some((submission) => submission.id === modelGeneratedDraftSubmission.id && submission.isGeneratedDraft === true && submission.artifactDraft?.source === 'model-artifact-draft' && submission.artifactDraftModelUsed === true && submission.artifactDraftChecksum), 'Project evidence archive must preserve model-backed generated artifact draft provenance.');
assert(response.body.projectEvidenceArchive.contents.submissions.some((submission) => submission.id === modelGeneratedDraftSubmission.id && submission.artifactDraftQuality?.readyForLocalPilot === true && submission.artifactDraftHumanReviewRequired === true), 'Project evidence archive must preserve model-backed draft quality and human-review metadata.');
assert(response.body.projectEvidenceArchive.contents.artifacts.length === archiveSubmissionCount && response.body.projectEvidenceArchive.contents.artifacts.every((artifact) => artifact.storageProof?.schemaVersion === 'agent-artifact-storage-proof/v1' && artifact.storageProofChecksum && artifact.contentChecksum), 'Project evidence archive must include checksummed artifact storage proofs for every submitted artifact.');
assert(response.body.projectEvidenceArchive.summary?.artifactStorageProofCoverageReady === true && response.body.projectEvidenceArchive.summary?.artifactStorageProofCount === archiveSubmissionCount && response.body.projectEvidenceArchive.summary?.workspaceFileProofCount === archiveSubmissionCount && response.body.projectEvidenceArchive.integrity.gates.some((gate) => gate.id === 'artifact-storage-proof-coverage' && gate.passed), 'Project evidence archive must gate complete artifact storage and workspace proof coverage.');
assert(response.body.projectEvidenceArchive.contents.transcripts.channels.some((channel) => channel.messages.some((message) => message.type === 'submission')), 'Project evidence archive must include submission messages in transcripts.');
assert(response.body.projectEvidenceArchive.contents.transcripts.proofCoverage?.ready === true && response.body.projectEvidenceArchive.contents.transcripts.proofCoverage?.counts?.submission === archiveSubmissionCount && response.body.projectEvidenceArchive.contents.transcripts.proofCoverage?.counts?.evidenceSearch >= 1 && response.body.projectEvidenceArchive.contents.transcripts.proofCoverage?.counts?.evidenceSourceReview >= 3 && response.body.projectEvidenceArchive.contents.transcripts.proofCoverage?.counts?.submissionReview >= 2 && response.body.projectEvidenceArchive.contents.transcripts.proofCoverage?.missingProofIds?.length === 0, 'Project evidence archive transcript proof coverage must include submission, evidence, source-review, and submission-review chat proof ids.');
assert(response.body.projectEvidenceArchive.contents.evidenceSearches.some((record) => record.sources?.length >= 1 && record.checksum), 'Project evidence archive must include evidence source packets with checksums.');
assert(response.body.projectEvidenceArchive.contents.evidenceSourceSnapshots?.length === standaloneArchiveSummary.evidenceSourceSnapshotCount && response.body.projectEvidenceArchive.contents.evidenceSourceSnapshots.every((snapshot) => snapshot.sourceChecksum && snapshot.summaryChecksum && snapshot.checksum), 'Project evidence archive must include checksummed source snapshots.');
assert(response.body.projectEvidenceArchive.contents.evidenceProviderReceipts?.length === standaloneArchiveSummary.evidenceProviderReceiptCount && response.body.projectEvidenceArchive.contents.evidenceProviderReceipts.every((receipt) => receipt.requestChecksum && receipt.resultChecksum && receipt.checksum), 'Project evidence archive must include checksummed provider receipts.');
assert(response.body.projectEvidenceArchive.contents.evidenceSourceReviewWorkflow.reviewItems.some((item) => item.evidenceSearchId === evidenceSearch.id && item.checksum), 'Project evidence archive must include evidence source review items with checksums.');
assert(response.body.projectEvidenceArchive.contents.evidenceCustodyReadiness?.schemaVersion === 'evidence-custody-readiness/v1' && response.body.projectEvidenceArchive.contents.evidenceCustodyReadiness?.custodyRows?.length === standaloneArchiveSummary.evidenceCustodyRecordCount, 'Project evidence archive must include evidence custody readiness rows.');
assert(response.body.projectEvidenceArchive.contents.evidenceSourceReviews?.length >= 3 && response.body.projectEvidenceArchive.contents.evidenceSourceReviews.every((review) => review.decision === 'approved' && review.commentsChecksum && review.checksum), 'Project evidence archive must include source review decision records with checksums.');
assert(response.body.projectEvidenceArchive.contents.submissionReviews.some((review) => review.verdict === 'accepted' && review.commentsChecksum), 'Project evidence archive must include accepted review evidence with checksums.');
assert(response.body.projectEvidenceArchive.contents.managerFlowGraph.nodes.some((node) => node.category === 'submission' && node.subtype === 'final-deliverable'), 'Project evidence archive must include final-deliverable Flow Graph nodes.');
for (const type of ['discovery-report', 'decision-proposal', 'implementation-plan']) {
  assert(response.body.projectEvidenceArchive.contents.submissions.some((submission) => submission.artifactType === type && submission.bodyChecksum), `Project evidence archive must include ${type} submission checksums.`);
  assert(response.body.projectEvidenceArchive.contents.managerFlowGraph.nodes.some((node) => node.category === 'submission' && node.subtype === type), `Project evidence archive must include ${type} Flow Graph nodes.`);
}
for (const secret of [FAKE_SEARCH_SECRET, FAKE_MODEL_SECRET, FAKE_SOURCE_SECRET, ACCESS_SIGNING_SECRET, managerIdentitySessionToken, activeSecurityIdentitySessionToken]) {
  assert(!JSON.stringify(response.body.projectEvidenceArchive).includes(secret), `Project evidence archive must not expose secret fixture value ${secret}.`);
}

const projectEvidenceArchiveChecksum = response.body.projectEvidenceArchive.checksum;
const projectEvidenceExportPath = `/projects/${projectId}/project-evidence-exports`;
response = membershipApi.handle({
  method: 'GET',
  path: projectEvidenceExportPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: projectEvidenceExportPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.projectEvidenceExportWorkflow?.schemaVersion === 'project-evidence-export-workflow/v1', 'Project API must expose the project evidence export workflow contract.');
assert(response.body.projectEvidenceExportWorkflow.readyForProductionExport === false, 'Project evidence export workflow must not claim production export readiness before real controls exist.');

response = membershipApi.handle({
  method: 'POST',
  path: projectEvidenceExportPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: projectEvidenceExportPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    action: 'request',
    mode: 'private-pilot',
    actorRole: 'manager',
    actorId: 'director',
    reason: 'Request customer handoff evidence package for private-pilot acceptance.',
    retentionDays: 30,
    dataResidencyRegion: 'local-private-pilot',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.projectEvidenceExport?.schemaVersion === 'project-evidence-export/v1', 'Manager must be able to request a governed project evidence export.');
const exportRequestId = response.body.projectEvidenceExport.exportRequestId;
const requestedExportArchiveChecksum = response.body.projectEvidenceArchive?.checksum || response.body.projectEvidenceExport.archiveChecksum;
assert(response.body.projectEvidenceExport.archiveChecksum && response.body.projectEvidenceExport.archiveChecksum === requestedExportArchiveChecksum, 'Project evidence export request must pin the archive checksum generated for that request.');
assert(response.body.projectEvidenceExportWorkflow.summary?.requestCount >= 1, 'Project evidence export workflow must count export requests.');
assert(response.body.readModels?.included === false && response.body.readModels.projectEvidenceExportWorkflowRoute?.endsWith('/project-evidence-exports') && response.body.readModels.managerReadyPackageRoute?.endsWith('/manager-ready-package'), 'Project evidence export request must support lightweight read-model refresh routes.');

for (const approval of [
  { role: 'manager', userId: 'director', reason: 'Manager approves the private-pilot handoff bundle.' },
  { role: 'security-admin', userId: 'security-lead', reason: 'Security approves the redacted private-pilot handoff bundle.' },
]) {
  response = membershipApi.handle({
    method: 'POST',
    path: projectEvidenceExportPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: projectEvidenceExportPath,
      role: approval.role,
      userId: approval.userId,
    }),
    body: {
      action: 'approve',
      mode: 'private-pilot',
      exportRequestId,
      actorRole: approval.role,
      actorId: approval.userId,
      reason: approval.reason,
      includeReadModels: false,
    },
  });
  assert(response.status === 200 && response.body.projectEvidenceExport?.decision === 'approved', `${approval.role} must be able to approve the project evidence export workflow.`);
  assert(response.body.readModels?.included === false && response.body.readModels.projectEvidenceExportWorkflowRoute?.endsWith('/project-evidence-exports'), `${approval.role} project evidence export approval must return deferred read-model routes.`);
}
assert(response.body.projectEvidenceExportWorkflow.readyForPrivatePilotHandoff === true, 'Project evidence export workflow must become private-pilot handoff ready after Manager and security-admin approvals.');
assert(response.body.projectEvidenceExportWorkflow.readyForProductionExport === false, 'Project evidence export workflow must keep production export blocked.');
assert(response.body.projectEvidenceExportWorkflow.gates.every((gate) => gate.passed), `Project evidence export workflow gates must pass for private-pilot handoff: ${JSON.stringify(response.body.projectEvidenceExportWorkflow.gates.filter((gate) => !gate.passed))}`);
assert(response.body.projectEvidenceExportWorkflow.readyForPrivatePilotDownload === false, 'Project evidence export workflow must require a download-audit record before local package handoff.');

response = membershipApi.handle({
  method: 'POST',
  path: projectEvidenceExportPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: projectEvidenceExportPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    action: 'download-audit',
    mode: 'private-pilot',
    exportRequestId,
    actorRole: 'manager',
    actorId: 'director',
    reason: 'Record local private-pilot package handoff after approvals.',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.projectEvidenceExport?.action === 'download-audit', 'Manager must be able to record a governed project evidence download audit.');
assert(response.body.projectEvidenceExportWorkflow.readyForPrivatePilotDownload === true, 'Project evidence export workflow must become local package ready after download audit.');
assert(response.body.projectEvidenceExportWorkflow.readyForProductionExport === false, 'Project evidence export workflow must keep production export blocked after local package audit.');
assert(response.body.projectEvidenceExportPackage?.schemaVersion === 'project-evidence-export-package/v1', 'Project evidence export download audit must return a local private-pilot package descriptor.');
assert(response.body.projectEvidenceExportPackage.readyForPrivatePilotDownload === true, 'Project evidence export package must be ready for private-pilot download.');
assert(response.body.projectEvidenceExportPackage.readyForProductionDownload === false, 'Project evidence export package must not issue production download readiness.');
assert(response.body.projectEvidenceExportPackage.downloadUrlIssued === false, 'Project evidence export package must not issue a production download URL.');
assert(response.body.projectEvidenceExportPackage.watermark?.applied === true && response.body.projectEvidenceExportPackage.watermark?.checksum, 'Project evidence export package must include a watermarked handoff descriptor.');
assert(response.body.projectEvidenceExportPackage.downloadAudit?.id === response.body.projectEvidenceExport.id, 'Project evidence export package must link to the download-audit row.');
assert(response.body.projectEvidenceExportPackage.archive?.currentChecksum && response.body.projectEvidenceExportPackage.archive?.manifest?.length > 0, 'Project evidence export package must include archive checksum and manifest proof.');
assert(response.body.readModels?.included === false && response.body.readModels.projectEvidenceExportPackageRoute?.includes(encodeURIComponent(exportRequestId)) && response.body.readModels.productionLaunchAuditRoute?.endsWith('/production-launch-audit'), 'Project evidence export download audit must return package and production-launch refresh routes.');

const projectEvidenceManagerReadyPackagePath = `/projects/${projectId}/manager-ready-package`;
response = membershipApi.handle({
  method: 'GET',
  path: projectEvidenceManagerReadyPackagePath,
  headers: signedHeadersFor({
    method: 'GET',
    path: projectEvidenceManagerReadyPackagePath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.summary?.projectEvidenceExportDownloadReady === true, 'Manager Ready Package summary must expose local project evidence package readiness.');
assert(response.body.projectEvidenceExportWorkflow?.readyForPrivatePilotHandoff === true, 'Manager Ready Package must embed the approved project evidence export workflow.');
assert(response.body.summary?.projectEvidenceExportReady === true, 'Manager Ready Package summary must expose project evidence export readiness.');
assert(response.body.productionLaunchAudit?.projectEvidenceHandoff?.readyForPrivatePilotPackage === true, 'Manager Ready Package production launch audit must show evidence handoff ready after package audit.');
assert(response.body.productionLaunchAudit?.nextShortestPath?.scope === 'production-hardening', 'Production launch audit must return to production hardening after evidence handoff package is ready.');

response = membershipApi.handle({
  method: 'GET',
  path: `${projectEvidenceExportPath}/${encodeURIComponent(exportRequestId)}/package`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `${projectEvidenceExportPath}/${encodeURIComponent(exportRequestId)}/package`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.projectEvidenceExportPackage?.readyForPrivatePilotDownload === true, 'Project API must expose the approved local evidence export package by request id.');
assert(response.body.projectEvidenceExportPackage?.exportRequestId === exportRequestId, 'Project evidence export package route must stay scoped to the requested export id.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/production-launch-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/production-launch-audit`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionLaunchAudit?.projectEvidenceHandoff?.readyForPrivatePilotPackage === true, 'Standalone production launch audit must include ready evidence handoff after package audit.');
assert(response.body.productionLaunchAudit.evidenceRoutes.some((route) => route.id === 'project-evidence-export-package' && route.ready && route.route?.includes(encodeURIComponent(exportRequestId))), 'Production launch audit evidence routes must include the ready project evidence export package route.');
assert(response.body.productionLaunchAudit.nextShortestPath?.scope === 'production-hardening', 'Standalone production launch audit must point to production hardening after handoff package is ready.');

progress('private-pilot release candidate receipt checks');
const privatePilotReleaseCandidatePath = `/projects/${projectId}/private-pilot-release-candidates`;
response = membershipApi.handle({
  method: 'GET',
  path: privatePilotReleaseCandidatePath,
  headers: signedHeadersFor({
    method: 'GET',
    path: privatePilotReleaseCandidatePath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.privatePilotReleaseCandidateWorkflow?.schemaVersion === 'private-pilot-release-candidate-workflow/v1', 'Project API must expose private-pilot release candidate workflow.');
assert(response.body.privatePilotReleaseCandidateWorkflow.readyToRecord === true, `Private-pilot release candidate workflow must be ready to record after handoff package audit: ${JSON.stringify(response.body.privatePilotReleaseCandidateWorkflow.failedPrerequisiteGates)}`);
assert(response.body.privatePilotReleaseCandidateWorkflow.readyForPrivatePilotRelease === false, 'Private-pilot release candidate workflow must require a recorded freeze receipt before release candidate readiness.');
assert(response.body.privatePilotReleaseCandidateWorkflow.status === 'private-pilot-release-candidate-record-needed', 'Private-pilot release candidate workflow must show record-needed before a receipt is written.');
progress('private-pilot release candidate record ready');

response = membershipApi.handle({
  method: 'POST',
  path: privatePilotReleaseCandidatePath,
  headers: signedHeadersFor({
    method: 'POST',
    path: privatePilotReleaseCandidatePath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    actorRole: 'manager',
    actorId: 'director',
    exportRequestId,
    reason: 'Freeze the private-pilot release candidate after approvals, package audit, provider eval, and deployment preflight.',
    now: '2026-06-01T11:58:00.000Z',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.privatePilotReleaseCandidate?.schemaVersion === 'private-pilot-release-candidate/v1', 'Manager must be able to record a private-pilot release candidate receipt.');
assert(response.body.privatePilotReleaseCandidate.readyForPrivatePilotRelease === true, `Private-pilot release candidate receipt must pass blocker gates: ${JSON.stringify(response.body.privatePilotReleaseCandidate.failedGates)}`);
assert(response.body.privatePilotReleaseCandidate.readyForProduction === false, 'Private-pilot release candidate receipt must not claim production readiness.');
assert(response.body.privatePilotReleaseCandidate.releaseChecksums?.productionLaunchAudit && response.body.privatePilotReleaseCandidate.releaseChecksums?.projectEvidenceExportPackage && response.body.privatePilotReleaseCandidate.releaseChecksums?.latestProviderEvalRun, 'Private-pilot release candidate must freeze launch audit, package, and provider eval checksums.');
assert(response.body.privatePilotReleaseCandidate.proofIds?.length >= 6 && response.body.privatePilotReleaseCandidate.eventId && response.body.privatePilotReleaseCandidate.timelineLogId, 'Private-pilot release candidate must include proof, event, and timeline links.');
assert(response.body.privatePilotReleaseCandidateWorkflow.readyForPrivatePilotRelease === true && response.body.privatePilotReleaseCandidateWorkflow.summary?.candidateCount >= 1, 'Private-pilot release candidate workflow must become ready after recording the receipt.');
assert(response.body.readModels?.included === false && response.body.readModels.privatePilotReleaseCandidateWorkflowRoute?.endsWith('/private-pilot-release-candidates') && response.body.readModels.managerReadyPackageRoute?.endsWith('/manager-ready-package'), 'Private-pilot release candidate receipt must support lightweight read-model refresh routes.');

response = membershipApi.handle({
  method: 'GET',
  path: privatePilotReleaseCandidatePath,
  headers: signedHeadersFor({
    method: 'GET',
    path: privatePilotReleaseCandidatePath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.privatePilotReleaseCandidateWorkflow?.status === 'private-pilot-release-candidate-ready', 'Security admin must be able to read the ready private-pilot release candidate workflow.');
assert(response.body.privatePilotReleaseCandidateWorkflow.latestCandidate?.exportRequestId === exportRequestId, 'Release candidate workflow must preserve the export request id.');
progress('private-pilot release candidate receipt ready');

progress('private-pilot launch run receipt checks');
const privatePilotLaunchRunPath = `/projects/${projectId}/private-pilot-launch-runs`;
response = membershipApi.handle({
  method: 'GET',
  path: privatePilotLaunchRunPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: privatePilotLaunchRunPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.privatePilotLaunchRunWorkflow?.schemaVersion === 'private-pilot-launch-run-workflow/v1', 'Project API must expose private-pilot launch run workflow.');
assert(response.body.privatePilotLaunchRunWorkflow.readyToLaunch === true, `Private-pilot launch run workflow must be ready after release candidate freeze: ${JSON.stringify(response.body.privatePilotLaunchRunWorkflow.failedLaunchGates)}`);
assert(response.body.privatePilotLaunchRunWorkflow.readyForPrivatePilotLaunch === false, 'Private-pilot launch run workflow must require a recorded launch receipt before launch readiness.');
assert(response.body.privatePilotLaunchRunWorkflow.status === 'private-pilot-launch-run-needed', 'Private-pilot launch run workflow must show launch-needed before a receipt is written.');

response = membershipApi.handle({
  method: 'POST',
  path: privatePilotLaunchRunPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: privatePilotLaunchRunPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    actorRole: 'manager',
    actorId: 'director',
    launchWindow: 'controlled private-pilot launch window',
    reason: 'Start the controlled private-pilot launch run from the frozen release candidate.',
    now: '2026-06-01T12:02:00.000Z',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.privatePilotLaunchRun?.schemaVersion === 'private-pilot-launch-run/v1', 'Manager must be able to record a private-pilot launch run receipt.');
assert(response.body.privatePilotLaunchRun.readyForPrivatePilotLaunch === true, `Private-pilot launch run receipt must pass blocker gates: ${JSON.stringify(response.body.privatePilotLaunchRun.failedGates)}`);
assert(response.body.privatePilotLaunchRun.readyForProduction === false, 'Private-pilot launch run receipt must not claim production readiness.');
assert(response.body.privatePilotLaunchRun.releaseCandidateId && response.body.privatePilotLaunchRun.releaseCandidateChecksum, 'Private-pilot launch run must bind the frozen release candidate.');
assert(response.body.privatePilotLaunchRun.releaseChecksums?.deploymentPreflight && response.body.privatePilotLaunchRun.releaseChecksums?.operationsReadiness && response.body.privatePilotLaunchRun.releaseChecksums?.latestProviderEvalRun, 'Private-pilot launch run must freeze deployment, operations, and provider eval checksums.');
assert(response.body.privatePilotLaunchRun.proofIds?.length >= 6 && response.body.privatePilotLaunchRun.eventId && response.body.privatePilotLaunchRun.timelineLogId, 'Private-pilot launch run must include proof, event, and timeline links.');
assert(response.body.privatePilotLaunchRunWorkflow.readyForPrivatePilotLaunch === true && response.body.privatePilotLaunchRunWorkflow.summary?.runCount >= 1, `Private-pilot launch run workflow must become ready after recording the receipt: ${JSON.stringify(response.body.privatePilotLaunchRunWorkflow.failedLaunchGates)}`);
assert(response.body.readModels?.included === false && response.body.readModels.privatePilotLaunchRunWorkflowRoute?.endsWith('/private-pilot-launch-runs') && response.body.readModels.deploymentPreflightRoute?.endsWith('/deployment-preflight'), 'Private-pilot launch run receipt must support lightweight read-model refresh routes.');

response = membershipApi.handle({
  method: 'GET',
  path: privatePilotLaunchRunPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: privatePilotLaunchRunPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.privatePilotLaunchRunWorkflow?.status === 'private-pilot-launch-run-ready', 'Security admin must be able to read the ready private-pilot launch run workflow.');
assert(response.body.privatePilotLaunchRunWorkflow.latestRun?.releaseCandidateId, 'Launch run workflow must preserve the release candidate id.');
progress('private-pilot launch run receipt ready');

progress('private-pilot launch health check receipt checks');
const privatePilotLaunchHealthCheckPath = `/projects/${projectId}/private-pilot-launch-health-checks`;
progress('post-launch proof map, flow graph, and persistence checks');
response = membershipApi.handle({
  method: 'GET',
  path: privatePilotLaunchHealthCheckPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: privatePilotLaunchHealthCheckPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.privatePilotLaunchHealthCheckWorkflow?.schemaVersion === 'private-pilot-launch-health-check-workflow/v1', 'Project API must expose private-pilot launch health check workflow.');
assert(response.body.privatePilotLaunchHealthCheckWorkflow.readyToCheck === true, `Private-pilot launch health workflow must be ready after launch run receipt: ${JSON.stringify(response.body.privatePilotLaunchHealthCheckWorkflow.failedHealthGates)}`);
assert(response.body.privatePilotLaunchHealthCheckWorkflow.readyForPrivatePilotMonitoring === false, 'Private-pilot launch health workflow must require a recorded health receipt before monitoring readiness.');
assert(response.body.privatePilotLaunchHealthCheckWorkflow.status === 'private-pilot-launch-health-check-needed', 'Private-pilot launch health workflow must show check-needed before a receipt is written.');

response = membershipApi.handle({
  method: 'POST',
  path: privatePilotLaunchHealthCheckPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: privatePilotLaunchHealthCheckPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    actorRole: 'manager',
    actorId: 'director',
    reason: 'Record private-pilot post-launch health after the controlled launch run.',
    now: '2026-06-01T12:06:00.000Z',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.privatePilotLaunchHealthCheck?.schemaVersion === 'private-pilot-launch-health-check/v1', 'Manager must be able to record a private-pilot launch health check receipt.');
assert(response.body.privatePilotLaunchHealthCheck.readyForPrivatePilotMonitoring === true, `Private-pilot launch health check receipt must pass blocker gates: ${JSON.stringify(response.body.privatePilotLaunchHealthCheck.failedGates)}`);
assert(response.body.privatePilotLaunchHealthCheck.readyForProduction === false, 'Private-pilot launch health check receipt must not claim production readiness.');
assert(response.body.privatePilotLaunchHealthCheck.launchRunId && response.body.privatePilotLaunchHealthCheck.launchRunChecksum, 'Private-pilot launch health check must bind the launch run receipt.');
assert(response.body.privatePilotLaunchHealthCheck.healthChecksums?.operationsReadiness && response.body.privatePilotLaunchHealthCheck.healthChecksums?.securityBoundary && response.body.privatePilotLaunchHealthCheck.healthChecksums?.workerQueueAdapterDryRun && response.body.privatePilotLaunchHealthCheck.healthChecksums?.persistenceAdapterDryRun && response.body.privatePilotLaunchHealthCheck.healthChecksums?.latestProviderEvalRun, 'Private-pilot launch health check must freeze operations, security, queue, persistence, and provider eval checksums.');
assert(response.body.privatePilotLaunchHealthCheck.proofIds?.length >= 6 && response.body.privatePilotLaunchHealthCheck.eventId && response.body.privatePilotLaunchHealthCheck.timelineLogId, 'Private-pilot launch health check must include proof, event, and timeline links.');
assert(response.body.privatePilotLaunchHealthCheck.requiredProductionControls?.some((control) => control.id === 'centralized-production-observability' && control.status === 'blocked'), 'Private-pilot launch health check must keep centralized production observability as a blocker.');
assert(response.body.privatePilotLaunchHealthCheckWorkflow.readyForPrivatePilotMonitoring === true && response.body.privatePilotLaunchHealthCheckWorkflow.summary?.healthCheckCount >= 1, `Private-pilot launch health workflow must become ready after recording the receipt: ${JSON.stringify(response.body.privatePilotLaunchHealthCheckWorkflow.failedHealthGates)}`);
assert(response.body.readModels?.included === false && response.body.readModels.privatePilotLaunchHealthCheckWorkflowRoute?.endsWith('/private-pilot-launch-health-checks') && response.body.readModels.operationsReadinessRoute?.endsWith('/operations-readiness'), 'Private-pilot launch health receipt must support lightweight read-model refresh routes.');

response = membershipApi.handle({
  method: 'GET',
  path: privatePilotLaunchHealthCheckPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: privatePilotLaunchHealthCheckPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.privatePilotLaunchHealthCheckWorkflow?.status === 'private-pilot-launch-health-ready', 'Security admin must be able to read the ready private-pilot launch health workflow.');
assert(response.body.privatePilotLaunchHealthCheckWorkflow.latestHealthCheck?.launchRunId, 'Launch health workflow must preserve the launch run id.');
progress('private-pilot launch health check receipt ready');

progress('private-pilot acceptance report checks');
const privatePilotAcceptanceReportPath = `/projects/${projectId}/private-pilot-acceptance-reports`;
response = membershipApi.handle({
  method: 'GET',
  path: privatePilotAcceptanceReportPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: privatePilotAcceptanceReportPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.privatePilotAcceptanceReportWorkflow?.schemaVersion === 'private-pilot-acceptance-report-workflow/v1', 'Project API must expose private-pilot acceptance report workflow.');
assert(response.body.privatePilotAcceptanceReportWorkflow.readyToReport === true, `Private-pilot acceptance report workflow must be ready after launch health: ${JSON.stringify(response.body.privatePilotAcceptanceReportWorkflow.failedAcceptanceGates)}`);
assert(response.body.privatePilotAcceptanceReportWorkflow.readyForPrivatePilotAcceptance === false, 'Private-pilot acceptance workflow must require a recorded report before acceptance readiness.');
assert(response.body.privatePilotAcceptanceReportWorkflow.status === 'private-pilot-acceptance-report-needed', 'Private-pilot acceptance workflow must show report-needed before a receipt is written.');

response = membershipApi.handle({
  method: 'POST',
  path: privatePilotAcceptanceReportPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: privatePilotAcceptanceReportPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    actorRole: 'manager',
    actorId: 'director',
    reason: 'Record customer-visible private-pilot acceptance after launch health and evidence handoff are ready.',
    now: '2026-06-01T12:07:00.000Z',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.privatePilotAcceptanceReport?.schemaVersion === 'private-pilot-acceptance-report/v1', 'Manager must be able to record a private-pilot acceptance report.');
assert(response.body.privatePilotAcceptanceReport.readyForPrivatePilotAcceptance === true, `Private-pilot acceptance report must pass blocker gates: ${JSON.stringify(response.body.privatePilotAcceptanceReport.failedGates)}`);
assert(response.body.privatePilotAcceptanceReport.readyForProduction === false, 'Private-pilot acceptance report must not claim production readiness.');
assert(response.body.privatePilotAcceptanceReport.acceptanceDecision === 'accepted-for-private-pilot', 'Private-pilot acceptance report must produce a customer-visible private-pilot acceptance decision.');
assert(response.body.privatePilotAcceptanceReport.launchRunId && response.body.privatePilotAcceptanceReport.launchRunChecksum && response.body.privatePilotAcceptanceReport.launchHealthCheckId && response.body.privatePilotAcceptanceReport.launchHealthCheckChecksum, 'Private-pilot acceptance report must bind launch run and launch health receipts.');
assert(response.body.privatePilotAcceptanceReport.acceptanceChecksums?.projectEvidenceArchive && response.body.privatePilotAcceptanceReport.acceptanceChecksums?.projectEvidenceExportWorkflow && response.body.privatePilotAcceptanceReport.acceptanceChecksums?.managerFlowGraph && response.body.privatePilotAcceptanceReport.acceptanceChecksums?.readinessProofMap, 'Private-pilot acceptance report must freeze evidence archive, export, Flow Graph, and Proof Map checksums.');
assert(response.body.privatePilotAcceptanceReport.proofIds?.length >= 10 && response.body.privatePilotAcceptanceReport.eventId && response.body.privatePilotAcceptanceReport.timelineLogId, 'Private-pilot acceptance report must include proof, event, and timeline links.');
assert(response.body.privatePilotAcceptanceReport.requiredProductionControls?.some((control) => control.id === 'public-production-managed-controls' && control.status === 'blocked'), 'Private-pilot acceptance report must keep public production managed controls as blockers.');
assert(response.body.privatePilotAcceptanceReportWorkflow.readyForPrivatePilotAcceptance === true && response.body.privatePilotAcceptanceReportWorkflow.summary?.reportCount >= 1, `Private-pilot acceptance workflow must become ready after recording the report: ${JSON.stringify(response.body.privatePilotAcceptanceReportWorkflow.failedAcceptanceGates)}`);
assert(response.body.readModels?.included === false && response.body.readModels.privatePilotAcceptanceReportWorkflowRoute?.endsWith('/private-pilot-acceptance-reports') && response.body.readModels.productionOperationsReadinessRoute?.endsWith('/production-operations-readiness'), 'Private-pilot acceptance receipt must support lightweight production-operations refresh routes.');

const managerReadyPackagePath = `/projects/${projectId}/manager-ready-package`;
response = membershipApi.handle({
  method: 'GET',
  path: managerReadyPackagePath,
  headers: signedHeadersFor({
    method: 'GET',
    path: managerReadyPackagePath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.privatePilotAcceptanceReportWorkflow?.readyForPrivatePilotAcceptance === true, 'Manager Ready Package must embed private-pilot acceptance readiness after the report.');
assert(response.body.summary?.privatePilotAcceptanceReportReady === true, 'Manager Ready Package summary must expose private-pilot acceptance readiness.');
assert(response.body.productionOperationsReadiness?.schemaVersion === 'production-operations-readiness/v1', 'Manager Ready Package must embed production operations readiness after the report.');
assert(response.body.productionOperationsReadiness.readyForPrivatePilotOperations === true, 'Production operations readiness must pass local/private-pilot operations proof after customer acceptance.');
assert(response.body.productionOperationsReadiness.readyForProductionOperations === false && response.body.productionOperationsReadiness.readyForProduction === false, 'Production operations readiness must not claim public production readiness.');
assert(response.body.productionOperationsReadiness.status === 'production-operations-controls-blocked', 'Production operations readiness must surface production control blockers after local proof passes.');
assert(response.body.productionOperationsReadiness.summary?.failedLocalProofGateCount === 0, 'Production operations readiness must have no local proof failures after the acceptance report.');
assert(response.body.productionOperationsReadiness.summary?.failedProductionControlGateCount > 0, 'Production operations readiness must keep production operations controls blocked.');
assert(response.body.summary?.productionOperationsReadyForPrivatePilot === true && response.body.summary?.productionOperationsReadyForProduction === false, 'Manager Ready Package summary must expose production operations private-pilot readiness without production readiness.');
assert(response.body.summary?.productionOperationsChecksum === response.body.productionOperationsReadiness.checksum, 'Manager Ready Package summary must preserve the production operations readiness checksum.');

response = membershipApi.handle({
  method: 'GET',
  path: privatePilotAcceptanceReportPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: privatePilotAcceptanceReportPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.privatePilotAcceptanceReportWorkflow?.status === 'private-pilot-acceptance-ready', 'Security admin must be able to read the ready private-pilot acceptance workflow.');
assert(response.body.privatePilotAcceptanceReportWorkflow.latestReport?.launchHealthCheckId, 'Acceptance report workflow must preserve the launch health id.');
progress('private-pilot acceptance report ready');

progress('production operations readiness checks');
const productionOperationsReadinessPath = `/projects/${projectId}/production-operations-readiness`;
response = membershipApi.handle({
  method: 'GET',
  path: productionOperationsReadinessPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionOperationsReadinessPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionOperationsReadiness?.schemaVersion === 'production-operations-readiness/v1', 'Project API must expose production operations readiness.');
assert(response.body.productionOperationsReadiness.readyForPrivatePilotOperations === true, `Production operations readiness must pass local/private-pilot proof after acceptance: ${JSON.stringify(response.body.productionOperationsReadiness.failedLocalProofGates)}`);
assert(response.body.productionOperationsReadiness.readyForProductionOperations === false && response.body.productionOperationsReadiness.readyForProduction === false, 'Production operations readiness must keep public production blocked.');
assert(response.body.productionOperationsReadiness.status === 'production-operations-controls-blocked', 'Production operations readiness must report production control blockers when local proof is ready.');
assert(response.body.productionOperationsReadiness.summary?.failedLocalProofGateCount === 0, 'Production operations readiness must have zero failed local proof gates after acceptance.');
assert(response.body.productionOperationsReadiness.summary?.failedProductionControlGateCount > 0, 'Production operations readiness must expose failed production control gates.');
assert(response.body.productionOperationsReadiness.requiredProductionControls?.some((control) => control.id === 'centralized-logs'), 'Production operations readiness must require centralized production logs.');
assert(response.body.productionOperationsReadiness.requiredProductionControls?.some((control) => control.id === 'alert-routing'), 'Production operations readiness must require alert routing.');
assert(response.body.productionOperationsReadiness.requiredProductionControls?.some((control) => control.id === 'on-call-ownership'), 'Production operations readiness must require on-call ownership.');
assert(response.body.productionOperationsReadiness.requiredProductionControls?.some((control) => control.id === 'managed-incident-system'), 'Production operations readiness must require a managed incident system.');
assert(response.body.productionOperationsReadiness.requiredProductionControls?.some((control) => control.id === 'real-restore-drill'), 'Production operations readiness must require a real restore drill receipt.');
assert(response.body.productionOperationsReadiness.proofIds?.length >= 10, 'Production operations readiness must preserve acceptance, health, operations, security, provider, and launch proof ids.');
assert(response.body.productionOperationsReadiness.nextShortestPath?.scope === 'production-operations-hardening', 'Production operations readiness must route next work to production operations hardening.');
assert(response.body.productionOperationsReadiness.backendRoutes?.productionOperationsReadiness?.endsWith('/production-operations-readiness'), 'Production operations readiness must expose its standalone route.');

response = membershipApi.handle({
  method: 'GET',
  path: productionOperationsReadinessPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionOperationsReadinessPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionOperationsReadiness?.status === 'production-operations-controls-blocked', 'Security admin must be able to read production operations readiness without production overclaim.');
progress('production operations readiness model ready');

const productionOperationsControlReceiptPath = `/projects/${projectId}/production-operations-control-receipts`;
response = membershipApi.handle({
  method: 'GET',
  path: productionOperationsControlReceiptPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionOperationsControlReceiptPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionOperationsControlReceiptWorkflow?.schemaVersion === 'production-operations-control-receipt-workflow/v1', 'Project API must expose production operations control receipt workflow.');
assert(response.body.productionOperationsControlReceiptWorkflow.readyForProductionOperations === false && response.body.productionOperationsControlReceiptWorkflow.summary?.missingControlCount > 0, 'Production operations control receipt workflow must require control evidence before production operations readiness can pass.');

const productionDeploymentControlReceiptPath = `/projects/${projectId}/production-deployment-control-receipts`;
response = membershipApi.handle({
  method: 'GET',
  path: productionDeploymentControlReceiptPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionDeploymentControlReceiptPath,
    role: 'runtime-platform',
    userId: 'runtime-ops',
  }),
});
assert(response.status === 200 && response.body.productionDeploymentControlReceiptWorkflow?.schemaVersion === 'production-deployment-control-receipt-workflow/v1', 'Project API must expose production deployment control receipt workflow.');
assert(response.body.productionDeploymentControlReceiptWorkflow.readyForPrivatePilotDeployment === true, 'Production deployment control receipt workflow must inherit private-pilot deployment readiness.');
assert(response.body.productionDeploymentControlReceiptWorkflow.readyForProductionDeployment === false && response.body.productionDeploymentControlReceiptWorkflow.summary?.missingControlCount > 0, 'Production deployment control receipt workflow must require deployment control evidence before production deployment readiness can pass.');

const productionSecurityControlReceiptPath = `/projects/${projectId}/production-security-control-receipts`;
response = membershipApi.handle({
  method: 'GET',
  path: productionSecurityControlReceiptPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionSecurityControlReceiptPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionSecurityControlReceiptWorkflow?.schemaVersion === 'production-security-control-receipt-workflow/v1', 'Project API must expose production security control receipt workflow.');
assert(response.body.productionSecurityControlReceiptWorkflow.readyForProductionSecurity === false && response.body.productionSecurityControlReceiptWorkflow.summary?.missingControlCount > 0, 'Production security control receipt workflow must require managed identity, KMS, RBAC, audit, and replay evidence before security readiness can pass.');

const productionProviderControlReceiptPath = `/projects/${projectId}/production-provider-control-receipts`;
response = membershipApi.handle({
  method: 'GET',
  path: productionProviderControlReceiptPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionProviderControlReceiptPath,
    role: 'runtime-platform',
    userId: 'runtime-ops',
  }),
});
assert(response.status === 200 && response.body.productionProviderControlReceiptWorkflow?.schemaVersion === 'production-provider-control-receipt-workflow/v1', 'Project API must expose production provider control receipt workflow.');
assert(response.body.productionProviderControlReceiptWorkflow.readyForLocalProviderContract === true, 'Production provider control receipt workflow must inherit local provider readiness and shadow eval proof.');
assert(response.body.productionProviderControlReceiptWorkflow.readyForProductionProvider === false && response.body.productionProviderControlReceiptWorkflow.summary?.missingControlCount > 0, 'Production provider control receipt workflow must require real provider rollout evidence before production provider readiness can pass.');

const privatePilotGoLiveReadinessPath = `/projects/${projectId}/private-pilot-go-live-readiness`;
response = membershipApi.handle({
  method: 'GET',
  path: privatePilotGoLiveReadinessPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: privatePilotGoLiveReadinessPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.privatePilotGoLiveReadiness?.schemaVersion === 'private-pilot-go-live-readiness/v1', 'Project API must expose private-pilot go-live readiness.');
assert(response.body.privatePilotGoLiveReadiness.readyForPrivatePilotGoLive === true && response.body.privatePilotGoLiveReadiness.readyForPrivatePilotAcceptance === true, 'Private-pilot go-live readiness must show launch and acceptance proof after closeout.');
assert(response.body.privatePilotGoLiveReadiness.readyForProduction === false, 'Private-pilot go-live readiness must not claim public production readiness.');
assert(response.body.privatePilotGoLiveReadiness.nextAction?.id === 'production-operations-hardening' && response.body.privatePilotGoLiveReadiness.backendRoutes?.privatePilotGoLiveReadiness?.endsWith('/private-pilot-go-live-readiness'), 'Private-pilot go-live readiness must route the next post-acceptance hardening action.');

const productionLaunchGapRegisterPath = `/projects/${projectId}/production-launch-gap-register`;
response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchGapRegisterPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionLaunchGapRegisterPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionLaunchGapRegister?.schemaVersion === 'production-launch-gap-register/v1', 'Project API must expose production launch gap register.');
assert(response.body.productionLaunchGapRegister.readyForPrivatePilotAcceptance === true && response.body.productionLaunchGapRegister.readyForProduction === false, 'Production launch gap register must carry private-pilot acceptance while keeping production blocked.');
assert(response.body.productionLaunchGapRegister.gapRows?.length >= 5 && response.body.productionLaunchGapRegister.nextAction?.apiPath, 'Production launch gap register must expose actionable production gaps and a routed next action.');
assert(response.body.productionLaunchGapRegister.domainRows?.length >= 3 && response.body.productionLaunchGapRegister.backendRoutes?.productionLaunchGapRegister?.endsWith('/production-launch-gap-register'), 'Production launch gap register must group gaps by domain and expose its own route.');

const productionLaunchControlCenterPath = `/projects/${projectId}/production-launch-control-center`;
response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchControlCenterPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionLaunchControlCenterPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionLaunchControlCenter?.schemaVersion === 'production-launch-control-center/v1', 'Project API must expose production launch control center.');
assert(response.body.productionLaunchControlCenter.readyForPrivatePilotAcceptance === true && response.body.productionLaunchControlCenter.readyForProduction === false, 'Production launch control center must carry private-pilot acceptance while keeping production blocked.');
assert(response.body.productionLaunchControlCenter.controlRows?.length >= 8 && response.body.productionLaunchControlCenter.nextAction?.apiPath, 'Production launch control center must expose gate rows and a routed next action.');
assert(response.body.productionLaunchControlCenter.controlRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.ready === false && row.apiPath?.endsWith('/production-evidence-integrity-audit')), 'Production launch control center must gate public production on managed-production evidence integrity.');
assert(response.body.productionLaunchControlCenter.blockedRows?.length >= 1 && response.body.productionLaunchControlCenter.backendRoutes?.productionLaunchControlCenter?.endsWith('/production-launch-control-center'), 'Production launch control center must expose blocked gates and its own route.');

const productionLaunchEvidenceDossierPath = `/projects/${projectId}/production-launch-evidence-dossier`;
response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchEvidenceDossierPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionLaunchEvidenceDossierPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionLaunchEvidenceDossier?.schemaVersion === 'production-launch-evidence-dossier/v1', 'Project API must expose production launch evidence dossier.');
assert(response.body.productionLaunchEvidenceDossier.readyForPrivatePilotDossier === true && response.body.productionLaunchEvidenceDossier.readyForProduction === false, 'Production launch evidence dossier must carry private-pilot acceptance while keeping production blocked.');
assert(response.body.productionLaunchEvidenceDossier.manifest?.length >= 9 && response.body.productionLaunchEvidenceDossier.manifest.some((row) => row.id === 'production-launch-control-center') && response.body.productionLaunchEvidenceDossier.manifest.some((row) => row.id === 'production-evidence-integrity-audit'), 'Production launch evidence dossier must aggregate launch control and evidence integrity evidence.');
assert(response.body.productionLaunchEvidenceDossier.controlDomainRows?.length === 4 && response.body.productionLaunchEvidenceDossier.openGapRows?.some((row) => row.id === 'managed-production-evidence-integrity'), 'Production launch evidence dossier must expose control domains and open managed-production evidence gaps.');
assert(response.body.productionLaunchEvidenceDossier.backendRoutes?.productionLaunchEvidenceDossier?.endsWith('/production-launch-evidence-dossier'), 'Production launch evidence dossier must expose its own backend route.');

const productionEvidenceIntegrityAuditPath = `/projects/${projectId}/production-evidence-integrity-audit`;
response = membershipApi.handle({
  method: 'GET',
  path: productionEvidenceIntegrityAuditPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionEvidenceIntegrityAuditPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1', 'Project API must expose production evidence integrity audit.');
assert(response.body.productionEvidenceIntegrityAudit.readyForProduction === false && response.body.productionEvidenceIntegrityAudit.summary?.missingControlCount > 0, 'Production evidence integrity audit must require explicit managed-production evidence before launch.');
assert(response.body.productionEvidenceIntegrityAudit.backendRoutes?.productionEvidenceIntegrityAudit?.endsWith('/production-evidence-integrity-audit'), 'Production evidence integrity audit must expose its own backend route.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.projectEvidenceExportRoutes?.some((route) => route.apiPath?.endsWith('/project-evidence-exports') && route.proofIds?.length && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include project evidence export routes with proof, timeline, and event links.');
assert(response.body.evidenceCustodyRoutes?.some((route) => route.apiPath?.endsWith('/evidence-custody-readiness') && route.proofIds?.length && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must keep evidence custody routes with proof, timeline, and event links after export handoff.');
assert(response.body.privatePilotReleaseCandidateRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-release-candidates') && route.readyForPrivatePilotRelease === true && route.proofIds?.length >= 6 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include private-pilot release candidate routes with proof, timeline, and event links.');
assert(response.body.privatePilotReleaseCandidateSummary?.readyCount >= 1 && response.body.privatePilotReleaseCandidateSummary?.latestCandidateChecksum, 'Readiness Proof Map must summarize private-pilot release candidate readiness.');
assert(response.body.privatePilotLaunchRunRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-launch-runs') && route.readyForPrivatePilotLaunch === true && route.proofIds?.length >= 6 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include private-pilot launch run routes with proof, timeline, and event links.');
assert(response.body.privatePilotLaunchRunSummary?.readyCount >= 1 && response.body.privatePilotLaunchRunSummary?.latestRunChecksum, 'Readiness Proof Map must summarize private-pilot launch run readiness.');
assert(response.body.privatePilotLaunchHealthCheckRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-launch-health-checks') && route.readyForPrivatePilotMonitoring === true && route.proofIds?.length >= 6 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include private-pilot launch health check routes with proof, timeline, and event links.');
assert(response.body.privatePilotLaunchHealthCheckSummary?.readyCount >= 1 && response.body.privatePilotLaunchHealthCheckSummary?.latestHealthCheckChecksum, 'Readiness Proof Map must summarize private-pilot launch health readiness.');
assert(response.body.privatePilotAcceptanceReportRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-acceptance-reports') && route.readyForPrivatePilotAcceptance === true && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include private-pilot acceptance report routes with proof, timeline, and event links.');
assert(response.body.privatePilotAcceptanceReportSummary?.readyCount >= 1 && response.body.privatePilotAcceptanceReportSummary?.latestAcceptanceReportChecksum, 'Readiness Proof Map must summarize private-pilot acceptance report readiness.');
assert(response.body.privatePilotGoLiveRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-go-live-readiness') && route.readyForPrivatePilotGoLive === true && route.readyForPrivatePilotAcceptance === true && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include private-pilot go-live readiness routes with proof, timeline, and event links.');
assert(response.body.privatePilotGoLiveSummary?.acceptanceReady === true && response.body.privatePilotGoLiveSummary?.readyForProduction === false, 'Readiness Proof Map must summarize private-pilot go-live readiness without production overclaim.');
assert(response.body.productionInfrastructureRehearsalRoutes?.some((route) => route.apiPath?.endsWith('/production-infrastructure-rehearsal') && route.readyForInfrastructureRehearsal === true && route.productionBlocked === true && route.readyForProduction === false && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length && route.upstreamRoutes?.deploymentPreflight?.endsWith('/deployment-preflight')), 'Readiness Proof Map must include production infrastructure rehearsal routes with proof, upstream routes, and production blockers.');
assert(response.body.productionInfrastructureRehearsalSummary?.routeReady === true && response.body.productionInfrastructureRehearsalSummary?.productionBlocked === true && response.body.productionInfrastructureRehearsalSummary?.readyForProduction === false, 'Readiness Proof Map must summarize production infrastructure rehearsal without production overclaim.');
assert(response.body.productionLaunchGapRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-gap-register') && route.privatePilotAccepted === true && route.readyForProduction === false && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include production launch gap register routes with proof, timeline, and event links.');
assert(response.body.productionLaunchGapSummary?.privatePilotAccepted === true && response.body.productionLaunchGapSummary?.readyForProduction === false, 'Readiness Proof Map must summarize production launch gap register without production overclaim.');
assert(response.body.productionLaunchControlCenterRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-control-center') && route.privatePilotAccepted === true && route.readyForProduction === false && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include production launch control center routes with proof, timeline, and event links.');
assert(response.body.productionLaunchControlCenterSummary?.privatePilotAccepted === true && response.body.productionLaunchControlCenterSummary?.readyForProduction === false, 'Readiness Proof Map must summarize production launch control center without production overclaim.');
assert(response.body.productionLaunchEvidenceDossierRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-evidence-dossier') && route.privatePilotAccepted === true && route.readyForProduction === false), 'Readiness Proof Map must include production launch evidence dossier routes without production overclaim.');
assert(response.body.productionLaunchEvidenceDossierSummary?.manifestEntryCount >= 9 && response.body.productionLaunchEvidenceDossierSummary?.readyForProduction === false, 'Readiness Proof Map must summarize production launch evidence dossier manifest coverage without production overclaim.');
assert(response.body.productionOperationsReadinessRoutes?.some((route) => route.apiPath?.endsWith('/production-operations-readiness') && route.readyForPrivatePilotOperations === true && route.readyForProduction === false && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include production operations readiness routes with proof, timeline, and event links.');
assert(response.body.productionOperationsReadinessSummary?.count === 1 && response.body.productionOperationsReadinessSummary?.readyForProduction === false && response.body.productionOperationsReadinessSummary?.proofIds?.length >= 10, 'Readiness Proof Map must summarize production operations readiness without claiming production readiness.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes?.some((node) => node.subtype === 'project-evidence-export' && node.route?.endsWith('/project-evidence-exports')), 'Manager Flow Graph must include project evidence export governance nodes.');
assert(response.body.nodes?.some((node) => node.subtype === 'evidence-custody-readiness' && node.route?.endsWith('/evidence-custody-readiness')), 'Manager Flow Graph must keep evidence custody readiness nodes after export handoff.');
const productTeamDeliveryTraceFlowNode = response.body.nodes?.find((node) => node.id === 'product-team-delivery-trace');
const productTeamDeliveryTraceStageAttachments = productTeamDeliveryTraceFlowNode?.attachments?.filter((attachment) => attachment.type === 'delivery-trace-stage') || [];
assert(productTeamDeliveryTraceFlowNode?.subtype === 'product-team-delivery-trace' && productTeamDeliveryTraceFlowNode.route?.endsWith('/product-team-delivery-trace') && productTeamDeliveryTraceFlowNode.status === 'confirmed' && productTeamDeliveryTraceFlowNode.proofIds?.length && productTeamDeliveryTraceFlowNode.timelineLogIds?.length && productTeamDeliveryTraceFlowNode.eventIds?.length && productTeamDeliveryTraceStageAttachments.filter((attachment) => attachment.ready === true).length >= 8, 'Manager Flow Graph must include a proofed product-team delivery trace node with ready stage attachments.');
assert(response.body.edges?.some((edge) => edge.source === 'productTeamDeliveryTrace' && edge.fromNodeId === 'brainstorm-layer' && edge.toNodeId === 'product-team-delivery-trace'), 'Manager Flow Graph must connect Brainstorm Layer into the product-team delivery trace.');
assert(response.body.edges?.some((edge) => edge.source === 'productTeamDeliveryTrace' && edge.fromNodeId?.startsWith('evidence-search-') && edge.toNodeId === 'product-team-delivery-trace'), 'Manager Flow Graph must connect evidence/search nodes into the product-team delivery trace.');
assert(response.body.edges?.some((edge) => edge.source === 'productTeamDeliveryTrace' && edge.fromNodeId === 'submission-review-workflow' && edge.toNodeId === 'product-team-delivery-trace'), 'Manager Flow Graph must connect review/revision workflow into the product-team delivery trace.');
const productTeamFinalDeliverableFlowNode = response.body.nodes?.find((node) => node.subtype === 'final-deliverable' && node.id?.startsWith('agent-submission-'));
assert(productTeamFinalDeliverableFlowNode && response.body.edges?.some((edge) => edge.source === 'productTeamDeliveryTrace' && edge.fromNodeId === productTeamFinalDeliverableFlowNode.id && edge.toNodeId === 'product-team-delivery-trace' && edge.importance === 'major'), 'Manager Flow Graph must connect accepted final-deliverable submission nodes into the product-team delivery trace.');
assert(response.body.nodes?.some((node) => node.subtype === 'private-pilot-release-candidate' && node.route?.endsWith('/private-pilot-release-candidates') && node.proofIds?.length >= 6 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'release-candidate-checksums')), 'Manager Flow Graph must include a proofed private-pilot release candidate node.');
assert(response.body.nodes?.some((node) => node.subtype === 'private-pilot-launch-run' && node.route?.endsWith('/private-pilot-launch-runs') && node.proofIds?.length >= 6 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'launch-run-checksums')), 'Manager Flow Graph must include a proofed private-pilot launch run node.');
assert(response.body.nodes?.some((node) => node.subtype === 'private-pilot-launch-health-check' && node.route?.endsWith('/private-pilot-launch-health-checks') && node.proofIds?.length >= 6 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'launch-health-checksums')), 'Manager Flow Graph must include a proofed private-pilot launch health check node.');
assert(response.body.nodes?.some((node) => node.subtype === 'private-pilot-acceptance-report' && node.route?.endsWith('/private-pilot-acceptance-reports') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'acceptance-report-checksums')), 'Manager Flow Graph must include a proofed private-pilot acceptance report node.');
assert(response.body.nodes?.some((node) => node.id === 'production-operations-readiness' && node.subtype === 'production-operations-readiness' && node.route?.endsWith('/production-operations-readiness') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'production-operations-controls')), 'Manager Flow Graph must include a proofed production operations readiness node.');
assert(response.body.nodes?.some((node) => node.id === 'private-pilot-go-live-readiness' && node.subtype === 'private-pilot-go-live-readiness' && node.route?.endsWith('/private-pilot-go-live-readiness') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'private-pilot-go-live-readiness')), 'Manager Flow Graph must include a proofed private-pilot go-live readiness node.');
assert(response.body.nodes?.some((node) => node.id === 'production-infrastructure-rehearsal' && node.subtype === 'production-infrastructure-rehearsal' && node.route?.endsWith('/production-infrastructure-rehearsal') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'production-infrastructure-rehearsal' && attachment.upstreamRoutes?.some((route) => route.endsWith('/deployment-preflight')))), 'Manager Flow Graph must include a proofed production infrastructure rehearsal node with upstream infrastructure routes.');
assert(response.body.nodes?.some((node) => node.id === 'production-launch-gap-register' && node.subtype === 'production-launch-gap-register' && node.route?.endsWith('/production-launch-gap-register') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'production-launch-gap-register')), 'Manager Flow Graph must include a proofed production launch gap register node.');
assert(response.body.nodes?.some((node) => node.id === 'production-launch-control-center' && node.subtype === 'production-launch-control-center' && node.route?.endsWith('/production-launch-control-center') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'production-launch-control-center')), 'Manager Flow Graph must include a proofed production launch control center node.');
assert(response.body.nodes?.some((node) => node.id === 'production-launch-evidence-dossier' && node.subtype === 'production-launch-evidence-dossier' && node.route?.endsWith('/production-launch-evidence-dossier') && node.attachments?.some((attachment) => attachment.type === 'production-launch-evidence-dossier')), 'Manager Flow Graph must include the production launch evidence dossier node.');
assert(response.body.edges?.some((edge) => edge.toNodeId === 'evidence-custody-readiness' && edge.source === 'evidenceCustodyReadiness' && edge.proofIds?.length && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must keep custody readiness edges with proof after export handoff.');
assert(response.body.edges?.some((edge) => edge.source === 'privatePilotReleaseCandidates' && edge.toNodeId.startsWith('private-pilot-release-candidate-') && edge.proofIds?.length >= 6 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect release candidate receipts to the project evidence ledger.');
assert(response.body.edges?.some((edge) => edge.source === 'privatePilotLaunchRuns' && edge.toNodeId.startsWith('private-pilot-launch-run-') && edge.proofIds?.length >= 6 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect launch run receipts to the frozen release candidate.');
assert(response.body.edges?.some((edge) => edge.source === 'privatePilotLaunchHealthChecks' && edge.toNodeId.startsWith('private-pilot-launch-health-check-') && edge.proofIds?.length >= 6 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect launch health checks to the launch run receipt.');
assert(response.body.edges?.some((edge) => edge.source === 'privatePilotAcceptanceReports' && edge.toNodeId.startsWith('private-pilot-acceptance-report-') && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect acceptance reports to the launch health receipt.');
assert(response.body.edges?.some((edge) => edge.source === 'productionOperationsReadiness' && edge.toNodeId === 'production-operations-readiness' && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect production operations readiness to the acceptance proof chain.');
assert(response.body.edges?.some((edge) => edge.source === 'privatePilotGoLiveReadiness' && edge.toNodeId === 'private-pilot-go-live-readiness' && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect private-pilot lifecycle receipts into the go-live readiness command node.');
assert(response.body.edges?.some((edge) => edge.source === 'productionInfrastructureRehearsal' && edge.toNodeId === 'production-infrastructure-rehearsal' && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect production control receipts into the production infrastructure rehearsal node.');
assert(response.body.edges?.some((edge) => edge.source === 'productionLaunchGapRegister' && edge.toNodeId === 'production-launch-gap-register' && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect private-pilot and operations proof into the production launch gap register node.');
assert(response.body.edges?.some((edge) => edge.source === 'productionLaunchControlCenter' && edge.toNodeId === 'production-launch-control-center' && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect production launch proof into the production launch control center node.');
assert(response.body.edges?.some((edge) => edge.source === 'productionLaunchEvidenceDossier' && edge.fromNodeId === 'production-launch-control-center' && edge.toNodeId === 'production-launch-evidence-dossier'), 'Manager Flow Graph must connect production launch control center into the evidence dossier.');
assert(response.body.edges?.some((edge) => edge.source === 'productionLaunchEvidenceDossier' && edge.fromNodeId === 'production-evidence-integrity-audit' && edge.toNodeId === 'production-launch-evidence-dossier'), 'Manager Flow Graph must connect production evidence integrity into the evidence dossier.');
assert(response.body.edges?.some((edge) => edge.source === 'productionLaunchEvidenceDossier' && edge.fromNodeId === 'production-launch-gap-register' && edge.toNodeId === 'production-launch-evidence-dossier'), 'Manager Flow Graph must connect production launch gaps into the evidence dossier.');

progress('production operations control receipt checks');
const productionOperationsControlIds = [
  'centralized-logs',
  'centralized-metrics',
  'centralized-traces',
  'alert-routing',
  'on-call-ownership',
  'managed-incident-system',
  'real-restore-drill',
  'managed-persistence-cutover',
  'managed-worker-queue-cutover',
  'centralized-audit-retention',
];
response = membershipApi.handle({
  method: 'POST',
  path: productionOperationsControlReceiptPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: productionOperationsControlReceiptPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    actorRole: 'security-admin',
    actorId: 'security-lead',
    reason: 'Record production operations control evidence receipts from managed observability, incident, restore, audit, database, and queue systems.',
    now: '2026-06-01T12:08:00.000Z',
    controls: productionOperationsControlIds.map((controlId) => ({
      controlId,
      status: 'verified',
      evidenceId: `prod_ops_${controlId}_receipt`,
      evidenceRoute: `https://ops.example.test/hofs/${controlId}`,
      evidenceChecksum: `prod_ops_${controlId}_checksum`,
      completedAt: '2026-06-01T12:07:30.000Z',
      ownerRole: controlId.includes('audit') ? 'security-admin' : 'operations-owner',
      detail: `Verified ${controlId} for production operations hardening.`,
    })),
  },
});
assert(response.status === 200 && response.body.productionOperationsControlReceipt?.schemaVersion === 'production-operations-control-receipt/v1', 'Security admin must be able to record production operations control receipts.');
assert(response.body.productionOperationsControlReceipt.readyForProductionOperationsControls === true, 'Production operations control receipt must verify all required operations controls.');
assert(response.body.productionOperationsControlReceipt.readyForProductionOperations === true, 'Production operations control receipt must combine verified controls with private-pilot operations proof.');
assert(response.body.productionOperationsControlReceipt.verifiedControlIds.length === productionOperationsControlIds.length, 'Production operations control receipt must preserve every verified control id.');
assert(response.body.productionOperationsControlReceipt.eventId && response.body.productionOperationsControlReceipt.timelineLogId, 'Production operations control receipt must write timeline and event proof.');
assert(response.body.productionOperationsControlReceiptWorkflow?.readyForProductionOperations === true, 'Production operations control receipt workflow must become ready after all controls are verified.');
assert(response.body.productionOperationsReadiness?.readyForProductionOperations === true && response.body.productionOperationsReadiness?.status === 'production-operations-ready', 'Production operations readiness must pass after verified production control receipts.');
assert(response.body.managerReadyPackage?.summary?.productionOperationsReadyForProduction === true, 'Manager Ready Package summary must expose production operations readiness after receipt verification.');
assert(response.body.managerReadyPackage?.privatePilotGoLiveReadiness?.readyForPrivatePilotAcceptance === true && response.body.managerReadyPackage?.privatePilotGoLiveReadiness?.summary?.failedGoLiveStageCount === 0, 'Manager Ready Package go-live readiness must keep private-pilot acceptance closed after production operations control receipts.');
assert(response.body.managerReadyPackage?.productionLaunchGapRegister?.readyForProduction === false && response.body.managerReadyPackage?.productionLaunchGapRegister?.summary?.openGapCount >= 1, 'Manager Ready Package production launch gap register must remain open after operations receipts while broader production controls are absent.');
assert(response.body.managerReadyPackage?.summary?.productionLaunchGapOpenCount === response.body.managerReadyPackage?.productionLaunchGapRegister?.summary?.openGapCount, 'Manager Ready Package summary must update production launch gap counts after operations receipts.');
assert(response.body.managerReadyPackage?.productionLaunchControlCenter?.readyForProduction === false && response.body.managerReadyPackage?.productionLaunchControlCenter?.summary?.blockedControlCount >= 1, 'Manager Ready Package production launch control center must remain no-go after operations receipts while broader production controls are absent.');
assert(response.body.managerReadyPackage?.summary?.productionLaunchControlBlockedCount === response.body.managerReadyPackage?.productionLaunchControlCenter?.summary?.blockedControlCount, 'Manager Ready Package summary must update production launch control counts after operations receipts.');
assert(response.body.managerReadyPackage?.productionLaunchAudit?.productionDecision === 'no-go', 'Broader production launch audit must remain no-go even after operations controls are receipted.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionOperationsControlReceiptRoutes?.some((route) => route.apiPath?.endsWith('/production-operations-control-receipts') && route.readyForProductionOperations === true && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include production operations control receipt routes with proof, timeline, and event links.');
assert(response.body.productionOperationsControlReceiptSummary?.readyCount >= 1 && response.body.productionOperationsControlReceiptSummary?.readyForProductionOperations === true, 'Readiness Proof Map must summarize verified production operations control receipts.');
assert(response.body.productionOperationsReadinessRoutes?.some((route) => route.apiPath?.endsWith('/production-operations-readiness') && route.readyForProduction === true), 'Readiness Proof Map must update production operations readiness after verified control receipts.');
assert(response.body.privatePilotGoLiveRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-go-live-readiness') && route.readyForPrivatePilotAcceptance === true && route.proofIds?.length >= 10), 'Readiness Proof Map must keep private-pilot go-live readiness after production operations receipts.');
assert(response.body.privatePilotGoLiveSummary?.productionOperationsControlsReady === true, 'Readiness Proof Map must show production operations controls in the go-live summary after receipts.');
assert(response.body.productionLaunchGapRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-gap-register') && route.productionOperationsControlsReady === true && route.readyForProduction === false && route.proofIds?.length >= 10), 'Readiness Proof Map must keep production launch gap register after production operations receipts.');
assert(response.body.productionLaunchGapSummary?.productionOperationsControlsReady === true && response.body.productionLaunchGapSummary?.readyForProduction === false, 'Readiness Proof Map must show production operations controls without closing the full production gap register.');
assert(response.body.productionLaunchControlCenterRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-control-center') && route.productionOperationsControlsReady === true && route.readyForProduction === false && route.proofIds?.length >= 10), 'Readiness Proof Map must keep production launch control center after production operations receipts.');
assert(response.body.productionLaunchControlCenterSummary?.productionOperationsControlsReady === true && response.body.productionLaunchControlCenterSummary?.readyForProduction === false, 'Readiness Proof Map must show production operations controls without closing the production launch control center.');

response = membershipApi.handle({
  method: 'GET',
  path: productionInfrastructureRehearsalPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionInfrastructureRehearsalPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionInfrastructureRehearsal?.domainRows?.some((row) => row.id === 'managed-persistence' && row.productionReady === true && row.observed?.cutoverReceiptReady === true), 'Production infrastructure rehearsal must project managed persistence cutover receipts into the infrastructure domain row.');
assert(response.body.productionInfrastructureRehearsal?.domainRows?.some((row) => row.id === 'managed-worker-queue' && row.productionReady === true && row.observed?.cutoverReceiptReady === true), 'Production infrastructure rehearsal must project managed worker queue cutover receipts into the infrastructure domain row.');
assert(response.body.productionInfrastructureRehearsal?.managedCutoverGates?.some((gate) => gate.id === 'managed-persistence-cutover' && gate.productionReady === true && gate.receiptReady === true && gate.evidenceTier === 'managed-production'), 'Production infrastructure rehearsal must project managed persistence cutover receipts into managed cutover gates.');
assert(response.body.productionInfrastructureRehearsal?.managedCutoverGates?.some((gate) => gate.id === 'managed-worker-queue-cutover' && gate.productionReady === true && gate.receiptReady === true && gate.evidenceTier === 'managed-production'), 'Production infrastructure rehearsal must project managed queue cutover receipts into managed cutover gates.');
assert(response.body.productionInfrastructureRehearsal?.readyForProduction === false && !response.body.productionInfrastructureRehearsal?.productionBlockedRows?.some((row) => ['managed-persistence', 'managed-worker-queue'].includes(row.id)), 'Production infrastructure rehearsal must clear managed database/queue blockers after operations cutover receipts while keeping broader production blocked.');
assert(response.body.productionInfrastructureRehearsal?.managedCutoverSummary?.productionReadyGateCount >= 2 && response.body.productionInfrastructureRehearsal?.managedCutoverSummary?.productionBlockedGateCount >= 1, 'Production infrastructure rehearsal managed cutover summary must advance after operations receipts while keeping remaining gates blocked.');
progress('production operations control receipt projection ready');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes?.some((node) => node.subtype === 'production-operations-control-receipt' && node.route?.endsWith('/production-operations-control-receipts') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'production-operations-control-receipt')), 'Manager Flow Graph must include a proofed production operations control receipt node.');
assert(response.body.edges?.some((edge) => edge.source === 'productionOperationsControlReceipts' && edge.toNodeId.startsWith('production-operations-control-receipt-') && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect production operations control receipts to operations readiness.');
assert(response.body.nodes?.some((node) => node.id === 'private-pilot-go-live-readiness' && node.route?.endsWith('/private-pilot-go-live-readiness') && node.proofIds?.length >= 10), 'Manager Flow Graph must keep private-pilot go-live readiness after production operations receipts.');
assert(response.body.edges?.some((edge) => edge.source === 'privatePilotGoLiveReadiness' && edge.fromNodeId?.startsWith('production-operations-control-receipt-') && edge.toNodeId === 'private-pilot-go-live-readiness'), 'Manager Flow Graph must connect production operations control receipts into the go-live readiness command node.');
assert(response.body.nodes?.some((node) => node.id === 'production-launch-gap-register' && node.route?.endsWith('/production-launch-gap-register') && node.proofIds?.length >= 10), 'Manager Flow Graph must keep production launch gap register after production operations receipts.');
assert(response.body.edges?.some((edge) => edge.source === 'productionLaunchGapRegister' && edge.fromNodeId === 'production-operations-readiness' && edge.toNodeId === 'production-launch-gap-register'), 'Manager Flow Graph must connect production operations readiness into the production launch gap register.');
assert(response.body.nodes?.some((node) => node.id === 'production-launch-control-center' && node.route?.endsWith('/production-launch-control-center') && node.proofIds?.length >= 10), 'Manager Flow Graph must keep production launch control center after production operations receipts.');
assert(response.body.edges?.some((edge) => edge.source === 'productionLaunchControlCenter' && edge.fromNodeId === 'production-operations-readiness' && edge.toNodeId === 'production-launch-control-center'), 'Manager Flow Graph must connect production operations readiness into the production launch control center.');

progress('production deployment control receipt checks');
const productionDeploymentControlIds = [
  'access-control-enforced',
  'replay-protection',
  'audit-fail-closed',
  'scheduler-autostart',
  'real-persistence-adapter',
  'managed-evidence-custody-storage',
  'real-queue-adapter',
  'environment-promotion-audit',
  'rollback-plan-and-smoke-test',
  'deployment-change-approval',
  'production-domain-and-tls',
];
response = membershipApi.handle({
  method: 'POST',
  path: productionDeploymentControlReceiptPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: productionDeploymentControlReceiptPath,
    role: 'runtime-platform',
    userId: 'runtime-ops',
  }),
  body: {
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    reason: 'Record production deployment controls for environment promotion, rollback smoke test, change approval, domain/TLS, access, scheduler, persistence, custody, and queue cutover.',
    now: '2026-06-01T12:10:00.000Z',
    controls: productionDeploymentControlIds.map((controlId) => ({
      controlId,
      status: 'verified',
      evidenceId: `prod_deploy_${controlId}_receipt`,
      evidenceRoute: `https://deploy.example.test/hofs/${controlId}`,
      evidenceChecksum: `prod_deploy_${controlId}_checksum`,
      completedAt: '2026-06-01T12:09:30.000Z',
      ownerRole: controlId.includes('approval') ? 'operations-owner' : 'runtime-platform',
      detail: `Verified ${controlId} for production deployment hardening.`,
    })),
  },
});
assert(response.status === 200 && response.body.productionDeploymentControlReceipt?.schemaVersion === 'production-deployment-control-receipt/v1', 'Runtime platform must be able to record production deployment control receipts.');
assert(response.body.productionDeploymentControlReceipt.readyForPrivatePilotDeployment === true, 'Production deployment control receipt must inherit private-pilot deployment proof.');
assert(response.body.productionDeploymentControlReceipt.readyForProductionDeploymentControls === true, 'Production deployment control receipt must verify all required deployment controls.');
assert(response.body.productionDeploymentControlReceipt.readyForProductionDeployment === true, 'Production deployment control receipt must combine verified controls with private-pilot deployment proof.');
assert(response.body.productionDeploymentControlReceipt.verifiedControlIds.length === productionDeploymentControlIds.length, 'Production deployment control receipt must preserve every verified control id.');
assert(response.body.productionDeploymentControlReceipt.eventId && response.body.productionDeploymentControlReceipt.timelineLogId, 'Production deployment control receipt must write timeline and event proof.');
assert(response.body.productionDeploymentControlReceiptWorkflow?.readyForProductionDeployment === true, 'Production deployment control receipt workflow must become ready after all controls are verified.');
assert(response.body.managerReadyPackage?.productionDeploymentControlReceiptWorkflow?.readyForProductionDeployment === true, 'Manager Ready Package must embed production deployment readiness after deployment receipts.');
assert(response.body.managerReadyPackage?.summary?.productionDeploymentReadyForProduction === true, 'Manager Ready Package summary must expose production deployment readiness after receipt verification.');
assert(response.body.managerReadyPackage?.productionLaunchAudit?.productionDecision === 'no-go', 'Broader production launch audit must remain no-go even after deployment controls are receipted.');
assert(response.body.managerReadyPackage?.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'production-deployment-preflight' && row.ready === true && row.apiPath?.endsWith('/production-deployment-control-receipts')), 'Production launch control center must mark the deployment preflight row ready after deployment receipts.');
assert(response.body.managerReadyPackage?.productionLaunchControlCenter?.readyForProduction === false, 'Production launch control center must remain no-go after deployment receipts while broader controls are absent.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionDeploymentControlReceiptRoutes?.some((route) => route.apiPath?.endsWith('/production-deployment-control-receipts') && route.readyForProductionDeployment === true && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include production deployment control receipt routes with proof, timeline, and event links.');
assert(response.body.productionDeploymentControlReceiptSummary?.readyCount >= 1 && response.body.productionDeploymentControlReceiptSummary?.readyForProductionDeployment === true, 'Readiness Proof Map must summarize verified production deployment control receipts.');
assert(response.body.productionLaunchGapRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-gap-register') && route.productionOperationsControlsReady === true && route.productionDeploymentControlsReady === true && route.readyForProduction === false && route.proofIds?.length >= 10), 'Readiness Proof Map must keep production launch gap register after deployment receipts.');
assert(response.body.productionLaunchGapSummary?.productionOperationsControlsReady === true && response.body.productionLaunchGapSummary?.productionDeploymentControlsReady === true && response.body.productionLaunchGapSummary?.readyForProduction === false, 'Readiness Proof Map must show operations and deployment controls without closing the full production gap register.');
assert(response.body.productionLaunchControlCenterRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-control-center') && route.productionOperationsControlsReady === true && route.productionDeploymentControlsReady === true && route.readyForProduction === false && route.proofIds?.length >= 10), 'Readiness Proof Map must keep production launch control center after deployment receipts.');
assert(response.body.productionLaunchControlCenterSummary?.productionOperationsControlsReady === true && response.body.productionLaunchControlCenterSummary?.productionDeploymentControlsReady === true && response.body.productionLaunchControlCenterSummary?.readyForProduction === false, 'Readiness Proof Map must show deployment controls without closing the production launch control center.');

response = membershipApi.handle({
  method: 'GET',
  path: productionInfrastructureRehearsalPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionInfrastructureRehearsalPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionInfrastructureRehearsal?.domainRows?.some((row) => row.id === 'deployment-preflight' && row.productionReady === true && row.observed?.deploymentReceiptReady === true), 'Production infrastructure rehearsal must project production deployment receipts into the deployment domain row.');
assert(response.body.productionInfrastructureRehearsal?.managedCutoverGates?.some((gate) => gate.id === 'deployment-cutover' && gate.productionReady === true && gate.receiptReady === true && gate.evidenceTier === 'managed-production'), 'Production infrastructure rehearsal must project production deployment receipts into the managed deployment cutover gate.');
assert(response.body.productionInfrastructureRehearsal?.backendRoutes?.productionDeploymentControlReceipts?.endsWith('/production-deployment-control-receipts'), 'Production infrastructure rehearsal must expose the production deployment control receipt route.');
assert(response.body.productionInfrastructureRehearsal?.upstreamChecksums?.productionDeploymentControlReceiptWorkflow, 'Production infrastructure rehearsal must bind the deployment receipt workflow checksum.');
assert(response.body.productionInfrastructureRehearsal?.readyForProduction === false && !response.body.productionInfrastructureRehearsal?.productionBlockedRows?.some((row) => row.id === 'deployment-preflight'), 'Production infrastructure rehearsal must clear the deployment preflight blocker after deployment receipts while keeping broader production blocked.');
assert(response.body.productionInfrastructureRehearsal?.managedCutoverSummary?.productionReadyGateCount >= 3 && response.body.productionInfrastructureRehearsal?.managedCutoverSummary?.productionBlockedGateCount >= 1, 'Production infrastructure rehearsal managed cutover summary must advance after deployment receipts while preserving remaining production blockers.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes?.some((node) => node.subtype === 'production-deployment-control-receipt' && node.route?.endsWith('/production-deployment-control-receipts') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'production-deployment-control-receipt')), 'Manager Flow Graph must include a proofed production deployment control receipt node.');
assert(response.body.edges?.some((edge) => edge.source === 'productionDeploymentControlReceipts' && edge.toNodeId.startsWith('production-deployment-control-receipt-') && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect production deployment control receipts to the evidence ledger.');
assert(response.body.edges?.some((edge) => edge.source === 'productionDeploymentControlReceipts' && edge.fromNodeId?.startsWith('production-deployment-control-receipt-') && edge.toNodeId === 'production-launch-control-center'), 'Manager Flow Graph must connect production deployment receipts into the production launch control center.');
assert(response.body.edges?.some((edge) => edge.source === 'privatePilotGoLiveReadiness' && edge.fromNodeId?.startsWith('production-deployment-control-receipt-') && edge.toNodeId === 'private-pilot-go-live-readiness'), 'Manager Flow Graph must connect production deployment receipts into the go-live readiness command node.');
progress('production deployment control receipt projection ready');

progress('production security control receipt checks');
const productionSecurityControlIds = [
  'managed-identity-provider',
  'service-identity-boundary',
  'managed-kms-secret-manager',
  'database-backed-rbac',
  'centralized-security-audit',
  'session-replay-hardening',
];
response = membershipApi.handle({
  method: 'POST',
  path: productionSecurityControlReceiptPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: productionSecurityControlReceiptPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    actorRole: 'security-admin',
    actorId: 'security-lead',
    reason: 'Record managed identity, KMS, database RBAC, audit, service identity, and replay-hardening production evidence for the launch control center.',
    now: '2026-06-01T12:12:00.000Z',
    controls: productionSecurityControlIds.map((controlId) => ({
      controlId,
      status: 'verified',
      evidenceId: `prod_sec_${controlId}_receipt`,
      evidenceRoute: `https://security.example.test/hofs/${controlId}`,
      evidenceChecksum: `prod_sec_${controlId}_checksum`,
      completedAt: '2026-06-01T12:11:30.000Z',
      ownerRole: 'security-admin',
      detail: `Verified ${controlId} for production security hardening.`,
    })),
  },
});
assert(response.status === 200 && response.body.productionSecurityControlReceipt?.schemaVersion === 'production-security-control-receipt/v1', 'Security admin must be able to record production security control receipts.');
assert(response.body.productionSecurityControlReceipt.readyForProductionSecurityControls === true, 'Production security control receipt must verify all required security controls.');
assert(response.body.productionSecurityControlReceipt.readyForProductionSecurity === true, 'Production security control receipt must combine verified controls with the clean local security boundary.');
assert(response.body.productionSecurityControlReceipt.verifiedControlIds.length === productionSecurityControlIds.length, 'Production security control receipt must preserve every verified control id.');
assert(response.body.productionSecurityControlReceipt.eventId && response.body.productionSecurityControlReceipt.timelineLogId, 'Production security control receipt must write timeline and event proof.');
assert(response.body.productionSecurityControlReceiptWorkflow?.readyForProductionSecurity === true, 'Production security control receipt workflow must become ready after all controls are verified.');
assert(response.body.securityBoundary?.readyForProduction === true && response.body.securityBoundary?.production?.status === 'production-security-ready', 'Security boundary must become production-security ready after verified control receipts.');
assert(response.body.managerReadyPackage?.securityBoundary?.readyForProduction === true, 'Manager Ready Package must embed the updated production-security-ready boundary after security receipts.');
assert(response.body.managerReadyPackage?.summary?.productionSecurityReadyForProduction === true, 'Manager Ready Package summary must expose production security readiness after receipt verification.');
assert(response.body.managerReadyPackage?.productionLaunchAudit?.productionDecision === 'no-go', 'Broader production launch audit must remain no-go even after security controls are receipted.');
assert(response.body.managerReadyPackage?.productionLaunchControlCenter?.readyForProduction === false && response.body.managerReadyPackage?.productionLaunchControlCenter?.summary?.blockedControlCount >= 1, 'Production launch control center must remain no-go after security receipts while broader production controls are absent.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionSecurityControlReceiptRoutes?.some((route) => route.apiPath?.endsWith('/production-security-control-receipts') && route.readyForProductionSecurity === true && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include production security control receipt routes with proof, timeline, and event links.');
assert(response.body.productionSecurityControlReceiptSummary?.readyCount >= 1 && response.body.productionSecurityControlReceiptSummary?.readyForProductionSecurity === true, 'Readiness Proof Map must summarize verified production security control receipts.');
assert(response.body.productionLaunchControlCenterRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-control-center') && route.productionOperationsControlsReady === true && route.productionDeploymentControlsReady === true && route.productionSecurityControlsReady === true && route.readyForProduction === false && route.proofIds?.length >= 10), 'Readiness Proof Map must show operations, deployment, and security controls ready without closing the production launch control center.');
assert(response.body.productionLaunchControlCenterSummary?.productionOperationsControlsReady === true && response.body.productionLaunchControlCenterSummary?.productionDeploymentControlsReady === true && response.body.productionLaunchControlCenterSummary?.productionSecurityControlsReady === true && response.body.productionLaunchControlCenterSummary?.readyForProduction === false, 'Readiness Proof Map must summarize production security controls without production overclaim.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes?.some((node) => node.subtype === 'production-security-control-receipt' && node.route?.endsWith('/production-security-control-receipts') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'production-security-control-receipt')), 'Manager Flow Graph must include a proofed production security control receipt node.');
assert(response.body.edges?.some((edge) => edge.source === 'productionSecurityControlReceipts' && edge.toNodeId.startsWith('production-security-control-receipt-') && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect production security control receipts to the security boundary.');
assert(response.body.edges?.some((edge) => edge.source === 'productionSecurityControlReceipts' && edge.fromNodeId?.startsWith('production-security-control-receipt-') && edge.toNodeId === 'production-launch-control-center'), 'Manager Flow Graph must connect production security receipts into the production launch control center.');
progress('production security control receipt ready');

progress('production provider control receipt checks');
const productionProviderControlIds = [
  'provider-allowlist',
  'budget-and-rate-limits',
  'agent-tool-grants',
  'failure-retry-circuit-breaker',
  'provider-audit-and-cost-ledger',
  'encrypted-secret-vault',
  'source-safety-review',
  'source-snapshot-and-provider-receipts',
  'model-output-quality-review',
  'real-provider-eval-run',
  'managed-provider-audit-storage',
  'managed-provider-eval-storage',
  'centralized-provider-cost-alerting',
  'calibrated-release-policy',
  'provider-incident-runbook',
];
response = membershipApi.handle({
  method: 'POST',
  path: productionProviderControlReceiptPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: productionProviderControlReceiptPath,
    role: 'runtime-platform',
    userId: 'runtime-ops',
  }),
  body: {
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    reason: 'Record real provider eval, managed audit/eval storage, cost alerts, release policy, incident runbook, and provider rollout control evidence.',
    now: '2026-06-01T12:18:00.000Z',
    controls: productionProviderControlIds.map((controlId) => ({
      controlId,
      status: 'verified',
      evidenceId: `prod_provider_${controlId}_receipt`,
      evidenceRoute: `https://provider.example.test/hofs/${controlId}`,
      evidenceChecksum: `prod_provider_${controlId}_checksum`,
      completedAt: '2026-06-01T12:17:30.000Z',
      ownerRole: controlId.includes('incident') || controlId.includes('alert') || controlId.includes('storage') ? 'operations-owner' : 'runtime-platform',
      detail: `Verified ${controlId} for production provider rollout.`,
    })),
  },
});
assert(response.status === 200 && response.body.productionProviderControlReceipt?.schemaVersion === 'production-provider-control-receipt/v1', 'Runtime platform must be able to record production provider control receipts.');
assert(response.body.productionProviderControlReceipt.readyForPrivatePilotProvider === true, 'Production provider control receipt must inherit local provider and shadow eval proof.');
assert(response.body.productionProviderControlReceipt.readyForProductionProviderControls === true, 'Production provider control receipt must verify all required provider controls.');
assert(response.body.productionProviderControlReceipt.readyForProductionProvider === true, 'Production provider control receipt must combine verified controls with local provider proof.');
assert(response.body.productionProviderControlReceipt.verifiedControlIds.length === productionProviderControlIds.length, 'Production provider control receipt must preserve every verified control id.');
assert(response.body.productionProviderControlReceipt.eventId && response.body.productionProviderControlReceipt.timelineLogId, 'Production provider control receipt must write timeline and event proof.');
assert(response.body.productionProviderControlReceiptWorkflow?.readyForProductionProvider === true, 'Production provider control receipt workflow must become ready after all controls are verified.');
assert(response.body.managerReadyPackage?.productionProviderControlReceiptWorkflow?.readyForProductionProvider === true, 'Manager Ready Package must embed production provider readiness after provider receipts.');
assert(response.body.managerReadyPackage?.summary?.productionProviderReadyForProduction === true, 'Manager Ready Package summary must expose production provider readiness after receipt verification.');
assert(response.body.managerReadyPackage?.productionLaunchAudit?.productionDecision === 'no-go', 'Broader production launch audit must remain no-go even after provider controls are receipted.');
assert(response.body.managerReadyPackage?.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'provider-production-rollout' && row.ready === true && row.apiPath?.endsWith('/production-provider-control-receipts')), 'Production launch control center must mark the provider rollout row ready after provider receipts.');
assert(response.body.managerReadyPackage?.productionLaunchControlCenter?.readyForProduction === false, 'Production launch control center must remain no-go after provider receipts while broader controls are absent.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionProviderControlReceiptRoutes?.some((route) => route.apiPath?.endsWith('/production-provider-control-receipts') && route.readyForProductionProvider === true && route.proofIds?.length >= 10 && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include production provider control receipt routes with proof, timeline, and event links.');
assert(response.body.productionProviderControlReceiptSummary?.readyCount >= 1 && response.body.productionProviderControlReceiptSummary?.readyForProductionProvider === true, 'Readiness Proof Map must summarize verified production provider control receipts.');
assert(response.body.productionLaunchControlCenterRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-control-center') && route.productionOperationsControlsReady === true && route.productionDeploymentControlsReady === true && route.productionSecurityControlsReady === true && route.productionProviderControlsReady === true && route.productionEvidenceIntegrityReady === false && route.readyForProduction === false && route.proofIds?.length >= 10), 'Readiness Proof Map must show operations, deployment, security, and provider controls ready while evidence integrity keeps the production launch control center blocked.');
assert(response.body.productionLaunchControlCenterSummary?.productionOperationsControlsReady === true && response.body.productionLaunchControlCenterSummary?.productionDeploymentControlsReady === true && response.body.productionLaunchControlCenterSummary?.productionSecurityControlsReady === true && response.body.productionLaunchControlCenterSummary?.productionProviderControlsReady === true && response.body.productionLaunchControlCenterSummary?.productionEvidenceIntegrityReady === false && response.body.productionLaunchControlCenterSummary?.readyForProduction === false, 'Readiness Proof Map must summarize production provider controls without production evidence overclaim.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes?.some((node) => node.subtype === 'production-provider-control-receipt' && node.route?.endsWith('/production-provider-control-receipts') && node.proofIds?.length >= 10 && node.timelineLogIds?.length && node.eventIds?.length && node.attachments?.some((attachment) => attachment.type === 'production-provider-control-receipt')), 'Manager Flow Graph must include a proofed production provider control receipt node.');
assert(response.body.edges?.some((edge) => edge.source === 'productionProviderControlReceipts' && edge.toNodeId.startsWith('production-provider-control-receipt-') && edge.proofIds?.length >= 10 && edge.timelineLogIds?.length && edge.eventIds?.length), 'Manager Flow Graph must connect production provider control receipts to provider eval proof.');
assert(response.body.edges?.some((edge) => edge.source === 'productionProviderControlReceipts' && edge.fromNodeId?.startsWith('production-provider-control-receipt-') && edge.toNodeId === 'production-launch-control-center'), 'Manager Flow Graph must connect production provider receipts into the production launch control center.');
progress('production provider control receipt ready');

response = membershipApi.handle({
  method: 'GET',
  path: productionEvidenceIntegrityAuditPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionEvidenceIntegrityAuditPath,
    role: 'manager',
    userId: 'director',
  }),
});
const totalProductionControlCount = productionOperationsControlIds.length
  + productionDeploymentControlIds.length
  + productionSecurityControlIds.length
  + productionProviderControlIds.length;
assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1', 'Production evidence integrity audit must remain readable after all production receipts are recorded.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.verifiedControlCount === totalProductionControlCount, 'Production evidence integrity audit must count every receipted production control.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.missingControlCount === 0, 'Production evidence integrity audit must show no missing receipt controls after receipts are recorded.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.managedProductionControlCount === 0, 'Production evidence integrity audit must not treat local/test receipt evidence as managed-production proof.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.localRehearsalControlCount === totalProductionControlCount, 'Production evidence integrity audit must classify current receipt evidence as local rehearsal proof.');
assert(response.body.productionEvidenceIntegrityAudit.readyForProduction === false && response.body.productionEvidenceIntegrityAudit.readyForManagedProductionEvidence === false, 'Production evidence integrity audit must keep public production blocked until explicit managed-production evidence exists.');
assert(response.body.productionEvidenceIntegrityAudit.domainRows?.every((row) => row.verifiedControlCount === row.requiredControlCount && row.readyForManagedProductionEvidence === false), 'Production evidence integrity audit must separate full local receipt coverage from managed-production evidence readiness.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/production-launch-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/production-launch-audit`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'managed-production-evidence-integrity' && gate.passed === false), 'Production launch audit must keep managed-production evidence integrity failed after local/test receipts.');
assert(response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'managed-production-evidence-integrity'), 'Production launch audit must keep managed-production evidence integrity in blocker inventory after local/test receipts.');
assert(response.body.productionLaunchAudit?.summary?.managedProductionEvidenceIntegrityReady === false && response.body.productionLaunchAudit?.summary?.managedProductionEvidenceLocalControlCount === totalProductionControlCount, 'Production launch audit summary must expose local rehearsal receipt coverage without closing production evidence integrity.');

response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchGapRegisterPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionLaunchGapRegisterPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionLaunchGapRegister?.gapRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.status === 'blocked'), 'Production launch gap register must keep managed-production evidence integrity open after local/test receipts.');
assert(response.body.productionLaunchGapRegister.summary?.managedProductionEvidenceIntegrityReady === false && response.body.productionLaunchGapRegister.summary?.managedProductionEvidenceLocalControlCount === totalProductionControlCount, 'Production launch gap register summary must expose local rehearsal evidence as a gap.');

response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchControlCenterPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionLaunchControlCenterPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.ready === false && row.missing?.length > 0), 'Production launch control center must keep managed-production evidence integrity blocked after local/test receipts.');
assert(response.body.productionLaunchControlCenter.summary?.productionEvidenceIntegrityReady === false && response.body.productionLaunchControlCenter.summary?.productionEvidenceIntegrityLocalControlCount === totalProductionControlCount, 'Production launch control center summary must expose local rehearsal evidence as a production blocker.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityRoutes?.some((route) => route.apiPath?.endsWith('/production-evidence-integrity-audit') && route.verifiedControlCount === totalProductionControlCount && route.localRehearsalControlCount === totalProductionControlCount && route.readyForProduction === false), 'Readiness Proof Map must expose production evidence integrity routes without treating local rehearsal evidence as production proof.');
assert(response.body.productionEvidenceIntegritySummary?.localRehearsalControlCount === totalProductionControlCount && response.body.productionEvidenceIntegritySummary?.readyForManagedProductionEvidence === false, 'Readiness Proof Map must summarize local rehearsal evidence integrity before managed-production proof is recorded.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes?.some((node) => node.id === 'production-evidence-integrity-audit' && node.route?.endsWith('/production-evidence-integrity-audit') && node.status === 'blocked' && node.attachments?.some((attachment) => attachment.type === 'production-evidence-integrity-audit')), 'Manager Flow Graph must include a blocked production evidence integrity audit node after local receipt evidence.');
assert(response.body.edges?.some((edge) => edge.source === 'productionEvidenceIntegrityAudit' && edge.fromNodeId === 'production-evidence-integrity-audit' && edge.toNodeId === 'production-launch-control-center'), 'Manager Flow Graph must connect production evidence integrity audit into the production launch control center.');

progress('managed production evidence integrity upgrade checks');
const managedProductionReceiptBatches = [
  {
    path: productionOperationsControlReceiptPath,
    role: 'security-admin',
    userId: 'security-lead',
    actorRole: 'security-admin',
    actorId: 'security-lead',
    now: '2026-06-01T12:30:00.000Z',
    prefix: 'managed_ops',
    routePrefix: 'https://ops.hofsstudio.example',
    controlIds: productionOperationsControlIds,
  },
  {
    path: productionDeploymentControlReceiptPath,
    role: 'runtime-platform',
    userId: 'runtime-ops',
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    now: '2026-06-01T12:32:00.000Z',
    prefix: 'managed_deploy',
    routePrefix: 'https://deploy.hofsstudio.example',
    controlIds: productionDeploymentControlIds,
  },
  {
    path: productionSecurityControlReceiptPath,
    role: 'security-admin',
    userId: 'security-lead',
    actorRole: 'security-admin',
    actorId: 'security-lead',
    now: '2026-06-01T12:34:00.000Z',
    prefix: 'managed_sec',
    routePrefix: 'https://security.hofsstudio.example',
    controlIds: productionSecurityControlIds,
  },
  {
    path: productionProviderControlReceiptPath,
    role: 'runtime-platform',
    userId: 'runtime-ops',
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    now: '2026-06-01T12:36:00.000Z',
    prefix: 'managed_provider',
    routePrefix: 'https://provider.hofsstudio.example',
    controlIds: productionProviderControlIds,
  },
];
for (const batch of managedProductionReceiptBatches) {
  progress(`managed production receipt ${batch.prefix} starting`);
  response = membershipApi.handle({
    method: 'POST',
    path: batch.path,
    headers: signedHeadersFor({
      method: 'POST',
      path: batch.path,
      role: batch.role,
      userId: batch.userId,
    }),
    body: {
      actorRole: batch.actorRole,
      actorId: batch.actorId,
      reason: 'Record explicit managed-production evidence for production evidence integrity audit verification.',
      now: batch.now,
      includeReadModels: false,
      controls: batch.controlIds.map((controlId) => ({
        controlId,
        status: 'verified',
        evidenceId: `${batch.prefix}_${controlId}_receipt`,
        evidenceRoute: `${batch.routePrefix}/${controlId}`,
        evidenceChecksum: `${batch.prefix}_${controlId}_checksum`,
        evidenceEnvironment: 'managed-production',
        completedAt: batch.now,
        ownerRole: batch.actorRole,
        detail: `Verified ${controlId} with explicit managed-production evidence.`,
      })),
    },
  });
  assert(response.status === 200, `Managed-production receipt batch must be accepted for ${batch.path}.`);
  assert(response.body.readModels?.included === false && response.body.readModels?.managerReadyPackageRoute?.endsWith('/manager-ready-package'), `Managed-production receipt batch ${batch.prefix} must support deferred read-model refresh.`);
  progress(`managed production receipt ${batch.prefix} completed`);
}

response = membershipApi.handle({
  method: 'GET',
  path: productionEvidenceIntegrityAuditPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionEvidenceIntegrityAuditPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1', 'Production evidence integrity audit must remain readable after managed-production receipts are recorded.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.managedProductionControlCount === totalProductionControlCount, 'Production evidence integrity audit must count every explicit managed-production control.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.localRehearsalControlCount === 0, 'Production evidence integrity audit must let newer managed-production receipts supersede local rehearsal evidence.');
assert(response.body.productionEvidenceIntegrityAudit.readyForManagedProductionEvidence === true && response.body.productionEvidenceIntegrityAudit.readyForProduction === true, 'Production evidence integrity audit must become production-evidence-ready only after explicit managed-production evidence exists.');
assert(response.body.productionEvidenceIntegrityAudit.rows?.every((row) => row.evidenceTier === 'managed-production' && row.evidenceEnvironment === 'managed-production'), 'Production evidence integrity audit rows must preserve managed-production environment evidence.');
assert(response.body.productionEvidenceIntegrityAudit.domainRows?.every((row) => row.readyForManagedProductionEvidence === true), 'Production evidence integrity audit must mark every production control domain ready after explicit managed-production proof.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/production-launch-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/production-launch-audit`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'managed-production-evidence-integrity' && gate.passed === true), 'Production launch audit must pass managed-production evidence integrity after explicit proof.');
assert(!response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'managed-production-evidence-integrity'), 'Production launch audit must remove managed-production evidence integrity from blockers after explicit proof.');
assert(response.body.productionLaunchAudit?.productionDecision === 'no-go' && response.body.productionLaunchAudit?.summary?.managedProductionEvidenceIntegrityReady === true, 'Production launch audit must expose evidence integrity readiness while broader public production can remain no-go.');
const managedEvidenceProductionLaunchAuditChecksum = response.body.productionLaunchAudit?.checksum;

response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchGapRegisterPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionLaunchGapRegisterPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && !response.body.productionLaunchGapRegister?.gapRows?.some((row) => row.id === 'managed-production-evidence-integrity'), 'Production launch gap register must close the managed-production evidence integrity gap after explicit proof.');
assert(response.body.productionLaunchGapRegister.summary?.managedProductionEvidenceIntegrityReady === true && response.body.productionLaunchGapRegister.readyForProduction === false, 'Production launch gap register must expose evidence integrity closure without overclaiming broader production readiness.');

response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchControlCenterPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionLaunchControlCenterPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.ready === true), 'Production launch control center must mark managed-production evidence integrity ready after explicit proof.');
assert(response.body.productionLaunchControlCenter.summary?.productionEvidenceIntegrityReady === true && response.body.productionLaunchControlCenter.readyForProduction === false, 'Production launch control center must expose evidence integrity readiness while broader launch controls can still keep production no-go.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityRoutes?.some((route) => route.apiPath?.endsWith('/production-evidence-integrity-audit') && route.managedProductionControlCount === totalProductionControlCount && route.readyForManagedProductionEvidence === true), 'Readiness Proof Map must upgrade production evidence integrity routes after managed-production proof is recorded.');
assert(response.body.productionEvidenceIntegritySummary?.managedProductionControlCount === totalProductionControlCount && response.body.productionEvidenceIntegritySummary?.readyForProduction === true, 'Readiness Proof Map must summarize managed-production evidence readiness after explicit proof.');
assert(response.body.productionLaunchControlCenterRoutes?.some((route) => route.apiPath?.endsWith('/production-launch-control-center') && route.productionEvidenceIntegrityReady === true && route.productionEvidenceIntegrityManagedControlCount === totalProductionControlCount && route.readyForProduction === false), 'Readiness Proof Map must feed managed-production evidence integrity readiness into the production launch control center route.');
assert(response.body.productionLaunchControlCenterSummary?.productionEvidenceIntegrityReady === true && response.body.productionLaunchControlCenterSummary?.productionEvidenceIntegrityManagedControlCount === totalProductionControlCount, 'Readiness Proof Map launch control summary must expose managed-production evidence integrity readiness.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes?.some((node) => node.id === 'production-evidence-integrity-audit' && node.status === 'confirmed' && node.proofIds?.length >= totalProductionControlCount), 'Manager Flow Graph must upgrade the production evidence integrity audit node after managed-production proof.');
progress('managed production evidence integrity ready');

const productionLaunchApprovalInputs = [
  {
    role: 'manager',
    userId: 'director',
    approverId: 'director',
    approverName: 'Product Director',
    reason: 'Manager approves production launch governance only after managed-production evidence integrity is explicit.',
    now: '2026-06-01T12:38:00.000Z',
  },
  {
    role: 'security-admin',
    userId: 'security-lead',
    approverId: 'security-lead',
    approverName: 'Security Lead',
    reason: 'Security approves production launch governance with security receipts and evidence integrity available.',
    now: '2026-06-01T12:39:00.000Z',
  },
  {
    role: 'operations-owner',
    userId: 'ops-lead',
    approverId: 'ops-lead',
    approverName: 'Operations Lead',
    reason: 'Operations owner approves production launch governance after operations, deployment, provider, and managed-evidence controls are receipted.',
    now: '2026-06-01T12:40:00.000Z',
  },
];

for (const approvalInput of productionLaunchApprovalInputs) {
  response = membershipApi.handle({
    method: 'POST',
    path: launchApprovalPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: launchApprovalPath,
      role: approvalInput.role,
      userId: approvalInput.userId,
    }),
    body: {
      mode: 'production',
      decision: 'approved',
      approverRole: approvalInput.role,
      approverId: approvalInput.approverId,
      approverName: approvalInput.approverName,
      reason: approvalInput.reason,
      linkedAuditChecksum: managedEvidenceProductionLaunchAuditChecksum,
      now: approvalInput.now,
    },
  });
  assert(response.status === 200 && response.body.launchApproval?.schemaVersion === 'launch-approval/v1', `Production launch approval must be accepted for ${approvalInput.role}.`);
  assert(response.body.launchApproval.mode === 'production' && response.body.launchApproval.decision === 'approved', `Production launch approval must preserve production approval mode for ${approvalInput.role}.`);
}

assert(response.body.launchApprovalWorkflow?.readyForProduction === true, 'Launch approval workflow must mark production approval ready after Manager, security-admin, and operations-owner approvals.');
assert(response.body.launchApprovalWorkflow.modes?.some((mode) => mode.id === 'production' && mode.ready && mode.approvedRoles.includes('manager') && mode.approvedRoles.includes('security-admin') && mode.approvedRoles.includes('operations-owner')), 'Launch approval workflow must summarize all required production approver roles.');
assert(response.body.launchApprovalWorkflow.proofIds?.length >= 10 && response.body.launchApprovalWorkflow.timelineLogIds?.length >= 5 && response.body.launchApprovalWorkflow.eventIds?.length >= 5, 'Production launch approval workflow must aggregate private-pilot and production approval proof, timeline, and event ids.');
assert(response.body.managerReadyPackage?.launchApprovalWorkflow?.readyForProduction === true && response.body.managerReadyPackage?.summary?.launchApprovalProductionReady === true, 'Manager Ready Package must expose production launch approval readiness after the three-role approval.');
assert(response.body.managerReadyPackage?.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'production-launch-approval-ready' && gate.passed === true), 'Production launch audit must pass the production approval gate after three-role approval.');
assert(response.body.managerReadyPackage?.productionLaunchAudit?.productionDecision === 'no-go' && response.body.managerReadyPackage?.productionLaunchAudit?.readyForProduction === false, 'Production launch audit must keep broader public production no-go after approval while other production gates remain blocked.');

response = membershipApi.handle({
  method: 'GET',
  path: launchApprovalPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: launchApprovalPath,
    role: 'operations-owner',
    userId: 'ops-lead',
  }),
});
assert(response.status === 200 && response.body.launchApprovalWorkflow?.readyForProduction === true, 'Operations owner must be able to read the production launch approval workflow after approval.');
assert(response.body.launchApprovalWorkflow.summary?.productionApproved === true && response.body.launchApprovalWorkflow.summary?.productionMissingRoleCount === 0, 'Launch approval workflow summary must close production missing approver roles.');

response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchControlCenterPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: productionLaunchControlCenterPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'production-launch-approvals' && row.ready === true), 'Production launch control center must mark production launch approvals ready after three-role approval.');
assert(response.body.productionLaunchControlCenter.stageRows?.some((row) => row.id === 'production-approval' && row.ready === true), 'Production launch control center stage rows must mark production approval ready.');
assert(response.body.productionLaunchControlCenter.summary?.productionApprovalReady === true && response.body.productionLaunchControlCenter.readyForProduction === false, 'Production launch control center must expose production approval readiness while public production remains blocked.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.launchApprovalSummary?.productionApprovalCount >= 3 && response.body.launchApprovalSummary?.proofIds?.length >= 10, 'Readiness Proof Map must summarize production launch approval proof after three-role approval.');
assert(response.body.launchApprovalRoutes?.filter((route) => route.mode === 'production' && route.decision === 'approved').length >= 3, 'Readiness Proof Map must expose every production launch approval as a proof route.');
assert(response.body.productionLaunchControlCenterRoutes?.some((route) => route.productionApprovalReady === true && route.readyForProduction === false), 'Readiness Proof Map must feed production approval readiness into the production launch control center route.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes?.filter((node) => node.source === 'launchApprovals' && node.subtype === 'launch-approval' && node.importance === 'critical' && node.status === 'confirmed').length >= 3, 'Manager Flow Graph must render production launch approvals as critical confirmed governance nodes.');
assert(response.body.edges?.some((edge) => edge.source === 'launchApprovals' && edge.label === 'Release governance' && edge.eventIds?.length >= 1), 'Manager Flow Graph must connect production launch approvals into release-governance evidence.');
progress('production launch governance approval ready');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-snapshot`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-snapshot`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceSnapshot?.recordsByTable?.project_evidence_exports?.length >= 4, 'Production persistence snapshot must include project evidence export request, approval, and download-audit rows.');
assert(response.body.persistenceSnapshot.recordsByTable.project_evidence_exports.every((record) => record.data.schemaVersion === 'project-evidence-export/v1' && record.data.archiveChecksum && record.data.checksum), 'Project evidence export persistence rows must preserve schema version, archive checksum, and row checksum.');
assert(response.body.persistenceSnapshot.recordsByTable.private_pilot_release_candidates?.some((record) => record.data.schemaVersion === 'private-pilot-release-candidate/v1' && record.data.readyForPrivatePilotRelease === true && record.data.eventId && record.data.timelineLogId && record.data.packageChecksum), 'Production persistence snapshot must include private-pilot release candidate rows with proof links and package checksum.');
assert(response.body.persistenceSnapshot.recordsByTable.private_pilot_launch_runs?.some((record) => record.data.schemaVersion === 'private-pilot-launch-run/v1' && record.data.readyForPrivatePilotLaunch === true && record.data.eventId && record.data.timelineLogId && record.data.releaseCandidateChecksum), 'Production persistence snapshot must include private-pilot launch run rows with proof links and release candidate checksum.');
assert(response.body.persistenceSnapshot.recordsByTable.private_pilot_launch_health_checks?.some((record) => record.data.schemaVersion === 'private-pilot-launch-health-check/v1' && record.data.readyForPrivatePilotMonitoring === true && record.data.eventId && record.data.timelineLogId && record.data.launchRunChecksum), 'Production persistence snapshot must include private-pilot launch health rows with proof links and launch run checksum.');
assert(response.body.persistenceSnapshot.recordsByTable.private_pilot_acceptance_reports?.some((record) => record.data.schemaVersion === 'private-pilot-acceptance-report/v1' && record.data.readyForPrivatePilotAcceptance === true && record.data.eventId && record.data.timelineLogId && record.data.launchHealthCheckChecksum && record.data.managerFlowGraphChecksum && record.data.readinessProofMapChecksum), 'Production persistence snapshot must include private-pilot acceptance report rows with proof links and acceptance checksums.');
assert(response.body.persistenceSnapshot.recordsByTable.production_operations_control_receipts?.some((record) => record.data.schemaVersion === 'production-operations-control-receipt/v1' && record.data.readyForProductionOperations === true && record.data.eventId && record.data.timelineLogId && record.data.verifiedControlCount === productionOperationsControlIds.length), 'Production persistence snapshot must include production operations control receipt rows with proof links and verified control coverage.');
assert(response.body.persistenceSnapshot.recordsByTable.production_deployment_control_receipts?.some((record) => record.data.schemaVersion === 'production-deployment-control-receipt/v1' && record.data.readyForProductionDeployment === true && record.data.eventId && record.data.timelineLogId && record.data.verifiedControlCount === productionDeploymentControlIds.length), 'Production persistence snapshot must include production deployment control receipt rows with proof links and verified control coverage.');
assert(response.body.persistenceSnapshot.recordsByTable.production_security_control_receipts?.some((record) => record.data.schemaVersion === 'production-security-control-receipt/v1' && record.data.readyForProductionSecurity === true && record.data.eventId && record.data.timelineLogId && record.data.verifiedControlCount === productionSecurityControlIds.length), 'Production persistence snapshot must include production security control receipt rows with proof links and verified control coverage.');
assert(response.body.persistenceSnapshot.recordsByTable.production_provider_control_receipts?.some((record) => record.data.schemaVersion === 'production-provider-control-receipt/v1' && record.data.readyForProductionProvider === true && record.data.eventId && record.data.timelineLogId && record.data.verifiedControlCount === productionProviderControlIds.length), 'Production persistence snapshot must include production provider control receipt rows with proof links and verified control coverage.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-migration-plan`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-migration-plan`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceMigrationPlan.seedOrder.includes('private_pilot_release_candidates'), 'Migration plan must seed private-pilot release candidate rows after a candidate receipt is recorded.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('private_pilot_launch_runs'), 'Migration plan must seed private-pilot launch run rows after a launch receipt is recorded.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('private_pilot_launch_health_checks'), 'Migration plan must seed private-pilot launch health check rows after a health receipt is recorded.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('private_pilot_acceptance_reports'), 'Migration plan must seed private-pilot acceptance report rows after an acceptance report is recorded.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('production_operations_control_receipts'), 'Migration plan must seed production operations control receipt rows after operations controls are recorded.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('production_deployment_control_receipts'), 'Migration plan must seed production deployment control receipt rows after deployment controls are recorded.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('production_security_control_receipts'), 'Migration plan must seed production security control receipt rows after security controls are recorded.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('production_provider_control_receipts'), 'Migration plan must seed production provider control receipt rows after provider controls are recorded.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-migration-dry-run`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-migration-dry-run`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceMigrationDryRun.importedTableCounts.private_pilot_release_candidates > 0, 'Migration dry-run must import private-pilot release candidate rows.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.private_pilot_launch_runs > 0, 'Migration dry-run must import private-pilot launch run rows.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.private_pilot_launch_health_checks > 0, 'Migration dry-run must import private-pilot launch health check rows.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.private_pilot_acceptance_reports > 0, 'Migration dry-run must import private-pilot acceptance report rows.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.production_operations_control_receipts > 0, 'Migration dry-run must import production operations control receipt rows.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.production_deployment_control_receipts > 0, 'Migration dry-run must import production deployment control receipt rows.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.production_security_control_receipts > 0, 'Migration dry-run must import production security control receipt rows.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.production_provider_control_receipts > 0, 'Migration dry-run must import production provider control receipt rows.');

progress('autonomous cycle consistency loop starting');
const consistencyLoopPath = `/projects/${projectId}/autonomous-run-control/run-loop`;
response = membershipApi.handle({
  method: 'POST',
  path: consistencyLoopPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: consistencyLoopPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    now: '2026-06-01T19:10:00.000Z',
    maxSteps: 3,
    force: true,
    includeReadModels: false,
    useAgentAutonomousStrategy: true,
    submitAgentWorkArtifacts: true,
    reviewPendingSubmissions: true,
    respondToReviewObligations: true,
  },
});
assert(response.status === 200 && response.body.autonomousRunControlLoop?.schemaVersion === 'autonomous-run-control-loop-run/v1', 'Autonomous consistency loop must record a bounded loop receipt.');
assert(response.body.autonomousRunControlLoop.stepCount >= 3 && response.body.autonomousRunControlLoop.runReceiptIds?.length >= 3 && !response.body.autonomousRunControlLoop.failedStep, `Autonomous consistency loop must run at least three receipt-backed steps. Actual: ${response.body.autonomousRunControlLoop.stepCount}`);
progress('autonomous cycle consistency loop completed');

const consistencyPath = `/projects/${projectId}/autonomous-cycle-consistency`;
response = membershipApi.handle({
  method: 'GET',
  path: consistencyPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: consistencyPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.autonomousCycleConsistency?.schemaVersion === 'autonomous-cycle-consistency/v1', 'Project API must expose standalone autonomous cycle consistency.');
assert(response.body.autonomousCycleConsistency.readyForLocalPilotCycleConsistency === true && response.body.autonomousCycleConsistency.readyForProduction === false, `Autonomous cycle consistency must prove local N-step continuity without production overclaim. Actual: ${response.body.autonomousCycleConsistency.status}`);
assert(response.body.autonomousCycleConsistency.summary?.observedStepCount >= 3 && response.body.autonomousCycleConsistency.summary?.actionRunCount >= 3 && response.body.autonomousCycleConsistency.summary?.loopRunCount >= 1, 'Autonomous cycle consistency must summarize at least three action runs and one loop receipt.');
assert(response.body.autonomousCycleConsistency.summary?.missingRunReceiptCount === 0 && response.body.autonomousCycleConsistency.summary?.failedLocalRowCount === 0 && response.body.autonomousCycleConsistency.summary?.workerDeadLetterCount === 0, 'Autonomous cycle consistency must not report missing receipts, failed local rows, or worker dead letters.');
assert(response.body.autonomousCycleConsistency.consistencyRows?.some((row) => row.id === 'n-step-autonomous-loop-observed' && row.ready), 'Autonomous cycle consistency must prove the N-step loop row.');
assert(response.body.autonomousCycleConsistency.consistencyRows?.some((row) => row.id === 'loop-run-receipts-linked' && row.ready && row.proofIds.length >= 3), 'Autonomous cycle consistency must link loop receipts to action receipts.');
assert(response.body.autonomousCycleConsistency.consistencyRows?.some((row) => row.id === 'flow-proof-surfaces-linked' && row.ready), 'Autonomous cycle consistency must prove Flow Graph and Proof Map surfaces.');
assert(response.body.autonomousCycleConsistency.consistencyRows?.some((row) => row.id === 'worker-recovery-clean' && row.ready), 'Autonomous cycle consistency must prove worker recovery remains clean.');
assert(response.body.autonomousCycleConsistency.consistencyRows?.some((row) => row.id === 'production-autonomy-boundary' && row.productionBlocker && row.ready === false), 'Autonomous cycle consistency must keep public 24/7 production autonomy blocked.');
assert(response.body.autonomousCycleConsistency.backendRoutes?.autonomousCycleConsistency?.endsWith('/autonomous-cycle-consistency'), 'Autonomous cycle consistency must expose its own backend route.');

const runtimeAutonomyPath = `/projects/${projectId}/runtime-autonomy-status`;
response = membershipApi.handle({
  method: 'GET',
  path: runtimeAutonomyPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: runtimeAutonomyPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.runtimeAutonomyStatus?.schemaVersion === 'runtime-autonomy-status/v1', 'Project API must expose standalone Runtime Autonomy Status.');
assert(response.body.runtimeAutonomyStatus.readyForLocalAutonomy === true && response.body.runtimeAutonomyStatus.readyForUnattendedProduction === false, `Runtime Autonomy Status must prove local/private autonomy without production overclaim. Actual: ${response.body.runtimeAutonomyStatus.status}`);
assert(response.body.runtimeAutonomyStatus.gates?.some((row) => row.id === 'mission-runner-started' && row.ready), 'Runtime Autonomy Status must prove the C-side Mission Runner started A-side autonomy.');
assert(response.body.runtimeAutonomyStatus.gates?.some((row) => row.id === 'autopilot-session-restorable' && row.ready), 'Runtime Autonomy Status must prove Autopilot session recovery or completed-session proof.');
assert(response.body.runtimeAutonomyStatus.gates?.some((row) => row.id === 'worker-queue-recovery-clean' && row.ready), 'Runtime Autonomy Status must prove worker queue recovery stays clean.');
assert(response.body.runtimeAutonomyStatus.gates?.some((row) => row.id === 'queue-adapter-rehearsal-passed' && row.ready), 'Runtime Autonomy Status must prove queue adapter rehearsal readiness.');
assert(response.body.runtimeAutonomyStatus.gates?.some((row) => row.id === 'production-unattended-autonomy-blocked' && row.productionBlocker && row.ready === false), 'Runtime Autonomy Status must keep unattended production autonomy blocked.');
assert(response.body.runtimeAutonomyStatus.backendRoutes?.workerQueue?.endsWith('/worker-queue') && response.body.runtimeAutonomyStatus.backendRoutes?.schedulerStatus === '/workers/autonomous/status' && response.body.runtimeAutonomyStatus.backendRoutes?.autopilotDueWorker === '/workers/autopilot/due', 'Runtime Autonomy Status must expose worker queue and scheduler recovery routes.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.autonomousCycleConsistencySummary?.routeReady === true, 'Readiness Proof Map must summarize autonomous cycle consistency after a bounded loop.');
assert(response.body.autonomousCycleConsistencySummary?.readyForLocalPilotCycleConsistency === true && response.body.autonomousCycleConsistencySummary?.observedStepCount >= 3 && response.body.autonomousCycleConsistencySummary?.readyForProduction === false, 'Readiness Proof Map must preserve N-step autonomous consistency counts and production boundary.');
assert(response.body.autonomousCycleConsistencyRoutes?.some((route) => route.apiPath?.endsWith('/autonomous-cycle-consistency') && route.autonomousRunControlRoute?.endsWith('/autonomous-run-control') && route.productTeamOperatingLoopRoute?.endsWith('/product-team-operating-loop') && route.runtimeContractsRoute?.endsWith('/runtime-contracts') && route.runReceiptCount >= 3 && route.loopReceiptCount >= 1 && route.readyForLocalPilotCycleConsistency === true && route.productionBlocker === true && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map must expose autonomous cycle consistency proof route with loop counts, operating-loop, contract, proof, and production-boundary evidence.');
assert(response.body.runtimeAutonomyStatusSummary?.routeReady === true && response.body.runtimeAutonomyStatusSummary?.readyForLocalAutonomy === true && response.body.runtimeAutonomyStatusSummary?.readyForUnattendedProduction === false, 'Readiness Proof Map must summarize Runtime Autonomy Status without production overclaim.');
assert(response.body.runtimeAutonomyStatusRoutes?.some((route) => route.apiPath?.endsWith('/runtime-autonomy-status') && route.readyForLocalAutonomy === true && route.productionBlocked === true && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length && route.upstreamRoutes?.autopilotDueWorker === '/workers/autopilot/due'), 'Readiness Proof Map must expose Runtime Autonomy Status route with proof and scheduler recovery links.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
const consistencyGraph = response.body.managerFlowGraph || response.body;
const consistencyNode = consistencyGraph?.nodes?.find((node) => node.id === 'autonomous-cycle-consistency' && node.source === 'autonomousCycleConsistency');
const consistencyEdges = consistencyGraph?.edges?.filter((edge) => edge.source === 'autonomousCycleConsistency') || [];
const runtimeAutonomyNode = consistencyGraph?.nodes?.find((node) => node.id === 'runtime-autonomy-status' && node.source === 'runtimeAutonomyStatus');
const runtimeAutonomyEdges = consistencyGraph?.edges?.filter((edge) => edge.source === 'runtimeAutonomyStatus') || [];
assert(response.status === 200 && consistencyNode?.route?.endsWith('/autonomous-cycle-consistency') && consistencyNode.proofIds.length && consistencyNode.timelineLogIds.length && consistencyNode.eventIds.length, 'Manager Flow Graph must include a proofed autonomous cycle consistency node.');
assert(consistencyNode.attachments.some((attachment) => attachment.type === 'autonomous-cycle-consistency-loop' && attachment.ready === true) && consistencyNode.attachments.some((attachment) => attachment.type === 'autonomous-cycle-consistency-proof' && attachment.proofIds?.length && attachment.timelineLogIds?.length && attachment.eventIds?.length) && consistencyNode.attachments.some((attachment) => attachment.type === 'autonomous-cycle-consistency-worker' && attachment.ready === true) && consistencyNode.attachments.some((attachment) => attachment.type === 'autonomous-cycle-consistency-production-boundary' && attachment.status === 'production-blocked'), 'Manager Flow Graph autonomous consistency node must expose loop, proof, worker recovery, and production boundary attachments.');
assert(consistencyEdges.some((edge) => edge.fromNodeId === 'autonomous-run-control' && edge.toNodeId === 'autonomous-cycle-consistency') && consistencyEdges.some((edge) => edge.fromNodeId === 'product-team-operating-loop' && edge.toNodeId === 'autonomous-cycle-consistency') && consistencyEdges.some((edge) => edge.fromNodeId === 'runtime-contract-freeze' && edge.toNodeId === 'autonomous-cycle-consistency') && consistencyEdges.some((edge) => edge.fromNodeId.startsWith('autonomous-run-control-run-') && edge.toNodeId === 'autonomous-cycle-consistency'), 'Manager Flow Graph must connect Run Control, Operating Loop, Runtime Contracts, and run receipts into autonomous cycle consistency.');
assert(runtimeAutonomyNode?.route?.endsWith('/runtime-autonomy-status') && runtimeAutonomyNode.proofIds.length && runtimeAutonomyNode.timelineLogIds.length && runtimeAutonomyNode.eventIds.length, 'Manager Flow Graph must include a proofed Runtime Autonomy Status node.');
assert(runtimeAutonomyNode.attachments.some((attachment) => attachment.type === 'runtime-autonomy-c-a-handoff' && attachment.ready === true) && runtimeAutonomyNode.attachments.some((attachment) => attachment.type === 'runtime-autonomy-worker-recovery' && attachment.ready === true) && runtimeAutonomyNode.attachments.some((attachment) => attachment.type === 'runtime-autonomy-production-boundary' && attachment.status === 'production-blocked'), 'Manager Flow Graph Runtime Autonomy Status node must expose C/A handoff, worker recovery, and production boundary attachments.');
assert(runtimeAutonomyEdges.some((edge) => edge.toNodeId === 'runtime-autonomy-status' && ['autonomous-run-control', 'product-team-operating-loop', 'autonomous-cycle-consistency'].includes(edge.fromNodeId)), 'Manager Flow Graph must connect core C/A runtime nodes into Runtime Autonomy Status.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-ready-package`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-ready-package`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.autonomousCycleConsistency?.schemaVersion === 'autonomous-cycle-consistency/v1', 'Manager Ready Package must embed autonomous cycle consistency.');
assert(response.body.summary?.autonomousCycleConsistencyReady === true && response.body.summary?.autonomousCycleConsistencyObservedStepCount >= 3 && response.body.summary?.autonomousCycleConsistencyMissingRunReceiptCount === 0, 'Manager Ready Package summary must expose autonomous consistency readiness, step count, and missing receipt count.');

const persistedStoreSnapshot = JSON.parse(readFileSync(`${root}/store.json`, 'utf8'));
assert(Array.isArray(persistedStoreSnapshot.securityAccessAuditRecords), 'File-backed store snapshot must export backend security audit stream records.');
const persistedAcceptanceProject = persistedStoreSnapshot.projects.find((project) => project.id === projectId);
assert(persistedAcceptanceProject?.autonomousRunControlLoopLedger?.some((record) => record.schemaVersion === 'autonomous-run-control-loop-run/v1' && record.stepCount >= 3 && record.runReceiptIds?.length >= 3 && record.eventId && record.logId), 'File-backed store must persist N-step autonomous loop receipts with proof ids.');
assert(persistedAcceptanceProject?.autonomousRunControlRunLedger?.length >= 3, 'File-backed store must persist child autonomous action run receipts from the N-step loop.');
progress('autonomous cycle consistency persistence ready');
assert(persistedAcceptanceProject?.projectMembershipPolicy?.revision === 2, 'File-backed store must persist the latest project membership policy revision.');
assert(persistedAcceptanceProject?.projectMembershipAudit?.length >= 2, 'File-backed store must persist project membership policy audit entries.');
assert(persistedAcceptanceProject?.identitySessions?.some((session) => session.id === activeSecurityIdentitySessionId && session.status === 'active' && session.tokenHash), 'File-backed store must persist active identity-session hash rows.');
assert(persistedAcceptanceProject?.identitySessions?.some((session) => session.id === managerIdentitySessionId && session.status === 'revoked' && session.revokedAt), 'File-backed store must persist revoked identity-session rows.');
assert(persistedAcceptanceProject?.providerUsageLedger?.some((record) => record.operation === 'search:evidence' && record.allowed === true && record.eventId), 'File-backed store must persist provider usage ledger rows with event proof.');
assert(persistedAcceptanceProject?.providerEvalRuns?.some((record) => record.schemaVersion === 'provider-eval-run/v1' && record.readyForPrivatePilotProviderEval === true && record.eventId && record.timelineLogId), 'File-backed store must persist provider eval shadow replay rows with event and timeline proof.');
assert(persistedAcceptanceProject?.launchApprovals?.filter((record) => record.mode === 'private-pilot' && record.decision === 'approved').length >= 2, 'File-backed store must persist private-pilot launch approvals.');
assert(persistedAcceptanceProject?.projectEvidenceExports?.filter((record) => record.exportRequestId === exportRequestId).length >= 4, 'File-backed store must persist project evidence export request, approval, and download-audit rows.');
assert(persistedAcceptanceProject?.privatePilotReleaseCandidates?.some((record) => record.schemaVersion === 'private-pilot-release-candidate/v1' && record.readyForPrivatePilotRelease === true && record.eventId && record.timelineLogId && record.releaseChecksums?.projectEvidenceExportPackage), 'File-backed store must persist private-pilot release candidate receipts with proof and package checksum.');
assert(persistedAcceptanceProject?.privatePilotLaunchRuns?.some((record) => record.schemaVersion === 'private-pilot-launch-run/v1' && record.readyForPrivatePilotLaunch === true && record.eventId && record.timelineLogId && record.releaseCandidateChecksum), 'File-backed store must persist private-pilot launch run receipts with proof and release candidate checksum.');
assert(persistedAcceptanceProject?.privatePilotLaunchHealthChecks?.some((record) => record.schemaVersion === 'private-pilot-launch-health-check/v1' && record.readyForPrivatePilotMonitoring === true && record.eventId && record.timelineLogId && record.launchRunChecksum), 'File-backed store must persist private-pilot launch health check receipts with proof and launch run checksum.');
assert(persistedAcceptanceProject?.privatePilotAcceptanceReports?.some((record) => record.schemaVersion === 'private-pilot-acceptance-report/v1' && record.readyForPrivatePilotAcceptance === true && record.eventId && record.timelineLogId && record.launchHealthCheckChecksum && record.acceptanceChecksums?.managerFlowGraph && record.acceptanceChecksums?.readinessProofMap), 'File-backed store must persist private-pilot acceptance reports with proof, health, Flow Graph, and Proof Map checksums.');
assert(persistedAcceptanceProject?.productionOperationsControlReceipts?.some((record) => record.schemaVersion === 'production-operations-control-receipt/v1' && record.readyForProductionOperations === true && record.eventId && record.timelineLogId && record.verifiedControlIds?.length === productionOperationsControlIds.length), 'File-backed store must persist production operations control receipts with proof and verified control ids.');
assert(persistedAcceptanceProject?.productionDeploymentControlReceipts?.some((record) => record.schemaVersion === 'production-deployment-control-receipt/v1' && record.readyForProductionDeployment === true && record.eventId && record.timelineLogId && record.verifiedControlIds?.length === productionDeploymentControlIds.length), 'File-backed store must persist production deployment control receipts with proof and verified control ids.');
assert(persistedAcceptanceProject?.productionSecurityControlReceipts?.some((record) => record.schemaVersion === 'production-security-control-receipt/v1' && record.readyForProductionSecurity === true && record.eventId && record.timelineLogId && record.verifiedControlIds?.length === productionSecurityControlIds.length), 'File-backed store must persist production security control receipts with proof and verified control ids.');
assert(persistedAcceptanceProject?.productionProviderControlReceipts?.some((record) => record.schemaVersion === 'production-provider-control-receipt/v1' && record.readyForProductionProvider === true && record.eventId && record.timelineLogId && record.verifiedControlIds?.length === productionProviderControlIds.length), 'File-backed store must persist production provider control receipts with proof and verified control ids.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.length >= 11, 'File-backed store snapshot must persist backend security audit stream decisions.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.allowed === false && record.streamChecksum), 'File-backed security audit stream must persist denied decisions with checksums.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.every((record) => record.previousStreamHash && record.streamHash), 'File-backed security audit stream must persist hash-chain links.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.replay?.detected === true && record.streamChecksum), 'File-backed security audit stream must persist replay denials with checksums.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.membership?.verified === false && record.streamChecksum), 'File-backed security audit stream must persist membership denials with checksums.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.membership?.reason === 'project-membership-revoked' && record.membership?.revision === 2), 'File-backed security audit stream must persist membership revocation denials with policy revision.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.identitySession?.verified === true && record.identitySession?.sessionId === managerIdentitySessionId), 'File-backed security audit stream must persist identity-session verified access decisions.');
const auditLogPath = `${root}/store.json.security-audit.jsonl`;
assert(existsSync(auditLogPath), 'File-backed store must write an independent append-only security audit JSONL file.');
const auditLogRecords = readFileSync(auditLogPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
assert(auditLogRecords.length >= persistedStoreSnapshot.securityAccessAuditRecords.length, 'Append-only security audit JSONL file must contain all persisted audit stream records.');
assert(auditLogRecords.every((line) => line.auditLogVersion === 1 && line.writtenAt && line.record?.streamChecksum && line.record?.previousStreamHash && line.record?.streamHash), 'Append-only security audit JSONL lines must include version, write time, checksummed records, and hash-chain links.');
assert(auditLogRecords.some((line) => line.record?.allowed === false), 'Append-only security audit JSONL file must include denied decisions.');
assert(auditLogRecords.some((line) => line.record?.replay?.detected === true), 'Append-only security audit JSONL file must include replay denials.');
assert(auditLogRecords.some((line) => line.record?.membership?.verified === false), 'Append-only security audit JSONL file must include project membership denials.');
assert(auditLogRecords.some((line) => line.record?.membership?.reason === 'project-membership-revoked' && line.record?.membership?.revision === 2), 'Append-only security audit JSONL file must include project membership revocation denials.');
assert(auditLogRecords.some((line) => line.record?.identitySession?.verified === true && line.record?.identitySession?.sessionId === managerIdentitySessionId), 'Append-only security audit JSONL file must include identity-session verified access decisions.');

const persistedProjectState = readSmallTextFiles(root);
for (const secret of [FAKE_SEARCH_SECRET, FAKE_MODEL_SECRET, FAKE_SOURCE_SECRET, ACCESS_SIGNING_SECRET]) {
  assert(!persistedProjectState.includes(secret), `Acceptance Harness must not persist secret fixture value ${secret}.`);
}
assert(!persistedProjectState.includes(managerIdentitySessionToken), 'Acceptance Harness must not persist the revoked raw identity-session token.');
assert(!persistedProjectState.includes(activeSecurityIdentitySessionToken), 'Acceptance Harness must not persist the active raw identity-session token.');
assert(persistedProjectState.includes('[REDACTED]'), 'Acceptance Harness must prove secret-bearing fields are redacted before persistence.');

console.log('Product team acceptance scenario validation passed.');
process.exit(0);
