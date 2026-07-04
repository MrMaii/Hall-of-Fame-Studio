import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const projectId = 'transcript_reply_contract_project';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'transcript_reply_contract_mission',
    meetingId: 'transcript_reply_contract_meeting',
    projectId,
    name: 'Transcript Reply Contract Project',
    missionBrief: 'Validate backend Group Chat transcript replies for a generic product-team mission.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_reply', text: 'Reply to a collaboration message and keep it traceable.', assignee: 'Marie Curie', status: 'pending' },
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

assert(candidateMessage?.id, 'Transcript reply validation needs a real backend transcript message.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/transcripts/main/replies`,
  body: {
    includeReadModels: false,
    messageId: candidateMessage.id,
    text: 'Acknowledged. Please preserve this point as collaboration proof for the Manager.',
    replier: 'Director',
    replierId: 'director',
    now: '2026-06-01T09:06:00.000Z',
  },
});

assert(response.status === 200, `Transcript reply returned ${response.status}.`);
const reply = response.body.transcriptReply;
assert(reply?.schemaVersion === 'transcript-reply/v1', 'Transcript reply must return transcript-reply/v1.');
assert(reply.parentMessageId === candidateMessage.id, 'Transcript reply must preserve the parent message id.');
assert(reply.replyMessageId && reply.timelineLogId && reply.eventId, 'Transcript reply must create chat, timeline, and event proof ids.');
assert(reply.apiPath?.includes('/transcripts/main#'), 'Transcript reply must expose a transcript anchor route.');
assert(reply.proofIds?.includes(candidateMessage.id), 'Transcript reply proof ids must include the parent message id.');
assert(reply.readyForProduction === false && reply.productionBlockerReason, 'Transcript reply must not claim production transcript retention readiness.');
assert(response.body.readModels?.transcriptReplyRoute?.includes('/transcripts/main#'), 'Deferred read models must expose the transcript reply route.');
assert(response.body.messages?.some((message) => message.id === reply.replyMessageId && message.replyToMessageId === candidateMessage.id), 'Transcript reply must append a backend reply message.');
assert(response.body.project?.logs?.some((log) => log.id === reply.timelineLogId && log.eventType === 'transcript-message-replied'), 'Transcript reply must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => event.id === reply.eventId && event.type === 'transcript-message-replied'), 'Transcript reply must persist an event-ledger row.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/main`,
});
assert(response.status === 200, 'Replied transcript channel must be readable.');
const repliedTranscript = response.body;
assert(repliedTranscript.summary?.replyCount >= 1, 'Transcript summary must count replies.');
assert(repliedTranscript.replies?.some((row) => row.id === reply.id && row.parentMessageId === candidateMessage.id && row.readyForBackendTranscriptReply), 'Transcript channel must expose the reply receipt.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
});
assert(response.status === 200, 'Readiness Proof Map must be readable after replying.');
const proofMap = response.body;
assert(proofMap.transcriptReplySummary?.readyForBackendTranscriptReplies, 'Readiness Proof Map must mark backend transcript replies ready.');
assert(proofMap.transcriptReplyRoutes?.some((route) => route.id === reply.id && route.replyMessageId === reply.replyMessageId && route.eventIds.includes(reply.eventId)), 'Readiness Proof Map must expose the transcript reply route.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
});
assert(response.status === 200, 'Manager Flow Graph must be readable after replying.');
const flowGraph = response.body;
assert(flowGraph.nodes?.some((node) => node.subtype === 'transcript-reply' && node.proofIds.includes(reply.id) && node.eventIds.includes(reply.eventId)), 'Manager Flow Graph must expose a proofed transcript reply node.');

console.log('Transcript reply contract validation passed.');
