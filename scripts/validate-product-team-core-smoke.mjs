import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import {
  buildPersonaSkillBlend,
  getPersonSkill,
  PROFESSIONAL_SKILLS,
  PERSON_SKILL_COUNT,
} from '../src/skills/personSkillSystem.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function bodyRows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.submissions)) return value.submissions;
  return [];
}

function asText(value) {
  return JSON.stringify(value);
}

const projectId = 'product_team_core_smoke_project';
const missionBrief = 'Validate a generic AI product team using a research-style brief only as a sample customer goal.';
const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Inventor', skill: 'brainstorm synthesis' },
];

assert(PERSON_SKILL_COUNT >= 40, 'Product-team smoke must run against the canonical Hall of Fame persona skill registry.');
for (const member of team) {
  const skill = getPersonSkill(member.id);
  assert(skill?.slug === member.id, `${member.id} must resolve to a canonical persona skill, not an app-only Agent definition.`);
  const blend = buildPersonaSkillBlend(member.id, missionBrief);
  assert(blend?.selectedSkill?.id && blend?.edge, `${member.id} must produce a persona + professional skill blend for the mission brief.`);
}

const service = createAgentProjectService({ messageLimit: 360 });
const api = createAgentProjectApi({ service });

const request = (input) => api.handle(input);
const requestAsync = (input) => api.handleAsync(input);

function submitArtifact({
  agentId,
  artifactType,
  title,
  summary,
  body,
  taskId = null,
  reviewerAgentId = 'curie',
  sourceRefs = [],
  dependsOn = [],
  now,
}) {
  const result = request({
    method: 'POST',
    path: `/projects/${projectId}/agents/${agentId}/submissions`,
    body: {
      includeReadModels: false,
      artifactType,
      title,
      summary,
      body,
      taskId,
      reviewerAgentId,
      sourceRefs,
      dependsOn,
      now,
    },
  });
  assert(result.status === 200, `${artifactType} submission returned ${result.status}.`);
  const submission = result.body.submission;
  assert(
    submission?.artifactType === artifactType
      && submission.messageId
      && submission.timelineLogId
      && submission.eventId
      && submission.artifactStorageProofChecksum,
    `${artifactType} must submit as a proofed Agent artifact node.`,
  );
  return submission;
}

let response = request({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'product_team_core_smoke_mission',
    meetingId: 'product_team_core_smoke_meeting',
    projectId,
    name: 'Product Team Core Smoke Project',
    missionBrief,
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_brainstorm', text: 'Create generic product-team brainstorm alternatives.', assignee: 'Leonardo da Vinci', status: 'pending' },
      { id: 'task_evidence', text: 'Collect and judge evidence for the strongest direction.', assignee: 'Marie Curie', status: 'pending' },
      { id: 'task_brief', text: 'Draft a manager-readable product brief.', assignee: 'Alan Turing', status: 'pending' },
      { id: 'task_review', text: 'Review, revise, and accept the final deliverable.', assignee: 'Marie Curie', status: 'pending' },
    ],
    maxLoops: 1,
    maxStepsPerLoop: 1,
    runInitialTick: false,
    now: '2026-06-01T09:00:00.000Z',
  },
});

assert(response.status === 200, `Mission Runner returned ${response.status}.`);
assert(response.body.productTeamMissionRun?.schemaVersion === 'product-team-mission-run/v1', 'Mission Runner must create a product-team mission receipt.');
assert(response.body.productTeamMissionRun.researchOnly === false && response.body.productTeamMissionRun.missionType === 'generic-product-team', 'Mission Runner must keep Research as a validation sample, not a research-only workflow.');
assert(response.body.meeting?.transcript?.some((turn) => turn.stage === 'role-clarification'), 'Kickoff meeting must include role self-marketing / clarification turns.');
assert(response.body.meeting?.transcript?.some((turn) => turn.stage === 'leader-campaign'), 'Kickoff meeting must include Leader campaign turns.');
const selfNominationTurns = response.body.meeting?.transcript?.filter((turn) => turn.stage === 'self-nomination') || [];
const professionalLabels = Object.values(PROFESSIONAL_SKILLS).flatMap((skill) => [skill.label, skill.zh]).filter(Boolean);
let personaBlendSelfNominationCount = 0;
for (const turn of selfNominationTurns) {
  const member = team.find((item) => item.id === turn.speakerId);
  if (!member) continue;
  const professionalLabel = professionalLabels.find((label) => String(turn.text || '').includes(label));
  if (!professionalLabel) continue;
  assert(
    String(turn.text || '').includes(professionalLabel),
    `${member.name} must self-market with the canonical persona professional skill blend.`,
  );
  personaBlendSelfNominationCount += 1;
}
assert(personaBlendSelfNominationCount >= 2, 'Kickoff self-marketing must verify multiple persona professional skill blends.');

