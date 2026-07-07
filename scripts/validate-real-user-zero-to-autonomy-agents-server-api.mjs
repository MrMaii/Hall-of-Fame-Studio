import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `real-user-zero-to-autonomy-agents-server-api-validate-${process.pid}`);
const serverScript = resolve(repoRoot, 'scripts', 'agent-project-server.mjs');
const secretVaultRecordsFile = resolve(tempRoot, 'secret-vault-records.json');
const boundWorkspaceRoot = resolve(tempRoot, 'bound-workspace');
const projectId = 'real_user_zero_to_autonomy_api_project';
const modelPlaintext = 'REAL_USER_ZERO_TO_AUTONOMY_API_MODEL_KEY_SHOULD_NOT_LEAK';
const searchPlaintext = 'REAL_USER_ZERO_TO_AUTONOMY_API_SEARCH_KEY_SHOULD_NOT_LEAK';

function readArg(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

const reportRequested = process.argv.includes('--report');
const reportFormat = readArg('--format') || 'json';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asText(value) {
  return JSON.stringify(value);
}

function bodyRows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.submissions)) return value.submissions;
  return [];
}

function stageRow({ id, label, ready, route, proofIds = [], detail = '' }) {
  return {
    id,
    label,
    ready: Boolean(ready),
    status: ready ? 'ready' : 'blocked',
    route: route || '',
    proofIds: proofIds.filter(Boolean),
    detail,
  };
}

function formatZeroToAutonomyReportMarkdown(report) {
  const lines = [
    '# Real User Zero-To-Autonomy Report',
    '',
    `Status: ${report.status}`,
    `Ready for local MVP trial: ${report.readyForLocalMvpTrial ? 'yes' : 'no'}`,
    `Ready for private-pilot delivery: ${report.readyForPrivatePilotDelivery ? 'yes' : 'no'}`,
    `Ready for public production: ${report.readyForPublicProduction ? 'yes' : 'no'}`,
    `Ready stages: ${report.summary.readyStageCount}/${report.summary.stageCount}`,
    `Artifact coverage: ${report.summary.submittedArtifactTypeCount}/${report.summary.requiredArtifactTypeCount}`,
    `Provider sources reviewed: ${report.summary.sourceReviewDecisionCount}/${report.summary.providerSourceCount}`,
    '',
    '## Stage Rows',
    '',
  ];
  for (const row of report.stageRows) {
    lines.push(`- ${row.status}: ${row.label}`);
    if (row.route) lines.push(`  Route: ${row.route}`);
    if (row.detail) lines.push(`  Detail: ${row.detail}`);
  }
  lines.push('');
  lines.push('## Public Production Blockers');
  lines.push('');
  for (const blocker of report.productionBlockers) lines.push(`- ${blocker}`);
  lines.push('');
  lines.push('Values are intentionally omitted. This report exposes readiness stages, proof routes, counts, and blocker categories only.');
  return `${lines.join('\n')}\n`;
}

function assertAutonomousHandoffOutput(project, submission, { context = 'real-user API handoff' } = {}) {
  const runs = Array.isArray(project?.agentAutonomousActionRunLedger) ? project.agentAutonomousActionRunLedger : [];
  const matchingRun = runs.find((run) => run.workSubmissionId === submission?.id) || runs[0] || null;
  assert(matchingRun?.schemaVersion === 'agent-autonomous-action-run/v1', `${context} must persist an Agent autonomous action run receipt.`);
  assert(matchingRun.workSubmissionId === submission?.id, `${context} run receipt must link to the autonomous Agent submission.`);
  assert(matchingRun.autonomousActionDecision?.schemaVersion === 'autonomous-action-decision/v1' || matchingRun.autonomousActionDecisionChecksum, `${context} must include an autonomous action decision.`);
  assert(matchingRun.resultMessageCount >= 1 && matchingRun.timelineLogIds?.length >= 1 && matchingRun.eventIds?.length >= 1, `${context} run receipt must carry chat, timeline, and event proof.`);
  assertAgentSubmissionNode(submission, { context });
  return matchingRun;
}

function assertAgentSubmissionNode(submission, { context = 'real-user API handoff' } = {}) {
  const bodyText = `${submission?.title || ''}\n${submission?.summary || ''}\n${submission?.body || ''}`;
  assert(submission?.id && submission?.messageId && submission?.timelineLogId && submission?.eventId, `${context} submission must carry proof ids.`);
  assert(bodyText.split(/\s+/).filter(Boolean).length >= 35, `${context} submission must contain substantive Agent-authored content.`);
  assert(/autonomous|backend Agent worker|worker cycle|proof/i.test(bodyText), `${context} submission body must identify autonomous worker provenance.`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function listen(server, { port = 0, host = '127.0.0.1' } = {}) {
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const address = server.address();
      resolvePromise({
        server,
        url: `http://${address.address}:${address.port}`,
      });
    });
  });
}

function createMockModelServer() {
  return createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const wantsJson = requestBody.response_format?.type === 'json_object';
    const content = wantsJson
      ? JSON.stringify({
          title: 'Generic product-team validation brief',
          summary: 'A model-backed product brief for the generic zero-to-autonomy validation path.',
          body: [
            '# Generic product-team validation brief',
            '',
            'This artifact connects kickoff, role negotiation, provider-backed evidence, brainstorm alternatives, reviewer feedback, linked revision, and final delivery as a generic product-team workflow.',
            '',
            'It remains blocked for public production until managed identity, persistence, queueing, provider audit, cost controls, and incident recovery are proven.',
          ].join('\n'),
          tags: ['product-team', 'zero-to-autonomy', 'provider-backed'],
        })
      : 'Local mock model confirmed the backend provider path without external network calls.';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      id: 'chatcmpl-real-user-zero-to-autonomy-api',
      object: 'chat.completion',
      model: requestBody.model || 'gpt-4o-mini',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
    }));
  });
}

function createMockSearchServer(requests) {
  return createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += String(chunk);
    });
    request.on('end', () => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization || '',
        body,
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        id: 'real-user-api-search-response-1',
        confidence: 'high',
        findings: ['Local search gateway returned evidence for the generic product-team validation run.'],
        sources: [
          {
            id: 'real-user-api-source-1',
            title: 'Local generic product-team evidence source',
            url: 'https://example.test/product-team-evidence?token=SHOULD_REDACT',
            summary: 'Controlled evidence proving the user-configured search provider path.',
            confidence: 'high',
          },
          {
            id: 'real-user-api-source-2',
            title: 'Local generic product-team corroborating source',
            url: 'https://example.test/product-team-corroboration',
            summary: 'Second controlled source corroborating the product-team validation chain.',
            confidence: 'high',
          },
        ],
      }));
    });
  });
}

