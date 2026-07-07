import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStatus(response, status, label) {
  assert(response.status === status, `${label} returned ${response.status}: ${response.body?.error || response.body?.message || 'no error detail'}`);
}

function assertProjectReadModels(response, projectId, label) {
  const readModels = response.body.readModels || {};
  assert(readModels.included === false, `${label} must return lightweight deferred read models.`);
  assert(readModels.managerDashboardRoute === `/projects/${projectId}/manager-dashboard`, `${label} must expose Manager Dashboard refresh route.`);
  assert(readModels.managerFlowGraphRoute === `/projects/${projectId}/manager-flow-graph`, `${label} must expose Manager Flow Graph refresh route.`);
  assert(readModels.readinessProofMapRoute === `/projects/${projectId}/readiness-proof-map`, `${label} must expose Readiness Proof Map refresh route.`);
  assert(readModels.transcriptsRoute === `/projects/${projectId}/transcripts`, `${label} must expose transcript refresh route.`);
  assert(readModels.timelineRoute === `/projects/${projectId}/timeline`, `${label} must expose timeline refresh route.`);
  assert(readModels.eventsRoute === `/projects/${projectId}/events`, `${label} must expose event-ledger refresh route.`);
  assert(readModels.agentStateSummaryRoute === `/projects/${projectId}/agent-state-summary`, `${label} must expose Agent State Summary refresh route.`);
  assert(readModels.assignmentTimelineMatrixRoute === `/projects/${projectId}/assignment-timeline-matrix`, `${label} must expose Assignment Timeline Matrix refresh route.`);
  assert(readModels.changeFlowRoute === `/projects/${projectId}/change-flow`, `${label} must expose Change Flow refresh route.`);
  assert(readModels.continuousWorkLoopRoute === `/projects/${projectId}/continuous-work-loop`, `${label} must expose Continuous Work Loop refresh route.`);
}

const projectId = 'manager_chat_command_contract_project';
const assignmentSourceMessageId = 'manager_chat_assignment_source';
const changeSourceMessageId = 'manager_chat_change_source';
const service = createAgentProjectService({ messageLimit: 180 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'manager_chat_command_contract_mission',
    meetingId: 'manager_chat_command_contract_meeting',
    projectId,
    name: 'Manager Chat Command Contract Project',
    missionBrief: 'Validate backend Manager group-chat commands for assignment and change intake in a generic product-team run.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      {
        id: 'task_manager_chat_contract',
        text: 'Start the initial proof package.',
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
  path: `/projects/${projectId}/chat`,
  body: {
    includeReadModels: false,
    channelId: 'main',
    messageId: assignmentSourceMessageId,
    text: 'leader assign @Alan Turing prepare the manager evidence packet',
    now: '2026-06-01T09:05:00.000Z',
  },
});
assertStatus(response, 200, 'Leader assignment chat command');
assert(response.body.route === 'leader-assignment', 'Leader assignment command must route through backend assignment handling.');
assertProjectReadModels(response, projectId, 'Leader assignment chat command');
const assignment = response.body.responses?.leaderAssignmentResponse;
const assignmentTask = assignment?.task;
assert(assignmentTask?.source === 'leader-chat-assignment' && assignmentTask.ownerId === 'turing', 'Leader assignment must create an owned backend task.');
assert(assignment?.assignmentMessage?.directTargetIds?.includes('turing'), 'Leader assignment must emit a direct @mention to the assignee.');
assert(assignment?.acknowledgementMessage?.id, 'Leader assignment must create assignee acknowledgement proof.');
assert(response.body.project?.logs?.some((log) => assignmentTask.timelineLogIds?.includes(log.id)), 'Leader assignment must persist assignment timeline proof.');
assert(response.body.project?.eventLedger?.some((event) => event.entityIds?.messageId === assignmentSourceMessageId), 'Leader assignment source command must persist event-ledger proof.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/chat`,
  body: {
    includeReadModels: false,
    channelId: 'google_chat',
    messageId: changeSourceMessageId,
    text: '@all add manager export summary feature before launch',
    now: '2026-06-01T09:10:00.000Z',
  },
});
assertStatus(response, 200, 'Manager change chat command');
assert(response.body.route === 'feature-change', 'Manager change command must route through backend change handling.');
assertProjectReadModels(response, projectId, 'Manager change chat command');
const changeRecord = (response.body.project?.changeLedger || []).find((row) => row.requestMessageId === changeSourceMessageId);
assert(changeRecord?.source === 'google-chat-mention-change-request', 'Manager change command must persist a Google Chat change ledger row.');
assert(changeRecord.confirmationMessageId && changeRecord.syncMessageId, 'Manager change command must persist owner confirmation and team sync proof.');
const ownerWorkResponse = response.body.responses?.changeOwnerStartWorkResponse;
assert(ownerWorkResponse?.route === 'agent-work-cycle', 'Manager change command must start owner work through the backend.');
assert(ownerWorkResponse?.messages?.some((message) => message.agentWorker?.trigger === 'change-owner-start-work'), 'Manager change command must emit owner work chat proof.');
assert(response.body.project?.agentWorkerLedger?.some((record) => (
  record.taskId === changeRecord.taskId
  && record.trigger === 'change-owner-start-work'
)), 'Manager change command must persist owner work ledger proof.');

