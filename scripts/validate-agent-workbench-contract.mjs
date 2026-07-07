import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStatus(response, status, label) {
  assert(response.status === status, `${label} returned ${response.status}: ${response.body?.error || response.body?.message || 'no error detail'}`);
}

function assertDeferredReadModels(response, projectId, agentId, label) {
  const readModels = response.body.readModels || {};
  assert(readModels.included === false, `${label} must return lightweight deferred read models.`);
  assert(readModels.managerFlowGraphRoute === `/projects/${projectId}/manager-flow-graph`, `${label} must expose Manager Flow Graph refresh route.`);
  assert(readModels.readinessProofMapRoute === `/projects/${projectId}/readiness-proof-map`, `${label} must expose Readiness Proof Map refresh route.`);
  assert(readModels.transcriptsRoute === `/projects/${projectId}/transcripts`, `${label} must expose transcript refresh route.`);
  assert(readModels.timelineRoute === `/projects/${projectId}/timeline`, `${label} must expose timeline refresh route.`);
  assert(readModels.eventsRoute === `/projects/${projectId}/events`, `${label} must expose event-ledger refresh route.`);
  if (agentId) {
    assert(readModels.agentDashboardRoute === `/projects/${projectId}/agents/${agentId}/dashboard`, `${label} must expose Agent Dashboard refresh route.`);
  }
}

function assertProjectProof(response, projectId, entity, label) {
  const project = response.body.project || {};
  const messages = [
    ...(response.body.messages || []),
    ...(project.messages || []),
    ...(project.chatMessages || []),
  ];
  assert(project.id === projectId, `${label} must return the backend project.`);
  assert(entity?.messageId && messages.some((message) => message.id === entity.messageId), `${label} must return transcript proof.`);
  assert(entity?.timelineLogId && project.logs?.some((log) => log.id === entity.timelineLogId), `${label} must persist timeline proof.`);
  assert(entity?.eventId && project.eventLedger?.some((event) => event.id === entity.eventId), `${label} must persist event-ledger proof.`);
}

function assertReadContains(api, path, predicate, label) {
  const response = api.handle({ method: 'GET', path });
  assertStatus(response, 200, label);
  assert(predicate(response.body), label);
  return response.body;
}

const projectId = 'agent_workbench_contract_project';
const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
];

const service = createAgentProjectService({
  messageLimit: 180,
  searchProvider: createSearchProvider({
    provider: 'deterministic',
    enabled: true,
    maxResults: 3,
  }),
});
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'agent_workbench_contract_mission',
    meetingId: 'agent_workbench_contract_meeting',
    projectId,
    name: 'Agent Workbench Contract Project',
    missionBrief: 'Validate a generic AI product-team workbench path with evidence, brainstorm, draft, review, revision, and final delivery nodes.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      {
        id: 'task_workbench_contract',
        text: 'Turn a customer product question into proofed product-team deliverables.',
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