response = request({
  method: 'POST',
  path: `/projects/${projectId}/meeting`,
  body: {
    includeReadModels: false,
    text: 'War Room: confirm brainstorm, evidence, draft, review, revision, and final deliverable responsibilities.',
    now: '2026-06-01T09:05:00.000Z',
  },
});
assert(response.status === 200 && response.body.meetingAgentTurns?.length >= 1, 'Backend meeting must create Agent-authored meeting turns.');
assert(response.body.meetingAgentTurns.every((turn) => turn.timelineLogIds?.length >= 1), 'Meeting turns must carry timeline proof ids.');

response = request({
  method: 'POST',
  path: `/projects/${projectId}/agents/curie/evidence-searches`,
  body: {
    includeReadModels: false,
    query: 'generic product-team validation evidence',
    purpose: 'Curie collects evidence for the generic product-team delivery chain.',
    taskId: 'task_evidence',
    sources: [
      {
        id: 'core-smoke-source-1',
        title: 'Generic product-team validation source',
        url: 'https://example.test/generic-product-team-validation',
        summary: 'Controlled local source proving evidence can be attached to the product-team chain.',
        confidence: 'high',
        kind: 'evidence-report',
      },
      {
        id: 'core-smoke-source-2',
        title: 'Generic product-team corroboration source',
        url: 'https://example.test/generic-product-team-corroboration',
        summary: 'Second controlled local source corroborating that the workflow remains generic and product-team oriented.',
        confidence: 'high',
        kind: 'evidence-report',
      },
    ],
    findings: ['Evidence supports validating the system as a generic product-team workflow.'],
    confidence: 'high',
    now: '2026-06-01T09:10:00.000Z',
  },
});
assert(response.status === 200, `Evidence search returned ${response.status}.`);
const evidenceSearch = response.body.evidenceSearch;
assert(evidenceSearch?.id && evidenceSearch.sources?.length === 2 && evidenceSearch.timelineLogId && evidenceSearch.eventId, 'Evidence search must persist sources, timeline, and event proof.');

response = request({
  method: 'POST',
  path: `/projects/${projectId}/evidence-source-review-workflow`,
  body: {
    includeReadModels: false,
    evidenceSearchId: evidenceSearch.id,
    sourceId: 'core-smoke-source-1',
    reviewerAgentId: 'curie',
    decision: 'approved',
    comments: 'Approved for local pilot use: the source is controlled, checksummed, and tied to the generic product-team validation chain.',
    now: '2026-06-01T09:11:00.000Z',
  },
});
assert(response.status === 200, `First evidence source review returned ${response.status}.`);
const firstSourceReview = response.body.evidenceSourceReview;
assert(firstSourceReview?.decision === 'approved' && firstSourceReview.messageId && firstSourceReview.timelineLogId && firstSourceReview.eventId, 'Reviewer must approve the first evidence source with transcript, timeline, and event proof.');

response = request({
  method: 'POST',
  path: `/projects/${projectId}/evidence-source-review-workflow`,
  body: {
    includeReadModels: false,
    evidenceSearchId: evidenceSearch.id,
    sourceId: 'core-smoke-source-2',
    reviewerAgentId: 'curie',
    decision: 'approved',
    comments: 'Approved for local pilot use: the corroborating source confirms the workflow is a generic product-team validation sample.',
    now: '2026-06-01T09:11:30.000Z',
  },
});
assert(response.status === 200, `Second evidence source review returned ${response.status}.`);
const secondSourceReview = response.body.evidenceSourceReview;
assert(secondSourceReview?.decision === 'approved' && secondSourceReview.messageId && secondSourceReview.timelineLogId && secondSourceReview.eventId, 'Reviewer must approve the second evidence source with transcript, timeline, and event proof.');

