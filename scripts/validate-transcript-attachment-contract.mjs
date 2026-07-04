import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const projectId = 'transcript_attachment_contract_project';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'transcript_attachment_contract_mission',
    meetingId: 'transcript_attachment_contract_meeting',
    projectId,
    name: 'Transcript Attachment Contract Project',
    missionBrief: 'Validate backend Group Chat transcript attachments for a generic product-team mission.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_attachment', text: 'Attach a collaboration file and keep it traceable.', assignee: 'Alan Turing', status: 'pending' },
    ],
    runInitialTick: false,
    now: '2026-06-01T09:00:00.000Z',
  },
});

assert(response.status === 200 && response.body.project?.id === projectId, 'Mission Runner must create a backend project with transcript context.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/transcripts/main/attachments`,
  body: {
    includeReadModels: false,
    fileName: 'validation-product-brief.md',
    contentType: 'text/markdown',
    sizeBytes: 96,
    contentText: '# Validation Product Brief\n\nThis attachment is a backend transcript proof, not a browser mock.',
    contentEncoding: 'utf8-preview',
    note: 'Attach the validation brief to the collaboration record.',
    uploadedBy: 'Director',
    uploadedById: 'director',
    now: '2026-06-01T09:08:00.000Z',
  },
});

assert(response.status === 200, `Transcript attachment returned ${response.status}.`);
const attachment = response.body.transcriptAttachment;
assert(attachment?.schemaVersion === 'transcript-attachment/v1', 'Transcript attachment must return transcript-attachment/v1.');
assert(attachment.attachmentMessageId && attachment.timelineLogId && attachment.eventId, 'Transcript attachment must create chat, timeline, and event proof ids.');
assert(attachment.apiPath?.includes('/transcripts/main#'), 'Transcript attachment must expose a transcript anchor route.');
assert(attachment.fileName === 'validation-product-brief.md' && attachment.contentType === 'text/markdown', 'Transcript attachment must preserve file metadata.');
assert(attachment.contentChecksum && attachment.proofIds?.includes(attachment.contentChecksum), 'Transcript attachment must include content checksum proof.');
assert(attachment.readyForProduction === false && attachment.productionBlockerReason, 'Transcript attachment must not claim production object-storage readiness.');
assert(response.body.readModels?.transcriptAttachmentRoute?.includes('/transcripts/main#'), 'Deferred read models must expose the transcript attachment route.');
assert(response.body.messages?.some((message) => (
  message.id === attachment.attachmentMessageId
  && message.type === 'file'
  && message.fileId === attachment.id
  && message.transcriptAttachmentReceiptId === attachment.id
)), 'Transcript attachment must append a backend file message.');
assert(response.body.project?.logs?.some((log) => log.id === attachment.timelineLogId && log.eventType === 'transcript-file-attached'), 'Transcript attachment must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => event.id === attachment.eventId && event.type === 'transcript-file-attached'), 'Transcript attachment must persist an event-ledger row.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/main`,
});
assert(response.status === 200, 'Attachment transcript channel must be readable.');
const attachedTranscript = response.body;
assert(attachedTranscript.summary?.attachmentCount >= 1, 'Transcript summary must count attachments.');
assert(attachedTranscript.attachments?.some((row) => row.id === attachment.id && row.attachmentMessageId === attachment.attachmentMessageId && row.readyForBackendTranscriptAttachment), 'Transcript channel must expose the attachment receipt.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
});
assert(response.status === 200, 'Readiness Proof Map must be readable after attachment.');
const proofMap = response.body;
assert(proofMap.transcriptAttachmentSummary?.readyForBackendTranscriptAttachments, 'Readiness Proof Map must mark backend transcript attachments ready.');
assert(proofMap.transcriptAttachmentRoutes?.some((route) => route.id === attachment.id && route.attachmentMessageId === attachment.attachmentMessageId && route.eventIds.includes(attachment.eventId)), 'Readiness Proof Map must expose the transcript attachment route.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
});
assert(response.status === 200, 'Manager Flow Graph must be readable after attachment.');
const flowGraph = response.body;
assert(flowGraph.nodes?.some((node) => node.subtype === 'transcript-attachment' && node.proofIds.includes(attachment.id) && node.eventIds.includes(attachment.eventId)), 'Manager Flow Graph must expose a proofed transcript attachment node.');

console.log('Transcript attachment contract validation passed.');