response = await api.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/evidence-searches`,
  body: {
    includeReadModels: false,
    useProvider: true,
    operation: 'search:evidence',
    taskId: 'task_workbench_contract',
    query: 'generic product team launch-readiness evidence',
    purpose: 'Collect decision evidence before the product-team brief.',
    confidence: 'high',
    findings: ['Provider-backed evidence should become a backend evidence-search node with source proof.'],
    tags: ['agent-workbench', 'contract', 'evidence'],
    now: '2026-06-01T09:05:00.000Z',
  },
});
assertStatus(response, 200, 'Workbench provider evidence');
assertDeferredReadModels(response, projectId, 'turing', 'Workbench provider evidence');
const evidenceSearch = response.body.evidenceSearch;
assert(evidenceSearch?.id && evidenceSearch.sources?.length > 0, 'Workbench evidence must create a backend evidence search with sources.');
assert(evidenceSearch.searchMode !== 'agent-note', 'Workbench evidence must not create browser-only agent-note proof.');
assertProjectProof(response, projectId, evidenceSearch, 'Workbench provider evidence');

const additionalGenericArtifactTypes = [
  'discovery-report',
  'evidence-packet',
  'decision-proposal',
  'risk-review',
  'implementation-plan',
];
const genericArtifactSubmissions = [];

for (const artifactType of additionalGenericArtifactTypes) {
  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/agents/turing/submissions`,
    body: {
      includeReadModels: false,
      artifactType,
      title: `Workbench ${artifactType.replace(/-/g, ' ')}`,
      summary: `Generic product-team ${artifactType.replace(/-/g, ' ')} submitted through Agent Workbench.`,
      body: `# Workbench ${artifactType.replace(/-/g, ' ')}\n\nThis ${artifactType.replace(/-/g, ' ')} links provider evidence to the generic product-team delivery chain.`,
      taskId: 'task_workbench_contract',
      sourceRefs: evidenceSearch.sources.slice(0, 2),
      dependsOn: [evidenceSearch.id],
      tags: ['agent-workbench', artifactType],
      now: '2026-06-01T09:08:00.000Z',
    },
  });
  assertStatus(response, 200, `Workbench ${artifactType} submission`);
  assertDeferredReadModels(response, projectId, 'turing', `Workbench ${artifactType} submission`);
  const genericSubmission = response.body.submission;
  assert(genericSubmission?.artifactType === artifactType, `Workbench must persist a ${artifactType} submission.`);
  assert(genericSubmission.artifactStorageProof?.schemaVersion === 'agent-artifact-storage-proof/v1', `Workbench ${artifactType} submission must include artifact storage proof.`);
  assertProjectProof(response, projectId, genericSubmission, `Workbench ${artifactType} submission`);
  genericArtifactSubmissions.push(genericSubmission);
}

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/submissions`,
  body: {
    includeReadModels: false,
    artifactType: 'brainstorm-board',
    title: 'Workbench brainstorm board',
    summary: 'Alternative product directions before choosing a delivery path.',
    body: '# Workbench brainstorm board\n\n- Option A: evidence-first product brief\n- Option B: implementation-first roadmap\n- Decision: combine evidence, review, and final delivery nodes.',
    taskId: 'task_workbench_contract',
    sourceRefs: evidenceSearch.sources.slice(0, 2),
    dependsOn: [evidenceSearch.id],
    tags: ['agent-workbench', 'brainstorm-board'],
    now: '2026-06-01T09:10:00.000Z',
  },
});
assertStatus(response, 200, 'Workbench brainstorm submission');
assertDeferredReadModels(response, projectId, 'turing', 'Workbench brainstorm submission');
const brainstormSubmission = response.body.submission;
assert(brainstormSubmission?.artifactType === 'brainstorm-board', 'Workbench must persist a brainstorm-board submission.');
assert(brainstormSubmission.artifactStorageProof?.schemaVersion === 'agent-artifact-storage-proof/v1', 'Workbench brainstorm submission must include artifact storage proof.');
assertProjectProof(response, projectId, brainstormSubmission, 'Workbench brainstorm submission');

response = await api.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/artifact-drafts`,
  body: {
    includeReadModels: false,
    artifactType: 'product-brief',
    taskId: 'task_workbench_contract',
    instruction: 'Draft a generic product-team brief from the evidence and brainstorm nodes.',
    evidenceSearchIds: [evidenceSearch.id],
    priorSubmissionIds: [brainstormSubmission.id],
    submit: true,
    useModel: false,
    requireModel: false,
    now: '2026-06-01T09:15:00.000Z',
  },
});
assertStatus(response, 200, 'Workbench draft submit');
assertDeferredReadModels(response, projectId, 'turing', 'Workbench draft submit');
assert(response.body.artifactDraft?.schemaVersion === 'agent-artifact-draft/v1', 'Workbench draft submit must return an artifact draft contract.');
const productBriefSubmission = response.body.submission;
assert(productBriefSubmission?.artifactType === 'product-brief', 'Workbench draft submit must persist a product-brief submission.');
assert(productBriefSubmission.isGeneratedDraft && productBriefSubmission.artifactDraft, 'Workbench draft submit must link the generated draft to the submission.');
assertProjectProof(response, projectId, productBriefSubmission, 'Workbench draft submit');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/submissions/${productBriefSubmission.id}/reviews`,
  body: {
    includeReadModels: false,
    reviewerAgentId: 'curie',
    verdict: 'changes-requested',
    comments: 'Please link the evidence source and add a revision note before final delivery.',
    requestedChanges: ['Link the evidence packet', 'Submit a revision-note response'],
    now: '2026-06-01T09:20:00.000Z',
  },
});
assertStatus(response, 200, 'Workbench review');
assertDeferredReadModels(response, projectId, '', 'Workbench review');
const review = response.body.review;
assert(review?.verdict === 'changes-requested' && review.submissionId === productBriefSubmission.id, 'Workbench review must persist a requested-changes review.');
assertProjectProof(response, projectId, review, 'Workbench review');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/submissions`,
  body: {
    includeReadModels: false,
    artifactType: 'revision-note',
    title: 'Workbench revision note',
    summary: 'Revision response linking evidence and reviewer-requested changes.',
    body: '# Workbench revision note\n\nThis revision links provider evidence, the brainstorm board, and the requested product-brief changes.',
    taskId: 'task_workbench_contract',
    respondsToReviewId: review.id,
    revisesSubmissionId: productBriefSubmission.id,
    dependsOn: [evidenceSearch.id, brainstormSubmission.id, productBriefSubmission.id, review.id],
    tags: ['agent-workbench', 'revision-note'],
    now: '2026-06-01T09:25:00.000Z',
  },
});
assertStatus(response, 200, 'Workbench revision submission');
assertDeferredReadModels(response, projectId, 'turing', 'Workbench revision submission');
const revisionSubmission = response.body.submission;
assert(revisionSubmission?.artifactType === 'revision-note' && revisionSubmission.respondsToReviewId === review.id, 'Workbench revision must link the review it answers.');
assert(revisionSubmission.revisesSubmissionId === productBriefSubmission.id, 'Workbench revision must link the submission it revises.');
assertProjectProof(response, projectId, revisionSubmission, 'Workbench revision submission');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/submissions`,
  body: {
    includeReadModels: false,
    artifactType: 'final-deliverable',
    title: 'Workbench final deliverable',
    summary: 'Final product-team deliverable after review and revision closure.',
    body: '# Workbench final deliverable\n\nFinal manager-ready product-team deliverable with evidence, brainstorm, draft, review, and revision proof.',
    taskId: 'task_workbench_contract',
    status: 'final',
    respondsToReviewId: review.id,
    revisesSubmissionId: revisionSubmission.id,
    supersedesSubmissionIds: [productBriefSubmission.id, revisionSubmission.id],
    dependsOn: [evidenceSearch.id, brainstormSubmission.id, productBriefSubmission.id, review.id, revisionSubmission.id],
    tags: ['agent-workbench', 'final-deliverable'],
    now: '2026-06-01T09:30:00.000Z',
  },
});
assertStatus(response, 200, 'Workbench final submission');
assertDeferredReadModels(response, projectId, 'turing', 'Workbench final submission');
const finalSubmission = response.body.submission;
assert(finalSubmission?.artifactType === 'final-deliverable' && finalSubmission.status === 'final', 'Workbench final submission must persist a final deliverable.');
assert(finalSubmission.revisesSubmissionId === revisionSubmission.id, 'Workbench final deliverable must link the revision it closes.');
assertProjectProof(response, projectId, finalSubmission, 'Workbench final submission');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/submissions/${finalSubmission.id}/reviews`,
  body: {
    includeReadModels: false,
    reviewerAgentId: 'curie',
    verdict: 'accepted',
    comments: 'Accepted as the final product-team deliverable for local MVP proof.',
    requestedChanges: [],
    now: '2026-06-01T09:35:00.000Z',
  },
});
assertStatus(response, 200, 'Workbench final review');
const finalReview = response.body.review;
assert(finalReview?.verdict === 'accepted', 'Workbench final review must accept the final deliverable.');
assertProjectProof(response, projectId, finalReview, 'Workbench final review');