const discoverySubmission = submitArtifact({
  agentId: 'jobs',
  artifactType: 'discovery-report',
  title: 'Generic product-team discovery report',
  summary: 'Discovery report frames the customer goal, user-facing value, proof surfaces, and production blockers.',
  body: '# Generic product-team discovery report\n\nThis discovery report captures the user goal, the expected product-team outcome, the Manager proof surfaces, the Agent responsibilities, and the production blockers that still prevent public launch.',
  taskId: 'task_brainstorm',
  now: '2026-06-01T09:12:00.000Z',
});

const evidencePacketSubmission = submitArtifact({
  agentId: 'curie',
  artifactType: 'evidence-packet',
  title: 'Generic product-team evidence packet',
  summary: 'Evidence packet links the source search, judgement, confidence, and downstream product-team decisions.',
  body: '# Generic product-team evidence packet\n\nThe evidence packet links the controlled source, confidence judgement, source snapshot, and downstream delivery decisions so the Manager can inspect why the team chose the strongest direction.',
  taskId: 'task_evidence',
  sourceRefs: [
    { type: 'evidence-search', id: evidenceSearch.id, route: `/projects/${projectId}/evidence-searches/${evidenceSearch.id}` },
    { type: 'evidence-source-review', id: firstSourceReview.id, route: `/projects/${projectId}/evidence-source-review-workflow#${firstSourceReview.id}` },
    { type: 'evidence-source-review', id: secondSourceReview.id, route: `/projects/${projectId}/evidence-source-review-workflow#${secondSourceReview.id}` },
  ],
  dependsOn: [evidenceSearch.id, firstSourceReview.id, secondSourceReview.id],
  now: '2026-06-01T09:13:00.000Z',
});

response = request({
  method: 'POST',
  path: `/projects/${projectId}/agents/da_vinci/submissions`,
  body: {
    includeReadModels: false,
    artifactType: 'brainstorm-board',
    title: 'Generic product-team brainstorm board',
    summary: 'Multiple product-team directions from persona viewpoints.',
    body: '# Generic product-team brainstorm board\n\n1. Build the proof as a delivery trace.\n2. Use evidence as a quality gate.\n3. Keep final delivery generic rather than research-only.',
    taskId: 'task_brainstorm',
    reviewerAgentId: 'curie',
    now: '2026-06-01T09:15:00.000Z',
  },
});
assert(response.status === 200, `Brainstorm submission returned ${response.status}.`);
const brainstormSubmission = response.body.submission;
assert(
  brainstormSubmission?.artifactType === 'brainstorm-board'
    && brainstormSubmission.messageId
    && brainstormSubmission.timelineLogId
    && brainstormSubmission.eventId
    && brainstormSubmission.artifactStorageProofChecksum,
  'Brainstorm board must be a proofed Agent artifact node with chat, timeline, event, and storage proof.',
);

