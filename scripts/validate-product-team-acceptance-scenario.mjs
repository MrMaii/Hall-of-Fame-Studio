import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAgentProjectApi, createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { signAgentProjectAccessHeaders } from '../src/agents/accessControl.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readSmallTextFiles(rootPath) {
  if (!existsSync(rootPath)) return '';
  const entries = readdirSync(rootPath, { withFileTypes: true });
  return entries.map((entry) => {
    const path = `${rootPath}/${entry.name}`;
    if (entry.isDirectory()) return readSmallTextFiles(path);
    if (!entry.isFile()) return '';
    const stats = statSync(path);
    if (stats.size > 2_000_000) return '';
    return readFileSync(path, 'utf8');
  }).join('\n');
}

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'protocol design' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Cross-domain Inventor', skill: 'brainstorm synthesis' },
];

const FAKE_SEARCH_SECRET = 'SEARCH_SECRET_SHOULD_NOT_LEAK_12345';
const FAKE_MODEL_SECRET = 'MODEL_SECRET_SHOULD_NOT_LEAK_12345';
const FAKE_SOURCE_SECRET = 'SOURCE_SECRET_SHOULD_NOT_LEAK_12345';
const FAKE_VAULT_MASTER_KEY = 'VAULT_MASTER_KEY_SHOULD_NOT_LEAK_12345';
const FAKE_VAULT_ROTATED_MASTER_KEY = 'VAULT_ROTATED_MASTER_KEY_SHOULD_NOT_LEAK_12345';
const ACCESS_SIGNING_SECRET = 'ACCESS_SIGNING_SECRET_SHOULD_NOT_LEAK_12345';
const enforcedManagerHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'manager',
  'x-hofs-user-id': 'director',
};
const enforcedSecurityHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'security-admin',
  'x-hofs-user-id': 'security-lead',
};
const enforcedObserverHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'observer',
  'x-hofs-user-id': 'observer',
};
const enforcedJobsAgentHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'agent',
  'x-hofs-agent-id': 'jobs',
  'x-hofs-user-id': 'agent-runtime-jobs',
};
const enforcedCurieReviewerHeaders = {
  'x-hofs-access-mode': 'enforced',
  'x-hofs-role': 'reviewer-agent',
  'x-hofs-agent-id': 'curie',
  'x-hofs-user-id': 'agent-runtime-curie',
};
const signedHeadersFor = ({
  method = 'GET',
  path,
  role = 'security-admin',
  agentId = '',
  userId = 'security-lead',
  requestId = '',
} = {}) => signAgentProjectAccessHeaders({
  method,
  path,
  role,
  agentId,
  userId,
  requestId,
  secret: ACCESS_SIGNING_SECRET,
});

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
assert(appSource.includes('backend-manager-submissions-snapshot'), 'Manager Dashboard UI must expose Agent submissions.');
assert(appSource.includes('agent-focus-submissions-'), 'Agent Dashboard UI must expose owned submissions.');
assert(appSource.includes('backend-manager-evidence-searches-snapshot'), 'Manager Dashboard UI must expose evidence searches.');
assert(appSource.includes('backend-manager-submission-reviews-snapshot'), 'Manager Dashboard UI must expose submission reviews.');
assert(appSource.includes('backend-mvp-readiness-snapshot'), 'Manager Ready Package UI must expose MVP readiness.');
assert(appSource.includes('/mvp-readiness'), 'Manager UI must expose the MVP readiness route.');
assert(appSource.includes('backend-pilot-launch-readiness-snapshot'), 'Manager Ready Package UI must expose pilot launch readiness.');
assert(appSource.includes('/pilot-launch-readiness') && appSource.includes('Pilot Launch') && appSource.includes('Private Pilot'), 'Manager UI must expose the pilot launch readiness route and decision.');
assert(appSource.includes('backend-deployment-preflight-snapshot'), 'Manager Ready Package UI must expose deployment preflight readiness.');
assert(appSource.includes('/deployment-preflight') && appSource.includes('Deployment Preflight') && appSource.includes('Preflight Warnings'), 'Manager UI must expose the deployment preflight route and warning count.');
assert(appSource.includes('/adapter-gateway-preflight') && appSource.includes('Gateway Live') && appSource.includes('Gateway State'), 'Manager UI must expose the adapter gateway preflight route and live/state status.');
assert(appSource.includes('backend-production-launch-audit-snapshot'), 'Manager Ready Package UI must expose production launch audit readiness.');
assert(appSource.includes('/production-launch-audit') && appSource.includes('Production Launch Audit') && appSource.includes('Private Pilot Audit'), 'Manager UI must expose the production launch audit route and decisions.');
assert(appSource.includes('backend-project-evidence-archive-snapshot'), 'Manager Ready Package UI must expose the project evidence archive.');
assert(appSource.includes('/project-evidence-archive') && appSource.includes('Project Evidence Archive') && appSource.includes('Archive route'), 'Manager UI must expose the project evidence archive route and status.');
assert(appSource.includes('backend-project-evidence-export-workflow-snapshot'), 'Manager Ready Package UI must expose the project evidence export workflow.');
assert(appSource.includes('/project-evidence-exports') && appSource.includes('Project Evidence Export Workflow') && appSource.includes('Export route'), 'Manager UI must expose the project evidence export workflow route and status.');
assert(appSource.includes('backend-launch-approval-workflow-snapshot'), 'Manager Ready Package UI must expose launch approval workflow readiness.');
assert(appSource.includes('/launch-approvals') && appSource.includes('Launch Approval Workflow') && appSource.includes('Pilot Approval'), 'Manager UI must expose the launch approval workflow route and pilot approval status.');
assert(appSource.includes('backend-provider-readiness-snapshot'), 'Manager Ready Package UI must expose provider readiness.');
assert(appSource.includes('/provider-readiness'), 'Manager UI must expose the provider readiness route.');
assert(appSource.includes('Failure Control') && appSource.includes('Open Circuits') && appSource.includes('Retry Attempts'), 'Manager Ready Package UI must expose provider failure-control readiness.');
assert(appSource.includes('backend-operations-readiness-snapshot'), 'Manager Ready Package UI must expose operations readiness.');
assert(appSource.includes('Persistence Adapter') && appSource.includes('DB Adapter Dry Run'), 'Manager Ready Package UI must expose managed persistence adapter readiness.');
assert(appSource.includes('Queue Adapter') && appSource.includes('Adapter Dry Run'), 'Manager Ready Package UI must expose queue adapter readiness.');
assert(appSource.includes('Queue Parity') && appSource.includes('Snapshot Parity') && appSource.includes('Lease Parity'), 'Manager Ready Package UI must expose queue adapter parity readiness.');
assert(appSource.includes('Worker Recovery') && appSource.includes('Dead Letters') && appSource.includes('Receipts'), 'Manager Ready Package UI must expose worker recovery readiness.');
assert(appSource.includes('Incident Drill') && appSource.includes('Drill Receipts') && appSource.includes('Drill Alerts'), 'Manager Ready Package UI must expose operations incident drill readiness.');
assert(appSource.includes('backend-security-boundary-snapshot'), 'Manager Ready Package UI must expose security boundary status.');
assert(appSource.includes('Audit Stream'), 'Manager Ready Package UI must expose backend security audit stream status.');
assert(appSource.includes('Secret Vault') && appSource.includes('Vault Records') && appSource.includes('Vault Rotation'), 'Manager Ready Package UI must expose secret-vault readiness and rotation.');
assert(appSource.includes('Identity Sessions') && appSource.includes('/identity-sessions'), 'Manager Ready Package UI must expose identity-session readiness and route.');
assert(appSource.includes('/security-boundary'), 'Manager UI must expose the security boundary route.');
assert(appSource.includes('agent-focus-evidence-searches-'), 'Agent Dashboard UI must expose owned evidence searches.');
assert(appSource.includes('agent-focus-submission-reviews-'), 'Agent Dashboard UI must expose owned submission reviews.');

const root = fileURLToPath(new URL('../.tmp/product-team-acceptance', import.meta.url));
mkdirSync(root, { recursive: true });

const projectRuntime = createLocalProjectRuntime({
  rootPath: `${root}/runtime`,
  enableCommandExecution: false,
});
const secretVault = createLocalSecretVault({
  enabled: true,
  masterKey: FAKE_VAULT_MASTER_KEY,
  keyId: 'acceptance-local-v1',
  keySource: 'acceptance-harness',
});
const sealedSearchSecret = await secretVault.seal('search.apiKey', FAKE_SEARCH_SECRET, { scope: 'search-provider' });
const sealedModelSecret = await secretVault.seal('model.apiKey', FAKE_MODEL_SECRET, { scope: 'model-provider' });
const searchApiKey = await secretVault.open(sealedSearchSecret);
const modelApiKey = await secretVault.open(sealedModelSecret);
const vaultRotation = await secretVault.rotate({
  nextMasterKey: FAKE_VAULT_ROTATED_MASTER_KEY,
  nextKeyId: 'acceptance-local-v2',
  metadata: {
    reason: 'product-team-acceptance-rotation-rehearsal',
    keySource: 'acceptance-rotation-harness',
  },
  now: '2026-06-01T10:05:00.000Z',
});
const rotatedSearchRecord = vaultRotation.records.find((record) => record.name === 'search.apiKey');
const rotatedModelRecord = vaultRotation.records.find((record) => record.name === 'model.apiKey');
const rotatedSearchApiKey = await secretVault.open(rotatedSearchRecord);
const rotatedModelApiKey = await secretVault.open(rotatedModelRecord);
const secretVaultStatus = secretVault.status();
assert(searchApiKey === FAKE_SEARCH_SECRET && modelApiKey === FAKE_MODEL_SECRET, 'Local secret vault must seal and open provider secrets.');
assert(rotatedSearchApiKey === FAKE_SEARCH_SECRET && rotatedModelApiKey === FAKE_MODEL_SECRET, 'Local secret vault rotation must preserve provider secret readability through the new key.');
assert(vaultRotation.receipt?.schemaVersion === 'secret-vault-rotation-receipt/v1' && vaultRotation.receipt.rotatedRecordCount === 2, 'Local secret vault rotation must return a rotation receipt.');
assert(secretVaultStatus.ready && secretVaultStatus.encryptedRecordCount === 2 && secretVaultStatus.rawSecretRecordCount === 0, 'Local secret vault status must prove encrypted records without raw secret rows.');
assert(secretVaultStatus.rotationSupported === true && secretVaultStatus.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1', 'Local secret vault status must expose rotation support and the latest rotation receipt.');
assert(secretVaultStatus.keyId === 'acceptance-local-v2', 'Local secret vault status must expose the rotated key id.');
const searchProvider = createSearchProvider({
  provider: 'deterministic',
  enabled: true,
  apiKey: rotatedSearchApiKey,
  apiKeySource: 'local-secret-vault',
  secretVaultStatus,
  endpoint: `https://search.local/query?api_key=${FAKE_SEARCH_SECRET}`,
  maxResults: 3,
});
const modelProvider = createModelProvider({
  provider: 'openai-compatible',
  enabled: false,
  apiKey: rotatedModelApiKey,
  apiKeySource: 'local-secret-vault',
  secretVaultStatus,
  baseURL: `https://models.local/v1?api_key=${FAKE_MODEL_SECRET}`,
});
const providerPolicy = {
  enabled: true,
  mode: 'enforced',
  allowedModelProviders: ['openai-compatible'],
  allowedSearchProviders: ['deterministic'],
  allowedModels: ['gpt-4o-mini'],
  allowedSearchEndpointHosts: ['search.local'],
  maxRequestsPerProjectHour: 20,
  dailyBudgetCents: 500,
  searchCostCentsPerRequest: 1,
  retryAttempts: 2,
  retryBackoffMs: [0, 0],
  circuitFailureThreshold: 3,
  circuitWindowMinutes: 15,
  circuitCooldownSeconds: 60,
  defaultToolGrants: ['provider:test', 'model:kickoff', 'model:intent'],
  agentToolGrants: {
    curie: ['search:evidence'],
  },
};
const api = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  replaceWithSeed: true,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
});

let response = api.handle({
  method: 'POST',
  path: '/kickoff-meetings',
  body: {
    meetingId: 'product_team_acceptance_meeting',
    projectId: 'product_team_acceptance_project',
    name: 'General Product Team Acceptance Project',
    brief: 'Use a research-style project only as a validation sample for a general AI product team operating system.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    now: '2026-06-01T10:00:00.000Z',
    tasks: [
      { id: 'task_brainstorm', text: 'Create alternative product-team directions from multiple persona viewpoints.', assignee: 'Leonardo da Vinci', status: 'pending' },
      { id: 'task_evidence', text: 'Collect and evaluate evidence for the strongest direction.', assignee: 'Marie Curie', status: 'pending' },
      { id: 'task_brief', text: 'Draft a manager-readable product brief and decision proposal.', assignee: 'Steve Jobs', status: 'pending' },
      { id: 'task_review', text: 'Review the draft, request revisions, and approve final delivery.', assignee: 'Marie Curie', status: 'pending' },
    ],
  },
});
assert(response.status === 200, 'Acceptance Harness must create a durable kickoff meeting.');
assert(response.body.meeting.transcript.some((turn) => turn.stage === 'role-clarification'), 'Kickoff meeting must include role-clarification turns.');
assert(response.body.meeting.transcript.some((turn) => turn.stage === 'leader-campaign'), 'Kickoff meeting must include Leader campaign turns.');

response = api.handle({
  method: 'POST',
  path: '/kickoff-meetings/product_team_acceptance_meeting/approve',
  body: {
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    now: '2026-06-01T10:10:00.000Z',
  },
});
assert(response.status === 200 && response.body.project?.id === 'product_team_acceptance_project', 'Kickoff approval must create the acceptance project.');

const projectId = response.body.project.id;
const projectMembershipPolicy = {
  schemaVersion: 'project-membership-policy/v1',
  projectId,
  source: 'product-team-acceptance-membership-fixture',
  managerUserIds: ['director'],
  securityAdminUserIds: ['security-lead'],
  observerUserIds: ['observer'],
  runtimeUserIds: ['http-autonomous-scheduler'],
  agentIds: team.map((member) => member.id),
  reviewerAgentIds: ['curie'],
  agentUserIds: Object.fromEntries(team.map((member) => [member.id, [`agent-runtime-${member.id}`]])),
  reviewerUserIds: {
    curie: ['agent-runtime-curie'],
  },
};

response = api.handle({ method: 'GET', path: '/search/status' });
assert(response.status === 200 && response.body.searchProvider.enabled, 'Search provider status must be exposed without requiring a secret.');
assert(!('apiKey' in response.body.searchProvider), 'Search provider status must not expose API keys.');
assert(!JSON.stringify(response.body.searchProvider).includes(FAKE_SEARCH_SECRET), 'Search provider status must redact secret-bearing endpoints.');
assert(!JSON.stringify(modelProvider.status()).includes(FAKE_MODEL_SECRET), 'Model provider status must redact secret-bearing endpoints.');

response = await api.handleAsync({
  method: 'POST',
  path: '/search/test',
  body: {
    query: 'generic AI product team acceptance evidence',
  },
});
assert(response.status === 200 && response.body.sources?.length > 0, 'Search provider test must return sources.');

response = await api.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/curie/evidence-searches`,
  body: {
    query: 'generic AI product team acceptance evidence',
    purpose: 'Verify the product-team workflow with reusable evidence primitives rather than research-only logic.',
    taskId: 'task_evidence',
    useProvider: true,
    maxResults: 3,
    now: '2026-06-01T10:20:00.000Z',
  },
});
assert(response.status === 200 && response.body.evidenceSearch?.sources?.length === 3, 'Agent evidence search must be accepted by the API.');
assert(response.body.evidenceSearch.provider === 'deterministic', 'Agent evidence search must preserve provider provenance.');
assert(response.body.evidenceSearch.evidenceJudgement === 'strong-evidence', 'Agent evidence search must include an aggregate evidence judgement.');
assert(response.body.evidenceSearch.qualityScore >= 70, 'Agent evidence search must include a usable aggregate quality score.');
assert(response.body.evidenceSearch.sources.every((source) => source.qualityScore > 0 && source.qualityLevel && source.qualitySignals?.length), 'Every evidence source must include quality judgement signals.');
assert(response.body.evidenceSearch.sourceSafetySummary?.sourceSafetyReady === true, 'Agent evidence search must include a ready source-safety summary.');
assert(response.body.evidenceSearch.sourceSafetySummary?.blockedSourceCount === 0, 'Agent evidence search must not include blocked sources in the acceptance path.');
assert(response.body.evidenceSearch.sources.every((source) => source.sourceSafetyScore > 0 && source.sourceSafetyLevel === 'safe' && source.sourceSafetySignals?.includes('source-safety-screened')), 'Every evidence source must include source-safety judgement signals.');
const evidenceSearch = response.body.evidenceSearch;

const submissionPlan = [
  {
    agentId: 'da_vinci',
    artifactType: 'brainstorm-board',
    title: 'Three product-team directions',
    summary: 'A cross-domain board comparing product strategy, market narrative, and technical feasibility.',
    taskId: 'task_brainstorm',
    body: '# Three product-team directions\n\n1. Product strategy lens\n2. Evidence-first validation lens\n3. Implementation architecture lens\n\nRecommended synthesis: build the smallest proof-bearing product-team workflow.',
  },
  {
    agentId: 'curie',
    artifactType: 'evidence-packet',
    title: 'Evidence quality packet',
    summary: 'Source-quality notes and confidence levels for the product-team validation path.',
    taskId: 'task_evidence',
    sourceRefs: [
      ...evidenceSearch.sources,
      {
        id: 'secret-bearing-source',
        title: 'Secret-bearing source should be redacted',
        kind: 'security-fixture',
        url: `https://example.test/source?token=${FAKE_SOURCE_SECRET}`,
        summary: `Fixture source includes api_key=${FAKE_SOURCE_SECRET} and must never persist raw.`,
      },
    ],
    body: `# Evidence quality packet\n\n- Strong internal evidence: kickoff transcript, task evidence, event ledger.\n- Remaining gap: live external search integration is not required for this generic contract test.\n- Security fixture: token=${FAKE_SOURCE_SECRET}`,
  },
  {
    agentId: 'jobs',
    artifactType: 'product-brief',
    title: 'Product-team MVP brief',
    summary: 'A manager-readable brief that frames the generic AI product team MVP.',
    taskId: 'task_brief',
    body: '# Product-team MVP brief\n\nThe product is a general AI product team operating system. Research validates the workflow; it does not define the vertical.',
  },
  {
    agentId: 'curie',
    artifactType: 'risk-review',
    title: 'Reviewer risk review',
    summary: 'Reviewer asks for clearer separation between generic product-team primitives and the research sample.',
    taskId: 'task_review',
    reviewStatus: 'changes-requested',
    body: '# Reviewer risk review\n\nRisk: confusing the validation sample with a research-only product. Required revision: keep artifact and evidence contracts generic.',
  },
  {
    agentId: 'turing',
    artifactType: 'revision-note',
    title: 'Generic contract revision note',
    summary: 'Revision maps brainstorm, evidence, brief, review, and final delivery to generic submission nodes.',
    taskId: 'task_brief',
    body: '# Generic contract revision note\n\nAll nodes now use artifactType and submission protocol fields rather than research-only route names.',
  },
  {
    agentId: 'jobs',
    artifactType: 'final-deliverable',
    title: 'Final product-team validation package',
    summary: 'Final deliverable tying kickoff, brainstorm, evidence, draft, review, revision, and proof routes together.',
    taskId: 'task_brief',
    status: 'final',
    reviewStatus: 'accepted',
    body: '# Final product-team validation package\n\nThis package proves the general product-team workflow can submit and trace work nodes end to end.',
  },
];

