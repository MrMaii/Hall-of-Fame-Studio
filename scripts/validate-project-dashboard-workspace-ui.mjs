import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = join(ROOT_DIR, 'dist');
const TEMP_ROOT = join(ROOT_DIR, '.tmp', `project-dashboard-workspace-ui-${process.pid}`);
const WORKSPACE_PATH = join(TEMP_ROOT, 'selected-workspace');
const OUTSIDE_PATH = join(TEMP_ROOT, 'outside-sentinel.txt');
const STORE_PATH = join(TEMP_ROOT, 'store.json');
const AUTH_PATH = join(TEMP_ROOT, 'local-auth.json');
const PROJECT_ID = 'project_dashboard_workspace_validation';
const PROJECT_NAME = 'Dashboard Workspace Validation';
const BACKEND_STORAGE_KEY = 'hall_of_fame_studio.agent_backend_url.v1';
const LOCAL_AUTH_STORAGE_KEY = 'hall_of_fame_studio.local_auth_session.v1';
const LANGUAGE_STORAGE_KEY = 'hall_of_fame_studio.language.v1';
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const requestedPath = decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const absolutePath = normalize(join(DIST_DIR, requestedPath));
      if (!absolutePath.startsWith(DIST_DIR)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      const body = await readFile(absolutePath);
      response.writeHead(200, { 'content-type': MIME_TYPES[extname(absolutePath)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      const body = await readFile(join(DIST_DIR, 'index.html'));
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(body);
    }
  });
}

async function listenStatic(server) {
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function fetchJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-hofs-local-auth-token': token } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  assert(response.ok, `${options.method || 'GET'} ${url} returned ${response.status}: ${body.message || body.error || 'unknown error'}`);
  return body;
}

function safeReaddirSync(path, options) {
  try { return readdirSync(path, options); } catch { return []; }
}

