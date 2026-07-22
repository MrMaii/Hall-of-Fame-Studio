import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const ACCEPTANCE_RUN_ID = (process.env.HOFS_MANAGER_PRIVATE_PILOT_RUN_ID || `manager-private-pilot-ui-${process.pid}`)
  .replace(/[^a-zA-Z0-9_.-]/g, '-');
const ACCEPTANCE_ROOT = fileURLToPath(new URL(`../.tmp/product-team-acceptance/${ACCEPTANCE_RUN_ID}/`, import.meta.url));
const STATIC_PORTS = [4186, 4187, 4188, 4189, 4190];
const ACCEPTANCE_STORE = new URL(`../.tmp/product-team-acceptance/${ACCEPTANCE_RUN_ID}/store.json`, import.meta.url);
const HANDOFF_PREP_TIMEOUT_MS = Math.max(
  60_000,
  Number.parseInt(process.env.HOFS_PRIVATE_PILOT_HANDOFF_TIMEOUT_MS || '900000', 10) || 900_000,
);
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const PROJECT_ID = 'product_team_acceptance_project';
const PROJECT_NAME = 'General Product Team Acceptance Project';
const VIEWPORT = { width: 1440, height: 1100 };
const RUN_PRODUCTION_CONTROLS = process.env.HOFS_MANAGER_PRIVATE_PILOT_RUN_PRODUCTION_CONTROLS === '1';
const LOCAL_AUTH_STORAGE_KEY = 'hall_of_fame_studio.local_auth_session.v1';
const FAKE_SEARCH_SECRET = 'SEARCH_SECRET_SHOULD_NOT_LEAK_12345';
const FAKE_MODEL_SECRET = 'MODEL_SECRET_SHOULD_NOT_LEAK_12345';
const FAKE_VAULT_MASTER_KEY = 'VAULT_MASTER_KEY_SHOULD_NOT_LEAK_12345';
const FAKE_VAULT_ROTATED_MASTER_KEY = 'VAULT_ROTATED_MASTER_KEY_SHOULD_NOT_LEAK_12345';
const nativeFetch = globalThis.fetch.bind(globalThis);
let backendAuthContext = null;
const validationStartedAt = Date.now();

function validationProgress(label) {
  const elapsedSeconds = ((Date.now() - validationStartedAt) / 1000).toFixed(1);
  console.log(`[manager-private-pilot +${elapsedSeconds}s] ${label}`);
}

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
  || process.env.HOFS_MANAGER_PRIVATE_PILOT_UI_BASE_URL
  || '',
);

function localUiBaseUrlCandidates(value = '') {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return [];
  const candidates = [normalized];
  try {
    const url = new URL(normalized);
    if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
      candidates.push(normalizeBaseUrl(url.toString()));
    } else if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
      candidates.push(normalizeBaseUrl(url.toString()));
    }
  } catch {
    // Keep the original value as the only candidate.
  }
  return Array.from(new Set(candidates));
}

globalThis.fetch = async (...args) => {
  let lastError = null;
  const [input, init = {}] = args;
  let requestArgs = args;
  if (backendAuthContext?.token && String(input).startsWith(backendAuthContext.baseUrl)) {
    const headers = new Headers(init.headers || {});
    headers.set('x-hofs-local-auth-token', backendAuthContext.token);
    requestArgs = [input, { ...init, headers }];
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await nativeFetch(...requestArgs);
    } catch (error) {
      lastError = error;
      const code = error?.cause?.code || error?.code || '';
      if (!['ECONNRESET', 'ECONNREFUSED', 'UND_ERR_SOCKET'].includes(code) || attempt === 3) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError;
};

const MIME_TYPES = {
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

function isBenignBrowserConsoleError(text = '') {
  return /Failed to load resource:\s*net::ERR_NETWORK_CHANGED/i.test(String(text || ''));
}

function preparePrivatePilotHandoffStore() {
  const stageScript = fileURLToPath(new URL('./validate-private-pilot-handoff-contract.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [stageScript], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    timeout: HANDOFF_PREP_TIMEOUT_MS,
    env: {
      ...process.env,
      HOFS_PRIVATE_PILOT_FOCUSED_FILE_BACKED: '1',
      HOFS_PRIVATE_PILOT_FOCUSED_PRESERVE_TMP: '1',
      HOFS_PRIVATE_PILOT_FOCUSED_STOP_BEFORE_EXPORT: '1',
      HOFS_PRIVATE_PILOT_FOCUSED_TEMP_ROOT: ACCEPTANCE_ROOT,
      HOFS_PRIVATE_PILOT_FOCUSED_PROJECT_ID: PROJECT_ID,
      HOFS_PRIVATE_PILOT_FOCUSED_PROJECT_NAME: PROJECT_NAME,
      HOFS_PROGRESS: process.env.HOFS_PROGRESS || '0',
    },
  });
  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new Error(`Private-pilot focused UI preparation timed out after ${HANDOFF_PREP_TIMEOUT_MS}ms for run ${ACCEPTANCE_RUN_ID}.`);
    }
    throw result.error;
  }
  if (result.signal) {
    throw new Error(`Private-pilot focused UI preparation ended by ${result.signal} for run ${ACCEPTANCE_RUN_ID}.`);
  }
  assert(result.status === 0, `Private-pilot focused UI preparation failed with status ${result.status}.`);
  assert(existsSync(ACCEPTANCE_STORE), 'Private-pilot focused UI prep store must exist after focused handoff preparation.');
}