response = await requestAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/artifact-drafts`,
  body: {
    includeReadModels: false,
    artifactType: 'product-brief',
    instruction: 'Draft a manager-readable generic product-team brief from the brainstorm and evidence nodes.',
    taskId: 'task_brief',
    evidenceSearchIds: [evidenceSearch.id],
    priorSubmissionIds: [brainstormSubmission.id],
    useModel: false,
    submit: true,
    reviewerAgentId: 'curie',
    now: '2026-06-01T09:20:00.000Z',
  },
});
assert(response.status === 200, `Artifact draft returned ${response.status}.`);
assert(response.body.artifactDraft?.schemaVersion === 'agent-artifact-draft/v1' && response.body.artifactDraft.source === 'local-artifact-draft-generator', 'Product brief draft must use the backend artifact-draft contract.');
const productBriefSubmission = response.body.submission;
assert(productBriefSubmission?.artifactType === 'product-brief' && productBriefSubmission.isGeneratedDraft && productBriefSubmission.artifactStorageProofChecksum, 'Generated product brief must submit as a proofed Agent artifact node.');

const decisionProposalSubmission = submitArtifact({
  agentId: 'jobs',
  artifactType: 'decision-proposal',
  title: 'Generic product-team decision proposal',
  summary: 'Decision proposal selects the validated direction and names the evidence and brainstorm alternatives used.',
  body: '# Generic product-team decision proposal\n\nThe decision proposal selects the delivery-trace direction because it connects kickoff, evidence, brainstorm, draft, review, revision, final delivery, Flow Graph, Proof Map, transcript, timeline, and event proof.',
  taskId: 'task_review',
  sourceRefs: [
    { type: 'agent-submission', id: discoverySubmission.id },
    { type: 'agent-submission', id: evidencePacketSubmission.id },
    { type: 'agent-submission', id: brainstormSubmission.id },
    { type: 'agent-submission', id: productBriefSubmission.id },
  ],
  dependsOn: [discoverySubmission.id, evidencePacketSubmission.id, brainstormSubmission.id, productBriefSubmission.id],
  now: '2026-06-01T09:21:00.000Z',
});

const riskReviewSubmission = submitArtifact({
  agentId: 'curie',
  artifactType: 'risk-review',
  title: 'Generic product-team risk review',
  summary: 'Risk review records evidence limits, production blockers, and reviewer concerns before final delivery.',
  body: '# Generic product-team risk review\n\nThe risk review keeps the product generic, checks evidence quality, names production blockers, and requires the revision loop before the final deliverable can be accepted.',
  taskId: 'task_review',
  sourceRefs: [
    { type: 'evidence-search', id: evidenceSearch.id },
    { type: 'agent-submission', id: productBriefSubmission.id },
    { type: 'agent-submission', id: decisionProposalSubmission.id },
  ],
  dependsOn: [evidenceSearch.id, productBriefSubmission.id, decisionProposalSubmission.id],
  now: '2026-06-01T09:22:00.000Z',
});

const implementationPlanSubmission = submitArtifact({
  agentId: 'turing',
  artifactType: 'implementation-plan',
  title: 'Generic product-team implementation plan',
  summary: 'Implementation plan maps the selected direction into backend contracts, proof routes, validation gates, and launch blockers.',
  body: '# Generic product-team implementation plan\n\nThe implementation plan keeps the work backend-first, routes Agent submissions through durable contracts, verifies Flow and Proof visibility, preserves transcript and event evidence, and leaves production launch blocked until managed controls exist.',
  taskId: 'task_brief',
  sourceRefs: [
    { type: 'agent-submission', id: decisionProposalSubmission.id },
    { type: 'agent-submission', id: riskReviewSubmission.id },
  ],
  dependsOn: [decisionProposalSubmission.id, riskReviewSubmission.id],
  now: '2026-06-01T09:23:00.000Z',
});

response = request({
  method: 'POST',
  path: `/projects/${projectId}/submissions/${encodeURIComponent(productBriefSubmission.id)}/reviews`,
  body: {
    includeReadModels: false,
    reviewerAgentId: 'curie',
    verdict: 'changes-requested',
    comments: 'Add explicit linkage to evidence, brainstorm, production blockers, and final delivery.',
    requestedChanges: ['Link evidence and brainstorm proof.', 'Name production blockers.'],
    now: '2026-06-01T09:25:00.000Z',
  },
});
assert(response.status === 200, `Product brief review returned ${response.status}.`);
const productBriefReview = response.body.review;
assert(productBriefReview?.verdict === 'changes-requested' && productBriefReview.messageId && productBriefReview.timelineLogId && productBriefReview.eventId, 'Reviewer must request changes with transcript, timeline, and event proof.');

response = request({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/submissions`,
  body: {
    includeReadModels: false,
    artifactType: 'revision-note',
    title: 'Generic product-team revision note',
    summary: 'Revision links evidence, brainstorm, blockers, and final delivery.',
    body: '# Generic product-team revision note\n\nThis revision links the evidence search, brainstorm board, product brief, and production blockers.',
    reviewerAgentId: 'curie',
    revisesSubmissionId: productBriefSubmission.id,
    respondsToReviewId: productBriefReview.id,
    now: '2026-06-01T09:30:00.000Z',
  },
});
assert(response.status === 200, `Revision submission returned ${response.status}.`);
const revisionSubmission = response.body.submission;
assert(
  revisionSubmission?.artifactType === 'revision-note'
    && revisionSubmission.respondsToReviewId === productBriefReview.id
    && revisionSubmission.messageId
    && revisionSubmission.timelineLogId
    && revisionSubmission.eventId
    && revisionSubmission.artifactStorageProofChecksum,
  'Revision note must link to the requested-changes review and carry chat, timeline, event, and storage proof.',
);

