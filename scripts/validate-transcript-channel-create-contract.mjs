import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appSource = readFileSync(resolve(repoRoot, 'src/App.jsx'), 'utf8');
const advancedProjectChatSource = readFileSync(resolve(repoRoot, 'src/project/AdvancedProjectChat.jsx'), 'utf8');
const projectId = 'transcript_channel_create_contract_project';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'transcript_channel_create_contract_mission',
    meetingId: 'transcript_channel_create_contract_meeting',
    projectId,
    name: 'Transcript Channel Create Contract Project',
    missionBrief: 'Validate backend-created Group Chat rooms for a generic product-team mission.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_channel_create', text: 'Create a dedicated brainstorm room and keep it traceable.', assignee: 'Steve Jobs', status: 'pending' },
    ],
    runInitialTick: false,
    now: '2026-06-01T09:00:00.000Z',
  },
});

assert(response.status === 200 && response.body.project?.id === projectId, 'Mission Runner must create a backend project before channel creation.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/transcripts`,
  body: {
    includeReadModels: false,
    channelId: 'brainstorm_room',
    name: 'Brainstorm Room',
    description: 'Backend-created collaboration room for generic product-team ideation.',
    category: 'text',
    actor: 'Product Director',
    actorId: 'director',
    now: '2026-06-01T09:09:00.000Z',
  },
});

assert(response.status === 200, `Transcript channel creation returned ${response.status}.`);
const channel = response.body.transcriptChannel;
const receipt = response.body.transcriptChannelReceipt;
assert(channel?.schemaVersion === 'transcript-channel/v1' && channel.channelId === 'brainstorm_room', 'Transcript channel creation must return transcript-channel/v1 metadata.');
assert(receipt?.schemaVersion === 'transcript-channel-created/v1', 'Transcript channel creation must return transcript-channel-created/v1.');
assert(receipt.messageId && receipt.timelineLogId && receipt.eventId && receipt.checksum, 'Transcript channel receipt must include chat, timeline, event, and checksum proof.');
assert(receipt.route === `/projects/${projectId}/transcripts/brainstorm_room`, 'Transcript channel receipt must expose the channel route.');
assert(response.body.messages?.some((message) => (
  message.channelId === 'brainstorm_room'
  && message.transcriptChannelReceiptId === receipt.id
  && message.transcriptChannelReceiptChecksum === receipt.checksum
)), 'Transcript channel creation must append a backend transcript system message.');
assert(response.body.project?.logs?.some((log) => (
  log.id === receipt.timelineLogId
  && log.eventType === 'transcript-channel-created'
  && log.transcriptChannelId === 'brainstorm_room'
)), 'Transcript channel creation must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => (
  event.id === receipt.eventId
  && event.type === 'transcript-channel-created'
  && event.channelId === 'brainstorm_room'
)), 'Transcript channel creation must persist an event-ledger row.');
assert(response.body.readModels?.included === false, 'Transcript channel creation must support lightweight deferred read-model responses.');
assert(response.body.readModels?.transcriptChannelRoute === `/projects/${projectId}/transcripts/brainstorm_room`, 'Deferred read models must expose the created transcript channel route.');
assert(response.body.readModels?.timelineRoute === `/projects/${projectId}/timeline`, 'Deferred read models must expose the timeline route.');
assert(response.body.readModels?.eventsRoute === `/projects/${projectId}/events`, 'Deferred read models must expose the event-ledger route.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts`,
});
assert(response.status === 200, 'Transcript index must be readable after channel creation.');
assert(response.body.channels?.some((row) => (
  row.channelId === 'brainstorm_room'
  && row.name === 'Brainstorm Room'
  && row.messageCount === 0
  && row.channelCreationReceiptCount === 1
  && row.proofIds?.includes(receipt.checksum)
  && row.apiPath === `/projects/${projectId}/transcripts/brainstorm_room`
)), 'Transcript index must expose backend-created channels with metadata and route proof.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/brainstorm_room`,
});
assert(response.status === 200, 'Created channel transcript must be readable.');
assert(response.body.messages?.length === 0, 'Operational channel-creation proof must not appear as a conversation message.');
assert(response.body.channelCreationReceipts?.some((row) => row.checksum === receipt.checksum), 'Created channel transcript must expose channel proof separately from conversation messages.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
});
assert(response.status === 200, 'Readiness Proof Map must be readable after channel creation.');
assert(response.body.transcriptChannelSummary?.readyForBackendTranscriptChannels, 'Readiness Proof Map must mark backend transcript channel creation ready.');
assert(response.body.transcriptChannelRoutes?.some((route) => (
  route.channelId === 'brainstorm_room'
  && route.apiPath === `/projects/${projectId}/transcripts/brainstorm_room`
  && route.readyForBackendTranscriptChannel === true
  && route.proofIds?.includes(receipt.checksum)
  && route.timelineLogIds?.includes(receipt.timelineLogId)
  && route.eventIds?.includes(receipt.eventId)
)), 'Readiness Proof Map must expose backend-created transcript channels with receipt, timeline, and event proof.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
});
assert(response.status === 200, 'Manager Flow Graph must be readable after channel creation.');
assert(response.body.nodes?.some((node) => (
  node.channelId === 'brainstorm_room'
  && node.route === `/projects/${projectId}/transcripts/brainstorm_room`
  && node.proofIds?.includes(receipt.messageId)
)), 'Manager Flow Graph must expose backend-created transcript channels as collaboration proof nodes.');

assert(advancedProjectChatSource.includes('project-chat-create-transcript-channel'), 'React Group Chat must expose the backend channel creation control.');
assert(appSource.includes("runBackendProjectCommand('transcripts'"), 'React Group Chat channel creation must call the backend transcripts route.');
assert(appSource.includes('refreshReceiptReadModels') && appSource.includes('transcriptChannelRoute'), 'React Group Chat channel creation must refresh backend transcript channel proof routes.');

console.log('Transcript channel create contract validation passed.');
