import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import {
  WORKFLOW_NODE_SCALES,
  workflowNodeVisibleAtScale,
} from '../src/workflow/workflowNodeProtocol.js';
import { summarizeAgentContributionOutcomes } from '../src/workflow/agentContributionPolicy.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const projectId = 'workflow_node_intent_contract_project';
const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', isLeader: true },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer' },
];
const taskSpecs = [
  { id: 'task-product', ownerId: 'jobs', assignee: 'Steve Jobs', text: 'Complete the product decision brief for the workflow node upgrade', artifactType: 'product-brief', reviewerId: 'curie', coAuthorIds: ['turing'] },
  { id: 'task-system', ownerId: 'turing', assignee: 'Alan Turing', text: 'Complete the implementation plan for semantic Timeline zoom', artifactType: 'implementation-plan', reviewerId: 'curie' },
  { id: 'task-evidence', ownerId: 'curie', assignee: 'Marie Curie', text: 'Complete the evidence packet for Agent submission quality', artifactType: 'evidence-packet', reviewerId: 'jobs' },
];

const project = {
  id: projectId,
  name: 'Workflow Node Intent Contract Project',
  status: 'active',
  createdAt: '2026-07-18T09:00:00.000Z',
  updatedAt: '2026-07-18T09:00:00.000Z',
  team,
  tasks: taskSpecs.map((task) => ({
    ...task,
    status: 'in-progress',
    workPulseCount: 0,
    reviewerAgentId: task.reviewerId,
  })),
  agentStates: Object.fromEntries(taskSpecs.map((task) => [task.ownerId, {
    status: 'working',
    currentPlan: { taskId: task.id, focus: task.text },
    obligations: [{ id: `obligation-${task.id}`, taskId: task.id, text: task.text, status: 'open' }],
  }])),
  logs: [],
  eventLedger: [],
  agentSubmissions: [],
  submissionReviews: [],
};

const service = createAgentProjectService({ projects: [project], messages: [] });
const runResults = [];
for (let round = 0; round < 6; round += 1) {
  for (const [index, task] of taskSpecs.entries()) {
    const minute = round * taskSpecs.length + index;
    const result = service.runAgentWorkCycle({
      projectId,
      agentId: task.ownerId,
      now: `2026-07-18T10:${String(minute).padStart(2, '0')}:00.000Z`,
      trigger: 'workflow-node-intent-contract',
      useAutonomousStrategy: true,
      workArtifactType: task.artifactType,
      workArtifactReviewerAgentId: task.reviewerId,
    });
    runResults.push(result);
  }
  const currentProject = service.getProject(projectId);
  if (team.every((agent) => (currentProject.agentSubmissions || []).some((submission) => submission.agentId === agent.id))) break;
}

for (const result of runResults) {
  const intent = result.contributionIntent;
  assert(intent?.schemaVersion === 'agent-workflow-node-intent/v1', `${result.agent?.agentId} must expose a versioned contribution intent.`);
  assert(['submit', 'defer', 'decline'].includes(intent.decision), `${result.agent?.agentId} must explicitly submit, defer, or decline.`);
  assert(intent.whyNow?.length > 20, `${result.agent?.agentId} must explain its publication decision.`);
  assert(result.log?.timelineSubmission?.submissionMotivation?.decision === intent.decision, `${result.agent?.agentId} Timeline trace must preserve the contribution decision.`);
  assert(result.log.timelineSubmission.submissionQuality?.readyForTimeline === true, `${result.agent?.agentId} work-cycle trace must fill every required Timeline field.`);
  assert(intent.reasonCode !== 'explicit-publication-request', 'The acceptance run must not force Agent publication through caller controls.');
  assert(result.strategyDecision?.schemaVersion === 'agent-autonomous-strategy-decision/v1', `${result.agent?.agentId} must record an autonomous strategy decision alongside publication intent.`);
  assert(result.strategyDecision.rationale?.join(' ').length > 20, `${result.agent?.agentId} strategy decision must explain its current priority.`);
  if (result.submission) {
    assert(result.submission.timelineSubmission?.submissionQuality?.readyForTimeline === true, `${result.agent?.agentId} artifact submission must fill every required Timeline field.`);
  }
}

const contributionSummary = summarizeAgentContributionOutcomes(runResults.map((result) => ({
  intent: result.contributionIntent,
  submitted: Boolean(
    result.contributionIntent?.decision === 'submit'
    && result.log?.timelineSubmission?.submissionMotivation?.decision === 'submit'
  ),
})));
assert(contributionSummary.submitDecisionCount >= team.length, 'The bounded task must create valuable autonomous submission decisions.');
assert(contributionSummary.deferCount >= team.length, 'Every Agent must demonstrate that unfinished work is deferred rather than spammed onto the Timeline.');
assert(contributionSummary.declineCount >= 1, 'At least one idle Agent must explicitly decline low-value monitoring publication.');
assert(contributionSummary.conversionRate === 1, 'Every submit intent in the bounded run must produce a submission, review, or revision node.');
assert(contributionSummary.noiseRate === 0, 'Deferred, declined, or duplicate opportunities must not create formal publication outcomes.');