async function createAcceptanceRuntimeDependencies() {
  const projectRuntime = createLocalProjectRuntime({
    rootPath: `${ACCEPTANCE_ROOT}/runtime`,
    enableCommandExecution: false,
  });
  const secretVault = createLocalSecretVault({
    enabled: true,
    masterKey: FAKE_VAULT_MASTER_KEY,
    keyId: 'acceptance-local-v1',
    keySource: 'manager-private-pilot-ui-validation',
  });
  const sealedSearchSecret = await secretVault.seal('search.apiKey', FAKE_SEARCH_SECRET, { scope: 'search-provider' });
  const sealedModelSecret = await secretVault.seal('model.apiKey', FAKE_MODEL_SECRET, { scope: 'model-provider' });
  const vaultRotation = await secretVault.rotate({
    nextMasterKey: FAKE_VAULT_ROTATED_MASTER_KEY,
    nextKeyId: 'acceptance-local-v2',
    metadata: {
      reason: 'manager-private-pilot-ui-validation',
      keySource: 'manager-private-pilot-ui-validation',
    },
    now: '2026-06-01T10:05:00.000Z',
  });
  const rotatedSearchRecord = vaultRotation.records.find((record) => record.name === sealedSearchSecret.name);
  const rotatedModelRecord = vaultRotation.records.find((record) => record.name === sealedModelSecret.name);
  const searchApiKey = await secretVault.open(rotatedSearchRecord);
  const modelApiKey = await secretVault.open(rotatedModelRecord);
  const secretVaultStatus = secretVault.status();
  const searchProvider = createSearchProvider({
    provider: 'deterministic',
    enabled: true,
    apiKey: searchApiKey,
    apiKeySource: 'local-secret-vault',
    secretVaultStatus,
    endpoint: `https://search.local/query?api_key=${FAKE_SEARCH_SECRET}`,
    maxResults: 3,
  });
  let modelFetchCount = 0;
  const modelProvider = createModelProvider({
    provider: 'openai-compatible',
    model: 'gpt-4o-mini',
    enabled: true,
    apiKey: modelApiKey,
    apiKeySource: 'local-secret-vault',
    secretVaultStatus,
    baseURL: `https://models.local/v1?api_key=${FAKE_MODEL_SECRET}`,
    fetchImpl: async () => {
      modelFetchCount += 1;
      return new Response(JSON.stringify({
        id: `deterministic-ui-model-${modelFetchCount}`,
        model: 'gpt-4o-mini',
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Model drafted implementation progress brief',
              summary: 'The model-backed draft connects implementation evidence, prior decisions, and review signals into a manager-visible product-team artifact.',
              body: '# Model drafted implementation progress brief\n\n## Context\nThe product-team workflow has submitted discovery, evidence, decision, risk, implementation, and final-deliverable artifacts.\n\n## Model Draft Output\nThis model-backed progress brief summarizes implementation status, links the evidence search, and prepares the next manager review handoff without becoming a research-only paper section.\n\n## Handoff\nReviewer should compare this model-authored draft with the local fallback draft and keep production rollout blocked until real BYOK controls are approved.',
              tags: ['model-draft', 'artifact-draft', 'product-team'],
            }),
          },
        }],
        usage: {
          prompt_tokens: 180,
          completion_tokens: 90,
          total_tokens: 270,
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
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
    defaultToolGrants: ['provider:test', 'model:kickoff', 'model:intent', 'model:artifact-draft'],
    agentToolGrants: {
      curie: ['search:evidence'],
    },
  };
  return {
    projectRuntime,
    llmProvider: modelProvider,
    searchProvider,
    providerPolicy,
    secretVault,
  };
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      const requestedPath = pathname === '/' ? '/index.html' : pathname;
      const absolutePath = normalize(join(DIST_DIR, requestedPath));

      if (!absolutePath.startsWith(DIST_DIR)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      const body = await readFile(absolutePath);
      response.writeHead(200, {
        'content-type': MIME_TYPES[extname(absolutePath)] || 'application/octet-stream',
      });
      response.end(body);
    } catch {
      const fallback = await readFile(join(DIST_DIR, 'index.html'));
      response.writeHead(200, { 'content-type': MIME_TYPES['.html'] });
      response.end(fallback);
    }
  });
}

