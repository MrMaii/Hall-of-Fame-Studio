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
const projectId = 'transcript_channel_pin_contract_project';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'transcript_channel_pin_contract_mission',
    meetingId: 'transcript_channel_pin_contract_meeting',
    projectId,
    name: 'Transcript Channel Pin Contract Project',
    missionBrief: 'Validate backend Group Chat channel pins for a generic product-team mission.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_channel_pin', text: 'Pin the main collaboration channel and keep it traceable.', assignee: 'Steve Jobs', status: 'pending' },
    ],
    runInitialTick: false,
    now: '2026-06-01T09:00:00.000Z',
  },
});

assert(response.status === 200 && response.body.project?.id === projectId, 'Mission Runner must create a backend project with transcript channels.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/transcripts/main/channel-pin`,
  body: {
    includeReadModels: false,
    reason: 'Keep the main collaboration channel visible for Manager review.',
    pinnedBy: 'Director',
    pinnedById: 'director',
    now: '2026-06-01T09:09:00.000Z',
  },
});

assert(response.status === 200, `Transcript channel pin returned ${response.status}.`);
const channelPin = response.body.transcriptChannelPin;
assert(channelPin?.schemaVersion === 'transcript-channel-pin/v1', 'Transcript channel pin must return transcript-channel-pin/v1.');
assert(channelPin.channelId === 'main', 'Transcript channel pin must preserve the channel id.');
assert(channelPin.channelPinMessageId && channelPin.timelineLogId && channelPin.eventId, 'Transcript channel pin must create chat, timeline, and event proof ids.');
assert(channelPin.apiPath === `/projects/${projectId}/transcripts/main`, 'Transcript channel pin must expose the channel route.');
assert(channelPin.proofIds?.includes(channelPin.channelPinMessageId), 'Transcript channel pin proof ids must include the channel pin message.');
assert(channelPin.readyForProduction === false && channelPin.productionBlockerReason, 'Transcript channel pin must not claim production retention readiness.');
assert(response.body.readModels?.transcriptChannelPinRoute === `/projects/${projectId}/transcripts/main`, 'Deferred read models must expose the transcript channel pin route.');
assert(response.body.messages?.some((message) => (
  message.id === channelPin.channelPinMessageId
  && message.transcriptChannelPinReceiptId === channelPin.id
)), 'Transcript channel pin must append a backend system message.');
assert(response.body.project?.logs?.some((log) => log.id === channelPin.timelineLogId && log.eventType === 'transcript-channel-pinned'), 'Transcript channel pin must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => event.id === channelPin.eventId && event.type === 'transcript-channel-pinned'), 'Transcript channel pin must persist an event-ledger row.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/main`,
});
assert(response.status === 200, 'Pinned transcript channel must be readable.');
const transcript = response.body;
assert(transcript.summary?.channelPinned === true && transcript.summary?.channelPinCount >= 1, 'Transcript summary must mark the channel pinned.');
assert(transcript.channelPins?.some((row) => row.id === channelPin.id && row.readyForBackendTranscriptChannelPin), 'Transcript channel must expose the channel pin receipt.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
});
assert(response.status === 200, 'Readiness Proof Map must be readable after channel pin.');
const proofMap = response.body;
assert(proofMap.transcriptChannelPinSummary?.readyForBackendTranscriptChannelPins, 'Readiness Proof Map must mark backend transcript channel pins ready.');
assert(proofMap.transcriptChannelPinRoutes?.some((route) => route.id === channelPin.id && route.channelId === 'main' && route.eventIds.includes(channelPin.eventId)), 'Readiness Proof Map must expose the transcript channel pin route.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
});
assert(response.status === 200, 'Manager Flow Graph must be readable after channel pin.');
const flowGraph = response.body;
assert(flowGraph.nodes?.some((node) => node.subtype === 'transcript-channel-pin' && node.proofIds.includes(channelPin.id) && node.eventIds.includes(channelPin.eventId)), 'Manager Flow Graph must expose a proofed transcript channel pin node.');

assert(advancedProjectChatSource.includes('project-chat-tool-pin') && advancedProjectChatSource.includes('pinBackendTranscriptChannel'), 'React Group Chat must expose the backend channel pin control.');
assert(!advancedProjectChatSource.includes('project-chat-tool-pin-backend-required'), 'React Group Chat must not keep the header pin as a backend-required mock.');

console.log('Transcript channel pin contract validation passed.');