response = request({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/submissions`,
  body: {
    includeReadModels: false,
    artifactType: 'final-deliverable',
    title: 'Final generic product-team delivery package',
    summary: 'Final package closes kickoff, meeting, brainstorm, evidence, draft, review, revision, and proof routes.',
    body: '# Final generic product-team delivery package\n\nThe generic product-team chain is complete and traceable through Flow Graph, Proof Map, transcript, timeline, and event ledger.',
    status: 'final',
    reviewerAgentId: 'curie',
    revisesSubmissionId: revisionSubmission.id,
    respondsToReviewId: productBriefReview.id,
    supersedesSubmissionIds: [productBriefSubmission.id, revisionSubmission.id],
    now: '2026-06-01T09:35:00.000Z',
  },
});
assert(response.status === 200, `Final deliverable returned ${response.status}.`);
const finalSubmission = response.body.submission;
assert(
  finalSubmission?.artifactType === 'final-deliverable'
    && finalSubmission.status === 'final'
    && finalSubmission.messageId
    && finalSubmission.timelineLogId
    && finalSubmission.eventId
    && finalSubmission.artifactStorageProofChecksum,
  'Final deliverable must be a final Agent artifact node with chat, timeline, event, and storage proof.',
);

response = request({
  method: 'POST',
  path: `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmission.id)}/reviews`,
  body: {
    includeReadModels: false,
    reviewerAgentId: 'curie',
    verdict: 'accepted',
    comments: 'Accepted: the generic product-team chain is traceable end to end.',
    now: '2026-06-01T09:40:00.000Z',
  },
});
assert(response.status === 200 && response.body.review?.verdict === 'accepted', 'Reviewer must accept the final deliverable.');
const finalReview = response.body.review;

const submissionsResponse = request({ method: 'GET', path: `/projects/${projectId}/submissions` });
const submissionRows = bodyRows(submissionsResponse.body.submissions);
const requiredGenericArtifactTypes = [
  'discovery-report',
  'brainstorm-board',
  'evidence-packet',
  'product-brief',
  'decision-proposal',
  'risk-review',
  'revision-note',
  'implementation-plan',
  'final-deliverable',
];
assert(requiredGenericArtifactTypes.every((type) => submissionRows.some((row) => row.artifactType === type)), 'Submissions route must expose every required generic product-team artifact type.');
for (const artifactType of requiredGenericArtifactTypes) {
  const submission = submissionRows.find((row) => row.artifactType === artifactType);
  assert(
    submission?.messageId
      && submission.timelineLogId
      && submission.eventId
      && submission.artifactStorageProofChecksum,
    `Submission route must expose ${artifactType} with chat, timeline, event, and storage proof.`,
  );
}

const brainstormLayer = request({ method: 'GET', path: `/projects/${projectId}/brainstorm-layer` });
assert(brainstormLayer.status === 200 && asText(brainstormLayer.body).includes(brainstormSubmission.id), 'Brainstorm Layer must trace the brainstorm-board submission.');

const artifactQuality = request({ method: 'GET', path: `/projects/${projectId}/artifact-quality-audit` });
assert(artifactQuality.status === 200 && artifactQuality.body.artifactQualityAudit?.gates?.some((gate) => gate.id === 'draft-review-revision-final-loop' && gate.passed), 'Artifact Quality Audit must prove the draft-review-revision-final loop.');
assert(artifactQuality.body.artifactQualityAudit?.gates?.some((gate) => gate.id === 'generic-artifact-type-coverage' && gate.passed), 'Artifact Quality Audit must prove required generic artifact type coverage.');
assert(artifactQuality.body.artifactQualityAudit?.summary?.missingArtifactTypeCount === 0, 'Artifact Quality Audit must report no missing generic artifact types.');
assert(artifactQuality.body.artifactQualityAudit?.readyForLocalPilot === true, `Artifact Quality Audit must be local-ready. Failed gates: ${(artifactQuality.body.artifactQualityAudit?.failedLocalDecisionGates || []).map((gate) => gate.id).join(', ') || 'none'}.`);

const reviewWorkflow = request({ method: 'GET', path: `/projects/${projectId}/submission-review-workflow` });
assert(reviewWorkflow.status === 200 && asText(reviewWorkflow.body).includes(productBriefReview.id) && asText(reviewWorkflow.body).includes(finalReview.id), 'Submission Review Workflow must include requested-changes and final acceptance reviews.');

const deliveryTrace = request({ method: 'GET', path: `/projects/${projectId}/product-team-delivery-trace` });
const deliveryTraceText = asText(deliveryTrace.body);
assert(deliveryTrace.status === 200 && ['brainstorm', 'evidence', 'draft', 'review', 'revision', 'final'].every((word) => deliveryTraceText.toLowerCase().includes(word)), 'Product Team Delivery Trace must include brainstorm, evidence, draft, review, revision, and final stages.');

const stateMachine = request({ method: 'GET', path: `/projects/${projectId}/planner-executor-reviewer-state-machine` });
const stateMachineModel = stateMachine.body.plannerExecutorReviewerStateMachine;
const stateMachineText = asText(stateMachine.body);
assert(stateMachine.status === 200 && stateMachineModel?.schemaVersion === 'planner-executor-reviewer-state-machine/v1', 'Planner / Executor / Reviewer state machine must expose its backend contract.');
assert(stateMachineModel.readyForLocalProductTeamStateMachine === true, 'Planner / Executor / Reviewer state machine must be local-ready for the complete product-team run.');
assert(['planner', 'executor', 'reviewer'].every((id) => stateMachineModel.roleRows?.some((row) => row.id === id && row.ready)), 'Planner / Executor / Reviewer state machine must prove all role lanes ready.');
assert(['plan-to-execute', 'execute-to-review', 'review-to-revision', 'revision-to-final'].every((id) => stateMachineModel.transitionRows?.some((row) => row.id === id && row.ready)), 'Planner / Executor / Reviewer state machine must prove every handoff transition ready.');
assert(
  stateMachineText.includes(productBriefReview.id)
    && stateMachineText.includes(revisionSubmission.id)
    && stateMachineText.includes(finalReview.id),
  'Planner / Executor / Reviewer state machine must trace review, revision, and final acceptance proof.',
);

const readyPackage = request({ method: 'GET', path: `/projects/${projectId}/manager-ready-package` });
assert(readyPackage.status === 200 && readyPackage.body.plannerExecutorReviewerStateMachine?.readyForLocalProductTeamStateMachine === true, 'Manager Ready Package must embed the Planner / Executor / Reviewer state machine.');

const flowGraph = request({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
const flowText = asText(flowGraph.body);
const requiredTraceIds = [
  discoverySubmission.id,
  evidencePacketSubmission.id,
  brainstormSubmission.id,
  evidenceSearch.id,
  firstSourceReview.id,
  secondSourceReview.id,
  productBriefSubmission.id,
  decisionProposalSubmission.id,
  riskReviewSubmission.id,
  implementationPlanSubmission.id,
  productBriefReview.id,
  revisionSubmission.id,
  finalSubmission.id,
  finalReview.id,
];
assert(flowGraph.status === 200 && requiredTraceIds.every((id) => flowText.includes(id)), 'Manager Flow Graph must trace all required generic submission/evidence/review nodes.');
assert(flowText.includes('planner-executor-reviewer-state-machine'), 'Manager Flow Graph must expose the Planner / Executor / Reviewer state machine node.');

const proofMap = request({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
const proofText = asText(proofMap.body);
assert(proofMap.status === 200 && requiredTraceIds.filter((id) => id !== productBriefReview.id && id !== finalReview.id).every((id) => proofText.includes(id)), 'Readiness Proof Map must expose required generic submission and evidence proof routes.');
assert(proofMap.body.projectMemoryReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/memory-readiness`, 'Readiness Proof Map must expose the project memory readiness proof route.');
assert(proofMap.body.plannerExecutorReviewerStateMachineRoutes?.[0]?.apiPath === `/projects/${projectId}/planner-executor-reviewer-state-machine`, 'Readiness Proof Map must expose the Planner / Executor / Reviewer state machine proof route.');
assert(proofMap.body.plannerExecutorReviewerStateMachineSummary?.readyForLocalProductTeamStateMachine === true, 'Readiness Proof Map must mark the Planner / Executor / Reviewer state machine local-ready.');