const assignmentProofIds = [
  assignmentSourceMessageId,
  assignment.assignmentMessage.id,
  assignment.acknowledgementMessage.id,
  ...(assignmentTask.timelineLogIds || []),
].filter(Boolean);
const changeProofIds = [
  changeSourceMessageId,
  changeRecord.confirmationMessageId,
  changeRecord.syncMessageId,
  ...(changeRecord.timelineLogIds || []),
].filter(Boolean);

response = api.handle({ method: 'GET', path: `/projects/${projectId}/transcripts` });
assertStatus(response, 200, 'Transcript index');
const transcriptJson = JSON.stringify(response.body);
for (const id of [assignmentSourceMessageId, assignment.assignmentMessage.id, assignment.acknowledgementMessage.id, changeSourceMessageId, changeRecord.confirmationMessageId, changeRecord.syncMessageId]) {
  assert(transcriptJson.includes(id), `Transcript index must expose chat command proof ${id}.`);
}

response = api.handle({ method: 'GET', path: `/projects/${projectId}/timeline` });
assertStatus(response, 200, 'Timeline read');
const timelineJson = JSON.stringify(response.body);
for (const id of [...(assignmentTask.timelineLogIds || []), changeRecord.confirmationMessageId, changeRecord.syncMessageId]) {
  assert(timelineJson.includes(id), `Timeline must expose derived chat command proof ${id}.`);
}

