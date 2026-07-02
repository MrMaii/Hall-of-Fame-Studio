import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(repoRoot, 'dist');
const tempRoot = resolve(repoRoot, '.tmp', 'real-user-zero-to-autonomy-agents-server-ui-validate');
const serverScript = resolve(repoRoot, 'scripts', 'agent-project-server.mjs');
const secretVaultRecordsFile = resolve(tempRoot, 'secret-vault-records.json');
const backendStorageKey = 'hall_of_fame_studio.agent_backend_url.v1';
const languageStorageKey = 'hall_of_fame_studio.language.v1';
const projectId = 'p_roundtable_001';
const modelPlaintext = 'REAL_USER_ZERO_TO_AUTONOMY_MODEL_KEY_SHOULD_NOT_LEAK';
const searchPlaintext = 'REAL_USER_ZERO_TO_AUTONOMY_SEARCH_KEY_SHOULD_NOT_LEAK';

function readCliArg(name) {
  const inlinePrefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

function normalizeBaseUrl(value = '') {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : '';
}

const configuredUiBaseUrl = normalizeBaseUrl(
  readCliArg('--ui-base-url')
  || process.env.HOFS_UI_BASE_URL
  || process.env.HOFS_REAL_USER_UI_BASE_URL
  || '',
);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const requestedPath = decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const absolutePath = normalize(join(distDir, requestedPath));
      if (!absolutePath.startsWith(distDir)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      const body = await readFile(absolutePath);
      response.writeHead(200, { 'content-type': mimeTypes[extname(absolutePath)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      const fallback = await readFile(join(distDir, 'index.html'));
      response.writeHead(200, { 'content-type': mimeTypes['.html'] });
      response.end(fallback);
    }
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
          title: 'Generic product-team validation product brief',
          summary: 'A manager-readable product brief connecting kickoff, provider evidence, brainstorm alternatives, review handoff, and final delivery as a generic product-team workflow.',
          body: [
            '# Generic product-team validation product brief',
            '',
            'This product brief keeps the work framed as a product-team artifact rather than a research-only output. The manager needs a concise path from kickoff to provider-backed evidence, brainstorm alternatives, a product brief submission, reviewer feedback, a linked revision note, and a final deliverable.',
            '',
            'The artifact should be inspected through Flow Graph, Proof Map, transcript, timeline, event ledger, and workspace storage proof. The handoff is explicit: Curie reviews evidence and quality, Turing owns backend proof, and the final package remains blocked for public production until managed identity, persistence, queue, provider audit, and operations controls exist.',
          ].join('\n'),
          tags: ['product-team', 'evidence', 'review-handoff'],
        })
      : 'Local mock model confirmed the backend provider path without external network use.';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      id: 'chatcmpl-real-user-zero-to-autonomy',
      object: 'chat.completion',
      model: requestBody.model || 'gpt-4o-mini',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 },
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
        id: 'real-user-search-response-1',
        confidence: 'high',
        findings: ['Local search gateway returned evidence for the autonomous product-team run.'],
        sources: [
          {
            id: 'real-user-source-1',
            title: 'Local product-team evidence source',
            url: 'https://example.test/product-team-evidence',
            summary: 'A controlled evidence result proving the user-configured search provider path.',
            confidence: 'high',
          },
        ],
      }));
    });
  });
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

async function waitForBackendSnapshot(url, predicate, message, { timeoutMs = 25000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = null;
  while (Date.now() < deadline) {
    lastSnapshot = await fetch(`${url}/snapshot`).then((response) => response.json());
    if (predicate(lastSnapshot)) return lastSnapshot;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  assert(false, message);
  return lastSnapshot;
}

function playwrightChromiumExecutableCandidates() {
  const explicitPath = process.env.HOFS_PLAYWRIGHT_CHROMIUM || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '';
  const localPlaywrightPath = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : '';
  const localHeadlessShells = localPlaywrightPath && existsSync(localPlaywrightPath)
    ? readdirSync(localPlaywrightPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^chromium_headless_shell-/.test(entry.name))
      .map((entry) => join(localPlaywrightPath, entry.name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'))
      .filter((candidate) => existsSync(candidate))
      .sort()
      .reverse()
    : [];
  return [explicitPath, ...localHeadlessShells].filter(Boolean);
}

async function launchBrowserWithRetry(attempts = 3) {
  let lastError = null;
  const optionSets = [
    { headless: true },
    ...playwrightChromiumExecutableCandidates().map((executablePath) => ({ headless: true, executablePath })),
  ];
  for (const options of optionSets) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await chromium.launch(options);
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await new Promise((resolvePromise) => setTimeout(resolvePromise, 600 * attempt));
      }
    }
  }
  throw lastError;
}

async function assertPageContains(page, text, message = `Expected page to contain "${text}".`) {
  await page.waitForFunction(
    (expectedText) => document.body.innerText.toLowerCase().includes(expectedText.toLowerCase()),
    text,
    { timeout: 10000 },
  ).catch(() => {});
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  assert(bodyText.toLowerCase().includes(text.toLowerCase()), message);
}

async function waitForButtonEnabled(page, testId, message, { timeoutMs = 20000 } = {}) {
  const button = page.getByTestId(testId);
  await button.waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && !element.disabled);
    },
    `[data-testid="${testId}"]`,
    { timeout: timeoutMs },
  );
  assert(await button.isEnabled(), message);
  return button;
}

async function scrollDashboardToStation(page) {
  await page.getByTestId('backend-worker-station').scrollIntoViewIfNeeded({ timeout: 10000 });
  await page.waitForTimeout(250);
}

function missionRowsFromProject(project) {
  if (Array.isArray(project?.productTeamMissionRuns)) return project.productTeamMissionRuns;
  if (Array.isArray(project?.productTeamMissionRuns?.rows)) return project.productTeamMissionRuns.rows;
  if (project?.productTeamMissionRuns?.latestRun) return [project.productTeamMissionRuns.latestRun];
  return [];
}