const transcript = request({ method: 'GET', path: `/projects/${projectId}/transcripts/main` });
const transcriptText = asText(transcript.body);
assert(transcript.status === 200 && requiredTraceIds.filter((id) => id !== evidenceSearch.id).every((id) => transcriptText.includes(id)), 'Group Chat transcript must retain required submission, review, revision, final, and acceptance proof.');

const timeline = request({ method: 'GET', path: `/projects/${projectId}/timeline` });
const events = request({ method: 'GET', path: `/projects/${projectId}/events` });
const timelineEventsText = `${asText(timeline.body)}\n${asText(events.body)}`;
assert(timeline.status === 200 && events.status === 200 && requiredTraceIds.every((id) => timelineEventsText.includes(id)), 'Timeline/Event Ledger must trace required generic submission, evidence, review, revision, final, and acceptance proof.');

const agentDashboard = request({ method: 'GET', path: `/projects/${projectId}/agents/turing/dashboard` });
const agentDashboardText = asText(agentDashboard.body);
assert(agentDashboard.status === 200 && [productBriefSubmission.id, implementationPlanSubmission.id, revisionSubmission.id, finalSubmission.id].every((id) => agentDashboardText.includes(id)), 'Agent Dashboard must expose the submitting Agent core outputs.');

const evidenceIndex = request({ method: 'GET', path: `/projects/${projectId}/evidence-index-readiness` });
assert(evidenceIndex.status === 200 && asText(evidenceIndex.body).includes(evidenceSearch.id) && asText(evidenceIndex.body).includes(finalSubmission.id), 'Evidence Index readiness must trace evidence and final-deliverable ids.');

