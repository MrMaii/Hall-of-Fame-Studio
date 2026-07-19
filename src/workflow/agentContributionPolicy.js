function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

function activeDuplicateSubmissions(project = {}, agent = {}, task = null) {
  if (!task?.id || !agent?.id) return [];
  return (project.agentSubmissions || []).filter((submission) => (
    String(submission.agentId || '') === String(agent.id)
    && String(submission.taskId || '') === String(task.id)
    && !['rejected', 'superseded', 'withdrawn'].includes(String(submission.reviewStatus || submission.status || '').toLowerCase())
  ));
}

export function evaluateAgentContributionOpportunity({
  project = {},
  agent = {},
  task = null,
  completed = false,
  managementSignals = [],
  strategyDecision = null,
  now = new Date().toISOString(),
} = {}) {
  const selectedAction = strategyDecision?.selectedAction || '';
  const duplicateSubmissions = activeDuplicateSubmissions(project, agent, task);
  const coAuthorIds = uniqueStrings([
    ...(task?.coAuthorIds || []),
    ...(task?.collaboratorIds || []),
  ]).filter((id) => id !== String(agent.id || ''));
  const reviewerAgentId = task?.reviewerAgentId || task?.reviewerId || null;
  const committerIds = uniqueStrings([agent.id, ...coAuthorIds]);
  const participantIds = uniqueStrings([...committerIds, reviewerAgentId]);
  const relationshipRoles = Object.fromEntries(participantIds.map((participantId) => [
    participantId,
    participantId === String(agent.id || '')
      ? 'primary-committer'
      : coAuthorIds.includes(participantId)
        ? 'co-committer'
        : participantId === String(reviewerAgentId || '')
          ? 'reviewer'
          : 'participant',
  ]));

  let decision = 'decline';
  let reasonCode = 'no-meaningful-change';
  let whyNow = 'No owned task, review obligation, management signal, or material project change requires publication.';
  let expectedValue = 'avoid-low-value-timeline-noise';
  let family = 'monitoring';
  let subtype = 'monitor-no-publication';

  if (duplicateSubmissions.length) {
    decision = 'defer';
    reasonCode = 'duplicate-submission';
    whyNow = 'An active submission already represents this Agent and task, so publishing another node would duplicate the same review checkpoint.';
    expectedValue = 'preserve-one-authoritative-review-lineage';
    family = 'submission';
    subtype = 'duplicate-deferred';
  } else if (selectedAction === 'respond-to-review-obligation') {
    decision = 'submit';
    reasonCode = 'review-obligation';
    whyNow = 'Requested changes create a new reviewable revision checkpoint that must be linked to the original submission.';
    expectedValue = 'close-requested-changes-with-proof';
    family = 'submission';
    subtype = 'revision-submit';
  } else if (selectedAction === 'review-pending-submission') {
    decision = 'submit';
    reasonCode = 'independent-review';
    whyNow = 'A teammate submission is awaiting independent evaluation, so the verdict and its evidence should become a durable review node.';
    expectedValue = 'independent-quality-verdict';
    family = 'review';
    subtype = 'submission-review';
  } else if (
    strategyDecision?.controls?.submitWorkArtifact
    && strategyDecision?.controls?.submitWorkArtifactOn === 'always'
  ) {
    decision = 'submit';
    reasonCode = 'explicit-publication-request';
    whyNow = 'The caller explicitly requested a proofed artifact publication for this work pulse, so the runtime records that override instead of presenting it as an autonomous choice.';
    expectedValue = 'caller-requested-reviewable-artifact';
    family = 'submission';
    subtype = coAuthorIds.length ? 'joint-submit' : 'individual-submit';
  } else if (completed || selectedAction === 'complete-and-submit-owned-work') {
    decision = 'submit';
    reasonCode = 'reviewable-checkpoint';
    whyNow = 'The owned task reached a reviewable completion checkpoint with an artifact and proof that collaborators can inspect.';
    expectedValue = 'manager-reviewable-deliverable';
    family = 'submission';
    subtype = coAuthorIds.length ? 'joint-submit' : 'individual-submit';
  } else if (managementSignals.length || selectedAction === 'answer-management-signal') {
    decision = 'submit';
    reasonCode = 'management-response';
    whyNow = 'A management signal changed shared responsibility or project state and needs an auditable response node.';
    expectedValue = 'shared-management-state';
    family = 'confirmation';
    subtype = 'management-response';
  } else if (task) {
    decision = 'defer';
    reasonCode = 'checkpoint-not-ready';
    whyNow = 'Work is active but has not reached a distinct reviewable checkpoint, so the pulse remains trace evidence instead of a formal submission.';
    expectedValue = 'avoid-premature-or-repetitive-submission';
    family = 'execution';
    subtype = 'work-in-progress-deferred';
  }

  return {
    id: `agent_contribution_intent_${agent.id || 'agent'}_${Date.parse(now) || 0}`,
    schemaVersion: 'agent-workflow-node-intent/v1',
    policySchemaVersion: 'agent-contribution-intent/v1',
    projectId: project.id || null,
    agentId: agent.id || null,
    taskId: task?.id || null,
    decidedAt: now,
    decision,
    reasonCode,
    whyNow,
    expectedValue,
    eligibleOpportunity: Boolean(task || managementSignals.length || ['respond-to-review-obligation', 'review-pending-submission'].includes(selectedAction)),
    proposedNode: { family, subtype },
    committerIds,
    coAuthorIds,
    participantIds,
    relationshipRoles,
    requiredFields: ['title', 'description', 'family', 'subtype', 'intent', 'commitMessage', 'relationshipRoles', 'attachmentsOrProof'],
    evidencePlan: ['artifact-or-work-record', 'timeline-log', 'event-ledger-proof'],
    duplicationRisk: {
      level: duplicateSubmissions.length ? 'high' : 'low',
      matchingSubmissionIds: duplicateSubmissions.map((submission) => submission.id),
    },
  };
}

export function summarizeAgentContributionOutcomes(records = []) {
  const normalized = records.map((record) => ({
    intent: record?.intent || record,
    submitted: Boolean(record?.submitted),
  })).filter((record) => record.intent?.decision);
  const opportunityCount = normalized.filter((record) => record.intent.eligibleOpportunity).length;
  const submitDecisionCount = normalized.filter((record) => record.intent.decision === 'submit').length;
  const publishedCount = normalized.filter((record) => record.submitted).length;
  const noisyPublishedCount = normalized.filter((record) => (
    record.submitted
    && (record.intent.decision !== 'submit' || record.intent.duplicationRisk?.level === 'high')
  )).length;

  return {
    schemaVersion: 'agent-contribution-outcome-summary/v1',
    opportunityCount,
    submitDecisionCount,
    deferCount: normalized.filter((record) => record.intent.decision === 'defer').length,
    declineCount: normalized.filter((record) => record.intent.decision === 'decline').length,
    publishedCount,
    conversionRate: submitDecisionCount ? Number((publishedCount / submitDecisionCount).toFixed(3)) : 0,
    noiseRate: publishedCount ? Number((noisyPublishedCount / publishedCount).toFixed(3)) : 0,
  };
}
