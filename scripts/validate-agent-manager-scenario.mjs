import {
  advanceAutonomousProjectCycle,
  appendProjectEvents,
  applyChatMessagesToAgentStates,
  attachMessageReceipts,
  backfillProjectEventLedger,
  createAutonomousCycleChatMessages,
  createAgentNetwork,
  createKickoffCharter,
  createKickoffRoleNegotiation,
  createLeaderAssignmentPackage,
  createLeaderElection,
  handleLeaderChatAssignment,
  handlePeerHandoff,
  handleFeatureChangeRequest,
  evaluateAutonomousSchedule,
  evaluateManagerScenarioReadiness,
  buildAgentChatReplies,
  EVENT_LEDGER_RETAINED_LIMIT,
  isLeaderAssignmentRequest,
  isPeerHandoffRequest,
  isFeatureChangeRequest,
  projectEventReplayProjection,
  publishAutonomousCycleChat,
  summarizeProjectEventLedger,
} from '../src/agents/agentRuntime.js';
import {
  addKickoffMeetingClarification,
  applyPeerManagementMatrix,
  buildNextActionResolution,
  buildPeerManagementMatrix,
  confirmKickoffMeetingLeader,
  confirmKickoffMeetingNextActions,
  createAgentProjectService,
  evaluateAgentWorkSchedule,
  hydrateAgentProject,
  runAgentWorkCycle,
  runDueAgentWorkCycles,
  runDueProjectAutonomousCycles,
  resolveProjectChatTargets,
  submitProjectMultiChannelChangeRequest,
} from '../src/agents/agentProjectService.js';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createAgentProjectMemoryStore } from '../src/agents/agentProjectStore.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const managerScenarioTmpFiles = [
  'provider-agent-work-cycle-api-store.json',
  'provider-agent-action-queue-api-store.json',
  'provider-autopilot-session-api-store.json',
  'provider-autopilot-due-api-store.json',
  'agent-manager-scenario-store.json',
  'agent-manager-api-store.json',
  'agent-contract-api-store.json',
  'agent-manager-due-worker-api-store.json',
  'agent-manager-http-store.json',
  'agent-manager-http-autostart-store.json',
  'agent-manager-kickoff-http-store.json',
];
const managerScenarioTmpDirectories = [
  'agent-manager-api-runtime',
  'agent-manager-api-workspace',
  'agent-manager-kickoff-http-runtime',
  'agent-manager-kickoff-http-workspace',
];
const preserveManagerScenarioTmp = process.env.HOFS_MANAGER_SCENARIO_PRESERVE_TMP === '1'
  || process.env.HOFS_KEEP_MANAGER_SCENARIO_TMP === '1';

function cleanupManagerScenarioTmp() {
  if (preserveManagerScenarioTmp) return;
  for (const fileName of managerScenarioTmpFiles) {
    const filePath = fileURLToPath(new URL(`../.tmp/${fileName}`, import.meta.url));
    rmSync(filePath, { force: true });
    rmSync(`${filePath}.security-audit.jsonl`, { force: true });
  }
  for (const directoryName of managerScenarioTmpDirectories) {
    rmSync(fileURLToPath(new URL(`../.tmp/${directoryName}`, import.meta.url)), {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}

cleanupManagerScenarioTmp();
process.on('exit', cleanupManagerScenarioTmp);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => {
    cleanupManagerScenarioTmp();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

const team = [
  { id: 'jobs', name: 'Steve Jobs', title: 'Product Visionary' },
  { id: 'turing', name: 'Alan Turing', title: 'System Architect' },
  { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
  { id: 'musk', name: 'Elon Musk', title: 'Execution Driver' },
  { id: 'confucius', name: 'Confucius', title: 'Consensus Steward' },
];

const projectId = 'scenario_validation_project';
const projectName = 'Manager Scenario Validation';
const brief = [
  projectName,
  'Kickoff meeting, role clarification, Leader election, group chat task assignment, 24/7 work, timeline proof, and Google Chat feature change.',
].join(' ');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(value, pattern, message) {
  assert(pattern.test(value), `${message}: ${value}`);
}

const scenarioStartedAt = Date.now();

function checkpoint(label) {
  if (process.env.HOFS_TRACE_MANAGER_SCENARIO !== '0') {
    const elapsedSeconds = ((Date.now() - scenarioStartedAt) / 1000).toFixed(1);
    console.error(`[manager-scenario +${elapsedSeconds}s] ${label}`);
  }
}

function hasContiguousSequences(events = []) {
  return events.every((event, index) => index === 0 || event.sequence === events[index - 1].sequence + 1);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function waitForCondition(read, predicate, message, { timeoutMs = 5000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await read();
    if (predicate(lastValue)) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  assert(false, message);
  return lastValue;
}

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/agents/agentProjectService.js', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../src/agents/agentProjectApi.js', import.meta.url), 'utf8');
const httpServerSource = readFileSync(new URL('../src/agents/agentProjectHttpServer.js', import.meta.url), 'utf8');
const workerQueueAdapterSource = readFileSync(new URL('../src/agents/workerQueueAdapter.js', import.meta.url), 'utf8');
const agentProjectServerSource = readFileSync(new URL('./agent-project-server.mjs', import.meta.url), 'utf8');
const packageSource = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const productTeamAcceptanceSource = readFileSync(new URL('./validate-product-team-acceptance-scenario.mjs', import.meta.url), 'utf8');
const backendUiValidationSource = readFileSync(new URL('./validate-manager-backend-ui.mjs', import.meta.url), 'utf8');
const privatePilotUiValidationSource = existsSync(new URL('./validate-manager-private-pilot-ui.mjs', import.meta.url))
  ? readFileSync(new URL('./validate-manager-private-pilot-ui.mjs', import.meta.url), 'utf8')
  : '';
assert(!appSource.includes("false && initiationStep === 'meeting'"), 'Initiation meeting UI must not be disabled by a false guard.');
assert(appSource.includes('meetingTranscript.map'), 'Initiation meeting UI must render runtime-generated meeting transcript entries.');
assert(appSource.includes('Heard by'), 'Initiation meeting UI must expose which Agents heard each transcript turn.');
assert(appSource.includes('queueRoomChangeDiscussion'), 'War Room meeting changes must be animated back into the meeting transcript.');
assert(appSource.includes("source: 'war-room-meeting-change-request'"), 'War Room meeting changes must enter the same change ledger path as chat changes.');
assert(appSource.includes('room_change_user_'), 'War Room meeting change requests must be mirrored into group chat before Agent discussion.');
assert(appSource.includes('focusedChatProofIds') && appSource.includes('Proof focus:'), 'Chat proof navigation must highlight exact evidence messages.');
assert(appSource.includes('focusedTimelineProofIds') && appSource.includes('Timeline proof focus:'), 'Timeline proof navigation must highlight exact evidence logs.');
assert(appSource.includes('data-chat-proof-id') && appSource.includes('scrollIntoView'), 'Chat proof navigation must auto-scroll to the exact evidence message.');
assert(appSource.includes('data-timeline-event-id') && appSource.includes('timelineViewportRef'), 'Timeline proof navigation must auto-pan toward the exact evidence node.');
assert(appSource.includes('timeline-evidence-detail') && appSource.includes('Source Channel') && appSource.includes('Receipts') && appSource.includes('Direct Targets') && appSource.includes('directTargetIds: log.directTargetIds'), 'Timeline detail must expose channel, receipt, and direct-target evidence for runtime events.');
assert(appSource.includes('Group Chat Transcript Index') && appSource.includes('group-chat-transcript-index') && appSource.includes('Message Count') && appSource.includes('Archived Proofs') && appSource.includes('Latest Speaker') && appSource.includes('Receipt Coverage') && appSource.includes('Direct Mentions'), 'Project dashboard must expose a group-chat transcript index with counts, archived proof recovery, latest speaker, receipts, and direct mentions.');
assert(appSource.includes('channelTranscriptRows') && appSource.includes('projectTranscriptMessages') && appSource.includes('recoveredProofIdsByChannel') && appSource.includes('Open transcript') && appSource.includes('transcript-channel-'), 'Group Chat Transcript Index must derive project-scoped channel rows, recover archived proof ids, and open exact transcript proof.');
assert(appSource.includes('syncBackendProjectTranscripts') && appSource.includes('/transcripts') && appSource.includes('transcriptIndex') && appSource.includes('transcriptChannels') && appSource.includes('backend-sync-transcripts') && appSource.includes('Sync transcripts') && appSource.includes('backendTranscriptReadModelMissing') && appSource.includes('backend-transcript-index-required') && appSource.includes('browser-local chat recovery is suppressed'), 'Group Chat Transcript Index must consume backend transcript read models when online, show backend-required missing state, and avoid treating browser chat history as the only collaboration source.');
assert(appSource.includes("cache: 'no-store'"), 'Backend read-model requests must bypass browser HTTP cache so proof navigation validates current backend evidence.');
assert(appSource.includes('recoverProofMessages') && appSource.includes('ensureProofMessagesAvailable'), 'Offline/sample chat proof navigation must retain recovered archived proof messages.');
assert(appSource.includes('shouldRequireBackendProofTranscript') && appSource.includes('transcriptSyncContainsProofIds') && appSource.includes('proofReady === false') && appSource.includes('backend-proof-transcript-required') && appSource.includes('Backend proof transcript missing; local recovery suppressed') && appSource.includes('Backend-online real projects require transcript proof from the backend.') && !appSource.includes('localChatContainsProofIds'), 'Backend-online real project proof navigation must sync backend transcripts and fail closed without local recovered or cached proof focus when backend proof is missing.');
assert(appSource.includes('shouldRequireBackendTimelineProof') && appSource.includes('timelineSyncContainsProofIds') && appSource.includes('ensureTimelineEventsAvailable') && appSource.includes('backend-proof-timeline-required') && appSource.includes('Backend timeline proof missing; local timeline focus suppressed') && appSource.includes('Backend-online real projects require timeline/event proof from the backend.') && appSource.includes('const openProjectTimelineProof = async'), 'Backend-online real project timeline proof navigation must sync backend timeline/events and fail closed instead of focusing stale browser timeline state.');
assert(appSource.includes('submission-chat-proof-') && appSource.includes('Submission chat proof') && appSource.includes('submission-timeline-proof-') && appSource.includes('Submission timeline proof'), 'Manager Dashboard submission rows must expose direct chat and timeline proof exits for Agent-submitted artifacts.');
assert(appSource.includes('chatProofIdsFromRow') && appSource.includes('row.message?.id') && appSource.includes('row.sourceMessageId') && appSource.includes('isChatProofId') && !appSource.includes('[row.messageId, ...(row.proofIds || [])]'), 'Submission and governance-row chat proof exits must filter real transcript message fields instead of mixing timeline, event, artifact, or checksum proof ids.');
assert(appSource.includes('chatProofIdsFromNode') && appSource.includes('const selectedChatProofIds = selectedNode ? chatProofIdsFromNode(selectedNode) : []') && !appSource.includes('!(selectedNode.timelineLogIds || []).includes(id)'), 'Manager Flow Graph node chat proof exits must filter to backend transcript message ids instead of passing mixed timeline, event, artifact, or checksum proof ids.');
assert(appSource.includes('chatProofIdsFromIds') && appSource.includes('m_') && appSource.includes('manager_demo_') && appSource.includes('leader_assign_') && appSource.includes('change_discuss_') && appSource.includes('agent_management_') && appSource.includes('assign_') && appSource.includes('ack_') && !appSource.includes('openProjectChatProof(activeProject, row.proofIds') && !appSource.includes('const chatIds = row.proofIds || []'), 'Manager governance chat proof exits must route through transcript-id filters that include real runtime transcript ids instead of passing generic proof ids directly into chat proof navigation.');
assert(appSource.includes('transcriptProofIdsFromRow') && appSource.includes('const transcriptProofIds = transcriptProofIdsFromRow(row)'), 'Transcript index proof exits must use transcript-derived message ids rather than the generic governance proof filter.');
assert(appSource.includes('project.initiation?.roleNegotiation?.transcript') && appSource.includes("String(log.id || '').startsWith('log_')"), 'Recovered proof messages must be rebuilt from kickoff transcripts and timeline logs.');
assert((appSource.match(/openProjectChatProof\(activeProject/g) || []).length >= 20 && appSource.includes('await ensureProofMessagesAvailable(project, ids'), 'Every dashboard chat proof button must route through the backend-aware proof opener.');
assert(!appSource.includes('manager_demo_assign_${index}') && !appSource.includes('manager_demo_change_${index}'), 'Manager demo must preserve runtime message ids so task proof links resolve.');
assert(appSource.includes("dataSource: 'sample-fixture'") && appSource.includes('sampleFixtureMeta') && appSource.includes('project-sample-fixture-banner') && appSource.includes('Load Sample Fixture') && appSource.includes('Sample fixture only / not a real project path'), 'Manager demo must be labeled as a sample fixture and kept visibly separate from the real project path.');
assert(appSource.includes("requestAgentBackend('/product-team-missions'") && appSource.includes('productTeamMissionRun') && appSource.includes('Product Team Mission Runner approved kickoff and started backend autonomy'), 'Real initiation approval must dispatch through the backend Product Team Mission Runner boundary.');
assert(appSource.includes("requestAgentBackend('/kickoff-meetings'") && appSource.includes('initiationMeetingSession') && appSource.includes('initiation-meeting-session-proof'), 'Real initiation flow must create a durable kickoff meeting session before approval.');
assert(appSource.includes('kickoffMeetingId: sessionId || undefined') && appSource.includes('reuseExistingKickoffMeeting: Boolean(sessionId)') && serviceSource.includes('reuseExistingKickoffMeeting') && serviceSource.includes('reusedKickoffMeeting'), 'Real initiation approval must reuse the saved kickoff meeting session through the Product Team Mission Runner when available.');
assert(appSource.includes('backend-product-team-mission-runs-snapshot') && appSource.includes('backendProductTeamMissionRuns') && appSource.includes('backendLatestProductTeamMissionRun') && appSource.includes('Mission route:'), 'Backend Manager Snapshot must render Product Team Mission Runner receipts and routes after initiation approval.');
assert(appSource.includes('backend-product-team-mission-chat-proof') && appSource.includes('backend-product-team-mission-timeline-proof') && appSource.includes('backend-product-team-mission-flow-node') && serviceSource.includes('meeting.evidence?.roleTranscriptIds'), 'Backend Manager Snapshot must let the Manager jump from Mission Runner receipt to chat proof, timeline proof, and the Flow Graph mission node.');
assert(appSource.includes('refreshProjectInitiationReadModels') && appSource.includes('kickoffReadModelRefresh') && appSource.includes('readRoutes.projectRoute') && appSource.includes('readRoutes.mainTranscriptRoute') && appSource.includes('readRoutes.timelineRoute') && appSource.includes('readRoutes.eventsRoute') && appSource.includes('includeReadModels: false'), 'React initiation approval must consume receipt-first kickoff responses and refresh project/transcript/timeline read models from backend routes.');
assert(serviceSource.includes('kickoff-generation-provenance/v1') && serviceSource.includes('productionClaim') && serviceSource.includes('deterministic-validation') && serviceSource.includes('model-provider-backed'), 'Kickoff meeting generation must label deterministic validation fallback separately from provider-backed model meetings.');
assert(appSource.includes('initiation-meeting-generation-source') && appSource.includes('initiation-result-generation-source') && appSource.includes('validation fallback') && appSource.includes('provider-backed model'), 'Initiation UI must expose kickoff generation provenance instead of hiding deterministic/model fallback status.');
assert(appSource.includes('kickoff-dashboard-generation-source') && appSource.includes('kickoffGenerationProvenance') && appSource.includes('Kickoff Generation Source'), 'Project dashboard must keep kickoff generation provenance visible after approval, not only during initiation.');
assert(appSource.includes('isDevelopmentInitiationFallbackEnabled') && appSource.includes('No local fallback project was created.') && appSource.includes('local-kickoff-development-fallback') && appSource.includes('Backend initiation approval failed'), 'Backend-connected initiation must fail closed by default and keep local project creation behind an explicit development fallback flag.');
assert(appSource.includes('isDevelopmentFallbackSwitchEnabled') && appSource.includes('if (!import.meta.env?.DEV) return false;') && appSource.includes("window[windowFlag] === true") && appSource.includes("import.meta.env?.[envFlag] === 'true'"), 'Explicit development fallback switches must be ignored by production builds so browser storage or console flags cannot turn real backend failures into local success.');
assert(appSource.includes('initiation-backend-error'), 'Backend-connected initiation failures must be visible in the initiation flow instead of silently creating a local project.');
assert(!appSource.includes('Backend initiation failed, used local runtime'), 'Backend-connected initiation must not silently create local fallback projects by default.');
assert(appSource.includes('start-initiation-button') && appSource.includes('initiation-approve-create'), 'Real initiation flow must expose stable UI hooks for backend-connected approval validation.');
assert(appSource.includes('initiation-director-decisions') && appSource.includes('Confirmed Team') && appSource.includes('Confirmed Leader Marker') && appSource.includes('First Execution Plan') && appSource.includes('leader-candidate-'), 'Real initiation result must expose explicit Director decisions for team, Leader marker, and next execution plan.');
assert(appSource.includes('initiation-meeting-leader-slate') && appSource.includes('initiation-meeting-leader-resolution') && appSource.includes('/leader') && appSource.includes('Manager confirmed in meeting'), 'Real initiation meeting must let managers persist the Leader confirmation during the campaign stage.');
assert(appSource.includes('initiationActionDrafts') && appSource.includes('initiation-next-action-') && appSource.includes('initiation-add-next-action'), 'Real initiation result must let managers edit first execution next actions before approval.');
assert(appSource.includes('initiation-meeting-next-actions') && appSource.includes('initiation-meeting-next-action-') && appSource.includes('initiation-meeting-save-next-actions') && appSource.includes('initiation-meeting-next-action-resolution') && appSource.includes('/next-actions') && appSource.includes('These become the first Leader assignments after approval'), 'Real initiation meeting must let managers persist first execution action resolution during the meeting.');
assert(appSource.includes('initiation-meeting-director-clarification') && appSource.includes('initiation-meeting-role-question-list') && appSource.includes('role questions answered') && appSource.includes('initiation-meeting-save-clarification') && appSource.includes('/clarify'), 'Real initiation meeting must let managers answer specific Agent role questions before approval.');
assert(appSource.includes('const submitInitiationMeetingInput = async') && appSource.includes('Kickoff meeting input saved through backend clarification') && appSource.includes('Initiation meeting input must be attached to a backend kickoff meeting session.') && appSource.includes('No local mock meeting response was saved.') && !appSource.includes('runRoomSimulation(text, meetingProject);'), 'Initiation meeting free input must persist as backend kickoff clarification instead of generating local mock meeting turns.');
assert(appSource.includes('initiationConfirmedTeamIds') && appSource.includes('initiation-meeting-confirmed-team-') && appSource.includes('Removed after meeting'), 'Real initiation meeting must let managers finalize the project team during the meeting.');
assert(serviceSource.includes("trigger: 'initiation-approval'") && serviceSource.includes('initiation-approved-first-work-pulse'), 'Real initiation approval must immediately start the first autonomous work pulse.');
assert(serviceSource.includes('First Pulse'), 'Real initiation approval must mirror the first autonomous work pulse into group chat.');
assert(!appSource.includes('role_negotiation_${Date.now()}') && !appSource.includes('election_${Date.now()}'), 'Real initiation chat must preserve runtime kickoff transcript ids.');
assert(!appSource.includes('manager_demo_role_${index}') && !appSource.includes('manager_demo_election_${index}'), 'Manager demo kickoff chat must preserve runtime kickoff transcript ids.');
assert(appSource.includes('kickoffCharterProofIds') && appSource.includes('Kickoff chat proof'), 'Kickoff charter must offer a direct jump back to the kickoff group chat evidence.');
assert(appSource.includes('kickoff-brief-alignment') && appSource.includes('Kickoff Brief Alignment') && appSource.includes('Project Brief') && appSource.includes('Brief Heard By') && appSource.includes('Brief proof') && appSource.includes('Role response proof'), 'Project dashboard must expose Director brief alignment before role questions and self-nominations.');
assert(appSource.includes('kickoff-confirmed-team-matrix') && appSource.includes('Confirmed Team Matrix') && appSource.includes('Director-selected roster persisted to project state and kickoff charter') && appSource.includes('Team timeline proof'), 'Project dashboard must expose the Director-confirmed team roster with project-state, charter, and timeline proof.');
assert(appSource.includes('kickoff-meeting-flow') && appSource.includes('Kickoff Meeting Flow') && appSource.includes('Role Clarification') && appSource.includes('Self Nominations') && appSource.includes('Peer Hearing') && appSource.includes('Leader Campaign') && appSource.includes('Director Confirmation') && appSource.includes('Leader Marker'), 'Project dashboard must expose the kickoff meeting flow from role clarification through Director-confirmed Leader marker.');
assert(appSource.includes('kickoffMeetingFlow') && appSource.includes('roleHearingCount') && appSource.includes('leaderHearingCount') && appSource.includes('leaderElectionResolution') && appSource.includes('leaderMarkerPersisted') && appSource.includes('Kickoff meeting proof'), 'Kickoff Meeting Flow must derive peer-hearing, Leader election resolution, and Leader-marker proof from project state and offer a chat proof jump.');
assert(serviceSource.includes('generationProvenance: kickoffGenerationProvenance') && serviceSource.includes('project.initiation?.generationProvenance') && serviceSource.includes('charter?.evidence?.generationProvenance'), 'Backend kickoff approval and Manager Dashboard read model must preserve kickoff generation provenance after project creation.');
assert(appSource.includes('kickoff-conversation-flow') && appSource.includes('Conversation Evidence') && appSource.includes('Conversation proof'), 'Kickoff Meeting Flow must expose concrete conversation rows and proof jumps.');
assert(appSource.includes('kickoff-hearing-matrix') && appSource.includes('Kickoff Hearing Matrix') && appSource.includes('Role Questions Heard') && appSource.includes('Self Nominations Heard') && appSource.includes('Leader Campaign Hearing') && appSource.includes('Heard By:') && appSource.includes('Hearing proof'), 'Kickoff Meeting Flow must expose a hearing matrix that maps every role question, self-nomination, and Leader campaign turn to peer receipts and proof jumps.');
assert(serviceSource.includes('hearingMatrixRows') && serviceSource.includes('coverageComplete') && serviceSource.includes('heardLabel'), 'Backend project dashboard must include kickoff hearing matrix rows with named receipt coverage.');
assert(serviceSource.includes('directorBriefMessage') && serviceSource.includes('directorBriefId') && serviceSource.includes('briefAlignment'), 'Backend kickoff flow must persist the Director project brief into group chat and manager dashboard brief alignment.');
assert(serviceSource.includes('confirmedTeamMatrixRows') && serviceSource.includes('confirmedTeamProofLogIds') && serviceSource.includes('inKickoffCharter'), 'Backend manager dashboard must expose the Director-confirmed team matrix from kickoff charter and project state.');
assert(readFileSync(new URL('../src/agents/agentRuntime.js', import.meta.url), 'utf8').includes('kickoff-director-brief') && readFileSync(new URL('../src/agents/agentRuntime.js', import.meta.url), 'utf8').includes('directorBriefIds') && readFileSync(new URL('../src/agents/agentRuntime.js', import.meta.url), 'utf8').includes('briefHearingEdges'), 'Kickoff charter and event ledger must retain Director brief evidence and hearing edges.');
assert(appSource.includes('Kickoff Execution Flow') && appSource.includes('Meeting decisions to first 24/7 work pulse') && appSource.includes('Next Action Resolution') && appSource.includes('kickoff-next-action-resolution') && appSource.includes('kickoff-next-action-agent-receipts') && appSource.includes('Agent receipts:') && appSource.includes('First pulse chat proof') && appSource.includes('First pulse timeline proof'), 'Project dashboard must expose kickoff execution flow from confirmed next actions to Agent receipts and first autonomous pulse.');
assert(appSource.includes('all-agent-startup-matrix') && appSource.includes('All-Agent Startup Matrix') && appSource.includes('Every confirmed Agent enters a fixed routine') && appSource.includes('Startup timeline proof') && appSource.includes('Startup Agents') && appSource.includes('Routine Plan') && appSource.includes('Startup Proof'), 'Project dashboard must expose all-Agent startup, fixed routine, and next-run queue proof after kickoff approval.');
assert(appSource.includes('allAgentStartupRows') && appSource.includes('allAgentsStarted') && appSource.includes('allAgentsScheduled') && appSource.includes('startupProofTypes') && appSource.includes('hasFirstPulsePlan'), 'Kickoff execution flow must derive all-Agent startup, scheduling, first-pulse, and routine-proof coverage.');
assert(serviceSource.includes('allAgentStartupRows') && serviceSource.includes('allAgentsStarted') && serviceSource.includes('allAgentsScheduled') && serviceSource.includes('startupProofTypes') && serviceSource.includes('hasFirstPulsePlan'), 'Backend manager dashboard must expose all-Agent startup, scheduling, first-pulse, and routine-proof coverage.');
assert(readFileSync(new URL('../src/agents/agentRuntime.js', import.meta.url), 'utf8').includes('scheduledNextRunAt') && readFileSync(new URL('../src/agents/agentRuntime.js', import.meta.url), 'utf8').includes('nextAgentRunAt: scheduledNextRunAt'), 'Autonomous project cycles must schedule the next Agent run on every Agent state.');
assert(appSource.includes('submitProjectChatMessage') && appSource.includes('submitProjectMeetingMessage'), 'App chat and meeting inputs must dispatch through the backend-oriented project service boundary.');
assert(serviceSource.includes('resolveProjectChatTargets') && serviceSource.includes("text.matchAll(/@([A-Za-z0-9_-]+)/g)"), 'Project service must resolve @mentions against the active project team.');
assert(!serviceSource.includes('const targets = [...text.matchAll(/@([A-Za-z0-9_]+)/g)]'), 'Project service target parsing must not truncate spaced Agent names.');
assert(appSource.includes('changeTimelineProofIds') && appSource.includes('Change chat proof') && appSource.includes('Change timeline proof'), 'Change Ledger must offer direct chat and timeline proof jumps.');
assert(appSource.includes('change-stage-') && appSource.includes('Source Request') && appSource.includes('Team Discussion') && appSource.includes('Owner Confirmation') && appSource.includes('Owner Plan') && appSource.includes('Team Sync') && appSource.includes('change.confirmationMessageId') && appSource.includes('change.syncMessageId'), 'Change Ledger must visibly stage source request, team discussion, owner confirmation, owner plan, and team sync evidence.');
assert(appSource.includes('changeFlowRows') && appSource.includes('ownerState.currentPlan?.changeRecordId') && appSource.includes('Sync Targets') && appSource.includes('change-sync-targets-') && appSource.includes('change-discussion-receipts-') && appSource.includes('Discussion receipts:'), 'Change Ledger must prove owner-plan linkage, synchronized Agents, and discussion receipt coverage.');
assert(appSource.includes('change-resolution-matrix') && appSource.includes('Change Resolution Matrix') && appSource.includes('Source Intake') && appSource.includes('Owner First Work') && appSource.includes('Owner work chat proof') && appSource.includes('Owner work timeline proof'), 'Project dashboard must expose a change resolution matrix from intake through owner first work proof.');
assert(appSource.includes('ownerWorkStarted') && appSource.includes('ownerWorkMessageIds') && appSource.includes('ownerWorkTimelineIds') && appSource.includes('Change Owner Pulses'), 'Change rows must derive owner first-work pulse proof and expose it in the backend manager snapshot.');
assert(serviceSource.includes('ownerWorkStarted') && serviceSource.includes('ownerWorkMessageIds') && serviceSource.includes('ownerWorkTimelineLogIds'), 'Backend manager dashboard change rows must expose owner first-work pulse proof.');
assert(appSource.includes('dual-channel-change-intake-matrix') && appSource.includes('Dual-channel Change Intake Matrix') && appSource.includes('Source Message') && appSource.includes('Source Receipts') && appSource.includes('Team Discussed') && appSource.includes('Source channel proof') && appSource.includes('Resolution chat proof') && appSource.includes('Change Intake'), 'Project dashboard must expose War Room and Google Chat change intake receipts before owner resolution.');
assert(serviceSource.includes('changeSourceIntakeRows') && serviceSource.includes('changeSourceIntake') && serviceSource.includes('dualChannelCount') && serviceSource.includes('sourceReadyCount'), 'Backend manager dashboard must expose channel-level change intake rows for single and dual-channel requests.');
assert(appSource.includes('dual_channel_change') && appSource.includes('runMultiChannelChangeBroadcast') && appSource.includes('Broadcast dual-channel change'), 'Manager demo must expose a one-click meeting plus Google Chat change broadcast.');
assert(serviceSource.includes('submitProjectMultiChannelChangeRequest') && serviceSource.includes('multi-channel-change-request') && serviceSource.includes('sourceChannelIds') && serviceSource.includes('sourceModes'), 'Backend service must support a unified multi-channel change request with explicit source modes.');
assert(serviceSource.includes('changeOwnerStartWorkResponse') && serviceSource.includes("trigger: 'change-owner-start-work'") && serviceSource.includes("cadence: 'change-start'"), 'Backend service must immediately start owner work after a confirmed feature change from chat, meeting, or dual-channel intake.');
assert(apiSource.includes("route.action === 'change-request'") && apiSource.includes('service.submitMultiChannelChangeRequest'), 'Backend API must expose a multi-channel change-request endpoint.');
assert(appSource.includes('handoffTimelineProofIds') && appSource.includes('Peer chat proof') && appSource.includes('Peer timeline proof'), 'Peer Handoffs must offer direct chat and timeline proof jumps.');
assert(appSource.includes('managementEventCount') && appSource.includes('task proof link'), 'Autonomous Work Loop must surface ongoing Agent management check-ins.');
assert(appSource.includes('24/7 Operations Board') && appSource.includes('operations-board-24-7') && appSource.includes('Project Next Run') && appSource.includes('Project Last Run') && appSource.includes('Backend Worker') && appSource.includes('Agent Run Queue'), 'Project dashboard must expose a 24/7 Operations Board with project cadence, backend worker, and Agent run queue evidence.');
assert(appSource.includes('operationsBoardRows') && appSource.includes('Next Agent Run') && appSource.includes('Latest Agent Work') && appSource.includes('Worker Trigger') && appSource.includes('Management Priority') && appSource.includes('operations-agent-'), '24/7 Operations Board must show each Agent next run, latest work, trigger, and management priority.');
assert(appSource.includes('continuous-work-loop') && appSource.includes('Continuous Work Loop') && appSource.includes('Scheduler to Agent pulse to timeline proof') && appSource.includes('Run Loop Pulse') && appSource.includes('Loop chat proof') && appSource.includes('Loop timeline proof'), 'Project dashboard must expose a continuous 24/7 work-loop view from scheduler to Agent pulse to chat and timeline proof.');
assert(appSource.includes('continuousWorkRows') && appSource.includes('loopState') && appSource.includes('proofReady') && appSource.includes('Continuous Rows') && appSource.includes('Continuous Proofs'), 'Continuous Work Loop must derive per-Agent loop state, proof readiness, and backend manager snapshot counts.');
assert(serviceSource.includes('continuousWorkLoop') && serviceSource.includes('continuousWorkLoopRows') && serviceSource.includes('proofedAgentCount') && serviceSource.includes('timelineProofCount'), 'Backend manager dashboard must expose continuous work-loop read-model counts and per-Agent proof rows.');
assert(appSource.includes('Fixed Work Routines') && appSource.includes('routine-row-') && appSource.includes('Routine Checklist') && appSource.includes('Next Evidence'), 'Project dashboard must expose every Agent fixed routine as a manager-visible matrix.');
assert(appSource.includes('Agent Management Mesh') && appSource.includes('agent-management-mesh') && appSource.includes('Leader Chain') && appSource.includes('Managed Agents') && appSource.includes('Latest Check-in') && appSource.includes('Management Proof'), 'Project dashboard must expose Agent-to-Agent management relationships and check-in proof.');
assert(appSource.includes('managementMeshRows') && appSource.includes('managementLogTypes') && appSource.includes('peer-management-check-in') && appSource.includes('management-response') && appSource.includes('Management timeline proof'), 'Agent Management Mesh must derive leader/peer-management response proof from Agent state and timeline logs.');
assert(appSource.includes('Peer Management Matrix') && appSource.includes('peer-management-matrix') && appSource.includes('Every independent Agent has a peer manager and a peer target'), 'Agent Management Mesh must expose the explicit peer-management matrix.');
assert(appSource.includes('runBackendManagementSync') && appSource.includes('manager-ui-management-sync') && appSource.includes('management-sync') && appSource.includes('agent-management-sync-') && appSource.includes('Run Management Sync'), 'Agent Management Mesh must let managers explicitly trigger a backend-backed Agent management sync from the relationship graph.');
assert(serviceSource.includes('buildPeerManagementMatrix') && serviceSource.includes('applyPeerManagementMatrix') && serviceSource.includes('peerManagementMatrix'), 'Backend service must create and expose durable peer-management matrix state.');
assert(appSource.includes('attachMessageReceipts') && appSource.includes('Seen {message.visibility.receiptCount}') && appSource.includes('Heard by {receipts.heardText}') && appSource.includes('Direct target {receipts.directText}'), 'Group chat must surface durable message receipt counts and named recipients.');
assert(appSource.includes('Unified Event Ledger') && appSource.includes('activeProject.eventLedger'), 'Project dashboard must surface the unified project event ledger.');
assert(appSource.includes('eventLedgerSummary') && appSource.includes('Retained {eventLedgerSummary.retainedCount}'), 'Project dashboard must expose retained/total event-ledger projection.');
assert(appSource.includes('eventLedgerSummary.replayProjection.kickoffSpeechCount') && appSource.includes("['Handoff', eventLedgerSummary.replayProjection.peerHandoffCount]"), 'Project dashboard must expose event-ledger replay projection counts.');
assert(appSource.includes('syncBackendTimelineAndEvents') && appSource.includes('/timeline') && appSource.includes('/events') && appSource.includes('timelineReadModel') && appSource.includes('eventLedgerReadModel') && appSource.includes('backend-sync-timeline-events') && appSource.includes('Sync Timeline'), 'Project dashboard must consume backend timeline and event-ledger read models when online instead of treating browser project logs as the only workflow source.');
assert(appSource.includes('Backend Worker Station') && appSource.includes('/workers/autonomous/status') && appSource.includes('/workers/autonomous/${action}') && appSource.includes("runBackendSchedulerAction('start')") && appSource.includes("runBackendSchedulerAction('stop')") && appSource.includes('backend-scheduler-agent-controls') && appSource.includes('AGENT CONTROL: STRATEGY'), 'Project dashboard must expose backend autonomous scheduler status and Agent autonomy controls.');
assert(appSource.includes('Agent Runs') && appSource.includes('agentProcessedCount') && appSource.includes('Agent Skips'), 'Backend Worker Station must surface per-Agent scheduler counters.');
assert(appSource.includes('runImmediately: true') && appSource.includes('includeReadModels: false') && appSource.includes('manager-ui-scheduler-start-pulse') && appSource.includes('Starting backend scheduler') && appSource.includes('startPending: true') && appSource.includes('startPending: false') && appSource.includes('lastStartedRunImmediately: false') && !appSource.includes('backend-scheduler-start-first-work') && !appSource.includes('persistActiveProject') && appSource.includes('silent = false') && appSource.includes('Immediate Start') && appSource.includes('Latest Backend Work') && appSource.includes('backend-last-result'), 'Backend Worker Station start must immediately kick current-project and Agent startup work through lightweight receipts, refresh silently, avoid optimistic browser-authored worker results, and surface the latest processed project/Agent result only after backend proof returns.');
assert(appSource.includes('projectHasBackendSyncEvidence') && appSource.includes('!allowLocalRuntimeFallbackForActiveProject(project)') && appSource.includes('backendStation.projectCatalog') && appSource.includes('backendStation.lastManagerDashboardSyncAt') && appSource.includes('Local autonomous cycle blocked; backend route required') && appSource.includes('Local fallback disabled for backend-synced project.'), 'Browser-local autonomous scheduler and direct local autonomous cycle calls must be disabled for backend-synced real projects even when the local station status is stale; local cycles are allowed only for offline-only, demo/sample, or explicit development fallback projects.');
assert(httpServerSource.includes('lastStartedRunImmediately') && httpServerSource.includes('state.lastResult') && httpServerSource.includes('forceAgentRun') && httpServerSource.includes('scheduler-start-agent-sweep'), 'HTTP scheduler status must preserve immediate-start, startup Agent sweep, and latest worker result evidence.');
assert(appSource.includes('manager-ui-backend-pulse') && appSource.includes('Server Pulse'), 'Project dashboard must expose a backend-backed project pulse path.');
assert(appSource.includes("requestAgentBackend('/workers/autonomous/tick'") && appSource.includes('forceAgentRun: true') && appSource.includes('manager-ui-backend-pulse-agents') && appSource.includes("agentReviewVerdict: 'auto'") && appSource.includes('extractBackendAgentAutonomousActionQueueFromPayload'), 'Backend Server Pulse must run a real scheduler tick that advances the current project and Agent workers together, then hydrate the Agent autonomous action queue returned by the scheduler.');
assert(appSource.includes('runBackendSchedulerTickPulse') && appSource.includes('projectCadence: cadence') && appSource.includes('manager-ui-${cadence}-pulse-agents'), 'Backend-online Hour Pulse and Day Report must also use the real scheduler tick path with Agent worker controls.');
assert(httpServerSource.includes('cadence: input.projectCadence || input.cadence'), 'HTTP scheduler tick must forward explicit project cadence overrides for manager-triggered hour/day pulses.');
assert(appSource.includes('Sync State') && appSource.includes('syncBackendProjectState') && appSource.includes('applyBackendProjectSnapshot') && appSource.includes('saveActiveProjectToBackend') && appSource.includes('backend-save-project') && appSource.includes('Seed Sample/Dev') && appSource.includes('Browser snapshot seeding is disabled for real backend projects.') && appSource.includes('disabled={backendStation.loading || !canSeedActiveProjectSnapshotToBackend(activeProject)}'), 'Project dashboard must sync backend project snapshots back into the manager UI and limit browser snapshot seeding to sample/dev fallback projects.');
assert(appSource.includes('mergeProjectMessages') && appSource.includes('Project sync:'), 'Backend project sync must merge returned chat messages without duplicating the manager transcript.');
assert(appSource.includes('syncBackendProjectCatalog') && appSource.includes('/projects') && appSource.includes('projectCatalog') && appSource.includes('backend-sync-project-catalog') && appSource.includes('Sync Backend Projects'), 'Project dashboard must list/load backend projects from the backend catalog instead of treating localStorage as the only project source.');
assert(appSource.includes('readStoredProjectArray') && appSource.includes('isBackendManagedBrowserCacheProject') && appSource.includes('cachedBackendManagedProjectIds') && appSource.includes('cachedBrowserProjectIds') && appSource.includes('!isBackendManagedBrowserCacheProject(project)') && appSource.includes('!backendManagedCachedIds.has(message.projectId || DEFAULT_CHAT_PROJECT_ID)') && appSource.includes('projectId === DEFAULT_CHAT_PROJECT_ID || browserProjectIds.has(projectId)') && appSource.includes('if (!project) return false;') && appSource.includes('isBackendManagedRealProject') && appSource.includes('canPersistProjectToBrowserCache') && appSource.includes('canPersistChatMessageToBrowserCache') && appSource.includes('const browserCacheProjects = projects.filter(canPersistProjectToBrowserCache)') && appSource.includes('const browserCacheMessages = chatMessages') && appSource.includes('!isBackendManagedRealProject(project)'), 'Browser localStorage project/chat cache must exclude backend-managed real projects and orphan project messages on startup and on write while keeping offline/demo/dev fallback cache available.');
assert(appSource.includes('syncBackendManagerDashboard') && appSource.includes('/manager-dashboard') && appSource.includes('Backend Manager Snapshot') && appSource.includes('backend-manager-dashboard-snapshot'), 'Project dashboard must pull and show the backend manager-dashboard aggregate snapshot.');
assert(appSource.includes('Manager dashboard sync:') && appSource.includes('Proof Routes') && appSource.includes('Ops Agents') && appSource.includes('Management Checks') && appSource.includes('Assignment Rows') && appSource.includes('Change Rows'), 'Backend manager-dashboard snapshot must expose readiness proof, operations, management, assignment, and change counts.');
assert(appSource.includes('syncBackendManagerCommandCenter') && appSource.includes('/manager-command-center') && appSource.includes('Command center sync:') && appSource.includes('Sync Command') && appSource.includes('backend-sync-command-center') && appSource.includes('backend-manager-command-center-snapshot'), 'Project dashboard must sync and show the standalone manager command center endpoint without pre-writing stale browser snapshots.');
assert(appSource.includes('syncBackendManagerScenarioWalkthrough') && appSource.includes('/manager-scenario-walkthrough') && appSource.includes('Scenario walkthrough sync:') && appSource.includes('Sync Walkthrough') && appSource.includes('backend-sync-scenario-walkthrough') && appSource.includes('backend-manager-scenario-walkthrough-snapshot'), 'Project dashboard must sync and show the standalone manager scenario walkthrough endpoint without pre-writing stale browser snapshots.');
assert(appSource.includes('syncBackendManagerScenarioTrail') && appSource.includes('/manager-scenario-trail') && appSource.includes('Scenario trail sync:') && appSource.includes('Standalone Trail') && appSource.includes('backend-sync-scenario-trail') && appSource.includes('backend-manager-scenario-trail-snapshot'), 'Project dashboard must sync and show the standalone manager scenario trail endpoint without pre-writing stale browser snapshots.');
assert(appSource.includes('syncBackendManagerRequirementMatrix') && appSource.includes('/manager-requirement-matrix') && appSource.includes('Requirement matrix sync:') && appSource.includes('Sync Matrix') && appSource.includes('backend-sync-requirement-matrix') && appSource.includes('backend-manager-requirement-matrix-snapshot'), 'Project dashboard must sync and show the standalone manager requirement matrix endpoint without pre-writing stale browser snapshots.');
assert(appSource.includes('syncBackendSyncProtocolAudit') && appSource.includes('/sync-protocol-audit') && appSource.includes('Sync protocol audit sync:') && appSource.includes('Sync Protocol') && appSource.includes('backend-sync-sync-protocol-audit') && appSource.includes('backend-sync-protocol-audit-snapshot'), 'Project dashboard must sync and show the standalone sync protocol audit endpoint without pre-writing stale browser snapshots.');
assert(appSource.includes('syncBackendManagerUseCaseAudit') && appSource.includes('/manager-use-case-audit') && appSource.includes('Use case audit sync:') && appSource.includes('Sync Audit') && appSource.includes('backend-sync-use-case-audit') && appSource.includes('backend-manager-use-case-audit-snapshot'), 'Project dashboard must sync and show the standalone manager use case audit endpoint without pre-writing stale browser snapshots.');
assert(appSource.includes('syncBackendManagerActionQueue') && appSource.includes('/manager-action-queue') && appSource.includes('Action queue sync:') && appSource.includes('Sync Queue') && appSource.includes('backend-sync-action-queue') && appSource.includes('backend-manager-action-queue-snapshot'), 'Project dashboard must sync and show the standalone manager action queue endpoint without pre-writing stale browser snapshots.');
assert(appSource.includes('syncBackendAgentAutonomousActionQueue') && appSource.includes('/agent-autonomous-action-queue') && appSource.includes('Agent autonomous queue sync:') && appSource.includes('Sync Agent Queue') && appSource.includes('backend-sync-agent-autonomous-action-queue') && appSource.includes('backend-agent-autonomous-action-queue-snapshot') && appSource.includes('runAgentAutonomousActionQueueRow') && appSource.includes('backend-agent-autonomous-action-run-'), 'Project dashboard must sync, show, and run the standalone Agent autonomous action queue endpoint without local mock mutation.');
assert(appSource.includes('syncBackendManagerReadyPackage') && appSource.includes('/manager-ready-package') && appSource.includes('Ready package sync:') && appSource.includes('Manager Ready Package') && appSource.includes('backend-sync-ready-package') && appSource.includes('backend-manager-ready-package-snapshot'), 'Project dashboard must sync and show the manager ready package endpoint without pre-writing stale browser snapshots.');
assert(appSource.includes('syncBackendReadyPackageSubmodels') && appSource.includes('/brainstorm-layer') && appSource.includes('/artifact-quality-audit') && appSource.includes('/submission-review-workflow') && appSource.includes('/product-team-delivery-trace') && appSource.includes('missingProductTeamDeliveryTrace') && appSource.includes('fetch-product-team-delivery-trace') && appSource.includes('/product-team-operating-loop') && appSource.includes('missingProductTeamOperatingLoop') && appSource.includes('fetch-product-team-operating-loop') && appSource.includes('/evidence-quality-audit') && appSource.includes('/evidence-source-review-workflow') && appSource.includes('/evidence-custody-readiness') && appSource.includes('readyPackageSubmodels') && appSource.includes('backend-sync-proof-models') && appSource.includes('Sync Proof Models'), 'Manager Ready Package proof subpanels must refresh standalone backend read models and expose backend-required missing state for delivery trace and operating loop instead of depending only on embedded package snapshots or frontend summary fallbacks.');
assert(serviceSource.includes('productTeamAcceptanceChainRoutes') && serviceSource.includes('readyForGenericProductTeamAcceptance') && serviceSource.includes('readyForBsideProductTeamRun') && appSource.includes('proof-map-product-team-acceptance-chain') && appSource.includes('Generic Product-Team Acceptance Chain'), 'Readiness Proof Map and Manager UI must expose the generic product-team acceptance chain as a route-backed C/A acceptance proof instead of scattered mock panels.');
assert(
  appSource.includes('missingBrainstormLayer')
    && appSource.includes('missingArtifactQualityAudit')
    && appSource.includes('missingSubmissionReviewWorkflow')
    && appSource.includes('missingEvidenceQualityAudit')
    && appSource.includes('missingEvidenceSourceReviewWorkflow')
    && appSource.includes('missingEvidenceCustodyReadiness')
    && appSource.includes('backend-brainstorm-layer-source')
    && appSource.includes('backend-artifact-quality-audit-source')
    && appSource.includes('backend-submission-review-workflow-source')
    && appSource.includes('backend-evidence-quality-audit-source')
    && appSource.includes('backend-evidence-source-review-workflow-source')
    && appSource.includes('backend-evidence-custody-readiness-source')
    && backendUiValidationSource.includes("['backend-brainstorm-layer-source', 'Brainstorm Layer']")
    && backendUiValidationSource.includes("['backend-evidence-custody-readiness-source', 'Evidence Custody Readiness']"),
  'Research-sample acceptance chain Ready Package panels must expose backend source labels and backend-required missing models for brainstorm, artifact, review, evidence, source-review, and custody contracts.',
);
assert(appSource.includes('includeLaunchControls') && appSource.includes('/production-launch-control-center') && appSource.includes('/production-evidence-integrity-audit') && appSource.includes('/production-operations-control-receipts') && appSource.includes('/production-deployment-control-receipts') && appSource.includes('/production-security-control-receipts') && appSource.includes('/production-provider-control-receipts') && appSource.includes('backendReadyPackageSubmodels.productionLaunchControlCenter') && appSource.includes('backendReadyPackageSubmodels.productionSecurityControlReceiptWorkflow'), 'Manager Ready Package launch/control panels must prefer standalone backend read models when full proof-model sync is requested.');
assert(appSource.includes('allowReadyPackageDerivedFallbacks') && appSource.includes('backendOnlineForReadyPackage') && appSource.includes('missingProductionLaunchGapRegister') && appSource.includes('missingProductionLaunchControlCenter') && appSource.includes('missingProductionEvidenceIntegrityAudit') && appSource.includes('missingProductionLaunchEvidenceDossier') && appSource.includes('missingProductionControlReceiptWorkflow') && appSource.includes('frontendMockSuppressed') && appSource.includes('backend-model-missing'), 'Backend-online real Manager Ready Package launch/control panels must show missing backend read models instead of synthesizing production fallback shapes.');
assert(apiSource.includes('productionControlReceiptReadModels') && apiSource.includes('productionOperationsControlReceiptWorkflowRoute') && apiSource.includes('productionDeploymentControlReceiptWorkflowRoute') && apiSource.includes('productionSecurityControlReceiptWorkflowRoute') && apiSource.includes('productionProviderControlReceiptWorkflowRoute'), 'Production-control receipt POST routes must support lightweight receipt responses with explicit standalone read-model refresh routes.');
assert(apiSource.includes('launchApprovalReadModels') && apiSource.includes('launchApprovalWorkflowRoute') && apiSource.includes('privatePilotGoLiveReadinessRoute') && apiSource.includes("route.action === 'launch-approvals'") && apiSource.includes('includeReadModels'), 'Launch approval POST routes must support receipt-first responses with explicit launch/go-live refresh routes.');
assert(apiSource.includes('securityBoundaryReadModels') && apiSource.includes('membershipPolicyRoute') && apiSource.includes('identitySessionsRoute') && apiSource.includes('securityAccessAuditRoute') && apiSource.includes("route.action === 'identity-sessions'") && apiSource.includes("route.action === 'membership-policy'"), 'Security membership and identity-session write routes must support receipt-first responses with explicit security refresh routes.');
assert(appSource.includes('refreshBackendManagerView') && appSource.includes('Sync Manager View'), 'Backend Worker Station must let managers manually refresh only the aggregate manager-dashboard view.');
assert(appSource.includes('applyBackendManagerDashboardPayload') && appSource.includes('payload.managerDashboard') && appSource.includes('payload.managerReadyPackage') && appSource.includes('applyBackendManagerDashboardPayload(kickoffResult)'), 'Backend command responses must be able to update the manager dashboard and ready package snapshots without an extra fetch.');
assert(appSource.includes('backend-url-input') && appSource.includes('Save URL') && appSource.includes('hall_of_fame_studio.agent_backend_url.v1'), 'Backend Worker Station must let managers configure and persist the backend URL.');
assert(appSource.includes('shouldAttemptBackendProjectWrite') && appSource.includes("runBackendProjectCommand('chat'") && appSource.includes("runBackendProjectCommand('meeting'"), 'Project chat and War Room inputs must attempt backend project commands through the configured endpoint instead of trusting a possibly stale station status flag.');
assert(appSource.includes('allowLocalRuntimeFallbackForActiveProject') && appSource.includes('projectHasBackendSyncEvidence') && appSource.includes('Backend chat failed; local fallback disabled for backend-online project; draft restored') && appSource.includes('Backend meeting failed; local fallback disabled for backend-online project; draft restored') && appSource.includes('setChatInput(current => current || text)') && appSource.includes('setRoomInput(current => current || text)') && appSource.includes('used allowed local runtime fallback'), 'Backend-synced real project inputs must fail closed, restore unsent drafts, and avoid silently mutating browser state; local runtime fallback is limited to offline-only, demo/sample, or explicit development mode.');
assert(appSource.includes('projectInputUiStateKey') && appSource.includes('chatInputDrafts') && appSource.includes('roomInputDrafts') && appSource.includes('activeChannelDrafts') && !appSource.includes("const [chatInput, setChatInput] = useState('')") && !appSource.includes("const [roomInput, setRoomInput] = useState('')") && !appSource.includes("const [activeChannelId, setActiveChannelId] = useState('main')"), 'Project chat input, War Room meeting input, and active chat channel must be project-scoped before they can write backend chat or meeting proof.');
assert(appSource.includes('focusedChatProofIdDrafts') && appSource.includes('focusedTimelineProofIdDrafts') && appSource.includes('selectedTimelineEventDrafts') && !appSource.includes('const [focusedChatProofIds, setFocusedChatProofIds] = useState([])') && !appSource.includes('const [focusedTimelineProofIds, setFocusedTimelineProofIds] = useState([])') && !appSource.includes('const [selectedTimelineEventId, setSelectedTimelineEventId] = useState(null)'), 'Chat proof focus, timeline proof focus, and selected timeline event must be project-scoped Manager monitoring state.');
assert(serviceSource.includes('runRoundtableExchange') && serviceSource.includes("schemaVersion: 'meeting-agent-turn/v1'") && serviceSource.includes('meetingAgentTurns') && serviceSource.includes("source: 'war-room-meeting-agent-turn'") && serviceSource.includes("eventType: 'meeting-agent-turn'"), 'Backend meeting commands must generate durable Agent meeting turns and timeline logs instead of leaving War Room discussion as frontend-only simulation.');
assert(apiSource.includes('meetingAgentTurns: result.meetingAgentTurns || []') && apiSource.includes('meetingProtocol: result.meetingProtocol || null'), 'Backend API must expose generated Agent meeting turns to frontend War Room consumers.');
assert(appSource.includes('playBackendMeetingTurns') && appSource.includes('backendResult?.meetingAgentTurns') && appSource.includes("source: turn.source || 'war-room-meeting-agent-turn'") && appSource.includes('backendTurnEvents.length') && appSource.includes('blockMissingBackendMeetingTurns') && appSource.includes('Backend meeting returned no Agent turns; local simulation blocked; draft restored') && !appSource.includes('if (!renderedBackendTurns) runRoomSimulation(text, nextProject);'), 'React War Room must play backend-authored meeting turns, restore unsent drafts, and block frontend local meeting simulation when backend-online projects return no Agent turns.');
assert(appSource.includes('const startMeeting = async') && appSource.includes("const backendResult = await runBackendProjectCommand('meeting'") && appSource.includes('BACKEND WAR ROOM SESSION OPENED') && appSource.includes('Backend meeting start failed; local fallback disabled for backend-online project'), 'Legacy War Room session start must write through the backend meeting command and fail closed for backend-online real projects.');
assert(appSource.includes('const handleTerminalSubmit = async') && appSource.includes("const backendResult = await runBackendProjectCommand('meeting'") && appSource.includes('Backend legacy terminal meeting failed; local fallback disabled for backend-online project') && appSource.includes('Backend legacy terminal meeting returned no Agent turns; local route simulation blocked') && appSource.includes('Backend legacy terminal meeting response lacked meetingAgentTurns; no local mock meeting was created.'), 'Legacy War Room terminal input must use the same backend-first meeting command and fail closed for backend-online real projects, including missing backend Agent turns.');
assert(!appSource.includes('Backend chat failed, used local runtime') && !appSource.includes('Backend meeting failed, used local runtime'), 'Backend-connected chat and meeting inputs must not silently create local fallback success by default.');
assert(appSource.includes('submission-review-failed') && appSource.includes('Review write failed:') && appSource.includes('No local review receipt was created.') && appSource.includes("reviewReceipt?.action === 'submission-review-failed'"), 'Reviewer composer backend failures must replace pending receipts with a visible failed state and must not create local review proof.');
assert(serviceSource.includes('contractProjectAgent') && serviceSource.includes("schemaVersion: 'agent-contract/v1'") && serviceSource.includes("eventType: 'agent-contracted'") && serviceSource.includes("type: 'agent-contracted'"), 'Backend service must expose a proofed Agent contract roster mutation.');
assert(apiSource.includes("route.tail[0] === 'contract'") && apiSource.includes('service.contractProjectAgent') && apiSource.includes('agentContract'), 'Backend API must expose Agent marketplace contract as a project roster route.');
assert(appSource.includes('const confirmAgentContractForProject = async') && appSource.includes('/agents/contract') && appSource.includes('includeReadModels: false') && appSource.includes('Backend Agent contract failed; local fallback disabled for backend-online project'), 'Marketplace Agent contract flow must use the backend roster route and fail closed for backend-online real projects.');
assert(appSource.includes('runBackendAgentPulse') && appSource.includes('manager-ui-agent-pulse') && appSource.includes('agent-work-cycle-'), 'Project dashboard must expose backend-backed per-Agent work pulses.');
assert(appSource.includes('backendAgentCollaborationBody') && appSource.includes('useAutonomousStrategy: true') && appSource.includes('submitWorkArtifact: true') && appSource.includes('reviewPendingSubmission: true') && appSource.includes('respondToReviewObligation: true') && appSource.includes('agentReviewVerdictForPulse'), 'Backend-backed Agent Pulse must request real autonomous strategy, submission, Reviewer processing, and Submitter revision-response behavior instead of a plain worklog-only pulse.');
assert(appSource.includes('backendSchedulerAgentSweepBody') && appSource.includes('useAgentAutonomousStrategy: true') && appSource.includes('submitAgentWorkArtifacts: true') && appSource.includes('respondToReviewObligations: true'), 'Backend scheduler start must forward autonomous Agent strategy, submission, and revision-response controls into the startup Agent sweep.');
assert(serviceSource.includes('runAutonomousRunControlLoop') && serviceSource.includes("schemaVersion: 'autonomous-run-control-loop-run/v1'") && serviceSource.includes('autonomousRunControlLoopLedger') && serviceSource.includes('autonomousRunControlLoopRoutes'), 'Backend service must expose a bounded autonomous run-control loop receipt with ledger and proof-map routes.');
assert(apiSource.includes("route.tail[0] === 'run-loop'") && apiSource.includes('service.runAutonomousRunControlLoop') && apiSource.includes('autonomousRunControlLoop'), 'Backend API must expose the autonomous run-control bounded loop route.');
assert(appSource.includes('runAutonomousRunControlLoop') && appSource.includes('backend-autonomous-run-control-loop-run') && appSource.includes('backend-autonomous-run-control-loop-receipt') && appSource.includes('Loop receipt:'), 'React Backend Worker Station must let the manager run and inspect a bounded autonomous run-control loop receipt.');
assert(serviceSource.includes('startAutonomousRunControlSession') && serviceSource.includes('tickAutonomousRunControlSession') && serviceSource.includes('tickAutonomousRunControlSessionWithProviderEvidence') && serviceSource.includes('pauseAutonomousRunControlSession') && serviceSource.includes("schemaVersion: 'autonomous-run-control-session/v1'") && serviceSource.includes("schemaVersion: 'autonomous-run-control-session-tick/v1'") && serviceSource.includes("schemaVersion: 'autopilot-delivery-target/v1'") && serviceSource.includes("schemaVersion: 'autopilot-delivery-target-control/v1'") && serviceSource.includes('buildAutopilotTargetExecutionOverrides') && serviceSource.includes("schemaVersion: 'autonomous-run-control-target-selection/v1'") && serviceSource.includes('targetMissingStageIds') && serviceSource.includes('autonomousRunControlSessionRoutes'), 'Backend service must expose proofed autonomous run-control sessions, session tick routes, Product Team delivery target tracking, target execution overrides, target-aware action selection, and an async provider-evidence session tick path.');
assert(serviceSource.includes('runDueAutonomousRunControlSessions') && serviceSource.includes('runDueAutonomousRunControlSessionsWithProviderEvidence') && serviceSource.includes("schemaVersion: 'autopilot-due-worker-summary/v1'") && serviceSource.includes("schemaVersion: 'autopilot-session-schedule/v1'") && serviceSource.includes('autopilotQueue') && serviceSource.includes("autopilotDueWorker: '/workers/autopilot/due'"), 'Backend service must expose bounded Autopilot session due-worker scanning, async provider-evidence due ticks, and queue rows for scheduler-owned autonomous sessions.');
assert(serviceSource.includes('autonomousRunControlSessionTickLedger || []).map') && serviceSource.includes("workerKind: 'autopilot-session'") && serviceSource.includes("autopilotQueue: 'oldest-active-session-per-project-then-due-time'") && workerQueueAdapterSource.includes('workerQueueSnapshot.autopilotQueue'), 'Autopilot session ticks must be exported as worker execution receipts and imported by the queue adapter lane, not left as UI-only session ledger proof.');
assert(apiSource.includes("route.tail[0] === 'sessions'") && apiSource.includes('service.startAutonomousRunControlSession') && apiSource.includes('service.tickAutonomousRunControlSession') && apiSource.includes('service.tickAutonomousRunControlSessionWithProviderEvidence') && apiSource.includes('service.pauseAutonomousRunControlSession'), 'Backend API must expose autonomous run-control session start/tick/pause routes, including the async provider-evidence tick branch.');
assert(apiSource.includes("workerRoute?.worker === 'autopilot'") && apiSource.includes('service.runDueAutonomousRunControlSessions') && apiSource.includes('service.runDueAutonomousRunControlSessionsWithProviderEvidence') && apiSource.includes("schemaVersion: result.schemaVersion || 'autopilot-due-worker-summary/v1'") && apiSource.includes('providerEvidenceSearchEnabled: true'), 'Backend API must expose bounded Autopilot due-worker routes for scheduler-owned session ticks, including async provider-evidence due-worker responses.');
assert(apiSource.includes('autonomousRunControlReadModels') && apiSource.includes('autonomousRunControlSessionsRoute') && apiSource.includes('autonomousRunControlSessionTickRoute') && apiSource.includes("schedulerTickRoute: '/workers/autonomous/tick'") && apiSource.includes("autopilotDueWorkerRoute: '/workers/autopilot/due'"), 'Autonomous Run Control writes must return dedicated session, scheduler, due-worker, Flow, Proof, timeline, and Agent refresh routes when read models are deferred.');
assert(httpServerSource.includes('/workers/autopilot/due') && httpServerSource.includes('api.handleAsync || api.handle') && httpServerSource.includes('useProviderEvidenceSearch') && httpServerSource.includes("schemaVersion: 'scheduler-autopilot-controls/v1'") && httpServerSource.includes('tickAutopilotSessions') && httpServerSource.includes('autopilotProcessedCount'), 'HTTP scheduler must be able to opt into async Autopilot session ticks, pass provider-evidence controls, and expose the controls/counters it used.');
assert(appSource.includes('startAutonomousRunControlSession') && appSource.includes('tickAutonomousRunControlSession') && appSource.includes('pauseAutonomousRunControlSession') && appSource.includes('backend-autonomous-run-control-session-start') && appSource.includes('backend-autonomous-run-control-session-tick-receipt') && appSource.includes('Autopilot session:') && appSource.includes('targetReadyCount'), 'React Backend Worker Station must let the manager start, tick, pause, and inspect an autonomous run-control session with delivery target progress.');
assert(appSource.includes('runAutopilotSessionThroughScheduler') && appSource.includes('ensureBackendAutopilotSessionForScheduler') && appSource.includes('extractAutopilotProviderEvidenceReceipt') && appSource.includes("requestAgentBackend('/workers/autonomous/tick'") && appSource.includes('tickAutopilotSessions: true') && appSource.includes('providerEvidenceSearchEnabled: true') && appSource.includes('backend-autonomous-run-control-session-scheduler-tick') && appSource.includes('backend-scheduler-autopilot-controls') && appSource.includes('backend-autonomous-run-control-session-worker-receipt') && appSource.includes('backend-autopilot-provider-evidence-receipt') && appSource.includes('Provider evidence:') && appSource.includes('Autopilot worker: /workers/autonomous/tick -> /workers/autopilot/due'), 'React Backend Worker Station must confirm a durable backend Autopilot session, advance it through the scheduler-owned due-worker lane, request provider evidence, and show the Autopilot scheduler/provider evidence receipt.');
assert(appSource.includes('chatProofIdsFromAttachment') && appSource.includes('providerEvidenceMessageId') && appSource.includes('providerEvidenceTranscriptRoute') && appSource.includes('flow-open-transcript-') && appSource.includes('Transcript proof'), 'Manager Flow Graph attachments must expose provider-evidence transcript proof jumps into backend Group Chat.');
assert(appSource.includes('const enterProjectScene = (mode)') && appSource.includes('projectMode === mode') && !appSource.includes("sceneTransition || projectMode !== 'dashboard'"), 'Project proof navigation must allow Flow Graph and other project scenes to jump directly into chat/timeline proof views, not only from the dashboard.');
assert(appSource.includes('refreshAutonomousRunControlReadModels') && appSource.includes('readRoutes.autonomousRunControlSessionsRoute') && appSource.includes('readRoutes.productTeamOperatingLoopRoute') && appSource.includes('readRoutes.autonomousCycleConsistencyRoute'), 'React must consume Autonomous Run Control receipt read-model routes for C/A session, operating-loop, cycle-consistency, Flow, Proof, timeline, and Agent queue refresh.');
assert(appSource.includes('runBackendAgentMessage') && appSource.includes('/message') && appSource.includes('Agent Message') && appSource.includes('agent-message-send-'), 'Project dashboard must expose backend-backed Agent-to-Agent message publishing controls.');
assert(appSource.includes('Agent Action Failed') && appSource.includes('No local run receipt was created.') && appSource.includes('backend-agent-autonomous-action-run-output-failed') && appSource.includes('agentAutonomousActionRun: null') && appSource.includes('localProofCreated: false'), 'Failed Agent Autonomous Action Queue runs must clear stale run receipts and show a non-proof failed state.');
assert(appSource.includes('Intent Run Failed') && appSource.includes('No local intent receipt was created.') && appSource.includes('backend-collaboration-intent-run-output-failed') && appSource.includes('collaborationIntentRun: null') && appSource.includes('localProofCreated: false'), 'Failed Collaboration Intent Queue runs must clear stale delegated receipts and show a non-proof failed state.');
assert(appSource.includes('Action failed:') && appSource.includes('No local operator receipt was created.') && appSource.includes('mvpReadinessOperatorActionRun') && appSource.includes('localProofCreated: false'), 'Failed MVP readiness operator actions must show failure instead of leaving a stale operator receipt.');
assert(appSource.includes('Agent Communication Flow') && appSource.includes('agentCommunicationRows') && appSource.includes('Sender Worklog') && appSource.includes('Agent chat proof'), 'Project dashboard must expose Agent-to-Agent communication flow proof.');
assert(appSource.includes('agent-message-delivery-matrix') && appSource.includes('Agent Message Delivery Matrix') && appSource.includes('Direct Receipt') && appSource.includes('Target Inbox') && appSource.includes('Delivery chat proof') && appSource.includes('Delivered Messages'), 'Project dashboard must expose per-target Agent message delivery from group chat receipt to target inbox.');
assert(appSource.includes('proof-map-agent-message-routes') && appSource.includes('backendAgentMessageSummary') && appSource.includes('Agent-to-Agent message routes') && appSource.includes('Agent message timeline proof'), 'Manager Proof Map must render backend Agent-to-Agent message routes with timeline proof exits.');
assert(appSource.includes('agent-priority-') && appSource.includes('latestAgentWorker.managementPriority') && appSource.includes('priorityReasons.slice'), 'Project dashboard must expose visible Agent worker priority and reasons in each Team row.');
assert(appSource.includes('agent-state-detail-') && appSource.includes('Latest Inbox') && appSource.includes('Open Obligation') && appSource.includes('Latest Worklog') && appSource.includes('Next Agent Run'), 'Project dashboard must expose each Agent as an independent visible state surface.');
assert(appSource.includes('selectedAgentFocusId') && appSource.includes('agent-focus-open-') && appSource.includes('agent-focus-panel-') && appSource.includes('Agent Focus Workspace') && appSource.includes('Owned Task Evidence') && appSource.includes('agent-focus-chat-proof-') && appSource.includes('agent-focus-timeline-proof-') && appSource.includes('Management Surface') && appSource.includes('agent-focus-management-proof-'), 'Project dashboard must let managers open a dedicated per-Agent focus workspace with plan, inbox, obligations, owned tasks, management surface, and proof routes.');
assert(appSource.includes('agentDashboardSnapshots') && appSource.includes('agentDashboardSnapshotKey') && appSource.includes('agentDashboardSnapshotFor') && appSource.includes('syncBackendAgentDashboard') && appSource.includes('/agents/${encodeURIComponent(agentId)}/dashboard') && appSource.includes('Backend Agent Dashboard') && appSource.includes('agent-focus-backend-dashboard-') && appSource.includes('agent-focus-backend-cadence-') && appSource.includes('agent-focus-backend-control-runs-') && appSource.includes('agent-focus-control-run-receipt-') && appSource.includes('agent-focus-dashboard-source-') && appSource.includes('agent-focus-backend-dashboard-required-') && appSource.includes('Sync Agent Dashboard') && appSource.includes('local Agent state stays visible as project snapshot context') && appSource.includes('Next Run') && appSource.includes('Management Priority') && appSource.includes('Routine') && appSource.includes('Control Runs'), 'Per-Agent focus workspace must sync and display the backend Agent dashboard read model, scope cached snapshots by project plus Agent, show backend-required missing state for real projects, and expose cadence, management priority, fixed routine, and autonomous control run receipts when online.');
assert(appSource.includes('projectAgentUiStateKey') && appSource.includes('projectSubmissionUiStateKey') && appSource.includes('agentWorkDraftFor') && appSource.includes('agentMessageDraftFor') && appSource.includes('submissionReviewDraftFor') && !appSource.includes('agentWorkDrafts[agent.id]') && !appSource.includes('agentMessageDrafts[agent.id]') && !appSource.includes('submissionReviewDrafts[row.id]'), 'Agent Focus workspace drafts and Reviewer composer state must be project-scoped before they can write backend Agent work, messages, or reviews.');
assert(appSource.includes('agent-focus-pulse-') && appSource.includes('Run Agent Pulse') && appSource.includes('runBackendAgentPulse(agent.id)'), 'Per-Agent focus workspace must let managers trigger that Agent fixed work pulse directly.');
assert(appSource.includes('agent-inbox-proof-') && appSource.includes('agent-obligation-proof-') && appSource.includes('agent-worklog-timeline-') && appSource.includes('openProjectChatProof') && appSource.includes('openProjectTimelineProof'), 'Project dashboard must let managers jump from each Agent state surface to exact chat and timeline proof.');
assert(appSource.includes('Leader Assignment Flow') && appSource.includes('Group @Assignment') && appSource.includes('Assignee Inbox') && appSource.includes('Acknowledgement') && appSource.includes('Work Pulse') && appSource.includes('Assignment chat proof') && appSource.includes('Assignment timeline proof'), 'Project dashboard must expose a manager-readable Leader @assignment flow from group chat to Agent inbox, acknowledgement, work pulse, and timeline proof.');
assert(appSource.includes('assignmentFlowRows') && appSource.includes('ownerState.inbox') && appSource.includes('ownerState.obligations') && appSource.includes('ownerState.worklog'), 'Leader Assignment Flow must derive visibility from the assigned Agent state, not only from task metadata.');
assert(appSource.includes('assignment-timeline-matrix') && appSource.includes('Assignment Timeline Matrix') && appSource.includes('@Assignment Posted') && appSource.includes('Assignee Saw It') && appSource.includes('Assignment Timeline Event') && appSource.includes('Assignment receipt proof') && appSource.includes('Assignment timeline event proof'), 'Project dashboard must expose a Leader assignment timeline matrix from group @mention to assignee receipt and timeline event proof.');
assert(appSource.includes('assignmentTimelineMatrixRows') && appSource.includes('assignmentTimelineIds') && appSource.includes('workTimelineIds') && appSource.includes('Assignment Timeline'), 'Leader assignment timeline matrix must derive assignment, acknowledgement, and work-pulse timeline proof rows.');
assert(serviceSource.includes('assignmentTimelineMatrix') && serviceSource.includes('assignmentTimelineMatrixRows') && serviceSource.includes('timelineReadyCount') && serviceSource.includes('assignmentTimelineLogIds'), 'Backend manager dashboard must expose Leader assignment timeline matrix rows.');
assert(appSource.includes('assignment-work-progress-matrix') && appSource.includes('Assignment Work Progress Matrix') && appSource.includes('Progress Chat') && appSource.includes('Timeline Progress') && appSource.includes('Completion Proof') && appSource.includes('Progress timeline proof') && appSource.includes('Completion timeline proof') && appSource.includes('Assignment Progress'), 'Project dashboard must expose assigned-work progress, latest update, and completion proof mapped to the timeline.');
assert(serviceSource.includes('assignmentWorkProgressRows') && serviceSource.includes('assignmentWorkProgress') && serviceSource.includes('progressReadyCount') && serviceSource.includes('completionReadyCount'), 'Backend manager dashboard must expose assigned-work progress and completion rows.');
assert(appSource.includes('managerAssignmentDraft') && appSource.includes('projectManagerUiStateKey') && appSource.includes('managerAssignmentDraftFor') && appSource.includes('updateManagerAssignmentDraft') && appSource.includes('Leader Assignment Composer') && appSource.includes('manager-leader-assignment-composer') && appSource.includes('manager-assignment-composer-input') && appSource.includes('manager-assignment-composer-target') && appSource.includes('manager-assignment-composer-submit') && appSource.includes('submitManagerLeaderAssignment') && !appSource.includes('setManagerAssignmentDraft(prev'), 'Project dashboard must let managers type custom work for the confirmed Leader to @assign in group chat, with the draft scoped to the active project.');
assert(appSource.includes('Manager Proof Map') && appSource.includes('manager-proof-map') && appSource.includes('managerProofMapDisplayRows') && appSource.includes("schemaVersion: 'manager-proof-map/v1'") && appSource.includes("missingBackendReadModel('manager-proof-map/v1'") && appSource.includes('manager-proof-map-source') && appSource.includes('openManagerProofMapRow') && appSource.includes('Every readiness condition has a direct evidence route') && appSource.includes('transcriptProofCoverageSummary') && appSource.includes('proof-map-transcript-proof-coverage') && appSource.includes('Transcript coverage proof'), 'Manager Scenario Readiness must expose an actionable backend-first proof map for every manager-ready condition, including backend transcript proof coverage.');
assert(appSource.includes('proof-map-') && appSource.includes('Kickoff chat proof') && appSource.includes('Group chat proof') && appSource.includes('Timeline proof') && appSource.includes('Change proof') && appSource.includes('Management proof'), 'Manager Proof Map must route checks to kickoff, group chat, timeline, change, and management evidence.');
assert(appSource.includes('Scenario Control Center') && appSource.includes('scenario-control-center') && appSource.includes('Kickoff Decisions') && appSource.includes('24/7 Work Pulse') && appSource.includes('Agent Management Sync') && appSource.includes('Mid-project Change Intake') && appSource.includes('Manager Evidence Exit') && appSource.includes('scenario-control-action-'), 'Project dashboard must expose a manager-first scenario control center from kickoff decisions through 24/7 work, management sync, change intake, and proof exit.');
assert(appSource.includes("action: () => runProjectAutonomousPulse('hourly')") && !appSource.includes("action: () => backendOnline ? runBackendServerPulse() : runAutonomousCycle(activeProject.id, 'hourly')"), 'Scenario Control Center 24/7 pulse must use the backend-first pulse wrapper instead of branching on a stale frontend online flag.');
assert(appSource.includes('const backendCommandAvailable = shouldAttemptBackendProjectWrite(activeProject)') && appSource.includes('(backendCommandAvailable || isManagerDemoProject(activeProject))') && !appSource.includes('(backendOnline || isManagerDemoProject(activeProject))') && appSource.includes('if (!activeProject || !backendCommandAvailable || !managerCommandCenter.nextBestAction?.canRun) return null;') && appSource.includes('if (!activeProject || !backendCommandAvailable || !row || !row.primaryAction?.canRun) return null;') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading || !managerCommandCenter.nextBestAction?.canRun}') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading || !row.canRun || row.routeResolved === false'), 'Manager command, walkthrough, and action queue controls must remain visible and backend-attemptable based on configured project/backend command availability, not a stale frontend online status label.');
assert(appSource.includes('if (!activeProject || !backendCommandAvailable || !action || !action.canRun) return null;') && appSource.includes('if (!activeProject || !backendCommandAvailable) return null;') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading || !action.canRun}') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading || !row.canRun || row.routeResolved === false}'), 'Autonomous Run Control and Agent Autonomous Queue actions must attempt backend routes whenever the project has a backend command target, even if the station status label is stale.');
assert(appSource.includes('const canSeedActiveProjectSnapshotToBackend = (project = activeProject)') && appSource.includes('if (!canSeedActiveProjectSnapshotToBackend(activeProject))') && appSource.includes('Backend project not found; local snapshot seeding is disabled for real projects.'), 'Hidden backend project seeding must be limited to sample/dev fallback projects; real backend command paths must fail closed instead of PUT-ing stale browser snapshots.');
assert(appSource.includes('runBackendPrivatePilotReceipt') && appSource.includes('manager-ui-private-pilot-receipt') && appSource.includes('includeReadModels: false'), 'Manager UI must record private-pilot launch receipts through backend command routes with receipt-first refresh, not frontend state mutation.');
assert(apiSource.includes('providerEvalRunReadModels') && apiSource.includes("route.action === 'provider-eval-runs'") && apiSource.includes('providerEvalRunWorkflowRoute') && apiSource.includes('providerControlledRunRoute') && apiSource.includes('managerReadyPackageRoute'), 'Provider eval run writes must support receipt-first provider/manager read-model refresh routes instead of embedding large Manager snapshots.');
assert(appSource.includes('backend-provider-eval-record-shadow-replay') && appSource.includes('manager-ui-provider-eval-receipt') && appSource.includes("workflowKey: 'providerEvalRunWorkflow'") && appSource.includes("receiptKey: 'providerEvalRun'"), 'Manager UI must let C-side operators record provider eval shadow replay through the backend receipt path.');
assert(appSource.includes('runBackendProductionControlReceipt') && appSource.includes('manager-ui-production-control-receipt') && appSource.includes("evidenceEnvironment: 'local-rehearsal'") && appSource.includes('backend-production-operations-record-controls') && appSource.includes('backend-production-deployment-record-controls') && appSource.includes('backend-production-security-record-controls') && appSource.includes('backend-production-provider-record-controls'), 'Manager UI production-control buttons must write backend local-rehearsal receipts instead of frontend state or public-production certification.');
assert(
  appSource.includes('backend-private-pilot-record-release-candidate')
    && appSource.includes('backend-private-pilot-record-launch-run')
    && appSource.includes('backend-private-pilot-record-launch-health')
    && appSource.includes('backend-private-pilot-record-acceptance-report')
    && appSource.includes('backend-launch-approval-record-manager')
    && appSource.includes('backend-launch-approval-record-security')
    && appSource.includes('backend-project-evidence-export-request')
    && appSource.includes('backend-project-evidence-export-approve-manager')
    && appSource.includes('backend-project-evidence-export-approve-security')
    && appSource.includes('backend-project-evidence-export-record-download-audit')
    && appSource.includes('privatePilotReleaseCandidateWorkflow')
    && appSource.includes('privatePilotLaunchRunWorkflow')
    && appSource.includes('privatePilotLaunchHealthCheckWorkflow')
    && appSource.includes('privatePilotAcceptanceReportWorkflow'),
  'Manager Ready Package must expose backend-backed C-side controls for release, launch, health, and acceptance private-pilot receipts.',
);
assert(backendUiValidationSource.includes('backend-private-pilot-record-release-candidate') && backendUiValidationSource.includes('backend-private-pilot-record-acceptance-report') && backendUiValidationSource.includes('receipt button disabled until backend gates pass'), 'Backend-connected browser validation must cover private-pilot receipt controls and gate-disabled state.');
assert(backendUiValidationSource.includes('backend-launch-approval-record-manager') && backendUiValidationSource.includes('backend-project-evidence-export-record-download-audit') && backendUiValidationSource.includes('record the missing private-pilot approval role') && backendUiValidationSource.includes('evidence export request button disabled'), 'Backend-connected browser validation must cover launch approval command controls plus evidence-export gate-disabled state.');
assert(appSource.includes('Manager Scenario Walkthrough') && appSource.includes('manager-scenario-walkthrough') && appSource.includes('Run walkthrough step') && appSource.includes('Walkthrough proof') && appSource.includes('Primary action:') && appSource.includes('Result inspection:') && appSource.includes('Run result proof') && appSource.includes('manager-walkthrough-run-') && appSource.includes('runManagerScenarioWalkthroughRow') && appSource.includes("/manager-scenario-walkthrough/${encodeURIComponent(row.id || 'next')}/run") && appSource.includes('Walkthrough route:'), 'Project dashboard must expose a guided manager scenario walkthrough that links each story stage to runnable actions, result inspection, and proof exits.');
assert(appSource.includes('manager-action-playbook') && appSource.includes('Manager Action Playbook') && appSource.includes('Operational next steps mapped to runnable backend routes and exact proof exits') && appSource.includes('managerActionPlaybook') && appSource.includes('manager-action-playbook-open-') && appSource.includes('manager-action-playbook-run-') && appSource.includes('Open Step') && appSource.includes('Run Action') && appSource.includes('Run Again') && appSource.includes('rerunnable'), 'Project dashboard must expose a manager-readable action playbook with backend routes, executable/rerunnable actions, and proof exits.');
assert(appSource.includes('manager-scenario-trail') && appSource.includes('Manager Scenario Trail') && appSource.includes('Project Brief Heard') && appSource.includes('Leader Marker Confirmed') && appSource.includes('Assigned Work Progress') && appSource.includes('Meeting + Google Chat Change') && appSource.includes('Trail proof') && appSource.includes('Scenario Trail'), 'Project dashboard must expose a single manager-readable end-to-end scenario trail with proof jumps.');
assert(serviceSource.includes('managerScenarioTrailRows') && serviceSource.includes('managerScenarioTrail') && serviceSource.includes('Project Brief Heard') && serviceSource.includes('Meeting + Google Chat Change'), 'Backend manager dashboard must expose the end-to-end manager scenario trail read model.');
assert(appSource.includes('sync-protocol-audit') && appSource.includes('Sync Protocol Audit') && appSource.includes('Backend collaboration protocol') && appSource.includes('Protocol timeline proof') && appSource.includes('Agent State') && appSource.includes('Ledger'), 'Project dashboard must expose a manager-readable backend sync protocol audit with proof jumps.');
assert(serviceSource.includes('syncProtocolAudit') && serviceSource.includes('syncProtocolRows') && serviceSource.includes('eventLedgerHasEvidence') && serviceSource.includes('Kickoff Decision Sync') && serviceSource.includes('Change Request Sync'), 'Backend manager dashboard must expose a unified sync protocol audit read model.');
assert(appSource.includes('backendOrAllowedFallback') && appSource.includes('frontendMockSuppressed') && appSource.includes('backend model missing') && appSource.includes('demo data') && appSource.includes('backend-backed'), 'Project dashboard must label Manager read-model provenance and suppress frontend fallback rows when backend read models are required.');
assert(appSource.includes('managerReadModelSourceLabel') && appSource.includes('managerReadModelSourceClass') && appSource.includes('manager-command-center-source') && appSource.includes('manager-scenario-walkthrough-source') && appSource.includes('manager-action-playbook-source') && appSource.includes('manager-use-case-audit-source') && appSource.includes('sync-protocol-audit-source'), 'Manager governance surfaces must expose visible backend-backed/demo/backend-required source labels for C-side proof controls.');
assert(appSource.includes('manager-flow-graph/missing-backend') && appSource.includes('manager-flow-source-label') && appSource.includes('manager-flow-backend-required') && appSource.includes('backendFlowGraphReady') && appSource.includes('const allowFlowFrontendFallbacks = allowLocalRuntimeFallbackForActiveProject(activeProject)') && appSource.includes('onClick={() => syncBackendManagerFlowGraph({ silent: false })}') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading}') && appSource.includes('onClick={() => confirmManagerFlowNode(selectedNode.id, true)}') && appSource.includes('onClick={() => confirmManagerFlowNode(selectedNode.id, false)}'), 'Manager Flow Graph must suppress frontend fallback rows for backend-synced real projects and keep Sync/Confirm/Supersede backend-attemptable from the configured command target rather than a stale frontend online status label.');
assert(appSource.includes('agent-workbench-') && appSource.includes('runBackendAgentEvidenceSearch') && appSource.includes('runBackendAgentArtifactSubmission') && appSource.includes('runBackendAgentArtifactDraft'), 'Agent Focus Workspace must expose a backend-backed Agent Workbench for evidence, artifact submissions, and draft submissions.');
assert(appSource.includes('/evidence-searches') && appSource.includes('/submissions') && appSource.includes('/artifact-drafts') && appSource.includes('includeReadModels: false') && appSource.includes('refreshAgentWriteReadModels') && appSource.includes('readRoutes.projectRoute') && appSource.includes('readRoutes.readinessProofMapRoute') && appSource.includes('readRoutes.transcriptsRoute') && appSource.includes('readRoutes.timelineRoute') && appSource.includes('readRoutes.eventsRoute') && appSource.includes('projectPayload?.project'), 'Agent Workbench writes must use backend Agent routes with lightweight read-model receipts and explicit project/proof/transcript/timeline/event refreshes instead of frontend mock rows.');
assert(appSource.includes('agentWorkbenchFailurePatch') && appSource.includes('Agent Workbench Write Failed') && appSource.includes('provider-evidence-search-failed') && appSource.includes('manual-source-record-failed') && appSource.includes('artifact-submission-failed') && appSource.includes('artifact-draft-submit-failed') && appSource.includes('no local workbench proof was created') && appSource.includes('localProofCreated: false'), 'Agent Workbench failed evidence/submission/draft writes must replace stale receipts with visible non-proof failure state.');
assert(apiSource.includes('projectMessagesRoute') && apiSource.includes('mainTranscriptRoute') && apiSource.includes('readinessProofMapRoute') && apiSource.includes('timelineRoute') && apiSource.includes('eventsRoute'), 'Lightweight backend read-model receipts must expose project, proof map, transcript, timeline, and event refresh routes for Agent and Manager writes.');
assert(appSource.includes('if (!activeProject || !agentId || !shouldAttemptBackendProjectWrite(activeProject)) return;') && appSource.includes('if (!activeProject?.id || !submission?.id || !shouldAttemptBackendProjectWrite(activeProject)) return;') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading || workbenchTaskOptions.length === 0}') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading || workbenchReviewOptions.length === 0}') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading}') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading || !rowReviewerId}') && appSource.includes('disabled={!backendCommandAvailable || backendStation.loading || !selectedMessageTarget}'), 'Agent Workbench, Reviewer composer, Agent Pulse, and Agent-to-Agent message controls must remain backend-attemptable from the configured backend command target instead of relying on a stale frontend online label.');
assert(appSource.includes('AGENT_WORKBENCH_ARTIFACT_TYPES') && appSource.includes('discovery-report') && appSource.includes('brainstorm-board') && appSource.includes('evidence-packet') && appSource.includes('product-brief') && appSource.includes('decision-proposal') && appSource.includes('risk-review') && appSource.includes('implementation-plan') && appSource.includes('final-deliverable'), 'Agent Workbench must stay generic to product-team artifact nodes rather than becoming a research-only surface.');
assert(serviceSource.includes('agent-artifact-storage-proof/v1') && serviceSource.includes('artifactStorageProofChecksum') && serviceSource.includes('artifact-storage-proof-ready') && serviceSource.includes('artifact-storage-proofs'), 'Agent submissions must carry checksummed artifact storage proof through the standard submission contract, artifact audit, archive manifest, and persistence/read-model surfaces.');
assert(appSource.includes('manager-live-command-center') && appSource.includes('Manager Live Command Center') && appSource.includes('Next best action:') && appSource.includes('Kickoff Decision Board') && appSource.includes('Leader Marker') && appSource.includes('Next Actions Confirmed') && appSource.includes('Work Loop Board') && appSource.includes('Loop proof') && appSource.includes('Collaboration Board') && appSource.includes('Leader @assignments') && appSource.includes('Agent messages') && appSource.includes('Collaboration proof') && appSource.includes('Change Protocol Board') && appSource.includes('Owner Plan Updated') && appSource.includes('Team Resync') && appSource.includes('Change protocol proof') && appSource.includes('Attention Queue') && appSource.includes('Agent Readiness') && appSource.includes('Latest @Signal') && appSource.includes('Work Started') && appSource.includes('Change Owner Sync') && appSource.includes('Owner Confirmed') && appSource.includes('Plan Updated') && appSource.includes('manager-command-kickoff-proof-') && appSource.includes('manager-command-work-loop-proof-') && appSource.includes('manager-command-collaboration-proof-') && appSource.includes('manager-command-change-protocol-proof-') && appSource.includes('manager-command-change-proof-') && appSource.includes('manager-command-agent-inbox-proof-') && appSource.includes('manager-command-run-next') && appSource.includes('runManagerCommandCenterNext') && appSource.includes('manager-command-run-receipt') && appSource.includes('Command run proof'), 'Project dashboard must expose a manager live command center with kickoff decisions, 24/7 work-loop proof, collaboration proof, change protocol proof, next action, attention queue, Agent receipt readiness, change owner sync, and run receipts.');
assert(serviceSource.includes('managerCommandCenter') && serviceSource.includes('managerCommandPrimaryAction') && serviceSource.includes('managerCommandAttentionRows') && serviceSource.includes('managerCommandLiveLanes') && serviceSource.includes('managerCommandKickoffRows') && serviceSource.includes('managerCommandKickoffBoard') && serviceSource.includes('managerCommandWorkLoopRows') && serviceSource.includes('managerCommandWorkLoopBoard') && serviceSource.includes('managerCommandCollaborationRows') && serviceSource.includes('managerCommandCollaborationBoard') && serviceSource.includes('managerCommandChangeProtocolRows') && serviceSource.includes('managerCommandChangeProtocolBoard') && serviceSource.includes('managerCommandChangeRows') && serviceSource.includes('changeReadyCount') && serviceSource.includes('getManagerCommandCenter') && serviceSource.includes('runManagerCommandCenterNext') && serviceSource.includes('manager-command-center-run-next') && serviceSource.includes('commandCenterAttentionCount') && serviceSource.includes('kickoffBoardReadyCount') && serviceSource.includes('workLoopRunningCount') && serviceSource.includes('collaborationReadyCount') && serviceSource.includes('changeProtocolReadyCount') && serviceSource.includes('changeOwnerReadyCount'), 'Backend manager dashboard and ready package must expose a manager command center read/run model with kickoff decision, 24/7 work-loop, collaboration, change protocol, and change owner sync rows.');
assert(apiSource.includes("route.action === 'manager-command-center'") && apiSource.includes('service.getManagerCommandCenter') && apiSource.includes("route.tail[0] === 'run-next'") && apiSource.includes('service.runManagerCommandCenterNext'), 'Backend API must expose standalone manager command center read and run-next endpoints.');
assert(serviceSource.includes('managerScenarioWalkthroughRows') && serviceSource.includes('managerScenarioWalkthrough') && serviceSource.includes('getManagerScenarioWalkthrough') && serviceSource.includes('runManagerScenarioWalkthroughStep') && serviceSource.includes('nextIncompleteStep') && serviceSource.includes('nextRunnableStep') && serviceSource.includes('resultInspection') && serviceSource.includes('manager-scenario-walkthrough-step-run') && serviceSource.includes('manager-scenario-walkthrough') && serviceSource.includes('walkthroughRunnableCount'), 'Backend manager dashboard and ready package must expose a guided scenario walkthrough read model with separate incomplete/rerunnable steps, result inspection, and a step-run entrypoint.');
assert(appSource.includes('manager-requirement-matrix') && appSource.includes('Manager Requirement Matrix') && appSource.includes('Each requested condition mapped to concrete chat, timeline, or read-model proof') && appSource.includes('Requirement proof') && appSource.includes('Requirements'), 'Project dashboard must expose a manager requirement matrix that maps requested conditions to evidence.');
assert(serviceSource.includes('managerRequirementMatrixRows') && serviceSource.includes('managerRequirementMatrix') && serviceSource.includes('Director opens a kickoff meeting') && serviceSource.includes('The owner adds the change to their plan') && serviceSource.includes('requirementReadyCount'), 'Backend manager dashboard and ready package must expose a requirement matrix read model.');
assert(appSource.includes('Manager Use Case Audit') && appSource.includes('manager-use-case-audit') && appSource.includes('Use case proof') && appSource.includes('Run use case action') && appSource.includes('Next action:') && appSource.includes('manager-use-case-run-') && appSource.includes('Kickoff Meeting') && appSource.includes('Group @Assignment') && appSource.includes('Owner Confirmation'), 'Project dashboard must expose a manager-readable use case audit that groups the requested story into proof-backed stages and runnable next actions.');
assert(serviceSource.includes('managerUseCaseAuditRows') && serviceSource.includes('managerUseCaseAuditRowsWithActions') && serviceSource.includes('runnableActionCount') && serviceSource.includes('nextAction') && serviceSource.includes('manager-use-case-audit') && serviceSource.includes('getManagerUseCaseAudit'), 'Backend manager dashboard and ready package must expose a standalone manager use case audit read model linked to Action Queue next actions.');
assert(serviceSource.includes('managerActionQueueRows') && serviceSource.includes('managerActionSpecs') && serviceSource.includes('nextActionId') && serviceSource.includes('Open kickoff meeting') && serviceSource.includes('Broadcast dual-channel change') && serviceSource.includes('actionQueueReadyCount'), 'Backend manager dashboard and ready package must expose a manager action queue read model with next-action metadata.');
assert(serviceSource.includes('kickoffMeetingRoute') && serviceSource.includes('kickoffMeetingId') && serviceSource.includes('routeResolved') && serviceSource.includes('actionQueueUnresolvedRouteCount'), 'Backend manager action queue must resolve kickoff meeting routes and expose unresolved route counts.');
assert(serviceSource.includes('requestBodyTemplate') && serviceSource.includes('requestBodyRequired') && serviceSource.includes('rerunnable: true') && serviceSource.includes('manager-action-playbook-24-7-pulse') && serviceSource.includes("apiPath: '/workers/autonomous/tick'") && serviceSource.includes('forceAgentRun') && serviceSource.includes('manager-action-playbook-management-sync'), 'Backend manager action queue must expose request body templates and rerunnable metadata for runnable POST actions, including scheduler-backed 24/7 pulses.');
assert(appSource.includes('Body template:') && appSource.includes('Next body:') && appSource.includes('Run route:') && appSource.includes('requestBodyTemplate') && appSource.includes('runApiPath') && appSource.includes('/manager-action-queue/${encodeURIComponent(actionId)}/run') && appSource.includes('runManagerActionPlaybookRow'), 'Project dashboard must display request body templates and execute action queue items through the backend run endpoint.');
assert(appSource.includes('Manager Action Run Ledger') && appSource.includes('manager-action-run-ledger') && appSource.includes('Run proof') && appSource.includes('backendManagerActionRuns'), 'Project dashboard must expose Action Queue execution receipts with timeline proof jumps.');
assert(appSource.includes('managerChangeDraft') && appSource.includes('projectManagerUiStateKey') && appSource.includes('managerChangeDraftFor') && appSource.includes('updateManagerChangeDraft') && appSource.includes('Manager Change Intake') && appSource.includes('manager-change-intake-composer') && appSource.includes('manager-change-composer-input') && appSource.includes('manager-change-composer-mode') && appSource.includes('manager-change-composer-submit') && appSource.includes('submitManagerChangeIntake') && appSource.includes('submitProjectMeetingMessage') && appSource.includes('submitProjectChatMessage') && !appSource.includes('setManagerChangeDraft(prev'), 'Project dashboard must let managers type a custom mid-project change and send it to War Room, Google Chat, or both, with the draft scoped to the active project.');
assert(existsSync(new URL('./validate-manager-backend-ui.mjs', import.meta.url)) && packageSource.includes('ui:manager-backend'), 'Backend-connected manager UI validation must be available as a package script.');
assert(existsSync(new URL('./validate-manager-backend-core-ui.mjs', import.meta.url)) && packageSource.includes('ui:manager-backend:core'), 'Fast Backend Worker Station C/A control validation must be available as a package script.');
assert(existsSync(new URL('./validate-manager-provider-proof-ui.mjs', import.meta.url)) && packageSource.includes('ui:manager-provider-proof'), 'Focused Manager provider proof UI validation must be available as a package script.');
assert(existsSync(new URL('./validate-settings-agents-server-ui.mjs', import.meta.url)) && packageSource.includes('ui:settings-agents-server'), 'Settings API key UI validation must run against the real agents:server Secret Vault path.');
assert(existsSync(new URL('./validate-manager-mission-runner-ui.mjs', import.meta.url)) && packageSource.includes('ui:manager-mission-runner') && packageSource.includes('ui:real-user-zero-to-autonomy'), 'Real user zero-to-autonomy browser validation must be available through the Mission Runner script and clear customer-facing alias.');
assert(existsSync(new URL('./validate-manager-private-pilot-ui.mjs', import.meta.url)) && packageSource.includes('ui:manager-private-pilot'), 'C-side private-pilot browser validation must be available as a package script.');
assert(
  packageSource.includes('agents:product-team:private-pilot:release')
    && packageSource.includes('agents:product-team:private-pilot:launch-handoff')
    && packageSource.includes('agents:product-team:private-pilot:launch')
    && packageSource.includes('agents:product-team:private-pilot:health')
    && packageSource.includes('agents:product-team:private-pilot:acceptance'),
  'Product-team private-pilot validation must expose staged release, launch, health, and acceptance gates instead of one opaque long runner.',
);
assert(
  productTeamAcceptanceSource.includes("'private-pilot-launch-handoff': 'private-pilot launch approval record ready'")
    && productTeamAcceptanceSource.includes("'private-pilot-handoff': 'private-pilot release candidate record ready'")
    && productTeamAcceptanceSource.includes("'private-pilot-release': 'private-pilot release candidate receipt ready'")
    && productTeamAcceptanceSource.includes("'private-pilot-launch': 'private-pilot launch run receipt ready'")
    && productTeamAcceptanceSource.includes("'private-pilot-health': 'private-pilot launch health check receipt ready'")
    && productTeamAcceptanceSource.includes("'private-pilot-acceptance': 'private-pilot acceptance report ready'")
    && productTeamAcceptanceSource.includes("'private-pilot': 'private-pilot acceptance report ready'")
    && productTeamAcceptanceSource.includes("progress('private-pilot launch approval record ready')")
    && productTeamAcceptanceSource.includes("progress('private-pilot release candidate record ready')")
    && productTeamAcceptanceSource.includes("progress('private-pilot release candidate receipt ready')")
    && productTeamAcceptanceSource.includes("progress('private-pilot acceptance report ready')"),
  'Product-team private-pilot validation stages must stop after each receipt is proven, not when the script merely reaches the section.',
);
assert(
  privatePilotUiValidationSource.includes('private-pilot-ui-launch-approval-prep')
    && privatePilotUiValidationSource.includes('ACCEPTANCE_RUN_ID')
    && privatePilotUiValidationSource.includes('HOFS_MANAGER_PRIVATE_PILOT_RUN_ID')
    && privatePilotUiValidationSource.includes('HOFS_PRODUCT_TEAM_RUN_ID: ACCEPTANCE_RUN_ID')
    && privatePilotUiValidationSource.includes('HANDOFF_PREP_TIMEOUT_MS')
    && privatePilotUiValidationSource.includes('Private-pilot launch-approval UI preparation timed out')
    && privatePilotUiValidationSource.includes('../.tmp/product-team-acceptance/${ACCEPTANCE_RUN_ID}/store.json')
    && privatePilotUiValidationSource.includes('backend-launch-approval-record-manager')
    && privatePilotUiValidationSource.includes('backend-launch-approval-record-security')
    && privatePilotUiValidationSource.includes('backend-project-evidence-export-request')
    && privatePilotUiValidationSource.includes('backend-project-evidence-export-record-download-audit')
    && privatePilotUiValidationSource.includes('backend-private-pilot-record-release-candidate')
    && privatePilotUiValidationSource.includes('backend-private-pilot-record-launch-run')
    && privatePilotUiValidationSource.includes('backend-private-pilot-record-launch-health')
    && privatePilotUiValidationSource.includes('backend-private-pilot-record-acceptance-report')
    && privatePilotUiValidationSource.includes('/manager-flow-graph')
    && privatePilotUiValidationSource.includes('/readiness-proof-map'),
  'C-side private-pilot browser validation must use an isolated backend handoff checkpoint with bounded preparation, click all real receipt buttons, and verify backend Flow Graph plus Proof Map evidence.',
);
assert(backendUiValidationSource.includes("clickDashboardStep(page, 'google_change')") && backendUiValidationSource.includes("clickDashboardStep(page, 'meeting_change')") && backendUiValidationSource.includes("clickDashboardStep(page, 'dual_channel_change')"), 'Backend-connected manager UI validation must exercise online Google Chat, War Room, and dual-channel changes.');
assert(backendUiValidationSource.includes('agent-message-send-musk') && backendUiValidationSource.includes('manager-ui-agent-message-proof'), 'Backend-connected manager UI validation must exercise online Agent-to-Agent messages.');
assert(backendUiValidationSource.includes("change.source === 'google-chat-mention-change-request'") && backendUiValidationSource.includes("change.source === 'war-room-meeting-change-request'"), 'Backend-connected manager UI validation must verify persisted change-ledger sources.');
assert(backendUiValidationSource.includes('Approved real backend projects must keep browser snapshot Seed Sample/Dev disabled') && backendUiValidationSource.includes("page.getByTestId('backend-save-project').isDisabled()"), 'Backend-connected manager UI validation must prove real initiated projects cannot seed browser snapshots over backend receipt ledgers.');
assert(backendUiValidationSource.includes('withSuppressedBackendFlowGraph') && backendUiValidationSource.includes('manager-flow-backend-required') && backendUiValidationSource.includes('backend model missing') && backendUiValidationSource.includes('fallbackNodeCount === 0') && backendUiValidationSource.includes('frontend-generated flow nodes are suppressed'), 'Backend-connected manager UI validation must prove real projects suppress frontend Flow Graph fallback nodes when the backend flow read model is missing.');
assert(
  appSource.includes('backend-product-team-delivery-trace-source')
    && appSource.includes('backend-product-team-operating-loop-source')
    && appSource.includes('backend-team-collaboration-diagnostics-source')
    && appSource.includes('backend-runtime-contracts-source')
    && appSource.includes('backend-autonomous-cycle-consistency-source')
    && appSource.includes('managerReadModelSourceLabel(backendProductTeamOperatingLoop)')
    && backendUiValidationSource.includes("page.getByTestId('backend-product-team-operating-loop-source')"),
  'Ready Package C/A autonomy panels must expose backend source labels so backend-required placeholders cannot masquerade as live read models.',
);
assert(serviceSource.includes('applyChatMessagesToAgentStates') && serviceSource.includes('source: userMessageSource'), 'Ordinary group chat messages must be delivered into Agent state by the project service, not only rendered in chat.');
assert(appSource.includes('backfillProjectEventLedger') && appSource.includes('const hydrateProject = (project) => backfillProjectEventLedger'), 'Project hydration must backfill legacy project event ledgers.');
assert(serviceSource.includes('runProjectAutonomousCycle') && serviceSource.includes("source: 'backend-kickoff-first-pulse-chat'"), 'Autonomous cycle chat must be published back into Agent state and event ledger from the kickoff service boundary.');
assert(serviceSource.includes('projectAfterUserMessage') && serviceSource.includes('project: projectAfterUserMessage'), 'Special chat commands must persist the Director source message before runtime handlers run.');
assert(serviceSource.includes('projectAfterMeetingMessage') && serviceSource.includes("source: 'war-room-meeting-message'"), 'War Room feature-change commands must persist the Director meeting source message before runtime handlers run.');
assert(appSource.includes('requestMessageId: meetingSourceMessage?.id || null'), 'Legacy War Room meeting input must preserve its source message id on feature-change records.');
assert(serviceSource.includes('const isPeerHandoff = !isFeatureChange && isPeerHandoffRequest(trimmedText)') && serviceSource.includes('const isLeaderAssignment = !isFeatureChange && !isPeerHandoff'), 'Peer handoff chat commands must be routed before broad Leader assignment detection.');
assert(serviceSource.includes('runAgentWorkCycle') && serviceSource.includes('agentWorkerLedger') && serviceSource.includes("source: 'agent-work-cycle-chat'"), 'Backend service must expose independent per-Agent work cycles that publish chat and timeline evidence.');
assert(serviceSource.includes('submitWorkArtifact') && serviceSource.includes('workSubmissionId') && serviceSource.includes("tags: ['autonomous-worker', 'agent-initiative'") && serviceSource.includes('submitAgentArtifact({'), 'Independent Agent worker cycles must be able to submit completed autonomous work through the standard Agent submission contract.');
assert(serviceSource.includes('resolveAgentWorkArtifactType') && serviceSource.includes('inferAgentWorkArtifactType') && serviceSource.includes("workArtifactType: 'auto'"), 'Autonomous Agent workers must be able to infer generic product-team artifact types from task intent instead of only submitting progress briefs.');
assert(serviceSource.includes('shouldAgentWorkerRecordEvidenceSearch') && serviceSource.includes('buildAgentWorkerEvidenceSearchPayload') && serviceSource.includes('recordAgentEvidenceSearch({') && serviceSource.includes('evidenceSearchResult'), 'Autonomous Agent workers must be able to record standard evidence-search proof for evidence-oriented tasks.');
assert(serviceSource.includes('runAgentWorkCycleWithProviderEvidence') && serviceSource.includes('runAgentAutonomousActionQueueItemWithProviderEvidence') && serviceSource.includes('useProviderEvidenceSearch') && serviceSource.includes('providerEvidenceSearchPlanned') && serviceSource.includes('evidenceSearchProviderReceipt') && serviceSource.includes("schemaVersion: 'agent-worker-provider-evidence/v1'"), 'Autonomous Agent workers and Agent Queue rows must have a controlled provider-backed evidence bridge from strategy-selected worker cycles to standard evidence-search nodes.');
assert(serviceSource.includes('reviewPendingSubmission') && serviceSource.includes('pendingSubmissionForReviewer') && serviceSource.includes('reviewAgentSubmission({') && serviceSource.includes('submissionReviewId'), 'Independent Reviewer worker cycles must be able to review pending submissions through the standard submission-review contract.');
assert(serviceSource.includes('automaticReviewVerdictForSubmission') && serviceSource.includes("['auto', 'automatic', 'autonomous-review'].includes(reviewVerdictMode)"), 'Reviewer worker cycles must support automatic verdict selection for scheduler-driven review loops.');
assert(serviceSource.includes('respondToReviewObligation') && serviceSource.includes('pendingReviewResponseForAgent') && serviceSource.includes('reviewResponseSubmissionId') && serviceSource.includes("tags: ['review-response', 'revision-loop'"), 'Independent Agent worker cycles must be able to respond to requested-change review obligations through linked revision submissions.');
assert(serviceSource.includes('buildAgentAutonomousStrategyDecision') && serviceSource.includes('agent-autonomous-strategy-decision/v1') && serviceSource.includes('strategySelectedAction'), 'Independent Agent worker cycles must record a backend autonomous strategy decision before taking submission/review/revision actions.');
assert(serviceSource.includes('buildAgentAutonomousActionQueue') && serviceSource.includes('agent-autonomous-action-queue/v1') && serviceSource.includes('runAgentAutonomousActionQueueItem') && serviceSource.includes('agentAutonomousActionRunLedger') && serviceSource.includes("schemaVersion: 'agent-autonomous-action-run/v1'"), 'Backend service must expose an Agent autonomous action queue that can run and persist strategy-selected Agent work-cycle receipts.');
assert(serviceSource.includes('buildAgentAutonomousInitiativeRow') && serviceSource.includes('agent-autonomous-initiative/v1') && serviceSource.includes('initiativeRows') && serviceSource.includes('targetArtifactTypes'), 'Agent autonomous action queues and Product Team Operating Loop must expose explicit Agent initiative rows with intent, artifact targets, and backend run routes.');
assert(serviceSource.includes('agentInitiativeId') && serviceSource.includes('queuedAgentInitiativeCount') && serviceSource.includes('agentInitiativeArtifactTypes') && serviceSource.includes('agentAutonomousActionRunApiPath'), 'Worker queue and Autonomous Run Control receipts must preserve Agent initiative ids, artifact targets, and queue run routes for scheduler/lease proof.');
assert(serviceSource.includes('leaderAssignmentStartWorkResponse') && serviceSource.includes("trigger: 'leader-assignment-start-work'") && serviceSource.includes("cadence: 'assignment-start'"), 'Backend service must immediately start the assigned Agent work pulse after a Leader @assignment.');
assert(serviceSource.includes('runDueAgentWorkCycles') && serviceSource.includes('evaluateAgentWorkSchedule') && serviceSource.includes('nextAgentRunAt'), 'Backend service must scan due independent Agent work cycles.');
assert(serviceSource.includes('agentManagementPriority') && serviceSource.includes('managementPriority') && serviceSource.includes('agent-max-per-project-limit'), 'Backend due-Agent worker must prioritize managed Agent work before lower-priority due Agents.');
assert(serviceSource.includes('managementSignalItems') && serviceSource.includes('management-response') && serviceSource.includes('managementResponseTargetIds'), 'Independent Agent workers must respond to manager and peer-manager signals as a closed management loop.');
assert(serviceSource.includes('agent-work-cycle-management') && serviceSource.includes('managementTargetIds'), 'Independent Agent worker cycles must publish auditable management check-ins to managed Agents.');
assert(apiSource.includes("route.tail[1] === 'work-cycle'") && apiSource.includes('service.runAgentWorkCycle'), 'Backend API must expose per-Agent work cycles as an Agent subresource.');
assert(apiSource.includes('service.runAgentWorkCycleWithProviderEvidence') && apiSource.includes('service.runAgentAutonomousActionQueueItemWithProviderEvidence') && apiSource.includes('agent-work-cycle-provider-evidence-requires-async-handler') && apiSource.includes('providerEvidenceSearch: result.providerEvidenceSearch'), 'Backend API must expose async provider-backed Agent work cycles and Agent Queue runs without routing them through the sync handler.');
assert(apiSource.includes('workSubmission: result.workSubmission') && apiSource.includes('submission: item.result.submission'), 'Agent work-cycle API and due-worker responses must expose autonomous work submissions when the worker creates them.');
assert(apiSource.includes('evidenceSearch: result.evidenceSearch') && apiSource.includes('evidenceSearch: item.result.evidenceSearch'), 'Agent work-cycle API and due-worker responses must expose autonomous evidence-search receipts when the worker creates them.');
assert(apiSource.includes('review: result.review') && apiSource.includes('reviewedSubmission: item.result.reviewedSubmission'), 'Agent work-cycle API and due-worker responses must expose Reviewer worker review receipts when created.');
assert(apiSource.includes('reviewResponseSubmission: result.reviewResponseSubmission') && apiSource.includes('reviewResponseSubmission: item.result.reviewResponseSubmission'), 'Agent work-cycle API and due-worker responses must expose linked revision response submissions when created.');
assert(apiSource.includes("workerRoute?.worker === 'agents'") && apiSource.includes('service.runDueAgentWorkCycles'), 'Backend API must expose due per-Agent worker scanning.');
assert(httpServerSource.includes('submitAgentWorkArtifacts') && httpServerSource.includes('agentWorkArtifactReviewerAgentId'), 'HTTP scheduler ticks must be able to request autonomous Agent work submissions explicitly.');
assert(httpServerSource.includes("input.agentWorkArtifactType || (input.submitAgentWorkArtifacts ? 'auto' : undefined)"), 'HTTP scheduler ticks and startup sweeps must default autonomous Agent work submissions to task-inferred artifact types.');
assert(httpServerSource.includes('reviewPendingSubmissions') && httpServerSource.includes('agentReviewVerdict'), 'HTTP scheduler ticks must be able to request Reviewer worker review processing explicitly.');
assert(httpServerSource.includes('respondToReviewObligations') && httpServerSource.includes('reviewResponseArtifactType'), 'HTTP scheduler ticks must be able to request Submitter worker review-obligation responses explicitly.');
assert(httpServerSource.includes('useAutonomousStrategy: Boolean(input.useAgentAutonomousStrategy') && httpServerSource.includes('useAgentAutonomousStrategy: Boolean(input.useAgentAutonomousStrategy'), 'HTTP scheduler ticks and startup sweeps must forward Agent autonomous strategy controls.');
assert(httpServerSource.includes('const start = (input = {})') && httpServerSource.includes('submitAgentWorkArtifacts: Boolean(input.submitAgentWorkArtifacts)') && httpServerSource.includes('respondToReviewObligations: Boolean(input.respondToReviewObligations)') && httpServerSource.includes('scheduler.start({') && httpServerSource.includes('...body'), 'HTTP scheduler start must forward Agent submission, strategy, and revision-response controls from the HTTP body to its immediate startup sweep.');
assert(httpServerSource.includes('scheduledTickInput') && httpServerSource.includes('tick(scheduledTickInput)') && httpServerSource.includes('...autonomousScheduler') && httpServerSource.includes('startupAgentControlSummary') && httpServerSource.includes('scheduledAgentControlSummary') && httpServerSource.includes('lastTickAgentControlSummary'), 'HTTP scheduler autostart and interval ticks must preserve and expose startup Agent strategy/submission controls, not only the manual start request.');
assert(serviceSource.includes('buildEnvAutonomousAgentControlSummary') && serviceSource.includes('schedulerAgentControls') && serviceSource.includes('AGENT_AUTONOMOUS_AGENT_STRATEGY') && serviceSource.includes('AGENT_AUTONOMOUS_AGENT_REVIEW_RESPONSES'), 'Deployment preflight must expose the configured unattended Agent autonomy controls alongside scheduler readiness.');
assert(agentProjectServerSource.includes('AGENT_AUTONOMOUS_AGENT_STRATEGY') && agentProjectServerSource.includes('AGENT_AUTONOMOUS_AGENT_SUBMISSIONS') && agentProjectServerSource.includes('AGENT_AUTONOMOUS_AGENT_REVIEWS') && agentProjectServerSource.includes('AGENT_AUTONOMOUS_AGENT_REVIEW_RESPONSES') && agentProjectServerSource.includes('createSecretVaultFromEnv') && agentProjectServerSource.includes('SECRET_VAULT_RECORDS_FILE') && agentProjectServerSource.includes('openVaultProviderKey') && agentProjectServerSource.includes('includeReadModels: false'), 'Local agents:server must expose explicit env controls for unattended Agent strategy, submissions, reviews, review-response loops, and restartable Secret Vault startup without heavy embedded read models.');
assert(packageSource.includes('agents:server:validate') && existsSync(new URL('./validate-agent-project-server-secret-vault.mjs', import.meta.url)), 'Local agents:server Secret Vault validation must be available as a package script.');
assert(apiSource.includes('managementPriority') && apiSource.includes('managementReasons'), 'Backend API must expose management priority metadata for due per-Agent workers.');
assert(serviceSource.includes('getTranscriptIndex') && serviceSource.includes('getChannelTranscript') && serviceSource.includes('buildTranscriptIndex') && serviceSource.includes('archivedProofMessages'), 'Backend service must expose project transcript index and per-channel transcript reads with archived proof recovery.');
assert(apiSource.includes("route.action === 'transcripts'") && apiSource.includes('service.getTranscriptIndex') && apiSource.includes('service.getChannelTranscript'), 'Backend API must expose transcript index and channel transcript endpoints.');
assert(serviceSource.includes('getReadinessProofMap') && serviceSource.includes('buildReadinessProofMap') && serviceSource.includes('proofKind') && serviceSource.includes('apiPath'), 'Backend service must expose a manager readiness proof map with typed evidence routes.');
assert(apiSource.includes("route.action === 'readiness-proof-map'") && apiSource.includes('service.getReadinessProofMap'), 'Backend API must expose readiness proof-map endpoints.');
assert(apiSource.includes("route.action === 'agent-autonomous-action-queue'") && apiSource.includes('service.getAgentAutonomousActionQueue') && apiSource.includes('service.runAgentAutonomousActionQueueItem'), 'Backend API must expose Agent autonomous action queue read/run endpoints.');
assert(serviceSource.includes('getManagerDashboard') && serviceSource.includes('buildManagerDashboardSnapshot') && serviceSource.includes('operationsBoard') && serviceSource.includes('managementMesh') && serviceSource.includes('assignmentFlow') && serviceSource.includes('changeFlow'), 'Backend service must expose an aggregated manager dashboard read model.');
assert(serviceSource.includes('agentCommunicationFlow') && serviceSource.includes('senderWorklogSeen') && serviceSource.includes('inboxSeen'), 'Backend manager dashboard must expose Agent communication flow from sender worklog to target inbox.');
assert(serviceSource.includes('agentMessageDeliveryRows') && serviceSource.includes('deliveryRows') && serviceSource.includes('deliveredCount'), 'Backend manager dashboard must expose per-target Agent message delivery rows.');
assert(serviceSource.includes('conversationRows: kickoffConversationRows') && serviceSource.includes('role-clarification') && serviceSource.includes('leader-campaign'), 'Backend manager dashboard must expose kickoff conversation rows for role clarification and Leader campaigns.');
assert(serviceSource.includes('kickoffExecutionFlow') && serviceSource.includes('nextActionResolution') && serviceSource.includes('nextActionResolutionDelivery') && serviceSource.includes('kickoff-decision-broadcast') && serviceSource.includes('firstPulseSchedulerRecord') && serviceSource.includes('readyForAutonomy'), 'Backend manager dashboard must expose kickoff execution flow from confirmed next actions to Agent receipts and first pulse.');
assert(apiSource.includes("route.action === 'manager-dashboard'") && apiSource.includes('service.getManagerDashboard'), 'Backend API must expose a manager dashboard endpoint.');
assert(serviceSource.includes('getManagerScenarioTrail') && serviceSource.includes('managerScenarioTrail: projectId ? `/projects/${projectId}/manager-scenario-trail`') && apiSource.includes("route.action === 'manager-scenario-trail'") && apiSource.includes('service.getManagerScenarioTrail'), 'Backend API must expose a standalone manager scenario trail endpoint and route hint.');
assert(serviceSource.includes('getManagerScenarioWalkthrough') && serviceSource.includes('managerScenarioWalkthrough: projectId ? `/projects/${projectId}/manager-scenario-walkthrough`') && apiSource.includes("route.action === 'manager-scenario-walkthrough'") && apiSource.includes('service.getManagerScenarioWalkthrough') && apiSource.includes('service.runManagerScenarioWalkthroughStep'), 'Backend API must expose standalone manager scenario walkthrough read/run endpoints and route hints.');
assert(serviceSource.includes('getManagerRequirementMatrix') && serviceSource.includes('managerRequirementMatrix: projectId ? `/projects/${projectId}/manager-requirement-matrix`') && apiSource.includes("route.action === 'manager-requirement-matrix'") && apiSource.includes('service.getManagerRequirementMatrix'), 'Backend API must expose a standalone manager requirement matrix endpoint and route hint.');
assert(serviceSource.includes('getSyncProtocolAudit') && serviceSource.includes('syncProtocolAudit: projectId ? `/projects/${projectId}/sync-protocol-audit`') && apiSource.includes("route.action === 'sync-protocol-audit'") && apiSource.includes('service.getSyncProtocolAudit'), 'Backend API must expose a standalone sync protocol audit endpoint and route hint.');
assert(serviceSource.includes('getManagerUseCaseAudit') && serviceSource.includes('managerUseCaseAudit: projectId ? `/projects/${projectId}/manager-use-case-audit`') && apiSource.includes("route.action === 'manager-use-case-audit'") && apiSource.includes('service.getManagerUseCaseAudit'), 'Backend API must expose a standalone manager use case audit endpoint and route hint.');
assert(serviceSource.includes('getManagerActionQueue') && serviceSource.includes('runManagerActionQueueItem') && serviceSource.includes('managerActionRuns') && serviceSource.includes('manager-action-run') && serviceSource.includes('runApiPath') && serviceSource.includes('managerActionRunTemplate') && serviceSource.includes('managerActionQueue: projectId ? `/projects/${projectId}/manager-action-queue`') && apiSource.includes("route.action === 'manager-action-queue'") && apiSource.includes('service.getManagerActionQueue') && apiSource.includes('service.runManagerActionQueueItem'), 'Backend API must expose standalone manager action queue read/run endpoints and execution receipts with route hints.');
assert(serviceSource.includes('getManagerReadyPackage') && serviceSource.includes('managerReadyPackage: projectId ? `/projects/${projectId}/manager-ready-package`') && serviceSource.includes('scenarioTrailReadyCount') && apiSource.includes("route.action === 'manager-ready-package'") && apiSource.includes('service.getManagerReadyPackage'), 'Backend API must expose a manager ready package endpoint with dashboard, proof, trail, and summary data.');
assert(apiSource.includes('publicProjectResult') && apiSource.includes('managerDashboard: projectId ? service.getManagerDashboard(projectId) : null') && apiSource.includes('managerReadyPackage: projectId ? service.getManagerReadyPackage(projectId) : null'), 'Backend project command responses must include the aggregate manager dashboard and ready package snapshots.');
assert(apiSource.includes('managerDashboard: service.getManagerDashboard(item.projectId)') && apiSource.includes('managerReadyPackage: service.getManagerReadyPackage(item.projectId)'), 'Backend due-worker processed responses must include manager dashboard and ready package snapshots.');
assert(serviceSource.includes('getAgentDashboard') && serviceSource.includes('buildAgentDashboardSnapshot') && serviceSource.includes('managementProofLogIds') && serviceSource.includes('ownedTasks') && serviceSource.includes('dashboardPath'), 'Backend service must expose an independent per-Agent dashboard read model with task and management proof.');
assert(apiSource.includes("section === 'dashboard'") && apiSource.includes('service.getAgentDashboard'), 'Backend API must expose per-Agent dashboard endpoints.');
assert(serviceSource.includes('submitAgentMessage') && serviceSource.includes('agent-to-agent-message') && serviceSource.includes('targetAgentIds') && serviceSource.includes("eventType: 'agent-message'") && serviceSource.includes('agentMessageRoutes') && serviceSource.includes('readyForAgentMessageDelivery'), 'Backend service must expose Agent-authored messages with explicit target Agent delivery, timeline proof, and Readiness Proof Map routes.');
assert(apiSource.includes("route.tail[1] === 'message'") && apiSource.includes('service.submitAgentMessage'), 'Backend API must expose Agent-to-Agent message endpoints.');
assert(serviceSource.includes('createKickoffMeetingSession') && serviceSource.includes('addKickoffMeetingClarification') && serviceSource.includes('confirmKickoffMeetingLeader') && serviceSource.includes('confirmKickoffMeetingNextActions') && serviceSource.includes('approveKickoffMeetingSession') && serviceSource.includes('buildRoleQuestionResolutions') && serviceSource.includes('buildLeaderElectionResolution') && serviceSource.includes('buildNextActionResolution') && serviceSource.includes('awaiting-manager-decision'), 'Backend service must expose a durable kickoff meeting session with role-question, Leader election, and next-action confirmation before project approval.');
assert(apiSource.includes('parseKickoffMeetingRoute') && apiSource.includes("parts[0] !== 'kickoff-meetings'") && apiSource.includes('service.clarifyKickoffMeeting') && apiSource.includes('service.confirmKickoffMeetingLeader') && apiSource.includes('service.confirmKickoffMeetingNextActions') && apiSource.includes('service.approveKickoffMeeting'), 'Backend API must expose kickoff meeting session create/read/clarify/leader/next-actions/approve routes.');
assert(apiSource.includes('projectInitiationReadModels') && apiSource.includes('kickoffMeetingApprovalRoute') && apiSource.includes('mainTranscriptRoute') && apiSource.includes("path === '/projects/initiate'") && apiSource.includes("kickoffMeetingRoute.action === 'approve'"), 'Project initiation and kickoff approval routes must support receipt-first responses with project/transcript/proof refresh routes.');

const roleNegotiation = createKickoffRoleNegotiation(team, brief, { projectId, projectName });
assert(roleNegotiation.transcript.some((item) => item.type === 'role-question'), 'Kickoff must include role clarification questions.');
assert(roleNegotiation.transcript.some((item) => item.type === 'role-volunteer'), 'Kickoff must include self-nomination turns.');
assert(roleNegotiation.transcript.every((item) => Array.isArray(item.hears)), 'Kickoff turns must expose who each Agent hears.');

const leaderElection = createLeaderElection(team, brief, { projectId, projectName });
assert(leaderElection.candidates.length >= 2, 'Leader election must have multiple candidates.');
assert(leaderElection.transcript.every((item) => item.type === 'leader-campaign'), 'Leader election must produce campaign statements.');
assert(leaderElection.transcript.every((item) => Array.isArray(item.hearsOthers) && item.hearsOthers.length > 0), 'Leader election turns must expose who heard each campaign.');

const leaderId = leaderElection.recommendedLeaderId;
const confirmedTeam = team.map((member) => ({
  ...member,
  role: member.id === leaderId ? 'Leader' : member.title,
  skill: member.title,
  isLeader: member.id === leaderId,
}));
const peerManagementMatrix = buildPeerManagementMatrix(confirmedTeam, {
  leaderId,
  reviewerId: confirmedTeam.find((agent) => agent.id !== leaderId)?.id,
});
assert(peerManagementMatrix.length === confirmedTeam.length, 'Peer-management matrix must include every independent Agent.');
assert(peerManagementMatrix.every((row) => row.peerManagedIds.length === 1 && row.peerManagerIds.length === 1), 'Every Agent must have one peer-management target and one peer manager.');
const peerManagedProject = applyPeerManagementMatrix({
  project: {
    id: projectId,
    name: projectName,
    team: confirmedTeam,
    agentStates: {},
  },
  leaderId,
  reviewerId: confirmedTeam.find((agent) => agent.id !== leaderId)?.id,
  now: '2026-05-28T09:00:00.000Z',
});
assert(peerManagedProject.peerManagementMatrix.length === confirmedTeam.length, 'Applied peer-management matrix must persist on project state.');
assert(Object.values(peerManagedProject.agentStates).every((state) => state.peerManagedIds?.length === 1 && state.peerManagerIds?.length === 1), 'Applied peer-management matrix must persist on every Agent state surface.');
const receiptProbe = attachMessageReceipts({
  id: 'receipt_probe',
  channelId: 'main',
  author: 'Director',
  text: '@Alan Turing please confirm visibility',
  targets: ['Alan Turing'],
}, confirmedTeam, { seenAt: '2026-05-28T09:00:00.000Z' });
assert(receiptProbe.heardBy.length === confirmedTeam.length, 'Director group-chat messages must be heard by every Agent.');
assert(receiptProbe.directTargetIds.includes('turing'), 'Message receipts must identify directly mentioned Agents.');
assert(receiptProbe.visibility.receiptCount === confirmedTeam.length, 'Message visibility summary must preserve receipt count.');
const prunedLedgerProject = {
  id: 'ledger_pruned_project',
  eventLedger: Array.from({ length: EVENT_LEDGER_RETAINED_LIMIT }, (_, index) => ({
    id: `evt_old_${index}`,
    type: 'retained-event',
    time: '2026-05-28T09:00:00.000Z',
    sequence: 501 + index,
  })),
  eventLedgerFirstSequence: 501,
  eventLedgerLastSequence: EVENT_LEDGER_RETAINED_LIMIT + 500,
  eventLedgerEventCount: EVENT_LEDGER_RETAINED_LIMIT + 500,
};
const prunedAppend = appendProjectEvents(prunedLedgerProject, [{
  id: 'evt_after_prune',
  type: 'after-prune',
  time: '2026-05-28T09:01:00.000Z',
  actor: 'Agent Runtime',
  summary: 'Append after ledger retention window.',
}]);
const prunedSummary = summarizeProjectEventLedger(prunedAppend);
assert(prunedAppend.eventLedger.at(-1).sequence === EVENT_LEDGER_RETAINED_LIMIT + 501, 'Append-only event ledger must continue from the last known sequence after pruning.');
assert(prunedSummary.firstSequence === 502 && prunedSummary.lastSequence === EVENT_LEDGER_RETAINED_LIMIT + 501, 'Pruned event-ledger projection must preserve the retained sequence window.');
assert(prunedSummary.eventCount === EVENT_LEDGER_RETAINED_LIMIT + 501 && prunedSummary.retainedCount === EVENT_LEDGER_RETAINED_LIMIT, 'Pruned event-ledger projection must distinguish total and retained counts.');
const plainLegacyProject = backfillProjectEventLedger({
  id: 'plain_legacy_project',
  name: 'Plain Legacy Project',
  logs: [{ id: 'plain_log_1', time: '2026-05-28T09:05:00.000Z', agent: 'System', log: 'Plain project log.' }],
});
assert(plainLegacyProject.eventLedger.length === 1, 'Plain legacy projects without kickoff charter must backfill without crashing.');
const spacedMentionReplies = buildAgentChatReplies({
  team: confirmedTeam,
  text: '@Alan Turing please review the group chat routing proof',
  targets: ['Alan Turing'],
  channelId: 'main',
  context: { projectId, projectName },
});
assert(spacedMentionReplies.some((message) => message.author === 'Alan Turing'), 'Group chat @mentions with spaced Agent names must route to the mentioned Agent.');
checkpoint('runtime primitives');
const network = createAgentNetwork(confirmedTeam, { projectId, projectName, topic: brief });
assert(network.governance.lead?.id === leaderId, 'Confirmed isLeader marker must control runtime governance.');

const project = {
  id: projectId,
  name: projectName,
  status: 'executing',
  progress: 10,
  team: confirmedTeam,
  tasks: [
    { id: 1, text: 'Create kickoff charter', assignee: confirmedTeam.find((agent) => agent.isLeader).name, status: 'done' },
    { id: 2, text: 'Build group chat assignment protocol', assignee: 'Alan Turing', status: 'pending' },
    { id: 3, text: 'Define timeline evidence criteria', assignee: 'Marie Curie', status: 'pending' },
  ],
  logs: [],
};

const ordinaryUserMessage = attachMessageReceipts({
  id: 'ordinary_chat_direct_1',
  projectId,
  channelId: 'main',
  type: 'mention',
  author: 'Director',
  text: '@Alan Turing please sanity-check the architecture note',
  targets: ['Alan Turing'],
}, confirmedTeam, { seenAt: '2026-05-28T09:10:00.000Z' });
const ordinaryAgentReplies = buildAgentChatReplies({
  team: confirmedTeam,
  text: ordinaryUserMessage.text,
  targets: ordinaryUserMessage.targets,
  channelId: 'main',
  context: { projectId, projectName, now: '2026-05-28T09:10:00.000Z' },
});
const ordinaryChatProject = applyChatMessagesToAgentStates({
  project,
  team: confirmedTeam,
  messages: [ordinaryUserMessage, ...ordinaryAgentReplies.map((message) => ({ ...message, projectId }))],
  now: '2026-05-28T09:10:00.000Z',
  source: 'group-chat-message',
});
assert(ordinaryChatProject.agentStates.turing?.inbox.some((item) => item.sourceMessageId === ordinaryUserMessage.id), 'Ordinary direct @mentions must enter the mentioned Agent inbox.');
assert(ordinaryChatProject.agentStates.turing?.obligations.some((item) => item.sourceMessageId === ordinaryUserMessage.id), 'Ordinary direct @mentions must create an Agent obligation.');
assert(Object.values(ordinaryChatProject.agentStates).some((state) => state.worklog.some((item) => item.kind === 'chat-message-sent')), 'Agent replies in ordinary chat must enter the author worklog.');
assert(ordinaryChatProject.eventLedger?.some((event) => event.type === 'group-chat-message' && event.entityIds?.messageId === ordinaryUserMessage.id), 'Ordinary group chat messages must enter the unified event ledger.');

const assignmentPackage = createLeaderAssignmentPackage({
  project,
  leaderId,
  now: '2026-05-28T10:00:00.000Z',
});
assert(assignmentPackage.assignmentMessages.length >= 2, 'Leader must assign open tasks in group chat.');
assert(assignmentPackage.assignmentMessages.every((message) => message.type === 'mention' && message.text.includes('@')), 'Assignments must be @mentions.');
assert(assignmentPackage.assignmentMessages.every((message) => message.heardBy?.length >= confirmedTeam.length - 1 && message.directTargetIds?.length === 1), 'Kickoff assignments must record who heard the @assignment and who was directly targeted.');
assert(assignmentPackage.assignmentLogs.every((log) => log.eventType === 'leader-assignment'), 'Leader assignments must enter timeline logs.');
assert(assignmentPackage.assignmentLogs.every((log) => log.receiptCount >= confirmedTeam.length - 1 && log.directTargetIds?.length === 1), 'Kickoff assignment timeline logs must preserve message receipt evidence.');
assert(assignmentPackage.acknowledgementMessages.length === assignmentPackage.assignmentMessages.length, 'Every assignment must produce an immediate assignee acknowledgement.');
assert(assignmentPackage.acknowledgementMessages.every((message) => message.assignmentReceipt?.ownerId && message.text.includes('starting work now')), 'Acknowledgements must show the assigned Agent received and started the task.');
assert(assignmentPackage.acknowledgementLogs.every((log) => log.eventType === 'assignment-acknowledged'), 'Assignment acknowledgements must enter timeline logs.');
assert(assignmentPackage.tasks.filter((task) => task.status !== 'done').every((task) => task.ownerId && task.assignedBy === leaderId), 'Assigned tasks must carry owner and assigning Leader.');
assert(assignmentPackage.tasks.filter((task) => task.status !== 'done').every((task) => task.assignmentMessageId && task.acknowledgementMessageId && task.timelineLogIds?.length >= 2), 'Kickoff-assigned tasks must carry assignment, acknowledgement, and timeline evidence ids.');
assert(assignmentPackage.tasks.filter((task) => task.status !== 'done').every((task) => task.source === 'kickoff-leader-assignment' && task.sourceChannelId === 'main'), 'Kickoff-assigned tasks must preserve source channel metadata for Chat proof navigation.');
const kickoffCharter = createKickoffCharter({
  project: { ...project, tasks: assignmentPackage.tasks },
  leaderId,
  reviewerId: confirmedTeam.find((agent) => agent.id !== leaderId)?.id,
  roleNegotiation,
  leaderElection,
  assignmentPackage,
  now: '2026-05-28T10:05:00.000Z',
});
assert(kickoffCharter.status === 'approved', 'Kickoff charter must approve the project for autonomous execution.');
assert(kickoffCharter.governance.leaderId === leaderId, 'Kickoff charter must preserve the confirmed Leader.');
assert(kickoffCharter.meeting.roleQuestionCount > 0, 'Kickoff charter must count role clarification questions.');
assert(kickoffCharter.meeting.selfNominationCount > 0, 'Kickoff charter must count self-nominations.');
assert(kickoffCharter.nextActions.length >= assignmentPackage.tasks.length, 'Kickoff charter must include next actions.');
assert(kickoffCharter.communicationRules.some((rule) => rule.includes('@mentions')), 'Kickoff charter must include group chat assignment rules.');
assert(kickoffCharter.evidence.assignmentMessageIds.length === assignmentPackage.assignmentMessages.length, 'Kickoff charter must preserve assignment evidence ids.');
assert(kickoffCharter.evidence.acknowledgementMessageIds.length === assignmentPackage.acknowledgementMessages.length, 'Kickoff charter must preserve assignment acknowledgement evidence ids.');
assert(kickoffCharter.evidence.roleHearingEdges.every((edge) => edge.hears.length > 0), 'Kickoff charter must preserve role-negotiation hearing edges.');
assert(kickoffCharter.evidence.leaderHearingEdges.every((edge) => edge.hears.length > 0), 'Kickoff charter must preserve Leader campaign hearing edges.');
const kickoffChatEvidenceIds = new Set([
  ...roleNegotiation.transcript.map((item) => item.id),
  ...leaderElection.transcript.map((item) => item.id),
  ...assignmentPackage.assignmentMessages.map((message) => message.id),
  ...assignmentPackage.acknowledgementMessages.map((message) => message.id),
]);
assert(kickoffCharter.evidence.roleTranscriptIds.every((id) => kickoffChatEvidenceIds.has(id)), 'Kickoff charter role transcript ids must resolve to group chat messages.');
assert(kickoffCharter.evidence.leaderCampaignIds.every((id) => kickoffChatEvidenceIds.has(id)), 'Kickoff charter Leader campaign ids must resolve to group chat messages.');
assert(kickoffCharter.evidence.assignmentMessageIds.every((id) => kickoffChatEvidenceIds.has(id)), 'Kickoff charter assignment ids must resolve to group chat messages.');
assert(kickoffCharter.evidence.acknowledgementMessageIds.every((id) => kickoffChatEvidenceIds.has(id)), 'Kickoff charter acknowledgement ids must resolve to group chat messages.');
assert(kickoffCharter.ledgerEvents?.some((event) => event.type === 'kickoff-role-question'), 'Kickoff role questions must enter the unified event ledger.');
assert(kickoffCharter.ledgerEvents?.some((event) => event.type === 'kickoff-role-volunteer'), 'Kickoff self-nominations must enter the unified event ledger.');
assert(kickoffCharter.ledgerEvents?.some((event) => event.type === 'kickoff-leader-campaign'), 'Leader campaign speeches must enter the unified event ledger.');

const assignedProject = appendProjectEvents({
  ...project,
  kickoffCharter,
  tasks: assignmentPackage.tasks.map((task) => (
    task.status === 'done' ? task : { ...task, workPulseCount: 2 }
  )),
  logs: [...assignmentPackage.acknowledgementLogs, ...assignmentPackage.assignmentLogs],
}, [
  ...(kickoffCharter.ledgerEvents || [kickoffCharter.ledgerEvent]),
  ...(assignmentPackage.ledgerEvents || []),
]);
assert(assignedProject.eventLedger?.some((event) => event.type === 'kickoff-charter-approved'), 'Kickoff charter must create a unified event-ledger entry.');
assert(assignedProject.eventLedger?.some((event) => event.type === 'leader-assignment'), 'Kickoff assignments must enter the unified event ledger.');
assert(assignedProject.eventLedger?.some((event) => event.type === 'kickoff-role-question'), 'Kickoff role questions must be retained in the project event ledger.');
assert(assignedProject.eventLedger?.some((event) => event.type === 'kickoff-role-volunteer'), 'Kickoff self-nominations must be retained in the project event ledger.');
assert(assignedProject.eventLedger?.some((event) => event.type === 'kickoff-leader-campaign'), 'Kickoff Leader campaigns must be retained in the project event ledger.');
assert(hasContiguousSequences(assignedProject.eventLedger), 'Unified event ledger sequences must be append-only and contiguous after kickoff.');

const changeText = '@all 新增一个 Google Chat export summary 功能';
const liveAssignmentText = 'leader assign @Alan Turing build the live manager-review assignment audit';
assert(isLeaderAssignmentRequest(liveAssignmentText), 'Leader assignment detector must catch group-chat assignment requests.');
const liveAssignmentDirectorMessage = attachMessageReceipts({
  id: 'director_live_assignment_source',
  projectId,
  channelId: 'main',
  type: 'mention',
  author: 'Director',
  text: liveAssignmentText,
  targets: ['Alan Turing'],
}, confirmedTeam, { seenAt: '2026-05-28T10:20:00.000Z' });
const assignedProjectAfterDirectorMessage = applyChatMessagesToAgentStates({
  project: assignedProject,
  team: confirmedTeam,
  messages: [liveAssignmentDirectorMessage],
  now: '2026-05-28T10:20:00.000Z',
  source: 'group-chat-message',
});
const liveAssignment = handleLeaderChatAssignment({
  project: assignedProjectAfterDirectorMessage,
  text: liveAssignmentText,
  leaderId,
  channelId: 'main',
  now: '2026-05-28T10:20:00.000Z',
});
assert(liveAssignment.project.eventLedger.some((event) => event.type === 'group-chat-message' && event.entityIds?.messageId === liveAssignmentDirectorMessage.id), 'Live Leader assignment source command must enter the unified event ledger.');
assert(liveAssignment.project.agentStates.turing?.inbox.some((item) => item.sourceMessageId === liveAssignmentDirectorMessage.id), 'Mentioned Agent must receive the Director source command before Leader assignment handling.');
assert(liveAssignment.task.source === 'leader-chat-assignment', 'Live Leader assignment must create a task from group chat.');
assert(liveAssignment.task.ownerId === 'turing', 'Live Leader assignment must resolve the mentioned Agent as owner.');
assert(liveAssignment.assignmentMessage.type === 'mention' && liveAssignment.assignmentMessage.text.includes('@Alan Turing'), 'Live Leader assignment must be emitted as an @mention from the Leader.');
assert(liveAssignment.assignmentMessage.heardBy?.includes('turing') && liveAssignment.assignmentMessage.directTargetIds?.includes('turing'), 'Live Leader assignment must record the mentioned Agent receipt.');
assert(liveAssignment.acknowledgementMessage.assignmentReceipt?.taskId === liveAssignment.task.id, 'Mentioned Agent must immediately acknowledge the new assignment.');
assert(liveAssignment.logs.some((log) => log.eventType === 'leader-assignment'), 'Live Leader assignment must enter timeline logs.');
assert(liveAssignment.logs.some((log) => log.eventType === 'assignment-acknowledged'), 'Live Leader acknowledgement must enter timeline logs.');
assert(liveAssignment.task.assignmentMessageId === liveAssignment.assignmentMessage.id, 'Live assignment task must link to the assignment message.');
assert(liveAssignment.task.acknowledgementMessageId === liveAssignment.acknowledgementMessage.id, 'Live assignment task must link to the acknowledgement message.');
assert(liveAssignment.task.timelineLogIds?.length >= 2, 'Live assignment task must link to timeline logs.');
assert(liveAssignment.project.agentStates.turing?.inbox.some((item) => item.taskId === liveAssignment.task.id), 'Mentioned Agent state must receive the assignment in its inbox.');
assert(liveAssignment.project.agentStates[leaderId]?.managedIds.includes('turing'), 'Leader state must manage the newly assigned Agent.');

const peerHandoffText = 'Alan Turing needs dependency help from @Marie Curie review the timeline evidence criteria';
assert(isPeerHandoffRequest(peerHandoffText), 'Peer handoff detector must catch Agent-to-Agent dependency requests.');
const peerHandoff = handlePeerHandoff({
  project: liveAssignment.project,
  text: peerHandoffText,
  requesterId: 'turing',
  channelId: 'main',
  now: '2026-05-28T10:35:00.000Z',
});
assert(peerHandoff.task.source === 'peer-handoff', 'Peer handoff must create a dependency task.');
assert(peerHandoff.task.ownerId === 'curie', 'Peer handoff must resolve the mentioned peer as owner.');
assert(peerHandoff.requestMessage.author === 'Alan Turing', 'Peer handoff request must be authored by the requesting Agent.');
assert(peerHandoff.requestMessage.type === 'mention' && peerHandoff.requestMessage.text.includes('@Marie Curie'), 'Peer handoff request must be an @mention.');
assert(peerHandoff.requestMessage.heardBy?.includes('curie') && peerHandoff.requestMessage.directTargetIds?.includes('curie'), 'Peer handoff request must record the target Agent receipt.');
assert(peerHandoff.acknowledgementMessage.handoffReceipt?.taskId === peerHandoff.task.id, 'Peer handoff target must acknowledge the dependency.');
assert(peerHandoff.logs.some((log) => log.eventType === 'peer-handoff'), 'Peer handoff request must enter timeline logs.');
assert(peerHandoff.logs.some((log) => log.eventType === 'peer-handoff-ack'), 'Peer handoff acknowledgement must enter timeline logs.');
assert(peerHandoff.task.requestMessageId === peerHandoff.requestMessage.id, 'Peer handoff task must link to the request message.');
assert(peerHandoff.task.acknowledgementMessageId === peerHandoff.acknowledgementMessage.id, 'Peer handoff task must link to the acknowledgement message.');
assert(peerHandoff.task.timelineLogIds?.length >= 2, 'Peer handoff task must link to timeline logs.');
assert(peerHandoff.project.peerHandoffs?.[0]?.status === 'accepted', 'Peer handoff ledger must record accepted handoffs.');
assert(peerHandoff.project.agentStates.turing?.peerManagedIds.includes('curie'), 'Requester state must show peer-managed dependency owner.');
assert(peerHandoff.project.agentStates.curie?.peerManagerIds.includes('turing'), 'Target state must show peer manager relation.');
assert(peerHandoff.project.agentStates.curie?.inbox.some((item) => item.source === 'peer-handoff'), 'Target state must receive peer handoff inbox item.');

const meetingChangeText = '@all add a manager meeting recap packet from the War Room';
assert(isFeatureChangeRequest(meetingChangeText), 'Feature-change detector must catch War Room meeting requests.');
const meetingChangeDirectorMessage = attachMessageReceipts({
  id: 'director_meeting_change_source',
  projectId,
  channelId: 'main',
  type: 'mention',
  author: 'Director',
  text: meetingChangeText,
  targets: ['all'],
}, confirmedTeam, { seenAt: '2026-05-28T10:50:00.000Z' });
const peerProjectAfterMeetingMessage = applyChatMessagesToAgentStates({
  project: peerHandoff.project,
  team: confirmedTeam,
  messages: [meetingChangeDirectorMessage],
  now: '2026-05-28T10:50:00.000Z',
  source: 'war-room-meeting-message',
});
const meetingChangeResponse = handleFeatureChangeRequest({
  project: peerProjectAfterMeetingMessage,
  text: meetingChangeText,
  author: 'director',
  now: '2026-05-28T10:50:00.000Z',
  channelId: 'main',
  source: 'war-room-meeting-change-request',
});
assert(meetingChangeResponse.project.eventLedger.some((event) => event.type === 'group-chat-message' && event.source === 'war-room-meeting-message' && event.entityIds?.messageId === meetingChangeDirectorMessage.id), 'War Room meeting change source command must enter the unified event ledger before change handling.');
assert(Object.values(meetingChangeResponse.project.agentStates).some((state) => state.inbox.some((item) => item.sourceMessageId === meetingChangeDirectorMessage.id)), 'War Room meeting change source command must be delivered into Agent inbox state.');
assert(meetingChangeResponse.changeTask.source === 'war-room-meeting-change-request', 'Meeting change task must preserve War Room source.');
assert(meetingChangeResponse.changeTask.sourceChannelId === 'main', 'Meeting change task must be mirrored to the main group channel.');
assert(meetingChangeResponse.changeRecord.status === 'confirmed-and-synced', 'Meeting change must be confirmed and synced.');
assert(meetingChangeResponse.changeRecord.teamStateSynced, 'Meeting change must sync owner update into the rest of the team state.');
assert(meetingChangeResponse.changeRecord.teamSyncCount === confirmedTeam.length - 1, 'Meeting change must record a sync receipt for every non-owner Agent.');
assert(Object.entries(meetingChangeResponse.teamSyncStateUpdates || {}).every(([, state]) => state.inbox.some((item) => item.source === 'change-sync')), 'Meeting change must write team sync inbox receipts.');
assert(meetingChangeResponse.changeTask.confirmationMessageId === meetingChangeResponse.changeRecord.confirmationMessageId, 'Meeting change task must link to confirmation evidence.');
assert(meetingChangeResponse.changeTask.syncMessageId === meetingChangeResponse.changeRecord.syncMessageId, 'Meeting change task must link to owner-sync evidence.');
assert(meetingChangeResponse.changeTask.timelineLogIds?.length >= 3, 'Meeting change task must link to timeline discussion logs.');
assert(meetingChangeResponse.discussionMessages.every((message) => message.channelId === 'main'), 'Meeting change discussion must be visible in group chat.');
assert(meetingChangeResponse.discussionMessages.every((message) => message.heardBy?.length > 0 && message.visibility?.receiptCount > 0), 'Meeting change discussion must carry group-chat receipt evidence.');
assert(meetingChangeResponse.discussionMessages.some((message) => message.type === 'decision'), 'Meeting change must include owner confirmation.');
assert(meetingChangeResponse.project.changeLedger?.[0]?.source === 'war-room-meeting-change-request', 'Returned project must persist meeting change ledger evidence.');

assert(isFeatureChangeRequest(changeText), 'Feature-change detector must catch Chinese/English mixed requests.');
const googleChangeDirectorMessage = attachMessageReceipts({
  id: 'director_google_change_source',
  projectId,
  channelId: 'google_chat',
  type: 'mention',
  author: 'Director',
  text: changeText,
  targets: ['all'],
}, confirmedTeam, { seenAt: '2026-05-28T11:00:00.000Z' });
const meetingProjectAfterGoogleMessage = applyChatMessagesToAgentStates({
  project: meetingChangeResponse.project,
  team: confirmedTeam,
  messages: [googleChangeDirectorMessage],
  now: '2026-05-28T11:00:00.000Z',
  source: 'google-chat-message',
});
const changeResponse = handleFeatureChangeRequest({
  project: meetingProjectAfterGoogleMessage,
  text: changeText,
  author: 'director',
  now: '2026-05-28T11:00:00.000Z',
  channelId: 'google_chat',
  source: 'google-chat-mention-change-request',
});
assert(changeResponse.project.eventLedger.some((event) => event.type === 'group-chat-message' && event.source === 'google-chat-message' && event.entityIds?.messageId === googleChangeDirectorMessage.id), 'Google Chat change source command must enter the unified event ledger before change handling.');
assert(Object.values(changeResponse.project.agentStates).some((state) => state.inbox.some((item) => item.sourceMessageId === googleChangeDirectorMessage.id && item.channelId === 'google_chat')), 'Google Chat change source command must be delivered into Agent inbox state.');
assert(changeResponse.changeTask.source === 'google-chat-mention-change-request', 'Change task must preserve Google Chat source.');
assert(changeResponse.changeTask.sourceChannelId === 'google_chat', 'Change task must preserve source channel.');
assert(changeResponse.changeRecord.status === 'confirmed-and-synced', 'Change ledger record must capture confirmed and synced status.');
assert(changeResponse.changeRecord.sourceChannelId === 'google_chat', 'Change ledger record must preserve source channel.');
assert(changeResponse.changeRecord.ownerId, 'Change ledger record must preserve responsible owner.');
assert(changeResponse.changeRecord.taskId === changeResponse.changeTask.id, 'Change ledger record must bind to the created task.');
assert(changeResponse.changeRecord.confirmationMessageId, 'Change ledger record must preserve confirmation evidence.');
assert(changeResponse.changeRecord.syncMessageId, 'Change ledger record must preserve owner sync evidence.');
assert(changeResponse.changeTask.confirmationMessageId === changeResponse.changeRecord.confirmationMessageId, 'Google Chat change task must link to confirmation evidence.');
assert(changeResponse.changeTask.syncMessageId === changeResponse.changeRecord.syncMessageId, 'Google Chat change task must link to owner-sync evidence.');
assert(changeResponse.changeTask.timelineLogIds?.length >= 3, 'Google Chat change task must link to timeline discussion logs.');
assert(changeResponse.changeRecord.planUpdate?.includes('Plan updated'), 'Change ledger record must preserve plan update text.');
assert(changeResponse.changeRecord.ownerStateUpdated, 'Change ledger record must show the responsible owner state was updated.');
assert(changeResponse.changeRecord.teamStateSynced, 'Change ledger record must show the team received the owner sync.');
assert(changeResponse.changeRecord.teamSyncCount === confirmedTeam.length - 1, 'Google Chat change must record a sync receipt for every non-owner Agent.');
assert(Object.values(changeResponse.teamSyncStateUpdates || {}).every((state) => state.inbox.some((item) => item.source === 'change-sync')), 'Google Chat change must write team sync inbox receipts.');
assert(changeResponse.ownerStateUpdate?.currentPlan?.taskId === changeResponse.changeTask.id, 'Feature change must enter the responsible owner current plan.');
assert(changeResponse.ownerStateUpdate?.obligations?.some((item) => item.taskId === changeResponse.changeTask.id), 'Feature change must create an owner obligation.');
assert(changeResponse.ownerStateUpdate?.inbox?.some((item) => item.sourceChannelId === 'google_chat'), 'Feature change owner state must preserve source channel inbox evidence.');
assert(changeResponse.project.agentStates[changeResponse.changeRecord.ownerId]?.currentPlan?.taskId === changeResponse.changeTask.id, 'Returned project must persist owner plan state.');
assert(changeResponse.project.changeLedger?.[0]?.id === changeResponse.changeRecord.id, 'Returned project must persist the change ledger entry.');
assert(changeResponse.discussionMessages.every((message) => message.channelId === 'google_chat'), 'Change discussion must remain in source channel.');
assert(changeResponse.discussionMessages.every((message) => message.heardBy?.length > 0 && message.visibility?.receiptCount > 0), 'Google Chat change discussion must carry receipt evidence.');
assert(changeResponse.discussionMessages.some((message) => message.type === 'decision'), 'Responsible owner must confirm the change.');
assert(changeResponse.discussionMessages.some((message) => message.id.includes('change_sync')), 'Responsible owner must sync the accepted plan to everyone.');
const googleChangeDiscussionIds = changeResponse.discussionMessages.map((message) => message.id);
assert(Object.values(changeResponse.project.agentStates).some((state) => state.inbox.some((item) => item.source === 'change-discussion-chat' && googleChangeDiscussionIds.includes(item.sourceMessageId))), 'Google Chat change discussion messages must be delivered into Agent inbox state.');
assert(Object.values(changeResponse.project.agentStates).some((state) => state.obligations.some((item) => item.source === 'change-discussion-chat' && googleChangeDiscussionIds.includes(item.sourceMessageId))), 'Google Chat change discussion messages must create Agent discussion obligations.');
assert(Object.values(changeResponse.project.agentStates).some((state) => state.worklog.some((item) => item.source === 'change-discussion-chat' && googleChangeDiscussionIds.includes(item.sourceMessageId))), 'Google Chat change discussion speakers must write discussion messages to Agent worklogs.');
assert(changeResponse.project.eventLedger.some((event) => event.source === 'change-discussion-chat' && googleChangeDiscussionIds.includes(event.entityIds?.messageId)), 'Google Chat change discussion delivery must enter the unified event ledger.');
const multiChannelChange = submitProjectMultiChannelChangeRequest({
  project: changeResponse.project,
  text: '@all add dual-channel manager review packet',
  now: '2026-05-28T11:02:00.000Z',
  messageIdPrefix: 'director_dual_channel_change',
});
assert(multiChannelChange.route === 'multi-channel-change', 'Multi-channel change request must route through one unified change flow.');
assert(multiChannelChange.messages.some((message) => message.channelId === 'main' && message.source === 'war-room-meeting-message'), 'Multi-channel change request must publish a War Room source message.');
assert(multiChannelChange.messages.some((message) => message.channelId === 'google_chat' && message.source === 'google-chat-message'), 'Multi-channel change request must publish a Google Chat source message.');
assert(multiChannelChange.responses.changeOwnerStartWorkResponse?.cycle?.trigger === 'change-owner-start-work', 'Multi-channel change request must immediately start the responsible owner work pulse.');
assert(multiChannelChange.project.agentWorkerLedger?.some((record) => record.trigger === 'change-owner-start-work' && record.taskId === multiChannelChange.responses.changeResponse.changeTask.id), 'Multi-channel change owner work pulse must persist to the Agent worker ledger.');
assert(multiChannelChange.messages.some((message) => message.agentWorker?.trigger === 'change-owner-start-work' && message.agentWorker?.taskId === multiChannelChange.responses.changeResponse.changeTask.id), 'Multi-channel change request must return the owner first work-pulse message.');
assert(multiChannelChange.responses.changeResponse.changeRecord.source === 'multi-channel-change-request', 'Multi-channel change record must preserve unified source metadata.');
assert(multiChannelChange.responses.changeResponse.changeRecord.sourceChannelIds.includes('main') && multiChannelChange.responses.changeResponse.changeRecord.sourceChannelIds.includes('google_chat'), 'Multi-channel change record must preserve every source channel.');
assert(multiChannelChange.responses.changeResponse.changeRecord.sourceModes.includes('war_room_meeting') && multiChannelChange.responses.changeResponse.changeRecord.sourceModes.includes('google_chat'), 'Multi-channel change record must preserve explicit War Room meeting and Google Chat source modes.');
assert(multiChannelChange.responses.changeResponse.changeRecord.sourceMessageIds.length === 2, 'Multi-channel change record must preserve both source message ids.');
assert(multiChannelChange.project.changeLedger[0].source === 'multi-channel-change-request' && multiChannelChange.project.changeLedger[0].sourceMessageIds.length === 2, 'Returned project must persist the unified multi-channel change ledger entry.');
assert(multiChannelChange.project.eventLedger.some((event) => event.source === 'multi-channel-change-source'), 'Multi-channel source messages must enter the unified event ledger before change handling.');

const changedProject = {
  ...multiChannelChange.project,
  objective: 'backend architecture evidence product execution for manager demo',
  currentObjective: 'implementation, evidence review, product flow, and execution delivery',
  tasks: multiChannelChange.project.tasks.map((task) => (
    [changeResponse.changeTask.id, multiChannelChange.responses.changeResponse.changeTask.id].includes(task.id)
      ? { ...task, workPulseCount: 2 }
      : task
  )),
};
const dueSchedule = evaluateAutonomousSchedule({
  project: {
    ...changedProject,
    autonomy: { enabled: true, cadence: 'hourly' },
    lastAutonomousRunAt: '2026-05-28T10:00:00.000Z',
    nextAutonomousRunAt: '2026-05-28T11:00:00.000Z',
  },
  cadence: 'hourly',
  now: '2026-05-28T11:05:00.000Z',
});
assert(dueSchedule.due, 'Autonomous scheduler must mark a project due when its next run time has passed.');
assert(dueSchedule.reason === 'hourly-cadence-due', 'Autonomous scheduler must explain why it is due.');
const scheduledCycle = advanceAutonomousProjectCycle({
  project: changedProject,
  team: changedProject.team,
  cadence: 'hourly',
  messages: [],
  now: '2026-05-28T11:05:00.000Z',
  trigger: 'scheduler',
  schedulerReason: dueSchedule.reason,
  dueAt: dueSchedule.dueAt,
});
assert(scheduledCycle.project.autonomousSchedulerLedger?.[0]?.trigger === 'scheduler', 'Scheduled autonomous cycles must write scheduler trigger evidence.');
assert(scheduledCycle.project.autonomousSchedulerLedger?.[0]?.nextRunAt === scheduledCycle.project.nextAutonomousRunAt, 'Scheduled autonomous cycles must persist the next run time.');
assert(scheduledCycle.project.autonomousLedger?.[0]?.schedulerReason === dueSchedule.reason, 'Autonomous cycle ledger must preserve the scheduler reason.');
const cycle = advanceAutonomousProjectCycle({
  project: changedProject,
  team: changedProject.team,
  cadence: 'daily',
  messages: [],
  now: '2026-05-28T12:00:00.000Z',
});
assert(cycle.project.logs.some((log) => log.eventType === 'task-completed'), 'Autonomous work must publish task completion to timeline logs.');
assert(cycle.project.autonomousLedger?.[0]?.publishedEventCount > 0, 'Autonomous cycle must publish visible progress.');
assert(cycle.project.nextAutonomousRunAt, 'Autonomous cycle must calculate the next run time.');
assert(cycle.project.autonomousSchedulerLedger?.[0]?.nextRunAt === cycle.project.nextAutonomousRunAt, 'Autonomous cycle must persist scheduler evidence.');
assert(cycle.project.progress > changedProject.progress, 'Autonomous cycle must move project progress.');
assert(cycle.project.agentStates, 'Autonomous cycle must persist independent per-Agent state.');
assert(confirmedTeam.every((agent) => cycle.project.agentStates[agent.id]), 'Every Agent must have a state record.');
assert(cycle.project.agentStates[leaderId].managedIds.length > 0, 'Leader state must show managed Agents.');
assert(Object.values(cycle.project.agentStates).some((state) => state.managerId === leaderId), 'Non-leader states must point to the Leader manager.');
assert(Object.values(cycle.project.agentStates).every((state) => state.currentPlan?.focus), 'Every Agent state must include an active work plan.');
assert(Object.values(cycle.project.agentStates).every((state) => state.currentPlan?.routine?.id), 'Every Agent state must include a fixed work routine.');
assert(Object.values(cycle.project.agentStates).some((state) => state.worklog.length > 0), 'Agent states must preserve private worklog entries.');
assert(cycle.project.agentStates.turing?.peerManagedIds.includes('curie'), 'Autonomous cycle must preserve peer handoff requester relations.');
assert(cycle.project.agentStates.curie?.peerManagerIds.includes('turing'), 'Autonomous cycle must preserve peer handoff target relations.');
assert(cycle.project.autonomousLedger?.[0]?.agentPlans.every((plan) => plan.routineId && plan.routineArtifact), 'Autonomous ledger must store fixed work routine evidence for every Agent.');
assert(cycle.cycle.agentPlans.every((plan) => plan.privateWork?.routine?.checklist?.length > 0), 'Cycle plans must include routine checklists.');
assert(cycle.cycle.managementEvents?.some((event) => event.kind === 'management-check-in'), 'Autonomous cycles must include Leader management check-ins.');
assert(cycle.cycle.managementEvents?.some((event) => event.kind === 'review-sweep'), 'Autonomous cycles must include Reviewer evidence sweeps.');
assert(cycle.cycle.managementEvents?.some((event) => event.kind === 'peer-management-check-in'), 'Autonomous cycles must preserve peer-management check-ins.');
assert(cycle.project.logs.some((log) => log.eventType === 'management-check-in'), 'Management check-ins must enter timeline logs.');
assert(cycle.project.autonomousLedger?.[0]?.managementEventCount >= 3, 'Autonomous ledger must count management-loop events.');
assert(Object.values(cycle.project.agentStates).some((state) => state.inbox.some((item) => item.source === 'management-check-in')), 'Managed Agents must receive management check-ins in their inbox.');
const finalEventTypes = new Set((cycle.project.eventLedger || []).map((event) => event.type));
assert(cycle.project.eventLedger?.length >= 12, 'Unified event ledger must accumulate kickoff, chat, change, peer, and autonomous events.');
assert(hasContiguousSequences(cycle.project.eventLedger), 'Unified event ledger sequence must remain contiguous across all scenario flows.');
const finalLedgerSummary = summarizeProjectEventLedger(cycle.project);
assert(finalLedgerSummary.contiguous && finalLedgerSummary.lastSequence === cycle.project.eventLedger.at(-1).sequence, 'Unified event-ledger projection must summarize final continuity.');
const replayProjection = projectEventReplayProjection(cycle.project);
assert(replayProjection.replayReady, 'Unified event ledger projection must be replay-ready for the full manager scenario.');
assert(replayProjection.kickoffSpeechCount >= roleNegotiation.transcript.length + leaderElection.transcript.length, 'Event-ledger replay must include kickoff role and Leader campaign speeches.');
assert(replayProjection.leaderAssignmentCount >= assignmentPackage.assignmentMessages.length, 'Event-ledger replay must include Leader assignment events.');
assert(replayProjection.changeConfirmationCount >= 2, 'Event-ledger replay must include War Room and Google Chat change confirmations.');
assert(replayProjection.peerHandoffCount >= 1, 'Event-ledger replay must include accepted peer handoff events.');
assert(replayProjection.autonomousRunCount >= 1, 'Event-ledger replay must include autonomous scheduler events.');
assert(finalEventTypes.has('kickoff-charter-approved'), 'Unified event ledger must include kickoff approval.');
assert(finalEventTypes.has('kickoff-role-question'), 'Unified event ledger must include kickoff role questions.');
assert(finalEventTypes.has('kickoff-role-volunteer'), 'Unified event ledger must include kickoff self-nominations.');
assert(finalEventTypes.has('kickoff-leader-campaign'), 'Unified event ledger must include Leader campaign speeches.');
assert(finalEventTypes.has('leader-assignment'), 'Unified event ledger must include Leader assignment events.');
assert(finalEventTypes.has('change-confirmed-and-synced'), 'Unified event ledger must include confirmed change events.');
assert(finalEventTypes.has('peer-handoff-accepted'), 'Unified event ledger must include accepted peer handoff events.');
assert(finalEventTypes.has('autonomous-scheduler'), 'Unified event ledger must include autonomous scheduler events.');
const cycleChatMessages = createAutonomousCycleChatMessages({
  project: cycle.project,
  cycle: cycle.cycle,
  cadence: 'daily',
  projectId,
});
assert(cycleChatMessages.length > 0, 'Autonomous cycles must produce group chat records.');
assert(cycleChatMessages.every((message) => message.projectId === projectId && message.channelId === 'main'), 'Autonomous chat records must be project-scoped group chat messages.');
assert(cycleChatMessages.some((message) => message.type === 'progress'), 'Autonomous chat records must include visible progress updates.');
assert(cycleChatMessages.some((message) => message.type === 'mention' && message.autonomous?.kind === 'management-check-in'), 'Autonomous management check-ins must appear as group-chat mentions.');
assert(cycleChatMessages.every((message) => message.heardBy?.length > 0 && message.visibility?.receiptCount > 0), 'Autonomous group chat records must carry message receipt evidence.');
const publishedCycleChat = publishAutonomousCycleChat({
  project: cycle.project,
  cycle: cycle.cycle,
  cadence: 'daily',
  projectId,
  now: '2026-05-28T12:00:00.000Z',
});
assert(publishedCycleChat.messages.length === cycleChatMessages.length, 'Published autonomous chat must expose the same visible group-chat records.');
assert(publishedCycleChat.project.eventLedger.some((event) => event.type === 'group-chat-message' && event.source === 'autonomous-cycle-chat'), 'Published autonomous chat must append group-chat message events to the unified ledger.');
assert(Object.values(publishedCycleChat.project.agentStates).some((state) => state.worklog.some((item) => item.kind === 'chat-message-sent' && item.source === 'autonomous-cycle-chat')), 'Published autonomous chat must enter Agent-authored worklogs.');
assert(Object.values(publishedCycleChat.project.agentStates).some((state) => state.inbox.some((item) => item.source === 'autonomous-cycle-chat')), 'Published autonomous management mentions must enter target Agent inboxes.');

checkpoint('manager readiness projection');
const managerReadiness = evaluateManagerScenarioReadiness({
  project: publishedCycleChat.project,
  team: publishedCycleChat.project.team,
  messages: [
    ...assignmentPackage.assignmentMessages.map((message) => ({ ...message, projectId })),
    ...assignmentPackage.acknowledgementMessages.map((message) => ({ ...message, projectId })),
    liveAssignment.assignmentMessage,
    liveAssignment.acknowledgementMessage,
    peerHandoff.requestMessage,
    peerHandoff.acknowledgementMessage,
    ...meetingChangeResponse.discussionMessages.map((message) => ({ ...message, projectId })),
    ...changeResponse.discussionMessages.map((message) => ({ ...message, projectId })),
    ...cycleChatMessages,
  ],
});
assert(managerReadiness.status === 'manager-ready', `Manager scenario readiness must pass all checks: ${managerReadiness.checks.filter((check) => !check.passed).map((check) => check.id).join(', ')}`);
assert(managerReadiness.score === 100, 'Manager scenario readiness score must be 100 for the validated scenario.');
assert(managerReadiness.checks.some((check) => check.id === 'midproject-change-synced' && check.passed), 'Readiness audit must include owner-synced mid-project change evidence.');
assert(managerReadiness.checks.some((check) => check.id === 'team-received-change-sync' && check.passed), 'Readiness audit must include team receipt of the owner sync.');
assert(managerReadiness.checks.some((check) => check.id === 'agents-hear-each-other' && check.passed), 'Readiness audit must include Agent hearing evidence.');
assert(managerReadiness.checks.some((check) => check.id === 'meeting-change-source' && check.passed), 'Readiness audit must include War Room meeting change evidence.');
assert(managerReadiness.checks.some((check) => check.id === 'dual-channel-change-source' && check.passed), 'Readiness audit must include dual-channel meeting plus Google Chat change evidence.');
assert(managerReadiness.checks.some((check) => check.id === 'task-evidence-linked' && check.passed), 'Readiness audit must include task-level chat/timeline evidence links.');
assert(managerReadiness.checks.some((check) => check.id === 'management-loop-running' && check.passed), 'Readiness audit must include autonomous management-loop evidence.');
assert(managerReadiness.checks.some((check) => check.id === 'message-receipts-recorded' && check.passed), 'Readiness audit must include message receipt evidence.');
assert(managerReadiness.checks.some((check) => check.id === 'event-ledger-continuity' && check.passed), 'Readiness audit must include unified event-ledger continuity.');
assert(managerReadiness.checks.some((check) => check.id === 'event-ledger-replay-ready' && check.passed), 'Readiness audit must include event-ledger replay projection evidence.');
const durableReadiness = evaluateManagerScenarioReadiness({
  project: publishedCycleChat.project,
  team: publishedCycleChat.project.team,
  messages: [],
});
assert(durableReadiness.status === 'manager-ready', `Manager readiness must remain durable without recent chat-window messages: ${durableReadiness.checks.filter((check) => !check.passed).map((check) => check.id).join(', ')}`);
assert(durableReadiness.checks.some((check) => check.id === 'group-chat-visible' && check.passed), 'Readiness audit must derive group-chat evidence from durable project state.');
assert(durableReadiness.checks.some((check) => check.id === 'message-receipts-recorded' && check.passed), 'Durable readiness must preserve receipt evidence without recent chat-window messages.');

const legacyKickoffCharter = { ...cycle.project.kickoffCharter };
delete legacyKickoffCharter.ledgerEvent;
delete legacyKickoffCharter.ledgerEvents;
const legacyProjectWithoutEventLedger = {
  ...publishedCycleChat.project,
  kickoffCharter: legacyKickoffCharter,
  initiation: {
    roleNegotiation,
    leaderElection,
    leaderId,
    approvedAt: kickoffCharter.createdAt,
  },
  eventLedger: [],
  eventLedgerFirstSequence: 0,
  eventLedgerLastSequence: 0,
  eventLedgerEventCount: 0,
};
const backfilledLegacyProject = backfillProjectEventLedger(legacyProjectWithoutEventLedger);
const backfilledLedgerSummary = summarizeProjectEventLedger(backfilledLegacyProject);
assert(backfilledLegacyProject.eventLedger.length > 0, 'Legacy projects without eventLedger must be backfilled from durable project evidence.');
assert(backfilledLedgerSummary.contiguous, 'Backfilled legacy event ledger must have contiguous sequences.');
assert(backfilledLedgerSummary.replayProjection.replayReady, 'Backfilled legacy event ledger must be replay-ready when durable evidence exists.');
assert(backfilledLedgerSummary.coverage.kickoffRoleQuestion && backfilledLedgerSummary.coverage.kickoffRoleVolunteer && backfilledLedgerSummary.coverage.kickoffLeaderCampaign, 'Backfilled ledger must recover kickoff speech events.');
assert(backfilledLedgerSummary.coverage.leaderAssignment && backfilledLedgerSummary.coverage.change && backfilledLedgerSummary.coverage.peerHandoff && backfilledLedgerSummary.coverage.autonomous, 'Backfilled ledger must recover assignment, change, handoff, and autonomous events.');
const migratedReadiness = evaluateManagerScenarioReadiness({
  project: backfilledLegacyProject,
  team: backfilledLegacyProject.team,
  messages: [],
});
assert(migratedReadiness.status === 'manager-ready', `Backfilled legacy project readiness must pass without recent chat-window messages: ${migratedReadiness.checks.filter((check) => !check.passed).map((check) => check.id).join(', ')}`);

const serviceTargetProbe = resolveProjectChatTargets('leader assign @Alan Turing prepare service evidence', confirmedTeam);
assert(serviceTargetProbe.includes('Alan Turing'), 'Project service must resolve spaced @Agent names before dispatching chat commands.');
checkpoint('durable kickoff meeting service');
const kickoffMeetingService = createAgentProjectService();
const createdKickoffMeeting = kickoffMeetingService.createKickoffMeeting({
  meetingId: 'svc_kickoff_meeting_session',
  projectId: 'svc_kickoff_project',
  name: 'Service Kickoff Session Project',
  brief: 'Create a backend-visible initiation meeting session before the manager approves the project.',
  team: confirmedTeam,
  selectedLeaderId: 'turing',
  tasks: [
    {
      id: 'svc_kickoff_task_1',
      text: 'Convert the approved kickoff meeting into backend project evidence',
      assignee: 'Alan Turing',
      ownerId: 'turing',
      status: 'pending',
    },
  ],
  now: '2026-05-28T12:30:00.000Z',
});
assert(createdKickoffMeeting.meeting.status === 'awaiting-manager-decision', 'Kickoff meeting session must remain pending until the manager approves it.');
assert(createdKickoffMeeting.meeting.transcript.some((turn) => turn.stage === 'role-clarification') && createdKickoffMeeting.meeting.transcript.some((turn) => turn.stage === 'leader-campaign'), 'Kickoff meeting session must preserve role clarification and Leader campaign turns.');
assert(createdKickoffMeeting.meeting.evidence.hearingEdgeCount > confirmedTeam.length, 'Kickoff meeting session must preserve peer-hearing evidence before project creation.');
assert(createdKickoffMeeting.meeting.roleQuestionResolutions?.some((row) => row.answered === false && row.questionId), 'Kickoff meeting session must expose unresolved role-question rows before manager clarification.');
assert(createdKickoffMeeting.meeting.leaderElectionResolution?.candidateCount >= 2 && createdKickoffMeeting.meeting.leaderElectionResolution.managerConfirmed === false, 'Kickoff meeting session must expose pending Leader election resolution before manager confirmation.');
assert(createdKickoffMeeting.meeting.nextActionResolution?.managerConfirmed === false && createdKickoffMeeting.meeting.nextActionResolution?.taskCount === 1, 'Kickoff meeting session must expose pending next-action resolution before manager confirmation.');
const directLeaderConfirmedKickoffMeeting = confirmKickoffMeetingLeader({
  meeting: createdKickoffMeeting.meeting,
  selectedLeaderId: 'turing',
  now: '2026-05-28T12:31:00.000Z',
});
assert(directLeaderConfirmedKickoffMeeting.leaderElectionResolution.managerConfirmed && directLeaderConfirmedKickoffMeeting.leaderElectionResolution.selectedLeaderId === 'turing', 'Direct kickoff meeting Leader confirmation must mark the selected campaign candidate as manager-confirmed.');
const directNextActionResolution = buildNextActionResolution({
  tasks: [{ id: 'direct_next_action_1', text: 'Directly confirm the first execution packet', assignee: 'Alan Turing', status: 'pending' }],
  team: confirmedTeam,
  selectedLeaderId: 'turing',
  now: '2026-05-28T12:31:30.000Z',
  managerConfirmed: true,
});
assert(directNextActionResolution.managerConfirmed && directNextActionResolution.tasks[0].ownerId === 'turing', 'Direct next-action resolution builder must normalize manager-confirmed Leader-owned actions.');
const directNextActionsConfirmedKickoffMeeting = confirmKickoffMeetingNextActions({
  meeting: createdKickoffMeeting.meeting,
  tasks: [{ id: 'direct_meeting_action_1', text: 'Direct meeting next action confirmation', assignee: 'Alan Turing', status: 'pending' }],
  now: '2026-05-28T12:31:45.000Z',
});
assert(directNextActionsConfirmedKickoffMeeting.nextActionResolution.managerConfirmed && directNextActionsConfirmedKickoffMeeting.nextActionResolution.actionIds.includes('direct_meeting_action_1'), 'Direct kickoff meeting next-action confirmation must persist manager-confirmed action ids.');
const directClarifiedKickoffMeeting = addKickoffMeetingClarification({
  meeting: createdKickoffMeeting.meeting,
  questionId: createdKickoffMeeting.meeting.transcript.find((turn) => turn.stage === 'role-clarification')?.id,
  text: 'Director clarification: Alan owns the integration proof, Marie owns the evidence packet, and the Leader will confirm sequencing before approval.',
  now: '2026-05-28T12:32:00.000Z',
});
assert(directClarifiedKickoffMeeting.managerClarifications?.length === 1 && directClarifiedKickoffMeeting.evidence.clarificationIds.length === 1, 'Direct kickoff meeting clarification must append Director clarification evidence.');
assert(directClarifiedKickoffMeeting.roleQuestionResolutions?.some((row) => row.answered && row.answerIds?.[0] === directClarifiedKickoffMeeting.managerClarifications[0].id), 'Direct kickoff meeting clarification must mark the targeted role question as answered.');
const serviceClarifiedKickoffMeeting = kickoffMeetingService.clarifyKickoffMeeting({
  meetingId: 'svc_kickoff_meeting_session',
  questionId: createdKickoffMeeting.meeting.transcript.find((turn) => turn.stage === 'role-clarification')?.id,
  text: 'Service clarification: Turing owns the backend proof and Curie reviews the timeline evidence before approval.',
  now: '2026-05-28T12:33:00.000Z',
});
assert(serviceClarifiedKickoffMeeting.route === 'kickoff-meeting-clarified' && serviceClarifiedKickoffMeeting.meeting.managerClarifications.length === 1, 'Kickoff meeting service must persist manager clarification turns before approval.');
assert(serviceClarifiedKickoffMeeting.meeting.roleQuestionResolutions.some((row) => row.answered && /Turing owns the backend proof/i.test(row.answerText || '')), 'Kickoff meeting service must persist the specific role-question answer state.');
const serviceLeaderConfirmedKickoffMeeting = kickoffMeetingService.confirmKickoffMeetingLeader({
  meetingId: 'svc_kickoff_meeting_session',
  selectedLeaderId: 'turing',
  now: '2026-05-28T12:34:00.000Z',
});
assert(serviceLeaderConfirmedKickoffMeeting.route === 'kickoff-meeting-leader-confirmed' && serviceLeaderConfirmedKickoffMeeting.meeting.leaderElectionResolution.managerConfirmed && serviceLeaderConfirmedKickoffMeeting.meeting.leaderElectionResolution.selectedLeaderId === 'turing', 'Kickoff meeting service must persist manager-confirmed Leader election resolution before approval.');
const serviceNextActionsConfirmedKickoffMeeting = kickoffMeetingService.confirmKickoffMeetingNextActions({
  meetingId: 'svc_kickoff_meeting_session',
  tasks: [
    {
      id: 'svc_kickoff_task_1',
      text: 'Manager confirmed service meeting next-action packet',
      assignee: 'Alan Turing',
      ownerId: 'turing',
      status: 'pending',
    },
  ],
  now: '2026-05-28T12:35:00.000Z',
});
assert(serviceNextActionsConfirmedKickoffMeeting.route === 'kickoff-meeting-next-actions-confirmed' && serviceNextActionsConfirmedKickoffMeeting.meeting.nextActionResolution.managerConfirmed && serviceNextActionsConfirmedKickoffMeeting.meeting.nextActionResolution.actionIds.includes('svc_kickoff_task_1'), 'Kickoff meeting service must persist manager-confirmed next-action resolution before approval.');
const approvedKickoffMeeting = kickoffMeetingService.approveKickoffMeeting({
  meetingId: 'svc_kickoff_meeting_session',
  selectedLeaderId: 'turing',
  reviewerId: 'curie',
  now: '2026-05-28T12:40:00.000Z',
});
assert(approvedKickoffMeeting.route === 'kickoff-meeting-approved' && approvedKickoffMeeting.meeting.status === 'approved', 'Approving a kickoff meeting session must return an approved meeting result.');
assert(approvedKickoffMeeting.project.team.some((agent) => agent.id === 'turing' && agent.isLeader), 'Kickoff meeting approval must create a project with the manager-confirmed Leader marker.');
assert(approvedKickoffMeeting.project.peerManagementMatrix?.length === approvedKickoffMeeting.project.team.length, 'Kickoff meeting approval must persist a peer-management matrix for every approved Agent.');
assert(Object.values(approvedKickoffMeeting.project.agentStates || {}).every((state) => state.peerManagedIds?.length === 1 && state.peerManagerIds?.length === 1), 'Kickoff meeting approval must give every Agent a peer-management target and peer manager.');
assert(approvedKickoffMeeting.project.logs?.some((log) => log.eventType === 'peer-management-check-in'), 'Kickoff meeting first pulse must publish peer-management check-in timeline evidence.');
assert(approvedKickoffMeeting.project.initiation.managerClarifications?.length === 1, 'Kickoff meeting approval must carry manager clarification turns into project initiation state.');
assert(approvedKickoffMeeting.project.initiation.meetingId === 'svc_kickoff_meeting_session' && approvedKickoffMeeting.project.kickoffCharter?.meetingSessionId === 'svc_kickoff_meeting_session', 'Kickoff meeting approval must carry the durable meeting id into the project and kickoff charter.');
assert(approvedKickoffMeeting.project.initiation.generationProvenance?.schemaVersion === 'kickoff-generation-provenance/v1' && approvedKickoffMeeting.project.initiation.generationProvenance.productionClaim === 'blocked' && approvedKickoffMeeting.project.kickoffCharter?.evidence?.generationProvenance?.schemaVersion === 'kickoff-generation-provenance/v1', 'Kickoff meeting approval must carry generation provenance into the project initiation state and kickoff charter evidence.');
assert(approvedKickoffMeeting.project.initiation.roleQuestionResolutions?.some((row) => row.answered && row.answerIds?.length > 0), 'Kickoff meeting approval must carry answered role-question resolution rows into project initiation state.');
assert(approvedKickoffMeeting.project.initiation.leaderElectionResolution?.managerConfirmed && approvedKickoffMeeting.project.initiation.leaderElectionResolution?.leaderMarkerPersisted, 'Kickoff meeting approval must carry manager-confirmed Leader election resolution and persisted Leader marker into project initiation state.');
assert(approvedKickoffMeeting.project.initiation.nextActionResolution?.managerConfirmed && approvedKickoffMeeting.project.initiation.nextActionResolution?.actionIds.includes('svc_kickoff_task_1'), 'Kickoff meeting approval must carry manager-confirmed next-action resolution into project initiation state.');
assert(approvedKickoffMeeting.project.team.every((agent) => approvedKickoffMeeting.project.agentStates?.[agent.id]?.inbox?.some((item) => item.sourceMessageId === 'decision_svc_kickoff_project_next_actions')), 'Kickoff meeting approval must deliver the next-action decision into every Agent inbox.');
assert(approvedKickoffMeeting.project.team.every((agent) => approvedKickoffMeeting.project.agentStates?.[agent.id]?.obligations?.some((item) => item.sourceMessageId === 'decision_svc_kickoff_project_next_actions')), 'Kickoff meeting approval must create next-action decision obligations for every Agent.');
assert(approvedKickoffMeeting.project.eventLedger?.some((event) => event.type === 'kickoff-director-clarification'), 'Kickoff meeting approval must persist manager clarification turns in the unified event ledger.');
assert(approvedKickoffMeeting.project.eventLedger?.some((event) => event.type === 'kickoff-next-action-resolution'), 'Kickoff meeting approval must persist next-action resolution in the unified event ledger.');
assert(approvedKickoffMeeting.messages.some((message) => message.weight === 'Director Clarification' && /Turing owns the backend proof/i.test(message.text || '')), 'Kickoff meeting approval must publish manager clarification into kickoff chat messages.');
assert(approvedKickoffMeeting.messages.some((message) => message.weight === 'Next Action Resolution'), 'Kickoff meeting approval must publish next-action resolution into kickoff decisions.');
assert(approvedKickoffMeeting.kickoffCharter?.evidence?.leaderCampaignIds?.length > 0, 'Kickoff meeting approval must carry saved Leader campaign evidence into the kickoff charter.');
assert(approvedKickoffMeeting.meeting.firstPulse.started && approvedKickoffMeeting.messages.some((message) => message.time === 'First Pulse'), 'Kickoff meeting approval must immediately start and publish the first autonomous pulse.');
assert(kickoffMeetingService.getKickoffMeeting('svc_kickoff_meeting_session').approvedProjectId === 'svc_kickoff_project', 'Kickoff meeting service must persist the approved session/project linkage.');
const kickoffMeetingSnapshot = kickoffMeetingService.snapshot();
assert(kickoffMeetingSnapshot.kickoffMeetings?.some((meeting) => meeting.id === 'svc_kickoff_meeting_session' && meeting.status === 'approved'), 'Project service snapshot must include durable kickoff meeting sessions.');
const reloadedKickoffMeetingService = createAgentProjectService({
  projects: kickoffMeetingSnapshot.projects,
  messages: kickoffMeetingSnapshot.messages,
  kickoffMeetings: kickoffMeetingSnapshot.kickoffMeetings,
});
assert(reloadedKickoffMeetingService.getKickoffMeeting('svc_kickoff_meeting_session').managerDecision.selectedLeaderId === 'turing', 'Reloaded service must preserve kickoff meeting manager decisions.');
assert(reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffExecutionFlow.firstPulse.started, 'Projects approved from a meeting session must expose kickoff execution flow in the manager dashboard.');
assert(reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffExecutionFlow.nextActionResolution.managerConfirmed && reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffExecutionFlow.nextActionResolution.actionIds.includes('svc_kickoff_task_1'), 'Projects approved from a meeting session must expose manager-confirmed next-action resolution in the manager dashboard.');
assert(reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffExecutionFlow.nextActionResolutionDelivery.allAgentsReceived && reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffExecutionFlow.nextActionResolutionDelivery.allAgentsObligated, 'Projects approved from a meeting session must expose next-action Agent receipt and obligation coverage in the manager dashboard.');
assert(reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffMeetingFlow.roleQuestionAnsweredCount >= 1 && reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffMeetingFlow.roleQuestionResolutions.some((row) => row.answered), 'Projects approved from a meeting session must expose answered role-question rows in the manager dashboard.');
assert(reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffMeetingFlow.generationProvenance?.schemaVersion === 'kickoff-generation-provenance/v1' && reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffMeetingFlow.generationProvenance.productionClaim === 'blocked', 'Projects approved from a meeting session must expose kickoff generation provenance in the manager dashboard.');
assert(reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffMeetingFlow.leaderElectionResolution.managerConfirmed && reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffMeetingFlow.leaderElectionResolution.leaderMarkerPersisted, 'Projects approved from a meeting session must expose manager-confirmed Leader election resolution in the manager dashboard.');
assert(reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').agents.peerManagementMatrix?.length === approvedKickoffMeeting.project.team.length, 'Projects approved from a meeting session must expose peer-management matrix rows in the manager dashboard.');
assert(reloadedKickoffMeetingService.getManagerDashboard('svc_kickoff_project').kickoffMeetingFlow.conversationRows.some((row) => row.stage === 'director-clarification' && /Turing owns the backend proof/i.test(row.text || '')), 'Projects approved from a meeting session must expose manager clarification rows in the manager dashboard.');
const reloadedKickoffActionQueue = reloadedKickoffMeetingService.getManagerActionQueue('svc_kickoff_project');
assert(reloadedKickoffActionQueue.rows.some((row) => row.requirementId === 'roles-questions-and-self-nominations' && row.apiPath === '/kickoff-meetings/svc_kickoff_meeting_session/clarify' && row.routeResolved), 'Projects approved from a meeting session must resolve kickoff clarification action routes with the durable meeting id.');
assert(reloadedKickoffActionQueue.rows.some((row) => row.requirementId === 'leader-election-marker' && row.apiPath === '/kickoff-meetings/svc_kickoff_meeting_session/leader' && row.context?.kickoffMeetingId === 'svc_kickoff_meeting_session'), 'Projects approved from a meeting session must resolve Leader confirmation action routes with context.');
assert(reloadedKickoffActionQueue.rows.some((row) => row.requirementId === 'leader-election-marker' && row.requestBodyTemplate?.selectedLeaderId === 'turing'), 'Projects approved from a meeting session must expose a Leader confirmation request body template.');
checkpoint('project service read models');
const projectService = createAgentProjectService({
  projects: [publishedCycleChat.project],
  messages: [
    ...assignmentPackage.assignmentMessages.map((message) => ({ ...message, projectId })),
    ...assignmentPackage.acknowledgementMessages.map((message) => ({ ...message, projectId })),
    ...meetingChangeResponse.discussionMessages.map((message) => ({ ...message, projectId })),
    ...changeResponse.discussionMessages.map((message) => ({ ...message, projectId })),
    ...publishedCycleChat.messages.map((message) => ({ ...message, projectId })),
  ],
});
const serviceMeetingChange = projectService.submitMeetingMessage({
  projectId,
  text: '@all add service-owned meeting change evidence',
  now: '2026-05-28T13:00:00.000Z',
  messageId: 'svc_meeting_source',
});
assert(serviceMeetingChange.route === 'war-room-meeting-change', 'Project service must route meeting feature changes through the War Room change protocol.');
assert(serviceMeetingChange.messages[0].id === 'svc_meeting_source', 'Project service must expose the War Room source message.');
assert(serviceMeetingChange.meetingAgentTurns?.length >= 1 && serviceMeetingChange.messages.some((message) => message.schemaVersion === 'meeting-agent-turn/v1'), 'Project service must return backend-authored Agent meeting turns for War Room animation.');
assert(serviceMeetingChange.meetingAgentTurns.every((turn) => turn.timelineLogIds?.length >= 1) && serviceMeetingChange.project.logs.some((log) => log.eventType === 'meeting-agent-turn' && serviceMeetingChange.meetingAgentTurns.some((turn) => turn.timelineLogIds.includes(log.id))), 'Project service must persist Agent meeting turns into the timeline with returned timeline log ids.');
assert(serviceMeetingChange.project.eventLedger.some((event) => event.source === 'war-room-meeting-agent-turn' && serviceMeetingChange.meetingAgentTurns.some((turn) => event.entityIds?.messageId === turn.messageId)), 'Project service must persist Agent meeting turns into the unified event ledger.');
assert(serviceMeetingChange.project.eventLedger.some((event) => event.source === 'war-room-meeting-message' && event.entityIds?.messageId === 'svc_meeting_source'), 'Project service must persist meeting source messages into the unified ledger.');
assert(serviceMeetingChange.responses.changeResponse.changeRecord.source === 'war-room-meeting-change-request', 'Project service meeting changes must preserve War Room source metadata.');
assert(serviceMeetingChange.responses.changeOwnerStartWorkResponse?.cycle?.trigger === 'change-owner-start-work', 'Project service meeting changes must immediately start the responsible owner work pulse.');

const serviceGoogleChange = projectService.submitChatMessage({
  projectId,
  channelId: 'google_chat',
  text: '@all add service Google Chat export audit',
  now: '2026-05-28T13:10:00.000Z',
  messageId: 'svc_google_source',
});
assert(serviceGoogleChange.route === 'feature-change', 'Project service must route Google Chat feature changes through the change protocol.');
assert(serviceGoogleChange.responses.changeResponse.changeTask.source === 'google-chat-mention-change-request', 'Project service must preserve Google Chat source on created tasks.');
assert(serviceGoogleChange.project.eventLedger.some((event) => event.source === 'google-chat-message' && event.entityIds?.messageId === 'svc_google_source'), 'Project service must persist Google Chat source messages into the unified ledger.');
assert(serviceGoogleChange.responses.changeOwnerStartWorkResponse?.cycle?.trigger === 'change-owner-start-work', 'Project service Google Chat changes must immediately start the responsible owner work pulse.');
const serviceDualChannelChange = projectService.submitMultiChannelChangeRequest({
  projectId,
  text: '@all add service dual-channel launch audit',
  now: '2026-05-28T13:12:00.000Z',
  messageIdPrefix: 'svc_dual_change',
});
assert(serviceDualChannelChange.route === 'multi-channel-change' && serviceDualChannelChange.messages.some((message) => message.channelId === 'main') && serviceDualChannelChange.messages.some((message) => message.channelId === 'google_chat'), 'Project service must persist one dual-channel change across War Room and Google Chat.');
assert(serviceDualChannelChange.responses.changeOwnerStartWorkResponse?.cycle?.trigger === 'change-owner-start-work', 'Project service multi-channel changes must immediately start the responsible owner work pulse.');
assert(projectService.getManagerDashboard(projectId).changeFlow.rows.some((row) => row.source === 'multi-channel-change-request' && row.sourceChannelIds?.includes('google_chat') && row.sourceModes?.includes('war_room_meeting') && row.sourceModes?.includes('google_chat') && row.sourceMessageIds?.length === 2), 'Project service manager dashboard must expose dual-channel change source evidence with explicit source modes.');
const serviceTranscriptIndex = projectService.getTranscriptIndex(projectId);
assert(serviceTranscriptIndex.channels.some((channel) => channel.channelId === 'main' && channel.messageCount > 0 && channel.archivedProofCount > 0), 'Project service transcript index must expose main-channel current messages plus archived proof recovery.');
assert(serviceTranscriptIndex.channels.some((channel) => channel.channelId === 'google_chat' && channel.messageCount > 0), 'Project service transcript index must expose Google Chat channel messages.');
const serviceMainTranscript = projectService.getChannelTranscript(projectId, 'main');
assert(serviceMainTranscript.messages.length > 0 && serviceMainTranscript.archivedProofMessages.length > 0 && serviceMainTranscript.proofIds.length >= serviceMainTranscript.messages.length, 'Project service channel transcript must return current messages, archived proof messages, and proof ids.');
assert(serviceMainTranscript.messages.some((message) => message.schemaVersion === 'meeting-agent-turn/v1' && message.source === 'war-room-meeting-agent-turn'), 'Project service channel transcript must expose backend-authored Agent meeting turns.');
assert(projectService.getTimeline(projectId).logs.some((log) => log.eventType === 'meeting-agent-turn' && log.messageId), 'Project service timeline route must expose backend-authored Agent meeting turns.');

const serviceLeaderAssignment = projectService.submitChatMessage({
  projectId,
  channelId: 'main',
  text: 'leader assign @Alan Turing prepare service manager-review evidence packet',
  now: '2026-05-28T13:20:00.000Z',
  messageId: 'svc_leader_source',
});
assert(serviceLeaderAssignment.route === 'leader-assignment', 'Project service must route Leader assignment chat commands before generic replies.');
assert(serviceLeaderAssignment.responses.leaderAssignmentResponse.task.ownerId === 'turing', 'Project service Leader assignment must resolve the mentioned owner.');
assert(serviceLeaderAssignment.messages.some((message) => message.text.includes('starting work now')), 'Project service Leader assignment must return the assignee acknowledgement message.');
assert(serviceLeaderAssignment.responses.leaderAssignmentStartWorkResponse?.cycle?.trigger === 'leader-assignment-start-work', 'Project service Leader assignment must immediately trigger the assigned Agent work pulse.');
assert(serviceLeaderAssignment.project.agentWorkerLedger?.some((record) => record.agentId === 'turing' && record.trigger === 'leader-assignment-start-work' && record.taskId === serviceLeaderAssignment.responses.leaderAssignmentResponse.task.id), 'Project service Leader assignment work pulse must persist to the Agent worker ledger.');
assert(serviceLeaderAssignment.messages.some((message) => message.agentWorker?.agentId === 'turing' && message.agentWorker?.trigger === 'leader-assignment-start-work'), 'Project service Leader assignment must return the assigned Agent first work-pulse message.');

const servicePeerHandoff = projectService.submitChatMessage({
  projectId,
  channelId: 'main',
  text: 'Alan Turing needs dependency help from @Marie Curie review service backend evidence',
  now: '2026-05-28T13:30:00.000Z',
  messageId: 'svc_peer_source',
});
assert(servicePeerHandoff.route === 'peer-handoff', 'Project service must route Agent-to-Agent dependency handoffs.');
assert(servicePeerHandoff.responses.peerHandoffResponse.task.ownerId === 'curie', 'Project service peer handoff must resolve the target peer.');
assert(servicePeerHandoff.project.peerHandoffs?.some((handoff) => handoff.status === 'accepted'), 'Project service must persist accepted peer handoffs.');

const serviceAutonomousCycle = projectService.runAutonomousCycle({
  projectId,
  cadence: 'hourly',
  now: '2026-05-28T14:00:00.000Z',
  trigger: 'backend-worker',
  schedulerReason: 'service-backend-worker-verification',
  dueAt: '2026-05-28T14:00:00.000Z',
  source: 'backend-worker-autonomous-chat',
});
assert(serviceAutonomousCycle.messages.length > 0, 'Project service autonomous worker cycle must publish visible group-chat messages.');
assert(serviceAutonomousCycle.project.autonomousSchedulerLedger?.[0]?.trigger === 'backend-worker', 'Project service autonomous worker cycle must preserve scheduler trigger metadata.');
assert(serviceAutonomousCycle.project.eventLedger.some((event) => event.source === 'backend-worker-autonomous-chat'), 'Project service autonomous worker messages must enter the unified event ledger.');
const directAgentWorkerProject = {
  ...serviceAutonomousCycle.project,
  agentStates: {
    ...serviceAutonomousCycle.project.agentStates,
    turing: {
      ...serviceAutonomousCycle.project.agentStates.turing,
      managedIds: Array.from(new Set([...(serviceAutonomousCycle.project.agentStates.turing?.managedIds || []), 'curie'])),
    },
  },
};
const directAgentWorkerProbe = runAgentWorkCycle({
  project: directAgentWorkerProject,
  agentId: 'turing',
  now: '2026-05-28T14:03:00.000Z',
  trigger: 'direct-agent-worker-probe',
});
assert(directAgentWorkerProbe.route === 'agent-work-cycle' && directAgentWorkerProbe.agent.agentId === 'turing', 'Direct per-Agent worker function must advance one named Agent independently.');
assert(directAgentWorkerProbe.project.eventLedger.some((event) => event.source === 'agent-work-cycle'), 'Direct per-Agent worker cycle must append timeline evidence to the unified event ledger.');
assert(directAgentWorkerProbe.messages.some((message) => message.agentWorker?.targetAgentId === 'curie' && /management check-in/i.test(message.text || '')), 'Independent Agent worker must publish visible management check-ins for managed Agents.');
assert(directAgentWorkerProbe.project.logs.some((log) => ['management-check-in', 'peer-management-check-in'].includes(log.eventType) && log.targetAgentId === 'curie'), 'Independent Agent worker management check-ins must enter the project timeline.');
assert(directAgentWorkerProbe.project.eventLedger.some((event) => event.source === 'agent-work-cycle-management' && event.entityIds?.targetAgentId === 'curie'), 'Independent Agent worker management check-ins must enter the unified event ledger.');
assert(directAgentWorkerProbe.project.agentStates.curie?.inbox.some((item) => /^agent_management_turing_curie/.test(item.sourceMessageId || '')), 'Managed Agents must receive independent worker check-ins in their inbox.');
assert(directAgentWorkerProbe.project.agentWorkerLedger?.[0]?.managementTargetIds?.includes('curie'), 'Independent Agent worker ledger must record managed Agent targets.');
const managementResponseProbe = runAgentWorkCycle({
  project: directAgentWorkerProbe.project,
  agentId: 'curie',
  now: '2026-05-28T14:04:00.000Z',
  trigger: 'direct-agent-management-response-probe',
});
assert(managementResponseProbe.messages.some((message) => message.agentWorker?.targetAgentId === 'turing' && /picked up your management signal/i.test(message.text || '')), 'Managed Agent worker pulses must respond visibly to manager check-ins.');
assert(managementResponseProbe.project.logs.some((log) => log.eventType === 'management-response' && log.agentId === 'curie' && log.targetAgentId === 'turing'), 'Managed Agent responses must enter the project timeline.');
assert(managementResponseProbe.project.eventLedger.some((event) => event.source === 'agent-work-cycle-management-response' && event.entityIds?.agentId === 'curie' && event.entityIds?.targetAgentId === 'turing'), 'Managed Agent responses must enter the unified event ledger.');
assert(managementResponseProbe.project.agentStates.curie?.inbox.some((item) => /^agent_management_turing_curie/.test(item.sourceMessageId || '') && item.status === 'addressed' && item.respondedAt), 'Managed Agent responses must mark the original management inbox signal as addressed.');
assert(managementResponseProbe.project.agentStates.curie?.obligations.some((item) => /^agent_management_turing_curie/.test(item.sourceMessageId || '') && item.status === 'done'), 'Managed Agent responses must close the management response obligation.');
assert(managementResponseProbe.project.agentWorkerLedger?.[0]?.managementResponseTargetIds?.includes('turing') && managementResponseProbe.project.agentWorkerLedger[0].managementResponseCount > 0, 'Independent Agent worker ledger must record management response targets.');
const serviceAgentAssignment = projectService.submitChatMessage({
  projectId,
  channelId: 'main',
  text: 'leader assign @Alan Turing run independent Agent worker proof',
  now: '2026-05-28T14:05:00.000Z',
  messageId: 'svc_agent_worker_assignment_source',
});
const serviceAgentTaskId = serviceAgentAssignment.responses.leaderAssignmentResponse.task.id;
assert(serviceAgentAssignment.responses.leaderAssignmentStartWorkResponse?.task?.id === serviceAgentTaskId && serviceAgentAssignment.responses.leaderAssignmentStartWorkResponse.task.workPulseCount >= 1, 'Service Leader assignment must immediately start the assigned Agent-owned task.');
const firstAgentPulse = projectService.runAgentWorkCycle({
  projectId,
  agentId: 'turing',
  now: '2026-05-28T14:06:00.000Z',
  trigger: 'service-agent-worker',
  useAutonomousStrategy: true,
  submitWorkArtifact: true,
  workArtifactReviewerAgentId: 'curie',
});
assert(firstAgentPulse.route === 'agent-work-cycle' && firstAgentPulse.messages.some((message) => /Progress on|Completed/.test(message.text || '')), 'Service per-Agent worker must publish a visible work message.');
assert(firstAgentPulse.project.agentStates.turing.worklog.some((item) => item.source === 'agent-work-cycle'), 'Service per-Agent worker must write private Agent worklog evidence.');
assert(firstAgentPulse.project.logs.some((log) => ['agent-work-pulse', 'agent-task-completed'].includes(log.eventType)), 'Service per-Agent worker must publish work evidence to the project timeline.');
assert(firstAgentPulse.task?.status === 'done' && firstAgentPulse.task.id === serviceAgentTaskId, 'Second pulse after immediate assignment-start work must be able to complete the Agent-owned task.');
assert(firstAgentPulse.submission?.artifactType === 'progress-brief' && firstAgentPulse.submission.taskId === serviceAgentTaskId, 'Completed Agent worker cycles must be able to submit a progress brief through the standard Agent submission contract.');
assert(firstAgentPulse.messages.some((message) => message.submissionId === firstAgentPulse.submission?.id), 'Autonomous worker submissions must publish group-chat submission proof.');
assert(firstAgentPulse.project.eventLedger.some((event) => event.type === 'agent-submission' && event.entityIds?.submissionId === firstAgentPulse.submission?.id), 'Autonomous worker submissions must append Agent submission event-ledger proof.');
assert(firstAgentPulse.project.agentWorkerLedger?.[0]?.workSubmissionId === firstAgentPulse.submission?.id, 'Agent worker ledger must link completed work cycles to the submitted work artifact.');
assert(firstAgentPulse.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1' && firstAgentPulse.strategyDecision.selectedAction === 'complete-and-submit-owned-work', 'Agent autonomous strategy must decide to submit completed owned work as a Manager-visible node.');
assert(firstAgentPulse.project.agentWorkerLedger?.[0]?.strategySelectedAction === 'complete-and-submit-owned-work' && firstAgentPulse.project.logs?.some((log) => log.strategyDecision?.id === firstAgentPulse.strategyDecision.id), 'Agent worker ledger and timeline proof must retain the autonomous strategy decision.');
const reviewerAgentPulse = projectService.runAgentWorkCycle({
  projectId,
  agentId: 'curie',
  now: '2026-05-28T14:06:30.000Z',
  trigger: 'service-reviewer-worker',
  useAutonomousStrategy: true,
  reviewPendingSubmission: true,
  agentReviewVerdict: 'changes-requested',
  agentReviewComments: 'Reviewer worker requested a tighter revision after checking task evidence and autonomous work proof.',
  agentReviewRequestedChanges: [
    'Link the revision to the autonomous worker submission.',
    'Summarize the evidence chain before final delivery.',
  ],
});
assert(reviewerAgentPulse.review?.verdict === 'changes-requested' && reviewerAgentPulse.review.submissionId === firstAgentPulse.submission?.id, 'Reviewer Agent worker must review pending autonomous work submissions through the standard review contract.');
assert(reviewerAgentPulse.strategyDecision?.selectedAction === 'review-pending-submission' && reviewerAgentPulse.strategyDecision.controls?.reviewSubmissionId === firstAgentPulse.submission?.id, 'Reviewer autonomous strategy must pick the pending teammate submission for review.');
assert(reviewerAgentPulse.messages.some((message) => message.type === 'submission-review' && message.reviewId === reviewerAgentPulse.review?.id), 'Reviewer worker reviews must publish group-chat review proof.');
assert(reviewerAgentPulse.project.eventLedger.some((event) => event.type === 'submission-review' && event.entityIds?.reviewId === reviewerAgentPulse.review?.id), 'Reviewer worker reviews must append submission-review event-ledger proof.');
assert(reviewerAgentPulse.project.agentWorkerLedger?.[0]?.submissionReviewId === reviewerAgentPulse.review?.id, 'Reviewer worker ledger must link cycles to created submission reviews.');
assert(reviewerAgentPulse.project.agentStates.turing?.obligations.some((item) => item.reviewId === reviewerAgentPulse.review?.id && item.status === 'open'), 'Changes-requested Reviewer worker reviews must create a submitter revision obligation.');
const submitterRevisionPulse = projectService.runAgentWorkCycle({
  projectId,
  agentId: 'turing',
  now: '2026-05-28T14:06:45.000Z',
  trigger: 'service-review-response-worker',
  useAutonomousStrategy: true,
  respondToReviewObligation: true,
  reviewResponseArtifactType: 'revision-note',
  reviewResponseReviewerAgentId: 'curie',
});
assert(submitterRevisionPulse.reviewResponseSubmission?.artifactType === 'revision-note' && submitterRevisionPulse.reviewResponseSubmission.respondsToReviewId === reviewerAgentPulse.review?.id, 'Submitter Agent worker must answer requested-change review obligations with linked revision submissions.');
assert(submitterRevisionPulse.strategyDecision?.selectedAction === 'respond-to-review-obligation' && submitterRevisionPulse.strategyDecision.controls?.reviewResponseId === reviewerAgentPulse.review?.id, 'Submitter autonomous strategy must prioritize open requested-change obligations before new work.');
assert(submitterRevisionPulse.reviewResponseSubmission?.revisesSubmissionId === firstAgentPulse.submission?.id, 'Submitter Agent worker revision submissions must link back to the reviewed submission.');
assert(submitterRevisionPulse.project.agentStates.turing?.obligations.some((item) => item.reviewId === reviewerAgentPulse.review?.id && item.status === 'resolved' && item.resolvedBySubmissionId === submitterRevisionPulse.reviewResponseSubmission?.id), 'Linked revision submissions must resolve the submitter review obligation.');
assert(submitterRevisionPulse.project.agentWorkerLedger?.[0]?.reviewResponseSubmissionId === submitterRevisionPulse.reviewResponseSubmission?.id, 'Submitter worker ledger must link cycles to review-response submissions.');
const reviewerAcceptRevisionPulse = projectService.runAgentWorkCycle({
  projectId,
  agentId: 'curie',
  now: '2026-05-28T14:06:55.000Z',
  trigger: 'service-reviewer-accept-revision-worker',
  useAutonomousStrategy: true,
  reviewPendingSubmission: true,
  reviewSubmissionId: submitterRevisionPulse.reviewResponseSubmission?.id,
  agentReviewVerdict: 'accepted',
  agentReviewComments: 'Reviewer worker accepted the linked revision response.',
});
assert(reviewerAcceptRevisionPulse.review?.verdict === 'accepted' && reviewerAcceptRevisionPulse.review.submissionId === submitterRevisionPulse.reviewResponseSubmission?.id, 'Reviewer Agent worker must accept linked revision submissions through the standard review contract.');
assert(reviewerAcceptRevisionPulse.strategyDecision?.selectedAction === 'review-pending-submission' && reviewerAcceptRevisionPulse.project.agentWorkerLedger?.[0]?.strategyDecision?.controls?.reviewSubmissionId === submitterRevisionPulse.reviewResponseSubmission?.id, 'Reviewer autonomous strategy must keep revision acceptance linked to the chosen submission.');
const secondAgentPulse = projectService.runAgentWorkCycle({
  projectId,
  agentId: 'turing',
  now: '2026-05-28T14:07:00.000Z',
  trigger: 'service-agent-worker',
});
assert(secondAgentPulse.project.agentWorkerLedger?.[0]?.agentId === 'turing', 'Per-Agent worker cycles must maintain an Agent worker ledger.');
const serviceAgentEvidence = projectService.getTaskEvidence(projectId, serviceAgentTaskId);
assert(serviceAgentEvidence.messages.some((message) => message.agentWorker?.agentId === 'turing'), 'Task evidence must include the per-Agent worker chat proof.');
assert(serviceAgentEvidence.logs.some((log) => log.eventType === 'agent-task-completed'), 'Task evidence must include the per-Agent worker completion timeline proof.');
assert(serviceAgentEvidence.submissions.some((submission) => submission.id === firstAgentPulse.submission?.id && submission.artifactType === 'progress-brief'), 'Task evidence must include autonomous worker-submitted progress briefs.');
assert(serviceAgentEvidence.submissions.some((submission) => submission.id === submitterRevisionPulse.reviewResponseSubmission?.id && submission.respondsToReviewId === reviewerAgentPulse.review?.id), 'Task evidence must include Submitter worker linked revision submissions.');
assert(serviceAgentEvidence.submissionReviews.some((review) => review.id === reviewerAgentPulse.review?.id && review.verdict === 'changes-requested'), 'Task evidence must include Reviewer worker requested-change reviews.');
assert(serviceAgentEvidence.submissionReviews.some((review) => review.id === reviewerAcceptRevisionPulse.review?.id && review.verdict === 'accepted'), 'Task evidence must include Reviewer worker accepted revision reviews.');
const autoBrainstormTaskId = 'svc_auto_brainstorm_artifact_task';
const autoBrainstormProject = projectService.getProject(projectId);
projectService.replaceProject({
  ...autoBrainstormProject,
  tasks: [
    {
      id: autoBrainstormTaskId,
      text: 'Create brainstorm alternatives board for the generic product-team workflow',
      assignee: 'Alan Turing',
      ownerId: 'turing',
      status: 'in-progress',
      workPulseCount: 1,
    },
    ...(autoBrainstormProject.tasks || []),
  ],
  agentStates: {
    ...(autoBrainstormProject.agentStates || {}),
    turing: {
      ...(autoBrainstormProject.agentStates?.turing || {}),
      currentPlan: {
        ...(autoBrainstormProject.agentStates?.turing?.currentPlan || {}),
        taskId: autoBrainstormTaskId,
        focus: 'Create brainstorm alternatives board for the generic product-team workflow',
      },
      obligations: [
        {
          id: 'svc_auto_brainstorm_artifact_obligation',
          taskId: autoBrainstormTaskId,
          text: 'Create brainstorm alternatives board for the generic product-team workflow',
          status: 'open',
        },
        ...(autoBrainstormProject.agentStates?.turing?.obligations || []),
      ],
    },
  },
});
const autoBrainstormPulse = projectService.runAgentWorkCycle({
  projectId,
  agentId: 'turing',
  now: '2026-05-28T14:07:30.000Z',
  trigger: 'service-agent-worker-auto-artifact',
  useAutonomousStrategy: true,
  submitWorkArtifact: true,
  workArtifactType: 'auto',
  workArtifactReviewerAgentId: 'curie',
});
assert(autoBrainstormPulse.submission?.artifactType === 'brainstorm-board' && autoBrainstormPulse.strategyDecision?.controls?.workArtifactType === 'brainstorm-board', 'Autonomous worker artifact inference must turn brainstorm task intent into a brainstorm-board submission node.');
assert(projectService.getTaskEvidence(projectId, autoBrainstormTaskId).submissions.some((submission) => submission.id === autoBrainstormPulse.submission?.id && submission.artifactType === 'brainstorm-board'), 'Task evidence must include autonomous worker-inferred brainstorm-board submissions.');
const providerEvidenceTaskId = 'svc_provider_evidence_worker_task';
const providerEvidenceProject = cloneJson(projectService.getProject(projectId));
const providerEvidenceTaskText = 'Search and package provider-backed evidence for the generic product-team workflow';
const providerEvidenceState = providerEvidenceProject.agentStates?.turing || {};
const providerSeedProject = {
  ...providerEvidenceProject,
  tasks: [
    {
      id: providerEvidenceTaskId,
      text: providerEvidenceTaskText,
      assignee: 'Alan Turing',
      ownerId: 'turing',
      status: 'in-progress',
      workPulseCount: 1,
    },
    ...(providerEvidenceProject.tasks || []),
  ],
  agentStates: {
    ...(providerEvidenceProject.agentStates || {}),
    turing: {
      ...providerEvidenceState,
      currentPlan: {
        ...(providerEvidenceState.currentPlan || {}),
        taskId: providerEvidenceTaskId,
        focus: providerEvidenceTaskText,
      },
      obligations: [
        {
          id: 'svc_provider_evidence_worker_obligation',
          taskId: providerEvidenceTaskId,
          text: providerEvidenceTaskText,
          status: 'open',
        },
      ],
    },
  },
  agentSubmissions: [],
  submissionReviews: [],
};
const providerEvidencePolicy = {
  enabled: true,
  mode: 'enforced',
  allowedSearchProviders: ['deterministic'],
  defaultToolGrants: ['search:evidence'],
  maxRequestsPerProjectHour: 10,
  dailyBudgetCents: 100,
  searchCostCentsPerRequest: 1,
  retryAttempts: 0,
  circuitFailureThreshold: 3,
  circuitWindowMinutes: 15,
  circuitCooldownSeconds: 300,
};
const providerWorkerService = createAgentProjectService({
  store: createAgentProjectMemoryStore({
    projects: [cloneJson(providerSeedProject)],
    messages: cloneJson(projectService.getMessages(projectId)),
  }),
  searchProvider: createSearchProvider({ provider: 'deterministic', enabled: true, maxResults: 2 }),
  providerPolicy: providerEvidencePolicy,
});
const providerQueueService = createAgentProjectService({
  store: createAgentProjectMemoryStore({
    projects: [cloneJson(providerSeedProject)],
    messages: cloneJson(projectService.getMessages(projectId)),
  }),
  searchProvider: createSearchProvider({ provider: 'deterministic', enabled: true, maxResults: 2 }),
  providerPolicy: providerEvidencePolicy,
});
const providerAutopilotService = createAgentProjectService({
  store: createAgentProjectMemoryStore({
    projects: [cloneJson(providerSeedProject)],
    messages: cloneJson(projectService.getMessages(projectId)),
  }),
  searchProvider: createSearchProvider({ provider: 'deterministic', enabled: true, maxResults: 2 }),
  providerPolicy: providerEvidencePolicy,
});
const providerAutopilotDueService = createAgentProjectService({
  store: createAgentProjectMemoryStore({
    projects: [cloneJson(providerSeedProject)],
    messages: cloneJson(projectService.getMessages(projectId)),
  }),
  searchProvider: createSearchProvider({ provider: 'deterministic', enabled: true, maxResults: 2 }),
  providerPolicy: providerEvidencePolicy,
});
const providerEvidenceTargetControl = {
  schemaVersion: 'autopilot-delivery-target-control/v1',
  targetKind: 'product-team-delivery-trace',
  targetStageId: 'evidence-quality',
  targetIntent: 'Ask the autonomous team to record provider-backed evidence/search proof and submit an evidence packet.',
  targetReason: 'Harness forces the evidence-quality stage to prove async provider-backed Autopilot execution.',
  preferredLane: 'agent-autonomy',
  workArtifactType: 'evidence-packet',
  agentWorkArtifactType: 'evidence-packet',
  submitWorkArtifact: true,
  submitAgentWorkArtifacts: true,
  submitWorkArtifactOn: 'always',
  recordEvidenceSearch: true,
  evidenceSearchQuery: 'autopilot provider evidence for generic product team',
  evidenceSearchPurpose: 'Prove Autopilot session ticks can execute provider-backed evidence through Agent Queue.',
  useAgentAutonomousStrategy: true,
  reviewPendingSubmission: true,
  reviewPendingSubmissions: true,
  respondToReviewObligation: true,
  respondToReviewObligations: true,
  includeReadModels: false,
};
const providerAgentQueue = providerQueueService.getAgentAutonomousActionQueue(projectId, {
  now: '2026-05-28T14:07:40.000Z',
});
const providerQueueRow = providerAgentQueue.rows.find((row) => row.agentId === 'turing');
assert(providerQueueRow?.providerEvidenceSearchPlanned === true
  && providerQueueRow.requestBodyTemplate?.useProviderEvidenceSearch === true
  && providerQueueRow.initiative?.providerEvidenceSearchPlanned === true
  && providerAgentQueue.summary?.providerEvidenceSearchRowCount >= 1, 'Agent autonomous action queue must automatically plan provider-backed evidence search for evidence-packet work when the search provider is enabled.');
const providerQueueRun = await providerQueueService.runAgentAutonomousActionQueueItemWithProviderEvidence({
  projectId,
  agentId: 'turing',
  now: '2026-05-28T14:07:42.000Z',
  force: true,
  requestBodyOverrides: { includeReadModels: false },
});
assert(providerQueueRun.route === 'agent-autonomous-action-queue-item-run'
  && providerQueueRun.providerEvidenceSearch?.status === 'completed'
  && providerQueueRun.evidenceSearch?.provider === 'deterministic'
  && providerQueueRun.agentAutonomousActionRun?.providerUsageId === providerQueueRun.providerUsage?.id
  && providerQueueRun.agentAutonomousActionRun?.evidenceSearchId === providerQueueRun.evidenceSearch?.id
  && providerQueueRun.project.agentAutonomousActionRunLedger?.some((run) => run.id === providerQueueRun.agentAutonomousActionRun.id && run.providerReceiptId === providerQueueRun.evidenceSearch?.providerReceiptId), 'Agent autonomous action queue provider runs must execute through provider-backed work cycles and persist run/evidence/provider links.');
const providerAutopilotSessionStart = providerAutopilotService.startAutonomousRunControlSession({
  projectId,
  sessionId: 'provider_evidence_autopilot_session',
  now: '2026-05-28T14:07:43.000Z',
  forceNewSession: true,
  maxLoops: 2,
  maxStepsPerLoop: 1,
  maxTotalSteps: 2,
  requestBodyOverrides: {
    includeReadModels: false,
    useProviderEvidenceSearch: true,
  },
});
const providerAutopilotTick = await providerAutopilotService.tickAutonomousRunControlSessionWithProviderEvidence({
  projectId,
  sessionId: providerAutopilotSessionStart.autonomousRunControlSession.id,
  now: '2026-05-28T14:07:44.000Z',
  requestBodyOverrides: {
    includeReadModels: false,
    useProviderEvidenceSearch: true,
    autopilotTargetControl: providerEvidenceTargetControl,
  },
});
assert(providerAutopilotTick.route === 'autonomous-run-control-session-tick', 'Autopilot provider-evidence session ticks must return the normal session tick route.');
assert(providerAutopilotTick.providerEvidenceSearch?.status === 'completed' && providerAutopilotTick.evidenceSearch?.provider === 'deterministic', `Autopilot provider-evidence session ticks must complete deterministic provider-backed evidence search: ${JSON.stringify({
  providerEvidenceSearch: providerAutopilotTick.providerEvidenceSearch,
  evidenceProvider: providerAutopilotTick.evidenceSearch?.provider,
  skipped: providerAutopilotTick.providerEvidenceSearchSkippedReason,
  tickProvider: providerAutopilotTick.autonomousRunControlSessionTick?.providerEvidenceSearch?.provider,
  actionLanes: providerAutopilotTick.autonomousRunControlSessionTick?.actionLanes,
})}`);
assert(providerAutopilotTick.autonomousRunControlSessionTick?.providerEvidenceSearch?.status === 'completed' && providerAutopilotTick.autonomousRunControlSessionTick?.actionLanes?.includes('agent-autonomy'), 'Autopilot provider-evidence session ticks must record provider evidence and Agent lane ownership in the tick receipt.');
assert(providerAutopilotTick.autonomousRunControlSessionTick?.providerUsageId === providerAutopilotTick.providerUsage?.id, 'Autopilot provider-evidence session ticks must link tick receipt to provider usage.');
assert(providerAutopilotTick.autonomousRunControlRuns?.some((run) => run.providerUsageId === providerAutopilotTick.providerUsage?.id && run.evidenceSearchId === providerAutopilotTick.evidenceSearch?.id), 'Autopilot provider-evidence session ticks must link run receipt to provider usage and evidence search.');
assert(providerAutopilotTick.project.autonomousRunControlSessionTickLedger?.some((tick) => tick.id === providerAutopilotTick.autonomousRunControlSessionTick.id && tick.evidenceSearchId === providerAutopilotTick.evidenceSearch?.id), 'Autopilot provider-evidence session ticks must persist tick/evidence proof into the project ledger.');
const providerAutopilotTickMessageId = providerAutopilotTick.autonomousRunControlSessionTick?.providerEvidenceMessageId;
const providerAutopilotTickTranscript = providerAutopilotService.getChannelTranscript(projectId, 'main');
assert(providerAutopilotTickMessageId
  && providerAutopilotTick.autonomousRunControlSessionTick.resultMessageIds?.includes(providerAutopilotTickMessageId)
  && providerAutopilotTick.messages?.some((message) => message.id === providerAutopilotTickMessageId && message.type === 'autopilot-provider-evidence' && message.evidenceSearchId === providerAutopilotTick.evidenceSearch?.id)
  && providerAutopilotService.getMessages(projectId).some((message) => message.id === providerAutopilotTickMessageId && message.providerUsageId === providerAutopilotTick.providerUsage?.id)
  && providerAutopilotTickTranscript.proofIds?.includes(providerAutopilotTickMessageId), 'Autopilot provider-evidence ticks must publish a group-chat coordination message and link it into tick result messages, stored transcripts, evidence search, and provider usage proof.');
const providerAutopilotDueSessionStart = providerAutopilotDueService.startAutonomousRunControlSession({
  projectId,
  sessionId: 'provider_evidence_autopilot_due_session',
  now: '2026-05-28T14:07:44.500Z',
  forceNewSession: true,
  maxLoops: 2,
  maxStepsPerLoop: 1,
  maxTotalSteps: 2,
  requestBodyOverrides: {
    includeReadModels: false,
    useProviderEvidenceSearch: true,
  },
});
const providerAutopilotDueWorker = await providerAutopilotDueService.runDueAutonomousRunControlSessionsWithProviderEvidence({
  now: '2026-05-28T14:07:44.750Z',
  forceDue: true,
  forceProjectIds: [projectId],
  maxProjects: 1,
  maxSessionsPerProject: 1,
  loopCount: 1,
  providerEvidenceSearchEnabled: true,
  requestBodyOverrides: {
    includeReadModels: false,
    useProviderEvidenceSearch: true,
    autopilotTargetControl: providerEvidenceTargetControl,
  },
});
const providerAutopilotDueProcessed = providerAutopilotDueWorker.processed.find((row) => row.sessionId === providerAutopilotDueSessionStart.autonomousRunControlSession.id);
assert(providerAutopilotDueWorker.schemaVersion === 'autopilot-due-worker-summary/v1'
  && providerAutopilotDueWorker.providerEvidenceSearchEnabled === true
  && providerAutopilotDueProcessed?.providerEvidenceSearch?.status === 'completed'
  && providerAutopilotDueProcessed?.evidenceSearchId
  && providerAutopilotDueProcessed?.providerUsageId
  && providerAutopilotDueProcessed?.providerEvidenceMessageId
  && providerAutopilotDueProcessed?.result?.autonomousRunControlSessionTick?.providerUsageId === providerAutopilotDueProcessed.providerUsageId, 'Autopilot due-worker must advance due sessions through the async provider-evidence lane and link provider/evidence proof into the session tick.');
const providerAutopilotDueFlowGraph = providerAutopilotDueService.getManagerFlowGraph(projectId);
const providerAutopilotDueProofMap = providerAutopilotDueService.getReadinessProofMap(projectId);
const providerAutopilotDueTranscript = providerAutopilotDueService.getChannelTranscript(projectId, 'main');
const providerAutopilotDueTickNode = providerAutopilotDueFlowGraph.nodes?.find((node) => (
  node.source === 'autonomousRunControlSessionTicks'
  && node.attachments?.some((attachment) => attachment.type === 'autopilot-provider-evidence' && attachment.evidenceSearchId === providerAutopilotDueProcessed.evidenceSearchId)
));
assert(providerAutopilotDueTickNode
  && providerAutopilotDueTickNode.attachments.some((attachment) => attachment.providerUsageId === providerAutopilotDueProcessed.providerUsageId)
  && providerAutopilotDueTickNode.attachments.some((attachment) => attachment.providerEvidenceMessageId === providerAutopilotDueProcessed.providerEvidenceMessageId && attachment.providerEvidenceTranscriptRoute?.includes(providerAutopilotDueProcessed.providerEvidenceMessageId))
  && providerAutopilotDueFlowGraph.edges?.some((edge) => edge.fromNodeId === providerAutopilotDueTickNode.id && edge.toNodeId === `evidence-search-${providerAutopilotDueProcessed.evidenceSearchId}` && edge.label === 'Provider evidence recorded'), 'Manager Flow Graph must attach provider evidence receipts to Autopilot due-worker tick nodes and link them to the evidence-search node.');
assert(providerAutopilotDueProofMap.autonomousRunControlSessionTickRoutes?.some((route) => (
  route.id === providerAutopilotDueProcessed.tickId
  && route.providerEvidenceSearch?.status === 'completed'
  && route.evidenceSearchId === providerAutopilotDueProcessed.evidenceSearchId
  && route.providerUsageId === providerAutopilotDueProcessed.providerUsageId
  && route.evidenceSearchRoute?.endsWith(`/evidence-searches/${providerAutopilotDueProcessed.evidenceSearchId}`)
  && route.providerUsageRoute?.includes(providerAutopilotDueProcessed.providerUsageId)
  && route.providerEvidenceMessageId === providerAutopilotDueProcessed.providerEvidenceMessageId
  && route.providerEvidenceTranscriptRoute?.includes(providerAutopilotDueProcessed.providerEvidenceMessageId)
)), 'Readiness Proof Map must expose provider evidence/search/usage/transcript routes from Autopilot due-worker tick receipts.');
assert(providerAutopilotDueTranscript.proofIds?.includes(providerAutopilotDueProcessed.providerEvidenceMessageId)
  && providerAutopilotDueService.getMessages(projectId).some((message) => message.id === providerAutopilotDueProcessed.providerEvidenceMessageId && message.type === 'autopilot-provider-evidence'), 'Autopilot due-worker provider evidence must be visible in backend Group Chat transcript proof, not only in worker ledgers.');
const providerAgentPulse = await providerWorkerService.runAgentWorkCycleWithProviderEvidence({
  projectId,
  agentId: 'turing',
  now: '2026-05-28T14:07:45.000Z',
  trigger: 'service-agent-worker-provider-evidence',
  submitWorkArtifact: true,
  workArtifactType: 'evidence-packet',
  workArtifactReviewerAgentId: 'curie',
  useProviderEvidenceSearch: true,
  requireProviderEvidenceSearch: true,
  evidenceSearchQuery: 'generic product team provider evidence',
  evidenceSearchPurpose: 'Prove autonomous Agent workers can use configured provider search before submitting evidence packets.',
  maxResults: 2,
});
assert(providerAgentPulse.evidenceSearch?.provider === 'deterministic'
  && providerAgentPulse.evidenceSearch.searchMode === 'deterministic-provider'
  && providerAgentPulse.evidenceSearch.providerReceiptId
  && providerAgentPulse.providerUsage?.operation === 'search:evidence', 'Provider-backed Agent worker cycles must route through configured search providers and persist evidence-search/provider-usage receipts.');
assert(providerAgentPulse.workSubmission?.sourceRefs?.some((ref) => ref.type === 'evidence-search' && ref.id === providerAgentPulse.evidenceSearch?.id)
  && providerAgentPulse.project.agentWorkerLedger?.[0]?.evidenceSearchProvider === 'deterministic'
  && providerAgentPulse.project.providerUsageLedger?.some((row) => row.providerReceiptId === providerAgentPulse.evidenceSearch?.providerReceiptId), 'Provider-backed Agent worker submissions must link their evidence-search node, worker ledger, and provider usage ledger.');
const providerApi = createFileBackedAgentProjectApi({
  filePath: new URL('../.tmp/provider-agent-work-cycle-api-store.json', import.meta.url),
  projects: [cloneJson(providerSeedProject)],
  messages: cloneJson(projectService.getMessages(projectId)),
  replaceWithSeed: true,
  searchProvider: createSearchProvider({ provider: 'deterministic', enabled: true, maxResults: 2 }),
  providerPolicy: providerEvidencePolicy,
});
const providerApiResponse = await providerApi.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/work-cycle`,
  body: {
    now: '2026-05-28T14:07:50.000Z',
    trigger: 'api-agent-worker-provider-evidence',
    submitWorkArtifact: true,
    workArtifactType: 'evidence-packet',
    workArtifactReviewerAgentId: 'curie',
    useProviderEvidenceSearch: true,
    requireProviderEvidenceSearch: true,
    evidenceSearchQuery: 'api generic product team provider evidence',
    evidenceSearchPurpose: 'Prove API async Agent worker cycles can call configured provider search.',
    maxResults: 2,
    includeReadModels: false,
  },
});
assert(providerApiResponse.status === 200
  && providerApiResponse.body.evidenceSearch?.provider === 'deterministic'
  && providerApiResponse.body.providerEvidenceSearch?.status === 'completed'
  && providerApiResponse.body.providerUsage?.providerReceiptId === providerApiResponse.body.evidenceSearch?.providerReceiptId
  && providerApiResponse.body.readModels?.included === false, 'Agent work-cycle API must expose async provider-backed evidence receipts with lightweight read-model refresh routes.');
const providerQueueApi = createFileBackedAgentProjectApi({
  filePath: new URL('../.tmp/provider-agent-action-queue-api-store.json', import.meta.url),
  projects: [cloneJson(providerSeedProject)],
  messages: cloneJson(projectService.getMessages(projectId)),
  replaceWithSeed: true,
  searchProvider: createSearchProvider({ provider: 'deterministic', enabled: true, maxResults: 2 }),
  providerPolicy: providerEvidencePolicy,
});
const providerQueueApiResponse = await providerQueueApi.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agent-autonomous-action-queue/turing/run`,
  body: {
    now: '2026-05-28T14:07:55.000Z',
    force: true,
    includeReadModels: false,
  },
});
assert(providerQueueApiResponse.status === 200
  && providerQueueApiResponse.body.route === 'agent-autonomous-action-queue-item-run'
  && providerQueueApiResponse.body.providerEvidenceSearch?.status === 'completed'
  && providerQueueApiResponse.body.evidenceSearch?.provider === 'deterministic'
  && providerQueueApiResponse.body.agentAutonomousActionRun?.providerUsageId === providerQueueApiResponse.body.providerUsage?.id
  && providerQueueApiResponse.body.readModels?.included === false, 'Agent autonomous action queue API must run provider-planned evidence rows through the async provider-backed worker path.');
const providerAutopilotApi = createFileBackedAgentProjectApi({
  filePath: new URL('../.tmp/provider-autopilot-session-api-store.json', import.meta.url),
  projects: [cloneJson(providerSeedProject)],
  messages: cloneJson(projectService.getMessages(projectId)),
  replaceWithSeed: true,
  searchProvider: createSearchProvider({ provider: 'deterministic', enabled: true, maxResults: 2 }),
  providerPolicy: providerEvidencePolicy,
});
const providerAutopilotApiStart = providerAutopilotApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/autonomous-run-control/sessions/start`,
  body: {
    sessionId: 'api_provider_evidence_autopilot_session',
    now: '2026-05-28T14:07:56.000Z',
    forceNewSession: true,
    maxLoops: 2,
    maxStepsPerLoop: 1,
    maxTotalSteps: 2,
    requestBodyOverrides: {
      includeReadModels: false,
      useProviderEvidenceSearch: true,
    },
    includeReadModels: false,
  },
});
assert(providerAutopilotApiStart.status === 200 && providerAutopilotApiStart.body.autonomousRunControlSession?.id === 'api_provider_evidence_autopilot_session', 'Autopilot provider API test must start a bounded session before async provider tick.');
const providerAutopilotApiTick = await providerAutopilotApi.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/autonomous-run-control/sessions/api_provider_evidence_autopilot_session/tick`,
  body: {
    now: '2026-05-28T14:07:57.000Z',
    useProviderEvidenceSearch: true,
    requestBodyOverrides: {
      includeReadModels: false,
      useProviderEvidenceSearch: true,
      autopilotTargetControl: providerEvidenceTargetControl,
    },
    includeReadModels: false,
  },
});
assert(providerAutopilotApiTick.status === 200
  && providerAutopilotApiTick.body.route === 'autonomous-run-control-session-tick'
  && providerAutopilotApiTick.body.providerEvidenceSearch?.status === 'completed'
  && providerAutopilotApiTick.body.evidenceSearch?.provider === 'deterministic'
  && providerAutopilotApiTick.body.autonomousRunControlSessionTick?.providerUsageId === providerAutopilotApiTick.body.providerUsage?.id
  && providerAutopilotApiTick.body.readModels?.included === false, 'Autopilot session tick API must expose the async provider-backed evidence lane with lightweight read-model routes.');
const providerAutopilotDueApi = createFileBackedAgentProjectApi({
  filePath: new URL('../.tmp/provider-autopilot-due-api-store.json', import.meta.url),
  projects: [cloneJson(providerSeedProject)],
  messages: cloneJson(projectService.getMessages(projectId)),
  replaceWithSeed: true,
  searchProvider: createSearchProvider({ provider: 'deterministic', enabled: true, maxResults: 2 }),
  providerPolicy: providerEvidencePolicy,
});
const providerAutopilotDueApiStart = providerAutopilotDueApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/autonomous-run-control/sessions/start`,
  body: {
    sessionId: 'api_provider_evidence_autopilot_due_session',
    now: '2026-05-28T14:07:58.000Z',
    forceNewSession: true,
    maxLoops: 2,
    maxStepsPerLoop: 1,
    maxTotalSteps: 2,
    requestBodyOverrides: {
      includeReadModels: false,
      useProviderEvidenceSearch: true,
    },
    includeReadModels: false,
  },
});
assert(providerAutopilotDueApiStart.status === 200 && providerAutopilotDueApiStart.body.autonomousRunControlSession?.id === 'api_provider_evidence_autopilot_due_session', 'Autopilot provider due-worker API test must start a bounded session before async due-worker tick.');
const providerAutopilotDueApiResponse = await providerAutopilotDueApi.handleAsync({
  method: 'POST',
  path: '/workers/autopilot/due',
  body: {
    now: '2026-05-28T14:07:59.000Z',
    forceDue: true,
    forceProjectIds: [projectId],
    maxProjects: 1,
    maxSessionsPerProject: 1,
    loopCount: 1,
    providerEvidenceSearchEnabled: true,
    requestBodyOverrides: {
      includeReadModels: false,
      useProviderEvidenceSearch: true,
      autopilotTargetControl: providerEvidenceTargetControl,
    },
    includeReadModels: false,
  },
});
const providerAutopilotDueApiProcessed = providerAutopilotDueApiResponse.body.processed?.find((row) => row.sessionId === 'api_provider_evidence_autopilot_due_session');
assert(providerAutopilotDueApiResponse.status === 200
  && providerAutopilotDueApiResponse.body.providerEvidenceSearchEnabled === true
  && providerAutopilotDueApiProcessed?.providerEvidenceSearch?.status === 'completed'
  && providerAutopilotDueApiProcessed?.evidenceSearch?.provider === 'deterministic'
  && providerAutopilotDueApiProcessed?.autonomousRunControlSessionTick?.providerUsageId === providerAutopilotDueApiProcessed.providerUsage?.id
  && providerAutopilotDueApiProcessed?.readModels?.included === false
  && providerAutopilotDueApiProcessed?.readModels?.autopilotDueWorkerRoute === '/workers/autopilot/due', 'Autopilot due-worker API must expose async provider-backed evidence ticks with lightweight session/proof refresh routes.');
const dueAgentSchedule = evaluateAgentWorkSchedule({
  project: {
    ...secondAgentPulse.project,
    agentStates: {
      ...secondAgentPulse.project.agentStates,
      turing: {
        ...secondAgentPulse.project.agentStates.turing,
        nextAgentRunAt: '2026-05-28T14:08:00.000Z',
      },
    },
  },
  agentId: 'turing',
  now: '2026-05-28T14:09:00.000Z',
});
assert(dueAgentSchedule.due && dueAgentSchedule.reason === 'agent-cadence-due', 'Agent work scheduler must mark an Agent due when its next Agent run time has passed.');
const forcedAgentSchedule = evaluateAgentWorkSchedule({
  project: {
    ...secondAgentPulse.project,
    agentStates: {
      ...secondAgentPulse.project.agentStates,
      turing: {
        ...secondAgentPulse.project.agentStates.turing,
        nextAgentRunAt: '2026-05-28T15:30:00.000Z',
      },
    },
  },
  agentId: 'turing',
  now: '2026-05-28T14:09:30.000Z',
  forceDue: true,
  forceReason: 'scheduler-start-agent-sweep',
});
assert(forcedAgentSchedule.due && forcedAgentSchedule.reason === 'scheduler-start-agent-sweep' && forcedAgentSchedule.dueAt === '2026-05-28T14:09:30.000Z', 'Agent work scheduler must support startup sweeps that wake Agents before their normal cadence.');
const waitingAgentSchedule = evaluateAgentWorkSchedule({
  project: secondAgentPulse.project,
  agentId: 'curie',
  now: '2026-05-28T14:09:00.000Z',
  intervalMs: 30 * 60 * 1000,
});
assert(['agent-cadence-due', 'agent-cadence-waiting'].includes(waitingAgentSchedule.reason), 'Agent work scheduler must return a stable due/waiting reason for project Agents.');
const serviceDueAgentProject = {
  ...projectService.getProject(projectId),
  agentStates: {
    ...projectService.getProject(projectId).agentStates,
    turing: {
      ...projectService.getProject(projectId).agentStates.turing,
      nextAgentRunAt: '2026-05-28T14:08:00.000Z',
    },
    curie: {
      ...projectService.getProject(projectId).agentStates.curie,
      nextAgentRunAt: '2026-05-28T14:40:00.000Z',
    },
  },
};
projectService.replaceProject(serviceDueAgentProject);
const serviceDueAgentCycle = projectService.runDueAgentWorkCycles({
  now: '2026-05-28T14:09:00.000Z',
  trigger: 'service-agent-due-worker',
});
assert(serviceDueAgentCycle.processed.some((item) => item.agentId === 'turing'), 'Service due-Agent worker must process due Agents.');
assert(serviceDueAgentCycle.skipped.some((item) => item.agentId === 'curie' && item.reason === 'agent-cadence-waiting'), 'Service due-Agent worker must skip Agents whose next Agent run is in the future.');
assert(serviceDueAgentCycle.messages.some((message) => message.agentWorker?.trigger === 'service-agent-due-worker'), 'Service due-Agent worker must publish per-Agent worker chat messages.');
assert(serviceDueAgentCycle.agentAutonomousActionQueues?.some((queue) => queue.projectId === projectId && queue.schemaVersion === 'agent-autonomous-action-queue/v1' && queue.rows.some((row) => row.requestBodyTemplate?.useAutonomousStrategy)), 'Service due-Agent worker must return the post-run Agent autonomous action queue for C-side schedulers.');
assert(projectService.getProject(projectId).agentWorkerLedger?.[0]?.trigger === 'service-agent-due-worker', 'Service due-Agent worker must persist the Agent worker ledger.');
const forcedDueAgentCycle = projectService.runDueAgentWorkCycles({
  now: '2026-05-28T14:12:00.000Z',
  trigger: 'service-agent-startup-sweep',
  forceDue: true,
  forceReason: 'scheduler-start-agent-sweep',
});
assert(forcedDueAgentCycle.processed.length >= confirmedTeam.length && forcedDueAgentCycle.processed.every((item) => item.reason === 'scheduler-start-agent-sweep'), 'Service due-Agent worker startup sweep must wake every Agent even before their normal cadence.');
assert(projectService.getProject(projectId).agentWorkerLedger?.some((record) => record.trigger === 'service-agent-startup-sweep'), 'Service due-Agent worker startup sweep must persist Agent worker ledger evidence.');
const managementPriorityProject = {
  ...projectService.getProject(projectId),
  team: projectService.getProject(projectId).team.filter((agent) => ['turing', 'jobs'].includes(agent.id)),
  tasks: [
    {
      id: 'managed_priority_task',
      text: 'Resolve manager-prioritized backend evidence',
      assignee: 'Alan Turing',
      ownerId: 'turing',
      status: 'in-progress',
    },
    {
      id: 'unmanaged_priority_task',
      text: 'Prepare lower-priority product polish note',
      assignee: 'Steve Jobs',
      ownerId: 'jobs',
      status: 'in-progress',
    },
    ...projectService.getProject(projectId).tasks,
  ],
  agentStates: {
    ...projectService.getProject(projectId).agentStates,
    turing: {
      ...projectService.getProject(projectId).agentStates.turing,
      managerId: 'musk',
      peerManagerIds: ['curie'],
      nextAgentRunAt: '2026-05-28T14:10:00.000Z',
      inbox: [
        {
          id: 'managed_priority_inbox',
          source: 'management-check-in',
          from: 'musk',
          text: 'Management check-in: publish the backend evidence first.',
          receivedAt: '2026-05-28T14:09:30.000Z',
        },
        ...(projectService.getProject(projectId).agentStates.turing.inbox || []),
      ],
      obligations: [
        {
          id: 'managed_priority_obligation',
          taskId: 'managed_priority_task',
          text: 'Resolve manager-prioritized backend evidence',
          status: 'open',
        },
        ...(projectService.getProject(projectId).agentStates.turing.obligations || []),
      ],
    },
    jobs: {
      ...projectService.getProject(projectId).agentStates.jobs,
      managerId: null,
      managedIds: [],
      peerManagedIds: [],
      peerManagerIds: [],
      inbox: [],
      obligations: [],
      nextAgentRunAt: '2026-05-28T14:10:00.000Z',
    },
  },
};
const priorityDueAgentCycle = runDueAgentWorkCycles({
  projects: [managementPriorityProject],
  now: '2026-05-28T14:11:00.000Z',
  trigger: 'management-priority-agent-due-worker',
  maxAgentsPerProject: 1,
});
assert(priorityDueAgentCycle.processed.length === 1 && priorityDueAgentCycle.processed[0].agentId === 'turing', 'Due-Agent worker must prioritize managed Agents with management signals before lower-priority due Agents.');
assert(priorityDueAgentCycle.processed[0].managementPriority > 0, 'Due-Agent worker must expose management priority for processed Agents.');
assert(priorityDueAgentCycle.processed[0].managementReasons.some((reason) => /managed by|management inbox|open owned task|open obligation/i.test(reason)), 'Due-Agent worker must expose management priority reasons.');
assert(priorityDueAgentCycle.skipped.some((item) => item.agentId === 'jobs' && item.reason === 'agent-max-per-project-limit'), 'Due-Agent worker must skip lower-priority due Agents when the per-project limit is reached.');
assert(priorityDueAgentCycle.messages.some((message) => /Management priority:/i.test(message.text)), 'Priority-driven Agent worker messages must explain the management reason in group chat.');
assert(priorityDueAgentCycle.projects[0].agentWorkerLedger?.[0]?.managementPriority === priorityDueAgentCycle.processed[0].managementPriority, 'Priority-driven Agent worker cycles must persist management priority in the worker ledger.');
assert(priorityDueAgentCycle.agentAutonomousActionQueues?.[0]?.rows?.some((row) => row.agentId === 'turing' && row.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1'), 'Priority-driven Agent worker cycles must expose the next strategy queue after the scheduler run.');
const serviceReadiness = projectService.evaluateReadiness(projectId);
assert(serviceReadiness.status === 'manager-ready', `Project service readiness must remain manager-ready after backend-style dispatches: ${serviceReadiness.checks.filter((check) => !check.passed).map((check) => check.id).join(', ')}`);
const serviceReadinessProofMap = projectService.getReadinessProofMap(projectId);
assert(serviceReadinessProofMap.status === 'manager-ready' && serviceReadinessProofMap.routes.length === serviceReadinessProofMap.totalCount, 'Project service readiness proof map must cover every readiness check.');
assert(serviceReadinessProofMap.routes.every((route) => route.passed && route.proofKind && route.apiPath), 'Every service readiness proof route must carry a typed backend path for manager-ready projects.');
assert(serviceReadinessProofMap.routes.some((route) => route.checkId === 'role-clarification' && route.proofKind === 'transcript' && route.apiPath.endsWith('/transcripts/main') && route.proofIds.length > 0), 'Readiness proof map must route kickoff role clarification to main transcript proof ids.');
assert(serviceReadinessProofMap.routes.some((route) => route.checkId === 'leader-assignments-acknowledged' && route.proofKind === 'task-evidence' && route.taskIds.length > 0 && route.timelineLogIds.length > 0), 'Readiness proof map must route Leader assignments to task evidence and timeline logs.');
assert(serviceReadinessProofMap.routes.some((route) => route.checkId === 'management-loop-running' && route.proofKind === 'timeline' && route.timelineLogIds.length > 0), 'Readiness proof map must route management-loop checks to timeline proof.');
assert(serviceReadinessProofMap.routes.some((route) => route.checkId === 'google-chat-change-source' && route.proofKind === 'change-ledger' && route.channelId === 'google_chat' && route.proofIds.includes('svc_google_source')), 'Readiness proof map must route Google Chat change checks to Google Chat source proof.');
assert(serviceReadinessProofMap.routes.some((route) => route.checkId === 'dual-channel-change-source' && route.proofKind === 'change-ledger' && route.proofIds.some((id) => /^svc_dual_change_/.test(id))), 'Readiness proof map must route dual-channel change checks to both source proofs.');
assert(serviceReadinessProofMap.routes.some((route) => route.checkId === 'event-ledger-replay-ready' && route.proofKind === 'event-ledger' && route.eventIds.length > 0), 'Readiness proof map must route event-ledger replay checks to ledger event ids.');
assert(serviceReadinessProofMap.agentAutonomousActionRoutes?.some((route) => route.proofKind === 'agent-autonomous-action-queue' && route.apiPath.endsWith('/agent-autonomous-action-queue') && route.agentIds.length >= confirmedTeam.length && route.nextSelectedAction), 'Readiness proof map must expose the Agent autonomous action queue as a backend proof route.');
assert(serviceReadinessProofMap.managerUseCaseAuditRoutes?.some((route) => route.proofKind === 'manager-use-case-audit' && route.apiPath?.endsWith('/manager-use-case-audit') && route.managerActionQueueRoute?.endsWith('/manager-action-queue') && route.readyForLocalManagerUseCaseAudit === true && route.productionBlocker === true && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness proof map must expose Manager Use Case Audit as a routed C-side proof surface without production overclaim.');
const serviceManagerDashboard = projectService.getManagerDashboard(projectId);
assert(serviceManagerDashboard.readiness.status === 'manager-ready' && serviceManagerDashboard.readinessProofMap.routes.length === serviceManagerDashboard.readiness.totalCount, 'Project service manager dashboard must embed readiness and proof-map coverage.');
assert(serviceManagerDashboard.agentAutonomousActionQueue?.schemaVersion === 'agent-autonomous-action-queue/v1' && serviceManagerDashboard.agentAutonomousActionQueue.rows.length >= confirmedTeam.length && serviceManagerDashboard.agentAutonomousActionQueue.rows.every((row) => row.requestBodyTemplate?.useAutonomousStrategy && row.runApiPath?.includes('/agent-autonomous-action-queue/')), 'Project service manager dashboard must embed a runnable Agent autonomous action queue.');
assert(serviceManagerDashboard.kickoffMeetingFlow.conversationRows.some((row) => row.stage === 'role-clarification') && serviceManagerDashboard.kickoffMeetingFlow.conversationRows.some((row) => row.stage === 'leader-campaign'), 'Project service manager dashboard must expose kickoff conversation rows for role clarification and Leader campaigns.');
assert(serviceManagerDashboard.kickoffExecutionFlow.nextActions.length > 0 && serviceManagerDashboard.kickoffExecutionFlow.assignmentRows.length > 0 && serviceManagerDashboard.kickoffExecutionFlow.readyForAutonomy, 'Project service manager dashboard must expose kickoff execution flow from next actions to autonomous readiness.');
assert(serviceManagerDashboard.transcriptIndex.channels.some((channel) => channel.channelId === 'main' && channel.totalProofCount > 0), 'Project service manager dashboard must embed transcript index proof.');
assert(serviceManagerDashboard.operationsBoard.agents.some((agent) => agent.agentId === 'turing' && typeof agent.managementPriority === 'number' && agent.latestWorklog), 'Project service manager dashboard must expose per-Agent operations rows with management priority and worklog evidence.');
assert(serviceManagerDashboard.agents.managementMesh.some((row) => row.agentId === 'turing' && row.checkInCount > 0), 'Project service manager dashboard must expose Agent management mesh proof.');
assert(serviceManagerDashboard.agents.peerManagementMatrix?.length === serviceManagerDashboard.agents.count && serviceManagerDashboard.agents.peerManagementMatrix.every((row) => row.peerManagedIds?.length > 0 && row.peerManagerIds?.length > 0), 'Project service manager dashboard must expose a complete peer-management matrix.');
assert(serviceManagerDashboard.kickoffExecutionFlow?.allAgentStartupRows?.length === serviceManagerDashboard.agents.count && serviceManagerDashboard.kickoffExecutionFlow.allAgentStartupRows.every((row) => row.started && row.scheduled && row.hasRoutinePlan && row.hasFirstPulsePlan && row.startupProofTypes?.includes('routine-plan') && row.startupProofTypes?.includes('first-pulse-plan')), 'Project service manager dashboard must prove every confirmed Agent has a routine plan, first-pulse startup evidence, and next-run schedule.');
assert(serviceManagerDashboard.assignmentFlow.rows.some((row) => row.taskId === serviceAgentTaskId && row.inboxSeen && row.timelineSeen), 'Project service manager dashboard must expose Leader assignment flow from inbox to timeline.');
assert(serviceManagerDashboard.changeFlow.rows.some((row) => row.sourceChannelId === 'google_chat' && row.requestMessageId === 'svc_google_source' && row.ownerPlanLinked && row.teamSyncCount > 0 && row.discussionDeliveryCount > 0 && row.discussionObligationCount > 0), 'Project service manager dashboard must expose Google Chat change flow from source message to discussion receipts, owner plan, and team sync.');
assert(serviceManagerDashboard.managerScenarioTrail.rows.some((row) => row.id === 'dual-channel-change' && row.passed) && serviceManagerDashboard.managerScenarioTrail.rows.some((row) => row.id === 'owner-plan-sync' && row.passed), 'Project service manager dashboard must expose a passing end-to-end manager scenario trail.');
assert(serviceManagerDashboard.syncProtocolAudit?.rows?.some((row) => row.id === 'leader-assignment-sync' && row.complete) && serviceManagerDashboard.syncProtocolAudit.rows.some((row) => row.id === 'change-request-sync' && row.complete) && serviceManagerDashboard.syncProtocolAudit.syncedCount > 0, 'Project service manager dashboard must expose a sync protocol audit with completed assignment and change sync rows.');
assert(serviceManagerDashboard.managerCommandCenter?.nextBestAction?.canRun && serviceManagerDashboard.managerCommandCenter.liveLanes?.some((lane) => lane.id === 'workers' && lane.status === 'active') && serviceManagerDashboard.managerCommandCenter.liveLanes?.some((lane) => lane.id === 'google-chat' && lane.proofCount > 0) && serviceManagerDashboard.managerCommandCenter.agentRows?.length === serviceManagerDashboard.agents.count, 'Project service manager dashboard must expose a live command center with next action, live lanes, and Agent readiness rows.');
assert(serviceManagerDashboard.managerCommandCenter.attentionRows?.some((row) => row.type === 'next-action') && typeof serviceManagerDashboard.managerCommandCenter.stats?.syncProtocols === 'string', 'Project service manager command center must surface an actionable attention queue and manager-readable stats.');
assert(serviceManagerDashboard.managerCommandCenter.kickoffBoard?.rows?.some((row) => row.id === 'leader-marker' && row.passed) && serviceManagerDashboard.managerCommandCenter.kickoffBoard?.rows?.some((row) => row.id === 'next-actions' && row.passed) && serviceManagerDashboard.managerCommandCenter.kickoffBoard.readyCount === serviceManagerDashboard.managerCommandCenter.kickoffBoard.count, 'Project service manager command center must expose a complete kickoff decision board with Leader marker and next-action confirmation.');
assert(serviceManagerDashboard.managerCommandCenter.workLoopBoard?.rows?.length === serviceManagerDashboard.agents.count && serviceManagerDashboard.managerCommandCenter.workLoopBoard.rows.some((row) => row.status === 'running' && row.scheduled && row.routineReady && row.proofReady && row.timelineLogIds?.length > 0) && serviceManagerDashboard.managerCommandCenter.workLoopBoard.scheduledCount > 0 && serviceManagerDashboard.managerCommandCenter.workLoopBoard.proofedCount > 0, 'Project service manager command center must expose a 24/7 work loop board with scheduled routines and timeline proof.');
assert(serviceManagerDashboard.managerCommandCenter.collaborationBoard?.rows?.some((row) => row.id === 'leader-assignments' && row.passed && row.proofIds?.length > 0 && row.timelineLogIds?.length > 0) && serviceManagerDashboard.managerCommandCenter.collaborationBoard.rows.some((row) => row.id === 'agent-messages' && row.passed && row.proofIds?.length > 0) && serviceManagerDashboard.managerCommandCenter.collaborationBoard.rows.some((row) => row.id === 'mutual-management' && row.passed && row.timelineLogIds?.length > 0), 'Project service manager command center must expose a collaboration board for Leader @assignments, Agent message delivery, and mutual management proof.');
assert(serviceManagerDashboard.managerCommandCenter.changeProtocolBoard?.rows?.some((row) => row.id === 'dual-channel-source' && row.passed && row.proofIds?.length > 0) && serviceManagerDashboard.managerCommandCenter.changeProtocolBoard.rows.some((row) => row.id === 'owner-plan' && row.passed) && serviceManagerDashboard.managerCommandCenter.changeProtocolBoard.rows.some((row) => row.id === 'team-resync' && row.passed) && serviceManagerDashboard.managerCommandCenter.changeProtocolBoard.rows.some((row) => row.id === 'owner-work' && row.passed && row.timelineLogIds?.length > 0), 'Project service manager command center must expose a change protocol board for dual-channel source, owner plan, team resync, and owner work proof.');
assert(serviceManagerDashboard.managerCommandCenter.agentRows.some((row) => row.receiptState === 'received-and-working' && row.receivedLatestSignal && row.obligatedLatestSignal && row.workingLatestSignal && row.inboxProofIds?.length > 0 && row.workProofIds?.length > 0), 'Project service manager command center must expose per-Agent @signal receipt, obligation, and work-start proof.');
assert(serviceManagerDashboard.managerCommandCenter.changeRows?.some((row) => row.ownerConfirmed && row.ownerPlanLinked && row.teamSynced && row.ownerWorkStarted && row.proofIds?.length > 0 && row.timelineLogIds?.length > 0) && serviceManagerDashboard.managerCommandCenter.changeReadyCount > 0, 'Project service manager command center must expose change owner confirmation, plan sync, team resync, and owner work proof.');
assert(serviceManagerDashboard.managerScenarioWalkthrough.rows.some((row) => row.id === 'leader-group-assignment' && row.completed && row.primaryAction?.requirementId === 'leader-group-assignment' && row.primaryAction?.canRun) && serviceManagerDashboard.managerScenarioWalkthrough.rows.some((row) => row.id === 'mutual-agent-management' && row.primaryAction?.runApiPath?.endsWith('/agents-mutually-manage/run')), 'Project service manager dashboard must expose a guided scenario walkthrough with runnable primary actions for Leader assignment and mutual management.');
assert(serviceManagerDashboard.managerRequirementMatrix.rows.some((row) => row.id === 'leader-election-marker' && row.passed) && serviceManagerDashboard.managerRequirementMatrix.rows.some((row) => row.id === 'owner-plan-and-team-sync' && row.passed), 'Project service manager dashboard must expose a passing requirement matrix for leader election and owner sync requirements.');
assert(serviceManagerDashboard.managerUseCaseAudit.status === 'covered' && serviceManagerDashboard.managerUseCaseAudit.rows.some((row) => row.id === 'kickoff-meeting-understanding' && row.covered) && serviceManagerDashboard.managerUseCaseAudit.rows.some((row) => row.id === 'owner-plan-team-sync' && row.covered), 'Project service manager dashboard must expose a covered manager use case audit grouped by the requested story stages.');
assert(serviceManagerDashboard.managerUseCaseAudit.rows.some((row) => row.id === 'group-chat-assignment-start' && row.actions?.some((action) => action.requirementId === 'leader-group-assignment' && action.runApiPath?.endsWith('/leader-group-assignment/run')) && row.runnableActionCount > 0 && row.nextAction?.canRun), 'Project service manager use case audit must link grouped story stages to runnable Action Queue next actions.');
const serviceManagerScenarioTrail = projectService.getManagerScenarioTrail(projectId);
assert(serviceManagerScenarioTrail.count === serviceManagerDashboard.managerScenarioTrail.count && serviceManagerScenarioTrail.rows.some((row) => row.id === 'next-actions-to-autonomy' && row.passed), 'Project service must expose the manager scenario trail as a standalone read model.');
const serviceManagerCommandCenter = projectService.getManagerCommandCenter(projectId);
assert(serviceManagerCommandCenter.nextBestAction?.runApiPath && serviceManagerCommandCenter.liveLanes.length >= 5 && serviceManagerCommandCenter.agentRows.length === serviceManagerDashboard.agents.count && serviceManagerCommandCenter.attentionCount === serviceManagerCommandCenter.attentionRows.length, 'Project service must expose the manager command center as a standalone read model.');
const serviceManagerScenarioWalkthrough = projectService.getManagerScenarioWalkthrough(projectId);
assert(serviceManagerScenarioWalkthrough.count === serviceManagerDashboard.managerScenarioWalkthrough.count && serviceManagerScenarioWalkthrough.status === 'covered' && !serviceManagerScenarioWalkthrough.nextIncompleteStep && serviceManagerScenarioWalkthrough.nextRunnableStep?.primaryAction?.canRun && serviceManagerScenarioWalkthrough.rows.some((row) => row.id === 'midproject-change-intake' && row.primaryAction?.requirementId === 'midproject-dual-channel-change' && row.primaryAction?.canRun), 'Project service must expose the guided manager scenario walkthrough as a standalone read model with separate completion gaps and rerunnable step metadata.');
const serviceManagerRequirementMatrix = projectService.getManagerRequirementMatrix(projectId);
assert(serviceManagerRequirementMatrix.count === serviceManagerDashboard.managerRequirementMatrix.count && serviceManagerRequirementMatrix.rows.some((row) => row.id === 'progress-to-timeline' && row.passed), 'Project service must expose the manager requirement matrix as a standalone read model.');
const serviceManagerUseCaseAudit = projectService.getManagerUseCaseAudit(projectId);
assert(serviceManagerUseCaseAudit.count === serviceManagerDashboard.managerUseCaseAudit.count && serviceManagerUseCaseAudit.rows.some((row) => row.id === 'group-chat-assignment-start' && row.covered && row.requirementIds.includes('assignee-receives-and-starts')), 'Project service must expose the manager use case audit as a standalone read model.');
assert(serviceManagerUseCaseAudit.rows.some((row) => row.id === 'mutual-agent-management' && row.nextAction?.requirementId === 'agents-mutually-manage' && row.nextAction?.runApiPath?.endsWith('/agents-mutually-manage/run') && row.runnableActionCount === 1), 'Standalone manager use case audit must expose the next runnable Action Queue item for mutual management.');
const serviceManagerActionQueue = projectService.getManagerActionQueue(projectId);
assert(serviceManagerActionQueue.count === serviceManagerDashboard.managerActionQueue.count && serviceManagerActionQueue.rows.some((row) => row.requirementId === 'leader-group-assignment' && row.method === 'POST' && row.apiPath.endsWith('/chat') && row.runApiPath?.endsWith('/leader-group-assignment/run') && row.routeResolved) && serviceManagerActionQueue.rows.every((row) => ['complete', 'ready', 'blocked'].includes(row.status)), 'Project service must expose the manager action queue as a standalone read model with executable route metadata.');
assert(serviceManagerActionQueue.rows.some((row) => row.requirementId === 'midproject-dual-channel-change' && row.requestBodyTemplate?.channelIds?.includes('google_chat') && row.requestBodyTemplate?.sourceModes?.includes('war_room_meeting') && row.requestBodyTemplate?.sourceModes?.includes('google_chat')) && serviceManagerActionQueue.rows.some((row) => row.requirementId === 'fixed-continuous-routines' && row.apiPath === '/workers/autonomous/tick' && row.requestBodyTemplate?.trigger === 'manager-action-playbook-24-7-pulse' && row.requestBodyTemplate?.forceAgentRun === true && row.requestBodyTemplate?.submitAgentWorkArtifacts === true), 'Project service manager action queue must expose request body templates for dual-channel change and scheduler-backed 24/7 pulse actions.');
assert(serviceManagerActionQueue.rows.some((row) => row.requirementId === 'assignee-receives-and-starts' && row.apiPath.includes('/agents/') && row.apiPath.endsWith('/work-cycle') && !row.apiPath.includes(':agentId') && row.routeResolved && row.context?.defaultAgentId) && serviceManagerActionQueue.rows.some((row) => row.requirementId === 'agents-mutually-manage' && row.apiPath.includes('/agents/') && row.apiPath.endsWith('/work-cycle') && !row.apiPath.includes(':agentId') && row.routeResolved), 'Project service manager action queue must resolve Agent work-cycle actions to directly executable Agent routes.');
assert(serviceManagerActionQueue.rows.some((row) => row.requirementId === 'fixed-continuous-routines' && row.status === 'complete' && row.rerunnable && row.canRun) && serviceManagerActionQueue.rows.some((row) => row.requirementId === 'agents-mutually-manage' && row.status === 'complete' && row.rerunnable && row.canRun) && serviceManagerActionQueue.rows.some((row) => row.requirementId === 'confirmed-team' && row.status === 'complete' && !row.rerunnable && !row.canRun), 'Project service manager action queue must keep completed operational actions rerunnable while completed approval actions stay locked.');
const serviceAgentAutonomousActionQueue = projectService.getAgentAutonomousActionQueue(projectId);
assert(serviceAgentAutonomousActionQueue.schemaVersion === 'agent-autonomous-action-queue/v1' && serviceAgentAutonomousActionQueue.count >= confirmedTeam.length && serviceAgentAutonomousActionQueue.backendRoutes.agentAutonomousActionRunTemplate.endsWith('/agent-autonomous-action-queue/:agentId/run'), 'Project service must expose the Agent autonomous action queue as a standalone read model with run route metadata.');
assert(serviceAgentAutonomousActionQueue.rows.every((row) => row.schemaVersion === 'agent-autonomous-action-queue-row/v1' && row.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1' && row.requestBodyTemplate?.useAutonomousStrategy && row.agentWorkCycleApiPath?.endsWith('/work-cycle')), 'Every Agent autonomous action queue row must carry a strategy decision, reusable body template, and delegated work-cycle route.');
assert(serviceAgentAutonomousActionQueue.rows.some((row) => ['respond-to-review-obligation', 'review-pending-submission', 'complete-and-submit-owned-work', 'answer-management-signal', 'continue-owned-work', 'monitor-project'].includes(row.selectedAction)) && serviceAgentAutonomousActionQueue.nextAction?.runApiPath?.includes('/agent-autonomous-action-queue/'), 'Agent autonomous action queue must expose the next strategy-selected Agent action.');
const serviceAgentAutonomousFlowGraph = projectService.getManagerFlowGraph(projectId);
assert(serviceAgentAutonomousFlowGraph.nodes.some((node) => node.source === 'agentAutonomousActionQueue' && node.route?.includes('/agent-autonomous-action-queue/') && node.attachments?.some((attachment) => attachment.type === 'agent-autonomous-action')), 'Manager Flow Graph must render Agent autonomous action queue rows as auditable submission nodes.');
const serviceRunManagerWalkthrough = projectService.runManagerScenarioWalkthroughStep({
  projectId,
  stepId: 'leader-group-assignment',
  now: '2026-05-28T15:52:30.000Z',
});
assert(serviceRunManagerWalkthrough.route === 'manager-scenario-walkthrough-step-run' && serviceRunManagerWalkthrough.managerScenarioWalkthroughStep?.id === 'leader-group-assignment' && serviceRunManagerWalkthrough.managerScenarioWalkthroughStep?.delegatedActionId === 'leader-group-assignment' && serviceRunManagerWalkthrough.managerScenarioWalkthroughStep?.resultInspection?.timelineLogIds?.length > 0 && serviceRunManagerWalkthrough.resultInspection?.messageCount > 0 && serviceRunManagerWalkthrough.managerActionRun?.requirementId === 'leader-group-assignment' && serviceRunManagerWalkthrough.managerActionRun?.resultMessageIds?.length > 0 && serviceRunManagerWalkthrough.managerActionRun?.timelineLogIds?.length > 0 && serviceRunManagerWalkthrough.managerScenarioWalkthrough?.rows?.some((row) => row.id === 'leader-group-assignment'), 'Project service must execute a guided manager walkthrough step by delegating to the Action Queue run logic and returning walkthrough result inspection metadata.');
const serviceRunManagerAction = projectService.runManagerActionQueueItem({
  projectId,
  actionId: 'assignee-receives-and-starts',
  now: '2026-05-28T15:53:00.000Z',
});
assert(serviceRunManagerAction.route === 'manager-action-queue-item-run' && serviceRunManagerAction.managerAction?.requirementId === 'assignee-receives-and-starts' && serviceRunManagerAction.managerActionRun?.requirementId === 'assignee-receives-and-starts' && serviceRunManagerAction.managerActionLog?.eventType === 'manager-action-run' && serviceRunManagerAction.project.eventLedger?.some((event) => event.type === 'manager-action-run' && event.entityIds?.requirementId === 'assignee-receives-and-starts') && serviceRunManagerAction.cycle?.trigger === 'manager-action-playbook-assignee-start' && serviceRunManagerAction.managerActionQueue?.rows?.length === serviceManagerActionQueue.rows.length, 'Project service must execute manager action queue items server-side and write an auditable manager-action-run receipt.');
const serviceExecutableAgentAutonomousAction = serviceAgentAutonomousActionQueue.rows.find((row) => row.canRun) || serviceAgentAutonomousActionQueue.rows[0];
const serviceRunAgentAutonomousAction = projectService.runAgentAutonomousActionQueueItem({
  projectId,
  agentId: serviceExecutableAgentAutonomousAction.agentId,
  now: '2026-05-28T15:53:30.000Z',
  force: true,
  requestBodyOverrides: { includeReadModels: false },
});
assert(serviceRunAgentAutonomousAction.route === 'agent-autonomous-action-queue-item-run' && serviceRunAgentAutonomousAction.agentAutonomousAction?.agentId === serviceExecutableAgentAutonomousAction.agentId && serviceRunAgentAutonomousAction.agentAutonomousActionRun?.schemaVersion === 'agent-autonomous-action-run/v1' && serviceRunAgentAutonomousAction.agentAutonomousActionRun?.strategyDecisionId && serviceRunAgentAutonomousAction.project.agentAutonomousActionRunLedger?.some((run) => run.id === serviceRunAgentAutonomousAction.agentAutonomousActionRun.id && run.timelineLogIds?.length && run.eventIds?.length) && serviceRunAgentAutonomousAction.project.eventLedger?.some((event) => event.type === 'agent-autonomous-action-run' && event.entityIds?.runId === serviceRunAgentAutonomousAction.agentAutonomousActionRun.id) && serviceRunAgentAutonomousAction.cycle?.trigger === 'agent-autonomous-action-queue-run' && serviceRunAgentAutonomousAction.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1' && serviceRunAgentAutonomousAction.agentAutonomousActionQueue?.rows?.length >= serviceAgentAutonomousActionQueue.rows.length, 'Project service must execute Agent autonomous action queue items through the backend and persist strategy/run proof.');
const serviceAutopilotSessionStart = projectService.startAutonomousRunControlSession({
  projectId,
  now: '2026-05-28T15:53:40.000Z',
  maxLoops: 4,
  maxStepsPerLoop: 2,
  maxTotalSteps: 8,
  requestBodyOverrides: {
    includeReadModels: false,
    forceDue: true,
    submitAgentWorkArtifacts: true,
    reviewPendingSubmissions: true,
    respondToReviewObligations: true,
  },
});
assert(serviceAutopilotSessionStart.route === 'autonomous-run-control-session-started' && serviceAutopilotSessionStart.autonomousRunControlSession?.schemaVersion === 'autonomous-run-control-session/v1' && serviceAutopilotSessionStart.autonomousRunControlSession.status === 'running' && serviceAutopilotSessionStart.autonomousRunControlSession.targetSnapshot?.schemaVersion === 'autopilot-delivery-target/v1' && Array.isArray(serviceAutopilotSessionStart.autonomousRunControlSession.targetMissingStageIds), 'Project service must start a proofed autonomous run-control session with a budget and Product Team delivery target snapshot.');
const serviceAutopilotSessionTick = projectService.tickAutonomousRunControlSession({
  projectId,
  sessionId: serviceAutopilotSessionStart.autonomousRunControlSession.id,
  now: '2026-05-28T15:53:50.000Z',
  requestBodyOverrides: {
    includeReadModels: false,
    forceDue: true,
    submitAgentWorkArtifacts: true,
    reviewPendingSubmissions: true,
    respondToReviewObligations: true,
  },
});
assert(serviceAutopilotSessionTick.route === 'autonomous-run-control-session-tick' && serviceAutopilotSessionTick.autonomousRunControlSessionTick?.schemaVersion === 'autonomous-run-control-session-tick/v1' && serviceAutopilotSessionTick.autonomousRunControlSessionTick.stepCount > 0 && serviceAutopilotSessionTick.autonomousRunControlSessionTick.loopReceiptIds?.length > 0 && serviceAutopilotSessionTick.autonomousRunControlSessionTick.runReceiptIds?.length > 0 && serviceAutopilotSessionTick.autonomousRunControlSessionTick.actionLanes?.length > 0 && serviceAutopilotSessionTick.autonomousRunControlSessionTick.targetSnapshot?.schemaVersion === 'autopilot-delivery-target/v1' && serviceAutopilotSessionTick.autonomousRunControlSessionTick.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1' && Array.isArray(serviceAutopilotSessionTick.autonomousRunControlSessionTick.targetMissingStageIds) && serviceAutopilotSessionTick.autonomousRunControlLoops?.some((loop) => loop.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1' && loop.actionLanes?.length > 0 && loop.targetSelections?.some((selection) => selection.schemaVersion === 'autonomous-run-control-target-selection/v1')) && serviceAutopilotSessionTick.autonomousRunControlRuns?.some((run) => run.actionLane && run.autopilotTargetSelection?.schemaVersion === 'autonomous-run-control-target-selection/v1'), 'Project service must tick an autonomous session through bounded loop/run receipts with lane, delivery-target ownership, and target-aware action selection proof.');
const serviceAutopilotRanAgentLane = serviceAutopilotSessionTick.autonomousRunControlRuns?.some((run) => run.actionLane === 'agent-autonomy');
const serviceAutopilotRanAgentInitiative = serviceAutopilotSessionTick.autonomousRunControlRuns?.some((run) => run.actionLane === 'agent-autonomy' && run.agentInitiative?.schemaVersion === 'agent-autonomous-initiative/v1' && run.agentInitiativeId && run.agentInitiativeArtifactType);
const serviceAutopilotLoopCapturedAgentInitiative = serviceAutopilotSessionTick.autonomousRunControlLoops?.some((loop) => loop.agentInitiativeIds?.length && loop.agentInitiativeArtifactTypes?.length);
assert(serviceAutopilotSessionTick.autonomousRunControlSessionTick.candidateAgentInitiativeIds?.length && serviceAutopilotSessionTick.autonomousRunControlSessionTick.candidateAgentInitiativeArtifactTypes?.length && (!serviceAutopilotRanAgentLane || (serviceAutopilotRanAgentInitiative && serviceAutopilotLoopCapturedAgentInitiative && serviceAutopilotSessionTick.autonomousRunControlSessionTick.agentInitiativeIds?.length && serviceAutopilotSessionTick.autonomousRunControlSessionTick.agentInitiativeArtifactTypes?.length)), 'Autopilot session ticks must freeze candidate Agent initiative proof, and Agent-lane runs/loops must freeze executed initiative proof.');
const serviceAutopilotTargetInjectedRun = (serviceAutopilotSessionTick.autonomousRunControlRuns || [])
  .find((run) => run.requestBody?.autopilotTargetControl?.schemaVersion === 'autopilot-delivery-target-control/v1');
assert(serviceAutopilotTargetInjectedRun
  && serviceAutopilotTargetInjectedRun.requestBody.autopilotTargetStageId === serviceAutopilotTargetInjectedRun.autopilotTargetControl?.targetStageId
  && serviceAutopilotTargetInjectedRun.requestBody.autopilotTargetSelection?.schemaVersion === 'autonomous-run-control-target-selection/v1'
  && (
    !serviceAutopilotTargetInjectedRun.autopilotTargetControl?.agentWorkArtifactType
    || serviceAutopilotTargetInjectedRun.requestBody.agentWorkArtifactType === serviceAutopilotTargetInjectedRun.autopilotTargetControl.agentWorkArtifactType
    || serviceAutopilotTargetInjectedRun.requestBody.workArtifactType === serviceAutopilotTargetInjectedRun.autopilotTargetControl.workArtifactType
  )
  && (
    serviceAutopilotTargetInjectedRun.autopilotTargetControl?.targetStageId !== 'evidence-quality'
    || serviceAutopilotTargetInjectedRun.requestBody.recordEvidenceSearch === true
  ), 'Autopilot target control must be injected into the delegated run request body so missing delivery stages drive real Agent artifact/evidence execution, not only receipt annotations.');
const serviceAutopilotSessionPause = projectService.pauseAutonomousRunControlSession({
  projectId,
  sessionId: serviceAutopilotSessionStart.autonomousRunControlSession.id,
  now: '2026-05-28T15:54:00.000Z',
});
assert(serviceAutopilotSessionPause.route === 'autonomous-run-control-session-paused' && serviceAutopilotSessionPause.autonomousRunControlSession.status === 'paused', 'Project service must pause an autonomous run-control session with timeline/event proof.');
const serviceAutopilotDueSessionStart = projectService.startAutonomousRunControlSession({
  projectId,
  now: '2026-05-28T15:54:05.000Z',
  maxLoops: 2,
  maxStepsPerLoop: 1,
  maxTotalSteps: 2,
  requestBodyOverrides: {
    includeReadModels: false,
    forceDue: true,
    submitAgentWorkArtifacts: true,
    reviewPendingSubmissions: true,
    respondToReviewObligations: true,
  },
});
const serviceAutopilotDueWorker = projectService.runDueAutonomousRunControlSessions({
  now: '2026-05-28T15:54:06.000Z',
  forceDue: true,
  forceProjectIds: [projectId],
  maxProjects: 1,
  maxSessionsPerProject: 1,
  loopCount: 1,
  requestBodyOverrides: {
    includeReadModels: false,
    submitAgentWorkArtifacts: true,
    reviewPendingSubmissions: true,
    respondToReviewObligations: true,
  },
});
assert(serviceAutopilotDueWorker.schemaVersion === 'autopilot-due-worker-summary/v1'
  && serviceAutopilotDueWorker.processed.some((row) => row.sessionId === serviceAutopilotDueSessionStart.autonomousRunControlSession.id
    && row.tickId
    && row.actionLanes?.length > 0
    && row.result?.autonomousRunControlSessionTick?.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1'
    && row.result?.autonomousRunControlLoops?.some((loop) => loop.targetSelections?.some((selection) => selection.schemaVersion === 'autonomous-run-control-target-selection/v1'))), 'Project service must scan active Autopilot sessions through a bounded due-worker and produce normal session tick receipts.');
const serviceAutopilotQueueSnapshot = projectService.getProjectWorkerQueue(projectId, {
  now: '2026-05-28T15:54:07.000Z',
  forceDue: true,
  forceProjectIds: [projectId],
});
assert(serviceAutopilotQueueSnapshot.autopilotQueue?.some((row) => row.workerKind === 'autopilot-session'
  && row.sessionId === serviceAutopilotDueSessionStart.autonomousRunControlSession.id
  && row.runApiPath === '/workers/autopilot/due'
  && row.directRunApiPath?.includes('/autonomous-run-control/sessions/')
  && row.requestBody?.sessionId === serviceAutopilotDueSessionStart.autonomousRunControlSession.id
  && row.requestBody?.requestBodyOverrides?.schedulerWorker === 'autopilot-due-worker')
  && serviceAutopilotQueueSnapshot.workerRoutes?.autopilotDueWorker === '/workers/autopilot/due'
  && serviceAutopilotQueueSnapshot.summary?.autopilotSessionCount >= 1, 'Worker queue snapshot must expose bounded Autopilot session rows and worker route contracts.');
const serviceAutopilotExecutionReceipt = serviceAutopilotQueueSnapshot.executionReceipts?.find((receipt) => receipt.workerKind === 'autopilot-session' && receipt.sessionId === serviceAutopilotDueSessionStart.autonomousRunControlSession.id);
assert(serviceAutopilotExecutionReceipt?.idempotencyKey
  && serviceAutopilotExecutionReceipt?.leaseKey
  && serviceAutopilotExecutionReceipt?.receiptChecksum, 'Worker queue snapshot must expose Autopilot session tick execution receipts with session idempotency, lease, and checksum proof.');
const serviceAutopilotQueueAdapterPlan = projectService.getWorkerQueueAdapterPlan(projectId, {
  now: '2026-05-28T15:54:07.000Z',
  forceDue: true,
  forceProjectIds: [projectId],
});
assert(serviceAutopilotQueueAdapterPlan.status === 'ready-for-queue-adapter-pilot'
  && serviceAutopilotQueueAdapterPlan.summary?.autopilotQueueRowCount >= 1
  && serviceAutopilotQueueAdapterPlan.summary?.autopilotDueRowCount >= 1
  && serviceAutopilotQueueAdapterPlan.queuePlans?.some((plan) => plan.id === 'autopilot-session' && plan.workerRoute === '/workers/autopilot/due' && plan.dueCount >= 1)
  && serviceAutopilotQueueAdapterPlan.verificationGates?.some((gate) => gate.id === 'concurrency-policy' && gate.passed && gate.detail.includes('oldest-active-session-per-project-then-due-time')), 'Worker queue adapter plan must promote Autopilot sessions into the managed queue/cron cutover contract.');
const serviceAutopilotQueueAdapterDryRun = projectService.getWorkerQueueAdapterDryRun(projectId, {
  now: '2026-05-28T15:54:07.000Z',
  forceDue: true,
  forceProjectIds: [projectId],
});
assert(serviceAutopilotQueueAdapterDryRun.status === 'passed'
  && serviceAutopilotQueueAdapterDryRun.summary?.autopilotQueueRowCount >= 1
  && serviceAutopilotQueueAdapterDryRun.summary?.autopilotDueRowCount >= 1
  && serviceAutopilotQueueAdapterDryRun.summary?.autopilotDispatchCount >= 1
  && serviceAutopilotQueueAdapterDryRun.summary?.autopilotExecutionReceiptCount >= 1
  && serviceAutopilotQueueAdapterDryRun.adapterExecution?.snapshotParityReceipt?.parityReady === true, 'Worker queue adapter dry-run must import, lease, dispatch, acknowledge, and parity-check Autopilot session rows.');
assert(serviceAutopilotQueueSnapshot.agentQueue?.every((row) => row.initiative?.schemaVersion === 'agent-autonomous-initiative/v1' && row.requestBody?.agentInitiativeId === row.initiativeId && row.agentAutonomousActionRunApiPath?.includes('/agent-autonomous-action-queue/')) && serviceAutopilotQueueSnapshot.summary?.agentInitiativeCount >= serviceAutopilotQueueSnapshot.summary?.agentCount, 'Worker queue snapshot must bind Agent worker rows to Agent initiative proof for scheduler import and lease auditing.');
const serviceAutopilotDashboard = projectService.getManagerDashboard(projectId, { fresh: true });
assert(serviceAutopilotDashboard.autonomousRunControlSessions?.rows?.some((row) => row.id === serviceAutopilotSessionStart.autonomousRunControlSession.id && row.actionLanes?.length > 0 && row.targetSnapshot?.schemaVersion === 'autopilot-delivery-target/v1' && Array.isArray(row.targetMissingStageIds)) && serviceAutopilotDashboard.autonomousRunControlSessions?.tickRows?.some((row) => row.id === serviceAutopilotSessionTick.autonomousRunControlSessionTick.id && row.actionLanes?.length > 0 && row.targetSnapshot?.schemaVersion === 'autopilot-delivery-target/v1' && row.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1' && Array.isArray(row.targetMissingStageIds)) && serviceAutopilotDashboard.autonomousRunControlLoops?.rows?.some((row) => row.actionLanes?.length > 0 && row.targetSelections?.some((selection) => selection.schemaVersion === 'autonomous-run-control-target-selection/v1')), 'Manager Dashboard must expose autonomous run-control session, tick, and loop rows with lane ownership, delivery target progress, and target-aware selection proof.');
const serviceAutopilotFlowGraph = projectService.getManagerFlowGraph(projectId, { fresh: true });
const serviceAutopilotSessionNode = serviceAutopilotFlowGraph.nodes?.find((node) => node.source === 'autonomousRunControlSessions' && node.id.includes(serviceAutopilotSessionStart.autonomousRunControlSession.id));
const serviceAutopilotTickNode = serviceAutopilotFlowGraph.nodes?.find((node) => node.source === 'autonomousRunControlSessionTicks' && node.id.includes(serviceAutopilotSessionTick.autonomousRunControlSessionTick.id));
assert(serviceAutopilotSessionNode?.attachments?.some((attachment) => attachment.actionLanes?.length > 0 && attachment.targetSnapshot?.schemaVersion === 'autopilot-delivery-target/v1' && Array.isArray(attachment.targetMissingStageIds)) && serviceAutopilotTickNode?.attachments?.some((attachment) => attachment.actionLanes?.length > 0 && attachment.targetSnapshot?.schemaVersion === 'autopilot-delivery-target/v1' && attachment.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1' && Array.isArray(attachment.targetMissingStageIds)) && serviceAutopilotFlowGraph.nodes?.some((node) => node.source === 'autonomousRunControlLoops' && node.attachments?.some((attachment) => attachment.actionLanes?.length > 0 && attachment.targetSelections?.some((selection) => selection.schemaVersion === 'autonomous-run-control-target-selection/v1'))), 'Manager Flow Graph must expose autonomous session, tick, and loop receipt nodes with lane ownership, delivery target attachments, and target-aware selection proof.');
const serviceAutopilotProofMap = projectService.getReadinessProofMap(projectId);
assert(serviceAutopilotProofMap.autonomousRunControlSessionRoutes?.some((route) => route.id === serviceAutopilotSessionStart.autonomousRunControlSession.id && route.actionLanes?.length > 0 && route.targetSnapshot?.schemaVersion === 'autopilot-delivery-target/v1' && Array.isArray(route.targetMissingStageIds)) && serviceAutopilotProofMap.autonomousRunControlSessionTickRoutes?.some((route) => route.id === serviceAutopilotSessionTick.autonomousRunControlSessionTick.id && route.actionLanes?.length > 0 && route.targetSnapshot?.schemaVersion === 'autopilot-delivery-target/v1' && route.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1' && Array.isArray(route.targetMissingStageIds)) && serviceAutopilotProofMap.autonomousRunControlLoopRoutes?.some((route) => route.actionLanes?.length > 0 && route.targetSelections?.some((selection) => selection.schemaVersion === 'autonomous-run-control-target-selection/v1')), 'Readiness Proof Map must expose autonomous session, tick, and loop proof routes with lane ownership, delivery target progress, and target-aware selection proof.');
const serviceManagerReadyPackage = projectService.getManagerReadyPackage(projectId);
assert(serviceManagerReadyPackage.ready && serviceManagerReadyPackage.managerDashboard.readiness.status === 'manager-ready' && serviceManagerReadyPackage.managerCommandCenter.agentRows.length === serviceManagerCommandCenter.agentRows.length && serviceManagerReadyPackage.managerScenarioTrail.rows.length === serviceManagerScenarioTrail.rows.length && serviceManagerReadyPackage.managerScenarioWalkthrough.rows.length === serviceManagerScenarioWalkthrough.rows.length && serviceManagerReadyPackage.managerRequirementMatrix.rows.length === serviceManagerDashboard.managerRequirementMatrix.rows.length && serviceManagerReadyPackage.syncProtocolAudit.rows.length === serviceManagerDashboard.syncProtocolAudit.rows.length && serviceManagerReadyPackage.managerUseCaseAudit.rows.length === serviceManagerUseCaseAudit.rows.length && serviceManagerReadyPackage.managerActionQueue.rows.length === serviceManagerActionQueue.rows.length && serviceManagerReadyPackage.managerActionRuns.count > 0 && serviceManagerReadyPackage.summary.managerActionRunCount > 0 && serviceManagerReadyPackage.summary.commandCenterAttentionCount === serviceManagerCommandCenter.attentionCount && serviceManagerReadyPackage.summary.walkthroughCompletedCount === serviceManagerScenarioWalkthrough.completedCount && serviceManagerReadyPackage.summary.walkthroughRunnableCount > 0 && serviceManagerReadyPackage.summary.syncProtocolSyncedCount === serviceManagerDashboard.syncProtocolAudit.syncedCount && serviceManagerReadyPackage.summary.useCaseCoveredCount === serviceManagerUseCaseAudit.coveredCount && serviceManagerReadyPackage.summary.requirementReadyCount > 0 && serviceManagerReadyPackage.summary.actionQueueCount === serviceManagerActionQueue.count && typeof serviceManagerReadyPackage.summary.actionQueueUnresolvedRouteCount === 'number' && serviceManagerReadyPackage.summary.proofRouteCount === serviceReadinessProofMap.routes.length, 'Project service must expose a manager ready package with dashboard, command center, proof-map, scenario trail, walkthrough, requirement matrix, sync protocol audit, use case audit, action queue, action-run receipts, and summary data.');
assert(serviceManagerReadyPackage.autonomousRunControlSessions?.rows?.some((row) => row.id === serviceAutopilotSessionStart.autonomousRunControlSession.id) && serviceManagerReadyPackage.summary.autonomousRunControlSessionCount > 0 && serviceManagerReadyPackage.summary.autonomousRunControlSessionTickCount > 0, 'Manager Ready Package must summarize autonomous run-control sessions and ticks.');
assert(serviceManagerReadyPackage.summary.kickoffBoardReadyCount === serviceManagerCommandCenter.kickoffBoard.readyCount && serviceManagerReadyPackage.summary.kickoffBoardCount === serviceManagerCommandCenter.kickoffBoard.count && serviceManagerReadyPackage.summary.workLoopRunningCount === serviceManagerCommandCenter.workLoopBoard.runningCount && serviceManagerReadyPackage.summary.workLoopCount === serviceManagerCommandCenter.workLoopBoard.count && serviceManagerReadyPackage.summary.collaborationReadyCount === serviceManagerCommandCenter.collaborationBoard.readyCount && serviceManagerReadyPackage.summary.collaborationBoardCount === serviceManagerCommandCenter.collaborationBoard.count && serviceManagerReadyPackage.summary.changeProtocolReadyCount === serviceManagerCommandCenter.changeProtocolBoard.readyCount && serviceManagerReadyPackage.summary.changeProtocolBoardCount === serviceManagerCommandCenter.changeProtocolBoard.count && serviceManagerReadyPackage.summary.changeOwnerReadyCount === serviceManagerCommandCenter.changeReadyCount && serviceManagerReadyPackage.summary.changeOwnerCount === serviceManagerCommandCenter.changeRows.length, 'Manager ready package summary must roll up kickoff, work-loop, collaboration, change protocol, and change-owner board counts for manager acceptance.');
assert(serviceManagerDashboard.backendRoutes.readinessProofMap.endsWith('/readiness-proof-map') && serviceManagerDashboard.backendRoutes.managerReadyPackage.endsWith('/manager-ready-package') && serviceManagerDashboard.backendRoutes.managerCommandCenter.endsWith('/manager-command-center') && serviceManagerDashboard.backendRoutes.managerScenarioTrail.endsWith('/manager-scenario-trail') && serviceManagerDashboard.backendRoutes.managerScenarioWalkthrough.endsWith('/manager-scenario-walkthrough') && serviceManagerDashboard.backendRoutes.managerRequirementMatrix.endsWith('/manager-requirement-matrix') && serviceManagerDashboard.backendRoutes.syncProtocolAudit.endsWith('/sync-protocol-audit') && serviceManagerDashboard.backendRoutes.managerUseCaseAudit.endsWith('/manager-use-case-audit') && serviceManagerDashboard.backendRoutes.managerActionQueue.endsWith('/manager-action-queue') && serviceManagerDashboard.backendRoutes.managerActionRunTemplate.endsWith('/manager-action-queue/:actionId/run') && serviceManagerDashboard.backendRoutes.agentAutonomousActionQueue.endsWith('/agent-autonomous-action-queue') && serviceManagerDashboard.backendRoutes.agentAutonomousActionRunTemplate.endsWith('/agent-autonomous-action-queue/:agentId/run') && serviceManagerDashboard.backendRoutes.agents.endsWith('/agents'), 'Project service manager dashboard must include backend route hints for manager clients.');
assert(serviceManagerDashboard.operationsBoard.agents.some((agent) => agent.agentId === 'turing' && agent.dashboardPath?.endsWith('/agents/turing/dashboard')), 'Project service manager dashboard must link Agent operations rows to per-Agent dashboard resources.');
const serviceAgentDashboard = projectService.getAgentDashboard(projectId, 'turing');
assert(serviceAgentDashboard.agentId === 'turing' && serviceAgentDashboard.agent.name === 'Alan Turing', 'Project service Agent dashboard must resolve the requested Agent identity.');
assert(serviceAgentDashboard.ownedTasks.some((task) => task.id === serviceAgentTaskId && task.evidence.timelineLogIds.length > 0), 'Project service Agent dashboard must expose owned task evidence for the requested Agent.');
assert(serviceAgentDashboard.inbox.some((item) => item.taskId === serviceAgentTaskId) && serviceAgentDashboard.worklog.length > 0, 'Project service Agent dashboard must expose independent inbox and worklog state.');
assert(serviceAgentDashboard.management.score > 0 && serviceAgentDashboard.management.managementInboxCount >= 0, 'Project service Agent dashboard must include management priority details.');
assert(serviceAgentDashboard.management.managerNames.length > 0 && serviceAgentDashboard.management.peerManagedNames.length > 0 && serviceAgentDashboard.proof.managementProofLogIds.length > 0, 'Project service Agent dashboard must include leader/peer management relationships and management proof ids.');
assert(serviceAgentDashboard.proof.chatProofIds.length > 0 && serviceAgentDashboard.proof.timelineLogIds.length > 0 && serviceAgentDashboard.proof.eventIds.length > 0, 'Project service Agent dashboard must include chat, timeline, and event proof ids.');
assert(serviceAgentDashboard.backendRoutes.dashboard.endsWith('/agents/turing/dashboard') && serviceAgentDashboard.backendRoutes.timeline.endsWith('/timeline'), 'Project service Agent dashboard must include backend route hints.');
const serviceRunContinuousAction = projectService.runManagerActionQueueItem({
  projectId,
  actionId: 'fixed-continuous-routines',
  now: '2026-05-28T15:53:30.000Z',
});
assert(serviceRunContinuousAction.route === 'manager-action-queue-item-run' && serviceRunContinuousAction.managerAction?.requirementId === 'fixed-continuous-routines' && serviceRunContinuousAction.resultRoute === undefined && serviceRunContinuousAction.managerActionRun?.resultRoute === 'manager-action-scheduler-tick' && serviceRunContinuousAction.managerActionRun?.schedulerTick?.schemaVersion === 'manager-action-scheduler-tick/v1' && serviceRunContinuousAction.managerActionRun?.resultAgentProcessedCount >= 1 && serviceRunContinuousAction.agentProcessed?.some((item) => item.projectId === projectId) && serviceRunContinuousAction.project.eventLedger?.some((event) => event.type === 'manager-action-run' && event.entityIds?.requirementId === 'fixed-continuous-routines'), 'Project service must execute the Action Queue 24/7 pulse through the backend scheduler boundary and include Agent worker evidence.');
const serviceRunManagerCommandCenter = projectService.runManagerCommandCenterNext({
  projectId,
  now: '2026-05-28T15:54:00.000Z',
});
assert(serviceRunManagerCommandCenter.route === 'manager-command-center-run-next' && serviceRunManagerCommandCenter.managerCommandCenterRun?.delegatedRunApiPath?.includes('/manager-action-queue/') && serviceRunManagerCommandCenter.managerActionRun?.resultMessageIds?.length > 0 && serviceRunManagerCommandCenter.managerCommandCenter?.agentRows?.length === serviceManagerDashboard.agents.count && serviceRunManagerCommandCenter.managerReadyPackage?.managerCommandCenter?.agentRows?.length === serviceManagerDashboard.agents.count, 'Project service must execute the manager command center next action through the backend and return updated command center receipt data.');
const serviceAgentMessage = projectService.submitAgentMessage({
  projectId,
  agentId: 'musk',
  targetAgentIds: ['turing'],
  channelId: 'main',
  text: 'Coordination note: keep the backend proof packet current for the next manager review.',
  now: '2026-05-28T14:09:30.000Z',
  messageId: 'svc_agent_to_agent_source',
});
assert(serviceAgentMessage.route === 'agent-message' && serviceAgentMessage.messages.some((message) => message.id === 'svc_agent_to_agent_source' && message.authorId === 'musk'), 'Project service must publish Agent-authored messages as first-class project chat.');
assert(serviceAgentMessage.project.agentStates.turing.inbox.some((item) => item.sourceMessageId === 'svc_agent_to_agent_source' && item.source === 'agent-to-agent-message'), 'Agent-authored messages must arrive in the target Agent inbox.');
assert(serviceAgentMessage.project.agentStates.musk.worklog.some((item) => item.sourceMessageId === 'svc_agent_to_agent_source'), 'Agent-authored messages must be recorded in the sender Agent worklog.');
assert(serviceAgentMessage.project.eventLedger.some((event) => event.source === 'agent-to-agent-message' && event.entityIds?.messageId === 'svc_agent_to_agent_source'), 'Agent-authored messages must be appended to the unified event ledger.');
assert(serviceAgentMessage.agentMessageTimelineLog?.eventType === 'agent-message' && serviceAgentMessage.project.logs.some((log) => log.id === serviceAgentMessage.agentMessageTimelineLog.id && log.messageId === 'svc_agent_to_agent_source'), 'Agent-authored messages must write timeline proof linked to the source message.');
const serviceAgentMessageTargetDashboard = projectService.getAgentDashboard(projectId, 'turing');
assert(serviceAgentMessageTargetDashboard.proof.chatProofIds.includes('svc_agent_to_agent_source') && serviceAgentMessageTargetDashboard.messages.some((message) => message.id === 'svc_agent_to_agent_source'), 'Target Agent dashboard must expose Agent-to-Agent message proof.');
const serviceManagerDashboardAfterAgentMessage = projectService.getManagerDashboard(projectId);
assert(serviceManagerDashboardAfterAgentMessage.agentCommunicationFlow.rows.some((row) => row.messageId === 'svc_agent_to_agent_source' && row.inboxSeen && row.senderWorklogSeen), 'Project service manager dashboard must expose Agent communication flow from sender worklog to target inbox.');
const serviceAgentMessageProofMap = projectService.getReadinessProofMap(projectId);
assert(serviceAgentMessageProofMap.agentMessageRoutes?.some((route) => (
  route.messageId === 'svc_agent_to_agent_source'
  && route.apiPath?.endsWith('/transcripts/main')
  && route.readyForAgentMessageDelivery === true
  && route.proofIds?.includes('svc_agent_to_agent_source')
  && route.timelineLogIds?.includes(serviceAgentMessage.agentMessageTimelineLog.id)
  && route.eventIds?.length > 0
  && route.inboxSeen === true
  && route.senderWorklogSeen === true
)), 'Readiness Proof Map must expose Agent-to-Agent message delivery as a routed backend proof surface.');
assert(serviceAgentMessageProofMap.agentMessageSummary?.readyForAgentMessageDelivery === true && serviceAgentMessageProofMap.agentMessageSummary.proofIds?.includes('svc_agent_to_agent_source'), 'Readiness Proof Map must summarize Agent-to-Agent message delivery readiness.');
const serviceSnapshot = projectService.snapshot();
assert(serviceSnapshot.projects.length === 1 && serviceSnapshot.messages.some((message) => message.id === 'svc_meeting_source'), 'Project service snapshot must expose persisted projects and message history for API responses.');
const reloadedStore = createAgentProjectMemoryStore({
  projects: serviceSnapshot.projects,
  messages: serviceSnapshot.messages,
  hydrateProject: hydrateAgentProject,
});
const reloadedService = createAgentProjectService({ store: reloadedStore });
assert(reloadedService.getMessages(projectId).some((message) => message.id === 'svc_google_source'), 'Reloaded project store must preserve message history by project.');
assert(reloadedService.getProject(projectId).eventLedgerEventCount >= serviceAutonomousCycle.project.eventLedgerEventCount, 'Reloaded project store must preserve event-ledger cursors.');
const postReloadAssignment = reloadedService.submitChatMessage({
  projectId,
  channelId: 'main',
  text: 'leader assign @Alan Turing verify post-reload backend persistence',
  now: '2026-05-28T14:20:00.000Z',
  messageId: 'svc_reload_leader_source',
});
assert(postReloadAssignment.route === 'leader-assignment', 'Reloaded service must continue routing Leader assignments after a repository snapshot reload.');
assert(postReloadAssignment.project.eventLedger.some((event) => event.entityIds?.messageId === 'svc_reload_leader_source'), 'Reloaded service must append source commands to the event ledger after reload.');
const postReloadCycle = reloadedService.runAutonomousCycle({
  projectId,
  cadence: 'hourly',
  now: '2026-05-28T15:00:00.000Z',
  trigger: 'backend-worker-after-reload',
  schedulerReason: 'service-reload-worker-verification',
  dueAt: '2026-05-28T15:00:00.000Z',
  source: 'backend-worker-after-reload-chat',
});
assert(postReloadCycle.project.autonomousSchedulerLedger?.[0]?.trigger === 'backend-worker-after-reload', 'Reloaded service must run backend worker cycles with fresh scheduler evidence.');
const reloadedReadiness = reloadedService.evaluateReadiness(projectId);
assert(reloadedReadiness.status === 'manager-ready', `Reloaded service must preserve manager readiness after post-reload commands: ${reloadedReadiness.checks.filter((check) => !check.passed).map((check) => check.id).join(', ')}`);
const fileStorePath = new URL('../.tmp/agent-manager-scenario-store.json', import.meta.url);
const fileStore = createAgentProjectFileStore({
  filePath: fileStorePath,
  projects: reloadedService.snapshot().projects,
  messages: reloadedService.snapshot().messages,
  hydrateProject: hydrateAgentProject,
  replaceWithSeed: true,
});
checkpoint('file-backed service');
const fileService = createAgentProjectService({ store: fileStore });
const fileServiceChange = fileService.submitChatMessage({
  projectId,
  channelId: 'google_chat',
  text: '@all add file-store persisted Google Chat audit',
  now: '2026-05-28T15:20:00.000Z',
  messageId: 'svc_file_google_source',
});
assert(fileServiceChange.route === 'feature-change', 'File-backed service must route Google Chat changes.');
const fileAutopilotSessionStart = fileService.startAutonomousRunControlSession({
  projectId,
  sessionId: 'file_restart_autopilot_session',
  now: '2026-05-28T15:24:00.000Z',
  actor: 'File Store Autopilot',
  reason: 'file-store-autopilot-resume-proof',
  forceNewSession: true,
  maxLoops: 3,
  maxStepsPerLoop: 1,
  maxTotalSteps: 3,
  requestBodyOverrides: {
    includeReadModels: false,
    forceDue: true,
    submitAgentWorkArtifacts: true,
    reviewPendingSubmissions: true,
    respondToReviewObligations: true,
  },
});
assert(fileAutopilotSessionStart.autonomousRunControlSession?.id === 'file_restart_autopilot_session' && fileAutopilotSessionStart.autonomousRunControlSession.status === 'running', 'File-backed service must persist an active Autopilot session before process restart.');
assert(existsSync(fileStorePath), 'File-backed project store must write its JSON snapshot to disk.');
let persistedSnapshot = JSON.parse(readFileSync(fileStorePath, 'utf8'));
assert(persistedSnapshot.messages.some((message) => message.id === 'svc_file_google_source'), 'File-backed project store must persist appended chat messages.');
assert(persistedSnapshot.projects[0]?.eventLedger?.some((event) => event.entityIds?.messageId === 'svc_file_google_source'), 'File-backed project store must persist project event-ledger updates.');
assert(persistedSnapshot.projects[0]?.autonomousRunControlSessionLedger?.some((session) => session.id === 'file_restart_autopilot_session' && session.status === 'running'), 'File-backed project store must persist active Autopilot sessions before restart.');
const restartedFileStore = createAgentProjectFileStore({
  filePath: fileStorePath,
  hydrateProject: hydrateAgentProject,
});
const restartedFileService = createAgentProjectService({ store: restartedFileStore });
assert(restartedFileService.getMessages(projectId).some((message) => message.id === 'svc_file_google_source'), 'Restarted file-backed service must reload persisted message history.');
assert(restartedFileService.getAutonomousRunControlSessions(projectId).sessions?.some((session) => session.id === 'file_restart_autopilot_session' && session.status === 'running'), 'Restarted file-backed service must reload active Autopilot session state from disk.');
const restartedFileAutopilotDueWorker = restartedFileService.runDueAutonomousRunControlSessions({
  now: '2026-05-28T15:25:00.000Z',
  forceDue: true,
  forceProjectIds: [projectId],
  maxProjects: 1,
  maxSessionsPerProject: 10,
  loopCount: 1,
  requestBodyOverrides: {
    includeReadModels: false,
    submitAgentWorkArtifacts: true,
    reviewPendingSubmissions: true,
    respondToReviewObligations: true,
  },
});
assert(restartedFileAutopilotDueWorker.processed.some((row) => row.sessionId === 'file_restart_autopilot_session'
  && row.tickId
  && row.result?.autonomousRunControlSessionTick?.sessionId === 'file_restart_autopilot_session'
  && row.result?.autonomousRunControlSessionTick?.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1'), 'Restarted file-backed service must resume active Autopilot sessions through the due-worker and produce normal tick receipts.');
const restartedFileAutopilotQueue = restartedFileService.getProjectWorkerQueue(projectId, {
  now: '2026-05-28T15:25:01.000Z',
  forceDue: true,
  forceProjectIds: [projectId],
});
assert(restartedFileAutopilotQueue.executionReceipts?.some((receipt) => receipt.workerKind === 'autopilot-session'
  && receipt.sessionId === 'file_restart_autopilot_session'
  && receipt.idempotencyKey
  && receipt.leaseKey
  && receipt.receiptChecksum), 'Restarted file-backed worker queue must expose Autopilot tick execution receipts with session idempotency and lease proof.');
const restartedFileAutopilotAdapterDryRun = restartedFileService.getWorkerQueueAdapterDryRun(projectId, {
  now: '2026-05-28T15:25:02.000Z',
  forceDue: true,
  forceProjectIds: [projectId],
});
assert(restartedFileAutopilotAdapterDryRun.status === 'passed'
  && restartedFileAutopilotAdapterDryRun.summary?.autopilotQueueRowCount >= 1
  && restartedFileAutopilotAdapterDryRun.summary?.autopilotDispatchCount >= 1
  && restartedFileAutopilotAdapterDryRun.summary?.autopilotExecutionReceiptCount >= 1, 'Restarted file-backed queue adapter dry-run must import, dispatch, and acknowledge resumed Autopilot session rows.');
const restartedFileOperationsReadiness = restartedFileService.getOperationsReadiness(projectId, { fresh: true });
assert(restartedFileOperationsReadiness.observability?.metrics?.autopilotResumeReady === true
  && restartedFileOperationsReadiness.observability.metrics.autopilotExecutionReceiptCount >= 1
  && restartedFileOperationsReadiness.observability.metrics.queueAdapterAutopilotDispatchCount >= 1, 'Operations readiness must expose resumed Autopilot session receipt and queue-adapter recovery metrics after file-store restart.');
assert(typeof restartedFileOperationsReadiness.observability?.metrics?.providerAuditRecoveryReady === 'boolean'
  && restartedFileOperationsReadiness.gates.some((gate) => gate.id === 'provider-audit-recovery-contract'), 'Operations readiness must expose provider audit recovery metrics and gate shape after file-store restart.');
const filePostRestartCycle = restartedFileService.runAutonomousCycle({
  projectId,
  cadence: 'hourly',
  now: '2026-05-28T16:00:00.000Z',
  trigger: 'file-store-worker-after-restart',
  schedulerReason: 'file-store-worker-verification',
  dueAt: '2026-05-28T16:00:00.000Z',
  source: 'file-store-worker-chat',
});
assert(filePostRestartCycle.project.autonomousSchedulerLedger?.[0]?.trigger === 'file-store-worker-after-restart', 'Restarted file-backed service must continue worker cycles after disk reload.');
assert(restartedFileService.evaluateReadiness(projectId).status === 'manager-ready', 'Restarted file-backed service must preserve manager readiness after disk reload.');
persistedSnapshot = JSON.parse(readFileSync(fileStorePath, 'utf8'));
assert(persistedSnapshot.projects[0]?.autonomousSchedulerLedger?.[0]?.trigger === 'file-store-worker-after-restart', 'File-backed project store must persist post-restart worker state.');
assert(persistedSnapshot.projects[0]?.autonomousRunControlSessionTickLedger?.some((tick) => tick.sessionId === 'file_restart_autopilot_session' && tick.workerKind === 'autopilot-session' && tick.executionReceipt?.receiptChecksum), 'File-backed project store must persist resumed Autopilot tick worker execution receipts after restart.');
const apiStorePath = new URL('../.tmp/agent-manager-api-store.json', import.meta.url);
const apiRuntimeRoot = fileURLToPath(new URL('../.tmp/agent-manager-api-runtime', import.meta.url));
const apiWorkspaceRoot = fileURLToPath(new URL('../.tmp/agent-manager-api-workspace', import.meta.url));
mkdirSync(apiWorkspaceRoot, { recursive: true });
const apiProjectRuntime = createLocalProjectRuntime({
  rootPath: apiRuntimeRoot,
  enableCommandExecution: true,
  allowedCommands: ['node'],
});
checkpoint('file-backed API and local runtime');
const projectApi = createFileBackedAgentProjectApi({
  filePath: apiStorePath,
  projects: [restartedFileService.getProject(projectId)],
  messages: restartedFileService.getMessages(projectId),
  replaceWithSeed: true,
  projectRuntime: apiProjectRuntime,
});
let apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness`,
});
assert(apiResponse.status === 200 && apiResponse.body.readiness.status === 'manager-ready', 'Agent project API must expose manager readiness for persisted projects.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
});
assert(apiResponse.status === 200 && apiResponse.body.status === 'manager-ready' && apiResponse.body.routes.some((route) => route.checkId === 'role-clarification' && route.apiPath.endsWith('/transcripts/main')), 'Agent project API must expose readiness proof-map routes for persisted projects.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.readiness.status === 'manager-ready' && apiResponse.body.operationsBoard.agents.length === confirmedTeam.length, 'Agent project API must expose aggregated manager dashboard readiness and operations rows.');
assert(apiResponse.body.assignmentFlow.rows.some((row) => row.timelineSeen) && apiResponse.body.changeFlow.rows.some((row) => row.teamSyncCount > 0), 'Agent project API manager dashboard must include assignment and change flow read models.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/local-runtime`,
});
assert(apiResponse.status === 200 && existsSync(apiResponse.body.localRuntime.memoryPath), 'Agent project API must create a project-scoped local memory folder.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/workspace/bind`,
  body: {
    workspacePath: apiWorkspaceRoot,
    now: '2026-05-28T16:01:00.000Z',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.localRuntime.workspacePath === apiWorkspaceRoot, 'Agent project API must bind a local workspace folder to one project.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/workspace/write`,
  body: {
    path: 'notes/local-edit-proof.md',
    content: '# Local Edit Proof\n\nThis file was written through the Agent project workspace API.\n',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.file.path === 'notes/local-edit-proof.md', 'Agent project API must write files inside the bound workspace.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/workspace/read`,
  body: { path: 'notes/local-edit-proof.md' },
});
assert(apiResponse.status === 200 && /workspace API/.test(apiResponse.body.content), 'Agent project API must read files from the bound workspace.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/workspace/list`,
  body: { path: '.', recursive: true },
});
assert(apiResponse.status === 200 && apiResponse.body.files.some((file) => file.path === 'notes/local-edit-proof.md'), 'Agent project API must list files from the bound workspace.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/workspace/read`,
  body: { path: '../outside.md' },
});
assert(apiResponse.status === 400 && /escapes allowed root/.test(apiResponse.body.message), 'Agent project API must reject workspace path traversal.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/workspace/exec`,
  body: {
    command: 'node',
    args: ['-e', 'console.log("workspace-exec-ok")'],
  },
});
assert(apiResponse.status === 200 && apiResponse.body.status === 0 && /workspace-exec-ok/.test(apiResponse.body.stdout), 'Agent project API must execute allowed local workspace commands when explicitly enabled.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-ready-package`,
});
assert(apiResponse.status === 200 && apiResponse.body.ready && apiResponse.body.summary.scenarioTrailReadyCount > 0 && apiResponse.body.summary.commandCenterAttentionCount === apiResponse.body.managerCommandCenter.attentionCount && apiResponse.body.managerDashboard.readiness.status === 'manager-ready', 'Agent project API must expose the manager ready package endpoint with command center summary data.');
const contractApi = createFileBackedAgentProjectApi({
  filePath: new URL('../.tmp/agent-contract-api-store.json', import.meta.url),
  projects: [filePostRestartCycle.project],
  messages: restartedFileService.getMessages(projectId),
  replaceWithSeed: true,
});
apiResponse = contractApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/contract`,
  body: {
    agent: {
      id: 'ada',
      name: 'Ada Lovelace',
      role: 'Systems Analyst',
      skill: 'computing',
      category: 'implementation',
    },
    contractedBy: 'Director',
    source: 'pantheon-market',
    reason: 'Expand implementation reasoning.',
    now: '2026-05-28T16:01:45.000Z',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.agentContract?.schemaVersion === 'agent-contract/v1', 'Agent project API must contract marketplace Agents through a backend roster mutation.');
assert(apiResponse.body.project.team.some((member) => member.id === 'ada' && member.contractStatus === 'active'), 'Agent contract route must persist the contracted Agent in the project team roster.');
assert(apiResponse.body.project.agentContracts?.some((record) => record.agentId === 'ada' && record.timelineLogIds?.length > 0 && record.eventIds?.length > 0), 'Agent contract route must persist auditable contract records with timeline and event proof.');
assert(apiResponse.body.project.eventLedger?.some((event) => event.type === 'agent-contracted' && event.entityIds?.agentId === 'ada'), 'Agent contract route must append the roster change to the unified event ledger.');
assert(apiResponse.body.project.logs?.some((log) => log.eventType === 'agent-contracted' && log.agentId === 'ada'), 'Agent contract route must create a Flow Graph-visible roster timeline log.');
assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels.agentDashboardRoute?.endsWith('/agents/ada/dashboard'), 'Agent contract route must support lightweight read-model refresh routes for the contracted Agent.');
apiResponse = contractApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/agents/ada/dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.agentId === 'ada' && apiResponse.body.agent.name === 'Ada Lovelace' && apiResponse.body.worklog.some((item) => item.kind === 'agent-contracted'), 'Contracted Agents must immediately have a backend Agent dashboard with contract worklog proof.');
apiResponse = contractApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
});
assert(apiResponse.status === 200 && apiResponse.body.nodes?.some((node) => node.subtype === 'agent-contracted' && node.agentId === 'ada' && node.category === 'collaboration'), 'Agent contract route must appear as a collaboration node in the backend Flow Graph.');
apiResponse = contractApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/launch-approvals`,
  body: {
    includeReadModels: false,
    mode: 'private-pilot',
    decision: 'approved',
    approverRole: 'manager',
    approverId: 'director',
    approverName: 'Product Director',
    reason: 'Validate lightweight launch approval response routes.',
    now: '2026-05-28T16:01:50.000Z',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.launchApproval?.schemaVersion === 'launch-approval/v1', 'Launch approval route must return a lightweight approval receipt.');
assert(apiResponse.body.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1', 'Launch approval route must return the updated workflow snapshot.');
assert(
  apiResponse.body.readModels?.included === false
    && apiResponse.body.readModels.launchApprovalWorkflowRoute?.endsWith('/launch-approvals')
    && apiResponse.body.readModels.productionLaunchAuditRoute?.endsWith('/production-launch-audit')
    && apiResponse.body.readModels.projectEvidenceExportWorkflowRoute?.endsWith('/project-evidence-exports')
    && apiResponse.body.readModels.privatePilotGoLiveReadinessRoute?.endsWith('/private-pilot-go-live-readiness'),
  'Launch approval route must return explicit launch/go-live read-model refresh routes when includeReadModels is false.',
);
assert(!apiResponse.body.managerReadyPackage && !apiResponse.body.managerDashboard, 'Launch approval route must not embed large Manager read models when includeReadModels is false.');
apiResponse = contractApi.handle({
  method: 'PUT',
  path: `/projects/${projectId}/membership-policy`,
  body: {
    includeReadModels: false,
    policy: {
      schemaVersion: 'project-membership-policy/v1',
      managerUserIds: ['director'],
      securityAdminUserIds: ['security-lead'],
      runtimeUserIds: ['scheduler'],
      agentIds: confirmedTeam.map((agent) => agent.id),
      reviewerAgentIds: ['curie'],
      agentUserIds: Object.fromEntries(confirmedTeam.map((agent) => [agent.id, [`agent-runtime-${agent.id}`]])),
      reviewerUserIds: {
        curie: ['agent-runtime-curie'],
      },
    },
    updatedBy: 'security-lead',
    source: 'manager-scenario-security-receipt',
    now: '2026-05-28T16:01:55.000Z',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', 'Project membership policy route must persist a lightweight security policy receipt.');
assert(
  apiResponse.body.readModels?.included === false
    && apiResponse.body.readModels.membershipPolicyRoute?.endsWith('/membership-policy')
    && apiResponse.body.readModels.securityBoundaryRoute?.endsWith('/security-boundary')
    && apiResponse.body.readModels.securityAuditStreamRoute?.endsWith('/security-audit-stream'),
  'Project membership policy route must return explicit security read-model refresh routes when includeReadModels is false.',
);
assert(!apiResponse.body.managerReadyPackage && !apiResponse.body.managerDashboard, 'Project membership policy route must not embed large Manager read models when includeReadModels is false.');
apiResponse = contractApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/identity-sessions`,
  body: {
    includeReadModels: false,
    role: 'manager',
    userId: 'director',
    issuerRole: 'security-admin',
    issuerId: 'security-lead',
    ttlMs: 60 * 60 * 1000,
    scope: ['project', 'manager-dashboard'],
    source: 'manager-scenario-identity-session',
    now: '2026-05-28T16:01:56.000Z',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.identitySession?.schemaVersion === 'identity-session/v1' && apiResponse.body.tokenContract?.returnedOnce === true, 'Identity-session route must issue a lightweight local session receipt.');
const managerScenarioIdentitySessionId = apiResponse.body.identitySession.id;
assert(
  apiResponse.body.readModels?.included === false
    && apiResponse.body.readModels.identitySessionsRoute?.endsWith('/identity-sessions')
    && apiResponse.body.readModels.securityAccessAuditRoute?.endsWith('/security-access-audit')
    && apiResponse.body.readModels.securityBoundaryRoute?.endsWith('/security-boundary'),
  'Identity-session issue route must return explicit security read-model refresh routes when includeReadModels is false.',
);
assert(!apiResponse.body.managerReadyPackage && !apiResponse.body.managerDashboard && !apiResponse.body.securityBoundary, 'Identity-session route must not embed large Manager or Security Boundary read models when includeReadModels is false.');
apiResponse = contractApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/identity-sessions/${encodeURIComponent(managerScenarioIdentitySessionId)}/revoke`,
  body: {
    includeReadModels: false,
    revokedBy: 'security-lead',
    reason: 'Manager scenario verifies lightweight identity-session revoke routes.',
    now: '2026-05-28T16:01:57.000Z',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.identitySession?.status === 'revoked', 'Identity-session revoke route must return a lightweight revocation receipt.');
assert(
  apiResponse.body.readModels?.included === false
    && apiResponse.body.readModels.identitySessionsRoute?.endsWith('/identity-sessions')
    && apiResponse.body.readModels.securityBoundaryRoute?.endsWith('/security-boundary'),
  'Identity-session revoke route must return explicit security refresh routes when includeReadModels is false.',
);
assert(!apiResponse.body.managerReadyPackage && !apiResponse.body.managerDashboard && !apiResponse.body.securityBoundary, 'Identity-session revoke route must not embed large Manager or Security Boundary read models when includeReadModels is false.');
checkpoint('file API manager ready package');
const lightweightProductionReceiptCases = [
  {
    path: `/projects/${projectId}/production-operations-control-receipts`,
    receiptKey: 'productionOperationsControlReceipt',
    schemaVersion: 'production-operations-control-receipt/v1',
    routeKey: 'productionOperationsControlReceiptWorkflowRoute',
    actorRole: 'security-admin',
    controlId: 'centralized-logs',
  },
  {
    path: `/projects/${projectId}/production-deployment-control-receipts`,
    receiptKey: 'productionDeploymentControlReceipt',
    schemaVersion: 'production-deployment-control-receipt/v1',
    routeKey: 'productionDeploymentControlReceiptWorkflowRoute',
    actorRole: 'runtime-platform',
    controlId: 'access-control-enforced',
  },
  {
    path: `/projects/${projectId}/production-security-control-receipts`,
    receiptKey: 'productionSecurityControlReceipt',
    schemaVersion: 'production-security-control-receipt/v1',
    routeKey: 'productionSecurityControlReceiptWorkflowRoute',
    actorRole: 'security-admin',
    controlId: 'managed-identity-provider',
  },
  {
    path: `/projects/${projectId}/production-provider-control-receipts`,
    receiptKey: 'productionProviderControlReceipt',
    schemaVersion: 'production-provider-control-receipt/v1',
    routeKey: 'productionProviderControlReceiptWorkflowRoute',
    actorRole: 'runtime-platform',
    controlId: 'provider-allowlist',
  },
];
for (const [index, receiptCase] of lightweightProductionReceiptCases.entries()) {
  apiResponse = projectApi.handle({
    method: 'POST',
    path: receiptCase.path,
    body: {
      includeReadModels: false,
      actorRole: receiptCase.actorRole,
      actorId: 'scenario-runtime',
      reason: 'Validate lightweight production-control receipt response routes.',
      now: `2026-05-28T16:01:${String(10 + index).padStart(2, '0')}.000Z`,
      controls: [{
        controlId: receiptCase.controlId,
        status: 'verified',
        evidenceId: `scenario_${receiptCase.controlId}_receipt`,
        evidenceRoute: `https://scenario.example.test/${receiptCase.controlId}`,
        evidenceChecksum: `scenario_${receiptCase.controlId}_checksum`,
        completedAt: `2026-05-28T16:01:${String(5 + index).padStart(2, '0')}.000Z`,
        ownerRole: receiptCase.actorRole,
        detail: `Scenario validation receipt for ${receiptCase.controlId}.`,
      }],
    },
  });
  assert(apiResponse.status === 200 && apiResponse.body[receiptCase.receiptKey]?.schemaVersion === receiptCase.schemaVersion, `Production-control route ${receiptCase.path} must return a lightweight receipt record.`);
  assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels?.managerReadyPackageRoute?.endsWith('/manager-ready-package') && apiResponse.body.readModels?.productionLaunchControlCenterRoute?.endsWith('/production-launch-control-center') && apiResponse.body.readModels?.[receiptCase.routeKey]?.endsWith(receiptCase.path), `Production-control route ${receiptCase.path} must return explicit read-model refresh routes when includeReadModels is false.`);
  assert(!apiResponse.body.managerReadyPackage && !apiResponse.body.productionLaunchControlCenter && !apiResponse.body.productionLaunchEvidenceDossier, `Production-control route ${receiptCase.path} must not embed large Manager read models when includeReadModels is false.`);
}
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-command-center`,
});
assert(apiResponse.status === 200 && apiResponse.body.nextBestAction?.runApiPath && apiResponse.body.liveLanes?.some((lane) => lane.id === 'workers') && apiResponse.body.agentRows?.length === confirmedTeam.length, 'Agent project API must expose the standalone manager command center endpoint.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/manager-command-center/run-next`,
  body: { now: '2026-05-28T16:02:00.000Z', includeReadModels: false },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'manager-command-center-run-next' && apiResponse.body.managerCommandCenterRun?.delegatedRunApiPath?.includes('/manager-action-queue/') && apiResponse.body.managerActionRun?.eventIds?.length > 0 && apiResponse.body.managerCommandCenter?.agentRows?.length === confirmedTeam.length && apiResponse.body.readModels?.included === false && apiResponse.body.readModels.managerReadyPackageRoute?.endsWith('/manager-ready-package'), 'Agent project API must execute the manager command center run-next endpoint and return lightweight command-center receipt data plus read-model refresh routes.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-scenario-trail`,
});
assert(apiResponse.status === 200 && apiResponse.body.rows.some((row) => row.id === 'leader-assignment' && row.passed) && apiResponse.body.rows.some((row) => row.id === 'dual-channel-change' && row.passed), 'Agent project API must expose the standalone manager scenario trail endpoint.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-scenario-walkthrough`,
});
assert(apiResponse.status === 200 && apiResponse.body.rows.some((row) => row.id === 'leader-group-assignment' && row.primaryAction?.runApiPath?.endsWith('/leader-group-assignment/run')) && apiResponse.body.rows.some((row) => row.id === 'owner-plan-team-sync' && row.completed) && apiResponse.body.runnableCount > 0, 'Agent project API must expose the standalone manager scenario walkthrough endpoint with primary action routes.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/manager-scenario-walkthrough/leader-group-assignment/run`,
  body: { now: '2026-05-28T16:02:30.000Z', includeReadModels: false },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'manager-scenario-walkthrough-step-run' && apiResponse.body.managerScenarioWalkthroughStep?.id === 'leader-group-assignment' && apiResponse.body.managerScenarioWalkthroughStep?.resultInspection?.messageCount > 0 && apiResponse.body.managerActionRun?.requirementId === 'leader-group-assignment' && apiResponse.body.managerActionRun?.timelineLogIds?.length > 0 && apiResponse.body.managerScenarioWalkthrough?.rows?.length > 0 && apiResponse.body.readModels?.included === false && apiResponse.body.readModels.managerDashboardRoute?.endsWith('/manager-dashboard'), 'Agent project API must execute guided manager walkthrough steps through the walkthrough run endpoint and return lightweight result inspection proof metadata plus read-model refresh routes.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-requirement-matrix`,
});
assert(apiResponse.status === 200 && apiResponse.body.rows.some((row) => row.id === 'owner-plan-and-team-sync' && row.passed) && apiResponse.body.rows.some((row) => row.id === 'agents-mutually-manage' && row.passed), 'Agent project API must expose the standalone manager requirement matrix endpoint.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/sync-protocol-audit`,
});
assert(apiResponse.status === 200 && ['synced', 'needs-attention'].includes(apiResponse.body.status) && apiResponse.body.rows.some((row) => row.id === 'leader-assignment-sync' && typeof row.complete === 'boolean') && apiResponse.body.rows.some((row) => row.id === 'change-request-sync' && typeof row.complete === 'boolean'), 'Agent project API must expose the standalone sync protocol audit endpoint.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-use-case-audit`,
});
assert(apiResponse.status === 200 && apiResponse.body.status === 'covered' && apiResponse.body.rows.some((row) => row.id === 'kickoff-meeting-understanding' && row.covered) && apiResponse.body.rows.some((row) => row.id === 'mutual-agent-management' && row.covered), 'Agent project API must expose the standalone manager use case audit endpoint.');
assert(apiResponse.body.rows.some((row) => row.id === 'group-chat-assignment-start' && row.actions?.some((action) => action.requirementId === 'assignee-receives-and-starts' && action.canRun) && row.nextAction?.runApiPath?.includes('/manager-action-queue/')), 'Agent project API use case audit must expose runnable Action Queue hints for each manager story stage.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-action-queue`,
});
assert(apiResponse.status === 200 && apiResponse.body.rows.some((row) => row.requirementId === 'midproject-dual-channel-change' && row.method === 'POST' && row.apiPath.endsWith('/change-request') && row.runApiPath?.endsWith('/midproject-dual-channel-change/run') && row.routeResolved && row.rerunnable && row.canRun && row.requestBodyTemplate?.channelIds?.includes('google_chat') && row.requestBodyTemplate?.sourceModes?.includes('war_room_meeting')) && apiResponse.body.rows.some((row) => row.requirementId === 'assignee-receives-and-starts' && row.apiPath.includes('/agents/') && !row.apiPath.includes(':agentId') && row.routeResolved) && typeof apiResponse.body.completedCount === 'number', 'Agent project API must expose the standalone manager action queue endpoint with executable Agent action routes.');
const apiExecutableAgentAction = apiResponse.body.rows.find((row) => row.requirementId === 'assignee-receives-and-starts' && row.method === 'POST' && row.routeResolved);
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/manager-action-queue/${apiExecutableAgentAction.requirementId}/run`,
  body: { now: '2026-05-28T16:03:00.000Z', includeReadModels: false },
});
assert(apiResponse.status === 200 && apiResponse.body.managerAction?.requirementId === 'assignee-receives-and-starts' && apiResponse.body.managerActionRun?.requirementId === 'assignee-receives-and-starts' && apiResponse.body.cycle?.trigger === 'manager-action-playbook-assignee-start' && apiResponse.body.project?.agentWorkerLedger?.some((record) => record.trigger === 'manager-action-playbook-assignee-start') && apiResponse.body.project?.eventLedger?.some((event) => event.type === 'manager-action-run') && apiResponse.body.messages?.some((message) => message.agentWorker?.trigger === 'manager-action-playbook-assignee-start') && apiResponse.body.managerActionQueue?.rows?.length > 0 && apiResponse.body.readModels?.included === false && apiResponse.body.readModels.managerFlowGraphRoute?.endsWith('/manager-flow-graph'), 'Agent project API must execute a manager action queue row through the backend run endpoint and return an auditable lightweight manager-action-run receipt.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/agent-autonomous-action-queue`,
});
assert(apiResponse.status === 200 && apiResponse.body.schemaVersion === 'agent-autonomous-action-queue/v1' && apiResponse.body.rows.some((row) => row.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1' && row.requestBodyTemplate?.useAutonomousStrategy && row.runApiPath?.includes('/agent-autonomous-action-queue/')) && apiResponse.body.backendRoutes.agentAutonomousActionRunTemplate.endsWith('/agent-autonomous-action-queue/:agentId/run'), 'Agent project API must expose the standalone Agent autonomous action queue endpoint with strategy-selected runnable routes.');
const apiExecutableAgentAutonomousAction = apiResponse.body.rows.find((row) => row.canRun) || apiResponse.body.rows[0];
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/agent-autonomous-action-queue/${apiExecutableAgentAutonomousAction.agentId}/run`,
  body: { now: '2026-05-28T16:03:30.000Z', force: true, includeReadModels: false },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'agent-autonomous-action-queue-item-run' && apiResponse.body.agentAutonomousAction?.agentId === apiExecutableAgentAutonomousAction.agentId && apiResponse.body.agentAutonomousActionRun?.schemaVersion === 'agent-autonomous-action-run/v1' && apiResponse.body.agentAutonomousActionRun?.strategyDecisionId && apiResponse.body.project?.agentAutonomousActionRunLedger?.some((run) => run.id === apiResponse.body.agentAutonomousActionRun.id) && apiResponse.body.project?.eventLedger?.some((event) => event.type === 'agent-autonomous-action-run') && apiResponse.body.cycle?.trigger === 'agent-autonomous-action-queue-run' && apiResponse.body.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1' && apiResponse.body.agentAutonomousActionQueue?.rows?.length > 0 && apiResponse.body.readModels?.included === false && apiResponse.body.readModels.managerFlowGraphRoute?.endsWith('/manager-flow-graph'), 'Agent project API must execute Agent autonomous action queue rows and return lightweight persisted strategy/run evidence.');
checkpoint('file API action queue run');
apiResponse = projectApi.handle({
  method: 'POST',
  path: '/kickoff-meetings',
  body: {
    meetingId: 'api_kickoff_meeting_session',
    projectId: 'api_kickoff_project',
    name: 'API Kickoff Session Project',
    brief: 'Create a backend API-visible kickoff meeting before project approval.',
    team: confirmedTeam,
    selectedLeaderId: 'turing',
    now: '2026-05-28T16:05:00.000Z',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.meeting.status === 'awaiting-manager-decision', 'Agent project API must create durable kickoff meeting sessions before project approval.');
assert(apiResponse.body.meeting.transcript.some((turn) => turn.stage === 'role-clarification') && apiResponse.body.meeting.transcript.some((turn) => turn.stage === 'leader-campaign'), 'API kickoff meeting sessions must expose role clarification and Leader campaign transcript turns.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: '/kickoff-meetings/api_kickoff_meeting_session',
});
assert(apiResponse.status === 200 && apiResponse.body.meeting.evidence.hearingEdgeCount > 0, 'Agent project API must read kickoff meeting session evidence before approval.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: '/kickoff-meetings/api_kickoff_meeting_session/clarify',
  body: {
    questionId: apiResponse.body.meeting.transcript.find((turn) => turn.stage === 'role-clarification')?.id,
    text: 'API clarification: the system Agent owns integration proof and the reviewer owns acceptance evidence.',
    now: '2026-05-28T16:07:00.000Z',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'kickoff-meeting-clarified' && apiResponse.body.meeting.evidence.clarificationIds.length === 1, 'Agent project API must persist manager clarification turns before approval.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: '/kickoff-meetings/api_kickoff_meeting_session/approve',
  body: {
    selectedLeaderId: 'turing',
    reviewerId: 'curie',
    now: '2026-05-28T16:10:00.000Z',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'kickoff-meeting-approved' && apiResponse.body.meeting.status === 'approved', 'Agent project API must approve kickoff meeting sessions into projects.');
assert(apiResponse.body.project.team.some((agent) => agent.id === 'turing' && agent.isLeader) && apiResponse.body.kickoffCharter?.governance?.leaderId === 'turing', 'API kickoff meeting approval must persist the manager-confirmed Leader marker.');
assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels.projectRoute?.endsWith('/api_kickoff_project') && apiResponse.body.readModels.transcriptsRoute?.endsWith('/transcripts') && apiResponse.body.readModels.readinessProofMapRoute?.endsWith('/readiness-proof-map') && apiResponse.body.readModels.kickoffMeetingApprovalRoute?.endsWith('/approve'), 'API kickoff meeting approval must return lightweight project/transcript/proof refresh routes.');
assert(!apiResponse.body.managerDashboard && !apiResponse.body.managerReadyPackage, 'API kickoff meeting approval must not embed large Manager read models when includeReadModels is false.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: '/projects/api_kickoff_project/manager-dashboard',
});
assert(apiResponse.status === 200 && apiResponse.body.kickoffExecutionFlow?.firstPulse?.started, 'API kickoff meeting approval read-model refresh must expose manager-dashboard first-pulse evidence.');
assert(apiResponse.body.kickoffMeetingFlow?.generationProvenance?.productionClaim === 'blocked' && apiResponse.body.kickoffMeetingFlow?.conversationRows?.some((row) => row.stage === 'director-clarification' && /system Agent owns integration proof/i.test(row.text || '')), 'API kickoff meeting approval read-model refresh must expose generation provenance and clarification evidence.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: '/projects/api_kickoff_project/manager-ready-package',
});
assert(apiResponse.status === 200 && apiResponse.body.managerDashboard?.kickoffExecutionFlow?.firstPulse?.started, 'API kickoff meeting approval read-model refresh must expose manager-ready package first-pulse evidence.');
checkpoint('file API kickoff approval');
apiResponse = projectApi.handle({
  method: 'GET',
  path: '/kickoff-meetings',
});
assert(apiResponse.status === 200 && apiResponse.body.kickoffMeetings.some((meeting) => meeting.id === 'api_kickoff_meeting_session' && meeting.approvedProjectId === 'api_kickoff_project'), 'Agent project API must list persisted kickoff meeting sessions with approved project links.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/chat`,
  body: {
    channelId: 'google_chat',
    text: '@all add API-routed Google Chat audit packet',
    now: '2026-05-28T16:20:00.000Z',
    messageId: 'api_google_source',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'feature-change', 'Agent project API must route Google Chat feature-change requests.');
assert(apiResponse.body.messages.some((message) => message.id === 'api_google_source'), 'Agent project API must return publishable source messages.');
assert(apiResponse.body.responses?.changeResponse?.changeRecord?.confirmationMessageId, 'Agent project API must return feature-change response details for backend-connected UI flows.');
assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels.managerDashboardRoute?.endsWith('/manager-dashboard'), 'Agent project API chat command responses must support lightweight read-model refresh routes.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/meeting`,
  body: {
    text: '@all add API-routed War Room audit packet',
    now: '2026-05-28T16:30:00.000Z',
    messageId: 'api_meeting_source',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'war-room-meeting-change', 'Agent project API must route War Room meeting changes.');
assert(apiResponse.body.meetingAgentTurns?.length >= 1 && apiResponse.body.messages.some((message) => message.schemaVersion === 'meeting-agent-turn/v1'), 'Agent project API must return backend-authored Agent meeting turns for frontend War Room playback.');
assert(apiResponse.body.meetingAgentTurns.every((turn) => turn.timelineLogIds?.length >= 1), 'Agent project API meeting turns must return timeline log ids for frontend proof navigation.');
assert(apiResponse.body.responses?.changeResponse?.discussionMessages?.length >= 3, 'Agent project API must return meeting discussion responses for backend-connected War Room animation.');
assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels.managerReadyPackageRoute?.endsWith('/manager-ready-package'), 'Agent project API meeting command responses must support lightweight manager-ready package refresh.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/change-request`,
  body: {
    text: '@all add API dual-channel release note',
    now: '2026-05-28T16:35:00.000Z',
    messageIdPrefix: 'api_dual_source',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'multi-channel-change', 'Agent project API must route dual-channel change requests.');
assert(apiResponse.body.messages.some((message) => message.channelId === 'main') && apiResponse.body.messages.some((message) => message.channelId === 'google_chat'), 'Agent project API dual-channel changes must return both source messages.');
assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels.managerFlowGraphRoute?.endsWith('/manager-flow-graph'), 'Agent project API dual-channel changes must return lightweight read-model refresh routes.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.changeFlow?.rows?.some((row) => row.source === 'multi-channel-change-request' && row.sourceMessageIds?.length === 2), 'Agent project API manager-dashboard refresh must expose dual-channel source evidence after lightweight writes.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-ready-package`,
});
assert(apiResponse.status === 200 && apiResponse.body.managerScenarioTrail?.rows?.some((row) => row.id === 'dual-channel-change' && row.passed), 'Agent project API manager-ready package refresh must expose scenario trail evidence after lightweight writes.');
checkpoint('file API chat and change commands');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/autonomous-cycle`,
  body: {
    cadence: 'hourly',
    now: '2026-05-28T17:00:00.000Z',
    trigger: 'api-worker',
    schedulerReason: 'api-worker-verification',
    dueAt: '2026-05-28T17:00:00.000Z',
    source: 'api-worker-chat',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.messageCount > 0, 'Agent project API must run autonomous worker cycles and return publishable messages.');
assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels.managerDashboardRoute?.endsWith('/manager-dashboard'), 'Agent project API autonomous-cycle responses must support lightweight manager read-model refresh.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.operationsBoard?.latestProjectCycle?.trigger === 'api-worker', 'Agent project API manager-dashboard refresh must include autonomous-cycle operations data.');
checkpoint('file API autonomous cycle');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/chat`,
  body: {
    channelId: 'main',
    text: 'leader assign @Alan Turing run API per-Agent worker packet',
    now: '2026-05-28T17:05:00.000Z',
    messageId: 'api_agent_worker_assignment_source',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'leader-assignment', 'Agent project API must create an Agent-owned task before a per-Agent worker cycle.');
const apiAgentTaskId = apiResponse.body.responses.leaderAssignmentResponse.task.id;
assert(apiResponse.body.responses.leaderAssignmentStartWorkResponse?.cycle?.trigger === 'leader-assignment-start-work', 'Agent project API Leader assignment must immediately start the assigned Agent work pulse.');
checkpoint('file API leader assignment for agent worker');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/work-cycle`,
  body: {
    now: '2026-05-28T17:06:00.000Z',
    trigger: 'api-agent-worker',
    submitWorkArtifact: true,
    workArtifactReviewerAgentId: 'curie',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'agent-work-cycle', 'Agent project API must expose per-Agent worker cycles through Agent subroutes.');
assert(apiResponse.body.agent?.agentId === 'turing' && apiResponse.body.messages.some((message) => message.agentWorker?.agentId === 'turing'), 'Per-Agent API worker cycle must return the advanced Agent state and chat proof.');
assert(apiResponse.body.project.eventLedger.some((event) => ['agent-work-pulse', 'agent-task-completed'].includes(event.type) && event.entityIds?.agentId === 'turing'), 'Per-Agent API worker cycle must append Agent work event evidence.');
assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels.agentDashboardRoute?.endsWith('/agents/turing/dashboard'), 'Per-Agent API worker responses must support lightweight Agent dashboard refresh.');
assert(apiResponse.body.task?.id === apiAgentTaskId && apiResponse.body.task.status === 'done', 'First explicit per-Agent API worker pulse after assignment-start work must complete the Agent-owned task.');
assert(apiResponse.body.submission?.artifactType === 'progress-brief' && apiResponse.body.workSubmission?.id === apiResponse.body.submission.id, 'Per-Agent API worker cycles must return autonomous work submission receipts when requested.');
assert(apiResponse.body.project.agentWorkerLedger?.[0]?.workSubmissionId === apiResponse.body.submission?.id, 'Per-Agent API worker ledger must link to autonomous work submissions.');
const apiWorkerSubmissionId = apiResponse.body.submission?.id;
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/curie/work-cycle`,
  body: {
    now: '2026-05-28T17:06:30.000Z',
    trigger: 'api-reviewer-worker',
    reviewPendingSubmission: true,
    reviewSubmissionId: apiWorkerSubmissionId,
    agentReviewVerdict: 'changes-requested',
    agentReviewComments: 'API Reviewer worker requested a linked revision for autonomous work proof.',
    agentReviewRequestedChanges: ['Submit a linked revision note before final acceptance.'],
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.review?.verdict === 'changes-requested' && apiResponse.body.review.submissionId === apiWorkerSubmissionId, 'Per-Agent API worker cycles must review pending submissions through the standard review contract when requested.');
assert(apiResponse.body.project.eventLedger.some((event) => event.type === 'submission-review' && event.entityIds?.reviewId === apiResponse.body.review?.id), 'Per-Agent API Reviewer worker cycles must append review event-ledger proof.');
assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels.agentDashboardRoute?.endsWith('/agents/curie/dashboard'), 'Per-Agent API Reviewer worker responses must support lightweight Reviewer dashboard refresh.');
const apiRequestedChangesReviewId = apiResponse.body.review?.id;
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/work-cycle`,
  body: {
    now: '2026-05-28T17:06:45.000Z',
    trigger: 'api-review-response-worker',
    respondToReviewObligation: true,
    reviewResponseId: apiRequestedChangesReviewId,
    reviewResponseArtifactType: 'revision-note',
    reviewResponseReviewerAgentId: 'curie',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.reviewResponseSubmission?.artifactType === 'revision-note' && apiResponse.body.reviewResponseSubmission.respondsToReviewId === apiRequestedChangesReviewId, 'Per-Agent API worker cycles must submit linked revision responses to requested-change reviews.');
assert(apiResponse.body.project.agentWorkerLedger?.[0]?.reviewResponseSubmissionId === apiResponse.body.reviewResponseSubmission?.id, 'Per-Agent API submitter worker ledger must link to review-response submissions.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/curie/work-cycle`,
  body: {
    now: '2026-05-28T17:06:55.000Z',
    trigger: 'api-reviewer-accept-revision-worker',
    reviewPendingSubmission: true,
    reviewSubmissionId: apiResponse.body.reviewResponseSubmission?.id,
    agentReviewVerdict: 'accepted',
    agentReviewComments: 'Accepted by API Reviewer worker after checking linked revision proof.',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.review?.verdict === 'accepted', 'Per-Agent API Reviewer worker cycles must accept linked revision submissions.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.operationsBoard?.agents?.some((agent) => agent.agentId === 'turing' && agent.trigger === 'api-review-response-worker'), 'Manager dashboard refresh must include per-Agent review-response worker operations data after lightweight Agent pulse.');
checkpoint('file API first agent worker');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/work-cycle`,
  body: {
    now: '2026-05-28T17:07:00.000Z',
    trigger: 'api-agent-worker',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.project.agentWorkerLedger?.[0]?.agentId === 'turing', 'Subsequent per-Agent API worker pulses must keep the Agent worker ledger moving.');
checkpoint('file API second agent worker');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/agents/turing/dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.agentId === 'turing' && apiResponse.body.ownedTasks.some((task) => task.id === apiAgentTaskId), 'Agent project API must expose an Agent dashboard with owned tasks.');
assert(apiResponse.body.latestWorker?.trigger === 'api-agent-worker' && apiResponse.body.proof.chatProofIds.length > 0 && apiResponse.body.proof.timelineLogIds.length > 0, 'Agent project API dashboard must include latest worker and proof ids.');
assert(apiResponse.body.management.managerNames.length > 0 || apiResponse.body.management.score >= 0, 'Agent project API dashboard must include management relationship metadata.');
checkpoint('file API agent dashboard');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/musk/message`,
  body: {
    targetAgentIds: ['turing'],
    channelId: 'main',
    text: 'Coordination note: keep the API Agent-to-Agent message proof visible.',
    now: '2026-05-28T17:08:00.000Z',
    messageId: 'api_agent_to_agent_source',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'agent-message', 'Agent project API must publish Agent-to-Agent messages through Agent subroutes.');
assert(apiResponse.body.messages.some((message) => message.id === 'api_agent_to_agent_source' && message.authorId === 'musk'), 'Agent-to-Agent API response must return the Agent-authored source message.');
assert(apiResponse.body.readModels?.included === false && apiResponse.body.readModels.agentDashboardRoute?.endsWith('/agents/musk/dashboard'), 'Agent-to-Agent API response must include lightweight Agent/Manager read-model refresh routes.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/agents/musk/dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.worklog?.some((item) => item.sourceMessageId === 'api_agent_to_agent_source'), 'Sender Agent dashboard refresh must include Agent-to-Agent worklog proof.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.agentCommunicationFlow?.rows?.some((row) => row.messageId === 'api_agent_to_agent_source' && row.inboxSeen && row.senderWorklogSeen), 'Manager dashboard refresh must include Agent-to-Agent communication flow proof.');
checkpoint('file API agent-to-agent message');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/agents/turing/dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.inbox.some((item) => item.sourceMessageId === 'api_agent_to_agent_source') && apiResponse.body.proof.chatProofIds.includes('api_agent_to_agent_source'), 'Target Agent dashboard must expose API Agent-to-Agent inbox and chat proof.');
checkpoint('file API agent worker and message');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts`,
});
assert(apiResponse.status === 200 && apiResponse.body.channels.some((channel) => channel.channelId === 'main' && channel.messageCount > 0 && channel.archivedProofCount > 0), 'Agent project API must expose transcript index with archived main-channel proof.');
assert(apiResponse.body.channels.some((channel) => channel.channelId === 'google_chat' && channel.messageCount > 0), 'Agent project API transcript index must expose Google Chat messages.');
apiResponse = projectApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/main`,
});
assert(apiResponse.status === 200 && apiResponse.body.messages.length > 0 && apiResponse.body.archivedProofMessages.length > 0, 'Agent project API must expose a per-channel transcript with archived proof messages.');
apiResponse = projectApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/local-runtime/archive`,
  body: {
    reason: 'scenario-validation-archive',
    now: '2026-05-28T17:09:00.000Z',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.project.status === 'archived' && existsSync(apiResponse.body.localRuntime.latestArchivePath), 'Agent project API must create a project-scoped archive snapshot.');
checkpoint('file API local archive');
persistedSnapshot = JSON.parse(readFileSync(apiStorePath, 'utf8'));
assert(persistedSnapshot.messages.some((message) => message.id === 'api_google_source'), 'Agent project API must persist chat requests through its file-backed store.');
assert(persistedSnapshot.projects[0]?.autonomousSchedulerLedger?.[0]?.trigger === 'api-worker', 'Agent project API must persist worker-cycle state.');
assert(persistedSnapshot.messages.some((message) => message.agentWorker?.agentId === 'turing'), 'Agent project API must persist per-Agent worker chat proof through its file-backed store.');
assert(persistedSnapshot.projects[0]?.agentWorkerLedger?.[0]?.agentId === 'turing', 'Agent project API must persist per-Agent worker ledger state.');
const restartedApi = createFileBackedAgentProjectApi({ filePath: apiStorePath });
apiResponse = restartedApi.handle({
  method: 'GET',
  path: '/kickoff-meetings/api_kickoff_meeting_session',
});
assert(apiResponse.status === 200 && apiResponse.body.meeting.status === 'approved' && apiResponse.body.meeting.approvedProjectId === 'api_kickoff_project', 'Restarted Agent project API must reload persisted kickoff meeting sessions.');
apiResponse = restartedApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/messages`,
});
assert(apiResponse.status === 200 && apiResponse.body.messages.some((message) => message.id === 'api_meeting_source'), 'Restarted Agent project API must reload persisted messages.');
apiResponse = restartedApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/main`,
});
assert(apiResponse.status === 200 && apiResponse.body.summary.archivedProofCount > 0, 'Restarted Agent project API must reload archived transcript proof recovery.');
apiResponse = restartedApi.handle({
  method: 'POST',
  path: `/projects/${projectId}/chat`,
  body: {
    channelId: 'main',
    text: 'leader assign @Alan Turing verify API restart continuity',
    now: '2026-05-28T17:20:00.000Z',
    messageId: 'api_restart_leader_source',
  },
});
assert(apiResponse.status === 200 && apiResponse.body.route === 'leader-assignment', 'Restarted Agent project API must continue routing Leader assignments.');
checkpoint('restarted file API leader assignment');
apiResponse = restartedApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness`,
});
assert(apiResponse.status === 200 && apiResponse.body.readiness.status === 'manager-ready', 'Restarted Agent project API must preserve manager readiness.');
apiResponse = restartedApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
});
assert(apiResponse.status === 200 && apiResponse.body.routes.some((route) => route.checkId === 'timeline-progress' && route.proofKind === 'timeline' && route.timelineLogIds.length > 0), 'Restarted Agent project API must preserve readiness proof-map timeline routes.');
apiResponse = restartedApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-dashboard`,
});
assert(apiResponse.status === 200 && apiResponse.body.timeline.eventLedgerSummary.replayProjection.replayReady && apiResponse.body.agents.managementMesh.length === confirmedTeam.length, 'Restarted Agent project API must preserve manager dashboard replay and management read models.');
const dueWorkerProbe = runDueProjectAutonomousCycles({
  projects: [
    {
      ...restartedApi.service.getProject(projectId),
      id: `${projectId}_due_probe`,
      autonomy: { enabled: true, cadence: 'hourly' },
      lastAutonomousRunAt: '2026-05-28T16:00:00.000Z',
      nextAutonomousRunAt: '2026-05-28T17:00:00.000Z',
    },
    {
      ...restartedApi.service.getProject(projectId),
      id: `${projectId}_not_due_probe`,
      autonomy: { enabled: true, cadence: 'hourly' },
      lastAutonomousRunAt: '2026-05-28T17:30:00.000Z',
      nextAutonomousRunAt: '2026-05-28T18:30:00.000Z',
    },
  ],
  getMessages: () => restartedApi.service.getMessages(projectId),
  now: '2026-05-28T17:30:00.000Z',
  trigger: 'due-worker-probe',
  source: 'due-worker-probe-chat',
});
assert(dueWorkerProbe.processed.length === 1 && dueWorkerProbe.processed[0].projectId === `${projectId}_due_probe`, 'Due worker helper must process only due autonomous projects.');
assert(dueWorkerProbe.skipped.some((item) => item.projectId === `${projectId}_not_due_probe` && item.reason === 'hourly-cadence-waiting'), 'Due worker helper must skip projects whose next run is still in the future.');
checkpoint('due worker helper');
const dueApiStorePath = new URL('../.tmp/agent-manager-due-worker-api-store.json', import.meta.url);
const dueProject = {
  ...restartedApi.service.getProject(projectId),
  autonomy: { enabled: true, cadence: 'hourly' },
  lastAutonomousRunAt: '2026-05-28T16:00:00.000Z',
  nextAutonomousRunAt: '2026-05-28T17:00:00.000Z',
};
const notDueProject = {
  ...restartedApi.service.getProject(projectId),
  id: `${projectId}_not_due`,
  name: 'Manager Scenario Not Due Control',
  autonomy: { enabled: true, cadence: 'hourly' },
  lastAutonomousRunAt: '2026-05-28T17:30:00.000Z',
  nextAutonomousRunAt: '2026-05-28T18:30:00.000Z',
};
checkpoint('due worker API');
const dueWorkerApi = createFileBackedAgentProjectApi({
  filePath: dueApiStorePath,
  projects: [dueProject, notDueProject],
  messages: restartedApi.service.getMessages(projectId),
  replaceWithSeed: true,
});
apiResponse = dueWorkerApi.handle({
  method: 'POST',
  path: '/workers/autonomous/due',
  body: {
    now: '2026-05-28T17:30:00.000Z',
    trigger: 'api-due-worker',
    source: 'api-due-worker-chat',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200, 'Agent project API due worker route must return success.');
assert(apiResponse.body.processed.length === 1 && apiResponse.body.processed[0].projectId === projectId, 'Agent project API due worker must process due projects.');
assert(apiResponse.body.processed[0].readModels?.included === false && apiResponse.body.processed[0].readModels.managerDashboardRoute?.endsWith('/manager-dashboard'), 'Agent project API due worker processed items must include lightweight manager read-model refresh routes.');
assert(apiResponse.body.skipped.some((item) => item.projectId === `${projectId}_not_due` && item.reason === 'hourly-cadence-waiting'), 'Agent project API due worker must report not-due projects as skipped.');
assert(apiResponse.body.messages.length > 0 && apiResponse.body.messages.every((message) => message.source !== 'not_due'), 'Agent project API due worker must publish messages only for processed projects.');
persistedSnapshot = JSON.parse(readFileSync(dueApiStorePath, 'utf8'));
const persistedDueProject = persistedSnapshot.projects.find((project) => project.id === projectId);
const persistedNotDueProject = persistedSnapshot.projects.find((project) => project.id === `${projectId}_not_due`);
assert(persistedDueProject.autonomousSchedulerLedger?.[0]?.trigger === 'api-due-worker', 'Due worker API must persist scheduler evidence for processed projects.');
assert(persistedNotDueProject.nextAutonomousRunAt === '2026-05-28T18:30:00.000Z', 'Due worker API must not mutate skipped projects.');
dueWorkerApi.service.replaceProject({
  ...dueWorkerApi.service.getProject(projectId),
  agentStates: {
    ...dueWorkerApi.service.getProject(projectId).agentStates,
    turing: {
      ...dueWorkerApi.service.getProject(projectId).agentStates.turing,
      nextAgentRunAt: '2026-05-28T17:25:00.000Z',
    },
    curie: {
      ...dueWorkerApi.service.getProject(projectId).agentStates.curie,
      nextAgentRunAt: '2026-05-28T18:25:00.000Z',
    },
  },
});
apiResponse = dueWorkerApi.handle({
  method: 'POST',
  path: '/workers/agents/due',
  body: {
    now: '2026-05-28T17:40:00.000Z',
    trigger: 'api-agent-due-worker',
    includeReadModels: false,
  },
});
assert(apiResponse.status === 200, 'Agent project API due-Agent worker route must return success.');
assert(apiResponse.body.processed.some((item) => item.projectId === projectId && item.agentId === 'turing'), 'Agent project API due-Agent worker must process due Agents.');
assert(apiResponse.body.skipped.some((item) => item.projectId === projectId && item.agentId === 'curie' && item.reason === 'agent-cadence-waiting'), 'Agent project API due-Agent worker must skip not-yet-due Agents.');
assert(apiResponse.body.processed.some((item) => item.agentId === 'turing' && typeof item.managementPriority === 'number' && Array.isArray(item.managementReasons)), 'Agent project API due-Agent worker must expose management priority metadata.');
assert(apiResponse.body.processed.some((item) => item.agentId === 'turing' && item.readModels?.included === false && item.readModels.agentDashboardRoute?.endsWith('/agents/turing/dashboard')), 'Agent project API due-Agent worker processed items must include lightweight Agent read-model refresh routes.');
const apiAgentDueQueue = apiResponse.body.agentAutonomousActionQueues?.find((queue) => queue.projectId === projectId);
assert(apiAgentDueQueue?.schemaVersion === 'agent-autonomous-action-queue/v1' && apiAgentDueQueue.backendRoutes?.agentAutonomousActionQueue?.endsWith('/agent-autonomous-action-queue'), 'Agent project API due-Agent worker must return post-run Agent autonomous action queues for Manager clients.');
assert(apiAgentDueQueue.rows?.some((row) => row.runApiPath?.includes('/agent-autonomous-action-queue/')), 'Agent due-worker API queues must expose runnable Agent autonomous queue routes for the processed project.');
assert(apiResponse.body.messages.some((message) => message.agentWorker?.trigger === 'api-agent-due-worker'), 'Agent project API due-Agent worker must publish Agent worker chat proof.');
persistedSnapshot = JSON.parse(readFileSync(dueApiStorePath, 'utf8'));
assert(persistedSnapshot.projects.find((project) => project.id === projectId)?.agentWorkerLedger?.[0]?.trigger === 'api-agent-due-worker', 'Agent project API due-Agent worker must persist per-Agent worker state.');
assert(persistedSnapshot.messages.some((message) => message.agentWorker?.trigger === 'api-agent-due-worker'), 'Agent project API due-Agent worker must persist per-Agent worker messages.');
const restartedDueWorkerApi = createFileBackedAgentProjectApi({ filePath: dueApiStorePath });
apiResponse = restartedDueWorkerApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness`,
});
assert(apiResponse.status === 200 && apiResponse.body.readiness.status === 'manager-ready', 'Restarted due-worker API must preserve readiness for processed projects.');
checkpoint('HTTP manager scenario');
const httpStorePath = new URL('../.tmp/agent-manager-http-store.json', import.meta.url);
const httpServer = createAgentProjectHttpServer({
  filePath: httpStorePath,
  projects: [restartedDueWorkerApi.service.getProject(projectId)],
  messages: restartedDueWorkerApi.service.getMessages(projectId),
  replaceWithSeed: true,
});
const httpRuntime = await httpServer.listen();
try {
  let httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/readiness`);
  let httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.readiness.status === 'manager-ready', 'HTTP server must expose project readiness over GET.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/readiness-proof-map`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.routes.some((route) => route.checkId === 'leader-assignments-acknowledged' && route.proofKind === 'task-evidence' && route.taskIds.length > 0), 'HTTP server must expose readiness proof-map task evidence routes.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-dashboard`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.readiness.status === 'manager-ready' && httpBody.operationsBoard.agents.length === confirmedTeam.length, 'HTTP server must expose aggregated manager dashboard read model.');
  assert(httpBody.transcriptIndex.channels.some((channel) => channel.channelId === 'main' && channel.totalProofCount > 0), 'HTTP manager dashboard must include transcript proof summary.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-ready-package`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.ready && httpBody.summary.proofRouteCount > 0 && httpBody.summary.commandCenterAttentionCount === httpBody.managerCommandCenter.attentionCount && httpBody.managerScenarioTrail.rows.some((row) => row.id === 'leader-assignment' && row.passed), 'HTTP server must expose the manager ready package route with command center data.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-command-center`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.nextBestAction?.canRun && httpBody.liveLanes?.some((lane) => lane.id === 'google-chat' && lane.proofCount > 0) && httpBody.agentRows?.length === confirmedTeam.length, 'HTTP server must expose the standalone manager command center route.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-scenario-trail`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.rows.some((row) => row.id === 'continuous-work' && row.passed) && httpBody.rows.some((row) => row.id === 'owner-plan-sync' && row.passed), 'HTTP server must expose the standalone manager scenario trail route.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-scenario-walkthrough`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.status === 'covered' && !httpBody.nextIncompleteStep && httpBody.nextRunnableStep?.primaryAction?.runApiPath?.includes('/manager-action-queue/') && httpBody.rows.some((row) => row.id === 'midproject-change-intake' && row.primaryAction?.requirementId === 'midproject-dual-channel-change' && row.primaryAction?.canRun), 'HTTP server must expose the standalone manager scenario walkthrough route with separate completion gaps and rerunnable step metadata.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-scenario-walkthrough/midproject-change-intake/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ now: '2026-05-28T17:56:30.000Z', includeReadModels: false }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.route === 'manager-scenario-walkthrough-step-run' && httpBody.managerScenarioWalkthroughStep?.id === 'midproject-change-intake' && httpBody.managerScenarioWalkthroughStep?.resultInspection?.messageCount > 0 && httpBody.managerActionRun?.requirementId === 'midproject-dual-channel-change' && httpBody.managerActionRun?.resultMessageIds?.length > 0 && httpBody.managerScenarioWalkthrough?.rows?.length > 0 && httpBody.readModels?.included === false && httpBody.readModels.managerReadyPackageRoute?.endsWith('/manager-ready-package'), 'HTTP server must execute guided manager walkthrough steps and return lightweight result inspection data plus read-model refresh routes.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-requirement-matrix`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.rows.some((row) => row.id === 'leader-group-assignment' && row.passed) && httpBody.rows.some((row) => row.id === 'midproject-dual-channel-change' && row.passed), 'HTTP server must expose the standalone manager requirement matrix route.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/sync-protocol-audit`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && ['synced', 'needs-attention'].includes(httpBody.status) && httpBody.rows.some((row) => row.id === 'leader-assignment-sync' && typeof row.complete === 'boolean') && httpBody.rows.some((row) => row.id === 'change-request-sync' && typeof row.complete === 'boolean'), 'HTTP server must expose the standalone sync protocol audit route.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-use-case-audit`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.status === 'covered' && httpBody.rows.some((row) => row.id === 'group-chat-assignment-start' && row.covered) && httpBody.rows.some((row) => row.id === 'owner-plan-team-sync' && row.covered), 'HTTP server must expose the standalone manager use case audit route.');
  assert(httpBody.rows.some((row) => row.id === 'mutual-agent-management' && row.nextAction?.requirementId === 'agents-mutually-manage' && row.nextAction?.canRun && row.runnableActionCount === 1), 'HTTP manager use case audit route must expose runnable Action Queue next actions.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-action-queue`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.rows.some((row) => row.requirementId === 'fixed-continuous-routines' && row.apiPath === '/workers/autonomous/tick' && row.runApiPath?.endsWith('/fixed-continuous-routines/run') && row.routeResolved && row.rerunnable && row.canRun && row.requestBodyTemplate?.trigger === 'manager-action-playbook-24-7-pulse' && row.requestBodyTemplate?.forceAgentRun === true) && httpBody.rows.some((row) => row.requirementId === 'agents-mutually-manage' && row.apiPath.includes('/agents/') && !row.apiPath.includes(':agentId') && row.routeResolved && row.rerunnable && row.canRun) && typeof httpBody.readyCount === 'number', 'HTTP server must expose the standalone manager action queue route with executable/rerunnable scheduler and Agent work-cycle actions.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-action-queue/agents-mutually-manage/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ now: '2026-05-28T17:57:00.000Z', includeReadModels: false }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.managerAction?.requirementId === 'agents-mutually-manage' && httpBody.managerActionRun?.requirementId === 'agents-mutually-manage' && httpBody.cycle?.trigger === 'manager-action-playbook-management-sync' && httpBody.project?.eventLedger?.some((event) => event.type === 'manager-action-run') && httpBody.managerActionQueue?.rows?.length > 0 && httpBody.readModels?.included === false && httpBody.readModels.managerDashboardRoute?.endsWith('/manager-dashboard'), 'HTTP server must execute manager action queue items through the backend run endpoint and return lightweight manager-action-run audit evidence.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/agent-autonomous-action-queue`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.schemaVersion === 'agent-autonomous-action-queue/v1' && httpBody.rows.some((row) => row.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1' && row.requestBodyTemplate?.useAutonomousStrategy && row.runApiPath?.includes('/agent-autonomous-action-queue/')) && httpBody.backendRoutes.agentAutonomousActionRunTemplate.endsWith('/agent-autonomous-action-queue/:agentId/run'), 'HTTP server must expose the standalone Agent autonomous action queue route with strategy-selected Agent work-cycle actions.');
  const httpExecutableAgentAutonomousAction = httpBody.rows.find((row) => row.canRun) || httpBody.rows[0];
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/agent-autonomous-action-queue/${httpExecutableAgentAutonomousAction.agentId}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ now: '2026-05-28T17:57:30.000Z', force: true, includeReadModels: false }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.route === 'agent-autonomous-action-queue-item-run' && httpBody.agentAutonomousAction?.agentId === httpExecutableAgentAutonomousAction.agentId && httpBody.agentAutonomousActionRun?.schemaVersion === 'agent-autonomous-action-run/v1' && httpBody.agentAutonomousActionRun?.strategyDecisionId && httpBody.project?.agentAutonomousActionRunLedger?.some((run) => run.id === httpBody.agentAutonomousActionRun.id) && httpBody.project?.eventLedger?.some((event) => event.type === 'agent-autonomous-action-run') && httpBody.cycle?.trigger === 'agent-autonomous-action-queue-run' && httpBody.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1' && httpBody.agentAutonomousActionQueue?.rows?.length > 0 && httpBody.readModels?.included === false && httpBody.readModels.managerDashboardRoute?.endsWith('/manager-dashboard'), 'HTTP server must execute Agent autonomous action queue items through the backend and return lightweight persisted strategy/run evidence.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channelId: 'google_chat',
      text: '@all add HTTP server Google Chat audit packet',
      now: '2026-05-28T18:00:00.000Z',
      messageId: 'http_google_source',
      includeReadModels: false,
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.route === 'feature-change', 'HTTP server must route chat commands through the Agent API.');
  assert(httpBody.messages.some((message) => message.id === 'http_google_source'), 'HTTP server must return publishable chat messages.');
  assert(httpBody.readModels?.included === false && httpBody.readModels.managerDashboardRoute?.endsWith('/manager-dashboard'), 'HTTP server chat command responses must support lightweight read-model refresh routes.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/change-request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: '@all add HTTP dual-channel audit packet',
      now: '2026-05-28T18:02:00.000Z',
      messageIdPrefix: 'http_dual_source',
      includeReadModels: false,
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.route === 'multi-channel-change', 'HTTP server must route dual-channel change requests.');
  assert(httpBody.messages.some((message) => message.channelId === 'main') && httpBody.messages.some((message) => message.channelId === 'google_chat'), 'HTTP server dual-channel changes must return War Room and Google Chat source messages.');
  assert(httpBody.readModels?.included === false && httpBody.readModels.managerReadyPackageRoute?.endsWith('/manager-ready-package'), 'HTTP server dual-channel changes must return lightweight read-model refresh routes.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-dashboard`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.changeFlow?.rows?.some((row) => row.source === 'multi-channel-change-request' && row.sourceMessageIds?.length === 2), 'HTTP manager-dashboard refresh must include dual-channel source evidence after lightweight writes.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-ready-package`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.managerScenarioTrail?.rows?.some((row) => row.id === 'dual-channel-change' && row.passed), 'HTTP manager-ready package refresh must include scenario trail evidence after lightweight writes.');

  const httpDueControl = {
    ...restartedDueWorkerApi.service.getProject(projectId),
    id: `${projectId}_http_not_due`,
    name: 'HTTP Not Due Control',
    autonomy: { enabled: true, cadence: 'hourly' },
    nextAutonomousRunAt: '2026-05-28T19:30:00.000Z',
    lastAutonomousRunAt: '2026-05-28T18:30:00.000Z',
  };
  httpRuntime.api.service.replaceProject(httpDueControl);
  httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/due`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-05-28T18:30:00.000Z',
      trigger: 'http-due-worker',
      source: 'http-due-worker-chat',
      includeReadModels: false,
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.processed.some((item) => item.projectId === projectId), 'HTTP server due worker must process due projects.');
  assert(httpBody.processed.some((item) => item.projectId === projectId && item.readModels?.included === false && item.readModels.managerDashboardRoute?.endsWith('/manager-dashboard')), 'HTTP server due worker processed items must support lightweight manager read-model refresh.');
  assert(httpBody.skipped.some((item) => item.projectId === `${projectId}_http_not_due`), 'HTTP server due worker must report skipped not-due projects.');
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-command-center/run-next`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ now: '2026-05-28T18:32:00.000Z', includeReadModels: false }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.route === 'manager-command-center-run-next' && httpBody.managerCommandCenterRun?.delegatedRunApiPath?.includes('/manager-action-queue/') && httpBody.managerActionRun?.timelineLogIds?.length > 0 && httpBody.managerCommandCenter?.agentRows?.length === confirmedTeam.length && httpBody.readModels?.included === false && httpBody.readModels.managerReadyPackageRoute?.endsWith('/manager-ready-package'), 'HTTP server must execute the manager command center run-next route and return lightweight command-center receipt data.');

  httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/status`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.scheduler.enabled === false, 'HTTP server autonomous scheduler must expose status before it is started.');
  const httpSchedulerDueProject = {
    ...restartedDueWorkerApi.service.getProject(projectId),
    id: `${projectId}_http_scheduler_due`,
    name: 'HTTP Scheduler Due Control',
    autonomy: { enabled: true, cadence: 'hourly' },
    nextAutonomousRunAt: '2026-05-28T18:40:00.000Z',
    lastAutonomousRunAt: '2026-05-28T17:40:00.000Z',
    agentSubmissions: [],
    submissionReviews: [],
    evidenceSearches: [],
    evidenceSourceSnapshots: [],
    evidenceProviderReceipts: [],
    evidenceSourceReviews: [],
    tasks: [
      {
        id: 'http_scheduler_agent_submission_task',
        text: 'Collect evidence search packet for the scheduler-produced autonomous product workflow',
        assignee: 'Alan Turing',
        ownerId: 'turing',
        status: 'in-progress',
        workPulseCount: 1,
      },
      ...(restartedDueWorkerApi.service.getProject(projectId).tasks || []),
    ],
    agentStates: {
      ...(restartedDueWorkerApi.service.getProject(projectId).agentStates || {}),
      turing: {
        ...(restartedDueWorkerApi.service.getProject(projectId).agentStates?.turing || {}),
        nextAgentRunAt: '2026-05-28T18:39:00.000Z',
        currentPlan: {
          ...(restartedDueWorkerApi.service.getProject(projectId).agentStates?.turing?.currentPlan || {}),
          taskId: 'http_scheduler_agent_submission_task',
          focus: 'Collect evidence search packet for the scheduler-produced autonomous product workflow',
        },
        obligations: [
          {
            id: 'http_scheduler_agent_submission_obligation',
            taskId: 'http_scheduler_agent_submission_task',
            text: 'Collect evidence search packet for the scheduler-produced autonomous product workflow',
            status: 'open',
          },
        ],
      },
      curie: {
        ...(restartedDueWorkerApi.service.getProject(projectId).agentStates?.curie || {}),
        nextAgentRunAt: '2026-05-28T18:40:00.000Z',
        inbox: [],
        obligations: [],
        managerId: null,
        peerManagerIds: [],
      },
    },
  };
  httpRuntime.api.service.replaceProject(httpSchedulerDueProject);
  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}_http_scheduler_due/autonomous-run-control/sessions/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-05-28T18:44:30.000Z',
      maxLoops: 2,
      maxStepsPerLoop: 1,
      maxTotalSteps: 2,
      includeReadModels: false,
      requestBodyOverrides: {
        includeReadModels: false,
        forceDue: true,
        submitAgentWorkArtifacts: true,
        reviewPendingSubmissions: true,
        respondToReviewObligations: true,
      },
    }),
  });
  httpBody = await httpResponse.json();
  const httpAutopilotSessionId = httpBody.autonomousRunControlSession?.id;
  assert(httpResponse.status === 200 && httpAutopilotSessionId, 'HTTP server must start an Autopilot session that the scheduler can later advance.');
  assert(httpBody.readModels?.included === false
    && httpBody.readModels.autonomousRunControlSessionsRoute?.endsWith('/autonomous-run-control/sessions')
    && httpBody.readModels.autonomousRunControlSessionTickRoute?.endsWith(`/autonomous-run-control/sessions/${encodeURIComponent(httpAutopilotSessionId)}/tick`)
    && httpBody.readModels.autopilotDueWorkerRoute === '/workers/autopilot/due'
    && httpBody.readModels.schedulerTickRoute === '/workers/autonomous/tick'
    && httpBody.readModels.readinessProofMapRoute?.endsWith('/readiness-proof-map'), 'HTTP Autopilot session start must return dedicated lightweight session, scheduler, due-worker, and proof refresh routes.');
  httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/tick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-05-28T18:45:00.000Z',
      trigger: 'http-scheduler-tick',
      source: 'http-scheduler-tick-chat',
      submitAgentWorkArtifacts: true,
      agentWorkArtifactReviewerAgentId: 'curie',
      reviewPendingSubmissions: true,
      agentReviewVerdict: 'changes-requested',
      agentReviewComments: 'HTTP scheduler Reviewer worker requested a linked revision for autonomous submission proof.',
      agentReviewRequestedChanges: ['Submit a linked scheduler revision before acceptance.'],
      tickAutopilotSessions: true,
      forceAutopilotRun: true,
      forceAutopilotProjectIds: [`${projectId}_http_scheduler_due`],
      autopilotLoopCount: 1,
      maxAutopilotProjects: 1,
      maxAutopilotSessionsPerProject: 1,
      autopilotRequestBodyOverrides: {
        submitAgentWorkArtifacts: true,
        reviewPendingSubmissions: true,
        respondToReviewObligations: true,
      },
      includeReadModels: false,
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.result.processed.some((item) => item.projectId === `${projectId}_http_scheduler_due`), 'HTTP scheduler tick endpoint must process due projects through the backend worker path.');
  assert(httpBody.result.agentProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due`), 'HTTP scheduler tick endpoint must process due Agents through the backend Agent worker path.');
  assert(httpBody.result.autopilotProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due`
    && item.sessionId === httpAutopilotSessionId
    && item.tickId
    && item.actionLanes?.length > 0
    && item.autonomousRunControlSessionTick?.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1'), 'HTTP scheduler tick endpoint must process active Autopilot sessions through the backend Autopilot due-worker path.');
  assert(httpBody.result.autopilotProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due`
    && item.sessionId === httpAutopilotSessionId
    && item.readModels?.included === false
    && item.readModels.autonomousRunControlSessionsRoute?.endsWith('/autonomous-run-control/sessions')
    && item.readModels.autonomousRunControlSessionTickRoute?.endsWith(`/autonomous-run-control/sessions/${encodeURIComponent(httpAutopilotSessionId)}/tick`)
    && item.readModels.autopilotDueWorkerRoute === '/workers/autopilot/due'
    && item.readModels.schedulerTickRoute === '/workers/autonomous/tick'
    && item.readModels.managerFlowGraphRoute?.endsWith('/manager-flow-graph')), 'HTTP scheduler Autopilot processed items must include lightweight session, due-worker, scheduler, and Flow refresh routes.');
  assert(httpBody.result.agentProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.evidenceSearch?.searchMode === 'worker-local-evidence-search' && item.evidenceSearch?.sources?.length >= 3), 'HTTP scheduler tick endpoint must record autonomous evidence search proof for evidence-oriented Agent tasks.');
  assert(httpBody.result.agentProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.workSubmission?.artifactType === 'evidence-packet' && item.workSubmission?.sourceRefs?.some((source) => source.type === 'evidence-search')), 'HTTP scheduler tick endpoint must infer evidence-packet submissions and link the autonomous evidence search.');
  assert(httpBody.result.agentProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.review?.verdict === 'changes-requested' && item.reviewedSubmission?.artifactType === 'evidence-packet'), 'HTTP scheduler tick endpoint must review inferred evidence-packet autonomous submissions through the standard review contract.');
  assert(httpBody.result.agentAutonomousActionQueues?.some((queue) => queue.projectId === `${projectId}_http_scheduler_due` && queue.schemaVersion === 'agent-autonomous-action-queue/v1' && queue.rows.some((row) => row.requestBodyTemplate?.useAutonomousStrategy)), 'HTTP scheduler tick endpoint must return the post-tick Agent autonomous action queue for Manager clients.');
  assert(httpBody.status.lastResult?.agentAutonomousActionQueues?.some((queue) => queue.projectId === `${projectId}_http_scheduler_due`), 'HTTP scheduler status must retain the latest Agent autonomous action queue after a tick.');
  assert(httpBody.result.processed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.readModels?.included === false && item.readModels.managerDashboardRoute?.endsWith('/manager-dashboard')), 'HTTP scheduler tick processed project items must include lightweight manager refresh routes.');
  assert(httpBody.result.agentProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.readModels?.included === false && item.readModels.agentDashboardRoute?.includes('/agents/')), 'HTTP scheduler tick processed Agent items must include lightweight Agent refresh routes.');
  assert(httpBody.status.tickCount >= 1 && httpBody.status.processedCount >= 1, 'HTTP scheduler tick endpoint must update scheduler status counters.');
  assert(httpBody.status.agentProcessedCount >= 1, 'HTTP scheduler tick endpoint must update per-Agent scheduler status counters.');
  assert(httpBody.status.autopilotProcessedCount >= 1
    && httpBody.status.autopilotSessionTickCount >= 1
    && httpBody.status.lastTickAutopilotControlSummary?.schemaVersion === 'scheduler-autopilot-controls/v1'
    && httpBody.status.lastTickAutopilotControlSummary.enabled === true
    && httpBody.status.lastResult?.autopilotProcessed?.some((item) => item.sessionId === httpAutopilotSessionId), 'HTTP scheduler status must expose Autopilot session controls, counters, and latest worker receipts.');
  assert(httpBody.status.lastTickAgentControlSummary?.schemaVersion === 'scheduler-agent-controls/v1'
    && httpBody.status.lastTickAgentControlSummary.submitAgentWorkArtifacts === true
    && httpBody.status.lastTickAgentControlSummary.workArtifactType === 'auto'
    && httpBody.status.lastTickAgentControlSummary.reviewPendingSubmissions === true
    && httpBody.status.lastTickAgentControlSummary.includeReadModels === false, 'HTTP scheduler status must expose the Agent autonomy controls used by the latest tick.');
  const httpSchedulerProjectAfterChangeRequest = httpRuntime.api.service.getProject(`${projectId}_http_scheduler_due`);
  httpRuntime.api.service.replaceProject({
    ...httpSchedulerProjectAfterChangeRequest,
    agentStates: {
      ...(httpSchedulerProjectAfterChangeRequest.agentStates || {}),
      turing: {
        ...(httpSchedulerProjectAfterChangeRequest.agentStates?.turing || {}),
        nextAgentRunAt: '2026-05-28T18:46:00.000Z',
      },
      curie: {
        ...(httpSchedulerProjectAfterChangeRequest.agentStates?.curie || {}),
        nextAgentRunAt: '2026-05-28T18:47:00.000Z',
      },
    },
  });
  httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/tick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-05-28T18:50:00.000Z',
      trigger: 'http-scheduler-review-closure-tick',
      source: 'http-scheduler-review-closure-chat',
      forceAgentRun: true,
      forceAgentProjectIds: [`${projectId}_http_scheduler_due`],
      maxAgentProjects: 1,
      maxAgentsPerProject: confirmedTeam.length,
      respondToReviewObligations: true,
      reviewResponseArtifactType: 'revision-note',
      reviewResponseReviewerAgentId: 'curie',
      reviewPendingSubmissions: true,
      agentReviewVerdict: 'accepted',
      agentReviewComments: 'HTTP scheduler Reviewer worker accepted the linked revision response.',
      includeReadModels: false,
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.result.agentProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.reviewResponseSubmission?.artifactType === 'revision-note'), 'HTTP scheduler tick endpoint must be able to request Submitter worker linked revision responses.');
  assert(httpBody.result.agentProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.review?.verdict === 'accepted' && item.reviewedSubmission?.artifactType === 'revision-note'), 'HTTP scheduler tick endpoint must be able to request Reviewer worker acceptance of linked revision responses.');
  assert(httpBody.result.agentSkipped.some((item) => item.projectId === projectId && item.reason === 'agent-force-project-filter'), 'HTTP scheduler forced Agent ticks must filter non-target projects before applying max-project limits.');
  assert(httpBody.status.lastTickAgentControlSummary?.respondToReviewObligations === true
    && httpBody.status.lastTickAgentControlSummary.reviewResponseArtifactType === 'revision-note'
    && httpBody.status.lastTickAgentControlSummary.maxAgentProjects === 1
    && httpBody.status.lastTickAgentControlSummary.maxAgentsPerProject === confirmedTeam.length, 'HTTP scheduler status must expose revision-response and Agent limit controls from forced ticks.');
  const httpSchedulerProjectAfterRevisionAccepted = httpRuntime.api.service.getProject(`${projectId}_http_scheduler_due`);
  httpRuntime.api.service.replaceProject({
    ...httpSchedulerProjectAfterRevisionAccepted,
    tasks: [
      {
        id: 'http_scheduler_final_deliverable_task',
        text: 'Prepare final deliverable handoff for the generic product-team workflow',
        assignee: 'Alan Turing',
        ownerId: 'turing',
        status: 'in-progress',
        workPulseCount: 1,
      },
      ...(httpSchedulerProjectAfterRevisionAccepted.tasks || []),
    ],
    agentStates: {
      ...(httpSchedulerProjectAfterRevisionAccepted.agentStates || {}),
      turing: {
        ...(httpSchedulerProjectAfterRevisionAccepted.agentStates?.turing || {}),
        nextAgentRunAt: '2026-05-28T18:51:00.000Z',
        currentPlan: {
          ...(httpSchedulerProjectAfterRevisionAccepted.agentStates?.turing?.currentPlan || {}),
          taskId: 'http_scheduler_final_deliverable_task',
          focus: 'Prepare final deliverable handoff for the generic product-team workflow',
        },
        obligations: [
          {
            id: 'http_scheduler_final_deliverable_obligation',
            taskId: 'http_scheduler_final_deliverable_task',
            text: 'Prepare final deliverable handoff for the generic product-team workflow',
            status: 'open',
          },
          ...(httpSchedulerProjectAfterRevisionAccepted.agentStates?.turing?.obligations || []),
        ],
      },
      curie: {
        ...(httpSchedulerProjectAfterRevisionAccepted.agentStates?.curie || {}),
        nextAgentRunAt: '2026-05-28T18:52:00.000Z',
      },
    },
  });
  httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/tick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-05-28T18:55:00.000Z',
      trigger: 'http-scheduler-final-deliverable-tick',
      source: 'http-scheduler-final-deliverable-chat',
      forceAgentRun: true,
      forceAgentProjectIds: [`${projectId}_http_scheduler_due`],
      maxAgentProjects: 1,
      maxAgentsPerProject: confirmedTeam.length,
      submitAgentWorkArtifacts: true,
      agentWorkArtifactReviewerAgentId: 'curie',
      reviewPendingSubmissions: true,
      agentReviewVerdict: 'accepted',
      agentReviewComments: 'HTTP scheduler Reviewer worker accepted the final deliverable handoff.',
      includeReadModels: false,
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.result.agentProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.workSubmission?.artifactType === 'final-deliverable'), 'HTTP scheduler tick endpoint must submit autonomous final-deliverable nodes through the standard Agent artifact contract.');
  assert(httpBody.result.agentProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.review?.verdict === 'accepted' && item.reviewedSubmission?.artifactType === 'final-deliverable'), 'HTTP scheduler tick endpoint must review and accept autonomous final-deliverable nodes through the standard review contract.');
  const httpSchedulerProjectAfterFinal = httpRuntime.api.service.getProject(`${projectId}_http_scheduler_due`);
  assert(httpSchedulerProjectAfterFinal.agentSubmissions?.some((submission) => submission.artifactType === 'final-deliverable' && submission.status === 'final'), 'HTTP scheduler final deliverable must persist as a final Agent submission.');
  const httpSchedulerFinalFlowGraph = httpRuntime.api.service.getManagerFlowGraph(`${projectId}_http_scheduler_due`);
  const httpSchedulerFinalFlowNode = httpSchedulerFinalFlowGraph.nodes.find((node) => node.source === 'agentSubmissions' && node.subtype === 'final-deliverable') || null;
  const httpSchedulerFinalWorkflowNode = httpSchedulerFinalFlowGraph.nodes.find((node) => node.id === 'submission-review-workflow') || null;
  assert(httpSchedulerFinalFlowNode && httpSchedulerFinalWorkflowNode?.status === 'confirmed', `Manager Flow Graph must show the final-deliverable node and a closed submission-review workflow. finalNode=${Boolean(httpSchedulerFinalFlowNode)} workflow=${JSON.stringify(httpSchedulerFinalWorkflowNode ? { status: httpSchedulerFinalWorkflowNode.status, subtype: httpSchedulerFinalWorkflowNode.subtype, summary: httpSchedulerFinalWorkflowNode.summary } : null)}`);
  const httpSchedulerFinalProofMap = httpRuntime.api.service.getReadinessProofMap(`${projectId}_http_scheduler_due`);
  assert(httpSchedulerFinalProofMap.submissionRoutes?.some((route) => route.artifactType === 'final-deliverable' && route.apiPath?.includes('/submissions/')) && httpSchedulerFinalProofMap.submissionReviewRoutes?.some((route) => route.verdict === 'accepted' && route.apiPath?.includes('/submission-reviews/')), 'Readiness Proof Map must expose final-deliverable and accepted-review proof routes.');
  const httpSchedulerFinalReviewWorkflow = httpRuntime.api.service.getSubmissionReviewWorkflow(`${projectId}_http_scheduler_due`);
  assert(
    httpSchedulerFinalReviewWorkflow.summary.acceptedFinalDeliverableCount >= 1
      && httpSchedulerFinalReviewWorkflow.gates.some((gate) => gate.id === 'change-requests-closed-by-revision' && gate.passed)
      && httpSchedulerFinalReviewWorkflow.gates.some((gate) => gate.id === 'final-deliverable-accepted' && gate.passed),
    'Submission review workflow must close the requested-change loop and record an accepted final deliverable for scheduler validation.',
  );
  checkpoint('HTTP scheduler immediate start');
  const httpSchedulerProjectBeforeStart = httpRuntime.api.service.getProject(`${projectId}_http_scheduler_due`);
  httpRuntime.api.service.replaceProject({
    ...httpSchedulerProjectBeforeStart,
    tasks: [
      {
        id: 'http_scheduler_start_submission_task',
        text: 'Create brainstorm startup board for the generic product-team workflow',
        assignee: 'Alan Turing',
        ownerId: 'turing',
        status: 'in-progress',
        workPulseCount: 1,
      },
      ...(httpSchedulerProjectBeforeStart.tasks || []).filter((task) => task.id !== 'http_scheduler_start_submission_task'),
    ],
    agentStates: {
      ...(httpSchedulerProjectBeforeStart.agentStates || {}),
      turing: {
        ...(httpSchedulerProjectBeforeStart.agentStates?.turing || {}),
        nextAgentRunAt: '2026-05-28T18:58:00.000Z',
        currentPlan: {
          ...(httpSchedulerProjectBeforeStart.agentStates?.turing?.currentPlan || {}),
          taskId: 'http_scheduler_start_submission_task',
          focus: 'Create brainstorm startup board for the generic product-team workflow',
        },
        obligations: [
          {
            id: 'http_scheduler_start_submission_obligation',
            taskId: 'http_scheduler_start_submission_task',
            text: 'Create brainstorm startup board for the generic product-team workflow',
            status: 'open',
          },
        ],
      },
      curie: {
        ...(httpSchedulerProjectBeforeStart.agentStates?.curie || {}),
        nextAgentRunAt: '2026-05-28T18:59:00.000Z',
      },
    },
  });
  httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      runImmediately: true,
      projectId: `${projectId}_http_scheduler_due`,
      includeReadModels: false,
      useAgentAutonomousStrategy: true,
      submitAgentWorkArtifacts: true,
      agentWorkArtifactType: 'brainstorm-board',
      agentWorkArtifactReviewerAgentId: 'curie',
      respondToReviewObligations: true,
      reviewResponseArtifactType: 'revision-note',
      reviewResponseReviewerAgentId: 'curie',
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.scheduler.enabled && httpBody.scheduler.lastStartedRunImmediately === true, 'HTTP scheduler start endpoint must enable the autonomous loop and record immediate-start intent.');
  assert(httpBody.scheduler.startupAgentControlSummary?.useAgentAutonomousStrategy === true
    && httpBody.scheduler.startupAgentControlSummary.submitAgentWorkArtifacts === true
    && httpBody.scheduler.startupAgentControlSummary.workArtifactType === 'brainstorm-board'
    && httpBody.scheduler.startupAgentControlSummary.respondToReviewObligations === true
    && httpBody.scheduler.scheduledAgentControlSummary?.includeReadModels === false, 'HTTP scheduler start status must expose startup and scheduled Agent autonomy controls for Manager audit.');
  const schedulerStartStatus = await waitForCondition(
    async () => {
      const response = await fetch(`${httpRuntime.url}/workers/autonomous/status`);
      return response.json();
    },
    (body) => (
      body.scheduler?.agentProcessedCount >= 1
      && body.scheduler?.lastResult?.agentsProcessed?.some((item) => item.reason === 'scheduler-start-agent-sweep' && item.projectId === `${projectId}_http_scheduler_due` && item.project?.agentWorkerLedger?.[0]?.trigger === 'http-autonomous-scheduler-startup-agents')
    ),
    'HTTP scheduler start must immediately run a startup Agent sweep, not only enable the interval.',
  );
  assert(schedulerStartStatus.scheduler.lastResult.processed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.readModels?.included === false && item.readModels.managerDashboardRoute?.endsWith('/manager-dashboard')), 'HTTP scheduler startup project sweep must return lightweight manager refresh routes.');
  assert(schedulerStartStatus.scheduler.lastResult.agentsProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.readModels?.included === false && item.readModels.agentDashboardRoute?.includes('/agents/')), 'HTTP scheduler startup Agent sweep must return lightweight Agent refresh routes.');
  assert(schedulerStartStatus.scheduler.lastResult.agentsProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.agentId === 'turing' && item.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1' && item.strategyDecision?.controls?.workArtifactType === 'brainstorm-board'), 'HTTP scheduler startup sweep must forward autonomous strategy controls from the start request body.');
  assert(schedulerStartStatus.scheduler.lastResult.agentsProcessed.some((item) => item.projectId === `${projectId}_http_scheduler_due` && item.agentId === 'turing' && item.workSubmission?.artifactType === 'brainstorm-board' && item.workSubmission?.taskId === 'http_scheduler_start_submission_task'), 'HTTP scheduler startup sweep must forward submission controls and create a standard Agent submission node.');
  assert(schedulerStartStatus.scheduler.lastResult.agentAutonomousActionQueues?.some((queue) => queue.projectId === `${projectId}_http_scheduler_due` && queue.backendRoutes?.agentAutonomousActionQueue?.endsWith('/agent-autonomous-action-queue')), 'HTTP scheduler startup status must retain the Agent autonomous action queue for C-side follow-up controls.');
  assert(schedulerStartStatus.scheduler.lastTickAgentControlSummary?.useAgentAutonomousStrategy === true
    && schedulerStartStatus.scheduler.lastTickAgentControlSummary.workArtifactType === 'brainstorm-board'
    && schedulerStartStatus.scheduler.lastTickAgentControlSummary.projectScoped === true, 'HTTP scheduler startup sweep status must retain the actual Agent autonomy controls used by the first run.');
  httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/stop`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.scheduler.enabled === false, 'HTTP scheduler stop endpoint must disable the autonomous loop.');
  checkpoint('HTTP scheduler autostart controls');
  const httpAutostartProjectId = `${projectId}_http_scheduler_autostart`;
  const httpAutostartProject = hydrateAgentProject({
    id: httpAutostartProjectId,
    name: 'HTTP Scheduler Autostart Validation',
    brief,
    team: confirmedTeam,
    tasks: [
      {
        id: 'http_scheduler_autostart_submission_task',
        text: 'Create brainstorm autostart board for the generic product-team workflow',
        assignee: 'Alan Turing',
        ownerId: 'turing',
        status: 'in-progress',
        workPulseCount: 1,
      },
    ],
    agentStates: {
      turing: {
        agentId: 'turing',
        name: 'Alan Turing',
        role: 'System Architect',
        nextAgentRunAt: '2026-05-28T19:00:00.000Z',
        inbox: [],
        worklog: [],
        taskIds: ['http_scheduler_autostart_submission_task'],
        currentPlan: {
          taskId: 'http_scheduler_autostart_submission_task',
          focus: 'Create brainstorm autostart board for the generic product-team workflow',
        },
        obligations: [
          {
            id: 'http_scheduler_autostart_submission_obligation',
            taskId: 'http_scheduler_autostart_submission_task',
            text: 'Create brainstorm autostart board for the generic product-team workflow',
            status: 'open',
          },
        ],
      },
      curie: {
        agentId: 'curie',
        name: 'Marie Curie',
        role: 'Evidence Reviewer',
        nextAgentRunAt: '2026-05-28T19:00:00.000Z',
        inbox: [],
        worklog: [],
        obligations: [],
      },
    },
  });
  const httpAutostartStorePath = new URL('../.tmp/agent-manager-http-autostart-store.json', import.meta.url);
  const autostartHttpServer = createAgentProjectHttpServer({
    filePath: httpAutostartStorePath,
    projects: [httpAutostartProject],
    autonomousScheduler: {
      enabled: true,
      intervalMs: 60_000,
      runImmediately: true,
      projectId: httpAutostartProjectId,
      includeReadModels: false,
      useAgentAutonomousStrategy: true,
      submitAgentWorkArtifacts: true,
      agentWorkArtifactType: 'brainstorm-board',
      agentWorkArtifactReviewerAgentId: 'curie',
      respondToReviewObligations: true,
      reviewResponseArtifactType: 'revision-note',
      reviewResponseReviewerAgentId: 'curie',
    },
  });
  const autostartRuntime = await autostartHttpServer.listen();
  try {
    const autostartStatus = await waitForCondition(
      async () => {
        const response = await fetch(`${autostartRuntime.url}/workers/autonomous/status`);
        return response.json();
      },
      (body) => body.scheduler?.lastStartedRunImmediately === true
        && body.scheduler?.lastResult?.agentsProcessed?.some((item) => (
          item.projectId === httpAutostartProjectId
          && item.agentId === 'turing'
          && item.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1'
          && item.strategyDecision?.controls?.workArtifactType === 'brainstorm-board'
          && item.workSubmission?.artifactType === 'brainstorm-board'
        )),
      'HTTP scheduler autostart must preserve startup Agent strategy/submission controls for unattended operation.',
      { timeoutMs: 5000 },
    );
    assert(autostartStatus.scheduler.startupAgentControlSummary?.useAgentAutonomousStrategy === true
      && autostartStatus.scheduler.startupAgentControlSummary.workArtifactType === 'brainstorm-board'
      && autostartStatus.scheduler.startupAgentControlSummary.respondToReviewObligations === true
      && autostartStatus.scheduler.scheduledAgentControlSummary?.includeReadModels === false
      && autostartStatus.scheduler.lastTickAgentControlSummary?.workArtifactType === 'brainstorm-board', 'HTTP scheduler autostart status must expose configured and last-used Agent autonomy controls.');
    assert(autostartStatus.scheduler.lastResult.processed.some((item) => item.projectId === httpAutostartProjectId && item.readModels?.included === false), 'HTTP scheduler autostart project sweep must keep lightweight read-model receipts.');
    assert(autostartStatus.scheduler.lastResult.agentsProcessed.some((item) => item.projectId === httpAutostartProjectId && item.readModels?.included === false && item.readModels.agentDashboardRoute?.includes('/agents/')), 'HTTP scheduler autostart Agent sweep must keep lightweight Agent read-model routes.');
    const autostartProjectAfterRun = autostartRuntime.api.service.getProject(httpAutostartProjectId);
    assert(autostartProjectAfterRun.agentSubmissions?.some((submission) => submission.artifactType === 'brainstorm-board' && submission.taskId === 'http_scheduler_autostart_submission_task'), 'HTTP scheduler autostart must persist the standard Agent submission node.');
  } finally {
    await autostartHttpServer.close();
  }
} finally {
  await httpServer.close();
}
persistedSnapshot = JSON.parse(readFileSync(httpStorePath, 'utf8'));
assert(persistedSnapshot.messages.some((message) => message.id === 'http_google_source'), 'HTTP server must persist chat messages to the file-backed store.');
assert(persistedSnapshot.projects.find((project) => project.id === projectId)?.autonomousSchedulerLedger?.some((record) => record.trigger === 'http-due-worker'), 'HTTP server must persist due-worker scheduler state.');
assert(persistedSnapshot.projects.find((project) => project.id === `${projectId}_http_scheduler_due`)?.autonomousSchedulerLedger?.some((record) => record.trigger === 'http-scheduler-tick'), 'HTTP scheduler tick endpoint must persist processed project state.');
assert(persistedSnapshot.projects.find((project) => project.id === `${projectId}_http_scheduler_due`)?.agentWorkerLedger?.some((record) => record.trigger === 'http-scheduler-tick-agents'), 'HTTP scheduler tick endpoint must persist processed Agent worker state.');
checkpoint('restarted HTTP readback');
const restartedHttpServer = createAgentProjectHttpServer({ filePath: httpStorePath });
const restartedHttpRuntime = await restartedHttpServer.listen();
try {
  const httpResponse = await fetch(`${restartedHttpRuntime.url}/projects/${projectId}/readiness`);
  const httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.readiness.status === 'manager-ready', 'Restarted HTTP server must reload persisted project readiness.');
  const proofMapResponse = await fetch(`${restartedHttpRuntime.url}/projects/${projectId}/readiness-proof-map`);
  const proofMapBody = await proofMapResponse.json();
  assert(proofMapResponse.status === 200 && proofMapBody.routes.some((route) => route.checkId === 'event-ledger-continuity' && route.proofKind === 'event-ledger' && route.eventIds.length > 0), 'Restarted HTTP server must reload readiness proof-map event ledger routes.');
  const dashboardResponse = await fetch(`${restartedHttpRuntime.url}/projects/${projectId}/manager-dashboard`);
  const dashboardBody = await dashboardResponse.json();
  assert(dashboardResponse.status === 200 && dashboardBody.timeline.eventLedgerSummary.contiguous && dashboardBody.backendRoutes.tasks.endsWith('/tasks'), 'Restarted HTTP server must reload manager dashboard route and ledger summaries.');
} finally {
  await restartedHttpServer.close();
}
checkpoint('HTTP kickoff session');
const kickoffHttpStorePath = new URL('../.tmp/agent-manager-kickoff-http-store.json', import.meta.url);
const kickoffHttpRuntimeRoot = fileURLToPath(new URL('../.tmp/agent-manager-kickoff-http-runtime', import.meta.url));
const kickoffHttpWorkspaceRoot = fileURLToPath(new URL('../.tmp/agent-manager-kickoff-http-workspace', import.meta.url));
mkdirSync(kickoffHttpWorkspaceRoot, { recursive: true });
const kickoffHttpServer = createAgentProjectHttpServer({
  filePath: kickoffHttpStorePath,
  replaceWithSeed: true,
  projectRuntime: createLocalProjectRuntime({
    rootPath: kickoffHttpRuntimeRoot,
    enableCommandExecution: true,
    allowedCommands: ['node'],
  }),
});
const kickoffHttpRuntime = await kickoffHttpServer.listen();
const kickoffProjectId = 'http_kickoff_project';
try {
  const kickoffSessionResponse = await fetch(`${kickoffHttpRuntime.url}/kickoff-meetings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      meetingId: 'http_kickoff_meeting_session',
      projectId: 'http_kickoff_session_project',
      name: 'HTTP Kickoff Meeting Session Project',
      brief: 'Run the initiation meeting as a durable backend session before manager approval.',
      team,
      selectedLeaderId: 'musk',
      reviewerId: 'curie',
      now: '2026-05-28T18:50:00.000Z',
      tasks: [
        { id: 'http_kickoff_session_task_1', text: 'Turn approved session transcript into project evidence', assignee: 'Alan Turing', status: 'pending' },
      ],
    }),
  });
  const kickoffSessionBody = await kickoffSessionResponse.json();
  assert(kickoffSessionResponse.status === 200 && kickoffSessionBody.meeting.status === 'awaiting-manager-decision', 'HTTP server must create durable kickoff meeting sessions.');
  assert(kickoffSessionBody.meeting.generationProvenance?.schemaVersion === 'kickoff-generation-provenance/v1' && kickoffSessionBody.meeting.generationProvenance.productionClaim === 'blocked' && kickoffSessionBody.meeting.generationProvenance.deterministicFallback === true, 'HTTP kickoff meeting sessions must label deterministic validation fallback separately from production provider-backed meetings.');
  assert(kickoffSessionBody.meeting.transcript.some((turn) => turn.stage === 'role-clarification') && kickoffSessionBody.meeting.transcript.some((turn) => turn.stage === 'leader-campaign'), 'HTTP kickoff meeting sessions must expose role and Leader campaign transcript evidence.');
  const kickoffSessionReadResponse = await fetch(`${kickoffHttpRuntime.url}/kickoff-meetings/http_kickoff_meeting_session`);
  const kickoffSessionReadBody = await kickoffSessionReadResponse.json();
  assert(kickoffSessionReadResponse.status === 200 && kickoffSessionReadBody.meeting.evidence.hearingEdgeCount > 0, 'HTTP server must read kickoff meeting session hearing evidence before approval.');
  const kickoffSessionClarifyResponse = await fetch(`${kickoffHttpRuntime.url}/kickoff-meetings/http_kickoff_meeting_session/clarify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      questionId: kickoffSessionReadBody.meeting.transcript.find((turn) => turn.stage === 'role-clarification')?.id,
      text: 'HTTP clarification: the integration owner and evidence reviewer are confirmed before project approval.',
      now: '2026-05-28T18:52:00.000Z',
    }),
  });
  const kickoffSessionClarifyBody = await kickoffSessionClarifyResponse.json();
  assert(kickoffSessionClarifyResponse.status === 200 && kickoffSessionClarifyBody.meeting.evidence.clarificationIds.length === 1, 'HTTP server must persist kickoff meeting manager clarifications before approval.');
  const kickoffSessionNextActionsResponse = await fetch(`${kickoffHttpRuntime.url}/kickoff-meetings/http_kickoff_meeting_session/next-actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tasks: [
        { id: 'http_kickoff_session_task_1', text: 'HTTP manager confirmed next-action packet', assignee: 'Elon Musk', ownerId: 'musk', status: 'pending' },
      ],
      now: '2026-05-28T18:53:00.000Z',
    }),
  });
  const kickoffSessionNextActionsBody = await kickoffSessionNextActionsResponse.json();
  assert(kickoffSessionNextActionsResponse.status === 200 && kickoffSessionNextActionsBody.route === 'kickoff-meeting-next-actions-confirmed' && kickoffSessionNextActionsBody.meeting.nextActionResolution.managerConfirmed, 'HTTP server must persist kickoff meeting next-action resolution before approval.');
  const kickoffSessionApproveResponse = await fetch(`${kickoffHttpRuntime.url}/kickoff-meetings/http_kickoff_meeting_session/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      selectedLeaderId: 'musk',
      reviewerId: 'curie',
      now: '2026-05-28T18:55:00.000Z',
    }),
  });
  const kickoffSessionApproveBody = await kickoffSessionApproveResponse.json();
  assert(kickoffSessionApproveResponse.status === 200 && kickoffSessionApproveBody.route === 'kickoff-meeting-approved', 'HTTP server must approve kickoff meeting sessions into runnable projects.');
  assert(kickoffSessionApproveBody.meeting.approvedProjectId === 'http_kickoff_session_project' && kickoffSessionApproveBody.project.team.find((agent) => agent.id === 'musk')?.isLeader, 'HTTP kickoff meeting approval must link the session to a project with a Leader marker.');
  assert(kickoffSessionApproveBody.managerDashboard?.kickoffExecutionFlow?.firstPulse?.started, 'HTTP kickoff meeting approval must return manager-dashboard first-pulse evidence.');
  assert(kickoffSessionApproveBody.managerDashboard?.kickoffExecutionFlow?.nextActionResolution?.managerConfirmed && kickoffSessionApproveBody.project.initiation?.nextActionResolution?.actionIds?.includes('http_kickoff_session_task_1'), 'HTTP kickoff meeting approval must carry next-action resolution into the project and manager dashboard.');
  assert(kickoffSessionApproveBody.project.initiation?.generationProvenance?.schemaVersion === 'kickoff-generation-provenance/v1' && kickoffSessionApproveBody.managerDashboard?.kickoffMeetingFlow?.generationProvenance?.productionClaim === 'blocked', 'HTTP kickoff meeting approval must carry generation provenance into the project and manager dashboard.');
  assert(kickoffSessionApproveBody.managerDashboard?.kickoffExecutionFlow?.nextActionResolutionDelivery?.allAgentsReceived && kickoffSessionApproveBody.project.team.every((agent) => kickoffSessionApproveBody.project.agentStates?.[agent.id]?.inbox?.some((item) => item.sourceMessageId === 'decision_http_kickoff_session_project_next_actions')), 'HTTP kickoff meeting approval must deliver next-action decisions into every Agent inbox.');
  assert(kickoffSessionApproveBody.managerDashboard?.kickoffMeetingFlow?.conversationRows?.some((row) => row.stage === 'director-clarification' && /integration owner/i.test(row.text || '')), 'HTTP kickoff meeting approval must return manager clarification conversation evidence.');

  const kickoffResponse = await fetch(`${kickoffHttpRuntime.url}/projects/initiate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: kickoffProjectId,
      name: 'HTTP Kickoff Project',
      brief: 'Create a backend-first manager kickoff project with visible role negotiation, Leader election, assignments, and first autonomous pulse.',
      team,
      selectedLeaderId: 'musk',
      reviewerId: 'curie',
      now: '2026-05-28T19:00:00.000Z',
      includeReadModels: false,
      tasks: [
        { id: 'http_kickoff_task_1', text: 'Prepare backend kickoff evidence packet', assignee: 'Alan Turing', status: 'pending' },
        { id: 'http_kickoff_task_2', text: 'Review kickoff timeline proof', assignee: 'Marie Curie', status: 'pending' },
      ],
    }),
  });
  const kickoffBody = await kickoffResponse.json();
  assert(kickoffResponse.status === 200 && kickoffBody.route === 'kickoff-project-created', 'HTTP server must create projects through the backend kickoff endpoint.');
  assert(kickoffBody.project.team.find((agent) => agent.id === 'musk')?.isLeader, 'Backend kickoff endpoint must persist the Director-confirmed Leader marker.');
  assert(kickoffBody.project.initiation.roleNegotiation.transcript.some((item) => item.type === 'role-question'), 'Backend kickoff endpoint must produce role-clarification evidence.');
  assert(kickoffBody.project.initiation.leaderElection.transcript.every((item) => item.type === 'leader-campaign'), 'Backend kickoff endpoint must produce Leader campaign evidence.');
  assert(kickoffBody.project.initiation.nextActionResolution?.managerConfirmed && kickoffBody.project.initiation.nextActionResolution.actionIds.includes('http_kickoff_task_1'), 'Backend kickoff endpoint must produce confirmed next-action resolution evidence.');
  assert(kickoffBody.readModels?.included === false && kickoffBody.readModels.projectRoute?.endsWith(`/projects/${kickoffProjectId}`) && kickoffBody.readModels.mainTranscriptRoute?.endsWith('/transcripts/main') && kickoffBody.readModels.managerDashboardRoute?.endsWith('/manager-dashboard'), 'Backend kickoff endpoint must support lightweight project/transcript/manager refresh routes.');
  assert(!kickoffBody.managerDashboard && !kickoffBody.managerReadyPackage, 'Backend kickoff endpoint must not embed large Manager read models when includeReadModels is false.');
  const kickoffInitiationDashboardResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/manager-dashboard`);
  const kickoffInitiationDashboardBody = await kickoffInitiationDashboardResponse.json();
  assert(kickoffInitiationDashboardResponse.status === 200 && kickoffInitiationDashboardBody.kickoffExecutionFlow?.nextActionResolutionDelivery?.allAgentsReceived && kickoffBody.project.team.every((agent) => kickoffBody.project.agentStates?.[agent.id]?.obligations?.some((item) => item.sourceMessageId === 'decision_http_kickoff_project_next_actions')), 'Backend kickoff endpoint read-model refresh must expose confirmed next-action delivery into every Agent obligation list.');
  assert(kickoffBody.project.kickoffCharter?.governance?.leaderId === 'musk', 'Backend kickoff endpoint must persist kickoff charter governance.');
  assert(kickoffBody.roleNegotiation?.transcript?.length > 0 && kickoffBody.leaderElection?.transcript?.length > 0, 'Backend kickoff endpoint must return meeting and Leader election details for UI approval flows.');
  assert(kickoffBody.kickoffCharter?.governance?.leaderId === 'musk' && kickoffBody.assignmentPackage?.assignmentMessages?.length > 0, 'Backend kickoff endpoint must return charter and assignment package details.');
  assert(kickoffBody.project.eventLedger.some((event) => event.type === 'kickoff-role-question'), 'Backend kickoff endpoint must write kickoff role questions to the unified event ledger.');
  assert(kickoffBody.project.eventLedger.some((event) => event.type === 'kickoff-leader-campaign'), 'Backend kickoff endpoint must write Leader campaigns to the unified event ledger.');
  assert(kickoffBody.project.eventLedger.some((event) => event.type === 'leader-assignment'), 'Backend kickoff endpoint must write Leader assignments to the unified event ledger.');
  assert(kickoffBody.messages.some((message) => message.time === 'First Pulse'), 'Backend kickoff endpoint must publish the first autonomous pulse into chat messages.');
  assert(kickoffBody.project.autonomousSchedulerLedger?.[0]?.trigger === 'initiation-approval', 'Backend kickoff endpoint must immediately start the first autonomous work pulse.');
  assert(kickoffInitiationDashboardBody.kickoffMeetingFlow?.leaderMarkerPersisted && kickoffInitiationDashboardBody.assignmentFlow?.rows?.some((row) => row.taskId === 'http_kickoff_task_1'), 'Backend kickoff command read-model refresh must include manager-dashboard kickoff and assignment flow data.');
  assert(kickoffInitiationDashboardBody.kickoffExecutionFlow?.firstPulse?.started && kickoffInitiationDashboardBody.kickoffExecutionFlow?.nextActions?.some((row) => row.id === 'http_kickoff_task_1'), 'Backend kickoff command read-model refresh must include kickoff execution flow and first-pulse proof.');
  assert(kickoffBody.project.initiation?.generationProvenance?.schemaVersion === 'kickoff-generation-provenance/v1'
    && kickoffInitiationDashboardBody.kickoffMeetingFlow?.generationProvenance?.productionClaim === 'blocked',
  'Backend kickoff command read-model refresh must preserve kickoff generation provenance into the project and Manager Dashboard.');

  const kickoffGetResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}`);
  const kickoffGetBody = await kickoffGetResponse.json();
  assert(kickoffGetResponse.status === 200 && kickoffGetBody.messages.some((message) => message.time === 'First Pulse'), 'Backend kickoff project must be retrievable with its kickoff chat evidence.');
  const kickoffRuntimeResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/local-runtime`);
  const kickoffRuntimeBody = await kickoffRuntimeResponse.json();
  assert(kickoffRuntimeResponse.status === 200 && existsSync(kickoffRuntimeBody.localRuntime.memoryPath), 'HTTP backend must create a project-scoped local memory folder.');
  const kickoffBindResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/workspace/bind`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      workspacePath: kickoffHttpWorkspaceRoot,
      now: '2026-05-28T19:01:00.000Z',
    }),
  });
  const kickoffBindBody = await kickoffBindResponse.json();
  assert(kickoffBindResponse.status === 200 && kickoffBindBody.localRuntime.workspacePath === kickoffHttpWorkspaceRoot, 'HTTP backend must bind a local workspace folder.');
  const kickoffWriteResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/workspace/write`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      path: 'proof/http-local-edit.md',
      content: 'HTTP local workspace edit proof',
    }),
  });
  const kickoffWriteBody = await kickoffWriteResponse.json();
  assert(kickoffWriteResponse.status === 200 && kickoffWriteBody.file.path === 'proof/http-local-edit.md', 'HTTP backend must write files inside a bound local workspace.');
  const kickoffReadResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/workspace/read`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'proof/http-local-edit.md' }),
  });
  const kickoffReadBody = await kickoffReadResponse.json();
  assert(kickoffReadResponse.status === 200 && /workspace edit proof/.test(kickoffReadBody.content), 'HTTP backend must read files from a bound local workspace.');
  const kickoffExecResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/workspace/exec`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      command: 'node',
      args: ['-e', 'console.log("http-workspace-exec-ok")'],
    }),
  });
  const kickoffExecBody = await kickoffExecResponse.json();
  assert(kickoffExecResponse.status === 200 && kickoffExecBody.status === 0 && /http-workspace-exec-ok/.test(kickoffExecBody.stdout), 'HTTP backend must execute allowed workspace commands when explicitly enabled.');
  const kickoffTranscriptIndexResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/transcripts`);
  const kickoffTranscriptIndexBody = await kickoffTranscriptIndexResponse.json();
  assert(kickoffTranscriptIndexResponse.status === 200 && kickoffTranscriptIndexBody.recoverableProofCount > 0 && kickoffTranscriptIndexBody.channels.some((channel) => channel.channelId === 'main' && channel.messageCount > 0 && channel.totalProofCount >= channel.messageCount), 'Backend API must expose transcript index with current and recoverable main-channel proof.');
  const kickoffMainTranscriptResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/transcripts/main`);
  const kickoffMainTranscriptBody = await kickoffMainTranscriptResponse.json();
  assert(kickoffMainTranscriptResponse.status === 200 && kickoffMainTranscriptBody.messages.length > 0 && kickoffMainTranscriptBody.summary.totalProofCount >= kickoffMainTranscriptBody.messages.length, 'Backend API must expose per-channel transcript messages plus recoverable proof summary.');
  const kickoffProofMapResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/readiness-proof-map`);
  const kickoffProofMapBody = await kickoffProofMapResponse.json();
  assert(kickoffProofMapResponse.status === 200 && kickoffProofMapBody.routes.some((route) => route.checkId === 'role-clarification' && route.proofKind === 'transcript' && route.proofIds.length > 0), 'Backend kickoff API must expose readiness proof-map kickoff transcript routes.');
  assert(kickoffProofMapBody.routes.some((route) => route.checkId === 'leader-assignments-acknowledged' && route.taskIds.includes('http_kickoff_task_1')), 'Backend kickoff API must expose readiness proof-map assignment task routes.');
  const kickoffDashboardResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/manager-dashboard`);
  const kickoffDashboardBody = await kickoffDashboardResponse.json();
  assert(kickoffDashboardResponse.status === 200 && kickoffDashboardBody.kickoffMeetingFlow.leaderMarkerPersisted && kickoffDashboardBody.assignmentFlow.rows.some((row) => row.taskId === 'http_kickoff_task_1'), 'Backend kickoff API must expose manager dashboard kickoff and assignment flow read models.');
  assert(kickoffDashboardResponse.status === 200 && kickoffDashboardBody.kickoffExecutionFlow.firstPulse.started && kickoffDashboardBody.kickoffExecutionFlow.assignmentRows.some((row) => row.taskId === 'http_kickoff_task_1'), 'Backend kickoff API must expose kickoff execution flow from assignment to first pulse.');
  const agentListResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents`);
  const agentListBody = await agentListResponse.json();
  assert(agentListResponse.status === 200 && agentListBody.agents.length === team.length, 'Backend API must expose independent Agent states for a project.');
  const turingInboxResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents/turing/inbox`);
  const turingInboxBody = await turingInboxResponse.json();
  assert(turingInboxResponse.status === 200 && turingInboxBody.inbox.some((item) => item.taskId === 'http_kickoff_task_1'), 'Mentioned Agent must expose assigned work through its own inbox endpoint.');
  const curiePlanResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents/curie/plan`);
  const curiePlanBody = await curiePlanResponse.json();
  assert(curiePlanResponse.status === 200 && curiePlanBody.currentPlan?.routine?.id, 'Agent plan endpoint must expose the Agent fixed work routine.');
  const turingWorklogResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents/turing/worklog`);
  const turingWorklogBody = await turingWorklogResponse.json();
  assert(turingWorklogResponse.status === 200 && turingWorklogBody.worklog.length > 0, 'Agent worklog endpoint must expose private work evidence.');
  const turingDashboardResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents/turing/dashboard`);
  const turingDashboardBody = await turingDashboardResponse.json();
  assert(turingDashboardResponse.status === 200 && turingDashboardBody.agentId === 'turing' && turingDashboardBody.ownedTasks.some((task) => task.id === 'http_kickoff_task_1'), 'Backend API must expose a per-Agent dashboard with owned kickoff tasks.');
  assert(turingDashboardBody.inbox.some((item) => item.taskId === 'http_kickoff_task_1') && turingDashboardBody.proof.timelineLogIds.length > 0, 'Per-Agent dashboard must include Agent inbox and timeline proof.');
  assert(turingDashboardBody.backendRoutes.dashboard.endsWith('/agents/turing/dashboard'), 'Per-Agent dashboard must include its own backend route hint.');
  const httpAgentMessageResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents/musk/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      targetAgentIds: ['turing'],
      channelId: 'main',
      text: 'Coordination note: keep the HTTP Agent-to-Agent proof visible.',
      now: '2026-05-28T19:18:00.000Z',
      messageId: 'http_agent_to_agent_source',
    }),
  });
  const httpAgentMessageBody = await httpAgentMessageResponse.json();
  assert(httpAgentMessageResponse.status === 200 && httpAgentMessageBody.route === 'agent-message' && httpAgentMessageBody.messages.some((message) => message.authorId === 'musk'), 'HTTP backend must expose Agent-to-Agent message publishing.');
  const turingDashboardAfterAgentMessageResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents/turing/dashboard`);
  const turingDashboardAfterAgentMessageBody = await turingDashboardAfterAgentMessageResponse.json();
  assert(turingDashboardAfterAgentMessageResponse.status === 200 && turingDashboardAfterAgentMessageBody.inbox.some((item) => item.sourceMessageId === 'http_agent_to_agent_source'), 'HTTP Agent-to-Agent messages must arrive in the target Agent dashboard inbox.');
  const kickoffTimelineResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/timeline`);
  const kickoffTimelineBody = await kickoffTimelineResponse.json();
  assert(kickoffTimelineResponse.status === 200 && kickoffTimelineBody.logs.some((log) => log.eventType === 'leader-assignment'), 'Backend API must expose Leader assignments through the project timeline endpoint.');
  assert(kickoffTimelineBody.logs.some((log) => log.eventType === 'management-check-in'), 'Backend API timeline endpoint must expose autonomous management-loop evidence.');
  const kickoffEventsResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/events`);
  const kickoffEventsBody = await kickoffEventsResponse.json();
  assert(kickoffEventsResponse.status === 200 && kickoffEventsBody.eventLedger.some((event) => event.type === 'kickoff-role-question'), 'Backend API must expose kickoff role questions through the event-ledger endpoint.');
  assert(kickoffEventsBody.summary.coverage.leaderAssignment && kickoffEventsBody.summary.contiguous, 'Backend API event-ledger summary must expose contiguous assignment evidence.');
  const kickoffTasksResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/tasks`);
  const kickoffTasksBody = await kickoffTasksResponse.json();
  assert(kickoffTasksResponse.status === 200 && kickoffTasksBody.tasks.some((task) => task.id === 'http_kickoff_task_1'), 'Backend API must expose project tasks independently.');
  const kickoffTaskResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/tasks/http_kickoff_task_1`);
  const kickoffTaskBody = await kickoffTaskResponse.json();
  assert(kickoffTaskResponse.status === 200 && kickoffTaskBody.task.assignee === 'Alan Turing', 'Backend API must expose a single task by id.');
  const kickoffTaskEvidenceResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/tasks/http_kickoff_task_1/evidence`);
  const kickoffTaskEvidenceBody = await kickoffTaskEvidenceResponse.json();
  assert(kickoffTaskEvidenceResponse.status === 200 && kickoffTaskEvidenceBody.task.id === 'http_kickoff_task_1', 'Backend API must expose task evidence by id.');
  assert(kickoffTaskEvidenceBody.messages.some((message) => /Prepare backend kickoff evidence packet/.test(message.text)), 'Task evidence endpoint must include the source assignment message.');
  assert(kickoffTaskEvidenceBody.logs.some((log) => log.eventType === 'leader-assignment'), 'Task evidence endpoint must include linked timeline logs.');
  assert(kickoffTaskEvidenceBody.events.some((event) => event.type === 'leader-assignment'), 'Task evidence endpoint must include linked event-ledger entries.');
  const directMentionResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channelId: 'main',
      text: '@Alan Turing please prepare the independent Agent inbox proof',
      now: '2026-05-28T19:20:00.000Z',
      messageId: 'http_agent_inbox_probe',
    }),
  });
  const directMentionBody = await directMentionResponse.json();
  assert(directMentionResponse.status === 200 && directMentionBody.route === 'ordinary-chat', 'Direct @Agent chat through HTTP must route as ordinary chat when no special command is present.');
  const updatedTuringInboxResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents/turing/inbox`);
  const updatedTuringInboxBody = await updatedTuringInboxResponse.json();
  assert(updatedTuringInboxBody.inbox.some((item) => item.sourceMessageId === 'http_agent_inbox_probe'), 'Direct @Agent chat must appear in the target Agent inbox endpoint.');
  const httpAgentAssignmentResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channelId: 'main',
      text: 'leader assign @Alan Turing run HTTP independent Agent worker proof',
      now: '2026-05-28T19:25:00.000Z',
      messageId: 'http_agent_worker_assignment_source',
    }),
  });
  const httpAgentAssignmentBody = await httpAgentAssignmentResponse.json();
  assert(httpAgentAssignmentResponse.status === 200 && httpAgentAssignmentBody.route === 'leader-assignment', 'HTTP backend must create Agent-owned work before an independent Agent pulse.');
  const httpAgentTaskId = httpAgentAssignmentBody.responses.leaderAssignmentResponse.task.id;
  assert(httpAgentAssignmentBody.responses.leaderAssignmentStartWorkResponse?.cycle?.trigger === 'leader-assignment-start-work', 'HTTP Leader assignment must immediately start the assigned Agent work pulse.');
  const firstHttpAgentPulseResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents/turing/work-cycle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-05-28T19:26:00.000Z',
      trigger: 'http-agent-worker',
    }),
  });
  const firstHttpAgentPulseBody = await firstHttpAgentPulseResponse.json();
  assert(firstHttpAgentPulseResponse.status === 200 && firstHttpAgentPulseBody.route === 'agent-work-cycle', 'HTTP backend must expose an independent per-Agent worker endpoint.');
  assert(firstHttpAgentPulseBody.messages.some((message) => message.agentWorker?.agentId === 'turing'), 'HTTP per-Agent worker endpoint must return visible group-chat proof.');
  assert(firstHttpAgentPulseBody.task?.id === httpAgentTaskId && firstHttpAgentPulseBody.task.status === 'done', 'First explicit HTTP per-Agent worker pulse after assignment-start work must complete Agent-owned work.');
  const secondHttpAgentPulseResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/agents/turing/work-cycle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-05-28T19:27:00.000Z',
      trigger: 'http-agent-worker',
    }),
  });
  const secondHttpAgentPulseBody = await secondHttpAgentPulseResponse.json();
  assert(secondHttpAgentPulseResponse.status === 200 && secondHttpAgentPulseBody.project.agentWorkerLedger?.[0]?.agentId === 'turing', 'HTTP per-Agent worker endpoint must keep Agent-owned work pulses moving after completion.');
  const httpAgentTaskEvidenceResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/tasks/${httpAgentTaskId}/evidence`);
  const httpAgentTaskEvidenceBody = await httpAgentTaskEvidenceResponse.json();
  assert(httpAgentTaskEvidenceResponse.status === 200 && httpAgentTaskEvidenceBody.messages.some((message) => message.agentWorker?.agentId === 'turing'), 'HTTP task evidence must include per-Agent worker chat proof.');
  assert(httpAgentTaskEvidenceBody.events.some((event) => event.type === 'agent-task-completed'), 'HTTP task evidence must include per-Agent worker completion events.');
  const kickoffArchiveResponse = await fetch(`${kickoffHttpRuntime.url}/projects/${kickoffProjectId}/local-runtime/archive`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      reason: 'http-kickoff-validation-archive',
      now: '2026-05-28T19:28:00.000Z',
    }),
  });
  const kickoffArchiveBody = await kickoffArchiveResponse.json();
  assert(kickoffArchiveResponse.status === 200 && kickoffArchiveBody.project.status === 'archived' && existsSync(kickoffArchiveBody.localRuntime.latestArchivePath), 'HTTP backend must create a project-scoped archive snapshot.');
} finally {
  await kickoffHttpServer.close();
}
persistedSnapshot = JSON.parse(readFileSync(kickoffHttpStorePath, 'utf8'));
const persistedKickoffProject = persistedSnapshot.projects.find((project) => project.id === kickoffProjectId);
assert(persistedKickoffProject?.team.find((agent) => agent.id === 'musk')?.isLeader, 'File-backed HTTP kickoff endpoint must persist the Leader marker to disk.');
assert(persistedSnapshot.messages.some((message) => message.projectId === kickoffProjectId && message.time === 'First Pulse'), 'File-backed HTTP kickoff endpoint must persist first-pulse chat evidence.');
assert(persistedKickoffProject.agentStates?.turing?.inbox?.some((item) => item.sourceMessageId === 'http_agent_inbox_probe'), 'File-backed HTTP Agent endpoint must persist direct inbox updates.');
assert(persistedSnapshot.messages.some((message) => message.projectId === kickoffProjectId && message.agentWorker?.agentId === 'turing'), 'File-backed HTTP Agent worker endpoint must persist per-Agent chat proof.');
assert(persistedKickoffProject.agentWorkerLedger?.[0]?.agentId === 'turing', 'File-backed HTTP Agent worker endpoint must persist per-Agent worker ledger state.');

const assignmentText = assignmentPackage.assignmentMessages.map((message) => message.text).join(' ');
assertIncludes(assignmentText, /@/, 'Leader assignment transcript must include mentions');

console.log('Agent manager scenario validation passed.');
