import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function summarizeTargetRun(body = {}) {
  return JSON.stringify({
    keys: Object.keys(body),
    review: body.review ? {
      id: body.review.id,
      verdict: body.review.verdict,
      eventId: body.review.eventId,
      submissionId: body.review.submissionId,
      reviewerAgentId: body.review.reviewerAgentId,
    } : null,
    workSubmission: body.workSubmission ? {
      id: body.workSubmission.id,
      artifactType: body.workSubmission.artifactType,
      reviewStatus: body.workSubmission.reviewStatus,
      requestedReviewAgentId: body.workSubmission.requestedReviewAgentId,
    } : null,
    reviewResponseSubmission: body.reviewResponseSubmission ? {
      id: body.reviewResponseSubmission.id,
      artifactType: body.reviewResponseSubmission.artifactType,
      respondsToReviewId: body.reviewResponseSubmission.respondsToReviewId,
    } : null,
    autonomousRunControlRun: body.autonomousRunControlRun ? {
      actionId: body.autonomousRunControlRun.actionId,
      delegatedRunKind: body.autonomousRunControlRun.delegatedRunKind,
      agentAutonomousActionRunId: body.autonomousRunControlRun.agentAutonomousActionRunId,
      workSubmissionId: body.autonomousRunControlRun.workSubmissionId,
      reviewId: body.autonomousRunControlRun.reviewId,
    } : null,
    agentAutonomousActionRun: body.agentAutonomousActionRun ? {
      agentId: body.agentAutonomousActionRun.agentId,
      selectedAction: body.agentAutonomousActionRun.selectedAction,
      reviewId: body.agentAutonomousActionRun.reviewId,
      workSubmissionId: body.agentAutonomousActionRun.workSubmissionId,
      requestBody: {
        reviewPendingSubmissions: body.agentAutonomousActionRun.requestBody?.reviewPendingSubmissions,
        reviewSubmissionId: body.agentAutonomousActionRun.requestBody?.reviewSubmissionId,
        agentReviewVerdict: body.agentAutonomousActionRun.requestBody?.agentReviewVerdict,
        submitAgentWorkArtifacts: body.agentAutonomousActionRun.requestBody?.submitAgentWorkArtifacts,
        agentWorkArtifactType: body.agentAutonomousActionRun.requestBody?.agentWorkArtifactType,
      },
    } : null,
  });
}

const projectId = 'mvp_readiness_operator_actions_project';
const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Inventor', skill: 'brainstorm synthesis' },
];

