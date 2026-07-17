import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(repoRoot, 'dist');
const tempRoot = resolve(repoRoot, '.tmp', `local-auth-ui-validate-${process.pid}`);
const backendStorageKey = 'hall_of_fame_studio.agent_backend_url.v1';
const localAuthStorageKey = 'hall_of_fame_studio.local_auth_session.v1';
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const requestedPath = decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const filePath = normalize(join(distDir, requestedPath));
      if (!filePath.startsWith(distDir)) throw new Error('forbidden');
      const body = await readFile(filePath);
      response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      const body = await readFile(join(distDir, 'index.html'));
      response.writeHead(200, { 'content-type': mimeTypes['.html'] });
      response.end(body);
    }
  });
}

async function listen(server) {
  await new Promise((resolvePromise, reject) => server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolvePromise())));
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function close(runtime) {
  if (!runtime?.server) return;
  await new Promise((resolvePromise) => runtime.server.close(() => resolvePromise()));
}

function playwrightExecutableCandidates() {
  const root = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : '';
  if (!root || !existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^chromium_headless_shell-/.test(entry.name))
    .map((entry) => join(root, entry.name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'))
    .filter((filePath) => existsSync(filePath))
    .sort()
    .reverse();
}

async function launchBrowser() {
  let lastError = null;
  for (const options of [{ headless: true }, ...playwrightExecutableCandidates().map((executablePath) => ({ headless: true, executablePath }))]) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

assert(existsSync(join(distDir, 'index.html')), 'Run vite build before local auth UI validation.');
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

const backendServer = createAgentProjectHttpServer({
  filePath: join(tempRoot, 'projects.json'),
  localAuthFilePath: join(tempRoot, 'auth.json'),
  localAuthRequired: true,
});
let backendRuntime = null;
let staticRuntime = null;
let browser = null;

try {
  backendRuntime = await backendServer.listen({ port: 0, host: '127.0.0.1' });
  staticRuntime = await listen(createStaticServer());
  browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ backendUrl, storageKey }) => {
    window.__AGENT_BACKEND_URL__ = backendUrl;
    window.localStorage.setItem(storageKey, JSON.stringify(backendUrl));
  }, { backendUrl: backendRuntime.url, storageKey: backendStorageKey });
  const page = await context.newPage();
  const authenticatedRequests = [];
  const unauthenticatedRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== backendRuntime.url || url.pathname !== '/settings/runtime-readiness') return;
    const header = request.headers()['x-hofs-local-auth-token'] || '';
    (header ? authenticatedRequests : unauthenticatedRequests).push({ method: request.method(), header });
  });

  await page.goto(staticRuntime.url, { waitUntil: 'networkidle' });
  await page.getByTestId('local-first-run').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByTestId('local-first-run').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('first-run-auth-required-notice').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('open-settings-label').click();
  const openAdvancedSettings = page.getByRole('button', { name: '打开高级设置', exact: true });
  if (await openAdvancedSettings.count()) await openAdvancedSettings.click();
  await page.getByTestId('settings-tab-account').click();
  await page.getByTestId('settings-local-auth').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('settings-local-auth-username').fill('owner');
  await page.getByTestId('settings-local-auth-password').fill('correct horse battery staple1');
  await page.getByTestId('settings-local-auth-bootstrap').click();
  await page.getByTestId('settings-local-auth-signed-in').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByTestId('settings-local-auth-users').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByTestId('settings-local-auth-create-username').fill('manager');
  await page.getByTestId('settings-local-auth-create-password').fill('another correct horse battery staple1');
  await page.getByTestId('settings-local-auth-create-role').selectOption('manager');
  await page.getByTestId('settings-local-auth-create-user').click();
  await page.getByTestId('settings-local-auth-user-manager').waitFor({ state: 'visible', timeout: 15_000 });
  const session = await page.evaluate((storageKey) => JSON.parse(window.sessionStorage.getItem(storageKey) || 'null'), localAuthStorageKey);
  assert(session?.token && session.baseUrl === backendRuntime.url, 'Bootstrap must keep the local token in session storage bound to the active backend URL.');
  assert.equal(await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), localAuthStorageKey), null, 'Local authentication must not persist the token in local storage.');

  const authenticatedRequest = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/settings/runtime-readiness'
      && Boolean(request.headers()['x-hofs-local-auth-token'])
  ), { timeout: 15_000 });
  await page.getByTestId('settings-tab-deployment').click();
  await page.getByTestId('settings-local-auth-sync-runtime').click();
  await authenticatedRequest;
  assert(authenticatedRequests.length > 0, 'Authenticated Settings runtime requests must carry the local auth token.');

  await page.getByTestId('settings-tab-keys').click();
  await page.getByTestId('settings-local-model-simple').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('settings-model-provider-trigger').click();
  await page.getByTestId('settings-model-provider-option-stepfun').click();
  await page.getByTestId('settings-model-name-trigger').click();
  await page.getByTestId('settings-model-name-option-step-3.5-flash').click();
  await page.getByTestId('settings-provider-model-key-input').fill('LOCAL_AUTH_UI_FAKE_MODEL_KEY');
  const modelSaveButton = page.getByTestId('settings-provider-seal-model-key');
  assert.equal(
    await modelSaveButton.isEnabled(),
    true,
    'A complete visible model form must remain actionable when vault readiness needs recovery.',
  );
  await modelSaveButton.click();
  const modelSaveFeedback = page.getByTestId('settings-provider-seal-receipt');
  await modelSaveFeedback.waitFor({ state: 'visible', timeout: 10_000 });
  assert.match(
    await modelSaveFeedback.innerText(),
    /本地密钥存储.*(?:未就绪|尚未准备好)|本地身份.*重新登录/,
    'Unavailable local secret storage must produce an actionable Chinese recovery message.',
  );

  await page.getByTestId('settings-tab-account').click();
  await page.getByTestId('settings-local-auth-logout').click();
  await page.getByTestId('settings-local-auth-form').waitFor({ state: 'visible', timeout: 10_000 });
  assert.equal(await page.evaluate((storageKey) => window.sessionStorage.getItem(storageKey), localAuthStorageKey), null, 'Logout must clear the browser session token.');
  const unauthenticatedRequest = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/settings/runtime-readiness'
      && !request.headers()['x-hofs-local-auth-token']
  ), { timeout: 15_000 });
  await page.getByTestId('settings-tab-deployment').click();
  await page.getByTestId('settings-local-auth-sync-runtime').click();
  await unauthenticatedRequest;
  assert(unauthenticatedRequests.length > 0, 'After logout, Settings runtime requests must not carry the old local auth token.');
  console.log('Local auth UI validation passed.');
} finally {
  await browser?.close();
  await close(staticRuntime);
  await backendServer.close();
  await rm(tempRoot, { recursive: true, force: true });
}
