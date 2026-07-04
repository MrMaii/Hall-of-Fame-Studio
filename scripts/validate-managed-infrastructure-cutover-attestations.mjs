import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signAgentProjectAccessHeaders } from '../src/agents/accessControl.js';
import { createAdapterGatewayServer } from '../src/agents/adapterGatewayServer.js';
import { createAdapterGatewayPostgresStore } from '../src/agents/adapterGatewayStore.js';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function gateDetails(model = {}) {
  return (model.failedGates || model.gates || [])
    .filter((gate) => gate && gate.passed === false)
    .map((gate) => `${gate.id || 'gate'}: ${gate.detail || gate.issue || 'failed'}`)
    .join('; ');
}

function signedHeaders({ method = 'GET', path, role = 'security-admin', userId = 'security-lead', agentId = '', requestId } = {}) {
  return signAgentProjectAccessHeaders({
    method,
    path,
    role,
    userId,
    agentId,
    requestId,
    secret: accessSigningSecret,
    signedAt: new Date().toISOString(),
  });
}

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Inventor', skill: 'brainstorm synthesis' },
];

const llmProvider = {
  status() {
    return {
      provider: 'openai-compatible',
      enabled: true,
      configured: true,
      hasApiKey: true,
      apiKeySource: 'validation-stub',
      model: 'gpt-4o-mini',
    };
  },
  async createChatCompletion() {
    const json = {
      title: 'Managed infrastructure cutover validation brief',
      summary: 'A model-backed product-team brief for validating the managed infrastructure cutover bridge.',
      body: [
        '# Managed infrastructure cutover validation brief',
        '',
        'This draft ties provider-backed evidence, brainstorm alternatives, reviewer feedback, revision proof, final delivery, and production blockers into one generic product-team workflow.',
        '',
        'It remains blocked for public production until managed identity, persistence, queueing, provider audit, centralized observability, and launch approvals are proven.',
      ].join('\n'),
      tags: ['product-team', 'managed-infrastructure', 'cutover-proof'],
    };
    return {
      ok: true,
      provider: 'openai-compatible',
      model: 'gpt-4o-mini',
      content: JSON.stringify(json),
      json,
      usage: { promptTokens: 12, completionTokens: 24, totalTokens: 36 },
    };
  },
};

const searchProvider = {
  status() {
    return {
      provider: 'deterministic',
      enabled: true,
      configured: true,
      hasApiKey: false,
      apiKeySource: 'not-required',
      maxResults: 3,
    };
  },
  async search({ query, purpose, now, maxResults = 3 } = {}) {
    return {
      ok: true,
      provider: 'deterministic',
      searchMode: 'deterministic-validation',
      confidence: 'high',
      findings: ['Controlled search result supports the generic product-team cutover validation path.'],
      sources: [1, 2, 3].slice(0, maxResults).map((index) => ({
        id: `managed-infra-cutover-source-${index}`,
        title: `Managed infrastructure cutover source ${index}`,
        url: `https://example.test/managed-infra-cutover/${index}`,
        summary: `${purpose || query || now || 'cutover'} source ${index} is controlled validation evidence.`,
        confidence: 'high',
        kind: 'evidence-report',
      })),
    };
  },
};

function request(api, input, message) {
  const response = api.handle(input);
  assert(response.status === 200, `${message} returned ${response.status}.`);
  return response.body;
}

async function requestAsync(api, input, message) {
  const response = await api.handleAsync(input);
  assert(response.status === 200, `${message} returned ${response.status}.`);
  return response.body;
}

function submitArtifact(api, {
  agentId,
  artifactType,
  title,
  summary,
  body,
  taskId = null,
  reviewerAgentId = 'curie',
  sourceRefs = [],
  dependsOn = [],
  status,
  revisesSubmissionId,
  respondsToReviewId,
  now,
}) {
  const result = request(api, {
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
      status,
      revisesSubmissionId,
      respondsToReviewId,
      now,
    },
  }, `${artifactType} submission`);
  assert(result.submission?.artifactType === artifactType && result.submission.artifactStorageProofChecksum, `${artifactType} must persist as a proofed Agent artifact.`);
  return result.submission;
}