const submissionsByType = new Map();
const reviewsByVerdict = new Map();
for (const item of submissionPlan) {
  const submissionBody = {
    ...item,
    reviewerAgentId: 'curie',
    now: item.artifactType === 'final-deliverable'
      ? '2026-06-01T11:10:00.000Z'
      : '2026-06-01T10:30:00.000Z',
  };
  if (item.artifactType === 'revision-note') {
    submissionBody.revisesSubmissionId = submissionsByType.get('product-brief')?.id;
    submissionBody.respondsToReviewId = reviewsByVerdict.get('changes-requested')?.id;
  }
  if (item.artifactType === 'final-deliverable') {
    submissionBody.revisesSubmissionId = submissionsByType.get('revision-note')?.id;
    submissionBody.respondsToReviewId = reviewsByVerdict.get('changes-requested')?.id;
    submissionBody.supersedesSubmissionIds = [
      submissionsByType.get('product-brief')?.id,
      submissionsByType.get('revision-note')?.id,
    ].filter(Boolean);
  }
  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/agents/${item.agentId}/submissions`,
    body: submissionBody,
  });
  assert(response.status === 200, `Submission ${item.artifactType} must be accepted by the API.`);
  assert(response.body.submission?.artifactType === item.artifactType, `Submission ${item.artifactType} must preserve artifactType.`);
  assert(response.body.submission?.messageId && response.body.submission?.timelineLogId && response.body.submission?.eventId, `Submission ${item.artifactType} must link chat, timeline, and event proof.`);
  assert(response.body.artifact?.existsOnDisk && existsSync(response.body.artifact.absolutePath), `Submission ${item.artifactType} must write a workspace artifact.`);
  submissionsByType.set(item.artifactType, response.body.submission);

  if (item.artifactType === 'product-brief') {
    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/submissions/${encodeURIComponent(item.artifactType === 'product-brief' ? response.body.submission.id : '')}/reviews`,
      body: {
        reviewerAgentId: 'curie',
        verdict: 'changes-requested',
        comments: 'Keep the workflow primitives generic and cite the evidence search record.',
        requestedChanges: [
          'Separate product-team primitives from the research validation sample.',
          'Link the evidence search to the revised artifact.',
        ],
        now: '2026-06-01T10:55:00.000Z',
      },
    });
    assert(response.status === 200 && response.body.review?.verdict === 'changes-requested', `Reviewer must be able to request changes on a submitted brief. status=${response.status} body=${JSON.stringify(response.body)}`);
    reviewsByVerdict.set('changes-requested', response.body.review);
  }

  if (item.artifactType === 'final-deliverable') {
    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/submissions/${encodeURIComponent(response.body.submission.id)}/reviews`,
      body: {
        reviewerAgentId: 'curie',
        verdict: 'accepted',
        comments: 'Final package accepted because the chain proves kickoff, evidence, revision, and final delivery.',
        now: '2026-06-01T11:20:00.000Z',
      },
    });
    assert(response.status === 200 && response.body.review?.verdict === 'accepted', 'Reviewer must be able to accept the final deliverable.');
    reviewsByVerdict.set('accepted', response.body.review);
  }
}

response = api.handle({ method: 'GET', path: `/projects/${projectId}/submissions` });
assert(response.status === 200 && response.body.submissions.length === submissionPlan.length, 'Project API must list all Agent submissions.');
assert(response.body.submissions.some((submission) => submission.artifactType === 'final-deliverable' && submission.status === 'final'), 'Project submissions must include a final deliverable.');
const revisedProductBrief = response.body.submissions.find((submission) => submission.id === submissionsByType.get('product-brief')?.id);
const revisionNote = response.body.submissions.find((submission) => submission.artifactType === 'revision-note');
const finalDeliverable = response.body.submissions.find((submission) => submission.artifactType === 'final-deliverable');
assert(revisedProductBrief?.status === 'superseded' && revisedProductBrief.latestRevisionId, 'Original draft submission must be superseded by a linked revision.');
assert(revisionNote?.revisesSubmissionId === submissionsByType.get('product-brief')?.id, 'Revision note must link to the draft it revises.');
assert(revisionNote?.respondsToReviewId === reviewsByVerdict.get('changes-requested')?.id, 'Revision note must link to the review it answers.');
assert(finalDeliverable?.revisesSubmissionId === revisionNote?.id && finalDeliverable?.supersedesSubmissionIds?.includes(submissionsByType.get('product-brief')?.id), 'Final deliverable must preserve revision lineage.');

const finalSubmissionId = response.body.submissions.find((submission) => submission.artifactType === 'final-deliverable')?.id;
response = api.handle({ method: 'GET', path: `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmissionId)}` });
assert(response.status === 200 && /Final product-team validation package/.test(response.body.submission.title), 'Project API must read a single Agent submission.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/evidence-searches` });
assert(response.status === 200 && response.body.evidenceSearches.length === 1, 'Project API must list Agent evidence searches.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/evidence-searches/${encodeURIComponent(evidenceSearch.id)}` });
assert(response.status === 200 && response.body.evidenceSearch.confidence === 'high', 'Project API must read one Agent evidence search.');
assert(response.body.evidenceSearch.sourceSafetySummary?.sourceSafetyReady === true, 'Project API must preserve evidence source-safety summary.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/submission-reviews` });
assert(response.status === 200 && response.body.submissionReviews.length === 2, 'Project API must list submission reviews.');
response = api.handle({ method: 'GET', path: `/projects/${projectId}/submission-reviews/${encodeURIComponent(reviewsByVerdict.get('accepted').id)}` });
assert(response.status === 200 && response.body.submissionReview.verdict === 'accepted', 'Project API must read one submission review.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-dashboard` });
assert(response.status === 200 && response.body.submissions.count === submissionPlan.length, 'Manager Dashboard must expose submission summary.');
assert(response.body.submissions.finalDeliverableCount === 1, 'Manager Dashboard must count final deliverables.');
assert(response.body.submissions.revisionCount >= 2 && response.body.submissions.supersededCount >= 2, 'Manager Dashboard must summarize revision lineage and superseded submissions.');
assert(response.body.evidenceSearches.count === 1 && response.body.evidenceSearches.sourceCount === 3, 'Manager Dashboard must expose evidence search summary.');
assert(response.body.evidenceSearches.averageQualityScore >= 70 && response.body.evidenceSearches.strongEvidenceCount === 1, 'Manager Dashboard must expose evidence quality summary.');
assert(response.body.evidenceSearches.sourceSafetyReadyCount === 1 && response.body.evidenceSearches.sourceSafetyBlockedSourceCount === 0, 'Manager Dashboard must expose source-safety summary.');
assert(response.body.submissionReviews.acceptedCount === 1 && response.body.submissionReviews.changesRequestedCount === 1, 'Manager Dashboard must expose review summary.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-ready-package` });
assert(response.status === 200 && response.body.mvpReadiness?.readyForLocalPilot, 'Manager Ready Package must include a local-pilot-ready MVP readiness gate.');
assert(response.body.mvpReadiness?.readyForProduction === false, 'MVP readiness must not claim production readiness while production blockers remain.');
assert(response.body.mvpReadiness?.production?.blockerCount >= 3, 'MVP readiness must enumerate production blockers.');
assert(response.body.summary?.mvpCorePassedCount === response.body.summary?.mvpCoreTotalCount, 'Manager Ready Package summary must expose full MVP core coverage.');
assert(response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Manager Ready Package must include the security boundary contract.');
assert(response.body.securityBoundary?.status === 'local-boundary-ready', 'Security boundary must pass local redaction scanning.');
assert(response.body.securityBoundary?.readyForProduction === false, 'Security boundary must not claim production readiness before auth/RBAC/vault hardening.');
assert(response.body.securityBoundary?.redactionScan?.rawLeakCount === 0, 'Security boundary must not detect raw secret fixture leakage.');
assert(response.body.securityBoundary?.redactionScan?.redactionMarkerCount > 0, 'Security boundary must prove secret-bearing fields were redacted.');
assert(response.body.securityBoundary?.accessControl?.schemaVersion === 'access-control-policy/v1', 'Security boundary must include the access-control policy contract.');
assert(response.body.securityBoundary?.accessControl?.status === 'enforceable-prototype-policy', 'Security boundary must expose an enforceable prototype access policy.');
assert(response.body.securityBoundary?.accessControl?.replayProtectionContract?.requestIdHeader === 'x-hofs-request-id', 'Security boundary must expose the signed request replay-protection contract.');
assert(response.body.securityBoundary?.accessControl?.auditWriteContract?.failureStatusCode === 503, 'Security boundary must expose the audit fail-closed contract.');
assert(response.body.securityBoundary?.accessControl?.projectMembershipContract?.schemaVersion === 'project-membership-policy/v1', 'Security boundary must expose the project membership policy contract.');
assert(response.body.securityBoundary?.secretVault?.ready === true && response.body.securityBoundary?.secretVault?.encryptedRecordCount === 2, 'Security boundary must expose the local encrypted secret-vault contract.');
assert(response.body.securityBoundary?.secretVault?.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1', 'Security boundary must expose the local secret-vault rotation receipt.');
assert(response.body.securityBoundary?.summary?.secretVaultRotationReady === true, 'Security boundary summary must expose secret-vault rotation readiness.');
assert(response.body.securityBoundary?.production?.rows?.some((control) => control.id === 'encrypted-secret-vault' && control.status === 'local-control-ready'), 'Security boundary must mark the local encrypted secret vault control ready.');
assert(response.body.providerReadiness?.schemaVersion === 'provider-readiness/v1', 'Manager Ready Package must include the provider readiness contract.');
assert(response.body.providerReadiness?.status === 'local-provider-contract-ready', 'Provider readiness must pass the local provider contract for the acceptance project.');
assert(response.body.providerReadiness?.readyForProduction === false, 'Provider readiness must not claim production readiness before rollout controls exist.');
assert(response.body.providerReadiness?.gates?.every((gate) => gate.passed), 'Provider readiness gates must all pass for the acceptance project.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'provider-allowlist'), 'Provider readiness must keep provider allowlists as an explicit production control.');
assert(response.body.providerReadiness?.providerControlPolicy?.schemaVersion === 'provider-control-policy/v1', 'Provider readiness must include the provider control policy.');
assert(response.body.providerReadiness?.providerControlPolicy?.enforcementEnabled === true, 'Provider readiness must prove provider policy enforcement is enabled.');
assert(response.body.providerReadiness?.providerUsage?.count >= 1, 'Provider readiness must expose provider usage audit rows.');
assert(response.body.providerReadiness?.providerUsage?.dailyCostCents >= 1, 'Provider readiness must expose provider cost tracking.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'provider-audit-and-cost-ledger' && control.status === 'local-control-ready'), 'Provider readiness must mark the local provider audit ledger as ready.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'source-safety-review' && control.status === 'local-control-ready'), 'Provider readiness must mark local source-safety review ready.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'failure-retry-circuit-breaker' && control.status === 'local-control-ready'), 'Provider readiness must mark local provider failure controls ready.');
assert(response.body.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'encrypted-secret-vault' && control.status === 'local-control-ready'), 'Provider readiness must mark the local encrypted secret vault control ready.');
assert(response.body.providerReadiness?.providerBoundaries?.evidence?.sourceSafetySummary?.sourceSafetyReady === true, 'Provider readiness must expose evidence source-safety summary.');
assert(response.body.providerReadiness?.providerBoundaries?.failureControl?.ready === true, 'Provider readiness must expose provider retry/circuit-breaker summary.');
assert(response.body.providerReadiness?.providerBoundaries?.secretVault?.ready === true, 'Provider readiness must expose provider secret-vault summary.');
assert(response.body.providerReadiness?.providerBoundaries?.secretVault?.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1', 'Provider readiness must expose provider secret-vault rotation summary.');
assert(response.body.providerReadiness?.summary?.providerSecretVaultRotationReady === true, 'Provider readiness summary must expose secret-vault rotation readiness.');
assert(response.body.summary?.providerReadinessFailedGateCount === 0, 'Manager Ready Package summary must expose provider readiness gate status.');
assert(response.body.summary?.providerBackedSearchCount >= 1, 'Manager Ready Package summary must expose provider-backed search count.');
assert(response.body.operationsReadiness?.schemaVersion === 'operations-readiness/v1', 'Manager Ready Package must include the operations readiness contract.');
assert(response.body.operationsReadiness?.recovery?.runbookReady === true, 'Manager Ready Package must expose the recovery runbook.');
assert(response.body.operationsReadiness?.observability?.alertRules?.length >= 3, 'Manager Ready Package must expose local alert-rule drafts.');
assert(response.body.operationsReadiness?.incidentDrill?.schemaVersion === 'operations-incident-drill/v1', 'Manager Ready Package must expose the operations incident drill receipt.');
assert(typeof response.body.operationsReadiness?.incidentDrill?.drillReady === 'boolean', 'Manager Ready Package must expose operations incident drill readiness status.');
assert(response.body.operationsReadiness?.incidentDrill?.productionCutoverReady === false, 'Manager Ready Package incident drill must not claim production cutover readiness.');
assert(response.body.operationsReadiness?.incidentDrill?.receipts?.every((receipt) => receipt.receiptChecksum), 'Manager Ready Package incident drill receipts must be checksummed.');
assert(response.body.pilotLaunchReadiness?.schemaVersion === 'pilot-launch-readiness/v1', 'Manager Ready Package must include the pilot launch readiness contract.');
assert(['go', 'no-go'].includes(response.body.pilotLaunchReadiness?.privatePilotDecision), 'Pilot launch readiness must expose a private-pilot decision.');
assert(response.body.pilotLaunchReadiness?.productionDecision === 'no-go', 'Pilot launch readiness must keep production launch blocked.');
assert(response.body.pilotLaunchReadiness?.checksum, 'Pilot launch readiness must expose a checksummed launch packet.');
assert(response.body.summary?.pilotLaunchGateCount === response.body.pilotLaunchReadiness?.summary?.gateCount, 'Manager Ready Package summary must expose pilot launch gate count.');
assert(response.body.deploymentPreflight?.schemaVersion === 'deployment-preflight/v1', 'Manager Ready Package must include deployment preflight.');
assert(response.body.deploymentPreflight?.productionDeploymentReady === false, 'Deployment preflight must not claim production deployment readiness.');
assert(response.body.deploymentPreflight?.checksum, 'Deployment preflight must expose a checksum.');
assert(response.body.summary?.deploymentPreflightStatus === response.body.deploymentPreflight?.status, 'Manager Ready Package summary must expose deployment preflight status.');
assert(response.body.adapterGatewayPreflight?.schemaVersion === 'adapter-gateway-preflight/v1', 'Manager Ready Package must include adapter gateway preflight.');
assert(response.body.adapterGatewayPreflight?.privateGatewayReady === true, 'Adapter gateway preflight must pass the private local-shadow rehearsal path.');
assert(response.body.adapterGatewayPreflight?.productionCutoverReady === false, 'Adapter gateway preflight must not claim production cutover readiness.');
assert(response.body.adapterGatewayPreflight?.backendRoutes?.adapterGatewayPreflight?.endsWith('/adapter-gateway-preflight'), 'Adapter gateway preflight must expose its standalone backend route.');
assert(response.body.deploymentPreflight?.gates?.some((gate) => gate.id === 'adapter-gateway-preflight' && gate.passed), 'Deployment preflight must include a passing adapter gateway preflight gate.');
assert(response.body.deploymentPreflight?.adapters?.gateway?.preflight?.route?.endsWith('/adapter-gateway-preflight'), 'Deployment preflight must point to the adapter gateway preflight route.');
assert(response.body.summary?.adapterGatewayPreflightStatus === response.body.adapterGatewayPreflight?.status, 'Manager Ready Package summary must expose adapter gateway preflight status.');
assert(response.body.summary?.adapterGatewayLiveReady === false && response.body.summary?.adapterGatewayStateReadable === false, 'Local-shadow Manager Ready Package summary must keep live gateway/state checks pending until an endpoint is configured.');
assert(response.body.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1', 'Manager Ready Package must include the launch approval workflow contract.');
assert(response.body.launchApprovalWorkflow?.readyForPrivatePilot === false, 'Launch approval workflow must require explicit private-pilot approvals before release.');
assert(response.body.summary?.launchApprovalStatus === response.body.launchApprovalWorkflow?.status, 'Manager Ready Package summary must expose launch approval status.');
assert(response.body.summary?.launchApprovalPrivatePilotReady === false, 'Manager Ready Package summary must expose private-pilot approval readiness.');
assert(response.body.productionLaunchAudit?.schemaVersion === 'production-launch-audit/v1', 'Manager Ready Package must include the production launch audit contract.');
assert(['go', 'no-go'].includes(response.body.productionLaunchAudit?.privatePilotDecision), 'Production launch audit must expose a private-pilot decision.');
assert(response.body.productionLaunchAudit?.productionDecision === 'no-go', 'Production launch audit must keep public production blocked.');
assert(response.body.productionLaunchAudit?.readyForProduction === false, 'Production launch audit must not claim production readiness before final controls exist.');
assert(response.body.productionLaunchAudit?.failedPrivatePilotGates?.some((gate) => gate.id === 'private-pilot-launch-approval-ready'), 'Production launch audit must require launch approval before private-pilot go.');
assert(response.body.productionLaunchAudit?.summary?.failedProductionGateCount > 0, 'Production launch audit must keep production gates failed until real controls exist.');
assert(response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'production-managed-persistence'), 'Production launch audit must retain managed persistence as a production blocker.');
assert(response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'production-real-providers'), 'Production launch audit must retain real providers as a production blocker.');
assert(response.body.productionLaunchAudit?.auditIntegrityGates?.some((gate) => gate.id === 'production-overclaim-guard' && gate.passed), 'Production launch audit must prove production overclaim is blocked.');
assert(response.body.summary?.productionLaunchAuditStatus === response.body.productionLaunchAudit?.status, 'Manager Ready Package summary must expose production launch audit status.');
assert(response.body.summary?.productionLaunchProductionDecision === 'no-go', 'Manager Ready Package summary must expose the production launch no-go decision.');
assert(response.body.summary?.productionLaunchProductionBlockerCount === response.body.productionLaunchAudit?.summary?.productionBlockerCount, 'Manager Ready Package summary must expose production launch blocker count.');
assert(response.body.persistenceAdapterPlan?.schemaVersion === 'managed-persistence-adapter-plan/v1', 'Manager Ready Package must include the managed persistence adapter plan.');
assert(response.body.persistenceAdapterDryRun?.schemaVersion === 'managed-persistence-adapter-dry-run/v1', 'Manager Ready Package must include the managed persistence adapter dry-run.');
assert(response.body.summary?.persistenceAdapterDryRunStatus, 'Manager Ready Package summary must expose managed persistence adapter dry-run status.');
assert(response.body.summary?.persistenceAdapterDriver === 'local-shadow', 'Manager Ready Package summary must expose the active managed persistence adapter driver.');
assert(response.body.summary?.persistenceAdapterProductionCutoverReady === false, 'Manager Ready Package summary must keep production database cutover blocked for local shadow runs.');
assert(response.body.workerQueueAdapterPlan?.schemaVersion === 'worker-queue-adapter-plan/v1' && response.body.workerQueueAdapterPlan?.status === 'ready-for-queue-adapter-pilot', 'Manager Ready Package must include a ready worker queue adapter plan.');
assert(response.body.workerQueueAdapterDryRun?.schemaVersion === 'worker-queue-adapter-dry-run/v1' && response.body.workerQueueAdapterDryRun?.status === 'passed', 'Manager Ready Package must include a passing worker queue adapter dry-run.');
assert(response.body.summary?.queueAdapterDryRunStatus === 'passed' && response.body.summary?.queueAdapterDispatchCount >= 1, 'Manager Ready Package summary must expose queue adapter dry-run status and dispatch count.');
assert(response.body.summary?.queueAdapterDriver === 'local-shadow', 'Manager Ready Package summary must expose the active worker queue adapter driver.');
assert(response.body.summary?.queueAdapterProductionCutoverReady === false, 'Manager Ready Package summary must keep production queue cutover blocked for local shadow runs.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_SEARCH_SECRET), 'Security boundary must not expose the search secret fixture.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_MODEL_SECRET), 'Security boundary must not expose the model secret fixture.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_SOURCE_SECRET), 'Security boundary must not expose the source secret fixture.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_VAULT_MASTER_KEY), 'Security boundary must not expose the vault master key fixture.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_VAULT_ROTATED_MASTER_KEY), 'Security boundary must not expose the rotated vault master key fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_SEARCH_SECRET), 'Provider readiness must not expose the search secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_MODEL_SECRET), 'Provider readiness must not expose the model secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_SOURCE_SECRET), 'Provider readiness must not expose the source secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_VAULT_MASTER_KEY), 'Provider readiness must not expose the vault master key fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_VAULT_ROTATED_MASTER_KEY), 'Provider readiness must not expose the rotated vault master key fixture.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/mvp-readiness` });
assert(response.status === 200 && response.body.mvpReadiness?.status === 'mvp-local-candidate', 'Project API must expose MVP readiness as a standalone read model.');
assert(response.body.mvpReadiness.rows.some((row) => row.id === 'backend-worker-loop' && row.passed), 'MVP readiness must prove backend/runtime worker coverage.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-secret-vault-rbac' && row.apiPath?.endsWith('/security-boundary')), 'MVP readiness must point secret-vault/RBAC hardening to the security boundary route.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-managed-persistence' && row.apiPath?.endsWith('/persistence-adapter-dry-run')), 'MVP readiness must point managed-persistence hardening to the persistence adapter dry-run route.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-queue-cron' && row.apiPath?.endsWith('/worker-queue-adapter-dry-run')), 'MVP readiness must point queue/cron hardening to the worker queue adapter dry-run route.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-real-providers' && row.apiPath?.endsWith('/provider-readiness')), 'MVP readiness must point real provider rollout hardening to the provider readiness route.');
assert(response.body.mvpReadiness.production.rows.some((row) => row.id === 'production-observability-recovery' && row.apiPath?.endsWith('/operations-readiness')), 'MVP readiness must point observability/recovery hardening to the operations readiness route.');

