import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(repoRoot, 'dist');
const tempRoot = resolve(repoRoot, '.tmp', 'settings-agents-server-ui-validate');
const serverScript = resolve(repoRoot, 'scripts', 'agent-project-server.mjs');
const secretVaultRecordsFile = resolve(tempRoot, 'secret-vault-records.json');
const backendStorageKey = 'hall_of_fame_studio.agent_backend_url.v1';
const languageStorageKey = 'hall_of_fame_studio.language.v1';
const modelPlaintext = 'SETTINGS_UI_MODEL_KEY_SHOULD_NOT_LEAK';
const searchPlaintext = 'SETTINGS_UI_SEARCH_KEY_SHOULD_NOT_LEAK';

function readCliArg(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const prefixed = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : '';
}

function normalizeBaseUrl(value = '') {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : '';
}

const configuredUiBaseUrl = normalizeBaseUrl(readCliArg('--ui-base-url') || process.env.HOFS_UI_BASE_URL || '');

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
        id: 'settings-ui-search-response-1',
        confidence: 'high',
        findings: ['Settings UI configured a real backend search endpoint.'],
        sources: [
          {
            id: 'settings-ui-source-1',
            title: 'Settings UI search source',
            url: 'https://example.test/settings-search-source',
            summary: 'Controlled result from the local Settings validation search gateway.',
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

async function assertPageContains(page, text, message) {
  await page.waitForFunction(
    (expectedText) => document.body.innerText.toLowerCase().includes(expectedText.toLowerCase()),
    text,
    { timeout: 10000 },
  ).catch(() => {});
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  assert(bodyText.toLowerCase().includes(text.toLowerCase()), message || `Expected page to contain "${text}".`);
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

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

const backendChild = spawn(process.execPath, [serverScript], {
  cwd: repoRoot,
  env: {
    ...process.env,
    AGENT_PROJECT_HOST: '127.0.0.1',
    AGENT_PROJECT_PORT: '0',
    AGENT_PROJECT_STORE: resolve(tempRoot, 'store.json'),
    AGENT_PROJECT_RUNTIME_ROOT: resolve(tempRoot, 'runtime'),
    AGENT_SECURITY_AUDIT_LOG: resolve(tempRoot, 'security-audit.jsonl'),
    SECRET_VAULT_ENABLED: 'true',
    SECRET_VAULT_KEY: 'settings-agents-server-ui-validation-key',
    SECRET_VAULT_KEY_ID: 'settings-agents-server-ui-v1',
    SECRET_VAULT_RECORDS_FILE: secretVaultRecordsFile,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser = null;
let staticRuntime = null;
let mockSearchRuntime = null;
const searchRequests = [];
const consoleDiagnostics = [];

try {
  const backendUrl = await waitForServerUrl(backendChild);
  const vaultStatus = await fetchJson(`${backendUrl}/secret-vault/status`);
  assert(vaultStatus.body.secretVaultStatus?.ready === true, 'agents:server Secret Vault must be ready before Settings UI validation.');

  mockSearchRuntime = await listen(createMockSearchServer(searchRequests));
  staticRuntime = configuredUiBaseUrl ? await resolveExternalUiRuntime(configuredUiBaseUrl) : await listen(createStaticServer());
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

  await page.goto(staticRuntime.url, { waitUntil: 'networkidle' });
  await page.getByTestId('open-settings-button').click();
  await page.getByTestId('settings-tab-keys').click();
  await page.getByTestId('settings-provider-boundary').waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(page, 'Backend-owned provider credentials', 'Settings Keys must render the backend provider boundary.');
  await page.getByTestId('settings-secret-vault-local-startup-contract').waitFor({ state: 'visible', timeout: 10000 });
  const startupContractText = await page.getByTestId('settings-secret-vault-local-startup-contract').innerText();
  assert(
    startupContractText.includes('SECRET_VAULT_ENABLED=true')
      && startupContractText.includes('SECRET_VAULT_KEY')
      && startupContractText.includes('/local-mvp-startup-readiness')
      && startupContractText.includes('/settings/provider-readiness')
      && startupContractText.includes('/secret-vault/status')
      && startupContractText.includes('/secret-vault/seal')
      && startupContractText.includes('Startup readiness'),
    'Settings Keys must show the local agents:server Secret Vault startup contract before API keys are sealed.',
  );
  await page.getByRole('button', { name: /Sync status/i }).click();
  await page.waitForFunction(() => {
    const statusCard = document.querySelector('[data-testid="settings-secret-vault-status"]');
    return Boolean(statusCard && /ready/i.test(statusCard.textContent || ''));
  }, null, { timeout: 10000 });
  await assertPageContains(page, '/secret-vault/seal', 'Settings Keys must expose the backend secret-vault seal route.');
  const footerStatus = await page.getByTestId('settings-footer-backend-save-status').innerText();
  assert(
    footerStatus.toLowerCase().includes('backend-backed controls save on change'),
    `Settings footer must only claim backend-backed saves after the UI reaches the real backend readiness routes. Actual footer: ${footerStatus}`,
  );
  await page.getByTestId('settings-tab-health').click();
  await page.getByRole('button', { name: /Quick check/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes('/settings/health-readiness'), null, { timeout: 10000 });
  await assertPageContains(page, 'Settings Health', 'Settings Health tab must render backend-owned health readiness rows.');
  await assertPageContains(page, 'Local MVP startup', 'Settings Health quick check must include local MVP startup readiness from the backend contract.');
  await assertPageContains(page, 'Project catalog', 'Settings Health quick check must include backend project catalog readiness.');
  await page.getByTestId('settings-tab-keys').click();

  await page.getByTestId('settings-provider-model-key-input').fill(modelPlaintext);
  const sealModelButton = await waitForButtonEnabled(
    page,
    'settings-provider-seal-model-key',
    'Model key seal button must be enabled when agents:server Secret Vault is ready.',
  );
  await sealModelButton.click();
  await page.getByTestId('settings-provider-seal-receipt').waitFor({ state: 'visible', timeout: 10000 });

  await page.getByTestId('settings-provider-search-endpoint-input').fill(`${mockSearchRuntime.url}/search`);
  const sealSearchEndpointButton = await waitForButtonEnabled(
    page,
    'settings-provider-seal-search-endpoint',
    'Search endpoint seal button must be enabled when agents:server Secret Vault is ready.',
  );
  await sealSearchEndpointButton.click();
  await page.waitForFunction(() => document.body.innerText.includes('search.endpoint'), null, { timeout: 10000 });

  await page.getByTestId('settings-provider-search-key-input').fill(searchPlaintext);
  const sealSearchButton = await waitForButtonEnabled(
    page,
    'settings-provider-seal-search-key',
    'Search key seal button must be enabled when agents:server Secret Vault is ready.',
  );
  await sealSearchButton.click();
  await page.waitForFunction(() => document.body.innerText.includes('search.apiKey'), null, { timeout: 10000 });

  const recordsResponse = await fetchJson(`${backendUrl}/secret-vault/records`);
  const serializedRecords = JSON.stringify(recordsResponse.body);
  assert(recordsResponse.status === 200, `Secret Vault records route returned ${recordsResponse.status}.`);
  assert(recordsResponse.body.secretVaultRecords?.records?.some((record) => record.name === 'model.apiKey' && record.encrypted === true), 'Settings UI must seal model.apiKey into the real agents:server vault.');
  assert(recordsResponse.body.secretVaultRecords?.records?.some((record) => record.name === 'search.endpoint' && record.encrypted === true), 'Settings UI must seal search.endpoint into the real agents:server vault.');
  assert(recordsResponse.body.secretVaultRecords?.records?.some((record) => record.name === 'search.apiKey' && record.encrypted === true), 'Settings UI must seal search.apiKey into the real agents:server vault.');
  assert(!serializedRecords.includes(modelPlaintext) && !serializedRecords.includes(searchPlaintext), 'Real agents:server vault records must not expose plaintext Settings keys.');
  assert(!serializedRecords.includes(mockSearchRuntime.url), 'Real agents:server vault records must not expose the plaintext Settings search endpoint.');
  assert(!serializedRecords.includes('ciphertext'), 'Real agents:server vault record metadata must not expose ciphertext.');

  const modelStatusResponse = await fetchJson(`${backendUrl}/llm/status`);
  assert(modelStatusResponse.body.modelProvider?.hasApiKey === true, 'Settings model key seal must bind the key into the running agents:server model provider.');
  assert(modelStatusResponse.body.modelProvider?.apiKeySource === 'local-secret-vault', 'Running model provider must report local-secret-vault as the key source after Settings seal.');
  assert(modelStatusResponse.body.modelProvider?.runtimeEnabled === true, 'Settings model key seal must enable the running agents:server model runtime.');
  assert(modelStatusResponse.body.modelProvider?.enabled === true, 'Settings model key seal must make the local model provider callable when no policy block is configured.');
  const searchStatusResponse = await fetchJson(`${backendUrl}/search/status`);
  assert(searchStatusResponse.body.searchProvider?.hasApiKey === true, 'Settings search key seal must bind the key into the running agents:server search provider.');
  assert(searchStatusResponse.body.searchProvider?.apiKeySource === 'local-secret-vault', 'Running search provider must report local-secret-vault as the key source after Settings seal.');
  assert(searchStatusResponse.body.searchProvider?.hasEndpoint === true, 'Settings search endpoint seal must bind the endpoint into the running agents:server search provider.');
  assert(searchStatusResponse.body.searchProvider?.endpointSource === 'local-secret-vault', 'Running search provider must report local-secret-vault as the endpoint source after Settings seal.');
  assert(searchStatusResponse.body.searchProvider?.runtimeEnabled === true, 'Settings search key seal must mark the search runtime intentionally enabled.');
  assert(searchStatusResponse.body.searchProvider?.enabled === true && searchStatusResponse.body.searchProvider?.configured === true, 'Settings search endpoint/key seal must make the real agents:server search provider callable.');
  const searchTestResponse = await fetchJson(`${backendUrl}/search/test`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'settings search endpoint proof' }),
  });
  assert(searchTestResponse.status === 200 && searchTestResponse.body.ok === true, 'Settings search endpoint/key seal must make /search/test return provider evidence.');
  assert(searchRequests.length >= 1 && searchRequests.at(-1).authorization === `Bearer ${searchPlaintext}`, 'Settings search test must reach the configured endpoint with the sealed key.');
  await assertPageContains(page, 'Backend ready', 'Settings must show a ready provider after endpoint and key are configured through the backend vault.');

  const settingsText = await page.getByTestId('settings-provider-boundary').innerText();
  assert(!settingsText.includes(modelPlaintext) && !settingsText.includes(searchPlaintext), 'Settings UI must clear plaintext keys after backend seal receipts.');

  console.log('Settings agents:server UI validation passed.');
} catch (error) {
  if (consoleDiagnostics.length) {
    console.error(`Console diagnostics:\n${consoleDiagnostics.slice(-20).join('\n')}`);
  }
  throw error;
} finally {
  await browser?.close().catch(() => {});
  if (staticRuntime?.server) {
    await new Promise((resolvePromise) => staticRuntime.server.close(resolvePromise)).catch(() => {});
  }
  if (mockSearchRuntime?.server) {
    await new Promise((resolvePromise) => mockSearchRuntime.server.close(resolvePromise)).catch(() => {});
  }
  backendChild.kill('SIGTERM');
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, 3000);
    backendChild.once('exit', () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
  await rm(tempRoot, { recursive: true, force: true });
}