function waitForServerUrl(child, { timeoutMs = 15000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    let output = '';
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out waiting for agents:server startup. Output: ${output.slice(-1200)}`));
    }, timeoutMs);

    const finish = (error, url = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolvePromise(url);
    };

    const inspectChunk = (chunk) => {
      output += String(chunk);
      const match = output.match(/Agent project backend listening on (http:\/\/[^\s]+)/);
      if (match) finish(null, match[1]);
    };

    child.stdout.on('data', inspectChunk);
    child.stderr.on('data', inspectChunk);
    child.once('exit', (code, signal) => {
      finish(new Error(`agents:server exited before startup. code=${code} signal=${signal || 'none'} output=${output.slice(-1200)}`));
    });
    child.once('error', finish);
  });
}

function startBackend({ mockModelUrl }) {
  return spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AGENT_PROJECT_HOST: '127.0.0.1',
      AGENT_PROJECT_PORT: '0',
      AGENT_PROJECT_STORE: resolve(tempRoot, 'store.json'),
      AGENT_PROJECT_RUNTIME_ROOT: resolve(tempRoot, 'runtime'),
      AGENT_SECURITY_AUDIT_LOG: resolve(tempRoot, 'security-audit.jsonl'),
      AGENT_AUTONOMOUS_AGENT_STRATEGY: 'true',
      AGENT_AUTONOMOUS_AGENT_SUBMISSIONS: 'true',
      AGENT_AUTONOMOUS_ARTIFACT_TYPE: 'auto',
      SECRET_VAULT_ENABLED: 'true',
      SECRET_VAULT_KEY: 'real-user-zero-to-autonomy-api-validation-key',
      SECRET_VAULT_KEY_ID: 'real-user-zero-to-autonomy-api-v1',
      SECRET_VAULT_RECORDS_FILE: secretVaultRecordsFile,
      MODEL_PROVIDER: 'openai-compatible',
      MODEL_BASE_URL: `${mockModelUrl}/v1`,
      MODEL_NAME: 'gpt-4o-mini',
      SEARCH_PROVIDER: '',
      SEARCH_ENDPOINT: '',
      SEARCH_PROVIDER_ENDPOINT: '',
      SEARCH_PROVIDER_ENABLED: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
}

async function closeServer(runtime) {
  if (!runtime?.server) return;
  await new Promise((resolvePromise) => runtime.server.close(resolvePromise)).catch(() => {});
}

async function sealSecret(backendUrl, name, value, metadata = {}, { allowRuntimeValueEcho = false } = {}) {
  const response = await fetchJson(`${backendUrl}/secret-vault/seal`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      value,
      scope: metadata.scope || 'provider',
      source: 'real-user-zero-to-autonomy-api-validation',
      metadata,
      now: '2026-06-01T08:00:00.000Z',
    }),
  });
  assert(response.status === 200, `Secret seal ${name} returned ${response.status}.`);
  assert(response.body.secretVaultSealReceipt?.schemaVersion === 'secret-vault-seal-receipt/v1', `${name} must return a seal receipt.`);
  if (!allowRuntimeValueEcho) {
    assert(!JSON.stringify(response.body).includes(value), `${name} seal response must not expose plaintext.`);
  }
  return response.body;
}

async function submitArtifact(backendUrl, {
  agentId,
  artifactType,
  title,
  summary,
  body,
  taskId,
  reviewerAgentId = 'curie',
  sourceRefs = [],
  dependsOn = [],
  now,
}) {
  const response = await fetchJson(`${backendUrl}/projects/${projectId}/agents/${agentId}/submissions`, {
    method: 'POST',
    body: JSON.stringify({
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
    }),
  });
  assert(response.status === 200, `${artifactType} submission returned ${response.status}.`);
  const submission = response.body.submission || {};
  assert(
    submission.id
      && submission.artifactType === artifactType
      && submission.messageId
      && submission.timelineLogId
      && submission.eventId
      && submission.artifactStorageProofChecksum,
    `${artifactType} must submit as a proofed Agent artifact node.`,
  );
  return submission;
}

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

const mockModelRuntime = await listen(createMockModelServer());
const searchRequests = [];
const mockSearchRuntime = await listen(createMockSearchServer(searchRequests));
let backendChild = null;

try {
  backendChild = startBackend({ mockModelUrl: mockModelRuntime.url });
  const backendUrl = await waitForServerUrl(backendChild);

  let response = await fetchJson(`${backendUrl}/secret-vault/status`);
  assert(response.status === 200 && response.body.secretVaultStatus?.ready === true, 'Real-user API gate must start agents:server with a ready Secret Vault.');

  await sealSecret(backendUrl, 'model.apiKey', modelPlaintext, {
    scope: 'model-provider',
    providerKind: 'model',
    secretKind: 'api-key',
  });
  await sealSecret(backendUrl, 'search.endpoint', `${mockSearchRuntime.url}/search`, {
    scope: 'search-provider',
    providerKind: 'search',
    secretKind: 'endpoint',
    provider: 'http-json',
  }, { allowRuntimeValueEcho: true });
  await sealSecret(backendUrl, 'search.apiKey', searchPlaintext, {
    scope: 'search-provider',
    providerKind: 'search',
    secretKind: 'api-key',
    provider: 'http-json',
  });

  response = await fetchJson(`${backendUrl}/llm/status`);
  assert(response.body.modelProvider?.apiKeySource === 'local-secret-vault' && response.body.modelProvider?.enabled === true, 'Model provider must be vault-backed and enabled after user key seal.');
  response = await fetchJson(`${backendUrl}/search/status`);
  assert(response.body.searchProvider?.provider === 'http-json' && response.body.searchProvider?.enabled === true, 'Search provider must be vault-backed and enabled after endpoint/key seal.');
  assert(response.body.searchProvider?.endpointSource === 'local-secret-vault' && response.body.searchProvider?.apiKeySource === 'local-secret-vault', 'Search provider endpoint and key must both come from local Secret Vault.');

  response = await fetchJson(`${backendUrl}/search/test`, {
    method: 'POST',
    body: JSON.stringify({ query: 'real user generic product-team evidence' }),
  });
  assert(response.status === 200 && response.body.ok === true && response.body.sources?.length === 2, '/search/test must call the sealed search provider.');
  assert(searchRequests.length >= 1 && searchRequests.at(-1).authorization === `Bearer ${searchPlaintext}`, 'Search test must reach the configured endpoint with the sealed key.');

  response = await fetchJson(`${backendUrl}/secret-vault/records`);
  const serializedRecords = JSON.stringify(response.body);
  assert(!serializedRecords.includes(modelPlaintext) && !serializedRecords.includes(searchPlaintext), 'Vault records must not expose plaintext keys.');
  assert(!serializedRecords.includes(mockSearchRuntime.url), 'Vault records must not expose plaintext search endpoint.');

  response = await fetchJson(`${backendUrl}/local-mvp-startup-readiness`);
  const startupReadiness = response.body.localMvpStartupReadiness || {};
  const serializedStartupReadiness = JSON.stringify(startupReadiness);
  assert(response.status === 200 && startupReadiness.schemaVersion === 'local-mvp-startup-readiness/v1', 'Real-user API gate must read the backend startup readiness contract before mission creation.');
  assert(startupReadiness.readyForFirstProjectRun === true && startupReadiness.status === 'ready-for-local-mvp-session', 'Real-user API gate must prove first-project readiness before creating a product-team mission.');
  assert(startupReadiness.nextAction?.id === 'start-product-team-mission' && startupReadiness.nextAction?.route === '/product-team-missions', 'Startup readiness must route the ready user into Product Team Mission Runner.');
  assert(startupReadiness.summary?.modelRuntimeReady === true && startupReadiness.summary?.searchRuntimeReady === true, 'Startup readiness must confirm model and search runtime readiness before project startup.');
  assert(startupReadiness.providerVaultBindings?.redaction?.rawLeakCount === 0, 'Startup readiness must keep provider-vault metadata redacted before project startup.');
  assert(!serializedStartupReadiness.includes(modelPlaintext) && !serializedStartupReadiness.includes(searchPlaintext), 'Startup readiness must not expose plaintext provider keys.');
  assert(!serializedStartupReadiness.includes('ciphertext'), 'Startup readiness must not expose encrypted vault ciphertext.');

  response = await fetchJson(`${backendUrl}/product-team-missions`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      missionId: 'real_user_zero_to_autonomy_api_mission',
      meetingId: 'real_user_zero_to_autonomy_api_meeting',
      projectId,
      name: 'Real User Zero To Autonomy API Project',
      missionBrief: 'Start from a blank account setup and validate a generic AI product-team workflow. Research is only a sample customer goal.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
        { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence judgement' },
        { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'backend proof' },
        { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Inventor', skill: 'brainstorm synthesis' },
      ],
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      tasks: [
        { id: 'task_brainstorm', text: 'Brainstorm generic product-team delivery options.', assignee: 'Leonardo da Vinci', status: 'pending' },
        { id: 'task_evidence', text: 'Collect provider-backed evidence.', assignee: 'Marie Curie', status: 'pending' },
        { id: 'task_brief', text: 'Draft a product-team brief.', assignee: 'Alan Turing', status: 'pending' },
        { id: 'task_review', text: 'Review, revise, and accept the final deliverable.', assignee: 'Marie Curie', status: 'pending' },
      ],
      maxLoops: 1,
      maxStepsPerLoop: 1,
      runInitialTick: false,
      now: '2026-06-01T09:00:00.000Z',
    }),
  });
  assert(response.status === 200, `Mission Runner returned ${response.status}.`);
  assert(response.body.productTeamMissionRun?.schemaVersion === 'product-team-mission-run/v1', 'Mission Runner must return a product-team mission receipt.');
  assert(response.body.productTeamMissionRun.researchOnly === false && response.body.productTeamMissionRun.missionType === 'generic-product-team', 'Mission Runner must keep this flow generic, not research-only.');
  assert(response.body.meeting?.transcript?.some((turn) => turn.stage === 'leader-campaign'), 'Kickoff meeting must include Leader campaign/self-marketing turns.');
  const missionRun = response.body.productTeamMissionRun || {};
  const kickoffMeeting = response.body.meeting || {};

  response = await fetchJson(`${backendUrl}/projects/${projectId}/settings-provider-readiness`);
  let projectSettingsProviderReadiness = response.body.settingsProviderReadiness || {};
  let serializedSettingsReadiness = JSON.stringify(projectSettingsProviderReadiness);
  assert(response.status === 200 && projectSettingsProviderReadiness.schemaVersion === 'settings-provider-readiness/v1', 'Project-scoped Settings provider readiness must be readable after first project creation.');
  assert(projectSettingsProviderReadiness.projectId === projectId, 'Project-scoped Settings provider readiness must carry the real-user project id.');
  assert(projectSettingsProviderReadiness.backendRoutes?.settingsProviderReadiness === `/projects/${projectId}/settings-provider-readiness`, 'Project-scoped Settings provider readiness must expose its own route.');
  assert(projectSettingsProviderReadiness.canTypeApiFields === true && projectSettingsProviderReadiness.canSealSecrets === true, 'Project-scoped Settings provider readiness must keep API entry usable after Vault setup.');
  assert(projectSettingsProviderReadiness.providerVaultBindings?.redaction?.rawLeakCount === 0, 'Project-scoped Settings provider readiness must keep provider-vault metadata redacted.');
  assert(!serializedSettingsReadiness.includes(modelPlaintext) && !serializedSettingsReadiness.includes(searchPlaintext), 'Project-scoped Settings provider readiness must not expose plaintext provider keys.');
  assert(!serializedSettingsReadiness.includes('ciphertext'), 'Project-scoped Settings provider readiness must not expose encrypted vault ciphertext.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/settings-runtime-readiness`);
  const projectSettingsRuntimeReadiness = response.body.settingsRuntimeReadiness || {};
  serializedSettingsReadiness = JSON.stringify(projectSettingsRuntimeReadiness);
  assert(response.status === 200 && projectSettingsRuntimeReadiness.schemaVersion === 'settings-runtime-readiness/v1', 'Project-scoped Settings runtime readiness must be readable after first project creation.');
  assert(projectSettingsRuntimeReadiness.projectId === projectId, 'Project-scoped Settings runtime readiness must carry the real-user project id.');
  assert(projectSettingsRuntimeReadiness.backendRoutes?.settingsRuntimeReadiness === `/projects/${projectId}/settings-runtime-readiness`, 'Project-scoped Settings runtime readiness must expose its own route.');
  assert(projectSettingsRuntimeReadiness.rows?.some((row) => row.id === 'model-runtime' && row.status === 'pass'), 'Project-scoped Settings runtime readiness must pass the sealed model runtime.');
  assert(projectSettingsRuntimeReadiness.rows?.some((row) => row.id === 'search-runtime' && row.status === 'pass'), 'Project-scoped Settings runtime readiness must pass the sealed search runtime.');
  assert(projectSettingsRuntimeReadiness.modelRuntime?.providerVaultBindings?.redaction?.rawLeakCount === 0, 'Project-scoped Settings runtime readiness must include redacted provider-vault proof.');
  assert(projectSettingsRuntimeReadiness.readyForProduction === false, 'Project-scoped Settings runtime readiness must not claim public-production readiness.');
  assert(!serializedSettingsReadiness.includes(modelPlaintext) && !serializedSettingsReadiness.includes(searchPlaintext), 'Project-scoped Settings runtime readiness must not expose plaintext provider keys.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/settings-integration-readiness`);
  const projectSettingsIntegrationReadiness = response.body.settingsIntegrationReadiness || {};
  assert(response.status === 200 && projectSettingsIntegrationReadiness.schemaVersion === 'settings-integration-readiness/v1', 'Project-scoped Settings integration readiness must be readable after first project creation.');
  assert(projectSettingsIntegrationReadiness.projectId === projectId, 'Project-scoped Settings integration readiness must carry the real-user project id.');
  assert(projectSettingsIntegrationReadiness.readyForSettingsIntegrationsPanel === true, 'Settings Integrations panel must be backed by route-readable contracts for a first real-user project.');
  assert(projectSettingsIntegrationReadiness.backendRoutes?.settingsIntegrationReadiness === `/projects/${projectId}/settings-integration-readiness`, 'Settings integration readiness must expose its project-scoped aggregate route.');
  assert(projectSettingsIntegrationReadiness.summary?.rowCount >= 7, 'Settings integration readiness must cover every Settings integration row.');
  assert(projectSettingsIntegrationReadiness.summary?.routeReadyCount === projectSettingsIntegrationReadiness.summary.rowCount, 'Every Settings integration row must be route-backed for the first real-user project.');
  for (const id of ['provider-budget-policy', 'agent-tool-grant-policy', 'vector-store', 'proxy-webhook', 'mcp-tools', 'budget-alerts', 'error-reporting']) {
    const row = projectSettingsIntegrationReadiness.rows?.find((item) => item.id === id);
    assert(row?.routeReady === true, `${id} Settings integration row must be route-backed after first project creation.`);
    assert(row.requiredBackendRoute?.includes(projectId), `${id} Settings integration row must expose a project-scoped backend route.`);
  }

  response = await fetchJson(`${backendUrl}/projects/${projectId}/workspace/bind`, {
    method: 'POST',
    body: JSON.stringify({
      workspacePath: boundWorkspaceRoot,
      createIfMissing: true,
      now: '2026-06-01T09:02:00.000Z',
    }),
  });
  assert(response.status === 200 && response.body.route === 'workspace-bound', 'Real-user API startup must bind a backend local workspace.');
  assert(response.body.localRuntime?.workspacePath === boundWorkspaceRoot, 'Workspace bind receipt must return the bound workspace path.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/local-runtime`);
  assert(response.status === 200 && response.body.localRuntime?.workspacePath === boundWorkspaceRoot, 'Local runtime route must read back the real-user bound workspace path.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/workspace/write`, {
    method: 'POST',
    body: JSON.stringify({
      path: 'deliverables/zero-to-autonomy-workspace-proof.md',
      content: '# Zero-to-autonomy workspace proof\n\nThe generic product-team project has a backend-bound local workspace before Agent delivery begins.',
    }),
  });
  assert(response.status === 200 && response.body.file?.path === 'deliverables/zero-to-autonomy-workspace-proof.md', 'Real-user API startup must be able to write a proof file into the bound workspace.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/workspace/read`, {
    method: 'POST',
    body: JSON.stringify({
      path: 'deliverables/zero-to-autonomy-workspace-proof.md',
    }),
  });
  assert(response.status === 200 && /backend-bound local workspace/i.test(response.body.content || ''), 'Real-user API startup must read back the proof file from the bound workspace.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/meeting`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      text: 'War Room: confirm brainstorm, provider evidence, model-backed draft, review, revision, and final deliverable responsibilities.',
      now: '2026-06-01T09:05:00.000Z',
    }),
  });
  assert(response.status === 200 && response.body.meetingAgentTurns?.length >= 1, 'Backend meeting must create Agent-authored meeting turns.');
  assert(response.body.meetingAgentTurns.every((turn) => turn.timelineLogIds?.length >= 1), 'Meeting turns must carry timeline proof ids.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/collaboration-intent-queue/customer-agent-handoff-intent/run`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      now: '2026-06-01T09:07:00.000Z',
    }),
  });
  assert(response.status === 200, `Collaboration handoff intent returned ${response.status}.`);
  assert(response.body.collaborationIntentRun?.schemaVersion === 'collaboration-intent-run/v1', 'Collaboration handoff intent must persist a run receipt.');
  assert(
    response.body.agentAutonomousActionRun?.schemaVersion === 'agent-autonomous-action-run/v1'
      || response.body.autonomousRunControlRun?.schemaVersion === 'autonomous-run-control-action-run/v1',
    'Collaboration handoff intent must delegate to an autonomous execution lane.',
  );
  const collaborationHandoffSubmission = response.body.workSubmission || response.body.submission || {};
  assertAgentSubmissionNode(collaborationHandoffSubmission, { context: 'real-user API collaboration handoff intent' });
  assert(
    response.body.autonomousRunControlRun?.resultAgentProcessedCount >= 1
      || response.body.agentAutonomousActionRun?.workSubmissionId === collaborationHandoffSubmission.id,
    'Collaboration handoff intent must prove an Agent worker processed the handoff submission.',
  );
  assert(
    response.body.collaborationIntentRun.workSubmissionId === collaborationHandoffSubmission.id
      || response.body.collaborationIntentRun.relatedIds?.includes(collaborationHandoffSubmission.id),
    'Collaboration handoff intent receipt must link the Agent submission node.',
  );

  response = await fetchJson(`${backendUrl}/projects/${projectId}/agent-autonomous-action-queue/next/run`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      force: true,
      now: '2026-06-01T09:08:00.000Z',
      requestBodyOverrides: {
        submitWorkArtifact: true,
        submitWorkArtifactOn: 'always',
        workArtifactType: 'progress-brief',
        workArtifactReviewStatus: 'pending-review',
      },
    }),
  });
  assert(response.status === 200, `Agent autonomous queue returned ${response.status}.`);
  assert(response.body.agentAutonomousActionRun?.schemaVersion === 'agent-autonomous-action-run/v1', 'Agent autonomous queue must persist a direct Agent action receipt.');
  const handoffSubmission = response.body.workSubmission || response.body.submission || {};
  assertAutonomousHandoffOutput(response.body.project, handoffSubmission, { context: 'real-user API Agent queue handoff' });

  response = await fetchJson(`${backendUrl}/projects/${projectId}/agents/curie/evidence-searches`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      useProvider: true,
      query: 'real user product-team zero-to-autonomy evidence',
      purpose: 'Curie collects provider-backed evidence for the generic product-team delivery chain.',
      taskId: 'task_evidence',
      maxResults: 2,
      now: '2026-06-01T09:10:00.000Z',
    }),
  });
  assert(response.status === 200, `Evidence search returned ${response.status}.`);
  const evidenceSearch = response.body.evidenceSearch || {};
  assert(evidenceSearch.id && evidenceSearch.provider === 'http-json' && evidenceSearch.sources?.length === 2, 'Evidence search must use the sealed search provider and persist sources.');
  assert(response.body.providerReceipt?.id === evidenceSearch.providerReceiptId, 'Evidence search must link to a provider receipt.');
  assert(response.body.providerUsage?.providerVaultBindingChecksum, 'Evidence search must write provider-vault usage proof.');

  const initialSourceReviewWorkflow = await fetchJson(`${backendUrl}/projects/${projectId}/evidence-source-review-workflow`);
  assert(initialSourceReviewWorkflow.status === 200 && initialSourceReviewWorkflow.body.evidenceSourceReviewWorkflow?.schemaVersion === 'evidence-source-review-workflow/v1', 'Evidence Source Review Workflow must expose pending source decisions after provider evidence.');
  const pendingSourceReviewItems = (initialSourceReviewWorkflow.body.evidenceSourceReviewWorkflow.reviewItems || [])
    .filter((item) => item.decisionRequired && !item.latestDecisionId);
  assert(pendingSourceReviewItems.length >= evidenceSearch.sources.length, 'Evidence Source Review Workflow must queue every provider-backed source that requires Reviewer judgement.');

  const sourceReviewResponses = [];
  for (const [index, source] of pendingSourceReviewItems.entries()) {
    const reviewMinute = 11 + Math.floor(index / 30);
    const reviewSecond = String(index % 30).padStart(2, '0');
    response = await fetchJson(`${backendUrl}/projects/${projectId}/evidence-source-review-workflow`, {
      method: 'POST',
      body: JSON.stringify({
        includeReadModels: false,
        evidenceSearchId: source.evidenceSearchId,
        sourceId: source.sourceId,
        reviewerAgentId: source.reviewerAgentId || 'curie',
        decision: 'approved',
        comments: `Approved source ${index + 1} for local MVP use: it is provider-backed, checksummed, and linked to the generic product-team validation chain.`,
        now: `2026-06-01T09:${reviewMinute}:${reviewSecond}.000Z`,
      }),
    });
    assert(response.status === 200, `Evidence source review ${index + 1} returned ${response.status}.`);
    const sourceReview = response.body.evidenceSourceReview || {};
    assert(sourceReview.id && sourceReview.decision === 'approved' && sourceReview.messageId && sourceReview.timelineLogId && sourceReview.eventId, `Evidence source review ${index + 1} must persist reviewer decision proof.`);
    sourceReviewResponses.push(sourceReview);
  }
  assert(sourceReviewResponses.length === pendingSourceReviewItems.length, 'Every pending provider-backed evidence source must receive a Reviewer decision before artifact drafting.');
  const sourceReviewRefs = sourceReviewResponses.map((review) => ({
    type: 'evidence-source-review',
    id: review.id,
    route: `/projects/${projectId}/evidence-source-review-workflow#${review.id}`,
  }));

  const discoverySubmission = await submitArtifact(backendUrl, {
    agentId: 'jobs',
    artifactType: 'discovery-report',
    title: 'Real-user generic product-team discovery report',
    summary: 'Discovery report frames the customer goal, proof surfaces, and production blockers.',
    body: '# Real-user generic product-team discovery report\n\nThis discovery report captures the user goal, product-team outcome, Manager proof surfaces, Agent responsibilities, and remaining production blockers.',
    taskId: 'task_brainstorm',
    now: '2026-06-01T09:12:00.000Z',
  });

  const evidencePacketSubmission = await submitArtifact(backendUrl, {
    agentId: 'curie',
    artifactType: 'evidence-packet',
    title: 'Real-user generic product-team evidence packet',
    summary: 'Evidence packet links provider search, judgement, confidence, and downstream decisions.',
    body: '# Real-user generic product-team evidence packet\n\nThe evidence packet links the sealed provider source, confidence judgement, source snapshot, and downstream decisions so the Manager can inspect why the team chose a direction.',
    taskId: 'task_evidence',
    sourceRefs: [
      { type: 'evidence-search', id: evidenceSearch.id, route: `/projects/${projectId}/evidence-searches/${evidenceSearch.id}` },
      ...sourceReviewRefs,
    ],
    dependsOn: [evidenceSearch.id, ...sourceReviewResponses.map((review) => review.id)],
    now: '2026-06-01T09:13:00.000Z',
  });

  response = await fetchJson(`${backendUrl}/projects/${projectId}/agents/da_vinci/submissions`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      artifactType: 'brainstorm-board',
      title: 'Real-user generic product-team brainstorm board',
      summary: 'Persona alternatives for the generic product-team delivery.',
      body: '# Real-user generic brainstorm\n\n1. Build the proof as a product-team delivery trace.\n2. Keep provider-backed evidence visible.\n3. Close the review/revision/final loop.',
      taskId: 'task_brainstorm',
      reviewerAgentId: 'curie',
      now: '2026-06-01T09:15:00.000Z',
    }),
  });
  assert(response.status === 200, `Brainstorm submission returned ${response.status}.`);
  const brainstormSubmission = response.body.submission || {};
  assert(brainstormSubmission.id && brainstormSubmission.artifactType === 'brainstorm-board', 'Brainstorm must be a persisted Agent submission node.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/agents/turing/artifact-drafts`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      artifactType: 'product-brief',
      instruction: 'Draft a generic product-team validation brief from kickoff, provider-backed evidence, and brainstorm alternatives.',
      taskId: 'task_brief',
      evidenceSearchIds: [evidenceSearch.id],
      priorSubmissionIds: [discoverySubmission.id, evidencePacketSubmission.id, brainstormSubmission.id],
      useModel: true,
      requireModel: true,
      submit: true,
      reviewerAgentId: 'curie',
      now: '2026-06-01T09:20:00.000Z',
    }),
  });
  assert(response.status === 200, `Model-backed product brief draft returned ${response.status}.`);
  assert(response.body.artifactDraft?.schemaVersion === 'agent-artifact-draft/v1' && response.body.artifactDraft?.modelUsed === true, 'Product brief must use the backend model artifact-draft contract.');
  assert(response.body.providerUsage?.operation === 'model:artifact-draft' && response.body.providerUsage?.providerVaultBindingChecksum, 'Model draft must write provider usage with vault-binding proof.');
  const productBriefSubmission = response.body.submission || {};
  assert(productBriefSubmission.id && productBriefSubmission.artifactType === 'product-brief' && productBriefSubmission.isGeneratedDraft, 'Model draft must submit a product-brief Agent node.');

  const decisionProposalSubmission = await submitArtifact(backendUrl, {
    agentId: 'jobs',
    artifactType: 'decision-proposal',
    title: 'Real-user generic product-team decision proposal',
    summary: 'Decision proposal selects the validated direction and names the evidence and brainstorm alternatives used.',
    body: '# Real-user generic product-team decision proposal\n\nThe decision proposal selects the delivery-trace direction because it connects kickoff, evidence, brainstorm, draft, review, revision, final delivery, Flow Graph, Proof Map, transcript, timeline, and event proof.',
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

  const riskReviewSubmission = await submitArtifact(backendUrl, {
    agentId: 'curie',
    artifactType: 'risk-review',
    title: 'Real-user generic product-team risk review',
    summary: 'Risk review records evidence limits, production blockers, and reviewer concerns before final delivery.',
    body: '# Real-user generic product-team risk review\n\nThe risk review keeps the product generic, checks evidence quality, names production blockers, and requires the revision loop before final acceptance.',
    taskId: 'task_review',
    sourceRefs: [
      { type: 'evidence-search', id: evidenceSearch.id },
      { type: 'agent-submission', id: productBriefSubmission.id },
      { type: 'agent-submission', id: decisionProposalSubmission.id },
    ],
    dependsOn: [evidenceSearch.id, productBriefSubmission.id, decisionProposalSubmission.id],
    now: '2026-06-01T09:22:00.000Z',
  });

  const implementationPlanSubmission = await submitArtifact(backendUrl, {
    agentId: 'turing',
    artifactType: 'implementation-plan',
    title: 'Real-user generic product-team implementation plan',
    summary: 'Implementation plan maps the selected direction into backend contracts, proof routes, validation gates, and launch blockers.',
    body: '# Real-user generic product-team implementation plan\n\nThe implementation plan keeps the work backend-first, routes Agent submissions through durable contracts, verifies Flow and Proof visibility, preserves transcript and event evidence, and leaves public launch blocked until managed controls exist.',
    taskId: 'task_brief',
    sourceRefs: [
      { type: 'agent-submission', id: decisionProposalSubmission.id },
      { type: 'agent-submission', id: riskReviewSubmission.id },
    ],
    dependsOn: [decisionProposalSubmission.id, riskReviewSubmission.id],
    now: '2026-06-01T09:23:00.000Z',
  });

  response = await fetchJson(`${backendUrl}/projects/${projectId}/submissions/${encodeURIComponent(productBriefSubmission.id)}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      reviewerAgentId: 'curie',
      verdict: 'changes-requested',
      comments: 'Link provider evidence, brainstorm alternatives, production blockers, and final delivery proof.',
      requestedChanges: ['Link provider-backed evidence.', 'Name production blockers.'],
      now: '2026-06-01T09:25:00.000Z',
    }),
  });
  assert(response.status === 200, `Review returned ${response.status}.`);
  const productBriefReview = response.body.review || {};
  assert(productBriefReview.id && productBriefReview.verdict === 'changes-requested', 'Reviewer must request changes on the product brief.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/agents/turing/submissions`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      artifactType: 'revision-note',
      title: 'Real-user product-team revision note',
      summary: 'Revision links provider evidence, brainstorm, review obligations, and final proof.',
      body: '# Revision note\n\nThe revision links provider-backed evidence, brainstorm alternatives, requested changes, and final delivery proof.',
      reviewerAgentId: 'curie',
      revisesSubmissionId: productBriefSubmission.id,
      respondsToReviewId: productBriefReview.id,
      now: '2026-06-01T09:30:00.000Z',
    }),
  });
  assert(response.status === 200, `Revision submission returned ${response.status}.`);
  const revisionSubmission = response.body.submission || {};
  assert(revisionSubmission.id && revisionSubmission.artifactType === 'revision-note' && revisionSubmission.respondsToReviewId === productBriefReview.id, 'Revision note must link to requested-changes review.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/agents/turing/submissions`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      artifactType: 'final-deliverable',
      title: 'Final real-user generic product-team package',
      summary: 'Final package closes kickoff, meeting, evidence, brainstorm, draft, review, revision, and proof routes.',
      body: '# Final real-user generic product-team package\n\nThe generic chain is complete and traceable through Flow Graph, Proof Map, transcript, timeline, and event ledger.',
      status: 'final',
      reviewerAgentId: 'curie',
      revisesSubmissionId: revisionSubmission.id,
      respondsToReviewId: productBriefReview.id,
      supersedesSubmissionIds: [productBriefSubmission.id, revisionSubmission.id, implementationPlanSubmission.id],
      sourceRefs: [
        { type: 'agent-submission', id: discoverySubmission.id },
        { type: 'agent-submission', id: evidencePacketSubmission.id },
        { type: 'agent-submission', id: brainstormSubmission.id },
        { type: 'agent-submission', id: decisionProposalSubmission.id },
        { type: 'agent-submission', id: riskReviewSubmission.id },
        { type: 'agent-submission', id: implementationPlanSubmission.id },
      ],
      dependsOn: [
        discoverySubmission.id,
        evidencePacketSubmission.id,
        brainstormSubmission.id,
        decisionProposalSubmission.id,
        riskReviewSubmission.id,
        implementationPlanSubmission.id,
        revisionSubmission.id,
      ],
      now: '2026-06-01T09:35:00.000Z',
    }),
  });
  assert(response.status === 200, `Final deliverable returned ${response.status}.`);
  const finalSubmission = response.body.submission || {};
  assert(finalSubmission.id && finalSubmission.artifactType === 'final-deliverable' && finalSubmission.status === 'final', 'Final deliverable must be a final Agent submission node.');

  response = await fetchJson(`${backendUrl}/projects/${projectId}/submissions/${encodeURIComponent(finalSubmission.id)}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      reviewerAgentId: 'curie',
      verdict: 'accepted',
      comments: 'Accepted: the zero-to-autonomy product-team chain is traceable end to end.',
      now: '2026-06-01T09:40:00.000Z',
    }),
  });
  assert(response.status === 200 && response.body.review?.verdict === 'accepted', 'Reviewer must accept the final deliverable.');
  const finalReview = response.body.review || {};

  let submissions = await fetchJson(`${backendUrl}/projects/${projectId}/submissions`);
  let submissionRows = bodyRows(submissions.body.submissions);
  response = await fetchJson(`${backendUrl}/projects/${projectId}/submission-reviews`);
  assert(response.status === 200 && Array.isArray(response.body.submissionReviews), 'Backend must list submission reviews for open-change closure.');
  const respondedReviewIds = new Set(submissionRows.map((row) => row.respondsToReviewId).filter(Boolean));
  const openChangeReviews = response.body.submissionReviews.filter((review) => (
    review.verdict === 'changes-requested'
    && review.submissionId
    && !respondedReviewIds.has(review.id)
  ));
  for (const [index, openChangeReview] of openChangeReviews.entries()) {
    const revisionResponse = await fetchJson(`${backendUrl}/projects/${projectId}/agents/turing/submissions`, {
      method: 'POST',
      body: JSON.stringify({
        includeReadModels: false,
        artifactType: 'revision-note',
        title: `Real-user open change closure ${index + 1}`,
        summary: 'Linked revision closes an open changes-requested review before readiness is assessed.',
        body: '# Real-user open change closure\n\nThis linked revision responds to an earlier changes-requested review so the delivery trace has no open review obligations.',
        reviewerAgentId: openChangeReview.reviewerAgentId || 'curie',
        revisesSubmissionId: openChangeReview.submissionId,
        respondsToReviewId: openChangeReview.id,
        now: `2026-06-01T09:${41 + index}:00.000Z`,
      }),
    });
    assert(revisionResponse.status === 200 && revisionResponse.body.submission?.respondsToReviewId === openChangeReview.id, 'Each open changes-requested review must close with a linked revision note.');
  }

  submissions = await fetchJson(`${backendUrl}/projects/${projectId}/submissions`);
  submissionRows = bodyRows(submissions.body.submissions);
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

  const artifactQuality = await fetchJson(`${backendUrl}/projects/${projectId}/artifact-quality-audit`);
  assert(artifactQuality.status === 200 && artifactQuality.body.artifactQualityAudit?.gates?.some((gate) => gate.id === 'draft-review-revision-final-loop' && gate.passed), 'Artifact Quality Audit must prove the draft-review-revision-final loop.');
  assert(artifactQuality.body.artifactQualityAudit?.gates?.some((gate) => gate.id === 'generic-artifact-type-coverage' && gate.passed), 'Artifact Quality Audit must prove required generic artifact type coverage.');
  assert(artifactQuality.body.artifactQualityAudit?.summary?.missingArtifactTypeCount === 0, 'Artifact Quality Audit must report no missing generic artifact types.');

  const sourceReviewWorkflow = await fetchJson(`${backendUrl}/projects/${projectId}/evidence-source-review-workflow`);
  assert(sourceReviewWorkflow.status === 200 && sourceReviewWorkflow.body.evidenceSourceReviewWorkflow?.schemaVersion === 'evidence-source-review-workflow/v1', 'Evidence Source Review Workflow must be available in the real-user chain.');
  assert(sourceReviewWorkflow.body.evidenceSourceReviewWorkflow.readyForLocalPilot === true, 'Evidence Source Review Workflow must become local-ready after every source receives a Reviewer decision.');
  assert(sourceReviewWorkflow.body.evidenceSourceReviewWorkflow.summary?.sourceReviewDecisionCount >= evidenceSearch.sources.length, 'Evidence Source Review Workflow must count every real-user source decision.');
  assert(sourceReviewWorkflow.body.evidenceSourceReviewWorkflow.summary?.pendingDecisionSourceCount === 0, 'Evidence Source Review Workflow must have no pending source decisions before archive handoff.');

  const proofTargets = [
    handoffSubmission.id,
    discoverySubmission.id,
    evidenceSearch.id,
    ...sourceReviewResponses.map((review) => review.id),
    evidencePacketSubmission.id,
    brainstormSubmission.id,
    productBriefSubmission.id,
    decisionProposalSubmission.id,
    riskReviewSubmission.id,
    implementationPlanSubmission.id,
    productBriefReview.id,
    revisionSubmission.id,
    finalSubmission.id,
    finalReview.id,
  ];
  const flowGraph = await fetchJson(`${backendUrl}/projects/${projectId}/manager-flow-graph`);
  assert(flowGraph.status === 200 && proofTargets.every((id) => asText(flowGraph.body).includes(id)), 'Manager Flow Graph must trace every required generic submission, evidence, review, revision, final, and acceptance node.');
  const proofMap = await fetchJson(`${backendUrl}/projects/${projectId}/readiness-proof-map`);
  assert(proofMap.status === 200 && proofTargets.filter((id) => id !== productBriefReview.id && id !== finalReview.id).every((id) => asText(proofMap.body).includes(id)), 'Readiness Proof Map must expose required generic submission and evidence proof routes.');
  assert(proofMap.body.settingsProviderReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/settings-provider-readiness`, 'Readiness Proof Map must expose the project-scoped Settings provider readiness route.');
  assert(proofMap.body.settingsRuntimeReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/settings-runtime-readiness`, 'Readiness Proof Map must expose the project-scoped Settings runtime readiness route.');
  assert(proofMap.body.settingsIntegrationReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/settings-integration-readiness`, 'Readiness Proof Map must expose the project-scoped Settings integration readiness route.');
  assert(proofMap.body.projectMemoryReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/memory-readiness`, 'Readiness Proof Map must expose the memory readiness proof route.');
  const transcript = await fetchJson(`${backendUrl}/projects/${projectId}/transcripts/main`);
  assert(transcript.status === 200 && proofTargets.filter((id) => id !== evidenceSearch.id).every((id) => asText(transcript.body).includes(id)), 'Group Chat transcript must retain required submission, review, revision, final, and acceptance proof.');
  const timeline = await fetchJson(`${backendUrl}/projects/${projectId}/timeline`);
  const events = await fetchJson(`${backendUrl}/projects/${projectId}/events`);
  const timelineEventsText = `${asText(timeline.body)}\n${asText(events.body)}`;
  assert(timeline.status === 200 && events.status === 200 && proofTargets.every((id) => timelineEventsText.includes(id)), 'Timeline/Event Ledger must trace the complete zero-to-autonomy proof chain.');
  const agentDashboard = await fetchJson(`${backendUrl}/projects/${projectId}/agents/turing/dashboard`);
  assert(agentDashboard.status === 200 && [productBriefSubmission.id, implementationPlanSubmission.id, revisionSubmission.id, finalSubmission.id].every((id) => asText(agentDashboard.body).includes(id)), 'Agent Dashboard must expose Turing draft/implementation/revision/final outputs.');
  const evidenceIndex = await fetchJson(`${backendUrl}/projects/${projectId}/evidence-index-readiness`);
  assert(evidenceIndex.status === 200 && asText(evidenceIndex.body).includes(evidenceSearch.id) && asText(evidenceIndex.body).includes(finalSubmission.id), 'Evidence Index readiness must trace provider evidence and final deliverable.');
  const projectEvidenceArchive = await fetchJson(`${backendUrl}/projects/${projectId}/project-evidence-archive`);
  const archive = projectEvidenceArchive.body.projectEvidenceArchive;
  const archiveArtifactProofManifest = archive?.manifest?.find((entry) => entry.id === 'artifact-storage-proofs');
  assert(projectEvidenceArchive.status === 200 && archive?.schemaVersion === 'project-evidence-archive/v1', 'Project Evidence Archive must expose the real-user evidence handoff contract.');
  assert(archive.backendRoutes?.projectEvidenceArchive === `/projects/${projectId}/project-evidence-archive`, 'Project Evidence Archive must expose its own backend route.');
  assert(archive.readyForManagerHandoff === true && archive.status === 'archive-ready', 'Project Evidence Archive must become ready after evidence source decisions, artifact proofs, reviews, and final delivery are archived.');
  assert(archive.readyForProduction === false, 'Project Evidence Archive must not overclaim production export readiness.');
  assert(archive.summary?.finalDeliverableCount >= 1, 'Project Evidence Archive must include the accepted final deliverable.');
  assert(archive.summary?.evidenceSourceReviewDecisionCount >= evidenceSearch.sources.length, 'Project Evidence Archive must include every Reviewer source decision.');
  assert(archive.summary?.rawLeakCount === 0, 'Project Evidence Archive must keep the real-user archive redacted.');
  assert(
    archive.summary?.artifactStorageProofCoverageReady === true
      && archive.summary?.artifactStorageProofCount >= submissionRows.length
      && archive.summary?.workspaceFileProofCount >= submissionRows.length,
    'Project Evidence Archive must prove storage/workspace-file proof coverage for every real-user Agent submission.',
  );
  assert(
    archiveArtifactProofManifest?.ready === true
      && archiveArtifactProofManifest.storageProofCount >= submissionRows.length
      && archiveArtifactProofManifest.workspaceFileProofCount >= submissionRows.length,
    'Project Evidence Archive manifest must expose ready artifact-storage-proof coverage for every real-user Agent submission.',
  );
  const memoryReadiness = await fetchJson(`${backendUrl}/projects/${projectId}/memory-readiness`);
  assert(memoryReadiness.status === 200 && memoryReadiness.body.projectMemoryReadiness?.schemaVersion === 'project-memory-readiness/v1', 'Project memory readiness must be available after the real-user chain.');
  assert(memoryReadiness.body.projectMemoryReadiness?.readyForProduction === false, 'Project memory readiness must not claim managed memory production readiness.');
  const deliveryTrace = await fetchJson(`${backendUrl}/projects/${projectId}/product-team-delivery-trace`);
  const deliveryTraceText = asText(deliveryTrace.body).toLowerCase();
  assert(deliveryTrace.status === 200 && ['kickoff', 'brainstorm', 'evidence', 'draft', 'review', 'revision', 'final'].every((word) => deliveryTraceText.includes(word)), 'Product Team Delivery Trace must preserve the generic zero-to-autonomy stage chain.');
  const deliveryTraceModel = deliveryTrace.body.productTeamDeliveryTrace || {};
  const deliveryTraceRow = (id) => (deliveryTraceModel.rows || []).find((row) => row.id === id) || {};
  assert(deliveryTraceModel.readyForPrivatePilotDelivery === true, `Product Team Delivery Trace must close all generic zero-to-autonomy stages. Missing: ${JSON.stringify(deliveryTraceModel.missingRows || [])}`);
  assert(deliveryTraceRow('draft-artifact').ready === true && deliveryTraceRow('review-and-revision').ready === true, 'Product Team Delivery Trace must mark draft and review/revision stages ready.');
  const projectZeroToAutonomy = await fetchJson(`${backendUrl}/projects/${projectId}/zero-to-autonomy-report`);
  const projectZeroToAutonomyModel = projectZeroToAutonomy.body.zeroToAutonomyReport || {};
  const serializedProjectZeroToAutonomy = asText(projectZeroToAutonomy.body);
  assert(projectZeroToAutonomy.status === 200 && projectZeroToAutonomyModel.schemaVersion === 'project-zero-to-autonomy-report/v1', 'Project zero-to-autonomy report must be available through the real backend API.');
  assert(projectZeroToAutonomyModel.readyForLocalMvpTrial === true, `Project zero-to-autonomy report must mark the complete local MVP trial ready. Missing: ${JSON.stringify(projectZeroToAutonomyModel.missingRows || [])}`);
  assert(projectZeroToAutonomyModel.readyForPrivatePilotDelivery === true, 'Project zero-to-autonomy report must mark private-pilot delivery ready after trace and archive proof.');
  assert(projectZeroToAutonomyModel.readyForPublicProduction === false, 'Project zero-to-autonomy report must not claim public production readiness.');
  assert(projectZeroToAutonomyModel.summary?.submittedArtifactTypeCount === requiredGenericArtifactTypes.length, 'Project zero-to-autonomy report must prove complete generic artifact coverage.');
  assert((projectZeroToAutonomyModel.stageRows || []).some((row) => row.id === 'settings-byok-seal' && row.ready), 'Project zero-to-autonomy report must use the same Settings BYOK Seal stage id as the operator report.');
  assert(!(projectZeroToAutonomyModel.stageRows || []).some((row) => row.id === 'settings-byok-readiness'), 'Project zero-to-autonomy report must not use the stale Settings BYOK readiness stage id.');
  assert((projectZeroToAutonomyModel.stageRows || []).some((row) => row.id === 'brainstorm-draft-review-revision-final' && row.ready), 'Project zero-to-autonomy report must include the brainstorm-draft-review-revision-final stage.');
  assert(projectZeroToAutonomyModel.backendRoutes?.zeroToAutonomyReport === `/projects/${projectId}/zero-to-autonomy-report`, 'Project zero-to-autonomy report must expose its backend route.');
  assert(projectZeroToAutonomyModel.redaction?.plaintextProviderSecretsExposed === false && projectZeroToAutonomyModel.redaction?.ciphertextExposed === false, 'Project zero-to-autonomy report must expose explicit redaction status.');
  assert(!serializedProjectZeroToAutonomy.includes('SHOULD_NOT_LEAK') && !serializedProjectZeroToAutonomy.includes('"ciphertext":'), 'Project zero-to-autonomy report must not leak provider secrets or vault ciphertext.');

  const submittedArtifactTypes = new Set(submissionRows.map((row) => row.artifactType).filter(Boolean));
  const stageRows = [
    stageRow({
      id: 'settings-byok-seal',
      label: 'Settings BYOK Secret Vault and provider runtime',
      ready: true,
      route: '/secret-vault/seal',
      detail: 'Model key, search endpoint, and search key were sealed through the backend vault and bound to runtime providers.',
    }),
    stageRow({
      id: 'startup-readiness',
      label: 'Local MVP first-project readiness',
      ready: startupReadiness.readyForFirstProjectRun === true,
      route: '/local-mvp-startup-readiness',
      detail: startupReadiness.nextAction?.route || '',
    }),
    stageRow({
      id: 'kickoff-self-marketing',
      label: 'Kickoff meeting, role self-marketing, Leader/Reviewer confirmation',
      ready: missionRun.schemaVersion === 'product-team-mission-run/v1' && kickoffMeeting.transcript?.some((turn) => turn.stage === 'leader-campaign'),
      route: '/product-team-missions',
      proofIds: missionRun.proofIds || [],
      detail: `${missionRun.missionType || 'unknown'} / researchOnly=${missionRun.researchOnly === false ? 'false' : 'unknown'}`,
    }),
    stageRow({
      id: 'workspace-binding',
      label: 'Local/private MVP workspace binding and file proof',
      ready: true,
      route: `/projects/${projectId}/local-runtime`,
      detail: 'Workspace bind, write, and readback completed through backend routes.',
    }),
    stageRow({
      id: 'ca-handoff-autonomous-agent-output',
      label: 'C-side to A-side handoff and autonomous Agent output',
      ready: Boolean(collaborationHandoffSubmission.id && handoffSubmission.id),
      route: `/projects/${projectId}/collaboration-intent-queue`,
      proofIds: [collaborationHandoffSubmission.id, handoffSubmission.id],
      detail: 'Collaboration handoff and direct Agent Autonomous Action Queue both produced proofed submissions.',
    }),
    stageRow({
      id: 'provider-evidence-source-review',
      label: 'Provider-backed evidence and Reviewer source decisions',
      ready: evidenceSearch.sources?.length >= 2 && sourceReviewWorkflow.body.evidenceSourceReviewWorkflow?.summary?.pendingDecisionSourceCount === 0,
      route: `/projects/${projectId}/evidence-source-review-workflow`,
      proofIds: [evidenceSearch.id, ...sourceReviewResponses.map((review) => review.id)],
      detail: `${sourceReviewResponses.length} source decision(s) recorded.`,
    }),
    stageRow({
      id: 'brainstorm-draft-review-revision-final',
      label: 'Brainstorm, model-backed draft, review, revision, and final deliverable',
      ready: deliveryTraceModel.readyForPrivatePilotDelivery === true,
      route: `/projects/${projectId}/product-team-delivery-trace`,
      proofIds: [
        brainstormSubmission.id,
        productBriefSubmission.id,
        productBriefReview.id,
        revisionSubmission.id,
        finalSubmission.id,
        finalReview.id,
      ],
      detail: 'The Product Team Delivery Trace closed every generic zero-to-autonomy stage.',
    }),
    stageRow({
      id: 'generic-artifact-coverage',
      label: 'Required generic Agent submission types',
      ready: requiredGenericArtifactTypes.every((type) => submittedArtifactTypes.has(type)),
      route: `/projects/${projectId}/artifact-quality-audit`,
      proofIds: submissionRows.map((row) => row.id).filter(Boolean),
      detail: `${submittedArtifactTypes.size} submitted artifact type(s), ${requiredGenericArtifactTypes.length} required.`,
    }),
    stageRow({
      id: 'manager-proof-surfaces',
      label: 'Manager Flow Graph, Proof Map, transcript, timeline, event ledger, Agent Dashboard, Evidence Index',
      ready: true,
      route: `/projects/${projectId}/manager-flow-graph`,
      proofIds: proofTargets,
      detail: 'All proof surfaces retained the required submission, evidence, review, revision, final, and acceptance ids.',
    }),
    stageRow({
      id: 'project-evidence-archive',
      label: 'Project Evidence Archive and memory readiness handoff',
      ready: archive.readyForManagerHandoff === true && memoryReadiness.body.projectMemoryReadiness?.schemaVersion === 'project-memory-readiness/v1',
      route: `/projects/${projectId}/project-evidence-archive`,
      detail: `Archive status ${archive.status || 'unknown'}; productionReady=${archive.readyForProduction === true ? 'yes' : 'no'}.`,
    }),
  ];
  const report = {
    schemaVersion: 'real-user-zero-to-autonomy-operator-report/v1',
    generatedAt: new Date().toISOString(),
    status: stageRows.every((row) => row.ready) ? 'local-mvp-zero-to-autonomy-ready' : 'local-mvp-zero-to-autonomy-blocked',
    readyForLocalMvpTrial: stageRows.every((row) => row.ready),
    readyForPrivatePilotDelivery: Boolean(deliveryTraceModel.readyForPrivatePilotDelivery && archive.readyForManagerHandoff),
    readyForPublicProduction: false,
    missionType: missionRun.missionType || 'generic-product-team',
    projectId,
    summary: {
      stageCount: stageRows.length,
      readyStageCount: stageRows.filter((row) => row.ready).length,
      requiredArtifactTypeCount: requiredGenericArtifactTypes.length,
      submittedArtifactTypeCount: requiredGenericArtifactTypes.filter((type) => submittedArtifactTypes.has(type)).length,
      submissionCount: submissionRows.length,
      providerSourceCount: evidenceSearch.sources?.length || 0,
      sourceReviewDecisionCount: sourceReviewResponses.length,
      proofTargetCount: proofTargets.length,
      artifactStorageProofCount: archive.summary?.artifactStorageProofCount || 0,
      workspaceFileProofCount: archive.summary?.workspaceFileProofCount || 0,
      archiveRawLeakCount: archive.summary?.rawLeakCount || 0,
    },
    stageRows,
    artifactTypes: requiredGenericArtifactTypes.map((artifactType) => ({
      artifactType,
      present: submittedArtifactTypes.has(artifactType),
    })),
    backendRoutes: {
      localMvpStartupReadiness: '/local-mvp-startup-readiness',
      productTeamMissions: '/product-team-missions',
      settingsProviderReadiness: `/projects/${projectId}/settings-provider-readiness`,
      settingsRuntimeReadiness: `/projects/${projectId}/settings-runtime-readiness`,
      settingsIntegrationReadiness: `/projects/${projectId}/settings-integration-readiness`,
      localRuntime: `/projects/${projectId}/local-runtime`,
      managerFlowGraph: `/projects/${projectId}/manager-flow-graph`,
      readinessProofMap: `/projects/${projectId}/readiness-proof-map`,
      productTeamDeliveryTrace: `/projects/${projectId}/product-team-delivery-trace`,
      projectEvidenceArchive: `/projects/${projectId}/project-evidence-archive`,
      projectMemoryReadiness: `/projects/${projectId}/memory-readiness`,
      zeroToAutonomyReport: `/projects/${projectId}/zero-to-autonomy-report`,
    },
    productionBlockers: [
      'managed identity and service identity',
      'managed KMS or Secret Manager with rotation and revocation',
      'managed database and durable queue/cron cutover',
      'centralized audit, observability, alerting, and incident response',
      'provider cost controls, evals, and production provider incident process',
      'customer production acceptance policy and rollback proof',
    ],
    redaction: {
      plaintextProviderSecretsExposed: false,
      ciphertextExposed: false,
      archiveRawLeakCount: archive.summary?.rawLeakCount || 0,
      projectZeroToAutonomyChecksum: projectZeroToAutonomyModel.checksum || null,
    },
  };

  if (reportRequested) {
    if (reportFormat === 'markdown') {
      process.stdout.write(formatZeroToAutonomyReportMarkdown(report));
    } else {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
  } else {
    console.log('Real-user zero-to-autonomy agents:server API validation passed.');
  }
} finally {
  await stopChild(backendChild);
  await closeServer(mockModelRuntime);
  await closeServer(mockSearchRuntime);
  await rm(tempRoot, { recursive: true, force: true });
}