const jointSubmission = service.submitAgentArtifact({
  projectId,
  agentId: 'jobs',
  coAuthorIds: ['turing'],
  participantIds: ['curie'],
  relationshipRoles: {
    jobs: 'primary-committer',
    turing: 'co-committer',
    curie: 'reviewer',
  },
  artifactType: 'decision-proposal',
  title: 'Joint workflow node upgrade decision',
  summary: 'Jobs and Turing jointly recommend the shared workflow-node protocol after Curie evidence review.',
  description: 'Jobs and Turing combined product and system ownership into one reviewable decision node. Curie is the independent reviewer, not a co-author.',
  body: '# Joint workflow node upgrade decision\n\nAdopt the shared taxonomy, semantic scale, relationship attribution, and submission-quality gate.',
  reviewerAgentId: 'curie',
  now: '2026-07-18T10:10:00.000Z',
});

assert(jointSubmission.submission.timelineSubmission.submissionQuality.authorshipMode === 'joint', 'Joint submission must report joint authorship mode.');
assert(jointSubmission.submission.timelineSubmission.submissionQuality.readyForTimeline === true, 'Joint submission must pass field completeness.');
assert(jointSubmission.submission.coAuthorIds.includes('turing'), 'Joint submission must retain the co-author id.');
assert(jointSubmission.submission.relationshipRoles.curie === 'reviewer', 'Reviewer must not be misclassified as a co-author.');

const finalProject = service.getProject(projectId);
const autonomousJointSubmission = finalProject.agentSubmissions.find((submission) => (
  submission.agentId === 'jobs'
  && submission.taskId === 'task-product'
));
assert(autonomousJointSubmission?.coAuthorIds?.includes('turing'), 'Autonomous task metadata must produce a real joint submission without caller-supplied co-author controls.');
assert(autonomousJointSubmission?.timelineSubmission?.submissionMotivation?.reasonCode === 'reviewable-checkpoint', 'Autonomous joint publication must retain its value-based reason.');
for (const agent of team) {
  const agentTimelineSubmissions = (finalProject.logs || []).filter((log) => log.agentId === agent.id && log.timelineSubmission?.submissionMotivation?.decision === 'submit');
  const agentArtifacts = (finalProject.agentSubmissions || []).filter((submission) => submission.agentId === agent.id);
  assert(agentTimelineSubmissions.length >= 1, `${agent.name} must actively publish at least one workflow node.`);
  assert(agentArtifacts.length >= 1, `${agent.name} must publish at least one typed artifact node.`);
}

const graph = service.getManagerFlowGraph(projectId);
const actualSubmissionNodes = graph.nodes.filter((node) => node.source === 'agentSubmissions' && node.id.startsWith('agent-submission-'));
assert(actualSubmissionNodes.length >= team.length + 1, 'Manager Flow Graph must expose every Agent artifact plus the joint submission.');
const incompleteSubmissionNodes = actualSubmissionNodes.filter((node) => node.submission?.quality?.readyForTimeline !== true);
assert(
  incompleteSubmissionNodes.length === 0,
  `Every real Agent submission node must carry a passing quality receipt. Incomplete: ${incompleteSubmissionNodes.map((node) => `${node.id} [${(node.submission?.quality?.missingFieldIds || []).join(', ')}]`).join('; ')}`,
);

const jointGraphNode = graph.nodes.find((node) => node.id === `agent-submission-${jointSubmission.submission.id}`);
assert(jointGraphNode?.committerIds?.includes('jobs') && jointGraphNode.committerIds.includes('turing'), 'Relationship graph must retain both joint committers.');
assert(jointGraphNode?.relationshipRoles?.curie === 'reviewer', 'Relationship graph must preserve Reviewer attribution separately.');

const scaleNodeIds = Object.fromEntries(Object.keys(WORKFLOW_NODE_SCALES).map((scale) => [
  scale,
  new Set(graph.nodes.filter((node) => workflowNodeVisibleAtScale(node, scale)).map((node) => node.id)),
]));
const scaleOrder = ['month', 'week', 'day', 'hour'];
for (let index = 1; index < scaleOrder.length; index += 1) {
  const coarser = scaleNodeIds[scaleOrder[index - 1]];
  const finer = scaleNodeIds[scaleOrder[index]];
  assert([...coarser].every((id) => finer.has(id)), `${scaleOrder[index]} must retain every node visible at ${scaleOrder[index - 1]}.`);
}
assert(scaleNodeIds.hour.size > scaleNodeIds.month.size, 'Trace view must reveal more nodes than Outcome view.');

console.log(JSON.stringify({
  participatingAgentCount: team.length,
  activeAgentSubmissionRate: team.filter((agent) => finalProject.agentSubmissions.some((submission) => submission.agentId === agent.id)).length / team.length,
  typedArtifactCount: finalProject.agentSubmissions.length,
  completeRealSubmissionNodeCount: actualSubmissionNodes.length,
  jointAuthorshipVerified: true,
  autonomousJointAuthorshipVerified: true,
  intentRate: Number((contributionSummary.submitDecisionCount / contributionSummary.opportunityCount).toFixed(3)),
  fieldCompletenessRate: Number(((actualSubmissionNodes.length - incompleteSubmissionNodes.length) / actualSubmissionNodes.length).toFixed(3)),
  contributionSummary,
  strategyDecisions: runResults.map((result) => ({
    agentId: result.agent?.agentId,
    selectedAction: result.strategyDecision?.selectedAction,
    contributionDecision: result.contributionIntent?.decision,
    contributionReason: result.contributionIntent?.reasonCode,
  })),
  visibleNodeCounts: Object.fromEntries(scaleOrder.map((scale) => [scale, scaleNodeIds[scale].size])),
}, null, 2));
console.log('Workflow node intent contract validation passed.');
