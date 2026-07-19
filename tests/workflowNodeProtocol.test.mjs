import assert from 'node:assert/strict';
import test from 'node:test';

import { localizeText } from '../src/i18n/runtime.js';

import {
  WORKFLOW_NODE_FAMILIES,
  WORKFLOW_NODE_FAMILY_ORDER,
  WORKFLOW_NODE_SCALES,
  decorateWorkflowNode,
  evaluateWorkflowNodeSubmissionQuality,
  inferWorkflowNodeFamily,
  workflowNodeTimeBucket,
  workflowNodeVisibleAtScale,
} from '../src/workflow/workflowNodeProtocol.js';

test('workflow node protocol classifies representative and future Agent behavior without losing subtype detail', () => {
  assert.equal(inferWorkflowNodeFamily({ subtype: 'idea-proposal', title: 'A new onboarding idea' }), 'thinking');
  assert.equal(inferWorkflowNodeFamily({ subtype: 'joint-deliverable', title: 'Jobs and Turing submitted the release brief' }), 'submission');
  assert.equal(inferWorkflowNodeFamily({ subtype: 'timeline-action-acknowledge' }), 'confirmation');
  assert.equal(inferWorkflowNodeFamily({ subtype: 'phase-summary' }), 'summary');
  assert.equal(inferWorkflowNodeFamily({ subtype: 'rollback-recovery' }), 'recovery');
  assert.equal(inferWorkflowNodeFamily({ eventType: 'agent-contracted', summary: 'Ada joined the project team.' }), 'collaboration');

  const futureNode = decorateWorkflowNode({
    id: 'future-review-node',
    category: 'review',
    subtype: 'quantum-review-synthesis',
    title: 'Future review synthesis',
    summary: 'A future subtype remains readable without a schema migration.',
  });

  assert.equal(futureNode.category, 'review');
  assert.equal(futureNode.subtype, 'quantum-review-synthesis');
  assert.equal(futureNode.categoryLabel, 'Review');
  assert.equal(WORKFLOW_NODE_FAMILY_ORDER.length, 14);
  assert.deepEqual(Object.keys(WORKFLOW_NODE_FAMILIES), WORKFLOW_NODE_FAMILY_ORDER);
});

test('semantic Timeline scales form a monotonic path from outcomes to raw trace', () => {
  assert.deepEqual(Object.keys(WORKFLOW_NODE_SCALES), ['month', 'week', 'day', 'hour']);
  assert.equal(localizeText(WORKFLOW_NODE_SCALES.day.label, 'zh'), '活动');

  const nodes = [
    decorateWorkflowNode({ id: 'milestone', category: 'decision', subtype: 'launch-decision', importance: 'critical', title: 'Launch decision' }),
    decorateWorkflowNode({ id: 'phase', category: 'submission', subtype: 'joint-deliverable', importance: 'normal', title: 'Joint delivery' }),
    decorateWorkflowNode({ id: 'activity', category: 'thinking', subtype: 'idea-proposal', importance: 'normal', title: 'Idea' }),
    decorateWorkflowNode({ id: 'trace', category: 'communication', subtype: 'meeting-agent-turn', importance: 'normal', title: 'Meeting turn' }),
  ];

  const visibleIds = (scale) => nodes.filter((node) => workflowNodeVisibleAtScale(node, scale)).map((node) => node.id);

  assert.deepEqual(visibleIds('month'), ['milestone']);
  assert.deepEqual(visibleIds('week'), ['milestone', 'phase']);
  assert.deepEqual(visibleIds('day'), ['milestone', 'phase', 'activity']);
  assert.deepEqual(visibleIds('hour'), ['milestone', 'phase', 'activity', 'trace']);

  const timestamp = '2026-07-18T10:45:32.000Z';
  assert.equal(workflowNodeTimeBucket({ time: timestamp }, 'month'), '2026-07-01T00:00:00.000Z');
  assert.equal(workflowNodeTimeBucket({ time: timestamp }, 'week'), '2026-07-13T00:00:00.000Z');
  assert.equal(workflowNodeTimeBucket({ time: timestamp }, 'day'), '2026-07-18T00:00:00.000Z');
  assert.equal(workflowNodeTimeBucket({ time: timestamp }, 'hour'), '2026-07-18T10:00:00.000Z');
});

test('submission quality receipt distinguishes complete joint authorship from display-only placeholder data', () => {
  const completeNode = decorateWorkflowNode({
    id: 'joint-submit',
    category: 'submission',
    subtype: 'joint-deliverable',
    title: 'Joint launch brief',
    description: 'Jobs and Turing jointly produced the launch brief, resolved the open design choice, and request Curie review.',
    commitMessage: 'Submit the jointly authored launch brief for review.',
    committerIds: ['jobs', 'turing'],
    coAuthorIds: ['turing'],
    participantIds: ['curie'],
    relationshipRoles: {
      jobs: 'primary-committer',
      turing: 'co-committer',
      curie: 'reviewer',
    },
    proofIds: ['message-joint-submit'],
  });
  const completeSubmission = {
    id: 'submission-joint-submit',
    intent: 'Publish the joint brief for independent review.',
    commitMessage: completeNode.commitMessage,
    committerIds: ['jobs', 'turing'],
    coAuthorIds: ['turing'],
    participantIds: ['curie'],
    relationshipRoles: completeNode.relationshipRoles,
  };
  const quality = evaluateWorkflowNodeSubmissionQuality({
    node: completeNode,
    submission: completeSubmission,
    attachments: [{ id: 'artifact-launch-brief', type: 'product-brief', title: 'Launch brief' }],
  });

  assert.equal(quality.schemaVersion, 'workflow-node-submission-quality/v1');
  assert.equal(quality.authorshipMode, 'joint');
  assert.equal(quality.readyForTimeline, true);
  assert.ok(quality.completenessScore >= 85);
  assert.deepEqual(quality.missingFieldIds, []);

  const incompleteQuality = evaluateWorkflowNodeSubmissionQuality({
    node: { id: 'placeholder', category: 'submission', subtype: 'record', title: 'Placeholder', agentId: 'jobs' },
    submission: { intent: '', commitMessage: '', committerIds: ['jobs'] },
    attachments: [],
  });

  assert.equal(incompleteQuality.readyForTimeline, false);
  assert.ok(incompleteQuality.completenessScore < 85);
  assert.ok(incompleteQuality.missingFieldIds.includes('description'));
  assert.ok(incompleteQuality.missingFieldIds.includes('relationshipRoles'));
  assert.ok(incompleteQuality.missingFieldIds.includes('attachmentsOrProof'));
});
