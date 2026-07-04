import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const projectId = 'transcript_search_contract_project';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'transcript_search_contract_mission',
    meetingId: 'transcript_search_contract_meeting',
    projectId,
    name: 'Transcript Search Contract Project',
    missionBrief: 'Validate backend Group Chat transcript search for a generic product-team mission.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_evidence', text: 'Collect evidence and submit a product-team proof packet.', assignee: 'Marie Curie', status: 'pending' },
    ],
    runInitialTick: false,
    now: '2026-06-01T09:00:00.000Z',
  },
});

assert(response.status === 200 && response.body.project?.id === projectId, 'Mission Runner must create a backend project with transcript messages.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/search?query=${encodeURIComponent('leader')}&channelId=main`,
});

const search = response.body;
assert(response.status === 200, `Transcript search returned ${response.status}.`);
assert(search.schemaVersion === 'transcript-search/v1', 'Transcript search must return transcript-search/v1.');
assert(search.status === 'completed', 'Transcript search must complete for a non-empty query.');
assert(search.channelId === 'main', 'Transcript search must preserve channel scope.');
assert(search.resultCount > 0, 'Transcript search must find kickoff/leader transcript proof.');
assert(search.results.every((result) => result.schemaVersion === 'transcript-search-result/v1' && result.messageId && result.apiPath?.includes('/transcripts/main#')), 'Transcript search results must expose message ids and transcript proof routes.');
assert(search.proofIds.length >= search.resultCount, 'Transcript search must return proof ids for matching messages.');
assert(search.backendRoutes?.search?.includes('/transcripts/search'), 'Transcript search must expose its backend search route.');
assert(search.checksum, 'Transcript search must expose a checksum.');
assert(search.readyForProduction === false && search.productionBlockerReason, 'Transcript search must not claim production transcript retention readiness.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/transcripts/search?query=${encodeURIComponent('no-such-transcript-token')}&channelId=main`,
});
assert(response.status === 200 && response.body.resultCount === 0 && response.body.status === 'completed', 'Transcript search must return an empty completed result instead of synthesizing matches.');

console.log('Transcript search contract validation passed.');
