import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const projectId = 'transcript_mention_contract_project';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'transcript_mention_contract_mission',
    meetingId: 'transcript_mention_contract_meeting',
    projectId,
    name: 'Transcript Mention Contract Project',
    missionBrief: 'Validate backend Group Chat transcript mentions for a generic product-team mission.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_mention', text: 'Mention an Agent from a transcript message and keep it traceable.', assignee: 'Marie Curie', status: 'pending' },
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
].find((message) => message.authorId === 'curie' || message.author === 'Marie Curie')
  || transcript.messages?.[0]
  || transcript.archivedProofMessages?.[0];

assert(candidateMessage?.id, 'Transcript mention validation needs a real backend transcript message.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/transcripts/main/mentions`,
  body: {
    includeReadModels: false,
    messageId: candidateMessage.id,
    targetAgentId: 'curie',
    text: 'Please inspect this point and keep the Manager updated.',
    mentionedBy: 'Director',
    mentionedById: 'director',
    now: '2026-06-01T09:07:00.000Z',
  },
});

assert(response.status === 200, `Transcript mention returned ${response.status}.`);
const mention = response.body.transcriptMention;
assert(mention?.schemaVersion === 'transcript-mention/v1', 'Transcript mention must return transcript-mention/v1.');
assert(mention.sourceMessageId === candidateMessage.id, 'Transcript mention must preserve the source message id.');
assert(mention.mentionMessageId && mention.timelineLogId && mention.eventId, 'Transcript mention must create chat, timeline, and event proof ids.');
assert(mention.apiPath?.includes('/transcripts/main#'), 'Transcript mention must expose a transcript anchor route.');
assert(mention.proofIds?.includes(candidateMessage.id), 'Transcript mention proof ids must include the source message id.');
assert(mention.targetAgentIds?.includes('curie'), 'Transcript mention must preserve the target Agent id.');
assert(mention.readyForProduction === false && mention.productionBlockerReason, 'Transcript mention must not claim production transcript retention readiness.');
assert(response.body.readModels?.transcriptMentionRoute?.includes('/transcripts/main#'), 'Deferred read models must expose the transcript mention route.');
assert(response.body.messages?.some((message) => (
  message.id === mention.mentionMessageId
  && message.mentionSourceMessageId === candidateMessage.id
  && message.directTargetIds?.includes('curie')
)), 'Transcript mention must append a backend mention message with a direct target.');
assert(response.body.project?.agentStates?.curie?.inbox?.some((item) => item.sourceMessageId === mention.mentionMessageId), 'Transcript mention must enter the target Agent inbox.');
assert(response.body.project?.logs?.some((log) => log.id === mention.timelineLogId && log.eventType === 'transcript-message-mentioned'), 'Transcript mention must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => event.id === mention.eventId && event.type === 'transcript-message-mentioned'), 'Transcript mention must persist an event-ledger row.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/main`,
});
assert(response.status === 200, 'Mentioned transcript channel must be readable.');
const mentionedTranscript = response.body;
assert(mentionedTranscript.summary?.mentionCount >= 1, 'Transcript summary must count mentions.');
assert(mentionedTranscript.mentions?.some((row) => row.id === mention.id && row.sourceMessageId === candidateMessage.id && row.readyForBackendTranscriptMention), 'Transcript channel must expose the mention receipt.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
});
assert(response.status === 200, 'Readiness Proof Map must be readable after mentioning.');
const proofMap = response.body;
assert(proofMap.transcriptMentionSummary?.readyForBackendTranscriptMentions, 'Readiness Proof Map must mark backend transcript mentions ready.');
assert(proofMap.transcriptMentionRoutes?.some((route) => route.id === mention.id && route.mentionMessageId === mention.mentionMessageId && route.eventIds.includes(mention.eventId)), 'Readiness Proof Map must expose the transcript mention route.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
});
assert(response.status === 200, 'Manager Flow Graph must be readable after mentioning.');
const flowGraph = response.body;
assert(flowGraph.nodes?.some((node) => node.subtype === 'transcript-mention' && node.proofIds.includes(mention.id) && node.eventIds.includes(mention.eventId)), 'Manager Flow Graph must expose a proofed transcript mention node.');

console.log('Transcript mention contract validation passed.');