function findTeamAgentId(team = [], patterns = [], fallbackIndex = 0) {
  const row = team.find((agent) => {
    const searchable = `${agent.id || ''} ${agent.name || ''} ${agent.role || ''} ${agent.title || ''} ${agent.skill || ''}`;
    return patterns.some((pattern) => pattern.test(searchable));
  }) || team[fallbackIndex] || null;
  return row?.id || row?.name || '';
}

function findProjectTaskId(tasks = [], patterns = [], fallbackIndex = 0) {
  const row = tasks.find((task) => {
    const searchable = `${task.id || ''} ${task.text || ''} ${task.title || ''} ${task.assignee || ''} ${task.status || ''}`;
    return patterns.some((pattern) => pattern.test(searchable));
  }) || tasks[fallbackIndex] || null;
  return row?.id || null;
}

async function submitArtifact(backendUrl, {
  agentId,
  artifactType,
  title,
  summary,
  body,
  taskId,
  reviewerAgentId,
  sourceRefs = [],
  dependsOn = [],
}) {
  const response = await fetchJson(`${backendUrl}/projects/${projectId}/agents/${encodeURIComponent(agentId)}/submissions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
    }),
  });
  assert(response.status === 200, `Real-user ${artifactType} submission returned ${response.status}.`);
  const submission = response.body.submission || {};
  assert(
    submission.id
      && submission.artifactType === artifactType
      && submission.messageId
      && submission.timelineLogId
      && submission.eventId
      && submission.artifactStorageProofChecksum,
    `Real-user ${artifactType} must submit as a proofed Agent artifact node.`,
  );
  return submission;
}

async function closeAgentsServer(child) {
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

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

const staticRuntime = configuredUiBaseUrl
  ? { server: null, url: configuredUiBaseUrl, external: true }
  : await listen(createStaticServer());
const mockModelRuntime = await listen(createMockModelServer());
const searchRequests = [];
const mockSearchRuntime = await listen(createMockSearchServer(searchRequests));
const backendChild = spawn(process.execPath, [serverScript], {
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
    SECRET_VAULT_KEY: 'real-user-zero-to-autonomy-validation-key',
    SECRET_VAULT_KEY_ID: 'real-user-zero-to-autonomy-v1',
    SECRET_VAULT_RECORDS_FILE: secretVaultRecordsFile,
    MODEL_PROVIDER: 'openai-compatible',
    MODEL_BASE_URL: `${mockModelRuntime.url}/v1`,
    MODEL_NAME: 'gpt-4o-mini',
    SEARCH_PROVIDER: '',
    SEARCH_ENDPOINT: '',
    SEARCH_PROVIDER_ENDPOINT: '',
    SEARCH_PROVIDER_ENABLED: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser = null;
const consoleDiagnostics = [];
const backendResponses = [];

try {
  const backendUrl = await waitForServerUrl(backendChild);
  const vaultStatus = await fetchJson(`${backendUrl}/secret-vault/status`);
  assert(vaultStatus.body.secretVaultStatus?.ready === true, 'Real-user gate must start agents:server with a ready Secret Vault.');

  browser = await launchBrowserWithRetry();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ targetBackendUrl, storageKey, languageKey }) => {
    window.__AGENT_BACKEND_URL__ = targetBackendUrl;
    window.localStorage.setItem(storageKey, JSON.stringify(targetBackendUrl));
    window.localStorage.setItem(languageKey, 'en');
  }, {
    targetBackendUrl: backendUrl,
    storageKey: backendStorageKey,
    languageKey: languageStorageKey,
  });

  const page = await context.newPage();
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleDiagnostics.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    if (/\/(projects|product-team-missions|workers|kickoff-meetings|secret-vault)\b/.test(response.url())) {
      backendResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await page.goto(staticRuntime.url, { waitUntil: 'networkidle' });

  await page.getByTestId('open-settings-button').click();
  await page.getByTestId('settings-tab-keys').click();
  await page.getByTestId('settings-provider-boundary').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: /Sync status/i }).click();
  await page.waitForFunction(() => {
    const statusCard = document.querySelector('[data-testid="settings-secret-vault-status"]');
    return Boolean(statusCard && /ready/i.test(statusCard.textContent || ''));
  }, null, { timeout: 10000 });
  await page.getByTestId('settings-provider-model-key-input').fill(modelPlaintext);
  const sealModelButton = await waitForButtonEnabled(page, 'settings-provider-seal-model-key', 'Real user must be able to seal a model key before project startup.');
  await sealModelButton.click();
  await page.getByTestId('settings-provider-seal-receipt').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('settings-provider-search-endpoint-input').fill(`${mockSearchRuntime.url}/search`);
  const sealSearchEndpointButton = await waitForButtonEnabled(page, 'settings-provider-seal-search-endpoint', 'Real user must be able to seal a search endpoint before project startup.');
  await sealSearchEndpointButton.click();
  await page.waitForFunction(() => document.body.innerText.includes('search.endpoint'), null, { timeout: 10000 });
  await page.getByTestId('settings-provider-search-key-input').fill(searchPlaintext);
  const sealSearchButton = await waitForButtonEnabled(page, 'settings-provider-seal-search-key', 'Real user must be able to seal a search key before project startup.');
  await sealSearchButton.click();
  await page.waitForFunction(() => document.body.innerText.includes('search.apiKey'), null, { timeout: 10000 });

  const modelStatus = await fetchJson(`${backendUrl}/llm/status`);
  assert(modelStatus.body.modelProvider?.apiKeySource === 'local-secret-vault' && modelStatus.body.modelProvider?.enabled === true, 'Real-user model provider must be vault-backed and enabled after Settings key seal.');
  const searchStatus = await fetchJson(`${backendUrl}/search/status`);
  assert(searchStatus.body.searchProvider?.enabled === true && searchStatus.body.searchProvider?.provider === 'http-json', 'Real-user gate must have a callable user-configured search provider for evidence output.');
  assert(searchStatus.body.searchProvider?.endpointSource === 'local-secret-vault' && searchStatus.body.searchProvider?.apiKeySource === 'local-secret-vault', 'Real-user search provider must be vault-backed for both endpoint and key.');
  const searchTest = await fetchJson(`${backendUrl}/search/test`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'real user autonomous product-team evidence' }),
  });
  assert(searchTest.body.ok === true && searchTest.body.sources?.length === 1, 'Real-user search provider must return evidence from the user-configured endpoint.');
  assert(searchRequests.length >= 1 && searchRequests.at(-1).authorization === `Bearer ${searchPlaintext}`, 'Real-user search test must reach the configured search endpoint with the sealed key.');
  const records = await fetchJson(`${backendUrl}/secret-vault/records`);
  const serializedRecords = JSON.stringify(records.body);
  assert(!serializedRecords.includes(modelPlaintext) && !serializedRecords.includes(searchPlaintext), 'Real-user backend must not expose plaintext provider keys after Settings seal.');
  assert(!serializedRecords.includes(mockSearchRuntime.url), 'Real-user backend must not expose plaintext search endpoint through vault record metadata.');

  await page.getByRole('button', { name: /Close/i }).last().click();
  await page.getByText('Workspace Hub', { exact: false }).click();
  await assertPageContains(page, 'ACTIVE PROJECTS', 'Workspace dashboard must be reachable before starting a real initiation.');
  await page.getByTestId('start-initiation-button').click();
  await assertPageContains(page, 'Project Initiation Flow', 'A fresh user must be able to open project initiation.');
  await page.getByTestId('initiation-next-invite').click();
  await page.getByTestId('initiation-next-lobby').click();
  await page.getByTestId('initiation-start-meeting').click();
  await assertPageContains(page, 'INITIATION ROUNDTABLE', 'Initiation must reach the kickoff meeting.');
  await page.getByTestId('initiation-meeting-session-proof').waitFor({ state: 'visible', timeout: 8000 });
  await page.getByTestId('initiation-meeting-director-clarification').waitFor({ state: 'visible', timeout: 8000 });
  await page.getByTestId('initiation-meeting-clarification-input').fill('Manager clarified from zero setup: Turing owns backend proof, Curie reviews evidence, and the team must produce a generic product-team deliverable.');
  await page.getByTestId('initiation-meeting-save-clarification').click();
  await assertPageContains(page, 'ROLE QUESTIONS ANSWERED', 'Kickoff meeting must persist Manager clarification.');
  await page.getByTestId('initiation-meeting-leader-candidate-turing').click();
  await assertPageContains(page, 'MANAGER CONFIRMED IN MEETING', 'Kickoff meeting must persist the selected Leader.');
  await page.getByTestId('initiation-meeting-next-action-0').fill('Run the first generic product-team autonomy handoff and submit visible Agent output.');
  await page.getByTestId('initiation-meeting-save-next-actions').click();
  await assertPageContains(page, 'NEXT ACTION RESOLUTION:', 'Kickoff meeting must persist next actions before approval.');
  await page.getByTestId('initiation-finish-meeting').click();
  await assertPageContains(page, 'Director Decisions', 'Initiation result must expose Director decisions before approval.');
  await page.getByTestId('initiation-approve-create').click();
  await page.getByTestId('backend-worker-station').waitFor({ state: 'visible', timeout: 30000 });

  const missionSnapshot = await waitForBackendSnapshot(
    backendUrl,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === projectId);
      return missionRowsFromProject(project).some((run) => (
        run.schemaVersion === 'product-team-mission-run/v1'
        && run.reusedKickoffMeeting === true
        && run.autonomousSessionId
        && run.autonomousSessionTickId
      ));
    },
    'Real-user approval must create a reused-kickoff Mission Runner receipt with Autopilot proof.',
  );
  const initiatedProject = missionSnapshot.projects.find((item) => item.id === projectId);
  const missionRun = missionRowsFromProject(initiatedProject).find((run) => run.schemaVersion === 'product-team-mission-run/v1');
  assert(missionRun?.researchOnly === false, 'Real-user Mission Runner receipt must stay generic product-team, not research-only.');
  assert(missionRun?.customerAgentHandoff?.readyForLocalAutonomy === true, 'Mission Runner must create a C/A handoff ready for local autonomy.');
  const team = initiatedProject?.team || [];
  const productLeadAgentId = findTeamAgentId(team, [/jobs/i, /steve/i, /product|vision/i], 0);
  const evidenceReviewerAgentId = findTeamAgentId(team, [/curie/i, /marie/i, /evidence|review/i], 1);
  const architectAgentId = findTeamAgentId(team, [/turing/i, /alan/i, /system|architect|leader/i], 2);
  assert(productLeadAgentId && evidenceReviewerAgentId && architectAgentId, 'Real-user project must expose product lead, evidence reviewer, and architect Agent ids.');
  const projectTasks = initiatedProject?.tasks || [];
  const discoveryTaskId = findProjectTaskId(projectTasks, [/discover|interview|user|product|kickoff/i], 0);
  const evidenceTaskId = findProjectTaskId(projectTasks, [/evidence|search|source|report/i], 1);
  const brainstormTaskId = findProjectTaskId(projectTasks, [/brainstorm|option|idea|product/i], 0);
  const briefTaskId = findProjectTaskId(projectTasks, [/brief|draft|artifact|report|backend/i], 1);
  const reviewTaskId = findProjectTaskId(projectTasks, [/review|risk|final|decision/i], 2);

  await scrollDashboardToStation(page);
  await page.getByTestId('backend-product-team-mission-runs-snapshot').waitFor({ state: 'visible', timeout: 20000 });
  await page.getByTestId('backend-collaboration-intent-queue-snapshot').waitFor({ state: 'visible', timeout: 25000 });
  const intentRunButton = await waitForButtonEnabled(
    page,
    'collaboration-intent-run-customer-agent-handoff-intent',
    'A real user must be able to run the C/A handoff intent from the Manager UI.',
    { timeoutMs: 30000 },
  );
  await intentRunButton.click();
  await page.getByTestId('backend-collaboration-intent-run-output').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId('backend-collaboration-intent-output-work-submission').waitFor({ state: 'visible', timeout: 30000 });
  const intentOutputText = await page.getByTestId('backend-collaboration-intent-run-output').innerText();
  assert(/Intent Output Nodes/i.test(intentOutputText), 'Real-user intent run must render output nodes.');
  assert(/Agent Submission/i.test(intentOutputText), 'Real-user intent run must create an Agent Submission output node.');
  assert(/Output chat proof/i.test(intentOutputText), 'Real-user intent output must expose chat proof exits.');

  const providerEvidenceResponse = await fetchJson(`${backendUrl}/projects/${projectId}/agents/${encodeURIComponent(evidenceReviewerAgentId)}/evidence-searches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      useProvider: true,
      query: 'real user product-team evidence after kickoff',
      purpose: 'Agent Curie collects provider-backed evidence for the generic product-team delivery.',
      maxResults: 2,
      includeReadModels: false,
    }),
  });
  assert(providerEvidenceResponse.status === 200, `Real-user provider-backed evidence search returned ${providerEvidenceResponse.status}.`);
  const providerEvidenceSearch = providerEvidenceResponse.body.evidenceSearch || {};
  assert(providerEvidenceSearch.id && providerEvidenceSearch.provider === 'http-json', 'Real-user Agent evidence search must use the user-configured search provider.');
  assert(providerEvidenceSearch.sources?.length === 1, 'Real-user Agent evidence search must persist provider sources.');
  assert(providerEvidenceSearch.providerReceiptId && providerEvidenceResponse.body.providerReceipt?.id === providerEvidenceSearch.providerReceiptId, 'Real-user Agent evidence search must link to a provider receipt.');
  assert(providerEvidenceResponse.body.providerUsage?.providerVaultBindingChecksum, 'Real-user Agent evidence search must write provider usage with provider-vault proof.');
  assert(searchRequests.length >= 2 && searchRequests.at(-1).authorization === `Bearer ${searchPlaintext}`, 'Real-user Agent evidence search must reach the configured endpoint with the sealed key.');

  let submissions = await fetchJson(`${backendUrl}/projects/${projectId}/submissions`);
  let submissionRows = submissions.body.submissions?.submissions || submissions.body.submissions?.rows || submissions.body.submissions || [];
  assert(Array.isArray(submissionRows) && submissionRows.length >= 1, 'Real-user backend must persist at least one Agent submission after C/A handoff run.');
  const handoffSubmission = submissionRows[0];
  assert(handoffSubmission?.id && handoffSubmission?.artifactType, 'Real-user Agent submission must carry id and artifact type.');

  const discoverySubmission = await submitArtifact(backendUrl, {
    agentId: productLeadAgentId,
    artifactType: 'discovery-report',
    title: 'Generic product-team validation discovery report',
    summary: 'Jobs frames the customer goal, proof surfaces, and production blockers as a product-team discovery report.',
    body: '# Generic product-team validation discovery report\n\nThe customer starts from a blank workspace and expects a generic AI product team to turn a goal into inspectable product work: kickoff, evidence, brainstorm, draft, review, revision, implementation plan, and final delivery.',
    taskId: discoveryTaskId,
    reviewerAgentId: evidenceReviewerAgentId,
  });

  const evidencePacketSubmission = await submitArtifact(backendUrl, {
    agentId: evidenceReviewerAgentId,
    artifactType: 'evidence-packet',
    title: 'Generic product-team validation evidence packet',
    summary: 'Curie packages provider-backed evidence, source confidence, and decision constraints.',
    body: '# Generic product-team validation evidence packet\n\nThe evidence packet links the user-configured search provider result, source snapshot, confidence judgement, and downstream product-team decisions.',
    taskId: evidenceTaskId,
    reviewerAgentId: evidenceReviewerAgentId,
    sourceRefs: [{ type: 'evidence-search', id: providerEvidenceSearch.id, route: `/projects/${projectId}/evidence-searches/${providerEvidenceSearch.id}` }],
    dependsOn: [providerEvidenceSearch.id],
  });

  const brainstormSubmission = await submitArtifact(backendUrl, {
    agentId: productLeadAgentId,
    artifactType: 'brainstorm-board',
    title: 'Generic product-team validation brainstorm',
    summary: 'Jobs proposes options for turning the kickoff and evidence into a generic product-team deliverable.',
    body: '# Generic product-team validation brainstorm\n\n1. Ship the proof as a product-team delivery trace.\n2. Emphasize the provider-backed evidence path.\n3. Package the review and final-deliverable loop for customer inspection.',
    taskId: brainstormTaskId,
    reviewerAgentId: evidenceReviewerAgentId,
  });

  const productBriefDraftResponse = await fetchJson(`${backendUrl}/projects/${projectId}/agents/${encodeURIComponent(architectAgentId)}/artifact-drafts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      artifactType: 'product-brief',
      instruction: 'Draft a generic product-team validation brief from kickoff, provider-backed evidence, and the first autonomous handoff output.',
      evidenceSearchIds: [providerEvidenceSearch.id],
      priorSubmissionIds: [handoffSubmission.id, discoverySubmission.id, evidencePacketSubmission.id, brainstormSubmission.id],
      useModel: true,
      requireModel: true,
      submit: true,
      reviewerAgentId: evidenceReviewerAgentId,
      includeReadModels: false,
    }),
  });
  assert(productBriefDraftResponse.status === 200, `Real-user model-backed product brief draft returned ${productBriefDraftResponse.status}.`);
  assert(productBriefDraftResponse.body.artifactDraft?.schemaVersion === 'agent-artifact-draft/v1', 'Real-user product brief must be generated as an artifact draft contract.');
  assert(productBriefDraftResponse.body.artifactDraft?.source === 'model-artifact-draft' && productBriefDraftResponse.body.artifactDraft?.modelUsed === true, 'Real-user product brief must exercise the configured model provider path.');
  assert(productBriefDraftResponse.body.providerUsage?.operation === 'model:artifact-draft' && productBriefDraftResponse.body.providerUsage?.allowed === true, 'Real-user model-backed draft must write allowed provider usage proof.');
  assert(productBriefDraftResponse.body.providerUsage?.providerVaultBindingChecksum, 'Real-user model-backed draft must bind provider usage to provider-vault proof.');
  const productBriefSubmission = productBriefDraftResponse.body.submission || {};
  assert(productBriefSubmission.id && productBriefSubmission.artifactType === 'product-brief' && productBriefSubmission.isGeneratedDraft, 'Real-user model-backed draft must submit a product-brief Agent node.');

  const decisionProposalSubmission = await submitArtifact(backendUrl, {
    agentId: productLeadAgentId,
    artifactType: 'decision-proposal',
    title: 'Generic product-team validation decision proposal',
    summary: 'Jobs selects the delivery-trace direction and names which evidence and brainstorm alternatives support it.',
    body: '# Generic product-team validation decision proposal\n\nThe selected direction is a delivery-trace package because it connects kickoff, evidence, brainstorm, product brief, reviewer feedback, revision, implementation planning, and final delivery to Manager proof routes.',
    taskId: reviewTaskId,
    sourceRefs: [
      { type: 'agent-submission', id: discoverySubmission.id },
      { type: 'agent-submission', id: evidencePacketSubmission.id },
      { type: 'agent-submission', id: brainstormSubmission.id },
      { type: 'agent-submission', id: productBriefSubmission.id },
    ],
    dependsOn: [discoverySubmission.id, evidencePacketSubmission.id, brainstormSubmission.id, productBriefSubmission.id],
    reviewerAgentId: evidenceReviewerAgentId,
  });

  const riskReviewSubmission = await submitArtifact(backendUrl, {
    agentId: evidenceReviewerAgentId,
    artifactType: 'risk-review',
    title: 'Generic product-team validation risk review',
    summary: 'Curie records evidence limits, production blockers, and reviewer concerns before final delivery.',
    body: '# Generic product-team validation risk review\n\nThe risk review confirms the chain is valid for local MVP inspection, but production remains blocked by managed identity, persistence, queueing, provider audit, cost controls, and incident recovery.',
    taskId: reviewTaskId,
    sourceRefs: [
      { type: 'evidence-search', id: providerEvidenceSearch.id },
      { type: 'agent-submission', id: productBriefSubmission.id },
      { type: 'agent-submission', id: decisionProposalSubmission.id },
    ],
    dependsOn: [providerEvidenceSearch.id, productBriefSubmission.id, decisionProposalSubmission.id],
    reviewerAgentId: evidenceReviewerAgentId,
  });

  const implementationPlanSubmission = await submitArtifact(backendUrl, {
    agentId: architectAgentId,
    artifactType: 'implementation-plan',
    title: 'Generic product-team validation implementation plan',
    summary: 'Turing maps the selected direction into backend contracts, proof routes, validation gates, and launch blockers.',
    body: '# Generic product-team validation implementation plan\n\nThe implementation plan keeps the work backend-first: Agent submissions, artifact drafts, reviews, revisions, evidence, Flow Graph, Proof Map, transcript, timeline, and event ledger are route-backed before public launch hardening begins.',
    taskId: briefTaskId,
    sourceRefs: [
      { type: 'agent-submission', id: decisionProposalSubmission.id },
      { type: 'agent-submission', id: riskReviewSubmission.id },
    ],
    dependsOn: [decisionProposalSubmission.id, riskReviewSubmission.id],
    reviewerAgentId: evidenceReviewerAgentId,
  });

  const productBriefReviewResponse = await fetchJson(`${backendUrl}/projects/${projectId}/submissions/${encodeURIComponent(productBriefSubmission.id)}/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      reviewerAgentId: evidenceReviewerAgentId,
      verdict: 'changes-requested',
      comments: 'Evidence is present; add a concise revision that names the generic product-team contract and production blockers.',
      requestedChanges: ['Tie the brief to generic product-team artifacts instead of a research-only deliverable.'],
      includeReadModels: false,
    }),
  });
  assert(productBriefReviewResponse.status === 200 && productBriefReviewResponse.body.review?.verdict === 'changes-requested', 'Real-user Reviewer must be able to request changes on the product brief.');
  const productBriefReview = productBriefReviewResponse.body.review;

  const revisionResponse = await fetchJson(`${backendUrl}/projects/${projectId}/agents/${encodeURIComponent(architectAgentId)}/submissions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      artifactType: 'revision-note',
      title: 'Generic product-team contract revision',
      summary: 'Revision responds to Curie by keeping the validation sample generic and linking evidence, draft, and production blockers.',
      body: '# Generic product-team contract revision\n\nThis revision keeps the workflow generic: kickoff, evidence, product brief, review, revision, and final deliverable are product-team artifact nodes, not research-only paper steps.',
      reviewerAgentId: evidenceReviewerAgentId,
      revisesSubmissionId: productBriefSubmission.id,
      respondsToReviewId: productBriefReview.id,
      includeReadModels: false,
    }),
  });
  assert(revisionResponse.status === 200, `Real-user linked revision submission returned ${revisionResponse.status}.`);
  const revisionSubmission = revisionResponse.body.submission || {};
  assert(revisionSubmission.id && revisionSubmission.artifactType === 'revision-note' && revisionSubmission.respondsToReviewId === productBriefReview.id, 'Real-user Agent must submit a linked revision-note response.');

  const finalResponse = await fetchJson(`${backendUrl}/projects/${projectId}/agents/${encodeURIComponent(architectAgentId)}/submissions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      artifactType: 'final-deliverable',
      title: 'Final generic product-team validation package',
      summary: 'Final deliverable ties kickoff, evidence, draft, review, revision, Flow Graph, Proof Map, transcript, timeline, and event proof into one customer-visible chain.',
      body: '# Final generic product-team validation package\n\nThe team produced a provider-backed evidence node, a model-backed product brief, a requested-changes review, a linked revision note, and this final deliverable through generic backend contracts.',
      status: 'final',
      reviewerAgentId: evidenceReviewerAgentId,
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
      includeReadModels: false,
    }),
  });
  assert(finalResponse.status === 200, `Real-user final deliverable submission returned ${finalResponse.status}.`);
  const finalSubmission = finalResponse.body.submission || {};
  assert(finalSubmission.id && finalSubmission.artifactType === 'final-deliverable' && finalSubmission.status === 'final', 'Real-user Agent must submit a final-deliverable node.');

  const finalReviewResponse = await fetchJson(`${backendUrl}/projects/${projectId}/submissions/${encodeURIComponent(finalSubmission.id)}/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      reviewerAgentId: evidenceReviewerAgentId,
      verdict: 'accepted',
      comments: 'Final package accepted: evidence, draft, review, revision, and final delivery are traceable through backend proof surfaces.',
      includeReadModels: false,
    }),
  });
  assert(finalReviewResponse.status === 200 && finalReviewResponse.body.review?.verdict === 'accepted', 'Real-user Reviewer must accept the final deliverable.');
  const finalReview = finalReviewResponse.body.review;

  const reviewListResponse = await fetchJson(`${backendUrl}/projects/${projectId}/submission-reviews`);
  assert(reviewListResponse.status === 200 && Array.isArray(reviewListResponse.body.submissionReviews), 'Real-user backend must list submission reviews for open-change closure.');
  const openChangeReview = reviewListResponse.body.submissionReviews.find((review) => (
    review.verdict === 'changes-requested'
    && review.submissionId
    && review.submissionId !== productBriefSubmission.id
    && ![productBriefReview.id, finalReview.id].includes(review.id)
  ));
  if (openChangeReview) {
    const openChangeRevisionResponse = await fetchJson(`${backendUrl}/projects/${projectId}/agents/${encodeURIComponent(architectAgentId)}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        artifactType: 'revision-note',
        title: 'Autonomous evidence packet revision closure',
        summary: 'Linked revision closes the earlier autonomous evidence packet review request before final delivery readiness is assessed.',
        body: '# Autonomous evidence packet revision closure\n\nThis linked revision responds to the earlier changes-requested review and keeps the final delivery chain free of open review obligations.',
        reviewerAgentId: openChangeReview.reviewerAgentId || evidenceReviewerAgentId,
        revisesSubmissionId: openChangeReview.submissionId,
        respondsToReviewId: openChangeReview.id,
        includeReadModels: false,
      }),
    });
    assert(openChangeRevisionResponse.status === 200 && openChangeRevisionResponse.body.submission?.respondsToReviewId === openChangeReview.id, 'Real-user chain must close pre-existing changes-requested reviews with a linked revision note.');
  }

  submissions = await fetchJson(`${backendUrl}/projects/${projectId}/submissions`);
  submissionRows = submissions.body.submissions?.submissions || submissions.body.submissions?.rows || submissions.body.submissions || [];
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
  assert(
    requiredGenericArtifactTypes.every((artifactType) => submissionRows.some((row) => row.artifactType === artifactType)),
    'Real-user backend must persist every required generic product-team artifact type.',
  );

  const requiredTraceIds = [
    discoverySubmission.id,
    providerEvidenceSearch.id,
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
  const serializedFlowGraph = JSON.stringify(flowGraph.body);
  assert(flowGraph.body.nodes?.some((node) => node.id === `product-team-mission-run-${missionRun.id}`), 'Manager Flow Graph must expose the Mission Runner receipt node.');
  assert(serializedFlowGraph.includes(handoffSubmission.id), 'Manager Flow Graph must trace the Agent submission created by the real-user handoff.');
  assert(requiredTraceIds.every((id) => serializedFlowGraph.includes(id)), 'Manager Flow Graph must trace every required generic artifact, evidence, review, revision, final, and acceptance node.');

  const proofMap = await fetchJson(`${backendUrl}/projects/${projectId}/readiness-proof-map`);
  const serializedProofMap = JSON.stringify(proofMap.body);
  assert(serializedProofMap.includes('/readiness-proof-map') && serializedProofMap.includes('/manager-flow-graph'), 'Readiness Proof Map must expose proof routes after real-user handoff.');
  assert(serializedProofMap.includes('/submissions') || serializedProofMap.includes(handoffSubmission.id), 'Readiness Proof Map must trace Agent submission proof after real-user handoff.');
  assert(requiredTraceIds.filter((id) => id !== productBriefReview.id && id !== finalReview.id).every((id) => serializedProofMap.includes(id)), 'Readiness Proof Map must trace every required generic submission and provider-backed evidence proof.');
  assert(serializedProofMap.includes('/submission-review-workflow') && serializedProofMap.includes('/product-team-delivery-trace'), 'Readiness Proof Map must expose review workflow and product-team delivery trace routes.');
  assert(proofMap.body.projectMemoryReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/memory-readiness`, 'Readiness Proof Map must expose the memory readiness proof route after real-user handoff.');

  const deliveryTrace = await fetchJson(`${backendUrl}/projects/${projectId}/product-team-delivery-trace`);
  assert(deliveryTrace.status === 200 && deliveryTrace.body.productTeamDeliveryTrace?.schemaVersion === 'product-team-delivery-trace/v1', 'Real-user chain must expose the product-team delivery trace read model.');
  const traceModel = deliveryTrace.body.productTeamDeliveryTrace;
  const traceRows = traceModel.rows || [];
  const traceRow = (id) => traceRows.find((row) => row.id === id) || {};
  const assertTraceEvidence = (id, label) => {
    const row = traceRow(id);
    assert(row.id === id, `Real-user delivery trace must include ${label}.`);
    assert(
      (row.proofIds?.length || 0) > 0 || (row.timelineLogIds?.length || 0) > 0 || (row.eventIds?.length || 0) > 0,
      `Real-user delivery trace ${label} must carry proof, timeline, or event evidence.`,
    );
    return row;
  };
  const brainstormTrace = assertTraceEvidence('brainstorm-layer', 'the brainstorm layer');
  assert(
    (traceModel.summary?.brainstormAlternativeCount || 0) >= 2 || /[2-9]/.test(brainstormTrace.detail || ''),
    `Real-user delivery trace must show visible brainstorm alternatives. Row: ${JSON.stringify(brainstormTrace)}`,
  );
  const evidenceTrace = assertTraceEvidence('evidence-quality', 'the provider-backed evidence stage');
  assert(
    evidenceTrace.evidenceSearchIds?.includes(providerEvidenceSearch.id) || JSON.stringify(evidenceTrace).includes(providerEvidenceSearch.id),
    `Real-user delivery trace evidence stage must include the configured-provider search. Row: ${JSON.stringify(evidenceTrace)}`,
  );
  const draftTrace = assertTraceEvidence('draft-artifact', 'the model-backed draft stage');
  assert(
    draftTrace.artifactIds?.includes(productBriefSubmission.id) || JSON.stringify(draftTrace).includes(productBriefSubmission.id),
    `Real-user delivery trace draft stage must include the model-backed product brief. Row: ${JSON.stringify(draftTrace)}`,
  );
  const reviewTrace = assertTraceEvidence('review-and-revision', 'the review and revision stage');
  assert(
    [productBriefReview.id, revisionSubmission.id].every((id) => JSON.stringify(reviewTrace).includes(id)),
    `Real-user delivery trace review stage must include the requested-change review and linked revision. Row: ${JSON.stringify(reviewTrace)}`,
  );
  const finalTrace = assertTraceEvidence('final-deliverable', 'the final deliverable stage');
  assert(
    finalTrace.ready === true
      && finalTrace.artifactIds?.includes(finalSubmission.id)
      && JSON.stringify(finalTrace).includes(finalReview.messageId || finalReview.eventId || finalReview.timelineLogId),
    `Real-user delivery trace must mark the accepted final deliverable ready. Row: ${JSON.stringify(finalTrace)}`,
  );
  assert(traceModel.readyForProduction === false, 'Real-user delivery trace must not overclaim production readiness.');

  const reviewWorkflow = await fetchJson(`${backendUrl}/projects/${projectId}/submission-review-workflow`);
  assert(reviewWorkflow.status === 200 && reviewWorkflow.body.submissionReviewWorkflow?.schemaVersion === 'submission-review-workflow/v1', 'Real-user chain must expose the submission review workflow read model.');
  const reviewWorkflowModel = reviewWorkflow.body.submissionReviewWorkflow;
  const serializedReviewWorkflow = JSON.stringify(reviewWorkflowModel);
  const reviewWorkflowGates = new Map((reviewWorkflowModel.gates || []).map((gate) => [gate.id, gate]));
  assert(reviewWorkflowModel.summary?.reviewRoundCount >= 2, 'Real-user review workflow must record multiple review rounds.');
  assert(reviewWorkflowModel.summary?.revisionResponseCount >= 1, 'Real-user review workflow must record a linked revision response.');
  assert(reviewWorkflowModel.summary?.openChangeRequestCount === 0, 'Real-user review workflow must close change-requested reviews with linked revisions.');
  assert(reviewWorkflowModel.summary?.acceptedFinalDeliverableCount >= 1, 'Real-user review workflow must record final-deliverable acceptance.');
  assert(reviewWorkflowGates.get('change-requests-closed-by-revision')?.passed === true, 'Real-user review workflow must pass the change-request closure gate.');
  assert(reviewWorkflowGates.get('final-deliverable-accepted')?.passed === true, 'Real-user review workflow must pass the final-deliverable acceptance gate.');
  assert([productBriefReview.id, revisionSubmission.id, finalReview.id].every((id) => serializedReviewWorkflow.includes(id)), 'Real-user review workflow must trace review, revision, and final acceptance ids.');

  const artifactQuality = await fetchJson(`${backendUrl}/projects/${projectId}/artifact-quality-audit`);
  assert(artifactQuality.status === 200 && artifactQuality.body.artifactQualityAudit?.schemaVersion === 'artifact-quality-audit/v1', 'Real-user chain must expose artifact quality audit.');
  assert(artifactQuality.body.artifactQualityAudit.gates?.some((gate) => gate.id === 'draft-review-revision-final-loop' && gate.passed), 'Real-user artifact quality audit must prove the draft-review-revision-final loop.');
  assert(artifactQuality.body.artifactQualityAudit.gates?.some((gate) => gate.id === 'generic-artifact-type-coverage' && gate.passed), 'Real-user artifact quality audit must prove all required generic artifact types.');
  assert(artifactQuality.body.artifactQualityAudit.summary?.missingArtifactTypeCount === 0, 'Real-user artifact quality audit must report no missing generic artifact types.');

  const evidenceIndex = await fetchJson(`${backendUrl}/projects/${projectId}/evidence-index-readiness`);
  assert(evidenceIndex.status === 200 && evidenceIndex.body.evidenceIndexReadiness?.schemaVersion === 'evidence-index-readiness/v1', 'Real-user chain must expose the evidence index readiness contract.');
  const evidenceIndexModel = evidenceIndex.body.evidenceIndexReadiness;
  const serializedEvidenceIndex = JSON.stringify(evidenceIndexModel);
  assert(evidenceIndexModel.readyForLocalMvp === true, 'Real-user evidence index must become locally ready after evidence and artifact submissions.');
  assert(evidenceIndexModel.readyForProduction === false, 'Real-user evidence index must not claim managed vector-store production readiness.');
  assert(evidenceIndexModel.summary?.evidenceSearchCount >= 1, 'Real-user evidence index must count provider-backed evidence searches.');
  assert(evidenceIndexModel.summary?.submissionCount >= requiredGenericArtifactTypes.length, 'Real-user evidence index must count required Agent artifact submissions.');
  assert(evidenceIndexModel.summary?.artifactStorageProofCount >= requiredGenericArtifactTypes.length, 'Real-user evidence index must count required artifact storage proofs.');
  assert(evidenceIndexModel.summary?.sourceSnapshotCount >= 1, 'Real-user evidence index must count source snapshots.');
  assert(evidenceIndexModel.backendRoutes?.evidenceIndexReadiness === `/projects/${projectId}/evidence-index-readiness`, 'Real-user evidence index must expose its project route.');
  assert(requiredTraceIds.filter((id) => id !== productBriefReview.id && id !== finalReview.id).every((id) => serializedEvidenceIndex.includes(id)), 'Real-user evidence index must trace required evidence and artifact ids.');
  assert(evidenceIndexModel.gates?.some((gate) => gate.id === 'managed-vector-adapter-production-blocked' && gate.status === 'blocked'), 'Real-user evidence index must keep managed vector adapter as a production blocker.');
  assert(!serializedEvidenceIndex.includes(modelPlaintext) && !serializedEvidenceIndex.includes(searchPlaintext), 'Real-user evidence index must not leak sealed provider secrets.');
  const memoryReadiness = await fetchJson(`${backendUrl}/projects/${projectId}/memory-readiness`);
  assert(memoryReadiness.status === 200 && memoryReadiness.body.projectMemoryReadiness?.schemaVersion === 'project-memory-readiness/v1', 'Real-user chain must expose the project memory readiness contract.');
  assert(memoryReadiness.body.projectMemoryReadiness.readyForProduction === false, 'Real-user memory readiness must not claim managed memory production readiness.');

  const transcript = await fetchJson(`${backendUrl}/projects/${projectId}/transcripts/main`);
  const serializedTranscript = JSON.stringify(transcript.body);
  assert(serializedTranscript.includes('Turing owns backend proof') || serializedTranscript.includes('Agent Submission'), 'Group Chat transcript must retain Manager clarification or Agent output proof.');
  assert(serializedTranscript.includes(providerEvidenceSearch.id) || serializedTranscript.includes('provider-backed evidence'), 'Group Chat transcript must retain provider-backed evidence proof.');
  assert(requiredTraceIds.filter((id) => id !== providerEvidenceSearch.id).every((id) => serializedTranscript.includes(id)), 'Group Chat transcript must retain required generic submission, review, revision, final, and acceptance proof.');

  const timeline = await fetchJson(`${backendUrl}/projects/${projectId}/timeline`);
  const events = await fetchJson(`${backendUrl}/projects/${projectId}/events`);
  const serializedTimelineEvents = JSON.stringify({ timeline: timeline.body, events: events.body });
  assert(serializedTimelineEvents.includes(missionRun.id), 'Timeline/Event Ledger must trace Mission Runner proof.');
  assert(serializedTimelineEvents.includes(handoffSubmission.id), 'Timeline/Event Ledger must trace Agent submission proof.');
  assert(requiredTraceIds.every((id) => serializedTimelineEvents.includes(id)), 'Timeline/Event Ledger must trace required generic artifacts, evidence, review, revision, final, and final acceptance proof.');

  await scrollDashboardToStation(page);
  await page.getByTestId('backend-sync-manager-view').click();
  await page.getByTestId('backend-manager-submissions-snapshot').waitFor({ state: 'visible', timeout: 25000 });
  await page.getByTestId('backend-sync-proof-models').click();
  await page.getByTestId('backend-artifact-quality-audit-snapshot').waitFor({ state: 'visible', timeout: 25000 });
  await page.waitForFunction(
    (artifactTypes) => {
      const audit = document.querySelector('[data-testid="backend-artifact-quality-audit-snapshot"]');
      const text = audit?.textContent || '';
      return /9\/9/.test(text) || artifactTypes.every((artifactType) => text.includes(artifactType));
    },
    requiredGenericArtifactTypes,
    { timeout: 25000 },
  ).catch(() => {});
  const managerSubmissionsText = await page.getByTestId('backend-manager-submissions-snapshot').innerText();
  const artifactAuditText = await page.getByTestId('backend-artifact-quality-audit-snapshot').innerText();
  const managerArtifactUiText = `${managerSubmissionsText}\n${artifactAuditText}`;
  const normalizedManagerArtifactUiText = managerArtifactUiText.toLowerCase();
  const normalizedArtifactAuditText = artifactAuditText.toLowerCase();
  const missingManagerUiArtifactTypes = requiredGenericArtifactTypes.filter((artifactType) => !normalizedManagerArtifactUiText.includes(artifactType.toLowerCase()));
  assert(!missingManagerUiArtifactTypes.length, `Manager UI must render every required generic artifact type from backend submissions or Artifact Quality Audit. Missing: ${missingManagerUiArtifactTypes.join(', ')}. Audit excerpt: ${artifactAuditText.slice(0, 800)}`);
  assert(/9\/9/.test(artifactAuditText) || requiredGenericArtifactTypes.every((artifactType) => normalizedArtifactAuditText.includes(artifactType.toLowerCase())), `Manager UI Artifact Quality Audit must show complete generic artifact type coverage. Audit excerpt: ${artifactAuditText.slice(0, 800)}`);

  console.log('Real-user zero-to-autonomy agents:server UI validation passed.');
} catch (error) {
  const page = browser?.contexts?.()[0]?.pages?.()[0] || null;
  if (page) {
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    if (bodyText) console.error(`Visible page excerpt:\n${bodyText.slice(0, 1800)}`);
  }
  if (backendResponses.length) console.error(`Backend traffic tail:\n${backendResponses.slice(-30).join('\n')}`);
  if (consoleDiagnostics.length) console.error(`Console diagnostics:\n${consoleDiagnostics.slice(-20).join('\n')}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await closeAgentsServer(backendChild);
  if (staticRuntime.server) {
    await new Promise((resolvePromise) => staticRuntime.server.close(resolvePromise)).catch(() => {});
  }
  await new Promise((resolvePromise) => mockModelRuntime.server.close(resolvePromise)).catch(() => {});
  await new Promise((resolvePromise) => mockSearchRuntime.server.close(resolvePromise)).catch(() => {});
  await rm(tempRoot, { recursive: true, force: true });
}