async function prepareCutoverValidationProject(api) {
  request(api, {
    method: 'POST',
    path: '/product-team-missions',
    body: {
      includeReadModels: false,
      missionId: 'managed_infra_cutover_mission',
      meetingId: 'managed_infra_cutover_meeting',
      projectId,
      name: 'Managed Infrastructure Cutover Attestation Project',
      missionBrief: 'Validate backend bridge from private adapter gateway attestations into managed infrastructure cutover receipts.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      tasks: [
        { id: 'task_brainstorm', text: 'Create generic product-team brainstorm alternatives.', assignee: 'Leonardo da Vinci', status: 'pending' },
        { id: 'task_evidence', text: 'Collect and judge evidence for the strongest direction.', assignee: 'Marie Curie', status: 'pending' },
        { id: 'task_brief', text: 'Draft a manager-readable product brief.', assignee: 'Alan Turing', status: 'pending' },
        { id: 'task_review', text: 'Review, revise, and accept the final deliverable.', assignee: 'Marie Curie', status: 'pending' },
      ],
      runInitialTick: false,
      now: '2026-06-01T09:00:00.000Z',
    },
  }, 'Product-team mission');

  request(api, {
    method: 'POST',
    path: `/projects/${projectId}/meeting`,
    body: {
      includeReadModels: false,
      text: 'War Room: confirm brainstorm, provider-backed evidence, draft, review, revision, final deliverable, and managed cutover proof responsibilities.',
      now: '2026-06-01T09:05:00.000Z',
    },
  }, 'Backend meeting');

  const evidenceResult = await requestAsync(api, {
    method: 'POST',
    path: `/projects/${projectId}/agents/curie/evidence-searches`,
    body: {
      includeReadModels: false,
      useProvider: true,
      query: 'managed infrastructure cutover validation evidence',
      purpose: 'Curie collects provider-backed evidence for the generic product-team cutover bridge.',
      taskId: 'task_evidence',
      maxResults: 3,
      now: '2026-06-01T09:10:00.000Z',
    },
  }, 'Provider-backed evidence search');
  const evidenceSearch = evidenceResult.evidenceSearch;
  assert(evidenceSearch?.id && evidenceResult.providerReceipt?.id && evidenceResult.providerUsage?.operation === 'search:evidence', 'Evidence search must create provider receipt and usage proof.');

  for (const source of evidenceSearch.sources || []) {
    request(api, {
      method: 'POST',
      path: `/projects/${projectId}/evidence-source-review-workflow`,
      body: {
        includeReadModels: false,
        evidenceSearchId: evidenceSearch.id,
        sourceId: source.id,
        reviewerAgentId: 'curie',
        decision: 'approved',
        comments: 'Approved controlled source for managed cutover validation.',
        now: '2026-06-01T09:11:00.000Z',
      },
    }, 'Evidence source review');
  }

  const discoverySubmission = submitArtifact(api, {
    agentId: 'jobs',
    artifactType: 'discovery-report',
    title: 'Managed cutover discovery report',
    summary: 'Discovery report frames the customer goal, proof surfaces, and production blockers.',
    body: '# Managed cutover discovery report\n\nThe product-team goal is to prove the bridge from private gateway attestation to Manager-visible production evidence without turning this into a research-only workflow.',
    taskId: 'task_brainstorm',
    now: '2026-06-01T09:12:00.000Z',
  });
  const evidencePacketSubmission = submitArtifact(api, {
    agentId: 'curie',
    artifactType: 'evidence-packet',
    title: 'Managed cutover evidence packet',
    summary: 'Evidence packet links provider search, source review, and downstream decisions.',
    body: '# Managed cutover evidence packet\n\nThe evidence packet links controlled sources, confidence judgement, source snapshots, and downstream cutover decisions.',
    taskId: 'task_evidence',
    sourceRefs: [{ type: 'evidence-search', id: evidenceSearch.id, route: `/projects/${projectId}/evidence-searches/${evidenceSearch.id}` }],
    dependsOn: [evidenceSearch.id],
    now: '2026-06-01T09:13:00.000Z',
  });
  const brainstormSubmission = submitArtifact(api, {
    agentId: 'da_vinci',
    artifactType: 'brainstorm-board',
    title: 'Managed cutover brainstorm board',
    summary: 'Multiple product-team directions for safe cutover proof.',
    body: '# Managed cutover brainstorm board\n\n1. Keep gateway attestation separate from launch approval.\n2. Require project dry-runs before writing production evidence.\n3. Keep Manager proof routes visible.',
    taskId: 'task_brainstorm',
    now: '2026-06-01T09:15:00.000Z',
  });

  const draftResult = await requestAsync(api, {
    method: 'POST',
    path: `/projects/${projectId}/agents/turing/artifact-drafts`,
    body: {
      includeReadModels: false,
      artifactType: 'product-brief',
      instruction: 'Draft a manager-readable generic product-team brief from the cutover evidence and brainstorm nodes.',
      taskId: 'task_brief',
      evidenceSearchIds: [evidenceSearch.id],
      priorSubmissionIds: [discoverySubmission.id, evidencePacketSubmission.id, brainstormSubmission.id],
      useModel: true,
      submit: true,
      reviewerAgentId: 'curie',
      now: '2026-06-01T09:20:00.000Z',
    },
  }, 'Model-backed artifact draft');
  const productBriefSubmission = draftResult.submission;
  assert(
    productBriefSubmission?.artifactType === 'product-brief'
      && draftResult.artifactDraft?.source === 'model-artifact-draft',
    `Model draft must use model provider provenance. Status: ${JSON.stringify(draftResult.modelProviderStatus || {})}`,
  );

  const decisionProposalSubmission = submitArtifact(api, {
    agentId: 'jobs',
    artifactType: 'decision-proposal',
    title: 'Managed cutover decision proposal',
    summary: 'Decision proposal selects the signed-gateway-attestation bridge with project dry-run guardrails.',
    body: '# Managed cutover decision proposal\n\nUse signed gateway attestations only after project persistence and queue dry-runs pass, then project receipt evidence into Manager proof surfaces.',
    taskId: 'task_review',
    dependsOn: [discoverySubmission.id, evidencePacketSubmission.id, brainstormSubmission.id, productBriefSubmission.id],
    now: '2026-06-01T09:21:00.000Z',
  });
  const riskReviewSubmission = submitArtifact(api, {
    agentId: 'curie',
    artifactType: 'risk-review',
    title: 'Managed cutover risk review',
    summary: 'Risk review records evidence limits, production blockers, and reviewer concerns.',
    body: '# Managed cutover risk review\n\nThe main risk is overclaiming public production readiness from gateway-local proof. The route must fail closed and keep unrelated launch gates blocked.',
    taskId: 'task_review',
    dependsOn: [evidenceSearch.id, productBriefSubmission.id, decisionProposalSubmission.id],
    now: '2026-06-01T09:22:00.000Z',
  });
  submitArtifact(api, {
    agentId: 'turing',
    artifactType: 'implementation-plan',
    title: 'Managed cutover implementation plan',
    summary: 'Implementation plan maps backend contracts, proof routes, validation gates, and launch blockers.',
    body: '# Managed cutover implementation plan\n\nImplement the bridge in agentProjectService/API, require adapter dry-runs, persist receipt evidence, and verify Flow/Proof visibility.',
    taskId: 'task_brief',
    dependsOn: [decisionProposalSubmission.id, riskReviewSubmission.id],
    now: '2026-06-01T09:23:00.000Z',
  });

  const reviewResult = request(api, {
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
  }, 'Product brief review');
  const revisionSubmission = submitArtifact(api, {
    agentId: 'turing',
    artifactType: 'revision-note',
    title: 'Managed cutover revision note',
    summary: 'Revision links evidence, brainstorm, blockers, and final delivery.',
    body: '# Managed cutover revision note\n\nThis revision links the evidence search, brainstorm board, product brief, and production blockers.',
    reviewerAgentId: 'curie',
    revisesSubmissionId: productBriefSubmission.id,
    respondsToReviewId: reviewResult.review.id,
    now: '2026-06-01T09:30:00.000Z',
  });
  const finalSubmission = submitArtifact(api, {
    agentId: 'turing',
    artifactType: 'final-deliverable',
    title: 'Final managed cutover validation package',
    summary: 'Final package closes kickoff, evidence, brainstorm, draft, review, revision, and proof routes.',
    body: '# Final managed cutover validation package\n\nThe generic product-team chain is complete and traceable through Flow Graph, Proof Map, transcript, timeline, and event ledger.',
    status: 'final',
    reviewerAgentId: 'curie',
    revisesSubmissionId: revisionSubmission.id,
    respondsToReviewId: reviewResult.review.id,
    dependsOn: [revisionSubmission.id, productBriefSubmission.id],
    now: '2026-06-01T09:35:00.000Z',
  });
  request(api, {
    method: 'POST',
    path: `/projects/${projectId}/submissions/${encodeURIComponent(finalSubmission.id)}/reviews`,
    body: {
      includeReadModels: false,
      reviewerAgentId: 'curie',
      verdict: 'accepted',
      comments: 'Accepted: managed cutover validation is traceable end to end.',
      now: '2026-06-01T09:40:00.000Z',
    },
  }, 'Final deliverable review');

  request(api, {
    method: 'POST',
    path: `/projects/${projectId}/provider-eval-runs`,
    body: {
      includeReadModels: false,
      mode: 'shadow-replay',
      actorRole: 'runtime-platform',
      actorId: 'provider-eval-cutover-harness',
      reason: 'Record controlled provider shadow replay for managed cutover validation.',
      now: '2026-06-01T10:00:00.000Z',
    },
  }, 'Provider eval run');

  request(api, {
    method: 'PUT',
    path: `/projects/${projectId}/membership-policy`,
    body: {
      includeReadModels: false,
      updatedBy: 'security-lead',
      source: 'managed-cutover-membership-validation',
      now: '2026-06-01T10:05:00.000Z',
      policy: {
        schemaVersion: 'project-membership-policy/v1',
        projectId,
        source: 'managed-cutover-membership-validation',
        managerUserIds: ['director'],
        securityAdminUserIds: ['security-lead'],
        operationsOwnerUserIds: ['ops-lead'],
        observerUserIds: ['observer'],
        runtimeUserIds: ['runtime-ops'],
        agentIds: team.map((member) => member.id),
        reviewerAgentIds: ['curie'],
        agentUserIds: Object.fromEntries(team.map((member) => [member.id, [`agent-runtime-${member.id}`]])),
        reviewerUserIds: { curie: ['agent-runtime-curie'] },
      },
    },
  }, 'Membership policy');

  const sessionResult = request(api, {
    method: 'POST',
    path: `/projects/${projectId}/identity-sessions`,
    body: {
      includeReadModels: false,
      role: 'security-admin',
      userId: 'security-lead',
      issuerRole: 'manager',
      issuerId: 'director',
      source: 'managed-cutover-identity-session-validation',
      now: '2026-06-01T10:06:00.000Z',
    },
  }, 'Identity session');

  const securityPath = `/projects/${projectId}/security-boundary`;
  const securityRead = api.handle({
    method: 'GET',
    path: securityPath,
    headers: signedHeaders({ method: 'GET', path: securityPath, requestId: 'managed-cutover-security-boundary-allow' }),
  });
  assert(securityRead.status === 200, `Signed security boundary read returned ${securityRead.status}: ${JSON.stringify(securityRead.body?.accessDecision || securityRead.body || {})}`);
  const agentPath = `/projects/${projectId}/agents/jobs/dashboard`;
  request(api, {
    method: 'GET',
    path: agentPath,
    headers: signedHeaders({ method: 'GET', path: agentPath, role: 'agent', agentId: 'jobs', userId: 'agent-runtime-jobs', requestId: 'managed-cutover-agent-dashboard-allow' }),
  }, 'Signed Agent dashboard read');
  const forbiddenPath = `/projects/${projectId}/agents/curie/dashboard`;
  const denied = api.handle({
    method: 'GET',
    path: forbiddenPath,
    headers: signedHeaders({ method: 'GET', path: forbiddenPath, role: 'agent', agentId: 'jobs', userId: 'agent-runtime-jobs', requestId: 'managed-cutover-agent-dashboard-deny' }),
  });
  assert(denied.status === 403, 'Signed cross-Agent dashboard read must be denied for access audit proof.');

  request(api, {
    method: 'POST',
    path: `/projects/${projectId}/worker-queue`,
    body: {
      includeReadModels: false,
      now: '2026-06-01T10:10:00.000Z',
      forceDue: true,
      forceProjectIds: [projectId],
      maxAgentsPerProject: team.length,
      maxProjects: 1,
    },
  }, 'Worker queue snapshot');

  const persistenceSnapshot = request(api, { method: 'GET', path: `/projects/${projectId}/persistence-snapshot` }, 'Persistence snapshot').persistenceSnapshot;
  assert(persistenceSnapshot?.integrity?.status === 'ready', `Prepared project persistence snapshot must be ready. ${JSON.stringify(persistenceSnapshot?.integrity || {})}`);
  assert(!JSON.stringify(persistenceSnapshot).includes(modelSecret), 'Prepared project snapshot must not leak the model secret.');
  assert(!JSON.stringify(persistenceSnapshot).includes(sessionResult.token), 'Prepared project snapshot must not leak raw identity session token.');
}

