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
  assert(readModels.agentDashboardRoute === `/projects/${projectId}/agents/${agentId}/dashboard`, `${label} must expose sender Agent Dashboard refresh route.`);
}

const projectId = 'agent_message_contract_project';
const messageId = 'agent_message_contract_turing_to_curie';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'agent_message_contract_mission',
    meetingId: 'agent_message_contract_meeting',
    projectId,
    name: 'Agent Message Contract Project',
    missionBrief: 'Validate route-backed Agent-to-Agent coordination for a generic product-team run.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      {
        id: 'task_agent_message_contract',
        text: 'Coordinate proof review between Agents.',
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
  path: `/projects/${projectId}/agents/turing/message`,
  body: {
    includeReadModels: false,
    targetAgentIds: ['curie'],
    channelId: 'main',
    text: 'Coordination note for Marie Curie: keep the evidence review route and timeline proof visible for the manager.',
    messageId,
    now: '2026-06-01T09:05:00.000Z',
  },
});
assertStatus(response, 200, 'Agent message write');
assertDeferredReadModels(response, projectId, 'turing', 'Agent message write');

const project = response.body.project || {};
const message = (response.body.messages || []).find((item) => item.id === messageId);
assert(message?.source === 'agent-to-agent-message', 'Agent message write must return a first-class agent-to-agent transcript message.');
assert(message.authorId === 'turing', 'Agent message must preserve the sender Agent id.');
assert(message.directTargetIds?.includes('curie') || message.targetIds?.includes('curie'), 'Agent message must preserve the target Agent id.');
assert(project.agentStates?.curie?.inbox?.some((item) => item.source === 'agent-to-agent-message' && item.sourceMessageId === messageId), 'Agent message must arrive in the target Agent inbox.');
assert(project.agentStates?.turing?.worklog?.some((item) => item.source === 'agent-to-agent-message' && item.sourceMessageId === messageId), 'Agent message must append sender worklog proof.');
assert(project.logs?.some((log) => log.eventType === 'agent-message' && log.messageId === messageId), 'Agent message must persist timeline proof.');
assert(project.eventLedger?.some((event) => event.source === 'agent-to-agent-message' && event.entityIds?.messageId === messageId), 'Agent message must persist event-ledger proof.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/transcripts` });
assertStatus(response, 200, 'Transcript index');
assert(JSON.stringify(response.body).includes(messageId), 'Transcript index must expose the Agent message proof.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/timeline` });
assertStatus(response, 200, 'Timeline read');
assert(response.body.logs?.some((log) => log.eventType === 'agent-message' && log.messageId === messageId), 'Timeline read must expose the Agent message proof log.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/events` });
assertStatus(response, 200, 'Event ledger read');
assert(response.body.eventLedger?.some((event) => event.source === 'agent-to-agent-message' && event.entityIds?.messageId === messageId), 'Event ledger read must expose the Agent message proof event.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-dashboard` });
assertStatus(response, 200, 'Manager Dashboard read');
assert(response.body.agentCommunicationFlow?.rows?.some((row) => row.messageId === messageId && row.inboxSeen && row.senderWorklogSeen), 'Manager Dashboard must expose Agent communication flow proof.');
assert(response.body.agentCommunicationFlow?.deliveryRows?.some((row) => row.messageId === messageId && row.targetId === 'curie' && row.receiptSeen && row.inboxSeen), 'Manager Dashboard must expose per-target Agent message delivery proof.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assertStatus(response, 200, 'Readiness Proof Map read');
assert(response.body.agentMessageSummary?.readyForAgentMessageDelivery === true, 'Readiness Proof Map must mark Agent message delivery ready.');
assert(response.body.agentMessageRoutes?.some((route) => (
  route.messageId === messageId
  && route.readyForAgentMessageDelivery
  && route.timelineLogIds?.some((id) => id.includes(messageId))
  && route.eventIds?.some((id) => id.includes(messageId))
)), 'Readiness Proof Map must expose route, timeline, and event proof for the Agent message.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
assertStatus(response, 200, 'Manager Flow Graph read');
assert(response.body.nodes?.some((node) => node.id === `agent-message-${messageId}` && node.proofIds?.includes(messageId)), 'Manager Flow Graph must expose an Agent message node.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agents/curie/dashboard` });
assertStatus(response, 200, 'Target Agent Dashboard read');
assert(JSON.stringify(response.body).includes(messageId), 'Target Agent Dashboard must expose the received Agent message proof.');

console.log('Agent message backend contract validation passed.');
