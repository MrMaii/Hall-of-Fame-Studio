import { readFileSync } from 'node:fs';
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
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Inventor', skill: 'brainstorm synthesis' },
];

assert(PERSON_SKILL_COUNT >= 40, 'Product-team smoke must run against the canonical Hall of Fame persona skill registry.');
assert(
  appSource.includes('agent-workbench-artifact-draft-proof')
    && appSource.includes('Draft node: {latestWorkbenchReceipt.artifactDraftId}')
    && appSource.includes('latestWorkbenchReceipt.readModels?.managerFlowGraphRoute')
    && appSource.includes('latestWorkbenchReceipt.readModels?.readinessProofMapRoute')
    && appSource.includes('latestWorkbenchReceipt.readModels?.timelineRoute')
    && appSource.includes('latestWorkbenchReceipt.readModels?.eventsRoute'),
  'Product-team smoke must pin the visible Agent Workbench artifact-draft proof receipt through Flow Graph, Proof Map, Timeline, and Event routes.',
);
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
const governanceProtocol = request({ method: 'GET', path: `/projects/${projectId}/governance-protocol` });
assert(governanceProtocol.status === 200, `Governance Protocol returned ${governanceProtocol.status}.`);
assert(governanceProtocol.body.governanceProtocol?.schemaVersion === 'governance-protocol/v1', 'Governance Protocol must be exposed as a standalone backend read model.');
assert(governanceProtocol.body.governanceProtocol.lead?.id === 'jobs' && governanceProtocol.body.governanceProtocol.reviewer?.id === 'curie', 'Governance Protocol must read the kickoff-confirmed Leader and Reviewer from backend charter proof.');
assert(governanceProtocol.body.governanceProtocol.proofIds?.length && governanceProtocol.body.governanceProtocol.eventIds?.length, 'Governance Protocol must carry proof and event ids.');
assert(governanceProtocol.body.governanceProtocol.backendRoutes?.readinessProofMap === `/projects/${projectId}/readiness-proof-map`, 'Governance Protocol must link back to the backend Readiness Proof Map.');
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
const deliveryTraceModel = deliveryTrace.body.productTeamDeliveryTrace;
assert(deliveryTrace.status === 200 && deliveryTraceModel?.schemaVersion === 'product-team-delivery-trace/v1', 'Product Team Delivery Trace must expose its backend contract.');
assert(deliveryTraceModel.readyForPrivatePilotDelivery === true && deliveryTraceModel.readyForProduction === false, 'Product Team Delivery Trace must close the local/private-pilot loop without production overclaim.');
const expectedGenericTraceStageIds = [
  'kickoff-meeting',
  'agent-self-marketing',
  'brainstorm-layer',
  'evidence-quality',
  'draft-artifact',
  'review-and-revision',
  'final-deliverable',
  'proof-surfaces',
];
const deliveryTraceStageIds = (deliveryTraceModel.rows || []).map((row) => row.id);
assert(
  expectedGenericTraceStageIds.every((id) => deliveryTraceStageIds.includes(id)),
  `Research validation sample must prove generic product-team delivery stages, not research-only stages. Got: ${deliveryTraceStageIds.join(', ')}.`,
);
assert(
  (deliveryTraceModel.rows || []).every((row) => (
    row.ready === true
    && ((row.proofIds || []).length || (row.timelineLogIds || []).length || (row.eventIds || []).length)
  )),
  'Every ready Product Team Delivery Trace stage must carry proof, timeline, or event evidence.',
);
assert(
  (deliveryTraceModel.rows || []).every((row) => !/\b(paper|thesis|manuscript)\b|论文/i.test(`${row.id || ''} ${row.stage || ''} ${row.label || ''} ${row.detail || ''}`)),
  'Research validation sample trace rows must not introduce paper/thesis/manuscript-specific protocol fields.',
);
assert(deliveryTraceModel.backendRoutes?.productTeamDeliveryTrace === `/projects/${projectId}/product-team-delivery-trace`, 'Product Team Delivery Trace must expose its own backend route.');

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
const flowNodes = flowGraph.body.nodes || [];
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
const flowSubmissionNodes = flowGraph.body.nodes?.filter((node) => node.category === 'submission' && node.source === 'agentSubmissions') || [];
const flowSubmissionNodesMissingRoute = flowSubmissionNodes.filter((node) => !(
  node.submissionId
  && node.submissionRoute === `/projects/${projectId}/submissions/${encodeURIComponent(node.submissionId)}`
  && node.route === node.submissionRoute
  && node.attachments?.some((attachment) => (
    attachment.submissionId === node.submissionId
    && attachment.submissionRoute === node.submissionRoute
  ))
));
assert(
  flowSubmissionNodes.length >= requiredGenericArtifactTypes.length
    && flowSubmissionNodesMissingRoute.length === 0,
  `Manager Flow Graph submission nodes must expose explicit backend submissionId/submissionRoute fields on nodes and artifact attachments. Missing: ${flowSubmissionNodesMissingRoute.map((node) => `${node.id}:${node.subtype}:${node.source}`).join(', ') || 'none'}.`,
);
const flowEvidenceNode = flowNodes.find((node) => node.source === 'evidenceSearches' && node.evidenceSearchId === evidenceSearch.id);
assert(
  flowEvidenceNode?.evidenceSearchRoute === `/projects/${projectId}/evidence-searches/${encodeURIComponent(evidenceSearch.id)}`
    && flowEvidenceNode.route === flowEvidenceNode.evidenceSearchRoute
    && flowEvidenceNode.attachments?.some((attachment) => (
      attachment.evidenceSearchId === evidenceSearch.id
      && attachment.evidenceSearchRoute === flowEvidenceNode.evidenceSearchRoute
    )),
  'Manager Flow Graph evidence-search nodes must expose explicit backend evidenceSearchId/evidenceSearchRoute fields on nodes and attachments.',
);
const flowSourceReviewNodes = flowNodes.filter((node) => node.source === 'evidenceSourceReviews');
assert(
  flowSourceReviewNodes.length >= 2
    && flowSourceReviewNodes.every((node) => (
      node.evidenceSourceReviewId
      && node.evidenceSourceReviewRoute === `/projects/${projectId}/evidence-source-review-workflow#${encodeURIComponent(node.evidenceSourceReviewId)}`
      && node.route === node.evidenceSourceReviewRoute
      && node.evidenceSearchId === evidenceSearch.id
      && node.evidenceSearchRoute === `/projects/${projectId}/evidence-searches/${encodeURIComponent(evidenceSearch.id)}`
      && node.attachments?.some((attachment) => (
        attachment.evidenceSourceReviewId === node.evidenceSourceReviewId
        && attachment.evidenceSourceReviewRoute === node.evidenceSourceReviewRoute
      ))
    )),
  'Manager Flow Graph evidence-source-review nodes must expose explicit backend evidenceSourceReviewRoute and evidenceSearchRoute fields.',
);
const flowSubmissionReviewNodes = flowNodes.filter((node) => node.source === 'submissionReviews');
assert(
  flowSubmissionReviewNodes.length >= 2
    && flowSubmissionReviewNodes.every((node) => (
      node.submissionReviewId
      && node.submissionReviewRoute === `/projects/${projectId}/submission-reviews/${encodeURIComponent(node.submissionReviewId)}`
      && node.route === node.submissionReviewRoute
      && node.submissionId
      && node.submissionRoute === `/projects/${projectId}/submissions/${encodeURIComponent(node.submissionId)}`
      && node.attachments?.some((attachment) => (
        attachment.submissionReviewId === node.submissionReviewId
        && attachment.submissionReviewRoute === node.submissionReviewRoute
      ))
    )),
  'Manager Flow Graph submission-review nodes must expose explicit backend submissionReviewId/submissionReviewRoute fields on nodes and attachments.',
);
assert(flowText.includes('planner-executor-reviewer-state-machine'), 'Manager Flow Graph must expose the Planner / Executor / Reviewer state machine node.');
[
  'governance-protocol',
  'manager-command-center',
  'manager-scenario-trail',
  'manager-scenario-walkthrough',
  'manager-requirement-matrix',
  'sync-protocol-audit',
  'manager-use-case-audit',
  'manager-action-queue',
].forEach((nodeId) => {
  assert(flowText.includes(nodeId), `Manager Flow Graph must expose ${nodeId} as a C-side governance/action route node.`);
});