async function listen(server, port) {
  return new Promise((resolve) => {
    server.once('error', (error) => resolve({ ok: false, error }));
    server.listen(port, '127.0.0.1', () => resolve({ ok: true }));
  });
}

async function startStaticServer() {
  for (const port of STATIC_PORTS) {
    const server = createStaticServer();
    const result = await listen(server, port);
    if (result.ok) return { server, url: `http://127.0.0.1:${port}` };
  }
  throw new Error(`Could not bind static validation server on ${STATIC_PORTS.join(', ')}.`);
}

async function resolveExternalUiRuntime(value = '') {
  const candidates = localUiBaseUrlCandidates(value);
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (response.ok) {
        return { server: null, url: candidate, external: true, configuredUrl: normalizeBaseUrl(value) };
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Configured UI base URL is unreachable: ${normalizeBaseUrl(value)}. Tried: ${candidates.join(', ')}. ${lastError?.message || lastError || ''}`);
}

async function launchBrowserWithRetry(attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await chromium.launch({ headless: true });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      }
    }
  }
  try {
    return await chromium.launch({ channel: 'msedge', headless: true });
  } catch (edgeError) {
    throw new Error(`Could not launch Playwright browser. Bundled Chromium failed: ${lastError?.message || lastError}. Edge fallback failed: ${edgeError?.message || edgeError}`);
  }
}

async function assertPageContains(page, text, message = `Expected page to contain "${text}".`) {
  await page.waitForFunction(
    (expectedText) => document.body.innerText.includes(expectedText),
    text,
    { timeout: 10000 },
  ).catch(() => {});
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  assert(bodyText.includes(text), message);
}

async function scrollDashboardToStation(page) {
  await page.evaluate(() => {
    [...document.querySelectorAll('.overflow-y-auto')].forEach((element) => {
      element.scrollTop = Math.floor(element.scrollHeight * 0.45);
    });
  });
  await page.getByTestId('backend-worker-station').scrollIntoViewIfNeeded({ timeout: 15000 });
  await page.waitForTimeout(250);
}

async function getBackendJson(backendUrl, route) {
  const response = await fetch(`${backendUrl}${route}`);
  const body = await response.json().catch(() => ({}));
  assert(response.ok, `Backend route ${route} returned ${response.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

async function waitForBackendJson(backendUrl, route, predicate, message, { timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastBody = null;
  while (Date.now() < deadline) {
    lastBody = await getBackendJson(backendUrl, route);
    if (predicate(lastBody)) return lastBody;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const workflow = Object.values(lastBody || {}).find((value) => value && typeof value === 'object') || {};
  const failedGates = [
    ...(workflow.failedPrerequisiteGates || []),
    ...(workflow.prerequisiteGates || []).filter((gate) => !gate.passed),
  ].filter((gate, index, rows) => gate?.id && rows.findIndex((row) => row?.id === gate.id) === index);
  assert(false, `${message}. Failed gates: ${JSON.stringify(failedGates)}. Last body: ${JSON.stringify(lastBody).slice(0, 1200)}`);
  return lastBody;
}

async function waitForButtonEnabled(page, testId, message, { timeoutMs = 15000 } = {}) {
  const selector = `[data-testid="${testId}"]`;
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction((targetSelector) => {
    const button = document.querySelector(targetSelector);
    return Boolean(button && !button.disabled);
  }, selector, { timeout: timeoutMs }).catch(async () => {
    const disabled = await locator.isDisabled().catch(() => 'missing');
    if (disabled === false) return;
    throw new Error(`${message} Disabled state: ${disabled}`);
  });
  return locator;
}

async function waitForButtonDisabled(page, testId, message, { timeoutMs = 30000 } = {}) {
  const selector = `[data-testid="${testId}"]`;
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  await page.waitForFunction((targetSelector) => {
    const button = document.querySelector(targetSelector);
    return Boolean(button?.disabled);
  }, selector, { timeout: timeoutMs }).catch(async () => {
    const disabled = await locator.isDisabled().catch(() => 'missing');
    if (disabled === true) return;
    throw new Error(`${message} Disabled state: ${disabled}`);
  });
  return locator;
}

async function syncReadyPackageModels(page) {
  const packageButton = await waitForButtonEnabled(page, 'backend-sync-ready-package', 'Sync Package must be enabled before refreshing private-pilot controls.');
  const readyPackageResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname.endsWith('/manager-ready-package')
  ), { timeout: 60000 });
  await packageButton.click();
  const readyPackageResponse = await readyPackageResponsePromise;
  assert(
    readyPackageResponse.ok(),
    `Ready Package sync failed with HTTP ${readyPackageResponse.status()}.`,
  );
  await page.waitForTimeout(250);
}

async function recordPrivatePilotReceipt({
  page,
  backendUrl,
  testId,
  route,
  workflowKey,
  readyPredicate,
  beforePredicate,
  label,
}) {
  validationProgress(`${label}: using refreshed prerequisites`);
  validationProgress(`${label}: checking backend readiness`);
  await waitForBackendJson(
    backendUrl,
    route,
    (body) => beforePredicate(body[workflowKey] || {}),
    `${label} workflow must be ready for the C-side receipt before the button click`,
  );

  const button = await waitForButtonEnabled(page, testId, `${label} receipt button must be enabled by backend readiness gates.`);
  const [receiptResponse] = await Promise.all([
    page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === route
    ), { timeout: 60000 }),
    button.click(),
  ]);
  validationProgress(`${label}: button clicked`);
  const receiptPayload = await receiptResponse.json();
  assert(
    receiptResponse.ok(),
    `${label} receipt request failed with HTTP ${receiptResponse.status()}: ${receiptPayload.error || receiptPayload.message || 'unknown backend error'}.`,
  );

  const body = await waitForBackendJson(
    backendUrl,
    route,
    (payload) => readyPredicate(payload[workflowKey] || {}),
    `${label} receipt must be persisted through the backend route`,
    { timeoutMs: 30000 },
  );
  validationProgress(`${label}: receipt persisted`);
  await waitForButtonDisabled(page, testId, `${label} receipt button must disable after the backend receipt is recorded.`);
  validationProgress(`${label}: UI refreshed`);
  return body;
}

const preResolvedUiRuntime = configuredUiBaseUrl
  ? await resolveExternalUiRuntime(configuredUiBaseUrl)
  : null;

if (process.env.HOFS_SKIP_PRIVATE_PILOT_HANDOFF_PREP === '1') {
  assert(existsSync(ACCEPTANCE_STORE), 'Private-pilot launch-handoff store must exist when preparation is skipped.');
} else {
  preparePrivatePilotHandoffStore();
}
validationProgress('private-pilot handoff store ready');

const acceptanceDependencies = await createAcceptanceRuntimeDependencies();
const backendServer = createAgentProjectHttpServer({
  filePath: ACCEPTANCE_STORE,
  localAuthFilePath: join(ACCEPTANCE_ROOT, 'auth.json'),
  localAuthRequired: true,
  replaceWithSeed: false,
  ...acceptanceDependencies,
});
const backendRuntime = await backendServer.listen();
const bootstrapResponse = await fetch(`${backendRuntime.url}/local-auth/bootstrap`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'manager-private-pilot-validator', password: 'pilot1' }),
});
const bootstrapPayload = await bootstrapResponse.json();
assert(bootstrapResponse.status === 201, `Could not create isolated local validation account: ${bootstrapPayload.error || bootstrapResponse.status}.`);
const localAuthSession = { ...bootstrapPayload.localAuth, baseUrl: backendRuntime.url };
backendAuthContext = { baseUrl: backendRuntime.url, token: localAuthSession.token };
validationProgress('isolated local account ready');
const staticRuntime = configuredUiBaseUrl
  ? preResolvedUiRuntime
  : await startStaticServer();
