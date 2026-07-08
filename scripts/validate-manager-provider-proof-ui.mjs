import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const BACKEND_STORE = new URL(`../.tmp/agent-manager-provider-proof-ui-store-${process.pid}.json`, import.meta.url);
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const VIEWPORT = { width: 1440, height: 1100 };
const nativeFetch = globalThis.fetch.bind(globalThis);

const providerEvidencePolicy = {
  enabled: true,
  mode: 'enforced',
  allowedSearchProviders: ['deterministic'],
  defaultToolGrants: ['search:evidence'],
  maxRequestsPerProjectHour: 10,
  dailyBudgetCents: 100,
  searchCostCentsPerRequest: 1,
  retryAttempts: 0,
  circuitFailureThreshold: 3,
  circuitWindowMinutes: 15,
  circuitCooldownSeconds: 300,
};

globalThis.fetch = async (...args) => {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await nativeFetch(...args);
    } catch (error) {
      lastError = error;
      const code = error?.cause?.code || error?.code || '';
      if (!['ECONNRESET', 'ECONNREFUSED', 'UND_ERR_SOCKET'].includes(code) || attempt === 3) throw error;
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

async function listen(server, { port = 0, host = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const address = server.address();
      resolve({
        server,
        url: `http://${address.address}:${address.port}`,
      });
    });
  });
}