const proofMap = request({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
const proofText = asText(proofMap.body);
assert(proofMap.status === 200 && requiredTraceIds.filter((id) => id !== productBriefReview.id && id !== finalReview.id).every((id) => proofText.includes(id)), 'Readiness Proof Map must expose required generic submission and evidence proof routes.');
assert(
  requiredGenericArtifactTypes.every((artifactType) => {
    const route = proofMap.body.submissionRoutes?.find((item) => item.artifactType === artifactType);
    return route?.id
      && route.submissionId === route.id
      && route.submissionRoute === `/projects/${projectId}/submissions/${encodeURIComponent(route.submissionId)}`
      && route.apiPath === route.submissionRoute;
  }),
  'Readiness Proof Map submission routes must expose explicit backend submissionId/submissionRoute fields for every generic artifact type.',
);
assert(
  proofMap.body.evidenceSearchRoutes?.some((route) => (
    route.id === evidenceSearch.id
    && route.evidenceSearchId === evidenceSearch.id
    && route.evidenceSearchRoute === `/projects/${projectId}/evidence-searches/${encodeURIComponent(evidenceSearch.id)}`
    && route.apiPath === route.evidenceSearchRoute
  )),
  'Readiness Proof Map evidence-search routes must expose explicit backend evidenceSearchId/evidenceSearchRoute fields.',
);
const proofMapSourceReviewRoutes = proofMap.body.evidenceSourceReviewRoutes?.filter((route) => route.evidenceSearchId === evidenceSearch.id) || [];
assert(
  proofMapSourceReviewRoutes.length >= 2
    && proofMapSourceReviewRoutes.every((route) => (
    route.id
    && route.evidenceSourceReviewId === route.id
    && route.evidenceSourceReviewRoute === `/projects/${projectId}/evidence-source-review-workflow#${encodeURIComponent(route.evidenceSourceReviewId)}`
    && route.apiPath === route.evidenceSourceReviewRoute
    && route.evidenceSearchRoute === `/projects/${projectId}/evidence-searches/${encodeURIComponent(evidenceSearch.id)}`
  )),
  'Readiness Proof Map evidence-source-review routes must expose explicit backend review and evidence-search resource fields.',
);
assert(
  proofMap.body.submissionReviewRoutes?.every((route) => (
    route.id
    && route.submissionReviewId === route.id
    && route.submissionReviewRoute === `/projects/${projectId}/submission-reviews/${encodeURIComponent(route.submissionReviewId)}`
    && route.apiPath === route.submissionReviewRoute
    && route.submissionId
    && route.submissionRoute === `/projects/${projectId}/submissions/${encodeURIComponent(route.submissionId)}`
  )),
  'Readiness Proof Map submission-review routes must expose explicit backend review and submission resource fields.',
);
assert(proofMap.body.projectMemoryReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/memory-readiness`, 'Readiness Proof Map must expose the project memory readiness proof route.');
assert(proofMap.body.plannerExecutorReviewerStateMachineRoutes?.[0]?.apiPath === `/projects/${projectId}/planner-executor-reviewer-state-machine`, 'Readiness Proof Map must expose the Planner / Executor / Reviewer state machine proof route.');
assert(proofMap.body.plannerExecutorReviewerStateMachineSummary?.readyForLocalProductTeamStateMachine === true, 'Readiness Proof Map must mark the Planner / Executor / Reviewer state machine local-ready.');
const governanceProofMapRoutes = [
  ['governanceProtocolRoutes', `/projects/${projectId}/governance-protocol`],
  ['managerCommandCenterRoutes', `/projects/${projectId}/manager-command-center`],
  ['managerScenarioTrailRoutes', `/projects/${projectId}/manager-scenario-trail`],
  ['managerScenarioWalkthroughRoutes', `/projects/${projectId}/manager-scenario-walkthrough`],
  ['managerRequirementMatrixRoutes', `/projects/${projectId}/manager-requirement-matrix`],
  ['syncProtocolAuditRoutes', `/projects/${projectId}/sync-protocol-audit`],
  ['managerUseCaseAuditRoutes', `/projects/${projectId}/manager-use-case-audit`],
  ['managerActionQueueRoutes', `/projects/${projectId}/manager-action-queue`],
];
for (const [routeKey, apiPath] of governanceProofMapRoutes) {
  const route = proofMap.body[routeKey]?.[0];
  assert(route?.apiPath === apiPath, `Readiness Proof Map must expose ${routeKey} at ${apiPath}.`);
  assert(route.readinessProofMapRoute === `/projects/${projectId}/readiness-proof-map`, `${routeKey} must link back to the Readiness Proof Map.`);
  assert(route.readyForProduction === false && route.productionBlocker === true, `${routeKey} must keep production readiness blocked.`);
}
assert(
  proofMap.body.managerActionQueueRoutes?.[0]?.runTemplateRoute === `/projects/${projectId}/manager-action-queue/:actionId/run`,
  'Readiness Proof Map must expose the Manager Action Queue run template route.',
);

const transcript = request({ method: 'GET', path: `/projects/${projectId}/transcripts/main` });
const transcriptText = asText(transcript.body);
assert(transcript.status === 200 && requiredTraceIds.filter((id) => id !== evidenceSearch.id).every((id) => transcriptText.includes(id)), 'Group Chat transcript must retain required submission, review, revision, final, and acceptance proof.');
const transcriptMessages = transcript.body.messages || [];
assert(transcriptMessages.some((message) => message.type === 'submission' && message.submissionId === finalSubmission.id && message.submissionRoute === `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmission.id)}` && message.resourceRoute === message.submissionRoute), 'Group Chat submission messages must carry the backend submission route for collaboration cards.');
assert(transcriptMessages.some((message) => message.type === 'evidence-search' && message.evidenceSearchId === evidenceSearch.id && message.evidenceSearchRoute === `/projects/${projectId}/evidence-searches/${encodeURIComponent(evidenceSearch.id)}` && message.resourceRoute === message.evidenceSearchRoute), 'Group Chat evidence-search messages must carry the backend evidence-search route for collaboration cards.');
const sourceReviewTranscriptMessages = transcriptMessages.filter((message) => message.type === 'evidence-source-review' && message.evidenceSearchId === evidenceSearch.id);
assert(sourceReviewTranscriptMessages.length >= 2 && sourceReviewTranscriptMessages.every((message) => message.evidenceSourceReviewRoute === `/projects/${projectId}/evidence-source-review-workflow#${encodeURIComponent(message.reviewId)}` && message.evidenceSearchRoute === `/projects/${projectId}/evidence-searches/${encodeURIComponent(evidenceSearch.id)}` && message.resourceRoute === message.evidenceSourceReviewRoute), 'Group Chat evidence-source-review messages must carry backend source-review and evidence-search routes for collaboration cards.');
assert(transcriptMessages.some((message) => message.type === 'submission-review' && message.reviewId === finalReview.id && message.submissionReviewRoute === `/projects/${projectId}/submission-reviews/${encodeURIComponent(finalReview.id)}` && message.submissionRoute === `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmission.id)}` && message.resourceRoute === message.submissionReviewRoute), 'Group Chat submission-review messages must carry backend review and submission routes for collaboration cards.');

const timeline = request({ method: 'GET', path: `/projects/${projectId}/timeline` });
const events = request({ method: 'GET', path: `/projects/${projectId}/events` });
const timelineEventsText = `${asText(timeline.body)}\n${asText(events.body)}`;
assert(timeline.status === 200 && events.status === 200 && requiredTraceIds.every((id) => timelineEventsText.includes(id)), 'Timeline/Event Ledger must trace required generic submission, evidence, review, revision, final, and acceptance proof.');

const agentDashboard = request({ method: 'GET', path: `/projects/${projectId}/agents/turing/dashboard` });
const agentDashboardText = asText(agentDashboard.body);
assert(agentDashboard.status === 200 && [productBriefSubmission.id, implementationPlanSubmission.id, revisionSubmission.id, finalSubmission.id].every((id) => agentDashboardText.includes(id)), 'Agent Dashboard must expose the submitting Agent core outputs.');

const evidenceIndex = request({ method: 'GET', path: `/projects/${projectId}/evidence-index-readiness` });
assert(evidenceIndex.status === 200 && asText(evidenceIndex.body).includes(evidenceSearch.id) && asText(evidenceIndex.body).includes(finalSubmission.id), 'Evidence Index readiness must trace evidence and final-deliverable ids.');

const sourceReviewWorkflow = request({ method: 'GET', path: `/projects/${projectId}/evidence-source-review-workflow` });
assert(sourceReviewWorkflow.status === 200 && sourceReviewWorkflow.body.evidenceSourceReviewWorkflow?.schemaVersion === 'evidence-source-review-workflow/v1', 'Evidence Source Review Workflow must expose the reviewer source-decision contract.');
assert(sourceReviewWorkflow.body.evidenceSourceReviewWorkflow.readyForLocalPilot === true, 'Evidence Source Review Workflow must be local-ready after Reviewer source decisions.');
assert(sourceReviewWorkflow.body.evidenceSourceReviewWorkflow.summary?.sourceReviewDecisionCount >= 2, 'Evidence Source Review Workflow must count submitted Reviewer source decisions.');
assert(sourceReviewWorkflow.body.evidenceSourceReviewWorkflow.summary?.pendingDecisionSourceCount === 0, 'Evidence Source Review Workflow must have no pending source decisions before archive handoff.');

const projectEvidenceArchive = request({ method: 'GET', path: `/projects/${projectId}/project-evidence-archive` });
const archive = projectEvidenceArchive.body.projectEvidenceArchive;
const archiveArtifactProofManifest = archive?.manifest?.find((entry) => entry.id === 'artifact-storage-proofs');
const archiveFinalDeliverablesManifest = archive?.manifest?.find((entry) => entry.id === 'final-deliverables');
const archiveArtifactQualityManifest = archive?.manifest?.find((entry) => entry.id === 'artifact-quality-audit');
const archiveTranscriptManifest = archive?.manifest?.find((entry) => entry.id === 'group-chat-transcripts');
const archiveSourceReviewWorkflowManifest = archive?.manifest?.find((entry) => entry.id === 'evidence-source-review-workflow');
const archiveSourceReviewDecisionsManifest = archive?.manifest?.find((entry) => entry.id === 'evidence-source-review-decisions');
assert(projectEvidenceArchive.status === 200 && archive?.schemaVersion === 'project-evidence-archive/v1', 'Project Evidence Archive must expose the backend archive contract.');
assert(archive.status === 'archive-ready' && archive.readyForManagerHandoff === true, `Project Evidence Archive must be ready for Manager handoff after source decisions and final delivery. failed=${JSON.stringify(archive.integrity?.failedGates || [])}`);
assert(archive.readyForProduction === false, 'Project Evidence Archive must not overclaim production readiness.');
assert(archive.summary?.rawLeakCount === 0, 'Project Evidence Archive must not leak raw secrets.');
assert(archive.summary?.finalDeliverableCount >= 1, 'Project Evidence Archive summary must include the final deliverable.');
assert(archive.summary?.evidenceSourceReviewDecisionCount >= 2 && archive.summary?.evidenceSourceReviewPendingDecisionCount === 0, 'Project Evidence Archive summary must include closed Reviewer source decisions.');
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
assert(archiveSourceReviewWorkflowManifest?.ready, 'Project Evidence Archive manifest must include ready evidence source review workflow evidence.');
assert(archiveSourceReviewDecisionsManifest?.ready, 'Project Evidence Archive manifest must include Reviewer source decision evidence.');
assert(
  archiveTranscriptManifest?.ready
    && archiveTranscriptManifest.missingTranscriptProofIdCount === 0,
  'Project Evidence Archive manifest must include complete backend transcript proof coverage.',
);

const memoryReadiness = request({ method: 'GET', path: `/projects/${projectId}/memory-readiness` });
assert(memoryReadiness.status === 200 && memoryReadiness.body.projectMemoryReadiness?.schemaVersion === 'project-memory-readiness/v1', 'Project memory readiness must be available for a real product-team run.');
assert(memoryReadiness.body.projectMemoryReadiness?.readyForProduction === false, 'Project memory readiness must not overclaim production managed-memory readiness.');

console.log('Product team core smoke validation passed.');