async function main() {
const service = createAgentProjectService({ messageLimit: 360 });
const api = createAgentProjectApi({ service });
const httpServer = createAgentProjectHttpServer({ api });
const runtime = await httpServer.listen({ port: 0, host: '127.0.0.1' });
const request = async ({ method = 'GET', path, body } = {}) => {
  const httpResponse = await fetch(`${runtime.url}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await httpResponse.json();
  return { status: httpResponse.status, body: responseBody };
};

try {
let response = await request({
  method: 'POST',
  path: '/kickoff-meetings',
  body: {
    meetingId: 'mvp_readiness_operator_actions_meeting',
    projectId,
    name: 'MVP Readiness Operator Actions Project',
    brief: 'Validate that a Manager C-side MVP readiness action can hand off to the A-side team and produce generic product-team artifacts.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    now: '2026-06-01T10:00:00.000Z',
    tasks: [
      { id: 'task_brainstorm', text: 'Create a generic product-team brainstorm board.', assignee: 'Leonardo da Vinci', status: 'pending' },
      { id: 'task_evidence', text: 'Collect evidence for the strongest direction.', assignee: 'Marie Curie', status: 'pending' },
      { id: 'task_brief', text: 'Draft a manager-readable product brief.', assignee: 'Alan Turing', status: 'pending' },
      { id: 'task_review', text: 'Review, revise, and accept the final deliverable.', assignee: 'Marie Curie', status: 'pending' },
    ],
  },
});
assert(response.status === 200, `Kickoff meeting creation returned ${response.status}.`);

response = await request({
  method: 'POST',
  path: '/kickoff-meetings/mvp_readiness_operator_actions_meeting/approve',
  body: {
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    now: '2026-06-01T10:01:00.000Z',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.project?.id === projectId, 'Kickoff approval must create a backend project for MVP readiness target execution.');

async function runNextMvpReadinessTarget({
  expectedStageId,
  expectedStepId,
  recordNow,
  runNow,
  checkResult,
}) {
  response = await request({ method: 'GET', path: `/projects/${projectId}/mvp-readiness` });
  const action = response.body.mvpReadiness?.operatorActions?.find((row) => row.id === 'close-mvp-core-gap');
  assert(response.status === 200 && action?.targetControl?.schemaVersion === 'autopilot-delivery-target-control/v1', 'MVP readiness must expose a target-control operator action while the core loop is incomplete.');
  assert(action.targetControl.targetStageId === expectedStageId, `MVP readiness target must select ${expectedStageId}.`);
  assert(!expectedStepId || action.targetControl.targetStepId === expectedStepId, `MVP readiness target must select step ${expectedStepId}.`);

  response = await request({
    method: 'POST',
    path: `/projects/${projectId}/mvp-readiness/operator-actions/close-mvp-core-gap/run`,
    body: {
      includeReadModels: false,
      actor: 'Product Director',
      now: recordNow,
    },
  });
  assert(response.status === 200, `MVP readiness operator action returned ${response.status}.`);
  assert(response.body.mvpReadinessOperatorActionRun?.schemaVersion === 'mvp-readiness-operator-action-run/v1', 'MVP readiness operator action must record a backend receipt.');
  assert(response.body.mvpReadinessOperatorActionRun.targetStageId === expectedStageId, `MVP readiness receipt must preserve target stage ${expectedStageId}.`);
  assert(!expectedStepId || response.body.mvpReadinessOperatorActionRun.targetStepId === expectedStepId, `MVP readiness receipt must preserve target step ${expectedStepId}.`);
  assert(response.body.mvpReadinessOperatorActionRun.targetControl?.checksum, 'MVP readiness receipt must preserve a target-control checksum.');
  assert(response.body.readModels?.operatorActionAutonomousRunRoute?.endsWith('/autonomous-run-control/run-mvp-readiness-target/run'), 'MVP readiness receipt must return the Autonomous Run Control handoff route.');

  response = await request({ method: 'GET', path: `/projects/${projectId}/collaboration-intent-queue` });
  const targetIntent = response.body.collaborationIntentQueue?.rows?.find((row) => (
    row.source === 'mvp-readiness-operator-action-run'
    && row.canRun
    && row.runIntentApiPath
    && row.runApiPath?.endsWith('/autonomous-run-control/run-mvp-readiness-target/run')
    && (!expectedStageId || row.relatedIds?.includes(expectedStageId) || row.targetStageId === expectedStageId)
  ));
  assert(response.status === 200 && targetIntent, `Collaboration Intent Queue must expose the MVP readiness ${expectedStageId} target as runnable.`);

  response = await request({
    method: 'POST',
    path: targetIntent.runIntentApiPath,
    body: {
      includeReadModels: false,
      now: runNow,
    },
  });
  assert(response.status === 200, `Collaboration Intent Queue target run returned ${response.status}.`);
  assert(response.body.collaborationIntentRun?.schemaVersion === 'collaboration-intent-run/v1', 'Collaboration Intent Queue must record a run receipt.');
  assert(response.body.collaborationIntentRun.delegatedRunKind === 'autonomous-run-control', 'MVP readiness target must delegate through Autonomous Run Control.');
  assert(response.body.autonomousRunControlRun?.actionId === 'run-mvp-readiness-target', 'Autonomous Run Control must run the MVP readiness target action.');
  assert(response.body.autonomousRunControlRun.autopilotTargetStageId === expectedStageId, `Autonomous Run Control must execute target stage ${expectedStageId}.`);

  checkResult(response);

  response = await request({ method: 'GET', path: `/projects/${projectId}/autonomous-run-control` });
  assert(
    !response.body.autonomousRunControl?.nextActions?.some((row) => row.id === 'run-mvp-readiness-target' && row.targetStepId === expectedStepId),
    `Autonomous Run Control must expire completed target step ${expectedStepId}.`,
  );
}

await runNextMvpReadinessTarget({
  expectedStageId: 'brainstorm-layer',
  expectedStepId: 'brainstorm-layer',
  recordNow: '2026-06-01T10:02:00.000Z',
  runNow: '2026-06-01T10:03:00.000Z',
  checkResult: (targetResponse) => {
    const submission = targetResponse.body.workSubmission;
    assert(submission?.artifactType === 'brainstorm-board', 'Brainstorm target must produce a brainstorm-board Agent submission.');
    assert(submission.messageId && submission.timelineLogId && submission.eventId && submission.artifactStorageProofChecksum, 'Brainstorm submission must carry chat, timeline, event, and workspace proof.');
  },
});

await runNextMvpReadinessTarget({
  expectedStageId: 'evidence-quality',
  expectedStepId: 'evidence-quality',
  recordNow: '2026-06-01T10:04:00.000Z',
  runNow: '2026-06-01T10:05:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.workSubmission?.artifactType === 'evidence-packet', 'Evidence target must produce an evidence-packet Agent submission.');
    assert(targetResponse.body.evidenceSearch?.qualityScore >= 60 && targetResponse.body.evidenceSearch.eventId, 'Evidence target must create a quality-scored evidence search with event proof.');
  },
});

await runNextMvpReadinessTarget({
  expectedStageId: 'draft-artifact',
  expectedStepId: 'draft-product-brief',
  recordNow: '2026-06-01T10:06:00.000Z',
  runNow: '2026-06-01T10:07:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.workSubmission?.artifactType === 'product-brief', 'Draft target must produce a product-brief Agent submission.');
  },
});

await runNextMvpReadinessTarget({
  expectedStageId: 'review-and-revision',
  expectedStepId: 'review-product-brief',
  recordNow: '2026-06-01T10:08:00.000Z',
  runNow: '2026-06-01T10:09:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.review?.verdict === 'changes-requested' && targetResponse.body.review.eventId, `Review target must create a changes-requested review with event proof. ${summarizeTargetRun(targetResponse.body)}`);
  },
});

await runNextMvpReadinessTarget({
  expectedStageId: 'review-and-revision',
  expectedStepId: 'submit-revision-note',
  recordNow: '2026-06-01T10:10:00.000Z',
  runNow: '2026-06-01T10:11:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.reviewResponseSubmission?.artifactType === 'revision-note', 'Revision target must create a revision-note Agent submission.');
    assert(targetResponse.body.reviewResponseSubmission.respondsToReviewId, 'Revision target must link the revision note to the requested-change review.');
  },
});

await runNextMvpReadinessTarget({
  expectedStageId: 'final-deliverable',
  expectedStepId: 'submit-final-deliverable',
  recordNow: '2026-06-01T10:12:00.000Z',
  runNow: '2026-06-01T10:13:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.workSubmission?.artifactType === 'final-deliverable', 'Final target must produce a final-deliverable Agent submission.');
  },
});

await runNextMvpReadinessTarget({
  expectedStageId: 'final-deliverable',
  expectedStepId: 'accept-final-deliverable',
  recordNow: '2026-06-01T10:14:00.000Z',
  runNow: '2026-06-01T10:15:00.000Z',
  checkResult: (targetResponse) => {
    assert(targetResponse.body.review?.verdict === 'accepted' && targetResponse.body.review.eventId, `Final acceptance target must create an accepted final-deliverable review. ${summarizeTargetRun(targetResponse.body)}`);
  },
});

response = await request({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
assert(response.status === 200, `Manager Flow Graph returned ${response.status}.`);
for (const artifactType of ['brainstorm-board', 'evidence-packet', 'product-brief', 'revision-note', 'final-deliverable']) {
  assert(
    response.body.nodes?.some((node) => node.source === 'agentSubmissions' && node.subtype === artifactType && node.proofIds?.length && node.timelineLogIds?.length && node.eventIds?.length),
    `Manager Flow Graph must show proofed ${artifactType} nodes created from MVP readiness targets.`,
  );
}

response = await request({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assert(response.status === 200, `Readiness Proof Map returned ${response.status}.`);
for (const artifactType of ['brainstorm-board', 'evidence-packet', 'product-brief', 'revision-note', 'final-deliverable']) {
  assert(
    response.body.submissionRoutes?.some((route) => route.artifactType === artifactType && route.proofIds?.length && route.timelineLogIds?.length && route.eventIds?.length),
    `Readiness Proof Map must expose proofed ${artifactType} routes created from MVP readiness targets.`,
  );
}
assert(response.body.submissionReviewRoutes?.some((route) => route.verdict === 'accepted' && route.proofIds?.length), 'Readiness Proof Map must expose the accepted final review route.');

response = await request({ method: 'GET', path: `/projects/${projectId}/mvp-readiness` });
assert(response.status === 200 && response.body.mvpReadiness?.readyForLocalPilot === true, 'MVP readiness must become local-pilot ready after the targeted core loop closes.');
assert(response.body.mvpReadiness.readyForProduction === false, 'MVP readiness must not claim public production readiness.');
assert(response.body.mvpReadiness.nextShortestPath?.scope === 'production-hardening', 'After core closure, MVP readiness must route the next shortest path to production hardening.');

console.log('MVP readiness operator action validation passed.');
} finally {
  await httpServer.close();
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
