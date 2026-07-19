import assert from 'node:assert/strict';
import test from 'node:test';

import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function workflowProject() {
  return {
    id: 'workflow-node-intent-project',
    name: 'Workflow Node Intent Project',
    status: 'active',
    createdAt: '2026-07-18T09:00:00.000Z',
    updatedAt: '2026-07-18T09:00:00.000Z',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', isLeader: true },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer' },
    ],
    tasks: [
      {
        id: 'joint-launch-brief',
        text: 'Jointly produce the launch brief and submit it for independent review.',
        assignee: 'Steve Jobs',
        ownerId: 'jobs',
        status: 'in-progress',
      },
    ],
    agentStates: {},
    logs: [],
    eventLedger: [],
    agentSubmissions: [],
    submissionReviews: [],
  };
}

test('public Agent submission route preserves joint authorship and publishes a complete workflow node receipt', () => {
  const service = createAgentProjectService({ projects: [workflowProject()], messages: [] });
  const result = service.submitAgentArtifact({
    projectId: 'workflow-node-intent-project',
    agentId: 'jobs',
    coAuthorIds: ['turing'],
    participantIds: ['curie'],
    relationshipRoles: {
      jobs: 'primary-committer',
      turing: 'co-committer',
      curie: 'reviewer',
    },
    artifactType: 'product-brief',
    title: 'Joint launch brief',
    summary: 'Jobs and Turing jointly resolved the launch scope and prepared the brief for Curie review.',
    description: 'Jobs and Turing jointly produced this node because the launch scope is now stable. Curie should verify the evidence and either accept it or request a revision.',
    body: '# Joint launch brief\n\nA jointly authored launch recommendation with evidence and next actions.',
    taskId: 'joint-launch-brief',
    reviewerAgentId: 'curie',
    now: '2026-07-18T10:00:00.000Z',
  });

  assert.deepEqual(result.submission.committerIds, ['jobs', 'turing']);
  assert.deepEqual(result.submission.coAuthorIds, ['turing']);
  assert.equal(result.submission.relationshipRoles.jobs, 'primary-committer');
  assert.equal(result.submission.relationshipRoles.turing, 'co-committer');
  assert.equal(result.submission.relationshipRoles.curie, 'reviewer');
  assert.equal(result.submission.timelineSubmission.submissionQuality.schemaVersion, 'workflow-node-submission-quality/v1');
  assert.equal(result.submission.timelineSubmission.submissionQuality.authorshipMode, 'joint');
  assert.equal(result.submission.timelineSubmission.submissionQuality.readyForTimeline, true);

  const graph = service.getManagerFlowGraph('workflow-node-intent-project');
  const node = graph.nodes.find((item) => item.id === `agent-submission-${result.submission.id}`);

  assert.ok(node, 'joint submission must be visible in the public Manager Flow Graph read model');
  assert.equal(node.category, 'submission');
  assert.equal(node.semanticLabel, 'Phase');
  assert.equal(node.visual.iconKey, 'file-check');
  assert.equal(node.description, result.submission.description);
  assert.deepEqual(node.committerIds, ['jobs', 'turing']);
  assert.deepEqual(node.coAuthorIds, ['turing']);
  assert.equal(node.submission.quality.readyForTimeline, true);
  assert.equal(node.submission.quality.authorshipMode, 'joint');
  assert.equal(node.relationshipRoles.curie, 'reviewer');
  assert.ok(node.attachments.length >= 1);
});

test('Agent work-cycle records why it published and fills the lightweight node contract before artifact review', () => {
  const project = workflowProject();
  project.agentStates = {
    jobs: {
      status: 'working',
      currentPlan: { taskId: 'joint-launch-brief', focus: 'Prepare the joint launch brief' },
      obligations: [{ id: 'launch-brief-obligation', taskId: 'joint-launch-brief', text: 'Prepare the joint launch brief', status: 'open' }],
    },
  };
  const service = createAgentProjectService({ projects: [project], messages: [] });
  const result = service.runAgentWorkCycle({
    projectId: project.id,
    agentId: 'jobs',
    now: '2026-07-18T11:00:00.000Z',
    trigger: 'workflow-node-intent-test',
    useAutonomousStrategy: true,
    submitWorkArtifact: true,
    submitWorkArtifactOn: 'always',
    workArtifactType: 'product-brief',
    workArtifactReviewerAgentId: 'curie',
  });

  assert.equal(result.log.timelineSubmission.submissionMotivation.schemaVersion, 'agent-workflow-node-intent/v1');
  assert.equal(result.log.timelineSubmission.submissionMotivation.decision, 'submit');
  assert.ok(result.log.timelineSubmission.submissionMotivation.whyNow.length > 20);
  assert.equal(result.log.timelineSubmission.submissionQuality.readyForTimeline, true);
  assert.equal(result.log.timelineSubmission.submissionQuality.authorshipMode, 'individual');
  assert.equal(result.submission.timelineSubmission.submissionQuality.readyForTimeline, true);
  assert.equal(result.submission.descriptionSource, 'agent-authored');
});

test('public Agent work-cycle autonomously defers noise, submits a completed joint checkpoint, and declines empty monitoring', () => {
  const project = workflowProject();
  project.tasks[0].coAuthorIds = ['turing'];
  project.tasks[0].reviewerAgentId = 'curie';
  const service = createAgentProjectService({ projects: [project], messages: [] });

  const firstPulse = service.runAgentWorkCycle({
    projectId: project.id,
    agentId: 'jobs',
    now: '2026-07-18T12:00:00.000Z',
    trigger: 'workflow-node-autonomous-intent-test',
    useAutonomousStrategy: true,
  });
  assert.equal(firstPulse.contributionIntent.decision, 'defer');
  assert.equal(firstPulse.contributionIntent.reasonCode, 'checkpoint-not-ready');
  assert.equal(firstPulse.log.timelineSubmission.submissionMotivation.decision, 'defer');
  assert.equal(firstPulse.submission, null);

  const completionPulse = service.runAgentWorkCycle({
    projectId: project.id,
    agentId: 'jobs',
    now: '2026-07-18T12:05:00.000Z',
    trigger: 'workflow-node-autonomous-intent-test',
    useAutonomousStrategy: true,
  });
  assert.equal(completionPulse.contributionIntent.decision, 'submit');
  assert.equal(completionPulse.contributionIntent.reasonCode, 'reviewable-checkpoint');
  assert.equal(completionPulse.submission.timelineSubmission.submissionMotivation.reasonCode, 'reviewable-checkpoint');
  assert.deepEqual(completionPulse.submission.committerIds, ['jobs', 'turing']);
  assert.equal(completionPulse.submission.relationshipRoles.turing, 'co-committer');
  assert.equal(completionPulse.submission.timelineSubmission.submissionQuality.readyForTimeline, true);

  const monitoringPulse = service.runAgentWorkCycle({
    projectId: project.id,
    agentId: 'jobs',
    now: '2026-07-18T12:10:00.000Z',
    trigger: 'workflow-node-autonomous-intent-test',
    useAutonomousStrategy: true,
  });
  assert.equal(monitoringPulse.contributionIntent.decision, 'decline');
  assert.equal(monitoringPulse.contributionIntent.reasonCode, 'no-meaningful-change');
  assert.equal(monitoringPulse.submission, null);
});
