import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAgentProjectApi, createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { signAgentProjectAccessHeaders } from '../src/agents/accessControl.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asText(value) {
  return JSON.stringify(value);
}

const projectId = process.env.HOFS_PRIVATE_PILOT_FOCUSED_PROJECT_ID || 'private_pilot_handoff_focused_project';
const projectName = process.env.HOFS_PRIVATE_PILOT_FOCUSED_PROJECT_NAME || 'Private Pilot Handoff Focused Project';
const fileBackedFixture = process.env.HOFS_PRIVATE_PILOT_FOCUSED_FILE_BACKED === '1';
const preserveTmp = process.env.HOFS_PRIVATE_PILOT_FOCUSED_PRESERVE_TMP === '1';
const stopBeforeEvidenceExport = process.env.HOFS_PRIVATE_PILOT_FOCUSED_STOP_BEFORE_EXPORT === '1';
const ACCESS_SIGNING_SECRET = 'focused-private-pilot-access-secret';
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
const tempRoot = fileBackedFixture
  ? resolve(process.env.HOFS_PRIVATE_PILOT_FOCUSED_TEMP_ROOT || resolve('.tmp', 'private-pilot-focused', `run-${process.pid}`))
  : null;
if (tempRoot) {
  mkdirSync(tempRoot, { recursive: true });
}
function cleanupTempRoot() {
  if (!tempRoot || preserveTmp) return;
  rmSync(tempRoot, { recursive: true, force: true });
}
if (tempRoot) {
  process.once('exit', cleanupTempRoot);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      cleanupTempRoot();
      process.exit(signal === 'SIGINT' ? 130 : 143);
    });
  }
}
const focusedSearchSecret = 'focused-search-secret';
const focusedModelSecret = 'focused-model-secret';
const secretVault = createLocalSecretVault({
  enabled: true,
  masterKey: 'focused-vault-master-v1',
  keyId: 'focused-local-v1',
  keySource: 'focused-validation-fixture',
});
const sealedSearchSecret = await secretVault.seal('search.apiKey', focusedSearchSecret, { scope: 'search-provider' });
const sealedModelSecret = await secretVault.seal('model.apiKey', focusedModelSecret, { scope: 'model-provider' });
const vaultRotation = await secretVault.rotate({
  nextMasterKey: 'focused-vault-master-v2',
  nextKeyId: 'focused-local-v2',
  metadata: {
    reason: 'focused-private-pilot-validation-rotation',
    keySource: 'focused-validation-fixture',
  },
  now: '2026-06-01T09:05:00.000Z',
});
const rotatedSearchRecord = vaultRotation.records.find((record) => record.name === 'search.apiKey') || sealedSearchSecret;
const rotatedModelRecord = vaultRotation.records.find((record) => record.name === 'model.apiKey') || sealedModelSecret;
const rotatedSearchApiKey = await secretVault.open(rotatedSearchRecord);
const rotatedModelApiKey = await secretVault.open(rotatedModelRecord);
const secretVaultStatus = secretVault.status();
assert(secretVaultStatus.ready && secretVaultStatus.encryptedRecordCount === 2, 'Focused fixture must expose local encrypted Secret Vault readiness.');
const searchProvider = createSearchProvider({
  provider: 'deterministic',
  enabled: true,
  apiKey: rotatedSearchApiKey,
  apiKeySource: 'local-secret-vault',
  secretVaultStatus,
  endpoint: 'https://search.local/query',
  maxResults: 2,
});
const modelProvider = createModelProvider({
  provider: 'openai-compatible',
  enabled: true,
  apiKey: rotatedModelApiKey,
  apiKeySource: 'local-secret-vault',
  secretVaultStatus,
  baseURL: 'https://models.local/v1',
  fetchImpl: async () => new Response(JSON.stringify({
    id: 'focused-model-draft-1',
    model: 'gpt-4o-mini',
    choices: [{
      message: {
        content: JSON.stringify({
          title: 'Focused private-pilot product brief',
          summary: 'The model-backed product brief connects brainstorm, evidence, risk review, and handoff readiness for a generic product-team pilot.',
          body: '# Focused private-pilot product brief\n\nThis model-backed product brief keeps Research as a validation sample and verifies a generic product-team handoff. It connects brainstorm options, provider-backed evidence, reviewer judgement, revision closure, and explicit production blockers before private-pilot release freeze.',
          tags: ['private-pilot', 'product-team', 'handoff'],
        }),
      },
    }],
    usage: {
      prompt_tokens: 120,
      completion_tokens: 80,
      total_tokens: 200,
    },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }),
});
const providerPolicy = {
  enabled: true,
  mode: 'enforced',
  allowedModelProviders: ['openai-compatible'],
  allowedSearchProviders: ['deterministic'],
  allowedModels: ['gpt-4o-mini'],
  allowedSearchEndpointHosts: ['search.local'],
  maxRequestsPerProjectHour: 10,
  dailyBudgetCents: 200,
  searchCostCentsPerRequest: 1,
  retryAttempts: 1,
  retryBackoffMs: [0],
  defaultToolGrants: ['provider:test', 'model:kickoff', 'model:intent', 'model:artifact-draft'],
  agentToolGrants: {
    curie: ['search:evidence'],
  },
};
const projectRuntime = tempRoot
  ? createLocalProjectRuntime({
    rootPath: resolve(tempRoot, 'runtime'),
    enableCommandExecution: false,
  })
  : null;
const api = fileBackedFixture
  ? createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'store.json'),
    securityAuditLogPath: resolve(tempRoot, 'store.json.security-audit.jsonl'),
    replaceWithSeed: true,
    messageLimit: 360,
    projectRuntime,
    llmProvider: modelProvider,
    searchProvider,
    providerPolicy,
    secretVault,
  })
  : createAgentProjectApi({
    service: createAgentProjectService({
      messageLimit: 360,
      llmProvider: modelProvider,
      searchProvider,
      providerPolicy,
      secretVault,
    }),
  });
