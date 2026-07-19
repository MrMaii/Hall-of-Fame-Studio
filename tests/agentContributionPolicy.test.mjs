import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateAgentContributionOpportunity,
  summarizeAgentContributionOutcomes,
} from '../src/workflow/agentContributionPolicy.js';

const agent = { id: 'jobs', name: 'Steve Jobs' };
const jointTask = {
  id: 'launch-brief',
  text: 'Publish the launch brief',
  ownerId: 'jobs',
  coAuthorIds: ['turing'],
  reviewerAgentId: 'curie',
  status: 'in-progress',
};

test('contribution policy submits valuable checkpoints with explicit joint attribution', () => {
  const intent = evaluateAgentContributionOpportunity({
    project: { id: 'project', agentSubmissions: [] },
    agent,
    task: jointTask,
    completed: true,
    strategyDecision: { selectedAction: 'complete-and-submit-owned-work' },
    now: '2026-07-18T12:00:00.000Z',
  });

  assert.equal(intent.schemaVersion, 'agent-workflow-node-intent/v1');
  assert.equal(intent.policySchemaVersion, 'agent-contribution-intent/v1');
  assert.equal(intent.decision, 'submit');
  assert.equal(intent.reasonCode, 'reviewable-checkpoint');
  assert.equal(intent.proposedNode.family, 'submission');
  assert.equal(intent.proposedNode.subtype, 'joint-submit');
  assert.deepEqual(intent.committerIds, ['jobs', 'turing']);
  assert.equal(intent.relationshipRoles.jobs, 'primary-committer');
  assert.equal(intent.relationshipRoles.turing, 'co-committer');
  assert.equal(intent.relationshipRoles.curie, 'reviewer');
  assert.ok(intent.whyNow.length > 20);
  assert.ok(intent.evidencePlan.length >= 3);
});

test('contribution policy defers unfinished and duplicate work, then declines empty monitoring noise', () => {
  const unfinished = evaluateAgentContributionOpportunity({
    project: { id: 'project', agentSubmissions: [] },
    agent,
    task: jointTask,
    completed: false,
    strategyDecision: { selectedAction: 'continue-owned-work' },
  });
  assert.equal(unfinished.decision, 'defer');
  assert.equal(unfinished.reasonCode, 'checkpoint-not-ready');

  const duplicate = evaluateAgentContributionOpportunity({
    project: {
      id: 'project',
      agentSubmissions: [{ id: 'existing', agentId: 'jobs', taskId: 'launch-brief', reviewStatus: 'pending-review' }],
    },
    agent,
    task: jointTask,
    completed: true,
    strategyDecision: { selectedAction: 'complete-and-submit-owned-work' },
  });
  assert.equal(duplicate.decision, 'defer');
  assert.equal(duplicate.reasonCode, 'duplicate-submission');
  assert.deepEqual(duplicate.duplicationRisk.matchingSubmissionIds, ['existing']);

  const monitoring = evaluateAgentContributionOpportunity({
    project: { id: 'project', agentSubmissions: [] },
    agent,
    task: null,
    completed: false,
    strategyDecision: { selectedAction: 'monitor-project' },
  });
  assert.equal(monitoring.decision, 'decline');
  assert.equal(monitoring.reasonCode, 'no-meaningful-change');

  assert.deepEqual(summarizeAgentContributionOutcomes([
    { intent: unfinished, submitted: false },
    { intent: duplicate, submitted: false },
    { intent: monitoring, submitted: false },
  ]), {
    schemaVersion: 'agent-contribution-outcome-summary/v1',
    opportunityCount: 2,
    submitDecisionCount: 0,
    deferCount: 2,
    declineCount: 1,
    publishedCount: 0,
    conversionRate: 0,
    noiseRate: 0,
  });
});