function parseJson(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', 'managed-infrastructure-cutover-attestations-validate');
const projectId = 'managed_infrastructure_cutover_attestation_project';
const authToken = 'MANAGED_INFRA_CUTOVER_GATEWAY_TOKEN';
const signingSecret = 'MANAGED_INFRA_CUTOVER_SIGNING_SECRET_SHOULD_NOT_LEAK';
const accessSigningSecret = 'MANAGED_INFRA_CUTOVER_ACCESS_SIGNING_SECRET';
const modelSecret = 'MANAGED_INFRA_CUTOVER_MODEL_KEY_SHOULD_NOT_LEAK';
const envKeys = [
  'ADAPTER_GATEWAY_HTTP_ENDPOINT',
  'ADAPTER_GATEWAY_AUTH_TOKEN',
  'ADAPTER_GATEWAY_TIMEOUT_MS',
  'MANAGED_PERSISTENCE_ADAPTER_DRIVER',
  'MANAGED_PERSISTENCE_HTTP_ENDPOINT',
  'WORKER_QUEUE_ADAPTER_DRIVER',
  'WORKER_QUEUE_HTTP_ENDPOINT',
  'MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET',
  'PRODUCTION_ATTESTATION_SIGNING_SECRET',
  'MODEL_PROVIDER',
  'MODEL_API_KEY',
  'MODEL_PROVIDER_ENABLED',
  'SEARCH_PROVIDER',
  'SEARCH_PROVIDER_ENABLED',
];
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
const fakeDatabase = {
  tableRecords: new Map(),
  queueRows: new Map(),
  queueLeases: new Map(),
  deadLetters: new Map(),
  dryRuns: new Map(),
  snapshots: [],
};

const query = async (text, values, operation) => {
  if (operation.name === 'upsert-table-record') {
    fakeDatabase.tableRecords.set(`${values[0]}:${values[1]}:${values[2]}`, parseJson(values[3]));
  }
  if (operation.name === 'upsert-queue-row') {
    fakeDatabase.queueRows.set(`${values[0]}:${values[1]}`, parseJson(values[2]));
  }
  if (operation.name === 'upsert-queue-lease') {
    fakeDatabase.queueLeases.set(`${values[0]}:${values[1]}`, parseJson(values[3]));
  }
  if (operation.name === 'upsert-dead-letter') {
    fakeDatabase.deadLetters.set(`${values[0]}:${values[1]}`, parseJson(values[2]));
  }
  if (operation.name === 'insert-persistence-dry-run') {
    fakeDatabase.dryRuns.set(values[0], { kind: 'persistence', receipt: parseJson(values[2]) });
  }
  if (operation.name === 'insert-worker-queue-dry-run') {
    fakeDatabase.dryRuns.set(values[0], { kind: 'worker-queue', receipt: parseJson(values[2]) });
  }
  if (operation.name === 'insert-state-snapshot') {
    fakeDatabase.snapshots.push({
      snapshotId: values[0],
      state: parseJson(values[1]),
      stateChecksum: values[2],
    });
  }
  if (operation.name === 'readback-state-snapshot') {
    const latest = fakeDatabase.snapshots.at(-1);
    return latest
      ? { rowCount: 1, rows: [{ state: latest.state, stateChecksum: latest.stateChecksum }] }
      : { rowCount: 0, rows: [] };
  }
  if (operation.name === 'readback-store-counts') {
    return {
      rowCount: 1,
      rows: [{
        tableRecordCount: fakeDatabase.tableRecords.size,
        queueRowCount: fakeDatabase.queueRows.size,
        leaseCount: fakeDatabase.queueLeases.size,
        deadLetterCount: fakeDatabase.deadLetters.size,
        persistenceDryRunCount: [...fakeDatabase.dryRuns.values()].filter((row) => row.kind === 'persistence').length,
        workerQueueDryRunCount: [...fakeDatabase.dryRuns.values()].filter((row) => row.kind === 'worker-queue').length,
      }],
    };
  }
  return { rowCount: 1, rows: [] };
};

function resetGatewayEnv() {
  for (const key of envKeys) delete process.env[key];
}

function restoreEnv() {
  for (const [key, value] of originalEnv.entries()) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
resetGatewayEnv();
process.env.MODEL_PROVIDER = 'openai-compatible';
process.env.MODEL_API_KEY = modelSecret;
process.env.MODEL_PROVIDER_ENABLED = 'true';
process.env.SEARCH_PROVIDER = 'deterministic';
process.env.SEARCH_PROVIDER_ENABLED = 'true';

const gateway = createAdapterGatewayServer({
  storeAdapter: createAdapterGatewayPostgresStore({
    databaseUrl: 'postgres://gateway_user:secret_password@localhost:5432/hofs',
    schema: 'hofs_gateway_cutover_validation',
    query,
  }),
  authToken,
  productionAttestationSigningSecret: signingSecret,
});
let gatewayRuntime = null;

try {
  const api = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'store.json'),
    replaceWithSeed: true,
    llmProvider,
    searchProvider,
    accessControl: {
      signingSecret: accessSigningSecret,
      requireSignedRequestIds: true,
    },
  });

  await prepareCutoverValidationProject(api);

  let response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/managed-infrastructure-cutover-attestations`,
    body: { includeReadModels: false },
  });
  assert(response.status === 200, `Missing-gateway cutover attestation route returned ${response.status}.`);
  assert(response.body.managedInfrastructureCutoverAttestationRun?.status === 'adapter-gateway-endpoint-missing', 'Cutover attestation route must fail closed without a gateway endpoint.');
  assert(!response.body.productionOperationsControlReceipt, 'Missing gateway must not write production operations receipt evidence.');

  gatewayRuntime = await gateway.listen({ port: 0 });
  process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT = gatewayRuntime.url;
  process.env.ADAPTER_GATEWAY_AUTH_TOKEN = authToken;
  process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER = 'http-json';
  process.env.WORKER_QUEUE_ADAPTER_DRIVER = 'http-json';
  process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = signingSecret;

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/managed-infrastructure-cutover-attestations`,
    body: { includeReadModels: false },
  });
  assert(response.status === 200, `Pre-readback cutover attestation route returned ${response.status}.`);
  assert(response.body.managedInfrastructureCutoverAttestationRun?.status === 'managed-production-attestation-not-ready', 'Gateway must not issue project cutover evidence before readback parity.');
  assert(!response.body.productionOperationsControlReceipt, 'Attestation-not-ready state must not write production operations receipt evidence.');

  response = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/persistence-adapter-dry-run`,
  });
  assert(
    response.status === 200 && response.body.persistenceAdapterDryRun?.status === 'passed',
    `Gateway-backed persistence dry-run must pass. ${gateDetails(response.body.persistenceAdapterDryRun)}`,
  );
  assert(response.body.persistenceAdapterDryRun.summary?.adapterProductionCutoverReady === false, 'Persistence dry-run alone must still not claim production cutover.');

  response = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/worker-queue-adapter-dry-run`,
  });
  assert(
    response.status === 200 && response.body.workerQueueAdapterDryRun?.status === 'passed',
    `Gateway-backed worker queue dry-run must pass. ${gateDetails(response.body.workerQueueAdapterDryRun)}`,
  );
  assert(response.body.workerQueueAdapterDryRun.summary?.adapterProductionCutoverReady === false, 'Worker queue dry-run alone must still not claim production cutover.');

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/managed-infrastructure-cutover-attestations`,
    body: {
      includeReadModels: false,
      actorRole: 'operations-owner',
      actorId: 'ops-lead',
      actorName: 'Operations Lead',
      reason: 'Attach signed managed-production gateway attestations after query-bound readback parity.',
    },
  });
  assert(response.status === 200, `Cutover attestation route returned ${response.status}.`);
  const run = response.body.managedInfrastructureCutoverAttestationRun;
  assert(run?.schemaVersion === 'managed-infrastructure-cutover-attestation-run/v1', 'Cutover attestation run must expose its schema.');
  assert(
    run.status === 'managed-infrastructure-cutover-attested' && run.localProofCreated === true,
    `Cutover attestation run must create proof only after signed gateway attestations. Actual: ${JSON.stringify({ status: run.status, blocker: run.blocker, projectDryRunSummary: run.projectDryRunSummary })}`,
  );
  assert(run.attestedControlIds?.includes('managed-persistence-cutover') && run.attestedControlIds?.includes('managed-worker-queue-cutover'), 'Cutover attestation run must attest persistence and queue cutover controls.');
  const receipt = response.body.productionOperationsControlReceipt;
  assert(receipt?.schemaVersion === 'production-operations-control-receipt/v1', 'Cutover attestation run must write a production operations receipt.');
  assert(receipt.controls?.filter((control) => control.evidenceEnvironment === 'managed-production' && control.attestationSignature?.startsWith('sig_hmac_sha256_v1_')).length === 2, 'Operations receipt must preserve signed managed-production attestations for both infrastructure controls.');
  assert(!JSON.stringify(response.body).includes(signingSecret), 'Cutover attestation response must not leak the signing secret.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/production-infrastructure-rehearsal`,
  });
  assert(response.status === 200, `Production infrastructure rehearsal returned ${response.status}.`);
  assert(response.body.productionInfrastructureRehearsal?.managedCutoverGates?.some((gate) => gate.id === 'managed-persistence-cutover' && gate.productionReady === true && gate.evidenceTier === 'managed-production'), 'Infrastructure rehearsal must mark managed persistence cutover ready from signed operations receipt.');
  assert(response.body.productionInfrastructureRehearsal?.managedCutoverGates?.some((gate) => gate.id === 'managed-worker-queue-cutover' && gate.productionReady === true && gate.evidenceTier === 'managed-production'), 'Infrastructure rehearsal must mark managed queue cutover ready from signed operations receipt.');
  assert(response.body.productionInfrastructureRehearsal.readyForProduction === false, 'Infrastructure rehearsal must still keep broader production blocked.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/production-evidence-integrity-audit`,
  });
  assert(response.status === 200, `Production evidence integrity audit returned ${response.status}.`);
  assert(response.body.productionEvidenceIntegrityAudit?.rows?.some((row) => row.controlId === 'managed-persistence-cutover' && row.evidenceTier === 'managed-production' && row.attestationSignatureReady === true), 'Evidence integrity audit must classify managed persistence cutover as signed managed-production evidence.');
  assert(response.body.productionEvidenceIntegrityAudit?.rows?.some((row) => row.controlId === 'managed-worker-queue-cutover' && row.evidenceTier === 'managed-production' && row.attestationSignatureReady === true), 'Evidence integrity audit must classify managed queue cutover as signed managed-production evidence.');
  assert(response.body.productionEvidenceIntegrityAudit.readyForProduction === false, 'Partial infrastructure attestations must not close all production evidence integrity.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/security-boundary`,
  });
  assert(response.status === 200 && response.body.securityBoundary?.routePolicies?.some((route) => route.routeKey === 'managed-infrastructure-cutover-attestations'), 'Security Boundary must list the managed infrastructure cutover attestation route policy.');

  console.log('Managed infrastructure cutover attestation validation passed.');
} finally {
  if (gatewayRuntime) await gateway.close();
  restoreEnv();
  await rm(tempRoot, { recursive: true, force: true });
}
