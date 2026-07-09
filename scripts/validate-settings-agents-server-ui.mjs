import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(repoRoot, 'dist');
const tempRoot = resolve(repoRoot, '.tmp', `settings-agents-server-ui-validate-${process.pid}`);
const serverScript = resolve(repoRoot, 'scripts', 'agent-project-server.mjs');
const secretVaultRecordsFile = resolve(tempRoot, 'secret-vault-records.json');
const uiWorkspaceRoot = resolve(tempRoot, 'ui-bound-workspace');
const backendStorageKey = 'hall_of_fame_studio.agent_backend_url.v1';
const languageStorageKey = 'hall_of_fame_studio.language.v1';
const projectId = 'p_roundtable_001';
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

async function waitForProjectSettings(backendUrl, predicate, description, { timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastResponse = null;
  while (Date.now() < deadline) {
    lastResponse = await fetchJson(`${backendUrl}/projects/${projectId}/project-settings`);
    if (lastResponse.status === 200 && predicate(lastResponse.body.projectSettings || {})) {
      return lastResponse.body.projectSettings;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }
  throw new Error(`${description}. Last project-settings response: ${JSON.stringify(lastResponse?.body || {}).slice(0, 1200)}`);
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
        title: 'Settings backend workflow smoke product brief',
        summary: 'A controlled product-team brief proving the Settings model provider path without external network use.',
        body: [
          '# Settings backend workflow smoke product brief',
          '',
          'The backend can accept sealed provider credentials, run a compact product-team workflow, submit a product-brief artifact, and expose the result through Flow Graph and Proof Map evidence.',
        ].join('\n'),
        tags: ['settings', 'product-team', 'workflow-smoke'],
      })
      : 'Local mock model confirmed the Settings backend provider path without external network use.';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      id: 'chatcmpl-settings-agents-server-ui',
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

async function assertPanelTextIncludes(page, testId, expectedTexts, message) {
  const panel = page.getByTestId(testId);
  await panel.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(({ selector, expected }) => {
    const text = document.querySelector(selector)?.innerText?.toLowerCase() || '';
    return expected.every((expectedText) => text.includes(String(expectedText).toLowerCase()));
  }, {
    selector: `[data-testid="${testId}"]`,
    expected: expectedTexts,
  }, { timeout: 15000 }).catch(() => {});
  const text = await panel.innerText();
  const missing = expectedTexts.filter((expectedText) => !text.toLowerCase().includes(String(expectedText).toLowerCase()));
  assert(!missing.length, `${message} Missing: ${missing.join(', ')}. Panel excerpt: ${text.slice(0, 800)}`);
  return text;
}

async function waitForVaultRecord(backendUrl, recordName, { timeoutMs = 10000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastRecords = [];
  while (Date.now() < deadline) {
    const recordsResponse = await fetchJson(`${backendUrl}/secret-vault/records`);
    lastRecords = recordsResponse.body.secretVaultRecords?.records || [];
    if (recordsResponse.status === 200 && lastRecords.some((record) => record.name === recordName && record.encrypted === true)) {
      return recordsResponse.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for encrypted vault record "${recordName}". Records: ${JSON.stringify(lastRecords.slice(-5))}`);
}

async function clickSealButtonAndWaitForRecord(page, button, backendUrl, recordName, description) {
  const sealRequestPromise = page.waitForRequest((request) => (
    request.method() === 'POST'
      && new URL(request.url()).pathname === '/secret-vault/seal'
      && String(request.postData() || '').includes(`"name":"${recordName}"`)
  ), { timeout: 30000 }).catch(() => null);
  await button.click();
  const sealRequest = await sealRequestPromise;
  assert(sealRequest, `${description} did not send a matching /secret-vault/seal request for ${recordName}. Vault seal requests: ${JSON.stringify(vaultSealRequestLog.slice(-8))}`);
  await waitForVaultRecord(backendUrl, recordName, { timeoutMs: 45000 }).catch((error) => {
    throw new Error(`${error.message}. Vault seal requests: ${JSON.stringify(vaultSealRequestLog.slice(-8))}`);
  });
  const sealResponse = await Promise.race([
    sealRequest.response().catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 1000)),
  ]);
  if (sealResponse) {
    assert(sealResponse.status() === 200, `${description} seal route returned ${sealResponse.status()} for ${recordName}.`);
  }
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

async function waitForSettingsProviderIdle(page) {
  const syncStatusButton = page.getByTestId('settings-provider-sync-status');
  await syncStatusButton.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="settings-provider-sync-status"]');
    return Boolean(button && !button.disabled);
  }, null, { timeout: 15000 });
}

async function fillControlledInput(page, testId, value) {
  let actual = '';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const input = page.getByTestId(testId);
    try {
      await input.waitFor({ state: 'visible', timeout: 10000 });
      await input.scrollIntoViewIfNeeded({ timeout: 10000 });
      await input.fill(value);
      await page.waitForTimeout(200 * attempt);
      actual = await input.inputValue().catch(() => '<unreadable>');
      if (actual === value) return;
    } catch (error) {
      actual = `<${error.message || String(error)}>`;
      await page.waitForTimeout(250 * attempt);
    }
  }
  throw new Error(`Controlled input ${testId} did not retain filled value. Expected ${value}, actual ${actual}.`);
}

async function selectProjectSettingOption(page, testId, value, expectedRequestText) {
  const beforeCount = projectSettingsRequestLog.length;
  const select = page.getByTestId(testId);
  const expectedRequestObserved = () => projectSettingsRequestLog
    .slice(beforeCount)
    .some((entry) => !expectedRequestText || entry.body.includes(expectedRequestText));
  await select.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction((selector) => {
    const element = document.querySelector(selector);
    return Boolean(element && !element.disabled);
  }, `[data-testid="${testId}"]`, { timeout: 15000 });
  await select.selectOption(value);
  await page.waitForFunction(({ selector, expected }) => (
    document.querySelector(selector)?.value === expected
  ), { selector: `[data-testid="${testId}"]`, expected: value }, { timeout: 5000 }).catch(() => {});
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1200));
  if (!expectedRequestObserved()) {
    await page.waitForFunction((selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && !element.disabled);
    }, `[data-testid="${testId}"]`, { timeout: 15000 });
    await select.evaluate((element, nextValue) => {
      element.value = nextValue;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
  const deadline = Date.now() + 10_000;
  while (!expectedRequestObserved() && Date.now() < deadline) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  if (!expectedRequestObserved()) {
    const diagnostic = await select.evaluate((element) => ({
      value: element.value,
      disabled: element.disabled,
      options: Array.from(element.options || []).map((option) => option.value),
    })).catch((error) => ({ error: error.message || String(error) }));
    throw new Error(`Project setting ${testId} did not send expected backend request ${expectedRequestText || '<any>'}. State: ${JSON.stringify(diagnostic)}. Requests: ${JSON.stringify(projectSettingsRequestLog.slice(beforeCount))}`);
  }
}

async function clickProjectSettingCheckbox(page, testId, expectedChecked, expectedRequestText) {
  const beforeCount = projectSettingsRequestLog.length;
  const expectedRequestObserved = () => projectSettingsRequestLog
    .slice(beforeCount)
    .some((entry) => !expectedRequestText || entry.body.includes(expectedRequestText));
  const root = page.getByTestId(testId);
  const nestedCheckbox = root.locator('input[type="checkbox"]').first();
  const checkbox = await nestedCheckbox.count().catch(() => 0) ? nestedCheckbox : root;
  await checkbox.waitFor({ state: 'visible', timeout: 10000 });
  const enableDeadline = Date.now() + 15000;
  while (await checkbox.isDisabled().catch(() => false)) {
    if (Date.now() > enableDeadline) throw new Error(`Checkbox ${testId} stayed disabled.`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  if (await checkbox.isChecked() !== expectedChecked) {
    await checkbox.click();
  }
  const checkedDeadline = Date.now() + 5000;
  while ((await checkbox.isChecked()) !== expectedChecked && !expectedRequestObserved()) {
    if (Date.now() > checkedDeadline) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1200));
  if (!expectedRequestObserved()) {
    while (await checkbox.isDisabled().catch(() => false)) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
    }
    await checkbox.evaluate((element, nextChecked) => {
      element.checked = !nextChecked;
      element.click();
    }, expectedChecked);
  }
  const deadline = Date.now() + 10_000;
  while (!expectedRequestObserved() && Date.now() < deadline) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  if (!expectedRequestObserved()) {
    const diagnostic = await checkbox.evaluate((element) => ({
      checked: element.checked,
      disabled: element.disabled,
    })).catch((error) => ({ error: error.message || String(error) }));
    throw new Error(`Checkbox ${testId} did not send expected backend request ${expectedRequestText || '<any>'}. State: ${JSON.stringify(diagnostic)}. Requests: ${JSON.stringify(projectSettingsRequestLog.slice(beforeCount))}`);
  }
}

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

const mockModelRuntime = await listen(createMockModelServer());
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
    MODEL_PROVIDER: 'openai-compatible',
    MODEL_BASE_URL: `${mockModelRuntime.url}/v1`,
    MODEL_NAME: 'gpt-4o-mini',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser = null;
let staticRuntime = null;
let mockSearchRuntime = null;
const searchRequests = [];
const consoleDiagnostics = [];
const projectSettingsRequestLog = [];
const vaultSealRequestLog = [];
const settingsWorkflowSmokeLog = [];
const settingsHealthRequestLog = [];

try {
  const backendUrl = await waitForServerUrl(backendChild);
  const vaultStatus = await fetchJson(`${backendUrl}/secret-vault/status`);
  assert(vaultStatus.body.secretVaultStatus?.ready === true, 'agents:server Secret Vault must be ready before Settings UI validation.');
  const seedProjectResponse = await fetchJson(`${backendUrl}/projects/initiate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      includeReadModels: false,
      projectId,
      name: 'Roundtable Initiation System',
      brief: 'Validate Settings backend-backed runtime, integration, and workspace contracts for a generic product-team project.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
        { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
        { id: 'turing', name: 'Alan Turing', title: 'Systems Architect' },
      ],
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      tasks: [
        { id: 'settings_task_brief', text: 'Validate backend-backed Settings readiness for local MVP launch.', assignee: 'Alan Turing', status: 'pending' },
      ],
      now: '2026-06-01T10:00:00.000Z',
    }),
  });
  assert(seedProjectResponse.status === 200 && seedProjectResponse.body.project?.id === projectId, 'Settings UI validation must seed the active project through the real backend before project-scoped Settings checks.');

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
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if ([
      '/workers/autonomous/status',
      '/llm/status',
      '/llm/test',
      '/search/status',
      '/search/test',
      '/settings/workflow-smoke',
    ].includes(path)) {
      settingsHealthRequestLog.push({
        type: 'request',
        method: request.method(),
        path,
        url: request.url(),
      });
    }
    if (request.method() === 'PUT' && /\/projects\/[^/]+\/project-settings$/.test(path)) {
      projectSettingsRequestLog.push({
        method: request.method(),
        url: request.url(),
        body: request.postData() || '',
      });
    }
    if (request.method() === 'POST' && path === '/secret-vault/seal') {
      vaultSealRequestLog.push({
        method: request.method(),
        url: request.url(),
        body: request.postData() || '',
      });
    }
    if (request.method() === 'POST' && path === '/settings/workflow-smoke') {
      settingsWorkflowSmokeLog.push({
        type: 'request',
        method: request.method(),
        url: request.url(),
        body: request.postData() || '',
      });
    }
  });
  page.on('response', async (response) => {
    const path = new URL(response.url()).pathname;
    if ([
      '/workers/autonomous/status',
      '/llm/status',
      '/llm/test',
      '/search/status',
      '/search/test',
      '/settings/workflow-smoke',
    ].includes(path)) {
      settingsHealthRequestLog.push({
        type: 'response',
        status: response.status(),
        path,
      });
    }
    if (path !== '/settings/workflow-smoke') return;
    const body = await response.json().catch(() => ({}));
    settingsWorkflowSmokeLog.push({
      type: 'response',
      status: response.status(),
      body,
    });
  });
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (/\/projects\/[^/]+\/project-settings$/.test(path)) {
      const latest = [...projectSettingsRequestLog].reverse().find((entry) => entry.url === response.url() && entry.status === undefined);
      if (latest) latest.status = response.status();
    }
    if (path === '/secret-vault/seal') {
      const latest = [...vaultSealRequestLog].reverse().find((entry) => entry.url === response.url() && entry.status === undefined);
      if (latest) latest.status = response.status();
    }
  });

  await page.goto(staticRuntime.url, { waitUntil: 'networkidle' });
  await page.getByTestId('backend-sync-project-catalog').click();
  await page.getByTestId(`project-nav-${projectId}`).waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId(`project-nav-${projectId}`).click();
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('open-settings-button').click();
  await page.getByTestId('settings-tab-keys').click();
  await page.getByTestId('settings-provider-boundary').waitFor({ state: 'visible', timeout: 10000 });
  await assertPageContains(page, 'Backend-owned provider credentials', 'Settings Keys must render the backend provider boundary.');
  await page.getByTestId('settings-provider-api-entry-state').waitFor({ state: 'visible', timeout: 10000 });
  await assertPanelTextIncludes(page, 'settings-provider-api-entry-state', [
    'API input fields',
    'Browser persistence: disabled',
    'Plaintext after Seal: cleared after backend receipt',
  ], 'Settings Keys must show that provider secrets are backend-vault-only.');
  await page.getByTestId('settings-provider-open-backend-target').click();
  await page.getByTestId('settings-deployment-backend-url-input').waitFor({ state: 'visible', timeout: 10000 });
  const shortcutBackendUrl = await page.getByTestId('settings-deployment-backend-url-input').inputValue();
  assert(
    normalizeBaseUrl(shortcutBackendUrl) === backendUrl,
    `Settings Keys backend URL shortcut must open the active agents:server target. Expected ${backendUrl}, got ${shortcutBackendUrl}.`,
  );
  await page.getByTestId('settings-tab-keys').click();
  await page.getByTestId('settings-provider-boundary').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('settings-secret-vault-local-startup-contract').waitFor({ state: 'visible', timeout: 10000 });
  const startupContractText = await page.getByTestId('settings-secret-vault-local-startup-contract').innerText();
  assert(
    startupContractText.includes('Local vault')
      && startupContractText.includes('.tmp/agent-local-user-runtime.json')
      && startupContractText.includes('API fields after refresh')
      && startupContractText.includes('/local-mvp-startup-readiness')
      && startupContractText.includes('/settings/provider-readiness')
      && startupContractText.includes('/secret-vault/status')
      && startupContractText.includes('/secret-vault/seal')
      && startupContractText.includes('Startup readiness'),
    'Settings Keys must show the local agents:server Secret Vault startup contract before API keys are sealed.',
  );
  await page.getByTestId('settings-provider-sync-status').click();
  await waitForSettingsProviderIdle(page);
  await assertPanelTextIncludes(page, 'settings-provider-api-entry-state', [
    'Seal persistence: available through /secret-vault/seal',
  ], 'Settings Keys must show Seal availability only after backend Secret Vault readiness is synced.');
  await assertPanelTextIncludes(page, 'settings-provider-readiness-contract', [
    'backend-backed',
    'Backend settings-provider-readiness/v1 route synced',
  ], 'Settings Keys must expose provider readiness as a backend-backed contract after syncing provider status.');
  await assertPageContains(page, '/secret-vault/seal', 'Settings Keys must expose the backend secret-vault seal route.');
  await page.waitForFunction(() => {
    const footer = document.querySelector('[data-testid="settings-footer-backend-save-status"]')?.textContent || '';
    const entry = document.querySelector('[data-testid="settings-provider-api-entry-state"]')?.textContent || '';
    return /run health check before first project/i.test(footer) && /seal persistence:\s*available through \/secret-vault\/seal/i.test(entry);
  }, null, { timeout: 15000 }).catch(async () => {
    const footerStatus = await page.getByTestId('settings-footer-backend-save-status').innerText().catch(() => '<missing footer>');
    const entryStatus = await page.getByTestId('settings-provider-api-entry-state').innerText().catch(() => '<missing api entry>');
    const vaultStatusText = await page.getByTestId('settings-secret-vault-status').innerText().catch(() => '<missing vault status>');
    throw new Error(`Settings footer must require Health before claiming backend-backed saves. Footer: ${footerStatus}. API entry: ${entryStatus}. Vault: ${vaultStatusText}.`);
  });
  const footerConnectionButton = await waitForButtonEnabled(
    page,
    'settings-footer-test-connection',
    'Settings footer Test Connection must be available as a visible backend health entry point.',
  );
  await footerConnectionButton.click();
  await page.getByTestId('settings-health-quick-check').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('settings-health-workflow-smoke').waitFor({ state: 'visible', timeout: 10000 });
  try {
    await page.waitForFunction(() => document.body.innerText.includes('/settings/health-readiness'), null, { timeout: 20000 });
  } catch (error) {
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    console.error(`Settings Health panel after Quick check:\n${bodyText.slice(0, 1200)}`);
    throw error;
  }
  await assertPageContains(page, 'Settings Health', 'Settings Health tab must render backend-owned health readiness rows.');
  await assertPageContains(page, '/local-mvp-startup-readiness', 'Settings Health quick check must include local MVP startup readiness from the backend contract.');
  await assertPageContains(page, '/projects', 'Settings Health quick check must include backend project catalog readiness.');
  await page.waitForFunction(() => {
    const footer = document.querySelector('[data-testid="settings-footer-backend-save-status"]')?.textContent || '';
    return /health check failed or blocked/i.test(footer) && /backend setup required before first project/i.test(footer);
  }, null, { timeout: 15000 }).catch(async () => {
    const footerStatus = await page.getByTestId('settings-footer-backend-save-status').innerText().catch(() => '<missing footer>');
    const healthStatusText = await page.getByTestId('settings-health-route-contract').innerText().catch(() => '<missing health status>');
    throw new Error(`Settings footer must stay blocked after Health runs before provider secrets are sealed. Footer: ${footerStatus}. Health: ${healthStatusText}.`);
  });
  assert(
    await page.getByTestId('settings-health-workflow-smoke').isVisible(),
    'Settings Health Workflow Smoke control must be visible before provider secrets are sealed; full smoke runs after provider secrets are sealed.',
  );

  await page.getByTestId('settings-tab-deployment').click();
  await page.getByTestId('settings-deployment-backend-url-input').waitFor({ state: 'visible', timeout: 10000 });
  const deploymentBackendUrl = await page.getByTestId('settings-deployment-backend-url-input').inputValue();
  assert(
    normalizeBaseUrl(deploymentBackendUrl) === backendUrl,
    `Settings Deployment backend URL input must show the active agents:server target. Expected ${backendUrl}, got ${deploymentBackendUrl}.`,
  );
  await page.getByTestId('settings-deployment-save-backend-url').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('settings-runtime-readiness-contract').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: /Sync runtime/i }).click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="settings-runtime-readiness-contract"]')?.textContent || '';
    return /settings-runtime-readiness\/v1|runtime readiness/i.test(text) && !/not synced/i.test(text);
  }, null, { timeout: 15000 });
  await assertPanelTextIncludes(page, 'settings-deployment-runtime-boundary', [
    '/workers/autonomous/status',
  ], 'Settings Deployment must expose the backend worker status route.');
  await assertPanelTextIncludes(page, 'settings-runtime-readiness-contract', [
    'Backend-owned runtime readiness',
    'backend-backed',
    'Backend settings-runtime-readiness/v1 route synced',
    '/settings/runtime-readiness',
    'npm run agents:settings-runtime-readiness',
  ], 'Settings Deployment must render backend runtime readiness instead of browser-inferred deployment state.');

  await page.getByTestId('settings-tab-models').click();
  await page.getByTestId('settings-model-runtime-readiness-contract').waitFor({ state: 'visible', timeout: 10000 });
  await assertPanelTextIncludes(page, 'settings-model-runtime-readiness-contract', [
    'Model policy readiness comes from the backend',
    'backend-backed',
    'Backend settings-runtime-readiness/v1 route synced',
    '/settings/runtime-readiness',
    'Model runtime',
    'Search runtime',
  ], 'Settings Models must render backend model/runtime readiness instead of a browser-only model picker.');

  await page.getByTestId('settings-tab-integrations').click();
  await page.getByTestId('settings-integration-readiness-summary').waitFor({ state: 'visible', timeout: 10000 });
  const integrationSyncButton = page.getByRole('button', { name: /Sync integration readiness/i });
  await integrationSyncButton.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find((element) => /Sync integration readiness/i.test(element.textContent || ''));
    return Boolean(button && !button.disabled);
  }, null, { timeout: 10000 });
  await integrationSyncButton.click();
  try {
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-testid="settings-integration-readiness-summary"]')?.textContent || '';
      return /routes ready/i.test(text) && !/not synced/i.test(text);
    }, null, { timeout: 15000 });
  } catch (error) {
    const summaryText = await page.getByTestId('settings-integration-readiness-summary').innerText().catch(() => '');
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    console.error(`Settings integration readiness summary: ${summaryText}\n${bodyText.slice(0, 1200)}`);
    throw error;
  }
  await page.getByTestId('settings-integration-readiness-contract').waitFor({ state: 'visible', timeout: 10000 });
  await assertPanelTextIncludes(page, 'settings-integrations-runtime-boundary', [
    'backend-backed',
    'Backend settings-integration-readiness/v1 route synced',
    `/projects/${projectId}/settings-integration-readiness`,
  ], 'Settings Integrations must expose the project-scoped backend readiness proof route.');
  await assertPanelTextIncludes(page, 'settings-integration-readiness-contract', [
    `/projects/${projectId}/evidence-index-readiness`,
    `/projects/${projectId}/adapter-gateway-preflight`,
    `/projects/${projectId}/provider-readiness`,
    `/projects/${projectId}/budget-alert-readiness`,
    `/projects/${projectId}/error-reporting-readiness`,
    'Production blocker',
  ], 'Settings Integrations must render project-scoped backend readiness rows instead of fake editable integration controls.');
  await assertPanelTextIncludes(page, 'settings-integrations-route-contract', [
    `/projects/${projectId}/provider-readiness`,
    '/search/status',
    '/secret-vault/status',
    'Production integrations stay blocked',
  ], 'Settings Integrations route contract must keep provider/tool integration state backend-governed.');

  await page.getByTestId('settings-tab-workspace').click();
  const memorySyncButton = await waitForButtonEnabled(
    page,
    'settings-workspace-sync-memory-readiness',
    'Workspace memory readiness sync must be available for the backend-seeded project.',
  );
  await memorySyncButton.click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="settings-workspace-memory-readiness-status"]')?.textContent || '';
    return !/not synced/i.test(text);
  }, null, { timeout: 10000 });
  const summariesSyncButton = await waitForButtonEnabled(
    page,
    'settings-workspace-sync-meeting-summaries',
    'Workspace meeting summaries sync must be available for the backend-seeded project.',
  );
  await summariesSyncButton.click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="settings-workspace-meeting-summary-status"]')?.textContent || '';
    return !/not synced/i.test(text);
  }, null, { timeout: 10000 });
  await assertPanelTextIncludes(page, 'settings-workspace-memory-readiness', [
    'Backend project memory readiness',
    'backend-backed',
    'Backend project-memory-readiness/v1 route synced',
    `/projects/${projectId}/memory-readiness`,
    'Production',
    'blocked',
  ], 'Settings Workspace must render backend memory readiness instead of a fake long-term memory toggle.');
  await assertPanelTextIncludes(page, 'settings-workspace-meeting-summaries', [
    'Backend meeting summaries',
    'backend-backed',
    'Backend meeting-summaries/v1 route synced',
    `/projects/${projectId}/meeting-summaries`,
    'Rows:',
    'Proof ids:',
  ], 'Settings Workspace must render backend meeting summaries instead of browser-local notes.');
  await assertPanelTextIncludes(page, 'settings-workspace-route-contract', [
    'Global language: browser-local UI preference only',
    `/projects/${projectId}/project-settings`,
    `/projects/${projectId}`,
    'project-workspace-capabilities/v1',
  ], 'Settings Workspace must distinguish browser-local preferences from backend project settings.');
  await assertPanelTextIncludes(page, 'settings-workspace-bind-contract', [
    'Backend local workspace binding',
    `/projects/${projectId}/workspace/bind`,
    `/projects/${projectId}/local-runtime`,
    'not bound',
  ], 'Settings Workspace must render a backend local workspace binding contract.');
  await page.getByTestId('settings-workspace-bind-path-input').fill(uiWorkspaceRoot);
  await page.getByTestId('settings-workspace-bind-create-if-missing').check();
  const workspaceBindButton = await waitForButtonEnabled(
    page,
    'settings-workspace-bind-submit',
    'Workspace bind action must be available for the backend-seeded project.',
  );
  await workspaceBindButton.click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="settings-workspace-bind-receipt"]')?.textContent || '';
    return /workspace-bound|backend-bound/i.test(text);
  }, null, { timeout: 10000 });
  const localRuntimeResponse = await fetchJson(`${backendUrl}/projects/${projectId}/local-runtime`);
  assert(localRuntimeResponse.status === 200, `Settings Workspace local runtime route returned ${localRuntimeResponse.status}.`);
  assert(localRuntimeResponse.body.localRuntime?.workspacePath === uiWorkspaceRoot, 'Settings Workspace bind action must persist the selected workspace path through the backend local runtime.');

  await selectProjectSettingOption(page, 'settings-workspace-interface-density', 'compact', '"interfaceDensity":"compact"');
  await waitForProjectSettings(
    backendUrl,
    (settings) => settings.workspacePolicy?.interfaceDensity === 'compact',
    'Settings Workspace interface density must persist through backend project-settings',
  );
  await selectProjectSettingOption(page, 'settings-workspace-default-visibility', 'manager-only', '"defaultVisibility":"manager-only"');
  await waitForProjectSettings(
    backendUrl,
    (settings) => settings.workspacePolicy?.defaultVisibility === 'manager-only',
    'Settings Workspace default visibility must persist through backend project-settings',
  ).catch((error) => {
    throw new Error(`${error.message}. Browser project-settings requests: ${JSON.stringify(projectSettingsRequestLog.slice(-8))}`);
  });
  await selectProjectSettingOption(page, 'settings-workspace-autosave-cadence', '120', '"autosaveCadenceSeconds":120');
  const workspaceSettings = await waitForProjectSettings(
    backendUrl,
    (settings) => (
      settings.workspacePolicy?.interfaceDensity === 'compact'
      && settings.workspacePolicy?.defaultVisibility === 'manager-only'
      && settings.workspacePolicy?.autosaveCadenceSeconds === 120
    ),
    'Settings Workspace controls must persist through backend project-settings',
  ).catch((error) => {
    throw new Error(`${error.message}. Browser project-settings requests: ${JSON.stringify(projectSettingsRequestLog.slice(-10))}`);
  });
  assert(workspaceSettings.workspaceCapabilities?.schemaVersion === 'project-workspace-capabilities/v1', 'Backend project settings must return workspace capability proof after Workspace edits.');

  await page.getByTestId('settings-tab-privacy').click();
  await selectProjectSettingOption(page, 'settings-privacy-retention-mode', 'session-only', '"retentionMode":"session-only"');
  await waitForProjectSettings(
    backendUrl,
    (settings) => settings.privacyPolicy?.retentionMode === 'session-only',
    'Settings Privacy retention mode must persist through backend project-settings',
  );
  await selectProjectSettingOption(page, 'settings-privacy-provider-log-mode', 'metadata-only', '"providerLogMode":"metadata-only"');
  await waitForProjectSettings(
    backendUrl,
    (settings) => settings.privacyPolicy?.providerLogMode === 'metadata-only',
    'Settings Privacy provider log mode must persist through backend project-settings',
  );
  await clickProjectSettingCheckbox(page, 'settings-privacy-export-approval', false, '"evidenceExportRequiresApproval":false');
  const privacySettings = await waitForProjectSettings(
    backendUrl,
    (settings) => (
      settings.privacyPolicy?.retentionMode === 'session-only'
      && settings.privacyPolicy?.providerLogMode === 'metadata-only'
      && settings.privacyPolicy?.evidenceExportRequiresApproval === false
    ),
    'Settings Privacy controls must persist through backend project-settings',
  ).catch((error) => {
    throw new Error(`${error.message}. Browser project-settings requests: ${JSON.stringify(projectSettingsRequestLog.slice(-12))}`);
  });
  assert(privacySettings.privacyPolicy?.readyForProduction === false, 'Settings Privacy backend receipt must not overclaim production privacy compliance.');
  const privacyRevisionText = await page.getByTestId('settings-privacy-policy-revision').innerText();
  assert(/Revision:\s*[1-9]/.test(privacyRevisionText), `Settings Privacy UI must show a backend settings revision after edits. Actual: ${privacyRevisionText}`);

  await page.getByTestId('settings-tab-integrations').click();
  await selectProjectSettingOption(page, 'settings-provider-budget-daily', '500', '"dailyBudgetCents":500');
  await waitForProjectSettings(
    backendUrl,
    (settings) => settings.providerBudgetPolicy?.dailyBudgetCents === 500,
    'Settings provider daily budget must persist through backend project-settings',
  );
  await selectProjectSettingOption(page, 'settings-provider-budget-hourly', '20', '"maxRequestsPerProjectHour":20');
  await waitForProjectSettings(
    backendUrl,
    (settings) => settings.providerBudgetPolicy?.maxRequestsPerProjectHour === 20,
    'Settings provider hourly request limit must persist through backend project-settings',
  );
  await clickProjectSettingCheckbox(page, 'settings-tool-grant-provider-test', false, '"defaultToolGrants":["model:kickoff","model:intent","model:artifact-draft","search:evidence"]');
  const integrationSettings = await waitForProjectSettings(
    backendUrl,
    (settings) => (
      settings.providerBudgetPolicy?.dailyBudgetCents === 500
      && settings.providerBudgetPolicy?.maxRequestsPerProjectHour === 20
      && Array.isArray(settings.toolGrantPolicy?.defaultToolGrants)
      && !settings.toolGrantPolicy.defaultToolGrants.includes('provider:test')
    ),
    'Settings Integration budget and Agent tool grants must persist through backend project-settings',
  );
  assert(integrationSettings.integrationCapabilities?.schemaVersion === 'project-integration-capabilities/v1', 'Backend project settings must return integration capability proof after Integration edits.');
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="settings-tool-grant-policy"]')?.textContent || '';
    return text.includes('Default grants: 4/5');
  }, null, { timeout: 10000 }).catch(async () => {
    const panelText = await page.getByTestId('settings-tool-grant-policy').innerText().catch(() => '<missing panel>');
    const providerTestChecked = await page.getByTestId('settings-tool-grant-provider-test').locator('input[type="checkbox"]').first().isChecked().catch(() => null);
    throw new Error(`Settings Tool Grant panel did not render backend-saved 4/5 default grants. Provider test checked: ${providerTestChecked}. Panel excerpt: ${panelText.slice(0, 1200)}`);
  });
  await assertPanelTextIncludes(page, 'settings-provider-budget-policy', [
    '500 cents/day',
    '20',
    `/projects/${projectId}/project-settings`,
  ], 'Settings Integrations must render the backend-backed provider budget policy after save.');
  await assertPanelTextIncludes(page, 'settings-tool-grant-policy', [
    'Default grants: 4/5',
    `/projects/${projectId}/project-settings`,
  ], 'Settings Integrations must render backend-backed Agent tool grants after save.');

  const controlledRunResponse = await fetchJson(`${backendUrl}/projects/${projectId}/provider-controlled-run`);
  assert(controlledRunResponse.status === 200 && controlledRunResponse.body.providerControlledRun?.budget?.dailyBudgetCents === 500, 'Provider controlled run must consume the Settings provider budget saved through the UI.');
  assert(controlledRunResponse.body.providerControlledRun?.budget?.remainingHourlyRequests === 20, 'Provider controlled run must consume the Settings hourly request limit saved through the UI.');
  const timelineResponse = await fetchJson(`${backendUrl}/projects/${projectId}/timeline`);
  assert(timelineResponse.status === 200 && timelineResponse.body.logs?.some((row) => row.eventType === 'project-settings-updated' && row.providerBudgetPolicy?.dailyBudgetCents === 500), 'Settings UI project-settings writes must create timeline proof.');
  const eventsResponse = await fetchJson(`${backendUrl}/projects/${projectId}/events`);
  assert(eventsResponse.status === 200 && eventsResponse.body.eventLedger?.some((event) => event.type === 'project-settings-updated' && event.payload?.privacyPolicy?.providerLogMode === 'metadata-only'), 'Settings UI project-settings writes must create event-ledger proof.');

  await page.getByTestId('settings-tab-keys').click();

  await fillControlledInput(page, 'settings-provider-model-base-url-input', `${mockModelRuntime.url}/v1`);
  await fillControlledInput(page, 'settings-provider-model-name-input', 'gpt-4o-mini');
  await fillControlledInput(page, 'settings-provider-model-key-input', modelPlaintext);
  const sealModelButton = await waitForButtonEnabled(
    page,
    'settings-provider-seal-model-key',
    'Model configuration seal button must be enabled when agents:server Secret Vault is ready and model key, Base URL, and Model ID are filled.',
  );
  await clickSealButtonAndWaitForRecord(page, sealModelButton, backendUrl, 'model.apiKey', 'Model key seal button');
  await waitForVaultRecord(backendUrl, 'model.baseURL');
  await waitForVaultRecord(backendUrl, 'model.name');
  await page.getByTestId('settings-provider-seal-receipt').waitFor({ state: 'visible', timeout: 10000 });
  await waitForSettingsProviderIdle(page);

  await fillControlledInput(page, 'settings-provider-search-key-input', searchPlaintext);
  await fillControlledInput(page, 'settings-provider-search-endpoint-input', `${mockSearchRuntime.url}/search`);
  const sealSearchButton = await waitForButtonEnabled(
    page,
    'settings-provider-seal-search-key',
    'Search configuration seal button must be enabled when agents:server Secret Vault is ready and search key and endpoint are filled.',
  );
  await clickSealButtonAndWaitForRecord(page, sealSearchButton, backendUrl, 'search.apiKey', 'Search key seal button');
  await waitForVaultRecord(backendUrl, 'search.endpoint');

  const recordsResponse = await fetchJson(`${backendUrl}/secret-vault/records`);
  const serializedRecords = JSON.stringify(recordsResponse.body);
  assert(recordsResponse.status === 200, `Secret Vault records route returned ${recordsResponse.status}.`);
  assert(recordsResponse.body.secretVaultRecords?.records?.some((record) => record.name === 'model.apiKey' && record.encrypted === true), 'Settings UI must seal model.apiKey into the real agents:server vault.');
  assert(recordsResponse.body.secretVaultRecords?.records?.some((record) => record.name === 'model.baseURL' && record.encrypted === true), 'Settings UI must seal model.baseURL into the real agents:server vault.');
  assert(recordsResponse.body.secretVaultRecords?.records?.some((record) => record.name === 'model.name' && record.encrypted === true), 'Settings UI must seal model.name into the real agents:server vault.');
  assert(recordsResponse.body.secretVaultRecords?.records?.some((record) => record.name === 'search.endpoint' && record.encrypted === true), 'Settings UI must seal search.endpoint into the real agents:server vault.');
  assert(recordsResponse.body.secretVaultRecords?.records?.some((record) => record.name === 'search.apiKey' && record.encrypted === true), 'Settings UI must seal search.apiKey into the real agents:server vault.');
  assert(!serializedRecords.includes(modelPlaintext) && !serializedRecords.includes(searchPlaintext), 'Real agents:server vault records must not expose plaintext Settings keys.');
  assert(!serializedRecords.includes(mockModelRuntime.url), 'Real agents:server vault records must not expose the plaintext model Base URL.');
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
  await page.getByTestId('settings-provider-sync-status').click();
  await waitForSettingsProviderIdle(page);
  await assertPanelTextIncludes(page, 'settings-provider-model-status', [
    'Backend ready',
    'Runtime enabled: yes',
    'Secret source: local-secret-vault',
  ], 'Settings must show the model provider ready after the model key is sealed through the backend vault.');
  await assertPanelTextIncludes(page, 'settings-provider-search-status', [
    'Backend ready',
    'Runtime enabled: yes',
    'Secret source: local-secret-vault',
    'Endpoint source: local-secret-vault',
  ], 'Settings must show the search provider ready after endpoint and key are sealed through the backend vault.');

  const settingsText = await page.getByTestId('settings-provider-boundary').innerText();
  assert(!settingsText.includes(modelPlaintext) && !settingsText.includes(searchPlaintext), 'Settings UI must clear plaintext keys after backend seal receipts.');

  await page.getByTestId('settings-tab-health').click();
  await page.getByTestId('settings-health-workflow-smoke').waitFor({ state: 'visible', timeout: 10000 });
  const workflowSmokeButton = await waitForButtonEnabled(
    page,
    'settings-health-workflow-smoke',
    'Settings Health Workflow Smoke must be available after provider secrets are sealed.',
    { timeoutMs: 20000 },
  );
  const searchRequestsBeforeWorkflowSmoke = searchRequests.length;
  await workflowSmokeButton.scrollIntoViewIfNeeded();
  const workflowSmokeHitTarget = await workflowSmokeButton.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      buttonText: element.textContent,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      hitTag: hit?.tagName || null,
      hitTestId: hit?.getAttribute('data-testid') || null,
      hitAriaLabel: hit?.getAttribute('aria-label') || null,
      hitText: hit?.textContent?.slice(0, 120) || null,
    };
  });
  let workflowSmokeRequestPromise = page.waitForRequest((request) => (
    request.method() === 'POST'
      && new URL(request.url()).pathname === '/settings/workflow-smoke'
  ), { timeout: 15000 }).catch(() => null);
  await workflowSmokeButton.click();
  let workflowSmokeRequest = await workflowSmokeRequestPromise;
  if (!workflowSmokeRequest) {
    await page.waitForFunction((selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && !element.disabled);
    }, '[data-testid="settings-health-workflow-smoke"]', { timeout: 20000 }).catch(() => {});
    const retryButton = page.getByTestId('settings-health-workflow-smoke');
    workflowSmokeRequestPromise = page.waitForRequest((request) => (
      request.method() === 'POST'
        && new URL(request.url()).pathname === '/settings/workflow-smoke'
    ), { timeout: 15000 }).catch(() => null);
    await retryButton.evaluate((element) => {
      if (element.disabled) throw new Error('settings-health-workflow-smoke-disabled');
      element.click();
    });
    workflowSmokeRequest = await workflowSmokeRequestPromise;
  }
  const workflowSmokePostClickState = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="settings-health-workflow-smoke"]');
    const rows = Array.from(document.querySelectorAll('[data-testid="settings-health-route-contract"], [data-testid="settings-health-workflow-smoke"]'));
    return {
      buttonExists: Boolean(button),
      buttonDisabled: button?.disabled ?? null,
      bodyHasRunning: /running/i.test(document.body.innerText || ''),
      healthRelatedText: rows.map((row) => row.textContent || '').join('\n').slice(0, 1600),
    };
  });
  assert(
    workflowSmokeRequest,
    `Settings Workflow Smoke button did not issue POST /settings/workflow-smoke. Hit target: ${JSON.stringify(workflowSmokeHitTarget)}. Post-click: ${JSON.stringify(workflowSmokePostClickState)}.`,
  );
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return /product-brief submission/i.test(text) && /provider usage/i.test(text) && /flow nodes/i.test(text);
    }, null, { timeout: 220000 });
  } catch (error) {
    const healthText = await page.getByTestId('settings-health-route-contract').innerText({ timeout: 1000 }).catch(() => '<missing settings health route contract>');
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    console.error(`Settings Workflow Smoke hit target before click:\n${JSON.stringify(workflowSmokeHitTarget, null, 2)}`);
    console.error(`Settings Workflow Smoke post-click state:\n${JSON.stringify(workflowSmokePostClickState, null, 2)}`);
    console.error(`Settings Health request log:\n${JSON.stringify(settingsHealthRequestLog.slice(-20), null, 2)}`);
    console.error(`Settings Workflow Smoke log:\n${JSON.stringify(settingsWorkflowSmokeLog.slice(-4), null, 2)}`);
    console.error(`Settings Health contract excerpt:\n${healthText.slice(0, 1600)}`);
    console.error(`Settings page excerpt after Workflow Smoke timeout:\n${bodyText.slice(0, 2200)}`);
    throw error;
  }
  await assertPageContains(
    page,
    'product-brief submission',
    'Settings Health Workflow Smoke must prove backend Agent output through a product-brief submission.',
  );
  await assertPageContains(
    page,
    'Provider Usage',
    'Settings Health Workflow Smoke must expose the provider usage proof created by the backend Agent workflow.',
  );
  await page.waitForFunction(() => {
    const footer = document.querySelector('[data-testid="settings-footer-backend-save-status"]')?.textContent || '';
    return /backend-backed controls save on change/i.test(footer);
  }, null, { timeout: 15000 }).catch(async () => {
    const footerStatus = await page.getByTestId('settings-footer-backend-save-status').innerText().catch(() => '<missing footer>');
    const healthStatusText = await page.getByTestId('settings-health-route-contract').innerText().catch(() => '<missing health status>');
    throw new Error(`Settings footer must claim backend-backed saves after sealed provider secrets and Workflow Smoke pass. Footer: ${footerStatus}. Health: ${healthStatusText}.`);
  });
  assert(
    searchRequests.length > searchRequestsBeforeWorkflowSmoke,
    'Settings Health Workflow Smoke must consume the Settings-sealed search endpoint after /search/test has already proven the provider.',
  );
  assert(
    searchRequests.at(-1)?.authorization === `Bearer ${searchPlaintext}`,
    'Settings Health Workflow Smoke must call the configured search endpoint with the Settings-sealed search key.',
  );

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
  if (mockModelRuntime?.server) {
    await new Promise((resolvePromise) => mockModelRuntime.server.close(resolvePromise)).catch(() => {});
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