const proofIds = [
  evidenceSearch.id,
  ...genericArtifactSubmissions.map((submission) => submission.id),
  brainstormSubmission.id,
  productBriefSubmission.id,
  review.id,
  revisionSubmission.id,
  finalSubmission.id,
  finalReview.id,
].filter(Boolean);

assertReadContains(
  api,
  `/projects/${projectId}/transcripts`,
  (body) => proofIds.every((id) => JSON.stringify(body).includes(id)),
  'Transcript index must expose every Workbench proof id.',
);
assertReadContains(
  api,
  `/projects/${projectId}/timeline`,
  (body) => [
    evidenceSearch.timelineLogId,
    ...genericArtifactSubmissions.map((submission) => submission.timelineLogId),
    brainstormSubmission.timelineLogId,
    productBriefSubmission.timelineLogId,
    review.timelineLogId,
    revisionSubmission.timelineLogId,
    finalSubmission.timelineLogId,
    finalReview.timelineLogId,
  ]
    .every((id) => id && JSON.stringify(body).includes(id)),
  'Timeline must expose every Workbench timeline proof id.',
);
assertReadContains(
  api,
  `/projects/${projectId}/events`,
  (body) => [
    evidenceSearch.eventId,
    ...genericArtifactSubmissions.map((submission) => submission.eventId),
    brainstormSubmission.eventId,
    productBriefSubmission.eventId,
    review.eventId,
    revisionSubmission.eventId,
    finalSubmission.eventId,
    finalReview.eventId,
  ]
    .every((id) => id && JSON.stringify(body).includes(id)),
  'Event ledger must expose every Workbench event proof id.',
);
const flowGraph = assertReadContains(
  api,
  `/projects/${projectId}/manager-flow-graph`,
  (body) => Array.isArray(body.nodes) && body.nodes.length > 0,
  'Manager Flow Graph must return nodes after Workbench writes.',
);
const flowGraphJson = JSON.stringify(flowGraph);
const missingFlowProofIds = proofIds.filter((id) => !flowGraphJson.includes(id));
assert(
  missingFlowProofIds.length === 0,
  `Manager Flow Graph must expose Workbench evidence, submissions, reviews, revisions, and final deliverable. Missing: ${missingFlowProofIds.join(', ')}`,
);
assert(
  flowGraphJson.includes(finalSubmission.id) && flowGraphJson.includes('final-deliverable'),
  'Manager Flow Graph must expose the Workbench final deliverable proof.',
);
assertReadContains(
  api,
  `/projects/${projectId}/readiness-proof-map`,
  (body) => proofIds.every((id) => JSON.stringify(body).includes(id))
    && JSON.stringify(body).includes('/submission-review-workflow')
    && JSON.stringify(body).includes('/manager-flow-graph'),
  'Readiness Proof Map must expose Workbench proof routes.',
);
assertReadContains(
  api,
  `/projects/${projectId}/submission-review-workflow`,
  (body) => body.submissionReviewWorkflow?.summary?.revisionResponseCount >= 1
    && body.submissionReviewWorkflow?.summary?.acceptedFinalDeliverableCount >= 1,
  'Submission Review Workflow must close through revision and accepted final deliverable.',
);

console.log('Agent Workbench backend contract validation passed.');
