import {
  advanceAutonomousProjectCycle,
  createAutonomousCycleChatMessages,
  createAgentNetwork,
  createKickoffCharter,
  createKickoffRoleNegotiation,
  createLeaderAssignmentPackage,
  createLeaderElection,
  handleLeaderChatAssignment,
  handlePeerHandoff,
  handleFeatureChangeRequest,
  isLeaderAssignmentRequest,
  isPeerHandoffRequest,
  isFeatureChangeRequest,
} from '../src/agents/agentRuntime.js';
import { readFileSync } from 'node:fs';

const team = [
  { id: 'jobs', name: 'Steve Jobs', title: 'Product Visionary' },
  { id: 'turing', name: 'Alan Turing', title: 'System Architect' },
  { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
  { id: 'musk', name: 'Elon Musk', title: 'Execution Driver' },
  { id: 'confucius', name: 'Confucius', title: 'Consensus Steward' },
];

const projectId = 'scenario_validation_project';
const projectName = 'Manager Scenario Validation';
const brief = [
  projectName,
  'Kickoff meeting, role clarification, Leader election, group chat task assignment, 24/7 work, timeline proof, and Google Chat feature change.',
].join(' ');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(value, pattern, message) {
  assert(pattern.test(value), `${message}: ${value}`);
}

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
assert(!appSource.includes("false && initiationStep === 'meeting'"), 'Initiation meeting UI must not be disabled by a false guard.');
assert(appSource.includes('meetingTranscript.map'), 'Initiation meeting UI must render runtime-generated meeting transcript entries.');

const roleNegotiation = createKickoffRoleNegotiation(team, brief, { projectId, projectName });
assert(roleNegotiation.transcript.some((item) => item.type === 'role-question'), 'Kickoff must include role clarification questions.');
assert(roleNegotiation.transcript.some((item) => item.type === 'role-volunteer'), 'Kickoff must include self-nomination turns.');
assert(roleNegotiation.transcript.every((item) => Array.isArray(item.hears)), 'Kickoff turns must expose who each Agent hears.');

const leaderElection = createLeaderElection(team, brief, { projectId, projectName });
assert(leaderElection.candidates.length >= 2, 'Leader election must have multiple candidates.');
assert(leaderElection.transcript.every((item) => item.type === 'leader-campaign'), 'Leader election must produce campaign statements.');

const leaderId = leaderElection.recommendedLeaderId;
const confirmedTeam = team.map((member) => ({
  ...member,
  role: member.id === leaderId ? 'Leader' : member.title,
  skill: member.title,
  isLeader: member.id === leaderId,
}));
const network = createAgentNetwork(confirmedTeam, { projectId, projectName, topic: brief });
assert(network.governance.lead?.id === leaderId, 'Confirmed isLeader marker must control runtime governance.');

const project = {
  id: projectId,
  name: projectName,
  status: 'executing',
  progress: 10,
  team: confirmedTeam,
  tasks: [
    { id: 1, text: 'Create kickoff charter', assignee: confirmedTeam.find((agent) => agent.isLeader).name, status: 'done' },
    { id: 2, text: 'Build group chat assignment protocol', assignee: 'Alan Turing', status: 'pending' },
    { id: 3, text: 'Define timeline evidence criteria', assignee: 'Marie Curie', status: 'pending' },
  ],
  logs: [],
};

const assignmentPackage = createLeaderAssignmentPackage({
  project,
  leaderId,
  now: '2026-05-28T10:00:00.000Z',
});
assert(assignmentPackage.assignmentMessages.length >= 2, 'Leader must assign open tasks in group chat.');
assert(assignmentPackage.assignmentMessages.every((message) => message.type === 'mention' && message.text.includes('@')), 'Assignments must be @mentions.');
assert(assignmentPackage.assignmentLogs.every((log) => log.eventType === 'leader-assignment'), 'Leader assignments must enter timeline logs.');
assert(assignmentPackage.acknowledgementMessages.length === assignmentPackage.assignmentMessages.length, 'Every assignment must produce an immediate assignee acknowledgement.');
assert(assignmentPackage.acknowledgementMessages.every((message) => message.assignmentReceipt?.ownerId && message.text.includes('starting work now')), 'Acknowledgements must show the assigned Agent received and started the task.');
assert(assignmentPackage.acknowledgementLogs.every((log) => log.eventType === 'assignment-acknowledged'), 'Assignment acknowledgements must enter timeline logs.');
assert(assignmentPackage.tasks.filter((task) => task.status !== 'done').every((task) => task.ownerId && task.assignedBy === leaderId), 'Assigned tasks must carry owner and assigning Leader.');
const kickoffCharter = createKickoffCharter({
  project: { ...project, tasks: assignmentPackage.tasks },
  leaderId,
  reviewerId: confirmedTeam.find((agent) => agent.id !== leaderId)?.id,
  roleNegotiation,
  leaderElection,
  assignmentPackage,
  now: '2026-05-28T10:05:00.000Z',
});
assert(kickoffCharter.status === 'approved', 'Kickoff charter must approve the project for autonomous execution.');
assert(kickoffCharter.governance.leaderId === leaderId, 'Kickoff charter must preserve the confirmed Leader.');
assert(kickoffCharter.meeting.roleQuestionCount > 0, 'Kickoff charter must count role clarification questions.');
assert(kickoffCharter.meeting.selfNominationCount > 0, 'Kickoff charter must count self-nominations.');
assert(kickoffCharter.nextActions.length >= assignmentPackage.tasks.length, 'Kickoff charter must include next actions.');
assert(kickoffCharter.communicationRules.some((rule) => rule.includes('@mentions')), 'Kickoff charter must include group chat assignment rules.');
assert(kickoffCharter.evidence.assignmentMessageIds.length === assignmentPackage.assignmentMessages.length, 'Kickoff charter must preserve assignment evidence ids.');
assert(kickoffCharter.evidence.acknowledgementMessageIds.length === assignmentPackage.acknowledgementMessages.length, 'Kickoff charter must preserve assignment acknowledgement evidence ids.');

const assignedProject = {
  ...project,
  kickoffCharter,
  tasks: assignmentPackage.tasks.map((task) => (
    task.status === 'done' ? task : { ...task, workPulseCount: 2 }
  )),
  logs: [...assignmentPackage.acknowledgementLogs, ...assignmentPackage.assignmentLogs],
};

const changeText = '@all 新增一个 Google Chat export summary 功能';
const liveAssignmentText = 'leader assign @Alan Turing build the live manager-review assignment audit';
assert(isLeaderAssignmentRequest(liveAssignmentText), 'Leader assignment detector must catch group-chat assignment requests.');
const liveAssignment = handleLeaderChatAssignment({
  project: assignedProject,
  text: liveAssignmentText,
  leaderId,
  channelId: 'main',
  now: '2026-05-28T10:20:00.000Z',
});
assert(liveAssignment.task.source === 'leader-chat-assignment', 'Live Leader assignment must create a task from group chat.');
assert(liveAssignment.task.ownerId === 'turing', 'Live Leader assignment must resolve the mentioned Agent as owner.');
assert(liveAssignment.assignmentMessage.type === 'mention' && liveAssignment.assignmentMessage.text.includes('@Alan Turing'), 'Live Leader assignment must be emitted as an @mention from the Leader.');
assert(liveAssignment.acknowledgementMessage.assignmentReceipt?.taskId === liveAssignment.task.id, 'Mentioned Agent must immediately acknowledge the new assignment.');
assert(liveAssignment.logs.some((log) => log.eventType === 'leader-assignment'), 'Live Leader assignment must enter timeline logs.');
assert(liveAssignment.logs.some((log) => log.eventType === 'assignment-acknowledged'), 'Live Leader acknowledgement must enter timeline logs.');
assert(liveAssignment.project.agentStates.turing?.inbox.some((item) => item.taskId === liveAssignment.task.id), 'Mentioned Agent state must receive the assignment in its inbox.');
assert(liveAssignment.project.agentStates[leaderId]?.managedIds.includes('turing'), 'Leader state must manage the newly assigned Agent.');

const peerHandoffText = 'Alan Turing needs dependency help from @Marie Curie review the timeline evidence criteria';
assert(isPeerHandoffRequest(peerHandoffText), 'Peer handoff detector must catch Agent-to-Agent dependency requests.');
const peerHandoff = handlePeerHandoff({
  project: liveAssignment.project,
  text: peerHandoffText,
  requesterId: 'turing',
  channelId: 'main',
  now: '2026-05-28T10:35:00.000Z',
});
assert(peerHandoff.task.source === 'peer-handoff', 'Peer handoff must create a dependency task.');
assert(peerHandoff.task.ownerId === 'curie', 'Peer handoff must resolve the mentioned peer as owner.');
assert(peerHandoff.requestMessage.author === 'Alan Turing', 'Peer handoff request must be authored by the requesting Agent.');
assert(peerHandoff.requestMessage.type === 'mention' && peerHandoff.requestMessage.text.includes('@Marie Curie'), 'Peer handoff request must be an @mention.');
assert(peerHandoff.acknowledgementMessage.handoffReceipt?.taskId === peerHandoff.task.id, 'Peer handoff target must acknowledge the dependency.');
assert(peerHandoff.logs.some((log) => log.eventType === 'peer-handoff'), 'Peer handoff request must enter timeline logs.');
assert(peerHandoff.logs.some((log) => log.eventType === 'peer-handoff-ack'), 'Peer handoff acknowledgement must enter timeline logs.');
assert(peerHandoff.project.peerHandoffs?.[0]?.status === 'accepted', 'Peer handoff ledger must record accepted handoffs.');
assert(peerHandoff.project.agentStates.turing?.peerManagedIds.includes('curie'), 'Requester state must show peer-managed dependency owner.');
assert(peerHandoff.project.agentStates.curie?.peerManagerIds.includes('turing'), 'Target state must show peer manager relation.');
assert(peerHandoff.project.agentStates.curie?.inbox.some((item) => item.source === 'peer-handoff'), 'Target state must receive peer handoff inbox item.');

assert(isFeatureChangeRequest(changeText), 'Feature-change detector must catch Chinese/English mixed requests.');
const changeResponse = handleFeatureChangeRequest({
  project: peerHandoff.project,
  text: changeText,
  author: 'director',
  now: '2026-05-28T11:00:00.000Z',
  channelId: 'google_chat',
  source: 'google-chat-mention-change-request',
});
assert(changeResponse.changeTask.source === 'google-chat-mention-change-request', 'Change task must preserve Google Chat source.');
assert(changeResponse.changeTask.sourceChannelId === 'google_chat', 'Change task must preserve source channel.');
assert(changeResponse.changeRecord.status === 'confirmed-and-synced', 'Change ledger record must capture confirmed and synced status.');
assert(changeResponse.changeRecord.sourceChannelId === 'google_chat', 'Change ledger record must preserve source channel.');
assert(changeResponse.changeRecord.ownerId, 'Change ledger record must preserve responsible owner.');
assert(changeResponse.changeRecord.taskId === changeResponse.changeTask.id, 'Change ledger record must bind to the created task.');
assert(changeResponse.changeRecord.confirmationMessageId, 'Change ledger record must preserve confirmation evidence.');
assert(changeResponse.changeRecord.syncMessageId, 'Change ledger record must preserve owner sync evidence.');
assert(changeResponse.changeRecord.planUpdate?.includes('Plan updated'), 'Change ledger record must preserve plan update text.');
assert(changeResponse.changeRecord.ownerStateUpdated, 'Change ledger record must show the responsible owner state was updated.');
assert(changeResponse.ownerStateUpdate?.currentPlan?.taskId === changeResponse.changeTask.id, 'Feature change must enter the responsible owner current plan.');
assert(changeResponse.ownerStateUpdate?.obligations?.some((item) => item.taskId === changeResponse.changeTask.id), 'Feature change must create an owner obligation.');
assert(changeResponse.ownerStateUpdate?.inbox?.some((item) => item.sourceChannelId === 'google_chat'), 'Feature change owner state must preserve source channel inbox evidence.');
assert(changeResponse.project.agentStates[changeResponse.changeRecord.ownerId]?.currentPlan?.taskId === changeResponse.changeTask.id, 'Returned project must persist owner plan state.');
assert(changeResponse.project.changeLedger?.[0]?.id === changeResponse.changeRecord.id, 'Returned project must persist the change ledger entry.');
assert(changeResponse.discussionMessages.every((message) => message.channelId === 'google_chat'), 'Change discussion must remain in source channel.');
assert(changeResponse.discussionMessages.some((message) => message.type === 'decision'), 'Responsible owner must confirm the change.');
assert(changeResponse.discussionMessages.some((message) => message.id.includes('change_sync')), 'Responsible owner must sync the accepted plan to everyone.');

const changedProject = {
  ...changeResponse.project,
  objective: 'backend architecture evidence product execution for manager demo',
  currentObjective: 'implementation, evidence review, product flow, and execution delivery',
  tasks: changeResponse.project.tasks.map((task) => (
    task.id === changeResponse.changeTask.id ? { ...task, workPulseCount: 2 } : task
  )),
};
const cycle = advanceAutonomousProjectCycle({
  project: changedProject,
  team: changedProject.team,
  cadence: 'daily',
  messages: [],
  now: '2026-05-28T12:00:00.000Z',
});
assert(cycle.project.logs.some((log) => log.eventType === 'task-completed'), 'Autonomous work must publish task completion to timeline logs.');
assert(cycle.project.autonomousLedger?.[0]?.publishedEventCount > 0, 'Autonomous cycle must publish visible progress.');
assert(cycle.project.progress > changedProject.progress, 'Autonomous cycle must move project progress.');
assert(cycle.project.agentStates, 'Autonomous cycle must persist independent per-Agent state.');
assert(confirmedTeam.every((agent) => cycle.project.agentStates[agent.id]), 'Every Agent must have a state record.');
assert(cycle.project.agentStates[leaderId].managedIds.length > 0, 'Leader state must show managed Agents.');
assert(Object.values(cycle.project.agentStates).some((state) => state.managerId === leaderId), 'Non-leader states must point to the Leader manager.');
assert(Object.values(cycle.project.agentStates).every((state) => state.currentPlan?.focus), 'Every Agent state must include an active work plan.');
assert(Object.values(cycle.project.agentStates).every((state) => state.currentPlan?.routine?.id), 'Every Agent state must include a fixed work routine.');
assert(Object.values(cycle.project.agentStates).some((state) => state.worklog.length > 0), 'Agent states must preserve private worklog entries.');
assert(cycle.project.agentStates.turing?.peerManagedIds.includes('curie'), 'Autonomous cycle must preserve peer handoff requester relations.');
assert(cycle.project.agentStates.curie?.peerManagerIds.includes('turing'), 'Autonomous cycle must preserve peer handoff target relations.');
assert(cycle.project.autonomousLedger?.[0]?.agentPlans.every((plan) => plan.routineId && plan.routineArtifact), 'Autonomous ledger must store fixed work routine evidence for every Agent.');
assert(cycle.cycle.agentPlans.every((plan) => plan.privateWork?.routine?.checklist?.length > 0), 'Cycle plans must include routine checklists.');
const cycleChatMessages = createAutonomousCycleChatMessages({
  project: cycle.project,
  cycle: cycle.cycle,
  cadence: 'daily',
  projectId,
});
assert(cycleChatMessages.length > 0, 'Autonomous cycles must produce group chat records.');
assert(cycleChatMessages.every((message) => message.projectId === projectId && message.channelId === 'main'), 'Autonomous chat records must be project-scoped group chat messages.');
assert(cycleChatMessages.some((message) => message.type === 'progress'), 'Autonomous chat records must include visible progress updates.');

const assignmentText = assignmentPackage.assignmentMessages.map((message) => message.text).join(' ');
assertIncludes(assignmentText, /@/, 'Leader assignment transcript must include mentions');

console.log('Agent manager scenario validation passed.');