response = api.handle({ method: 'GET', path: `/projects/${projectId}/events` });
assertStatus(response, 200, 'Event ledger read');
const eventJson = JSON.stringify(response.body);
for (const id of [assignmentSourceMessageId, changeSourceMessageId, changeRecord.id]) {
  assert(eventJson.includes(id), `Event ledger must expose chat command proof ${id}.`);
}

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-dashboard` });
assertStatus(response, 200, 'Manager Dashboard read');
assert(response.body.assignmentTimelineMatrix?.rows?.some((row) => (
  row.taskId === assignmentTask.id
  && row.assignmentPosted
  && row.assigneeReceived
  && row.assigneeAccepted
  && row.timelineRecorded
)), 'Manager Dashboard must expose assignment timeline matrix proof.');
assert(response.body.changeFlow?.rows?.some((row) => (
  row.changeId === changeRecord.id
  && row.ownerPlanLinked
  && row.ownerWorkStarted
  && row.teamSyncCount > 0
  && row.sourceMessageIds?.includes(changeSourceMessageId)
)), 'Manager Dashboard must expose change flow owner plan and team sync proof.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agent-state-summary` });
assertStatus(response, 200, 'Agent State Summary read');
assert(response.body.agentStateSummary?.schemaVersion === 'agent-state-summary/v1', 'Agent State Summary route must expose the backend read-model schema.');
assert(response.body.agentStateSummary?.backendRoutes?.agentStateSummary === `/projects/${projectId}/agent-state-summary`, 'Agent State Summary route must expose its standalone backend route.');
assert(response.body.agentStateSummary?.rows?.some((row) => row.agentId === 'turing' || row.agent?.id === 'turing' || row.id === 'turing'), 'Agent State Summary route must expose the assignee Agent state row.');
const turingAgentStateSummaryRow = response.body.agentStateSummary.rows.find((row) => row.agentId === 'turing' || row.agent?.id === 'turing' || row.id === 'turing');
assert(typeof turingAgentStateSummaryRow.openTaskCount === 'number' && turingAgentStateSummaryRow.openTaskCount > 0, 'Agent State Summary route must expose backend-owned open task counts.');
assert(turingAgentStateSummaryRow.currentTaskText && turingAgentStateSummaryRow.currentTask?.id, 'Agent State Summary route must expose backend-owned current task fields.');
assert(response.body.agentStateSummary?.readyForUnattendedProduction === false, 'Agent State Summary must not claim unattended production readiness.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/assignment-timeline-matrix` });
assertStatus(response, 200, 'Assignment Timeline Matrix read');
assert(response.body.assignmentTimelineMatrix?.schemaVersion === 'assignment-timeline-matrix/v1', 'Assignment Timeline Matrix route must expose the backend read-model schema.');
assert(response.body.assignmentTimelineMatrix?.backendRoutes?.assignmentTimelineMatrix === `/projects/${projectId}/assignment-timeline-matrix`, 'Assignment Timeline Matrix route must expose its standalone backend route.');
assert(response.body.assignmentTimelineMatrix?.rows?.some((row) => (
  row.taskId === assignmentTask.id
  && row.assignmentPosted
  && row.assigneeReceived
  && row.timelineRecorded
)), 'Assignment Timeline Matrix route must expose the assignment proof row.');
assert(response.body.assignmentTimelineMatrix?.readyForProduction === false, 'Assignment Timeline Matrix must not claim production readiness.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/change-flow` });
assertStatus(response, 200, 'Change Flow read');
assert(response.body.changeFlow?.schemaVersion === 'change-flow/v1', 'Change Flow route must expose the backend read-model schema.');
assert(response.body.changeFlow?.backendRoutes?.changeFlow === `/projects/${projectId}/change-flow`, 'Change Flow route must expose its standalone backend route.');
assert(response.body.changeFlow?.rows?.some((row) => (
  row.changeId === changeRecord.id
  && row.ownerPlanLinked
  && row.ownerWorkStarted
  && row.teamSyncCount > 0
)), 'Change Flow route must expose the owner plan and team sync proof row.');
assert(response.body.changeFlow?.readyForProduction === false, 'Change Flow must not claim production readiness.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/continuous-work-loop` });
assertStatus(response, 200, 'Continuous Work Loop read');
assert(response.body.continuousWorkLoop?.schemaVersion === 'continuous-work-loop/v1', 'Continuous Work Loop route must expose the backend read-model schema.');
assert(response.body.continuousWorkLoop?.backendRoutes?.continuousWorkLoop === `/projects/${projectId}/continuous-work-loop`, 'Continuous Work Loop route must expose its standalone backend route.');
assert(response.body.continuousWorkLoop?.rows?.some((row) => row.agentId === 'turing' || row.agent?.id === 'turing'), 'Continuous Work Loop route must expose the owner Agent work row.');
assert(response.body.continuousWorkLoop?.readyForUnattendedProduction === false, 'Continuous Work Loop must not claim unattended production readiness.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assertStatus(response, 200, 'Readiness Proof Map read');
const proofJson = JSON.stringify(response.body);
for (const id of [...assignmentProofIds, ...changeProofIds]) {
  assert(proofJson.includes(id), `Readiness Proof Map must expose chat command proof ${id}.`);
}
assert(response.body.readiness?.checks?.some((check) => check.id === 'midproject-change-synced' && check.passed), 'Readiness Proof Map must mark mid-project change sync ready.');
assert(response.body.continuousWorkLoopRoutes?.some((route) => (
  route.apiPath === `/projects/${projectId}/continuous-work-loop`
  && route.readyForUnattendedProduction === false
  && route.productionBlocker === true
)), 'Readiness Proof Map must expose continuous-work-loop route with production blocker.');
assert(response.body.agentStateSummaryRoutes?.some((route) => (
  route.apiPath === `/projects/${projectId}/agent-state-summary`
  && route.readyForUnattendedProduction === false
  && route.productionBlocker === true
)), 'Readiness Proof Map must expose agent-state-summary route with production blocker.');
assert(response.body.assignmentTimelineMatrixRoutes?.some((route) => (
  route.apiPath === `/projects/${projectId}/assignment-timeline-matrix`
  && route.readyForProduction === false
  && route.productionBlocker === true
)), 'Readiness Proof Map must expose assignment-timeline-matrix route with production blocker.');
assert(response.body.changeFlowRoutes?.some((route) => (
  route.apiPath === `/projects/${projectId}/change-flow`
  && route.readyForProduction === false
  && route.productionBlocker === true
)), 'Readiness Proof Map must expose change-flow route with production blocker.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
assertStatus(response, 200, 'Manager Flow Graph read');
const flowJson = JSON.stringify(response.body);
for (const id of [...assignmentProofIds, ...changeProofIds]) {
  assert(flowJson.includes(id), `Manager Flow Graph must expose chat command proof ${id}.`);
}

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agents/turing/dashboard` });
assertStatus(response, 200, 'Assignee Agent Dashboard read');
assert(JSON.stringify(response.body).includes(assignmentTask.id), 'Assignee Agent Dashboard must expose the assigned task proof.');

console.log('Manager chat command backend contract validation passed.');