async function waitForBackendSnapshot(url, predicate, message, { timeoutMs = 25000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = null;
  while (Date.now() < deadline) {
    lastSnapshot = await fetch(`${url}/snapshot`).then((response) => response.json());
    if (predicate(lastSnapshot)) return lastSnapshot;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(false, message);
  return lastSnapshot;
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

async function scrollDashboardToStation(page) {
  await page.getByTestId('backend-worker-station').scrollIntoViewIfNeeded({ timeout: 10000 });
  await page.waitForTimeout(250);
}

function playwrightChromiumExecutableCandidates() {
  const explicitPath = process.env.HOFS_PLAYWRIGHT_CHROMIUM || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '';
  const localPlaywrightPath = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : '';
  const localHeadlessShells = localPlaywrightPath && existsSync(localPlaywrightPath)
    ? safeReaddirSync(localPlaywrightPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^chromium_headless_shell-/.test(entry.name))
      .map((entry) => join(localPlaywrightPath, entry.name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'))
      .filter((candidate) => existsSync(candidate))
      .sort()
      .reverse()
    : [];
  return [explicitPath, ...localHeadlessShells].filter(Boolean);
}

function safeReaddirSync(path, options) {
  try {
    return readdirSync(path, options);
  } catch {
    return [];
  }
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
        if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      }
    }
  }
  throw lastError;
}

async function waitForButtonEnabled(page, testId, message, { timeoutMs = 15000 } = {}) {
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

const secretVault = createLocalSecretVault({
  enabled: true,
  masterKey: 'provider-proof-local-vault-key',
  keyId: 'provider-proof-v1',
});

const backendServer = createAgentProjectHttpServer({
  filePath: BACKEND_STORE,
  replaceWithSeed: true,
  llmProvider: createModelProvider({ enabled: false }),
  searchProvider: createSearchProvider({ provider: 'deterministic', enabled: true, maxResults: 2 }),
  secretVault,
  providerPolicy: providerEvidencePolicy,
});
const backendRuntime = await backendServer.listen();
const staticServer = createStaticServer();
const staticRuntime = await listen(staticServer);
let browser = null;
const backendResponses = [];
const consoleDiagnostics = [];

try {
  browser = await launchBrowserWithRetry();
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(({ backendUrl, storageKey, languageStorageKey }) => {
    window.__AGENT_BACKEND_URL__ = backendUrl;
    window.localStorage.setItem(storageKey, JSON.stringify(backendUrl));
    window.localStorage.setItem(languageStorageKey, 'en');
  }, {
    backendUrl: backendRuntime.url,
    storageKey: BACKEND_STORAGE_KEY,
    languageStorageKey: LANGUAGE_STORAGE_KEY,
  });

  const page = await context.newPage();
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleDiagnostics.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    if (/\/(projects|workers)\//.test(response.url())) {
      backendResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await page.goto(staticRuntime.url, { waitUntil: 'networkidle' });
  await page.getByTestId('open-settings-button').click();
  await page.getByTestId('settings-tab-deployment').click();
  await page.getByTestId('settings-deployment-runtime-boundary').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Deployment is owned by the worker station', 'Settings Deployment must present backend runtime ownership.');
  await assertPageContains(page, '/workers/autonomous/status', 'Settings Deployment must expose the backend worker status route.');
  await assertPageContains(page, 'Production rule:', 'Settings Deployment must keep production deployment blockers explicit.');

  await page.getByTestId('settings-tab-models').click();
  await page.getByTestId('settings-model-runtime-boundary').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Models are selected by backend provider policy', 'Settings Models must present backend provider policy ownership.');
  await assertPageContains(page, '/llm/status', 'Settings Models must expose the backend model status route.');
  await assertPageContains(page, '/provider-vault-bindings', 'Settings Models must expose the backend provider-vault binding route.');
  await assertPageContains(page, 'Provider policy, not browser routing', 'Settings Models must reject browser-only model routing controls.');

  await page.getByTestId('settings-tab-keys').click();
  await page.getByTestId('settings-provider-boundary').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Backend-owned provider credentials', 'Settings must present BYOK as a backend-owned provider boundary.');
  await page.getByRole('button', { name: /Sync status/i }).click();
  await page.getByTestId('settings-provider-search-status').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, '/llm/status', 'Settings provider boundary must expose the model provider status route.');
  await assertPageContains(page, '/search/status', 'Settings provider boundary must expose the evidence provider status route.');
  await page.getByTestId('settings-provider-search-endpoint-input').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('settings-provider-vault-bindings').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, '/provider-vault-bindings', 'Settings provider boundary must expose the provider-vault binding route.');
  await assertPageContains(page, 'Provider-vault binding proof', 'Settings provider boundary must show provider-vault binding proof.');
  await page.getByTestId('settings-secret-vault-status').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, '/secret-vault/seal', 'Settings provider boundary must expose the backend secret-vault seal route.');
  await page.getByTestId('settings-provider-model-key-input').fill('provider-proof-model-key');
  const sealModelKeyButton = await waitForButtonEnabled(
    page,
    'settings-provider-seal-model-key',
    'Settings model key seal must be enabled once the backend secret vault is ready.',
  );
  await sealModelKeyButton.click();
  await page.getByTestId('settings-provider-seal-receipt').waitFor({ state: 'visible', timeout: 8000 });
  await page.getByTestId('settings-provider-search-key-input').fill('provider-proof-search-key');
  const sealSearchKeyButton = await waitForButtonEnabled(
    page,
    'settings-provider-seal-search-key',
    'Settings search key seal must be enabled once the backend secret vault is ready.',
  );
  await sealSearchKeyButton.click();
  await page.waitForFunction(() => document.body.innerText.includes('search.apiKey'), null, { timeout: 8000 });
  const secretRecordsResponse = await fetch(`${backendRuntime.url}/secret-vault/records`).then((response) => response.json());
  const serializedSecretRecords = JSON.stringify(secretRecordsResponse);
  assert(secretRecordsResponse.secretVaultRecords?.records?.some((record) => record.name === 'model.apiKey' && record.encrypted === true), 'Settings model key seal must create an encrypted backend vault record.');
  assert(secretRecordsResponse.secretVaultRecords?.records?.some((record) => record.name === 'search.apiKey' && record.encrypted === true), 'Settings search key seal must create an encrypted backend vault record.');
  assert(!serializedSecretRecords.includes('provider-proof-model-key') && !serializedSecretRecords.includes('provider-proof-search-key'), 'Settings key seal must not expose plaintext keys through backend record metadata.');
  const providerModelStatusResponse = await fetch(`${backendRuntime.url}/llm/status`).then((response) => response.json());
  assert(providerModelStatusResponse.modelProvider?.hasApiKey === true && providerModelStatusResponse.modelProvider?.apiKeySource === 'local-secret-vault', 'Settings model key seal must bind the running backend model provider to the local secret vault.');
  assert(providerModelStatusResponse.modelProvider?.runtimeEnabled === true && providerModelStatusResponse.modelProvider?.enabled === true, 'Settings model key seal must enable the running backend model provider runtime.');
  const providerSearchStatusResponse = await fetch(`${backendRuntime.url}/search/status`).then((response) => response.json());
  assert(providerSearchStatusResponse.searchProvider?.hasApiKey === true && providerSearchStatusResponse.searchProvider?.apiKeySource === 'local-secret-vault', 'Settings search key seal must bind the running backend search provider to the local secret vault.');
  assert(providerSearchStatusResponse.searchProvider?.runtimeEnabled === true && providerSearchStatusResponse.searchProvider?.enabled === true, 'Settings search key seal must keep the deterministic backend search provider callable.');
  await assertPageContains(page, 'Production rule:', 'Settings provider boundary must keep production provider controls explicit.');
  const settingsText = await page.getByTestId('settings-provider-boundary').innerText();
  assert(!settingsText.includes('Paste token'), 'Settings must not present frontend token paste as the BYOK path.');
  const settingsModalText = await page.locator('section').first().innerText();
  assert(!settingsModalText.includes('Unified API Gateway') && !settingsModalText.includes('GPT-4.1'), 'Settings must not present browser-only deployment/model selectors as real provider configuration.');
  await page.getByRole('button', { name: /Close/i }).last().click();

  await page.getByRole('button', { name: /Load Sample Fixture.*Manager demo data/i }).click();
  await page.getByTestId('project-sample-fixture-banner').waitFor({ state: 'visible', timeout: 30000 });
  await assertPageContains(page, 'Manager Demo: Autonomous Agent Studio', 'Manager Demo sample fixture must be visible before provider-proof UI validation.');

  await scrollDashboardToStation(page);
  const station = page.getByTestId('backend-worker-station');
  await station.getByRole('button', { name: /Check/i }).click();
  await station.getByText('Online', { exact: true }).waitFor({ state: 'visible', timeout: 8000 });

  await page.getByTestId('backend-sync-agent-autonomous-action-queue').click();
  await page.getByTestId('backend-autonomous-run-control-snapshot').waitFor({ state: 'visible', timeout: 15000 });
  await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => snapshot.projects.some((project) => project.id === 'p_manager_demo_001'),
    'Manager Demo sample fixture must be adopted by the backend before provider-proof UI validation.',
  );

  const startButton = await waitForButtonEnabled(
    page,
    'backend-autonomous-run-control-session-start',
    'Autopilot session start must be enabled for the backend-adopted sample project.',
  );
  await startButton.click();
  await page.getByTestId('backend-autonomous-run-control-session-receipt').waitFor({ state: 'visible', timeout: 15000 });

  const schedulerTickButton = await waitForButtonEnabled(
    page,
    'backend-autonomous-run-control-session-scheduler-tick',
    'Autopilot scheduler tick must be enabled after the session starts.',
    { timeoutMs: 20000 },
  );
  await schedulerTickButton.click();
  await page.getByTestId('backend-autonomous-run-control-session-worker-receipt').waitFor({ state: 'visible', timeout: 20000 });
  await page.getByTestId('backend-autopilot-provider-evidence-receipt').waitFor({ state: 'visible', timeout: 25000 });
  await assertPageContains(page, 'Provider evidence:', 'Backend Worker Station must render the provider evidence receipt.');

  const providerSnapshot = await waitForBackendSnapshot(
    backendRuntime.url,
    (snapshot) => {
      const project = snapshot.projects.find((item) => item.id === 'p_manager_demo_001');
      const providerTick = project?.autonomousRunControlSessionTickLedger?.find((tick) => (
        tick.providerEvidenceSearch?.status === 'completed'
        && tick.providerEvidenceMessageId
        && tick.evidenceSearchId
        && tick.providerUsageId
      ));
      return Boolean(
        providerTick
        && snapshot.messages.some((message) => (
          message.projectId === project.id
          && message.id === providerTick.providerEvidenceMessageId
          && message.type === 'autopilot-provider-evidence'
          && message.evidenceSearchId === providerTick.evidenceSearchId
        )),
      );
    },
    'Autopilot provider evidence must persist a provider-backed tick and group-chat proof message.',
  );
  const providerProject = providerSnapshot.projects.find((item) => item.id === 'p_manager_demo_001');
  const providerTick = providerProject.autonomousRunControlSessionTickLedger.find((tick) => (
    tick.providerEvidenceSearch?.status === 'completed'
    && tick.providerEvidenceMessageId
    && tick.evidenceSearchId
    && tick.providerUsageId
  ));

  const flowGraph = await fetch(`${backendRuntime.url}/projects/p_manager_demo_001/manager-flow-graph`).then((response) => response.json());
  const providerFlowNode = flowGraph.nodes?.find((node) => (
    node.source === 'autonomousRunControlSessionTicks'
    && node.attachments?.some((attachment) => (
      attachment.type === 'autopilot-provider-evidence'
      && attachment.providerEvidenceMessageId === providerTick.providerEvidenceMessageId
      && attachment.providerEvidenceTranscriptRoute?.includes(providerTick.providerEvidenceMessageId)
    ))
  ));
  const providerAttachment = providerFlowNode?.attachments?.find((attachment) => (
    attachment.type === 'autopilot-provider-evidence'
    && attachment.providerEvidenceMessageId === providerTick.providerEvidenceMessageId
  ));
  assert(providerFlowNode && providerAttachment, 'Manager Flow Graph must attach provider evidence and transcript route to the Autopilot tick node.');

  const proofMap = await fetch(`${backendRuntime.url}/projects/p_manager_demo_001/readiness-proof-map`).then((response) => response.json());
  assert(proofMap.autonomousRunControlSessionTickRoutes?.some((route) => (
    route.id === providerTick.id
    && route.providerEvidenceMessageId === providerTick.providerEvidenceMessageId
    && route.providerEvidenceTranscriptRoute?.includes(providerTick.providerEvidenceMessageId)
  )), 'Readiness Proof Map must expose the Autopilot provider-evidence transcript route.');

  await page.getByRole('button', { name: /Open Flow Graph/i }).click();
  await page.getByTestId('manager-flow-graph').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: /Sync Graph/i }).click();
  const providerNodeElement = page.getByTestId(`manager-flow-node-${providerFlowNode.id}`);
  await providerNodeElement.waitFor({ state: 'attached', timeout: 15000 });
  await providerNodeElement.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });
  await page.waitForFunction((nodeId) => {
    const metadata = document.querySelector('[data-testid="timeline-node-metadata-detail"]')?.textContent || '';
    return metadata.includes(nodeId);
  }, providerFlowNode.id, { timeout: 10000 });
  await page.getByTestId('manager-flow-detail-attachment-autopilot-provider-evidence').waitFor({ state: 'visible', timeout: 5000 });
  await assertPageContains(page, 'Transcript route:', 'Flow Graph detail must render the provider evidence transcript route.');
  await page.getByTestId(`flow-open-transcript-${providerAttachment.id}`).click();
  await assertPageContains(page, 'PROOF FOCUS:', 'Flow Graph provider evidence attachment must jump to backend Group Chat transcript proof.');
  await assertPageContains(page, 'accepted the Autopilot evidence slot', 'Provider evidence transcript proof must show the Agent coordination message.');

  console.log('Manager provider proof UI validation passed.');
} catch (error) {
  await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
  const page = browser?.contexts?.()[0]?.pages?.()[0] || null;
  if (page) {
    await page.screenshot({
      path: fileURLToPath(new URL('../dist/manager-provider-proof-ui-failure.png', import.meta.url)),
      fullPage: true,
    }).catch(() => {});
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    console.error(`Visible page excerpt:\n${bodyText.slice(0, 1600)}`);
    const stationText = await page.getByTestId('backend-worker-station').innerText({ timeout: 1000 }).catch(() => '');
    if (stationText) console.error(`Backend Worker Station excerpt:\n${stationText.slice(-2400)}`);
  }
  if (backendResponses.length) console.error(`Backend traffic tail:\n${backendResponses.slice(-40).join('\n')}`);
  if (consoleDiagnostics.length) console.error(`Console diagnostics:\n${consoleDiagnostics.join('\n')}`);
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await backendServer.close().catch(() => {});
  await new Promise((resolve) => staticRuntime.server.close(resolve)).catch(() => {});
}
