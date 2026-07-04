import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const projectId = 'transcript_pin_contract_project';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'transcript_pin_contract_mission',
    meetingId: 'transcript_pin_contract_meeting',
    projectId,
    name: 'Transcript Pin Contract Project',
    missionBrief: 'Validate backend Group Chat transcript pins for a generic product-team mission.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_pin', text: 'Pin a collaboration proof message and keep it traceable.', assignee: 'Steve Jobs', status: 'pending' },
    ],
    runInitialTick: false,
    now: '2026-06-01T09:00:00.000Z',
  },
});

assert(response.status === 200 && response.body.project?.id === projectId, 'Mission Runner must create a backend project with transcript messages.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/main`,
});
assert(response.status === 200, `Transcript read returned ${response.status}.`);

const transcript = response.body;
const candidateMessage = [
  ...(transcript.messages || []),
  ...(transcript.archivedProofMessages || []),
].find((message) => /leader|reviewer|kickoff/i.test(`${message.text || ''} ${message.role || ''}`))
  || transcript.messages?.[0]
  || transcript.archivedProofMessages?.[0];

assert(candidateMessage?.id, 'Transcript pin validation needs a real backend transcript message.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/transcripts/main/pins`,
  body: {
    includeReadModels: false,
    messageId: candidateMessage.id,
    reason: 'Pin leadership discussion for Manager proof review.',
    pinnedBy: 'Director',
    pinnedById: 'director',
    now: '2026-06-01T09:05:00.000Z',
  },
});

assert(response.status === 200, `Transcript pin returned ${response.status}.`);
const pin = response.body.transcriptPin;
assert(pin?.schemaVersion === 'transcript-pin/v1', 'Transcript pin must return transcript-pin/v1.');
assert(pin.messageId === candidateMessage.id, 'Transcript pin must preserve the pinned message id.');
assert(pin.pinMessageId && pin.timelineLogId && pin.eventId, 'Transcript pin must create chat, timeline, and event proof ids.');
assert(pin.apiPath?.includes('/transcripts/main#'), 'Transcript pin must expose a transcript anchor route.');
assert(pin.proofIds?.includes(candidateMessage.id), 'Transcript pin proof ids must include the original message id.');
assert(pin.readyForProduction === false && pin.productionBlockerReason, 'Transcript pin must not claim production transcript retention readiness.');
assert(response.body.readModels?.transcriptPinRoute?.includes('/transcripts/main#'), 'Deferred read models must expose the transcript pin route.');
assert(response.body.project?.logs?.some((log) => log.id === pin.timelineLogId && log.eventType === 'transcript-message-pinned'), 'Transcript pin must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => event.id === pin.eventId && event.type === 'transcript-message-pinned'), 'Transcript pin must persist an event-ledger row.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/main`,
});
assert(response.status === 200, 'Pinned transcript channel must be readable.');
const pinnedTranscript = response.body;
assert(pinnedTranscript.summary?.pinnedMessageCount >= 1, 'Transcript summary must count pinned messages.');
assert(pinnedTranscript.pinnedMessages?.some((row) => row.id === pin.id && row.messageId === candidateMessage.id && row.readyForBackendTranscriptPin), 'Transcript channel must expose the pinned message receipt.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
});
assert(response.status === 200, 'Readiness Proof Map must be readable after pinning.');
const proofMap = response.body;
assert(proofMap.transcriptPinSummary?.readyForBackendTranscriptPins, 'Readiness Proof Map must mark backend transcript pins ready.');
assert(proofMap.transcriptPinRoutes?.some((route) => route.id === pin.id && route.messageId === candidateMessage.id && route.eventIds.includes(pin.eventId)), 'Readiness Proof Map must expose the transcript pin route.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
});
assert(response.status === 200, 'Manager Flow Graph must be readable after pinning.');
const flowGraph = response.body;
assert(flowGraph.nodes?.some((node) => node.subtype === 'transcript-pin' && node.proofIds.includes(pin.id) && node.eventIds.includes(pin.eventId)), 'Manager Flow Graph must expose a proofed transcript pin node.');

console.log('Transcript pin contract validation passed.');