function playwrightChromiumExecutableCandidates() {
  const explicitPath = process.env.HOFS_PLAYWRIGHT_CHROMIUM || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '';
  const localPlaywrightPath = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : '';
  const localHeadlessShells = localPlaywrightPath && existsSync(localPlaywrightPath)
    ? safeReaddirSync(localPlaywrightPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^chromium_headless_shell-/.test(entry.name))
      .map(entry => join(localPlaywrightPath, entry.name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'))
      .filter(candidate => existsSync(candidate))
      .sort()
      .reverse()
    : [];
  return [explicitPath, ...localHeadlessShells].filter(Boolean);
}

async function launchValidationBrowser() {
  const optionSets = [
    { headless: true },
    ...playwrightChromiumExecutableCandidates().map(executablePath => ({ headless: true, executablePath })),
    { channel: 'msedge', headless: true },
  ];
  let lastError = null;
  for (const options of optionSets) {
    try { return await chromium.launch(options); } catch (error) { lastError = error; }
  }
  throw lastError;
}

rmSync(TEMP_ROOT, { recursive: true, force: true });
mkdirSync(join(WORKSPACE_PATH, 'docs'), { recursive: true });
mkdirSync(join(WORKSPACE_PATH, 'src'), { recursive: true });
writeFileSync(join(WORKSPACE_PATH, 'README.md'), '# Local project workspace\n', 'utf8');
writeFileSync(join(WORKSPACE_PATH, 'docs', 'brief.md'), '# Initial brief\nAgent-owned project evidence.\n', 'utf8');
writeFileSync(join(WORKSPACE_PATH, 'src', 'App.jsx'), 'export default function App() { return null; }\n', 'utf8');
writeFileSync(join(WORKSPACE_PATH, 'data.json'), '{"status":"local"}\n', 'utf8');
writeFileSync(join(WORKSPACE_PATH, 'cover.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
writeFileSync(OUTSIDE_PATH, 'must remain outside', 'utf8');

const projectRuntime = createLocalProjectRuntime({ rootPath: join(TEMP_ROOT, 'runtime') });
const backendServer = createAgentProjectHttpServer({
  filePath: STORE_PATH,
  localAuthFilePath: AUTH_PATH,
  localAuthRequired: true,
  replaceWithSeed: true,
  projectRuntime,
});
const backendRuntime = await backendServer.listen();
const staticServer = createStaticServer();
const staticUrl = await listenStatic(staticServer);
let browser = null;
const consoleErrors = [];
const pageErrors = [];

try {
  const bootstrap = await fetchJson(`${backendRuntime.url}/local-auth/bootstrap`, '', {
    method: 'POST',
    body: JSON.stringify({ username: 'workspace-validator', password: 'workspace-audit-1', displayName: 'Workspace Validator' }),
  });
  const authSession = { ...bootstrap.localAuth, baseUrl: backendRuntime.url };
  const token = authSession.token;

  await fetchJson(`${backendRuntime.url}/projects/initiate`, token, {
    method: 'POST',
    body: JSON.stringify({
      includeReadModels: false,
      projectId: PROJECT_ID,
      name: PROJECT_NAME,
      brief: 'Verify that the Dashboard manages the selected local workspace folder.',
      team: [
        { id: 'leader', name: 'Local Leader', role: 'Project Lead', isLeader: true },
        { id: 'builder', name: 'Local Builder', role: 'Builder' },
      ],
      selectedLeaderId: 'leader',
      reviewerId: 'builder',
      now: '2026-07-20T14:00:00.000Z',
    }),
  });
  await fetchJson(`${backendRuntime.url}/projects/${PROJECT_ID}/workspace/bind`, token, {
    method: 'POST',
    body: JSON.stringify({ workspacePath: WORKSPACE_PATH, createIfMissing: false, now: '2026-07-20T14:01:00.000Z' }),
  });

  browser = await launchValidationBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
  await context.addInitScript(({ authSession: session, authStorageKey, backendStorageKey, backendUrl, languageStorageKey }) => {
    window.__AGENT_BACKEND_URL__ = backendUrl;
    window.localStorage.setItem(backendStorageKey, JSON.stringify(backendUrl));
    window.localStorage.setItem(languageStorageKey, 'en');
    window.sessionStorage.setItem(authStorageKey, JSON.stringify(session));
  }, {
    authSession,
    authStorageKey: LOCAL_AUTH_STORAGE_KEY,
    backendStorageKey: BACKEND_STORAGE_KEY,
    backendUrl: backendRuntime.url,
    languageStorageKey: LANGUAGE_STORAGE_KEY,
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

  await page.goto(staticUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: new RegExp(PROJECT_NAME, 'i') }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: new RegExp(PROJECT_NAME, 'i') }).click();
  await page.getByTestId('project-dashboard-view').waitFor({ state: 'visible', timeout: 30000 });
  const workspaceSection = page.getByTestId('project-dashboard-workspace-section');
  await workspaceSection.waitFor({ state: 'visible', timeout: 10000 });
  assert(await page.getByTestId('project-open-workspace').count() === 0, 'Workspace must be an always-visible Dashboard section, not an opener-controlled drawer.');

  const rootRow = page.getByTestId('workspace-tree-entry-.');
  await rootRow.waitFor({ state: 'visible', timeout: 10000 });
  assert(await rootRow.getAttribute('aria-expanded') === 'true', 'Workspace root must open expanded.');
  await page.getByTestId('workspace-tree-entry-docs').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('workspace-tree-entry-src').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('workspace-tree-entry-cover.png').waitFor({ state: 'visible', timeout: 10000 });

  renameSync(join(WORKSPACE_PATH, 'README.md'), join(WORKSPACE_PATH, '项目说明.md'));
  const localRenameStartedAt = Date.now();
  await page.getByTestId('workspace-tree-entry-项目说明.md').waitFor({ state: 'visible', timeout: 1200 });
  const localRenameLatencyMs = Date.now() - localRenameStartedAt;
  assert(localRenameLatencyMs < 1200, 'A local rename must reach the Dashboard through the live filesystem mirror, not a polling interval.');
  assert(await page.getByTestId('workspace-tree-entry-README.md').count() === 0, 'The Dashboard must remove the old name after a local rename.');

  await page.getByTestId('workspace-tree-entry-项目说明.md').click();
  const mirroredEditor = page.getByTestId('workspace-file-editor');
  await mirroredEditor.waitFor({ state: 'visible', timeout: 10000 });
  writeFileSync(join(WORKSPACE_PATH, '项目说明.md'), '# 本地内容已实时更新\n', 'utf8');
  const localContentStartedAt = Date.now();
  await page.waitForFunction(
    expected => document.querySelector('[data-testid="workspace-file-editor"]')?.value === expected,
    '# 本地内容已实时更新\n',
    { timeout: 1200 },
  );
  const localContentLatencyMs = Date.now() - localContentStartedAt;
  assert(localContentLatencyMs < 1200, 'A local content edit must update the open Dashboard editor through the live filesystem mirror.');

  writeFileSync(join(WORKSPACE_PATH, '本地新增研究记录.md'), '# Added outside the Dashboard\n', 'utf8');
  const localCreateStartedAt = Date.now();
  await page.getByTestId('workspace-tree-entry-本地新增研究记录.md').waitFor({ state: 'visible', timeout: 1200 });
  const localCreateLatencyMs = Date.now() - localCreateStartedAt;
  assert(
    await page.getByTestId('workspace-tree-entry-本地新增研究记录.md').getByText('本地新增研究记录.md', { exact: true }).isVisible(),
    'Workspace must preserve the exact Unicode filename created in the bound local folder.',
  );

  await rootRow.click();
  const createFileButton = page.getByRole('button', { name: 'File', exact: true });
  await createFileButton.click();
  const newFileDialog = page.getByRole('dialog', { name: 'New file' });
  await newFileDialog.waitFor({ state: 'visible', timeout: 10000 });
  const newFileName = newFileDialog.getByRole('textbox', { name: 'Name' });
  assert(await newFileName.evaluate(element => element === document.activeElement), 'New-file dialog must focus its name field.');
  await newFileName.press('Escape');
  await newFileDialog.waitFor({ state: 'hidden', timeout: 10000 });
  assert(await workspaceSection.isVisible(), 'Escape in the file-action dialog must keep the Workspace section visible.');
  assert(await createFileButton.evaluate(element => element === document.activeElement), 'Closing the file-action dialog must restore focus to its opener.');

  await page.getByRole('button', { name: 'Expand docs' }).click();
  const briefRow = page.getByTestId('workspace-tree-entry-docs/brief.md');
  await briefRow.waitFor({ state: 'visible', timeout: 10000 });
  await briefRow.click();
  const editor = page.getByTestId('workspace-file-editor');
  await editor.waitFor({ state: 'visible', timeout: 10000 });
  await editor.fill('# Updated from Dashboard\nLocal workspace remains the source of truth.\n');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Saved to local Workspace'), null, { timeout: 10000 });
  assert(readFileSync(join(WORKSPACE_PATH, 'docs', 'brief.md'), 'utf8').includes('Updated from Dashboard'), 'Dashboard save must update the selected local file.');

  await rootRow.click();
  await page.getByRole('button', { name: 'Folder', exact: true }).click();
  const nameInput = page.getByRole('dialog', { name: 'New folder' }).getByRole('textbox', { name: 'Name' });
  await nameInput.fill('review-notes');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByTestId('workspace-tree-entry-review-notes').waitFor({ state: 'visible', timeout: 10000 });
  assert(readFileSync(OUTSIDE_PATH, 'utf8') === 'must remain outside', 'Workspace UI must leave the outside sentinel untouched.');

  const renamedWorkspacePath = join(TEMP_ROOT, 'renamed-workspace');
  renameSync(WORKSPACE_PATH, renamedWorkspacePath);
  const rootRenameStartedAt = Date.now();
  await rootRow.getByText('renamed-workspace', { exact: true }).waitFor({ state: 'visible', timeout: 1200 });
  const rootRenameLatencyMs = Date.now() - rootRenameStartedAt;
  assert(rootRenameLatencyMs < 1200, 'Renaming the bound root folder locally must update the Dashboard binding immediately.');

  assert(consoleErrors.length === 0, `Workspace UI emitted console diagnostics:\n${consoleErrors.join('\n')}`);
  assert(pageErrors.length === 0, `Workspace UI emitted page errors:\n${pageErrors.join('\n')}`);
  console.log(`Project Dashboard local Workspace UI validation passed (rename ${localRenameLatencyMs}ms, content ${localContentLatencyMs}ms, create ${localCreateLatencyMs}ms, root rename ${rootRenameLatencyMs}ms).`);
} catch (error) {
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) await page.screenshot({ path: join(TEMP_ROOT, 'failure.png'), fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await backendServer.close().catch(() => {});
  await new Promise(resolveClose => staticServer.close(resolveClose)).catch(() => {});
  rmSync(TEMP_ROOT, { recursive: true, force: true });
}