let browser = null;
let page = null;
const diagnostics = [];
const pageErrors = [];

try {
  await waitForBackendJson(
    backendRuntime.url,
    `/projects/${PROJECT_ID}/launch-approvals`,
    (body) => (
      body.launchApprovalWorkflow?.readyForPrivatePilot === false
      && (body.launchApprovalWorkflow?.summary?.approvalCount || 0) === 0
    ),
    'Prepared launch-handoff project must stop before launch approvals are recorded',
  );
  await waitForBackendJson(
    backendRuntime.url,
    `/projects/${PROJECT_ID}/project-evidence-exports`,
    (body) => (
      body.projectEvidenceExportWorkflow?.readyForPrivatePilotHandoff === false
      && (body.projectEvidenceExportWorkflow?.summary?.requestCount || 0) === 0
    ),
    'Prepared launch-handoff project must stop before project evidence export is requested',
  );

  browser = await launchBrowserWithRetry();
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(({ authSession, authStorageKey, backendUrl, storageKey, languageStorageKey }) => {
    window.__AGENT_BACKEND_URL__ = backendUrl;
    window.localStorage.setItem(storageKey, JSON.stringify(backendUrl));
    window.localStorage.setItem(languageStorageKey, 'en');
    window.sessionStorage.setItem(authStorageKey, JSON.stringify(authSession));
  }, {
    authSession: localAuthSession,
    authStorageKey: LOCAL_AUTH_STORAGE_KEY,
    backendUrl: backendRuntime.url,
    storageKey: BACKEND_STORAGE_KEY,
    languageStorageKey: LANGUAGE_STORAGE_KEY,
  });
  page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' && !isBenignBrowserConsoleError(message.text())) {
      diagnostics.push(`console ${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack || error.message);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && /\/(projects|workers)\//.test(response.url())) {
      diagnostics.push(`http ${response.status()} ${response.url()}`);
    }
  });

  await page.goto(staticRuntime.url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  validationProgress('workspace loaded');
  const syncCatalogButton = page.getByTestId('backend-sync-project-catalog');
  if (await syncCatalogButton.count() > 0 && await syncCatalogButton.isVisible()) {
    await syncCatalogButton.click();
  }
  await assertPageContains(page, PROJECT_NAME, 'Backend project catalog sync must expose the prepared product-team acceptance project.');
  await page.getByText(PROJECT_NAME, { exact: true }).first().click();
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(
    page,
    'Validate private-pilot handoff for a generic AI product-team project.',
    'Prepared backend project goal must be visible after loading the real backend project.',
  );
  await scrollDashboardToStation(page);
  await page.getByTestId('backend-worker-station').waitFor({ state: 'visible', timeout: 10000 });
  validationProgress('complete Dashboard loaded');

  await syncReadyPackageModels(page);
  validationProgress('initial Ready Package sync requested');
  await page.getByTestId('backend-launch-approval-workflow-snapshot').waitFor({ state: 'visible', timeout: 30000 });
  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-launch-approval-record-manager',
    route: `/projects/${PROJECT_ID}/launch-approvals`,
    workflowKey: 'launchApprovalWorkflow',
    beforePredicate: (workflow) => !(workflow.modes?.find((mode) => mode.id === 'private-pilot')?.approvedRoles || []).includes('manager'),
    readyPredicate: (workflow) => (
      (workflow.modes?.find((mode) => mode.id === 'private-pilot')?.approvedRoles || []).includes('manager')
      && workflow.readyForPrivatePilot === false
    ),
    label: 'Private-pilot manager launch approval',
  });
  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-launch-approval-record-security',
    route: `/projects/${PROJECT_ID}/launch-approvals`,
    workflowKey: 'launchApprovalWorkflow',
    beforePredicate: (workflow) => (
      (workflow.modes?.find((mode) => mode.id === 'private-pilot')?.approvedRoles || []).includes('manager')
      && !(workflow.modes?.find((mode) => mode.id === 'private-pilot')?.approvedRoles || []).includes('security-admin')
    ),
    readyPredicate: (workflow) => workflow.readyForPrivatePilot === true && workflow.readyForProduction === false,
    label: 'Private-pilot security launch approval',
  });

  await page.getByTestId('backend-project-evidence-export-workflow-snapshot').waitFor({ state: 'visible', timeout: 10000 });
  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-project-evidence-export-request',
    route: `/projects/${PROJECT_ID}/project-evidence-exports`,
    workflowKey: 'projectEvidenceExportWorkflow',
    beforePredicate: (workflow) => (workflow.summary?.requestCount || 0) === 0,
    readyPredicate: (workflow) => Boolean(workflow.latestPrivatePilotRequest?.exportRequestId || workflow.latestPrivatePilotRequest?.id),
    label: 'Project evidence export request',
  });
  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-project-evidence-export-approve-manager',
    route: `/projects/${PROJECT_ID}/project-evidence-exports`,
    workflowKey: 'projectEvidenceExportWorkflow',
    beforePredicate: (workflow) => (
      Boolean(workflow.latestPrivatePilotRequest?.exportRequestId || workflow.latestPrivatePilotRequest?.id)
      && !(workflow.modes?.find((mode) => mode.id === 'private-pilot')?.approvedRoles || []).includes('manager')
    ),
    readyPredicate: (workflow) => (
      (workflow.modes?.find((mode) => mode.id === 'private-pilot')?.approvedRoles || []).includes('manager')
      && workflow.readyForPrivatePilotHandoff === false
    ),
    label: 'Project evidence export manager approval',
  });
  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-project-evidence-export-approve-security',
    route: `/projects/${PROJECT_ID}/project-evidence-exports`,
    workflowKey: 'projectEvidenceExportWorkflow',
    beforePredicate: (workflow) => (
      (workflow.modes?.find((mode) => mode.id === 'private-pilot')?.approvedRoles || []).includes('manager')
      && !(workflow.modes?.find((mode) => mode.id === 'private-pilot')?.approvedRoles || []).includes('security-admin')
    ),
    readyPredicate: (workflow) => workflow.readyForPrivatePilotHandoff === true && workflow.readyForPrivatePilotDownload === false,
    label: 'Project evidence export security approval',
  });
  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-project-evidence-export-record-download-audit',
    route: `/projects/${PROJECT_ID}/project-evidence-exports`,
    workflowKey: 'projectEvidenceExportWorkflow',
    beforePredicate: (workflow) => workflow.readyForPrivatePilotHandoff === true && workflow.readyForPrivatePilotDownload === false,
    readyPredicate: (workflow) => workflow.readyForPrivatePilotDownload === true,
    label: 'Project evidence export download audit',
  });

  const releaseCandidatePanel = page.getByTestId('backend-private-pilot-release-candidate-workflow-snapshot');
  await releaseCandidatePanel.waitFor({ state: 'visible', timeout: 10000 });
  const releaseCandidatePanelText = await releaseCandidatePanel.innerText();
  assert(
    /Private Pilot Release Candidate/i.test(releaseCandidatePanelText),
    'Ready Package must render private-pilot release-candidate workflow controls.',
  );

  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-private-pilot-record-release-candidate',
    route: `/projects/${PROJECT_ID}/private-pilot-release-candidates`,
    workflowKey: 'privatePilotReleaseCandidateWorkflow',
    beforePredicate: (workflow) => workflow.readyToRecord === true && workflow.readyForPrivatePilotRelease === false,
    readyPredicate: (workflow) => workflow.readyForPrivatePilotRelease === true,
    label: 'Private-pilot release candidate',
  });

  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-private-pilot-record-launch-run',
    route: `/projects/${PROJECT_ID}/private-pilot-launch-runs`,
    workflowKey: 'privatePilotLaunchRunWorkflow',
    beforePredicate: (workflow) => workflow.readyToLaunch === true && workflow.readyForPrivatePilotLaunch === false,
    readyPredicate: (workflow) => workflow.readyForPrivatePilotLaunch === true,
    label: 'Private-pilot launch run',
  });

  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-private-pilot-record-launch-health',
    route: `/projects/${PROJECT_ID}/private-pilot-launch-health-checks`,
    workflowKey: 'privatePilotLaunchHealthCheckWorkflow',
    beforePredicate: (workflow) => workflow.readyToCheck === true && workflow.readyForPrivatePilotMonitoring === false,
    readyPredicate: (workflow) => workflow.readyForPrivatePilotMonitoring === true,
    label: 'Private-pilot launch health',
  });

  await recordPrivatePilotReceipt({
    page,
    backendUrl: backendRuntime.url,
    testId: 'backend-private-pilot-record-acceptance-report',
    route: `/projects/${PROJECT_ID}/private-pilot-acceptance-reports`,
    workflowKey: 'privatePilotAcceptanceReportWorkflow',
    beforePredicate: (workflow) => workflow.readyToReport === true && workflow.readyForPrivatePilotAcceptance === false,
    readyPredicate: (workflow) => workflow.readyForPrivatePilotAcceptance === true,
    label: 'Private-pilot acceptance report',
  });

  const flowGraph = await getBackendJson(backendRuntime.url, `/projects/${PROJECT_ID}/manager-flow-graph`);
  assert(
    flowGraph.nodes?.some((node) => (
      node.subtype === 'private-pilot-acceptance-report'
      && node.route?.endsWith('/private-pilot-acceptance-reports')
      && node.proofIds?.length
      && node.timelineLogIds?.length
      && node.eventIds?.length
    )),
    'Manager Flow Graph must include the customer-visible private-pilot acceptance report node after C-side receipt clicks.',
  );

  const proofMap = await getBackendJson(backendRuntime.url, `/projects/${PROJECT_ID}/readiness-proof-map`);
  assert(
    proofMap.privatePilotAcceptanceReportSummary?.readyCount >= 1
      && proofMap.privatePilotAcceptanceReportRoutes?.some((route) => (
        route.apiPath?.endsWith('/private-pilot-acceptance-reports')
        && route.readyForPrivatePilotAcceptance === true
        && route.proofIds?.length
        && route.timelineLogIds?.length
        && route.eventIds?.length
      )),
    'Readiness Proof Map must prove the private-pilot acceptance report after C-side receipt clicks.',
  );
  assert(
    proofMap.launchOperationsOverviewSummary?.routeReady === true
      && proofMap.launchOperationsOverviewRoutes?.some((route) => route.apiPath?.endsWith('/launch-operations-overview')),
    'Readiness Proof Map must expose the backend launch operations overview route.',
  );

  const launchOperationsPayload = await getBackendJson(backendRuntime.url, `/projects/${PROJECT_ID}/launch-operations-overview`);
  const launchOperationsReadModel = launchOperationsPayload.launchOperationsOverview;
  assert(
    launchOperationsReadModel?.schemaVersion === 'launch-operations-overview/v1'
      && launchOperationsReadModel.readyForPrivatePilotAcceptance === true
      && launchOperationsReadModel.readyForPublicProduction === false
      && launchOperationsReadModel.publicProductionDecision === 'no-go'
      && launchOperationsReadModel.backendRoutes?.launchOperationsOverview?.endsWith('/launch-operations-overview'),
    'Backend launch operations overview must summarize private-pilot acceptance and keep public production no-go.',
  );

  const acceptancePanelText = await page.getByTestId('backend-private-pilot-acceptance-report-workflow-snapshot').innerText();
  assert(
    /Acceptance Ready/i.test(acceptancePanelText),
    'C-side Ready Package must show private-pilot acceptance readiness after the final backend receipt.',
  );
  const launchOperationsOverview = page.getByTestId('backend-launch-operations-overview');
  await launchOperationsOverview.waitFor({ state: 'visible', timeout: 10000 });
  const launchOperationsText = await launchOperationsOverview.innerText();
  assert(/Private pilot accepted/i.test(launchOperationsText), 'Manager UI launch operations overview must summarize private-pilot acceptance.');
  assert(/public production no-go/i.test(launchOperationsText), 'Manager UI launch operations overview must keep public production no-go.');
  assert(/Customer Acceptance/i.test(launchOperationsText) && /accepted/i.test(launchOperationsText), 'Manager UI launch operations overview must expose customer acceptance state.');
  assert(/Evidence Package/i.test(launchOperationsText) && /download audited/i.test(launchOperationsText), 'Manager UI launch operations overview must expose evidence package download audit state.');
  assert(/\/launch-operations-overview/i.test(launchOperationsText), 'Manager UI launch operations overview must link the backend overview route.');
  assert(/\/private-pilot-go-live-readiness/i.test(launchOperationsText), 'Manager UI launch operations overview must link the private-pilot go-live route.');
  assert(/\/public-production-startup-readiness/i.test(launchOperationsText), 'Manager UI launch operations overview must link the public-production startup route.');

  if (RUN_PRODUCTION_CONTROLS) {
    await recordPrivatePilotReceipt({
      page,
      backendUrl: backendRuntime.url,
      testId: 'backend-production-operations-record-controls',
      route: `/projects/${PROJECT_ID}/production-operations-control-receipts`,
      workflowKey: 'productionOperationsControlReceiptWorkflow',
      beforePredicate: (workflow) => workflow.readyForPrivatePilotOperations === true && workflow.readyForProductionOperations === false,
      readyPredicate: (workflow) => workflow.readyForProductionOperations === true,
      label: 'Production operations control rehearsal',
    });
    await recordPrivatePilotReceipt({
      page,
      backendUrl: backendRuntime.url,
      testId: 'backend-production-deployment-record-controls',
      route: `/projects/${PROJECT_ID}/production-deployment-control-receipts`,
      workflowKey: 'productionDeploymentControlReceiptWorkflow',
      beforePredicate: (workflow) => workflow.readyForPrivatePilotDeployment === true && workflow.readyForProductionDeployment === false,
      readyPredicate: (workflow) => workflow.readyForProductionDeployment === true,
      label: 'Production deployment control rehearsal',
    });
    await recordPrivatePilotReceipt({
      page,
      backendUrl: backendRuntime.url,
      testId: 'backend-production-security-record-controls',
      route: `/projects/${PROJECT_ID}/production-security-control-receipts`,
      workflowKey: 'productionSecurityControlReceiptWorkflow',
      beforePredicate: (workflow) => workflow.readyForLocalSecurityBoundary === true && workflow.readyForProductionSecurity === false,
      readyPredicate: (workflow) => workflow.readyForProductionSecurity === true,
      label: 'Production security control rehearsal',
    });
    await recordPrivatePilotReceipt({
      page,
      backendUrl: backendRuntime.url,
      testId: 'backend-production-provider-record-controls',
      route: `/projects/${PROJECT_ID}/production-provider-control-receipts`,
      workflowKey: 'productionProviderControlReceiptWorkflow',
      beforePredicate: (workflow) => workflow.readyForLocalProviderContract === true && workflow.readyForProductionProvider === false,
      readyPredicate: (workflow) => workflow.readyForProductionProvider === true,
      label: 'Production provider control rehearsal',
    });

    const productionFlowGraph = await getBackendJson(backendRuntime.url, `/projects/${PROJECT_ID}/manager-flow-graph`);
    for (const subtype of [
      'production-operations-control-receipt',
      'production-deployment-control-receipt',
      'production-security-control-receipt',
      'production-provider-control-receipt',
    ]) {
      assert(
        productionFlowGraph.nodes?.some((node) => (
          node.subtype === subtype
          && node.proofIds?.length
          && node.timelineLogIds?.length
          && node.eventIds?.length
        )),
        `Manager Flow Graph must include proofed ${subtype} nodes after C-side production control clicks.`,
      );
    }

    const productionProofMap = await getBackendJson(backendRuntime.url, `/projects/${PROJECT_ID}/readiness-proof-map`);
    assert(productionProofMap.productionOperationsControlReceiptSummary?.readyForProductionOperations === true, 'Proof Map must summarize production operations control receipt readiness after UI clicks.');
    assert(productionProofMap.productionDeploymentControlReceiptSummary?.readyForProductionDeployment === true, 'Proof Map must summarize production deployment control receipt readiness after UI clicks.');
    assert(productionProofMap.productionSecurityControlReceiptSummary?.readyForProductionSecurity === true, 'Proof Map must summarize production security control receipt readiness after UI clicks.');
    assert(productionProofMap.productionProviderControlReceiptSummary?.readyForProductionProvider === true, 'Proof Map must summarize production provider control receipt readiness after UI clicks.');
    assert(
      productionProofMap.productionLaunchControlCenterSummary?.productionOperationsControlsReady === true
        && productionProofMap.productionLaunchControlCenterSummary?.productionDeploymentControlsReady === true
        && productionProofMap.productionLaunchControlCenterSummary?.productionSecurityControlsReady === true
        && productionProofMap.productionLaunchControlCenterSummary?.productionProviderControlsReady === true
        && productionProofMap.productionLaunchControlCenterSummary?.readyForProduction === false,
      'Production Launch Control Center proof summary must show all local rehearsal controls ready while public production remains blocked.',
    );

    const productionEvidenceIntegrity = await getBackendJson(backendRuntime.url, `/projects/${PROJECT_ID}/production-evidence-integrity-audit`);
    assert(
      productionEvidenceIntegrity.productionEvidenceIntegrityAudit?.readyForProduction === false
        && productionEvidenceIntegrity.productionEvidenceIntegrityAudit?.readyForManagedProductionEvidence === false
        && productionEvidenceIntegrity.productionEvidenceIntegrityAudit?.summary?.localRehearsalControlCount > 0,
      'Production evidence integrity audit must keep local rehearsal receipts from becoming public-production proof.',
    );

    await syncReadyPackageModels(page);
    const productionLaunchControlText = await page.getByTestId('backend-production-launch-control-center-snapshot').innerText();
    assert(/no-go/i.test(productionLaunchControlText), 'Manager UI must keep production launch control center no-go after local rehearsal receipts.');
    const productionOverviewText = await page.getByTestId('backend-launch-operations-overview').innerText();
    assert(/public production no-go/i.test(productionOverviewText), 'Launch operations overview must keep public production no-go after local rehearsal receipts.');
    assert(/Production Blockers/i.test(productionOverviewText), 'Launch operations overview must keep production blocker counts visible.');
    console.log('Manager production controls UI validation passed.');
  }

  assert(pageErrors.length === 0, `Page errors were recorded:\n${pageErrors.join('\n')}`);
  assert(diagnostics.length === 0, `Browser/backend diagnostics were recorded:\n${diagnostics.join('\n')}`);
  console.log('Manager private-pilot UI validation passed.');
} catch (error) {
  if (page) {
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    console.error(`Visible page excerpt:\n${bodyText.slice(0, 1800)}`);
  }
  if (diagnostics.length) console.error(`Diagnostics:\n${diagnostics.join('\n')}`);
  if (pageErrors.length) console.error(`Page errors:\n${pageErrors.join('\n')}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await backendServer.close().catch(() => {});
  if (staticRuntime.server) {
    await new Promise((resolve) => staticRuntime.server.close(resolve)).catch(() => {});
  }
  if (process.env.HOFS_MANAGER_PRIVATE_PILOT_PRESERVE_TMP !== '1') {
    await rm(ACCEPTANCE_ROOT, { recursive: true, force: true }).catch(() => {});
  }
}