const projectEvidenceArchive = request({ method: 'GET', path: `/projects/${projectId}/project-evidence-archive` });
const archive = projectEvidenceArchive.body.projectEvidenceArchive;
const archiveArtifactProofManifest = archive?.manifest?.find((entry) => entry.id === 'artifact-storage-proofs');
const archiveFinalDeliverablesManifest = archive?.manifest?.find((entry) => entry.id === 'final-deliverables');
const archiveArtifactQualityManifest = archive?.manifest?.find((entry) => entry.id === 'artifact-quality-audit');
const archiveTranscriptManifest = archive?.manifest?.find((entry) => entry.id === 'group-chat-transcripts');
assert(projectEvidenceArchive.status === 200 && archive?.schemaVersion === 'project-evidence-archive/v1', 'Project Evidence Archive must expose the backend archive contract.');
assert(archive.readyForProduction === false, 'Project Evidence Archive must not overclaim production readiness.');
assert(archive.summary?.rawLeakCount === 0, 'Project Evidence Archive must not leak raw secrets.');
assert(archive.summary?.finalDeliverableCount >= 1, 'Project Evidence Archive summary must include the final deliverable.');
assert(archive.summary?.artifactQualityReady === true, 'Project Evidence Archive summary must include local-ready artifact quality.');
assert(
  archive.summary?.transcriptProofCoverageReady === true
    && archive.summary?.transcriptMissingProofIdCount === 0,
  'Project Evidence Archive summary must prove transcript proof coverage for critical work nodes.',
);
assert(
  archive.summary?.artifactStorageProofCoverageReady === true
    && archive.summary?.artifactStorageProofCount >= submissionRows.length
    && archive.summary?.workspaceFileProofCount >= submissionRows.length,
  'Project Evidence Archive summary must prove artifact storage and workspace-file proof coverage for every submission.',
);
assert(
  archiveArtifactProofManifest?.ready
    && archiveArtifactProofManifest.count >= submissionRows.length
    && archiveArtifactProofManifest.storageProofCount >= submissionRows.length
    && archiveArtifactProofManifest.workspaceFileProofCount >= submissionRows.length,
  'Project Evidence Archive manifest must include ready artifact-storage-proof coverage for every submission.',
);
assert(
  archive.backendRoutes?.projectEvidenceArchive === `/projects/${projectId}/project-evidence-archive`,
  'Project Evidence Archive must expose its own backend proof route.',
);
assert(archiveFinalDeliverablesManifest?.ready, 'Project Evidence Archive manifest must include ready final-deliverable evidence.');
assert(archiveArtifactQualityManifest?.ready, 'Project Evidence Archive manifest must include ready artifact quality audit evidence.');
assert(
  archiveTranscriptManifest?.ready
    && archiveTranscriptManifest.missingTranscriptProofIdCount === 0,
  'Project Evidence Archive manifest must include complete backend transcript proof coverage.',
);

const memoryReadiness = request({ method: 'GET', path: `/projects/${projectId}/memory-readiness` });
assert(memoryReadiness.status === 200 && memoryReadiness.body.projectMemoryReadiness?.schemaVersion === 'project-memory-readiness/v1', 'Project memory readiness must be available for a real product-team run.');
assert(memoryReadiness.body.projectMemoryReadiness?.readyForProduction === false, 'Project memory readiness must not overclaim production managed-memory readiness.');

console.log('Product team core smoke validation passed.');
