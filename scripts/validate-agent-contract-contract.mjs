import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStatus(response, status, label) {
  assert(response.status === status, `${label} returned ${response.status}: ${response.body?.error || response.body?.message || 'no error detail'}`);
}

function assertDeferredReadModels(response, projectId, agentId, label) {
  const readModels = response.body.readModels || {};
  assert(readModels.included === false, `${label} must return lightweight deferred read models.`);
  assert(readModels.managerDashboardRoute === `/projects/${projectId}/manager-dashboard`, `${label} must expose Manager Dashboard refresh route.`);
  assert(readModels.managerFlowGraphRoute === `/projects/${projectId}/manager-flow-graph`, `${label} must expose Manager Flow Graph refresh route.`);
  assert(readModels.readinessProofMapRoute === `/projects/${projectId}/readiness-proof-map`, `${label} must expose Readiness Proof Map refresh route.`);
  assert(readModels.transcriptsRoute === `/projects/${projectId}/transcripts`, `${label} must expose transcript refresh route.`);
  assert(readModels.timelineRoute === `/projects/${projectId}/timeline`, `${label} must expose timeline refresh route.`);
  assert(readModels.eventsRoute === `/projects/${projectId}/events`, `${label} must expose event-ledger refresh route.`);
  assert(readModels.agentDashboardRoute === `/projects/${projectId}/agents/${agentId}/dashboard`, `${label} must expose contracted Agent Dashboard refresh route.`);
}

const projectId = 'agent_contract_contract_project';
const agentId = 'ada';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'agent_contract_contract_mission',
    meetingId: 'agent_contract_contract_meeting',
    projectId,
    name: 'Agent Contract Contract Project',
    missionBrief: 'Validate marketplace Agent contracting for a generic product-team run.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      {
        id: 'task_agent_contract_contract',
        text: 'Add a specialist Agent from the marketplace.',
        assignee: 'Alan Turing',
        status: 'pending',
      },
    ],
    runInitialTick: false,
    now: '2026-06-01T09:00:00.000Z',
  },
});
assertStatus(response, 200, 'Product Team Mission Runner');
assert(response.body.project?.id === projectId, 'Mission Runner must create the backend project.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/contract`,
  body: {
    includeReadModels: false,
    agent: {
      id: agentId,
      name: 'Ada Lovelace',
      role: 'Systems Analyst',
      skill: 'computing systems',
      category: 'implementation',
    },
    contractedBy: 'Director',
    source: 'pantheon-market',
    reason: 'Expand implementation reasoning with a market-contracted specialist.',
    now: '2026-06-01T09:05:00.000Z',
  },
});
assertStatus(response, 200, 'Agent contract write');
assert(response.body.agentContract?.schemaVersion === 'agent-contract/v1', 'Agent contract write must return an agent-contract/v1 receipt.');
assertDeferredReadModels(response, projectId, agentId, 'Agent contract write');
assert(!response.body.managerReadyPackage && !response.body.managerFlowGraph && !response.body.agentDashboard, 'Agent contract write must not embed large read models when includeReadModels is false.');

const project = response.body.project || {};
const contract = response.body.agentContract || {};
assert(contract.agentId === agentId && contract.source === 'pantheon-market', 'Agent contract receipt must preserve the marketplace source and Agent id.');
assert(contract.backendRoutes?.agentDashboard === `/projects/${projectId}/agents/${agentId}/dashboard`, 'Agent contract receipt must point to the contracted Agent Dashboard route.');
assert(project.team?.some((member) => member.id === agentId && member.contractStatus === 'active'), 'Agent contract write must persist the Agent in the project team roster.');
assert(project.agentContracts?.some((record) => record.id === contract.id && record.timelineLogIds?.length > 0 && record.eventIds?.length > 0), 'Agent contract write must persist auditable contract records with timeline and event proof.');
assert(project.agentStates?.[agentId]?.worklog?.some((item) => item.kind === 'agent-contracted' && item.contractId === contract.id), 'Agent contract write must create contracted Agent worklog proof.');
assert(project.logs?.some((log) => log.eventType === 'agent-contracted' && log.contractId === contract.id), 'Agent contract write must create Flow Graph-visible roster timeline proof.');
assert(project.eventLedger?.some((event) => event.type === 'agent-contracted' && event.entityIds?.contractId === contract.id), 'Agent contract write must append the roster change to the unified event ledger.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agents/${agentId}/dashboard` });
assertStatus(response, 200, 'Contracted Agent Dashboard read');
assert(response.body.agentId === agentId && response.body.agent?.name === 'Ada Lovelace', 'Contracted Agent Dashboard must expose the marketplace Agent identity.');
assert(response.body.worklog?.some((item) => item.kind === 'agent-contracted' && item.contractId === contract.id), 'Contracted Agent Dashboard must expose contract worklog proof.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
assertStatus(response, 200, 'Manager Flow Graph read');
assert(response.body.nodes?.some((node) => node.subtype === 'agent-contracted' && node.agentId === agentId && node.category === 'collaboration'), 'Manager Flow Graph must expose the Agent contract as a collaboration node.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/timeline` });
assertStatus(response, 200, 'Timeline read');
assert(response.body.logs?.some((log) => log.eventType === 'agent-contracted' && log.contractId === contract.id), 'Timeline read must expose the Agent contract proof log.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/events` });
assertStatus(response, 200, 'Event ledger read');
assert(response.body.eventLedger?.some((event) => event.type === 'agent-contracted' && event.entityIds?.contractId === contract.id), 'Event ledger read must expose the Agent contract proof event.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assertStatus(response, 200, 'Readiness Proof Map read');
assert(JSON.stringify(response.body).includes(`/projects/${projectId}/agents/${agentId}/dashboard`), 'Readiness Proof Map must keep the contracted Agent Dashboard route discoverable.');

console.log('Agent contract backend contract validation passed.');