const request = (input) => api.handle(input);

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Inventor', skill: 'brainstorm synthesis' },
];

let response = request({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: `${projectId}_mission`,
    meetingId: `${projectId}_meeting`,
    projectId,
    name: projectName,
    missionBrief: 'Validate private-pilot handoff for a generic AI product-team project. Research is only a sample goal.',
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
assert(response.status === 200 && response.body.productTeamMissionRun?.missionType === 'generic-product-team', 'Mission Runner must create a generic product-team project.');
assert(response.body.productTeamMissionRun.researchOnly === false, 'Private-pilot handoff must not turn the product into a research-only workflow.');

response = await api.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/curie/evidence-searches`,
  body: {
    includeReadModels: false,
    query: 'generic product-team private-pilot handoff evidence',
    purpose: 'Curie collects controlled evidence for private-pilot handoff.',
    taskId: 'task_evidence',
    useProvider: true,
    maxResults: 2,
    findings: ['Evidence supports a private-pilot handoff package for the generic product-team chain.'],
    confidence: 'high',
    now: '2026-06-01T09:10:00.000Z',
  },
});
assert(response.status === 200 && response.body.evidenceSearch?.id, 'Evidence search must create a backend evidence node.');
assert(response.body.providerUsage?.operation === 'search:evidence', 'Provider-backed evidence search must write search usage proof.');
const evidenceSearch = response.body.evidenceSearch;

for (const sourceId of evidenceSearch.sources.map((source) => source.id)) {
  response = request({
    method: 'POST',
    path: `/projects/${projectId}/evidence-source-review-workflow`,
    body: {
      includeReadModels: false,
      evidenceSearchId: evidenceSearch.id,
      sourceId,
      reviewerAgentId: 'curie',
      decision: 'approved',
      comments: `Approved controlled source ${sourceId} for private-pilot handoff.`,
      now: '2026-06-01T09:11:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.evidenceSourceReview?.decision === 'approved', `${sourceId} must receive Reviewer source approval.`);
}

function submitArtifact(agentId, artifactType, title, body, extra = {}) {
  const result = request({
    method: 'POST',
    path: `/projects/${projectId}/agents/${agentId}/submissions`,
    body: {
      includeReadModels: false,
      artifactType,
      title,
      summary: title,
      body,
      reviewerAgentId: 'curie',
      now: '2026-06-01T09:20:00.000Z',
      ...extra,
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
    `${artifactType} must be a proofed Agent submission node.`,
  );
  return submission;
}

const discovery = submitArtifact('jobs', 'discovery-report', 'Focused discovery report', '# Discovery\n\nThis discovery report frames the customer goal, product-team outcome, proof surfaces, expected handoff package, and remaining public-production blockers for operator review.', { taskId: 'task_brainstorm' });
const brainstorm = submitArtifact('da_vinci', 'brainstorm-board', 'Focused brainstorm board', '# Brainstorm\n\nThe team compares a delivery trace, an evidence-first package, and a reviewer-led handoff path before selecting the strongest private-pilot direction.', { taskId: 'task_brainstorm' });
const evidencePacket = submitArtifact('curie', 'evidence-packet', 'Focused evidence packet', '# Evidence packet\n\nThis evidence packet records controlled sources, reviewer judgement, confidence, source safety, and downstream decisions for the private-pilot handoff package.', {
  taskId: 'task_evidence',
  sourceRefs: [{ type: 'evidence-search', id: evidenceSearch.id }],
  dependsOn: [evidenceSearch.id],
});
response = await api.handleAsync({
  method: 'POST',
  path: `/projects/${projectId}/agents/turing/artifact-drafts`,
  body: {
    includeReadModels: false,
    artifactType: 'product-brief',
    instruction: 'Draft a focused private-pilot handoff product brief from the brainstorm and evidence nodes.',
    taskId: 'task_brief',
    evidenceSearchIds: [evidenceSearch.id],
    priorSubmissionIds: [brainstorm.id, evidencePacket.id],
    useModel: true,
    requireModel: true,
    submit: true,
    reviewerAgentId: 'curie',
    now: '2026-06-01T09:18:00.000Z',
  },
});
assert(response.status === 200 && response.body.artifactDraft?.schemaVersion === 'agent-artifact-draft/v1', 'Product brief must be generated through the backend artifact-draft contract.');
assert(response.body.providerUsage?.operation === 'model:artifact-draft', 'Model-backed product brief must write model usage proof.');
const productBrief = response.body.submission;
assert(productBrief?.artifactType === 'product-brief' && productBrief.isGeneratedDraft && productBrief.artifactStorageProofChecksum, 'Generated product brief must submit as a proofed Agent artifact node.');
const decision = submitArtifact('jobs', 'decision-proposal', 'Focused decision proposal', '# Decision\n\nThe decision proposal selects the delivery-trace direction because it connects kickoff proof, brainstorm alternatives, evidence judgement, review closure, and handoff readiness.', {
  taskId: 'task_review',
  dependsOn: [discovery.id, brainstorm.id, evidencePacket.id, productBrief.id],
});
const risk = submitArtifact('curie', 'risk-review', 'Focused risk review', '# Risk\n\nThe risk review confirms the package is suitable for supervised private-pilot handoff while public production remains blocked by managed controls.', {
  taskId: 'task_review',
  dependsOn: [evidenceSearch.id, productBrief.id, decision.id],
});
const implementation = submitArtifact('turing', 'implementation-plan', 'Focused implementation plan', '# Implementation\n\nThe implementation plan maps backend contracts, proof routes, evidence archive checks, approval receipts, and launch blockers into an operator-readable plan.', {
  taskId: 'task_brief',
  dependsOn: [decision.id, risk.id],
});

response = request({
  method: 'POST',
  path: `/projects/${projectId}/submissions/${encodeURIComponent(productBrief.id)}/reviews`,
  body: {
    includeReadModels: false,
    reviewerAgentId: 'curie',
    verdict: 'changes-requested',
    comments: 'Link brainstorm, evidence, risk, and final handoff.',
    requestedChanges: ['Link proof nodes.', 'Name production blockers.'],
    now: '2026-06-01T09:30:00.000Z',
  },
});
assert(response.status === 200 && response.body.review?.verdict === 'changes-requested', 'Reviewer must request changes before final handoff.');
const requestedChangeReview = response.body.review;

const revision = submitArtifact('turing', 'revision-note', 'Focused revision note', '# Revision\n\nThe revision links brainstorm, evidence, product brief, risk review, implementation plan, requested changes, and final handoff package readiness.', {
  revisesSubmissionId: productBrief.id,
  respondsToReviewId: requestedChangeReview.id,
  dependsOn: [productBrief.id, requestedChangeReview.id],
});
const finalDeliverable = submitArtifact('turing', 'final-deliverable', 'Focused final deliverable', '# Final deliverable\n\nThe final deliverable closes the generic product-team chain and makes the private-pilot handoff package traceable through Flow Graph and Proof Map.', {
  status: 'final',
  revisesSubmissionId: revision.id,
  respondsToReviewId: requestedChangeReview.id,
  supersedesSubmissionIds: [productBrief.id, revision.id],
  dependsOn: [implementation.id, revision.id],
});

response = request({
  method: 'POST',
  path: `/projects/${projectId}/submissions/${encodeURIComponent(finalDeliverable.id)}/reviews`,
  body: {
    includeReadModels: false,
    reviewerAgentId: 'curie',
    verdict: 'accepted',
    comments: 'Accepted for focused private-pilot handoff validation.',
    now: '2026-06-01T09:40:00.000Z',
  },
});
assert(response.status === 200 && response.body.review?.verdict === 'accepted', 'Reviewer must accept the final deliverable.');

response = request({ method: 'GET', path: `/projects/${projectId}/artifact-quality-audit` });
assert(
  response.status === 200 && response.body.artifactQualityAudit?.readyForLocalPilot === true,
  `Artifact Quality Audit must be local-ready before private-pilot handoff. failed=${JSON.stringify(response.body.artifactQualityAudit?.failedLocalDecisionGates || response.body.artifactQualityAudit?.gates?.filter((gate) => !gate.passed) || []).slice(0, 1200)}`,
);

response = request({ method: 'GET', path: `/projects/${projectId}/project-evidence-archive` });
assert(
  response.status === 200 && response.body.projectEvidenceArchive?.readyForManagerHandoff === true,
  `Evidence archive must be ready before private-pilot handoff export. status=${response.body.projectEvidenceArchive?.status || response.status} failed=${JSON.stringify(response.body.projectEvidenceArchive?.integrity?.failedGates || response.body.projectEvidenceArchive?.integrity?.gates?.filter((gate) => !gate.passed) || []).slice(0, 1200)}`,
);
assert(response.body.projectEvidenceArchive.readyForProduction === false, 'Evidence archive must keep public production blocked.');

if (stopBeforeEvidenceExport) {
  assert(fileBackedFixture === true && api.store, 'Focused UI prep must use the file-backed API so security, replay, and browser readback proof are persisted.');
  response = request({
    method: 'POST',
    path: `/projects/${projectId}/provider-eval-runs`,
    body: {
      includeReadModels: false,
      mode: 'shadow-replay',
      actorRole: 'runtime-platform',
      actorId: 'focused-ui-prep-provider-eval',
      reason: 'Record focused provider eval shadow replay before Manager private-pilot UI receipts.',
      now: '2026-06-01T09:50:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.providerEvalRun?.readyForPrivatePilotProviderEval === true, 'Focused UI prep must record provider eval readiness before browser release-candidate receipts.');

  const signedApi = createAgentProjectApi({
    service: api.service,
    accessControl: {
      signingSecret: ACCESS_SIGNING_SECRET,
      replayStore: api.store,
    },
  });
  const signedSecurityPath = `/projects/${projectId}/security-boundary`;
  response = signedApi.handle({
    method: 'GET',
    path: signedSecurityPath,
    headers: {
      'x-hofs-access-mode': 'enforced',
      'x-hofs-role': 'security-admin',
      'x-hofs-user-id': 'security-lead',
    },
  });
  assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-missing', 'Focused UI prep must prove unsigned enforced security reads fail closed.');
  response = signedApi.handle({
    method: 'GET',
    path: signedSecurityPath,
    headers: signedHeadersFor({ method: 'GET', path: signedSecurityPath }),
  });
  assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Focused UI prep must prove signed security reads before browser release-candidate receipts.');
  const tamperedHeaders = signedHeadersFor({ method: 'GET', path: signedSecurityPath });
  tamperedHeaders['x-hofs-role'] = 'observer';
  response = signedApi.handle({
    method: 'GET',
    path: signedSecurityPath,
    headers: tamperedHeaders,
  });
  assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-invalid', 'Focused UI prep must prove tampered signed identity headers fail closed.');

  const membershipPolicyPath = `/projects/${projectId}/membership-policy`;
  response = signedApi.handle({
    method: 'PUT',
    path: membershipPolicyPath,
    headers: signedHeadersFor({ method: 'PUT', path: membershipPolicyPath }),
    body: {
      includeReadModels: false,
      policy: {
        schemaVersion: 'project-membership-policy/v1',
        projectId,
        source: 'focused-private-pilot-ui-prep-membership-fixture',
        managerUserIds: ['director'],
        securityAdminUserIds: ['security-lead'],
        operationsOwnerUserIds: ['ops-lead'],
        observerUserIds: ['observer'],
        runtimeUserIds: ['runtime-ops'],
        agentIds: ['jobs', 'curie', 'turing', 'da_vinci'],
        reviewerAgentIds: ['curie'],
        agentUserIds: {
          jobs: ['agent-runtime-jobs'],
          curie: ['agent-runtime-curie'],
          turing: ['agent-runtime-turing'],
          da_vinci: ['agent-runtime-da_vinci'],
        },
        reviewerUserIds: {
          curie: ['agent-runtime-curie'],
        },
      },
      updatedBy: 'security-lead',
      source: 'focused-private-pilot-ui-prep-membership-fixture',
      now: '2026-06-01T10:03:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', 'Focused UI prep must persist project membership policy proof.');

  const identitySessionsPath = `/projects/${projectId}/identity-sessions`;
  response = signedApi.handle({
    method: 'POST',
    path: identitySessionsPath,
    headers: signedHeadersFor({ method: 'POST', path: identitySessionsPath }),
    body: {
      includeReadModels: false,
      role: 'security-admin',
      userId: 'security-lead',
      issuerRole: 'security-admin',
      issuerId: 'security-lead',
      ttlMs: 60 * 60 * 1000,
      scope: ['project', 'security-boundary'],
      source: 'focused-private-pilot-ui-prep-identity-session',
    },
  });
  assert(response.status === 200 && response.body.identitySession?.status === 'active', 'Focused UI prep must issue an active local identity-session proof.');

  const replayApi = createAgentProjectApi({
    service: api.service,
    accessControl: {
      signingSecret: ACCESS_SIGNING_SECRET,
      requireSignedRequestIds: true,
      replayStore: api.store,
    },
  });
  const replayHeaders = signedHeadersFor({
    method: 'GET',
    path: signedSecurityPath,
    requestId: 'focused-private-pilot-ui-prep-security-boundary-replay',
  });
  response = replayApi.handle({
    method: 'GET',
    path: signedSecurityPath,
    headers: replayHeaders,
  });
  assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Focused UI prep must allow first replay-protected security request.');
  response = replayApi.handle({
    method: 'GET',
    path: signedSecurityPath,
    headers: replayHeaders,
  });
  assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-replay-detected', 'Focused UI prep must persist replay protection evidence.');

  response = request({ method: 'GET', path: `/projects/${projectId}/security-audit-stream` });
  assert(response.status === 200 && response.body.securityAuditStream?.hashChainReady === true, 'Focused UI prep must create a hash-chain-ready security audit stream.');

  response = request({ method: 'GET', path: `/projects/${projectId}/deployment-preflight` });
  assert(response.status === 200 && response.body.deploymentPreflight?.privatePilotDeploymentReady === true, 'Focused UI prep must satisfy private-pilot deployment preflight before browser release-candidate receipts.');
  response = request({ method: 'GET', path: `/projects/${projectId}/production-launch-audit` });
  const failedPrivatePilotGateIds = new Set((response.body.productionLaunchAudit?.failedPrivatePilotGates || []).map((gate) => gate.id));
  assert(!failedPrivatePilotGateIds.has('deployment-preflight-private-ready'), 'Focused UI prep must clear the deployment preflight private-pilot blocker.');
  assert(!failedPrivatePilotGateIds.has('security-provider-operations-local-ready'), 'Focused UI prep must clear the security/provider/operations local-readiness blocker.');

  response = request({ method: 'GET', path: `/projects/${projectId}/launch-approvals` });
  assert(
    response.status === 200
      && response.body.launchApprovalWorkflow?.readyForPrivatePilot === false
      && (response.body.launchApprovalWorkflow?.summary?.approvalCount || 0) === 0,
    'Focused UI prep must stop before private-pilot launch approvals are recorded.',
  );
  response = request({ method: 'GET', path: `/projects/${projectId}/project-evidence-exports` });
  assert(
    response.status === 200
      && response.body.projectEvidenceExportWorkflow?.readyForPrivatePilotHandoff === false
      && (response.body.projectEvidenceExportWorkflow?.summary?.requestCount || 0) === 0,
    'Focused UI prep must stop before project evidence export is requested.',
  );
  console.log('Private-pilot handoff focused UI prep validation passed.');
  process.exit(0);
}

const exportPath = `/projects/${projectId}/project-evidence-exports`;
response = request({
  method: 'POST',
  path: exportPath,
  body: {
    action: 'request',
    mode: 'private-pilot',
    actorRole: 'manager',
    actorId: 'director',
    reason: 'Request focused private-pilot customer handoff package.',
    retentionDays: 30,
    dataResidencyRegion: 'local-private-pilot',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.projectEvidenceExport?.schemaVersion === 'project-evidence-export/v1', 'Manager must request a governed evidence export.');
const exportRequestId = response.body.projectEvidenceExport.exportRequestId;

for (const approval of [
  { role: 'manager', userId: 'director' },
  { role: 'security-admin', userId: 'security-lead' },
]) {
  response = request({
    method: 'POST',
    path: exportPath,
    body: {
      action: 'approve',
      mode: 'private-pilot',
      exportRequestId,
      actorRole: approval.role,
      actorId: approval.userId,
      reason: `${approval.role} approves focused private-pilot handoff.`,
      includeReadModels: false,
    },
  });
  assert(response.status === 200 && response.body.projectEvidenceExport?.decision === 'approved', `${approval.role} must approve the evidence export.`);
}
assert(response.body.projectEvidenceExportWorkflow?.readyForPrivatePilotHandoff === true, 'Evidence export workflow must become private-pilot handoff ready after approvals.');
assert(response.body.projectEvidenceExportWorkflow.readyForProductionExport === false, 'Evidence export workflow must keep production export blocked.');

response = request({
  method: 'POST',
  path: exportPath,
  body: {
    action: 'download-audit',
    mode: 'private-pilot',
    exportRequestId,
    actorRole: 'manager',
    actorId: 'director',
    reason: 'Record focused private-pilot package handoff after approvals.',
    includeReadModels: false,
  },
});
assert(response.status === 200 && response.body.projectEvidenceExport?.action === 'download-audit', 'Manager must record a governed download audit.');
assert(response.body.projectEvidenceExportWorkflow?.readyForPrivatePilotDownload === true, 'Evidence export workflow must become local package ready after download audit.');
assert(response.body.projectEvidenceExportPackage?.readyForPrivatePilotDownload === true, 'Evidence export package must be ready for private-pilot download.');
assert(response.body.projectEvidenceExportPackage.readyForProductionDownload === false, 'Evidence export package must not issue production download readiness.');
assert(response.body.projectEvidenceExportPackage.downloadUrlIssued === false, 'Evidence export package must not issue a production URL.');
assert(response.body.projectEvidenceExportPackage.watermark?.checksum, 'Evidence export package must include watermark proof.');

response = request({ method: 'GET', path: `${exportPath}/${encodeURIComponent(exportRequestId)}/package` });
assert(response.status === 200 && response.body.projectEvidenceExportPackage?.exportRequestId === exportRequestId, 'Package route must read back the requested export package.');

const readyPackage = request({ method: 'GET', path: `/projects/${projectId}/manager-ready-package` });
assert(readyPackage.status === 200 && readyPackage.body.summary?.projectEvidenceExportDownloadReady === true, 'Manager Ready Package must expose private-pilot handoff package readiness.');
assert(readyPackage.body.productionLaunchAudit?.projectEvidenceHandoff?.readyForPrivatePilotPackage === true, 'Production Launch Audit must show the handoff package ready while production remains blocked.');
assert(readyPackage.body.productionLaunchAudit.productionDecision === 'no-go', 'Production Launch Audit must keep public production no-go.');

const proofMap = request({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assert(proofMap.status === 200 && proofMap.body.projectEvidenceExportRoutes?.some((route) => route.apiPath?.endsWith('/project-evidence-exports')), 'Readiness Proof Map must expose project evidence export routes.');

const flowGraph = request({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
const flowText = asText(flowGraph.body);
assert(flowGraph.status === 200 && flowText.includes('project-evidence-export'), 'Manager Flow Graph must include project evidence export handoff nodes.');
assert(flowText.includes(finalDeliverable.id), 'Manager Flow Graph must preserve final deliverable proof through handoff.');

console.log('Private-pilot handoff focused contract validation passed.');

export {
  api,
  request,
  projectId,
  fileBackedFixture,
  tempRoot,
  exportRequestId,
  finalDeliverable,
};
