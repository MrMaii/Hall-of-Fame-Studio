import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runRoundtableExchange } from '../src/agents/agentRuntime.js';
import { submitProjectMeetingMessage } from '../src/agents/agentProjectService.js';
import { MEETING_TURN_GRACE_PERIOD_MS, meetingTurnDelayMs } from '../src/agents/meetingQueueProtocol.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const appSource = readFileSync(resolve(repoRoot, 'src', 'App.jsx'), 'utf8');

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary', capabilities: ['product'] },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', capabilities: ['implementation'] },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', capabilities: ['review'] },
  { id: 'confucius', name: 'Confucius', role: 'Consensus Steward', capabilities: ['orchestration'] },
];

const exchange = runRoundtableExchange(team, 'We need to decide how the onboarding flow should work.', {
  projectId: 'smart_meeting_contract_project',
  projectName: 'Smart Meeting Contract',
  meetingType: 'sync',
  language: 'en',
});

assert(exchange.intentions.length === team.length, 'Every Agent must produce a speaking intention for a meeting turn.');
assert(exchange.responses.length === team.length, 'Every queued Agent must eventually receive a meeting response turn.');
assert(exchange.responses.every((turn, index) => turn.delayMs === meetingTurnDelayMs(index)), 'Meeting response delays must follow the shared queue grace protocol.');
assert(exchange.responses[0].delayMs >= MEETING_TURN_GRACE_PERIOD_MS, 'The first Agent must wait for the configured grace period before speaking.');

const meetingResult = submitProjectMeetingMessage({
  project: {
    id: 'smart_meeting_contract_project',
    name: 'Smart Meeting Contract',
    team,
    tasks: [],
    logs: [],
    agentStates: {},
    eventLedger: [],
  },
  text: '@all Please queue your responses before speaking.',
  now: '2026-07-08T12:00:00.000Z',
  messageId: 'smart_meeting_user_message',
  language: 'en',
});

assert(meetingResult.messages[0]?.id === 'smart_meeting_user_message', 'The Director meeting message must be the first persisted message.');
assert(meetingResult.meetingAgentTurns.length === team.length, 'Backend meeting service must persist every queued Agent turn.');
assert(meetingResult.meetingAgentTurns.every((turn, index) => turn.delayMs === meetingTurnDelayMs(index)), 'Backend meeting turns must expose the same queue grace delays as the runtime.');
assert(meetingResult.meetingAgentTurns.every((turn) => turn.timelineLogIds?.length >= 1), 'Backend meeting turns must retain timeline proof ids.');

const loadInitialProjectsStart = appSource.indexOf('const loadInitialProjects = () =>');
const loadInitialProjectsEnd = appSource.indexOf('const INITIATION_MEMBERS', loadInitialProjectsStart);
const loadInitialProjectsSource = appSource.slice(loadInitialProjectsStart, loadInitialProjectsEnd);
assert(loadInitialProjectsSource.includes('isBackendManagedBrowserCacheProject'), 'The restored Dashboard must keep backend-managed projects authoritative in the local backend instead of duplicating them in browser cache.');

const canPersistProjectStart = appSource.indexOf('const canPersistProjectToBrowserCache =');
const canPersistProjectEnd = appSource.indexOf('const isUnscopedProofLikeChatMessage', canPersistProjectStart);
const canPersistProjectSource = appSource.slice(canPersistProjectStart, canPersistProjectEnd);
assert(canPersistProjectSource.includes('isBackendManagedRealProject'), 'The restored Dashboard must not write backend-managed project state into the browser-only cache.');

const submitRoomInputStart = appSource.indexOf('const submitRoomInput = async');
const submitRoomInputEnd = appSource.indexOf('const insertMention =', submitRoomInputStart);
const submitRoomInputSource = appSource.slice(submitRoomInputStart, submitRoomInputEnd);
const stageMeetingIndex = submitRoomInputSource.indexOf('stageMeetingUserTurn');
const backendMeetingIndex = submitRoomInputSource.indexOf("await runBackendProjectCommand('meeting'");
assert(stageMeetingIndex >= 0 && stageMeetingIndex < backendMeetingIndex, 'Meeting input must render the Director message before awaiting the backend Agent turns.');
assert(submitRoomInputSource.includes('queueMeetingIntentPreview'), 'Meeting input must queue visible Agent intent before awaiting backend turns.');
assert(appSource.includes('const roomUserIntentActiveRef = useRef(false);'), 'Meeting runtime must keep a ref for Director speaking or typing intent.');
assert(appSource.includes('const scheduleRoomAgentTurn = ({'), 'Meeting runtime must schedule Agent turns through the Director-precedence gate.');
assert(appSource.includes('if (roomUserIntentActiveRef.current)'), 'Queued Agent turns must defer while the Director is speaking or typing.');
assert(appSource.includes('setRoomUserIntentActive(true)'), 'Meeting input and voice controls must mark Director intent active.');
assert(appSource.includes("status: 'paused'"), 'An Agent that is already visibly speaking must be paused when Director intent begins.');

const submitChatInputStart = appSource.indexOf('const submitChatInput = async');
const submitChatInputEnd = appSource.indexOf('const createProjectTranscriptChannel = async', submitChatInputStart);
const submitChatInputSource = appSource.slice(submitChatInputStart, submitChatInputEnd);
const stageChatIndex = submitChatInputSource.indexOf('stageProjectChatUserMessage');
const backendChatIndex = submitChatInputSource.indexOf("await runBackendProjectCommand('chat'");
assert(stageChatIndex >= 0 && stageChatIndex < backendChatIndex, 'Project chat input must render the Director message before awaiting backend persistence.');

const approveInitiationStart = appSource.indexOf('const approveInitiationProject = async');
const approveInitiationEnd = appSource.indexOf('const enterProjectScene =', approveInitiationStart);
const approveInitiationSource = appSource.slice(approveInitiationStart, approveInitiationEnd);
assert(approveInitiationSource.includes('agentAutonomousActionQueue'), 'Project approval must expose the backend Agent autonomous action queue so post-initiation work is visible.');
assert(approveInitiationSource.includes('syncBackendAgentAutonomousActionQueue'), 'Project approval must refresh Agent autonomous action queue read models after kickoff autonomy starts.');

console.log('Smart meeting runtime contract passed.');
