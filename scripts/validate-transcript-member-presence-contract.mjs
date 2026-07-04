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
const projectId = 'transcript_member_presence_contract_project';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'transcript_member_presence_contract_mission',
    meetingId: 'transcript_member_presence_contract_meeting',
    projectId,
    name: 'Transcript Member Presence Contract Project',
    missionBrief: 'Validate backend Group Chat member presence for a generic product-team mission.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_presence', text: 'Show who has received and acted on collaboration messages.', assignee: 'Steve Jobs', status: 'pending' },
    ],
    runInitialTick: false,
    now: '2026-06-01T09:00:00.000Z',
  },
});

assert(response.status === 200 && response.body.project?.id === projectId, 'Mission Runner must create a backend project with transcript receipts.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/main/members`,
});

assert(response.status === 200, `Transcript member presence returned ${response.status}.`);
const presence = response.body;
assert(presence.schemaVersion === 'transcript-member-presence/v1', 'Member presence must expose transcript-member-presence/v1.');
assert(presence.apiPath === `/projects/${projectId}/transcripts/main/members`, 'Member presence must expose the channel members route.');
assert(presence.members?.length === 3, 'Member presence must return every project Agent.');
assert(presence.summary?.readyForBackendTranscriptMemberPresence, 'Member presence summary must be backend-ready when transcript proof exists.');
assert(presence.summary.presentCount > 0, 'At least one Agent must be present from real transcript receipts.');
assert(presence.proofIds?.length > 0, 'Member presence must expose transcript proof ids.');
assert(presence.readyForProduction === false && presence.productionBlockerReason, 'Member presence must not claim production authenticated presence readiness.');
assert(presence.members.some((member) => member.receivedCount > 0 || member.authoredCount > 0), 'Member rows must derive receipt/authored counts from backend transcript messages.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
});
assert(response.status === 200, 'Readiness Proof Map must be readable after member presence.');
const proofMap = response.body;
assert(proofMap.transcriptMemberPresenceSummary?.readyForBackendTranscriptMemberPresence, 'Readiness Proof Map must mark backend member presence ready.');
assert(proofMap.transcriptMemberPresenceRoutes?.some((route) => route.apiPath === `/projects/${projectId}/transcripts/main/members` && route.proofIds.length > 0), 'Readiness Proof Map must expose the member presence route.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
});
assert(response.status === 200, 'Manager Flow Graph must be readable after member presence.');
const flowGraph = response.body;
assert(flowGraph.nodes?.some((node) => node.subtype === 'transcript-member-presence' && node.route === `/projects/${projectId}/transcripts/main/members`), 'Manager Flow Graph must expose a transcript-member-presence node.');

assert(appSource.includes('project-chat-tool-members') && appSource.includes('project-chat-member-presence-panel'), 'React Group Chat must expose the backend member presence control and panel.');
assert(!appSource.includes('project-chat-tool-members-backend-required'), 'React Group Chat must not keep the member presence button as a backend-required mock.');

console.log('Transcript member presence contract validation passed.');