response = api.handle({
  method: 'PUT',
  path: `/projects/${projectId}/membership-policy`,
  body: {
    policy: projectMembershipPolicy,
    updatedBy: 'security-lead',
    source: 'product-team-acceptance-membership-api',
    now: '2026-06-01T11:25:00.000Z',
  },
});
assert(response.status === 200 && response.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', 'Project API must persist a project membership policy.');
assert(response.body.projectMembershipSummary?.managerUserCount === 1 && response.body.projectMembershipSummary?.agentBindingCount === team.length, 'Project membership policy summary must count manager and Agent runtime bindings.');
assert(response.body.projectMembershipAuditEntry?.eventId && response.body.log?.eventType === 'project-membership-policy-updated', 'Project membership policy updates must create audit and timeline proof.');
assert(response.body.project.eventLedger.some((event) => event.type === 'project-membership-policy-updated'), 'Project membership policy updates must enter the event ledger.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/membership-policy` });
assert(response.status === 200 && response.body.projectMembershipPolicy?.revision === 1, 'Project API must read the persisted project membership policy.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/security-boundary` });
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Project API must expose a standalone security boundary contract.');
assert(response.body.securityBoundary.redactionScan.status === 'ready', 'Standalone security boundary must report a ready redaction scan.');
assert(response.body.securityBoundary.providerBoundary.exposedSecrets === false, 'Standalone security boundary must not expose provider secrets.');
assert(response.body.securityBoundary.projectMembership?.configured && response.body.securityBoundary.projectMembership.revision === 1, 'Security boundary must expose persisted project membership policy status.');
assert(response.body.securityBoundary.secretVault?.ready === true && response.body.securityBoundary.secretVault.rawSecretRecordCount === 0, 'Standalone security boundary must expose encrypted secret vault readiness.');
assert(response.body.securityBoundary.secretVault?.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1' && response.body.securityBoundary.summary?.secretVaultRotationReady === true, 'Standalone security boundary must expose secret-vault rotation readiness.');
assert(!JSON.stringify(response.body.securityBoundary).includes(FAKE_VAULT_ROTATED_MASTER_KEY), 'Standalone security boundary must not expose the rotated vault master key fixture.');
for (const routeKey of ['submissions', 'evidence-searches', 'submission-reviews', 'pilot-launch-readiness', 'deployment-preflight', 'adapter-gateway-preflight', 'production-launch-audit', 'launch-approvals', 'project-evidence-exports', 'mvp-readiness', 'persistence-snapshot', 'persistence-migration-plan', 'persistence-migration-dry-run', 'persistence-adapter-plan', 'persistence-adapter-dry-run', 'worker-queue', 'worker-queue-adapter-plan', 'worker-queue-adapter-dry-run', 'operations-readiness', 'provider-readiness', 'security-boundary', 'security-access-audit', 'security-audit-stream', 'membership-policy', 'identity-sessions']) {
  assert(response.body.securityBoundary.routeSummary.routeKeys.includes(routeKey), `Security boundary route manifest must include ${routeKey}.`);
}
assert(response.body.securityBoundary.production.status === 'production-blocked' && response.body.securityBoundary.production.blockerCount >= 4, 'Security boundary must keep production hardening blockers visible.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/provider-readiness` });
assert(response.status === 200 && response.body.providerReadiness?.schemaVersion === 'provider-readiness/v1', 'Project API must expose a standalone provider readiness contract.');
assert(response.body.providerReadiness.status === 'local-provider-contract-ready', 'Standalone provider readiness must pass local provider gates.');
assert(response.body.providerReadiness.readyForProduction === false, 'Standalone provider readiness must keep production rollout blocked.');
assert(response.body.providerReadiness.providerBoundaries?.search?.status?.provider === 'deterministic', 'Provider readiness must expose deterministic provider provenance for local validation.');
assert(response.body.providerReadiness.providerBoundaries?.evidence?.providerBackedSearchCount >= 1, 'Provider readiness must link provider-backed evidence searches.');
assert(response.body.providerReadiness.requiredProductionControls.some((control) => control.id === 'budget-and-rate-limits'), 'Provider readiness must expose budget and rate-limit production controls.');
assert(response.body.providerReadiness.requiredProductionControls.some((control) => control.id === 'budget-and-rate-limits' && control.status === 'local-control-ready'), 'Provider readiness must mark local budget and rate controls ready.');
assert(response.body.providerReadiness.gates.some((gate) => gate.id === 'search-source-safety-review' && gate.passed), 'Provider readiness must gate provider-backed evidence source safety.');
assert(response.body.providerReadiness.gates.some((gate) => gate.id === 'provider-retry-circuit-breaker' && gate.passed), 'Provider readiness must gate provider retry/circuit-breaker controls.');
assert(response.body.providerReadiness.gates.some((gate) => gate.id === 'provider-secret-vault-contract' && gate.passed), 'Provider readiness must gate provider secret-vault controls.');
assert(response.body.providerReadiness.summary?.sourceSafetyReady === true && response.body.providerReadiness.summary?.sourceSafetyBlockedSourceCount === 0, 'Standalone provider readiness must summarize source-safety readiness.');
assert(response.body.providerReadiness.summary?.providerFailureControlReady === true && response.body.providerReadiness.summary?.providerOpenCircuitCount === 0 && response.body.providerReadiness.summary?.providerRetryAttempts === 2, 'Standalone provider readiness must summarize retry/circuit-breaker readiness.');
assert(response.body.providerReadiness.summary?.providerSecretVaultReady === true && response.body.providerReadiness.summary?.providerSecretVaultEncryptedRecordCount === 2, 'Standalone provider readiness must summarize secret-vault readiness.');
assert(response.body.providerReadiness.summary?.providerSecretVaultRotationReady === true, 'Standalone provider readiness must summarize secret-vault rotation readiness.');
assert(response.body.providerReadiness.backendRoutes.providerReadiness?.endsWith('/provider-readiness'), 'Provider readiness must expose its own backend route.');
assert(response.body.providerReadiness.providerUsage?.rows?.some((row) => row.operation === 'search:evidence' && row.allowed === true && row.retry?.attemptCount >= 1 && row.circuitBreaker?.state === 'closed'), 'Provider readiness must expose allowed provider usage rows with retry/circuit metadata.');
assert(response.body.providerReadiness.redaction?.responseLeakCount === 0, 'Provider readiness must report zero response secret leaks.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_SEARCH_SECRET), 'Standalone provider readiness must not expose the search secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_MODEL_SECRET), 'Standalone provider readiness must not expose the model secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_SOURCE_SECRET), 'Standalone provider readiness must not expose the source secret fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_VAULT_MASTER_KEY), 'Standalone provider readiness must not expose the vault master key fixture.');
assert(!JSON.stringify(response.body.providerReadiness).includes(FAKE_VAULT_ROTATED_MASTER_KEY), 'Standalone provider readiness must not expose the rotated vault master key fixture.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-boundary`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.securityBoundary.accessControl.status === 'enforceable-prototype-policy', 'Security admin must be able to read the security boundary in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/provider-readiness`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.providerReadiness.status === 'local-provider-contract-ready', 'Security admin must be able to read provider readiness in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-snapshot`,
  headers: enforcedObserverHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.route?.routeKey === 'persistence-snapshot', 'Observer must not export persistence snapshots in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/agents/jobs/dashboard`,
  headers: enforcedJobsAgentHeaders,
});
assert(response.status === 200 && response.body.agentId === 'jobs', 'Agent must be able to read its own dashboard in enforced mode.');
response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/agents/curie/dashboard`,
  headers: enforcedJobsAgentHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.route?.routeKey === 'agent-read', 'Agent must not read another Agent dashboard in enforced mode.');
response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/agents/curie/submissions`,
  headers: enforcedJobsAgentHeaders,
  body: {
    artifactType: 'risk-review',
    title: 'Unauthorized cross-Agent submission',
    summary: 'This should be rejected by the access layer.',
    body: 'Denied before persistence.',
  },
});
assert(response.status === 403 && response.body.accessDecision?.route?.routeKey === 'agent-submissions', 'Agent must not submit artifacts as another Agent in enforced mode.');
response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmissionId)}/reviews`,
  headers: enforcedCurieReviewerHeaders,
  body: {
    reviewerAgentId: 'jobs',
    verdict: 'accepted',
    comments: 'Reviewer identity mismatch should be rejected.',
  },
});
assert(response.status === 403 && response.body.accessDecision?.route?.routeKey === 'submission-review-create', 'Reviewer Agent must not submit a review under another reviewer id.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-access-audit`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.securityAccessAudit?.schemaVersion === 'security-access-audit/v1', 'Security admin must be able to read the persisted access audit.');
assert(response.body.securityAccessAudit.count >= 6, 'Security access audit must persist enforced-mode allow and deny decisions.');
assert(response.body.securityAccessAudit.deniedCount >= 4, 'Security access audit must persist denied decisions.');
assert(response.body.securityAccessAudit.rows.every((row) => row.id && row.routeKey && row.actor?.role), 'Security access audit rows must include id, route, and actor proof.');
assert(response.body.securityAccessAudit.eventIds.length >= response.body.securityAccessAudit.count, 'Security access audit must link decisions to event-ledger proof.');
assert(response.body.securityAccessAudit.stream?.count >= response.body.securityAccessAudit.count, 'Security access audit must expose the backend audit stream summary.');
assert(response.body.securityAccessAudit.stream?.sequenceGapCount === 0, 'Security audit stream must preserve contiguous project-local append order.');
assert(response.body.securityAccessAudit.stream?.hashChainReady === true, 'Security access audit must expose a verified backend audit hash chain.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-audit-stream`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.securityAuditStream?.schemaVersion === 'security-audit-stream/v1', 'Security admin must be able to read the backend audit stream.');
assert(response.body.securityAuditStream.count >= 7, 'Backend security audit stream must persist enforced-mode allow and deny decisions.');
assert(response.body.securityAuditStream.deniedCount >= 4, 'Backend security audit stream must persist denied decisions.');
assert(response.body.securityAuditStream.sequenceGapCount === 0, 'Backend security audit stream must preserve contiguous append order.');
assert(response.body.securityAuditStream.hashChainReady === true && response.body.securityAuditStream.chainBreakCount === 0 && response.body.securityAuditStream.hashMismatchCount === 0, 'Backend security audit stream must expose a verified hash-chain proof.');
assert(response.body.securityAuditStream.rows.every((row) => row.streamRecordId && row.streamChecksum && row.streamSequence && row.previousStreamHash && row.streamHash), 'Backend security audit stream rows must include stream ids, checksums, sequence proof, and hash-chain links.');
assert(response.body.securityAuditStream.storage?.type === 'file-store-append-log', 'Backend security audit stream must use the file-store append log sink.');
assert(response.body.securityAuditStream.storage?.hashChain?.ready === true && response.body.securityAuditStream.storage?.hashChain?.latestStreamHash, 'Backend security audit stream storage must expose hash-chain metadata.');
assert(response.body.securityAuditStream.storage?.auditLogPath?.endsWith('store.json.security-audit.jsonl'), 'Backend security audit stream must expose the append log path.');
assert(response.body.securityAuditStream.storage?.migrationTable === 'security_audit_stream', 'Backend security audit stream must name its persistence migration table.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-boundary`,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 200 && response.body.securityBoundary.accessAudit?.count >= 8, 'Security boundary must summarize persisted access-audit decisions.');
assert(response.body.securityBoundary.accessAudit?.deniedCount >= 4, 'Security boundary must summarize denied access decisions.');
assert(response.body.securityBoundary.accessAudit?.stream?.count >= response.body.securityBoundary.accessAudit?.count, 'Security boundary must summarize backend audit stream decisions.');
assert(response.body.securityBoundary.accessAudit?.stream?.sequenceGapCount === 0, 'Security boundary must expose contiguous backend audit stream proof.');
assert(response.body.securityBoundary.accessAudit?.stream?.hashChainReady === true, 'Security boundary must expose verified audit-stream hash-chain proof.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/persistence-snapshot` });
assert(response.status === 200 && response.body.persistenceSnapshot?.schemaVersion === 'production-persistence-snapshot/v1', 'Project API must expose a production persistence snapshot contract.');
assert(response.body.persistenceSnapshot.integrity.status === 'ready', 'Production persistence snapshot must pass integrity checks for the acceptance project.');
for (const table of ['projects', 'project_membership_policies', 'project_membership_grants', 'project_messages', 'project_event_ledger', 'project_timeline_logs', 'project_tasks', 'agent_states', 'agent_submissions', 'evidence_searches', 'submission_reviews', 'security_access_audit', 'security_audit_stream', 'worker_runs', 'read_model_checkpoints']) {
  assert(response.body.persistenceSnapshot.recordCounts[table] > 0, `Production persistence snapshot must include ${table} records.`);
}
assert(response.body.persistenceSnapshot.recordsByTable.project_membership_policies.some((record) => record.data.revision === 1), 'Production persistence snapshot must include project membership policy rows.');
assert(response.body.persistenceSnapshot.recordsByTable.project_membership_grants.some((record) => record.data.role === 'agent-runtime-binding' && record.data.agentId === 'jobs'), 'Production persistence snapshot must include Agent runtime membership binding rows.');
assert(response.body.persistenceSnapshot.recordsByTable.agent_submissions.some((record) => record.data.artifactType === 'final-deliverable'), 'Production persistence snapshot must include final deliverable submission rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_searches.some((record) => record.data.evidenceJudgement === 'strong-evidence'), 'Production persistence snapshot must include evidence judgement rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_searches.some((record) => record.data.sourceSafetyReady === true), 'Production persistence snapshot must include evidence source-safety readiness rows.');
assert(response.body.persistenceSnapshot.recordsByTable.evidence_sources.some((record) => record.data.sourceSafetyLevel === 'safe' && record.data.sourceSafetySignals?.includes('source-safety-screened')), 'Production persistence snapshot must include source-level safety judgement rows.');
assert(response.body.persistenceSnapshot.recordsByTable.security_access_audit.some((record) => record.data.allowed === false), 'Production persistence snapshot must include denied access-audit rows.');
assert(response.body.persistenceSnapshot.recordsByTable.security_audit_stream.some((record) => record.data.allowed === false && record.data.streamChecksum), 'Production persistence snapshot must include denied backend audit-stream rows.');
assert(response.body.persistenceSnapshot.recordsByTable.security_audit_stream.every((record) => record.data.previousStreamHash && record.data.streamHash), 'Production persistence snapshot must include audit-stream hash-chain columns.');
assert(response.body.persistenceSnapshot.recordsByTable.provider_usage_ledger.some((record) => record.data.retryPolicyConfigured === true && record.data.circuitBreakerConfigured === true && record.data.retryAttemptCount >= 1), 'Production persistence snapshot must include provider retry/circuit-breaker ledger columns.');
assert(response.body.persistenceSnapshot.recordsByTable.worker_runs.every((record) => record.data.idempotencyKey && record.data.leaseKey && record.data.receiptChecksum && record.data.executionStatus), 'Production persistence snapshot must include worker idempotency, lease, execution receipt, and status columns.');
assert(response.body.persistenceSnapshot.recordsByTable.worker_runs.every((record) => record.data.maxAttempts >= 3 && typeof record.data.retryable === 'boolean' && typeof record.data.deadLettered === 'boolean'), 'Production persistence snapshot must include worker retry/dead-letter columns.');
assert(response.body.persistenceSnapshot.recordsByTable.read_model_checkpoints.some((record) => record.data.readModel === 'security-boundary'), 'Production persistence snapshot must include the security boundary read-model checkpoint.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/worker-queue`,
  body: {
    now: '2026-06-01T11:25:00.000Z',
    forceDue: true,
    forceProjectIds: [projectId],
    maxAgentsPerProject: team.length,
    maxProjects: 1,
  },
});
assert(response.status === 200 && response.body.workerQueueSnapshot?.schemaVersion === 'worker-queue-snapshot/v1', 'Project API must expose a worker queue snapshot contract.');
assert(response.body.workerQueueSnapshot.summary.projectQueuedCount >= 1, 'Worker queue snapshot must include queued project work when forced due.');
assert(response.body.workerQueueSnapshot.summary.agentQueuedCount >= team.length, 'Worker queue snapshot must include queued Agent work when forced due.');
assert(response.body.workerQueueSnapshot.retryPolicy?.schemaVersion === 'worker-queue-retry-policy/v1' && response.body.workerQueueSnapshot.deadLetterPolicy?.schemaVersion === 'worker-dead-letter-policy/v1', 'Worker queue snapshot must expose retry and dead-letter policies.');
assert(response.body.workerQueueSnapshot.agentQueue.every((row) => row.idempotencyKey && row.leaseKey && row.runApiPath === '/workers/agents/due' && row.retry?.schemaVersion === 'worker-retry-state/v1' && row.executionReceiptExpected === true), 'Agent worker queue rows must include idempotency, lease, retry, receipt, and worker route contract.');
assert(response.body.workerQueueSnapshot.executionReceipts.length >= 1 && response.body.workerQueueSnapshot.executionReceipts.every((receipt) => receipt.receiptChecksum && receipt.idempotencyKey && receipt.leaseKey), 'Worker queue snapshot must expose execution receipts for completed worker runs.');
assert(Array.isArray(response.body.workerQueueSnapshot.deadLetterQueue) && response.body.workerQueueSnapshot.summary.workerDeadLetterCount === response.body.workerQueueSnapshot.deadLetterQueue.length, 'Worker queue snapshot must expose dead-letter queue summary and rows.');

response = api.handle({
  method: 'POST',
  path: '/workers/queue-snapshot',
  body: {
    now: '2026-06-01T11:25:00.000Z',
    forceDue: true,
    forceProjectIds: [projectId],
    maxAgentsPerProject: team.length,
    maxProjects: 1,
  },
});
assert(response.status === 200 && response.body.workerQueueSnapshot?.projectQueue.some((row) => row.projectId === projectId), 'Global worker queue snapshot must include the acceptance project.');
assert(response.body.workerQueueSnapshot.summary.workerRunReceiptCount >= 1, 'Global worker queue snapshot must include worker execution receipt counts.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/worker-queue-adapter-plan` });
assert(response.status === 200 && response.body.workerQueueAdapterPlan?.schemaVersion === 'worker-queue-adapter-plan/v1', 'Project API must expose a worker queue adapter plan.');
assert(response.body.workerQueueAdapterPlan.status === 'ready-for-queue-adapter-pilot', 'Worker queue adapter plan must pass for the acceptance project.');
assert(response.body.workerQueueAdapterPlan.adapterContract?.methods?.includes('ackExecutionReceipt(workerExecutionReceipt)'), 'Worker queue adapter plan must include execution receipt acknowledgement.');
assert(response.body.workerQueueAdapterPlan.adapterContract?.methods?.includes('inspectSnapshotParity(workerQueueSnapshot, projectId)'), 'Worker queue adapter plan must include snapshot parity inspection.');
assert(response.body.workerQueueAdapterPlan.queuePlans?.some((plan) => plan.id === 'agent-work' && plan.dueCount >= team.length), 'Worker queue adapter plan must include the Agent worker queue.');
assert(response.body.workerQueueAdapterPlan.adapterStatus?.schemaVersion === 'worker-queue-adapter-status/v1', 'Worker queue adapter plan must expose adapter driver status.');
assert(response.body.workerQueueAdapterPlan.adapterStatus.driver === 'local-shadow', 'Default worker queue adapter plan must use the local-shadow driver.');
assert(response.body.workerQueueAdapterPlan.adapterStatus.productionCutoverReady === false, 'Default worker queue adapter plan must not claim production queue cutover readiness.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/worker-queue-adapter-dry-run` });
assert(response.status === 200 && response.body.workerQueueAdapterDryRun?.schemaVersion === 'worker-queue-adapter-dry-run/v1', 'Project API must expose a worker queue adapter dry-run.');
assert(response.body.workerQueueAdapterDryRun.status === 'passed', 'Worker queue adapter dry-run must pass for the acceptance project.');
assert(response.body.workerQueueAdapterDryRun.gates.every((gate) => gate.passed), 'Worker queue adapter dry-run gates must all pass.');
assert(response.body.workerQueueAdapterDryRun.gates.some((gate) => gate.id === 'adapter-driver-status' && gate.passed), 'Worker queue adapter dry-run must prove adapter driver status.');
assert(response.body.workerQueueAdapterDryRun.gates.some((gate) => gate.id === 'adapter-execution-receipt' && gate.passed), 'Worker queue adapter dry-run must prove the adapter execution receipt.');
assert(response.body.workerQueueAdapterDryRun.gates.some((gate) => gate.id === 'snapshot-parity' && gate.passed), 'Worker queue adapter dry-run must prove queue snapshot parity.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution?.schemaVersion === 'worker-queue-adapter-shadow-execution/v1', 'Worker queue adapter dry-run must expose the shadow adapter execution record.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.adapterStatus?.driver === 'local-shadow', 'Worker queue adapter dry-run must expose the local-shadow queue adapter driver.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.adapterStatus.productionCutoverReady === false, 'Worker queue adapter dry-run must keep production queue cutover blocked until a real adapter runs.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.finalReceipt?.schemaVersion === 'worker-queue-adapter-execution-receipt/v1', 'Worker queue adapter dry-run must expose a final queue adapter execution receipt.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.snapshotParityReceipt?.schemaVersion === 'worker-queue-adapter-snapshot-parity/v1', 'Worker queue adapter dry-run must expose a snapshot parity receipt.');
assert(response.body.workerQueueAdapterDryRun.adapterExecution.snapshotParityReceipt?.parityReady === true, 'Worker queue adapter snapshot parity receipt must pass.');
assert(response.body.workerQueueAdapterDryRun.summary.adapterOperationCount >= team.length + 4, 'Worker queue adapter dry-run summary must expose executed queue adapter operations.');
assert(response.body.workerQueueAdapterDryRun.summary.adapterQueueRowCount >= team.length, 'Worker queue adapter dry-run summary must expose imported queue row coverage.');
assert(response.body.workerQueueAdapterDryRun.summary.snapshotParityReady === true, 'Worker queue adapter dry-run summary must expose snapshot parity readiness.');
assert(response.body.workerQueueAdapterDryRun.summary.snapshotLeaseParityReady === true, 'Worker queue adapter dry-run summary must expose lease parity readiness.');
assert(response.body.workerQueueAdapterDryRun.summary.snapshotDeadLetterParityReady === true, 'Worker queue adapter dry-run summary must expose dead-letter parity readiness.');
assert(response.body.workerQueueAdapterDryRun.summary.adapterDriver === 'local-shadow', 'Worker queue adapter dry-run summary must expose the active queue adapter driver.');
assert(response.body.workerQueueAdapterDryRun.summary.adapterProductionCutoverReady === false, 'Worker queue adapter dry-run summary must not claim production queue cutover readiness for local shadow runs.');
assert(response.body.workerQueueAdapterDryRun.summary.dispatchCount >= team.length && response.body.workerQueueAdapterDryRun.summary.leaseAcquisitionCount >= team.length, 'Worker queue adapter dry-run must simulate dispatch and lease acquisition.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
const graph = response.body;
const submissionNodes = graph.nodes.filter((node) => node.category === 'submission' && node.source === 'agentSubmissions');
const evidenceNodes = graph.nodes.filter((node) => node.category === 'evidence' && node.source === 'evidenceSearches');
const reviewNodes = graph.nodes.filter((node) => node.category === 'review' && node.source === 'submissionReviews');
const selfMarketingNodes = graph.nodes.filter((node) => node.category === 'self-marketing');
const roleClarificationNodes = graph.nodes.filter((node) => node.subtype === 'role-clarification');
const revisionEdges = graph.edges.filter((edge) => edge.type === 'revision');
const graphTypes = new Set(submissionNodes.map((node) => node.subtype));
for (const type of ['brainstorm-board', 'evidence-packet', 'product-brief', 'risk-review', 'revision-note', 'final-deliverable']) {
  assert(graphTypes.has(type), `Manager Flow Graph must include ${type} submission node.`);
}
assert(roleClarificationNodes.length > 0 && roleClarificationNodes.every((node) => node.proofIds.length && node.eventIds.length && node.attachments.length), 'Manager Flow Graph must include proofed role-clarification nodes.');
assert(selfMarketingNodes.some((node) => node.subtype === 'role-self-nomination'), 'Manager Flow Graph must include role self-nomination self-marketing nodes.');
assert(selfMarketingNodes.some((node) => node.subtype === 'leader-campaign'), 'Manager Flow Graph must include Leader campaign self-marketing nodes.');
assert(selfMarketingNodes.every((node) => node.proofIds.length && node.eventIds.length && node.attachments.length), 'Every self-marketing node must have transcript, event, and attachment proof.');
assert(submissionNodes.every((node) => node.proofIds.length && node.timelineLogIds.length && node.eventIds.length && node.attachments.length), 'Every explicit submission node must have chat, timeline, event, and artifact proof.');
assert(revisionEdges.length >= 3 && revisionEdges.every((edge) => edge.proofIds.length && edge.timelineLogIds.length && edge.eventIds.length), 'Manager Flow Graph must include proofed revision lineage edges.');
assert(evidenceNodes.length === 1 && evidenceNodes.every((node) => node.proofIds.length && node.timelineLogIds.length && node.eventIds.length && node.attachments.length), 'Manager Flow Graph must include proofed evidence-search nodes.');
const evidenceSourceAttachments = evidenceNodes[0].attachments.filter((attachment) => attachment.source === 'evidenceSearches');
assert(evidenceNodes[0].summary.includes('strong-evidence') && evidenceSourceAttachments.every((attachment) => attachment.qualityScore > 0 && attachment.qualityLevel), 'Manager Flow Graph evidence node must expose source quality judgement.');
assert(evidenceNodes[0].sourceSafetySummary?.sourceSafetyReady === true && evidenceNodes[0].sourceSafetySummary?.blockedSourceCount === 0 && evidenceSourceAttachments.every((attachment) => attachment.sourceSafetyLevel === 'safe' && attachment.sourceSafetySignals?.includes('source-safety-screened')), 'Manager Flow Graph evidence node must expose source-safety judgement.');
assert(reviewNodes.length === 2 && reviewNodes.every((node) => node.proofIds.length && node.timelineLogIds.length && node.eventIds.length && node.attachments.length), 'Manager Flow Graph must include proofed submission-review nodes.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assert(response.status === 200 && response.body.submissionSummary.count === submissionPlan.length, 'Readiness Proof Map must summarize Agent submissions.');
assert(response.body.roleNegotiationSummary.roleClarificationCount > 0 && response.body.roleNegotiationSummary.selfNominationCount > 0, 'Readiness Proof Map must expose role-negotiation routes.');
assert(response.body.selfMarketingSummary.selfNominationCount > 0 && response.body.selfMarketingSummary.leaderCampaignCount > 0, 'Readiness Proof Map must expose self-marketing routes.');
assert(response.body.selfMarketingRoutes.every((route) => route.proofIds.length && route.eventIds.length && route.apiPath), 'Self-marketing proof routes must include transcript and event proof.');
assert(response.body.revisionSummary.count >= 2 && response.body.revisionSummary.respondedReviewIds.includes(reviewsByVerdict.get('changes-requested')?.id), 'Readiness Proof Map must summarize artifact revision lineage.');
assert(response.body.revisionRoutes.every((route) => route.proofIds.length && route.timelineLogIds.length && route.eventIds.length && route.apiPath), 'Revision proof routes must include chat, timeline, event, and API proof.');
assert(response.body.submissionRoutes.some((route) => route.artifactType === 'final-deliverable'), 'Readiness Proof Map must expose final deliverable submission route.');
assert(response.body.evidenceSearchSummary.count === 1 && response.body.evidenceSearchSummary.averageQualityScore >= 70 && response.body.evidenceSearchRoutes.some((route) => route.sourceCount === 3 && route.evidenceJudgement === 'strong-evidence'), 'Readiness Proof Map must expose evidence search routes and quality judgement.');
assert(response.body.evidenceSearchSummary.sourceSafetyReadyCount === 1 && response.body.evidenceSearchSummary.sourceSafetyBlockedSourceCount === 0 && response.body.evidenceSearchRoutes.some((route) => route.sourceSafetySummary?.sourceSafetyReady), 'Readiness Proof Map must expose source-safety routes and summary.');
assert(response.body.submissionReviewSummary.acceptedCount === 1 && response.body.submissionReviewRoutes.some((route) => route.verdict === 'changes-requested'), 'Readiness Proof Map must expose submission review routes.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/tasks/task_brief/evidence` });
assert(response.status === 200 && response.body.submissions.some((submission) => submission.artifactType === 'final-deliverable'), 'Task evidence must include linked Agent submissions.');
assert(response.body.submissionReviews.some((review) => review.verdict === 'accepted'), 'Task evidence must include linked submission reviews.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/tasks/task_evidence/evidence` });
assert(response.status === 200 && response.body.evidenceSearches.some((record) => record.id === evidenceSearch.id), 'Task evidence must include linked evidence searches.');
assert(response.body.evidenceSearches.some((record) => record.qualitySummary?.judgement === 'strong-evidence'), 'Task evidence must preserve evidence quality judgement.');
assert(response.body.evidenceSearches.some((record) => record.sourceSafetySummary?.sourceSafetyReady), 'Task evidence must preserve source-safety judgement.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agents/jobs/dashboard` });
assert(response.status === 200 && response.body.ownedSubmissions.some((submission) => submission.artifactType === 'final-deliverable'), 'Agent Dashboard must expose owned submissions.');
assert(response.body.ownedSubmissionReviews.some((review) => review.verdict === 'accepted'), 'Agent Dashboard must expose submission reviews relevant to the Agent.');
assert(response.body.obligations.some((obligation) => (
  obligation.reviewId === reviewsByVerdict.get('changes-requested')?.id
  && obligation.status === 'resolved'
  && obligation.resolvedBySubmissionId === finalDeliverable?.id
)), 'Original submitter obligation must be resolved by the linked revision/final deliverable.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/agents/curie/dashboard` });
assert(response.status === 200 && response.body.ownedEvidenceSearches.some((record) => record.id === evidenceSearch.id), 'Agent Dashboard must expose owned evidence searches.');
assert(response.body.ownedSubmissionReviews.some((review) => review.verdict === 'changes-requested'), 'Reviewer Agent Dashboard must expose completed reviews.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/transcripts/main` });
assert(response.status === 200 && response.body.messages.some((message) => message.type === 'submission'), 'Group Chat transcript must include submission messages.');
assert(response.body.messages.some((message) => message.type === 'evidence-search'), 'Group Chat transcript must include evidence-search messages.');
assert(response.body.messages.some((message) => message.type === 'submission-review'), 'Group Chat transcript must include submission-review messages.');

response = api.handle({ method: 'GET', path: `/projects/${projectId}/events` });
assert(response.status === 200 && response.body.eventLedger.filter((event) => event.type === 'agent-submission').length >= submissionPlan.length, 'Event ledger must include Agent submission events.');
assert(response.body.eventLedger.some((event) => event.type === 'evidence-search'), 'Event ledger must include evidence-search events.');
assert(response.body.eventLedger.filter((event) => event.type === 'submission-review').length >= 2, 'Event ledger must include submission-review events.');
assert(response.body.eventLedger.filter((event) => event.type === 'security-access').length >= 6, 'Event ledger must include security access audit events.');
assert(response.body.eventLedger.some((event) => event.type === 'provider-usage'), 'Event ledger must include provider usage audit events.');

const httpServer = createAgentProjectHttpServer({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  autonomousScheduler: {
    intervalMs: 1_000,
  },
});
const httpRuntime = await httpServer.listen();
try {
  let httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/status`);
  let httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.scheduler.enabled === false, 'Product-team HTTP backend must expose scheduler status before start.');

  httpResponse = await fetch(`${httpRuntime.url}/workers/autonomous/tick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-01T11:30:00.000Z',
      trigger: 'product-team-http-scheduler-tick',
      source: 'product-team-http-scheduler-chat',
      forceProjectRun: true,
      forceProjectIds: [projectId],
      forceAgentRun: true,
      forceAgentProjectIds: [projectId],
      maxAgentProjects: 1,
      maxAgentsPerProject: team.length,
      agentTrigger: 'product-team-http-scheduler-tick-agents',
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.skipped === false, 'Product-team HTTP scheduler tick must run through the real backend server.');
  assert(httpBody.result.processed.some((item) => item.projectId === projectId), 'Product-team HTTP scheduler tick must process the acceptance project.');
  assert(httpBody.result.agentProcessed.some((item) => item.projectId === projectId), 'Product-team HTTP scheduler tick must process due Agent work for the acceptance project.');
  assert(httpBody.result.processed.some((item) => item.managerDashboard?.operationsBoard?.latestProjectCycle?.trigger === 'product-team-http-scheduler-tick'), 'HTTP processed project rows must include Manager Dashboard operations evidence.');
  assert(httpBody.result.agentProcessed.some((item) => item.managerReadyPackage?.operationsBoard?.agents?.length > 0), 'HTTP processed Agent rows must include Manager Ready Package Agent evidence.');
  assert(httpBody.status.tickCount >= 1 && httpBody.status.agentProcessedCount >= 1, 'Product-team HTTP scheduler tick must update project and Agent scheduler counters.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-dashboard`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.operationsBoard.latestProjectCycle?.trigger === 'product-team-http-scheduler-tick', 'HTTP Manager Dashboard must expose the scheduler-produced project cycle.');
  assert(httpBody.continuousWorkLoop.proofedAgentCount > 0, 'HTTP Manager Dashboard must expose proofed continuous Agent work after scheduler tick.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-ready-package`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.operationsBoard.latestProjectCycle?.trigger === 'product-team-http-scheduler-tick', 'HTTP Manager Ready Package must expose scheduler-produced operations evidence.');
  assert(httpBody.mvpReadiness?.readyForLocalPilot && httpBody.mvpReadiness?.production?.status === 'production-blocked', 'HTTP Manager Ready Package must expose local-pilot readiness without overclaiming production readiness.');
  assert(httpBody.providerReadiness?.status === 'local-provider-contract-ready' && httpBody.providerReadiness?.readyForProduction === false, 'HTTP Manager Ready Package must expose provider readiness without overclaiming production readiness.');
  assert(httpBody.securityBoundary?.status === 'local-boundary-ready' && httpBody.securityBoundary?.redactionScan?.rawLeakCount === 0, 'HTTP Manager Ready Package must expose a clean local security boundary.');
  assert(httpBody.persistenceAdapterPlan?.schemaVersion === 'managed-persistence-adapter-plan/v1' && httpBody.persistenceAdapterDryRun?.schemaVersion === 'managed-persistence-adapter-dry-run/v1', 'HTTP Manager Ready Package must expose managed persistence adapter plan and dry-run readiness.');
  assert(httpBody.operationsReadiness?.summary?.workerRecoveryContractReady === true, 'HTTP Manager Ready Package must expose worker recovery readiness.');
  assert(httpBody.pilotLaunchReadiness?.schemaVersion === 'pilot-launch-readiness/v1' && httpBody.pilotLaunchReadiness?.productionDecision === 'no-go', 'HTTP Manager Ready Package must expose pilot launch readiness without production overclaim.');
  assert(httpBody.deploymentPreflight?.schemaVersion === 'deployment-preflight/v1' && httpBody.deploymentPreflight?.productionDeploymentReady === false, 'HTTP Manager Ready Package must expose deployment preflight without production overclaim.');
  assert(httpBody.adapterGatewayPreflight?.schemaVersion === 'adapter-gateway-preflight/v1' && httpBody.adapterGatewayPreflight?.productionCutoverReady === false, 'HTTP Manager Ready Package must expose adapter gateway preflight without production overclaim.');
  assert(httpBody.summary?.adapterGatewayPreflightStatus === httpBody.adapterGatewayPreflight?.status, 'HTTP Manager Ready Package summary must expose adapter gateway preflight status.');
  assert(httpBody.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1' && httpBody.launchApprovalWorkflow?.readyForProduction === false, 'HTTP Manager Ready Package must expose launch approval workflow without production overclaim.');
  assert(httpBody.productionLaunchAudit?.schemaVersion === 'production-launch-audit/v1' && httpBody.productionLaunchAudit?.productionDecision === 'no-go', 'HTTP Manager Ready Package must expose production launch audit without production overclaim.');
  assert(['go', 'no-go'].includes(httpBody.productionLaunchAudit?.privatePilotDecision) && httpBody.productionLaunchAudit?.readyForProduction === false, 'HTTP Manager Ready Package must expose launch audit status without claiming production readiness.');
  assert(httpBody.projectEvidenceArchive?.schemaVersion === 'project-evidence-archive/v1' && httpBody.projectEvidenceArchive?.readyForProduction === false, 'HTTP Manager Ready Package must expose the project evidence archive without production overclaim.');
  assert(httpBody.projectEvidenceArchive?.summary?.rawLeakCount === 0 && httpBody.summary?.projectEvidenceArchiveStatus === httpBody.projectEvidenceArchive?.status, 'HTTP Manager Ready Package summary must expose archive status and zero raw leaks.');
  assert(httpBody.workerQueueAdapterPlan?.schemaVersion === 'worker-queue-adapter-plan/v1' && httpBody.workerQueueAdapterDryRun?.status === 'passed', 'HTTP Manager Ready Package must expose queue adapter plan and dry-run readiness.');
  assert(httpBody.summary?.workerExecutionReceiptCount >= 1 && httpBody.summary?.workerDeadLetterCount === 0, 'HTTP Manager Ready Package summary must expose worker receipt and dead-letter counts.');
  assert(httpBody.summary?.queueAdapterDryRunStatus === 'passed' && httpBody.summary?.queueAdapterDispatchCount >= 1, 'HTTP Manager Ready Package summary must expose queue adapter dry-run status.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/pilot-launch-readiness`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.pilotLaunchReadiness?.schemaVersion === 'pilot-launch-readiness/v1', 'HTTP pilot launch readiness endpoint must expose the launch contract.');
  assert(['go', 'no-go'].includes(httpBody.pilotLaunchReadiness?.privatePilotDecision), 'HTTP pilot launch readiness must expose a private-pilot decision.');
  assert(httpBody.pilotLaunchReadiness?.productionDecision === 'no-go', 'HTTP pilot launch readiness must keep production launch blocked.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/deployment-preflight`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.deploymentPreflight?.schemaVersion === 'deployment-preflight/v1', 'HTTP deployment preflight endpoint must expose the deployment contract.');
  assert(httpBody.deploymentPreflight?.productionDeploymentReady === false, 'HTTP deployment preflight must keep production deployment blocked.');
  assert(httpBody.deploymentPreflight?.backendRoutes?.adapterGatewayPreflight?.endsWith('/adapter-gateway-preflight'), 'HTTP deployment preflight must expose the adapter gateway preflight route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/adapter-gateway-preflight`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.adapterGatewayPreflight?.schemaVersion === 'adapter-gateway-preflight/v1', 'HTTP adapter gateway preflight endpoint must expose the gateway preflight contract.');
  assert(httpBody.adapterGatewayPreflight?.privateGatewayReady === true, 'HTTP adapter gateway preflight must pass the local-shadow private rehearsal path.');
  assert(httpBody.adapterGatewayPreflight?.productionCutoverReady === false, 'HTTP adapter gateway preflight must keep production cutover blocked.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/project-evidence-archive`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.projectEvidenceArchive?.schemaVersion === 'project-evidence-archive/v1', 'HTTP project evidence archive endpoint must expose the archive contract.');
  assert(httpBody.projectEvidenceArchive?.summary?.finalDeliverableCount >= 1, 'HTTP project evidence archive must include final deliverable evidence.');
  assert(httpBody.projectEvidenceArchive?.summary?.rawLeakCount === 0, 'HTTP project evidence archive must keep redaction clean.');
  assert(httpBody.projectEvidenceArchive?.backendRoutes?.projectEvidenceArchive?.endsWith('/project-evidence-archive'), 'HTTP project evidence archive must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/project-evidence-exports`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.projectEvidenceExportWorkflow?.schemaVersion === 'project-evidence-export-workflow/v1', 'HTTP project evidence export workflow endpoint must expose the export governance contract.');
  assert(httpBody.projectEvidenceExportWorkflow?.readyForProductionExport === false, 'HTTP project evidence export workflow must keep production export blocked.');
  assert(httpBody.projectEvidenceExportWorkflow?.backendRoutes?.projectEvidenceExports?.endsWith('/project-evidence-exports'), 'HTTP project evidence export workflow must expose its own route.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/launch-approvals`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1', 'HTTP launch approvals endpoint must expose the approval workflow contract.');
  assert(httpBody.launchApprovalWorkflow?.readyForProduction === false, 'HTTP launch approvals endpoint must not claim production approval readiness.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/production-launch-audit`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.productionLaunchAudit?.schemaVersion === 'production-launch-audit/v1', 'HTTP production launch audit endpoint must expose the audit contract.');
  assert(['go', 'no-go'].includes(httpBody.productionLaunchAudit?.privatePilotDecision), 'HTTP production launch audit must expose a private-pilot decision.');
  assert(httpBody.productionLaunchAudit?.productionDecision === 'no-go', 'HTTP production launch audit must keep public production blocked.');
  assert(httpBody.productionLaunchAudit?.summary?.failedProductionGateCount > 0, 'HTTP production launch audit must keep failed production gates visible.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/mvp-readiness`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.mvpReadiness?.summary?.schedulerProofedAgentCount > 0, 'HTTP MVP readiness endpoint must include scheduler-produced Agent proof.');
  assert(httpBody.mvpReadiness?.nextShortestPath?.scope === 'production-hardening', 'HTTP MVP readiness must point to production hardening after core acceptance passes.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/security-boundary`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.securityBoundary?.schemaVersion === 'security-boundary/v1', 'HTTP security boundary endpoint must expose the security contract.');
  assert(httpBody.securityBoundary?.routeSummary?.routeKeys?.includes('security-boundary'), 'HTTP security boundary route manifest must include itself.');
  assert(httpBody.securityBoundary?.redactionScan?.status === 'ready' && httpBody.securityBoundary?.providerBoundary?.exposedSecrets === false, 'HTTP security boundary must preserve redaction guarantees.');
  assert(httpBody.securityBoundary?.accessControl?.status === 'enforceable-prototype-policy', 'HTTP security boundary must expose the access-control policy contract.');
  assert(httpBody.securityBoundary?.secretVault?.ready === true, 'HTTP security boundary must expose local secret-vault readiness.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/provider-readiness`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.providerReadiness?.schemaVersion === 'provider-readiness/v1', 'HTTP provider readiness endpoint must expose the provider rollout contract.');
  assert(httpBody.providerReadiness?.status === 'local-provider-contract-ready', 'HTTP provider readiness endpoint must pass local provider gates.');
  assert(httpBody.providerReadiness?.providerControlPolicy?.enforcementEnabled === true, 'HTTP provider readiness must expose enforced provider policy.');
  assert(httpBody.providerReadiness?.providerUsage?.count >= 1, 'HTTP provider readiness must expose provider usage audit rows.');
  assert(httpBody.providerReadiness?.providerBoundaries?.evidence?.sourceSafetySummary?.sourceSafetyReady === true, 'HTTP provider readiness must expose source-safety summary.');
  assert(httpBody.providerReadiness?.providerBoundaries?.failureControl?.ready === true, 'HTTP provider readiness must expose provider failure-control summary.');
  assert(httpBody.providerReadiness?.providerBoundaries?.secretVault?.ready === true, 'HTTP provider readiness must expose provider secret-vault summary.');
  assert(httpBody.providerReadiness?.requiredProductionControls?.some((control) => control.id === 'encrypted-secret-vault' && control.status === 'local-control-ready'), 'HTTP provider readiness must expose encrypted secret vault as a local control.');
  assert(!JSON.stringify(httpBody.providerReadiness).includes(FAKE_SEARCH_SECRET), 'HTTP provider readiness must not expose the search secret fixture.');
  assert(!JSON.stringify(httpBody.providerReadiness).includes(FAKE_MODEL_SECRET), 'HTTP provider readiness must not expose the model secret fixture.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/security-boundary`, {
    headers: enforcedObserverHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 403 && httpBody.accessDecision?.route?.routeKey === 'security-boundary', 'HTTP enforced mode must reject observer security-boundary access.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/agents/jobs/dashboard`, {
    headers: enforcedJobsAgentHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.agentId === 'jobs', 'HTTP enforced mode must allow an Agent to read its own dashboard.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/agents/curie/dashboard`, {
    headers: enforcedJobsAgentHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 403 && httpBody.accessDecision?.route?.routeKey === 'agent-read', 'HTTP enforced mode must reject cross-Agent dashboard access.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/security-access-audit`, {
    headers: enforcedSecurityHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.securityAccessAudit?.count >= 10, 'HTTP security access audit endpoint must expose persisted access decisions.');
  assert(httpBody.securityAccessAudit?.deniedCount >= 5, 'HTTP security access audit endpoint must include denied access decisions.');
  assert(httpBody.securityAccessAudit?.eventIds?.length >= httpBody.securityAccessAudit?.count, 'HTTP security access audit rows must link to event-ledger proof.');
  assert(httpBody.securityAccessAudit?.stream?.count >= httpBody.securityAccessAudit?.count, 'HTTP security access audit endpoint must expose backend audit stream summary.');
  assert(httpBody.securityAccessAudit?.stream?.sequenceGapCount === 0, 'HTTP security access audit endpoint must preserve contiguous backend audit stream proof.');
  assert(httpBody.securityAccessAudit?.stream?.hashChainReady === true, 'HTTP security access audit endpoint must preserve backend audit hash-chain proof.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/security-audit-stream`, {
    headers: enforcedSecurityHeaders,
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.securityAuditStream?.schemaVersion === 'security-audit-stream/v1', 'HTTP security audit stream endpoint must expose the backend audit stream contract.');
  assert(httpBody.securityAuditStream?.count >= 11, 'HTTP security audit stream endpoint must expose persisted access decisions.');
  assert(httpBody.securityAuditStream?.deniedCount >= 5, 'HTTP security audit stream endpoint must include denied decisions.');
  assert(httpBody.securityAuditStream?.sequenceGapCount === 0, 'HTTP security audit stream endpoint must preserve contiguous append order.');
  assert(httpBody.securityAuditStream?.hashChainReady === true && httpBody.securityAuditStream?.chainBreakCount === 0 && httpBody.securityAuditStream?.hashMismatchCount === 0, 'HTTP security audit stream endpoint must expose a verified hash chain.');
  assert(httpBody.securityAuditStream?.rows?.every((row) => row.streamRecordId && row.streamChecksum && row.streamSequence && row.previousStreamHash && row.streamHash), 'HTTP security audit stream rows must include stream ids, checksums, sequence proof, and hash-chain links.');
  assert(httpBody.securityAuditStream?.storage?.type === 'file-store-append-log', 'HTTP security audit stream endpoint must use the file-store append log sink.');
  assert(httpBody.securityAuditStream?.storage?.hashChain?.ready === true, 'HTTP security audit stream storage must expose hash-chain metadata.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/persistence-snapshot`);
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.persistenceSnapshot?.integrity?.status === 'ready', 'HTTP persistence snapshot endpoint must expose a ready normalized persistence contract.');
  assert(httpBody.persistenceSnapshot.recordCounts.worker_runs > 0 && httpBody.persistenceSnapshot.recordCounts.read_model_checkpoints > 0, 'HTTP persistence snapshot must include worker and read-model checkpoint rows.');
  assert(httpBody.persistenceSnapshot.recordCounts.security_access_audit > 0, 'HTTP persistence snapshot must include security access audit rows.');
  assert(httpBody.persistenceSnapshot.recordCounts.security_audit_stream > 0, 'HTTP persistence snapshot must include backend security audit stream rows.');
  assert(httpBody.persistenceSnapshot.recordCounts.provider_usage_ledger > 0, 'HTTP persistence snapshot must include provider usage ledger rows.');

  httpResponse = await fetch(`${httpRuntime.url}/workers/queue-snapshot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-01T11:35:00.000Z',
      forceDue: true,
      forceProjectIds: [projectId],
      maxAgentsPerProject: team.length,
      maxProjects: 1,
    }),
  });
  httpBody = await httpResponse.json();
  assert(httpResponse.status === 200 && httpBody.workerQueueSnapshot?.summary?.agentQueuedCount >= team.length, 'HTTP worker queue snapshot must expose forced due Agent queue rows.');
  assert(httpBody.workerQueueSnapshot.agentQueue.every((row) => row.idempotencyKey && row.leaseKey && row.retry?.schemaVersion === 'worker-retry-state/v1'), 'HTTP worker queue snapshot rows must include idempotency, lease, and retry keys.');
  assert(httpBody.workerQueueSnapshot.deadLetterPolicy?.schemaVersion === 'worker-dead-letter-policy/v1' && httpBody.workerQueueSnapshot.executionReceipts?.length >= 1, 'HTTP worker queue snapshot must expose dead-letter policy and execution receipts.');

  httpResponse = await fetch(`${httpRuntime.url}/projects/${projectId}/manager-flow-graph`);
  httpBody = await httpResponse.json();
  assert(
    httpResponse.status === 200
    && httpBody.nodes.some((node) => (
      node.category === 'monitoring'
      && (node.eventIds?.length || node.timelineLogIds?.length)
    )),
    'HTTP Manager Flow Graph must expose scheduler/runtime monitoring proof nodes.',
  );
} finally {
  await httpServer.close();
}

const signedApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
  },
});
const signedSecurityPath = `/projects/${projectId}/security-boundary`;
response = signedApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: enforcedSecurityHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-missing', 'Signed access mode must reject unsigned enforced requests when a signing secret is configured.');
response = signedApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: signedHeadersFor({ method: 'GET', path: signedSecurityPath }),
});
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Signed access mode must allow valid signed security-admin requests.');
const tamperedSignedHeaders = signedHeadersFor({ method: 'GET', path: signedSecurityPath });
tamperedSignedHeaders['x-hofs-role'] = 'observer';
response = signedApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: tamperedSignedHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-invalid', 'Signed access mode must reject tampered identity headers before role policy evaluation.');

const replayApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireSignedRequestIds: true,
  },
});
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: signedHeadersFor({ method: 'GET', path: signedSecurityPath }),
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-request-id-missing', 'Replay protection must require a signed request id.');
const replayHeaders = signedHeadersFor({
  method: 'GET',
  path: signedSecurityPath,
  requestId: 'product-team-replay-once-security-boundary',
});
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: replayHeaders,
});
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Replay protection must allow the first use of a signed request id.');
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: replayHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-replay-detected', 'Replay protection must reject reuse of the same signed request id.');
const persistentReplayHeaders = signedHeadersFor({
  method: 'GET',
  path: signedSecurityPath,
  requestId: 'product-team-persistent-replay-security-boundary',
});
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: persistentReplayHeaders,
});
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Persistent replay protection must allow the first use of a new signed request id.');
const restartedReplayApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireSignedRequestIds: true,
  },
});
response = restartedReplayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: persistentReplayHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-replay-detected', 'Replay protection must reject reused request ids after a file-backed backend restart.');
assert(response.body.accessDecision?.replay?.storage === 'file-store', 'Replay protection must report file-backed storage for restarted API checks.');
assert(restartedReplayApi.store.snapshot().accessReplayRecords.some((record) => record.requestId === 'product-team-persistent-replay-security-boundary'), 'File-backed store must persist signed request replay records.');
response = replayApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-access-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/security-access-audit`,
    role: 'security-admin',
    userId: 'security-lead',
    requestId: 'product-team-replay-audit-read',
  }),
});
assert(response.status === 200 && response.body.securityAccessAudit?.rows?.some((row) => row.replay?.detected === true), 'Security access audit must persist replay-denied decisions.');

const auditFailClosedApi = createAgentProjectApi({
  service: {
    recordAccessDecision() {
      throw new Error('audit-sink-offline');
    },
  },
  accessControl: {
    failClosedOnAuditError: true,
  },
});
response = auditFailClosedApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-dashboard`,
  headers: enforcedManagerHeaders,
});
assert(response.status === 503 && response.body.error === 'access-audit-write-failed', 'Audit fail-closed mode must reject allowed project access when audit write fails.');
assert(response.body.accessDecision?.audit?.written === false && response.body.accessDecision?.audit?.reason === 'access-audit-write-failed', 'Audit fail-closed response must explain the audit write failure.');

const signedHttpServer = createAgentProjectHttpServer({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireSignedRequestIds: true,
  },
  autonomousScheduler: {
    intervalMs: 1_000,
  },
});
const signedHttpRuntime = await signedHttpServer.listen();
try {
  let signedHttpResponse = await fetch(`${signedHttpRuntime.url}${signedSecurityPath}`, {
    headers: enforcedSecurityHeaders,
  });
  let signedHttpBody = await signedHttpResponse.json();
  assert(signedHttpResponse.status === 403 && signedHttpBody.accessDecision?.reason === 'signed-access-missing', 'HTTP signed access mode must reject unsigned enforced requests.');

  signedHttpResponse = await fetch(`${signedHttpRuntime.url}${signedSecurityPath}`, {
    headers: signedHeadersFor({
      method: 'GET',
      path: signedSecurityPath,
      requestId: 'product-team-signed-http-security-boundary',
    }),
  });
  signedHttpBody = await signedHttpResponse.json();
  assert(signedHttpResponse.status === 200 && signedHttpBody.securityBoundary?.schemaVersion === 'security-boundary/v1', 'HTTP signed access mode must allow valid signed security-admin requests.');

  signedHttpResponse = await fetch(`${signedHttpRuntime.url}/workers/autonomous/tick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-01T11:40:00.000Z',
      trigger: 'product-team-signed-http-scheduler-tick',
      source: 'product-team-signed-http-scheduler-chat',
      forceProjectRun: true,
      forceProjectIds: [projectId],
      forceAgentRun: true,
      forceAgentProjectIds: [projectId],
      maxAgentProjects: 1,
      maxAgentsPerProject: team.length,
      agentTrigger: 'product-team-signed-http-scheduler-tick-agents',
    }),
  });
  signedHttpBody = await signedHttpResponse.json();
  assert(signedHttpResponse.status === 200 && signedHttpBody.skipped === false, 'HTTP scheduler must sign its internal worker calls when access signing is enabled.');
  assert(signedHttpBody.result.processed.some((item) => item.projectId === projectId), 'Signed HTTP scheduler tick must process the acceptance project.');
} finally {
  await signedHttpServer.close();
}

const membershipApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  projectRuntime,
  llmProvider: modelProvider,
  searchProvider,
  providerPolicy,
  secretVault,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireProjectMembership: true,
  },
});
const membershipManagerPath = `/projects/${projectId}/manager-dashboard`;
response = membershipApi.handle({
  method: 'GET',
  path: membershipManagerPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipManagerPath,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.projectId === projectId, 'Project membership policy must allow the signed project manager.');
response = membershipApi.handle({
  method: 'GET',
  path: membershipManagerPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipManagerPath,
    role: 'manager',
    userId: 'outside-manager',
  }),
});
assert(response.status === 403 && response.body.accessDecision?.membership?.reason === 'project-membership-mismatch', 'Project membership policy must reject a signed manager outside the project.');

const membershipProviderReadinessPath = `/projects/${projectId}/provider-readiness`;
response = membershipApi.handle({
  method: 'GET',
  path: membershipProviderReadinessPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipProviderReadinessPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.providerReadiness?.schemaVersion === 'provider-readiness/v1', 'Project membership policy must allow security admin provider readiness reads.');

const identitySessionsPath = `/projects/${projectId}/identity-sessions`;
response = membershipApi.handle({
  method: 'POST',
  path: identitySessionsPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: identitySessionsPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    role: 'manager',
    userId: 'director',
    issuerRole: 'manager',
    issuerId: 'director',
    ttlMs: 60 * 60 * 1000,
    scope: ['project', 'manager-dashboard'],
    source: 'product-team-acceptance-identity-session',
  },
});
assert(response.status === 200 && response.body.identitySession?.schemaVersion === 'identity-session/v1', 'Project API must issue a local identity-session record.');
assert(response.body.tokenContract?.schemaVersion === 'identity-session-token/v1' && response.body.tokenContract.returnedOnce === true && response.body.tokenContract.header === 'x-hofs-session-token', 'Identity-session issuance must return the one-time token contract.');
assert(response.body.token && response.body.token.startsWith('hofs_sess_'), 'Identity-session issuance must return a bearer token once.');
const managerIdentitySessionToken = response.body.token;
const managerIdentitySessionId = response.body.identitySession.id;
assert(response.body.identitySession.status === 'active' && response.body.identitySession.tokenHash !== managerIdentitySessionToken, 'Identity-session response must expose only public token-hash proof, never the raw token as session data.');
assert(!JSON.stringify(response.body.project).includes(managerIdentitySessionToken), 'Persisted project state returned by the API must not include the raw identity-session token.');
assert(response.body.project.eventLedger.some((event) => event.type === 'identity-session-issued' && event.entityIds?.identitySessionId === managerIdentitySessionId), 'Identity-session issuance must enter the project event ledger.');

response = membershipApi.handle({
  method: 'GET',
  path: identitySessionsPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: identitySessionsPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.identitySessions?.summary?.activeCount >= 1, 'Project API must list active local identity sessions.');
assert(response.body.identitySessions.rows.some((row) => row.id === managerIdentitySessionId && row.status === 'active'), 'Identity-session list must include the newly issued active session.');
assert(!JSON.stringify(response.body.identitySessions).includes(managerIdentitySessionToken), 'Identity-session list must not expose the raw session token.');

response = membershipApi.handle({
  method: 'GET',
  path: membershipManagerPath,
  headers: {
    'x-hofs-session-token': managerIdentitySessionToken,
  },
});
assert(response.status === 200 && response.body.projectId === projectId, 'Identity-session token must authorize the project manager without signed headers.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-access-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/security-access-audit`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.securityAccessAudit?.rows?.some((row) => row.identitySession?.verified === true && row.identitySession?.sessionId === managerIdentitySessionId), 'Security access audit must persist identity-session verified access decisions.');

const revokeIdentitySessionPath = `${identitySessionsPath}/${encodeURIComponent(managerIdentitySessionId)}/revoke`;
response = membershipApi.handle({
  method: 'POST',
  path: revokeIdentitySessionPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: revokeIdentitySessionPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    revokedBy: 'security-lead',
    reason: 'Acceptance harness proves revoked sessions fail closed.',
  },
});
assert(response.status === 200 && response.body.identitySession?.status === 'revoked', 'Project API must revoke local identity sessions.');
assert(response.body.project.eventLedger.some((event) => event.type === 'identity-session-revoked' && event.entityIds?.identitySessionId === managerIdentitySessionId), 'Identity-session revocation must enter the project event ledger.');

response = membershipApi.handle({
  method: 'GET',
  path: membershipManagerPath,
  headers: {
    'x-hofs-session-token': managerIdentitySessionToken,
  },
});
assert(response.status === 403 && response.body.error === 'identity-session-invalid', 'Revoked identity-session tokens must fail closed before route dispatch.');

response = membershipApi.handle({
  method: 'POST',
  path: identitySessionsPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: identitySessionsPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    role: 'security-admin',
    userId: 'security-lead',
    issuerRole: 'security-admin',
    issuerId: 'security-lead',
    ttlMs: 60 * 60 * 1000,
    scope: ['project', 'security-boundary'],
    source: 'product-team-acceptance-active-identity-session',
  },
});
assert(response.status === 200 && response.body.identitySession?.status === 'active', 'Project API must keep a second active identity-session proof row.');
const activeSecurityIdentitySessionToken = response.body.token;
const activeSecurityIdentitySessionId = response.body.identitySession.id;

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-boundary`,
  headers: {
    'x-hofs-session-token': activeSecurityIdentitySessionToken,
  },
});
assert(response.status === 200 && response.body.securityBoundary?.identitySessions?.activeCount >= 1, 'Security boundary must accept active identity-session tokens and summarize active sessions.');
assert(response.body.securityBoundary.identitySessions.rows.some((row) => row.id === activeSecurityIdentitySessionId && row.status === 'active'), 'Security boundary must expose public identity-session rows.');
assert(response.body.securityBoundary.summary?.identitySessionRevokedCount >= 1, 'Security boundary must summarize revoked identity sessions.');
assert(response.body.securityBoundary.routeSummary.routeKeys.includes('identity-sessions'), 'Security boundary route manifest must include identity sessions after issuance.');

const membershipAgentPath = `/projects/${projectId}/agents/jobs/dashboard`;
response = membershipApi.handle({
  method: 'GET',
  path: membershipAgentPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipAgentPath,
    role: 'agent',
    agentId: 'jobs',
    userId: 'agent-runtime-jobs',
  }),
});
assert(response.status === 200 && response.body.agentId === 'jobs', 'Project membership policy must allow the bound Agent runtime identity.');

response = membershipApi.handle({
  method: 'PUT',
  path: `/projects/${projectId}/membership-policy`,
  headers: signedHeadersFor({
    method: 'PUT',
    path: `/projects/${projectId}/membership-policy`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    policy: {
      ...projectMembershipPolicy,
      revokedUserIds: ['agent-runtime-jobs'],
    },
    updatedBy: 'security-lead',
    source: 'product-team-acceptance-revocation',
    now: '2026-06-01T11:35:00.000Z',
  },
});
assert(response.status === 200 && response.body.projectMembershipPolicy?.revision === 2, 'Signed project membership updates must persist a new policy revision.');
assert(response.body.projectMembershipSummary?.revokedUserCount === 1, 'Project membership policy summary must expose revoked users.');

response = membershipApi.handle({
  method: 'GET',
  path: membershipAgentPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipAgentPath,
    role: 'agent',
    agentId: 'jobs',
    userId: 'agent-runtime-jobs',
  }),
});
assert(response.status === 403 && response.body.accessDecision?.membership?.reason === 'project-membership-revoked', 'Project membership policy must reject revoked Agent runtime identities.');

response = membershipApi.handle({
  method: 'GET',
  path: membershipAgentPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: membershipAgentPath,
    role: 'agent',
    agentId: 'jobs',
    userId: 'agent-runtime-outsider',
  }),
});
assert(response.status === 403 && response.body.accessDecision?.membership?.reason === 'project-membership-mismatch', 'Project membership policy must reject a signed Agent runtime user that is not bound to the project Agent.');

const membershipReviewPath = `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmissionId)}/reviews`;
response = membershipApi.handle({
  method: 'POST',
  path: membershipReviewPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: membershipReviewPath,
    role: 'reviewer-agent',
    agentId: 'turing',
    userId: 'agent-runtime-turing',
  }),
  body: {
    reviewerAgentId: 'turing',
    verdict: 'accepted',
    comments: 'This should fail because Turing is not the project Reviewer in the membership policy.',
  },
});
assert(response.status === 403 && response.body.accessDecision?.membership?.reason === 'project-membership-mismatch', 'Project membership policy must reject non-Reviewer Agent review attempts even when role and signature are otherwise valid.');
response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/security-access-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/security-access-audit`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.securityAccessAudit?.rows?.some((row) => row.membership?.verified === false), 'Security access audit must persist project membership denials.');
assert(response.body.securityAccessAudit?.rows?.some((row) => row.membership?.verified === true), 'Security access audit must persist project membership allows.');
assert(response.body.securityAccessAudit?.rows?.some((row) => row.membership?.reason === 'project-membership-revoked' && row.membership?.revision === 2), 'Security access audit must persist membership revocation decisions with policy revision.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-snapshot`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-snapshot`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceSnapshot?.recordCounts?.access_replay_records > 0, 'Production persistence snapshot must include signed access replay records after replay protection runs.');
assert(response.body.persistenceSnapshot.recordsByTable.access_replay_records.some((record) => record.data.requestId === 'product-team-persistent-replay-security-boundary'), 'Production persistence snapshot must include the persistent replay request id record.');
assert(response.body.persistenceSnapshot.recordCounts.identity_sessions >= 2, 'Production persistence snapshot must include identity-session rows after local session issuance.');
assert(response.body.persistenceSnapshot.recordsByTable.identity_sessions.some((record) => record.data.id === activeSecurityIdentitySessionId && record.data.status === 'active'), 'Production persistence snapshot must include active identity-session rows.');
assert(response.body.persistenceSnapshot.recordsByTable.identity_sessions.some((record) => record.data.id === managerIdentitySessionId && record.data.status === 'revoked'), 'Production persistence snapshot must include revoked identity-session rows.');
assert(response.body.persistenceSnapshot.recordsByTable.security_access_audit.some((record) => record.data.identitySessionVerified === true && record.data.identitySessionId === managerIdentitySessionId), 'Production persistence snapshot must include identity-session access-audit columns.');
assert(!JSON.stringify(response.body.persistenceSnapshot).includes(managerIdentitySessionToken), 'Production persistence snapshot must not expose revoked raw identity-session tokens.');
assert(!JSON.stringify(response.body.persistenceSnapshot).includes(activeSecurityIdentitySessionToken), 'Production persistence snapshot must not expose active raw identity-session tokens.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-migration-plan`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-migration-plan`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceMigrationPlan?.schemaVersion === 'managed-persistence-migration-plan/v1', 'Project API must expose a managed persistence migration plan.');
assert(response.body.persistenceMigrationPlan.status === 'ready-for-managed-database-pilot', 'Migration plan must be ready once critical acceptance records are present.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('project_membership_policies'), 'Migration plan must seed project membership policies.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('identity_sessions'), 'Migration plan must seed identity-session rows.');
assert(response.body.persistenceMigrationPlan.seedOrder.includes('access_replay_records'), 'Migration plan must seed signed access replay records.');
assert(response.body.persistenceMigrationPlan.tablePlans.some((plan) => plan.table === 'security_audit_stream' && /security-admin/.test(plan.rlsDraft)), 'Migration plan must include security audit stream RLS guidance.');
assert(response.body.persistenceMigrationPlan.verificationGates.every((gate) => gate.passed), 'Migration plan verification gates must all pass for the acceptance project.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-migration-dry-run`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-migration-dry-run`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceMigrationDryRun?.schemaVersion === 'managed-persistence-dry-run/v1', 'Project API must expose a managed persistence dry-run verifier.');
assert(response.body.persistenceMigrationDryRun.status === 'passed', 'Managed persistence dry-run must pass for the acceptance project.');
assert(response.body.persistenceMigrationDryRun.adapterContract?.methods?.includes('importBatch(table, rows)'), 'Dry-run verifier must expose the minimum database adapter contract.');
assert(response.body.persistenceMigrationDryRun.summary.importedRecordCount === response.body.persistenceMigrationDryRun.summary.expectedRecordCount, 'Dry-run verifier must import every snapshot row.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.access_replay_records > 0, 'Dry-run verifier must import signed access replay rows.');
assert(response.body.persistenceMigrationDryRun.importedTableCounts.identity_sessions >= 2, 'Dry-run verifier must import identity-session rows.');
assert(response.body.persistenceMigrationDryRun.gates.some((gate) => gate.id === 'checksum-preserved' && gate.passed), 'Dry-run verifier must check checksum preservation.');
assert(response.body.persistenceMigrationDryRun.gates.some((gate) => gate.id === 'rls-policy-drafts' && gate.passed), 'Dry-run verifier must check RLS guidance coverage.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-adapter-plan`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-adapter-plan`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceAdapterPlan?.schemaVersion === 'managed-persistence-adapter-plan/v1', 'Project API must expose a managed persistence adapter cutover plan.');
assert(response.body.persistenceAdapterPlan.status === 'ready-for-managed-adapter-pilot', 'Managed persistence adapter plan must be ready once migration, membership, replay, worker, and read-model records are present.');
assert(response.body.persistenceAdapterPlan.adapterContract?.schemaVersion === 'managed-persistence-adapter-contract/v2', 'Managed persistence adapter plan must expose the v2 database adapter contract.');
assert(response.body.persistenceAdapterPlan.adapterContract.methods.includes('compareShadowRead(projectId)'), 'Managed persistence adapter plan must require shadow-read comparison.');
assert(response.body.persistenceAdapterPlan.adapterContract.methods.includes('rollbackCutover(projectId)'), 'Managed persistence adapter plan must require rollback support.');
assert(response.body.persistenceAdapterPlan.backupRestorePlan.length >= 3, 'Managed persistence adapter plan must include backup and restore cutover steps.');
assert(response.body.persistenceAdapterPlan.shadowReadPlan.some((row) => row.id === 'runtime-security-proof' && row.tables.includes('project_membership_policies') && row.tables.includes('identity_sessions') && row.ready), 'Managed persistence adapter shadow reads must cover project membership and identity-session rows.');
assert(response.body.persistenceAdapterPlan.adapterStatus?.schemaVersion === 'managed-persistence-adapter-status/v1', 'Managed persistence adapter plan must expose adapter driver status.');
assert(response.body.persistenceAdapterPlan.adapterStatus.driver === 'local-shadow', 'Default managed persistence adapter plan must use the local-shadow driver.');
assert(response.body.persistenceAdapterPlan.adapterStatus.productionCutoverReady === false, 'Default managed persistence adapter plan must not claim production database cutover readiness.');
assert(response.body.persistenceAdapterPlan.verificationGates.every((gate) => gate.passed), 'Managed persistence adapter plan gates must all pass for the acceptance project.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-adapter-dry-run`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-adapter-dry-run`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceAdapterDryRun?.schemaVersion === 'managed-persistence-adapter-dry-run/v1', 'Project API must expose a managed persistence adapter dry-run verifier.');
assert(response.body.persistenceAdapterDryRun.status === 'passed', 'Managed persistence adapter dry-run must pass for the acceptance project.');
assert(response.body.persistenceAdapterDryRun.gates.every((gate) => gate.passed), 'Managed persistence adapter dry-run gates must all pass for the acceptance project.');
assert(response.body.persistenceAdapterDryRun.gates.some((gate) => gate.id === 'adapter-driver-status' && gate.passed), 'Managed persistence adapter dry-run must prove adapter driver status.');
assert(response.body.persistenceAdapterDryRun.gates.some((gate) => gate.id === 'adapter-execution-receipt' && gate.passed), 'Managed persistence adapter dry-run must prove the adapter execution receipt.');
assert(response.body.persistenceAdapterDryRun.adapterExecution?.schemaVersion === 'managed-persistence-adapter-shadow-execution/v1', 'Managed persistence adapter dry-run must expose the shadow adapter execution record.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.adapterStatus?.driver === 'local-shadow', 'Managed persistence adapter dry-run must expose the local-shadow adapter driver.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.adapterStatus.productionCutoverReady === false, 'Managed persistence adapter dry-run must keep production cutover blocked until a real adapter runs.');
assert(response.body.persistenceAdapterDryRun.adapterExecution?.preRollbackReceipt?.schemaVersion === 'managed-persistence-adapter-execution-receipt/v1', 'Managed persistence adapter dry-run must expose a pre-rollback execution receipt.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.preRollbackReceipt.tableCounts.project_membership_policies > 0, 'Managed persistence adapter execution must import project membership policy rows before rollback.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.preRollbackReceipt.tableCounts.identity_sessions >= 2, 'Managed persistence adapter execution must import identity-session rows before rollback.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.preRollbackReceipt.tableCounts.security_audit_stream > 0, 'Managed persistence adapter execution must import security audit stream rows before rollback.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.finalReceipt?.schemaVersion === 'managed-persistence-adapter-execution-receipt/v1', 'Managed persistence adapter dry-run must expose a final rollback receipt.');
assert(response.body.persistenceAdapterDryRun.adapterExecution.finalReceipt.tableCounts.project_membership_policies === 0, 'Managed persistence adapter dry-run must roll back imported table rows after verification.');
assert(response.body.persistenceAdapterDryRun.summary.adapterOperationCount >= 8, 'Managed persistence adapter dry-run summary must expose executed adapter operations.');
assert(response.body.persistenceAdapterDryRun.summary.adapterImportedTableCount >= 10, 'Managed persistence adapter dry-run summary must expose imported adapter table coverage.');
assert(response.body.persistenceAdapterDryRun.summary.adapterDriver === 'local-shadow', 'Managed persistence adapter dry-run summary must expose the active adapter driver.');
assert(response.body.persistenceAdapterDryRun.summary.adapterProductionCutoverReady === false, 'Managed persistence adapter dry-run summary must not claim production cutover readiness for local shadow runs.');
assert(response.body.persistenceAdapterDryRun.summary.shadowReadParityCount === response.body.persistenceAdapterDryRun.summary.shadowReadGroupCount, 'Managed persistence adapter dry-run must prove shadow-read parity.');
assert(response.body.persistenceAdapterDryRun.summary.transactionRollbackReady === true, 'Managed persistence adapter dry-run must prove rollback readiness.');
assert(response.body.persistenceAdapterDryRun.summary.backupRestoreReady === true, 'Managed persistence adapter dry-run must prove backup/restore readiness.');
assert(response.body.persistenceAdapterDryRun.readModelProbe.expectedReadModels.every((name) => response.body.persistenceAdapterDryRun.readModelProbe.checkpointNames.includes(name)), 'Managed persistence adapter dry-run must prove read-model checkpoint parity.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/operations-readiness`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/operations-readiness`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.operationsReadiness?.schemaVersion === 'operations-readiness/v1', 'Project API must expose an operations readiness contract.');
assert(response.body.operationsReadiness.status === 'local-operations-contract-ready', 'Operations readiness must pass once worker proof, audit stream, persistence, and dry-run evidence exist.');
assert(response.body.operationsReadiness.gates.every((gate) => gate.passed), 'Operations readiness gates must all pass for the acceptance project.');
assert(response.body.operationsReadiness.gates.some((gate) => gate.id === 'worker-failure-recovery-contract' && gate.passed), 'Operations readiness must include a passing worker failure recovery gate.');
assert(response.body.operationsReadiness.gates.some((gate) => gate.id === 'queue-adapter-dry-run' && gate.passed), 'Operations readiness must include a passing queue adapter dry-run gate.');
assert(response.body.operationsReadiness.gates.some((gate) => gate.id === 'managed-persistence-adapter-cutover' && gate.passed), 'Operations readiness must include a passing managed persistence adapter cutover gate.');
assert(response.body.operationsReadiness.gates.some((gate) => gate.id === 'incident-drill-rehearsal' && gate.passed), 'Operations readiness must include a passing incident drill rehearsal gate.');
assert(response.body.operationsReadiness.incidentDrill?.schemaVersion === 'operations-incident-drill/v1', 'Operations readiness must expose a structured incident drill receipt.');
assert(response.body.operationsReadiness.incidentDrill?.drillReady === true, 'Operations incident drill must pass for the acceptance project.');
assert(response.body.operationsReadiness.incidentDrill?.summary?.failedReceiptCount === 0, 'Operations incident drill must have no failed local rehearsal receipts.');
assert(response.body.operationsReadiness.incidentDrill?.summary?.routedAlertRuleCount === response.body.operationsReadiness.incidentDrill?.summary?.alertRuleCount, 'Operations incident drill must route every alert rule to a backend proof surface.');
assert(response.body.operationsReadiness.incidentDrill?.receipts?.some((receipt) => receipt.id === 'verify-queue-recovery' && receipt.passed && receipt.receiptChecksum), 'Operations incident drill must prove queue recovery readiness with a checksummed receipt.');
assert(response.body.operationsReadiness.incidentDrill?.receipts?.some((receipt) => receipt.id === 'verify-persistence-recovery' && receipt.passed && receipt.receiptChecksum), 'Operations incident drill must prove persistence recovery readiness with a checksummed receipt.');
assert(response.body.operationsReadiness.summary?.incidentDrillReady === true, 'Operations readiness summary must expose incident drill readiness.');
assert(response.body.operationsReadiness.observability?.metrics?.incidentDrillReady === true, 'Operations readiness observability metrics must expose incident drill readiness.');
assert(response.body.operationsReadiness.observability.metrics.securityAuditStreamCount >= 11, 'Operations readiness must surface security audit stream metrics.');
assert(response.body.operationsReadiness.observability.metrics.securityAuditStreamHashChainReady === true, 'Operations readiness must surface verified audit hash-chain status.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterDryRunStatus === 'passed', 'Operations readiness must surface managed persistence adapter dry-run status.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterShadowReadParityCount === response.body.operationsReadiness.observability.metrics.persistenceAdapterShadowReadGroupCount, 'Operations readiness must surface managed persistence adapter shadow-read parity metrics.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterRollbackReady === true, 'Operations readiness must surface managed persistence adapter rollback readiness.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterBackupRestoreReady === true, 'Operations readiness must surface managed persistence adapter backup/restore readiness.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterOperationCount >= 8, 'Operations readiness must surface managed persistence adapter execution operation metrics.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterImportedTableCount >= 10, 'Operations readiness must surface managed persistence adapter imported table metrics.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterDriver === 'local-shadow', 'Operations readiness must surface managed persistence adapter driver status.');
assert(response.body.operationsReadiness.observability.metrics.persistenceAdapterProductionCutoverReady === false, 'Operations readiness must keep production database cutover blocked for local shadow runs.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterDryRunStatus === 'passed', 'Operations readiness must surface queue adapter dry-run status.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterDispatchCount >= team.length, 'Operations readiness must surface queue adapter dispatch metrics.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterLeaseAcquisitionCount >= team.length, 'Operations readiness must surface queue adapter lease metrics.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterOperationCount >= team.length + 4, 'Operations readiness must surface worker queue adapter execution operation metrics.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterQueueRowCount >= team.length, 'Operations readiness must surface worker queue adapter row import metrics.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterDriver === 'local-shadow', 'Operations readiness must surface worker queue adapter driver status.');
assert(response.body.operationsReadiness.observability.metrics.queueAdapterProductionCutoverReady === false, 'Operations readiness must keep production queue cutover blocked for local shadow runs.');
assert(response.body.operationsReadiness.observability.metrics.workerRecoveryContractReady === true, 'Operations readiness must surface worker recovery contract readiness.');
assert(response.body.operationsReadiness.observability.metrics.workerExecutionReceiptCount >= 1, 'Operations readiness must surface worker execution receipt metrics.');
assert(response.body.operationsReadiness.observability.metrics.workerDeadLetterCount === 0, 'Operations readiness must surface worker dead-letter metrics.');
assert(response.body.operationsReadiness.observability.metrics.persistenceRecordCount > 0, 'Operations readiness must surface persistence recovery metrics.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'audit-stream-hash-chain-break'), 'Operations readiness must include an audit hash-chain alert rule.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'migration-dry-run-failed'), 'Operations readiness must include a migration dry-run alert rule.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'persistence-adapter-dry-run-failed'), 'Operations readiness must include a managed persistence adapter dry-run alert rule.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'queue-adapter-dry-run-failed'), 'Operations readiness must include a queue adapter dry-run alert rule.');
assert(response.body.operationsReadiness.observability.alertRules.some((rule) => rule.id === 'worker-dead-letter-nonempty'), 'Operations readiness must include a worker dead-letter alert rule.');
assert(response.body.operationsReadiness.recovery.steps.some((step) => step.id === 'verify-import' && step.evidenceRoute?.endsWith('/persistence-migration-dry-run')), 'Operations readiness must include a recovery step for migration import verification.');
assert(response.body.operationsReadiness.recovery.steps.some((step) => step.id === 'verify-database-adapter' && step.evidenceRoute?.endsWith('/persistence-adapter-dry-run')), 'Operations readiness must include a recovery step for managed persistence adapter verification.');
assert(response.body.operationsReadiness.recovery.steps.some((step) => step.id === 'verify-queue-adapter' && step.evidenceRoute?.endsWith('/worker-queue-adapter-dry-run')), 'Operations readiness must include a recovery step for queue adapter verification.');
assert(response.body.operationsReadiness.backendRoutes.operationsReadiness?.endsWith('/operations-readiness'), 'Operations readiness must expose its own backend route.');
assert(response.body.operationsReadiness.backendRoutes.persistenceAdapterDryRun?.endsWith('/persistence-adapter-dry-run'), 'Operations readiness must expose the managed persistence adapter dry-run route.');
assert(response.body.operationsReadiness.backendRoutes.workerQueueAdapterDryRun?.endsWith('/worker-queue-adapter-dry-run'), 'Operations readiness must expose the queue adapter dry-run route.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/pilot-launch-readiness`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/pilot-launch-readiness`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.pilotLaunchReadiness?.schemaVersion === 'pilot-launch-readiness/v1', 'Project API must expose a standalone pilot launch readiness contract.');
assert(response.body.pilotLaunchReadiness.privatePilotDecision === 'go', 'Pilot launch readiness must approve the completed acceptance project for private pilot.');
assert(response.body.pilotLaunchReadiness.productionDecision === 'no-go', 'Pilot launch readiness must keep production launch blocked.');
assert(response.body.pilotLaunchReadiness.summary?.failedGateCount === 0, 'Pilot launch readiness must have no failed private-pilot gates after full acceptance.');
assert(response.body.pilotLaunchReadiness.summary?.readyEvidenceRouteCount === response.body.pilotLaunchReadiness.summary?.evidenceRouteCount, 'Pilot launch readiness must have every evidence route ready.');
assert(response.body.pilotLaunchReadiness.productionBlockers?.some((row) => row.id === 'production-managed-persistence'), 'Pilot launch readiness must retain managed persistence as a production blocker.');
assert(response.body.pilotLaunchReadiness.productionBlockers?.some((row) => row.id === 'production-real-providers'), 'Pilot launch readiness must retain real providers as a production blocker.');
assert(response.body.pilotLaunchReadiness.gates.some((gate) => gate.id === 'production-overclaim-blocked' && gate.passed), 'Pilot launch readiness must prove production overclaim is blocked.');
assert(response.body.pilotLaunchReadiness.evidenceRoutes.some((route) => route.id === 'operations-readiness' && route.ready), 'Pilot launch readiness must link operations readiness as a ready evidence route.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/deployment-preflight`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/deployment-preflight`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.deploymentPreflight?.schemaVersion === 'deployment-preflight/v1', 'Project API must expose a standalone deployment preflight contract.');
assert(response.body.deploymentPreflight.privatePilotDeploymentReady === true, 'Deployment preflight must pass blocker gates for the completed acceptance project.');
assert(response.body.deploymentPreflight.productionDeploymentReady === false, 'Deployment preflight must keep production deployment blocked.');
assert(response.body.deploymentPreflight.gates.some((gate) => gate.id === 'secret-vault-ready' && gate.passed), 'Deployment preflight must verify local secret vault readiness.');
assert(response.body.deploymentPreflight.gates.some((gate) => gate.id === 'managed-persistence-preflight' && gate.passed), 'Deployment preflight must verify managed persistence dry-run readiness.');
assert(response.body.deploymentPreflight.gates.some((gate) => gate.id === 'worker-queue-preflight' && gate.passed), 'Deployment preflight must verify worker queue dry-run readiness.');
assert(response.body.deploymentPreflight.gates.some((gate) => gate.id === 'adapter-gateway-preflight' && gate.passed), 'Deployment preflight must verify adapter gateway preflight readiness.');
assert(response.body.deploymentPreflight.productionControls.some((control) => control.id === 'scheduler-autostart' && control.ready === false), 'Deployment preflight must keep scheduler autostart as an explicit deployment control when env is not enabled.');
assert(response.body.deploymentPreflight.backendRoutes.deploymentPreflight?.endsWith('/deployment-preflight'), 'Deployment preflight must expose its own backend route.');
assert(response.body.deploymentPreflight.backendRoutes.adapterGatewayPreflight?.endsWith('/adapter-gateway-preflight'), 'Deployment preflight must expose the adapter gateway preflight backend route.');
const deploymentPreflightChecksum = response.body.deploymentPreflight.checksum;

const adapterGatewayPreflightPath = `/projects/${projectId}/adapter-gateway-preflight`;
response = membershipApi.handle({
  method: 'GET',
  path: adapterGatewayPreflightPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: adapterGatewayPreflightPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.adapterGatewayPreflight?.schemaVersion === 'adapter-gateway-preflight/v1', 'Project API must expose a standalone adapter gateway preflight contract.');
assert(response.body.adapterGatewayPreflight.privateGatewayReady === true, 'Standalone adapter gateway preflight must pass the local-shadow private rehearsal path.');
assert(response.body.adapterGatewayPreflight.productionCutoverReady === false, 'Standalone adapter gateway preflight must keep production cutover blocked.');
assert(response.body.adapterGatewayPreflight.backendRoutes.adapterGatewayPreflight?.endsWith('/adapter-gateway-preflight'), 'Standalone adapter gateway preflight must expose its own backend route.');

const launchApprovalPath = `/projects/${projectId}/launch-approvals`;
response = membershipApi.handle({
  method: 'POST',
  path: launchApprovalPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: launchApprovalPath,
    role: 'manager',
    userId: 'director',
  }),
  body: {
    mode: 'private-pilot',
    decision: 'approved',
    approverRole: 'manager',
    approverId: 'director',
    approverName: 'Product Director',
    reason: 'Manager approves the private pilot after complete product-team acceptance proof.',
    linkedAuditChecksum: deploymentPreflightChecksum,
    now: '2026-06-01T12:10:00.000Z',
  },
});
assert(response.status === 200 && response.body.launchApproval?.schemaVersion === 'launch-approval/v1', 'Project API must persist a manager launch approval record.');
assert(response.body.launchApproval.approverRole === 'manager' && response.body.launchApproval.decision === 'approved', 'Manager launch approval must preserve role and decision.');
assert(response.body.launchApprovalWorkflow?.readyForPrivatePilot === false, 'Private-pilot launch approval must still require security approval after manager approval.');
assert(response.body.project.eventLedger.some((event) => event.type === 'launch-approval' && event.entityIds?.launchApprovalId === response.body.launchApproval.id), 'Launch approval must enter the project event ledger.');

response = membershipApi.handle({
  method: 'POST',
  path: launchApprovalPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: launchApprovalPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
  body: {
    mode: 'private-pilot',
    decision: 'approved',
    approverRole: 'security-admin',
    approverId: 'security-lead',
    approverName: 'Security Lead',
    reason: 'Security approves the private pilot with production controls still blocked.',
    linkedAuditChecksum: deploymentPreflightChecksum,
    now: '2026-06-01T12:12:00.000Z',
  },
});
assert(response.status === 200 && response.body.launchApproval?.schemaVersion === 'launch-approval/v1', 'Project API must persist a security launch approval record.');
assert(response.body.launchApprovalWorkflow?.schemaVersion === 'launch-approval-workflow/v1', 'Launch approval POST must return the workflow snapshot.');
assert(response.body.launchApprovalWorkflow.readyForPrivatePilot === true, 'Launch approval workflow must mark private pilot ready after manager and security approvals.');
assert(response.body.launchApprovalWorkflow.readyForProduction === false, 'Launch approval workflow must keep production blocked without operations-owner approval.');
assert(response.body.managerReadyPackage?.launchApprovalWorkflow?.readyForPrivatePilot === true, 'Manager Ready Package must embed the updated launch approval workflow.');
assert(response.body.managerReadyPackage?.productionLaunchAudit?.privatePilotDecision === 'go', `Manager Ready Package launch audit must move to private-pilot go after approvals. failedPrivatePilotGates=${JSON.stringify(response.body.managerReadyPackage?.productionLaunchAudit?.failedPrivatePilotGates || [])}`);
assert(response.body.managerReadyPackage?.productionLaunchAudit?.productionDecision === 'no-go', 'Manager Ready Package launch audit must keep production no-go after private-pilot approval.');

response = membershipApi.handle({
  method: 'GET',
  path: launchApprovalPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: launchApprovalPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.launchApprovalWorkflow?.rows?.length >= 2, 'Project API must read back persisted launch approvals.');
assert(response.body.launchApprovalWorkflow.modes.some((mode) => mode.id === 'private-pilot' && mode.ready && mode.approvedRoles.includes('manager') && mode.approvedRoles.includes('security-admin')), 'Launch approval workflow must summarize private-pilot role approvals.');
assert(response.body.launchApprovalWorkflow.modes.some((mode) => mode.id === 'production' && !mode.ready && mode.missingRoles.includes('operations-owner')), 'Launch approval workflow must summarize missing production approver roles.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.nodes.filter((node) => node.source === 'launchApprovals' && node.subtype === 'launch-approval').length >= 2, 'Manager Flow Graph must include launch approval decision nodes.');
assert(response.body.edges.some((edge) => edge.source === 'launchApprovals' && edge.label === 'Release governance' && edge.eventIds?.length), 'Manager Flow Graph must connect launch approvals to release-governance evidence.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'director',
  }),
});
assert(response.status === 200 && response.body.launchApprovalSummary?.count >= 2, 'Readiness Proof Map must summarize launch approval proof.');
assert(response.body.launchApprovalRoutes?.every((route) => route.apiPath?.endsWith('/launch-approvals') && route.proofIds.length && route.timelineLogIds.length && route.eventIds.length), 'Readiness Proof Map launch approval routes must include API, checksum, timeline, and event proof.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-snapshot`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-snapshot`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceSnapshot?.recordsByTable?.launch_approvals?.length >= 2, 'Production persistence snapshot must include launch approval rows after approval.');
assert(response.body.persistenceSnapshot.recordsByTable.launch_approvals.every((record) => record.data.schemaVersion === 'launch-approval/v1' && record.data.checksum), 'Launch approval persistence rows must preserve schema version and checksum.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/production-launch-audit`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/production-launch-audit`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.productionLaunchAudit?.schemaVersion === 'production-launch-audit/v1', 'Project API must expose a standalone production launch audit contract.');
assert(response.body.productionLaunchAudit.privatePilotDecision === 'go', 'Production launch audit must approve the completed acceptance project for private pilot.');
assert(response.body.productionLaunchAudit.productionDecision === 'no-go', 'Production launch audit must keep public production blocked.');
assert(response.body.productionLaunchAudit.summary?.failedPrivatePilotGateCount === 0, 'Standalone production launch audit must have no failed private-pilot gates after full acceptance.');
assert(response.body.productionLaunchAudit.summary?.failedProductionGateCount > 0, 'Standalone production launch audit must keep production gates failed.');
assert(response.body.productionLaunchAudit.evidenceRoutes.some((route) => route.id === 'production-launch-audit' && route.ready), 'Standalone production launch audit must include its own evidence route.');
assert(response.body.productionLaunchAudit.backendRoutes.productionLaunchAudit?.endsWith('/production-launch-audit'), 'Production launch audit must expose its own backend route.');
assert(response.body.productionLaunchAudit.nextShortestPath?.scope === 'production-hardening', 'Production launch audit must point to production hardening after private-pilot gates pass.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/project-evidence-archive`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/project-evidence-archive`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.projectEvidenceArchive?.schemaVersion === 'project-evidence-archive/v1', 'Project API must expose a standalone project evidence archive contract.');
assert(response.body.projectEvidenceArchive.status === 'archive-ready', `Project evidence archive must be ready after the full acceptance scenario. failed=${JSON.stringify(response.body.projectEvidenceArchive.integrity?.failedGates || [])}`);
assert(response.body.projectEvidenceArchive.readyForManagerHandoff === true, 'Project evidence archive must be ready for manager/customer handoff.');
assert(response.body.projectEvidenceArchive.readyForProduction === false, 'Project evidence archive must not claim production readiness.');
assert(response.body.projectEvidenceArchive.summary?.finalDeliverableCount >= 1, 'Project evidence archive must include the final deliverable.');
assert(response.body.projectEvidenceArchive.summary?.evidenceSearchCount >= 1, 'Project evidence archive must include evidence searches.');
assert(response.body.projectEvidenceArchive.summary?.submissionReviewCount >= 2, 'Project evidence archive must include submission reviews.');
assert(response.body.projectEvidenceArchive.summary?.transcriptMessageCount > 0, 'Project evidence archive must include transcript messages.');
assert(response.body.projectEvidenceArchive.summary?.flowGraphProofedNodeCount > 0, 'Project evidence archive must include proofed Flow Graph nodes.');
assert(response.body.projectEvidenceArchive.summary?.rawLeakCount === 0, 'Project evidence archive must report zero raw secret leaks.');
assert(response.body.projectEvidenceArchive.manifest.every((entry) => entry.checksum), 'Every project evidence archive manifest entry must carry a checksum.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'final-deliverables' && entry.ready), 'Project evidence archive manifest must include ready final-deliverable evidence.');
assert(response.body.projectEvidenceArchive.manifest.some((entry) => entry.id === 'group-chat-transcripts' && entry.ready), 'Project evidence archive manifest must include ready transcript evidence.');
assert(response.body.projectEvidenceArchive.integrity.gates.every((gate) => gate.passed), 'Project evidence archive integrity gates must all pass for the acceptance scenario.');
assert(response.body.projectEvidenceArchive.backendRoutes.projectEvidenceArchive?.endsWith('/project-evidence-archive'), 'Project evidence archive must expose its own backend route.');
assert(response.body.projectEvidenceArchive.contents.finalDeliverables.some((submission) => submission.id === finalSubmissionId && submission.bodyChecksum), 'Project evidence archive must include the final deliverable body checksum.');
assert(response.body.projectEvidenceArchive.contents.transcripts.channels.some((channel) => channel.messages.some((message) => message.type === 'submission')), 'Project evidence archive must include submission messages in transcripts.');
assert(response.body.projectEvidenceArchive.contents.evidenceSearches.some((record) => record.sources?.length >= 1 && record.checksum), 'Project evidence archive must include evidence source packets with checksums.');
assert(response.body.projectEvidenceArchive.contents.submissionReviews.some((review) => review.verdict === 'accepted' && review.commentsChecksum), 'Project evidence archive must include accepted review evidence with checksums.');
assert(response.body.projectEvidenceArchive.contents.managerFlowGraph.nodes.some((node) => node.category === 'submission' && node.subtype === 'final-deliverable'), 'Project evidence archive must include final-deliverable Flow Graph nodes.');
for (const secret of [FAKE_SEARCH_SECRET, FAKE_MODEL_SECRET, FAKE_SOURCE_SECRET, ACCESS_SIGNING_SECRET, managerIdentitySessionToken, activeSecurityIdentitySessionToken]) {
  assert(!JSON.stringify(response.body.projectEvidenceArchive).includes(secret), `Project evidence archive must not expose secret fixture value ${secret}.`);
}

const projectEvidenceArchiveChecksum = response.body.projectEvidenceArchive.checksum;
const projectEvidenceExportPath = `/projects/${projectId}/project-evidence-exports`;
response = membershipApi.handle({
  method: 'GET',
  path: projectEvidenceExportPath,
  headers: signedHeadersFor({
    method: 'GET',
    path: projectEvidenceExportPath,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.projectEvidenceExportWorkflow?.schemaVersion === 'project-evidence-export-workflow/v1', 'Project API must expose the project evidence export workflow contract.');
assert(response.body.projectEvidenceExportWorkflow.readyForProductionExport === false, 'Project evidence export workflow must not claim production export readiness before real controls exist.');

response = membershipApi.handle({
  method: 'POST',
  path: projectEvidenceExportPath,
  headers: signedHeadersFor({
    method: 'POST',
    path: projectEvidenceExportPath,
    role: 'manager',
    userId: 'manager-operator',
  }),
  body: {
    action: 'request',
    mode: 'private-pilot',
    actorRole: 'manager',
    actorId: 'manager-operator',
    reason: 'Request customer handoff evidence package for private-pilot acceptance.',
    retentionDays: 30,
    dataResidencyRegion: 'local-private-pilot',
  },
});
assert(response.status === 200 && response.body.projectEvidenceExport?.schemaVersion === 'project-evidence-export/v1', 'Manager must be able to request a governed project evidence export.');
const exportRequestId = response.body.projectEvidenceExport.exportRequestId;
assert(response.body.projectEvidenceExport.archiveChecksum === projectEvidenceArchiveChecksum, 'Project evidence export request must pin the current archive checksum.');
assert(response.body.projectEvidenceExportWorkflow.summary?.requestCount >= 1, 'Project evidence export workflow must count export requests.');

for (const approval of [
  { role: 'manager', userId: 'manager-operator', reason: 'Manager approves the private-pilot handoff bundle.' },
  { role: 'security-admin', userId: 'security-lead', reason: 'Security approves the redacted private-pilot handoff bundle.' },
]) {
  response = membershipApi.handle({
    method: 'POST',
    path: projectEvidenceExportPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: projectEvidenceExportPath,
      role: approval.role,
      userId: approval.userId,
    }),
    body: {
      action: 'approve',
      mode: 'private-pilot',
      exportRequestId,
      actorRole: approval.role,
      actorId: approval.userId,
      reason: approval.reason,
    },
  });
  assert(response.status === 200 && response.body.projectEvidenceExport?.decision === 'approved', `${approval.role} must be able to approve the project evidence export workflow.`);
}
assert(response.body.projectEvidenceExportWorkflow.readyForPrivatePilotHandoff === true, 'Project evidence export workflow must become private-pilot handoff ready after Manager and security-admin approvals.');
assert(response.body.projectEvidenceExportWorkflow.readyForProductionExport === false, 'Project evidence export workflow must keep production export blocked.');
assert(response.body.projectEvidenceExportWorkflow.gates.every((gate) => gate.passed), `Project evidence export workflow gates must pass for private-pilot handoff: ${JSON.stringify(response.body.projectEvidenceExportWorkflow.gates.filter((gate) => !gate.passed))}`);
assert(response.body.managerReadyPackage?.projectEvidenceExportWorkflow?.readyForPrivatePilotHandoff === true, 'Manager Ready Package must embed the approved project evidence export workflow.');
assert(response.body.managerReadyPackage?.summary?.projectEvidenceExportReady === true, 'Manager Ready Package summary must expose project evidence export readiness.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/readiness-proof-map`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
    role: 'manager',
    userId: 'manager-operator',
  }),
});
assert(response.status === 200 && response.body.projectEvidenceExportRoutes?.some((route) => route.apiPath?.endsWith('/project-evidence-exports') && route.proofIds?.length && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must include project evidence export routes with proof, timeline, and event links.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/manager-flow-graph`,
    role: 'manager',
    userId: 'manager-operator',
  }),
});
assert(response.status === 200 && response.body.nodes?.some((node) => node.subtype === 'project-evidence-export' && node.route?.endsWith('/project-evidence-exports')), 'Manager Flow Graph must include project evidence export governance nodes.');

response = membershipApi.handle({
  method: 'GET',
  path: `/projects/${projectId}/persistence-snapshot`,
  headers: signedHeadersFor({
    method: 'GET',
    path: `/projects/${projectId}/persistence-snapshot`,
    role: 'security-admin',
    userId: 'security-lead',
  }),
});
assert(response.status === 200 && response.body.persistenceSnapshot?.recordsByTable?.project_evidence_exports?.length >= 3, 'Production persistence snapshot must include project evidence export request and approval rows.');
assert(response.body.persistenceSnapshot.recordsByTable.project_evidence_exports.every((record) => record.data.schemaVersion === 'project-evidence-export/v1' && record.data.archiveChecksum === projectEvidenceArchiveChecksum && record.data.checksum), 'Project evidence export persistence rows must preserve schema version, archive checksum, and row checksum.');

const persistedStoreSnapshot = JSON.parse(readFileSync(`${root}/store.json`, 'utf8'));
assert(Array.isArray(persistedStoreSnapshot.securityAccessAuditRecords), 'File-backed store snapshot must export backend security audit stream records.');
const persistedAcceptanceProject = persistedStoreSnapshot.projects.find((project) => project.id === projectId);
assert(persistedAcceptanceProject?.projectMembershipPolicy?.revision === 2, 'File-backed store must persist the latest project membership policy revision.');
assert(persistedAcceptanceProject?.projectMembershipAudit?.length >= 2, 'File-backed store must persist project membership policy audit entries.');
assert(persistedAcceptanceProject?.identitySessions?.some((session) => session.id === activeSecurityIdentitySessionId && session.status === 'active' && session.tokenHash), 'File-backed store must persist active identity-session hash rows.');
assert(persistedAcceptanceProject?.identitySessions?.some((session) => session.id === managerIdentitySessionId && session.status === 'revoked' && session.revokedAt), 'File-backed store must persist revoked identity-session rows.');
assert(persistedAcceptanceProject?.providerUsageLedger?.some((record) => record.operation === 'search:evidence' && record.allowed === true && record.eventId), 'File-backed store must persist provider usage ledger rows with event proof.');
assert(persistedAcceptanceProject?.launchApprovals?.filter((record) => record.mode === 'private-pilot' && record.decision === 'approved').length >= 2, 'File-backed store must persist private-pilot launch approvals.');
assert(persistedAcceptanceProject?.projectEvidenceExports?.filter((record) => record.exportRequestId === exportRequestId).length >= 3, 'File-backed store must persist project evidence export request and approval rows.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.length >= 11, 'File-backed store snapshot must persist backend security audit stream decisions.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.allowed === false && record.streamChecksum), 'File-backed security audit stream must persist denied decisions with checksums.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.every((record) => record.previousStreamHash && record.streamHash), 'File-backed security audit stream must persist hash-chain links.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.replay?.detected === true && record.streamChecksum), 'File-backed security audit stream must persist replay denials with checksums.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.membership?.verified === false && record.streamChecksum), 'File-backed security audit stream must persist membership denials with checksums.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.membership?.reason === 'project-membership-revoked' && record.membership?.revision === 2), 'File-backed security audit stream must persist membership revocation denials with policy revision.');
assert(persistedStoreSnapshot.securityAccessAuditRecords.some((record) => record.identitySession?.verified === true && record.identitySession?.sessionId === managerIdentitySessionId), 'File-backed security audit stream must persist identity-session verified access decisions.');
const auditLogPath = `${root}/store.json.security-audit.jsonl`;
assert(existsSync(auditLogPath), 'File-backed store must write an independent append-only security audit JSONL file.');
const auditLogRecords = readFileSync(auditLogPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
assert(auditLogRecords.length >= persistedStoreSnapshot.securityAccessAuditRecords.length, 'Append-only security audit JSONL file must contain all persisted audit stream records.');
assert(auditLogRecords.every((line) => line.auditLogVersion === 1 && line.writtenAt && line.record?.streamChecksum && line.record?.previousStreamHash && line.record?.streamHash), 'Append-only security audit JSONL lines must include version, write time, checksummed records, and hash-chain links.');
assert(auditLogRecords.some((line) => line.record?.allowed === false), 'Append-only security audit JSONL file must include denied decisions.');
assert(auditLogRecords.some((line) => line.record?.replay?.detected === true), 'Append-only security audit JSONL file must include replay denials.');
assert(auditLogRecords.some((line) => line.record?.membership?.verified === false), 'Append-only security audit JSONL file must include project membership denials.');
assert(auditLogRecords.some((line) => line.record?.membership?.reason === 'project-membership-revoked' && line.record?.membership?.revision === 2), 'Append-only security audit JSONL file must include project membership revocation denials.');
assert(auditLogRecords.some((line) => line.record?.identitySession?.verified === true && line.record?.identitySession?.sessionId === managerIdentitySessionId), 'Append-only security audit JSONL file must include identity-session verified access decisions.');

const persistedProjectState = readSmallTextFiles(root);
for (const secret of [FAKE_SEARCH_SECRET, FAKE_MODEL_SECRET, FAKE_SOURCE_SECRET, ACCESS_SIGNING_SECRET]) {
  assert(!persistedProjectState.includes(secret), `Acceptance Harness must not persist secret fixture value ${secret}.`);
}
assert(!persistedProjectState.includes(managerIdentitySessionToken), 'Acceptance Harness must not persist the revoked raw identity-session token.');
assert(!persistedProjectState.includes(activeSecurityIdentitySessionToken), 'Acceptance Harness must not persist the active raw identity-session token.');
assert(persistedProjectState.includes('[REDACTED]'), 'Acceptance Harness must prove secret-bearing fields are redacted before persistence.');

console.log('Product team acceptance scenario validation passed.');
